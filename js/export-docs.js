/*  export-docs.js – Der Inhalt als Markdown und als Word-Datei (.docx).
 *
 *  Beide sind die neutrale, bearbeitbare Fassung: was drinsteht, nicht wie
 *  es aussieht. Das Aussehen eines Themes ist CSS und laesst sich in Word
 *  nicht nachbauen – wer genau das Aussehen braucht, nimmt das PDF. Word
 *  wollen Personalvermittler und manche Portale; Markdown ist fuer alles,
 *  was Text weiterverarbeitet (ein Chat, ein Wiki, eine Notiz).
 *
 *  Die DOCX-Datei schreibt RickCV selbst: ein paar XML-Dateien in einem
 *  ZIP. Keine Bibliothek, kein Netz. Mit Foto, Ueberschriften als echte
 *  Formatvorlagen (Word erzeugt daraus ein Inhaltsverzeichnis, Vorlese-
 *  software springt daran entlang), der Sprache des Dokuments und – wenn
 *  eingeschaltet – dem Anschreiben auf eigener Seite, mit den Raendern und
 *  dem Anschriftfeld nach DIN 5008.
 */
(function (global) {
  "use strict";

  var I18n = global.RickCVI18n;

  function clean(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function doc(key, locale) {
    return I18n ? I18n.t("doc", key, locale) : key;
  }

  /* ----------------------------------------------------------- Inhalt */

  //  Neueste Station zuerst, wie im Dokument.
  function startValue(event) {
    var parts = clean(event.start).split("/");
    var year = Number(parts[parts.length - 1]) || 0;
    var month = parts.length > 1 ? Number(parts[0]) || 0 : 0;
    return year * 12 + month;
  }

  function period(event, locale) {
    var mode = event.dateMode || "auto";
    if (mode === "auto") {
      if (!event.start && !event.end && !event.present) mode = "none";
      else if (!event.end && !event.present) mode = "start";
      else mode = "range";
    }
    if (mode === "none") return "";
    if (mode === "start") return clean(event.start);
    return clean(event.start) + " – " + (event.present ? doc("present", locale) : clean(event.end));
  }

  //  Was im Dokument steht, in Lesereihenfolge und ohne Gestaltung. Beide
  //  Ausgaben bauen darauf auf; so koennen sie nicht auseinanderlaufen.
  function outline(state) {
    var s = state;
    var locale = s.locale || "de";
    var out = { locale: locale, blocks: [] };
    var c = s.contact || {};
    out.name = clean(c.name);
    out.role = clean(c.role);
    out.contact = [clean(c.address), clean(c.city), clean(c.email), clean(c.phone)].filter(Boolean);
    out.photo = s.photo && s.photo.show && /^data:image\//.test(s.photo.src || "") ? s.photo.src : "";

    if (s.profile && s.profile.show !== false && clean(s.profile.text)) {
      out.blocks.push({ title: clean(s.profile.title), paragraphs: clean(s.profile.text).split(/\n+/) });
    }

    (s.sections || []).forEach(function (section) {
      if (section.show === false) return;
      var events = (s.events || []).filter(function (event) { return event.sectionId === section.id; })
        .slice().sort(function (a, b) { return startValue(b) - startValue(a); });
      if (!events.length) return;
      out.blocks.push({
        title: clean(section.title),
        entries: events.map(function (event) {
          return {
            title: clean(event.title),
            period: period(event, locale),
            where: [clean(event.company), clean(event.place)].filter(Boolean).join(", "),
            paragraphs: (event.description || []).map(clean).filter(Boolean),
            bullets: (event.list || []).map(clean).filter(Boolean),
          };
        }),
      });
    });

    function list(block, line) {
      if (!block || block.show === false || !Array.isArray(block.items)) return;
      var items = block.items.map(line).filter(Boolean);
      if (items.length) out.blocks.push({ title: clean(block.title), bullets: items });
    }
    list(s.skills, function (item) { return clean(item.name); });
    list(s.languages, function (item) {
      return clean(item.name) + (clean(item.level) ? " – " + clean(item.level) : "");
    });
    list(s.projects, function (item) {
      return clean(item.name) + (clean(item.description) ? " – " + clean(item.description) : "") +
        (clean(item.url) ? " (" + clean(item.url) + ")" : "");
    });
    list(s.interests, function (item) { return clean(item.name); });
    list(s.mobility, function (item) { return clean(item.name); });
    if (s.mobilitySB && s.mobilitySB.show && !(s.mobility && s.mobility.show)) {
      list(s.mobilitySB, function (item) { return clean(item.name); });
    }
    list(s.references, function (item) {
      return [clean(item.name), clean(item.role), clean(item.company), clean(item.contact)].filter(Boolean).join(", ");
    });

    var settings = s.settings || {};
    out.place = clean(settings.place) || clean(c.city).replace(/^\d{4,5}\s+/, "");
    out.date = clean(settings.date) || today(locale);

    var letter = s.coverLetter || {};
    if (settings.showCoverLetter) {
      out.letter = {
        recipient: clean(letter.recipient).split("\n").map(clean).filter(Boolean),
        subject: clean(letter.subject),
        salutation: clean(letter.salutation),
        paragraphs: (letter.paragraphs || []).map(clean).filter(Boolean),
        closing: clean(letter.closing),
      };
    }
    return out;
  }

  var MONTHS = {
    de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September",
         "Oktober", "November", "Dezember"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September",
         "October", "November", "December"],
  };

  function today(locale) {
    var now = new Date();
    var month = (MONTHS[locale] || MONTHS.de)[now.getMonth()];
    return locale === "en" ? now.getDate() + " " + month + " " + now.getFullYear()
      : now.getDate() + ". " + month + " " + now.getFullYear();
  }

  /* --------------------------------------------------------- Markdown */

  //  Zeichen, die Markdown als Auszeichnung liest, werden maskiert – sonst
  //  wird aus "C++" oder "*Name*" etwas anderes.
  function md(text) {
    return String(text).replace(/([\\`*_[\]#|<>])/g, "\\$1");
  }

  function markdown(state) {
    var o = outline(state);
    var lines = [];
    lines.push("# " + md(o.name || doc("cvTitle", o.locale)));
    if (o.role) lines.push("", "**" + md(o.role) + "**");
    if (o.contact.length) lines.push("", o.contact.map(md).join(" · "));
    o.blocks.forEach(function (block) {
      lines.push("", "## " + md(block.title));
      (block.paragraphs || []).forEach(function (text) { lines.push("", md(text)); });
      (block.entries || []).forEach(function (entry) {
        lines.push("", "### " + md(entry.title) + (entry.period ? " · " + md(entry.period) : ""));
        if (entry.where) lines.push("", "*" + md(entry.where) + "*");
        entry.paragraphs.forEach(function (text) { lines.push("", md(text)); });
        if (entry.bullets.length) {
          lines.push("");
          entry.bullets.forEach(function (text) { lines.push("- " + md(text)); });
        }
      });
      if (block.bullets) {
        lines.push("");
        block.bullets.forEach(function (text) { lines.push("- " + md(text)); });
      }
    });
    if (o.place || o.date) lines.push("", md([o.place, o.date].filter(Boolean).join(", ")));
    if (o.letter) {
      var l = o.letter;
      lines.push("", "---", "", "## " + md(l.subject || doc("letterTitle", o.locale)));
      if (l.recipient.length) lines.push("", l.recipient.map(md).join("  \n"));
      lines.push("", md([o.place, o.date].filter(Boolean).join(", ")));
      if (l.salutation) lines.push("", md(l.salutation));
      l.paragraphs.forEach(function (text) { lines.push("", md(text)); });
      if (l.closing) lines.push("", md(l.closing));
      if (o.name) lines.push("", md(o.name));
    }
    return lines.join("\n") + "\n";
  }

  /* -------------------------------------------------------------- ZIP */

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  //  Ungepackt ("stored"): eine Bewerbung ist klein, und Word liest es.
  function zip(files) {
    var encoder = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;
    files.forEach(function (file) {
      var name = encoder.encode(file.name);
      var data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
      var crc = crc32(data);
      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // UTF-8-Namen
      local.setUint16(8, 0, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      var entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true);
      entry.setUint16(4, 20, true);
      entry.setUint16(6, 20, true);
      entry.setUint16(8, 0x0800, true);
      entry.setUint32(16, crc, true);
      entry.setUint32(20, data.length, true);
      entry.setUint32(24, data.length, true);
      entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var size = central.reduce(function (sum, part) { return sum + part.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(total);
    var at = 0;
    all.forEach(function (part) { out.set(part, at); at += part.length; });
    return out;
  }

  /* ------------------------------------------------------------- DOCX */

  function xml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  }

  function run(text, props) {
    return "<w:r>" + (props ? "<w:rPr>" + props + "</w:rPr>" : "") +
      '<w:t xml:space="preserve">' + xml(text) + "</w:t></w:r>";
  }

  function para(content, style, pPr) {
    return "<w:p><w:pPr>" + (style ? '<w:pStyle w:val="' + style + '"/>' : "") + (pPr || "") +
      "</w:pPr>" + content + "</w:p>";
  }

  //  Titel links, Zeitraum rechtsbuendig auf derselben Zeile – ueber einen
  //  Tabstopp am rechten Rand, wie man es in Word von Hand machen wuerde.
  function entryHead(entry, width) {
    var tab = '<w:tabs><w:tab w:val="right" w:pos="' + width + '"/></w:tabs>';
    return para(run(entry.title, "<w:b/>") + (entry.period ? "<w:r><w:tab/></w:r>" + run(entry.period) : ""),
      "Eintrag", tab);
  }

  function bullet(text) {
    return para(run(text), "Aufzaehlung");
  }

  var STYLES = function (lang, font) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font +
      '" w:cs="' + font + '"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="' + lang +
      '"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/>' +
      "</w:pPr></w:pPrDefault></w:docDefaults>" +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/>' +
      '<w:rPr><w:caps/><w:spacing w:val="20"/><w:sz w:val="22"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>' +
      '<w:next w:val="Normal"/><w:pPr><w:keepNext/>' +
      '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="286F6F"/></w:pBdr><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr>' +
      '<w:rPr><w:b/><w:color w:val="286F6F"/><w:sz w:val="28"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Eintrag"><w:name w:val="Eintrag"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="140" w:after="0"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Ort"><w:name w:val="Ort"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:keepNext/><w:spacing w:after="40"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Aufzaehlung"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="20"/>' +
      '<w:ind w:left="360" w:hanging="240"/></w:pPr></w:style>' +
      "</w:styles>";
  };

  var NUMBERING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/>' +
    '<w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl>' +
    '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

  //  Ein Bild in Word braucht seine Masse in EMU (914400 je Zoll).
  function picture(id, width, height) {
    var cx = Math.round(width * 9525);
    var cy = Math.round(height * 9525);
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="1" name="Foto" descr="Foto"/>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="0" name="foto.jpg"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>' +
      "</wp:inline></w:drawing></w:r>";
  }

  //  "data:image/webp;base64,…" → JPEG-Bytes. Word liest kein WebP; der
  //  Umweg ueber eine Leinwand macht daraus ein JPEG. Ohne Leinwand (Node,
  //  Tests) bleibt das Foto weg.
  function photoBytes(src) {
    return new Promise(function (resolve) {
      if (!src || typeof document === "undefined" || typeof Image === "undefined") return resolve(null);
      var image = new Image();
      image.onload = function () {
        try {
          var max = 600;
          var scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(image.naturalWidth * scale);
          canvas.height = Math.round(image.naturalHeight * scale);
          var context = canvas.getContext("2d");
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var data = canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
          var binary = atob(data);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          resolve({ bytes: bytes, width: canvas.width, height: canvas.height });
        } catch (error) { resolve(null); }
      };
      image.onerror = function () { resolve(null); };
      image.src = src;
    });
  }

  //  Satzspiegel in Twips (1/1440 Zoll). DIN 5008: links 25 mm, rechts
  //  20 mm; US Letter mit je einem Zoll.
  function page(state) {
    var letter = state.settings && state.settings.pageSize === "letter";
    return letter
      ? { w: 12240, h: 15840, left: 1440, right: 1440, top: 1080, bottom: 1080 }
      : { w: 11906, h: 16838, left: 1417, right: 1134, top: 1134, bottom: 1134 };
  }

  function sectionProps(p) {
    return '<w:sectPr><w:pgSz w:w="' + p.w + '" w:h="' + p.h + '"/><w:pgMar w:top="' + p.top +
      '" w:right="' + p.right + '" w:bottom="' + p.bottom + '" w:left="' + p.left +
      '" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
  }

  function documentXml(o, p, photo) {
    var width = p.w - p.left - p.right;
    var body = [];
    if (photo) {
      //  Fotohoehe 4,5 cm, die Breite folgt dem Seitenverhaeltnis.
      var height = 170;
      body.push(para(picture("rIdFoto", Math.round(height * photo.width / photo.height), height), null,
        '<w:spacing w:after="0"/><w:jc w:val="right"/>'));
    }
    //  Groesse und Fettung stehen zusaetzlich direkt am Text: viele Leser
    //  (Bewerbungssysteme, auch RickCVs eigener Import) werten die
    //  Formatvorlage nicht aus und erkennen den Namen nur so.
    var nameRun = run(o.name || doc("cvTitle", o.locale), '<w:b/><w:sz w:val="48"/>');
    body.push(para(o.link ? '<w:hyperlink r:id="rIdSource">' + nameRun + "</w:hyperlink>" : nameRun, "Title"));
    if (o.role) body.push(para(run(o.role, '<w:caps/><w:sz w:val="22"/>'), "Subtitle"));
    if (o.contact.length) body.push(para(run(o.contact.join("  ·  "), '<w:color w:val="555555"/>')));

    o.blocks.forEach(function (block) {
      body.push(para(run(block.title, '<w:b/><w:color w:val="286F6F"/><w:sz w:val="28"/>'), "Heading1"));
      (block.paragraphs || []).forEach(function (text) { body.push(para(run(text))); });
      (block.entries || []).forEach(function (entry) {
        body.push(entryHead(entry, width));
        if (entry.where) body.push(para(run(entry.where), "Ort"));
        entry.paragraphs.forEach(function (text) { body.push(para(run(text))); });
        entry.bullets.forEach(function (text) { body.push(bullet(text)); });
      });
      (block.bullets || []).forEach(function (text) { body.push(bullet(text)); });
    });

    if (o.place || o.date) {
      body.push(para(run([o.place, o.date].filter(Boolean).join(", ")), null, '<w:spacing w:before="360"/>'));
    }

    if (o.letter) {
      var l = o.letter;
      //  Neue Seite. Nach DIN 5008 (Form B) beginnt das Anschriftfeld 45 mm
      //  unter der Blattkante; davor steht der Absender als kleine Zeile.
      var sender = [o.name].concat(o.contact.slice(0, 2)).filter(Boolean).join(" · ");
      body.push(para('<w:r><w:br w:type="page"/></w:r>'));
      //  2551 Twips = 45 mm ab Blattkante; die Vermerkzone ist 17,7 mm hoch,
      //  danach beginnt die Anschrift (bei etwa 62,7 mm).
      body.push(para(run(sender, '<w:sz w:val="16"/><w:u w:val="single"/>'), null,
        '<w:spacing w:before="' + Math.max(0, 2551 - p.top) + '" w:after="760"/>'));
      l.recipient.forEach(function (line, index) {
        body.push(para(run(line), null, index === l.recipient.length - 1
          ? '<w:spacing w:after="720"/>' : '<w:spacing w:after="0"/>'));
      });
      body.push(para(run([o.place, o.date].filter(Boolean).join(", ")), null,
        '<w:spacing w:after="360"/><w:jc w:val="right"/>'));
      if (l.subject) body.push(para(run(l.subject, "<w:b/>"), null, '<w:spacing w:after="360"/>'));
      if (l.salutation) body.push(para(run(l.salutation), null, '<w:spacing w:after="160"/>'));
      l.paragraphs.forEach(function (text) { body.push(para(run(text), null, '<w:spacing w:after="160"/>')); });
      if (l.closing) body.push(para(run(l.closing), null, '<w:spacing w:before="160" w:after="720"/>'));
      if (o.name) body.push(para(run(o.name)));
    }

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      "<w:body>" + body.join("") + sectionProps(p) + "</w:body></w:document>";
  }

  /* ------------------------------------------- Das Dokument in der Datei */

  //  Damit eine exportierte Datei auf einem anderen Geraet wieder genau
  //  dieses Dokument ergibt (js/import.js, fromEmbedded): der ganze Stand
  //  als Datenteil (customXml – Word behaelt ihn beim Speichern), und ein
  //  RickCV-Link hinter dem Namen, der auch ein daraus erzeugtes PDF
  //  ueberlebt. carry = { json, link }, beides optional.
  function base64Utf8(text) {
    var bytes = new TextEncoder().encode(text);
    var out = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(out);
  }

  function carryParts(carry) {
    if (!carry || !carry.json) return { files: [], rel: "", type: "" };
    var guid = "{" + newGuid() + "}";
    return {
      files: [
        { name: "customXml/item1.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<rickcv xmlns="https://cv.rickinto.place/ns/document" version="1">' + base64Utf8(carry.json) + "</rickcv>" },
        { name: "customXml/itemProps1.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<ds:datastoreItem ds:itemID="' + guid + '" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs/></ds:datastoreItem>' },
        { name: "customXml/_rels/item1.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/></Relationships>' },
      ],
      rel: '<Relationship Id="rIdData" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item1.xml"/>',
      type: '<Override PartName="/customXml/itemProps1.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/>',
    };
  }

  function docx(state, carry) {
    var o = outline(state);
    var parts = carryParts(carry);
    var p = page(state);
    var lang = o.locale === "en" ? (state.settings && state.settings.pageSize === "letter" ? "en-US" : "en-GB") : "de-DE";
    var font = clean(state.style && state.style.fontFamily) || "Calibri";
    //  Wie der Titel des PDFs (render.js): "Bewerbung – Name" mit Anschreiben.
    var kind = doc(o.letter ? "applicationTitle" : "cvTitle", o.locale);
    var title = o.name ? kind + " – " + o.name : kind;
    return photoBytes(o.photo).then(function (photo) {
      var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
        (carry && carry.link ? '<Relationship Id="rIdSource" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xml(carry.link) + '" TargetMode="External"/>' : "") +
        parts.rel +
        (photo ? '<Relationship Id="rIdFoto" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto.jpg"/>' : "") +
        "</Relationships>";
      var files = [
        { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Default Extension="jpg" ContentType="image/jpeg"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
          parts.type +
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
          "</Types>" },
        { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
          "</Relationships>" },
        { name: "docProps/core.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
          'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
          "<dc:title>" + xml(title) + "</dc:title><dc:creator>" + xml(o.name) + "</dc:creator>" +
          "<dc:language>" + lang + "</dc:language></cp:coreProperties>" },
        { name: "word/_rels/document.xml.rels", data: rels },
        { name: "word/document.xml", data: documentXml(Object.assign({ link: carry && carry.link }, o), p, photo) },
        { name: "word/styles.xml", data: STYLES(lang, xml(font)) },
        { name: "word/numbering.xml", data: NUMBERING },
      ];
      if (photo) files.push({ name: "word/media/foto.jpg", data: photo.bytes });
      files = files.concat(parts.files);
      return zip(files);
    });
  }

  /* ------------------------------------------------- DOCX wie im Design */

  /*  Die Fassung, die aussieht wie das Dokument: gebaut aus dem Bauplan,
   *  den js/word-design.js im Vorschaurahmen vermisst. Jedes Blatt ist eine
   *  Tabelle ueber die ganze Seite (Seitenspalte und Hauptteil als Zellen,
   *  mit ihrer Flaeche), darin Absaetze mit den gemessenen Abstaenden und
   *  Tabellen fuer alles, was nebeneinander steht. Die Seitenraender sind
   *  null; die Raender des Themes stecken in den Zellen.
   *
   *  Masse: 1 CSS-Pixel = 15 Twips = 9525 EMU, Schriftgrad in halben Punkt
   *  (px · 1,5), Linien in Achtelpunkt (px · 6).
   */
  function twips(value) { return Math.max(0, Math.round((Number(value) || 0) * 15)); }

  function designedXml(design, p, media) {
    var drawing = 0;
    var fonts = {};

    function rPr(r) {
      var out = "";
      if (r.font) {
        fonts[r.font] = r.generic || "sans-serif";
        out += '<w:rFonts w:ascii="' + xml(r.font) + '" w:hAnsi="' + xml(r.font) + '" w:cs="' + xml(r.font) + '"/>';
      }
      if (r.bold) out += "<w:b/><w:bCs/>";
      if (r.italic) out += "<w:i/><w:iCs/>";
      if (r.caps) out += "<w:caps/>";
      if (r.smallCaps) out += "<w:smallCaps/>";
      if (r.strike) out += "<w:strike/>";
      if (r.color) out += '<w:color w:val="' + r.color + '"/>';
      if (r.spacing) out += '<w:spacing w:val="' + Math.floor(r.spacing * 15) + '"/>';
      if (r.size) {
        //  Abgerundet: Word setzt die meisten Schriften eine Spur breiter
        //  als der Browser, und ohne die Schrift des Designs ist die
        //  Ersatzschrift oft breiter – ein halber Punkt weniger haelt die
        //  Zeilen, wie sie im Dokument stehen.
        var sz = Math.max(2, Math.floor(r.size * 1.5));
        out += '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>';
      }
      if (r.underline) out += '<w:u w:val="single"/>';
      if (r.shade) out += '<w:shd w:val="clear" w:color="auto" w:fill="' + r.shade + '"/>';
      return out ? "<w:rPr>" + out + "</w:rPr>" : "";
    }

    function image(r) {
      var id = media.add(r.img);
      if (!id) return "";
      var cx = Math.max(1, Math.round(r.w * 9525));
      var cy = Math.max(1, Math.round(r.h * 9525));
      drawing += 1;
      return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
        '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + drawing + '" name="Bild ' + drawing + '"/>' +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:nvPicPr><pic:cNvPr id="' + drawing + '" name="bild' + drawing + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip r:embed="' + id + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>' +
        "</wp:inline></w:drawing></w:r>";
    }

    function runXml(r) {
      if (r.br) return "<w:r><w:br/></w:r>";
      if (r.img) return image(r);
      if (r.text === undefined || r.text === "") return "";
      return "<w:r>" + rPr(r) + '<w:t xml:space="preserve">' + xml(r.text) + "</w:t></w:r>";
    }

    //  Aufeinanderfolgende Laeufe mit demselben Ziel werden ein Link.
    function runsXml(runs) {
      var out = "";
      var i = 0;
      while (i < runs.length) {
        var href = runs[i].href;
        if (!href) { out += runXml(runs[i]); i++; continue; }
        var group = "";
        while (i < runs.length && runs[i].href === href) { group += runXml(runs[i]); i++; }
        var id = media.link(href);
        out += id ? '<w:hyperlink r:id="' + id + '">' + group + "</w:hyperlink>" : group;
      }
      return out;
    }

    function border(side, b) {
      return "<w:" + side + ' w:val="single" w:sz="' + Math.max(2, Math.round(b.width * 6)) +
        '" w:space="' + Math.min(31, Math.round((b.space || 0) * 0.75)) + '" w:color="' + b.color + '"/>';
    }

    function paraXml(node) {
      var pPr = "";
      if (node.heading) pPr += '<w:pStyle w:val="' + node.heading + '"/><w:keepNext/>';
      if (node.borderTop || node.borderBottom) {
        pPr += "<w:pBdr>" + (node.borderTop ? border("top", node.borderTop) : "") +
          (node.borderBottom ? border("bottom", node.borderBottom) : "") + "</w:pBdr>";
      }
      var spacing = '<w:spacing w:before="' + twips(node.before) + '" w:after="' + twips(node.after) + '"';
      if (node.tight && node.line) spacing += ' w:line="' + twips(node.line) + '" w:lineRule="exact"';
      else if (node.line && !node.picture) spacing += ' w:line="' + twips(node.line) + '" w:lineRule="atLeast"';
      else spacing += ' w:line="240" w:lineRule="auto"';
      pPr += spacing + "/>";
      var hanging = node.bullet ? twips(node.hanging) : 0;
      //  Der Text nach dem Aufzaehlungszeichen beginnt am Einzug.
      if (hanging) pPr = pPr.replace(/<w:spacing /, '<w:tabs><w:tab w:val="left" w:pos="' + twips(node.indL) + '"/></w:tabs><w:spacing ');
      pPr += '<w:ind w:left="' + twips(node.indL) + '" w:right="' + twips(node.indR) + '"' +
        (hanging ? ' w:hanging="' + hanging + '"' : "") + "/>";
      if (node.align && node.align !== "left") pPr += '<w:jc w:val="' + node.align + '"/>';
      var body = "";
      if (node.bullet) body += runXml(node.bullet) + "<w:r>" + rPr(node.bullet) + "<w:tab/></w:r>";
      body += runsXml(node.runs || []);
      return "<w:p><w:pPr>" + pPr + "</w:pPr>" + body + "</w:p>";
    }

    //  Ein Absatz fast ohne Hoehe: trennt Tabellen, traegt einen Abstand.
    function spacer(height, pageBreak) {
      var line = Math.max(15, twips(height));
      return "<w:p><w:pPr>" + (pageBreak ? "<w:pageBreakBefore/>" : "") +
        '<w:spacing w:before="0" w:after="0" w:line="' + line + '" w:lineRule="exact"/>' +
        '<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>';
    }

    function cellBorders(b) {
      if (!b) return "";
      return "<w:tcBorders>" + ["top", "left", "bottom", "right"].map(function (side) {
        return border(side, { width: b.width, color: b.color });
      }).join("") + "</w:tcBorders>";
    }

    function tableXml(node) {
      var cols = (node.cols || []).map(function (w) { return Math.max(15, twips(w)); });
      var total = cols.reduce(function (a, b) { return a + b; }, 0);
      var outer = node.border
        ? ["top", "left", "bottom", "right"].map(function (side) { return border(side, node.border); }).join("")
        : '<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>';
      var tblPr = '<w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/>' +
        (node.indL ? '<w:tblInd w:w="' + twips(node.indL) + '" w:type="dxa"/>' : "") +
        "<w:tblBorders>" + outer + '<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>' +
        '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/>' +
        '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000"/></w:tblPr>';
      var grid = "<w:tblGrid>" + cols.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join("") + "</w:tblGrid>";
      var height = node.page ? Math.max(15, twips(node.height) - 140) : node.height ? twips(node.height) : 0;
      var trPr = height ? '<w:trPr><w:trHeight w:val="' + height + '" w:hRule="' + (node.exact ? "exact" : "atLeast") + '"/></w:trPr>' : "";
      var cells = (node.cells || []).map(function (cell, index) {
        var pad = cell.pad || {};
        var tcPr = '<w:tcPr><w:tcW w:w="' + (cols[index] || 15) + '" w:type="dxa"/>' + cellBorders(cell.border) +
          (cell.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + cell.shade + '"/>' : "") +
          '<w:tcMar><w:top w:w="' + twips(pad.t) + '" w:type="dxa"/><w:left w:w="' + twips(pad.l) + '" w:type="dxa"/>' +
          '<w:bottom w:w="' + twips(pad.b) + '" w:type="dxa"/><w:right w:w="' + twips(pad.r) + '" w:type="dxa"/></w:tcMar>' +
          (cell.valign === "center" ? '<w:vAlign w:val="center"/>' : "") + "</w:tcPr>";
        return "<w:tc>" + tcPr + flowXml(cell.children || [], true) + "</w:tc>";
      }).join("");
      return "<w:tbl>" + tblPr + grid + "<w:tr>" + trPr + cells + "</w:tr></w:tbl>";
    }

    //  Eine Folge von Absaetzen und Tabellen. Vor einer Tabelle steht ihr
    //  Abstand als eigener schmaler Absatz; zwei Tabellen brauchen ohnehin
    //  einen dazwischen, sonst verschmilzt Word sie. Eine Zelle muss mit
    //  einem Absatz enden.
    function flowXml(nodes, inCell) {
      var out = "";
      var last = null;
      nodes.forEach(function (node) {
        if (!node) return;
        if (node.t === "table") {
          if (node.before > 0.5 || last === "table") out += spacer(Math.max(1, node.before || 0));
          out += tableXml(node);
          last = "table";
        } else {
          out += paraXml(node);
          last = "p";
        }
      });
      if (inCell && last !== "p") out += spacer(1);
      return out;
    }

    var body = "";
    design.sheets.forEach(function (sheet, index) {
      if (index > 0) body += spacer(1, true);
      body += tableXml(sheet.table);
    });
    body += spacer(1);
    var bg = design.sheets[0] && design.sheets[0].background;
    return {
      fonts: fonts,
      background: bg && bg !== "FFFFFF" ? bg : null,
      xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
        (bg && bg !== "FFFFFF" ? '<w:background w:color="' + bg + '"/>' : "") +
        "<w:body>" + body +
        '<w:sectPr><w:pgSz w:w="' + p.w + '" w:h="' + p.h + '"/>' +
        '<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>' +
        "</w:body></w:document>",
    };
  }

  //  Bilder und Links sammeln: jedes Bild nur einmal in der Datei, auch wenn
  //  dasselbe Symbol zwanzigmal vorkommt.
  function Media() {
    this.files = [];
    this.rels = [];
    this.bySrc = {};
    this.byHref = {};
  }

  Media.prototype.add = function (src) {
    if (this.bySrc[src]) return this.bySrc[src];
    var m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(src || "");
    if (!m) return null;
    var ext = m[1] === "png" ? "png" : "jpg";
    var binary = atob(m[2]);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var n = this.files.length + 1;
    var id = "rIdImg" + n;
    this.files.push({ name: "word/media/bild" + n + "." + ext, data: bytes });
    this.rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/bild' + n + "." + ext + '"/>');
    this.bySrc[src] = id;
    return id;
  };

  Media.prototype.link = function (href) {
    if (this.byHref[href]) return this.byHref[href];
    var id = "rIdLink" + (Object.keys(this.byHref).length + 1);
    this.rels.push('<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xml(href) + '" TargetMode="External"/>');
    this.byHref[href] = id;
    return id;
  };

  var FAMILY = { "sans-serif": "swiss", "system-ui": "swiss", serif: "roman", monospace: "modern", cursive: "script" };

  //  Die Schriften des Designs als TrueType (js/word-fonts.js, gebaut von
  //  tools/build-word-fonts.py). Gut zwei Megabyte – erst beim Export
  //  geladen. Fehlt das Buendel, wird eben nichts eingebettet.
  var fontsLoading = null;

  function wordFonts() {
    if (global.RickCVWordFonts) return Promise.resolve(global.RickCVWordFonts);
    if (typeof document === "undefined") return Promise.resolve(null);
    if (fontsLoading) return fontsLoading;
    fontsLoading = new Promise(function (resolve) {
      var script = document.createElement("script");
      script.src = "js/word-fonts.js";
      script.onload = function () { resolve(global.RickCVWordFonts || null); };
      script.onerror = function () { fontsLoading = null; resolve(null); };
      document.head.appendChild(script);
    });
    return fontsLoading;
  }

  function newGuid() {
    var bytes = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(bytes);
    else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    var hex = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("").toUpperCase();
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  //  ECMA-376 17.8.1: die ersten 32 Bytes der Schrift, verknuepft mit den
  //  Bytes des Schluessels in umgekehrter Reihenfolge.
  function obfuscate(base64, guid) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var hex = guid.replace(/-/g, "");
    var key = [];
    for (var k = 0; k < 16; k++) key.push(parseInt(hex.substr(k * 2, 2), 16));
    key.reverse();
    for (var j = 0; j < 32 && j < bytes.length; j++) bytes[j] ^= key[j % 16];
    return bytes;
  }

  //  Der Name (Absatzvorlage "Title") wird zum Link auf das Dokument.
  function linkNames(value, link) {
    if (Array.isArray(value)) { value.forEach(function (item) { linkNames(item, link); }); return; }
    if (!value || typeof value !== "object") return;
    if (value.t === "p" && value.heading === "Title") {
      (value.runs || []).forEach(function (r) { if (r.text !== undefined && !r.href) r.href = link; });
      return;
    }
    Object.keys(value).forEach(function (key) { if (key !== "runs") linkNames(value[key], link); });
  }

  function designedDocx(state, design, carry) {
    if (!design || !design.sheets || !design.sheets.length) return Promise.reject(new Error("design"));
    if (carry && carry.link) linkNames(design.sheets, carry.link);
    return wordFonts().then(function (bundle) { return buildDesigned(state, design, bundle, carry); });
  }

  function buildDesigned(state, design, bundle, carry) {
    var parts = carryParts(carry);
    var o = outline(state);
    var p = page(state);
    var lang = o.locale === "en" ? (state.settings && state.settings.pageSize === "letter" ? "en-US" : "en-GB") : "de-DE";
    var kind = doc(o.letter ? "applicationTitle" : "cvTitle", o.locale);
    var title = o.name ? kind + " – " + o.name : kind;
    var media = new Media();
    var built = designedXml(design, p, media);
    //  Eingebettete Schriften: Word zeigt sie, auch wenn sie auf dem Rechner
    //  fehlen. Nur die, die das Dokument wirklich benutzt.
    var fontFiles = [];
    var fontRels = [];
    var fontTable = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      Object.keys(built.fonts).map(function (name) {
        var generic = built.fonts[name];
        var embed = "";
        var faces = bundle && bundle[name];
        if (faces) {
          [["regular", "embedRegular"], ["bold", "embedBold"]].forEach(function (pair) {
            if (!faces[pair[0]]) return;
            var guid = newGuid();
            var n = fontFiles.length + 1;
            fontFiles.push({ name: "word/fonts/font" + n + ".odttf", data: obfuscate(faces[pair[0]], guid) });
            fontRels.push('<Relationship Id="rIdFont' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font' + n + '.odttf"/>');
            embed += "<w:" + pair[1] + ' r:id="rIdFont' + n + '" w:fontKey="{' + guid + '}"/>';
          });
        }
        return '<w:font w:name="' + xml(name) + '"><w:charset w:val="00"/><w:family w:val="' + (FAMILY[generic] || "swiss") + '"/>' +
          '<w:pitch w:val="' + (generic === "monospace" ? "fixed" : "variable") + '"/>' + embed + "</w:font>";
      }).join("") + "</w:fonts>";
    //  Ueberschriften als echte Formatvorlagen (Navigation, Vorlesen), aber
    //  ohne eigenes Aussehen: das steht direkt am Text.
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="' + lang + '"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/>' +
      '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      "</w:styles>";
    var settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      (built.background ? "<w:displayBackgroundShape/>" : "") +
      (fontFiles.length ? "<w:embedTrueTypeFonts/>" : "") +
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
      "</w:settings>";
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdFonts" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>' +
      '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      media.rels.join("") + parts.rel + "</Relationships>";
    var files = [
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>' +
        '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>' +
        '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
        parts.type +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        "</Types>" },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        "</Relationships>" },
      { name: "docProps/core.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
        "<dc:title>" + xml(title) + "</dc:title><dc:creator>" + xml(o.name) + "</dc:creator>" +
        "<dc:language>" + lang + "</dc:language></cp:coreProperties>" },
      { name: "word/_rels/document.xml.rels", data: rels },
      { name: "word/document.xml", data: built.xml },
      { name: "word/styles.xml", data: styles },
      { name: "word/fontTable.xml", data: fontTable },
      { name: "word/settings.xml", data: settings },
    ].concat(media.files, fontFiles, parts.files);
    if (fontRels.length) {
      files.push({ name: "word/_rels/fontTable.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + fontRels.join("") + "</Relationships>" });
    }
    return zip(files);
  }

  global.RickCVExportDocs = { markdown: markdown, docx: docx, designedDocx: designedDocx, outline: outline, _zip: zip };
})(typeof window !== "undefined" ? window : this);
