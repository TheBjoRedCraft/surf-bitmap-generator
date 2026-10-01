"""
Builds textures.js from the resource pack textures next to this script.

Inputs (copied from the surf resource pack):
  bitmaps/**/*.png  - assets/surf/textures/bitmaps
  shift.json        - assets/surf/font/shift.json (negative/positive space advances)

Output: textures.js with every texture as Base64 data URI, so the page also works via file://
(canvas pixel access on file:// images would otherwise taint the canvas).
"""
import base64
import json
from pathlib import Path

HERE = Path(__file__).parent


def main():
    textures = {}
    for png in sorted((HERE / "bitmaps").rglob("*.png")):
        key = png.relative_to(HERE / "bitmaps").as_posix()
        textures[key] = "data:image/png;base64," + base64.b64encode(png.read_bytes()).decode()

    advances = {}
    for provider in json.loads((HERE / "shift.json").read_text(encoding="utf-8"))["providers"]:
        if provider.get("type") == "space":
            advances.update(provider["advances"])

    (HERE / "textures.js").write_text(
        "/* Texturen aus dem surf-Resourcepack (assets/surf/textures/bitmaps) + Space-Advances aus\n"
        " * assets/surf/font/shift.json. Generiert von build-textures.py – nicht von Hand bearbeiten. */\n"
        f"window.SURF_TEXTURES = {json.dumps(textures, indent=2)};\n"
        f"window.SURF_SPACE_ADVANCES = {json.dumps(advances, ensure_ascii=True)};\n",
        encoding="utf-8",
    )
    print(f"textures.js written ({len(textures)} textures, {len(advances)} space advances)")


if __name__ == "__main__":
    main()
