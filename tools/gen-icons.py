# -*- coding: utf-8 -*-
"""Erzeugt js/icon-data.js aus dem lucide-static-Paket.

Aufruf:
    npm pack lucide-static && tar xzf lucide-static-*.tgz -C lucide-static/
    python3 tools/gen-icons.py


Wir betten nur eine kuratierte Auswahl ein: der Icon-Picker soll schnell
laden, und fuer einen Lebenslauf ist der Bedarf gut ueberschaubar.
Deutsche Suchbegriffe kommen dazu, damit die Suche zweisprachig ist.
"""
import json, os, re, io

SRC = os.environ.get("LUCIDE_SRC", "lucide-static/package")

# Kuratierte Auswahl, nach Themen gruppiert (Gruppe -> Lucide-Namen)
GROUPS = {
    "Bildung": ["graduation-cap", "school", "book-open", "book-marked", "library",
                "notebook-pen", "pencil-ruler", "microscope", "flask-conical",
                "atom", "calculator", "languages", "presentation"],
    "Arbeit": ["briefcase", "building-2", "factory", "store", "hard-hat",
               "wrench", "hammer", "cog", "clipboard-list", "file-text",
               "handshake", "users", "user-round", "id-card", "target",
               "trending-up", "chart-column", "chart-pie", "gavel", "scale"],
    "Technik": ["laptop", "monitor", "smartphone", "server", "database",
                "cloud", "code", "terminal", "git-branch", "cpu", "bug",
                "shield-check", "lock", "key-round", "wifi", "network",
                "binary", "braces", "component", "layers"],
    "Kreativ": ["palette", "brush", "pen-tool", "camera", "video", "film",
                "music", "headphones", "mic", "guitar", "piano", "drama",
                "image", "shapes", "wand-sparkles", "type"],
    "Gesundheit": ["stethoscope", "heart-pulse", "cross", "pill", "syringe",
                   "brain", "activity", "dumbbell", "hand-heart"],
    "Soziales": ["heart-handshake", "helping-hand", "users-round", "baby",
                 "dog", "cat", "leaf", "recycle", "sprout", "trees",
                 "globe", "earth", "sun", "droplet"],
    "Mobilitaet": ["car", "car-front", "bus", "train-front", "bike", "plane",
                   "ship", "truck", "map-pin", "map", "compass", "navigation",
                   "footprints", "fuel"],
    "Kontakt": ["mail", "phone", "house", "map-pinned", "link", "at-sign",
                "send", "message-circle", "calendar", "clock", "printer"],
    "Freizeit": ["mountain", "tent", "waves", "sailboat", "gamepad-2",
                 "dices", "puzzle", "utensils", "coffee", "wine", "cake-slice",
                 "shopping-basket", "flower", "tree-palm", "star", "trophy",
                 "medal", "award", "flame", "sparkles", "rocket", "lightbulb",
                 "gem", "crown", "party-popper", "book-heart", "telescope"],
}

