#!/usr/bin/env python3
"""Draw AverageTV's banner and icon: our mark and our name.

The mark is the letter A as an old rooftop aerial — two rods, three elements — between
square brackets. The same geometry is drawn on the television by `Mark.java`; this file
draws the two pictures the television shows outside the app (the tile in Amazon's
launcher and the app's icon), so both say the same thing.

Usage:
    python3 tools/mark.py        re-make artwork/*.svg and the two PNGs in res/
    python3 tools/mark.py --preview   also write a preview with a background, to look at

Needs `rsvg-convert` (librsvg) for the rasterizing. It is not part of the build, which
never needs a network and no library. The wordmark is set in the app's own font,
assets/fonts/InterVariable.ttf.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VARIANT = os.path.dirname(HERE)
ART = os.path.join(VARIANT, "artwork")
DRAWABLE = os.path.join(VARIANT, "res", "drawable-nodpi")
FONT = "../assets/fonts/InterVariable.ttf"      # relative to artwork/

FONT_STYLE = """  <style>
    @font-face { font-family: 'Inter'; src: url('%s'); font-weight: 100 900; }
    text { font-family: 'Inter'; }
  </style>""" % FONT


def mark(cx, cy, s, stroke="#ffffff"):
    """The mark, `s` tall overall, centred on (cx, cy). The same numbers as Mark.java."""
    apex = cy - s * 0.377
    base = cy + s * 0.230
    half = s * 0.300
    bx = half + s * 0.16
    top = apex - s * 0.05
    h = (base - apex) + s * 0.10
    arm = s * 0.11
    rod = s * 0.055
    brk = s * 0.065
    out = ['<g fill="none" stroke="%s" stroke-linecap="butt">' % stroke]
    out.append('<path d="M %.2f %.2f L %.2f %.2f" stroke-width="%.2f"/>' % (cx, apex, cx - half, base, rod))
    out.append('<path d="M %.2f %.2f L %.2f %.2f" stroke-width="%.2f"/>' % (cx, apex, cx + half, base, rod))
    for i in range(3):
        y = apex + (base - apex) * (0.34 + i * 0.22)
        hw = half * ((y - apex) / (base - apex))
        out.append('<path d="M %.2f %.2f L %.2f %.2f" stroke-width="%.2f"/>' % (cx - hw, y, cx + hw, y, rod))
    out.append('<path d="M %.2f %.2f L %.2f %.2f M %.2f %.2f L %.2f %.2f M %.2f %.2f L %.2f %.2f" stroke-width="%.2f"/>' % (
        cx - bx, top, cx - bx, top + h,
        cx - bx, top, cx - bx + arm, top,
        cx - bx, top + h, cx - bx + arm, top + h, brk))
    out.append('<path d="M %.2f %.2f L %.2f %.2f M %.2f %.2f L %.2f %.2f M %.2f %.2f L %.2f %.2f" stroke-width="%.2f"/>' % (
        cx + bx, top, cx + bx, top + h,
        cx + bx, top, cx + bx - arm, top,
        cx + bx, top + h, cx + bx - arm, top + h, brk))
    out.append('</g>')
    return "\n".join(out)


BANNER = """<?xml version="1.0" encoding="utf-8"?>
<!-- AverageTV's banner: the tile the launcher draws on the television.
     Our mark on the left, our name on the right, in the app's own font.
     Rendered to res/drawable-nodpi/banner_variant.png with rsvg-convert
     (see variant/README.md); the numbers come from tools/mark.py, which keeps them
     the same as the mark the app draws on the television (Mark.java). -->
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
%s
%s
  <text x="228" y="196" font-size="74" font-weight="600" fill="#ffffff">AverageTV</text>
</svg>""" % (FONT_STYLE, mark(113, 170, 184))

ICON = """<?xml version="1.0" encoding="utf-8"?>
<!-- AverageTV's icon: upstream's gradient, our mark on it.
     Rendered to res/drawable-nodpi/icon.png with rsvg-convert. -->
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffa28a"/>
      <stop offset="0.45" stop-color="#ff9690"/>
      <stop offset="1" stop-color="#c684d5"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="192" height="192" rx="46" ry="46" fill="url(#g)"/>
%s
</svg>""" % mark(96, 98, 118)


def write(name, svg, png):
    os.makedirs(ART, exist_ok=True)
    with open(os.path.join(ART, name), "w", encoding="utf-8") as f:
        f.write(svg)
    subprocess.run(["rsvg-convert", "-o", png, os.path.join(ART, name)], check=True)
    print("wrote %s and %s" % (os.path.join("artwork", name), png))


def main():
    write("banner_variant.svg", BANNER, os.path.join(DRAWABLE, "banner_variant.png"))
    write("icon.svg", ICON, os.path.join(DRAWABLE, "icon.png"))
    if "--preview" in sys.argv:
        preview = BANNER.replace('width="640" height="360">',
                                  'width="640" height="360"><rect width="640" height="360" fill="#12305e"/>')
        write("banner_variant.svg", preview, os.path.join(ART, "banner_preview.png"))
        write("banner_variant.svg", BANNER, os.path.join(DRAWABLE, "banner_variant.png"))


if __name__ == "__main__":
    main()
