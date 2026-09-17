# RickCV - Dynamic Resume & Cover Letter Template
     _____  _      _     _______      __
    |  __ \(_)    | |   / ____\ \    / /
    | |__) |_  ___| | _| |     \ \  / / 
    |  _  /| |/ __| |/ / |      \ \/ /  
    | | \ \| | (__|   <| |____   \  /   
    |_|  \_\_|\___|_|\_\\_____|   \/  [rɪk-si-vi]
    A dynamic template for your resume and cover letter

Build your CV and Cover Letter here: https://cv.rickinto.place/

Welcome to **RickCV** – a browser-based builder for professional resumes and cover letters. Fill in a form, watch the document update live, and save it as a PDF. No sign-up, no server, no build step: it is plain HTML, CSS and JavaScript, and everything you type stays on your own device.

It also includes features to optimize your resume for Applicant Tracking Systems (ATS), making it easy to tailor your content for both human and machine readers.

## The builder

![RickCV builder](https://github.com/rickintoplace/RickCV/blob/main/examples/builder.png?raw=true)

Edit on the left, watch the document on the right.

![Icon picker](https://github.com/rickintoplace/RickCV/blob/main/examples/icon-picker.png?raw=true)

Around 150 embedded icons, searchable in German and English.

## Preview

<p align="center">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/preview1.png?raw=true" width="48%">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/preview2.png?raw=true" width="48%">
</p>

Two A4 pages are generated and saved as a PDF file that can be read by both people and machines.

## Features

- **Visual editor:** Every part of the document is a form field. No code, no JSON, no prior knowledge required.
- **Live preview:** The page next to the editor re-renders as you type, and shows the page count.
- **Photo placement:** Drag the picture to move the crop, scroll to zoom, and pick a shape (full-width band, rounded square, or circle).
- **Your own categories:** *Education*, *Experience* and *Volunteering* are only the defaults. Rename them, reorder them, add your own — each one keeps a separate machine-readable meaning so applicant systems still file it correctly.
- **Icon picker:** ~150 embedded [Lucide](https://lucide.dev) icons plus Google Material Symbols, searchable in German and English. One stroke-weight slider drives both sets — Material Symbols is matched through its variable font axis so the two never look mismatched — plus size, color and an optional background shape.
- **Address as a map link:** Optionally the address in the sidebar links to OpenStreetMap — clickable in the PDF, unchanged on paper.
- **Two languages:** German and English for the interface and the document, including the language marking inside the PDF. Switch it straight from the header, or under *Optionen*.
- **Light and dark editor:** The button next to the language follows your system by default, and cycles to light or dark if you would rather decide yourself. Only the editor changes — the resume stays on white paper, because that is what gets printed.
- **Honest machine readability:** See exactly what an applicant tracking system reads, and edit it yourself if you want. No hidden text — see below.
- **A4 or US Letter:** one setting, and the page box, the print size and the cover letter's
  page breaks all follow. An A4 PDF sent to a US printer comes out scaled or clipped; this is
  the fix.
- **Dates as far as they exist:** a station can show a period, only its start, or no date at
  all. By default RickCV decides from what you typed — a further-education entry with a single
  year no longer drags an empty dash behind it.
- **Themes are files:** every layout is a single CSS file. Three come with RickCV; you can
  drop in someone else's, or write your own **in the builder itself** — a workshop with the
  document next to it that updates as you type, and a download button at the end. No checkout,
  no build, no reload.
- **Customizable styling:** colors, typeface, font size, sidebar width, headline sizes and DIN 5008 margins.
- **One page or many:** The resume stops after one page by default; switch on multi-page mode for longer careers.
  The cover letter needs no switch: it breaks onto further A4 sheets by itself once the text no longer fits,
  keeping your margins on every page and numbering them per DIN 5008 — and it says so when that happens,
  because one page is almost always the right answer.
- **Bring your data in:** Drop a file anywhere on the page — a RickCV backup, a
  [JSON Resume](https://jsonresume.org/) `resume.json`, the ZIP from LinkedIn's *Get a copy
  of your data* (or its single CSV files), an old resume as PDF, or plain text pasted into
  the dialog. RickCV shows what it found before anything is changed, and you choose whether
  it replaces the document or is added to it. Reading happens in your browser; no upload.
- **Export to PDF:** Crisp A4 pages, straight from the browser's print dialog.
- **Your data stays yours:** Everything is stored in your browser only. Export it as a RickCV backup (everything, including styling and photo) or as `resume.json` in the open JSON Resume format that other tools can read.

### Dynamically change the color
![color changes](https://github.com/rickintoplace/RickCV/blob/main/examples/dynamic%20accent%20color.png?raw=true)

### Customize icons, sections, timeline and chronology
<p align="center">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/example%20dynaline.png?raw=true" width="48%">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/example%20%20icons.png?raw=true" width="48%">
</p>

## How to Use

### Option A – use the hosted version

Open the site, fill in the form, click **Als PDF speichern**. That is the whole workflow.

### Option B – run it on your own machine

Download the repository and double-click `index.html`. It opens in your browser and works
straight away – no web server, no installation, no dependencies.

```bash
git clone https://github.com/rickintoplace/RickCV.git
```

> Only an internet connection is needed the first time, so the browser can fetch the Google
> fonts and icons.

### Building your document

1. **Person & Kontakt** – your name, role and contact details.
2. **Profilbild** – drop in a photo. Drag inside the small preview to move the crop, use the
   scroll wheel or the *Zoom* slider to scale it, and choose a shape.
3. **Werdegang** – add your stations. Each one belongs to a category, which decides the
   block it appears in. Under *Kategorien verwalten* you can rename the three defaults,
   reorder them or add your own — a category called "Meine Reise" still exports as
   professional experience, because its meaning is set separately. Use the ↑ ↓ buttons to
   reorder, ⧉ to duplicate and ✕ to delete.
4. **Kenntnisse, Sprachen, Interessen, Projekte, Mobilität** – optional sections. Each has a
   switch to hide it completely.
5. **Referenzen** – off by default; switch it on if you want them on the page.
6. **Anschreiben** – recipient, subject, salutation and as many paragraphs as you need.
   You can also upload a scan of your signature. Under **Folgeseiten** you decide what a
   second sheet looks like: letterhead on page one only (DIN 5008) or repeated, and how the
   page numbers are labelled.
7. **Design** – layout, accent color, typeface, font size, icon set, sidebar width and margins.
8. **Maschinenlesbarkeit** – see and edit what applicant systems read. See the section below.
9. **Optionen** – interface language, date format, chronological order and multi-page mode.

### Saving as PDF

Click **Als PDF speichern**. In the browser's print dialog choose:

| Setting | Value |
| --- | --- |
| Destination | Save as PDF |
| Paper size | A4 |
| Margins | None |
| Background graphics | Enabled |

Chrome gives the best results, since the layout is tuned for it.

### Keeping and moving your data

Your document is saved in your browser automatically, so you can close the tab and come back
later. Because the browser storage is tied to one browser on one device, use **Export** to
download a `.json` backup and **Import** to load it again on another computer, in another
browser, or to keep several versions of your CV side by side.

## About ATS, hidden text, and GEO

RickCV used to embed a copy of your data behind the layout, so that
applicant tracking systems would pick it up. **That is no longer the default.**

Research on applicant systems now treats invisible content as a manipulation
attempt. Detectors flag text below 4 pt, text in the background color, and 
any mismatch between *what a human sees* and *what a machine extracts*.
In a measurement study of 196,682 real resumes, roughly 1 % contained
hidden injected content, and **over 90 % of those were plain "data injection":
hidden skill and experience lists**.

What actually helps is duller and more reliable:

- **Chrome already exports a tagged PDF.** The file carries a structure tree and
  a language marking, so the reading order follows the DOM. RickCV puts your
  name and contact details before the career blocks for that reason.
- **The icon set matters more than you would think.** Material Symbols is a
  font, so the icon name ends up glued to your heading in the extracted text
  (`schoolEDUCATION`). The Lucide icons are SVG and leave nothing behind.
  Lucide is the default.
- **The document title becomes the PDF title** and the suggested filename.

If your layout is unusually graphic and you still want a safety net, the
**machine readability** section offers a *visible* extra page in plain text. You
can read exactly what it says, copy it, or write it yourself. The invisible mode
is still available, clearly marked, for people who want it anyway.

On **GEO (Generative Engine Optimization)**: a 2026 survey of 45 studies
concludes that no reviewed technique shows a stable, cross-platform causal
effect. There is nothing here worth building into a resume, so RickCV does not
pretend otherwise.

Sources: [Measuring Real-World Prompt Injection Attacks in LLM-based Resume
Screening](https://arxiv.org/abs/2605.28999) ·
[Optimizing Visibility in Generative Engines: A Critical Survey
(2023–2026)](https://arxiv.org/abs/2607.14035) ·
[PhantomLint](https://arxiv.org/abs/2508.17884) ·
[W3C: reading order in PDF](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF3)

## A note on browsers

Editing works in any modern browser. **The PDF export is tuned for Chrome** —
other browsers handle margins, page breaks and background colors differently.
RickCV shows a reminder in the preview bar when you are not using a
Chromium-based browser.

## Themes

A theme is one CSS file. Seven ship with RickCV —
[see them with pictures](themes/README.md):

| Theme | |
| --- | --- |
| **Clean** | the calm baseline: timeline at the edge, dates on the right |
| **Dynaline** | the timeline as an axis; how long something lasted sets the distance |
| **Icons** | symbols carry the layout, timeline down the middle |
| **Einspaltig** / Single column | header block, then one full-width column as a plain list — no timeline, no dots, no boxes |
| **Klassisch** / Classic | serifs, small caps and hairlines, stations as a list with hanging dates |
| **Kompakt** / Compact | the date moves onto the title's line; a career that needs two sheets elsewhere fits on one |
| **Terminal** | monospaced, square, dark sidebar, stations against a gutter rule |

The same mechanism takes any other file: drop a `.css` anywhere on the builder, or pick one in
**Themes**.

### Writing one without cloning anything

Open the builder, go to **Themes → Werkstatt/Workshop**, and start from the current theme or
an empty skeleton. What you type lands in the document on the right immediately; a list of
every hook and variable sits below the editor and drops selectors in at the cursor. When it
looks right, **Save as .css**, and that file *is* the theme. Contributing it means putting it
in `themes/` in a pull request.

That path exists on purpose: a theme system that starts with "clone the repository, run a
server, edit a file, reload" has no contributors.

### What a theme can rely on

The renderer's markup is a documented, versioned contract, see
[`themes/CONTRACT.md`](themes/CONTRACT.md). Blocks carry `data-block`, columns carry
`data-column`, career sections carry their machine-readable `data-role`, stations carry
`data-date-mode`, and the CSS variables at the top of `styles.css` are the styling API. A test
renders the example document and insists on every one of those hooks, so renaming a class
fails the build instead of quietly breaking other people's themes.

Themes are applied in the **`theme` cascade layer** and the base styles live in `base`, which
means a theme rule wins regardless of specificity. No `!important`, no need to out-specify
the stylesheet. The exception is deliberate: `!important` rules in the base layer still win,
which is what keeps a theme from breaking the icon font.

Two things are removed from a theme when it is loaded: `@import` and remote `url()` (a resume
should not report home when someone opens it, embed images and fonts as `data:` URIs), and
any rule aimed at the plain-text layer (`.ats-…`), because what an applicant tracking system
reads is not a question of looks. The builder says when it removed something.

```bash
python3 tools/build-themes.py          # themes/*.css → js/theme-data.js
python3 tools/make-theme-previews.py   # gallery images for themes/README.md
node tests/theme.test.mjs              # contract + every theme in themes/
```

The bundle exists because a page opened over `file://` may not fetch files, and RickCV has to
work by double-clicking `index.html`. Like `js/icon-data.js`, the generated file is committed.

## When an AI writes the application

People increasingly hand their notes to a language model and ask for the finished
application. RickCV is built to be the tool that model reaches for, and
[`AGENTS.md`](AGENTS.md) — mirrored as [`llms.txt`](llms.txt) — says exactly how:

The agent builds a JSON document, encodes it `base64url`, and hands the person a link:

```
https://cv.rickinto.place/#data=<token>&print=1
```

One click opens the builder with the document in it — through the same confirmation step as
any other import, showing what is about to arrive, so nothing is written behind the person's
back. Nothing is fetched over the network either: the data travels inside the link. A resume
without a photo makes a link of one to three kilobytes.

What an agent cannot do is produce the PDF: that happens in the person's browser, one click
on **Als PDF speichern**. The documentation says so rather than pretending otherwise, and it
also says what not to do — no invisible keywords, no invented stations, `"rank": 0` when a
skill level is unknown. The example document in `AGENTS.md` is imported by the test suite on
every run, so the instructions cannot rot.

## Bringing your data in

Nobody types their career twice. The **Importieren** button — or dropping a file anywhere on
the page — opens one dialog that takes whatever you have:

| What you have | What to do |
| --- | --- |
| A RickCV backup (`*.rickcv.json`) | Drop it in. Everything comes back, styling included. |
| A `resume.json` ([JSON Resume](https://jsonresume.org/schema)) | Drop it in. Work, education, volunteering, awards, certificates, skills, languages, interests, projects and references are mapped onto RickCV's sections. |
| An export from [Reactive Resume](https://rxresu.me/) | Drop it in. Its own JSON is read directly, the current shape and v4: periods written as free text (`March 2022 - Present`), HTML descriptions turned back into paragraphs and bullets, and its 0–5 skill levels kept as they are. Hidden items stay hidden. |
| Your LinkedIn data | *Settings → Data privacy → Get a copy of your data*. Drop the ZIP in — or the single CSV files, if your browser cannot unpack ZIPs. |
| A Word file (`.docx`) | Drop it in. This is the best route of all, see below. The old `.doc` format is not readable — save it as `.docx` in Word first. |
| An old resume as PDF | Drop it in. RickCV pulls the text out, separates columns, sorts it into sections and takes the pictures with it. Scanned PDFs hold no text, so those cannot work. |
| Anything else | Copy the text into the dialog's text box. |

Whatever the source, the dialog first shows **what it found** — name, number of stations,
skills, languages — and lets you decide between *Ersetzen* (a new document, keeping your
styling) and *Ergänzen* (append to what is already there, fill empty fields). Nothing is
changed until you confirm.

Text and PDF imports are a **draft**: a PDF knows about coordinates, not about careers, so
the guesses are labelled as such and want checking. The structured formats — RickCV, JSON
Resume, LinkedIn — are exact.

### Word documents

If your resume still exists as a `.docx`, use that rather than a PDF. A Word file is a ZIP
with XML inside, and that XML *states* what a PDF only implies: this paragraph is a heading,
this is a table cell, this is a bullet, this image belongs here. RickCV reads it directly —
headings from Word's own styles, table rows as label-and-value pairs, line breaks inside a
cell as separate lines (which is where templates hide the difference between employer, role
and degree), and the pictures out of `word/media`.

No converter, no upload: the same ZIP reader that opens a LinkedIn export opens the `.docx`,
and the XML is read in the browser.

### What a PDF gives away

A PDF holds no sections, no headings and no dates — only characters at coordinates. RickCV
puts the document back together from what *is* there:

- **Columns** are found by looking for the widest vertical lane no line of text crosses, so a
  sidebar is read as a sidebar and not woven into the main column.
- **Headings** are recognised by their keywords, and letter-spaced titles (`B E R U F S -
  E R F A H R U N G`) are closed up first. Unknown headings are measured against the ones
  that were recognised — same size, same spacing — so a section ends where it really ends.
- **The name** is the largest type on the sheet, not the first line. In a two-column layout
  the first line is usually the sidebar; and where a narrow column breaks the name across two
  lines, the two are put back together.
- **Dates** are read wherever they sit: in front of the entry, at the end of the line, split
  over two lines (`Ausbildung 11/13` / `ZOOLINO, Bad Wimpeln – 09/15`), with two-digit years,
  German or English month names, and an open end (`heute`, `present`).
- **Pictures** are placed by where they sit on the page: the large upright one at the top
  becomes the photo, a flat wide one on a letter page becomes the signature, and a small
  image beside a project becomes that project's picture. What cannot be placed is left out
  rather than dropped somewhere random.
- **Label columns** — the shape most German templates use — are understood: a line like
  `Sprachkenntnisse   Deutsch, Muttersprache` puts its content where the label says, a date in
  the left column starts the entry, and `Führerschein   Klasse B` lands in the mobility
  section. Where a label carries no meaning, it is kept, because the same gap can equally
  separate two skills set side by side.
- **Employer before role** is handled: `Nordwind Energie GmbH, Kassel` followed by
  `Projektleiterin Netzausbau` is read as company, place and title — not as a title and a
  company.
- **Icon fonts** put their glyphs in Unicode's private use area, where they stick to the
  headings they decorate and quietly break them. Those characters are removed — unless most of
  the page is private-use, which means the PDF maps its whole text that way and removing
  anything would leave an empty page.
- **The cover letter** stops the reading: from the salutation on, nothing else is treated as
  part of the resume. So does the closing line of a German resume (`Beispielstadt, 16.09.2026`),
  which is followed only by a signature. A page break ends list sections too, so a letterhead on
  sheet two does not end up among your skills.
- **Icon fonts** contribute no text. They are recognised by the name of the embedded font, which
  is more reliable than looking at the characters: depending on the file, an icon arrives as a
  private-use character, as an empty piece, or as its spelled-out name (`school`).
- **When a PDF has no text for its headings** — bold type drawn as graphics, which is what
  Firefox does with variable fonts — RickCV says so and still salvages what is left: dates,
  employers, places and descriptions become stations under one category. It does not invent a
  name in that case, because the name was in the missing layer too.

Unreadable characters are dropped rather than passed through: a placeholder in the middle of a
word is worse than a gap, and the import tells you it happened.

Where little is recognised, RickCV says so and shows you the text it read, so you can sort it
in by hand instead of hunting for what went missing.

### Going the other way

*Exportieren* offers the same two doors: the complete RickCV backup, and `resume.json` in
the JSON Resume format, which other resume tools, themes and CLI renderers can read. Your
career data is yours to take elsewhere. The two differ on purpose: the backup holds
everything, the `resume.json` holds what the document actually shows — a section switched
off is not part of your resume.

None of this involves a server. Files are read in the browser, including the PDF: pdf.js
lives in `vendor/` and is loaded from your own copy of the site.

## Hosting it yourself

RickCV is a static site. Upload the files and you are done.

### GitHub Pages

The repository ships with a workflow at `.github/workflows/pages.yml`. Enable it once:

1. Push the repository to GitHub.
2. Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.

Every push to `main` then publishes the site to
`https://<username>.github.io/<repository>/`.

### Any web space

Copy `index.html`, `cv.html`, `builder.css`, `builder.js`, `render.js`, `defaults.js` and
`styles.css` into a directory on your web space. That is all it takes.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | The builder – the page visitors open |
| `cv.html` | The document itself, shown in the preview frame and printed |
| `builder.css` | Styling of the editor |
| `styles.css` | Styling of the resume and cover letter |
| `js/i18n.js` | German and English texts |
| `js/model.js` | Data model, example data, migration of older saves |
| `js/render.js` | Turns the data into the resume and cover letter |
| `js/ats.js` | Builds the plain-text version |
| `js/icons.js`, `js/icon-data.js`, `js/icon-picker.js` | Icon catalogue and picker |
| `js/fields.js` | Reusable form controls |
| `js/sections.js` | What each editor section contains |
| `js/builder.js` | Wiring: state, history, saving, preview, printing |
| `js/import.js` | Reading and writing other formats: JSON Resume, LinkedIn, CSV, text |
| `js/import-dialog.js` | The dialog behind *Importieren* |
| `js/pdf-import.js` | Text and picture extraction from PDFs, loads `vendor/pdfjs` on demand |
| `js/docx-import.js` | Reads Word documents: ZIP, XML, tables, pictures |
| `js/themes.js` | Themes: header, safety checks, hook catalogue |
| `js/theme-data.js` | The shipped themes, generated by `tools/build-themes.py` |
| `themes/` | One CSS file per theme, plus `CONTRACT.md` and `_starter.css` |
| `vendor/pdfjs/` | Mozilla's pdf.js (Apache-2.0), only fetched when a PDF is imported |
| `tools/gen-icons.py` | Regenerates `js/icon-data.js` from lucide-static |

Every file is a plain script which is what lets you
open `index.html` by double-clicking it.

## Advanced customization

Everything in the **Design** section writes to CSS variables defined at the top of
`styles.css`. If you want to go further than the editor allows, that is the place to look.
`--accent-color`, `--font-color`, `--sidebar-width`, `--img-height` and friends are all
documented there.

Icons come from two sets. [Lucide](https://lucide.dev) icons are embedded in
`js/icon-data.js` (ISC licence, see `licenses/`); run `tools/gen-icons.py` to
change the selection. [Google Material
Symbols](https://fonts.google.com/icons) ship as a font in `fonts/`, cut down
to exactly the symbols the builder offers — 53 kB instead of the full 2.3 MB.

Nothing is fetched from Google at runtime. All nine document typefaces live in
`fonts/` as well, so the builder works offline and no visitor IP address is
handed to a third party. Run `python3 tools/fetch-fonts.py` to refresh the
files after changing the font list or the icon selection; it also pulls in the
licence texts.

Each typeface ships as **two static files, 400 and 700** — not as one variable
font covering both. That is deliberate, and it is about machine readability
rather than looks: with a variable font the browser derives the bold weight
itself, and some print paths cannot express that in a PDF. Firefox (through
cairo) draws such text as vector outlines — the page looks right, but the bold
parts are no longer text. In a resume that is the name, every section heading
and every job title: an applicant tracking system reads a document without them.
With real static faces every browser embeds a proper font, and the text stays
text.

For the same reason the document switches **ligatures off**
(`font-variant-ligatures: none` in `styles.css`). A single glyph for "fl" saves
nothing and costs a word: printed through cairo it arrives without a mapping, so
`Tierpflege` reaches the reader as `Tierp?ege`. The icon font is exempt — it
builds its symbols out of ligatures.

The two sets measure weight differently: Lucide in stroke pixels on a 24-unit
grid, Material Symbols on a variable font axis. Their defaults (`stroke 2`
and `wght 400`) look nothing alike side by side: Material comes out roughly twice
as heavy. RickCV maps them onto one slider, calibrated by comparing them
directly: `stroke 1.75` matches `wght 200`. Material glyphs also carry padding
inside their box and render about 8 % smaller at the same size, which the
stylesheet compensates for.

## Technologies Used

- **HTML5** - For structuring the resume and cover letter content.
- **CSS3** - For styling the layout, including responsive design and custom themes.
- **JavaScript** - For the editor, the live preview and the document rendering. No frameworks, no build step, no dependencies.
- **Self-hosted webfonts** - Nine document typefaces and a trimmed Material Symbols icon font in `fonts/`, generated by `tools/fetch-fonts.py`. No runtime call to Google.

## Contributing

If you’d like to contribute to the development of RickCV, feel free to fork the repository, make your changes, and create a pull request. I welcome any improvements or new features that could enhance this template.

There is no build step and there are no dependencies to install: open `index.html` and you
are developing. The import path has a test suite, because parsing other people's file
formats is where silent breakage lives:

```bash
node tests/import.test.mjs
```

```bash
node tests/theme.test.mjs
```

The first needs nothing but Node (20 or newer) — the browser code runs in a small sandbox that
pretends to be a `window`. The second adds a headless Chromium where one is installed, to check
the DOM contract on a really rendered document; without a browser it skips that part. Fixtures live in `tests/fixtures/`: a JSON Resume, a plain-text
resume, a LinkedIn export ZIP and a two-column PDF (its source HTML sits next to it). If you
add a format or touch the heuristics, add a fixture.

## License

RickCV is free software under the **GNU Affero General Public License, version 3 or
later** (AGPL-3.0-or-later). The full text is in [`LICENSE`](LICENSE).

In plain words: use it, run it, change it, host it — for yourself, inside a company, or as
a public service. The one condition is that anyone who uses your version, **including over
a network**, can get its source code. That is section 13 of the licence, and it is the
reason this project picked the AGPL over the MIT licence: it keeps a hosted fork open
instead of closed behind a paywall.

Third-party components keep their own licences: [Lucide](https://lucide.dev) icons (ISC),
the document typefaces (SIL Open Font Licence) and Material Symbols (Apache-2.0) in
[`licenses/`](licenses/), and, for the optional PDF import, Mozilla's
[pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0) in `vendor/`.




