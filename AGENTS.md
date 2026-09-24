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

RickCV's own *Copy as a link* writes `#z=<base64url(deflate-raw(json))>`, which is
three to four times shorter. Both forms are read; `#data=` is the simpler one to
produce and stays supported.

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
gets long; past roughly 100 000 characters, hand the person the JSON instead and
tell them: **Importieren / Import → paste the text**. The result is the same.

## The document

Everything is optional, `version` included; whatever is missing, RickCV fills with
defaults, and a value it does not know (a colour that is not a colour, an option
that does not exist) falls back to the default too. This
example is complete enough for a real application:

```json
{
  "version": 5,
  "locale": "de",
  "settings": { "pageSize": "a4", "showCoverLetter": true, "place": "Berlin" },
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
| `settings.place`, `settings.date` | The place and date line, used by the cover letter and by the resume footer alike. Leave both empty: the document then uses the person's city and the day it is opened |
| `settings.pageMode` | `"single"` (one sheet), `"flow"` (as many as the content needs), `"two"` (two sheets, each block assigned) |
| `settings.showCoverLetter` | include the cover letter |
| `settings.page2.sidebar` | `"keep"` (default) or `"none"` — whether sheets after the first keep the sidebar |
| `settings.page2.repeatHeader` / `repeatContact` / `repeatPhoto` | what a follow-up sheet repeats |
| `style.pageBottom` | centimetres of free space below the last block, `0.5` by default |
| `theme.slug` | `clean`, `dynaline`, `icons`, `klassisch`, `kompakt`, `terminal`, `rightrail`, `marginheads`, `banner` |
| `theme.css` | a complete CSS theme of your own; `theme.slug` then stays empty |
| `events[].sectionId` | `"experience"`, `"education"` or `"volunteer"` |
| `events[].start` / `end` | `"MM/YYYY"` or `"YYYY"`; `present: true` means "to this day" |
| `events[].dateMode` | `"auto"` (default), `"range"`, `"start"`, `"none"` — for entries without a period |
| `events[].description` | paragraphs, as a list of strings (a single string is split at its line breaks) |
| `events[].list` | bullet points |
| `skills.items[].rank` | 0 to 5; **0 means "not stated"** and is the honest choice when you do not know |
| `photo.src` | a `data:` URI; please keep it under a megabyte. Web addresses (`https://…`) are not loaded — neither here nor in `projects.items[].img` or `coverLetter.signatureImg` |

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


## Writing a theme for your person

The look of the document is one CSS file. If you design one, put it in `theme.css` of the
JSON (leave `theme.slug` empty) and it travels inside the link like everything else. The
contract — the hooks you may rely on, the variables, what gets stripped on load — is in
[`themes/CONTRACT.md`](themes/CONTRACT.md). Two rules matter: no `@import` and no remote
`url()` (a resume should not report home; embed images as `data:` URIs), and nothing aimed at
`.ats-…`. Both are removed when the theme is loaded, so a theme that breaks them silently
loses those rules.

If the theme is good enough for other people, tell your person about the **Contribute** button
in Themes → Workshop: one click opens a pull request against `themes/` with the file in it.
Do not send it anywhere else.

## What you should not do

* **No invisible keywords.** RickCV can emit a plain-text version for applicant
  tracking systems, but text hidden behind the layout counts as manipulation
  there. Leave `ats.mode` at `"off"` or `"appendix"` — an import switches
  `"hidden"` off anyway and tells the person so.
* **No invented stations, grades or self-assessments.** If you do not know a
  skill level, write `"rank": 0`.
* **You cannot produce the PDF yourself.** Printing happens in the person's
  browser — one click. Do not promise otherwise.
