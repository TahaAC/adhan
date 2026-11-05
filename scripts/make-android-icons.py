#!/usr/bin/env python3
"""Generate Android TV icons + banner from the app's icon-512.png."""
from PIL import Image, ImageDraw, ImageFont

SRC = '/home/z/my-project/public/icon-512.png'
APP = '/home/z/my-project/android-tv/app'

src = Image.open(SRC).convert('RGBA')
print('source icon:', src.size, src.mode)

# --- launcher mipmaps (Android expects opaque launcher icons) ---
sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for dpi, px in sizes.items():
    im = src.resize((px, px), Image.LANCZOS)
    # composite onto the brand green so the icon is fully opaque
    bg = Image.new('RGBA', (px, px), (6, 43, 31, 255))
    bg.alpha_composite(im)
    import os
    d = f'{APP}/res/mipmap-{dpi}'
    os.makedirs(d, exist_ok=True)
    bg.convert('RGB').save(f'{d}/ic_launcher.png', 'PNG')
    print(f'mipmap-{dpi}/ic_launcher.png {px}x{px}')

# --- TV banner: 320x180, xhdpi ---
W, H = 320, 180
banner = Image.new('RGBA', (W, H), (4, 21, 14, 255))
draw = ImageDraw.Draw(banner)
# subtle vertical gradient
for y in range(H):
    t = y / H
    r = int(4 + 8 * t); g = int(21 + 26 * t); b = int(14 + 14 * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b, 255))
# gold border line at the bottom
draw.rectangle([0, H - 4, W, H], fill=(217, 169, 78, 255))

# crescent icon on the left (from the source icon, resized)
icon = src.resize((96, 96), Image.LANCZOS)
banner.alpha_composite(icon, (14, (H - 96) // 2))

# text — sizes measured so nothing is cut off (banner safe area ~ 300px wide)
def fit_font(path, start, max_w, text):
    size = start
    while size > 10:
        f = ImageFont.truetype(path, size)
        bb = f.getbbox(text)
        if bb[2] - bb[0] <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(path, 10)

x0 = 122
title_f = fit_font('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf', 40, W - x0 - 14, 'Shia Azan')
sub_f = fit_font('/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf', 20, W - x0 - 14, 'Prayer Times · Qibla')
draw = ImageDraw.Draw(banner)
tb = title_f.getbbox('Shia Azan')
sb = sub_f.getbbox('Prayer Times · Qibla')
title_h = tb[3] - tb[1]
sub_h = sb[3] - sb[1]
gap = 16
total_h = title_h + gap + sub_h
ty = (H - total_h) // 2 - tb[1]
draw.text((x0, ty), 'Shia Azan', font=title_f, fill=(242, 234, 216, 255))
draw.text((x0, ty + title_h + gap - sb[1]), 'Prayer Times · Qibla', font=sub_f, fill=(217, 169, 78, 255))

banner.convert('RGB').save(f'{APP}/res/drawable/banner.png', 'PNG')
print('drawable/banner.png 320x180')

# --- also a 512 icon copy for the repo/assets ---
src.convert('RGB').save('/home/z/my-project/android-tv/icon.png', 'PNG')
print('done')
