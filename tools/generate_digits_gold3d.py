# generate_digits_gold3d.py
# Gold 3D digit sprite sheet — "warm gold luxury" art direction (art.md 1.0/2.1).
#
# Layer order (bottom to top):
#   cream rim silhouette -> dark bronze extrusion (offset down) ->
#   dark bronze inner outline -> gold vertical gradient fill ->
#   bevel top highlight / bottom shade -> soft gloss
#
# Output layout matches loaders: 10 cells of 100x160 px, gap 0 -> 1000x160.
# Deploy to: src/assets/, wechatgame/assets/, tools/ (keep all three in sync).
#
# Usage:  python3 generate_digits_gold3d.py [font.ttf] [output.png]

import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

CELL_W, CELL_H = 100, 160
SS = 4  # supersampling
W, H = CELL_W * SS, CELL_H * SS

FONT_PATH = sys.argv[1] if len(sys.argv) > 1 else "Poppins-Bold.ttf"
OUT_PATH = sys.argv[2] if len(sys.argv) > 2 else "digits.png"

# ── tunables (final-pixel values, scaled by SS internally) ────────────────────
OUTLINE_PX = 4      # dark bronze inner outline width
RIM_PX = 6          # cream outer rim width
DEPTH_PX = 7        # 3D extrusion depth (downward)
PLUMP_RATIO = 0.012 # corner-rounding dilation / font size

# ── colors ────────────────────────────────────────────────────────────────────
GRAD = [                       # gold gradient, top -> bottom (unified top light)
    (0.00, (255, 246, 200)),
    (0.35, (255, 210, 77)),
    (0.70, (240, 160, 48)),
    (1.00, (214, 136, 32)),
]
OUTLINE = (92, 58, 16)         # dark bronze
EXTRUDE = (122, 78, 20)        # bronze side face (slightly lighter than outline)
RIM = (255, 253, 244)          # cream rim
BEVEL_HI = (255, 252, 225)     # top bevel highlight
BEVEL_LO = (150, 92, 18)       # bottom inner shade
GLOSS = (255, 255, 255)

MAX_W_RATIO, MAX_H_RATIO = 0.86, 0.88


def dilate(mask, r):
    if r <= 0:
        return mask
    m = mask.filter(ImageFilter.MaxFilter(2 * r + 1))
    m = m.filter(ImageFilter.GaussianBlur(r * 0.4))
    return m.point(lambda v: 255 if v >= 128 else 0)


def text_mask(font, ch):
    img = Image.new("L", (W, H), 0)
    ImageDraw.Draw(img).text((W // 2, H // 2), ch, font=font, fill=255, anchor="mm")
    return img


def plump(mask, radius):
    r = max(1, radius)
    m = mask.filter(ImageFilter.MaxFilter(2 * r + 1))
    m = m.filter(ImageFilter.GaussianBlur(r * 1.2))
    return m.point(lambda v: 255 if v >= 128 else 0)


def build_masks(font, ch):
    ow, rw, depth = OUTLINE_PX * SS, RIM_PX * SS, DEPTH_PX * SS
    fill = plump(text_mask(font, ch),
                 max(1, int(font.size * PLUMP_RATIO)))
    outline = dilate(fill, ow)
    # extrusion body: union of outline silhouette offset 0..depth downward
    body = outline.copy()
    step = SS
    for dy in range(step, depth + 1, step):
        body = ImageChops.lighter(body, ImageChops.offset(outline, 0, dy))
    rim = dilate(body, rw)
    return fill, outline, body, rim


def find_font_size(ch):
    for size in range(int(H * 0.90), 40, -4):
        font = ImageFont.truetype(FONT_PATH, size)
        _, _, _, rim = build_masks(font, ch)
        bbox = rim.getbbox()
        if bbox is None:
            continue
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if bw <= W * MAX_W_RATIO and bh <= H * MAX_H_RATIO:
            return size
    return 160


def gradient_color(t):
    for (t0, c0), (t1, c1) in zip(GRAD, GRAD[1:]):
        if t <= t1:
            f = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(int(a + (b - a) * f) for a, b in zip(c0, c1))
    return GRAD[-1][1]


def solid(color):
    return Image.new("RGBA", (W, H), color + (255,))


def render_digit(ch, size):
    font = ImageFont.truetype(FONT_PATH, size)
    fill, outline, body, rim = build_masks(font, ch)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # 1. cream rim (wraps everything, incl. extrusion)
    out.paste(solid(RIM), (0, 0), rim)

    # 2. extrusion side face
    out.paste(solid(EXTRUDE), (0, 0), body)

    # 3. top-face outline
    out.paste(solid(OUTLINE), (0, 0), outline)

    # 4. gold gradient fill (mapped to glyph bbox -> unified light)
    bbox = fill.getbbox()
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = grad.load()
    y0, y1 = bbox[1], bbox[3]
    for y in range(y0, y1 + 1):
        c = gradient_color((y - y0) / max(1, y1 - y0))
        for x in range(bbox[0], bbox[2] + 1):
            px[x, y] = c + (255,)
    out.paste(grad, (0, 0), fill)

    # 5. bevel: top highlight edge
    off = max(2, SS * 2)
    top_edge = ImageChops.subtract(fill, ImageChops.offset(fill, 0, off))
    top_edge = top_edge.filter(ImageFilter.GaussianBlur(SS * 0.6))
    out.paste(solid(BEVEL_HI), (0, 0), top_edge)

    # 6. bevel: bottom inner shade
    bot_edge = ImageChops.subtract(fill, ImageChops.offset(fill, 0, -off))
    bot_edge = bot_edge.filter(ImageFilter.GaussianBlur(SS * 0.6))
    bot_edge = bot_edge.point(lambda v: int(v * 0.8))
    out.paste(solid(BEVEL_LO), (0, 0), bot_edge)

    # 7. soft gloss ellipse, upper-left (light from top-left)
    gw, gh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    gloss_mask = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(gloss_mask)
    gd.ellipse([bbox[0] + gw * 0.10, bbox[1] + gh * 0.06,
                bbox[0] + gw * 0.58, bbox[1] + gh * 0.24], fill=110)
    gloss_mask = gloss_mask.filter(ImageFilter.GaussianBlur(SS * 1.4))
    gloss_mask = ImageChops.multiply(gloss_mask, fill)
    out.paste(solid(GLOSS), (0, 0), gloss_mask)

    return out.resize((CELL_W, CELL_H), Image.LANCZOS)


def main():
    size = find_font_size("0")
    sheet = Image.new("RGBA", (CELL_W * 10, CELL_H), (0, 0, 0, 0))
    for i, ch in enumerate("0123456789"):
        sheet.paste(render_digit(ch, size), (i * CELL_W, 0))
    sheet.save(OUT_PATH)
    print(f"saved {OUT_PATH} ({sheet.size[0]}x{sheet.size[1]}), font size {size}")


if __name__ == "__main__":
    main()
