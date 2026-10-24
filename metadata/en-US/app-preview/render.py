#!/usr/bin/env python3
"""Render the App Store preview from real iPhone captures.

Requires Python 3, Pillow, NumPy, ffmpeg and ffprobe. Run from any directory.
The captures and scene descriptions are listed in storyboard.json.
"""

import argparse
import json
import math
from pathlib import Path
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT, FPS = 886, 1920, 30
FONT_DIR = Path('/System/Library/Fonts/Supplemental')


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def font(size, bold=False):
    name = 'Arial Bold.ttf' if bold else 'Arial.ttf'
    return ImageFont.truetype(str(FONT_DIR / name), size)


def caption(scene, path):
    image = Image.new('RGBA', (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    top = scene.get('caption_position') == 'top'
    offset = -1390 if top else 0
    if top:
        for y in range(200, 600):
            alpha = round(238 * min(1, (y - 200) / 70, (600 - y) / 70))
            draw.line((0, y, WIDTH, y), fill=(9, 12, 20, alpha))
    else:
        for y in range(1510, HEIGHT):
            alpha = round(238 * min(1, (y - 1510) / 240))
            draw.line((0, y, WIDTH, y), fill=(9, 12, 20, alpha))
    draw.rounded_rectangle((48, 1670 + offset, 116, 1676 + offset), radius=3, fill='#36c7e5')
    draw.text((48, 1704 + offset), 'NOUTUBE', font=font(24, True), fill='#8adcec')
    size = 57
    while draw.textlength(scene['title'], font=font(size, True)) > WIDTH - 96:
        size -= 1
    draw.text((48, 1752 + offset), scene['title'], font=font(size, True), fill='white')
    draw.text((48, 1835 + offset), scene['subtitle'], font=font(28), fill='#dce0e9')
    if scene.get('credit'):
        draw.text((48, 1883 + offset), scene['credit'], font=font(16), fill='#b6bdcc')
    image.save(path)


def soundtrack(path, duration):
    """Original, quiet instrumental: warm pads, a pentatonic motif, soft pulse."""
    rate = 48000
    t = np.arange(round(duration * rate)) / rate
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    chords = [(48, 55, 60, 64), (45, 52, 57, 60),
              (41, 48, 53, 57), (43, 50, 55, 62), (48, 55, 60, 64)]

    def hz(midi):
        return 440 * 2 ** ((midi - 69) / 12)

    for i, chord in enumerate(chords):
        local = t - i * 6
        envelope = np.clip(local / 1.4, 0, 1) * np.clip((7.2 - local) / 1.8, 0, 1)
        for j, note in enumerate(chord):
            phase = 2 * math.pi * hz(note) * local
            tone = np.sin(phase) + 0.16 * np.sin(2 * phase)
            left += tone * envelope * 0.032 * (1 - j * 0.10)
            right += (np.sin(phase + 0.06) + 0.16 * np.sin(2 * phase)) * envelope * 0.032 * (0.7 + j * 0.10)
    motif = [72, 76, 79, 76, 74, 72, 69, 67]
    for i, start in enumerate(np.arange(0.6, duration - 0.6, 0.6)):
        local = t - start
        envelope = np.where(local >= 0, np.exp(-np.maximum(local, 0) * 5), 0)
        phase = 2 * math.pi * hz(motif[i % len(motif)]) * local
        pluck = (np.sin(phase) + 0.2 * np.sin(2 * phase)) * envelope * 0.025
        left += pluck * (0.85 if i % 2 else 1)
        right += pluck * (1 if i % 2 else 0.85)
    for start in np.arange(0, duration, 0.6):
        local = np.maximum(t - start, 0)
        pulse = np.sin(2 * math.pi * (48 * local + 6 * (1 - np.exp(-local * 24))))
        pulse *= np.exp(-local * 18) * (t >= start) * 0.035
        left += pulse
        right += pulse
    fade = np.minimum(np.clip(t / 0.6, 0, 1), np.clip((duration - t) / 1.3, 0, 1))
    stereo = np.stack([left * fade, right * fade], axis=1)
    pcm = (np.clip(stereo * 1.8, -1, 1) * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(pcm.tobytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant', default='', help='Storyboard/output suffix, e.g. v2')
    parser.add_argument('--poster-time', type=float, default=2, help='Poster frame time in seconds')
    args = parser.parse_args()
    suffix = f'-{args.variant}' if args.variant else ''
    scenes = json.loads((ROOT / f'storyboard{suffix}.json').read_text())
    work = ROOT / f'.render{suffix}'
    work.mkdir(exist_ok=True)
    for i, scene in enumerate(scenes):
        source = ROOT / scene['capture']
        if not source.is_file():
            raise SystemExit(f'Missing iPhone recording: {source}')
        overlay = work / f'caption-{i}.png'
        caption(scene, overlay)
        caption_fade_out = min(4.5, scene['duration'] - 0.5)
        # Crop only the small aspect-ratio mismatch; preserve the full UI scale.
        # Simulator recordings can omit trailing frames on static screens.
        video_filter = (
            f'[0:v]fps={FPS},scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,'
            f'crop={WIDTH}:{HEIGHT},setsar=1,'
            f'tpad=stop_mode=clone:stop_duration={scene["duration"]},'
            f'trim=duration={scene["duration"]},setpts=PTS-STARTPTS[ui];'
            '[1:v]format=rgba,fade=t=in:st=0.20:d=0.30:alpha=1,'
            f'fade=t=out:st={caption_fade_out}:d=0.35:alpha=1[caption];'
            '[ui][caption]overlay=0:0:shortest=1,format=yuv420p[out]'
        )
        run('ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y',
            '-ss', scene.get('start', 0), '-i', source, '-loop', '1', '-i', overlay,
            '-filter_complex_threads', '1', '-filter_complex', video_filter,
            '-map', '[out]', '-t', scene['duration'], '-an', '-c:v', 'libx264',
            '-preset', 'fast', '-crf', '16', '-profile:v', 'high', '-level:v', '4.0',
            '-pix_fmt', 'yuv420p', '-r', FPS, work / f'scene-{i}.mp4')
    duration = sum(scene['duration'] for scene in scenes)
    soundtrack(work / 'original-score.wav', duration)
    (work / 'concat.txt').write_text(''.join(f"file 'scene-{i}.mp4'\n" for i in range(len(scenes))))
    output = ROOT / f'noutube-app-store-preview{suffix}.mp4'
    run('ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-f', 'concat',
        '-safe', '0', '-i', work / 'concat.txt', '-i', work / 'original-score.wav',
        '-map', '0:v:0', '-map', '1:a:0', '-t', duration,
        '-c:v', 'libx264', '-preset', 'slow', '-b:v', '11M', '-maxrate', '12M',
        '-bufsize', '24M', '-profile:v', 'high', '-level:v', '4.0',
        '-pix_fmt', 'yuv420p', '-r', FPS, '-c:a', 'aac', '-b:a', '256k',
        '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output)
    run('ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-ss', args.poster_time,
        '-i', output, '-frames:v', '1', '-update', '1', ROOT / f'poster{suffix}.jpg')
    result = subprocess.check_output([
        'ffprobe', '-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', str(output)
    ])
    (ROOT / f'video-specs{suffix}.json').write_bytes(result)
    print(f'Rendered {output}')


if __name__ == '__main__':
    main()
