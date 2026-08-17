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

  var Model = global.RickCVModel;
  var Fields = global.RickCVFields;
  var I18n = global.RickCVI18n;

  var state = null;
  var sections = [];
  var t = I18n.ui("de");
  var committedLocale = "de";

  var frame = null;
  var frameReady = false;

  var history = [];
  var historyTimer = null;
  var pendingSnapshot = null;
  var committed = "";

  /* ---------------------------------------------------------------- Helfer */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
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
  function toast(message) {
    var node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove("visible"); }, 2600);
  }
  global.RickCVToast = toast;

  /* ------------------------------------------------------- Laden/Speichern */

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
    }
    return Model.createExample("de");
  }

  var save = debounce(function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      status(t("saved"));
    } catch (error) {
      status(t("storageFull")); // meist ein zu grosses Profilbild
    }
  }, 500);

  /* ---------------------------------------------------------------- Verlauf */

  //  Der Stand VOR einer Aenderungsserie wird gesichert und erst abgelegt,
  //  wenn 600 ms nichts mehr passiert – so wird aus einem getippten Wort ein
  //  einziger Undo-Schritt.
  function pushHistory() {
    if (pendingSnapshot === null) pendingSnapshot = committed;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(function () {
      var current = JSON.stringify(state);
      if (pendingSnapshot !== null && pendingSnapshot !== current) {
        history.push(pendingSnapshot);
        if (history.length > 40) history.shift();
      }
      pendingSnapshot = null;
      committed = current;
    }, 600);
  }

  function undo() {
    if (!history.length) return toast(t("nothingToUndo"));
    clearTimeout(historyTimer);
    pendingSnapshot = null;
    replaceState(JSON.parse(history.pop()));
    toast(t("undone"));
  }

  function replaceState(next) {
    state = next;
    committed = JSON.stringify(state);
    committedLocale = state.locale;
    Fields.setState(state);
    applyLocale();
    buildEditor();
    sendToPreview();
    save();
  }

  /* -------------------------------------------------------------- Vorschau */

  //  Die Vorschau folgt dem Tippen frameweise statt auf einem Timer: pro
  //  Bildwiederholung geht hoechstens eine Nachricht raus. Das ist so
  //  unmittelbar wie moeglich und laesst trotzdem nichts auflaufen, wenn
  //  jemand schnell schreibt oder einen Regler zieht.
  var previewQueued = false;

  function sendToPreview() {
    if (previewQueued) return;
    previewQueued = true;
    global.requestAnimationFrame(function () {
      previewQueued = false;
      if (!frameReady || !frame.contentWindow) return;
      frame.contentWindow.postMessage({ type: "rickcv:data", data: state }, "*");
    });
  }

  function changed(structural) {
    pushHistory();
    sendToPreview();
    save();
    status(t("saving"));
    if (structural) updateCounts();
  }

  /* -------------------------------------------------------------- Sprache */

  function applyLocale() {
    var locale = state.locale || "de";
    t = I18n.ui(locale);
    document.documentElement.lang = locale;
    global.RickCVIconPicker.setTranslator(t);

    var texts = {
      "brand-tagline": "tagline",
      "btn-example": "example",
      "btn-reset": "reset",
      "btn-import": "import",
      "btn-export": "export",
      "btn-open": "openTab",
      "btn-print": "print",
      "zoom-label": "zoom",
      "tab-edit": "tabEdit",
      "tab-preview": "tabPreview",
    };
    Object.keys(texts).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.textContent = t(texts[id]);
    });

    var titles = {
      "btn-example": "exampleTitle",
      "btn-reset": "resetTitle",
      "btn-import": "importTitle",
      "btn-export": "exportTitle",
      "btn-open": "openTabTitle",
      "resizer": "dragWidth",
    };
    Object.keys(titles).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.title = t(titles[id]);
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
      onLocaleChange: switchLocale,
    };
  }

  //  Beim Sprachwechsel werden Vorgabe-Ueberschriften mitgezogen, sofern der
  //  Nutzer sie nicht selbst geaendert hat. Eigene Formulierungen bleiben.
  function switchLocale() {
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
  }

  function updateCounts() {
    sections.forEach(function (section) {
      if (!section.count) return;
      var badge = document.querySelector('[data-section="' + section.id + '"] .section-count');
      if (badge) badge.textContent = section.count();
    });
  }

  function buildEditor() {
    var editor = document.getElementById("editor");

    // Aufklappzustand ueber den Neuaufbau retten
    var openState = {};
    editor.querySelectorAll(".section").forEach(function (node) {
      openState[node.dataset.section] = node.open;
    });

    sections = global.RickCVSections.build(sectionContext());
    editor.innerHTML = "";

    sections.forEach(function (section) {
      var details = el("details", "section");
      details.dataset.section = section.id;
      details.open = openState[section.id] !== undefined ? openState[section.id] : !!section.open;

      var summary = el("summary");
      summary.appendChild(el("span", null, section.title));
      if (section.count) {
        summary.appendChild(el("span", "section-count", String(section.count())));
      }
      details.appendChild(summary);

      var body = el("div", "section-body");
      // Inhalte erst bauen, wenn der Abschnitt zum ersten Mal aufgeht:
      // das haelt den Start schnell, auch bei vielen Eintraegen.
      if (details.open) {
        section.build(body);
        body.dataset.built = "1";
      }
      details.addEventListener("toggle", function () {
        if (details.open && !body.dataset.built) {
          section.build(body);
          body.dataset.built = "1";
        }
      });
      details.appendChild(body);
      editor.appendChild(details);
    });
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

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var migrated = Model.migrate(JSON.parse(String(reader.result)));
        if (!migrated) throw new Error("kein gültiges Dokument");
        history.push(committed);
        replaceState(migrated);
        toast(t("imported"));
      } catch (error) {
        toast(t("importFailed"));
      }
    };
    reader.readAsText(file);
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

  function printCv() {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "rickcv:print" }, "*");
    toast(isChromium() ? t("printHint") : t("printHint") + " " + t("printHintChrome"));
  }

  /* ---------------------------------------------------- Zoom & Seitenzahl */

  var previewHeight = 1200;
  var previewPages = 1;
  var zoomMode = "fit";
  var PAGE_HEIGHT = 1123; // 29,7 cm bei 96 dpi

  function applyZoom() {
    var scroll = document.getElementById("preview-scroll");
    var canvas = document.getElementById("preview-canvas");
    var stage = document.getElementById("preview-stage");

    var available = scroll.clientWidth - 32;
    var scale = zoomMode === "fit" ? Math.min(1, available / 820) : Number(zoomMode);

    stage.style.transform = "scale(" + scale + ")";
    canvas.style.width = 820 * scale + "px";
    canvas.style.height = previewHeight * scale + "px";
    frame.style.height = previewHeight + "px";
  }

  function showPageCount(count) {
    var node = document.getElementById("page-count");
    if (!node) return;
    previewPages = count;
    node.textContent = count + " " + (count === 1 ? t("page") : t("pages"));
  }

  /* ---------------------------------------------------------------- Start */

  function bindHeader() {
    document.getElementById("btn-print").addEventListener("click", printCv);
    document.getElementById("btn-export").addEventListener("click", exportJson);
    document.getElementById("btn-import").addEventListener("click", function () {
      document.getElementById("import-file").click();
    });
    document.getElementById("import-file").addEventListener("change", function (event) {
      if (event.target.files[0]) importJson(event.target.files[0]);
      event.target.value = "";
    });
    document.getElementById("btn-example").addEventListener("click", function () {
      history.push(committed);
      replaceState(Model.createExample(state.locale));
      toast(t("exampleLoaded"));
    });
    document.getElementById("btn-reset").addEventListener("click", function () {
      if (!global.confirm(t("confirmReset"))) return;
      history.push(committed);
      replaceState(Model.createBase(state.locale));
      toast(t("newStarted"));
    });
    document.getElementById("btn-open").addEventListener("click", function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        /* Vorschau nutzt dann den zuletzt gespeicherten Stand */
      }
      global.open("cv.html", "_blank");
    });

    document.getElementById("zoom").addEventListener("change", function (event) {
      zoomMode = event.target.value;
      applyZoom();
    });
    document.getElementById("tab-edit").addEventListener("click", function () {
      document.body.classList.remove("show-preview");
    });
    document.getElementById("tab-preview").addEventListener("click", function () {
      document.body.classList.add("show-preview");
    });
  }

  function bindResizer() {
    var resizer = document.getElementById("resizer");
    var resizing = false;

    resizer.addEventListener("pointerdown", function (event) {
      resizing = true;
      resizer.setPointerCapture(event.pointerId);
    });
    resizer.addEventListener("pointermove", function (event) {
      if (!resizing) return;
      var width = Math.max(320, Math.min(global.innerWidth * 0.7, event.clientX));
      document.documentElement.style.setProperty("--ui-sidebar-w", width + "px");
      applyZoom();
    });
    ["pointerup", "pointercancel"].forEach(function (type) {
      resizer.addEventListener(type, function () { resizing = false; });
    });
  }

  function bindKeys() {
    document.addEventListener("keydown", function (event) {
      var meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      var key = event.key.toLowerCase();
      var tag = (event.target.tagName || "").toLowerCase();

      if (key === "z" && !event.shiftKey) {
        if (tag === "input" || tag === "textarea") return; // dort gilt Browser-Undo
        event.preventDefault();
        undo();
      } else if (key === "p") {
        event.preventDefault();
        printCv();
      } else if (key === "s") {
        event.preventDefault();
        exportJson();
      }
    });
  }

  function init() {
    state = load();
    frame = document.getElementById("preview-frame");
    committed = JSON.stringify(state);
    committedLocale = state.locale;

    Fields.configure({
      state: state,
      onChange: changed,
      t: function (key) { return t(key); },
    });

    global.addEventListener("message", function (event) {
      var message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "rickcv:ready") {
        frameReady = true;
        frame.contentWindow.postMessage({ type: "rickcv:data", data: state }, "*");
      } else if (message.type === "rickcv:height") {
        previewHeight = Math.max(600, message.height);
        showPageCount(message.pages || Math.max(1, Math.round(message.height / PAGE_HEIGHT)));
        applyZoom();
        status(t("saved"));
      } else if (message.type === "rickcv:error") {
        status("Fehler: " + message.message);
      }
    });

    applyLocale();
    buildEditor();
    bindHeader();
    bindResizer();
    bindKeys();
    global.addEventListener("resize", debounce(applyZoom, 100));
    applyZoom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
