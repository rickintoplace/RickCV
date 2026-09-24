/*  preview.js – Das Dokument in cv.html.
 *
 *  Laeuft im Vorschaurahmen des Builders und wird per postMessage befuellt.
 *  Direkt geoeffnet zeigt es den zuletzt gespeicherten Stand.
 *
 *  Frueher stand das hier als Skript in cv.html selbst. Als eigene Datei
 *  kann die Seite eine Content-Security-Policy tragen, die nur Skripte von
 *  der eigenen Adresse zulaesst – ein eingeschleustes Skript liefe dann
 *  nicht, selbst wenn es ins Dokument gelangte.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "rickcv.data.v3";
  var LEGACY_KEY = "rickcv.data.v2";

  var framed = window.parent !== window;

  //  Wohin Nachrichten gehen duerfen: nur an die eigene Adresse. Per
  //  Doppelklick geoeffnet (file://) hat die Seite keinen Ursprung, den
  //  man nennen koennte – dann bleibt nur "*".
  var ORIGIN = window.location.origin && window.location.origin !== "null"
    ? window.location.origin : "*";

  function tell(message) {
    if (framed) window.parent.postMessage(message, ORIGIN);
  }

  //  Nur der Baukasten darf dieses Dokument befuellen, und nur als der
  //  Rahmen, in dem es steckt. Eine fremde Seite, die cv.html in einem
  //  Fenster oeffnet oder selbst einrahmt, soll hier weder Daten
  //  hineinschreiben noch den Druck ausloesen koennen.
  function trusted(event) {
    if (!framed || event.source !== window.parent) return false;
    return ORIGIN === "*" || event.origin === ORIGIN;
  }

  //  Der Seitenumbruch des Anschreibens wird gemessen, und Messen setzt
  //  die endgueltige Schrift voraus: laedt sie erst spaeter nach,
  //  stimmen Zeilenumbruch und Seitengrenze nicht mehr. Deshalb merkt
  //  sich die Seite ihren letzten Stand und zeichnet ihn neu, sobald
  //  die Schriften stehen.
  var lastData = null;

  //  Welcher Stand zuletzt gezeichnet wurde. Der Baukasten wartet damit
  //  vor dem Drucken auf genau den Stand, den er geschickt hat.
  var lastSeq = 0;

  function paint(data) {
    lastData = data;
    try {
      RickCVRender.render(document, data);
    } catch (error) {
      console.error("RickCV Render-Fehler:", error);
      tell({ type: "rickcv:error", message: String(error && error.message) });
    }
  }

  //  Die Seitenzahl wird aus der tatsaechlichen Hoehe der Bloecke
  //  berechnet – der Builder zeigt sie neben dem Zoom an.
  function countPages() {
    var perPage = RickCVRender.pageHeightPx(lastData || {});
    var pages = 0;
    document.querySelectorAll(
      ".resume_wrapper, .cover-letter_wrapper, .ats-appendix_wrapper"
    ).forEach(function (block) {
      pages += Math.max(1, Math.ceil(block.offsetHeight / perPage - 0.02));
    });
    return pages || 1;
  }

  //  Hoehe und Seitenzahl erzwingen ein Layout. Das kostet, also wird
  //  bei mehreren Renderdurchgaengen kurz hintereinander nur einmal
  //  gemessen – gezeichnet wird trotzdem sofort.
  var reportQueued = false;
  function scheduleReport() {
    if (reportQueued) return;
    reportQueued = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        reportQueued = false;
        report();
      });
    });
  }

  function report() {
    tell({
      type: "rickcv:height",
      height: document.documentElement.scrollHeight,
      pages: countPages(),
      letterPages: RickCVRender.letterPages(),
      //  Wo das Anschreiben beginnt: der Baukasten rollt dorthin, sobald
      //  jemand den Reiter "Anschreiben" oeffnet.
      letterTop: (function () {
        var letter = document.querySelector(".cover-letter");
        return letter ? Math.round(letter.getBoundingClientRect().top + window.scrollY) : 0;
      })(),
      seq: lastSeq,
    });
  }

  //  Eine Datei, die jemand auf die Vorschau zieht, gehoert dem
  //  Baukasten und nicht diesem Rahmen: Chrome wuerde sie sonst
  //  einfach anzeigen und die Vorschau waere weg. Gemeldet wird auch
  //  das Ziehen selbst – das Fenster darueber zeigt daraufhin an,
  //  dass es die Datei nimmt.
  if (framed) {
    ["dragenter", "dragover"].forEach(function (name) {
      document.addEventListener(name, function (event) {
        if (!event.dataTransfer) return;
        event.preventDefault();
        tell({ type: "rickcv:dragging" });
      });
    });

    document.addEventListener("dragleave", function (event) {
      if (event.relatedTarget) return;
      tell({ type: "rickcv:dragend" });
    });

    document.addEventListener("drop", function (event) {
      event.preventDefault();
      var file = event.dataTransfer && event.dataTransfer.files[0];
      tell({ type: "rickcv:file", file: file || null });
    });
  }

  /*  Aus der Vorschau in den Editor.
   *
   *  Wer mit der Maus ueber einen Eintrag faehrt – eine Station, eine
   *  Kenntnis, einen Absatz –, sieht ihn dezent umrandet und an seiner Ecke
   *  einen kleinen Knopf "Bearbeiten". Nur dieser Knopf fuehrt in den
   *  Editor; ein Klick in den Text tut, was er immer tut. Solange eine
   *  Maustaste gedrueckt ist, bleibt der Knopf weg: wer markiert, um zu
   *  kopieren, soll nicht versehentlich woanders landen.
   *
   *  Nur mit einer Maus (hover und feiner Zeiger). Auf dem Telefon gehoert
   *  die Vorschau dem Wischen, und einen Hover gibt es dort nicht.
   */
  var editor = { frame: null, button: null, target: null, pressed: false };

  function editLabel() {
    var locale = lastData && lastData.locale === "en" ? "en" : "de";
    return RickCVI18n.t("ui", "editHere", locale);
  }

  function buildEditHint() {
    editor.frame = document.createElement("div");
    editor.frame.className = "rickcv-edit-frame";
    editor.button = document.createElement("button");
    editor.button.type = "button";
    editor.button.className = "rickcv-edit-button";
    editor.button.addEventListener("click", function (event) {
      event.preventDefault();
      if (!editor.target) return;
      tell({ type: "rickcv:edit", path: editor.target.getAttribute("data-edit") });
      hideEditHint();
    });
    document.body.appendChild(editor.frame);
    document.body.appendChild(editor.button);
    hideEditHint();
  }

  function hideEditHint() {
    editor.target = null;
    if (!editor.frame) return;
    editor.frame.hidden = true;
    editor.button.hidden = true;
  }

  //  Der Kasten um das, was man sieht. Das Element selbst ist oft schmaler
  //  oder breiter: bei den Stationen im Theme Clean ragen Titel und Datum
  //  ueber den Kasten der Station hinaus, und die Umrandung sass versetzt.
  //  Gezaehlt werden Text und Bilder; die Linie der Zeitleiste nicht, die
  //  reicht bis zur naechsten Station.
  function visibleBox(node) {
    var box = null;
    function add(rect) {
      if (!rect.width && !rect.height) return;
      if (!box) { box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }; return; }
      box.left = Math.min(box.left, rect.left);
      box.top = Math.min(box.top, rect.top);
      box.right = Math.max(box.right, rect.right);
      box.bottom = Math.max(box.bottom, rect.bottom);
    }
    var range = document.createRange();
    (function visit(current) {
      Array.prototype.forEach.call(current.childNodes, function (child) {
        if (child.nodeType === 3) {
          if (!child.nodeValue.trim()) return;
          range.selectNodeContents(child);
          add(range.getBoundingClientRect());
        } else if (child.nodeType === 1) {
          if (child.classList.contains("line")) return;
          if (/^(IMG|svg)$/i.test(child.tagName)) add(child.getBoundingClientRect());
          else visit(child);
        }
      });
    })(node);
    if (!box) {
      var own = node.getBoundingClientRect();
      box = { left: own.left, top: own.top, right: own.right, bottom: own.bottom };
    }
    box.width = box.right - box.left;
    box.height = box.bottom - box.top;
    return box;
  }

  function showEditHint(target) {
    if (!editor.frame) buildEditHint();
    editor.target = target;
    var rect = visibleBox(target);
    var left = rect.left + window.scrollX;
    var top = rect.top + window.scrollY;

    editor.frame.style.left = (left - 4) + "px";
    editor.frame.style.top = (top - 3) + "px";
    editor.frame.style.width = (rect.width + 8) + "px";
    editor.frame.style.height = (rect.height + 6) + "px";
    editor.frame.hidden = false;

    editor.button.textContent = "✎ " + editLabel();
    editor.button.hidden = false;
    //  Rechts oben an der Umrandung, aber nie ueber den Rand der Seite.
    var width = editor.button.offsetWidth;
    var x = Math.min(left + rect.width + 4 - width, document.documentElement.scrollWidth - width - 4);
    editor.button.style.left = Math.max(4, x) + "px";
    editor.button.style.top = Math.max(0, top - 3 - editor.button.offsetHeight) + "px";
  }

  if (framed && window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    //  Auf dem Weg von einem Eintrag zu seinem Knopf liegt ein Streifen, der
    //  zu keinem Eintrag gehoert. Solange der Zeiger in der Umrandung oder
    //  auf dem Knopf ist, bleibt beides stehen – sonst verschwaende der
    //  Knopf, kurz bevor man ihn erreicht.
    function inside(node, event) {
      if (!node || node.hidden) return false;
      var rect = node.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right &&
             event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    //  Wer von einem Eintrag schraeg zu dessen Knopf faehrt, streift oft den
    //  Eintrag daneben – meist die Ueberschrift darueber. Sofort umzuspringen
    //  hiesse: der Knopf laeuft davon, kurz bevor man ihn erreicht. Also
    //  wechselt die Umrandung erst, wenn der Zeiger eine Weile auf dem neuen
    //  Eintrag bleibt; wer vorher den Knopf erreicht, behaelt ihn.
    var SWITCH_DELAY = 250;
    var pendingSwitch = null;

    function cancelSwitch() {
      clearTimeout(pendingSwitch);
      pendingSwitch = null;
    }

    document.addEventListener("mousemove", function (event) {
      if (editor.pressed) return;
      if (editor.button && event.target === editor.button) return cancelSwitch();
      var target = event.target.closest && event.target.closest("[data-edit]");
      if (target === editor.target) return cancelSwitch();

      //  Ein tiefer liegender Eintrag im umrandeten gewinnt sofort – das
      //  ist kein Weg zum Knopf, sondern ein genaueres Zeigen.
      var deeper = target && editor.target && editor.target.contains(target);
      if (deeper || !editor.target) {
        cancelSwitch();
        return target ? showEditHint(target) : hideEditHint();
      }
      if (inside(editor.frame, event) || inside(editor.button, event)) return cancelSwitch();

      cancelSwitch();
      pendingSwitch = setTimeout(function () {
        pendingSwitch = null;
        if (target && target.isConnected) showEditHint(target);
        else hideEditHint();
      }, SWITCH_DELAY);
    });
    document.addEventListener("mousedown", function (event) {
      if (editor.button && event.target === editor.button) return;
      editor.pressed = true;
      cancelSwitch();
      hideEditHint();
    });
    document.addEventListener("mouseup", function () { editor.pressed = false; });
    document.addEventListener("mouseleave", hideEditHint);
  }

  window.addEventListener("message", function (event) {
    if (!trusted(event)) return;
    var message = event.data;
    if (!message || typeof message !== "object") return;

    if (message.type === "rickcv:data") {
      lastSeq = Number(message.seq) || 0;
      //  Neu gezeichnet heisst: der umrandete Knoten ist nicht mehr da.
      hideEditHint();
      paint(message.data);
      scheduleReport();
    } else if (message.type === "rickcv:print") {
      window.focus();
      window.print();
    }
  });

  // Direktaufruf: gespeicherten Stand oder Beispiel zeigen.
  var initial = null;
  try {
    var stored =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (stored) initial = RickCVModel.migrate(JSON.parse(stored));
  } catch (error) {
    /* kein Speicher verfuegbar – dann eben das Beispiel */
  }
  paint(initial || RickCVModel.createExample("de"));

  window.addEventListener("load", report);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (lastData) paint(lastData);
      scheduleReport();
    });
  }

  /*  Allein geoeffnet – ohne Baukasten drumherum – passt sich das
   *  Blatt der Fensterbreite an, indem es verkleinert wird. Es wird
   *  nicht umgebaut: sonst saehe man etwas anderes als im PDF, und
   *  die Seitenaufteilung faende andere Umbrueche als der Drucker.
   */
  var currentScale = 1;

  function fitToWindow() {
    if (framed) return; // im Vorschaurahmen skaliert der Baukasten
    var sheet = document.querySelector(".resume_wrapper, .cover-letter_wrapper");
    if (!sheet) return;

    var width = sheet.getBoundingClientRect().width / (currentScale || 1);
    var room = document.documentElement.clientWidth - 16;
    currentScale = Math.min(1, room / width);

    var host = document.querySelector(".document");
    host.style.transformOrigin = "top center";
    host.style.transform = currentScale < 1 ? "scale(" + currentScale + ")" : "";
    //  Der verkleinerte Inhalt beansprucht sonst weiter die volle
    //  Hoehe und haengt unten ins Leere.
    host.style.height = currentScale < 1
      ? host.scrollHeight * currentScale + "px" : "";
  }

  window.addEventListener("resize", fitToWindow);
  window.addEventListener("load", fitToWindow);
  setTimeout(fitToWindow, 0);

  tell({ type: "rickcv:ready" });
})();
