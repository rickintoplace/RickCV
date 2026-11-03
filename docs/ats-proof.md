# ATS-Nachweis

Erzeugt von `node tools/ats-proof.mjs` – jeder kann es wiederholen. Jedes Theme wird mit Chromium
gedruckt (deutsches Beispiel auf A4, englisches auf US Letter) und von unabhängigen Textlesern
gelesen, wie sie in Bewerbungssystemen stecken. ✓ heißt: Name, E-Mail und Telefon stehen am Stück
im Text, der Name steht vor der ersten Station, und jede Station steht zusammen – Titel, Zeitraum
und Arbeitgeber, ohne dass Text aus der Seitenspalte dazwischenfährt. „Datei“ prüft Tags,
Sprachangabe und eingebettete Schriften.

Das ist kein Versprechen für ein bestimmtes System: kommerzielle Parser (Textkernel bei Personio
und SAP SuccessFactors, Workday, Greenhouse) sind nicht frei verfügbar und nicht Teil dieses Tests.

Stand 2026-11-03 · Chromium 156.0.8078.79 Arch Linux · pdftotext version 26.10.0 · pdfminer.six

| Theme | Fassung | Datei | pdftotext -raw | pdftotext | pdf.js | pdfminer.six |
| --- | --- | --- | --- | --- | --- | --- |
| akademisch | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| akademisch | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| banner | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| banner | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| clean | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| clean | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| dynaline | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| dynaline | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| einspaltig | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| einspaltig | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| einsteiger | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| einsteiger | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| grossdruck | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| grossdruck | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| icons | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| icons | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| klassisch | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| klassisch | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| kompakt | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| kompakt | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| marginheads | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| marginheads | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| rightrail | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| rightrail | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| terminal | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| terminal | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |

**Alle 26 Fassungen bestanden.**
