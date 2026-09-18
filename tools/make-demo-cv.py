# -*- coding: utf-8 -*-
"""Baut die Beispieldatei fuer die Vorfuehrung: tests/fixtures/demo-cv.pdf

Aufruf:
    python3 tools/make-demo-cv.py

Das ist ein erfundener Lebenslauf in fremdem Aufbau – zweispaltig, mit Foto,
Projektmarken und einer Unterschrift auf dem Anschreiben. Er wird von
tools/record-demo.mjs in RickCV fallen gelassen; das GIF im README zeigt
also, was der Import aus einer fremden Datei wirklich macht.

Die Bilder liegen als Dateien in examples/demo-assets/ und werden hier als
data:-Adressen eingebettet. Wer bessere Bilder hat, legt sie unter demselben
Namen ab und ruft das Skript erneut auf.
"""
import base64
import io
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "examples", "demo-assets")
OUT_HTML = os.path.join(ROOT, "tests", "fixtures", "demo-cv-quelle.html")
OUT_PDF = os.path.join(ROOT, "tests", "fixtures", "demo-cv.pdf")

TYPES = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp"}


MAX_EDGE = 720  # mehr braucht kein Bild auf einem A4-Blatt


def shrink(raw, mime):
    """Grosse Bilder kleinrechnen – sonst wiegt die Beispieldatei ein Vielfaches.

    Ohne Pillow bleibt das Bild, wie es ist; die Datei wird dann nur groesser.
    """
    try:
        from PIL import Image
    except ImportError:
        return raw, mime
    try:
        image = Image.open(io.BytesIO(raw))
    except Exception:
        return raw, mime
    if max(image.size) <= MAX_EDGE:
        return raw, mime

    scale = MAX_EDGE / float(max(image.size))
    image = image.resize((max(1, int(image.width * scale)),
                          max(1, int(image.height * scale))), Image.LANCZOS)
    buffer = io.BytesIO()
    if mime == "jpeg":
        image.convert("RGB").save(buffer, "JPEG", quality=82)
    else:
        image.save(buffer, "PNG", optimize=True)
    return buffer.getvalue(), mime


def data_uri(name):
    """Bild aus examples/demo-assets/<name>.* als data:-Adresse."""
    for extension, mime in TYPES.items():
        path = os.path.join(ASSETS, name + extension)
        if os.path.exists(path):
            with open(path, "rb") as handle:
                raw, mime = shrink(handle.read(), mime)
            return "data:image/%s;base64,%s" % (mime, base64.b64encode(raw).decode("ascii"))
    raise SystemExit("Bild fehlt: %s.(jpg|png|webp) in examples/demo-assets/" % name)


def browser():
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        found = shutil.which(name)
        if found:
            return found
    raise SystemExit("Kein Chromium gefunden – ohne Browser kein PDF.")


