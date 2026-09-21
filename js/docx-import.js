/*  docx-import.js – Ein Word-Dokument lesen.
 *
 *  Der Umweg ueber das PDF entfaellt hier: ein .docx ist ein ZIP mit XML,
 *  und darin steht ausgeschrieben, was im PDF erraten werden muss –
 *  Ueberschrift oder Fliesstext, Tabellenzelle oder Absatz, Aufzaehlung
 *  oder nicht. Deshalb ist der Weg ueber die Originaldatei fast immer der
 *  bessere, und fuer die meisten Menschen liegt der Lebenslauf genau so
 *  auf der Platte.
 *
 *  Gebrauchsfertige Vorlagen bauen ihren Lebenslauf allerdings selten aus
 *  Absaetzen. Sie streuen zwei Dutzend Textrahmen ueber das Blatt, jeder
 *  mit einer Stelle in Zwanzigmillionsteln eines Zolls – in der Datei
 *  stehen sie in der Reihenfolge, in der jemand sie gezogen hat, nicht in
 *  der, in der man sie liest. Wer die Rahmen einfach hintereinander weg
 *  liest, bekommt den Namen zwischen zwei Aufzaehlungspunkten. Deshalb
 *  wird hier gemessen statt gereiht: jede Zeile bekommt ihre Stelle auf
 *  dem Blatt, und daraus macht layout.js dieselben Zeilen wie aus einem
 *  PDF – Spalten, Tabulatoren und alles.
 *
 *  Herauskommt dieselbe Form wie beim PDF – Text, Zeilen mit Schriftgrad,
 *  Bilder mit Platzierung –, damit dahinter dieselbe Auswertung arbeitet.
 */
