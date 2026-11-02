# Rigel

**English** · [Türkçe](README.tr.md)

A personal web browser built on Firefox (Gecko), inspired by [Zen Browser](https://zen-browser.app/).
Rigel doesn't compile Firefox: it combines Mozilla's official Firefox build, [fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig) and its own interface code (`src/rigel/`).
Everything Firefox does (codecs, extensions, Picture-in-Picture) keeps working as is. The interface is in Turkish.

<p align="center">
  <img src="docs/ekran/ada.png" alt="Rigel's Ada layout: a single top strip, bookmarks bar and a Wikipedia page" width="900">
</p>

## Features

- **Five layouts:** Ada, Orbit Dock, Command, Side Panel and Classic. Switch with `Ctrl+Shift+L`, no restart needed.
- **Palette (`Ctrl+K`):** address, search, open tabs, history and bookmarks, 65 commands and `!bang` shortcuts (`!yt`, `!w`, `!gh`…).
- **Zen-style features:** Glance (Alt+click), compact mode, workspaces (`Ctrl+Alt+1..9`), Essentials, tab groups, containers.
- **Appearance studio:** corners, density, fonts, glass, shadows, borders, tab styles, toolbar buttons, background image or gradient, custom colors for every surface, and theme packs you can save and share.
- **Customizable new tab:** edit mode with widgets, your own shortcuts, layouts and a photo background.
- **Mods and mod store:** CSS mods for the browser and for websites, with settings, per-layout support and conflict warnings.
- **Session restore:** if you start with a new tab, the previous session is still one click away.
- **Privacy:** telemetry, studies, Pocket, sponsored suggestions and Firefox accounts are off. uBlock Origin, SponsorBlock and Dark Reader are installed on first run (you can remove them).

## Screenshots

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/ekran/klasik.png" alt="Classic layout"><br>
      <sub><b>Classic</b> Horizontal tabs, address bar and bookmarks on top: the layout you already know.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/ekran/yanpanel.png" alt="Side Panel layout"><br>
      <sub><b>Side Panel</b> Vertical tabs and address on the left; the page gets the full height.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/ekran/palet.png" alt="Ctrl+K palette"><br>
      <sub><b>Palette (Ctrl+K)</b> Open tabs, bookmarks, history and commands in one box.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/ekran/yeni-sekme.png" alt="New tab page"><br>
      <sub><b>New tab</b> Photo background, clock, greeting and shortcuts.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/ekran/gorunum.png" alt="Appearance studio"><br>
      <sub><b>Appearance studio</b> Corners, density, fonts, background and theme packs, applied live.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/ekran/brutal.png" alt="Brutal theme pack"><br>
      <sub><b>Brutal theme</b> Thick borders and hard shadows, with separate dark and light palettes.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/ekran/ayarlar.png" alt="Settings, appearance page"><br>
      <sub><b>Settings</b> Layout, theme and accent color in one place.</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/ekran/modlar.png" alt="Mod store"><br>
      <sub><b>Mod store</b> Restyle the browser and websites with CSS mods.</sub>
    </td>
  </tr>
</table>

## Install

### Quick install

**Linux (x86_64):** downloads the latest release, checks its SHA256 and installs it. Run it again to update.

```bash
curl -fsSL https://raw.githubusercontent.com/oktayyavuz/RigelWebBrowser/main/kur.sh | bash
```

**Windows (x64, PowerShell):** downloads, verifies and runs the latest installer. No admin rights needed.

```powershell
irm https://raw.githubusercontent.com/oktayyavuz/RigelWebBrowser/main/kur.ps1 | iex
```

**Arch Linux:** the AUR package isn't published yet. Until then you can build it from the PKGBUILD in this repo:

```bash
git clone https://github.com/oktayyavuz/RigelWebBrowser && cd RigelWebBrowser/packaging/aur && makepkg -si
```

Ready-made files (tar.xz, AppImage, Windows installer and zip) are on the [Releases](https://github.com/oktayyavuz/RigelWebBrowser/releases/latest) page.

| File | How to use |
|---|---|
| `rigel-<version>-linux-x86_64.tar.xz` | Extract and run `./install.sh` (no internet needed). `./bin/rigel` runs it without installing. |
| `rigel-<version>-x86_64.AppImage` | `chmod +x` and run. |
| `rigel-<version>-windows-x64-setup.exe` | Double-click. Installs per user. The installer isn't signed, so SmartScreen may warn you. |
| `rigel-<version>-windows-x64.zip` | Portable: extract anywhere and run `Rigel.cmd`. |

The profile lives in `~/.local/share/rigel/profile` on Linux and `%LOCALAPPDATA%\Rigel\profile` on Windows. Updating or uninstalling keeps it.

### From source (Linux)

```bash
git clone https://github.com/oktayyavuz/RigelWebBrowser
cd RigelWebBrowser
./install.sh
```

No root needed. `install.sh` downloads the pinned Firefox version (`FIREFOX_VERSION`, Turkish, x86_64) from `archive.mozilla.org`, verifies it against Mozilla's `SHA256SUMS`, installs everything into `~/.local/share/rigel/` and adds a `rigel` launcher and a desktop entry. It does not change your default browser; to do that, run `xdg-settings set default-web-browser rigel.desktop`.

- Update: `git pull && ./install.sh --guncelle`
- Uninstall: `./uninstall.sh` (keeps your profile) or `./uninstall.sh --profil-de` (removes it too)
- Arch package from source: `cd packaging/arch && makepkg -si` (installs to `/opt/rigel`, command `rigel`)

Requirements: `curl` or `wget`, `tar`, `xz`, `sha256sum`, and `ffmpeg` for video.

## Building release files

Rigel doesn't compile Firefox. A "build" packages Mozilla's official binaries together with Rigel:

```bash
scripts/build.sh [linux|windows|all]    # output goes to dist/
```

Requirements: `bash`, `curl`/`wget`, `tar`, `xz`, `sha256sum`, `python3`; for Windows also `7z`, plus `wine` for the installer (without it only the zip is built). Downloads are verified against Mozilla's `SHA256SUMS` and cached in `~/.cache/rigel-build`. Set `RIGEL_APPIMAGE=1` to build the AppImage as well.

## Development

```bash
proto/setup.sh   # once: downloads Firefox into proto/firefox and sets up a dev profile
proto/run.sh     # starts Rigel with proto/profile (clears the startup cache)
node --test 'src/rigel/search/tests/*.test.mjs' 'src/rigel/l10n/tests/*.test.mjs'
```

The entry point is `src/rigel/rigel.uc.mjs`. Default prefs are in `prefs/rigel.js`, policies in `distribution/policies.json`. Use the Browser Toolbox (`Ctrl+Alt+Shift+I`) for debugging. The mod format is described in `src/rigel/mods/STORE.md`.

## Known limitations

- Some Firefox traces remain: the version number, the About dialog and `about:` pages.
- Firefox Sync is off.
- The Windows build is new; please report any problems.

## License

- Rigel code: **MPL-2.0** ([LICENSE](LICENSE)).
- **Firefox** is downloaded from Mozilla. Firefox is a trademark of the Mozilla Foundation; Rigel is not affiliated with or endorsed by Mozilla.
- **fx-autoconfig** by [MrOtherGuy](https://github.com/MrOtherGuy/fx-autoconfig): MPL-2.0, `vendor/fx-autoconfig/LICENSE`.
- 9 mods in the mod store are adapted from MIT-licensed mods in the [Zen theme store](https://github.com/zen-browser/theme-store); their notices are kept in the mod files.
