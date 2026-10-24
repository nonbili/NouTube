# Store screenshots

Six English screenshots each for Android, iPhone, and iPad highlight ad blocking,
background playback, channel feeds, distraction controls, and keyword filtering.
Android and iPad also show playback speed and quality controls; iPhone shows
subscription and playlist import. iPad images use the native 13-inch tablet layout.

- Android exports: `../images/phoneScreenshots/1.jpg` through `6.jpg`, 1080 × 1920 RGB JPEG.
- iPhone exports: `../../../fastlane/metadata/ios/en-US/01-playback.png` through `06-import.png`, 1320 × 2868 RGB PNG.
- iPad exports: `../../../fastlane/metadata/ios/en-US/ipad-*.png`, 2064 × 2752 RGB PNG.
- Review: open `preview.html`, or the platform contact sheets.

Run `python3 metadata/en-US/screenshots/render.py` from the repository root with
Pillow installed. Use `--platform ios`, `--platform ipad`, or `--platform android` for one platform.
The renderer uses macOS Arial fonts. The phone screen intentionally extends below
the canvas; original captures remain uncropped under `source/`.

The images show real platform UI. iOS feed, distraction, and blocklist sources
come from the original full-resolution simulator recordings in
`../app-preview/captures/`; other sources are native screenshots. The iPad simulator reuses the iPhone demo
settings and saved NASA channel data, rendered in the actual iPad layout. Feed entries
are live NASA uploads. Lunar imagery is NASA Goddard's *Tour of the Moon in 4K*
([visualization credit](https://svs.gsfc.nasa.gov/4619/)).

The twelve iPhone/iPad exports were uploaded to App Store Connect version
0.6.13 (en-US); see `../app-preview/app-store-upload.json` for the upload receipt.
The renderer itself only writes local files.
See [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
and [Google Play preview asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
