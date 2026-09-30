#!/usr/bin/env python3
"""Renders the myWebVault toolbar/app icons (apps/browser/src/images/icon*.png).

The "Geometric W" logo on a rounded #3B2A9E square: left half white, right V #C4BBFF.
Locked: a padlock badge bottom-right. Berry: a notification dot bottom-right.
Pure Python (no image libraries), with 8x8 supersampling for anti-aliasing.

Usage: python3 scripts/mywebvault/generate-icons.py
"""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "browser", "src", "images")

# Logo polygons from the brand SVG (viewBox 0 0 400 400).
LEFT_W = [(40, 110), (102, 110), (135.5, 203.5), (169, 110), (231, 110), (166.5, 290), (104.5, 290)]
RIGHT_V = [(360, 110), (298, 110), (264.5, 203.5), (231, 110), (169, 110), (233.5, 290), (295.5, 290)]

PRIMARY = (0x3B, 0x2A, 0x9E)
WHITE = (0xFF, 0xFF, 0xFF)
LIGHT_ACCENT = (0xC4, 0xBB, 0xFF)
# At tiny sizes the lavender V blends into the white half; a brighter tint keeps it visible.
LIGHT_ACCENT_SMALL = (0xDD, 0xD7, 0xFF)
GRAY_BG = (0x6E, 0x6B, 0x80)

DARK = (0x1E, 0x16, 0x50)
BERRY = (0xE5, 0x48, 0x7F)

# (background, left colour, right colour, corner badge)
VARIANTS = {
    "": (PRIMARY, WHITE, LIGHT_ACCENT, None),
    "_gray": (GRAY_BG, WHITE, (0xD4, 0xD2, 0xDC), None),
    "_locked": (PRIMARY, WHITE, LIGHT_ACCENT, "lock"),
}
SIZES = {
    "": [16, 19, 32, 38, 48, 96, 128],
    "_gray": [16, 19, 32, 38, 48, 96, 128],
    "_locked": [19, 38],
}
SUPERSAMPLE = 8


def inside(poly, x, y):
    result = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            result = not result
        j = i
    return result


def in_rounded_square(x, y, size, radius):
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2


def in_round_rect(u, v, x0, y0, x1, y1, r):
    cx = min(max(u, x0 + r), x1 - r)
    cy = min(max(v, y0 + r), y1 - r)
    return x0 <= u <= x1 and y0 <= v <= y1 and (u - cx) ** 2 + (v - cy) ** 2 <= r**2


def lock_shape(u, v, keyhole):
    """Padlock in the bottom-right corner, in units of the icon size. Returns True/False/"hole"."""
    if in_round_rect(u, v, 0.50, 0.63, 0.98, 0.98, 0.07):
        if keyhole and ((u - 0.74) ** 2 + (v - 0.78) ** 2 <= 0.045**2 or (0.727 <= u <= 0.753 and 0.78 <= v <= 0.88)):
            return "hole"
        return True
    cx, cy, outer, inner = 0.74, 0.63, 0.17, 0.095
    d2 = (u - cx) ** 2 + (v - cy) ** 2
    if v <= cy and inner**2 <= d2 <= outer**2:
        return True
    return (cx - outer <= u <= cx - inner or cx + inner <= u <= cx + outer) and cy <= v <= 0.66


def dot_shape(u, v, keyhole):
    return (u - 0.78) ** 2 + (v - 0.78) ** 2 <= 0.19**2


BADGES = {"lock": (lock_shape, DARK), "berry": (dot_shape, BERRY)}
OUTLINE = 0.06
OUTLINE_DIRECTIONS = [(1, 0), (-1, 0), (0, 1), (0, -1), (0.7, 0.7), (-0.7, 0.7), (0.7, -0.7), (-0.7, -0.7)]


def badge_colour(badge, u, v, size):
    """Colour of the corner badge at (u, v), or None where the icon shows through."""
    if badge is None:
        return None
    shape, colour = BADGES[badge]
    keyhole = size >= 32
    hit = shape(u, v, keyhole)
    if hit == "hole":
        return WHITE
    if hit:
        return colour
    # A white ring around the badge separates it from the icon, as in Bitwarden's locked icon.
    for dx, dy in OUTLINE_DIRECTIONS:
        for step in (OUTLINE, OUTLINE / 2):
            if shape(u + dx * step, v + dy * step, keyhole):
                return WHITE
    return None


def render(size, bg, left, right, badge=None):
    if size <= 19 and right == LIGHT_ACCENT:
        right = LIGHT_ACCENT_SMALL
    # Map the logo's 320-unit-wide W to 78% of the icon width, centred.
    k = 0.78 * size / 320
    ox = size / 2 - 200 * k
    oy = size / 2 - 200 * k
    left_poly = [(ox + px * k, oy + py * k) for px, py in LEFT_W]
    right_poly = [(ox + px * k, oy + py * k) for px, py in RIGHT_V]
    radius = size * 0.22

    rows = []
    n = SUPERSAMPLE
    for py in range(size):
        row = bytearray([0])  # PNG filter type: none
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(n):
                for sx in range(n):
                    x = px + (sx + 0.5) / n
                    y = py + (sy + 0.5) / n
                    colour = badge_colour(badge, x / size, y / size, size)
                    if colour is None:
                        if not in_rounded_square(x, y, size, radius):
                            continue
                        if inside(right_poly, x, y):
                            colour = right
                        elif inside(left_poly, x, y):
                            colour = left
                        else:
                            colour = bg
                    acc[0] += colour[0]
                    acc[1] += colour[1]
                    acc[2] += colour[2]
                    acc[3] += 1
            if acc[3] == 0:
                row += bytes(4)
            else:
                row += bytes([round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(255 * acc[3] / n**2)])
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    for suffix, (bg, left, right, badge) in VARIANTS.items():
        for size in SIZES[suffix]:
            rows = render(size, bg, left, right, badge)
            # Beta builds use the same artwork.
            for beta in ("", "_beta"):
                name = f"icon{size}{suffix}{beta}.png"
                write_png(os.path.join(OUT_DIR, name), size, rows)
                print("wrote", name)
    # Notification dot ("berry"), shown when there's something to look at in the popup.
    for size in (19, 38):
        write_png(os.path.join(OUT_DIR, f"berry{size}.png"), size, render(size, PRIMARY, WHITE, LIGHT_ACCENT, "berry"))
        print("wrote", f"berry{size}.png")


if __name__ == "__main__":
    main()
