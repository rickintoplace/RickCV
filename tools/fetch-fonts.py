# -*- coding: utf-8 -*-
"""Laedt die Webfonts von Google Fonts herunter und legt sie unter fonts/ ab.

Aufruf:
    python3 tools/fetch-fonts.py

Erzeugt fonts/fonts.css und die zugehoerigen .woff2-Dateien. Damit laedt
RickCV zur Laufzeit nichts mehr von fonts.googleapis.com oder
fonts.gstatic.com nach — das erspart den Besuchern eine Uebermittlung ihrer
IP-Adresse an Google und macht den Baukasten offline benutzbar.

Zwei Arten von Schriften:

  Textschriften  Die Auswahl aus FONT_STACK in js/render.js. Je Familie
                 werden die Schnitte 400 und 700 in den Subsets latin und
                 latin-ext geholt; mehr braucht das Dokument nicht.

  Material Symbols
                 Eine variable Icon-Schrift mit rund 3300 Symbolen und
                 2,3 MB. Der Baukasten bietet davon nur die kuratierte
                 Auswahl aus js/icons.js an, deshalb wird die Schrift auf
                 genau diese Symbole zusammengestrichen.

Die Dateien im Ordner fonts/ sind also erzeugt, nicht handgepflegt: ein
neues Symbol gehoert in die Auswahl in js/icons.js, danach dieses Skript
erneut laufen lassen.

Benoetigt: fonttools und brotli (pip install fonttools brotli).
"""
import io
import os
import re
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "fonts")
LICENSE_OUT = os.path.join(ROOT, "licenses", "fonts")

#  Google liefert je nach User-Agent unterschiedliche Formate aus. Mit einer
#  aktuellen Chrome-Kennung kommt woff2 – das kleinste und ueberall
#  unterstuetzte Format.
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/131.0.0.0 Safari/537.36")

WEIGHTS = ["400", "700"]        # mehr benutzt styles.css nicht
SUBSETS = ("latin", "latin-ext")

MATERIAL_URL = ("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
                ":opsz,wght,FILL,GRAD@24,100..700,0..1,-50..200")

#  Die Ligaturen der Icon-Schrift setzen sich aus den Buchstaben des
#  Iconnamens zusammen; ohne diese Glyphen entsteht kein Symbol.
LIGATURE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_ "

#  Googles Stylesheet lieferte nicht nur die Schrift, sondern auch diese
#  Klasse. Ohne sie stuende in der Kopfzeile das Wort "contrast" statt des
#  Symbols. Uebernommen wie ausgeliefert, damit sich nichts verschiebt.
MATERIAL_CLASS = """.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}"""


def fetch(url, binary=False):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    return data if binary else data.decode("utf-8")


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def read_list(path, marker, pattern):
    """Zieht eine Namensliste aus einer JavaScript-Datei."""
    source = open(os.path.join(ROOT, path), encoding="utf-8").read()
    start = source.index(marker)
    end = source.index("\n  };", start) if "{" in marker else source.index("\n  ];", start)
    return re.findall(pattern, source[start:end], re.M)


#  Wer eine Schrift mitliefert, liefert ihre Lizenz mit – die OFL verlangt
#  das ausdruecklich. Die Texte kommen aus den Quellrepositorys von Google.
LICENSE_SOURCES = [("ofl", "OFL.txt"), ("apache", "LICENSE.txt"), ("ufl", "UFL.txt")]
MATERIAL_LICENSE = ("https://raw.githubusercontent.com/google/material-design-icons"
                    "/master/LICENSE")


def fetch_license(family):
    """Holt den Lizenztext einer Familie aus dem Repository google/fonts."""
    name = family.lower().replace(" ", "")
    for directory, filename in LICENSE_SOURCES:
        url = "https://raw.githubusercontent.com/google/fonts/main/%s/%s/%s" % (
            directory, name, filename)
        try:
            text = fetch(url)
        except Exception:
            continue
        target = "%s-%s" % (slug(family), filename)
        open(os.path.join(LICENSE_OUT, target), "w", encoding="utf-8").write(text)
        return target
    sys.exit("Kein Lizenztext gefunden fuer " + family)