PAGE = u"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0 }
body { margin:0; font-family:"DejaVu Sans",sans-serif; font-size:10.5pt; color:#1d2430 }
.page { width:210mm; height:297mm; box-sizing:border-box; display:flex; page-break-after:always }
.side { width:64mm; background:#eef2f4; padding:12mm 8mm; box-sizing:border-box }
.main { flex:1; padding:12mm 12mm 10mm; box-sizing:border-box }
h1 { font-size:21pt; margin:0 0 1mm; letter-spacing:-0.2pt }
.role { font-size:11pt; letter-spacing:2pt; text-transform:uppercase; color:#48596b; margin-bottom:5mm }
h2 { font-size:11.5pt; margin:6mm 0 2.5mm; color:#1a4f6e; text-transform:uppercase; letter-spacing:1pt }
.side h2 { margin-top:7mm; font-size:10pt }
p { margin:0 0 1.4mm }
.photo { width:100%%; border-radius:2mm; display:block; margin-bottom:6mm }
.entry { margin-bottom:4mm }
.when { float:right; color:#5a6b7d; font-size:9.5pt }
.what { font-weight:700 }
.where { color:#48596b; font-size:9.5pt; margin-bottom:0.8mm }
ul { margin:0.8mm 0 0 4.5mm; padding:0 }
li { margin-bottom:0.6mm }
.skill { display:flex; justify-content:space-between; margin-bottom:1.2mm; font-size:9.5pt }
.dots { letter-spacing:1pt; color:#1a4f6e }
.proj { display:flex; gap:4mm; align-items:flex-start; margin-bottom:4mm }
.proj img { width:13mm; border-radius:2mm }
.pname { font-weight:700 }
.letter { padding:30mm 20mm; box-sizing:border-box }
.sig { width:48mm; margin-top:5mm }
</style></head><body>

<div class="page">
  <div class="side">
    <img class="photo" src="%(photo)s">
    <h2>Contact</h2>
    <p>Gartenstraße 14</p>
    <p>04109 Leipzig</p>
    <p>nora.feldkamp@example.de</p>
    <p>+49 341 5540118</p>
    <h2>Skills</h2>
    <div class="skill"><span>Go</span><span class="dots">●●●●●</span></div>
    <div class="skill"><span>Rust</span><span class="dots">●●●●○</span></div>
    <div class="skill"><span>PostgreSQL</span><span class="dots">●●●●○</span></div>
    <div class="skill"><span>Kubernetes</span><span class="dots">●●●○○</span></div>
    <div class="skill"><span>Terraform</span><span class="dots">●●●○○</span></div>
    <div class="skill"><span>Observability</span><span class="dots">●●●●○</span></div>
    <h2>Languages</h2>
    <div class="skill"><span>German</span><span>native</span></div>
    <div class="skill"><span>English</span><span>fluent (C1)</span></div>
    <div class="skill"><span>Spanish</span><span>basic (A2)</span></div>
    <h2>Interests</h2>
    <p>Long-distance cycling</p>
    <p>Public transport data</p>
    <p>Bread baking</p>
  </div>

  <div class="main">
    <h1>Nora Feldkamp</h1>
    <div class="role">Backend Engineer</div>
    <p>Ten years of building payment and scheduling systems that stay up. Happiest where
       correctness matters more than novelty, and where the on-call phone stays quiet.</p>

    <h2>Experience</h2>
    <div class="entry"><span class="when">05/2021 – present</span>
      <div class="what">Senior Backend Engineer</div>
      <div class="where">Nordlicht GmbH, Leipzig</div>
      <ul><li>Owns the settlement service: 40 million transactions a month</li>
          <li>Cut end-of-day reconciliation from 90 to 7 minutes</li>
          <li>Mentors three engineers and runs the on-call rotation</li></ul></div>
    <div class="entry"><span class="when">08/2018 – 04/2021</span>
      <div class="what">Backend Engineer</div>
      <div class="where">Fahrplanquelle e.G., Dresden</div>
      <ul><li>Open timetable API for regional transit, 2,800 daily users</li>
          <li>Moved the import pipeline from nightly batches to streaming</li></ul></div>
    <div class="entry"><span class="when">03/2016 – 07/2018</span>
      <div class="what">Software Developer</div>
      <div class="where">Kestrel Logistik AG, Halle</div>
      <ul><li>Route planning for 200 vehicles, written in Go</li>
          <li>Introduced integration tests; releases went weekly instead of monthly</li></ul></div>
    <div class="entry"><span class="when">09/2014 – 02/2016</span>
      <div class="what">Working student, Data Engineering</div>
      <div class="where">Universität Leipzig, Institute for Computer Science</div></div>

    <h2>Education</h2>
    <div class="entry"><span class="when">10/2012 – 09/2015</span>
      <div class="what">M.Sc. Computer Science</div>
      <div class="where">Universität Leipzig</div></div>
    <div class="entry"><span class="when">10/2009 – 09/2012</span>
      <div class="what">B.Sc. Computer Science</div>
      <div class="where">HTWK Leipzig</div></div>

    <h2>Projects</h2>
    <div class="proj"><img src="%(logo1)s">
      <div><div class="pname">fahrplanquelle.de</div>
           <div>Open departure data for 90 regional lines</div></div></div>
    <div class="proj"><img src="%(logo2)s">
      <div><div class="pname">gartenfunk</div>
           <div>Soil sensors on LoRaWAN, 40 gardens in Leipzig</div></div></div>
    <div class="proj"><img src="%(logo3)s">
      <div><div class="pname">ledgerlint</div>
           <div>Static checks for double-entry bookkeeping files</div></div></div>
  </div>
</div>

<div class="page"><div class="letter">
  <p>Nora Feldkamp · Gartenstraße 14 · 04109 Leipzig</p>
  <br><br>
  <p>Kestrel Logistik AG</p>
  <p>Human Resources</p>
  <br><br>
  <p><b>Application as Senior Backend Engineer</b></p>
  <br>
  <p>Dear Ms Brandt,</p>
  <br>
  <p>your posting mentions settlement systems that have outgrown their nightly batch runs.
     That is the problem I spent the last four years on: at Nordlicht I moved reconciliation
     from a 90-minute nightly job to a seven-minute streaming pipeline, without a single
     missed settlement window.</p>
  <br>
  <p>I would like to bring that experience to your team and would be glad to talk.</p>
  <br>
  <p>Kind regards,</p>
  <img class="sig" src="%(sig)s">
  <p>Nora Feldkamp</p>
</div></div>

</body></html>
"""


def main():
    html = PAGE % {
        "photo": data_uri("photo"),
        "logo1": data_uri("logo-1"),
        "logo2": data_uri("logo-2"),
        "logo3": data_uri("logo-3"),
        "sig": data_uri("signature"),
    }
    with io.open(OUT_HTML, "w", encoding="utf-8") as handle:
        handle.write(html)

    subprocess.run([browser(), "--headless", "--disable-gpu", "--no-sandbox",
                    "--no-pdf-header-footer", "--print-to-pdf=" + OUT_PDF,
                    "file://" + OUT_HTML], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for path in (OUT_HTML, OUT_PDF):
        print("  %-38s %5.0f kB" % (os.path.relpath(path, ROOT), os.path.getsize(path) / 1024.0))


if __name__ == "__main__":
    main()
