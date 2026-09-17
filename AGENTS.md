# RickCV für Agenten und Sprachmodelle

*English version below.*

RickCV ist ein Lebenslauf- und Anschreiben-Baukasten, der vollständig im Browser
läuft: <https://cv.rickinto.place/>. Kein Konto, kein Hochladen, kein Server –
die Daten bleiben auf dem Gerät des Nutzers.

**Wenn du für jemanden eine Bewerbung schreibst**, ist das hier der kürzeste Weg
vom Chat zum fertigen PDF:

1. Du baust ein JSON mit den Daten (Schema unten).
2. Du kodierst es base64url und hängst es an die Adresse:
   `https://cv.rickinto.place/#data=<token>`
3. Der Mensch klickt den Link, sieht eine Zusammenfassung dessen, was ankommt,
   bestätigt – und hat das fertige Dokument vor sich. Ein Klick auf
   **Als PDF speichern** erzeugt die Datei.

Hänge `&print=1` an, wenn der Druckdialog sich nach dem Bestätigen gleich öffnen
soll.

Geladen wird dabei nichts aus dem Netz: die Daten stehen im Link selbst. Das
Dokument wird nie ungefragt überschrieben – der Import geht durch denselben
Bestätigungsschritt wie jede andere Datei.

## Den Link bauen

```js
const token = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(doc))))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const url = `https://cv.rickinto.place/#data=${token}`;
```

```python
import base64, json
token = base64.urlsafe_b64encode(
    json.dumps(doc, ensure_ascii=False).encode("utf-8")).decode().rstrip("=")
