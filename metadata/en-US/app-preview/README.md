# NouTube App Store preview

The revised cut is `noutube-app-store-preview-v2.mp4`, with `poster-v2.jpg`
and `preview-sheet-v2.jpg` for review. It leads with ad blocking,
SponsorBlock, background playback, channel feeds without a YouTube account,
and content filters. The feed scene uses live NASA channel uploads. The
filter scenes show Shorts/recommendation/end-screen controls and title
keywords being enabled in the app.

Render the revised cut with:

```sh
python3 metadata/en-US/app-preview/render.py --variant v2 --poster-time 10
```

`noutube-app-store-preview.mp4` is the original cut. `poster.jpg` is
the suggested poster frame, taken at 00:02 in the finished video.

The video uses actual NouTube screen recordings from an iPhone 17 Pro
simulator running iOS 26.2. Captions are burned in for muted autoplay. The
soundtrack is an original synthesized instrumental made by `render.py`; none
of the audio from the videos being demonstrated is included.

Export: 30 seconds, 886 × 1920 portrait, 30 fps, H.264 High Profile Level 4.0,
YUV 4:2:0, target video bitrate 11 Mbps, stereo AAC at 256 kbps / 48 kHz, with
the MP4 index at the beginning for streaming. `video-specs.json` contains the
actual FFprobe output. These settings follow [Apple's app preview
specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications).

To render again on macOS, install Python packages `Pillow` and `numpy` and
make `ffmpeg` / `ffprobe` available on PATH, then run:

```sh
python3 metadata/en-US/app-preview/render.py
```

Edit `storyboard.json` to change captions, source clips, trim points, or scene
durations. The source recordings are in `captures/`. Intermediate renders are
ignored by Git. The renderer uses the Arial fonts included with macOS.

Visualizations shown inside the app are credited to NASA's Goddard Space
Flight Center:

- [Tour of the Moon 4K Redux](https://svs.gsfc.nasa.gov/4619/), NASA/LRO.
- [Thermonuclear Art: The Sun in UHD](https://svs.gsfc.nasa.gov/13057/), NASA/SDO.
- [A Decade of Sun](https://svs.gsfc.nasa.gov/13641/), NASA/SDO (history thumbnail).
- [NASA's official channel](https://www.youtube.com/@NASA), for the live feed
  thumbnails in the revised preview.

NASA SVS permits reuse of these visualizations without their separately
licensed audio; see its [usage guidance](https://svs.gsfc.nasa.gov/help/).
The preview includes an onscreen visualization credit. NASA is not affiliated
with or endorsing NouTube.

The revised video and twelve iPhone/iPad screenshots were uploaded to the
English localization of App Store Connect version 0.6.13. Apple completed asset
processing. `app-store-upload.json` records the verified upload; the version
was not submitted for review.
