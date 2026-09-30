"""Builds the README banner (logo mark + outlined "myWebVault" wordmark) in light and dark variants.

Usage (needs `pip install fonttools` and Sora's variable font from Google Fonts):
    python scripts/mywebvault/generate-banner.py path/to/Sora[wght].ttf docs/assets

The wordmark is converted to paths so it renders identically on GitHub, which shows SVGs as images
without web fonts. Colours and weights follow the brand section of the project brief.
"""

import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font_path, out_dir = sys.argv[1], Path(sys.argv[2])

FONT_SIZE = 64
MARK_HEIGHT = 84
GAP = 22  # between mark and wordmark
PAD_X, HEIGHT = 8, 120


def instance(weight):
    return instantiateVariableFont(TTFont(font_path), {"wght": weight})


regular, bold = instance(400), instance(700)
upem = regular["head"].unitsPerEm
scale = FONT_SIZE / upem
cap_height = bold["OS/2"].sCapHeight * scale


def text_paths(font, text, x, baseline):
    """Returns (svg path data, advance width) for text drawn at x on the baseline."""
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    parts = []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyph_set)
        # Font units are y-up; SVG is y-down.
        glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        parts.append(pen.getCommands())
        x += hmtx[name][0] * scale
    return " ".join(parts), x


# Logo mark: two equal Vs (source viewBox 40..360 x 110..290), scaled to MARK_HEIGHT.
mark_scale = MARK_HEIGHT / 180
mark_w = 320 * mark_scale
mark_y = (HEIGHT - MARK_HEIGHT) / 2
mark_transform = f"translate({PAD_X - 40 * mark_scale:.2f} {mark_y - 110 * mark_scale:.2f}) scale({mark_scale:.4f})"
LEFT = "40,110 102,110 135.5,203.5 169,110 231,110 166.5,290 104.5,290"
RIGHT = "360,110 298,110 264.5,203.5 231,110 169,110 233.5,290 295.5,290"

# Wordmark, vertically centred on the mark by cap height.
baseline = HEIGHT / 2 + cap_height / 2
x = PAD_X + mark_w + GAP
my, x = text_paths(regular, "my", x, baseline)
web, x = text_paths(bold, "Web", x, baseline)
vault, x = text_paths(bold, "Vault", x, baseline)
width = x + PAD_X

THEMES = {
    "light": {"mark_left": "#3B2A9E", "mark_right": "#8B7CF6", "my": "#4C3BCF", "web": "#1E1650", "vault": "#4C3BCF"},
    "dark": {"mark_left": "#FFFFFF", "mark_right": "#C4BBFF", "my": "#C4BBFF", "web": "#FFFFFF", "vault": "#C4BBFF"},
}

for name, c in THEMES.items():
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {HEIGHT}" width="{width:.0f}" height="{HEIGHT}" role="img" aria-label="myWebVault">
  <g transform="{mark_transform}">
    <polygon points="{LEFT}" fill="{c['mark_left']}"/>
    <polygon points="{RIGHT}" fill="{c['mark_right']}"/>
  </g>
  <path fill="{c['my']}" d="{my}"/>
  <path fill="{c['web']}" d="{web}"/>
  <path fill="{c['vault']}" d="{vault}"/>
</svg>
"""
    (out_dir / f"mywebvault-banner-{name}.svg").write_text(svg)
    print(name, f"{width:.0f}x{HEIGHT}", len(svg), "bytes")
