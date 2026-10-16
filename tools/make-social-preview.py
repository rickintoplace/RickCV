# -*- coding: utf-8 -*-
"""Erzeugt das Vorschaubild fuer geteilte Links (img/social-preview.jpg).

Aufruf:
    python3 tools/make-social-preview.py

Wird ein Link zu cv.rickinto.place in einen Messenger, eine Mail oder ein
soziales Netz gelegt, holt der Dienst die Seite ab und zeigt eine Karte –
mit diesem Bild (og:image in index.html), 1200 x 630 Pixel.

Die Karte zeigt kein nachgezeichnetes Blatt, sondern echte: das
Beispieldokument, gesetzt von render.js in drei Themes. Schrift und Farben
kommen aus dem Projekt (fonts/, die Akzentfarbe des Baukastens), damit das
Bild auf jedem Rechner gleich herauskommt.

Ein geteilter Lebenslauf hat dieselbe Karte: was hinter dem # steht, geht
nie an den Server und damit auch an keinen Dienst, der die Vorschau baut.

Gebraucht wird ein Chromium (tools/chromium.py sagt, wo es gesucht wird)
und ein kurzlebiger lokaler Server – ueber file:// laedt die Seite ihre
Schriften nicht. Dazu Pillow: gerechnet wird doppelt so gross und dann
verkleinert, weil die Blaetter winzig sind und ihre Zeilen sonst ausfransen.
"""
import http.server
import io
import os
import socketserver
import subprocess
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chromium import find_chromium  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "img", "social-preview.jpg")
SHEET = ".social-sheet-probe.html"
CARD = ".social-card-probe.html"
PORT = 8751
W, H = 1200, 630

#  Dieselben drei wie in der Galerie im README.
THEMES = ("rightrail", "banner", "clean")

#  Ein Blatt, wie make-theme-previews.py es setzt; das Theme kommt aus der
#  Adresse, damit die Karte drei Rahmen mit derselben Seite fuellen kann.
SHEET_PAGE = """<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="styles.css">
<style>
  html, body { margin: 0; padding: 0; background: #fff; overflow: hidden }
  .document { margin: 0 }
  #CV { gap: 0 }
  #CV > .resume_wrapper { margin: 0 !important; box-shadow: none !important }
  #CV > .resume_wrapper ~ .resume_wrapper { display: none }
  .cover-letter_wrapper, .ats-page, .resume-page-number { display: none }
</style></head>
<body><div class="document"></div>
<script src="js/i18n.js"></script><script src="js/icon-data.js"></script>
<script src="js/icons.js"></script><script src="js/theme-data.js"></script>
<script src="js/themes.js"></script><script src="js/model.js"></script>
<script src="js/ats.js"></script><script src="js/render.js"></script>
<script>
  var data = RickCVModel.createExample("de");
  data.settings.showCoverLetter = false;
  data.languages.show = true;
  data.theme = { slug: location.search.slice(1), name: "", css: "", source: "builtin" };
  RickCVRender.render(document, data);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { RickCVRender.render(document, data); });
  }
</script></body></html>
"""

