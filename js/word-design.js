/*  word-design.js – Das gezeichnete Dokument, vermessen fuer Word.
 *
 *  Laeuft im Vorschaurahmen (cv.html). Ein Theme ist CSS, und CSS laesst
 *  sich in Word nicht nachbauen. Was sich uebertragen laesst, ist das
 *  Ergebnis: wo jeder Block steht, wie breit er ist, welche Schrift, Farbe
 *  und Flaeche er hat. Das liest diese Datei aus dem fertigen Layout – fuer
 *  jedes Theme gleich, auch fuer ein selbst geschriebenes – und gibt einen
 *  kleinen Bauplan zurueck, aus dem js/export-docs.js die DOCX-Datei setzt:
 *
 *    Absatz    { t: "p", runs, before, after, indL, indR, align, ... }
 *    Tabelle   { t: "table", cols, cells, ... }   Spalten, Baender, Flaechen
 *    Bild      { img: "data:…", w, h }            als Lauf in einem Absatz
 *
 *  Die Raster kommen aus der Geometrie, nicht aus dem CSS: was im Dokument
 *  nebeneinander steht, wird eine Tabellenzeile; was untereinander steht,
 *  bekommt den gemessenen Abstand als Abstand vor dem Absatz. Symbole und
 *  das Foto werden zu Bildern. Masse in CSS-Pixeln, ungedreht und
 *  unskaliert – Umrechnung in Twips macht export-docs.js.
 *
 *  Was Word nicht kann, faellt weg: die Linien einer Zeitleiste, Verlaeufe,
 *  Schatten. Der Text bleibt vollstaendig und bearbeitbar.
 */
