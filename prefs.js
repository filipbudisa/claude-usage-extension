'use strict';

import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const DASH_TO_PANEL_UUID = 'dash-to-panel@jderose9.github.com';

// Prefs run in a separate process without `global`, so check GNOME Shell's
// list of enabled extensions to know whether Dash to Panel is active.
function _dashToPanelEnabled() {
    try {
        return Gio.Settings.new('org.gnome.shell')
            .get_strv('enabled-extensions')
            .includes(DASH_TO_PANEL_UUID);
    } catch (_) {
        return false;
    }
}

export default class ClaudeUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        page.add(group);
        window.add(page);

        // Refresh interval
        const intervalRow = new Adw.SpinRow({
            title: 'Refresh interval',
            subtitle: 'Seconds',
            adjustment: new Gtk.Adjustment({
                lower: 10, upper: 600, step_increment: 10,
                value: settings.get_int('refresh-interval'),
            }),
        });
        settings.bind('refresh-interval', intervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(intervalRow);

        // String-keyed combo rows (Adw.ComboRow selects by index, GSettings
        // stores an id string, so map between the two).
        const addComboRow = (title, key, entries) => {
            const row = new Adw.ComboRow({
                title,
                model: Gtk.StringList.new(entries.map(([, label]) => label)),
            });
            const ids = entries.map(([id]) => id);
            row.selected = Math.max(0, ids.indexOf(settings.get_string(key)));
            row.connect('notify::selected', () => settings.set_string(key, ids[row.selected]));
            group.add(row);
        };

        addComboRow('Display mode', 'display-mode', [
            ['text', 'Text (percentage)'],
            ['bar', 'Progress Bar'],
            ['both', 'Both'],
        ]);

        addComboRow('Icon style', 'icon-style', [
            ['color', 'Color'],
            ['monochrome', 'Monochrome'],
        ]);

        // Show icon
        const showIconRow = new Adw.SwitchRow({ title: 'Show icon' });
        settings.bind('show-icon', showIconRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(showIconRow);

        // Monitor — only meaningful with Dash to Panel, which provides a panel
        // on each monitor. On the stock top bar there is only one panel
        // (primary), so the setting can't move the indicator. Hide the row
        // when DtP is absent.
        if (_dashToPanelEnabled()) {
            const nMonitors = Gdk.Display.get_default()?.get_monitors().get_n_items() ?? 1;
            const labels = [];
            for (let i = 0; i < nMonitors; i++)
                labels.push(i === 0 ? 'Monitor 0 (primary)' : `Monitor ${i}`);
            const monitorRow = new Adw.ComboRow({
                title: 'Monitor',
                model: Gtk.StringList.new(labels),
            });
            monitorRow.selected = Math.min(Math.max(0, settings.get_int('monitor')), nMonitors - 1);
            monitorRow.connect('notify::selected', () => settings.set_int('monitor', monitorRow.selected));
            group.add(monitorRow);
        }

        // Proxy URL
        const proxyRow = new Adw.EntryRow({
            title: 'Proxy URL (empty for direct, e.g. http://localhost:11809)',
        });
        settings.bind('proxy-url', proxyRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(proxyRow);
    }
}
