/*  savefile.js – Das Dokument als eine Datei, die einem selbst gehoert.
 *
 *  Der Browser-Speicher ist bequem, aber ein Cache-Leeren weit vom Verlust
 *  entfernt, und Safari raeumt ihn nach sieben Tagen ohne Besuch von selbst
 *  auf. Deshalb gibt es "Als Datei speichern": eine einzige HTML-Datei, die
 *
 *    - ohne RickCV und ohne Netz genau so aussieht wie die Vorschau
 *      (Stylesheet und benutzte Schriften stecken darin),
 *    - sich drucken und mailen laesst,
 *    - kein ausfuehrbares Skript enthaelt,
 *    - und ihre Daten als JSON mitbringt: auf RickCV gezogen, ist sie
 *      wieder ein bearbeitbares Dokument (js/import.js erkennt sie).
 *
 *  In Chromium merkt sich RickCV die Datei (File System Access API): das
 *  naechste Strg+S schreibt still in dieselbe. Anderswo gibt es die API
 *  nicht; dann wird heruntergeladen, jedes Mal als neue Datei.
 */
(function (global) {
  "use strict";

  var api = null;
  var waiting = {};
  var counter = 0;
  var assetsLoading = null;

  function t(key) { return api.t(key); }

  function init(handles) { api = handles; }

  /* ----------------------------------------------------------- Bausteine */

  //  Der Rahmen schickt das gezeichnete Dokument zurueck (js/preview.js).
  function snapshot() {
    return new Promise(function (resolve, reject) {
      var id = ++counter;
      waiting[id] = resolve;
      api.post({ type: "rickcv:snapshot", id: id });
      setTimeout(function () {
        if (!waiting[id]) return;
        delete waiting[id];
        reject(new Error("snapshot"));
      }, 8000);
    });
  }

  function receive(message) {
    var done = waiting[message.id];
    if (!done) return;
    delete waiting[message.id];
    done(message);
  }

  //  Das Buendel ist gut ein Megabyte gross und wird erst hier geladen.
  function assets() {
    if (global.RickCVDocAssets) return Promise.resolve(global.RickCVDocAssets);
    if (assetsLoading) return assetsLoading;
    assetsLoading = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "js/doc-assets.js";
      script.onload = function () { resolve(global.RickCVDocAssets); };
      script.onerror = function () { assetsLoading = null; reject(new Error("assets")); };
      document.head.appendChild(script);
    });
    return assetsLoading;
  }

  function fontCss(bundle, families) {
    var wanted = {};
    families.forEach(function (family) { wanted[family.toLowerCase()] = true; });
    return bundle.fonts.filter(function (face) {
      return wanted[face.family.toLowerCase()];
    }).map(function (face) {
      return "@font-face {\n  font-family: '" + face.family + "';\n  font-style: " + face.style +
        ";\n  font-weight: " + face.weight + ";\n  src: url(data:font/woff2;base64," + face.data +
        ") format('woff2');\n" + (face.range ? "  unicode-range: " + face.range + ";\n" : "") + "}";
    }).join("\n");
  }

  //  Das JSON steht in einem <script type="application/json">. Das fuehrt
  //  kein Browser aus; "<" wird trotzdem maskiert, damit kein "</script>"
  //  im Text den Block vorzeitig schliesst.
  function dataBlock(state) {
    return JSON.stringify(state).replace(/</g, "\\u003c");
  }

  function compose(shot, bundle, state) {
    var doc = new DOMParser().parseFromString("<!DOCTYPE html>" + shot.html, "text/html");
    var head = doc.head;

    var meta = doc.createElement("meta");
    meta.setAttribute("http-equiv", "Content-Security-Policy");
    meta.setAttribute("content",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'");
    var charset = doc.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    var viewport = doc.createElement("meta");
    viewport.setAttribute("name", "viewport");
    viewport.setAttribute("content", "width=device-width, initial-scale=1.0");
    var generator = doc.createElement("meta");
    generator.setAttribute("name", "generator");
    generator.setAttribute("content", "RickCV – https://cv.rickinto.place/");

    //  Das Grund-Stylesheet muss vor dem Theme stehen: es legt die
    //  Reihenfolge der Ebenen fest (@layer base, theme).
    var fonts = doc.createElement("style");
    fonts.textContent = fontCss(bundle, shot.families);
    var base = doc.createElement("style");
    base.textContent = bundle.styles;

    Array.prototype.slice.call(head.querySelectorAll("meta[charset], meta[name='viewport']"))
      .forEach(function (node) { node.parentNode.removeChild(node); });
    [base, fonts, generator, viewport, meta, charset].forEach(function (node) {
      head.insertBefore(node, head.firstChild);
    });

    //  Bilder, die noch auf eine Datei neben cv.html zeigen (nur das
    //  Beispiel tut das), werden zu data:-Adressen. Ein Bild, das sich so
    //  nicht finden laesst, faellt weg, statt als kaputtes Symbol zu stehen.
    Array.prototype.forEach.call(doc.querySelectorAll("img[src]"), function (img) {
      var src = img.getAttribute("src");
      if (/^data:/i.test(src)) return;
      var known = (bundle.images || {})[src] || (bundle.images || {})["./" + src.replace(/^\.?\//, "")];
      if (known) img.setAttribute("src", known);
      else img.parentNode.removeChild(img);
    });

    var data = doc.createElement("script");
    data.type = "application/json";
    data.id = "rickcv-data";
    data.textContent = "__RICKCV_DATA__";
    doc.body.appendChild(data);

    var note = "\n  Gespeichert mit RickCV. Diese Datei zeigt die Bewerbung ohne Netz und\n" +
      "  ohne Programm. Um sie weiter zu bearbeiten, zieh sie auf\n" +
      "  https://cv.rickinto.place/ (oder auf eine lokale index.html von RickCV).\n" +
      "  Saved with RickCV. To edit it again, drop this file onto RickCV.\n";
    var html = "<!DOCTYPE html>\n<!--" + note + "-->\n" + doc.documentElement.outerHTML;
    return html.replace("__RICKCV_DATA__", function () { return dataBlock(state); });
  }

  function fileName(state) {
    var title = global.RickCVRender.documentTitle(state);
    return title.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() + ".html";
  }

  /* ------------------------------------------------------------- Schreiben */

  function download(name, html) {
    var blob = new Blob([html], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    api.toast(t("fileDownloaded").replace("{name}", name));
  }

  function writeTo(handle, html) {
    return handle.createWritable().then(function (stream) {
      return stream.write(html).then(function () { return stream.close(); });
    });
  }

  function allowed(handle) {
    if (!handle.queryPermission) return Promise.resolve(true);
    return handle.queryPermission({ mode: "readwrite" }).then(function (state) {
      if (state === "granted") return true;
      return handle.requestPermission({ mode: "readwrite" }).then(function (asked) {
        return asked === "granted";
      });
    });
  }

  function pick(name) {
    return global.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "HTML", accept: { "text/html": [".html", ".htm"] } }],
    });
  }

  //  "again": in die bekannte Datei schreiben, sofern es eine gibt (Strg+S).
  //  Sonst – oder mit "Speichern unter" – wird gefragt, wohin.
  function save(again) {
    var state = api.state();
    var name = fileName(state);
    var Store = global.RickCVStore;
    var docId = api.docId();
    api.status(t("fileSaving"));

    var built = Promise.all([snapshot(), assets()]).then(function (parts) {
      return compose(parts[0], parts[1], state);
    });

    if (!global.showSaveFilePicker) {
      return built.then(function (html) { download(name, html); api.status(t("saved")); },
                        failed);
    }

    var known = again && Store ? Store.fileOf(docId) : Promise.resolve(null);
    return known.then(function (handle) {
      if (handle) {
        return allowed(handle).then(function (ok) { return ok ? handle : pick(name); });
      }
      return pick(name);
    }).then(function (handle) {
      return built.then(function (html) { return writeTo(handle, html); }).then(function () {
        if (Store) Store.rememberFile(docId, handle);
        api.status(t("saved"));
        api.toast(t("fileSaved").replace("{name}", handle.name));
      });
    }).catch(function (error) {
      //  Abgebrochen ist kein Fehler.
      if (error && error.name === "AbortError") { api.status(t("saved")); return; }
      failed(error);
    });
  }

  function failed(error) {
    console.warn("Als Datei speichern fehlgeschlagen:", error);
    api.status(t("saved"));
    api.toast(t("fileFailed"));
  }

  //  Aus einer gespeicherten Datei die Daten wieder herausholen (js/import.js).
  function extract(text) {
    var match = /<script[^>]*id=["']?rickcv-data["']?[^>]*>([\s\S]*?)<\/script>/i.exec(String(text));
    return match ? match[1].trim() : null;
  }

  global.RickCVSaveFile = {
    init: init,
    receive: receive,
    save: save,
    extract: extract,
    canRemember: function () { return !!global.showSaveFilePicker; },
  };
})(typeof window !== "undefined" ? window : this);