(function (global) {
  "use strict";

  var view = global;

  /* --------------------------------------------------------- Messen */

  //  Rechteck eines Elements relativ zum Blatt, in Satz-Pixeln.
  function boxer(sheet) {
    var origin = sheet.getBoundingClientRect();
    var scale = sheet.offsetWidth ? origin.width / sheet.offsetWidth : 1;
    if (!scale) scale = 1;
    return function (rect) {
      return {
        x: (rect.left - origin.left) / scale, y: (rect.top - origin.top) / scale,
        w: rect.width / scale, h: rect.height / scale,
      };
    };
  }

  function px(value) { return parseFloat(value) || 0; }

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    var style = view.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || px(style.opacity) === 0 && style.opacity !== "") return false;
    if (style.display === "contents") return true;
    var rect = el.getBoundingClientRect();
    if (!(rect.width > 0.5 && rect.height > 0.5)) return false;
    //  Nur fuer Vorleseprogramme da ("Kontakt" ueber den Kontaktdaten):
    //  ein Pixel gross und beschnitten. In Word waere es sichtbar.
    var clipped = (style.clip && style.clip !== "auto") || (style.clipPath && style.clipPath !== "none" && /inset\(50%|circle\(0/.test(style.clipPath));
    if (clipped) return false;
    if ((rect.width <= 2 || rect.height <= 2) && /hidden|clip/.test(style.overflow)) return false;
    return true;
  }

  //  Kinder, wobei display:contents durchsichtig ist – so bauen Einspaltig
  //  und Einstieg ihr Raster: die Spalten verschwinden, die Bloecke bleiben.
  function flowChildren(el) {
    var out = [];
    Array.prototype.forEach.call(el.children, function (child) {
      if (!visible(child)) return;
      if (/^(SCRIPT|STYLE|TEMPLATE)$/.test(child.tagName)) return;
      if (view.getComputedStyle(child).display === "contents") {
        out = out.concat(flowChildren(child));
      } else {
        out.push(child);
      }
    });
    return out;
  }

  var BLOCKY = /^(block|flex|grid|list-item|table|flow-root|table-row|table-cell|table-row-group)$/;



  //  Steht etwas Lesbares darin – Text, ein Bild, ein Symbol?
  function hasContent(el) {
    if (/^(IMG|svg)$/i.test(el.tagName)) return true;
    if ((el.textContent || "").trim()) return true;
    return !!el.querySelector("img, svg");
  }

  /* --------------------------------------------------------- Farben */

  //  Berechnete Farben kommen nicht nur als rgb(): color-mix() liefert
  //  "color(srgb …)" oder "oklab(…)". Die Leinwand versteht, was der
  //  Browser versteht – ein Punkt gemalt und zurueckgelesen.
  var colorCache = {};
  var probe = null;

  function parseColor(value) {
    if (!value || value === "transparent") return null;
    if (colorCache.hasOwnProperty(value)) return colorCache[value];
    var m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(value);
    var out = null;
    if (m) {
      out = { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4])) };
    } else {
      try {
        if (!probe) {
          var canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          probe = canvas.getContext("2d", { willReadFrequently: true });
        }
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "rgba(1, 2, 3, 0.004)";
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        var d = probe.getImageData(0, 0, 1, 1).data;
        out = d[3] ? { r: d[0], g: d[1], b: d[2], a: d[3] / 255 } : null;
      } catch (error) { out = null; }
    }
    colorCache[value] = out;
    return out;
  }

  //  Halbdurchsichtiges auf den Untergrund mischen: Word kennt keine
  //  Deckkraft bei Schrift und Schattierung.
  function hex(value, under) {
    var c = parseColor(value);
    if (!c || c.a === 0) return null;
    var base = under ? parseColor("rgb(" + under.r + "," + under.g + "," + under.b + ")") : { r: 255, g: 255, b: 255 };
    var mix = function (fg, bg) { return Math.round(fg * c.a + bg * (1 - c.a)); };
    var r = mix(c.r, base.r), g = mix(c.g, base.g), b = mix(c.b, base.b);
    return [r, g, b].map(function (n) { return ("0" + n.toString(16)).slice(-2); }).join("").toUpperCase();
  }

  function rgbOf(hexValue) {
    return hexValue ? { r: parseInt(hexValue.slice(0, 2), 16), g: parseInt(hexValue.slice(2, 4), 16), b: parseInt(hexValue.slice(4, 6), 16) } : null;
  }

  function background(el, under) {
    var style = view.getComputedStyle(el);
    var color = hex(style.backgroundColor, under);
    //  Ein Verlauf: seine erste Farbe ist besser als nichts.
    if (!color && /gradient/.test(style.backgroundImage)) {
      var first = /rgba?\([^)]+\)/.exec(style.backgroundImage);
      if (first) color = hex(first[0], under);
    }
    return color;
  }

  /* --------------------------------------------------------- Bilder */

  //  Jedes Bild wird erst spaeter (asynchron) gerastert; hier nur vormerken.
  function Pictures() {
    this.jobs = [];
  }

  Pictures.prototype.add = function (make) {
    var slot = { img: null };
    this.jobs.push(make().then(function (data) { slot.img = data; }, function () { slot.img = null; }));
    return slot;
  };

  Pictures.prototype.done = function () { return Promise.all(this.jobs); };

  //  Ein Symbol als eigenstaendiges SVG: die Farben, die sonst aus dem CSS
  //  kommen (currentColor, .rank-full), stehen danach direkt daran.
  function inlineSvg(svg, w, h) {
    var copy = svg.cloneNode(true);
    var from = [svg].concat(Array.prototype.slice.call(svg.querySelectorAll("*")));
    var to = [copy].concat(Array.prototype.slice.call(copy.querySelectorAll("*")));
    from.forEach(function (node, index) {
      var style = view.getComputedStyle(node);
      var target = to[index];
      ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity"].forEach(function (name) {
        var value = style.getPropertyValue(name);
        if (value) target.style.setProperty(name, value);
      });
      if (style.display === "none") target.setAttribute("display", "none");
    });
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", w);
    copy.setAttribute("height", h);
    copy.removeAttribute("class");
    return new XMLSerializer().serializeToString(copy);
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = src;
    });
  }

  var RES = 4; // Bildpunkte je CSS-Pixel: scharf auch gedruckt

  //  Optional ein Kreis oder eine Pille dahinter (der farbige Punkt einer
  //  Zeitleiste mit Symbol darin).
  function rasterSvg(svg, w, h, badge) {
    var markup = inlineSvg(svg, Math.max(1, Math.round(w * RES)), Math.max(1, Math.round(h * RES)));
    return loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup)).then(function (image) {
      var outer = badge || { w: w, h: h, x: 0, y: 0 };
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(outer.w * RES));
      canvas.height = Math.max(1, Math.round(outer.h * RES));
      var context = canvas.getContext("2d");
      if (badge && badge.fill) {
        context.fillStyle = "#" + badge.fill;
        roundRect(context, 0, 0, canvas.width, canvas.height, badge.radius * RES);
        context.fill();
      }
      context.drawImage(image, (badge ? badge.x : 0) * RES, (badge ? badge.y : 0) * RES, w * RES, h * RES);
      return { src: canvas.toDataURL("image/png"), w: outer.w, h: outer.h };
    });
  }

  function roundRect(context, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  //  Das Foto, wie es dasteht: Ausschnitt (object-fit), runde Ecken, Kreis.
  function rasterPhoto(img, w, h) {
    var style = view.getComputedStyle(img);
    var holder = img.parentElement ? view.getComputedStyle(img.parentElement) : style;
    var radius = Math.max(radiusOf(style, w, h), img.parentElement ? radiusOf(holder, w, h) : 0);
    return loadImage(img.currentSrc || img.src).then(function (image) {
      var canvas = document.createElement("canvas");
      var scale = Math.min(3, Math.max(1, 900 / Math.max(w, h)));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var context = canvas.getContext("2d");
      var nw = image.naturalWidth, nh = image.naturalHeight;
      var fit = style.objectFit || "fill";
      var sx = 0, sy = 0, sw = nw, sh = nh;
      if (fit === "cover") {
        var ratio = Math.max(w / nw, h / nh);
        sw = w / ratio; sh = h / ratio;
        var pos = (style.objectPosition || "50% 50%").split(" ");
        var fx = /%$/.test(pos[0]) ? parseFloat(pos[0]) / 100 : 0.5;
        var fy = /%$/.test(pos[1] || "") ? parseFloat(pos[1]) / 100 : 0.5;
        sx = (nw - sw) * fx; sy = (nh - sh) * fy;
      }
      if (radius > 0) {
        roundRect(context, 0, 0, canvas.width, canvas.height, radius * scale);
        context.clip();
      } else {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return {
        src: radius > 0 ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9),
        w: w, h: h,
      };
    });
  }

  function radiusOf(style, w, h) {
    var raw = style.borderTopLeftRadius || "0";
    var value = parseFloat(raw) || 0;
    if (/%/.test(raw)) value = Math.min(w, h) * value / 100;
    return value;
  }

  /* --------------------------------------------------------- Text */

  function family(style) {
    var parts = (style.fontFamily || "").split(",").map(function (part) {
      return part.replace(/["']/g, "").trim();
    }).filter(Boolean);
    var generic = parts.filter(function (part) { return /^(serif|sans-serif|monospace|system-ui|cursive)$/.test(part); })[0] || "sans-serif";
    var name = parts.filter(function (part) { return !/^(serif|sans-serif|monospace|system-ui|cursive|-apple-system|ui-[a-z-]+)$/.test(part); })[0] || "";
    return { name: name, generic: generic };
  }

  function runStyle(el, under) {
    var style = view.getComputedStyle(el);
    var font = family(style);
    var weight = parseInt(style.fontWeight, 10) || (style.fontWeight === "bold" ? 700 : 400);
    var spacing = style.letterSpacing === "normal" ? 0 : px(style.letterSpacing);
    var deco = style.textDecorationLine || style.textDecoration || "";
    return {
      font: font.name, generic: font.generic, size: px(style.fontSize),
      bold: weight >= 600, italic: style.fontStyle === "italic" || style.fontStyle === "oblique",
      color: hex(style.color, under) || "000000",
      caps: style.textTransform === "uppercase", smallCaps: /small-caps/.test(style.fontVariantCaps || style.fontVariant || ""),
      spacing: spacing, underline: /underline/.test(deco), strike: /line-through/.test(deco),
      transform: style.textTransform,
    };
  }

  function transform(text, how) {
    if (how === "lowercase") return text.toLowerCase();
    if (how === "capitalize") return text.replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
    return text;
  }

  //  Was ::before und ::after an Text einfuegen ("–", "·", ein Pfeil).
  function pseudoText(el, which) {
    var content = view.getComputedStyle(el, which).content;
    if (!content || content === "none" || content === "normal") return "";
    var m = /^"(.*)"$/.exec(content);
    return m ? m[1].replace(/\\([0-9a-f]{1,6})\s?/gi, function (all, code) {
      return String.fromCodePoint(parseInt(code, 16));
    }) : "";
  }

  /* --------------------------------------------------------- Umsetzen */

  //  Koordinaten: Ein Rahmen (frame) ist die Zelle in Word, in der gerade
  //  geschrieben wird – x und w in Blatt-Pixeln. Einzuege messen sich an
  //  ihm, Abstaende am Vorgaenger.

  function Converter(sheet, pictures) {
    this.box = boxer(sheet);
    this.pictures = pictures;
  }

  Converter.prototype.rect = function (el) {
    return this.box(el.getBoundingClientRect());
  };

  //  Innenkasten: ohne Rand und Innenabstand.
  Converter.prototype.inner = function (el) {
    var r = this.rect(el);
    var s = view.getComputedStyle(el);
    var l = px(s.borderLeftWidth) + px(s.paddingLeft), t = px(s.borderTopWidth) + px(s.paddingTop);
    var rr = px(s.borderRightWidth) + px(s.paddingRight), b = px(s.borderBottomWidth) + px(s.paddingBottom);
    return { x: r.x + l, y: r.y + t, w: Math.max(0, r.w - l - rr), h: Math.max(0, r.h - t - b) };
  };

  Converter.prototype.rangeRect = function (nodes) {
    var range = document.createRange();
    range.setStartBefore(nodes[0]);
    range.setEndAfter(nodes[nodes.length - 1]);
    return this.box(range.getBoundingClientRect());
  };

  //  Steht ein Element auf eigener Zeile (oder neben anderen, aber als
  //  Kasten)? Kinder einer Flex- oder Rasterzeile sind es immer.
  function blockLevel(el) {
    var style = view.getComputedStyle(el);
    if (style.position === "absolute" || style.position === "fixed") return true;
    if (style.float && style.float !== "none") return true;
    return BLOCKY.test(style.display);
  }

  function hasBlockInside(el) {
    if (/^svg$/i.test(el.tagName)) return false;
    return Array.prototype.some.call(el.children, function (child) {
      if (!visible(child)) return false;
      var style = view.getComputedStyle(child);
      if (style.display === "contents") return hasBlockInside(child);
      return blockLevel(child) || (!/inline-(block|flex|grid)/.test(style.display) && hasBlockInside(child));
    });
  }

  function meaningful(node) {
    return node.nodeType === 1 || (node.nodeType === 3 && node.nodeValue.trim());
  }

  //  Die Bestandteile eines Elements, wie CSS sie setzt: Kaesten fuer sich,
  //  Text und Inline-Elemente dazwischen als Zeilengruppen. Ein Inline-
  //  Element mit einem Kasten darin wird aufgeteilt (block-in-inline).
  Converter.prototype.items = function (el) {
    var self = this;
    var out = [];
    var group = null;
    function flush() {
      if (group && group.nodes.some(meaningful)) {
        var nodes = group.nodes;
        while (nodes.length && nodes[0].nodeType === 3 && !nodes[0].nodeValue.trim()) nodes.shift();
        while (nodes.length && nodes[nodes.length - 1].nodeType === 3 && !nodes[nodes.length - 1].nodeValue.trim()) nodes.pop();
        if (nodes.length) {
          group.r = self.rangeRect(nodes);
          if (group.r.w > 0.5 || group.r.h > 0.5) out.push(group);
        }
      }
      group = null;
    }
    function add(node) {
      if (!group) group = { inline: true, nodes: [], parent: el };
      group.nodes.push(node);
    }
    function visit(parent) {
      Array.prototype.forEach.call(parent.childNodes, function (node) {
        if (node.nodeType === 3) { add(node); return; }
        if (node.nodeType === 1 && node.tagName === "BR") { add(node); return; }
        if (node.nodeType !== 1 || !visible(node) || /^(SCRIPT|STYLE|TEMPLATE)$/.test(node.tagName)) return;
        var style = view.getComputedStyle(node);
        if (style.display === "contents") { visit(node); return; }
        if (blockLevel(node)) { flush(); out.push({ el: node, r: self.rect(node) }); return; }
        if (hasBlockInside(node)) { visit(node); return; }
        add(node);
      });
    }
    visit(el);
    flush();
    return out;
  };

  //  Die Laeufe einer Zeilengruppe, in Lesereihenfolge.
  Converter.prototype.runs = function (nodes, stop, under) {
    var self = this;
    var out = [];
    function walk(node, insideLink) {
      if (node.nodeType === 3) {
        var parent = node.parentElement;
        var style = view.getComputedStyle(parent);
        var text = node.nodeValue;
        if (!/pre/.test(style.whiteSpace)) text = text.replace(/\s+/g, " ");
        if (!text) return;
        var props = runStyle(parent, under);
        out.push(Object.assign({ text: transform(text, props.transform), href: insideLink || null }, props, {
          shade: inlineShade(parent, stop, under),
        }));
        return;
      }
      if (node.nodeType === 1 && node.tagName === "BR") {
        if (view.getComputedStyle(node).display !== "none") out.push({ br: true });
        return;
      }
      if (node.nodeType !== 1 || !visible(node)) return;
      var tag = node.tagName;
      if (tag === "IMG") {
        var ir = self.rect(node);
        out.push({ pic: self.pictures.add(function () { return rasterPhoto(node, ir.w, ir.h); }), w: ir.w, h: ir.h });
        return;
      }
      if (/^svg$/i.test(tag)) {
        var sr = self.rect(node);
        if (sr.w < 1 || sr.h < 1) return;
        out.push({ pic: self.pictures.add(function () { return rasterSvg(node, sr.w, sr.h); }), w: sr.w, h: sr.h });
        var ns = view.getComputedStyle(node);
        if (px(ns.marginRight) > 1 || px(ns.paddingRight) > 1) out.push({ text: " ", size: px(ns.fontSize) || 10, gap: true });
        return;
      }
      //  Der Link aus dem "PDF zum Weiterbearbeiten" gehoert nicht in Word.
      var link = tag === "A" && !node.classList.contains("rickcv-source") &&
        /^(https?:|mailto:|tel:)/.test(node.getAttribute("href") || "") ? node.getAttribute("href") : insideLink;
      var before = pseudoText(node, "::before");
      if (before) out.push(Object.assign({ text: before }, runStyle(node, under)));
      Array.prototype.forEach.call(node.childNodes, function (child) { walk(child, link); });
      var after = pseudoText(node, "::after");
      if (after) out.push(Object.assign({ text: after }, runStyle(node, under)));
      //  Inline-Bloecke mit Abstand dazwischen (Plaketten, Symbolzeilen):
      //  ein Leerzeichen haelt sie auseinander.
      var inlineStyle = view.getComputedStyle(node);
      if (/inline-(block|flex)/.test(inlineStyle.display) && (px(inlineStyle.marginRight) > 1 || px(inlineStyle.paddingRight) > 1)) {
        out.push({ text: " ", size: px(inlineStyle.fontSize), gap: true });
      }
    }
    nodes.forEach(function (node) { walk(node, null); });
    return trimRuns(out);
  };

  //  Leerraum an den Enden eines Absatzes faellt weg, wie im Browser.
  function trimRuns(out) {
    while (out.length && out[0].text !== undefined && !out[0].text.trim() && !out[0].pic) out.shift();
    while (out.length && out[out.length - 1].text !== undefined && !out[out.length - 1].text.trim()) out.pop();
    if (out.length && out[0].text) out[0].text = out[0].text.replace(/^\s+/, "");
    if (out.length && out[out.length - 1].text) out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, "");
    return out;
  }

  //  Eine Plakette: die Flaeche eines Inline-Elements wird zur Schattierung
  //  seines Textes.
  function inlineShade(node, stop, under) {
    for (var el = node; el && el !== stop; el = el.parentElement) {
      var style = view.getComputedStyle(el);
      if (!/inline/.test(style.display)) break;
      var color = hex(style.backgroundColor, under);
      if (color) return color;
    }
    return null;
  }

  //  Ein Absatz: die Laeufe, und vom Element (owner) Ausrichtung, Rand und
  //  Innenabstand. box: wo der Text steht; frame: die Word-Zelle.
  Converter.prototype.paragraph = function (owner, runs, box, frame, gap, under, own, text) {
    if (!runs.length) return null;
    var s = view.getComputedStyle(owner);
    var p = {
      t: "p", runs: runs,
      before: Math.max(0, gap) + (own ? px(s.paddingTop) + px(s.borderTopWidth) : 0),
      after: own ? px(s.paddingBottom) + px(s.borderBottomWidth) : 0,
      indL: Math.max(0, box.x - frame.x),
      indR: Math.max(0, frame.x + frame.w - (box.x + box.w)),
      align: alignOf(s.textAlign),
      line: s.lineHeight === "normal" ? 0 : px(s.lineHeight),
      heading: own ? headingOf(owner) : null,
    };
    //  Eine Zeile im Browser soll in Word nicht umbrechen, nur weil die
    //  Schrift dort ein paar Prozent breiter laeuft: die Seite, zu der sie
    //  nicht ausgerichtet ist, bekommt den Platz bis zum Zellenrand.
    var lineHeight = p.line || px(s.fontSize) * 1.3;
    var single = (text || box).h < lineHeight * 1.6;
    //  Wo der Text wirklich steht, sagt mehr als text-align: Themes
    //  zentrieren auch ueber Flex, Tabellen oder Ziertext daneben.
    if (single && text && p.align === "left" && box.w - text.w > 8) {
      var leftGap = text.x - box.x, rightGap = box.x + box.w - (text.x + text.w);
      if (Math.abs(leftGap - rightGap) < 4) p.align = "center";
      else if (rightGap < 2 && leftGap > 6) p.align = "right";
    }
    if (single && !runs.some(function (r) { return r.pic && r.h > lineHeight * 2; })) {
      if (p.align === "left" || p.align === "both") p.indR = 0;
      else if (p.align === "right") p.indL = 0;
    }
    if (own) {
      var bottom = px(s.borderBottomWidth) && s.borderBottomStyle !== "none" ? hex(s.borderBottomColor, under) : null;
      var top = px(s.borderTopWidth) && s.borderTopStyle !== "none" ? hex(s.borderTopColor, under) : null;
      if (bottom) p.borderBottom = { color: bottom, width: px(s.borderBottomWidth), space: px(s.paddingBottom) };
      if (top) p.borderTop = { color: top, width: px(s.borderTopWidth), space: px(s.paddingTop) };
      if (bottom) p.after = 0;
      if (top) p.before = Math.max(0, gap);
      if (owner.tagName === "LI") {
        var marker = listMarker(owner);
        if (marker) {
          //  Das Zeichen steht im Browser links neben dem Text. In Word
          //  braucht es den Platz im Einzug, sonst springt der Text zum
          //  naechsten Tabstopp.
          p.bullet = Object.assign({ text: marker }, runStyle(owner, under));
          p.hanging = Math.max(8, px(s.fontSize) * 0.95);
          p.indL = Math.max(p.indL, p.hanging);
        }
      }
    }
    return p;
  };

  function alignOf(value) {
    if (value === "center") return "center";
    if (value === "right" || value === "end") return "right";
    if (value === "justify") return "both";
    return "left";
  }

  function headingOf(el) {
    var tag = el.tagName;
    if (tag === "H1") return "Title";
    if (tag === "H2" || el.classList.contains("resume_title")) return "Heading1";
    if (tag === "H3") return "Heading2";
    return null;
  }

  function listMarker(el) {
    var style = view.getComputedStyle(el);
    if (pseudoText(el, "::before")) return null; // steht schon als Lauf da
    var type = style.listStyleType;
    if (!type || type === "none" || style.display !== "list-item") return null;
    if (type === "disc") return "•";
    if (type === "circle") return "◦";
    if (type === "square") return "▪";
    if (/^"/.test(type)) return type.replace(/^"|"$/g, "");
    var index = Array.prototype.indexOf.call(el.parentElement.children, el) + 1;
    return index + ".";
  }

  //  Ein Bestandteil: Zeilengruppe, Bild, Symbol, Balken, Kasten.
  Converter.prototype.block = function (item, frame, gap, under) {
    var self = this;
    if (item.inline) {
      var parent = item.parent;
      var box = this.inner(parent);
      var p = this.paragraph(parent, this.runs(item.nodes, parent, under), { x: box.x, y: item.r.y, w: box.w, h: item.r.h }, frame, gap, under, false, item.r);
      return p ? [p] : [];
    }
    var el = item.el;
    var s = view.getComputedStyle(el);
    if (!hasContent(el) && !background(el, under)) return [];
    if (el.tagName === "IMG") {
      var ir = this.rect(el);
      return [this.picturePara(this.pictures.add(function () { return rasterPhoto(el, ir.w, ir.h); }), ir, frame, gap)];
    }
    if (/^svg$/i.test(el.tagName)) {
      var sr = this.rect(el);
      return [this.picturePara(this.pictures.add(function () { return rasterSvg(el, sr.w, sr.h); }), sr, frame, gap)];
    }
    if (el.classList.contains("language_bar")) return this.bar(el, frame, gap, under);
    var badge = this.badge(el, under);
    if (badge) return [this.picturePara(badge.slot, badge.rect, frame, gap)];

    var fill = background(el, under);
    var border = boxBorder(s, under);
    if (fill || border) return this.boxed(el, frame, gap, under, fill, border);

    var kids = this.items(el);
    var before = pseudoText(el, "::before");
    var after = pseudoText(el, "::after");
    if (kids.length === 1 && kids[0].inline) {
      var runs = this.runs(kids[0].nodes, el, under);
      if (before) runs.unshift(Object.assign({ text: before }, runStyle(el, under)));
      if (after) runs.push(Object.assign({ text: after }, runStyle(el, under)));
      var own = this.inner(el);
      var para = this.paragraph(el, trimRuns(runs), own, frame, gap, under, true, kids[0].r);
      return para ? [para] : [];
    }
    //  Rand und Innenabstand oben gehoeren zum Abstand vor dem ersten Kind;
    //  die Einzuege messen sich weiter an der Word-Zelle.
    var inner = this.inner(el);
    var nodes = this.list(kids, { x: frame.x, y: inner.y, w: frame.w, h: inner.h }, gap + px(s.paddingTop) + px(s.borderTopWidth), under);
    //  Eine Linie unter einem Block mit mehreren Zeilen (Ueberschrift mit
    //  Symbol und Text): an den letzten Absatz.
    var bottomColor = px(s.borderBottomWidth) && s.borderBottomStyle !== "none" ? hex(s.borderBottomColor, under) : null;
    if (bottomColor) {
      var last = lastParagraph(nodes);
      if (last) last.borderBottom = { color: bottomColor, width: px(s.borderBottomWidth), space: px(s.paddingBottom) };
    }
    if (/^H[1-3]$/.test(el.tagName)) {
      var first = firstParagraph(nodes);
      if (first) first.heading = headingOf(el);
    }
    void self;
    return nodes;
  };

  function firstParagraph(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      if (node.t === "p" && !node.picture) return node;
      if (node.t === "table") {
        for (var c = 0; c < node.cells.length; c++) {
          var found = firstParagraph(node.cells[c].children || []);
          if (found) return found;
        }
      }
    }
    return null;
  }

  function lastParagraph(nodes) {
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i] && nodes[i].t === "p") return nodes[i];
    }
    return null;
  }

  //  Ein farbiger Punkt mit Symbol (Zeitleiste): als ein Bild.
  Converter.prototype.badge = function (el, under) {
    var svg = el.querySelector("svg");
    if (!svg || (el.textContent || "").trim()) return null;
    var fill = background(el, under);
    if (!fill) return null;
    var r = this.rect(el);
    if (r.w > 48 || r.h > 48) return null;
    var sr = this.rect(svg);
    var s = view.getComputedStyle(el);
    var slot = this.pictures.add(function () {
      return rasterSvg(svg, sr.w, sr.h, { w: r.w, h: r.h, x: sr.x - r.x, y: sr.y - r.y, fill: fill, radius: radiusOf(s, r.w, r.h) });
    });
    return { slot: slot, rect: r };
  };

  Converter.prototype.picturePara = function (slot, r, frame, gap) {
    return { t: "p", runs: [{ pic: slot, w: r.w, h: r.h }], before: Math.max(0, gap), after: 0,
             indL: Math.max(0, r.x - frame.x), indR: 0, align: "left", line: 0, picture: true };
  };

  function boxBorder(s, under) {
    var sides = ["Top", "Right", "Bottom", "Left"];
    var all = sides.every(function (side) {
      return px(s["border" + side + "Width"]) > 0 && s["border" + side + "Style"] !== "none";
    });
    if (!all) return null;
    return { color: hex(s.borderTopColor, under) || "000000", width: px(s.borderTopWidth) };
  }

  //  Flaeche oder Rahmen: eine Tabelle mit einer Zelle, die Innenabstaende
  //  als Zellraender.
  Converter.prototype.boxed = function (el, frame, gap, under, fill, border) {
    var s = view.getComputedStyle(el);
    var r = this.rect(el);
    var inner = this.inner(el);
    var shade = fill ? rgbOf(fill) : under;
    //  Ein wenig Reserve, falls Word den Text breiter setzt – aber nicht
    //  ueber den Rahmen hinaus.
    var room = Math.max(r.w, frame.x + frame.w - r.x);
    var width = Math.min(room, r.w * 1.02 + 1);
    var cellFrame = { x: inner.x, y: inner.y, w: inner.w + (width - r.w), h: inner.h };
    var kids = this.items(el);
    var content;
    if (kids.length === 1 && kids[0].inline) {
      var p = this.paragraph(el, this.runs(kids[0].nodes, el, under === shade ? under : shade), inner, cellFrame, 0, shade, false);
      content = p ? [p] : [];
    } else {
      content = this.list(kids, cellFrame, 0, shade);
    }
    return [{
      t: "table", before: Math.max(0, gap), indL: Math.max(0, r.x - frame.x),
      cols: [width], height: 0,
      cells: [{ shade: fill, border: border, radius: radiusOf(s, r.w, r.h),
        pad: { t: px(s.paddingTop), r: px(s.paddingRight), b: px(s.paddingBottom), l: px(s.paddingLeft) },
        children: content }],
    }];
  };

  //  Der Sprachbalken: eine Tabelle aus Fuellung und Rest.
  Converter.prototype.bar = function (el, frame, gap, under) {
    var p = el.querySelector("p") || el;
    var fillEl = el.querySelector("span");
    var r = this.rect(p);
    var fr = fillEl ? this.rect(fillEl) : { w: 0 };
    var es = view.getComputedStyle(el);
    var outline = hex(es.outlineColor, under) || hex(es.borderTopColor, under);
    var outlineWidth = px(es.outlineWidth) || px(es.borderTopWidth);
    var color = fillEl ? background(fillEl, under) : null;
    var share = r.w ? Math.max(0, Math.min(1, fr.w / r.w)) : 0;
    var label = fillEl ? (fillEl.textContent || "").trim() : "";
    var outside = el.getAttribute("data-level") === "outside";
    var textStyle = fillEl ? runStyle(fillEl, color ? rgbOf(color) : under) : null;
    var run = label ? [Object.assign({ text: label }, textStyle)] : [];
    var indent = fillEl ? px(view.getComputedStyle(fillEl).paddingLeft) + 1 : 1;
    var labelPara = function (runs) { return { t: "p", runs: runs, before: 0, after: 0, indL: indent, indR: 0, align: "left", line: r.h, tight: true }; };
    var cells = [];
    var widthFill = Math.round(r.w * share * 100) / 100;
    if (widthFill > 0.5) cells.push({ w: widthFill, shade: color, children: [labelPara(outside ? [] : run)] });
    if (r.w - widthFill > 0.5) cells.push({ w: r.w - widthFill, shade: null, children: [labelPara(outside || !cells.length ? run : [])] });
    return [{
      t: "table", before: Math.max(0, gap), indL: Math.max(0, r.x - frame.x), height: r.h, exact: true,
      cols: cells.map(function (c) { return c.w; }),
      border: outline && outlineWidth ? { color: outline, width: outlineWidth } : null,
      cells: cells.map(function (c) { return { shade: c.shade, pad: { t: 0, r: 0, b: 0, l: 0 }, children: c.children, valign: "center" }; }),
    }];
  };

  //  Bestandteile untereinander oder nebeneinander. Was nebeneinander steht,
  //  wird eine Tabellenzeile; der Abstand zum Vorgaenger kommt aus der
  //  Geometrie. Ein schwebendes Element (float) vor einem Text wird Teil
  //  von dessen erster Zeile – so stehen Zeitraeume in Clean vor dem Titel.
  Converter.prototype.list = function (items, frame, gap, under) {
    var self = this;
    items = items.filter(function (item) {
      if (item.inline) return true;
      var el = item.el;
      if (!hasContent(el) && !background(el, under)) return false;
      //  Absolut gesetzte Verzierungen ohne Text (Linien, Punkte) fallen weg.
      var position = view.getComputedStyle(el).position;
      return !(position === "absolute" && !(el.textContent || "").trim() && !/^(svg|img)$/i.test(el.tagName) && !el.querySelector("img, svg"));
    });

    //  Ein gesetztes Symbol, das ueber einem anderen Bestandteil liegt (der
    //  Punkt einer Zeitleiste ueber dem Rand der Station), ist Verzierung:
    //  als eigene Zeile schoebe es alles nach unten.
    items = items.filter(function (item) {
      if (item.inline || view.getComputedStyle(item.el).position !== "absolute") return true;
      return !items.some(function (other) {
        return other !== item && (other.inline || view.getComputedStyle(other.el).position !== "absolute") &&
          overlapX(other.r, item.r) && overlapY(other.r, item.r);
      });
    });

    var floats = [];
    items.forEach(function (item) {
      if (item.inline) return;
      var style = view.getComputedStyle(item.el);
      if (!style.float || style.float === "none") return;
      var host = items.filter(function (other) {
        return other !== item && !other.floatInto && overlapX(other.r, item.r) && Math.abs(other.r.y - item.r.y) < 4 &&
          other.r.h >= item.r.h * 0.8;
      })[0];
      if (host) { host.prefix = (host.prefix || []).concat([item]); floats.push(item); item.floatInto = host; }
    });
    items = items.filter(function (item) { return floats.indexOf(item) === -1; });

    var rows = [];
    items.forEach(function (item) {
      var row = rows.filter(function (candidate) {
        return candidate.some(function (other) { return overlapY(other.r, item.r) && !overlapX(other.r, item.r); });
      })[0];
      if (row) row.push(item);
      else rows.push([item]);
    });
    rows.forEach(function (row) { row.sort(function (a, b) { return a.r.x - b.r.x; }); });
    rows.sort(function (a, b) { return top(a) - top(b); });

    var out = [];
    var cursor = frame.y;
    var first = true;
    rows.forEach(function (row) {
      var y = top(row);
      var space = first ? Math.max(0, y - frame.y) + Math.max(0, gap) : Math.max(0, y - cursor);
      //  Ein grosser Abstand ist fast immer ein dehnbarer (margin: auto,
      //  Fussleiste am Blattende). In Word laeuft der Text oft etwas
      //  laenger; ohne Reserve rutschte die Fussleiste auf ein neues Blatt.
      if (!first && space > 90) space -= Math.min(space * 0.5, 70);
      first = false;
      var merged = row.length > 1 ? self.mergeText(row, frame, space, under) : null;
      if (merged) {
        out.push(merged);
      } else if (row.length === 1) {
        out = out.concat(self.withPrefix(row[0], frame, space, under));
      } else {
        out.push(self.row(row, frame, space, under));
      }
      cursor = Math.max(cursor, bottom(row));
    });
    return out;
  };

  //  Texte, die nebeneinander stehen wie Woerter einer Zeile ("Musterstr. 4,"
  //  und "12345 Musterstadt" als zwei Flex-Kinder): ein Absatz. In zwei
  //  knappen Zellen braeche jeder fuer sich um, sobald Word breiter setzt.
  Converter.prototype.mergeText = function (row, frame, gap, under) {
    var self = this;
    var parts = [];
    for (var i = 0; i < row.length; i++) {
      var item = row[i];
      if (item.prefix) return null;
      var nodes;
      var owner;
      if (item.inline) { nodes = item.nodes; owner = item.parent; }
      else {
        var style = view.getComputedStyle(item.el);
        if (/^(svg|img)$/i.test(item.el.tagName) || item.el.querySelector("svg, img")) return null;
        if (background(item.el, under) || boxBorder(style, under)) return null;
        var kids = this.items(item.el);
        if (kids.length !== 1 || !kids[0].inline) return null;
        nodes = kids[0].nodes; owner = item.el;
      }
      var size = px(view.getComputedStyle(owner).fontSize) || 12;
      if (item.r.h > size * 2.2) return null; // mehrzeilig: eigene Spalte
      if (i > 0) {
        var prev = row[i - 1].r;
        var space = item.r.x - (prev.x + prev.w);
        if (space > size * 1.2 || space < -1) return null;
        if (Math.abs(item.r.y - prev.y) > size * 0.6) return null;
      }
      parts.push({ owner: owner, nodes: nodes, item: item });
    }
    var runs = [];
    parts.forEach(function (part, index) {
      var own = self.runs(part.nodes, part.owner, under);
      if (!part.item.inline) {
        var before = pseudoText(part.owner, "::before"), after = pseudoText(part.owner, "::after");
        if (before) own.unshift(Object.assign({ text: before }, runStyle(part.owner, under)));
        if (after) own.push(Object.assign({ text: after }, runStyle(part.owner, under)));
      }
      //  Zwei Kaesten nebeneinander sind zwei Woerter: ein Leerzeichen
      //  dazwischen, wenn nicht schon eines dasteht.
      if (index > 0 && own.length && runs.length) {
        var tail = runs[runs.length - 1].text || "";
        if (!/\s$/.test(tail) && !/^\s/.test(own[0].text || "")) runs.push(Object.assign({ text: " " }, runStyle(part.owner, under)));
      }
      runs = runs.concat(own);
    });
    var first = row[0].r, last = row[row.length - 1].r;
    var box = { x: first.x, y: first.y, w: last.x + last.w - first.x, h: Math.max.apply(null, row.map(function (it) { return it.r.h; })) };
    var owner = parts[0].owner.parentElement || parts[0].owner;
    var p = this.paragraph(parts[0].owner, trimRuns(runs), box, frame, gap, under, false, box);
    if (!p) return null;
    //  Ausrichtung der Zeile: wo sie im umgebenden Kasten steht.
    var around = this.inner(owner);
    var leftGap = box.x - around.x, rightGap = around.x + around.w - (box.x + box.w);
    if (rightGap < 3 && leftGap > 6) { p.align = "right"; p.indL = 0; p.indR = Math.max(0, frame.x + frame.w - (box.x + box.w)); }
    return p;
  };

  Converter.prototype.withPrefix = function (item, frame, gap, under) {
    var self = this;
    var nodes = this.block(item, frame, gap, under);
    if (!item.prefix) return nodes;
    var target = firstParagraph(nodes);
    if (!target) return nodes;
    var lead = [];
    item.prefix.forEach(function (floated) {
      var runs = self.runs([floated.el], floated.el, under);
      if (!runs.length) return;
      lead = lead.concat(runs);
      if (!runs[runs.length - 1].pic || !runs[runs.length - 1].gap) lead.push(Object.assign({ text: " " }, runStyle(floated.el, under)));
    });
    target.runs = lead.concat(target.runs);
    target.indL = Math.min(target.indL, Math.max(0, item.prefix[0].r.x - frame.x));
    return nodes;
  };

  function overlapY(a, b) {
    var overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return overlap > Math.min(a.h, b.h) * 0.4;
  }

  function overlapX(a, b) {
    return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2;
  }

  function top(row) { return Math.min.apply(null, row.map(function (i) { return i.r.y; })); }
  function bottom(row) { return Math.max.apply(null, row.map(function (i) { return i.r.y + i.r.h; })); }

  //  Eine Zeile nebeneinander. Jede Zelle reicht bis zum naechsten
  //  Nachbarn, die letzte bis zum Rand, die erste beginnt am Rand: fehlt in
  //  Word die Schrift des Designs, ist die Ersatzschrift oft etwas breiter –
  //  mit den Luecken als Reserve bricht nichts um.
  //  Wo ein Bestandteil wirklich Tinte hat: ein Flex-Kasten, der den Rest
  //  der Zeile fuellt, aber rechtsbuendig nur drei Zeilen Kontakt traegt,
  //  belegt nur diese. Ein Kasten mit Flaeche belegt sich ganz.
  Converter.prototype.extent = function (item, under) {
    if (item.inline) return item.r;
    if (background(item.el, under) || boxBorder(view.getComputedStyle(item.el), under)) return item.r;
    var range = document.createRange();
    range.selectNodeContents(item.el);
    var ink = this.box(range.getBoundingClientRect());
    if (!(ink.w > 0)) return item.r;
    var x0 = Math.max(item.r.x, ink.x);
    return { x: x0, y: item.r.y, w: Math.max(0, Math.min(item.r.x + item.r.w, ink.x + ink.w) - x0), h: item.r.h };
  };

  //  Eine Zeile nebeneinander. Jede Zelle beginnt, wo die vorige endet;
  //  der Einzug darin haelt den Text an seiner Stelle. Die Grenze liegt
  //  mitten in der Luecke zwischen dem, was beide Nachbarn wirklich zeigen –
  //  fehlt in Word die Schrift oder laeuft sie breiter, haben beide Seiten
  //  Reserve: ein linksbuendiger Name wie ein rechtsbuendiger Kontaktblock.
  Converter.prototype.row = function (row, frame, gap, under) {
    var self = this;
    var cols = [];
    var cells = [];
    var x = frame.x;
    var ink = row.map(function (item) { return self.extent(item, under); });
    row.forEach(function (item, index) {
      var left = index === 0 ? Math.min(frame.x, ink[0].x) : x;
      var next = row[index + 1];
      var end = ink[index].x + ink[index].w;
      var right = next ? Math.max(left + 1, end, (end + ink[index + 1].x) / 2) : Math.max(end, frame.x + frame.w);
      if (next && right > ink[index + 1].x) right = Math.max(left + 1, ink[index + 1].x);
      var width = Math.max(1, right - left);
      cols.push(width);
      var cellFrame = { x: left, y: item.r.y, w: width, h: item.r.h };
      var children = self.withPrefix(item, cellFrame, item.r.y - top(row), under);
      cells.push({ children: children, valign: "top" });
      x = left + width;
    });
    return { t: "table", before: Math.max(0, gap), indL: 0, cols: cols, cells: cells };
  };

  /* --------------------------------------------------------- Blaetter */

  //  Ein Blatt: seine Spalten (Seitenspalte, Hauptteil) als Zellen einer
  //  Tabelle ueber die ganze Seite. Ein Theme ohne sichtbare Spalten
  //  (display: contents) hat nur eine.
  function sheetDesign(sheet, pictures) {
    var c = new Converter(sheet, pictures);
    var page = c.rect(sheet);
    var under = rgbOf(background(sheet) || "FFFFFF");
    var kids = flowChildren(sheet);
    var columns = kids.filter(function (el) {
      var r = c.rect(el);
      return r.h > page.h * 0.6 && r.w < page.w * 0.9;
    });
    var cells = [];
    var cols = [];
    if (columns.length >= 2) {
      columns.sort(function (a, b) { return c.rect(a).x - c.rect(b).x; });
      var x = 0;
      columns.forEach(function (col, index) {
        var r = c.rect(col);
        if (r.x - x > 1) { cols.push(r.x - x); cells.push({ children: [] }); }
        var right = index === columns.length - 1 ? page.w : r.x + r.w;
        var width = right - Math.max(x, r.x);
        var fill = background(col, under);
        var shade = fill ? rgbOf(fill) : under;
        var s = view.getComputedStyle(col);
        var inner = c.inner(col);
        cols.push(width);
        cells.push({
          shade: fill,
          pad: { t: 0, r: Math.max(0, r.x + width - (inner.x + inner.w)), b: 0, l: Math.max(0, inner.x - Math.max(x, r.x)) },
          //  Gemessen ab der Blattkante: die Seite hat in Word keinen Rand.
          children: c.list(c.items(col), { x: inner.x, y: 0, w: inner.w, h: inner.h }, 0, shade),
          top: inner.y,
        });
        x = Math.max(x, r.x) + width;
      });
      if (page.w - x > 1) { cols.push(page.w - x); cells.push({ children: [] }); }
    } else {
      var inner = c.inner(sheet);
      cols.push(page.w);
      cells.push({
        shade: null, pad: { t: 0, r: page.w - (inner.x + inner.w), b: 0, l: inner.x },
        children: c.list(c.items(sheet), { x: inner.x, y: 0, w: inner.w, h: inner.h }, 0, under),
      });
    }
    return { w: page.w, h: page.h, background: background(sheet) || null,
             table: { t: "table", cols: cols, cells: cells, height: page.h, page: true } };
  }

  //  Alle sichtbaren Blaetter in der Reihenfolge, in der sie gedruckt werden.
  function capture(doc) {
    doc = doc || document;
    var pictures = new Pictures();
    var sheets = Array.prototype.filter.call(doc.querySelectorAll(".cover-letter_wrapper, .resume_wrapper"), visible)
      .map(function (sheet) { return { el: sheet, top: sheet.getBoundingClientRect().top, left: sheet.getBoundingClientRect().left }; })
      .sort(function (a, b) { return a.top - b.top || a.left - b.left; });
    var design = { sheets: sheets.map(function (s) { return sheetDesign(s.el, pictures); }) };
    return pictures.done().then(function () { return resolveSlots(design); });
  }

  //  Die Platzhalter der Bilder durch ihre fertigen Daten ersetzen.
  function resolveSlots(value) {
    if (Array.isArray(value)) return value.map(resolveSlots).filter(function (item) { return item !== undefined; });
    if (value && typeof value === "object") {
      if (value.pic) {
        if (!value.pic.img) return undefined;
        return { img: value.pic.img.src, w: value.w || value.pic.img.w, h: value.h || value.pic.img.h };
      }
      var out = {};
      Object.keys(value).forEach(function (key) {
        var resolved = resolveSlots(value[key]);
        if (resolved !== undefined) out[key] = resolved;
      });
      return out;
    }
    return value;
  }

  global.RickCVWordDesign = { capture: capture, _hex: hex };
})(typeof window !== "undefined" ? window : this);
