# RickCV - Dynamic Resume & Cover Letter Template
     _____  _      _     _______      __
    |  __ \(_)    | |   / ____\ \    / /
    | |__) |_  ___| | _| |     \ \  / / 
    |  _  /| |/ __| |/ / |      \ \/ /  
    | | \ \| | (__|   <| |____   \  /   
    |_|  \_\_|\___|_|\_\\_____|   \/  [rɪk-si-vi]
    A dynamic template for your resume and cover letter

See an example in action at codesandbox: https://hw8733.csb.app/

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
- **Icon picker:** ~150 embedded [Lucide](https://lucide.dev) icons plus Google Material Symbols, searchable in German and English. One stroke-weight slider drives both sets — Material Symbols is matched through its variable font axis so the two never look mismatched — plus size, colour and an optional background shape.
- **Two languages:** German and English for the interface and the document, including the language marking inside the PDF.
- **Honest machine readability:** See exactly what an applicant tracking system reads, and edit it yourself if you want. No hidden text — see below.
- **Multiple layouts:** 'clean', 'icons', and 'dynaline'.
- **Customizable styling:** Colours, typeface, font size, sidebar width, headline sizes and DIN 5008 margins.
- **One page or many:** The resume stops after one page by default; switch on multi-page mode for longer careers.
- **Export to PDF:** Crisp A4 pages, straight from the browser's print dialog.
- **Your data stays yours:** Everything is stored in your browser only. Export and import it as a JSON file to back it up or move it to another computer.

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
   You can also upload a scan of your signature.
7. **Design** – layout, accent colour, typeface, font size, icon set, sidebar width and margins.
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
later. Because the browser storage is tied to one browser on one device, use **Exportieren** to
download a `.json` backup and **Importieren** to load it again – on another computer, in another
browser, or to keep several versions of your CV side by side.

## About ATS, hidden text, and "GEO"

RickCV used to embed a copy of your data in ~3 pt type behind the layout, so that
applicant tracking systems would pick it up. **That is no longer the default, and
you should think twice before switching it back on.**

Research on applicant systems now treats invisible content as a manipulation
attempt. Detectors flag text below 4 pt, text in the background colour, and —
most directly — any mismatch between *what a human sees* and *what a machine
extracts*. In a measurement study of 196,682 real resumes, roughly 1 % contained
hidden injected content, and **over 90 % of those were plain "data injection":
hidden skill and experience lists**, which is exactly what the old feature
produced. It is the single most-detected pattern, not an obscure edge case.

What actually helps is duller and more reliable:

- **Chrome already exports a tagged PDF.** The file carries a structure tree and
  a language marking, so the reading order follows the DOM. RickCV puts your
  name and contact details before the career blocks for that reason.
- **The icon set matters more than you would think.** Material Symbols is a
  font, so the icon name ends up glued to your heading in the extracted text
  (`schoolAUSBILDUNG`). The embedded Lucide icons are SVG and leave nothing
  behind. Lucide is the default.
- **The document title becomes the PDF title** and the suggested filename —
  RickCV sets it to "Lebenslauf – Your Name" automatically.

If your layout is unusually graphic and you still want a safety net, the
**Maschinenlesbarkeit** section offers a *visible* extra page in plain text. You
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
other browsers handle margins, page breaks and background colours differently.
RickCV shows a reminder in the preview bar when you are not using a
Chromium-based browser.

## Hosting it yourself

RickCV is a static site: there is nothing to build and nothing to run on a server. Upload the
files and you are done.

### GitHub Pages

The repository ships with a workflow at `.github/workflows/pages.yml`. Enable it once:

1. Push the repository to GitHub.
2. Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.

Every push to `main` then publishes the site to
`https://<username>.github.io/<repository>/`.

### Netlify, Cloudflare Pages, Vercel & co.

Drag the project folder onto the provider's upload area, or connect the repository and leave
the build command empty. Publish directory: the repository root.

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
| `tools/gen-icons.py` | Regenerates `js/icon-data.js` from lucide-static |

The editor and the document are deliberately separate: `cv.html` runs in its own
frame and receives the data through `postMessage`, so the editor's styling can
never leak into your PDF.

Every file is a plain script — no modules, no bundler — which is what lets you
open `index.html` by double-clicking it.

## Advanced customization

Everything in the **Design** section writes to CSS variables defined at the top of
`styles.css`. If you want to go further than the editor allows, that is the place to look –
`--accent-color`, `--font-color`, `--sidebar-width`, `--img-height` and friends are all
documented there.

Icons come from two sets. [Lucide](https://lucide.dev) icons are embedded in
`js/icon-data.js` (ISC licence, see `licenses/`) so they work offline; run
`tools/gen-icons.py` to change the selection. [Google Material
Symbols](https://fonts.google.com/icons) are loaded from Google Fonts at runtime.

The two sets measure weight differently — Lucide in stroke pixels on a 24-unit
grid, Material Symbols on a variable font axis — and their defaults (`stroke 2`
and `wght 400`) look nothing alike side by side: Material comes out roughly twice
as heavy. RickCV maps them onto one slider, calibrated by comparing them
directly: `stroke 1.75` matches `wght 200`. Material glyphs also carry padding
inside their box and render about 8 % smaller at the same size, which the
stylesheet compensates for.

## Technologies Used

- **HTML5** - For structuring the resume and cover letter content.
- **CSS3** - For styling the layout, including responsive design and custom themes.
- **JavaScript** - For the editor, the live preview and the document rendering. No frameworks, no build step, no dependencies.
- **Google Fonts** - Used for icons and fonts (e.g., Material Icons).

## Contributing

If you’d like to contribute to the development of RickCV, feel free to fork the repository, make your changes, and create a pull request. I welcome any improvements or new features that could enhance this template.

## License

The MIT license, with the following restriction:

- **Commercial use** of this code or derivative works is permitted only with express written permission of the author.




