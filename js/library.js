/*  library.js – Mehrere Dokumente, fruehere Staende, Sicherung vor dem
 *  Ersetzen.
 *
 *  Der Baukasten arbeitet weiter an genau einem Dokument, dem aktiven. Es
 *  steht wie bisher in localStorage (builder.js); hier bekommt es eine
 *  Kennung und eine Kopie in IndexedDB (js/store.js), und neben ihm koennen
 *  weitere liegen.
 *
 *  Drei Dinge passieren ohne Zutun:
 *
 *    - Bevor ein Import, das Beispiel oder eine wiederhergestellte Version
 *      den Stand ersetzt, wird er als Version gesichert. "Rueckgaengig" gilt
 *      nur, solange der Tab offen ist – die Sicherung bleibt.
 *    - Beim Start und dann hoechstens alle 15 Minuten, in denen gearbeitet
 *      wird, entsteht eine automatische Version.
 *    - Was im Papierkorb liegt, verschwindet nach 30 Tagen.
 *
 *  Wer nur einen Lebenslauf schreibt, merkt davon nichts, bis er etwas
 *  zurueckhaben will.
 */
(function (global) {
  "use strict";

  var Store = global.RickCVStore;
  var DOC_KEY = "rickcv.doc.active";
  var AUTO_EVERY = 15 * 60 * 1000;

  var api = null;
  var docId = null;
  var createdAt = Date.now();
  var docName = "";
  var ready = false;
  var lastAuto = 0;
  var lastAutoData = "";
  var syncTimer = null;

  function t(key) { return api.t(key); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, run) {
    var node = el("button", "btn" + (className ? " " + className : ""), label);
    node.type = "button";
    node.addEventListener("click", run);
    return node;
  }

  function readKey() {
    try { return localStorage.getItem(DOC_KEY); } catch (error) { return null; }
  }

  function writeKey(id) {
    try { localStorage.setItem(DOC_KEY, id); } catch (error) { /* dann nur fuer diesen Tab */ }
  }

  //  Wie ein Dokument in der Liste heisst: der vergebene Name, sonst Name
  //  der Person und – fuer die Kopie je Stelle – der Empfaenger des
  //  Anschreibens.
  function autoTitle(state) {
    var name = String((state.contact && state.contact.name) || "").trim();
    var letter = state.settings && state.settings.showCoverLetter && state.coverLetter;
    var to = letter ? String(letter.recipient || "").split("\n")[0].trim() : "";
    //  Ohne Anschreiben sagt die Stellenanzeige, wofuer die Kopie ist.
    if (!to && state.job && state.job.ad && global.RickCVJobMatch) to = global.RickCVJobMatch.titleOf(state.job.ad);
    return [name, to].filter(Boolean).join(" · ") || t("libUntitled");
  }

  function titleOf(record) {
    if (record.name) return record.name;
    try { return autoTitle(JSON.parse(record.data)); } catch (error) { return t("libUntitled"); }
  }

  function when(at) {
    var date = new Date(at);
    var locale = api.locale() === "en" ? "en-GB" : "de-DE";
    return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) +
      ", " + date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  /* ------------------------------------------------------------------ Start */

  function init(handles) {
    api = handles;
    docId = readKey();
    if (!docId) {
      docId = Store.newId();
      writeKey(docId);
    }
    return Store.available().then(function (ok) {
      ready = ok;
      if (!ok) return;
      return Store.getDoc(docId).then(function (record) {
        if (record) {
          createdAt = record.createdAt || createdAt;
          docName = record.name || "";
        }
        //  Der Stand beim Oeffnen ist die erste Version dieser Sitzung –
        //  sofern er sich von der letzten unterscheidet.
        var data = api.json();
        return Store.listVersions(docId).then(function (versions) {
          lastAuto = Date.now();
          lastAutoData = data;
          if (versions.length && versions[0].data === data) return;
          return Store.addVersion({ doc: docId, kind: "auto", data: data, title: autoTitle(api.state()) });
        }).then(function () { return syncDoc(); });
      }).then(function () { return Store.emptyTrash(); });
    }).then(function () { return ready; });
  }

  function isReady() { return ready; }
  function currentId() { return docId; }

  /* ------------------------------------------------------------- Speichern */

  function record(data, extra) {
    var now = Date.now();
    return Object.assign({
      id: docId, name: docName, title: autoTitle(api.state()), createdAt: createdAt,
      updatedAt: now, deletedAt: null, data: data,
    }, extra || {});
  }

  function syncDoc() {
    if (!ready) return Promise.resolve();
    clearTimeout(syncTimer);
    syncTimer = null;
    var data = api.json();
    var work = [Store.putDoc(record(data))];
    if (Date.now() - lastAuto > AUTO_EVERY && data !== lastAutoData) {
      lastAuto = Date.now();
      lastAutoData = data;
      work.push(Store.addVersion({ doc: docId, kind: "auto", data: data, title: autoTitle(api.state()) }));
    }
    return Promise.all(work);
  }

  //  builder.js meldet jedes Speichern; die Kopie in IndexedDB folgt mit
  //  etwas Abstand, sie muss nicht jeden Tastendruck mitschreiben.
  function saved() {
    if (!ready) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncDoc, 1500);
  }

  function flush() {
    if (syncTimer !== null) syncDoc();
  }

  //  Vor jedem Ersetzen: der Stand, wie er jetzt ist, als Version.
  function beforeReplace(reason) {
    if (!ready) return Promise.resolve();
    var data = api.json();
    return Store.addVersion({
      doc: docId, kind: "before", name: reason || "", data: data, title: autoTitle(api.state()),
    });
  }

  /* -------------------------------------------------------------- Versionen */

  var KIND_LABEL = { auto: "verAuto", before: "verBefore", named: "verNamed" };

  function openVersions() {
    if (!ready) return api.toast(t("storeMissing"));
    flush();
    var list = el("ul", "lib-list");
    var nameRow = el("div", "lib-name-row");
    var nameInput = el("input", "lib-name-input");
    nameInput.type = "text";
    nameInput.placeholder = t("verNamePlaceholder");
    nameInput.setAttribute("aria-label", t("verNamePlaceholder"));
    var close = null;

    function paint() {
      return Store.listVersions(docId).then(function (versions) {
        list.textContent = "";
        if (!versions.length) list.appendChild(el("li", "lib-empty", t("verNone")));
        versions.forEach(function (version) {
          var item = el("li", "lib-item");
          var text = el("div", "lib-text");
          var label = version.kind === "named" ? version.name
            : t(KIND_LABEL[version.kind] || "verAuto") + (version.name ? " – " + version.name : "");
          text.appendChild(el("strong", null, label));
          text.appendChild(el("small", null, when(version.at) + (version.title ? " · " + version.title : "")));
          item.appendChild(text);
          var actions = el("div", "lib-actions");
          actions.appendChild(button(t("verRestore"), "btn-small", function () {
            close(null);
            api.replace(JSON.parse(version.data), t("verRestored"), t("verBeforeRestore"));
          }));
          actions.appendChild(button(t("libDelete"), "btn-small btn-quiet", function () {
            Store.deleteVersion(version.id).then(paint);
          }));
          item.appendChild(actions);
          list.appendChild(item);
        });
      });
    }

    nameRow.appendChild(nameInput);
    nameRow.appendChild(button(t("verSaveNamed"), "btn-small", function () {
      var name = nameInput.value.trim() || when(Date.now());
      Store.addVersion({ doc: docId, kind: "named", name: name, data: api.json(), title: autoTitle(api.state()) })
        .then(function () {
          nameInput.value = "";
          api.toast(t("verNamedSaved"));
          return paint();
        });
    }));
    nameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") nameRow.querySelector("button").click();
    });

    paint();
    global.RickCVDialog.open({
      title: t("verTitle"),
      message: t("verIntro"),
      body: [nameRow, list],
      className: "lib-dialog",
      actions: [{ label: t("close"), value: null, primary: true }],
      ready: function (handle) { close = handle; },
    });
  }

  /* ------------------------------------------------------------- Bibliothek */

  //  Ein anderes Dokument aktiv machen. Der jetzige Stand wird vorher
  //  festgeschrieben – nichts geht dabei verloren.
  function switchTo(id) {
    return syncDoc().then(function () { return Store.getDoc(id); }).then(function (target) {
      if (!target) return;
      var previous = docId;
      docId = target.id;
      createdAt = target.createdAt || Date.now();
      docName = target.name || "";
      writeKey(docId);
      lastAuto = Date.now();
      lastAutoData = target.data;
      api.load(JSON.parse(target.data));
      api.toast(t("libOpened").replace("{title}", titleOf(target)), {
        label: t("libBack"), run: function () { switchTo(previous); },
      });
    });
  }

  function createDoc(state, name) {
    var id = Store.newId();
    var now = Date.now();
    return Store.putDoc({
      id: id, name: name || "", title: autoTitle(state), createdAt: now, updatedAt: now,
      deletedAt: null, data: JSON.stringify(state),
    }).then(function () { return id; });
  }

  //  "Neu" legt ein weiteres Dokument an, statt das jetzige zu leeren.
  function newDocument(base) {
    if (!ready) return Promise.resolve(false);
    return createDoc(base).then(function (id) { return switchTo(id); }).then(function () { return true; });
  }

  //  Die Kopie fuer eine neue Stelle: alles bleibt, nur der Name sagt,
  //  dass es eine Kopie ist.
  function duplicate(id) {
    return syncDoc().then(function () { return Store.getDoc(id); }).then(function (source) {
      if (!source) return null;
      var name = t("libCopyOf").replace("{title}", titleOf(source));
      return createDoc(JSON.parse(source.data), name);
    });
  }

  function trash(id) {
    return Store.getDoc(id).then(function (doc) {
      if (!doc) return;
      doc.deletedAt = Date.now();
      return Store.putDoc(doc);
    });
  }

  function untrash(id) {
    return Store.getDoc(id).then(function (doc) {
      if (!doc) return;
      doc.deletedAt = null;
      doc.updatedAt = Date.now();
      return Store.putDoc(doc);
    });
  }

  function rename(id, name) {
    if (id === docId) docName = name;
    return Store.getDoc(id).then(function (doc) {
      if (!doc) return;
      doc.name = name;
      return Store.putDoc(doc);
    });
  }

  function openLibrary() {
    if (!ready) return api.toast(t("storeMissing"));
    var close = null;
    var list = el("ul", "lib-list");
    var bin = el("details", "lib-trash");
    var binList = el("ul", "lib-list");
    var binSummary = el("summary");
    bin.appendChild(binSummary);
    bin.appendChild(el("p", "lib-hint", t("libTrashHint").replace("{days}", Store.TRASH_DAYS)));
    bin.appendChild(binList);

    function row(doc, active) {
      var item = el("li", "lib-item" + (active ? " lib-active" : ""));
      var text = el("div", "lib-text");
      var title = el("strong", null, titleOf(doc));
      text.appendChild(title);
      text.appendChild(el("small", null, (active ? t("libCurrent") + " · " : "") +
        t("libChanged") + " " + when(doc.updatedAt)));
      item.appendChild(text);
      var actions = el("div", "lib-actions");
      item.appendChild(actions);
      return { item: item, actions: actions, title: title };
    }

    function paint() {
      return syncDoc().then(function () { return Store.listDocs(); }).then(function (docs) {
        list.textContent = "";
        binList.textContent = "";
        var live = docs.filter(function (doc) { return !doc.deletedAt; });
        var gone = docs.filter(function (doc) { return doc.deletedAt; });

        live.forEach(function (doc) {
          var active = doc.id === docId;
          var r = row(doc, active);
          if (!active) {
            r.actions.appendChild(button(t("libOpen"), "btn-small btn-primary", function () {
              close(null);
              switchTo(doc.id);
            }));
          }
          r.actions.appendChild(button(t("libDuplicate"), "btn-small", function () {
            duplicate(doc.id).then(paint);
          }));
          r.actions.appendChild(button(t("libRename"), "btn-small btn-quiet", function () {
            var input = el("input", "lib-name-input");
            input.type = "text";
            input.value = doc.name || titleOf(doc);
            input.setAttribute("aria-label", t("libRename"));
            r.title.replaceWith(input);
            input.focus();
            input.select();
            var done = false;
            function commit() {
              if (done) return;
              done = true;
              rename(doc.id, input.value.trim()).then(paint);
            }
            input.addEventListener("keydown", function (event) {
              if (event.key === "Enter") { event.preventDefault(); commit(); }
              if (event.key === "Escape") { event.stopPropagation(); done = true; paint(); }
            });
            input.addEventListener("blur", commit);
          }));
          if (!active) {
            r.actions.appendChild(button(t("libDelete"), "btn-small btn-quiet", function () {
              trash(doc.id).then(paint);
            }));
          }
          list.appendChild(r.item);
        });

        binSummary.textContent = t("libTrash") + " (" + gone.length + ")";
        bin.hidden = !gone.length;
        gone.forEach(function (doc) {
          var r = row(doc, false);
          r.actions.appendChild(button(t("libUntrash"), "btn-small", function () {
            untrash(doc.id).then(paint);
          }));
          r.actions.appendChild(button(t("libDeleteForever"), "btn-small btn-quiet", function () {
            Store.deleteDoc(doc.id).then(paint);
          }));
          binList.appendChild(r.item);
        });
      });
    }

    var top = el("div", "lib-top");
    top.appendChild(button(t("libNew"), "btn-small", function () {
      close(null);
      api.newDocument();
    }));
    top.appendChild(button(t("libVersions"), "btn-small btn-quiet", function () {
      close(null);
      openVersions();
    }));

    paint();
    global.RickCVDialog.open({
      title: t("libTitle"),
      message: t("libIntro"),
      body: [top, list, bin],
      className: "lib-dialog",
      actions: [{ label: t("close"), value: null, primary: true }],
      ready: function (handle) { close = handle; },
    });
  }

  global.RickCVLibrary = {
    init: init,
    ready: isReady,
    currentId: currentId,
    saved: saved,
    flush: flush,
    beforeReplace: beforeReplace,
    newDocument: newDocument,
    openVersions: openVersions,
    openLibrary: openLibrary,
    autoTitle: function (state) { return autoTitle(state); },
  };
})(typeof window !== "undefined" ? window : this);
