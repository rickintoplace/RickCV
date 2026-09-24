/*  builder.js – Verkabelt Zustand, Formulare und Vorschau.
 *
 *  Zustaendig fuer: Laden und Speichern, Verlauf, Sprache, Import/Export,
 *  Druck und die Groesse der Vorschau. Die Formulare selbst kommen aus
 *  sections.js, die Bausteine aus fields.js.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "rickcv.data.v3";
  var LEGACY_KEY = "rickcv.data.v2";
  var THEME_KEY = "rickcv.theme";

  var Model = global.RickCVModel;
  var Fields = global.RickCVFields;
  var I18n = global.RickCVI18n;

  var state = null;
  var sections = [];
  //  Welche Abschnitte aufgeklappt sind, ueber Reiterwechsel hinweg.
  var sectionOpen = {};
  var t = I18n.ui("de");
  var committedLocale = "de";

  var frame = null;
  var frameReady = false;

  //  Nachrichten an den Vorschaurahmen gehen nur an die eigene Adresse –
  //  der Rahmen traegt den ganzen Lebenslauf. Per Doppelklick geoeffnet
  //  (file://) gibt es keinen Ursprung, den man nennen koennte.
  var ORIGIN = global.location.origin && global.location.origin !== "null"
    ? global.location.origin : "*";

  //  Nur der eigene Vorschaurahmen darf hier melden. Eine fremde Seite,
  //  die den Baukasten oeffnet, koennte sonst eine Datei als Theme
  //  einschmuggeln – ganz ohne Rueckfrage.
  function fromFrame(event) {
    if (!frame || event.source !== frame.contentWindow) return false;
    return ORIGIN === "*" || event.origin === ORIGIN;
  }

  //  Der Verlauf hinter "Rueckgaengig" (js/history.js). Er heisst nicht
  //  "history", damit er window.history nicht verdeckt.
  var steps = null;

  //  Zaehler fuer die Staende, die an die Vorschau gehen, und fuer den, den
  //  sie zuletzt gezeichnet hat. Gedruckt wird erst, wenn beide sich
  //  einholen – sonst laege im PDF der vorige Stand.
  var sentSeq = 0;
  var paintedSeq = 0;
  var afterPaint = [];

  //  Erscheinungsbild des Editors. "system" traegt kein Attribut – dann
  //  entscheidet color-scheme anhand der Einstellung des Betriebssystems.
  var THEMES = ["system", "light", "dark"];
  var THEME_ICONS = { system: "contrast", light: "light_mode", dark: "dark_mode" };
  var THEME_LABELS = { system: "themeSystem", light: "themeLight", dark: "themeDark" };
  var theme = "system";
  var themeHintShown = false;

  /* ---------------------------------------------------------------- Helfer */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  //  Die Symbole der Oberflaeche stehen in js/ui-icons.js.
  function iconHtml(name) {
    return global.RickCVUi.icon(name);
  }

  //  Jede Schaltflaeche mit data-icon bekommt ihr Symbol, sobald die Seite
  //  steht – so steht die Zeichnung an einer Stelle und nicht in jeder
  //  Zeile HTML.
  function paintIcons(root) {
    var nodes = (root || document).querySelectorAll("[data-icon]");
    Array.prototype.forEach.call(nodes, function (node) {
      var slot = node.querySelector(".btn-glyph") || node;
      slot.innerHTML = iconHtml(node.getAttribute("data-icon"));
    });
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function status(message) {
    document.getElementById("status").textContent = message;
  }

  var toastTimer = null;

  //  Der Hinweis kann einen Handgriff tragen: "Beispiel geladen ·
  //  Rueckgaengig". Dort steht er im Weg des Blicks, im Augenblick der
  //  Reue – besser als jede Tastenkombination, die niemand kennt.
  function toast(message, action) {
    var node = document.getElementById("toast");
    node.textContent = "";
    node.appendChild(el("span", null, message));

    if (action) {
      var button = el("button", "toast-action", action.label);
      button.type = "button";
      button.addEventListener("click", function () {
        node.classList.remove("visible");
        action.run();
      });
      node.appendChild(button);
    }

    node.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove("visible"); },
      action ? 6000 : 2600);
  }
  global.RickCVToast = toast;

  /* ------------------------------------------------------- Laden/Speichern */

  //  Beim allerersten Besuch steht nichts im Speicher. Dann zeigt der
  //  Editor eine Karte, die sagt, dass rechts ein Beispiel steht – und wie
  //  man anders anfaengt.
  var firstVisit = false;

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    } catch (error) {
      console.warn("Browser-Speicher nicht lesbar:", error);
    }
    if (raw) {
      try {
        var migrated = Model.migrate(JSON.parse(raw));
        if (migrated) return migrated;
      } catch (error) {
        console.warn("Gespeicherte Daten unlesbar, starte mit Beispiel:", error);
      }
    } else {
      firstVisit = true;
    }
    return Model.createExample(startLocale());
  }

  //  Beim allerersten Besuch entscheidet die Spracheinstellung des
  //  Browsers, in welcher Sprache Oberflaeche und Beispiel erscheinen.
  //  Vorher landete jeder in einem deutschen Baukasten, auch wer kein Wort
  //  Deutsch spricht.
  function startLocale() {
    var languages = global.navigator.languages || [global.navigator.language || ""];
    for (var i = 0; i < languages.length; i++) {
      var code = String(languages[i]).toLowerCase();
      if (code.indexOf("de") === 0) return "de";
      if (code.indexOf("en") === 0) return "en";
    }
    return "de";
  }

  //  Gespeichert wird kurz nach dem letzten Tastendruck – und sofort, wenn
  //  der Tab geschlossen oder verlassen wird. Sonst ging verloren, was in
  //  der letzten halben Sekunde getippt wurde.
  var saveTimer = null;
  var storageFull = false;

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageFull = false;
    } catch (error) {
      //  Meist ein zu grosses Profilbild. Das soll niemand erst beim
      //  naechsten Neuladen merken: der Hinweis kommt einmal als Meldung
      //  und bleibt in der Statuszeile stehen, bis es wieder klappt.
      if (!storageFull) toast(t("storageFull"));
      storageFull = true;
    }
    showSaveState();
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }

  function flushSave() {
    if (saveTimer !== null) saveNow();
  }

  //  Die Statuszeile sagt, was mit den Daten ist – und nur das. Frueher
  //  meldete auch die Vorschau "Gespeichert", sobald sie fertig gezeichnet
  //  hatte, und ueberschrieb damit "Speicher voll".
  function showSaveState() {
    if (saveTimer !== null) status(t("saving"));
    else status(storageFull ? t("storageFull") : t("saved"));
  }

  /* ---------------------------------------------------------------- Verlauf */

  function snapshot() {
    return JSON.stringify(state);
  }

  //  Aus einem getippten Wort wird ein einziger Undo-Schritt; die Regeln
  //  dafuer stehen in js/history.js.
  function pushHistory() {
    steps.touch();
  }

  function undo() {
    var previous = steps.undo();
    if (previous === null) return toast(t("nothingToUndo"));
    replaceState(JSON.parse(previous));
    toast(t("undone"));
  }

  function redo() {
    var next = steps.redo();
    if (next === null) return toast(t("nothingToRedo"));
    replaceState(JSON.parse(next));
    toast(t("redone"));
  }

  //  Ein Schritt, der den ganzen Stand austauscht – Beispiel, Neu, Import.
  //  Er kommt mit seinem eigenen Rueckweg: im Hinweis steht, dass er sich
  //  zuruecknehmen laesst, und ein Klick darauf tut es.
  function replaceAll(next, message) {
    hideWelcome();
    steps.checkpoint();
    replaceState(next);
    toast(message, { label: t("undo"), run: undo });
  }

  //  Der Knopf sagt, ob es etwas zurueckzunehmen gibt. Ohne ihn wussten
  //  nur die von Strg+Z, dass ein Klick auf "Beispiel" oder "Neu"
  //  umkehrbar ist – und wer das nicht weiss, verliert seine Arbeit.
  function showUndo() {
    if (!steps) return;
    var back = document.getElementById("btn-undo");
    var ahead = document.getElementById("btn-redo");
    if (back) back.disabled = !steps.canUndo();
    if (ahead) ahead.disabled = !steps.canRedo();
  }

  function replaceState(next) {
    state = next;
    committedLocale = state.locale;
    Fields.setState(state);
    applyLocale();
    buildEditor();
    sendToPreview();
    save();
    steps.reset();
  }

  /*  Ist das Dokument noch das Beispiel oder ein leeres? Dann geht bei
   *  "Beispiel" und "Neu" nichts verloren, und eine Rueckfrage waere nur im
   *  Weg. Sonst fragen beide nach: Rueckgaengig gibt es nur, solange der Tab
   *  offen ist, gespeichert wird der neue Stand aber sofort.
   */
  function stable(value) {
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ":" + stable(value[key]);
      }).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function untouched() {
    var current = stable(Model.migrate(JSON.parse(snapshot())));
    return [Model.createExample(state.locale), Model.createBase(state.locale)]
      .some(function (doc) { return stable(Model.migrate(doc)) === current; });
  }

  //  Steht noch genau das Beispiel in dieser Sprache da?
  function isExample(locale) {
    var current = JSON.parse(snapshot());
    current.locale = locale;
    return stable(Model.migrate(current)) === stable(Model.migrate(Model.createExample(locale)));
  }

  /* ---------------------------------------------------------- Startkarte */

  var welcome = null;

  function showWelcome() {
    var pane = document.querySelector(".editor-pane");
    if (!pane || welcome) return;
    welcome = el("section", "welcome");
    welcome.setAttribute("aria-labelledby", "welcome-title");
    pane.insertBefore(welcome, pane.firstChild);
    paintWelcome();
  }

  function paintWelcome() {
    if (!welcome) return;
    welcome.textContent = "";

    var close = el("button", "btn btn-icon welcome-close", "✕");
    close.type = "button";
    close.title = t("close");
    close.setAttribute("aria-label", t("close"));
    close.addEventListener("click", hideWelcome);

    var title = el("h2", "welcome-title", t("welcomeTitle"));
    title.id = "welcome-title";

    var actions = el("div", "welcome-actions");
    [
      { label: t("welcomeEdit"), primary: true, run: function () {
        var name = document.querySelector('[data-section="person"] input');
        if (name) name.focus();
      } },
      { label: t("welcomeImport"), run: function () { openImport(); } },
      { label: t("welcomeAi"), run: function () { openAi(); } },
      { label: t("welcomeEmpty"), run: function () {
        replaceAll(Model.createBase(state.locale), t("newStarted"));
      } },
    ].forEach(function (entry) {
      var button = el("button", "btn" + (entry.primary ? " btn-primary" : ""), entry.label);
      button.type = "button";
      button.addEventListener("click", function () {
        hideWelcome();
        entry.run();
      });
      actions.appendChild(button);
    });

    welcome.appendChild(close);
    welcome.appendChild(title);
    welcome.appendChild(el("p", "welcome-text", t("welcomeText")));
    welcome.appendChild(actions);
  }

  function hideWelcome() {
    if (!welcome) return;
    welcome.parentNode.removeChild(welcome);
    welcome = null;
  }

  /* -------------------------------------------------------------- Vorschau */

  //  Die Vorschau folgt dem Tippen frameweise statt auf einem Timer: pro
  //  Bildwiederholung geht hoechstens eine Nachricht raus. Das ist so
  //  unmittelbar wie moeglich und laesst trotzdem nichts auflaufen, wenn
  //  jemand schnell schreibt oder einen Regler zieht.
  var previewQueued = false;

  function flushPreview() {
    if (!previewQueued) return;   // schon abgeschickt
    previewQueued = false;
    if (!frameReady || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "rickcv:data", data: state, seq: ++sentSeq },
      ORIGIN);
  }

  function sendToPreview() {
    if (previewQueued) return;
    previewQueued = true;

    var flush = flushPreview;
    global.requestAnimationFrame(flush);

    //  requestAnimationFrame laeuft nur, solange gezeichnet wird – im
    //  Hintergrund-Tab oder bei ausgeblendeter Vorschau ruht es. Ohne den
    //  Timer bliebe die Sperre dann stehen und die Vorschau fror ein, bis
    //  die Seite neu geladen wurde. Der Timer schickt notfalls selbst; wer
    //  zuerst kommt, gewinnt.
    global.setTimeout(flush, 120);
  }

  /*  Die Vorschau meldet sich mit "rickcv:ready", sobald cv.html steht.
   *  Auf diese Meldung allein ist kein Verlass: der Rahmen laedt parallel
   *  zum Builder, und liegt cv.html im Cache, ist die Meldung schon durch,
   *  bevor hier jemand zuhoert. Dann blieb frameReady falsch und die
   *  Vorschau stand bis zum naechsten Neuladen still – Eingaben landeten im
   *  Speicher, aber nicht im Bild.
   *
   *  Deshalb zwei Wege zum selben Ziel: die Meldung und das load-Ereignis
   *  des Rahmens. Wer zuerst kommt, schaltet frei; der zweite Aufruf kostet
   *  nur eine ueberfluessige Nachricht.
   */
  function markFrameReady() {
    frameReady = true;
    sendToPreview();
  }

  function watchFrame() {
    frame.addEventListener("load", markFrameReady);

    //  Schon fertig, bevor der Zuhoerer stand? Dann sofort nachreichen.
    var doc = frame.contentDocument;
    if (doc && doc.readyState === "complete") markFrameReady();
  }

  function changed() {
    //  Wer tippt, hat sich entschieden; die Startkarte hat ihren Dienst getan.
    hideWelcome();
    pushHistory();
    sendToPreview();
    save();
    showSaveState();
    //  Zahl und "ausgeblendet" koennen sich mit jedem Schalter aendern.
    updateCounts();
  }

  /* ------------------------------------------------------ Erscheinungsbild */

  //  Wird direkt beim Laden aufgerufen, noch vor init(): sonst blitzt beim
  //  Start kurz das Systemschema auf, bevor die eigene Wahl greift.
  function applyTheme() {
    var root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);

    var icon = document.getElementById("btn-theme-icon");
    var button = document.getElementById("btn-theme");
    if (icon) icon.textContent = THEME_ICONS[theme];
    if (button) {
      var label = t(THEME_LABELS[theme]);
      button.title = label;
      button.setAttribute("aria-label", label);
    }
  }

  function cycleTheme() {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      /* ohne Speicher gilt die Wahl eben nur fuer diese Sitzung */
    }
    applyTheme();

    //  Dass der Lebenslauf hell bleibt, ist Absicht: er wird gedruckt. Einmal
    //  gesagt reicht – bei jedem Klick waere der Hinweis nur noch im Weg.
    if (theme !== "system" && !themeHintShown) {
      themeHintShown = true;
      toast(t("themeSwitched"));
    }
  }

  try {
    if (THEMES.indexOf(localStorage.getItem(THEME_KEY)) !== -1) {
      theme = localStorage.getItem(THEME_KEY);
    }
  } catch (error) {
    /* kein Speicher – dann folgt der Editor dem System */
  }
  applyTheme();

  /* -------------------------------------------------------------- Sprache */

  function applyLocale() {
    var locale = state.locale || "de";
    t = I18n.ui(locale);
    document.documentElement.lang = locale;
    global.RickCVIconPicker.setTranslator(t);

    var texts = {
      "brand-tagline": "tagline",
      "btn-import": "import",
      "btn-export": "export",
      "btn-print": "print",
      "zoom-label": "zoom",
      "tab-edit": "tabEdit",
      "tab-preview": "tabPreview",
      "footer-note": "footerNote",
      "footer-imprint": "footerImprint",
      "footer-privacy": "footerPrivacy",
      "footer-source": "footerSource",
    };
    Object.keys(texts).forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      //  Traegt die Schaltflaeche ein Symbol, gehoert der Text in ihre
      //  Beschriftung – sonst wuerde er die Zeichnung daneben loeschen.
      var label = node.querySelector(".btn-label");
      (label || node).textContent = t(texts[id]);
    });

    //  Auch der Reiter im Browser: er stand fest auf Deutsch, waehrend
    //  daneben die englische Oberflaeche lief.
    document.title = "RickCV – " + t("tagline");

    //  Die Auswahl in der Kopfzeile und die im Abschnitt "Optionen" zeigen
    //  denselben Wert – egal, ueber welche der beiden umgestellt wurde.
    var langSwitch = document.getElementById("lang-switch");
    if (langSwitch) langSwitch.value = locale;

    //  Das Erscheinungsbild ist beschriftet, also faellt es mit der Sprache um.
    applyTheme();
    paintWelcome();

    var titles = {
      "btn-undo": "undoTitle",
      "btn-redo": "redoTitle",
      "btn-more": "moreTitle",
      "lang-switch": "languageTitle",
      "btn-import": "importTitle",
      "btn-export": "exportTitle",
      "btn-print": "printTitle",
      "resizer": "dragWidth",
    };
    //  Auf dem Mac heisst Strg dort Cmd – die Tastenkuerzel in den Titeln
    //  sollen stimmen.
    var mac = /Mac|iPhone|iPad/.test(global.navigator.platform || global.navigator.userAgent);
    function keys(text) {
      return mac ? text.replace(/Strg\+Umschalt\+|Ctrl\+Shift\+/g, "⇧⌘").replace(/Strg\+|Ctrl\+/g, "⌘")
                 : text;
    }

    Object.keys(titles).forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.title = keys(t(titles[id]));
      //  Wo nur ein Symbol steht, ist der Titel auch der Name des Knopfes.
      if (!node.querySelector(".btn-label") && !node.textContent.trim()) {
        node.setAttribute("aria-label", t(titles[id]).replace(/\s*\(.*\)$/, ""));
      }
    });

    //  Was nur Vorlesesoftware hoert, stand fest auf Deutsch.
    var labels = {
      "lang-switch": "languageTitle",
      "preview-frame": "tabPreview",
      "footer-nav": "footerNavLabel",
    };
    Object.keys(labels).forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      if (id === "preview-frame") node.title = t(labels[id]);
      else node.setAttribute("aria-label", t(labels[id]));
    });

    var fit = document.querySelector('#zoom option[value="fit"]');
    if (fit) fit.textContent = t("zoomFit");

    var warn = document.getElementById("browser-warn");
    if (warn) {
      warn.hidden = isChromium();
      warn.textContent = t("browserWarn");
      warn.title = t("browserWarnLong");
    }
  }

  /* --------------------------------------------------------- Editor bauen */

  function sectionContext() {
    return {
      state: state,
      t: t,
      onChange: changed,
      refreshSection: refreshSection,
      rebuildEditor: buildEditor,
      onLocaleChange: switchLocale,
    };
  }

  //  Beim Sprachwechsel werden Vorgabe-Ueberschriften mitgezogen, sofern der
  //  Nutzer sie nicht selbst geaendert hat. Eigene Formulierungen bleiben.
  function switchLocale() {
    //  Das unveraenderte Beispiel wechselt mit der Sprache. Wer auf einem
    //  deutschen Rechner ankommt und auf Englisch umstellt, will kein
    //  deutsches Beispiel mit englischen Ueberschriften – und verliert
    //  nichts, wenn es ausgetauscht wird.
    if (committedLocale !== state.locale && isExample(committedLocale)) {
      replaceState(Model.createExample(state.locale));
      return;
    }

    var previous = I18n.doc(committedLocale);
    var next = I18n.doc(state.locale);

    function retitle(holder, key) {
      if (holder && holder.title === previous(key)) holder.title = next(key);
    }
    retitle(state.profile, "profile");
    retitle(state.skills, "skills");
    retitle(state.languages, "languages");
    retitle(state.interests, "interests");
    retitle(state.projects, "projects");
    retitle(state.mobility, "mobility");
    retitle(state.mobilitySB, "mobility");
    retitle(state.references, "references");
    if (state.contactTitle === previous("contact")) state.contactTitle = next("contact");

    (state.sections || []).forEach(function (section) {
      var key = section.atsRole === "other" ? null : section.atsRole;
      if (key && section.title === previous(key)) section.title = next(key);
    });

    committedLocale = state.locale;
    applyLocale();
    buildEditor();
    sendToPreview();
    save();
  }

  function refreshSection(id) {
    sections = global.RickCVSections.build(sectionContext());
    var section = sections.filter(function (item) { return item.id === id; })[0];
    var node = document.querySelector('[data-section="' + id + '"] .section-body');
    if (!section || !node) return;
    node.innerHTML = "";
    section.build(node);
    showLetterLength();
  }

  //  Kopfzeile eines Abschnitts: Zahl der Eintraege und ob der Block
  //  gerade nicht im Dokument steht. Beides aendert sich beim Bearbeiten,
  //  ohne dass der Abschnitt neu gebaut wird.
  function updateCounts() {
    sections.forEach(function (section) {
      var node = document.querySelector('[data-section="' + section.id + '"]');
      if (!node) return;
      var badge = node.querySelector(".section-count");
      if (badge && section.count) badge.textContent = section.count();
      var hidden = !!(section.hidden && section.hidden());
      node.classList.toggle("is-hidden", hidden);
      var flag = node.querySelector(".section-hidden");
      if (flag) flag.hidden = !hidden;
    });
  }

  /* ------------------------------------------------- Aus der Vorschau */

  //  Welcher Abschnitt einen Pfad in den Daten bearbeitet. Die Vorschau
  //  meldet den Pfad (js/preview.js, render.js setzt ihn als data-edit).
  var SECTION_FOR = [
    [/^(contact|contactTitle)(\.|$)/, "person"],
    [/^photo(\.|$)/, "photo"],
    [/^profile(\.|$)/, "profile"],
    [/^(events|sections)(\.|$)/, "events"],
    [/^skills(\.|$)/, "skills"],
    [/^languages(\.|$)/, "languages"],
    [/^interests(\.|$)/, "interests"],
    [/^(mobility|mobilitySB)(\.|$)/, "mobility"],
    [/^projects(\.|$)/, "projects"],
    [/^references(\.|$)/, "references"],
    [/^footers(\.|$)/, "footer"],
    [/^(coverLetter\.recipient|settings\.(date|place))$/, "letterAddress"],
    [/^coverLetter\.signature/, "letterSignature"],
    [/^coverLetter(\.|$)/, "letterText"],
  ];

  function revealPath(path) {
    if (typeof path !== "string" || !/^[\w.]+$/.test(path)) return;
    var rule = SECTION_FOR.filter(function (entry) { return entry[0].test(path); })[0];
    if (!rule) return;
    var section = sections.filter(function (item) { return item.id === rule[1]; })[0];
    if (!section) return;

    hideWelcome();
    if (narrowLayout()) showColumn(false);
    selectGroup(section.group || "resume", false);

    var details = document.querySelector('[data-section="' + section.id + '"]');
    if (!details) return;
    if (details.reveal) details.reveal();

    var target = null;
    var field = null;

    //  Ein Eintrag einer Liste: "events.3", "skills.items.2" …
    var item = /^(.*)\.(\d+)$/.exec(path);
    var list = item && details.querySelector('.list-editor[data-path="' + item[1] + '"]');
    if (list) {
      target = list.openItem(Number(item[2]));
      field = target && target.querySelector(".list-item-body input:not([type=checkbox]), " +
        ".list-item-body textarea, .list-item-body select");
    }
    //  Ein Feld: "contact.name", "coverLetter.subject" …
    if (!target) {
      field = details.querySelector('[data-path="' + path + '"]');
      target = field && (field.closest(".field") || field);
    }
    //  Eine ganze Liste oder ein Block: "sections", "footers.left" …
    if (!target) {
      target = details.querySelector('.list-editor[data-path="' + path + '"]') ||
        (details.querySelector('[data-path^="' + path + '."]') || {}).parentNode || null;
      field = target && target.querySelector("input:not([type=checkbox]), textarea, select, " +
        ".list-item-toggle");
    }
    if (!target) target = details;

    //  Was dazwischen zugeklappt ist, geht auf – "Kategorien verwalten" etwa.
    for (var node = target; node && node !== details; node = node.parentNode) {
      if (node.tagName === "DETAILS") node.open = true;
    }

    target.scrollIntoView({ block: "center", behavior: "smooth" });
    if (field) field.focus({ preventScroll: true });
    target.classList.remove("flash");
    void target.offsetWidth;            // die Animation neu starten
    target.classList.add("flash");
    setTimeout(function () { target.classList.remove("flash"); }, 1700);
  }

  /* ------------------------------------------------------------- Reiter */

  //  Vier Reiter statt sechzehn Abschnitte untereinander: was im Lebenslauf
  //  steht, das Anschreiben, das Aussehen und alles andere. Welcher offen
  //  ist, merkt sich der Browser – nur fuer diesen Besucher, als
  //  Bequemlichkeit.
  var GROUPS = [
    { id: "resume", label: "tabResume", icon: "user-round" },
    { id: "letter", label: "tabLetter", icon: "mail" },
    { id: "design", label: "tabDesign", icon: "palette" },
    { id: "settings", label: "tabSettings", icon: "settings" },
  ];
  var GROUP_KEY = "rickcv.ui.group";
  var activeGroup = "resume";

  try {
    var storedGroup = localStorage.getItem(GROUP_KEY);
    if (GROUPS.some(function (group) { return group.id === storedGroup; })) activeGroup = storedGroup;
  } catch (error) { /* ohne Speicher beginnt man eben beim Lebenslauf */ }

  function buildTabs() {
    var bar = document.getElementById("editor-tabs");
    if (!bar) return;
    bar.textContent = "";
    bar.setAttribute("aria-label", t("editorTabs"));

    GROUPS.forEach(function (group) {
      var tab = el("button", "editor-tab");
      tab.type = "button";
      var glyph = el("span", "editor-tab-icon");
      glyph.setAttribute("aria-hidden", "true");
      glyph.innerHTML = iconHtml(group.icon);
      tab.appendChild(glyph);
      tab.appendChild(el("span", "editor-tab-label", t(group.label)));
      tab.id = "tab-" + group.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "editor");
      var selected = group.id === activeGroup;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.addEventListener("click", function () { selectGroup(group.id, true); });
      bar.appendChild(tab);
    });

    document.getElementById("editor").setAttribute("aria-labelledby", "tab-" + activeGroup);
  }

  //  Pfeiltasten wandern zwischen den Reitern, wie bei jeder Reiterleiste.
  function bindTabKeys() {
    var bar = document.getElementById("editor-tabs");
    if (!bar) return;
    bar.addEventListener("keydown", function (event) {
      var index = GROUPS.map(function (group) { return group.id; }).indexOf(activeGroup);
      var next = null;
      if (event.key === "ArrowRight") next = (index + 1) % GROUPS.length;
      else if (event.key === "ArrowLeft") next = (index + GROUPS.length - 1) % GROUPS.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = GROUPS.length - 1;
      if (next === null) return;
      event.preventDefault();
      selectGroup(GROUPS[next].id, true);
      var tab = document.getElementById("tab-" + GROUPS[next].id);
      if (tab) tab.focus();
    });
  }

  function selectGroup(id, scroll) {
    if (id === activeGroup) return;
    activeGroup = id;
    try { localStorage.setItem(GROUP_KEY, id); } catch (error) { /* nur Bequemlichkeit */ }
    buildEditor();
    document.querySelector(".editor-pane").scrollTop = 0;
    //  Die Vorschau geht mit: wer das Anschreiben bearbeitet, will es sehen.
    if (scroll) scrollPreviewTo(id === "letter" ? "letter" : "top");
  }

  /* --------------------------------------------------------- Editor bauen */

  function buildEditor() {
    var editor = document.getElementById("editor");

    // Aufklappzustand ueber den Neuaufbau retten
    var openState = {};
    editor.querySelectorAll(".section").forEach(function (node) {
      openState[node.dataset.section] = node.open;
    });
    Object.keys(openState).forEach(function (id) { sectionOpen[id] = openState[id]; });

    sections = global.RickCVSections.build(sectionContext());
    editor.innerHTML = "";
    buildTabs();

    sections.filter(function (section) {
      return (section.group || "resume") === activeGroup;
    }).forEach(function (section) {
      //  Ein fester Kopf ohne Auf und Zu – etwa der Schalter, ob es ein
      //  Anschreiben gibt. Einzuklappen gaebe es da nichts.
      if (section.plain) {
        var panel = el("div", "section section-plain");
        panel.dataset.section = section.id;
        var inner = el("div", "section-body");
        section.build(inner);
        panel.appendChild(inner);
        editor.appendChild(panel);
        return;
      }

      var details = el("details", "section");
      details.dataset.section = section.id;
      details.open = sectionOpen[section.id] !== undefined ? sectionOpen[section.id] : !!section.open;

      var summary = el("summary");
      var chevron = el("span", "section-chevron");
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = iconHtml("chevron-right");
      summary.appendChild(chevron);

      if (section.icon) {
        var glyph = el("span", "section-icon");
        glyph.setAttribute("aria-hidden", "true");
        glyph.innerHTML = iconHtml(section.icon);
        summary.appendChild(glyph);
      }
      summary.appendChild(el("span", "section-title", section.title));

      //  "ausgeblendet": der Block steht gerade nicht im Dokument. Das sah
      //  man bisher erst nach dem Aufklappen am Schalter darin.
      var flag = el("span", "section-hidden");
      flag.innerHTML = iconHtml("eye-off");
      flag.appendChild(el("span", null, t("sectionHidden")));
      flag.hidden = true;
      summary.appendChild(flag);

      if (section.count) {
        summary.appendChild(el("span", "section-count", String(section.count())));
      }
      details.appendChild(summary);

      var body = el("div", "section-body");
      // Inhalte erst bauen, wenn der Abschnitt zum ersten Mal aufgeht:
      // das haelt den Start schnell, auch bei vielen Eintraegen.
      function ensureBuilt() {
        if (body.dataset.built) return;
        section.build(body);
        body.dataset.built = "1";
        showLetterLength();
      }
      //  Sofort aufklappen und bauen – "toggle" kommt erst eine Runde
      //  spaeter, und wer aus der Vorschau hierher springt, braucht die
      //  Felder jetzt.
      details.reveal = function () {
        details.open = true;
        sectionOpen[section.id] = true;
        ensureBuilt();
      };
      if (details.open) ensureBuilt();
      details.addEventListener("toggle", function () {
        sectionOpen[section.id] = details.open;
        if (details.open) ensureBuilt();
      });
      details.appendChild(body);
      editor.appendChild(details);
    });

    updateCounts();
    showLetterLength();
  }

  /* ------------------------------------------------------- Import/Export */

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function slug(value) {
    return String(value || "lebenslauf").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lebenslauf";
  }

  function exportJson() {
    download(slug(state.contact.name) + ".rickcv.json",
      JSON.stringify(state, null, 2), "application/json");
    toast(t("exported"));
  }

  //  Dieselben Daten im offenen Standard: resume.json laesst sich von
  //  anderen Programmen lesen, traegt dafuer kein Aussehen mit sich.
  function exportJsonResume() {
    download(slug(state.contact.name) + ".resume.json",
      JSON.stringify(global.RickCVImport.toJsonResume(state), null, 2), "application/json");
    toast(t("exported"));
  }

  //  Ein Theme per Datei: hereingezogen, gepruefte Fassung uebernommen,
  //  Hinweise gemeldet. Die Werkstatt im Abschnitt "Themes" macht dasselbe
  //  mit dem Dateiwaehler.
  function loadTheme(file) {
    var Themes = global.RickCVThemes;
    if (!Themes) return;

    var reader = new FileReader();
    reader.onerror = function () { toast(t("importFailed")); };
    reader.onload = function () {
      var css = String(reader.result);
      var read = Themes.read(css, file.name.replace(/\.css$/i, ""));
      steps.checkpoint();
      state.theme = { slug: "", name: read.name, css: css, source: "file" };
      state.settings.template = "custom";
      replaceState(state);
      toast(t("themeLoaded"));
    };
    reader.readAsText(file);
  }

  /*  Dasselbe Dokument als Adresse: alles, was im Baukasten steht, steckt
   *  dann im Link. Praktisch, um an einem anderen Rechner weiterzumachen
   *  oder jemandem den Stand zu schicken – und es ist derselbe Weg, den
   *  auch ein Sprachmodell nimmt (siehe AGENTS.md).
   */
  function bytesToBase64Url(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return global.btoa(binary)
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function toBase64Url(text) {
    return bytesToBase64Url(new TextEncoder().encode(text));
  }

  function linkBase() {
    return global.location.origin && global.location.origin !== "null"
      ? global.location.origin + global.location.pathname
      : global.location.href.split("#")[0];
  }

  //  Gepackt wird mit dem, was der Browser mitbringt. Ein Lebenslauf ist
  //  Text mit vielen wiederkehrenden Schluesselnamen – das schrumpft auf
  //  ein Drittel bis ein Viertel. Kann der Browser es nicht, geht der Link
  //  eben ungepackt hinaus.
  function deflateRaw(text) {
    var bytes = new TextEncoder().encode(text);
    if (typeof global.CompressionStream !== "function") return Promise.resolve(null);

    try {
      var stream = new Blob([bytes]).stream()
        .pipeThrough(new global.CompressionStream("deflate-raw"));
      return new Response(stream).arrayBuffer().then(function (buffer) {
        return new Uint8Array(buffer);
      }, function () { return null; });
    } catch (error) {
      return Promise.resolve(null);
    }
  }

  //  Ein Bild kleiner rechnen, aber nur fuer den Link: im Dokument bleibt
  //  es, wie es ist.
  function scaleImage(dataUrl, maxSide, quality) {
    return new Promise(function (resolve) {
      if (!/^data:image\//.test(dataUrl || "")) return resolve(dataUrl || "");

      var image = new Image();
      image.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        //  Dieselbe Umrechnung wie beim Hochladen: Transparenz bleibt
        //  erhalten, statt im JPEG schwarz zu werden.
        var small = Fields.encodeImage(image, image.width * scale, image.height * scale, quality);
        resolve(small.length < dataUrl.length ? small : dataUrl);
      };
      image.onerror = function () { resolve(dataUrl); };
      image.src = dataUrl;
    });
  }

  //  Dasselbe Dokument, aber mit Bildern in Linkgroesse. 640 Punkte
  //  reichen fuer ein Bewerbungsfoto in Druckqualitaet; passt es damit
  //  noch nicht in eine Adresse, wird weiter heruntergerechnet, bevor das
  //  Bild ganz herausfaellt. Unterschrift und Projektbilder stehen
  //  kleiner auf dem Blatt und duerfen entsprechend kleiner sein.
  var IMAGE_STEPS = [
    { photo: 640, small: 260, quality: 0.72 },
    { photo: 440, small: 200, quality: 0.68 },
    { photo: 300, small: 160, quality: 0.62 },
  ];

  function stateWithSmallImages(step) {
    var copy = JSON.parse(JSON.stringify(state));
    var jobs = [];

    if (copy.photo && copy.photo.src) {
      jobs.push(scaleImage(copy.photo.src, step.photo, step.quality).then(function (src) {
        copy.photo.src = src;
      }));
    }
    if (copy.coverLetter && copy.coverLetter.signatureImg) {
      jobs.push(scaleImage(copy.coverLetter.signatureImg, step.small + 160, 0.75)
        .then(function (src) { copy.coverLetter.signatureImg = src; }));
    }
    (copy.projects && copy.projects.items ? copy.projects.items : []).forEach(function (item) {
      if (!item.img) return;
      jobs.push(scaleImage(item.img, step.small, step.quality).then(function (src) {
        item.img = src;
      }));
    });

    return Promise.all(jobs).then(function () { return copy; });
  }

  function stateWithoutImages() {
    var copy = JSON.parse(JSON.stringify(state));
    if (copy.photo) copy.photo.src = "";
    if (copy.coverLetter) copy.coverLetter.signatureImg = "";
    (copy.projects && copy.projects.items ? copy.projects.items : []).forEach(function (item) {
      if (/^data:/.test(item.img || "")) item.img = "";
    });
    return copy;
  }

  function linkFor(data) {
    var json = JSON.stringify(data);
    return deflateRaw(json).then(function (packed) {
      if (packed) return linkBase() + "#z=" + bytesToBase64Url(packed);
      return linkBase() + "#data=" + toBase64Url(json);
    });
  }

  //  Die Zwischenablage gibt es nur im sicheren Kontext; per Doppelklick
  //  geoeffnet (file://) muss der alte Weg herhalten.
  function copyText(text, done) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function () { done(true); },
        function () { done(fallbackCopy(text)); });
      return;
    }
    done(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var area = el("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var worked = false;
    try { worked = document.execCommand("copy"); } catch (error) { worked = false; }
    document.body.removeChild(area);
    return worked;
  }

  //  Ab hier wird eine Adresse den meisten Chatfenstern und
  //  Mailprogrammen zu lang. Browser selbst tragen ein Vielfaches.
  var LINK_LIMIT = 100000;

  //  Wieviel ein gepackter Link beim Auspacken hoechstens ergeben darf. Ein
  //  Dokument mit Foto braucht ein paar Megabyte; wer mehr in einen Link
  //  packt, will etwas anderes als einen Lebenslauf zeigen.
  var LINK_BYTES = 16 * 1024 * 1024;

  /*  "Als Link kopieren" soll immer einen Link ergeben. Mit einem
   *  Bewerbungsfoto ist das ganze Dokument schnell eine Viertelmillion
   *  Zeichen – frueher kam dann nur die Meldung, der Link sei zu lang, und
   *  damit war die Sache erledigt. Jetzt wird der Reihe nach versucht, und
   *  der Hinweis sagt, was auf dem Weg geblieben ist:
   *
   *    1. alles, gepackt                  – ohne Foto ein paar Kilobyte
   *    2. Bilder Schritt fuer Schritt kleiner gerechnet
   *    3. ohne Bilder                     – der Rest passt immer
   */
  function copyLink() {
    status(t("expLinkWorking"));

    function smaller(index) {
      if (index >= IMAGE_STEPS.length) {
        return linkFor(stateWithoutImages()).then(function (bare) {
          return { link: bare, note: t("expLinkNoImages") };
        });
      }
      return stateWithSmallImages(IMAGE_STEPS[index]).then(function (small) {
        return linkFor(small).then(function (link) {
          if (link.length <= LINK_LIMIT) {
            return { link: link, note: t("expLinkSmallImages") };
          }
          return smaller(index + 1);
        });
      });
    }

    linkFor(state).then(function (full) {
      if (full.length <= LINK_LIMIT) return { link: full, note: "" };
      return smaller(0);
    }).then(function (result) {
      showSaveState();
      copyText(result.link, function (worked) {
        if (!worked) return toast(t("expCopyFailed"));
        var size = t("expLinkCopied").replace("{kb}", Math.round(result.link.length / 1024));
        toast(result.note ? size + " – " + result.note : size);
      });
    }, function (error) {
      //  Ohne diesen Zweig blieb "wird erstellt …" fuer immer stehen.
      console.warn("Link nicht erstellt:", error);
      showSaveState();
      toast(t("expCopyFailed"));
    });
  }

  function copyJson() {
    copyText(JSON.stringify(state, null, 2), function (worked) {
      toast(worked ? t("expJsonCopied") : t("expCopyFailed"));
    });
  }

  //  printAfter: der Link verlangte den Druckdialog (&print=1). Das gilt nur
  //  fuer genau diesen Import – bricht jemand ab, oeffnet der naechste,
  //  ganz andere Import nicht ploetzlich den Druck.
  function openImport(file, text, printAfter) {
    global.RickCVImportDialog.open({
      t: t,
      state: function () { return state; },
      onApply: function (next, info) {
        replaceAll(next, t("impDone").replace("{count}", info.count));
        if (printAfter) printCv();
      },
      onAi: openAi,
    }, file, text);
  }

  //  "Mit deiner KI erstellen" (js/ai-help.js). Die Antwort des Chats geht
  //  durch denselben Import wie alles andere – mit Bestaetigung.
  function openAi() {
    global.RickCVAi.open({
      t: t,
      locale: state.locale,
      state: function () { return state; },
      ownContent: !isExample(state.locale) &&
        !!(String(state.contact.name || "").trim() || state.events.length),
      copy: copyText,
      toast: toast,
      onAnswer: function (text) { openImport(null, text); },
    });
  }

  /*  Daten aus dem Link.
   *
   *  Gedacht fuer den Fall, dass jemand seine KI bittet, die Bewerbung zu
   *  schreiben: sie baut das JSON, haengt es an einen Link, und der Mensch
   *  klickt einmal. Geladen wird nichts aus dem Netz – die Daten stehen im
   *  Link selbst, und sie laufen durch denselben Dialog wie jeder Import,
   *  damit niemand ungefragt ein fremdes Dokument untergeschoben bekommt.
   *
   *    index.html#data=<base64url(JSON)>[&print=1]
   *
   *  Beschrieben in AGENTS.md.
   */

  function fromBase64Url(value) {
    var base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    //  atob liefert Bytes; UTF-8 daraus zu machen ist der Umweg ueber
    //  decodeURIComponent.
    var binary = global.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function base64UrlToBytes(value) {
    var base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    var binary = global.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function readHash() {
    var hash = global.location.hash || "";
    //  "z" ist der gepackte Weg, "data" der einfache. Beide bleiben
    //  lesbar: Links aus frueheren Fassungen und aus Anleitungen fuer
    //  Sprachmodelle sollen nicht eines Tages ins Leere laufen.
    var packed = /[#&]z=([^&]+)/.exec(hash);
    var data = /[#&]data=([^&]+)/.exec(hash);
    if (!packed && !data) return;

    var printAfter = /[#&]print=1\b/.test(hash);

    //  Der Link soll nicht im Verlauf stehenbleiben: er enthaelt den
    //  halben Lebenslauf.
    try {
      global.history.replaceState(null, "",
        global.location.pathname + global.location.search);
    } catch (error) { /* file:// erlaubt das nicht – dann bleibt er stehen */ }

    if (!packed) {
      try {
        openImport(null, fromBase64Url(data[1]), printAfter);
      } catch (error) {
        toast(t("importFailed"));
      }
      return;
    }

    global.RickCVImport.inflateRaw(base64UrlToBytes(packed[1]), LINK_BYTES).then(function (bytes) {
      openImport(null, new TextDecoder().decode(bytes), printAfter);
    }).catch(function () {
      toast(t("importFailed"));
    });
  }

  /* ----------------------------------------------------------- Kleines Menue */

  var openPopup = null;
  var popupAnchor = null;

  function closePopup(returnFocus) {
    if (!openPopup) return;
    openPopup.parentNode.removeChild(openPopup);
    openPopup = null;
    document.removeEventListener("mousedown", onPopupOutside, true);
    document.removeEventListener("keydown", onPopupKey, true);
    if (popupAnchor) {
      popupAnchor.setAttribute("aria-expanded", "false");
      if (returnFocus) popupAnchor.focus();
    }
    popupAnchor = null;
  }

  function onPopupOutside(event) {
    if (openPopup && !openPopup.contains(event.target) &&
        !(popupAnchor && popupAnchor.contains(event.target))) closePopup(false);
  }

  //  Ein Menue bedient sich wie eines: Pfeiltasten wandern, Pos1 und Ende
  //  springen, Escape schliesst und gibt den Fokus an den Knopf zurueck.
  function onPopupKey(event) {
    var items = Array.prototype.slice.call(openPopup.querySelectorAll(".menu-item"));
    var index = items.indexOf(document.activeElement);
    var next = null;
    if (event.key === "Escape") {
      event.preventDefault();
      closePopup(true);
      return;
    }
    if (event.key === "Tab") { closePopup(false); return; }
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index + items.length - 1) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    items[next].focus();
  }

  //  entries: [{ label, hint, icon, action }]
  function popupMenu(anchor, entries) {
    if (openPopup) {
      var same = popupAnchor === anchor;
      closePopup(false);
      if (same) return;
    }

    var menu = el("div", "menu-pop");
    menu.setAttribute("role", "menu");
    if (anchor.id) menu.setAttribute("aria-labelledby", anchor.id);
    entries.forEach(function (entry) {
      var item = el("button", "menu-item");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.tabIndex = -1;

      if (entry.icon) {
        var glyph = el("span", "menu-glyph");
        glyph.innerHTML = iconHtml(entry.icon);
        item.appendChild(glyph);
      }

      item.appendChild(el("strong", null, entry.label));
      if (entry.hint) item.appendChild(el("small", null, entry.hint));
      item.addEventListener("click", function () {
        closePopup(true);
        entry.action();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    var rect = anchor.getBoundingClientRect();
    var width = menu.offsetWidth;
    //  Am rechten Rand ausrichten, aber nie aus dem Fenster laufen lassen.
    var left = Math.max(8, Math.min(rect.right - width, global.innerWidth - width - 8));
    menu.style.left = left + "px";
    menu.style.top = (rect.bottom + 6) + "px";

    openPopup = menu;
    popupAnchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", onPopupOutside, true);
    document.addEventListener("keydown", onPopupKey, true);
    menu.querySelector(".menu-item").focus();
  }

  /*  Eine Datei irgendwo ins Fenster ziehen heisst: uebernimm das. Wer
   *  einen Lebenslauf auf RickCV zieht, hat sich schon entschieden – der
   *  Umweg ueber "Importieren" ist dann nur eine Huerde. Es gilt ueberall:
   *  ueber dem Editor, ueber der Vorschau (die in einem eigenen Rahmen
   *  liegt und deshalb nachfragt), und auch ueber einem Eingabefeld – eine
   *  Datei ist dort ohnehin kein Text zum Einfuegen.
   *
   *  Zwei Stellen behalten ihr eigenes Verhalten, weil dort etwas anderes
   *  gemeint ist: das Feld fuer das Foto und der Dialog selbst.
   */
  function bindFileDrop() {
    ["dragenter", "dragover"].forEach(function (name) {
      document.addEventListener(name, function (event) {
        if (!hasFiles(event)) return;
        event.preventDefault();
        showDropHint();
      });
    });

    document.addEventListener("drop", function (event) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      hideDropHint();
      takeFile(event.dataTransfer.files[0]);
    });

    //  Verlaesst die Datei das Fenster wieder, verschwindet auch das
    //  Zeichen. Ohne das bliebe es stehen, bis jemand irgendwo loslaesst.
    ["dragleave", "dragend"].forEach(function (name) {
      document.addEventListener(name, function (event) {
        if (event.relatedTarget) return;
        hideDropHint();
      });
    });
  }

  function takeFile(file) {
    if (!file) return;
    //  Eine CSS-Datei ist kein Lebenslauf, sondern sein Aussehen.
    if (/\.css$/i.test(file.name) || file.type === "text/css") loadTheme(file);
    else openImport(file);
  }

  /*  Das Zeichen beim Ziehen: die ganze Flaeche sagt, dass sie die Datei
   *  nimmt. Es steht ueber allem und faengt nichts ab – losgelassen wird
   *  auf dem, was darunter liegt.
   *
   *  Ein- und ausgeblendet wird ueber eine Zeitschaltung statt ueber
   *  gezaehlte dragenter und dragleave: beim Ueberfahren von Feldern,
   *  Schaltflaechen und dem Vorschaurahmen kommen die paarweise durcheinander,
   *  ein ausbleibendes dragover dagegen heisst zuverlaessig "weg".
   */
  var dragHint = null;
  var dragTimer = null;

  function showDropHint() {
    if (!dragHint) {
      dragHint = el("div", "drop-hint");
      dragHint.appendChild(el("div", "drop-hint-label", t("dropAnywhere")));
      document.body.appendChild(dragHint);
    }
    dragHint.firstChild.textContent = t("dropAnywhere");
    document.body.classList.add("dragging-file");

    //  Grosszuegig bemessen: steht der Zeiger still, meldet der Browser
    //  das Ziehen nur noch alle paar hundert Millisekunden.
    if (dragTimer) global.clearTimeout(dragTimer);
    dragTimer = global.setTimeout(hideDropHint, 700);
  }

  function hideDropHint() {
    if (dragTimer) global.clearTimeout(dragTimer);
    dragTimer = null;
    document.body.classList.remove("dragging-file");
  }

  function hasFiles(event) {
    var data = event.dataTransfer;
    if (!data) return false;
    if (data.files && data.files.length) return true;
    return data.types && Array.prototype.indexOf.call(data.types, "Files") !== -1;
  }

  //  Das Layout ist auf Chromes Druckausgabe abgestimmt. Andere Browser
  //  setzen Raender, Umbrueche und Hintergrundfarben abweichend, deshalb der
  //  Hinweis – aber nur dort, wo er zutrifft.
  function isChromium() {
    var data = global.navigator.userAgentData;
    if (data && Array.isArray(data.brands)) {
      return data.brands.some(function (brand) {
        return /Chromium|Google Chrome/i.test(brand.brand);
      });
    }
    var ua = global.navigator.userAgent;
    return /Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua);
  }

  //  Gedruckt wird der Stand, der gerade im Editor steht. Was noch auf dem
  //  Weg zur Vorschau ist, geht sofort hinaus, und der Druck wartet, bis
  //  die Vorschau ihn gezeichnet und gemessen hat – Bilder und Schriften
  //  eingeschlossen. Der Zeitgeber ist nur die Rueckfallebene, falls der
  //  Rahmen gerade nicht zeichnet (ausgeblendet auf dem Telefon).
  function whenPainted(fn) {
    flushPreview();
    if (paintedSeq >= sentSeq) return fn();
    var done = false;
    function run() {
      if (done) return;
      done = true;
      fn();
    }
    afterPaint.push({ seq: sentSeq, run: run });
    setTimeout(run, 2500);
  }

  /*  Beim ersten PDF steht vor dem Druckdialog, was darin einzustellen ist.
   *  Frueher war das ein Hinweis von zwei Sekunden, der unter dem
   *  aufgehenden Druckdialog verschwand – gelesen hat ihn niemand, und das
   *  PDF bekam Raender und verlor die Hintergrundfarben. Wer es einmal
   *  gesehen hat, kann es abwaehlen.
   */
  var PRINT_GUIDE_KEY = "rickcv.ui.printGuide";

  function wantsPrintGuide() {
    try { return localStorage.getItem(PRINT_GUIDE_KEY) !== "off"; } catch (error) { return true; }
  }

  function printGuide() {
    if (!wantsPrintGuide()) return printCv();

    var steps = el("dl", "print-steps");
    [
      [t("printGuideDestination"), t("printGuideDestinationValue")],
      [t("printGuidePaper"), state.settings.pageSize === "letter" ? "Letter" : "A4"],
      [t("printGuideMargins"), t("printGuideMarginsValue")],
      [t("printGuideBackground"), t("printGuideBackgroundValue")],
    ].forEach(function (row) {
      steps.appendChild(el("dt", null, row[0]));
      steps.appendChild(el("dd", null, row[1]));
    });

    var again = el("label", "print-guide-again");
    var box = el("input");
    box.type = "checkbox";
    again.appendChild(box);
    again.appendChild(el("span", null, t("printGuideHide")));

    var body = [steps];
    if (!isChromium()) body.push(el("p", "imp-warn", t("printHintChrome")));
    body.push(again);

    global.RickCVDialog.open({
      title: t("printGuideTitle"),
      message: t("printGuideIntro"),
      body: body,
      className: "print-guide",
      actions: [
        { label: t("impCancel"), value: false },
        { label: t("printGuideGo"), value: true, primary: true },
      ],
    }).then(function (go) {
      if (!go) return;
      if (box.checked) {
        try { localStorage.setItem(PRINT_GUIDE_KEY, "off"); } catch (error) { /* dann eben wieder */ }
      }
      printCv();
    });
  }

  //  Die Vorschau an eine Stelle rollen: zum Anfang oder zum Anschreiben.
  //  Wo das Anschreiben beginnt, meldet der Rahmen mit jeder Messung.
  var letterTop = 0;

  function scrollPreviewTo(where) {
    var scroll = document.getElementById("preview-scroll");
    if (!scroll) return;
    var top = where === "letter" && letterTop ? letterTop * currentScale : 0;
    scroll.scrollTo({ top: top, behavior: "smooth" });
  }

  function printCv() {
    if (!frame.contentWindow) return;
    whenPainted(function () {
      frame.contentWindow.postMessage({ type: "rickcv:print" }, ORIGIN);
    });
    //  Das Papier, das eingestellt ist – der Hinweis sagte frueher immer A4.
    var hint = t("printHint").replace("{size}",
      state.settings.pageSize === "letter" ? "Letter" : "A4");
    toast(isChromium() ? hint : hint + " " + t("printHintChrome"));
  }

  /* ---------------------------------------------------- Zoom & Seitenzahl */

  var previewHeight = 1200;
  var previewPages = 1;
  var zoomMode = "fit";
  var currentScale = 1;
  var PAGE_HEIGHT = 1123; // 29,7 cm bei 96 dpi

  function applyZoom() {
    var scroll = document.getElementById("preview-scroll");
    var canvas = document.getElementById("preview-canvas");
    var stage = document.getElementById("preview-stage");

    var available = scroll.clientWidth - 32;

    //  Auf schmalen Bildschirmen liegt die Vorschau hinter dem Reiter
    //  "Vorschau" und ist zwischendurch ausgeblendet – dann ist sie 0 breit.
    //  Ohne diese Bremse ergaebe "Einpassen" einen negativen Massstab und
    //  das Dokument verschwaende: genau das machte den Baukasten auf dem
    //  Telefon unbrauchbar.
    if (available <= 0) return;

    var scale = zoomMode === "fit" ? Math.min(1, available / 820) : Number(zoomMode);
    currentScale = scale;

    //  Passt das Blatt in die Breite, gehoert die Querbewegung der
    //  Wischgeste – sonst muss man es waagerecht schieben koennen. Die
    //  scrollende Flaeche entscheidet das selbst, deshalb steht es hier und
    //  nicht im Stylesheet.
    scroll.style.touchAction = 820 * scale > scroll.clientWidth + 1 ? "" : "pan-y";

    stage.style.transform = "scale(" + scale + ")";
    canvas.style.width = 820 * scale + "px";
    canvas.style.height = previewHeight * scale + "px";
    frame.style.height = previewHeight + "px";
  }

  /*  Ab einer gewissen Breite ist in der Kopfzeile Platz fuer Zoom,
   *  Seitenzahl und Status. Dann wandert die Leiste dorthin und die Vorschau
   *  bekommt die Zeile zurueck, die sie sonst an eine halbleere Leiste
   *  verliert. Darunter bleibt die eigene Leiste ueber der Vorschau – dort
   *  waere in der Kopfzeile kein Platz. Die Breite steht auch in
   *  builder.css als --ui-wide.
   */
  var WIDE_LAYOUT = "(min-width: 1700px)";

  function placePreviewBar(wide) {
    var bar = document.getElementById("preview-bar");
    if (!bar) return;

    var target = wide
      ? document.querySelector(".app-header")
      : document.querySelector(".preview");
    if (bar.parentNode === target) return;

    if (wide) {
      //  Vor die Luecke, damit die Schaltflaechen rechts stehen bleiben.
      target.insertBefore(bar, document.querySelector(".header-spacer"));
    } else {
      target.insertBefore(bar, target.firstChild);
    }
    bar.classList.toggle("in-header", wide);
    applyZoom();
  }

  function bindWideLayout() {
    var query = global.matchMedia(WIDE_LAYOUT);
    placePreviewBar(query.matches);
    //  addEventListener kennt Safari erst ab 14 – addListener als Rueckfall.
    if (query.addEventListener) {
      query.addEventListener("change", function (event) { placePreviewBar(event.matches); });
    } else if (query.addListener) {
      query.addListener(function (event) { placePreviewBar(event.matches); });
    }
  }

  /*  Das Anschreiben bricht von selbst um. Damit das niemandem entgeht,
   *  meldet die Vorschau, wieviele Blaetter es geworden sind, und der
   *  Abschnitt "Anschreiben" sagt, was davon zu halten ist.
   */
  var letterPageCount = 0;

  function showLetterLength(pages) {
    if (pages !== undefined) letterPageCount = pages;

    //  Der Abschnitt wird beim ersten Aufklappen und bei jedem Neuaufbau
    //  frisch gebaut – die Warnung ist dann wieder versteckt und muss den
    //  zuletzt gemeldeten Stand nachgereicht bekommen.
    var note = document.getElementById("letter-length-warn");
    if (!note) return;

    if (letterPageCount < 2) { note.hidden = true; return; }
    note.textContent = t("letterLongWarn").replace(/\{pages\}/g, letterPageCount);
    note.hidden = false;
  }

  function showPageCount(count) {
    var node = document.getElementById("page-count");
    if (!node) return;
    previewPages = count;
    node.textContent = count + " " + (count === 1 ? t("page") : t("pages"));
  }

  /* ---------------------------------------------------------------- Start */

  //  Frueher ohne Rueckfrage – direkt neben "Neu", und nach einem Neuladen
  //  war die eigene Arbeit weg.
  //  Eine Rueckfrage nur, wo es etwas zu verlieren gibt – und im Stil des
  //  Baukastens, nicht als Kasten des Browsers (js/dialog.js).
  function ask(titleKey, messageKey, goKey, danger) {
    if (untouched()) return Promise.resolve(true);
    return global.RickCVDialog.confirm({
      title: t(titleKey), message: t(messageKey),
      confirm: t(goKey), cancel: t("impCancel"), danger: danger,
    });
  }

  function loadExample() {
    ask("confirmExampleTitle", "confirmExample", "confirmExampleGo", false).then(function (yes) {
      if (!yes) return;
      hideWelcome();
      replaceAll(Model.createExample(state.locale), t("exampleLoaded"));
    });
  }

  //  Die Rueckfrage bleibt, wo es etwas zu verlieren gibt: "Rueckgaengig"
  //  gilt nur, solange der Reiter offen ist – wer danach neu laedt, hat
  //  nichts mehr.
  function newDocument() {
    ask("confirmResetTitle", "confirmReset", "confirmResetGo", true).then(function (yes) {
      if (!yes) return;
      hideWelcome();
      replaceAll(Model.createBase(state.locale), t("newStarted"));
    });
  }

  function openTab() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* Vorschau nutzt dann den zuletzt gespeicherten Stand */
    }
    global.open("cv.html", "_blank");
  }

  function bindHeader() {
    document.getElementById("btn-theme").addEventListener("click", cycleTheme);

    document.getElementById("lang-switch").addEventListener("change", function (event) {
      if (event.target.value === state.locale) return;
      state.locale = event.target.value;
      //  Ein Schritt im Verlauf wie jede andere Aenderung: sonst nahm das
      //  naechste Rueckgaengig den Sprachwechsel stillschweigend mit zurueck.
      pushHistory();
      switchLocale(); // uebersetzt auch die Vorgabe-Ueberschriften mit
    });

    document.getElementById("btn-print").addEventListener("click", printGuide);
    document.getElementById("btn-export").addEventListener("click", function (event) {
      //  Das PDF steht auch hier, obwohl es einen eigenen Knopf hat: wer
      //  "Exportieren" sucht, sucht meistens genau das.
      popupMenu(event.currentTarget, [
        { label: t("expPdf"), hint: t("expPdfHint"), icon: "printer", action: printGuide },
        { label: t("expRickcv"), hint: t("expRickcvHint"), icon: "download", action: exportJson },
        { label: t("expJsonResume"), hint: t("expJsonResumeHint"), icon: "braces",
          action: exportJsonResume },
        { label: t("expLink"), hint: t("expLinkHint"), icon: "link", action: copyLink },
        { label: t("expCopyJson"), hint: t("expCopyJsonHint"), icon: "copy", action: copyJson },
      ]);
    });
    document.getElementById("btn-more").addEventListener("click", function (event) {
      popupMenu(event.currentTarget, [
        { label: t("reset"), hint: t("resetTitle"), icon: "file-plus", action: newDocument },
        { label: t("example"), hint: t("exampleTitle"), icon: "sparkles", action: loadExample },
        { label: t("aiMenu"), hint: t("aiMenuHint"), icon: "bot", action: openAi },
        { label: t("openTab"), hint: t("openTabTitle"), icon: "external-link", action: openTab },
      ]);
    });
    document.getElementById("btn-import").addEventListener("click", function () {
      openImport();
    });
    document.getElementById("btn-undo").addEventListener("click", undo);
    document.getElementById("btn-redo").addEventListener("click", redo);

    document.getElementById("zoom").addEventListener("change", function (event) {
      zoomMode = event.target.value;
      applyZoom();
    });
    document.getElementById("tab-edit").addEventListener("click", function () {
      showColumn(false);
    });
    document.getElementById("tab-preview").addEventListener("click", function () {
      showColumn(true);
    });
  }

  /*  Der einzige Weg, die Spalte zu wechseln.
   *
   *  Vorher setzten drei Stellen die Klasse selbst – die Reiter und die
   *  beiden Enden der Wischgeste. Was daran haengt, stand nur bei den
   *  Reitern, und deshalb sagten die Reiter nach einem Wisch das Falsche:
   *  aria-pressed blieb stehen, wo der Finger die Spalte laengst gewechselt
   *  hatte. Hier steht es einmal, und jeder Weg kommt hier vorbei.
   */
  var onColumnChange = [];

  //  Auf dem Telefon liegt die andere Spalte neben dem Bildschirm. Sie
  //  bleibt dort unerreichbar – sonst landete Tab in Feldern, die man nicht
  //  sieht, und Vorlesesoftware laese beide Spalten durcheinander.
  function narrowLayout() {
    return global.matchMedia("(max-width: 900px)").matches;
  }

  function applyInert() {
    var preview = document.body.classList.contains("show-preview");
    var narrow = narrowLayout();
    document.querySelector(".editor-pane").inert = narrow && preview;
    document.querySelector(".preview").inert = narrow && !preview;
  }

  function showColumn(preview) {
    document.body.classList.toggle("show-preview", preview);
    applyInert();

    document.getElementById("tab-edit")
      .setAttribute("aria-pressed", String(!preview));
    document.getElementById("tab-preview")
      .setAttribute("aria-pressed", String(preview));

    //  Erst jetzt hat die Vorschau eine Breite, auf die sich "Einpassen"
    //  beziehen kann.
    if (preview) applyZoom();

    onColumnChange.forEach(function (fn) { fn(preview); });
  }

  /*  Wischen zwischen Bearbeiten und Vorschau.
   *
   *  Die Schiene folgt dem Finger, statt erst beim Loslassen umzuschalten:
   *  Das zeigt waehrend der Geste, wohin sie fuehrt, und laesst sich
   *  abbrechen, indem man zurueckzieht. Beim Loslassen entscheidet, wie weit
   *  gezogen wurde – ein Drittel der Breite genuegt.
   *
   *  Senkrechtes Scrollen behaelt Vorrang: erst wenn die Bewegung deutlich
   *  waagerechter ist als senkrecht, uebernimmt die Geste.
   */
  var SWIPE_TAKEOVER = 8;     // px, ab hier entscheidet sich die Richtung
  var SWIPE_COMMIT = 0.18;    // Anteil der Bildschirmbreite zum Umschalten
  var SWIPE_FLICK = 0.45;     // px je ms – ein Schnippen genuegt auch kurz

  function bindSwipe() {
    var track = document.querySelector(".app-track");
    if (!track) return;

    var startX = 0, startY = 0, deltaX = 0, pointer = null;
    var tracking = false, sliding = false, width = 0;

    //  Fuer das Schnippen: letzter Punkt und Zeitpunkt, daraus die
    //  Geschwindigkeit am Ende der Geste.
    var lastX = 0, lastTime = 0, speed = 0;

    function narrow() {
      return global.matchMedia("(max-width: 900px)").matches;
    }

    function showing() {
      return document.body.classList.contains("show-preview");
    }

    function release() {
      if (pointer !== null && track.hasPointerCapture &&
          track.hasPointerCapture(pointer)) {
        track.releasePointerCapture(pointer);
      }
      pointer = null;
      tracking = false;
      sliding = false;
      track.classList.remove("dragging");
      track.style.transform = "";   // ab hier fuehrt wieder das Stylesheet
    }

    track.addEventListener("pointerdown", function (event) {
      if (!narrow() || event.pointerType === "mouse") return;
      tracking = true;
      sliding = false;
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      deltaX = 0;
      lastX = event.clientX;
      lastTime = event.timeStamp;
      speed = 0;
      width = track.clientWidth / 2 || global.innerWidth;
    });

    track.addEventListener("pointermove", function (event) {
      if (!tracking || event.pointerId !== pointer) return;

      deltaX = event.clientX - startX;
      var deltaY = event.clientY - startY;

      var span = event.timeStamp - lastTime;
      if (span > 0) {
        //  Gleitender Mittelwert: eine einzelne ruckartige Meldung soll die
        //  Entscheidung nicht allein tragen.
        speed = speed * 0.6 + ((event.clientX - lastX) / span) * 0.4;
        lastX = event.clientX;
        lastTime = event.timeStamp;
      }

      if (!sliding) {
        //  Erst entscheiden, wenn ueberhaupt ein Weg zurueckgelegt ist. Ein
        //  Finger zittert beim Aufsetzen; wer schon beim ersten Pixel nach
        //  Richtung fragt, verwirft fast jede Geste als senkrecht.
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_TAKEOVER) return;
        if (Math.abs(deltaX) < Math.abs(deltaY) * 1.2) { tracking = false; return; }

        sliding = true;
        //  Ab hier zaehlt der Weg, damit die Schiene nicht springt.
        startX = event.clientX;
        deltaX = 0;
        track.classList.add("dragging");
        if (track.setPointerCapture) track.setPointerCapture(pointer);
      }

      //  Am jeweiligen Ende gibt die Schiene nur gedaempft nach, damit
      //  spuerbar ist, dass dahinter nichts mehr kommt.
      var shown = deltaX;
      if ((!showing() && shown > 0) || (showing() && shown < 0)) shown /= 4;

      var base = showing() ? -50 : 0;
      track.style.transform = "translateX(" + (base + (shown / width) * 50) + "%)";
    });

    ["pointerup", "pointercancel"].forEach(function (type) {
      track.addEventListener(type, function (event) {
        if (!tracking || (pointer !== null && event.pointerId !== pointer)) return;
        //  Zwei Wege zum Umschalten: weit genug gezogen oder schnell genug
        //  geschnippt. Ohne den zweiten fuehlt sich die Geste zaeh an, weil
        //  ein kurzer, schneller Wisch folgenlos bliebe.
        var far = Math.abs(deltaX) > width * SWIPE_COMMIT ||
          (Math.abs(speed) > SWIPE_FLICK && deltaX * speed > 0);

        if (sliding && far && type === "pointerup") {
          if (deltaX < 0 && !showing()) {
            showColumn(true);
          } else if (deltaX > 0 && showing()) {
            showColumn(false);
          }
        }
        release();
      });
    });
  }

  /*  Kopfzeile, Reiter und Vorschauleiste weichen beim Scrollen.
   *
   *  Zusammen belegen sie auf einem Telefon rund ein Drittel der Hoehe. Wer
   *  liest, scrollt abwaerts – dann duerfen sie weg. Wer zurueckwill,
   *  scrollt aufwaerts – dann sind sie sofort wieder da, ohne dass man erst
   *  ganz nach oben muss.
   *
   *  Die Bewegung wird aufaddiert, statt jede einzelne Meldung zu bewerten:
   *  Scrollen meldet sich in vielen kleinen Schritten, ein einzelner davon
   *  sagt ueber die Richtung wenig.
   */
  var CHROME_HIDE = 24;     // px abwaerts, bevor die Leisten weichen
  var CHROME_REVEAL = 10;   // px aufwaerts, und sie sind wieder da
  var CHROME_TOP = 24;      // so weit oben bleiben sie ohnehin stehen

  function bindChromeAutoHide() {
    var root = document.documentElement;
    var header = document.querySelector(".app-header");
    var tabs = document.querySelector(".mobile-tabs");
    var bar = document.getElementById("preview-bar");

    //  Beide Spalten scrollen, aber nur die sichtbare darf mitreden: die
    //  andere bewegt sich beim Umschalten und beim Neuzeichnen mit, und das
    //  ist keine Handbewegung.
    var lanes = [
      { pane: document.querySelector(".editor-pane"), preview: false, last: 0 },
      { pane: document.getElementById("preview-scroll"), preview: true, last: 0 }
    ];
    var carry = 0;

    function narrow() {
      return global.matchMedia("(max-width: 900px)").matches;
    }

    function show() {
      carry = 0;
      document.body.classList.remove("chrome-away");
    }

    /*  Wieviel Platz die Leisten verdecken. Das aendert sich, wenn die
     *  Kopfzeile anders umbricht oder der Status umlaeuft – nicht aber beim
     *  Verstecken, denn das ist eine reine Verschiebung. Genau deshalb darf
     *  hier ueberhaupt gemessen werden, ohne dass Messen und Verstecken sich
     *  gegenseitig aufschaukeln.
     */
    function measure() {
      if (!narrow()) {
        root.style.removeProperty("--chrome-h");
        root.style.removeProperty("--bar-h");
        return;
      }
      var chromeH = (header ? header.offsetHeight : 0) +
                    (tabs ? tabs.offsetHeight : 0);
      root.style.setProperty("--chrome-h", chromeH + "px");
      root.style.setProperty("--bar-h", (bar ? bar.offsetHeight : 0) + "px");
    }

    //  Nach einem Sprung im Inhalt – Spalte gewechselt, Abschnitt auf- oder
    //  zugeklappt – faengt die Richtungsmessung von vorn an. Sonst ergaebe
    //  der alte Stand beim naechsten Ereignis einen Riesenschritt in
    //  irgendeine Richtung.
    function resync() {
      lanes.forEach(function (lane) {
        lane.last = lane.pane ? Math.max(0, lane.pane.scrollTop) : 0;
      });
      carry = 0;
    }

    lanes.forEach(function (lane) {
      if (!lane.pane) return;

      lane.pane.addEventListener("scroll", function () {
        if (!narrow()) return;

        if (lane.preview !== document.body.classList.contains("show-preview")) {
          lane.last = Math.max(0, lane.pane.scrollTop);
          return;
        }

        //  Gummiband: iOS meldet oberhalb des Anfangs negative Werte, die
        //  beim Zurueckschnappen einen Abwaertsschritt vortaeuschen wuerden.
        var top = Math.max(0, lane.pane.scrollTop);
        var step = top - lane.last;
        lane.last = top;

        if (top <= CHROME_TOP) { show(); return; }

        //  Meldungen ohne Weg kommen haeufig – am Ende eines Schwungs, beim
        //  Abfangen des Gummibands. Sie sagen nichts ueber die Richtung und
        //  wuerden unten als Wechsel gelesen.
        if (step === 0) return;

        //  Richtungswechsel setzt den Zaehler zurueck, sonst muesste man
        //  erst den ganzen bisherigen Weg wieder aufholen.
        if ((step > 0) !== (carry > 0)) carry = 0;
        carry += step;

        if (carry > CHROME_HIDE) {
          document.body.classList.add("chrome-away");
        } else if (carry < -CHROME_REVEAL) {
          show();
        }
      }, { passive: true });
    });

    //  Beim Umschalten der Spalte sollen die Leisten sichtbar sein – egal ob
    //  ueber die Reiter oder per Wisch.
    onColumnChange.push(function () { show(); resync(); });

    //  Sprache, Erscheinungsbild und Drehung aendern den Umbruch der
    //  Kopfzeile und damit das Polster. Der Beobachter faengt das ab, ohne
    //  dass jede Stelle daran denken muss.
    if (global.ResizeObserver) {
      var watcher = new global.ResizeObserver(function () { measure(); });
      [header, tabs, bar].forEach(function (el) { if (el) watcher.observe(el); });
    }

    global.addEventListener("resize", debounce(function () {
      measure();
      if (!narrow()) show();
    }, 150));

    measure();
  }

  //  Der Teiler zwischen Formular und Vorschau: mit der Maus zu ziehen, mit
  //  den Pfeiltasten zu schieben.
  function setSidebarWidth(width) {
    var clamped = Math.round(Math.max(320, Math.min(global.innerWidth * 0.7, width)));
    document.documentElement.style.setProperty("--ui-sidebar-w", clamped + "px");
    var resizer = document.getElementById("resizer");
    resizer.setAttribute("aria-valuenow", String(clamped));
    resizer.setAttribute("aria-valuemax", String(Math.round(global.innerWidth * 0.7)));
    applyZoom();
  }

  function bindResizer() {
    var resizer = document.getElementById("resizer");
    var resizing = false;

    resizer.setAttribute("role", "separator");
    resizer.setAttribute("aria-orientation", "vertical");
    resizer.setAttribute("aria-controls", "editor");
    resizer.setAttribute("aria-valuemin", "320");
    resizer.tabIndex = 0;
    resizer.addEventListener("keydown", function (event) {
      var width = document.querySelector(".editor-pane").getBoundingClientRect().width;
      var step = event.shiftKey ? 80 : 20;
      if (event.key === "ArrowLeft") width -= step;
      else if (event.key === "ArrowRight") width += step;
      else if (event.key === "Home") width = 320;
      else if (event.key === "End") width = global.innerWidth * 0.7;
      else return;
      event.preventDefault();
      setSidebarWidth(width);
    });

    resizer.addEventListener("pointerdown", function (event) {
      resizing = true;
      resizer.setPointerCapture(event.pointerId);
    });
    resizer.addEventListener("pointermove", function (event) {
      if (!resizing) return;
      setSidebarWidth(event.clientX);
    });
    ["pointerup", "pointercancel"].forEach(function (type) {
      resizer.addEventListener(type, function () { resizing = false; });
    });
  }

  //  Nur wo Text steht, hat der Browser ein eigenes Rueckgaengig. In einem
  //  Schalter, Regler oder Auswahlfeld hat er keines – dort gilt der Verlauf
  //  des Baukastens.
  var TEXT_INPUTS = ["text", "search", "email", "url", "tel", "number", "password"];

  function editsText(target) {
    var tag = (target.tagName || "").toLowerCase();
    if (tag === "textarea" || target.isContentEditable) return true;
    return tag === "input" && TEXT_INPUTS.indexOf((target.type || "text").toLowerCase()) !== -1;
  }

  function bindKeys() {
    document.addEventListener("keydown", function (event) {
      var meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      var key = event.key.toLowerCase();
      var tag = (event.target.tagName || "").toLowerCase();

      if (key === "z" && !event.shiftKey) {
        if (editsText(event.target)) return; // dort gilt Browser-Undo
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        if (editsText(event.target)) return;
        event.preventDefault();
        redo();
      } else if (key === "p") {
        event.preventDefault();
        printGuide();
      } else if (key === "s") {
        event.preventDefault();
        exportJson();
      }
    });
  }

  function init() {
    state = load();
    frame = document.getElementById("preview-frame");
    committedLocale = state.locale;
    steps = global.RickCVHistory.create({ read: snapshot, onChange: showUndo });

    Fields.configure({
      state: state,
      onChange: changed,
      t: function (key) { return t(key); },
      commit: function () { steps.settle(); },
      notify: function (message) { toast(message, { label: t("undo"), run: undo }); },
    });

    global.addEventListener("message", function (event) {
      if (!fromFrame(event)) return;
      var message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "rickcv:ready") {
        markFrameReady();
      } else if (message.type === "rickcv:height") {
        previewHeight = Math.max(600, message.height);
        showPageCount(message.pages || Math.max(1, Math.round(message.height / PAGE_HEIGHT)));
        showLetterLength(message.letterPages || 0);
        applyZoom();
        paintedSeq = Math.max(paintedSeq, Number(message.seq) || 0);
        letterTop = Number(message.letterTop) || 0;
        afterPaint = afterPaint.filter(function (entry) {
          if (entry.seq > paintedSeq) return true;
          entry.run();
          return false;
        });
      } else if (message.type === "rickcv:error") {
        status(t("previewError") + " " + message.message);
      } else if (message.type === "rickcv:dragging") {
        //  Die Vorschau liegt in einem eigenen Rahmen; was dort gezogen
        //  wird, sieht dieses Fenster nicht von selbst.
        showDropHint();
      } else if (message.type === "rickcv:dragend") {
        hideDropHint();
      } else if (message.type === "rickcv:file") {
        hideDropHint();
        takeFile(message.file);
      } else if (message.type === "rickcv:edit") {
        revealPath(message.path);
      }
    });

    paintIcons();
    watchFrame();
    applyLocale();
    buildEditor();
    bindTabKeys();
    bindHeader();
    bindResizer();
    bindSwipe();
    bindChromeAutoHide();
    bindWideLayout();
    bindFileDrop();
    bindKeys();
    //  Kommt jemand ueber einen Link mit Daten, sagt der Import-Dialog
    //  schon, was passiert – die Karte stuende nur daneben.
    if (firstVisit && !/[#&](z|data)=/.test(global.location.hash || "")) showWelcome();
    //  Die Statuszeile stand bis zur ersten Aenderung fest auf "Bereit" – auf
    //  Deutsch, auch in der englischen Oberflaeche.
    status(firstVisit ? t("ready") : t("saved"));
    readHash();
    global.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushSave();
    });
    global.addEventListener("resize", debounce(function () {
      applyZoom();
      applyInert();
    }, 100));
    applyZoom();
    applyInert();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