(function (global) {
  "use strict";

  var Import = global.RickCVImport;
  var Layout = global.RickCVLayout;

  var EMU = 12700;   // Word misst Rahmen in EMU: 12700 auf einen Punkt
  var TWIP = 20;     // Seitenmasse in Zwanzigsteln eines Punktes

  //  A4 mit den Raendern, die Word voreinstellt – falls das Dokument
  //  nichts dazu sagt.
  var SHEET = { width: 595, height: 842, left: 71, right: 71, top: 57 };

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

  //  Liefert die Stelle hinter der schliessenden Marke.
  function findEnd(xml, name, from) {
    var token = new RegExp("<" + name + "(?:\\s[^>]*)?>|</" + name + ">", "g");
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

  //  Jede Marke dieses Namens der Reihe nach, mit ihrem Inhalt. Was in
  //  einer schon steckt, kommt nicht noch einmal: der Zeiger springt hinter
  //  das Ende.
  function eachBlock(xml, name, run) {
    var pattern = new RegExp("<" + name + "(?:\\s[^>]*)?>", "g");
    var closing = name.length + 3;
    var match;

    while ((match = pattern.exec(xml)) !== null) {
      if (isSelfClosing(match[0])) continue;
      var start = match.index + match[0].length;
      var end = findEnd(xml, name, start);
      run(xml.slice(start, end - closing), match[0]);
      pattern.lastIndex = end;
    }
  }

  function firstBlock(xml, name) {
    var found = "";
    eachBlock(xml, name, function (inner) {
      if (!found) found = inner;
    });
    return found;
  }

  //  Marke samt Inhalt herausschneiden.
  function dropBlocks(xml, name) {
    var pattern = new RegExp("<" + name + "(?:\\s[^>]*)?>", "g");
    var out = "";
    var last = 0;
    var match;

    while ((match = pattern.exec(xml)) !== null) {
      if (isSelfClosing(match[0])) continue;
      var end = findEnd(xml, name, match.index + match[0].length);
      out += xml.slice(last, match.index);
      last = end;
      pattern.lastIndex = end;
    }
    return out + xml.slice(last);
  }

  function attribute(tag, name) {
    var match = String(tag).match(new RegExp(name + '="([^"]*)"'));
    return match ? match[1] : "";
  }

  //  Wingdings und Verwandte tragen keinen Text, sondern Zeichen: ein
  //  Haken, ein Pfeil, ein Telefonhoerer. Als Buchstabe gelesen steht davon
  //  ein "ñ" am Anfang der Zeile – im PDF wird derselbe Zierrat an der
  //  Schriftart erkannt und weggelassen, hier genauso.
  var SYMBOL_FONT = /wingdings|webdings|symbol|marlett|font ?awesome|material|glyphicons/i;

  function textOf(xml) {
    var out = "";

    //  Lauf fuer Lauf, denn nur der Lauf weiss, in welcher Schrift seine
    //  Zeichen stehen.
    eachBlock(xml, "w:r", function (run) {
      if (SYMBOL_FONT.test((run.match(/<w:rFonts\b[^>]*>/) || [""])[0])) return;

      var pattern = /<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
      var match;

      while ((match = pattern.exec(run)) !== null) {
        if (match[0].indexOf("<w:tab") === 0) out += "\t";
        //  Ein Umbruch innerhalb des Absatzes ist eine eigene Zeile: in
        //  Lebenslauf-Vorlagen steht so der Arbeitgeber ueber der
        //  Taetigkeit, in einer einzigen Tabellenzelle.
        else if (match[0].indexOf("<w:br") === 0) out += "\n";
        else out += decodeEntities(match[1]);
      }
    });

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

  function indentOf(xml) {
    var match = xml.match(/<w:ind\b[^>]*>/);
    if (!match) return 0;
    var left = Number(attribute(match[0], "w:left") || attribute(match[0], "w:start") || 0);
    return left > 0 ? left / TWIP : 0;
  }

  //  Zwei Arten Seitenwechsel, und sie wirken an verschiedenen Stellen:
  //  ein ausdruecklicher Umbruch steht dort, wo er umbricht – alles
  //  danach liegt auf dem naechsten Blatt. Die Erinnerung an den letzten
  //  Satz ("lastRenderedPageBreak") steht dagegen vor dem ersten Stueck,
  //  das Word schon einmal auf das neue Blatt gesetzt hat.
  function breaksAfter(xml) {
    return /<w:br\s+w:type="page"\s*\/>/.test(xml);
  }

  function breaksBefore(xml) {
    return /<w:lastRenderedPageBreak\s*\/>/.test(xml);
  }

  //  Die Absaetze eines Stuecks – einer Tabellenzelle, eines Textrahmens –
  //  jeder fuer sich, mit dem, was die Auswertung spaeter braucht.
  function paragraphsOf(xml, defaultSize) {
    var out = [];

    eachBlock(xml, "w:p", function (inner) {
      var plain = dropDrawings(inner);
      var size = sizeOf(plain) || defaultSize;
      var bullet = isBullet(plain);
      var heavy = boldness(plain) >= 0.99;
      var indent = indentOf(plain);

      //  Word sagt selbst, was eine Ueberschrift ist. Traegt sie keinen
      //  eigenen Grad, bekommt sie einen – die Auswertung dahinter
      //  entscheidet nach Groesse, und ohne Unterschied faende sie keine.
      //  Der Abstand muss deutlich sein: liegt der erfundene Grad dicht
      //  ueber dem Fliesstext, gilt hinterher jeder fett gesetzte
      //  Aufzaehlungspunkt als Ueberschrift und der halbe Abschnitt ist
      //  weg.
      var text = textOf(plain);
      if (isHeadingStyle(plain)) size = Math.max(size, defaultSize * 1.5);
      else if (heavy && text.trim().length < 40) size = Math.max(size, defaultSize * 1.35);

      text.split("\n").forEach(function (part) {
        var value = part.replace(/[ ]+/g, " ").trim();
        if (!value) return;
        out.push({
          text: bullet ? "• " + value : value,
          size: size, bold: heavy, indent: indent,
        });
      });
    });

    return out;
  }

  /* -------------------------------------------------------------- Rahmen */

  //  Ein Rahmen taucht in der Datei zweimal auf: einmal als Zeichnung fuer
  //  heutige Textprogramme und einmal als Ersatzdarstellung fuer Word 2007.
  //  Beide tragen denselben Text. Wer die Ersatzdarstellung mitliest,
  //  bekommt jeden Namen, jedes Datum und jeden Aufzaehlungspunkt doppelt.
  function dropFallbacks(xml) {
    return dropBlocks(xml, "mc:Fallback");
  }

  //  Zeichnungen aus einem Absatz herausnehmen: ihr Text steht in eigenen
  //  Rahmen und darf nicht mit in die Zeile des Absatzes rutschen.
  function dropDrawings(xml) {
    return dropBlocks(dropBlocks(xml, "w:drawing"), "w:pict");
  }

  function offsetOf(block) {
    var offset = block.match(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/);
    if (offset) return { offset: Number(offset[1]) / EMU, align: "" };
    var align = block.match(/<wp:align>(\w+)<\/wp:align>/);
    return { offset: 0, align: align ? align[1] : "" };
  }

  //  Wo sitzt die Zeichnung auf dem Blatt? Sie sagt selbst, woran sie
  //  haengt: am Blatt, am Satzspiegel oder am laufenden Absatz. Nur der
  //  letzte Fall braucht den Stand des Fliesstextes – und nur dort kann
  //  sich die Schaetzung ueberhaupt verlaufen.
  function placeDrawing(xml, sheet, flowTop) {
    var extent = xml.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/);
    var width = extent ? Number(extent[1]) / EMU : 0;
    var height = extent ? Number(extent[2]) / EMU : 0;
    var content = sheet.width - sheet.left - sheet.right;

    if (!/<wp:anchor\b/.test(xml)) {
      return { x: sheet.left, top: flowTop, w: width, h: height, inline: true };
    }

    var horizontal = offsetOf(firstBlock(xml, "wp:positionH"));
    var vertical = offsetOf(firstBlock(xml, "wp:positionV"));
    var fromH = attribute((xml.match(/<wp:positionH\b[^>]*>/) || [""])[0], "relativeFrom");
    var fromV = attribute((xml.match(/<wp:positionV\b[^>]*>/) || [""])[0], "relativeFrom");

    var x;
    if (horizontal.align === "center") x = sheet.left + Math.max(0, (content - width) / 2);
    else if (horizontal.align === "right") x = sheet.left + Math.max(0, content - width);
    else if (horizontal.align) x = sheet.left;
    else x = (fromH === "page" || fromH === "leftMargin" ? 0 : sheet.left) + horizontal.offset;

    var top;
    if (vertical.align === "center") top = Math.max(0, (sheet.height - height) / 2);
    else if (vertical.align === "bottom") top = Math.max(0, sheet.height - sheet.top - height);
    else if (vertical.align) top = sheet.top;
    else if (fromV === "page" || fromV === "topMargin") top = vertical.offset;
    else if (fromV === "margin") top = sheet.top + vertical.offset;
    else top = flowTop + vertical.offset;

    return { x: x, top: top, w: width, h: height, inline: false };
  }

  //  Eine Gruppe verschiebt ihre Teile in einem eigenen Koordinatennetz:
  //  a:chOff ist dessen Nullpunkt, a:chExt seine Weite. Ohne die Umrechnung
  //  liegen alle Teile einer Gruppe uebereinander auf ihrem Anker.
  function groupFrame(xml) {
    var group = firstBlock(xml, "wpg:grpSpPr");
    if (!group) return null;

    var frame = firstBlock(group, "a:xfrm");
    var off = frame.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/);
    var ext = frame.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
    var childOff = frame.match(/<a:chOff\s+x="(-?\d+)"\s+y="(-?\d+)"/);
    var childExt = frame.match(/<a:chExt\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (!ext || !childExt) return null;

    return {
      x: off ? Number(off[1]) : 0,
      y: off ? Number(off[2]) : 0,
      cx: childOff ? Number(childOff[1]) : 0,
      cy: childOff ? Number(childOff[2]) : 0,
      scaleX: Number(childExt[1]) ? Number(ext[1]) / Number(childExt[1]) : 1,
      scaleY: Number(childExt[2]) ? Number(ext[2]) / Number(childExt[2]) : 1,
    };
  }

  //  Die alte Schreibweise (w:pict) stellt dieselbe Sache in CSS zusammen:
  //  "position:absolute;margin-left:229.6pt;margin-top:12.75pt;width:332pt".
  function placeVml(tag, sheet, flowTop) {
    var style = attribute(tag, "style").replace(/&quot;/g, '"');
    var values = {};
    style.split(";").forEach(function (rule) {
      var parts = rule.split(":");
      if (parts.length === 2) values[parts[0].trim()] = parts[1].trim();
    });

    function points(value, fallback) {
      var match = String(value || "").match(/^(-?[\d.]+)(pt|in|cm|mm|px)?$/);
      if (!match) return fallback;
      var number = Number(match[1]);
      var unit = match[2] || "pt";
      if (unit === "in") return number * 72;
      if (unit === "cm") return number * 28.35;
      if (unit === "mm") return number * 2.835;
      if (unit === "px") return number * 0.75;
      return number;
    }

    var width = points(values.width, 0);
    var height = points(values.height, 0);
    var x = points(values["margin-left"], 0);
    var top = points(values["margin-top"], 0);

    if (values["mso-position-horizontal-relative"] !== "page") x += sheet.left;
    var relativeV = values["mso-position-vertical-relative"];
    if (relativeV === "margin") top += sheet.top;
    else if (relativeV !== "page") top += flowTop;

    return { x: x, top: top, w: width, h: height, inline: false };
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

  function blipsIn(xml) {
    var found = [];
    var pattern = /<a:blip[^>]*r:embed="([^"]+)"|<v:imagedata[^>]*r:id="([^"]+)"/g;
    var match;
    while ((match = pattern.exec(xml)) !== null) found.push(match[1] || match[2]);
    return found;
  }

  /* ----------------------------------------------------------------- Lauf */

  function sheetOf(xml) {
    var sheet = {
      width: SHEET.width, height: SHEET.height,
      left: SHEET.left, right: SHEET.right, top: SHEET.top,
    };

    var size = (xml.match(/<w:pgSz\b[^>]*>/) || [""])[0];
    if (size) {
      sheet.width = Number(attribute(size, "w:w")) / TWIP || sheet.width;
      sheet.height = Number(attribute(size, "w:h")) / TWIP || sheet.height;
    }

    var margin = (xml.match(/<w:pgMar\b[^>]*>/) || [""])[0];
    if (margin) {
      sheet.left = Number(attribute(margin, "w:left")) / TWIP || sheet.left;
      sheet.right = Number(attribute(margin, "w:right")) / TWIP || sheet.right;
      sheet.top = Number(attribute(margin, "w:top")) / TWIP || sheet.top;
    }

    return sheet;
  }

  function convert(files) {
    var source = Import.decodeText(files["word/document.xml"]);
    if (!source) throw new Error("noDocx");

    var document = dropFallbacks(source);
    var rels = relationships(Import.decodeText(files["word/_rels/document.xml.rels"]));
    var styles = Import.decodeText(files["word/styles.xml"]);
    var defaultSize =
      sizeOf((styles.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/) || [""])[0]) || 11;

    var sheet = sheetOf(document);
    var body = (document.match(/<w:body>([\s\S]*)<\/w:body>/) || [null, document])[1];

    var pages = {};
    var images = [];
    var page = 1;
    var flowTop = sheet.top;

    //  Ein Stueck Text mit seiner Stelle auf dem Blatt. Die Breite wird
    //  geschaetzt – sie entscheidet nur, ob zwei Stuecke nebeneinander
    //  stehen oder in zwei Spalten. Als Mass dient die mittlere
    //  Zeichenbreite der Schriften, mit denen Vorlagen gesetzt werden:
    //  knapp ein halbes Geviert. Lieber etwas zu schmal als zu breit –
    //  eine zu breit geratene Zeile in der Seitenspalte laesst die Gasse
    //  zwischen den Spalten verschwinden. Ein Rahmen deckelt sie
    //  ausserdem: sonst ragte ein kurzer Text in einem breiten Rahmen in
    //  die Nachbarspalte.
    function push(text, size, x, top, bold, limit) {
      var value = String(text).replace(/[ \t]+$/g, "");
      if (!value.trim()) return;

      var estimate = Math.max(size, value.length * size * 0.45);
      (pages[page] = pages[page] || []).push({
        str: value,
        whole: true,
        x: x,
        y: sheet.height - top,
        w: limit ? Math.min(estimate, limit) : Math.min(estimate, sheet.width - x),
        h: size,
        bold: !!bold,
      });
    }

    function lineHeight(size) {
      return size * 1.3;
    }

    //  Zierrat aussortieren wie beim PDF: winzige Symbole, Striche und
    //  flaechige Hintergruende sind kein Inhalt.
    function collect(id, box) {
      var target = rels[id];
      if (!target) return;

      var width = box.w || 0;
      var height = box.h || 0;
      var ratio = height ? width / height : 1;
      if (width < 20 || height < 20) return;
      if (ratio > 6 || ratio < 1 / 6) return;
      if (width * height > sheet.width * sheet.height * 0.65) return;

      var bytes = files["word/" + target] || files[target];
      var src = dataUrl(bytes, target);
      if (!src) return;

      images.push({
        src: src, page: page, x: box.x, y: sheet.height - box.top - height,
        w: width, h: height,
        ratio: ratio,
        area: width * height,
        pageWidth: sheet.width, pageHeight: sheet.height,
      });
    }

    //  Der Text eines Rahmens, Zeile fuer Zeile von seiner Oberkante nach
    //  unten. Genauer laesst es sich nicht sagen: was Word wirklich
    //  umbricht, weiss nur Word.
    function fill(inner, box) {
      var top = box.top;
      paragraphsOf(inner, defaultSize).forEach(function (line) {
        var height = lineHeight(line.size);
        push(line.text, line.size, box.x + line.indent, top + height * 0.75,
             line.bold, box.w);
        top += height;
      });
      return top - box.top;
    }

    //  Eine Zeichnung: entweder ein Bild, oder ein Rahmen mit Text, oder
    //  eine Gruppe aus beidem.
    function handleDrawing(xml) {
      var box = placeDrawing(xml, sheet, flowTop);
      var group = groupFrame(xml);
      var used = false;

      eachBlock(xml, "wps:wsp", function (shape) {
        var spot = { x: box.x, top: box.top, w: box.w, h: box.h };

        if (group) {
          var frame = firstBlock(firstBlock(shape, "wps:spPr"), "a:xfrm");
          var off = frame.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/);
          var ext = frame.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
          if (off) {
            spot.x = box.x + ((Number(off[1]) - group.cx) * group.scaleX) / EMU;
            spot.top = box.top + ((Number(off[2]) - group.cy) * group.scaleY) / EMU;
          }
          if (ext) {
            spot.w = (Number(ext[1]) * group.scaleX) / EMU;
            spot.h = (Number(ext[2]) * group.scaleY) / EMU;
          }
        }

        var inner = firstBlock(shape, "w:txbxContent");
        if (inner) { fill(inner, spot); used = true; }

        blipsIn(firstBlock(shape, "wps:spPr") || shape).forEach(function (id) {
          collect(id, spot);
          used = true;
        });
      });

      //  Ein eingebundenes Bild steht fuer sich, ohne Rahmen darum.
      if (!used) {
        blipsIn(xml).forEach(function (id) { collect(id, box); });
      }

      return box;
    }

    //  Die alte Schreibweise, wenn kein moderner Zwilling danebensteht.
    function handlePict(xml, tag) {
      var shape = (xml.match(/<v:(?:shape|rect|roundrect|oval)\b[^>]*>/) || [tag])[0];
      var box = placeVml(shape, sheet, flowTop);
      var inner = firstBlock(xml, "w:txbxContent");
      if (inner) fill(inner, box);
      blipsIn(xml).forEach(function (id) { collect(id, box); });
      return box;
    }

    //  Alle Zeichnungen eines Stuecks. Zurueck kommt, wieviel davon im
    //  Fliesstext Platz beansprucht – eingebundene Bilder schieben den
    //  Text weiter, freigestellte Rahmen nicht.
    function handleShapes(xml) {
      var pushed = 0;

      eachBlock(xml, "w:drawing", function (inner) {
        var box = handleDrawing(inner);
        if (box.inline) pushed = Math.max(pushed, box.h);
      });

      eachBlock(xml, "w:pict", function (inner, tag) {
        handlePict(inner, tag);
      });

      return pushed;
    }

    //  Die Blaetter des Dokumentkoerpers der Reihe nach: Absatz oder
    //  Tabelle. Was in einer Tabelle steckt, kommt nicht noch einmal als
    //  Absatz.
    function walk(xml) {
      var pattern = /<w:(tbl|p)(?:\s[^>]*)?>/g;
      var match;

      while ((match = pattern.exec(xml)) !== null) {
        if (isSelfClosing(match[0])) continue;
        var name = "w:" + match[1];
        var start = match.index + match[0].length;
        var end = findEnd(xml, name, start);
        var inner = xml.slice(start, end - name.length - 3);
        pattern.lastIndex = end;

        if (match[1] === "tbl") table(inner);
        else paragraph(inner);
      }
    }

    //  Eine Tabellenzeile wird eine Zeile mit Tabulatoren – genau die
    //  Form, in der auch ein PDF seine Beschriftungsspalten hinterlaesst.
    //  Stehen in einer Zelle mehrere Absaetze, bleiben es mehrere Zeilen:
    //  dort steckt bei Lebenslauf-Vorlagen der Unterschied zwischen
    //  Arbeitgeber, Taetigkeit und Abschluss.
    function table(xml) {
      eachBlock(xml, "w:tr", function (rowXml) {
        handleShapes(rowXml);

        var cells = [];
        eachBlock(rowXml, "w:tc", function (cellXml) {
          cells.push(paragraphsOf(cellXml, defaultSize));
        });

        var height = cells.reduce(function (most, entries) {
          return Math.max(most, entries.length);
        }, 0);

        for (var line = 0; line < height; line++) {
          var parts = cells.map(function (entries) {
            return entries[line] ? entries[line].text : "";
          });
          //  Leere Spalten am Ende erzeugen sonst lose Tabulatoren.
          while (parts.length && !parts[parts.length - 1]) parts.pop();
          if (!parts.join("")) continue;

          var size = cells.reduce(function (most, entries) {
            return entries[line] ? Math.max(most, entries[line].size) : most;
          }, 0) || defaultSize;

          //  Die ganze Zeile als ein Stueck: sie ist schon zusammengesetzt,
          //  und ihre Tabulatoren sollen keiner Spaltenrechnung mehr zum
          //  Opfer fallen.
          push(parts.join("\t"), size, sheet.left, flowTop + lineHeight(size) * 0.75,
               false, sheet.width - sheet.left - sheet.right);
          flowTop += lineHeight(size);
          if (flowTop > sheet.height - sheet.top) turnPage();
        }
      });
    }

    function turnPage() {
      page++;
      flowTop = sheet.top;
    }

    function paragraph(xml) {
      var plain = dropDrawings(xml);
      if (breaksBefore(plain)) turnPage();

      var pushed = handleShapes(xml);
      var size = sizeOf(plain) || defaultSize;
      var text = textOf(plain);
      var bulleted = isBullet(plain);
      var heavy = boldness(plain) >= 0.99;
      var indent = indentOf(plain);

      if (isHeadingStyle(plain)) size = Math.max(size, defaultSize * 1.5);
      else if (heavy && text.trim().length < 40) size = Math.max(size, defaultSize * 1.35);

      var height = lineHeight(size);
      var written = false;

      text.split("\n").forEach(function (part) {
        var value = part.replace(/[ ]+/g, " ").trim();
        if (!value) return;
        push(bulleted ? "• " + value : value, size, sheet.left + indent,
             flowTop + height * 0.75, heavy, sheet.width - sheet.left - sheet.right - indent);
        flowTop += height;
        written = true;
      });

      //  Auch ein leerer Absatz nimmt Platz ein – und daran haengen die
      //  Rahmen, die sich auf "den laufenden Absatz" beziehen.
      if (!written) flowTop += Math.max(pushed, height);

      if (breaksAfter(plain) || flowTop > sheet.height - sheet.top) turnPage();
    }

    walk(body);

    //  Spalte fuer Spalte, jede von oben nach unten – dieselbe Rechnung wie
    //  beim PDF, und dieselbe Reihenfolge, in der ein Mensch das Blatt
    //  liest.
    var lines = [];
    Object.keys(pages).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (number) {
        var slack = Math.max(2, Math.round(pages[number].length * 0.12));
        Layout.splitColumns(pages[number], sheet.width, slack).forEach(function (column) {
          lines = lines.concat(Layout.toLines(column, number));
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
