# NouTube

YouTube and YouTube Music in a single app. No ads, plays in the background.

- Manage watchlist, music library without login
- Hide shorts

[<img src="https://f-droid.org/badge/get-it-on.png"
    alt="Get it on F-Droid"
    height="80">](https://f-droid.org/packages/jp.nonbili.noutube)

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
