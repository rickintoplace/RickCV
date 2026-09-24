/*  import-dialog.js – Der Dialog hinter "Importieren".
 *
 *  Drei Zustaende: auswaehlen, lesen, bestaetigen. Uebernommen wird erst
 *  auf Knopfdruck, und vorher steht da, was gefunden wurde – ein Import,
 *  der den halben Lebenslauf still ueberschreibt, waere schlimmer als gar
 *  keiner.
 */
(function (global) {
  "use strict";

  var Import = global.RickCVImport;

  var overlay = null;
  var options = null;
  var parsed = null;
  var mode = "replace";
  var lastFocus = null;
  var release = null;   // gibt die Seite hinter dem Dialog wieder frei

  //  Jedes Lesen bekommt eine Nummer. Wer erst ein grosses PDF und gleich
  //  danach eine kleine Word-Datei hineinzieht, bekommt sonst zuerst die
  //  Word-Datei zu sehen – und dann, wenn das PDF fertig ist, dessen
  //  Ergebnis unter demselben "Uebernehmen". Es zaehlt nur das Letzte, und
  //  nach dem Schliessen gar keines mehr.
  var ticket = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function t(key) {
    return options && options.t ? options.t(key) : key;
  }

  /* ---------------------------------------------------------------- Bau */

  function build() {
    overlay = el("div", "imp-overlay");
    overlay.hidden = true;

    var panel = el("div", "imp-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "imp-title");

    var head = el("div", "imp-head");
    var title = el("h2", "imp-title", "");
    title.id = "imp-title";
    var close = el("button", "btn btn-icon imp-close", "✕");
    close.type = "button";
    close.addEventListener("click", hide);
    overlay.closeButton = close;
    head.appendChild(title);
    head.appendChild(close);

    var body = el("div", "imp-body");
    var foot = el("div", "imp-foot");

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(foot);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) hide();
    });

    //  Ziehen ueber dem ganzen Dialog, nicht nur ueber dem Feld: wer eine
    //  Datei loslaesst, zielt selten genau.
    ["dragenter", "dragover"].forEach(function (name) {
      overlay.addEventListener(name, function (event) {
        event.preventDefault();
        overlay.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (name) {
      overlay.addEventListener(name, function (event) {
        event.preventDefault();
        if (name === "dragleave" && overlay.contains(event.relatedTarget)) return;
        overlay.classList.remove("dragging");
      });
    });
    overlay.addEventListener("drop", function (event) {
      var file = event.dataTransfer && event.dataTransfer.files[0];
      if (!file) return;
      //  Sonst faengt der Griff am Dokument dieselbe Datei noch einmal.
      event.stopPropagation();
      readFile(file);
    });

    overlay.body = body;
    overlay.foot = foot;
    overlay.titleNode = title;
    overlay.panel = panel;
    return overlay;
  }

  /* ------------------------------------------------------------- Schritte */

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  //  pasted: was im Textfeld stand. Scheitert das Lesen, steht es wieder
  //  da – sonst muesste man es ein zweites Mal einfuegen, nur um die
  //  Stelle zu finden, an der es hakt.
  function stepPick(message, pasted) {
    parsed = null;
    var body = overlay.body;
    clear(body);
    clear(overlay.foot);

    if (message) {
      var error = el("p", "imp-error", message);
      error.setAttribute("role", "alert");
      body.appendChild(error);
    } else {
      body.appendChild(el("p", "imp-intro", t("impIntro")));
    }

    var drop = el("div", "imp-drop");
    drop.appendChild(el("div", "imp-drop-label", t("impDrop")));

    var choose = el("button", "btn btn-primary", t("impChoose"));
    choose.type = "button";
    var input = el("input");
    input.type = "file";
    input.hidden = true;
    input.accept = ".json,.zip,.csv,.pdf,.docx,.txt,application/json,application/zip,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
    input.addEventListener("change", function () {
      if (input.files[0]) readFile(input.files[0]);
      input.value = "";
    });
    choose.addEventListener("click", function () { input.click(); });

    drop.appendChild(choose);
    drop.appendChild(input);
    drop.appendChild(el("div", "imp-formats", t("impFormats")));
    body.appendChild(drop);

    var paste = el("div", "imp-paste");
    var label = el("label", "imp-label", t("impPasteLabel"));
    label.setAttribute("for", "imp-textarea");
    var area = el("textarea", "imp-textarea");
    area.id = "imp-textarea";
    area.rows = 6;
    area.placeholder = t("impPasteHint");
    if (pasted) area.value = pasted;

    var readText = el("button", "btn", t("impPasteBtn"));
    readText.type = "button";
    readText.addEventListener("click", function () {
      var value = area.value;
      if (!value.trim()) return;
      handle(function () { return Import.parseText(value, "eingefuegt.txt"); }, value);
    });

    paste.appendChild(label);
    paste.appendChild(area);
    paste.appendChild(readText);
    body.appendChild(paste);

    body.appendChild(el("p", "imp-note", t("impLinkedInHelp")));

    //  Wer gar nichts zum Hineinziehen hat, kommt auch ueber eine KI zu
    //  seinem Lebenslauf – der Weg dorthin steht hier, wo man ihn sucht.
    if (options.onAi) {
      var ai = el("button", "btn btn-link imp-ai", t("aiImportHint"));
      ai.type = "button";
      ai.addEventListener("click", function () {
        var run = options.onAi;
        hide();
        run();
      });
      body.appendChild(ai);
    }

    var cancel = el("button", "btn", t("impCancel"));
    cancel.type = "button";
    cancel.addEventListener("click", hide);
    overlay.foot.appendChild(cancel);

    if (pasted) area.focus();
    else choose.focus();
  }

  function stepBusy() {
    clear(overlay.body);
    clear(overlay.foot);
    overlay.body.appendChild(el("p", "imp-busy", t("impReading")));
  }

  var SUMMARY_ROWS = [
    { key: "contact", label: "sumContact" },
    { key: "events", label: "sumEvents" },
    { key: "skills", label: "sumSkills" },
    { key: "languages", label: "sumLanguages" },
    { key: "interests", label: "sumInterests" },
    { key: "mobility", label: "sumMobility" },
    { key: "projects", label: "sumProjects" },
    { key: "references", label: "sumReferences" },
    { key: "links", label: "sumLinks" },
    { key: "images", label: "sumImages" },
  ];

  var FORMAT_LABEL = {
    rickcv: "fmtRickcv", jsonresume: "fmtJsonresume", reactive: "fmtReactive",
    linkedin: "fmtLinkedin", pdf: "fmtPdf", docx: "fmtDocx", text: "fmtText",
  };

  function stepReview() {
    var body = overlay.body;
    clear(body);
    clear(overlay.foot);

    var summary = parsed.summary;

    body.appendChild(el("p", "imp-format",
      t("impFoundIn").replace("{format}", t(FORMAT_LABEL[parsed.format] || "fmtText"))));

    var list = el("dl", "imp-summary");
    if (summary.name) {
      list.appendChild(el("dt", null, t("sumName")));
      list.appendChild(el("dd", null, summary.name));
    }
    if (summary.profileText) {
      list.appendChild(el("dt", null, t("sumProfile")));
      list.appendChild(el("dd", null, "✓"));
    }
    if (summary.letter) {
      list.appendChild(el("dt", null, t("sumLetter")));
      list.appendChild(el("dd", null, "✓"));
    }
    SUMMARY_ROWS.forEach(function (row) {
      var value = summary[row.key];
      if (!value) return;
      list.appendChild(el("dt", null, t(row.label)));
      list.appendChild(el("dd", null, String(value)));
    });
    body.appendChild(list);

    var WARNINGS = {
      draft: "warnDraft", skillRanks: "warnSkillRanks", letter: "warnLetter",
      thin: "warnThin", images: "warnImages", noStructure: "warnNoStructure", unmapped: "warnUnmapped",
      newer: "warnNewer", customTheme: "warnCustomTheme", hiddenAts: "warnHiddenAts",
    };
    (parsed.warnings || []).forEach(function (key) {
      if (WARNINGS[key]) body.appendChild(el("p", "imp-warn", t(WARNINGS[key])));
    });

    //  Bei Text und PDF steht der gelesene Text zum Nachsehen daneben –
    //  aufgeklappt, wenn wenig erkannt wurde, sonst zusammengefaltet.
    if (parsed.text) {
      var peek = el("details", "imp-peek");
      peek.open = (parsed.warnings || []).indexOf("thin") !== -1;
      peek.appendChild(el("summary", null, t("impTextPeek")));
      peek.appendChild(el("pre", "imp-peek-text", parsed.text));
      body.appendChild(peek);
    }

    body.appendChild(el("p", "imp-label", t("impMode")));
    var modes = el("div", "imp-modes");
    [
      { value: "replace", label: "impModeReplace", hint: "impModeReplaceHint" },
      { value: "merge", label: "impModeMerge", hint: "impModeMergeHint" },
    ].forEach(function (entry) {
      var option = el("label", "imp-mode");
      var radio = el("input");
      radio.type = "radio";
      radio.name = "imp-mode";
      radio.value = entry.value;
      radio.checked = mode === entry.value;
      radio.addEventListener("change", function () { mode = entry.value; });

      var text = el("span", "imp-mode-text");
      text.appendChild(el("strong", null, t(entry.label)));
      text.appendChild(el("small", null, t(entry.hint)));

      option.appendChild(radio);
      option.appendChild(text);
      modes.appendChild(option);
    });
    body.appendChild(modes);

    var again = el("button", "btn", t("impAgain"));
    again.type = "button";
    again.addEventListener("click", function () { stepPick(); });

    var apply = el("button", "btn btn-primary", t("impApply"));
    apply.type = "button";
    apply.addEventListener("click", function () {
      var next = Import.apply(options.state(), parsed, mode);
      var count = SUMMARY_ROWS.reduce(function (sum, row) {
        return sum + (Number(summary[row.key]) || 0);
      }, summary.letter ? 1 : 0);
      //  hide() raeumt `parsed` weg – was gemeldet werden soll, muss
      //  vorher festgehalten werden.
      var info = { count: count, format: parsed.format, mode: mode };
      hide();
      options.onApply(next, info);
    });

    overlay.foot.appendChild(again);
    overlay.foot.appendChild(apply);
    apply.focus();
  }

  /* --------------------------------------------------------------- Lesen */

  var ERRORS = {
    unknownJson: "errUnknownJson", nothingFound: "errNothingFound",
    unreadable: "errUnreadable", emptyZip: "errEmptyZip", emptyCsv: "errEmptyCsv",
    noDecompression: "errNoDecompression", noPdfSupport: "errNoPdfSupport",
    pdfNoText: "errPdfNoText", pdfFailed: "errPdfFailed",
    noDocxSupport: "errNoDocxSupport", noDocx: "errNoDocx",
    noDocxText: "errNoDocxText", docxFailed: "errDocxFailed",
    brokenJson: "errBrokenJson", tooLarge: "errTooLarge",
  };

  function message(error) {
    var key = ERRORS[error && error.message];
    return key ? t(key) : t("errUnreadable");
  }

  function current(mine) {
    return mine === ticket && overlay && !overlay.hidden;
  }

  function handle(work, pasted) {
    var mine = ++ticket;
    stepBusy();
    //  Ein Bildaufbau dazwischen, sonst bleibt die Meldung bei grossen
    //  Dateien unsichtbar.
    global.requestAnimationFrame(function () {
      if (!current(mine)) return;
      var result;
      try {
        result = work();
      } catch (error) {
        return stepPick(message(error), pasted);
      }
      parsed = result;
      stepReview();
    });
  }

  function readFile(file) {
    var mine = ++ticket;
    stepBusy();
    Import.readFile(file, function (error, result) {
      if (!current(mine)) return;
      if (error) return stepPick(message(error));
      parsed = result;
      stepReview();
    });
  }

  /* ------------------------------------------------------------- Auf/Zu */

  //  file: eine Datei zum Einlesen. text: bereits vorhandener Inhalt –
  //  so kommt ein Link mit Daten durch dieselbe Bestaetigung wie alles
  //  andere, statt am Dialog vorbei ins Dokument zu schreiben.
  function show(config, file, text) {
    options = config;
    mode = "replace";
    if (!overlay) build();

    overlay.titleNode.textContent = t("impTitle");
    overlay.closeButton.setAttribute("aria-label", t("close"));
    overlay.closeButton.title = t("close");
    overlay.hidden = false;
    document.body.classList.add("picker-open");
    lastFocus = document.activeElement;
    //  Tab bleibt im Dialog, Escape schliesst ihn (js/focus.js).
    if (release) release();
    release = global.RickCVFocus ? global.RickCVFocus.trap(overlay.panel, hide) : null;

    if (file) readFile(file);
    else if (text) handle(function () { return Import.parseText(text, "link.json"); });
    else stepPick();
  }

  function hide() {
    if (!overlay) return;
    ticket++;
    overlay.hidden = true;
    overlay.classList.remove("dragging");
    document.body.classList.remove("picker-open");
    if (release) release();
    release = null;
    parsed = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  global.RickCVImportDialog = { open: show, close: hide };
})(typeof window !== "undefined" ? window : this);
