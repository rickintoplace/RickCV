# Der Theme-Vertrag, Fassung 1

Ein Theme für RickCV ist **eine CSS-Datei**. Sie wird in der Kaskadenebene
`theme` angewendet und gewinnt damit gegen jede Regel der Grundstile – ohne
`!important`, ohne dass du deren Selektoren nachbauen musst.

Dieses Dokument beschreibt, woran du dich festhalten kannst. Was hier steht,
ändert sich nicht ohne Erhöhung der Vertragsfassung; alles andere im Markup
darfst du als zufällig betrachten.

> Du brauchst das Projekt nicht auf deinem Rechner. Öffne
> <https://cv.rickinto.place/>, geh auf **Themes → Werkstatt** und schreib dort
> los: jede Zeile wirkt sofort im Dokument daneben, am Ende lädst du die Datei
> herunter. Wer sie beitragen will, legt sie als `themes/<name>.css` in einen
> Pull Request.

## Der Kopf

```css
/* @rickcv-theme
   name:     Nordlicht
   author:   jemand
   licence:  CC0-1.0
   contract: 1
   about:    Ein Satz über das Aussehen.
*/
```

`name` und `contract` sind Pflicht. `licence` sollte CC0 oder MIT sein – der
Kern von RickCV steht unter der AGPL, das Aussehen soll niemand mitschleppen
müssen.

## Am `<body>`

| Haken | Bedeutung |
| --- | --- |
| `data-contract="1"` | Fassung dieses Vertrags |
| `data-template="<name>"` | Name des aktiven Themes, `custom` bei einem eigenen |
| `data-icon-set="lucide\|material"` | welcher Symbolsatz gesetzt ist |
| `data-theme-name="…"` | Anzeigename des Themes, falls gesetzt |

Als Wurzel genügt `[data-template]` – es ist immer nur ein Theme aktiv, der
eigene Name muss im Selektor nicht vorkommen.

## Aufbau eines Blattes

```
[data-page="1"]                 ein Blatt (.resume_wrapper)
  [data-column="sidebar"]       die Seitenspalte (.resume_left)
    [data-block="photo"]
    [data-block="profile"] [data-block="contact"] [data-block="languages"]
    [data-block="interests"] [data-block="projects"] [data-block="mobilitySB"]
  [data-column="main"]          der Hauptteil (.resume_right)
    [data-block="namerole"]
    [data-block="section"] [data-role="experience|education|volunteer|other"]
      .timeline
        .event [data-date-mode="auto|range|start|none"]
          .date   .dot   .event-content
    [data-block="skills"] [data-block="mobility"] [data-block="references"]
```

Jeder Block trägt zusätzlich `.resume_item`, jede Blocküberschrift
`.resume_title`.

Folgeblätter sehen genauso aus, tragen aber `data-page="2"`, `"3"` … Wer sie
anders setzen will, hat daran einen Haken – und `[data-sidebar="none"]` am
Blatt, wenn eingestellt ist, dass Folgeblätter einspaltig laufen. Eine
wiederholte Kopfzeile trägt zusätzlich `.resume_namerole-repeat`.

## Variablen

Sie stehen am Anfang von `styles.css` und sind die eigentliche Schnittstelle;
ein Theme kommt oft mit ein paar Zeilen davon aus.

| Variable | Bedeutung |
| --- | --- |
| `--accent-color` | Akzentfarbe |
| `--font-color`, `--background-color` | Schrift und Papier |
| `--sidebar-color`, `--sidebar-font-color`, `--sidebar-width` | die Seitenspalte |
| `--font-family`, `--base-font-size`, `--title-size` | Typografie |
| `--headline-size`, `--headline-size-main` | Überschriften in Seitenspalte und Hauptteil |
| `--title-gap` | Abstand unter einer Überschrift im Hauptteil |
| `--profile-align` | Bündigkeit des Profiltexts; eine Wahl im Editor überstimmt sie |
| `--left-margin`, `--right-margin`, `--bottom-margin`, `--header-height` | Ränder nach DIN 5008 |
| `--icon-size`, `--icon-color`, `--icon-bg` | Symbole |

## Was ein Theme nicht darf

Beim Laden werden entfernt:

* `@import` und `url()` auf entfernte Adressen. Ein Lebenslauf soll nicht
  verraten, wann und wo jemand an ihm sitzt. Bilder und Schriften gehören als
  `data:`-Adresse in die Datei.
* Regeln, die auf `.ats-…` zielen. Was ein Bewerbungssystem aus dem Dokument
  liest, ist keine Frage des Aussehens.

Dazu eine Obergrenze von 64 kB je Theme.

## Mitgelieferte Themes

`themes/*.css` werden von `tools/build-themes.py` zu `js/theme-data.js`
gebündelt – nötig, weil eine Seite über `file://` keine Dateien nachladen darf,
RickCV aber per Doppelklick laufen soll. Die erzeugte Datei ist eingecheckt:

```bash
python3 tools/build-themes.py
```

## Prüfen

```bash
node tests/theme.test.mjs
```

Der Test rendert das Beispieldokument, hält jeden hier dokumentierten Haken
fest und prüft jedes Theme in `themes/` auf Kopf, Vertragsfassung und
Entschärfung. Wer einen Klassennamen ändert, bekommt einen roten Test – nicht
einen Themenautor, dessen Datei still nicht mehr greift.
