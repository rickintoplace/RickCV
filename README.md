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

## Preview

<p align="center">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/preview1.png?raw=true" width="48%">
<img src="https://github.com/rickintoplace/RickCV/blob/main/examples/preview2.png?raw=true" width="48%">
</p>

Two A4 pages are generated and saved as a PDF file that can be read by both people and machines.

## Features

- **Visual editor:** Every part of the document is a form field. No code, no JSON, no prior knowledge required.
- **Live preview:** The page next to the editor re-renders as you type.
- **Photo placement:** Drag the picture to move the crop, scroll to zoom, and pick a shape (full-width band, rounded square, or circle).
- **Dynamic Content:** Profile, contact details, languages, skills, interests, projects, mobility and a freely ordered career timeline.
- **ATS-Friendly:** Optionally embed a machine-readable copy of your data for applicant tracking systems.
- **Multiple Layouts:** Choose from 'clean', 'icons', and 'dynaline'.
- **Customizable Styling:** Colour themes, fonts, sidebar width, headline sizes and DIN 5008 margins.
- **Export to PDF:** Two crisp A4 pages, straight from the browser's print dialog.
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
3. **Werdegang** – add your stations. Each one is assigned to *Berufserfahrung*, *Ausbildung*
   or *Ehrenamt*, which decides the block it appears in. Use the ↑ ↓ buttons to reorder,
   ⧉ to duplicate and ✕ to delete.
4. **Kenntnisse, Sprachen, Interessen, Projekte, Mobilität** – optional sections. Each has a
   switch to hide it completely.
5. **Anschreiben** – recipient, subject, salutation and as many paragraphs as you need.
   You can also upload a scan of your signature.
6. **Design** – layout, accent colour, font, sidebar width and margins.
7. **Optionen** – date format, chronological order, separate blocks and the ATS copy.

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

| File | Purpose |
| --- | --- |
| `index.html` | The builder – the page visitors open |
| `builder.js` / `builder.css` | The editor: forms, state, import/export |
| `cv.html` | The document itself, shown in the preview frame and printed |
| `render.js` | Turns the data into the resume and cover letter |
| `defaults.js` | Data model and example content |
| `styles.css` | Styling of the resume and cover letter |
| `index.mjs` | The former data file. Superseded by the builder and no longer loaded – kept for reference |

The editor and the document are deliberately separate: `cv.html` runs in its own frame and
receives the data through `postMessage`, so the editor's styling can never leak into your PDF.

## Advanced customization

Everything in the **Design** section writes to CSS variables defined at the top of
`styles.css`. If you want to go further than the editor allows, that is the place to look –
`--accent-color`, `--font-color`, `--sidebar-width`, `--img-height` and friends are all
documented there.

Icons come from [Google Material Symbols](https://fonts.google.com/icons); type any icon name
into an icon field to use it.

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




