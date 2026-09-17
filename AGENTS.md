# RickCV for agents and language models

RickCV is a resume and cover-letter builder that runs entirely in the browser:
<https://cv.rickinto.place/>. No account, no upload, no server — the data stays
on the person's device.

**If you are writing an application for someone**, this is the shortest path from
a chat to a finished PDF:

1. Build a JSON document (schema below).
2. Encode it `base64url` and append it to the address:
   `https://cv.rickinto.place/#data=<token>`
3. The person clicks the link, sees a summary of what is about to arrive,
   confirms — and has the finished document in front of them. One click on
   **Save as PDF** produces the file.

Append `&print=1` if the print dialog should open right after they confirm.

Nothing is fetched over the network: the data travels inside the link. And no
document is overwritten silently — the import goes through the same confirmation
step as any other file.

## Building the link

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

A resume without a photo makes a link of one to three kilobytes. With a photo it
gets long — then hand the person the JSON instead and tell them:
**Importieren / Import → paste the text**. The result is the same.

## The document

Everything is optional; whatever is missing, RickCV fills with defaults. This
example is complete enough for a real application:

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

Field by field:

| Field | Meaning |
| --- | --- |
| `locale` | `"de"` or `"en"`; sets the interface, the default headings and the language marker inside the PDF |
| `settings.pageSize` | `"a4"` or `"letter"` — use `"letter"` for the US and Canada |
| `settings.pageMode` | `"single"` (one sheet), `"flow"` (as many as the content needs), `"two"` (two sheets, each block assigned) |
| `settings.showCoverLetter` | include the cover letter |
| `settings.page2.sidebar` | `"keep"` (default) or `"none"` — whether sheets after the first keep the sidebar |
| `settings.page2.repeatHeader` / `repeatContact` / `repeatPhoto` | what a follow-up sheet repeats |
| `style.pageBottom` | centimetres of free space below the last block, `0.5` by default |
| `theme.slug` | `clean`, `dynaline`, `icons`, `einspaltig`, `klassisch`, `kompakt`, `terminal`, `rightrail`, `marginheads`, `banner` |
| `events[].sectionId` | `"experience"`, `"education"` or `"volunteer"` |
| `events[].start` / `end` | `"MM/YYYY"` or `"YYYY"`; `present: true` means "to this day" |
| `events[].dateMode` | `"auto"` (default), `"range"`, `"start"`, `"none"` — for entries without a period |
| `events[].description` | paragraphs, as a list of strings |
| `events[].list` | bullet points |
| `skills.items[].rank` | 0 to 5; **0 means "not stated"** and is the honest choice when you do not know |
| `photo.src` | a `data:` URI; please keep it under a megabyte |

German documents use German headings by default (`locale: "de"`), including the
cover letter laid out to DIN 5008 — the norm German employers expect.

**Instead of this format** you may also send a
[JSON Resume](https://jsonresume.org/schema) document, or an export from
Reactive Resume; RickCV recognises both by their contents. Neither of them has a
cover letter, RickCV's own format does.

## What RickCV can do if you hand it over

* **Read existing documents**: the person can drop their old resume in as
  `.docx`, PDF, a LinkedIn export (ZIP) or `resume.json`. That happens locally,
  without a model and without an upload.
* **Give the data back to you**: *Export → JSON Resume*, or *Export → link*,
  which copies exactly the kind of URL described above.
* **Its own look**: a theme is a single CSS file. You can write one and ask the
  person to drop it on the builder; the contract is in
  [themes/CONTRACT.md](themes/CONTRACT.md).

## What you should not do

* **No invisible keywords.** RickCV can emit a plain-text version for applicant
  tracking systems, but text hidden behind the layout counts as manipulation
  there. Leave `ats.mode` at `"off"` or `"appendix"`.
* **No invented stations, grades or self-assessments.** If you do not know a
  skill level, write `"rank": 0`.
* **You cannot produce the PDF yourself.** Printing happens in the person's
  browser — one click. Do not promise otherwise.
