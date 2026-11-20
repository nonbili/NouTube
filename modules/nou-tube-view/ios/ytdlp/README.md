# iOS yt-dlp

iOS builds bundle CPython, yt-dlp, and CA certificates by default. Before `pod install` or building iOS locally, fetch the vendored runtime once:

```sh
bash scripts/prepare-ios-ytdlp.sh
bun run bundle
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
npx expo run:ios --configuration Release
```

Use the download button on a YouTube watch page, or open Tools and paste a video URL. It downloads a single progressive MP4 when available. Once it finishes, tap **Export** and choose **Save to Files**. Test only with media you have permission to download from the source.

It has no format picker, cookies, FFmpeg, JS challenge solver, or yt-dlp self-update. Some videos will not provide a compatible progressive MP4 format.
