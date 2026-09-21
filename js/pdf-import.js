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

  var Layout = global.RickCVLayout;

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

  /* --------------------------------------------------------------- Bilder */

  //  Ein PDF malt Bilder ueber eine Matrix in den Seitenraum: darin steckt
  //  auch, wo und wie gross. Genau das wird gebraucht, um ein Bewerbungsfoto
  //  von einem Firmenlogo und einer Unterschrift zu unterscheiden.
  function multiply(a, b) {
    return [
      a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
      a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
      a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
    ];
  }

  //  Die Bilddaten liegen im Arbeitsprozess und koennen noch unterwegs
  //  sein. Wer nicht rechtzeitig da ist, wird ausgelassen – ein fehlendes
  //  Logo ist kein Grund, den ganzen Import haengen zu lassen.
  function objectOf(page, name) {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (value) {
        if (done) return;
        done = true;
        resolve(value || null);
      };
      setTimeout(function () { finish(null); }, 4000);
      try {
        var store = name.indexOf("g_") === 0 ? page.commonObjs : page.objs;
        store.get(name, finish);
      } catch (error) { finish(null); }
    });
  }

  //  pdf.js liefert je nach Quelle eine fertige Bitmap oder rohe Pixel.
  //  Beides landet auf einer Leinwand und kommt als Datenadresse zurueck,
  //  verkleinert auf ein Mass, das in den Browserspeicher passt.
  function toDataUrl(image, maxSize) {
    var width = image.width || (image.bitmap && image.bitmap.width);
    var height = image.height || (image.bitmap && image.bitmap.height);
    if (!width || !height) return "";

    var canvas = document.createElement("canvas");
    if (!canvas.getContext) return "";

    var scale = Math.min(1, maxSize / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    var context = canvas.getContext("2d");
    if (!context) return "";

    //  Ein Bild mit Alphakanal auf Weiss setzen: im Lebenslauf steht es
    //  auf weissem Papier, und JPEG kennt keine Transparenz.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (image.bitmap) {
      context.drawImage(image.bitmap, 0, 0, canvas.width, canvas.height);
    } else if (image.data) {
      var source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      var sourceContext = source.getContext("2d");
      var pixels = sourceContext.createImageData(width, height);
      if (!fillPixels(pixels, image)) return "";
      sourceContext.putImageData(pixels, 0, 0);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
    } else {
      return "";
    }

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  //  Rohdaten kommen in drei Formen: ein Bit je Punkt (Schablonen), drei
  //  Bytes (RGB) oder vier (RGBA).
  function fillPixels(target, image) {
    var data = image.data;
    var count = target.width * target.height;

    if (data.length >= count * 4) {
      target.data.set(data.subarray(0, count * 4));
      return true;
    }

    if (data.length >= count * 3) {
      for (var i = 0; i < count; i++) {
        target.data[i * 4] = data[i * 3];
        target.data[i * 4 + 1] = data[i * 3 + 1];
        target.data[i * 4 + 2] = data[i * 3 + 2];
        target.data[i * 4 + 3] = 255;
      }
      return true;
    }

    //  Schablonen sind meist Zierrat, kein Inhalt.
    return false;
  }

  function pageImages(page, number, pdfjsLib) {
    var OPS = pdfjsLib.OPS;
    var view = page.view || [0, 0, 595, 842];
    var pageWidth = view[2] - view[0];
    var pageHeight = view[3] - view[1];

    return page.getOperatorList().then(function (operators) {
      var stack = [];
      var matrix = [1, 0, 0, 1, 0, 0];
      var placements = [];

      operators.fnArray.forEach(function (op, index) {
        var args = operators.argsArray[index];
        if (op === OPS.save) stack.push(matrix.slice());
        else if (op === OPS.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
        else if (op === OPS.transform) matrix = multiply(args, matrix);
        else if (op === OPS.paintImageXObject || op === OPS.paintJpegXObject) {
          var placedWidth = Math.abs(matrix[0]) || Math.abs(matrix[1]);
          var placedHeight = Math.abs(matrix[3]) || Math.abs(matrix[2]);
          placements.push({
            name: args[0],
            x: matrix[4],
            y: matrix[5],
            w: placedWidth,
            h: placedHeight,
          });
        }
      });

      //  Aussortiert wird, was kein Inhalt sein kann: Striche, Punkte und
      //  flaechige Hintergruende.
      var wanted = placements.filter(function (place) {
        if (place.w < 20 || place.h < 20) return false;
        var ratio = place.w / place.h;
        if (ratio > 6 || ratio < 1 / 6) return false;
        return (place.w * place.h) < pageWidth * pageHeight * 0.65;
      });

      var chain = Promise.resolve();
      var found = [];
      wanted.forEach(function (place) {
        chain = chain.then(function () {
          return objectOf(page, place.name).then(function (image) {
            if (!image) return;
            var maxSize = place.w > 120 ? 700 : 320;
            var dataUrl = "";
            try { dataUrl = toDataUrl(image, maxSize); } catch (error) { dataUrl = ""; }
            if (!dataUrl) return;
            found.push({
              src: dataUrl,
              page: number,
              x: place.x, y: place.y, w: place.w, h: place.h,
              ratio: place.w / place.h,
              area: place.w * place.h,
              pageWidth: pageWidth,
              pageHeight: pageHeight,
            });
          });
        });
      });

      return chain.then(function () { return found; });
    }, function () { return []; });
  }

  /* --------------------------------------------------------------- Seite */

  //  Symbolschriften (Material Symbols, Font Awesome und Verwandte) legen
  //  ihre Zeichen in den Privatbereich von Unicode. Im Text sind das
  //  unsichtbare Fremdkoerper, die an Ueberschriften kleben und ihre
  //  Erkennung zerstoeren – also raus damit.
  //
  //  Vorsicht ist trotzdem geboten: schlecht gebaute PDFs bilden ihren
  //  ganzen Text in den Privatbereich ab. Ueberwiegt er, wird nichts
  //  entfernt – lieber merkwuerdige Zeichen als eine leere Seite.
  var PRIVATE_USE = /[\uE000-\uF8FF]|[\uDB80-\uDBBF][\uDC00-\uDFFF]/g;

  //  Schriften setzen "fl" und "fi" als eine Glyphe. Im Text steht dann ein
  //  einzelnes Ligaturzeichen, und aus "Tierpflege" wird "Tierp[fl]ege" –
  //  jede spaetere Suche geht daran vorbei.
  var LIGATURES = {
    "\uFB00": "ff", "\uFB01": "fi", "\uFB02": "fl",
    "\uFB03": "ffi", "\uFB04": "ffl", "\uFB05": "st", "\uFB06": "st",
  };

  function expandLigatures(text) {
    return text.replace(/[\uFB00-\uFB06]/g, function (char) {
      return LIGATURES[char] || char;
    });
  }

  //  Wieviele Zeichen kamen ohne Zuordnung zurueck? Das passiert bei
  //  Ligaturglyphen in Dateien ohne Zuordnungstabelle: der Leser weiss, dass
  //  da etwas stand, aber nicht was. Der Zaehler wandert in die Warnung.
  var unmapped = 0;
  var UNMAPPED = /\uFFFD/g;

  function stripSymbols(items) {
    var total = 0;
    var symbols = 0;
    items.forEach(function (item) {
      total += item.str.length;
      symbols += (item.str.match(PRIVATE_USE) || []).length;
      unmapped += (item.str.match(UNMAPPED) || []).length;
    });

    var keepSymbols = !total || symbols / total > 0.15;

    return items.map(function (item) {
      var str = keepSymbols ? item.str : item.str.replace(PRIVATE_USE, "");
      //  Ein Platzhalterzeichen mitten im Wort ist schlechter als eine
      //  Luecke: es steht in jeder Suche im Weg. Die Warnung sagt, dass
      //  Buchstaben fehlen koennen.
      str = expandLigatures(str).replace(UNMAPPED, "");
      if (str === item.str) return item;

      //  Blieb nichts uebrig, wird daraus ein Platzhalter: er traegt keinen
      //  Text mehr, wohl aber seine Breite. Ohne die klaffte an der Stelle
      //  eine Luecke, und aus "Tierpflege" wuerde "Tierp ege".
      return Object.assign({}, item, { str: str, ghost: !str.trim() });
    });
  }

  //  Symbolschriften tragen keinen Text bei: was aussieht wie ein Symbol,
  //  kommt je nach Datei als Privatbereich-Zeichen, als leeres Stueck oder
  //  als ausgeschriebener Symbolname ("school") zurueck. Am Namen der
  //  Schrift ist das sicher zu erkennen – und dann faellt der ganze
  //  Schnipsel weg, nicht nur einzelne Zeichen.
  var ICON_FONT = /material.?(symbols|icons)|font.?awesome|icomoon|glyphicons|feather|lucide|ionicons|octicons|typicons|entypo/i;

  //  Ein fetter Schnitt steht im Namen der eingebetteten Schrift. Das ist
  //  die einzige Stelle, an der ein PDF "wichtig" sagt – Ueberschriften,
  //  Stationstitel und Projektnamen haengen daran.
  var BOLD_FONT = /bold|black|heavy|semibold|demibold|ultra/i;

  function boldFontMap(page, items) {
    var map = {};
    items.forEach(function (item) {
      var name = item.fontName;
      if (!name || map[name] !== undefined) return;
      var label = "";
      try {
        var font = page.commonObjs.get(name);
        label = (font && (font.name || font.loadedName)) || "";
      } catch (error) {
        label = "";
      }
      map[name] = BOLD_FONT.test(label) || BOLD_FONT.test(name);
    });
    return map;
  }

  function iconFontMap(page, items) {
    var map = {};
    items.forEach(function (item) {
      var name = item.fontName;
      if (!name || map[name] !== undefined) return;
      var label = "";
      try {
        var font = page.commonObjs.get(name);
        label = (font && (font.name || font.loadedName)) || "";
      } catch (error) {
        label = "";
      }
      map[name] = ICON_FONT.test(label);
    });
    return map;
  }

  function pageText(page, number) {
    return page.getTextContent().then(function (content) {
      var view = page.view || [0, 0, 595, 842];
      var width = view[2] - view[0];

      //  Entfernte Zeichen bleiben als leere Stuecke stehen: ihre Breite
      //  wird noch gebraucht. Ohne sie klafft dort eine Luecke, und aus
      //  "Tierpflege" wuerde "Tierp ege" statt "Tierpege".
      var icons = iconFontMap(page, content.items);
      var bold = boldFontMap(page, content.items);
      var cleaned = stripSymbols(content.items).map(function (item) {
        if (!icons[item.fontName]) return item;
        return Object.assign({}, item, { str: "", ghost: true });
      });

      //  Ein Stueck, das nur ein Leerzeichen traegt, bleibt drin. Kapitaelchen
      //  setzt Chrome Buchstabe fuer Buchstabe, und das Leerzeichen zwischen
      //  zwei Woertern ist dann ein eigenes Stueck: wer es wegwirft, bekommt
      //  "ZOOLINO,Bad Wimpeln" – der Abstand allein ist zu klein, um daraus
      //  wieder ein Leerzeichen zu schliessen.
      var items = cleaned.filter(function (item) {
        return (item.str && item.str.length) || item.ghost;
      }).map(function (item) {
        return {
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width || 0,
          h: Math.abs(item.transform[3]) || item.height || 10,
          ghost: !!item.ghost,
          bold: !!bold[item.fontName],
        };
      });

      if (!items.length) return [];

      //  Spalte fuer Spalte, jede von oben nach unten – das ist die
      //  Reihenfolge, in der ein Mensch das Blatt liest.
      return Layout.splitColumns(items, width).reduce(function (all, column) {
        return all.concat(Layout.toLines(column, number));
      }, []);
    });
  }

  function extract(file, callback) {
    var library = null;
    unmapped = 0;

    load().then(function (pdfjsLib) {
      library = pdfjsLib;
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
      var rows = [];
      var images = [];
      var chain = Promise.resolve();
      for (var number = 1; number <= pdf.numPages; number++) {
        (function (index) {
          chain = chain.then(function () {
            return pdf.getPage(index).then(function (page) {
              //  Erst die Operatorliste: sie laedt nebenbei die Schriften,
              //  und ohne die laesst sich eine Symbolschrift nicht von
              //  einer Textschrift unterscheiden.
              return pageImages(page, index, library).then(function (found) {
                images = images.concat(found);
                return pageText(page, index);
              }).then(function (lines) {
                rows = rows.concat(lines);
              });
            });
          });
        })(number);
      }
      return chain.then(function () { return { rows: rows, images: images }; });
    }).then(function (result) {
      var text = result.rows.map(function (row) { return row.text; }).join("\n");
      if (!text.replace(/\s/g, "")) {
        //  Ein eingescanntes PDF enthaelt Bilder, keinen Text. Das ist kein
        //  Fehler im Import, und Texterkennung gehoert nicht hierher.
        return callback(new Error("pdfNoText"));
      }
      //  Der Text ist das, was man anschauen kann; die Zeilen tragen
      //  zusaetzlich Schriftgrad und Seite, die Bilder ihre Platzierung –
      //  damit erkennt die Auswertung Ueberschriften, Namen und Foto,
      //  statt zu raten.
      callback(null, {
        text: text, lines: result.rows, images: result.images, unmapped: unmapped,
      });
    }).catch(function (error) {
      //  Der Grund bleibt in der Konsole: fuer den Nutzer ist "ging nicht"
      //  die richtige Auskunft, fuer einen Fehlerbericht nicht.
      console.warn("PDF-Import fehlgeschlagen:", error);
      callback(error && error.message === "noPdfSupport" ? error : new Error("pdfFailed"));
    });
  }

  global.RickCVPdf = { extract: extract };
})(typeof window !== "undefined" ? window : this);
