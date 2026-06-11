# generate_digits_watercolor.py
# Flat watercolor-style digit sprite sheet — "soft pastel" art direction.
#
# Style: clean sans-serif, warm dark brown fill, thin white soft outline,
#        subtle top highlight. No 3D extrusion, no bevel, no rim.
#
# Output: 10 cells of 100x160 px, gap 0 -> 1000x160 (same layout as gold3d).
# Deploy to: src/assets/, wechatgame/assets/, tools/ (keep all three in sync).
#
# Usage:  python3 generate_digits_watercolor.py [font.ttf] [output.png]

import sys
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

CELL_W, CELL_H = 100, 160
SS = 4  # supersampling
W, H = CELL_W * SS, CELL_H * SS

FONT_PATH = sys.argv[1] if len(sys.argv) > 1 else "NotoSans-Bold.ttf"
OUT_PATH  = sys.argv[2] if len(sys.argv) > 2 else "digits.png"

# ── tunables ──────────────────────────────────────────────────────────────────
OUTLINE_PX   = 3     # white soft outline width (final px, scaled internally)
PLUMP_RATIO  = 0.008 # slight corner rounding

# ── colors ────────────────────────────────────────────────────────────────────
FILL_COLOR    = (255, 252, 248)  # near-white #FFFCF8
OUTLINE_CLR   = (139, 94, 48)   # medium brown #8B5E30
BEVEL_HI_CLR  = (255, 255, 245) # near-white highlight
WAVE_COLOR    = (180, 130, 75)  # warm brown wave lines
WAVE_ALPHA    = 38              # wave opacity (0-255)
MAX_W_RATIO, MAX_H_RATIO = 0.84, 0.86


def dilate(mask, r):
    if r <= 0:
        return mask
    m = mask.filter(ImageFilter.MaxFilter(2 * r + 1))
    m = m.filter(ImageFilter.GaussianBlur(r * 0.5))
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


def find_font_size(font_path):
    for size in range(int(H * 0.88), 40, -4):
        font = ImageFont.truetype(font_path, size)
        mask = plump(text_mask(font, "0"), max(1, int(font.size * PLUMP_RATIO)))
        outline_mask = dilate(mask, OUTLINE_PX * SS)
        bbox = outline_mask.getbbox()
        if bbox is None:
            continue
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if bw <= W * MAX_W_RATIO and bh <= H * MAX_H_RATIO:
            return size, font
    return 160, ImageFont.truetype(font_path, 160)


def solid(color, alpha=255):
    return Image.new("RGBA", (W, H), color + (alpha,))


def make_wave_overlay(fill_mask):
    """Horizontal sine-wave lines clipped to fill_mask (fingerprint texture)."""
    spacing   = int(SS * 8)    # line spacing at supersampled res (~8px final)
    amplitude = int(SS * 2.5)  # wave height (~2.5px final)
    line_w    = max(1, int(SS * 1.1))
    cycles    = 2.5            # wave cycles across full width

    lines = Image.new("L", (W, H), 0)
    draw  = ImageDraw.Draw(lines)
    for y0 in range(-spacing, H + spacing, spacing):
        pts = [(x, y0 + int(amplitude * math.sin(2 * math.pi * cycles * x / W)))
               for x in range(0, W + 1, 2)]
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=255, width=line_w)

    # Clip to glyph and scale alpha
    clipped = ImageChops.multiply(lines, fill_mask)
    clipped = clipped.point(lambda v: int(v * WAVE_ALPHA / 255))

    overlay = Image.new("RGBA", (W, H), WAVE_COLOR + (0,))
    overlay.putalpha(clipped)
    return overlay


def render_digit(ch, font):
    ow = OUTLINE_PX * SS
    fill_mask    = plump(text_mask(font, ch), max(1, int(font.size * PLUMP_RATIO)))
    outline_mask = dilate(fill_mask, ow)

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # 1. White outline — soft glow around the glyph
    glow = outline_mask.filter(ImageFilter.GaussianBlur(SS * 0.8))
    out.paste(solid(OUTLINE_CLR, 180), (0, 0), glow)
    out.paste(solid(OUTLINE_CLR), (0, 0), outline_mask)

    # 2. Main fill
    out.paste(solid(FILL_COLOR), (0, 0), fill_mask)

    # 2b. Wave / fingerprint texture inside glyph
    out = Image.alpha_composite(out, make_wave_overlay(fill_mask))

    # 3. Subtle top highlight — thin warm strip at very top of glyph
    off = max(2, SS * 2)
    top_edge = ImageChops.subtract(fill_mask, ImageChops.offset(fill_mask, 0, off))
    top_edge = top_edge.filter(ImageFilter.GaussianBlur(SS * 0.5))
    top_edge = top_edge.point(lambda v: int(v * 0.45))
    out.paste(solid(BEVEL_HI_CLR), (0, 0), top_edge)

    return out.resize((CELL_W, CELL_H), Image.LANCZOS)


def main():
    font_size, font = find_font_size(FONT_PATH)
    sheet = Image.new("RGBA", (CELL_W * 10, CELL_H), (0, 0, 0, 0))
    for i, ch in enumerate("0123456789"):
        sheet.paste(render_digit(ch, font), (i * CELL_W, 0))
    sheet.save(OUT_PATH)
    print(f"saved {OUT_PATH} ({sheet.size[0]}x{sheet.size[1]}), font size {font_size}")


if __name__ == '__main__':
    main()
