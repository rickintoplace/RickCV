# -*- coding: utf-8 -*-
"""Erzeugt Vorschaubilder fuer jedes Theme in themes/.

Aufruf:
    python3 tools/make-theme-previews.py

Legt themes/previews/<name>.webp an und schreibt themes/README.md mit der
Galerie (englisch, wie das README daneben). Gebraucht wird ein Chromium und ein kurzlebiger lokaler Server –
ueber file:// laedt die Seite ihre Schriften nicht.

Wozu: ein Theme-Beitrag laesst sich damit ansehen statt lesen. Wer einen
Pull Request prueft, schaut auf ein Bild; wer ein Theme schreibt, sieht,
was er abgibt.
"""
import http.server
import io
import os
import re
import socketserver
import subprocess
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chromium import find_chromium  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEMES = os.path.join(ROOT, "themes")
SHOTS = os.path.join(THEMES, "previews")
PORT = 8749

PAGE = """<!DOCTYPE html><html lang="%(locale)s"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="styles.css">
<style>
  /*  Das Bild soll das Blatt sein und sonst nichts: kein Rahmen ringsum,
      kein Schatten, und vom zweiten Bogen keine Kante am unteren Rand. */
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
  var data = RickCVModel.createExample("%(locale)s");
  data.settings.showCoverLetter = false;
  data.languages.show = true;
  data.theme = { slug: "%(slug)s", name: "", css: "", source: "builtin" };
  RickCVRender.render(document, data);
  //  Ein zweites Mal, sobald die Schriften geladen sind – sonst zeigt das
  //  Vorschaubild einen Satz in der Ersatzschrift.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { RickCVRender.render(document, data); });
  }
</script></body></html>
"""


def browser():
    found = find_chromium()
    if not found:
        raise SystemExit("Kein Chromium gefunden – ohne Browser keine Vorschau. "
                         "CHROME=/pfad/zum/browser setzen.")
    return found


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


def shrink(path, target, width=640):
    """Verkleinert das Bild, wenn Pillow da ist.

    Ein Blatt in voller Breite kostet knapp 300 kB. In einer Galerie, die
    mit jedem Beitrag waechst, summiert sich das im Verlauf des Projekts –
    und gebraucht wird es nur als Vorschau. Fehlt Pillow, bleibt das Bild
    wie es ist; der Beitrag soll nicht an einer Abhaengigkeit scheitern.
    """
    try:
        from PIL import Image
    except ImportError:
        os.replace(path, target)
        return

    image = Image.open(path).convert("RGB")
    if image.width > width:
        height = round(image.height * width / image.width)
        image = image.resize((width, height), Image.LANCZOS)

    #  WebP: schaerfer als ein JPEG derselben Groesse und ein Bruchteil des
    #  PNGs. Eine Galerie, die mit jedem Beitrag waechst, bleibt so klein.
    image.save(target, "WEBP", quality=88, method=6)
    os.remove(path)


def field(css, key):
    """Ein Feld aus dem Theme-Kopf, zusammengefasst auf eine Zeile."""
    match = re.search(r"\b%s:\s*([\s\S]*?)\n\s*(?:[a-z-]+:|\*/)" % re.escape(key), css)
    return " ".join(match.group(1).split()) if match else ""


def main():
    chrome = browser()
    if not os.path.isdir(SHOTS):
        os.makedirs(SHOTS)

    slugs = sorted(
        name[:-4] for name in os.listdir(THEMES)
        if name.endswith(".css") and not name.startswith("_")
    )

    server = serve()
    rows = []
    try:
        for slug in slugs:
            probe = os.path.join(ROOT, ".theme-preview.html")
            io.open(probe, "w", encoding="utf-8").write(PAGE % {"slug": slug, "locale": "en"})
            shot = os.path.join(SHOTS, slug + ".png")
            target = os.path.join(SHOTS, slug + ".webp")

            subprocess.run([
                chrome, "--headless", "--disable-gpu", "--no-sandbox",
                #  Genau ein A4-Blatt bei 96 dpi – das Bild ist das Blatt.
                "--hide-scrollbars", "--force-device-scale-factor=1",
                "--window-size=794,1123", "--virtual-time-budget=9000",
                "--screenshot=" + shot,
                "http://127.0.0.1:%d/.theme-preview.html" % PORT,
            ], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            os.remove(probe)

            if not os.path.exists(shot):
                raise SystemExit("Vorschau fuer %s ist nicht entstanden." % slug)

            shrink(shot, target)

            css = io.open(os.path.join(THEMES, slug + ".css"), encoding="utf-8").read()
            #  Englisch zuerst: die Galerie steht im README neben dem
            #  englischen Text. Das Bindestrich-Feld muss mit in die
            #  Abbruchbedingung, sonst klebt "about-en:" an "about:".
            name = field(css, "name-en") or field(css, "name") or slug
            about = field(css, "about-en") or field(css, "about")
            rows.append((slug, name, about))
            print("  %-12s %6.1f kB" % (slug, os.path.getsize(target) / 1024.0))
    finally:
        server.shutdown()

    gallery = ["# Themes", "",
               "Every theme is a single CSS file. How to write one is in",
               "[CONTRACT.md](CONTRACT.md) — and the easiest way is the **workshop**",
               "inside the builder itself: Themes → Workshop, type, watch, download the file.",
               "", "These pictures are made by `python3 tools/make-theme-previews.py`.", ""]
    for slug, name, about in rows:
        gallery += ["## %s" % name, "",
                    "%s" % (about or ""), "",
                    "![%s](previews/%s.webp)" % (name, slug), "",
                    "`themes/%s.css`" % slug, ""]

    io.open(os.path.join(THEMES, "README.md"), "w", encoding="utf-8").write("\n".join(gallery))
    print("themes/README.md geschrieben (%d Themes)" % len(rows))


if __name__ == "__main__":
    main()
