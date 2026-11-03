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
| banner | de-a4 | ✓ | ✓ | ✗ Nachhaltigkeitsprojekt im Naturschutz: Zeitraum nicht bei der Station | ✓ | ✗ Abitur: Zeitraum nicht bei der Station; Praktikum: Zeitraum nicht bei der Station; Angefangene Ausbildung zum Tierpfleger: Zeitraum nicht bei der Station; Ferienspaß: Zeitraum nicht bei der Station; Selbstständigkeit: Zeitraum nicht bei der Station; Nachhaltigkeitsprojekt im Naturschutz: Zeitraum nicht bei der Station; Soziale Leistungen: Zeitraum nicht bei der Station |
| banner | en-letter | ✓ | ✓ | ✗ Social security: Zeitraum nicht bei der Station | ✓ | ✗ A-levels: Zeitraum nicht bei der Station; Work experience: Zeitraum nicht bei der Station; Apprenticeship in animal care (unfinished): Zeitraum nicht bei der Station; Environmental commitment: Zeitraum nicht bei der Station; Summer programme: Zeitraum nicht bei der Station; Self-employment: Zeitraum nicht bei der Station; Rainforest project: Zeitraum nicht bei der Station; Social security: Zeitraum nicht bei der Station |
| clean | de-a4 | ✓ | ✓ | ✗ Ferienspaß: Zeitraum nicht bei der Station | ✓ | ✗ Abitur: Zeitraum nicht bei der Station; Praktikum: Zeitraum nicht bei der Station; Angefangene Ausbildung zum Tierpfleger: Zeitraum nicht bei der Station; Ferienspaß: Zeitraum nicht bei der Station; Selbstständigkeit: Zeitraum nicht bei der Station; Nachhaltigkeitsprojekt im Naturschutz: Zeitraum nicht bei der Station; Soziale Leistungen: Zeitraum nicht bei der Station |
| clean | en-letter | ✓ | ✓ | ✓ | ✓ | ✗ A-levels: Zeitraum nicht bei der Station; Work experience: Zeitraum nicht bei der Station; Apprenticeship in animal care (unfinished): Zeitraum nicht bei der Station; Environmental commitment: Zeitraum nicht bei der Station; Summer programme: Zeitraum nicht bei der Station; Self-employment: Zeitraum nicht bei der Station; Rainforest project: Zeitraum nicht bei der Station; Social security: Zeitraum nicht bei der Station |
| dynaline | de-a4 | ✓ | ✓ | ✓ | ✓ | ✗ Abitur: Zeitraum nicht bei der Station; Praktikum: Zeitraum nicht bei der Station; Angefangene Ausbildung zum Tierpfleger: Zeitraum nicht bei der Station; Umweltengagement: Zeitraum nicht bei der Station; Ferienspaß: Zeitraum nicht bei der Station; Selbstständigkeit: Zeitraum nicht bei der Station; Nachhaltigkeitsprojekt im Naturschutz: Zeitraum nicht bei der Station; Soziale Leistungen: Zeitraum nicht bei der Station |
| dynaline | en-letter | ✓ | ✓ | ✗ Rainforest project: Zeitraum nicht bei der Station | ✓ | ✗ A-levels: Zeitraum nicht bei der Station; Work experience: Zeitraum nicht bei der Station; Apprenticeship in animal care (unfinished): Zeitraum nicht bei der Station; Environmental commitment: Zeitraum nicht bei der Station; Summer programme: Zeitraum nicht bei der Station; Self-employment: Zeitraum nicht bei der Station; Rainforest project: Zeitraum nicht bei der Station; Social security: Zeitraum nicht bei der Station |
| einspaltig | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| einspaltig | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| einsteiger | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| einsteiger | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| grossdruck | de-a4 | ✓ | ✓ | ✓ | ✓ | ✓ |
| grossdruck | en-letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| icons | de-a4 | ✓ | ✓ | ✗ Ferienspaß: Zeitraum nicht bei der Station | ✓ | ✗ Abitur: Zeitraum nicht bei der Station; Praktikum: Zeitraum nicht bei der Station; Angefangene Ausbildung zum Tierpfleger: Zeitraum nicht bei der Station; Ferienspaß: Zeitraum nicht bei der Station; Selbstständigkeit: Zeitraum nicht bei der Station; Nachhaltigkeitsprojekt im Naturschutz: Zeitraum nicht bei der Station; Soziale Leistungen: Zeitraum nicht bei der Station |
| icons | en-letter | ✓ | ✓ | ✓ | ✓ | ✗ A-levels: Zeitraum nicht bei der Station; Work experience: Zeitraum nicht bei der Station; Apprenticeship in animal care (unfinished): Zeitraum nicht bei der Station; Environmental commitment: Zeitraum nicht bei der Station; Summer programme: Zeitraum nicht bei der Station; Self-employment: Zeitraum nicht bei der Station; Rainforest project: Zeitraum nicht bei der Station; Social security: Zeitraum nicht bei der Station |
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

**8 von 26 Fassungen mit Befund.**
