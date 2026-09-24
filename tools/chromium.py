# -*- coding: utf-8 -*-
"""Findet ein Chromium fuer die Werkzeuge in tools/.

Dieselben Regeln wie tests/chromium.mjs:

  1. die Umgebungsvariable CHROME, wenn sie gesetzt ist
  2. ein Chromium oder Chrome im PATH
  3. die ueblichen Installationsorte unter macOS und Windows

Frueher suchten die Werkzeuge nur im PATH. Auf einem Mac liegt Chrome aber
in /Applications und nicht dort – die Werkzeuge meldeten dann "kein
Chromium", obwohl eines installiert war.
"""
import os
import shutil

NAMES = ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable")

PLACES = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    os.path.expanduser("~/Applications/Chromium.app/Contents/MacOS/Chromium"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
)


def find_chromium():
    """Pfad zu einem Chromium oder None."""
    own = os.environ.get("CHROME", "").strip()
    if own:
        return own if os.access(own, os.X_OK) else None
    for name in NAMES:
        found = shutil.which(name)
        if found:
            return found
    for place in PLACES:
        if os.access(place, os.X_OK):
            return place
    return None