def ui_icons():
    """Die Symbolnamen, die der Editor selbst benutzt (THEME_ICONS)."""
    source = open(os.path.join(ROOT, "js/builder.js"), encoding="utf-8").read()
    line = re.search(r"var THEME_ICONS = \{(.*?)\};", source, re.S).group(1)
    return re.findall(r'"([a-z0-9_]+)"', line)


def parse_css(css):
    """Zerlegt Googles Stylesheet in (subset, weight, url, unicode_range)."""
    blocks = []
    for comment, block in re.findall(r"/\* (\S+) \*/\s*(@font-face \{.*?\})", css, re.S):
        url = re.search(r"url\((\S+?)\)", block).group(1)
        weight = re.search(r"font-weight:\s*([^;]+);", block).group(1).strip()
        ranges = re.search(r"unicode-range:\s*([^;]+);", block)
        blocks.append((comment, weight, url, ranges.group(1).strip() if ranges else None))
    return blocks


def text_fonts(families):
    """Laedt die Textschriften und liefert die @font-face-Regeln dazu."""
    rules = []
    for family in families:
        query = family.replace(" ", "+") + ":wght@" + ";".join(WEIGHTS)
        css = fetch("https://fonts.googleapis.com/css2?family=" + query + "&display=swap")

        #  Variable Familien liefern fuer jeden Schnitt dieselbe Datei. Dann
        #  genuegt eine Datei und eine Regel mit einem Gewichtsbereich; nur
        #  bei getrennten Dateien wird je Schnitt eine Regel geschrieben.
        for name in SUBSETS:
            blocks = [b for b in parse_css(css) if b[0] == name]
            if not blocks:
                continue
            urls = {block[2] for block in blocks}
            weights = [block[1] for block in blocks]
            ranges = blocks[0][3]

            if len(urls) == 1:
                spans = [("%s %s" % (min(weights), max(weights)) if len(weights) > 1
                          else weights[0], blocks[0][2], "%s-%s" % (slug(family), name))]
            else:
                spans = [(block[1], block[2], "%s-%s-%s" % (slug(family), block[1], name))
                         for block in blocks]

            for weight, url, stem in spans:
                filename = stem + ".woff2"
                path = os.path.join(OUT, filename)
                open(path, "wb").write(fetch(url, binary=True))
                rules.append(face(family, weight, filename, ranges, "%s %s" % (family, name)))
                print("  %-40s %6.1f kB" % (filename, os.path.getsize(path) / 1024.0))
    return rules


def ligature_map(font):
    """Liefert {Glyphenfolge: Ergebnisglyphe} fuer alle Ligaturen der Schrift.

    Die Icon-Schrift bildet Symbole als Ligatur des Iconnamens ab. Meist
    heisst die Ergebnisglyphe wie das Symbol, aber nicht immer: "phone" wird
    zu "call", "emoji_events" zu "trophy". Deshalb wird die Zuordnung aus der
    Schrift selbst gelesen statt geraten. Die Ligaturtabellen stecken in
    Extension-Lookups, die zuerst ausgepackt werden muessen.
    """
    ligatures = {}
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for table in lookup.SubTable:
            table = getattr(table, "ExtSubTable", table)
            for first, entries in getattr(table, "ligatures", {}).items():
                for entry in entries:
                    ligatures[(first,) + tuple(entry.Component)] = entry.LigGlyph
    return ligatures


