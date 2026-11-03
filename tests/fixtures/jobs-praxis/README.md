# Praxissatz für den Abgleich mit Stellenanzeigen

16 Anzeigen (12 deutsch, 4 englisch), jede mit einem Lebenslauf, wie ihn jemand mit diesem
Beruf tatsächlich hat – Zugbegleiter, Pflege, Bäckereiverkauf, Lager, Büro, Elektro, IT-Support,
Kita, Küche, Softwareentwicklung, Reinigung, Busverkehr; Warehouse, Barista, Frontend, Nursing.
Gemessen wird mit `node tests/jobmatch-praxis.mjs` (in der CI mit `--check`: jede Abweichung
scheitert).

Die Anzeigen sind nachgestellt, nicht kopiert: Aufbau, Überschriften und Formulierungen folgen
echten Anzeigen dieser Berufe (Du- und Sie-Form, „Das bringst du mit“, „Quereinsteiger:innen
willkommen“, „Interessiert? Dann freuen wir uns …“, Werte des Unternehmens, Gendern in allen
Spielarten), der Wortlaut ist eigen. Echte Anzeigen stehen unter dem Urheberrecht ihrer
Verfasser und gehören nicht in ein öffentliches Repository. Die Zugbegleiter-Anzeige enthält die
Sätze, an denen der alte Abgleich gescheitert ist.

Anders als `tests/fixtures/jobs/` prüft dieser Satz den Abgleich so, wie er benutzt wird – mit
Lebenslauf: Wird „mindestens Hauptschulabschluss“ durch Abitur erfüllt? Steht ein Abschluss nie
als Kenntnis da? Kommen persönliche Eigenschaften für sich statt als Lücke? Und erscheint nichts,
womit niemand etwas anfangen kann („Rat“, „Tat“, „Situationen“, „Quereinsteiger“)?
