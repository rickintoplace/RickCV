/*  store.js – Was laenger halten soll als ein offener Tab.
 *
 *  Der Stand, an dem gerade gearbeitet wird, liegt weiter in localStorage:
 *  das schreibt synchron, also auch noch beim Schliessen des Tabs, und der
 *  allein geoeffnete cv.html liest es. Alles andere liegt hier, in
 *  IndexedDB – dort passen auch Dutzende Staende mit Foto hinein, wo
 *  localStorage nach etwa fuenf Megabyte aufgibt:
 *
 *    docs      die Dokumente der Bibliothek, eines davon ist das aktive
 *              { id, title, createdAt, updatedAt, deletedAt, data }
 *    versions  fruehere Staende eines Dokuments
 *              { id, doc, kind, name, at, title, data }
 *    files     zu einem Dokument die Datei, in die es gespeichert wird
 *              (nur Chromium: ein FileSystemFileHandle) { doc, handle }
 *
 *  "data" ist immer der Zustand als JSON-Text, so wie er auch in
 *  localStorage steht.
 *
 *  Ohne IndexedDB (manche private Fenster) geht nichts verloren, was es
 *  vorher gab: dann gibt es eben keine Versionen und keine Bibliothek, und
 *  jede Funktion hier liefert ein leeres Ergebnis statt eines Fehlers.
 */
(function (global) {
  "use strict";

  var NAME = "rickcv";
  var VERSION = 1;

  //  Wie viele Staende ein Dokument behaelt. Benannte bleiben, bis man sie
  //  loescht; die automatischen verfallen nach 90 Tagen und ueber der
  //  Hoechstzahl, aelteste zuerst.
  var KEEP_AUTO = 60;
  var KEEP_DAYS = 90;
  var TRASH_DAYS = 30;

  var opening = null;

  function open() {
    if (opening) return opening;
    opening = new Promise(function (resolve) {
      var request;
      try {
        request = global.indexedDB.open(NAME, VERSION);
      } catch (error) {
        return resolve(null);
      }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "id" });
        if (!db.objectStoreNames.contains("versions")) {
          var versions = db.createObjectStore("versions", { keyPath: "id", autoIncrement: true });
          versions.createIndex("doc", "doc");
        }
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "doc" });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { resolve(null); };
      request.onblocked = function () { resolve(null); };
    });
    return opening;
  }

  //  Ein Schritt in einer Transaktion, als Promise. Ohne Datenbank kommt
  //  "fallback" zurueck.
  function run(storeName, mode, work, fallback) {
    return open().then(function (db) {
      if (!db) return fallback;
      return new Promise(function (resolve) {
        var tx;
        try {
          tx = db.transaction(storeName, mode);
        } catch (error) {
          return resolve(fallback);
        }
        var result = fallback;
        var request = work(tx.objectStore(storeName));
        if (request) request.onsuccess = function () { result = request.result; };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { resolve(fallback); };
        tx.onabort = function () { resolve(fallback); };
      });
    });
  }

  function available() {
    return open().then(function (db) { return !!db; });
  }

  /* ------------------------------------------------------------ Dokumente */

  function newId() {
    var bytes = new Uint8Array(8);
    (global.crypto || {}).getRandomValues ? global.crypto.getRandomValues(bytes)
      : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
    return Array.prototype.map.call(bytes, function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function putDoc(doc) {
    return run("docs", "readwrite", function (store) { return store.put(doc); }, null);
  }

  function getDoc(id) {
    return run("docs", "readonly", function (store) { return store.get(id); }, null);
  }

  function listDocs() {
    return run("docs", "readonly", function (store) { return store.getAll(); }, [])
      .then(function (docs) {
        return (docs || []).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      });
  }

  function deleteDoc(id) {
    return run("docs", "readwrite", function (store) { return store.delete(id); }, null)
      .then(function () { return deleteVersions(id); })
      .then(function () { return forgetFile(id); });
  }

  //  Was laenger als 30 Tage im Papierkorb liegt, geht endgueltig.
  function emptyTrash(now) {
    return listDocs().then(function (docs) {
      var limit = (now || Date.now()) - TRASH_DAYS * 86400000;
      return Promise.all(docs.filter(function (doc) {
        return doc.deletedAt && doc.deletedAt < limit;
      }).map(function (doc) { return deleteDoc(doc.id); }));
    });
  }

  /* ------------------------------------------------------------- Versionen */

  function addVersion(entry) {
    var record = {
      doc: entry.doc, kind: entry.kind || "auto", name: entry.name || "",
      at: entry.at || Date.now(), title: entry.title || "", data: entry.data,
    };
    return run("versions", "readwrite", function (store) { return store.add(record); }, null)
      .then(function (id) {
        return pruneVersions(entry.doc).then(function () { return id; });
      });
  }

  function listVersions(docId) {
    return run("versions", "readonly", function (store) {
      return store.index("doc").getAll(docId);
    }, []).then(function (all) {
      return (all || []).sort(function (a, b) { return b.at - a.at || b.id - a.id; });
    });
  }

  function getVersion(id) {
    return run("versions", "readonly", function (store) { return store.get(id); }, null);
  }

  function updateVersion(record) {
    return run("versions", "readwrite", function (store) { return store.put(record); }, null);
  }

  function deleteVersion(id) {
    return run("versions", "readwrite", function (store) { return store.delete(id); }, null);
  }

  function deleteVersions(docId) {
    return listVersions(docId).then(function (all) {
      return Promise.all(all.map(function (version) { return deleteVersion(version.id); }));
    });
  }

  function pruneVersions(docId, now) {
    return listVersions(docId).then(function (all) {
      var limit = (now || Date.now()) - KEEP_DAYS * 86400000;
      var auto = all.filter(function (version) { return version.kind !== "named"; });
      var drop = auto.filter(function (version, index) {
        return index >= KEEP_AUTO || version.at < limit;
      });
      return Promise.all(drop.map(function (version) { return deleteVersion(version.id); }));
    });
  }

  /* ---------------------------------------------------------------- Dateien */

  function rememberFile(docId, handle) {
    return run("files", "readwrite", function (store) {
      return store.put({ doc: docId, handle: handle });
    }, null);
  }

  function fileOf(docId) {
    return run("files", "readonly", function (store) { return store.get(docId); }, null)
      .then(function (record) { return record ? record.handle : null; });
  }

  function forgetFile(docId) {
    return run("files", "readwrite", function (store) { return store.delete(docId); }, null);
  }

  global.RickCVStore = {
    available: available,
    newId: newId,
    putDoc: putDoc,
    getDoc: getDoc,
    listDocs: listDocs,
    deleteDoc: deleteDoc,
    emptyTrash: emptyTrash,
    addVersion: addVersion,
    listVersions: listVersions,
    getVersion: getVersion,
    updateVersion: updateVersion,
    deleteVersion: deleteVersion,
    pruneVersions: pruneVersions,
    rememberFile: rememberFile,
    fileOf: fileOf,
    forgetFile: forgetFile,
    KEEP_AUTO: KEEP_AUTO,
    TRASH_DAYS: TRASH_DAYS,
  };
})(typeof window !== "undefined" ? window : this);
