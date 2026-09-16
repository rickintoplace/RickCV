/*  docx-import.js – Ein Word-Dokument lesen.
 *
 *  Der Umweg ueber das PDF entfaellt hier: ein .docx ist ein ZIP mit XML,
 *  und darin steht ausgeschrieben, was im PDF erraten werden muss –
 *  Ueberschrift oder Fliesstext, Tabellenzelle oder Absatz, Aufzaehlung
 *  oder nicht. Deshalb ist der Weg ueber die Originaldatei fast immer der
 *  bessere, und fuer die meisten Menschen liegt der Lebenslauf genau so
 *  auf der Platte.
 *
 *  Herauskommt dieselbe Form wie beim PDF – Text, Zeilen mit Schriftgrad,
 *  Bilder mit Platzierung –, damit dahinter dieselbe Auswertung arbeitet.
 */
(function (global) {
  "use strict";

  var Import = global.RickCVImport;

  var PAGE_HEIGHT = 842;   // A4 in Punkt, als Bezug fuer die Bildlage
  var LINE_STEP = 14;      // angenommener Zeilenabstand

  function decodeEntities(value) {
    return String(value)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (match, code) {
        return String.fromCharCode(Number(code));
      })
      .replace(/&amp;/g, "&");
  }

  /* ----------------------------------------------------------- XML-Gerüst */

  //  Word verschachtelt Tabellen, Absaetze nicht. Deshalb genuegt ein
  //  Zaehler fuer gleichnamige Marken, um das Ende eines Blocks zu finden.
  //  Achtung bei leeren Marken: "<w:p w14:paraId=\"...\"/>" sieht mit
  //  Attributen aus wie ein oeffnender Absatz, ist aber schon zu Ende.
  //  Wird er mitgezaehlt, verschluckt der Block alles Folgende – und aus
  //  einem ganzen Lebenslauf wird eine einzige Zeile.
  function isSelfClosing(tag) {
    return tag.slice(-2) === "/>";
  }

  function findEnd(xml, tag, from) {
    var token = new RegExp("<w:" + tag + "(?:\\s[^>]*)?>|</w:" + tag + ">", "g");
    token.lastIndex = from;
    var depth = 1;
    var match;

    while ((match = token.exec(xml)) !== null) {
      if (match[0].charAt(1) === "/") {
        depth--;
        if (!depth) return match.index + match[0].length;
      } else if (!isSelfClosing(match[0])) {
        depth++;
      }
    }
    return xml.length;
  }

  //  Die Blaetter des Dokumentkoerpers der Reihe nach: Absatz oder Tabelle.
  function blocks(xml) {
    var pattern = /<w:(tbl|p)(?:\s[^>]*)?>/g;
    var found = [];
    var match;

    while ((match = pattern.exec(xml)) !== null) {
      if (isSelfClosing(match[0])) continue; // leerer Absatz
      var start = match.index + match[0].length;
      var end = findEnd(xml, match[1], start);
      found.push({ tag: match[1], inner: xml.slice(start, end) });
      pattern.lastIndex = end;
    }
    return found;
  }

  function textOf(xml) {
    var out = "";
    var pattern = /<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    var match;

    while ((match = pattern.exec(xml)) !== null) {
      if (match[0].indexOf("<w:tab") === 0) out += "\t";
      //  Ein Umbruch innerhalb des Absatzes ist eine eigene Zeile: in
      //  Lebenslauf-Vorlagen steht so der Arbeitgeber ueber der Taetigkeit,
      //  in einer einzigen Tabellenzelle.
      else if (match[0].indexOf("<w:br") === 0) out += "\n";
      else out += decodeEntities(match[1]);
    }
    return out;
  }

  /* -------------------------------------------------------------- Absätze */

  function sizeOf(xml) {
    //  w:sz zaehlt halbe Punkte.
    var sizes = [];
    var pattern = /<w:sz(?:Cs)?\s+w:val="(\d+)"/g;
    var match;
    while ((match = pattern.exec(xml)) !== null) sizes.push(Number(match[1]) / 2);
    return sizes.length ? Math.max.apply(null, sizes) : 0;
  }

  function isHeadingStyle(xml) {
    var match = xml.match(/<w:pStyle\s+w:val="([^"]+)"/);
    if (!match) return false;
    //  Word benennt seine Formatvorlagen je nach Sprache der Oberflaeche.
    return /^(heading|title|berschrift|titel|subtitle)/i.test(match[1]);
  }

  function boldness(xml) {
    var runs = (xml.match(/<w:r(?:\s[^>]*)?>/g) || []).length;
    var bold = (xml.match(/<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/g) || []).length;
    return runs ? bold / runs : 0;
  }

  function isBullet(xml) {
    return /<w:numPr>/.test(xml);
  }

  function hasPageBreak(xml) {
    return /<w:br\s+w:type="page"\s*\/>|<w:lastRenderedPageBreak\s*\/>/.test(xml);
  }

  /* --------------------------------------------------------------- Bilder */

  function relationships(xml) {
    var map = {};
    var pattern = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    var match;
    while ((match = pattern.exec(xml)) !== null) {
      map[match[1]] = match[2].replace(/^\/?word\//, "").replace(/^\.\.\//, "");
    }
    return map;
  }

  var MEDIA_TYPES = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", bmp: "image/bmp", webp: "image/webp",
  };

  function dataUrl(bytes, name) {
    var extension = (name.split(".").pop() || "").toLowerCase();
    var type = MEDIA_TYPES[extension];
    if (!type || !bytes || !bytes.length) return "";

    //  In Stuecken umwandeln: fromCharCode mit einem ganzen Bild als
    //  Argumentliste sprengt den Aufrufstapel.
    var binary = "";
    for (var i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return "data:" + type + ";base64," + global.btoa(binary);
  }

  //  Word misst in EMU: 914400 auf ein Zoll, ein Punkt sind 12700.
  function imagesIn(xml) {
    var found = [];
    var pattern = /<a:blip[^>]*r:embed="([^"]+)"/g;
    var match;
    while ((match = pattern.exec(xml)) !== null) found.push({ id: match[1] });

    if (!found.length) return found;

    var extent = xml.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/);
    var width = extent ? Number(extent[1]) / 12700 : 100;
    var height = extent ? Number(extent[2]) / 12700 : 100;
    found.forEach(function (image) {
      image.w = width;
      image.h = height;
    });
    return found;
  }

  //  Die Absaetze einer Tabellenzelle, jeder fuer sich – mit Merkzeichen
  //  fuer Aufzaehlungen.
  function cellParagraphs(xml) {
    var out = [];
    var pattern = /<w:p(?:\s[^>]*)?>/g;
    var match;

    while ((match = pattern.exec(xml)) !== null) {
      if (isSelfClosing(match[0])) continue;
      var start = match.index + match[0].length;
      var end = findEnd(xml, "p", start);
      var inner = xml.slice(start, end);
      pattern.lastIndex = end;

      var bullet = isBullet(inner);
      textOf(inner).split("\n").forEach(function (part) {
        var text = part.replace(/[ ]+/g, " ").trim();
        if (!text) return;
        out.push({ text: bullet ? "• " + text : text, size: sizeOf(inner) });
      });
    }
    return out;
  }

  /* ----------------------------------------------------------------- Lauf */

  function convert(files) {
    var document = Import.decodeText(files["word/document.xml"]);
    if (!document) throw new Error("noDocx");

    var rels = relationships(Import.decodeText(files["word/_rels/document.xml.rels"]));
    var styles = Import.decodeText(files["word/styles.xml"]);
    var defaultSize = sizeOf((styles.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [""])[0]) || 11;

    var body = (document.match(/<w:body>([\s\S]*)<\/w:body>/) || [null, document])[1];

    var lines = [];
    var images = [];
    var page = 1;
    var y = PAGE_HEIGHT - 40;

    function place(text, size) {
      var value = String(text).replace(/[ \t]+$/g, "").trim();
      if (!value) return null;

      var row = { text: value, size: size, spaced: false, x: 0, y: y, page: page };
      lines.push(row);
      step(LINE_STEP);
      return row;
    }

    function step(amount) {
      y -= amount;
      if (y < 40) { y = PAGE_HEIGHT - 40; page++; }
    }

    //  Bilder stehen oft in einem Absatz fuer sich – ohne Text also, und
    //  der wuerde sonst gar nicht erst angelegt. Die Lage kommt dann vom
    //  laufenden Stand, und der ruckt um die Bildhoehe weiter.
    function handleImages(source) {
      var found = imagesIn(source);
      found.forEach(function (image) {
        collect(image, { page: page, y: y });
      });
      if (found.length) {
        step(Math.max.apply(null, found.map(function (image) { return image.h; })));
      }
      return found.length;
    }

    function collect(image, row) {
      var target = rels[image.id];
      if (!target) return;

      //  Zierrat aussortieren wie beim PDF: winzige Symbole, Striche und
      //  flaechige Hintergruende sind kein Inhalt.
      var ratio = image.h ? image.w / image.h : 1;
      if (image.w < 20 || image.h < 20) return;
      if (ratio > 6 || ratio < 1 / 6) return;
      if (image.w * image.h > 595 * PAGE_HEIGHT * 0.65) return;

      var bytes = files["word/" + target] || files[target];
      var src = dataUrl(bytes, target);
      if (!src) return;

      images.push({
        src: src, page: row.page, x: 0, y: row.y,
        w: image.w, h: image.h,
        ratio: ratio,
        area: image.w * image.h,
        pageWidth: 595, pageHeight: PAGE_HEIGHT,
      });
    }

    blocks(body).forEach(function (block) {
      if (hasPageBreak(block.inner)) {
        page++;
        y = PAGE_HEIGHT - 40;
      }

      if (block.tag === "tbl") {
        //  Eine Tabellenzeile wird eine Zeile mit Tabulatoren – genau die
        //  Form, in der auch ein PDF seine Beschriftungsspalten
        //  hinterlaesst. Stehen in einer Zelle mehrere Absaetze, bleiben
        //  es mehrere Zeilen: dort steckt bei Lebenslauf-Vorlagen der
        //  Unterschied zwischen Arbeitgeber, Taetigkeit und Abschluss.
        var rowPattern = /<w:tr(?:\s[^>]*)?>/g;
        var match;
        while ((match = rowPattern.exec(block.inner)) !== null) {
          if (isSelfClosing(match[0])) continue;
          var start = match.index + match[0].length;
          var end = findEnd(block.inner, "tr", start);
          var rowXml = block.inner.slice(start, end);
          rowPattern.lastIndex = end;
          handleImages(rowXml);

          var cells = [];
          var cellPattern = /<w:tc(?:\s[^>]*)?>/g;
          var cell;
          while ((cell = cellPattern.exec(rowXml)) !== null) {
            if (isSelfClosing(cell[0])) continue;
            var cellStart = cell.index + cell[0].length;
            var cellEnd = findEnd(rowXml, "tc", cellStart);
            var cellXml = rowXml.slice(cellStart, cellEnd);
            cellPattern.lastIndex = cellEnd;
            cells.push(cellParagraphs(cellXml));
          }

          var height = cells.reduce(function (most, entries) {
            return Math.max(most, entries.length);
          }, 0);
          var rowSize = sizeOf(rowXml) || defaultSize;

          for (var line = 0; line < height; line++) {
            var parts = cells.map(function (entries) {
              return entries[line] ? entries[line].text : "";
            });
            //  Leere Spalten am Ende erzeugen sonst lose Tabulatoren.
            while (parts.length && !parts[parts.length - 1]) parts.pop();
            if (!parts.join("")) continue;
            place(parts.join("\t"), rowSize);
          }
        }
        return;
      }

      handleImages(block.inner);
      var text = textOf(block.inner);
      var size = sizeOf(block.inner) || defaultSize;
      var bulleted = isBullet(block.inner);

      //  Word sagt selbst, was eine Ueberschrift ist. Traegt sie keinen
      //  eigenen Grad, bekommt sie einen – die Auswertung dahinter
      //  entscheidet nach Groesse, und ohne Unterschied faende sie keine.
      if (isHeadingStyle(block.inner)) size = Math.max(size, defaultSize * 1.4);
      else if (boldness(block.inner) >= 0.99 && text.trim().length < 40) {
        size = Math.max(size, defaultSize * 1.15);
      }

      text.split("\n").forEach(function (part) {
        place(bulleted ? "• " + part : part, size);
      });
    });

    return {
      text: lines.map(function (row) { return row.text; }).join("\n"),
      lines: lines,
      images: images,
    };
  }

  function read(file, callback) {
    file.arrayBuffer().then(Import.readZip).then(function (files) {
      var result = convert(files);
      if (!result.text.replace(/\s/g, "")) throw new Error("noDocxText");
      callback(null, result);
    }).catch(function (error) {
      callback(error && error.message === "noDocx" ? error : new Error("docxFailed"));
    });
  }

  global.RickCVDocx = { read: read, convert: convert };
})(typeof window !== "undefined" ? window : this);
