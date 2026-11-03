# -*- coding: utf-8 -*-
"""Buendelt styles.css und die Schriften zu js/doc-assets.js.

Aufruf:
    python3 tools/build-doc-assets.py

Wozu? "Als Datei speichern" schreibt eine einzige HTML-Datei, die ohne
RickCV und ohne Netz genau so aussieht wie die Vorschau. Dafuer muessen das
Stylesheet und die benutzten Schriften hinein. Ueber file:// darf die Seite
sie aber nicht per fetch lesen – ein erzeugtes Skript dagegen laedt ueberall.

Das Buendel ist gross (die Schriften als base64) und wird deshalb erst beim
Speichern nachgeladen, nie beim Start. Wie js/theme-data.js ist es mit
eingecheckt, damit niemand etwas bauen muss, um RickCV zu benutzen;
tests/theme.test.mjs prueft, dass es zum Stand von styles.css passt.
"""
import base64
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "js", "doc-assets.js")

HEADER = """/*  doc-assets.js – erzeugt von tools/build-doc-assets.py, nicht von Hand pflegen.
 *
 *  Stylesheet und Schriften des Dokuments fuer "Als Datei speichern". Wird
 *  erst beim Speichern nachgeladen.
 */
(function (global) {
  "use strict";

  global.RickCVDocAssets = """

FOOTER = """;
})(typeof window !== "undefined" ? window : this);
"""


def read(path):
    with io.open(path, encoding="utf-8") as handle:
        return handle.read()


def font_faces():
    css = read(os.path.join(ROOT, "fonts", "fonts.css"))
    faces = []
    for block in re.findall(r"@font-face\s*{([^}]*)}", css):
        def prop(name):
            match = re.search(name + r"\s*:\s*([^;]+);", block)
            return match.group(1).strip() if match else ""
        family = prop("font-family").strip("'\"")
        src = re.search(r"url\('([^']+)'\)", block)
        if not family or not src:
            continue
        with open(os.path.join(ROOT, "fonts", src.group(1)), "rb") as handle:
            data = base64.b64encode(handle.read()).decode("ascii")
        faces.append({
            "family": family,
            "style": prop("font-style") or "normal",
            "weight": prop("font-weight") or "400",
            "range": prop("unicode-range"),
            "data": data,
        })
    return faces


#  Die Bilder des Beispiels liegen als Dateien im Projekt (js/model.js). Ein
#  eigenes Foto ist schon eine data:-Adresse; diese hier muessen erst eine
#  werden, sonst fehlen sie in der gespeicherten Datei.
def example_images():
    folder = os.path.join(ROOT, "img", "example")
    images = {}
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".webp"):
            continue
        with open(os.path.join(folder, name), "rb") as handle:
            images["./img/example/" + name] = "data:image/webp;base64," + base64.b64encode(handle.read()).decode("ascii")
    return images


def build():
    bundle = {"styles": read(os.path.join(ROOT, "styles.css")), "fonts": font_faces(),
              "images": example_images()}
    text = HEADER + json.dumps(bundle, ensure_ascii=True, indent=None) + FOOTER
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
    print("js/doc-assets.js: %d Schriftschnitte, %d kB" % (len(bundle["fonts"]), len(text) // 1024))


if __name__ == "__main__":
    build()
