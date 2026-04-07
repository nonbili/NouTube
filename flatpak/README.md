# Local Flatpak Testing

This directory contains a manifest adapted for local testing of the Flatpak build.

## Prerequisites

1.  **Flatpak & flatpak-builder**: Ensure you have them installed on your system.
2.  **Runtimes**: Install the necessary runtimes and SDKs:
    ```bash
    flatpak install flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08
    ```
3.  **Local Dependencies**: Since this manifest uses `type: dir` for the source, it will include your local `node_modules`. Make sure you have run `bun install` in the project root.

## Building

To build the Flatpak locally:

```bash
flatpak-builder --user --install --force-clean build-dir flatpak/jp.nonbili.noutube.yml
```

## Running

Once installed, you can run it via:

```bash
flatpak run jp.nonbili.noutube-dev
```

## Manifest Changes for Local Testing

- App ID changed to `jp.nonbili.noutube-dev` to avoid conflicts with stable installation.
- Changed source `type` to `dir` pointing to the project root.
- Added `--filesystem=xdg-download` to `finish-args` to allow the app to save videos to the standard Downloads folder.
- Added `--talk-name=org.freedesktop.FileManager1` to `finish-args` to enable Electron's "show item in folder" functionality on the host.
- Removed external `source.tar.gz` and `node_modules` archives to use local files instead.
