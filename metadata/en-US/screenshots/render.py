#!/usr/bin/env python3
"""Compose store screenshots from actual platform captures (Pillow required)."""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
FONTS = Path('/System/Library/Fonts/Supplemental')
FEATURES = [
    ('01-playback', 'No ads.\nJust your video.', 'Ad blocking + SponsorBlock'),
    ('02-background', 'Keep\nlistening.', 'Background playback, even with the screen off.'),
    ('03-feeds', 'Your channels.\nNo login.', 'New uploads in one personal feed.'),
    ('04-distractions', 'Cut the\ndistractions.', 'Hide Shorts and recommended videos.'),
    ('05-blocklist', 'Choose what\ngets through.', 'Filter channels and title keywords.'),
]
PLATFORMS = {
    'android': {
        'size': (1080, 1920),
        'directory': REPO / 'metadata/en-US/images/phoneScreenshots',
        'extra': ('06-controls', 'Playback,\nyour way.', 'Adjust playback speed and video quality.'),
    },
    'ipad': {
        'size': (2064, 2752),
        'directory': REPO / 'fastlane/metadata/ios/en-US',
        'features': FEATURES + [
                     ('06-controls', 'Playback,\nyour way.', 'Adjust playback speed and video quality.')],
    },
    'ios': {
        'size': (1320, 2868),
        'directory': REPO / 'fastlane/metadata/ios/en-US',
        'extra': ('06-import', 'Bring your\nfavorites.', 'Import YouTube subscriptions and playlists.'),
    },
}


def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ('Arial Bold.ttf' if bold else 'Arial.ttf')), size)


def background(width, height):
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / height
        draw.line((0, y, width, y), fill=(round(7 + 5*t), round(19 + 10*t), round(29 + 20*t)))
    glow = Image.new('RGBA', image.size)
    g = ImageDraw.Draw(glow)
    g.ellipse((width*.45, -height*.12, width*1.4, height*.55), fill=(31, 151, 177, 35))
    glow = glow.filter(ImageFilter.GaussianBlur(width*.15))
    return Image.alpha_composite(image.convert('RGBA'), glow)


def render(platform, config, index, feature):
    name, title, subtitle = feature
    source = ROOT / 'source' / platform / f'{name}.png'
    if not source.is_file():
        raise FileNotFoundError(source)
    width, height = config['size']
    scale = width / 1320
    left = round(84*scale) if platform == 'ios' else 60
    image = background(width, height)
    draw = ImageDraw.Draw(image)
    icon_size = round(62*scale)
    icon = Image.open(REPO / 'assets/images/icon.png').convert('RGBA')
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    icon_mask = Image.new('L', icon.size)
    ImageDraw.Draw(icon_mask).rounded_rectangle((0, 0, icon_size, icon_size), radius=icon_size*.24, fill=255)
    image.paste(icon, (left, round(62*scale)), icon_mask)
    draw.text((left + icon_size + round(18*scale), round(72*scale)), 'NouTube', font=font(round(36*scale), True), fill='#8adcec')

    title_y = round(158*scale)
    draw.multiline_text((left, title_y), title, font=font(round(108*scale), True), fill='white', spacing=round(7*scale))
    subtitle_font = font(round(36*scale))
    while draw.textlength(subtitle, font=subtitle_font) > width - left*2:
        subtitle_font = font(subtitle_font.size - 1)
    draw.text((left, round(422*scale)), subtitle, font=subtitle_font, fill='#c2d2e1')

    screen_width = width - 2*left
    screen_top = 548 if platform == 'ios' else (740 if platform == 'ipad' else 400)
    capture = Image.open(source).convert('RGB')
    screen_height = round(screen_width * capture.height / capture.width)
    capture = capture.resize((screen_width, screen_height), Image.Resampling.LANCZOS)
    radius = round(45*scale)
    shadow = Image.new('RGBA', (width, max(height, screen_top + screen_height + 80)))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left-8, screen_top+18, left+screen_width+8, screen_top+screen_height+24),
        radius=radius+8, fill=(0, 0, 0, 160),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(24*scale)))
    image = Image.alpha_composite(image, shadow.crop((0, 0, width, height)))
    # The screen extends below the canvas as a deliberate store composition.
    # Source captures remain available uncropped in source/<platform>/.
    panel = Image.new('RGBA', (screen_width+6, screen_height+6), '#375265')
    panel.paste(capture, (3, 3))
    mask = Image.new('L', panel.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, panel.width-1, panel.height-1), radius=radius, fill=255)
    image.paste(panel, (left-3, screen_top-3), mask)
    image = image.convert('RGB')
    directory = config['directory']
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / (f'{index}.jpg' if platform == 'android' else f'{"ipad-" if platform == "ipad" else ""}{name}.png')
    if platform == 'android':
        image.save(output, quality=96, subsampling=0, optimize=True)
    else:
        image.save(output, optimize=True)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', choices=['all', 'android', 'ios', 'ipad'], default='all')
    args = parser.parse_args()
    manifest = []
    galleries = []
    for platform, config in PLATFORMS.items():
        if args.platform not in ['all', platform]:
            continue
        features = config['features'] if 'features' in config else FEATURES + [config['extra']]
        outputs = [render(platform, config, i, feature)
                   for i, feature in enumerate(features, 1)]
        thumb_width = 270
        thumb_height = round(thumb_width * config['size'][1] / config['size'][0])
        sheet = Image.new('RGB', (3*thumb_width, ((len(outputs)+2)//3)*thumb_height), '#07131d')
        for i, output in enumerate(outputs):
            with Image.open(output) as image:
                sheet.paste(image.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS),
                            ((i % 3)*thumb_width, (i // 3)*thumb_height))
            manifest.append({'platform': platform, 'file': str(output.relative_to(REPO)),
                             'width': config['size'][0], 'height': config['size'][1]})
        sheet.save(ROOT / f'{platform}-preview.jpg', quality=94, subsampling=0)
        cards = ''.join(f'<a href="../../../{output.relative_to(REPO)}"><img src="../../../{output.relative_to(REPO)}" alt="{platform} screenshot {i}"></a>'
                        for i, output in enumerate(outputs, 1))
        galleries.append(f'<section><h2>{dict(ios="iPhone", ipad="iPad", android="Android")[platform]}</h2><div class="gallery">{cards}</div></section>')
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    (ROOT / 'preview.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NouTube store screenshots</title><style>body{margin:0;padding:40px;background:#07131d;color:white;font:16px system-ui}h1{margin:0 0 12px}p{color:#a9c3d4}section{margin:40px 0}.gallery{display:grid;grid-template-columns:repeat(6,minmax(160px,1fr));gap:16px;overflow:auto}.gallery img{display:block;width:100%;border:1px solid #274052;border-radius:12px}a{color:inherit}@media(max-width:900px){body{padding:20px}.gallery{grid-template-columns:repeat(3,minmax(140px,1fr))}}</style><h1>NouTube store screenshots</h1><p>Actual Android, iPhone, and iPad captures. Click a screenshot to view the full-resolution export.</p>''' + ''.join(galleries) + '</html>')
    print(f'Rendered {len(manifest)} store screenshots.')


if __name__ == '__main__':
    main()
