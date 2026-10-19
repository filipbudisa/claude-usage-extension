# Claude Code usage extension
![GNOME Shell 48-50](https://img.shields.io/badge/GNOME%20Shell-48--50-blue)

A GNOME Shell extension that displays your Claude Code API usage percentage in the top panel.

## Fork of Haletran's extension

This is a fork of [Haletran's claude-usage-extension](https://github.com/Haletran/claude-usage-extension).
I forked it to make it work on my own setup and with my own requirements.
Originally ported to the GNOME 42-era API, it has since been ported forward to
the ES-module extension API (GNOME 45+) and currently targets GNOME Shell 48-50.

**All changes were vibe-coded using Claude (with reasonable review and testing).**

### Changes made

- Ported the extension to GNOME Shell 48-50 (ESM API, libadwaita preferences)
- Added a manual **Refresh** button to the popup
- Added **Dash to Panel** support with a per-monitor screen selector (only shown when Dash to Panel is installed)
- Rendered the popup progress bars with Cairo for reliable fills

## Features

- **Real-time usage monitoring** - View your 5-hour and 7-day Claude Code usage
- **Manual refresh** - A Refresh button in the popup forces an immediate update
- **Dash to Panel support** - When [Dash to Panel](https://extensions.gnome.org/extension/1160/dash-to-panel/) is installed, pick which monitor's panel shows the indicator (screen selector in preferences)
- **Settings menu** - Change the layout or the refresh time

## Requirements

- GNOME Shell 48-50 (developed and tested on GNOME 50)
- Claude Code installed and authenticated (`~/.claude/.credentials.json`)
- _Optional:_ [Dash to Panel](https://extensions.gnome.org/extension/1160/dash-to-panel/) for the per-monitor screen selector

## Installation

This fork is not published on *extensions.gnome.org*. Install it manually:

```bash
git clone https://github.com/filipbudisa/claude-usage-extension
cp -r claude-usage-extension ~/.local/share/gnome-shell/extensions/claude-code-usage@haletran.com
cd ~/.local/share/gnome-shell/extensions/claude-code-usage@haletran.com/schemas
glib-compile-schemas .
```

Then restart GNOME Shell (Alt + F2, type `r`, Enter - or log out and back in) and enable the extension.