def material_font(icons):
    """Laedt die Icon-Schrift und streicht sie auf die kuratierte Auswahl."""
    css = fetch(MATERIAL_URL)
    url = re.search(r"url\((\S+?)\)", css).group(1)
    raw = fetch(url, binary=True)
    print("  %-40s %6.1f kB" % ("(vollstaendig)", len(raw) / 1024.0))

    font = TTFont(io.BytesIO(raw))
    cmap = font.getBestCmap()
    ligatures = ligature_map(font)

    glyphs, missing = [], []
    for icon in icons:
        sequence = tuple(cmap[ord(c)] for c in icon if ord(c) in cmap)
        glyph = ligatures.get(sequence)
        if glyph:
            glyphs.append(glyph)
        else:
            missing.append(icon)
    if missing:
        sys.exit("Keine Ligatur in der Schrift fuer: " + ", ".join(missing))

    options = subset.Options()
    #  rlig und rclt bilden in dieser Schrift die Symbole; ohne sie bleibt
    #  der Iconname als Wort stehen.
    options.layout_features = ["rlig", "rclt", "liga", "calt", "ccmp"]
    #  Ohne diese Zeile zieht die Ligaturhuelle jedes Symbol wieder herein,
    #  dessen Name sich aus denselben Buchstaben schreiben laesst – also
    #  praktisch alle.
    options.layout_closure = False
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(glyphs=glyphs, text=LIGATURE_CHARS)
    subsetter.subset(font)

    font.flavor = "woff2"
    target = os.path.join(OUT, "material-symbols-outlined.woff2")
    font.save(target)
    print("  %-40s %6.1f kB" % ("material-symbols-outlined.woff2",
                                os.path.getsize(target) / 1024.0))

    #  "block" statt "swap": bis die Schrift da ist, lieber nichts zeigen
    #  als kurz das Wort "school" dort, wo ein Symbol hingehoert.
    return face("Material Symbols Outlined", "100 700",
                "material-symbols-outlined.woff2", None,
                "%d kuratierte Symbole" % len(icons), display="block")


def face(family, weight, filename, ranges, note, display="swap"):
    rule = ["/* %s */" % note,
            "@font-face {",
            "  font-family: '%s';" % family,
            "  font-style: normal;",
            "  font-weight: %s;" % weight,
            "  font-display: %s;" % display,
            "  src: url('%s') format('woff2');" % filename]
    if ranges:
        rule.append("  unicode-range: %s;" % ranges)
    rule.append("}")
    return "\n".join(rule)


def main():
    for directory in (OUT, LICENSE_OUT):
        if not os.path.isdir(directory):
            os.makedirs(directory)

    families = read_list("js/render.js", "var FONT_STACK = {",
                         r"^\s+\"?([A-Za-z0-9 ]+?)\"?:", )
    icons = read_list("js/icons.js", "var MATERIAL = [", r'\["([a-z0-9_]+)"')
    #  Der Umschalter fuer das Erscheinungsbild benutzt dieselbe Schrift wie
    #  die Lebenslauf-Symbole – ohne diese drei bliebe in der Kopfzeile das
    #  Wort "contrast" stehen.
    icons += ui_icons()
    print("Textschriften: %d, Material-Symbole: %d" % (len(families), len(icons)))

    rules = text_fonts(families)
    rules.append(material_font(icons))

    print("Lizenzen:")
    for family in families:
        print("  %-40s %s" % (family, fetch_license(family)))
    open(os.path.join(LICENSE_OUT, "material-symbols-LICENSE.txt"), "w",
         encoding="utf-8").write(fetch(MATERIAL_LICENSE))
    print("  %-40s %s" % ("Material Symbols Outlined",
                          "material-symbols-LICENSE.txt"))

    header = [
        "/*  fonts.css – erzeugt von tools/fetch-fonts.py, nicht von Hand pflegen.",
        " *",
        " *  Alle Schriften liegen lokal im Ordner fonts/. RickCV laedt damit",
        " *  nichts von Google nach: keine IP-Adresse der Besucher geht dorthin,",
        " *  und der Baukasten funktioniert auch ohne Netz.",
        " *",
        " *  Lizenzen siehe licenses/README.md.",
        " */",
        "",
    ]
    rules.append(MATERIAL_CLASS)
    open(os.path.join(OUT, "fonts.css"), "w", encoding="utf-8").write(
        "\n".join(header) + "\n\n".join(rules) + "\n")
    print("fonts/fonts.css geschrieben")


if __name__ == "__main__":
    main()
