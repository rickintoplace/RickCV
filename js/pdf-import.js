/*  pdf-import.js – Text aus einem PDF holen, damit ein alter Lebenslauf
 *  nicht abgetippt werden muss.
 *
 *  Das ist die einzige Stelle im Baukasten mit Fremdcode: Mozillas pdf.js
 *  liegt unter vendor/pdfjs/ (Apache-2.0) und wird erst geladen, wenn
 *  jemand wirklich ein PDF hineinzieht. Ohne PDF-Import bleibt RickCV
 *  abhaengigkeitsfrei, und offline funktioniert beides.
 *
 *  Ein PDF weiss nichts von Zeilen oder Spalten – es kennt nur Schnipsel
 *  mit Koordinaten. Die Arbeit hier besteht darin, daraus wieder Text in
 *  Lesereihenfolge zu machen: erst Spalten trennen (Lebenslaeufe haben
 *  fast immer eine), dann Zeilen bilden, dann Woerter zusammensetzen.
 */
(function (global) {
  "use strict";

  var SCRIPT = "vendor/pdfjs/pdf.min.js";
  var WORKER = "vendor/pdfjs/pdf.worker.min.js";
  var loading = null;

  //  Schlaegt der Arbeitsprozess fehl – etwa bei file:// – rechnet pdf.js
  //  von selbst im Vordergrund weiter. Ohne gesetzte Quelle bricht es
  //  dagegen ab, deshalb steht das hier und nicht nur im Ladepfad: die
  //  Bibliothek koennte auch von anderer Stelle gekommen sein.
  function ready(lib) {
    if (lib && lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = WORKER;
    }
    return lib;
  }

  function load() {
    if (global.pdfjsLib) return Promise.resolve(ready(global.pdfjsLib));
    if (loading) return loading;

    loading = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = SCRIPT;
      script.onload = function () {
        if (!global.pdfjsLib) return reject(new Error("noPdfSupport"));
        resolve(ready(global.pdfjsLib));
      };
      script.onerror = function () { reject(new Error("noPdfSupport")); };
      document.head.appendChild(script);
    });
    return loading;
  }

  /* ------------------------------------------------------------- Spalten */

  //  Eine senkrechte Bahn, durch die keine Zeile laeuft, trennt zwei
  //  Spalten. Gesucht wird die breiteste solche Bahn, die beide Seiten
  //  nennenswert fuellt – sonst waere jeder Einzug schon eine Spalte.
  function splitColumns(items, width) {
    if (items.length < 20) return [items];

    var edges = [];
    items.forEach(function (item) { edges.push(item.x + item.w); });
    edges.sort(function (a, b) { return a - b; });

    var best = null;
    edges.forEach(function (edge) {
      if (edge < width * 0.2 || edge > width * 0.8) return;

      var left = 0, right = 0, gap = width;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.x < edge && item.x + item.w > edge + 1) return; // laeuft hindurch
        if (item.x + item.w <= edge) left++;
        else { right++; gap = Math.min(gap, item.x - edge); }
      }
      if (left < items.length * 0.15 || right < items.length * 0.15) return;
      if (!best || gap > best.gap) best = { edge: edge, gap: gap };
    });

    //  Unter einer halben Zeilenhoehe Abstand ist es kein Spaltenrand,
    //  sondern Zufall.
    if (!best || best.gap < width * 0.02) return [items];

    var leftItems = [], rightItems = [];
    items.forEach(function (item) {
      (item.x + item.w <= best.edge ? leftItems : rightItems).push(item);
    });
    return [leftItems, rightItems];
  }

  /* -------------------------------------------------------------- Zeilen */

  function toLines(items) {
    if (!items.length) return [];

    var heights = items.map(function (item) { return item.h; })
      .sort(function (a, b) { return a - b; });
    var tolerance = Math.max(2, heights[Math.floor(heights.length / 2)] * 0.5);

    var sorted = items.slice().sort(function (a, b) {
      return b.y - a.y || a.x - b.x; // im PDF waechst y nach oben
    });

    var lines = [];
    var current = null;
    sorted.forEach(function (item) {
      if (!current || Math.abs(current.y - item.y) > tolerance) {
        current = { y: item.y, parts: [] };
        lines.push(current);
      }
      current.parts.push(item);
    });

    return lines.map(function (line) {
      var parts = line.parts.sort(function (a, b) { return a.x - b.x; });
      var text = "";
      var previous = null;
      parts.forEach(function (item) {
        if (previous) {
          var space = item.x - (previous.x + previous.w);
          //  Schnipsel stossen im PDF oft mitten im Wort aneinander; erst
          //  ab einem Viertel Zeichenbreite ist es ein Leerzeichen.
          if (space > item.h * 0.25) text += " ";
        }
        text += item.str;
        previous = item;
      });
      return text.replace(/\s+/g, " ").trim();
    }).filter(Boolean);
  }

  /* --------------------------------------------------------------- Seite */

  function pageText(page) {
    return page.getTextContent().then(function (content) {
      var view = page.view || [0, 0, 595, 842];
      var width = view[2] - view[0];

      var items = content.items.filter(function (item) {
        return item.str && item.str.trim();
      }).map(function (item) {
        return {
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width || 0,
          h: Math.abs(item.transform[3]) || item.height || 10,
        };
      });

      if (!items.length) return "";

      return splitColumns(items, width).map(function (column) {
        return toLines(column).join("\n");
      }).join("\n\n");
    });
  }

  function extract(file, callback) {
    load().then(function (pdfjsLib) {
      return file.arrayBuffer().then(function (buffer) {
        return pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          //  Keine Schriftarten oder Bilder nachladen: gebraucht wird nur
          //  der Text, und es soll nichts ins Netz gehen.
          disableFontFace: true,
          isEvalSupported: false,
        }).promise;
      });
    }).then(function (pdf) {
      var pages = [];
      var chain = Promise.resolve();
      for (var number = 1; number <= pdf.numPages; number++) {
        (function (index) {
          chain = chain.then(function () {
            return pdf.getPage(index).then(pageText).then(function (text) {
              pages.push(text);
            });
          });
        })(number);
      }
      return chain.then(function () { return pages.join("\n\n"); });
    }).then(function (text) {
      if (!text.replace(/\s/g, "")) {
        //  Ein eingescanntes PDF enthaelt Bilder, keinen Text. Das ist kein
        //  Fehler im Import, und Texterkennung gehoert nicht hierher.
        return callback(new Error("pdfNoText"));
      }
      callback(null, text);
    }).catch(function (error) {
      //  Der Grund bleibt in der Konsole: fuer den Nutzer ist "ging nicht"
      //  die richtige Auskunft, fuer einen Fehlerbericht nicht.
      console.warn("PDF-Import fehlgeschlagen:", error);
      callback(error && error.message === "noPdfSupport" ? error : new Error("pdfFailed"));
    });
  }

  global.RickCVPdf = { extract: extract };
})(typeof window !== "undefined" ? window : this);
