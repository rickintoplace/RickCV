# Lizenzen mitgelieferter Bestandteile

## Lucide

Die Symbole in `js/icon-data.js` stammen aus [Lucide](https://lucide.dev)
und sind unter der ISC-Lizenz eingebettet — siehe `LUCIDE-LICENSE.txt`.

Nur eine kuratierte Auswahl ist enthalten, damit der Icon-Picker schnell lädt
und ohne Netzwerk funktioniert. Die Datei wird erzeugt, nicht von Hand
gepflegt: neue Symbole gehören in die Auswahl im Erzeugungsskript, nicht
direkt in `icon-data.js`.

## Wortmarken ("Marken" im Symbolwähler)

Die beiden Logos in `js/icons.js` (GitHub, LinkedIn) sind eingebettete
SVG-Pfade. Die Marken selbst gehören ihren jeweiligen Inhabern; sie stehen
hier ausschließlich dazu, den eigenen Auftritt auf der jeweiligen Plattform
zu kennzeichnen und zu verlinken. Wer sie anders einsetzt, hält sich an die
Markenrichtlinien des jeweiligen Anbieters.

Die Liste ist von Hand gepflegt und bewusst kurz. Ein weiteres Logo ist eine
weitere Zeile in `BRANDS` — mit Pfad und passender `viewBox`.

## Schriften im Ordner `fonts/`

Alle Webfonts werden mitgeliefert statt von Google Fonts nachgeladen. Die
Dateien sind erzeugt, nicht handgepflegt: `python3 tools/fetch-fonts.py`
holt sie samt Lizenztexten und schreibt `fonts/fonts.css`.

Die Textschriften stehen unter der SIL Open Font License 1.1 — Open Sans,
Roboto, Lato, Inter, Source Sans 3, IBM Plex Sans, Merriweather und
EB Garamond. Ubuntu steht unter der Ubuntu Font Licence 1.0. Die
vollstaendigen Texte liegen in `licenses/fonts/`; sie gehoeren bei jeder
Weitergabe dazu.

## Material Symbols

Die Icon-Schrift steht unter der Apache-2.0-Lizenz (siehe
`licenses/fonts/material-symbols-LICENSE.txt`). Mitgeliefert wird nicht die
ganze Schrift mit rund 3300 Symbolen (2,3 MB), sondern ein Auszug mit genau
den Symbolen, die der Baukasten anbietet — rund 53 kB. Ein neues Symbol
gehoert deshalb in die Auswahl in `js/icons.js`, danach `tools/fetch-fonts.py`
erneut laufen lassen.
