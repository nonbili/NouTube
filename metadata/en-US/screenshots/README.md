# Store screenshots

Six English screenshots each for Android, iPhone, iPad, and Windows desktop highlight
channel feeds, distraction controls, keyword/channel blocklist, local library folders,
privacy-first watch history, and advanced playback controls.
Android and iPad also show playback speed and quality controls; iPhone shows
subscription and playlist import; Windows desktop highlights multi-tab browsing with
a native Windows 11 title bar and zero direct YouTube / YouTube Music branding to
comply with Microsoft Store certification requirements.

- Android exports: `../images/phoneScreenshots/1.jpg` through `6.jpg`, 1080 × 1920 RGB JPEG.
- iPhone exports: `../../../fastlane/metadata/ios/en-US/01-playback.png` through `06-import.png`, 1320 × 2868 RGB PNG.
- iPad exports: `../../../fastlane/metadata/ios/en-US/ipad-*.png`, 2064 × 2752 RGB PNG.
- Windows desktop exports (direct app window): `../../../mstore/01-feeds.png` (and `1.png`) through `06-controls.png` (and `6.png`), 1920 × 1080 RGB PNG.
- Windows promo exports: `../../../mstore/promo/01-feeds.png` through `06-controls.png`, 1920 × 1080 RGB PNG.
- Review: open `preview.html`, `../../../mstore/preview-sheet.jpg`, or the platform contact sheets.

Run `python3 metadata/en-US/screenshots/render.py` from the repository root with
Pillow installed. Use `--platform ios`, `--platform ipad`, `--platform android`, or `--platform windows` for one platform.
To regenerate the uncropped Windows source captures directly from the desktop renderer, run:
`bun scripts/generate-windows-screenshots.ts`.

The images show real platform UI without including YouTube or YouTube Music logos directly.
Feed entries and lunar imagery are NASA Goddard's *Tour of the Moon in 4K*
([visualization credit](https://svs.gsfc.nasa.gov/4619/)).

See [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/),
[Google Play preview asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en),
and [Microsoft Store screenshot requirements](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-screenshots-and-images).