#  Farben aus builder.css (helles Schema): --ui-bg, --ui-text, --ui-muted,
#  --ui-accent, --ui-accent-soft. Die Marke steht wie im Kopf des
#  Baukastens: "RickCV" fett, daneben leise "Resume builder".
CARD_PAGE = """<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css">
<style>
  html, body { margin: 0; width: %(w)dpx; height: %(h)dpx; overflow: hidden }
  body {
    position: relative;
    font-family: "Inter", sans-serif;
    color: #22262b;
    background: #f2f4f6;
  }
  .text { position: absolute; left: 72px; top: 64px; width: 580px }
  .brand { display: flex; align-items: baseline; gap: 12px; font-size: 34px;
           font-weight: 700; letter-spacing: -0.02em }
  .brand small { font-size: 22px; font-weight: 400; letter-spacing: 0; color: #6b7280 }
  h1 { margin: 92px 0 0; font-size: 52px; line-height: 1.12; font-weight: 700;
       letter-spacing: -0.025em }
  .en { margin: 18px 0 0; font-size: 26px; line-height: 1.35; color: #6b7280 }
  .facts { margin: 34px 0 0; font-size: 21px; color: #6b7280 }
  .facts b { color: #286f6f; font-weight: 700 }
  .url { position: absolute; left: 72px; bottom: 58px; font-size: 24px;
         font-weight: 700; color: #286f6f }

  /*  Drei Blaetter, gefaechert um ihre Mitte; das vordere gerade. Sie
      laufen unten und rechts aus dem Bild – ein Stapel, kein Katalog. */
  .sheet { position: absolute; width: 794px; height: 1123px; border: 0;
           transform-origin: 50%% 50%%; background: #fff;
           box-shadow: 0 2px 6px rgba(16, 24, 40, 0.10), 0 24px 60px rgba(16, 24, 40, 0.18) }
  .s1 { left: %(x1)dpx; top: %(y1)dpx; transform: scale(0.42) rotate(-7deg) }
  .s3 { left: %(x3)dpx; top: %(y3)dpx; transform: scale(0.42) rotate(7deg) }
  .s2 { left: %(x2)dpx; top: %(y2)dpx; transform: scale(0.44) }
  .glow { position: absolute; left: 730px; top: 40px; width: 620px; height: 620px;
          border-radius: 50%%; background: #e6f0ef }
</style></head>
<body>
  <div class="glow"></div>
  <iframe class="sheet s1" src="%(sheet)s?%(t1)s"></iframe>
  <iframe class="sheet s3" src="%(sheet)s?%(t3)s"></iframe>
  <iframe class="sheet s2" src="%(sheet)s?%(t2)s"></iframe>
  <div class="text">
    <div class="brand">RickCV <small>Resume builder</small></div>
    <h1>Lebenslauf und Anschreiben im&nbsp;Browser</h1>
    <p class="en">Resume and cover letter in your browser.</p>
    <p class="facts"><b>Ohne Konto</b> &middot; <b>ohne Upload</b> &middot; freie Software</p>
  </div>
  <div class="url">cv.rickinto.place</div>
</body></html>
"""


def serve():
    handler = http.server.SimpleHTTPRequestHandler
    os.chdir(ROOT)

    class Quiet(handler):
        def log_message(self, *args):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("127.0.0.1", PORT), Quiet)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main():
    chrome = find_chromium()
    if not chrome:
        raise SystemExit("Kein Chromium gefunden – ohne Browser kein Bild. "
                         "CHROME=/pfad/zum/browser setzen.")
    try:
        from PIL import Image
    except ImportError:
        raise SystemExit("Pillow fehlt: python3 -m pip install Pillow")
    scale = 2

    sheet = os.path.join(ROOT, SHEET)
    card = os.path.join(ROOT, CARD)
    shot = TARGET + ".shot.png"
    io.open(sheet, "w", encoding="utf-8").write(SHEET_PAGE)
    io.open(card, "w", encoding="utf-8").write(CARD_PAGE % {
        "w": W, "h": H, "sheet": SHEET,
        #  Die Mitte jedes Blatts; ein Blatt ist 794 x 1123 vor dem Verkleinern.
        "x1": 830 - 397, "y1": 380 - 561, "x2": 985 - 397, "y2": 350 - 561,
        "x3": 1130 - 397, "y3": 400 - 561, "t1": THEMES[0], "t2": THEMES[1], "t3": THEMES[2]})

    server = serve()
    try:
        subprocess.run([
            chrome, "--headless", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--force-device-scale-factor=%d" % scale,
            "--window-size=%d,%d" % (W, H), "--virtual-time-budget=12000",
            "--screenshot=" + shot,
            "http://127.0.0.1:%d/%s" % (PORT, CARD),
        ], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    finally:
        server.shutdown()
        os.remove(sheet)
        os.remove(card)

    if not os.path.exists(shot):
        raise SystemExit("Das Bild ist nicht entstanden.")

    #  JPEG, nicht WebP: nicht jeder Dienst, der Vorschauen baut, liest
    #  WebP. Und nicht PNG: das Foto macht es ueber 300 kB, und WhatsApp
    #  laesst groessere Bilder gern weg. Ohne Farbunterabtastung bleibt die
    #  Schrift scharf.
    image = Image.open(shot).convert("RGB").resize((W, H), Image.LANCZOS)
    image.save(TARGET, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)
    os.remove(shot)
    print("img/social-preview.jpg  %.1f kB" % (os.path.getsize(TARGET) / 1024.0))


if __name__ == "__main__":
    main()
