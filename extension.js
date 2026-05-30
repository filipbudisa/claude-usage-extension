'use strict';

imports.gi.versions.Soup = '3.0';

const { GLib, GObject, Gio, St, Clutter } = imports.gi;
const Soup = imports.gi.Soup;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Me = ExtensionUtils.getCurrentExtension();
const API_URL = 'https://api.anthropic.com/api/oauth/usage';

let _indicator = null;

const ClaudeUsageIndicator = GObject.registerClass(
class ClaudeUsageIndicator extends PanelMenu.Button {
    _init(extensionPath, settings) {
        super._init(0.0, 'Claude Usage Indicator');

        this._extensionPath = extensionPath;
        this._settings = settings;
        this._session = this._createSession();
        this._timerId = null;

        this._box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });

        const iconPath = GLib.build_filenamev([this._extensionPath, 'claude-icon-22.png']);
        const gicon = Gio.icon_new_for_string(iconPath);
        this._icon = new St.Icon({
            gicon,
            style_class: 'claude-icon',
            icon_size: 16,
        });
        this._box.add_child(this._icon);

        this._panelProgressBg = new St.Widget({
            style_class: 'claude-panel-progress-bg',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._panelProgressBar = new St.Widget({ style_class: 'claude-panel-progress-bar' });
        this._panelProgressBg.add_child(this._panelProgressBar);
        this._box.add_child(this._panelProgressBg);

        this._label = new St.Label({
            text: '...',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'claude-usage-label',
        });
        this._box.add_child(this._label);
        this.add_child(this._box);

        this._createMenu();
        this._updateDisplayMode();
        this._updateIconVisibility();
        this._updateIconStyle();

        this._settingsChangedId = this._settings.connect('changed', (_s, key) => {
            if (key === 'refresh-interval') this._restartTimer();
            else if (key === 'display-mode') this._updateDisplayMode();
            else if (key === 'show-icon') this._updateIconVisibility();
            else if (key === 'proxy-url') this._recreateSession();
            else if (key === 'icon-style') this._updateIconStyle();
        });

        this._refreshUsage();
        this._startTimer();
    }

    _updateDisplayMode() {
        const mode = this._settings.get_string('display-mode');
        if (mode === 'bar') {
            this._panelProgressBg.show();
            this._label.hide();
            this._label.set_style('margin-left: 0;');
        } else if (mode === 'both') {
            this._panelProgressBg.show();
            this._label.show();
            this._label.set_style('margin-left: 6px;');
        } else {
            this._panelProgressBg.hide();
            this._label.show();
            this._label.set_style('margin-left: 0;');
        }
    }

    _updateIconVisibility() {
        if (this._settings.get_boolean('show-icon'))
            this._icon.show();
        else
            this._icon.hide();
    }

    _updateIconStyle() {
        const style = this._settings.get_string('icon-style');
        const desatName = 'monochrome-desaturate';
        const hasEffect = this._icon.get_effect(desatName) !== null;
        if (style === 'monochrome' && !hasEffect) {
            this._icon.add_effect(new Clutter.DesaturateEffect({ factor: 1.0, name: desatName }));
        } else if (style !== 'monochrome' && hasEffect) {
            this._icon.remove_effect_by_name(desatName);
        }
    }

    _createSession() {
        const session = new Soup.Session();
        const proxyUrl = this._settings.get_string('proxy-url');
        if (proxyUrl?.trim()) {
            session.set_proxy_resolver(Gio.SimpleProxyResolver.new(proxyUrl.trim(), null));
        }
        return session;
    }

    _recreateSession() {
        this._session?.abort();
        this._session = this._createSession();
        this._refreshUsage();
    }

    _createMenu() {
        const mkSection = (title) => {
            const box = new St.BoxLayout({ style_class: 'claude-usage-section', vertical: true });

            const header = new St.BoxLayout({ vertical: false });
            header.add_child(new St.Label({ text: title, style_class: 'claude-section-title' }));
            const pct = new St.Label({
                text: '...',
                style_class: 'claude-percent-label',
                x_expand: true,
                x_align: Clutter.ActorAlign.END,
            });
            header.add_child(pct);
            box.add_child(header);

            const progressBg = new St.Widget({ style_class: 'claude-progress-bg' });
            const progressBar = new St.Widget({ style_class: 'claude-progress-bar usage-low' });
            progressBg.add_child(progressBar);
            box.add_child(progressBg);

            const resetLabel = new St.Label({ text: 'Resets: ...', style_class: 'claude-reset-label' });
            box.add_child(resetLabel);

            const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
            item.add_child(box);
            this.menu.addMenuItem(item);

            return { pct, progressBar, resetLabel };
        };

        this._fiveHour = mkSection('5-Hour Usage');
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._sevenDay = mkSection('7-Day Usage');
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => ExtensionUtils.openPrefs());
        this.menu.addMenuItem(settingsItem);
    }

    _startTimer() {
        const interval = this._settings.get_int('refresh-interval');
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this._refreshUsage();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTimer() {
        if (this._timerId) { GLib.source_remove(this._timerId); this._timerId = null; }
    }

    _restartTimer() { this._stopTimer(); this._startTimer(); }

    _refreshUsage() {
        const configDir = GLib.getenv('CLAUDE_CONFIG_DIR') ??
            GLib.build_filenamev([GLib.get_home_dir(), '.claude']);
        const credPath = GLib.build_filenamev([configDir, '.credentials.json']);

        Gio.File.new_for_path(credPath).load_contents_async(null, (_file, result) => {
            try {
                const [, contents] = _file.load_contents_finish(result);
                const json = JSON.parse(new TextDecoder().decode(contents));
                const token = json.claudeAiOauth?.accessToken;
                if (!token) { this._setError('No token'); return; }
                this._fetchUsage(token);
            } catch (e) {
                this._setError('No credentials');
            }
        });
    }

    _fetchUsage(token) {
        const message = Soup.Message.new('GET', API_URL);
        message.request_headers.append('Authorization', `Bearer ${token}`);
        message.request_headers.append('anthropic-beta', 'oauth-2025-04-20');

        this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result) => {
            try {
                const bytes = _session.send_and_read_finish(result);
                if (message.status_code !== 200) { this._setError(`HTTP ${message.status_code}`); return; }
                this._updateDisplay(JSON.parse(new TextDecoder().decode(bytes.get_data())));
            } catch (e) {
                this._setError('Error');
            }
        });
    }

    _setError(msg) {
        this._label.set_text(msg);
        this._fiveHour.pct.set_text(msg);
        this._sevenDay.pct.set_text('—');
    }

    _updateDisplay(data) {
        const fh = data.five_hour?.utilization ?? 0;
        const sd = data.seven_day?.utilization ?? 0;

        this._label.set_text(`${Math.round(fh)}%`);
        this._updatePanelBar(fh);

        this._fiveHour.pct.set_text(`${fh.toFixed(1)}%`);
        this._updateBar(this._fiveHour.progressBar, fh);
        if (data.five_hour?.resets_at)
            this._fiveHour.resetLabel.set_text(`Resets in ${this._formatReset(data.five_hour.resets_at)}`);

        this._sevenDay.pct.set_text(`${sd.toFixed(1)}%`);
        this._updateBar(this._sevenDay.progressBar, sd);
        if (data.seven_day?.resets_at)
            this._sevenDay.resetLabel.set_text(`Resets in ${this._formatReset(data.seven_day.resets_at)}`);
    }

    _updatePanelBar(usage) {
        this._panelProgressBar.set_width(Math.round(Math.min(100, Math.max(0, usage)) / 100 * 50));
    }

    _updateBar(bar, usage) {
        bar.set_width(Math.round(Math.min(100, Math.max(0, usage)) / 100 * 200));
        ['usage-low', 'usage-medium', 'usage-high', 'usage-critical'].forEach(c => bar.remove_style_class_name(c));
        if (usage >= 90) bar.add_style_class_name('usage-critical');
        else if (usage >= 70) bar.add_style_class_name('usage-high');
        else if (usage >= 40) bar.add_style_class_name('usage-medium');
        else bar.add_style_class_name('usage-low');
    }

    _formatReset(iso) {
        try {
            const diff = new Date(iso) - new Date();
            if (diff < 0) return 'now';
            const m = Math.floor(diff / 60000);
            const h = Math.floor(m / 60);
            const d = Math.floor(h / 24);
            if (d > 0) return `${d}d ${h % 24}h`;
            if (h > 0) return `${h}h ${m % 60}m`;
            return `${m}m`;
        } catch (_) { return '—'; }
    }

    destroy() {
        this._stopTimer();
        this._session?.abort();
        this._session = null;
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

function init() {}

function enable() {
    _indicator = new ClaudeUsageIndicator(Me.path, ExtensionUtils.getSettings());
    Main.panel.addToStatusArea(Me.uuid, _indicator);
}

function disable() {
    _indicator?.destroy();
    _indicator = null;
}
