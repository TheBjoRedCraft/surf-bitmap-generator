"""
Builds the preview fonts embedded in fonts.css.

Inputs (download next to this script):
  Minecraft.otf  - https://github.com/IdreesInc/Minecraft-Font (OFL 1.1)
  unifont.hex    - https://unifoundry.com/pub/unifont/unifont-16.0.04/font-builds/unifont-16.0.04.hex.gz (gunzip)

Outputs Minecraft.woff and MinecraftPreviewExtra.woff and rewrites fonts.css.

"Minecraft Preview Extra" covers what the Minecraft font lacks:
  * small caps (ᴀʙᴄ…), drawn in the pixel style of Minecraft's nonlatin_european.png (5px high)
  * everything else from GNU Unifont, rendered like Minecraft's unihex provider
    (half-pixel resolution, width trimmed to the used columns)

Grid: 18 units/em, 1 Minecraft pixel = 2 units, ink starts at x=1, advance = ink + 3 units.
"""
import base64
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).parent
UNIFONT_RANGES = [(0x00A0, 0x052F), (0x1D00, 0x1DBF), (0x1E00, 0x1EFF), (0x2000, 0x2BFF)]

# rows top -> bottom; rows after the 5th hang below the baseline
SMALL_CAPS = {
    "ᴀ": [".###.", "#...#", "#####", "#...#", "#...#"],
    "ʙ": ["####.", "#...#", "####.", "#...#", "####."],
    "ᴄ": [".####", "#....", "#....", "#....", ".####"],
    "ᴅ": ["####.", "#...#", "#...#", "#...#", "####."],
    "ᴇ": ["#####", "#....", "####.", "#....", "#####"],
    "ғ": ["#####", "#....", "####.", "#....", "#...."],
    "ɢ": [".####", "#....", "#..##", "#...#", ".####"],
    "ʜ": ["#...#", "#...#", "#####", "#...#", "#...#"],
    "ɪ": ["###", ".#.", ".#.", ".#.", "###"],
    "ᴊ": ["....#", "....#", "....#", "#...#", ".###."],
    "ᴋ": ["#...#", "#..#.", "###..", "#..#.", "#...#"],
    "ʟ": ["#....", "#....", "#....", "#....", "#####"],
    "ᴍ": ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
    "ɴ": ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
    "ᴏ": [".###.", "#...#", "#...#", "#...#", ".###."],
    "ᴘ": ["####.", "#...#", "####.", "#....", "#...."],
    "ǫ": [".###.", "#...#", "#...#", "#...#", ".###.", "...#.", "....#"],
    "ʀ": ["####.", "#...#", "####.", "#..#.", "#...#"],
    "ᴛ": ["#####", "..#..", "..#..", "..#..", "..#.."],
    "ᴜ": ["#...#", "#...#", "#...#", "#...#", ".###."],
    "ᴠ": ["#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
    "ᴡ": ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
    "ʏ": ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
    "ᴢ": ["#####", "...#.", "..#..", ".#...", "#####"],
}


def rect(pen, x0, y0, x1, y1):
    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()


def pixel_glyph(rows):
    pen = TTGlyphPen(None)
    width = max(len(r) for r in rows)
    for i, row in enumerate(rows):
        y = 4 - i  # 5th row sits on the baseline
        for k, c in enumerate(row):
            if c == "#":
                rect(pen, 1 + 2 * k, 2 * y, 3 + 2 * k, 2 * y + 2)
    return pen.glyph(), 2 * width + 3


def unifont_glyphs(skip):
    for line in open(HERE / "unifont.hex"):
        cp, bits = line.strip().split(":")
        cp = int(cp, 16)
        if cp in skip or not any(a <= cp <= b for a, b in UNIFONT_RANGES):
            continue
        w = len(bits) // 16 * 4
        rows = [int(bits[i * w // 4:(i + 1) * w // 4], 16) for i in range(16)]
        on = lambda r, c: rows[r] >> (w - 1 - c) & 1
        cols = [c for c in range(w) if any(on(r, c) for r in range(16))]
        if not cols:
            continue
        lo, hi = min(cols), max(cols)
        pen = TTGlyphPen(None)
        for r in range(16):
            c = lo
            while c <= hi:
                if on(r, c):
                    start = c
                    while c <= hi and on(r, c):
                        c += 1
                    rect(pen, 1 + start - lo, 13 - r, 1 + c - lo, 14 - r)  # unifont row 13 = baseline row
                else:
                    c += 1
        yield cp, pen.glyph(), (hi - lo + 1) + 3


def build_extra(have):
    empty = TTGlyphPen(None).glyph()
    glyphs, metrics, cmap = {".notdef": empty}, {".notdef": (8, 0)}, {}

    def add(cp, glyph, advance):
        name = f"uni{cp:04X}"
        glyphs[name], metrics[name], cmap[cp] = glyph, (advance, 1), name

    for ch, rows in SMALL_CAPS.items():
        add(ord(ch), *pixel_glyph(rows))
    for cp, glyph, advance in unifont_glyphs(have | set(cmap)):
        add(cp, glyph, advance)

    fb = FontBuilder(18, isTTF=True)
    fb.setupGlyphOrder(list(glyphs))
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=16, descent=-2)
    fb.setupNameTable({"familyName": "Minecraft Preview Extra", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=16, sTypoDescender=-2, usWinAscent=16, usWinDescent=2)
    fb.setupPost()
    fb.font.flavor = "woff"
    fb.save(HERE / "MinecraftPreviewExtra.woff")
    print(f"extra font: {len(cmap)} glyphs")


def main():
    mc = TTFont(HERE / "Minecraft.otf")
    have = set(mc.getBestCmap())
    mc.flavor = "woff"
    mc.save(HERE / "Minecraft.woff")
    build_extra(have)

    b64 = lambda name: base64.b64encode((HERE / name).read_bytes()).decode()
    (HERE / "fonts.css").write_text(f"""/* Minecraft-Schrift für die Tooltip-Vorschau (Base64, damit sie auch über file:// lädt).
 * Generiert von build-fonts.py – nicht von Hand bearbeiten.
 *
 * "Minecraft Preview"       – https://github.com/IdreesInc/Minecraft-Font (SIL OFL 1.1, siehe LICENSE-Minecraft-Font.txt)
 * "Minecraft Preview Extra" – eigene Kapitälchen im Minecraft-Pixelstil + Glyphen aus GNU Unifont 16.0.04
 *                             (https://unifoundry.com, SIL OFL 1.1 / GPLv2+ mit Font-Exception)
 *
 * 18 Einheiten/em, 1 Minecraft-Pixel = 2 Einheiten -> font-size: 18px entspricht GUI-Scale 2.
 */
@font-face {{
  font-family: "Minecraft Preview";
  src: url("data:font/woff;base64,{b64("Minecraft.woff")}") format("woff");
  font-display: block;
}}
@font-face {{
  font-family: "Minecraft Preview Extra";
  src: url("data:font/woff;base64,{b64("MinecraftPreviewExtra.woff")}") format("woff");
  font-display: block;
}}
""", encoding="utf-8")
    print("fonts.css written")


if __name__ == "__main__":
    main()
