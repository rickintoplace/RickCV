# -*- coding: utf-8 -*-
"""Buendelt die Schriften als TrueType zu js/word-fonts.js.

Aufruf:
    python3 tools/build-word-fonts.py        (braucht fontTools und brotli)

Wozu? "Word (.docx)" bettet die Schriften des Designs in die Datei ein. Ohne
sie setzt Word eine Ersatzschrift, meist breiter – Zeilen brechen anders um,
und das Dokument sieht nicht mehr aus wie in RickCV. Word bettet nur
TrueType ein, im Ordner fonts/ liegt WOFF2; dieses Werkzeug packt aus und
fuegt die Teilmengen (latin, latin-ext) einer Schrift zu einer Datei
zusammen. Wie js/doc-assets.js ist das Buendel eingecheckt und wird erst
beim Export nachgeladen.
"""
import base64
import io
import json
import os
import re

from fontTools.ttLib import TTFont
from fontTools.merge import Merger

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "js", "word-fonts.js")

HEADER = """/*  word-fonts.js – erzeugt von tools/build-word-fonts.py, nicht von Hand pflegen.
 *
 *  Die Schriften des Dokuments als TrueType, zum Einbetten in die Word-Datei
 *  (js/export-docs.js). Wird erst beim Export nachgeladen.
 *  Lizenzen: licenses/README.md (SIL Open Font License, Apache-2.0).
 */
(function (global) {
  "use strict";

  global.RickCVWordFonts = """

FOOTER = """;
})(typeof window !== "undefined" ? window : this);
"""


def faces():
    css = io.open(os.path.join(ROOT, "fonts", "fonts.css"), encoding="utf-8").read()
    groups = {}
    for block in re.findall(r"@font-face\s*{([^}]*)}", css):
        def prop(name):
            match = re.search(name + r"\s*:\s*([^;]+);", block)
            return match.group(1).strip() if match else ""
        family = prop("font-family").strip("'\"")
        src = re.search(r"url\('([^']+)'\)", block)
        if not family or not src or "Material" in family:
            continue
        weight = "bold" if int(prop("font-weight") or 400) >= 600 else "regular"
        groups.setdefault((family, weight), []).append(os.path.join(ROOT, "fonts", src.group(1)))
    return groups


def truetype(paths):
    fonts = []
    for path in sorted(paths, key=lambda p: ("-ext" in p, p)):
        font = TTFont(path)
        font.flavor = None
        buffer = io.BytesIO()
        font.save(buffer)
        fonts.append(buffer.getvalue())
    if len(fonts) == 1:
        return fonts[0]
    files = []
    for index, data in enumerate(fonts):
        name = os.path.join("/tmp", "rickcv-word-font-%d-%d.ttf" % (os.getpid(), index))
        with open(name, "wb") as handle:
            handle.write(data)
        files.append(name)
    try:
        merged = Merger().merge(files)
        buffer = io.BytesIO()
        merged.save(buffer)
        return buffer.getvalue()
    except Exception as error:  # Teilmengen, die sich nicht vereinen lassen: latin genuegt
        print("  %s: nur latin (%s)" % (os.path.basename(paths[0]), error))
        return fonts[0]
    finally:
        for name in files:
            os.remove(name)


def rename(data, family, weight):
    """Word sucht eine eingebettete Schrift unter dem Namen im fontTable –
    der muss im name-Eintrag stehen. Google liefert manche Schnitte als
    Instanz einer variablen Schrift ("Source Sans 3 ExtraLight"); hier
    heissen sie wieder so, wie das CSS sie nennt."""
    font = TTFont(io.BytesIO(data))
    style = "Bold" if weight == "bold" else "Regular"
    table = font["name"]
    for name_id in (16, 17, 21, 22):
        table.removeNames(nameID=name_id)
    postscript = re.sub(r"[^A-Za-z0-9]", "", family) + "-" + style
    for name_id, value in ((1, family), (2, style), (4, family + " " + style), (6, postscript)):
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)
    os2 = font["OS/2"]
    os2.usWeightClass = 700 if weight == "bold" else 400
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b100000 if weight == "bold" else 0b1000000)
    font["head"].macStyle = 1 if weight == "bold" else 0
    buffer = io.BytesIO()
    font.save(buffer)
    return buffer.getvalue()


def main():
    out = {}
    for (family, weight), paths in sorted(faces().items()):
        data = rename(truetype(paths), family, weight)
        out.setdefault(family, {})[weight] = base64.b64encode(data).decode("ascii")
        print("  %-16s %-7s %6.1f kB" % (family, weight, len(data) / 1024))
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(HEADER + json.dumps(out, separators=(",", ":")) + FOOTER)
    print("geschrieben:", os.path.relpath(OUT, ROOT), "%.0f kB" % (os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
