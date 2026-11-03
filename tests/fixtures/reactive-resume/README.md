# Prüfstand aus Reactive Resume

Die 18 Vorlagen-PDFs, die [Reactive Resume](https://github.com/reactive-resume/reactive-resume)
mitliefert (`apps/web/public/templates/pdf/`), und deren unabhängig transkribierte Sollwerte
(`packages/api/src/features/resume/fixtures/shipped-import.json`), Stand Commit `ffa9d20`
vom 3. November 2026. Lizenz: MIT, siehe `LICENSE` in diesem Ordner.

Reactive Resume verlangt von seinem eigenen PDF-Import auf diesen Dateien jedes Feld. Wir lesen
sie mit RickCVs Import (`tests/benchmark.test.mjs`) und messen Feld für Feld gegen dieselben
Sollwerte – Name, Rolle, E-Mail, Telefon, Ort, Webseite und jede Station mit Arbeitgeber,
Titel, Ort, Zeitraum und wörtlichen Aufzählungspunkten. Fällt ein Wert unter den
festgehaltenen Stand, schlägt der Test fehl.

Die Lebensläufe darin sind ausgedacht.
