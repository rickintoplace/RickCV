# Kontrollsatz für den Abgleich mit Stellenanzeigen

20 ausgedachte Anzeigen (12 deutsch, 8 englisch), geschrieben ohne Kenntnis von `js/jobmatch.js`
und von `tests/fixtures/jobs/`. Gemessen wird mit
`JOBS_DIR=tests/fixtures/jobs-holdout node tests/jobmatch-corpus.mjs`.

| Stand 3. November 2026 | beim ersten Lesen | nach einer Runde allgemeiner Korrekturen |
| --- | --- | --- |
| Muss-Begriffe gefunden | 72 % | 81 % |
| Kann-Begriffe gefunden | 87 % | 95 % |
| Muss/Kann richtig | 85 % | 88 % |
| Verbotenes als Anforderung | 18 | 10 |

Die Korrekturen betrafen nur Allgemeines (Überschriften mit Emoji, Versalien oder „…“, unbekannte
Abschnitte, umbrochener Fließtext, Verneinungen). Wer weiter verbessert, sollte für eine ehrliche
Zahl einen neuen Kontrollsatz schreiben lassen – dieser hier ist jetzt teilweise bekannt.