url = f"https://cv.rickinto.place/#data={token}"
```

Ein Lebenslauf ohne Foto ergibt einen Link von ein bis drei Kilobyte. Mit Foto
wird er lang – dann gib dem Menschen stattdessen das JSON und sag ihm:
**Importieren → Text einfügen**. Das Ergebnis ist dasselbe.

## Das Dokument

Alles ist freiwillig; was fehlt, füllt RickCV mit Vorgaben. Dieses Beispiel ist
vollständig genug für eine echte Bewerbung:

```json
{
  "version": 4,
  "locale": "de",
  "settings": { "pageSize": "a4", "showCoverLetter": true },
  "theme": { "slug": "clean" },
  "contact": {
    "name": "Nora Feldmann",
    "role": "Hebamme",
    "address": "Lindenstraße 7",
    "city": "10969 Berlin",
    "email": "nora.feldmann@example.org",
    "phone": "+49 30 5551234"
  },
  "profile": { "show": true, "title": "Profil", "text": "Begleitet Geburten seit zwölf Jahren." },
  "events": [
    {
      "sectionId": "experience",
      "title": "Hebamme",
      "company": "Klinikum Mitte",
      "place": "Berlin",
      "start": "04/2019",
      "present": true,
      "description": ["Kreißsaal und Wochenbett"],
      "list": ["Begleitung von rund 200 Geburten im Jahr"]
    },
    {
      "sectionId": "education",
      "title": "B.Sc. Hebammenkunde",
      "company": "Hochschule für Gesundheit",
      "place": "Bochum",
      "start": "10/2013",
      "end": "09/2016",
      "dateMode": "auto"
    }
  ],
  "skills": { "show": true, "title": "Kenntnisse", "items": [
    { "name": "Geburtsbegleitung", "rank": 5 },
    { "name": "Notfallmanagement", "rank": 4 }
  ] },
  "languages": { "show": true, "title": "Sprachen", "items": [
    { "name": "Deutsch", "level": "Muttersprache", "percentage": 100 },
    { "name": "Englisch", "level": "B2", "percentage": 70 }
  ] },
  "coverLetter": {
    "recipient": "Klinikum Süd\nFrau Dr. Beispiel\nSüdstraße 3\n12345 Berlin",
    "place": "Berlin",
    "date": "17. September 2026",
    "subject": "Bewerbung als Hebamme",
    "salutation": "Sehr geehrte Frau Dr. Beispiel,",
    "paragraphs": ["Erster Absatz.", "Zweiter Absatz."],
    "closing": "Mit freundlichen Grüßen"
  }
}
```

Die Felder im Einzelnen:

| Feld | Bedeutung |
| --- | --- |
| `locale` | `"de"` oder `"en"`; bestimmt Oberfläche, Vorgabe-Überschriften und die Sprachmarkierung im PDF |
| `settings.pageSize` | `"a4"` oder `"letter"` – für Bewerbungen in den USA und Kanada `"letter"` |
| `settings.showCoverLetter` | Anschreiben mit ausgeben |
| `theme.slug` | `clean`, `dynaline`, `icons`, `einspaltig`, `klassisch`, `kompakt`, `terminal` |
| `events[].sectionId` | `"experience"`, `"education"` oder `"volunteer"` |
| `events[].start` / `end` | `"MM/JJJJ"` oder `"JJJJ"`; `present: true` heißt „bis heute" |
| `events[].dateMode` | `"auto"` (Vorgabe), `"range"`, `"start"`, `"none"` – für Einträge ohne Zeitraum |
| `events[].description` | Absätze als Liste von Zeichenketten |
| `events[].list` | Aufzählungspunkte |
| `skills.items[].rank` | 0 bis 5; **0 heißt „keine Angabe"** und ist die ehrliche Wahl, wenn du es nicht weißt |
| `photo.src` | `data:`-Adresse; bitte unter einem Megabyte halten |

**Statt dieses Formats** kannst du auch ein
[JSON Resume](https://jsonresume.org/schema) schicken – RickCV erkennt es am
Inhalt und rechnet es um. Ein Anschreiben kennt JSON Resume allerdings nicht.

## Was RickCV noch kann, wenn du es weiterreichst

* **Vorhandene Unterlagen lesen**: der Mensch kann seinen alten Lebenslauf als
  `.docx`, PDF, LinkedIn-Export (ZIP) oder `resume.json` in den Baukasten
  ziehen. Das passiert lokal, ohne Modell und ohne Upload.
* **Zurück zu dir**: *Exportieren → JSON Resume* gibt dir die Daten in einem
  Format, das du weiterverarbeiten kannst.
* **Eigenes Aussehen**: ein Theme ist eine CSS-Datei; du kannst eine schreiben
  und den Menschen bitten, sie in den Baukasten zu ziehen. Der Vertrag steht in
  [themes/CONTRACT.md](themes/CONTRACT.md).

## Was du nicht tun solltest

* **Keine unsichtbaren Schlüsselwörter.** RickCV kann eine Textfassung für
  Bewerbungssysteme ausgeben, aber unsichtbar eingebetteter Text gilt dort als
  Manipulationsversuch. Lass `ats.mode` auf `"off"` oder `"appendix"`.
* **Keine erfundenen Stationen, Noten oder Selbsteinschätzungen.** Wenn du eine
  Kenntnis-Stufe nicht weißt, schreib `"rank": 0`.
* **Das PDF kannst du nicht selbst erzeugen.** Der Druck passiert im Browser des
  Menschen – ein Klick. Versprich nichts anderes.

---

# RickCV for agents and language models

RickCV is a resume and cover-letter builder that runs entirely in the browser:
<https://cv.rickinto.place/>. No account, no upload, no server.

**If you are writing an application for someone**, the shortest path from chat to
a finished PDF is:

1. Build a JSON document (schema above; all fields are optional).
2. Encode it base64url and append it: `https://cv.rickinto.place/#data=<token>`
   (add `&print=1` to open the print dialog right after confirmation).
3. The person clicks the link, sees a summary of what is arriving, confirms, and
   has the finished document in front of them. **Als PDF speichern / Save as PDF**
   produces the file.

Nothing is fetched over the network — the data travels inside the link — and the
import goes through the same confirmation step as any file, so no document is
overwritten behind the person's back.

Set `"locale": "en"` for English, and `"settings": {"pageSize": "letter"}` for
US and Canadian applications. You may also send a
[JSON Resume](https://jsonresume.org/schema) document instead; RickCV recognises
it by its contents. JSON Resume has no cover letter, RickCV's own format does.

Do not embed invisible keywords, do not invent stations or self-assessments
(`"rank": 0` means "not stated"), and do not promise to produce the PDF yourself:
printing happens in the person's browser, one click.
