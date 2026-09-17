# -*- coding: utf-8 -*-
"""Buendelt themes/*.css zu js/theme-data.js.

Aufruf:
    python3 tools/build-themes.py

Warum ueberhaupt ein Buendel? RickCV soll per Doppelklick auf index.html
laufen. Ueber file:// darf eine Seite aber keine Dateien nachladen – ein
fetch("themes/clean.css") scheitert dort. Ein erzeugtes Skript mit den
Themes darin laedt dagegen ueberall.

Beitragende sehen davon nichts: sie schreiben eine CSS-Datei in themes/
und lassen dieses Skript laufen. Wie bei js/icon-data.js ist die erzeugte
Datei mit eingecheckt, damit niemand etwas bauen muss, um RickCV zu
benutzen.
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEMES = os.path.join(ROOT, "themes")
OUT = os.path.join(ROOT, "js", "theme-data.js")

HEADER = """/*  theme-data.js – erzeugt von tools/build-themes.py, nicht von Hand pflegen.
 *
 *  Die mitgelieferten Themes aus themes/ als Zeichenketten. Ein eigenes
 *  Theme braucht diese Datei nicht: es wird im Baukasten geladen und reist
 *  im Dokument mit.
 */
(function (global) {
  "use strict";

  global.RickCVThemeData = {
"""

FOOTER = """  };
})(typeof window !== "undefined" ? window : this);
"""


def main():
    names = sorted(
        name for name in os.listdir(THEMES)
        if name.endswith(".css") and not name.startswith("_")
    )

    entries = []
    for name in names:
        slug = name[:-4]
        css = io.open(os.path.join(THEMES, name), encoding="utf-8").read()

        if "@rickcv-theme" not in css:
            raise SystemExit(
                "%s hat keinen Kopf '@rickcv-theme' – siehe themes/_starter.css" % name)

        declared = re.search(r"contract:\s*(\d+)", css)
        if not declared:
            raise SystemExit("%s nennt keine Vertragsfassung" % name)

        entries.append('    %s: %s' % (json.dumps(slug), json.dumps(css)))
        print("  %-16s %6.1f kB" % (name, len(css.encode("utf-8")) / 1024.0))

    io.open(OUT, "w", encoding="utf-8").write(
        HEADER + ",\n".join(entries) + "\n" + FOOTER)
    print("js/theme-data.js geschrieben (%d Themes)" % len(entries))


if __name__ == "__main__":
    main()
