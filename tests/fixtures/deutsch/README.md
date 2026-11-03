# Deutsche Lebensläufe mit festen Sollwerten

Fünf ausgedachte Personen (`*.truth.json`) in acht typischen deutschen Layouts: tabellarisch mit
„Persönliche Daten“, zweispaltig mit Seitenspalte, einspaltig mit „Titel, Einrichtung, Ort“,
Europass-ähnlich, Word-artig über LibreOffice gedruckt, nur Jahreszahlen, beschriftete Felder
(„Position:“, „Zeitraum:“) und Karten. Erzeugt mit `erzeuger-satz1.py` und `erzeuger-satz2.py`
(Chromium, LibreOffice). Die Sollwerte standen fest, bevor ein Importer die Dateien gelesen hat.

Gemessen am 3. November 2026, jeweils beim ersten Lesen:

| | RickCV vorher | RickCV nachher | Reactive Resume |
| --- | --- | --- | --- |
| Satz 1 (15 PDFs), Stationen | 60 % | 100 % | 0 % |
| Satz 2 (6 PDFs, erst nach Satz 1 erzeugt), Stationen | 44 % | 100 % | 0 % |

Reactive Resume erhält den Text, legt deutsche Abschnitte aber als freie Textblöcke ab – es kennt
nur englische Überschriften. `tests/benchmark.test.mjs` hält RickCVs Stand fest.
