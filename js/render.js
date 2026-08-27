/*  render.js – Baut aus einem Datenobjekt das fertige Dokument.
 *
 *  Einstieg: RickCVRender.render(document, data)
 *
 *  Reihenfolge im DOM ist bewusst gewaehlt: Name und Kontakt stehen vor dem
 *  Werdegang. Chrome exportiert getaggte PDFs, deren Leserichtung der
 *  DOM-Reihenfolge folgt – wer den Lebenslauf maschinell ausliest, bekommt
 *  damit die Stammdaten zuerst.
 */
(function (global) {
  "use strict";

  var Icons = global.RickCVIconLib;
  var Ats = global.RickCVAts;
  var I18n = global.RickCVI18n;

  /* ---------------------------------------------------------------- Helfer */

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Nur unbedenkliche Schemata zulassen – blockt javascript: URLs.
  function safeUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "";
    if (/^(https?:|mailto:|tel:|data:image\/|#|\.|\/)/i.test(url)) return esc(url);
    return "";
  }

  function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
  }

  function items(section) {
    return section && Array.isArray(section.items) ? section.items : [];
  }

  function isOn(section) {
    return !!(section && section.show && items(section).length);
  }

  /* ---------------------------------------------------------------- Seiten */

  //  Ein Block liegt genau dann auf Seite 2, wenn es ueberhaupt eine zweite
  //  Seite gibt. Sonst wandert er zurueck auf Seite 1, statt zu verschwinden –
  //  wer die zweite Seite wieder abschaltet, soll nichts verlieren.
  function pageOf(block, pages) {
    return pages > 1 && Number(block && block.page) === 2 ? 2 : 1;
  }

  function onPage(block, page, pages) {
    return pageOf(block, pages) === page;
  }

  function pageCount(data) {
    return data.settings.pageMode === "two" ? 2 : 1;
  }

  /* -------------------------------------------------------------- Zeitraum */

  function formatDate(date, format) {
    var parts = String(date || "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return String(date || "");
    if (format === "short" && parts[1].length === 4) return parts[0] + "/" + parts[1].slice(-2);
    return parts[0] + "/" + parts[1];
  }

  function monthsBetween(start, end) {
    var a = String(start || "").split("/").map(Number);
    var b = String(end || "").split("/").map(Number);
    if (a.length < 2 || b.length < 2) return 0;
    return (b[1] - a[1]) * 12 + (b[0] - a[0]);
  }

  function comparable(date) {
    var parts = String(date || "").split("/");
    return Number(parts[1] || 0) * 12 + Number(parts[0] || 0);
  }

  function spanMonths(events) {
    if (!events.length) return 1;
    var earliest = events[0].start, latest = events[0].end;
    events.forEach(function (event) {
      if (comparable(event.start) < comparable(earliest)) earliest = event.start;
      if (comparable(event.end) > comparable(latest)) latest = event.end;
    });
    return monthsBetween(earliest, latest) || 1;
  }

  /* ------------------------------------------------------------ CSS-Styling */

  var FONT_STACK = {
    "Open Sans": "'Open Sans', sans-serif",
    Roboto: "'Roboto', sans-serif",
    Lato: "'Lato', sans-serif",
    Inter: "'Inter', sans-serif",
    Ubuntu: "'Ubuntu', sans-serif",
    "Source Sans 3": "'Source Sans 3', sans-serif",
    "IBM Plex Sans": "'IBM Plex Sans', sans-serif",
    Merriweather: "'Merriweather', Georgia, serif",
    "EB Garamond": "'EB Garamond', Garamond, serif",
  };

  /*  Frueher wurde hier zur Laufzeit ein Stylesheet von fonts.googleapis.com
   *  nachgeladen. Alle neun Familien liegen jetzt lokal in fonts/fonts.css,
   *  das cv.html fest einbindet – der Browser holt daraus nur die Datei der
   *  tatsaechlich benutzten Schrift. Kein Nachladen, keine Verbindung zu
   *  Google, und die Vorschau funktioniert auch offline.
   */

  /*  Lucide misst in Pixeln auf einem 24er Raster, Material Symbols in
   *  Schriftgewicht. Die beiden Skalen haben nichts miteinander zu tun, also
   *  wurde die Gerade ausgemessen statt geschaetzt: gleiche Symbole beider
   *  Saetze in gleicher Groesse gerendert und der Schwarzanteil verglichen.
   *
   *      Lucide 1,50  ~  wght 305
   *      Lucide 1,75  ~  wght 345
   *      Lucide 2,00  ~  wght 375
   *      Lucide 2,25  ~  wght 448
   *
   *  Daraus dieser Zusammenhang. Die frueheren Werte (1,75 entsprach wght
   *  200) stammten aus einem Augenmass und lagen durchweg zu leicht –
   *  Material wirkte neben Lucide duenn.
   */
  function strokeToWeight(stroke) {
    var weight = Math.round(345 + (Number(stroke) - 1.75) * 190);
    return Math.max(100, Math.min(700, weight));
  }

  function sidebarColor(style) {
    if (style.sidebarMode === "custom") return style.sidebarColor;
    if (style.sidebarMode === "dark") {
      return "color-mix(in oklab, " + style.accentColor + ", #181818 88%)";
    }
    return "color-mix(in oklab, " + style.accentColor + ", white 80%)";
  }

  function applyStyle(doc, data) {
    var style = data.style;
    var photo = data.photo;
    var root = doc.documentElement;
    var set = function (name, value) { root.style.setProperty(name, value); };

    set("--font-family", FONT_STACK[style.fontFamily] || "'Open Sans', sans-serif");
    set("--base-font-size", style.baseFontSize + "px");
    set("--accent-color", style.accentColor);
    set("--font-color", style.fontColor);
    set("--background-color", style.backgroundColor);
    set("--sidebar-color", sidebarColor(style));
    set("--sidebar-font-color",
      style.sidebarMode === "dark" ? (style.sidebarFontColor || "#f5f5f5")
                                   : (style.sidebarFontColor || style.fontColor));
    set("--color-empty", style.emptyColor);
    set("--sidebar-width", style.sidebarWidth + "%");
    set("--title-size", style.titleSize + "px");
    set("--headline-size", style.headlineSize + "px");
    set("--border", style.border + "mm");
    set("--left-margin", style.leftMargin + "cm");
    set("--right-margin", style.rightMargin + "cm");
    set("--bottom-margin", style.bottomMargin + "cm");
    set("--header-height", style.headerHeight + "em");

    set("--img-position-x", photo.posX + "%");
    set("--img-position-y", photo.posY + "%");
    set("--img-scale", String(photo.scale));
    set("--img-height", photo.height + "cm");
    // Ein randloses Band ueber die volle Sidebarbreite bleibt eckig –
    // eine Rundung dort schnitte die Seitenkante an.
    set("--img-radius",
      photo.shape === "circle" ? "50%" :
      photo.shape === "rounded" ? photo.radius + "px" : "0");

    // Symbolstil: eine Strichstaerke, zwei Sets.
    set("--icon-stroke", String(style.iconStroke));
    set("--icon-weight", String(strokeToWeight(style.iconStroke)));
    set("--icon-scale", String(style.iconScale));
    set("--icon-color",
      style.iconColor === "text" ? style.fontColor
      : style.iconColor === "custom" ? style.iconColorCustom
      : style.accentColor);
    set("--icon-bg", style.iconBg === "none" ? "transparent" : style.iconBgColor);
    set("--icon-bg-radius", style.iconBg === "circle" ? "50%" : "0.28em");
    set("--icon-bg-pad", style.iconBg === "none" ? "0" : "0.3em");

    root.lang = data.locale || "de"; // landet als /Lang im PDF

    var body = doc.body;
    body.className = body.className.split(/\s+/).filter(function (name) {
      return name && !/^(template-|photo-|pages-|letter-)/.test(name);
    }).join(" ");
    body.classList.add("template-" + (data.settings.template || "clean"));
    body.classList.add("photo-" + (photo.shape || "band"));
    var mode = data.settings.pageMode || "single";
    body.classList.add(
      mode === "flow" ? "pages-flow" : mode === "two" ? "pages-two" : "pages-fixed");

    //  Das Anschreiben hat seinen eigenen Seitenmodus: es steht auf einem
    //  eigenen Blatt und hat mit der Seitenzuordnung des Lebenslaufs nichts
    //  zu tun.
    body.classList.add(
      (data.settings.letterPageMode || "single") === "flow"
        ? "letter-flow" : "letter-fixed");
  }

  /* ----------------------------------------------------------- CV-Bausteine */

  function contactBlock(contact) {
    var out = "";
    if (contact.address || contact.city) {
      var lines = '<div class="contact-info">' + esc(contact.address) + "</div>" +
        '<div class="contact-info">' + esc(contact.city) + "</div>";

      //  Auf Wunsch zeigt die Anschrift auf OpenStreetMap. Im PDF wird
      //  daraus ein anklickbarer Bereich; sichtbar aendert sich nichts, die
      //  Adresse bleibt schlicht schwarz.
      if (contact.mapLink) {
        //  Die Suche findet die meisten Anschriften, aber nicht jede. Wer
        //  eine eigene Adresse hinterlegt – etwa den Permalink aus der
        //  Karte –, bekommt genau die.
        var custom = safeUrl(contact.mapUrl);
        var query = [contact.address, contact.city]
          .filter(function (part) { return part; }).join(", ");
        var href = custom || ("https://www.openstreetmap.org/search?query=" +
          encodeURIComponent(query));

        lines = '<a class="map-link" href="' + esc(href) +
          '" target="_blank" rel="noopener noreferrer">' + lines + "</a>";
      }

      out += '<div class="resume_subinfo">' +
        Icons.html({ set: "lucide", name: "map-pin" }) +
        '<div class="address-wrapper">' + lines + "</div></div>";
    }
    if (contact.email) {
      out += '<div class="resume_subinfo">' +
        Icons.html({ set: "lucide", name: "mail" }) +
        '<div class="contact-info"><a href="mailto:' + esc(contact.email) + '">' +
        esc(contact.email) + "</a></div></div>";
    }
    if (contact.phone) {
      var dial = String(contact.phone).replace(/\s+/g, "");
      out += '<div class="resume_subinfo">' +
        Icons.html({ set: "lucide", name: "phone" }) +
        '<div class="contact-info"><a href="tel:' + esc(dial) + '">' +
        esc(contact.phone) + "</a></div></div>";
    }
    return out;
  }

  function iconRows(list) {
    return list.map(function (item) {
      return '<div class="resume_subinfo">' + Icons.html(item.icon) + esc(item.name) + "</div>";
    }).join("");
  }

  function sidebarItem(title, body, extraClass) {
    return '<div class="resume_item ' + (extraClass || "") + '">' +
      '<div class="resume_title">' + esc(title) + "</div>" +
      '<div class="resume_info">' + body + "</div></div>";
  }

  function languageBlock(list) {
    return list.map(function (language) {
      var width = Math.max(0, Math.min(100, Number(language.percentage) || 0));
      return '<div class="language_list">' +
        '<div class="language_left">' + esc(language.name) + "</div>" +
        '<div class="language_bar"><p><span style="width:' + width + '%">' +
        esc(language.level || "") + "</span></p></div></div>";
    }).join("");
  }

  function projectBlock(list) {
    return list.map(function (project) {
      var url = safeUrl(project.url);
      var img = safeUrl(project.img);
      var picture = img
        ? '<div class="project-img-holder">' + (url ? '<a href="' + url + '">' : "") +
          '<img src="' + img + '" alt="' + esc(project.name) + '">' + (url ? "</a>" : "") + "</div>"
        : "";
      var title = url
        ? '<a href="' + url + '"><h3 class="project-title">' + esc(project.name) + "</h3></a>"
        : '<h3 class="project-title">' + esc(project.name) + "</h3>";
      return '<div class="resume_info project">' + picture +
        '<div class="project-txt">' + title + "<span>" + esc(project.description) + "</span></div></div>";
    }).join("");
  }

  /*  Fuenf Punkte als SVG.
   *
   *  Frueher standen hier fuenf Zeichen "●" (U+25CF). Das Zeichen fehlt in
   *  den Textschriften – jeder Browser griff zu einer anderen Ersatzschrift,
   *  in Firefox kamen die Punkte dadurch deutlich groesser heraus als in
   *  Chrome und ueberlappten sich. Als Vektor sind sie ueberall gleich, und
   *  sie landen als Grafik im PDF statt als Zeichenfolge im ausgelesenen
   *  Text.
   *
   *  Der Anteil bleibt stufenlos: der gefuellte Satz liegt ueber dem leeren
   *  und wird auf die Breite des Anteils beschnitten.
   */
  var RANK_DOTS = 5;
  var RANK_RADIUS = 8;
  var RANK_STEP = 21;

  function rankDots(ratio, key) {
    var width = RANK_STEP * (RANK_DOTS - 1) + RANK_RADIUS * 2;
    var height = RANK_RADIUS * 2;
    var circles = "";
    for (var i = 0; i < RANK_DOTS; i++) {
      circles += '<circle cx="' + (RANK_RADIUS + i * RANK_STEP) +
        '" cy="' + RANK_RADIUS + '" r="' + RANK_RADIUS + '"/>';
    }
    var clip = "rank-clip-" + key;
    return '<svg class="rank-dots" viewBox="0 0 ' + width + " " + height +
      '" role="img" aria-label="' + Math.round(ratio / 20) + " / " + RANK_DOTS + '">' +
      '<g class="rank-empty">' + circles + "</g>" +
      '<clipPath id="' + clip + '"><rect x="0" y="0" width="' +
      (width * ratio / 100) + '" height="' + height + '"/></clipPath>' +
      '<g class="rank-full" clip-path="url(#' + clip + ')">' + circles + "</g></svg>";
  }

  function skillBlock(list) {
    return list.map(function (skill, index) {
      var ratio = (Math.max(0, Math.min(5, Number(skill.rank) || 0)) / 5) * 100;
      return '<ul class="skills">' +
        '<li class="skill-description">' + esc(skill.name) + "</li>" +
        '<li class="rank">' + rankDots(ratio, index) + "</li></ul>";
    }).join("");
  }

  /* --------------------------------------------------------- Link-Fusszeile */

  //  Auf welchem Blatt die Leiste steht. "last" ist die Vorgabe: bei einer
  //  Seite ist das die einzige, bei zweien die hintere.
  function footerOnPage(footer, page, pages) {
    if (!footer || !footer.show) return false;
    if (!(footer.links || []).length) return false;
    var where = footer.page || "last";
    if (where === "all") return true;
    if (where === "last") return page === pages;
    return Number(where) === page;
  }

  //  Symbol und Text kommen aus dem normalen Icon-Katalog; freies HTML gibt
  //  es hier bewusst nicht, sonst haette eine importierte Datei einen Hebel.
  function footerLinks(footer) {
    var iconsOnly = footer.mode === "icons";

    return (footer.links || []).map(function (link) {
      var text = String(link.text || "").trim();
      var mark = Icons.html(link.icon, "resume-footer-icon");
      if (!mark && !text) return "";

      var body = mark + (!iconsOnly && text
        ? '<span class="resume-footer-text">' + esc(text) + "</span>"
        : "");

      var url = safeUrl(link.url);
      var label = String(link.label || "").trim() || text || String(link.url || "");
      if (!url) return '<span class="resume-footer-link">' + body + "</span>";

      return '<a class="resume-footer-link" href="' + url + '" ' +
        'target="_blank" rel="noopener noreferrer" ' +
        'title="' + esc(label) + '" aria-label="' + esc(label) + '">' + body + "</a>";
    }).join("");
  }

  function footerBlock(footer, sideClass, page, pages) {
    if (!footerOnPage(footer, page, pages)) return "";
    var links = footerLinks(footer);
    if (!links) return "";
    var intro = String(footer.intro || "").trim();

    return '<footer class="resume-link-footer ' + sideClass +
      " resume-footer-mode-" + esc(footer.mode || "iconText") + '">' +
      (intro ? '<div class="resume-footer-intro">' + nl2br(intro) + "</div>" : "") +
      '<div class="resume-footer-links">' + links + "</div></footer>";
  }

  function pageNumber(data, page, pages) {
    if (pages < 2 || !data.settings.page2.pageNumbers) return "";
    var label = I18n.t("doc", "pageOf", data.locale)
      .replace("{page}", page).replace("{pages}", pages);
    return '<div class="resume-page-number">' + esc(label) + "</div>";
  }

  function buildSidebar(data, page, pages) {
    var blocks = "";
    var page2 = data.settings.page2;

    if (data.profile.show && data.profile.text && onPage(data.profile, page, pages)) {
      blocks += '<div class="resume_item resume_profile">' +
        '<div class="resume_title">' + esc(data.profile.title) + "</div>" +
        '<div class="resume_info profile-container">' + nl2br(data.profile.text) + "</div></div>";
    }

    //  Der Kontaktblock gehoert immer auf die erste Seite; auf der zweiten ist
    //  er eine Wiederholung, damit das Blatt fuer sich zuordenbar bleibt.
    if (page === 1 || page2.repeatContact) {
      blocks += '<div class="resume_item resume_contact">' +
        '<div class="resume_title">' + esc(data.contactTitle) + "</div>" +
        '<div class="resume_info"><div class="contact_container">' +
        contactBlock(data.contact) + "</div></div></div>";
    }

    if (isOn(data.languages) && onPage(data.languages, page, pages)) {
      blocks += '<div class="resume_item resume_language">' +
        '<div class="resume_title">' + esc(data.languages.title) + "</div>" +
        '<div class="language_container">' + languageBlock(items(data.languages)) + "</div></div>";
    }
    if (isOn(data.mobilitySB) && onPage(data.mobilitySB, page, pages)) {
      blocks += sidebarItem(data.mobilitySB.title,
        '<div class="mobilitySB_container">' + iconRows(items(data.mobilitySB)) + "</div>",
        "resume_mobilitySB");
    }
    if (isOn(data.interests) && onPage(data.interests, page, pages)) {
      blocks += sidebarItem(data.interests.title,
        '<div class="interests_container">' + iconRows(items(data.interests)) + "</div>",
        "resume_interests");
    }
    if (isOn(data.projects) && onPage(data.projects, page, pages)) {
      blocks += '<div class="resume_item resume_projects">' +
        '<div class="resume_title">' + esc(data.projects.title) + "</div>" +
        '<div class="resume_info projects_container">' + projectBlock(items(data.projects)) + "</div></div>";
    }

    var showPhoto = data.photo.show && data.photo.src &&
      (page === 1 || page2.repeatPhoto);
    var photo = showPhoto
      ? '<div class="resume_image profile-image-container"><img src="' + safeUrl(data.photo.src) +
        '" alt="' + esc(I18n.t("doc", "photoAlt", data.locale)) + '"></div>'
      : "";

    return '<div class="resume_left">' + photo +
      '<div class="resume_bottom">' + blocks + "</div>" +
      footerBlock(data.footers.left, "resume-link-footer-left", page, pages) + "</div>";
  }

  function buildMain(data, grouped, page, pages) {
    var out = "";
    var page2 = data.settings.page2;

    //  Auf Seite 2 ist die Kopfzeile eine Wiederholung: kleiner gesetzt,
    //  damit sie den Blick nicht ein zweites Mal einfaengt.
    if (page === 1 || page2.repeatHeader) {
      out += '<div class="resume_item resume_namerole' +
        (page > 1 ? " resume_namerole-repeat" : "") + '">' +
        '<h1 class="name">' + esc(data.contact.name) + "</h1>" +
        '<div class="role">' + esc(data.contact.role) + "</div></div>";
    }

    (data.sections || []).forEach(function (section) {
      if (section.show === false) return;
      if (!onPage(section, page, pages)) return;
      if (!grouped[section.id] || !grouped[section.id].length) return;
      out += '<div class="resume_item timeline-container" data-section-id="' + esc(section.id) + '">' +
        '<h2 class="resume_title">' + Icons.html(section.icon) + esc(section.title) + "</h2>" +
        '<div class="timeline" data-timeline="' + esc(section.id) + '"></div></div>';
    });

    if (isOn(data.skills) && onPage(data.skills, page, pages)) {
      out += '<div class="resume_item resmue_skills">' +
        '<h2 class="resume_title">' + Icons.html(data.skills.icon) + esc(data.skills.title) + "</h2>" +
        '<div class="resume_info skills-container">' + skillBlock(items(data.skills)) + "</div></div>";
    }
    if (isOn(data.mobility) && onPage(data.mobility, page, pages)) {
      out += '<div class="resume_item resmue_mobility">' +
        '<h2 class="resume_title">' + Icons.html(data.mobility.icon) + esc(data.mobility.title) + "</h2>" +
        '<div class="resume_info mobility-container">' +
        items(data.mobility).map(function (item) { return esc(item.name); }).join("<br>") +
        "</div></div>";
    }
    if (isOn(data.references) && onPage(data.references, page, pages)) {
      out += '<div class="resume_item resume_references">' +
        '<h2 class="resume_title">' + Icons.html(data.references.icon) + esc(data.references.title) + "</h2>" +
        '<div class="resume_info references-container">' +
        items(data.references).map(function (reference) {
          var line = [esc(reference.role), esc(reference.company)].filter(Boolean).join(", ");
          return '<div class="reference">' +
            '<span class="reference-name">' + esc(reference.name) + "</span>" +
            (line ? '<span class="reference-role">' + line + "</span>" : "") +
            (reference.contact ? '<span class="reference-contact">' + esc(reference.contact) + "</span>" : "") +
            "</div>";
        }).join("") + "</div></div>";
    }

    //  Fusszeile und Seitenzahl haengen am unteren Rand der Spalte – der
    //  Container schiebt sich per margin-top:auto nach unten.
    var bottom = footerBlock(data.footers.right, "resume-link-footer-right", page, pages) +
      pageNumber(data, page, pages);

    return '<div class="resume_right">' + out +
      (bottom ? '<div class="resume-column-bottom">' + bottom + "</div>" : "") +
      "</div>";
  }

  /* ------------------------------------------------------------- Zeitleiste */

  function fillTimeline(doc, events, timeline, data) {
    if (!timeline || !events.length) return;
    var span = spanMonths(events);
    var format = data.settings.dateFormat;
    var present = I18n.t("doc", "present", data.locale);

    events.forEach(function (event) {
      var node = doc.createElement("div");
      node.className = "event";

      var date = doc.createElement("div");
      date.className = "date";
      var endLabel = event.present ? present : formatDate(event.end, format);
      date.innerHTML = esc(formatDate(event.start, format)) + "<br>&ndash; " + esc(endLabel);
      node.appendChild(date);

      var dot = doc.createElement("div");
      dot.className = "dot";
      dot.innerHTML = Icons.html(event.icon);
      dot.style.backgroundColor = event.color;
      node.appendChild(dot);

      var content = doc.createElement("div");
      content.className = "content";
      var html = "<h3>" + esc(event.title) + "</h3>";

      var where = [];
      if (event.company) where.push('<span class="event-company">' + esc(event.company) + "</span>");
      if (event.place) where.push('<span class="event-place">' + esc(event.place) + "</span>");
      if (where.length) html += "<p>" + where.join(", ") + "</p>";

      [["event-description", event.description], ["event-list", event.list]].forEach(function (pair) {
        var lines = (pair[1] || []).filter(function (line) { return String(line).trim(); });
        if (!lines.length) return;
        html += '<span class="' + pair[0] + '"><ul>' +
          lines.map(function (line) { return "<li>" + nl2br(line) + "</li>"; }).join("") +
          "</ul></span>";
      });

      content.innerHTML = html;
      node.appendChild(content);

      node.style.setProperty("--color", event.color);
      node.style.setProperty("--months-duration", String(monthsBetween(event.start, event.end) / span));
      node.style.setProperty("--offset", (event.hoffset || 0) + "px");
      node.style.marginTop = (event.voffset || 0) + "px";

      timeline.appendChild(node);
    });
  }

  //  Die farbigen Verbindungslinien brauchen fertige Layoutpositionen und
  //  werden deshalb erst nach dem Rendern gezeichnet.
  function drawLines(doc, events, timeline, data) {
    if (!timeline || !events.length) return;
    var nodes = timeline.querySelectorAll(".event");
    var span = spanMonths(events);

    nodes.forEach(function (node, index) {
      var event = events[index];
      var start = node.offsetTop;
      var end = (monthsBetween(events[0].start, event.end) / span) * timeline.offsetHeight;

      for (var j = index + 1; j < events.length; j++) {
        if (monthsBetween(event.end, events[j].start) >= 0) {
          end = nodes[j].offsetTop;
          break;
        }
      }

      var line = doc.createElement("div");
      line.className = "line";
      line.style.height =
        event.hideline || data.settings.noLine ? "0" : Math.max(0, end - start) + "px";
      node.appendChild(line);
    });
  }

  /* ------------------------------------------------------------- Anschreiben */

  function buildCoverLetter(data) {
    var letter = data.coverLetter;
    var align = data.settings.alignText;
    var signature = safeUrl(letter.signatureImg);

    var paragraphs = (letter.paragraphs || [])
      .filter(function (text) { return String(text || "").trim(); })
      .map(function (text) {
        return '<div class="cover-letter-body textblock" style="text-align:' + align + '"><p>' +
          nl2br(text) + "</p></div>";
      }).join("");

    var dateLine = [letter.place, letter.date].filter(Boolean).join(", ");

    return '<div class="cover-letter"><div class="cover-letter_wrapper">' +
      '<div class="cover-letter-header"><div class="cover-letter-sender">' +
      '<div class="resume_item resume_namerole"><h1>' + esc(data.contact.name) + "</h1>" +
      '<div class="cover-letter-role">' + esc(data.contact.role) + "</div></div>" +
      '<div class="header-contact-section">' + contactBlock(data.contact) + "</div></div></div>" +
      '<div class="cover-letter-content">' +
      '<div class="cover-letter-recipient">' + nl2br(letter.recipient) + "</div>" +
      '<div class="cover-letter-date">' + esc(dateLine) + "</div>" +
      '<div class="cover-letter-regard textblock" style="text-align:' + align + '">' +
      esc(letter.subject) + "</div>" +
      '<div class="cover-letter-salutation textblock" style="text-align:' + align + '">' +
      esc(letter.salutation) + "</div>" + paragraphs +
      '<div class="cover-letter-closing textblock" style="text-align:' + align + '">' +
      esc(letter.closing) + "<br>" +
      (signature ? '<div class="signature"><img src="' + signature + '" alt="' +
        esc(I18n.t("doc", "signatureAlt", data.locale)) + '" style="height:' +
        (Number(letter.signatureHeight) || 2) + 'rlh"></div>' : "") +
      "<span>" + esc(data.contact.name) + "</span></div></div></div></div>";
  }

  /* -------------------------------------------------------- Maschinenfassung */

  function buildAts(data) {
    var mode = data.ats.mode;
    if (mode === "off") return "";

    var text = Ats.effectiveText(data);
    if (!text.trim()) return "";

    if (mode === "hidden") {
      // Bewusst schlichtes, unsichtbares Textfeld – siehe Warnung in ats.js.
      return '<div class="ats-hidden" aria-hidden="true">' + nl2br(text) + "</div>";
    }

    var blocks = data.ats.custom
      ? '<pre class="ats-raw">' + esc(text) + "</pre>"
      : Ats.buildBlocks(data).map(function (block) {
          return '<section class="ats-block"><h2>' + esc(block.title) + "</h2><ul>" +
            block.lines.map(function (line) { return "<li>" + nl2br(line) + "</li>"; }).join("") +
            "</ul></section>";
        }).join("");

    return '<div class="ats-appendix"><div class="ats-appendix_wrapper">' +
      "<h1>" + esc(I18n.t("doc", "atsHeading", data.locale)) + "</h1>" +
      '<p class="ats-intro">' + esc(I18n.t("doc", "atsIntro", data.locale)) + "</p>" +
      blocks + "</div></div>";
  }

  /* ------------------------------------------------------------ Hauptrender */

  function groupEvents(data) {
    var grouped = {};
    (data.sections || []).forEach(function (section) { grouped[section.id] = []; });

    (data.events || []).forEach(function (event) {
      var id = grouped[event.sectionId] ? event.sectionId : (data.sections[0] || {}).id;
      if (grouped[id]) grouped[id].push(event);
    });

    // Innerhalb einer Sektion immer aufsteigend rechnen; die Anzeigerichtung
    // uebernimmt danach das Flex-Layout.
    Object.keys(grouped).forEach(function (id) {
      grouped[id].sort(function (a, b) { return comparable(a.start) - comparable(b.start); });
    });
    return grouped;
  }

  function documentTitle(data) {
    var name = String(data.contact.name || "").trim();
    var kind = I18n.t("doc", "cvTitle", data.locale);
    return name ? kind + " – " + name : kind;
  }

  function render(doc, data) {
    var grouped = groupEvents(data);
    applyStyle(doc, data);

    // Der Titel wird von Chrome als PDF-Titel und als Dateiname uebernommen.
    doc.title = documentTitle(data);

    var host = doc.querySelector(".document");
    if (!host) {
      host = doc.createElement("div");
      host.className = "document";
      doc.body.appendChild(host);
    }

    //  Jede Seite ist ein eigenes Blatt im DOM. Das macht die Zuordnung
    //  eindeutig und laesst Chrome an genau diesen Stellen umbrechen, statt
    //  den Umbruch aus der Hoehe zu raten.
    var pages = pageCount(data);
    var sheets = "";
    for (var page = 1; page <= pages; page++) {
      sheets += '<div class="resume_wrapper" data-page="' + page + '">' +
        buildSidebar(data, page, pages) +
        buildMain(data, grouped, page, pages) + "</div>";
    }

    host.innerHTML =
      '<div id="CV">' + sheets + "</div>" +
      (data.settings.showCoverLetter ? buildCoverLetter(data) : "") +
      buildAts(data);

    var direction = data.settings.reverseTimeline ? "column-reverse" : "column";
    (data.sections || []).forEach(function (section) {
      var timeline = host.querySelector('[data-timeline="' + section.id + '"]');
      if (timeline) timeline.style.flexDirection = direction;
      fillTimeline(doc, grouped[section.id] || [], timeline, data);
    });

    (doc.defaultView || global).requestAnimationFrame(function () {
      (data.sections || []).forEach(function (section) {
        drawLines(doc, grouped[section.id] || [],
          host.querySelector('[data-timeline="' + section.id + '"]'), data);
      });
      if (typeof data.onRendered === "function") data.onRendered();
    });
  }

  global.RickCVRender = {
    render: render,
    fonts: Object.keys(FONT_STACK),
    documentTitle: documentTitle,
  };
})(typeof window !== "undefined" ? window : this);