# Ergaenzende deutsche Suchbegriffe (Lucide-Tags sind rein englisch)
DE = {
    "graduation-cap": "abitur studium universitaet abschluss schule",
    "school": "schule ausbildung",
    "book-open": "buch lesen lernen",
    "book-marked": "buch lehrbuch",
    "library": "bibliothek buecherei",
    "notebook-pen": "notizen schreiben",
    "pencil-ruler": "planung entwurf zeichnen",
    "microscope": "forschung labor wissenschaft",
    "flask-conical": "chemie labor",
    "atom": "physik naturwissenschaft",
    "calculator": "rechnen mathematik buchhaltung",
    "languages": "sprachen uebersetzen",
    "presentation": "praesentation vortrag schulung",
    "briefcase": "arbeit beruf job taetigkeit",
    "building-2": "firma unternehmen buero",
    "factory": "fabrik industrie produktion",
    "store": "laden handel verkauf einzelhandel",
    "hard-hat": "bau handwerk sicherheit",
    "wrench": "werkzeug wartung montage",
    "hammer": "handwerk bau",
    "cog": "technik maschine einstellungen",
    "clipboard-list": "aufgaben projekt organisation",
    "file-text": "dokument bericht unterlagen",
    "handshake": "vertrieb partnerschaft vertrag",
    "users": "team gruppe kollegen",
    "user-round": "person profil ich",
    "id-card": "ausweis bewerbung profil",
    "target": "ziel strategie",
    "trending-up": "wachstum erfolg umsatz",
    "chart-column": "statistik auswertung analyse",
    "chart-pie": "analyse anteil auswertung",
    "gavel": "recht jura anwalt richter",
    "scale": "recht gerechtigkeit waage",
    "laptop": "computer notebook it",
    "monitor": "bildschirm computer",
    "smartphone": "handy mobil app",
    "server": "server it infrastruktur",
    "database": "datenbank daten sql",
    "cloud": "cloud hosting",
    "code": "programmieren entwicklung software",
    "terminal": "konsole entwicklung",
    "git-branch": "versionierung entwicklung",
    "cpu": "hardware technik prozessor",
    "bug": "fehler testen qualitaet",
    "shield-check": "sicherheit schutz datenschutz",
    "lock": "sicherheit datenschutz",
    "key-round": "zugang schluessel sicherheit",
    "wifi": "netzwerk funk",
    "network": "netzwerk verbindung",
    "binary": "daten informatik",
    "braces": "code programmierung",
    "component": "baustein modul",
    "layers": "ebenen struktur",
    "palette": "design farbe gestaltung kunst",
    "brush": "malen kunst gestaltung",
    "pen-tool": "grafik design illustration",
    "camera": "fotografie foto",
    "video": "video film kamera",
    "film": "film kino medien",
    "music": "musik",
    "headphones": "musik audio podcast",
    "mic": "mikrofon podcast moderation gesang",
    "guitar": "gitarre musik instrument",
    "piano": "klavier musik instrument",
    "drama": "theater schauspiel buehne",
    "image": "bild grafik",
    "shapes": "formen design",
    "wand-sparkles": "zauber magie kreativ",
    "type": "schrift typografie text",
    "stethoscope": "medizin arzt pflege",
    "heart-pulse": "gesundheit medizin puls",
    "cross": "medizin erste hilfe",
    "pill": "medikament apotheke pharmazie",
    "syringe": "impfung medizin",
    "brain": "psychologie denken lernen",
    "activity": "aktivitaet gesundheit puls",
    "dumbbell": "sport fitness kraftsport",
    "hand-heart": "pflege fuersorge ehrenamt",
    "heart-handshake": "ehrenamt soziales engagement",
    "helping-hand": "hilfe ehrenamt unterstuetzung",
    "users-round": "gemeinschaft verein team",
    "baby": "kinder betreuung familie",
    "dog": "hund tiere tierpflege",
    "cat": "katze tiere tierpflege",
    "leaf": "natur umwelt nachhaltigkeit",
    "recycle": "recycling umwelt nachhaltigkeit",
    "sprout": "wachstum garten natur",
    "trees": "wald natur forst",
    "globe": "welt international global",
    "earth": "welt umwelt international",
    "sun": "sonne wetter energie",
    "droplet": "wasser umwelt",
    "car": "auto fuehrerschein pkw",
    "car-front": "auto fuehrerschein pkw",
    "bus": "bus nahverkehr",
    "train-front": "zug bahn schiene",
    "bike": "fahrrad rad",
    "plane": "flugzeug reisen luftfahrt",
    "ship": "schiff seefahrt",
    "truck": "lkw logistik transport",
    "map-pin": "ort adresse standort",
    "map": "karte reisen",
    "compass": "orientierung navigation",
    "navigation": "navigation richtung",
    "footprints": "wandern gehen",
    "fuel": "tanken energie",
    "mail": "email post nachricht",
    "phone": "telefon anruf",
    "house": "adresse zuhause wohnort",
    "map-pinned": "adresse standort",
    "link": "link webseite",
    "at-sign": "email adresse",
    "send": "senden nachricht",
    "message-circle": "nachricht chat kommunikation",
    "calendar": "termin datum kalender",
    "clock": "zeit stunden termin",
    "printer": "drucken buero",
    "mountain": "berge wandern natur",
    "tent": "camping zelten outdoor",
    "waves": "meer schwimmen wasser",
    "sailboat": "segeln boot wassersport",
    "gamepad-2": "gaming videospiele",
    "dices": "spiele brettspiele wuerfel",
    "puzzle": "puzzle raetsel logik",
    "utensils": "kochen essen gastronomie",
    "coffee": "kaffee pause gastronomie",
    "wine": "wein genuss",
    "cake-slice": "backen kuchen",
    "shopping-basket": "einkauf handel",
    "flower": "blumen garten natur",
    "tree-palm": "reisen urlaub",
    "star": "favorit bewertung kenntnisse",
    "trophy": "erfolg auszeichnung wettbewerb",
    "medal": "auszeichnung ehrung",
    "award": "auszeichnung zertifikat urkunde",
    "flame": "feuer leidenschaft energie",
    "sparkles": "highlight besonders",
    "rocket": "start karriere innovation",
    "lightbulb": "idee innovation kreativ",
    "gem": "wertvoll sammeln",
    "crown": "fuehrung leitung",
    "party-popper": "feiern veranstaltung events",
    "book-heart": "lesen hobby literatur",
    "telescope": "astronomie beobachten",
}

tags = json.load(io.open(os.path.join(SRC, "tags.json"), encoding="utf-8"))

def inner_svg(name):
    path = os.path.join(SRC, "icons", name + ".svg")
    if not os.path.exists(path):
        return None
    svg = io.open(path, encoding="utf-8").read()
    body = svg[svg.index(">", svg.index("<svg")) + 1 : svg.rindex("</svg>")]
    body = re.sub(r"\s+", " ", body).strip()
    return body

entries, missing = [], []
for group, names in GROUPS.items():
    for name in names:
        body = inner_svg(name)
        if body is None:
            missing.append(name)
            continue
        keywords = " ".join(sorted(set(tags.get(name, []) + DE.get(name, "").split())))
        entries.append((name, group, body, keywords))

if missing:
    raise SystemExit("Unbekannte Icons: " + ", ".join(missing))

out = io.StringIO()
out.write("""/*  icon-data.js – Icon-Katalog fuer den Picker.
 *
 *  Lucide-Pfade sind eingebettet (ISC-Lizenz, https://lucide.dev), damit der
 *  Picker ohne Netzwerk funktioniert und keine externe Quelle noetig ist.
 *  Erzeugt aus lucide-static; nicht von Hand bearbeiten.
 *
 *  Format je Eintrag: [name, gruppe, svg, suchbegriffe]
 */
window.RickCVIcons = window.RickCVIcons || {};
window.RickCVIcons.lucide = [
""")
for name, group, body, keywords in entries:
    out.write("  [%s, %s, %s, %s],\n" % (
        json.dumps(name), json.dumps(group, ensure_ascii=False),
        json.dumps(body), json.dumps(keywords, ensure_ascii=False)))
out.write("];\n")

dest = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "js", "icon-data.js")
os.makedirs(os.path.dirname(dest), exist_ok=True)
io.open(dest, "w", encoding="utf-8").write(out.getvalue())
print("Icons:", len(entries), "->", dest)
print("Groesse: %.1f KB" % (len(out.getvalue()) / 1024))
