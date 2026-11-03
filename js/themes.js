/*  themes.js – Themes lesen, pruefen, bereitstellen.
 *
 *  Ein Theme ist eine CSS-Datei mit einem Kopf aus Metadaten. Mitgeliefert
 *  werden die aus themes/ (gebuendelt in theme-data.js), dazukommen kann
 *  jede Datei, die jemand in den Baukasten zieht.
 *
 *  Zwei Dinge passieren beim Einlesen, und beide sind Absicht:
 *
 *    1. `@import` und entfernte `url()` fliegen raus. CSS fuehrt nichts
 *       aus, kann aber nach Hause telefonieren: eine Schriftart oder ein
 *       Hintergrundbild von fremder Adresse verraet dem Absender, wann und
 *       wo jemand seinen Lebenslauf bearbeitet. `data:`-Adressen bleiben.
 *
 *    2. Regeln, die die Textfassung fuer Bewerbungssysteme betreffen,
 *       werden entfernt. Ein Theme bestimmt das Aussehen des Dokuments –
 *       nicht, was eine Maschine daraus liest.
 */
(function (global) {
  "use strict";

  var CONTRACT = 1;
  var MAX_SIZE = 64 * 1024;

  function clean(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  /* ------------------------------------------------------------ Metadaten */

  //  Der Kopf sieht aus wie bei einem Benutzerskript:
  //
  //    /* @rickcv-theme
  //       name:     Nordlicht
  //       contract: 1
  //    */
  //
  //  Fortsetzungszeilen ohne "schluessel:" gehoeren zum vorigen Wert.
  /* ------------------------------------------------------------------ Tags */

  //  Wofuer ein Theme taugt – in der Sprache derer, die eins suchen, nicht
  //  in der von Gestaltern. Wenige, damit die Wahl schnell geht.
  //  Kein Tag "fuer Bewerbungssysteme": das gilt fuer jedes eingebaute Theme.
  //  tests/theme.test.mjs prueft, dass jedes im ATS-Nachweis
  //  (docs/ats-proof.md) bei jedem Leser ohne Befund ist.
  var TAGS = [
    { id: "viel", de: "Viel Erfahrung", en: "Long career",
      hint: { de: "Dichter Satz, damit ein langer Werdegang auf wenige Blätter passt.",
              en: "Set tightly, so a long career fits on few pages." } },
    { id: "wenig", de: "Wenig Erfahrung", en: "First job",
      hint: { de: "Großzügig gesetzt – wenig Inhalt wirkt aufgeräumt statt verloren.",
              en: "Generous spacing – little content looks tidy rather than lost." } },
    { id: "serioes", de: "Seriös", en: "Formal",
      hint: { de: "Zurückhaltend: für Behörden, Banken, Kanzleien, Wissenschaft.",
              en: "Restrained: for public service, banks, law firms, research." } },
    { id: "auffallen", de: "Auffallen", en: "Stand out",
      hint: { de: "Farbe und Form tragen mit – für Berufe, in denen das Gestalten zählt.",
              en: "Colour and shape do part of the work – for jobs where design counts." } },
    { id: "lesbar", de: "Gut lesbar", en: "Easy to read",
      hint: { de: "Große Schrift, starker Kontrast, druckt gut in Schwarzweiß.",
              en: "Large type, strong contrast, prints well in black and white." } },
  ];
  var TAG_IDS = TAGS.map(function (tag) { return tag.id; });

  function tags(locale) {
    var key = (locale || "de") === "en" ? "en" : "de";
    return TAGS.map(function (tag) { return { id: tag.id, label: tag[key], hint: tag.hint[key] }; });
  }

  function parseMeta(css) {
    var meta = {
      name: "", name_en: "", author: "", licence: "", about: "", about_en: "",
      contract: 0, defaults: "", tags: "", example: "",
    };
    var head = String(css).match(/\/\*[\s\S]*?@rickcv-theme([\s\S]*?)\*\//);
    if (!head) return meta;

    var key = null;
    head[1].split("\n").forEach(function (line) {
      var entry = line.match(/^\s*([a-z][a-z-]*)\s*:\s*(.*)$/i);
      if (entry) {
        //  "about-en:" wird zu about_en – ein Theme darf seine Beschreibung
        //  zweisprachig mitbringen.
        key = entry[1].toLowerCase().replace(/-/g, "_");
        if (meta[key] !== undefined) meta[key] = clean(entry[2]);
      } else if (key && meta[key]) {
        var rest = clean(line);
        if (rest) meta[key] += " " + rest;
      }
    });

    meta.contract = Number(meta.contract) || 0;
    //  "example: short": das Beispiel ohne Ehrenamt, Projekte und
    //  Mobilitaet, fuer Themes mit grosser Schrift oder viel Luft.
    meta.example = /^short$/i.test(meta.example) ? "short" : "";
    //  Nur Tags aus der festen Liste: die Galerie filtert danach, und ein
    //  Tippfehler soll kein eigenes, leeres Filterfeld ergeben.
    meta.tags = String(meta.tags || "").toLowerCase().split(/[\s,;]+/).filter(function (tag, index, all) {
      return TAG_IDS.indexOf(tag) !== -1 && all.indexOf(tag) === index;
    });
    return meta;
  }

  /* ------------------------------------------------------------ Entschaerfen */

  var ATS_SELECTOR = /\.ats-|\[data-block\s*=\s*.?ats/i;
  var REMOTE_URL = /url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/gi;

  //  Ein kleiner Durchlauf ueber die Regeln – gross genug, um verschachtelte
  //  Regeln und @media mitzunehmen, klein genug, um ihn zu ueberblicken.
  function walk(css, report) {
    var out = "";
    var at = 0;

    while (at < css.length) {
      var brace = css.indexOf("{", at);
      var semicolon = css.indexOf(";", at);

      //  Eine Anweisung ohne Block: @import, @charset und Verwandte.
      if (brace === -1 || (semicolon !== -1 && semicolon < brace)) {
        if (semicolon === -1) { out += css.slice(at); break; }
        var statement = css.slice(at, semicolon + 1);
        if (/@import|@charset/i.test(statement)) report.imports++;
        else out += statement;
        at = semicolon + 1;
        continue;
      }

      var head = css.slice(at, brace);
      var depth = 1;
      var end = brace + 1;
      while (end < css.length && depth > 0) {
        if (css[end] === "{") depth++;
        else if (css[end] === "}") depth--;
        end++;
      }
      var body = css.slice(brace + 1, end - 1);

      if (ATS_SELECTOR.test(head)) {
        report.ats++;
      } else if (/@(media|supports|layer|container|scope)/i.test(head)) {
        out += head + "{" + walk(body, report) + "}";
      } else if (body.indexOf("{") !== -1) {
        out += head + "{" + walk(body, report) + "}";
      } else {
        out += head + "{" + declarations(body, report) + "}";
      }

      at = end;
    }

    return out;
  }

  function declarations(body, report) {
    return body.replace(REMOTE_URL, function () {
      report.remote++;
      return "none";
    });
  }

  function sanitize(css) {
    var report = { imports: 0, remote: 0, ats: 0, truncated: false };
    var input = String(css || "");

    if (input.length > MAX_SIZE) {
      input = input.slice(0, MAX_SIZE);
      report.truncated = true;
    }

    //  Kommentare bleiben stehen: im Kopf steht die Herkunft des Themes.
    return { css: walk(input, report), report: report };
  }

  /* -------------------------------------------------------------- Einlesen */

  //  Aus einer CSS-Datei wird ein Theme: Metadaten lesen, entschaerfen,
  //  Hinweise sammeln. Was zurueckkommt, laesst sich unveraendert in ein
  //  Dokument schreiben.
  function read(css, fallbackName) {
    var meta = parseMeta(css);
    var safe = sanitize(css);
    var notes = [];

    if (safe.report.imports) notes.push("imports");
    if (safe.report.remote) notes.push("remote");
    if (safe.report.ats) notes.push("ats");
    if (safe.report.truncated) notes.push("truncated");
    if (meta.contract && meta.contract !== CONTRACT) notes.push("contract");

    return {
      name: meta.name || clean(fallbackName) || "",
      meta: meta,
      css: safe.css,
      notes: notes,
    };
  }

  /* -------------------------------------------------------- Mitgelieferte */

  function data() {
    return global.RickCVThemeData || {};
  }

  function builtin(locale) {
    var english = (locale || "de") === "en";
    var bundle = data();
    return Object.keys(bundle).map(function (slug) {
      var meta = parseMeta(bundle[slug]);
      return {
        slug: slug,
        name: (english && meta.name_en) || meta.name || slug,
        author: meta.author,
        licence: meta.licence,
        about: (english && meta.about_en) || meta.about,
        contract: meta.contract,
        tags: meta.tags,
        example: meta.example,
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  //  Welche Fassung des Beispiels zu einem Theme passt ("" oder "short").
  function exampleFor(theme) {
    if (!theme) return "";
    var css = theme.css || (theme.slug ? data()[theme.slug] : "") || "";
    return parseMeta(css).example;
  }

  function source(slug) {
    return data()[slug] || "";
  }

  //  Welches CSS gilt fuer dieses Dokument? Ein mitgeliefertes Theme wird
  //  aus dem Buendel geholt – dann wirken spaetere Verbesserungen auch auf
  //  alte Dokumente. Ein eigenes reist im Dokument mit.
  //  Dasselbe CSS zweimal zu pruefen waere Verschwendung: gerendert wird
  //  bei jedem Tastendruck, geaendert selten.
  var lastSource = null;
  var lastResult = "";

  function resolve(theme) {
    if (!theme) return "";
    //  Ein Name, den es nicht mehr gibt – ein zurueckgezogenes Theme etwa –
    //  soll kein nacktes Dokument ergeben, sondern die Grundform.
    var known = theme.slug && data()[theme.slug];
    if (!known && theme.slug && !theme.css) known = data().clean;
    var raw = known || (typeof theme.css === "string" ? theme.css : "");
    //  Die eigenen Ergaenzungen kommen dahinter: gleiche Ebene, spaeter
    //  im Text – sie gewinnen, ohne !important.
    if (typeof theme.extra === "string" && theme.extra.trim()) raw += "\n\n/* Ergaenzungen */\n" + theme.extra;
    if (!raw) return "";
    if (raw === lastSource) return lastResult;

    lastSource = raw;
    lastResult = sanitize(raw).css;
    return lastResult;
  }

  /* ----------------------------------------------------------- Hakenliste */

  //  Was ein Theme anfassen kann, in der Sprache des Dokuments. Die Liste
  //  ist der Vertrag in bedienbarer Form: die Werkstatt zeigt sie an, ein
  //  Klick setzt den Selektor in den Editor. Sie steht hier und nicht in
  //  i18n.js, weil sie Inhalt ist und keine Beschriftung – sie aendert sich
  //  mit dem Renderer, nicht mit der Oberflaeche.
  var HOOKS = [
    {
      title: { de: "Bausteine", en: "Blocks" },
      items: [
        { sel: '[data-block="namerole"]', de: "Name und Rolle", en: "Name and role" },
        { sel: '[data-block="photo"]', de: "Bewerbungsfoto", en: "Photo" },
        { sel: '[data-block="profile"]', de: "Profiltext", en: "Profile text" },
        { sel: '[data-block="contact"]', de: "Kontaktangaben", en: "Contact details" },
        { sel: '[data-block="section"]', de: "Ein Werdegangs-Block", en: "A career block" },
        { sel: '[data-block="skills"]', de: "Kenntnisse", en: "Skills" },
        { sel: '[data-block="languages"]', de: "Sprachen", en: "Languages" },
        { sel: '[data-block="interests"]', de: "Interessen", en: "Interests" },
        { sel: '[data-block="projects"]', de: "Projekte", en: "Projects" },
        { sel: '[data-block="mobility"]', de: "Mobilität", en: "Mobility" },
        { sel: '[data-block="references"]', de: "Referenzen", en: "References" },
      ],
    },
    {
      title: { de: "Spalten und Seiten", en: "Columns and pages" },
      items: [
        { sel: '[data-column="sidebar"]', de: "Die Seitenspalte", en: "The sidebar" },
        { sel: '[data-column="main"]', de: "Der Hauptteil", en: "The main column" },
        { sel: '[data-page="1"]', de: "Nur das erste Blatt", en: "The first sheet only" },
        { sel: ".resume_wrapper", de: "Ein Blatt insgesamt", en: "A whole sheet" },
      ],
    },
    {
      title: { de: "Stationen", en: "Stations" },
      items: [
        { sel: ".event", de: "Eine Station", en: "One station" },
        { sel: '[data-role="experience"] .event', de: "Nur Berufserfahrung", en: "Work experience only" },
        { sel: '[data-role="education"] .event', de: "Nur Ausbildung", en: "Education only" },
        { sel: '[data-date-mode="none"]', de: "Station ohne Datum", en: "Station without a date" },
        { sel: ".event .date", de: "Die Zeitangabe", en: "The date" },
        { sel: ".event .dot", de: "Der Punkt auf der Leiste", en: "The dot on the timeline" },
        { sel: ".timeline", de: "Die Zeitleiste", en: "The timeline" },
        { sel: ".resume_title", de: "Alle Blocküberschriften (beide Spalten)", en: "All block headings (both columns)" },
        { sel: '[data-column="main"] .resume_title', de: "Überschriften im Hauptteil", en: "Headings in the main column" },
        { sel: '[data-column="sidebar"] .resume_title', de: "Überschriften der Seitenspalte", en: "Headings in the sidebar" },
      ],
    },
    {
      title: { de: "Variablen", en: "Variables" },
      items: [
        { sel: "--accent-color", de: "Akzentfarbe", en: "Accent colour" },
        { sel: "--font-color", de: "Schriftfarbe", en: "Text colour" },
        { sel: "--background-color", de: "Papierfarbe", en: "Paper colour" },
        { sel: "--sidebar-color", de: "Farbe der Seitenspalte", en: "Sidebar colour" },
        { sel: "--sidebar-font-color", de: "Schrift in der Seitenspalte", en: "Sidebar text colour" },
        { sel: "--sidebar-width", de: "Breite der Seitenspalte", en: "Sidebar width" },
        { sel: "--font-family", de: "Schriftart", en: "Typeface" },
        { sel: "--base-font-size", de: "Grundschriftgrad", en: "Base font size" },
        { sel: "--headline-size", de: "Überschriften der Seitenspalte", en: "Sidebar heading size" },
        { sel: "--headline-size-main", de: "Überschriften im Hauptteil", en: "Main heading size" },
        { sel: "--title-gap", de: "Abstand unter den Überschriften", en: "Space below headings" },
        { sel: "--profile-align", de: "Bündigkeit des Profiltexts", en: "Alignment of the summary" },
        { sel: "--left-margin", de: "Linker Rand", en: "Left margin" },
      ],
    },
  ];

  function hooks(locale) {
    var key = (locale || "de") === "en" ? "en" : "de";
    return HOOKS.map(function (group) {
      return {
        title: group.title[key],
        items: group.items.map(function (item) {
          return { sel: item.sel, about: item[key] };
        }),
      };
    });
  }


  /* ---------------------------------------------------------------- Zutaten */

  //  Fertige Regeln in Alltagssprache. Ein Klick setzt sie in die eigenen
  //  Ergaenzungen – vollstaendig, mit einem Kommentar, der sagt, was sie
  //  tun. Wer CSS kann, sieht, wie es geht; wer keins kann, muss es nicht.
  var RECIPES = [
    { id: "rule", de: "Linie unter den Überschriften", en: "Rule under headings",
      css: '[data-column="main"] .resume_title {\n  border-bottom: 2px solid var(--accent-color);\n  padding-bottom: 0.15em;\n}' },
    { id: "noicons", de: "Keine Symbole vor Überschriften", en: "No icons before headings",
      css: '.resume_title .rc-icon,\n.resume_title .material-symbols-outlined {\n  display: none;\n}' },
    { id: "notimeline", de: "Zeitleiste ausblenden", en: "Hide the timeline",
      css: '.timeline::before,\n.event .dot {\n  display: none;\n}' },
    { id: "datesbold", de: "Daten fett", en: "Dates in bold",
      css: '.event .date {\n  font-weight: 700;\n}' },
    { id: "airy", de: "Mehr Zeilenabstand", en: "More line spacing",
      css: '.resume_wrapper {\n  line-height: 1.6;\n}' },
    { id: "nameaccent", de: "Name in Akzentfarbe", en: "Name in accent colour",
      css: '[data-block="namerole"] h1 {\n  color: var(--accent-color);\n}' },
    { id: "sidebarplain", de: "Seitenspalte ohne Farbfläche", en: "Sidebar without a colour fill",
      css: '[data-column="sidebar"] {\n  background: transparent;\n}' },
  ];

  function recipes(locale) {
    var key = (locale || "de") === "en" ? "en" : "de";
    return RECIPES.map(function (recipe) {
      return {
        id: recipe.id, label: recipe[key],
        css: "/* " + recipe[key] + " */\n" + recipe.css + "\n",
      };
    });
  }

  /* ---------------------------------------------------------------- Pruefung */

  //  Eine fehlende Klammer schluckt still alles, was danach kommt – und
  //  wer CSS nicht kennt, sucht den Fehler dann in der falschen Regel.
  //  Geprueft wird hier, was sich ohne Netz und ohne Parser sicher sagen
  //  laesst: Klammern, Kommentare und ob der Browser eine Eigenschaft und
  //  ihren Wert kennt. Ergebnis: Liste von { line, key, prop, value }.
  function lint(css) {
    var text = String(css || "");
    var problems = [];
    var line = 1;
    var stack = [];
    var chunk = "";
    var chunkLine = 1;
    var supports = global.CSS && global.CSS.supports ? global.CSS.supports.bind(global.CSS) : null;

    function declaration(raw, at) {
      var body = raw.trim();
      if (!body || !supports || !stack.length) return;
      var colon = body.indexOf(":");
      if (colon < 1) return;
      var prop = body.slice(0, colon).trim().toLowerCase();
      var value = body.slice(colon + 1).replace(/!important\s*$/i, "").trim();
      if (prop.indexOf("--") === 0 || /^[-a-z]+$/.test(prop) === false) return;
      //  Innerhalb einer @-Regel ohne Deklarationen (etwa @media) steht ein
      //  Selektor, keine Eigenschaft; die Zeile endet dann nicht mit ";".
      if (!supports(prop, "inherit")) {
        problems.push({ line: at, key: "themeErrProperty", prop: prop });
        return;
      }
      if (!value || /var\(|env\(|attr\(/i.test(value)) return;
      if (!supports(prop, value)) problems.push({ line: at, key: "themeErrValue", prop: prop, value: value });
    }

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === "/" && text[i + 1] === "*") {
        var end = text.indexOf("*/", i + 2);
        var startLine = line;
        var skipped = end === -1 ? text.slice(i) : text.slice(i, end + 2);
        line += (skipped.match(/\n/g) || []).length;
        if (end === -1) {
          problems.push({ line: startLine, key: "themeErrComment" });
          break;
        }
        i = end + 1;
        continue;
      }
      if (c === '"' || c === "'") {
        var close = text.indexOf(c, i + 1);
        if (close === -1) close = text.length - 1;
        var quoted = text.slice(i, close + 1);
        line += (quoted.match(/\n/g) || []).length;
        chunk += quoted;
        i = close;
        continue;
      }
      if (c === "\n") line++;
      if (c === "{") {
        stack.push({ line: line, at: /^\s*@/.test(chunk) });
        chunk = "";
        chunkLine = line;
        continue;
      }
      if (c === "}") {
        declaration(chunk, chunkLine);
        chunk = "";
        chunkLine = line;
        if (!stack.length) problems.push({ line: line, key: "themeErrClose" });
        else stack.pop();
        continue;
      }
      if (c === ";") {
        if (!stack.length || !stack[stack.length - 1].at || !/^\s*@/.test(chunk)) declaration(chunk, chunkLine);
        chunk = "";
        chunkLine = line;
        continue;
      }
      if (!chunk.trim() && c !== "\n" && /\s/.test(c) === false) chunkLine = line;
      chunk += c;
    }
    if (stack.length) problems.push({ line: stack[stack.length - 1].line, key: "themeErrOpen" });
    return problems;
  }

  /* --------------------------------------------------------------- Vorlage */

  function starter(locale) {
    var german = (locale || "de") === "de";
    return [
      "/* @rickcv-theme",
      "   name:     " + (german ? "Mein Theme" : "My theme"),
      "   author:   ",
      "   licence:  CC0-1.0",
      "   contract: " + CONTRACT,
      german ? "   tags:     (wofuer: viel, wenig, serioes, auffallen, lesbar)"
             : "   tags:     (what for: viel, wenig, serioes, auffallen, lesbar)",
      "*/",
      "",
      german
        ? "/*  Alles hier drin gilt zusaetzlich zum Grundstil. Die Haken stehen"
        : "/*  Everything here applies on top of the base style. The hooks are",
      german
        ? "    rechts in der Liste – ein Klick fuegt sie ein.  */"
        : "    listed on the right – one click inserts them.  */",
      "",
      "[data-block=\"namerole\"] h1 {",
      "  letter-spacing: -0.02em;",
      "}",
      "",
      "[data-column=\"sidebar\"] .resume_title {",
      "  text-transform: uppercase;",
      "  letter-spacing: 0.12em;",
      "}",
      "",
    ].join("\n");
  }

  global.RickCVThemes = {
    CONTRACT: CONTRACT,
    MAX_SIZE: MAX_SIZE,
    read: read,
    sanitize: sanitize,
    parseMeta: parseMeta,
    builtin: builtin,
    exampleFor: exampleFor,
    source: source,
    hooks: hooks,
    tags: tags,
    recipes: recipes,
    lint: lint,
    resolve: resolve,
    starter: starter,
  };
})(typeof window !== "undefined" ? window : this);
