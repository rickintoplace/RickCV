# -*- coding: utf-8 -*-
"""Erzeugt das Social-Preview-Bild (1200x630) fuer RickCV.

Aufruf:
    python3 tools/make-social-preview.py

Legt social-preview.png im Projektstamm ab. Das Bild erscheint als
Vorschaukarte, wenn ein Link zu cv.rickinto.place auf sozialen
Plattformen geteilt wird (og:image / twitter:image in index.html).

Farben aus dem Baukasten: Akzent #b3403a, Teal #286f6f, Text #16191d,
Hintergrund #f8f9fb. Schrift: Montserrat (Wortmarke) + Liberation Sans.
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (248, 249, 251)          # #f8f9fb
INK = (22, 25, 29)            # #16191d
RED = (179, 64, 58)           # #b3403a
TEAL = (40, 111, 111)         # #286f6f
GRAY = (107, 114, 128)        # #6b7280
WHITE = (255, 255, 255)
PAPER = (255, 255, 255)
PAPER_LINE = (223, 227, 232)  # #dfe3e8

FONT_DIR = "/home/paperclip/.fonts"
SYS = "/usr/share/fonts/truetype/liberation"


def font(path, size):
    return ImageFont.truetype(path, size)


def main():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Sanfte Teal-Flaeche oben rechts als dezenten Hintergrundakzent.
    d.rounded_rectangle([760, -80, 1280, 300], radius=120, fill=(230, 240, 239))
    d.rounded_rectangle([980, 300, 1320, 700], radius=120, fill=(230, 240, 239))

    # Wortmarke: "Rick" dunkel, "CV" rot.
    f_word = font(os.path.join(FONT_DIR, "Montserrat-SemiBold.ttf"), 96)
    d.text((80, 70), "Rick", font=f_word, fill=INK)
    w_rick = d.textlength("Rick", font=f_word)
    d.text((80 + w_rick, 70), "CV", font=f_word, fill=RED)

    # Headline + Unterzeile.
    f_head = font(os.path.join(SYS, "LiberationSans-Bold.ttf"), 52)
    f_sub = font(os.path.join(SYS, "LiberationSans-Regular.ttf"), 30)
    d.text((80, 250), "Resume & cover letter builder", font=f_head, fill=INK)
    d.text((80, 320), "in your browser", font=f_head, fill=INK)
    d.text((80, 420), "No account  ·  No upload  ·  No server", font=f_sub, fill=GRAY)
    d.text((80, 462), "Your data stays on your device", font=f_sub, fill=GRAY)

    # URL-Pille (Teal).
    url = "cv.rickinto.place"
    f_url = font(os.path.join(SYS, "LiberationSans-Bold.ttf"), 30)
    pad = 26
    uw = d.textlength(url, font=f_url)
    pill = [80, 520, 80 + uw + pad * 2, 520 + 62]
    d.rounded_rectangle(pill, radius=31, fill=TEAL)
    d.text((80 + pad, 520 + 12), url, font=f_url, fill=WHITE)

    # Dokument-Mockup rechts: weisses Blatt mit Kopfzeile und Zeilen.
    doc_x, doc_y, doc_w, doc_h = 830, 120, 300, 390
    d.rounded_rectangle([doc_x, doc_y, doc_x + doc_w, doc_y + doc_h],
                        radius=14, fill=PAPER, outline=PAPER_LINE, width=2)
    # Kopfzeile (Name + Rolle).
    d.rounded_rectangle([doc_x + 30, doc_y + 34, doc_x + 150, doc_y + 58],
                        radius=6, fill=RED)
    d.rounded_rectangle([doc_x + 30, doc_y + 72, doc_x + 210, doc_y + 88],
                        radius=5, fill=(210, 213, 218))
    # Abschnittszeilen.
    for i in range(5):
        y = doc_y + 130 + i * 46
        d.rounded_rectangle([doc_x + 30, y, doc_x + 250, y + 12],
                            radius=6, fill=PAPER_LINE)
        d.rounded_rectangle([doc_x + 30, y + 20, doc_x + 180, y + 30],
                            radius=6, fill=(236, 238, 241))
    # Teal-Haken unten rechts im Blatt.
    d.ellipse([doc_x + 250, doc_y + 330, doc_x + 274, doc_y + 354], fill=TEAL)
    d.line([doc_x + 256, doc_y + 344, doc_x + 262, doc_y + 350], fill=WHITE, width=4)
    d.line([doc_x + 262, doc_y + 350, doc_x + 270, doc_y + 338], fill=WHITE, width=4)

    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "social-preview.png")
    img.save(out, "PNG")
    print("wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
