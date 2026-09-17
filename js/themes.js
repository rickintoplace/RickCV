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
  function parseMeta(css) {
    var meta = {
      name: "", author: "", licence: "", about: "", about_en: "",
      contract: 0, defaults: "",
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
        name: meta.name || slug,
        author: meta.author,
        licence: meta.licence,
        about: (english && meta.about_en) || meta.about,
        contract: meta.contract,
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
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
    var raw = theme.slug && data()[theme.slug]
      ? data()[theme.slug]
      : (typeof theme.css === "string" ? theme.css : "");
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
        { sel: ".resume_title", de: "Eine Blocküberschrift", en: "A block heading" },
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
        { sel: "--headline-size", de: "Größe der Überschriften", en: "Heading size" },
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

  /* --------------------------------------------------------------- Vorlage */

  function starter(locale) {
    var german = (locale || "de") === "de";
    return [
      "/* @rickcv-theme",
      "   name:     " + (german ? "Mein Theme" : "My theme"),
      "   author:   ",
      "   licence:  CC0-1.0",
      "   contract: " + CONTRACT,
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
    source: source,
    hooks: hooks,
    resolve: resolve,
    starter: starter,
  };
})(typeof window !== "undefined" ? window : this);
