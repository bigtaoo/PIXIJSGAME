#!/usr/bin/env python3
"""
Compose App Store screenshots: gradient background + rounded device frame + caption.

Pipeline:
  1) Render raw full-screen game frames (one PNG per scene) into
       markting/appstore/_raw/<device>/<scene>.png
     The companion capture script (tools/capture-store-screenshots.mjs) produces
     these; just point its output at _raw/<device>/ and use the scene ids below.
  2) Run this script:  python tools/compose-store-screenshots.py
     It writes final, exact-size, alpha-free store images into
       markting/appstore/iphone_6.5/   (1284x2778)
       markting/appstore/ipad_13/      (2064x2752)

Captions, colors and layout live in the tables below — edit and re-run; no
re-rendering needed unless the game art itself changes.

Requires: Pillow  (pip install Pillow)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
RAW = os.path.join(PROJ, 'markting', 'appstore', '_raw')
FONT_DIR = os.path.join(PROJ, 'markting', 'Lilita_One,Noto_Sans')
TITLE_FONT = os.path.join(FONT_DIR, 'Lilita_One', 'LilitaOne-Regular.ttf')
SUB_FONT = os.path.join(FONT_DIR, 'Noto_Sans', 'static', 'NotoSans-SemiBold.ttf')

PAL = {
    'blue':  ((221, 241, 250), (193, 212, 223)),
    'cream': ((249, 241, 221), (219, 211, 193)),
    'pink':  ((250, 221, 221), (221, 194, 194)),
}
TITLE_COLOR = (110, 71, 38)
SUB_COLOR = (122, 96, 82)

# scene raw name, output suffix, [title lines], subtitle, palette
SCENES = [
    ('stage1', '',   ['Add up to', 'the target'],   'Tap tiles that sum to the number',    'blue'),
    ('stage3', '-1', ['Boards grow', 'as you go'],  'Targets climb from 6 to 99',          'cream'),
    ('daily',  '-2', ['A new puzzle', 'every day'], 'Same board for everyone, 90 seconds', 'pink'),
    ('lobby',  '-3', ['19 cozy', 'levels'],         'Hand-crafted, relaxing watercolor',   'blue'),
    ('win',    '-4', ['Clear it,', 'earn 3 stars'], 'Simple to learn, hard to stop',       'cream'),
]
DEVICES = [
    ('iphone', 1284, 2778, '1284x2778', 'iphone_6.5'),
    ('ipad',   2064, 2752, '2064x2752', 'ipad_13'),
]


def gradient(w, h, top, bot):
    base = Image.new('RGB', (w, h))
    px = base.load()
    for y in range(h):
        t = y / (h - 1)
        px_row = (int(top[0] + (bot[0]-top[0])*t),
                  int(top[1] + (bot[1]-top[1])*t),
                  int(top[2] + (bot[2]-top[2])*t))
        for x in range(w):
            px[x, y] = px_row
    return base


def rounded_mask(w, h, rad):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w-1, h-1], radius=rad, fill=255)
    return m


def fit_font(path, text, max_w, start):
    size = start
    while size > 10:
        f = ImageFont.truetype(path, size)
        if f.getlength(text) <= max_w:
            return f, size
        size -= 2
    return ImageFont.truetype(path, 10), 10


def compose(device, W, H, tag, scene):
    raw_name, suffix, title_lines, subtitle, pal = scene
    top, bot = PAL[pal]
    canvas = gradient(W, H, top, bot)
    raw = Image.open(os.path.join(RAW, device, raw_name + '.png')).convert('RGB')
    aspect = raw.width / raw.height

    # measure caption first so the frame can sit safely below it
    tfont, tsize = fit_font(TITLE_FONT, max(title_lines, key=len), int(0.86*W), int(0.050*H))
    line_gap = int(tsize * 1.02)
    title_y0 = int(0.05 * H)
    title_bottom = title_y0 + line_gap * (len(title_lines) - 1) + tsize
    sfont, ssize = fit_font(SUB_FONT, subtitle, int(0.9*W), max(20, int(0.0195*H)))
    sub_y = title_bottom + int(0.022 * H)
    sub_bottom = sub_y + ssize

    # frame geometry: a clear gap below the caption (fixes caption/frame overlap)
    bezel = max(10, round(0.0075 * W))
    frame_top = int(sub_bottom + 0.035 * H)
    frame_bottom = int(0.955 * H)
    inner_h = frame_bottom - frame_top - 2*bezel
    inner_w = int(round(inner_h * aspect))
    frame_w, frame_h = inner_w + 2*bezel, inner_h + 2*bezel
    fx, fy = (W - frame_w) // 2, frame_top
    out_rad = int(0.05 * frame_w)
    in_rad = max(2, out_rad - bezel)

    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([fx, fy+12, fx+frame_w, fy+frame_h+12], radius=out_rad, fill=(60, 45, 30, 75))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), sh.filter(ImageFilter.GaussianBlur(20))).convert('RGB')

    bez = Image.new('RGBA', (frame_w, frame_h), (0, 0, 0, 0))
    ImageDraw.Draw(bez).rounded_rectangle([0, 0, frame_w-1, frame_h-1], radius=out_rad, fill=(22, 22, 26, 255))
    canvas.paste(bez, (fx, fy), bez)

    game = raw.resize((inner_w, inner_h), Image.LANCZOS)
    canvas.paste(game, (fx+bezel, fy+bezel), rounded_mask(inner_w, inner_h, in_rad))

    draw = ImageDraw.Draw(canvas)
    y = title_y0
    for line in title_lines:
        draw.text(((W - tfont.getlength(line))//2, y), line, font=tfont, fill=TITLE_COLOR)
        y += line_gap
    draw.text(((W - sfont.getlength(subtitle))//2, sub_y), subtitle, font=sfont, fill=SUB_COLOR)

    outdir = os.path.join(PROJ, 'markting', 'appstore', DEVICES_OUT[device])
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f'{tag}{suffix}.png')
    canvas.convert('RGB').save(out)
    assert sub_bottom < frame_top, f'caption overlaps frame in {out}'
    return out


DEVICES_OUT = {d[0]: d[4] for d in DEVICES}
if __name__ == '__main__':
    for device, W, H, tag, _ in DEVICES:
        for sc in SCENES:
            print('wrote', compose(device, W, H, tag, sc))
    print('done')
