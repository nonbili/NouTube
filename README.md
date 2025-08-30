# NouTube

YouTube and YouTube Music in a single app. No ads, plays in the background.

- Manage video/music library without login
- Manage watch history without login
- Hide shorts
- Live chat
- Play original audio

[<img src="https://f-droid.org/badge/get-it-on.png"
    alt="Get it on F-Droid"
    height="80">](https://f-droid.org/packages/jp.nonbili.noutube)

## Desktop version

Desktop version shares the same code base with mobile version.
Download Linux/macOS/Windows version from [NouTube-Desktop](https://github.com/nonbili/NouTube-Desktop/releases).

## How it works

- Wrap https://m.youtube.com and https://music.youtube.com in Android webview
- Inject code to block ads
- Hook playback controls and support playing in background

## Screenshots

<img src="metadata/en-US/images/phoneScreenshots/1.jpg" width="240" alt="youtube"> <img src="metadata/en-US/images/phoneScreenshots/2.jpg" width="240" alt="youtube-music"> <img src="metadata/en-US/images/phoneScreenshots/3.jpg" width="240" alt="music-library">

## Development

```
bun install
bun dev
bun run android
```
