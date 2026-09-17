# -*- coding: utf-8 -*-
"""Erzeugt Vorschaubilder fuer jedes Theme in themes/.

Aufruf:
    python3 tools/make-theme-previews.py

Legt themes/previews/<name>.png an und schreibt themes/README.md mit der
Galerie. Gebraucht wird ein Chromium und ein kurzlebiger lokaler Server –
ueber file:// laedt die Seite ihre Schriften nicht.

Wozu: ein Theme-Beitrag laesst sich damit ansehen statt lesen. Wer einen
Pull Request prueft, schaut auf ein Bild; wer ein Theme schreibt, sieht,
was er abgibt.
"""
import http.server
import io
import os
import re
import shutil
import socketserver
import subprocess
import sys
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEMES = os.path.join(ROOT, "themes")
SHOTS = os.path.join(THEMES, "previews")
PORT = 8749

PAGE = """<!DOCTYPE html><html lang="%(locale)s"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="styles.css"></head>
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
</script></body></html>
"""


def browser():
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        found = shutil.which(name)
        if found:
            return found
    raise SystemExit("Kein Chromium gefunden – ohne Browser keine Vorschau.")


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


def shrink(path, width=640):
    """Verkleinert das Bild, wenn Pillow da ist.

    Ein Blatt in voller Breite kostet knapp 300 kB. In einer Galerie, die
    mit jedem Beitrag waechst, summiert sich das im Verlauf des Projekts –
    und gebraucht wird es nur als Vorschau. Fehlt Pillow, bleibt das Bild
    wie es ist; der Beitrag soll nicht an einer Abhaengigkeit scheitern.
    """
    try:
        from PIL import Image
    except ImportError:
        return

    image = Image.open(path).convert("RGB")
    if image.width > width:
        height = round(image.height * width / image.width)
        image = image.resize((width, height), Image.LANCZOS)

    #  Ein Lebenslauf ist fast durchgehend flaechig: mit einer Palette
    #  bleibt er scharf und braucht ein Drittel des Platzes.
    image.convert("P", palette=Image.ADAPTIVE, colors=128).save(path, optimize=True)


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
            io.open(probe, "w", encoding="utf-8").write(PAGE % {"slug": slug, "locale": "de"})
            target = os.path.join(SHOTS, slug + ".png")

            subprocess.run([
                chrome, "--headless", "--disable-gpu", "--no-sandbox",
                "--window-size=820,1160", "--virtual-time-budget=9000",
                "--screenshot=" + target,
                "http://127.0.0.1:%d/.theme-preview.html" % PORT,
            ], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            os.remove(probe)

            if not os.path.exists(target):
                raise SystemExit("Vorschau fuer %s ist nicht entstanden." % slug)

            shrink(target)

            css = io.open(os.path.join(THEMES, slug + ".css"), encoding="utf-8").read()
            name = (re.search(r"name:\s*(.+)", css) or [None, slug])[1].strip()
            about = (re.search(r"about:\s*([\s\S]*?)\n\s*(?:[a-z]+:|\*/)", css) or [None, ""])[1]
            about = " ".join(about.split())
            rows.append((slug, name, about))
            print("  %-12s %6.1f kB" % (slug, os.path.getsize(target) / 1024.0))
    finally:
        server.shutdown()

    gallery = ["# Themes", "",
               "Jedes Theme ist eine einzelne CSS-Datei. Wie man eine schreibt, steht in",
               "[CONTRACT.md](CONTRACT.md) – und am bequemsten geht es in der **Werkstatt**",
               "im Baukasten selbst: Themes → Werkstatt, tippen, zusehen, Datei herunterladen.",
               "", "Die Bilder hier erzeugt `python3 tools/make-theme-previews.py`.", ""]
    for slug, name, about in rows:
        gallery += ["## %s" % name, "",
                    "%s" % (about or ""), "",
                    "![%s](previews/%s.png)" % (name, slug), "",
                    "`themes/%s.css`" % slug, ""]

    io.open(os.path.join(THEMES, "README.md"), "w", encoding="utf-8").write("\n".join(gallery))
    print("themes/README.md geschrieben (%d Themes)" % len(rows))


if __name__ == "__main__":
    main()
