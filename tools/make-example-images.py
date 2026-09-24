# -*- coding: utf-8 -*-
"""Rendert die Bilder des Beispieldokuments.

Aufruf:
    python3 tools/make-example-images.py

Liest die Zeichnungen aus tools/example-images/*.svg und legt sie als
img/example/<name>.webp ab. Das Foto (img/example/photo.webp) ist keine
Zeichnung und hat deshalb hier keine Quelle; es liegt fertig im Projekt.

Gebraucht wird ein Chromium (tools/chromium.py sagt, wo es gesucht wird);
er rechnet die Zeichnung auf eine Leinwand und packt sie als WebP.

Wozu: frueher lud das Beispiel seine Bilder von fremden Adressen – von
ibb.co, pexels und opengameart. Wer den Baukasten oeffnete, meldete sich
damit bei drei Unbekannten, und die Content-Security-Policy in cv.html
laesst das inzwischen gar nicht mehr zu. Die Bilder liegen jetzt im
Projekt, und ihre Quelle liegt daneben.
"""
import base64
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chromium import find_chromium  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, "tools", "example-images")
TARGET = os.path.join(ROOT, "img", "example")

#  Kantenlaenge in Pixeln. Die Projektbilder sind Marken von zwei
#  Zentimetern; 320 Punkte reichen dafuer gut 300 dpi.
SIZES = {}
DEFAULT_SIZE = 320
QUALITY = 0.86

PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<pre id="out"></pre>
<script>
  var image = new Image();
  image.onload = function () {
    var canvas = document.createElement("canvas");
    canvas.width = %(size)d;
    canvas.height = %(size)d;
    canvas.getContext("2d").drawImage(image, 0, 0, %(size)d, %(size)d);
    document.getElementById("out").textContent =
      "RESULT:" + canvas.toDataURL("image/webp", %(quality)s) + ":END";
  };
  image.onerror = function () {
    document.getElementById("out").textContent = "RESULT:error:END";
  };
  image.src = "data:image/svg+xml;base64,%(svg)s";
</script></body></html>
"""


def render(chrome, svg, size):
    page = PAGE % {
        "size": size,
        "quality": QUALITY,
        "svg": base64.b64encode(svg.encode("utf-8")).decode("ascii"),
    }
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False,
                                     encoding="utf-8") as handle:
        handle.write(page)
        probe = handle.name
    try:
        dom = subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-sandbox",
             "--virtual-time-budget=5000", "--dump-dom", "file://" + probe],
            capture_output=True, text=True, timeout=120, check=True,
        ).stdout
    finally:
        os.unlink(probe)

    match = re.search(r"RESULT:data:image/webp;base64,([A-Za-z0-9+/=]+):END", dom)
    if not match:
        raise SystemExit("Chromium hat kein WebP geliefert – kann er es kodieren?")
    return base64.b64decode(match.group(1))


def main():
    chrome = find_chromium()
    if not chrome:
        raise SystemExit("Kein Chromium gefunden. CHROME=/pfad/zum/browser setzen.")

    os.makedirs(TARGET, exist_ok=True)
    for name in sorted(os.listdir(SOURCES)):
        if not name.endswith(".svg"):
            continue
        slug = name[:-4]
        with open(os.path.join(SOURCES, name), encoding="utf-8") as handle:
            svg = handle.read()
        data = render(chrome, svg, SIZES.get(slug, DEFAULT_SIZE))
        with open(os.path.join(TARGET, slug + ".webp"), "wb") as handle:
            handle.write(data)
        print("  %s.webp  %d kB" % (slug, round(len(data) / 1024)))


if __name__ == "__main__":
    main()
