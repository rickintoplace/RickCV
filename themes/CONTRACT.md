# The theme contract, version 1

A theme for RickCV is **one CSS file**. It is applied in the `theme` cascade
layer, which means it wins against every rule of the base styles — without
`!important` and without rebuilding their selectors.

This document describes what you can rely on. Nothing here changes without
raising the contract version; everything else in the markup you should treat as
accidental.

> You do not need the project on your machine. Open
> <https://cv.rickinto.place/>, go to **Themes → Workshop** and start writing:
> every line takes effect in the document next to it, and at the end you
> download the file. To contribute it, put it in a pull request as
> `themes/<name>.css`.

## The header

```css
/* @rickcv-theme
   name:     Nordlicht
   author:   somebody
   licence:  CC0-1.0
   contract: 1
   about:    One sentence about how it looks.
*/
```

`name` and `contract` are required. `licence` should be CC0 or MIT — the core of
RickCV is under the AGPL, but nobody should have to carry that along for a
look. Add `name-en:` and `about-en:` if you want an English name and
description next to a German one; the gallery shows whichever fits the
interface language.

## On the `<body>`

| Hook | Meaning |
| --- | --- |
| `data-contract="1"` | version of this contract |
| `data-template="<name>"` | the active theme, `custom` for your own |
| `data-icon-set="lucide\|material"` | which icon set is in use |
| `data-theme-name="…"` | display name of the theme, if set |

`[data-template]` is enough as a root — only one theme is ever active, so your
own name does not need to appear in the selector.

## How a sheet is built

```
[data-page="1"]                 one sheet (.resume_wrapper)
  [data-column="sidebar"]       the sidebar (.resume_left)
    [data-block="photo"]
    [data-block="profile"] [data-block="contact"] [data-block="languages"]
    [data-block="interests"] [data-block="projects"] [data-block="mobilitySB"]
  [data-column="main"]          the main column (.resume_right)
    [data-block="namerole"]
    [data-block="section"] [data-role="experience|education|volunteer|other"]
      .timeline
        .event [data-date-mode="auto|range|start|none"]
          .date   .dot   .event-content
    [data-block="skills"] [data-block="mobility"] [data-block="references"]
```

Every block also carries `.resume_item`, every block heading `.resume_title`.

Further sheets look the same but carry `data-page="2"`, `"3"` … — a hook if you
want to set them differently — plus `[data-sidebar="none"]` on the sheet when
follow-up sheets are set to run full width. A repeated letterhead also carries
`.resume_namerole-repeat`.

## Variables

They sit at the top of `styles.css` and are the actual interface; a theme often
gets by with a handful of them.

| Variable | Meaning |
| --- | --- |
| `--accent-color` | accent colour |
| `--font-color`, `--background-color` | text and paper |
| `--sidebar-color`, `--sidebar-font-color`, `--sidebar-width` | the sidebar |
| `--font-family`, `--base-font-size`, `--title-size` | typography |
| `--headline-size`, `--headline-size-main` | headings in the sidebar and in the main column |
| `--headline-scale-side`, `--headline-scale-main` | a factor on those; this is how a theme sets smaller headings without disabling the slider in the editor |
| `--date-column` | width of the date column, measured by the renderer from the widest date in the document |
| `--title-gap` | space below a heading in the main column |
| `--profile-align` | alignment of the summary; a choice in the editor overrules it |
| `--left-margin`, `--right-margin`, `--bottom-margin`, `--header-height` | margins per DIN 5008 |
| `--icon-size`, `--icon-color`, `--icon-bg` | icons |

## Colours

A theme may bring its own palette (`--accent-color`, `--sidebar-color`, …). The
moment someone *touches* a colour in the editor, that colour is written onto the
`<body>` and wins against the theme; everything left alone stays the theme's
business. A theme needs to do nothing for this — but it should expect one of its
colours to be replaced, and not build a contrast out of two colours it sets
itself.

The same goes for `--profile-align`: the setting in the editor says "left to the
theme" until someone picks something else.

## What a theme may not do

Two things are stripped when a theme is loaded:

* `@import` and `url()` pointing at remote addresses. A resume should not report
  when and where someone is working on it. Images and fonts belong in the file
  as `data:` URIs.
* Rules aimed at `.ats-…`. What an applicant tracking system reads out of the
  document is not a question of looks.

Plus a ceiling of 64 kB per theme.

## The themes that ship with RickCV

`themes/*.css` are bundled into `js/theme-data.js` by `tools/build-themes.py` —
necessary because a page opened over `file://` may not fetch files, while RickCV
has to run from a double-click. The generated file is committed:

```bash
python3 tools/build-themes.py
```

## Checking

```bash
node tests/theme.test.mjs
```

The test renders the example document, holds on to every hook documented here,
and checks each theme in `themes/` for its header, its contract version and the
sanitising. Rename a class and you get a red test — instead of a theme author
whose file quietly stopped working.
