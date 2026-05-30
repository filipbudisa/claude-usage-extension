'use strict';

const { Gtk, Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

function init() {}

function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings();

    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 20, margin_bottom: 20,
        margin_start: 20, margin_end: 20,
        spacing: 14,
    });

    function addRow(labelText, widget) {
        const row = new Gtk.Box({ spacing: 12 });
        row.append(new Gtk.Label({ label: labelText, xalign: 0, hexpand: true }));
        row.append(widget);
        box.append(row);
    }

    // Refresh interval
    const intervalSpin = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({ lower: 10, upper: 600, step_increment: 10,
            value: settings.get_int('refresh-interval') }),
        numeric: true,
    });
    settings.bind('refresh-interval', intervalSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
    addRow('Refresh interval (seconds)', intervalSpin);

    // Display mode
    const displayCombo = new Gtk.ComboBoxText();
    displayCombo.append('text', 'Text (percentage)');
    displayCombo.append('bar', 'Progress Bar');
    displayCombo.append('both', 'Both');
    displayCombo.set_active_id(settings.get_string('display-mode'));
    displayCombo.connect('changed', () => settings.set_string('display-mode', displayCombo.get_active_id()));
    addRow('Display mode', displayCombo);

    // Icon style
    const iconCombo = new Gtk.ComboBoxText();
    iconCombo.append('color', 'Color');
    iconCombo.append('monochrome', 'Monochrome');
    iconCombo.set_active_id(settings.get_string('icon-style'));
    iconCombo.connect('changed', () => settings.set_string('icon-style', iconCombo.get_active_id()));
    addRow('Icon style', iconCombo);

    // Show icon
    const showIconSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    settings.bind('show-icon', showIconSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    addRow('Show icon', showIconSwitch);

    // Proxy URL
    const proxyEntry = new Gtk.Entry({
        text: settings.get_string('proxy-url'),
        placeholder_text: 'http://localhost:11809 (leave empty for direct)',
        width_chars: 36,
    });
    proxyEntry.connect('changed', () => settings.set_string('proxy-url', proxyEntry.get_text()));
    addRow('Proxy URL', proxyEntry);

    return box;
}
