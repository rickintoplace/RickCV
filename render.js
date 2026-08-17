/*  render.js – Rendert ein RickCV-Datenobjekt in ein Dokument.
 *
 *  Klassisches Script (kein Modul), damit cv.html auch ohne Webserver laeuft.
 *  Einstieg:  RickCVRender.render(document, data)
 */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------- Helfer */

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Nur http(s), mailto, tel und data:image zulassen – blockt javascript: URLs.
  function safeUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "";
    if (/^(https?:|mailto:|tel:|data:image\/|#|\.|\/)/i.test(url)) return esc(url);
    return "";
  }

  function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
  }

  function list(section) {
    return section && Array.isArray(section.items) ? section.items : [];
  }

  function isOn(section) {
    return !!(section && section.show && list(section).length > 0);
  }

  /* ------------------------------------------------------------- Datum/Zeit */

  function formatDate(date, format) {
    var parts = String(date || "").split("/");
    var month = parts[0];
    var year = parts[1];
    if (!month || !year) return String(date || "");
    if (format === "short" && year.length === 4) {
      return month + "/" + year.slice(-2);
    }
    return month + "/" + year;
  }

  function monthsBetween(start, end) {
    var a = String(start || "").split("/").map(Number);
    var b = String(end || "").split("/").map(Number);
    if (a.length < 2 || b.length < 2) return 0;
    return (b[1] - a[1]) * 12 + (b[0] - a[0]);
  }

  function toComparable(date) {
    var parts = String(date || "").split("/");
    return Number(parts[1] || 0) * 12 + Number(parts[0] || 0);
  }

  function totalMonths(events) {
    if (!events.length) return 0;
    var earliest = events[0].start;
    var latest = events[0].end;
    events.forEach(function (event) {
      if (toComparable(event.start) < toComparable(earliest)) earliest = event.start;
      if (toComparable(event.end) > toComparable(latest)) latest = event.end;
    });
    var span = monthsBetween(earliest, latest);
    return span || 1; // Division durch 0 vermeiden
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

  function loadFont(doc, family) {
    if (!FONT_STACK[family]) return;
    var id = "rickcv-font";
    var link = doc.getElementById(id);
    if (!link) {
      link = doc.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      doc.head.appendChild(link);
    }
    var href =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family).replace(/%20/g, "+") +
      ":wght@400;600;700&display=swap";
    if (link.href !== href) link.href = href;
  }

  function sidebarColor(style) {
    if (style.sidebarMode === "custom") return style.sidebarColor;
    if (style.sidebarMode === "dark") {
      return "color-mix(in oklab, " + style.accentColor + ", #181818 88%)";
    }
    return "color-mix(in oklab, " + style.accentColor + ", white 80%)";
  }

  function sidebarFontColor(style) {
    if (style.sidebarMode === "dark") return style.sidebarFontColor || "#f5f5f5";
    return style.sidebarFontColor || style.fontColor;
  }

  function applyStyle(doc, data) {
    var style = data.style;
    var photo = data.photo;
    var root = doc.documentElement;
    var set = function (name, value) {
      root.style.setProperty(name, value);
    };

    loadFont(doc, style.fontFamily);
    set("--font-family", FONT_STACK[style.fontFamily] || "'Open Sans', sans-serif");
    set("--accent-color", style.accentColor);
    set("--font-color", style.fontColor);
    set("--background-color", style.backgroundColor);
    set("--sidebar-color", sidebarColor(style));
    set("--sidebar-font-color", sidebarFontColor(style));
    set("--color-empty", style.emptyColor);
    set("--sidebar-width", style.sidebarWidth + "%");
    set("--title-size", style.titleSize + "px");
    set("--headline-size", style.headlineSize + "px");
    set("--border", style.border + "mm");
    set("--left-margin", style.leftMargin + "cm");
    set("--right-margin", style.rightMargin + "cm");
    set("--bottom-margin", style.bottomMargin + "cm");
    set("--header-height", style.headerHeight + "em");

    // Profilbild-Anordnung
    set("--img-position-x", photo.posX + "%");
    set("--img-position-y", photo.posY + "%");
    set("--img-scale", String(photo.scale));
    set("--img-height", photo.height + "cm");
    set("--img-radius", photo.shape === "circle" ? "50%" : photo.radius + "px");
    set("--img-border", "0");

    // Template- und Formklassen setzen, alte entfernen
    var body = doc.body;
    body.className = body.className
      .split(/\s+/)
      .filter(function (name) {
        return name && !/^(template-|photo-)/.test(name);
      })
      .join(" ");
    body.classList.add("template-" + (data.settings.template || "clean"));
    body.classList.add("photo-" + (photo.shape || "band"));
  }

  /* ----------------------------------------------------------- Bausteine CV */

  function contactBlock(contact) {
    var out = "";
    if (contact.address || contact.city) {
      out +=
        '<div class="resume_subinfo">' +
        '<i class="material-icons">location_on</i>' +
        '<div class="address-wrapper">' +
        '<div class="contact-info">' + esc(contact.address) + "</div>" +
        '<div class="contact-info">' + esc(contact.city) + "</div>" +
        "</div></div>";
    }
    if (contact.email) {
      out +=
        '<div class="resume_subinfo">' +
        '<i class="material-icons">email</i>' +
        '<div class="contact-info"><a href="mailto:' + esc(contact.email) + '">' +
        esc(contact.email) + "</a></div></div>";
    }
    if (contact.phone) {
      var dial = String(contact.phone).replace(/\s+/g, "").replace(/^0/, "+49");
      out +=
        '<div class="resume_subinfo">' +
        '<i class="material-icons">phone</i>' +
        '<div class="contact-info"><a href="tel:' + esc(dial) + '">' +
        esc(contact.phone) + "</a></div></div>";
    }
    return out;
  }

  function photoBlock(photo) {
    if (!photo.show || !photo.src) return "";
    return (
      '<div class="resume_image profile-image-container">' +
      '<img src="' + safeUrl(photo.src) + '" alt="Profilbild">' +
      "</div>"
    );
  }

  function sidebarItem(title, body) {
    return (
      '<div class="resume_item">' +
      '<div class="resume_title">' + esc(title) + "</div>" +
      '<div class="resume_info">' + body + "</div>" +
      "</div>"
    );
  }

  function iconRows(items) {
    return items
      .map(function (item) {
        var icon = item.icon
          ? '<span class="material-symbols-outlined">' + esc(item.icon) + "</span>"
          : "";
        return '<div class="resume_subinfo">' + icon + esc(item.name) + "</div>";
      })
      .join("");
  }

  function languageBlock(items) {
    return items
      .map(function (language) {
        var width = Math.max(0, Math.min(100, Number(language.percentage) || 0));
        return (
          '<div class="language_list">' +
          '<div class="language_left">' + esc(language.name) + "</div>" +
          '<div class="language_bar"><p><span style="width:' + width + '%">' +
          esc(language.level || "") +
          "</span></p></div></div>"
        );
      })
      .join("");
  }

  function projectBlock(items) {
    return items
      .map(function (project) {
        var url = safeUrl(project.url);
        var img = safeUrl(project.img);
        var picture = img
          ? '<div class="project-img-holder">' +
            (url ? '<a href="' + url + '">' : "") +
            '<img src="' + img + '" alt="' + esc(project.name) + '">' +
            (url ? "</a>" : "") +
            "</div>"
          : "";
        var title = url
          ? '<a href="' + url + '"><h3 class="project-title">' + esc(project.name) + "</h3></a>"
          : '<h3 class="project-title">' + esc(project.name) + "</h3>";
        return (
          '<div class="resume_info project">' + picture +
          '<div class="project-txt">' + title +
          "<span>" + esc(project.description) + "</span></div></div>"
        );
      })
      .join("");
  }

  function skillBlock(items) {
    return items
      .map(function (skill) {
        var ratio = (Math.max(0, Math.min(5, Number(skill.rank) || 0)) / 5) * 100;
        return (
          '<ul class="skills">' +
          '<li class="skill-description">' + esc(skill.name) + "</li>" +
          '<li class="rank" style="--ratio:' + ratio + '%">&#9679;&#9679;&#9679;&#9679;&#9679;</li>' +
          "</ul>"
        );
      })
      .join("");
  }

  function buildSidebar(data) {
    var blocks = "";

    if (data.profile.show && data.profile.text) {
      blocks +=
        '<div class="resume_item resume_profile">' +
        '<div class="resume_title">' + esc(data.profile.title || "Profil") + "</div>" +
        '<div class="resume_info profile-container">' + nl2br(data.profile.text) + "</div>" +
        "</div>";
    }

    blocks +=
      '<div class="resume_item resume_contact">' +
      '<div class="resume_title">' + esc(data.sectionTitles.contact) + "</div>" +
      '<div class="resume_info"><div class="contact_container">' +
      contactBlock(data.contact) +
      "</div></div></div>";

    if (isOn(data.languages)) {
      blocks +=
        '<div class="resume_item resume_language">' +
        '<div class="resume_title">' + esc(data.languages.title) + "</div>" +
        '<div class="language_container">' + languageBlock(list(data.languages)) + "</div>" +
        "</div>";
    }
    if (isOn(data.mobilitySB)) {
      blocks += sidebarItem(
        data.mobilitySB.title,
        '<div class="mobilitySB_container">' + iconRows(list(data.mobilitySB)) + "</div>"
      );
    }
    if (isOn(data.interests)) {
      blocks += sidebarItem(
        data.interests.title,
        '<div class="interests_container">' + iconRows(list(data.interests)) + "</div>"
      );
    }
    if (isOn(data.projects)) {
      blocks +=
        '<div class="resume_item resume_projects">' +
        '<div class="resume_title">' + esc(data.projects.title) + "</div>" +
        '<div class="resume_info projects_container">' + projectBlock(list(data.projects)) + "</div>" +
        "</div>";
    }

    return (
      '<div class="resume_left">' +
      photoBlock(data.photo) +
      '<div class="resume_bottom">' + blocks + "</div>" +
      "</div>"
    );
  }

  function timelineSection(id, title, icon, timelineClass) {
    return (
      '<div class="resume_item timeline-container" id="' + id + '">' +
      '<div class="resume_title"><i class="material-icons">' + esc(icon) + "</i>" + esc(title) + "</div>" +
      '<div class="timeline ' + timelineClass + '"></div></div>'
    );
  }

  function buildMain(data, buckets) {
    var out =
      '<div class="resume_item resume_namerole">' +
      '<div class="name">' + esc(data.contact.name) + "</div>" +
      '<div class="role">' + esc(data.contact.role) + "</div></div>";

    if (buckets.education.length) {
      out += timelineSection(
        "education-section",
        data.sectionTitles.education,
        data.sectionIcons.education,
        "timeline-education"
      );
    }
    if (buckets.experience.length) {
      out += timelineSection(
        "experience-section",
        data.sectionTitles.experience,
        data.sectionIcons.experience,
        "timeline-experience"
      );
    }
    if (buckets.volunteer.length) {
      out += timelineSection(
        "volunteer-section",
        data.sectionTitles.volunteer,
        data.sectionIcons.volunteer,
        "timeline-volunteer"
      );
    }

    if (isOn(data.skills)) {
      out +=
        '<div class="resume_item resmue_skills">' +
        '<div class="resume_title"><i class="material-icons">' + esc(data.skills.icon) + "</i>" +
        esc(data.skills.title) + "</div>" +
        '<div id="skills-container" class="resume_info skills-container">' +
        skillBlock(list(data.skills)) + "</div></div>";
    }
    if (isOn(data.mobility)) {
      out +=
        '<div class="resume_item resmue_mobility">' +
        '<div class="resume_title"><i class="material-icons">' + esc(data.mobility.icon) + "</i>" +
        esc(data.mobility.title) + "</div>" +
        '<div class="resume_info mobility-container">' +
        list(data.mobility).map(function (item) { return esc(item.name); }).join("<br>") +
        "</div></div>";
    }

    return '<div class="resume_right">' + out + "</div>";
  }

  /* ------------------------------------------------------------- Zeitleiste */

  function createTimeline(doc, events, timeline, data) {
    if (!timeline || !events.length) return;

    var span = totalMonths(events);
    var format = data.settings.dateFormat;

    events.forEach(function (event) {
      var eventElement = doc.createElement("div");
      eventElement.className = "event";

      var dateElement = doc.createElement("div");
      dateElement.className = "date";
      var endLabel = event.present ? "heute" : formatDate(event.end, format);
      dateElement.innerHTML = formatDate(event.start, format) + "<br>&ndash; " + esc(endLabel);
      eventElement.appendChild(dateElement);

      var dot = doc.createElement("div");
      dot.className = "dot";
      dot.innerHTML = '<span class="material-symbols-outlined">' + esc(event.icon) + "</span>";
      dot.style.backgroundColor = event.color;
      eventElement.appendChild(dot);

      var content = doc.createElement("div");
      content.className = "content";
      var html = "<h3>" + esc(event.title) + "</h3>";

      if (event.company && event.place) {
        html += '<p><span class="event-company">' + esc(event.company) +
          '</span>, <span class="event-place">' + esc(event.place) + "</span></p>";
      } else if (event.company) {
        html += '<p><span class="event-company">' + esc(event.company) + "</span></p>";
      } else if (event.place) {
        html += '<p><span class="event-place">' + esc(event.place) + "</span></p>";
      }

      var description = (event.description || []).filter(Boolean);
      if (description.length) {
        html += '<span class="event-description"><ul>' +
          description.map(function (line) { return "<li>" + nl2br(line) + "</li>"; }).join("") +
          "</ul></span>";
      }

      var bullets = (event.list || []).filter(Boolean);
      if (bullets.length) {
        html += '<span class="event-list"><ul>' +
          bullets.map(function (line) { return "<li>" + nl2br(line) + "</li>"; }).join("") +
          "</ul></span>";
      }

      content.innerHTML = html;
      eventElement.appendChild(content);

      var ratio = monthsBetween(event.start, event.end) / span;
      var top = (monthsBetween(events[0].start, event.start) / span) * 100;

      eventElement.style.setProperty("--color", event.color);
      eventElement.style.setProperty("--months-duration", String(ratio));
      eventElement.style.setProperty("--offset", (event.hoffset || 0) + "px");
      eventElement.style.top = top + "%";
      eventElement.style.marginTop = (event.voffset || 0) + "px";

      timeline.appendChild(eventElement);
    });
  }

  // Die farbigen Verbindungslinien brauchen gerenderte Positionen und werden
  // deshalb erst nach dem Layout gezeichnet.
  function drawLines(doc, events, timeline, data) {
    if (!timeline || !events.length) return;
    var elements = timeline.querySelectorAll(".event");

    elements.forEach(function (eventElement, index) {
      var event = events[index];
      var startPosition = eventElement.offsetTop;
      var span = totalMonths(events);
      var endRatio = monthsBetween(events[0].start, event.end) / span;
      var endPosition = endRatio * timeline.offsetHeight;

      for (var j = index + 1; j < events.length; j++) {
        if (monthsBetween(event.end, events[j].start) >= 0) {
          endPosition = elements[j].offsetTop;
          break;
        }
      }

      var line = doc.createElement("div");
      line.className = "line";
      var height = Math.max(0, endPosition - startPosition);
      line.style.height =
        event.hideline || data.settings.noLine ? "0" : height + "px";
      eventElement.appendChild(line);
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
      })
      .join("");

    var dateLine = [letter.place, letter.date].filter(Boolean).join(", ");

    return (
      '<div class="cover-letter"><div class="cover-letter_wrapper">' +
      '<div class="cover-letter-header"><div class="cover-letter-sender">' +
      '<div class="resume_item resume_namerole">' +
      "<h1>" + esc(data.contact.name) + "</h1>" +
      '<div class="cover-letter-role">' + esc(data.contact.role) + "</div></div>" +
      '<div class="header-contact-section">' + contactBlock(data.contact) + "</div>" +
      "</div></div>" +
      '<div class="cover-letter-content">' +
      '<div class="cover-letter-recipient">' + nl2br(letter.recipient) + "</div>" +
      '<div class="cover-letter-date">' + esc(dateLine) + "</div>" +
      '<div class="cover-letter-regard textblock" style="text-align:' + align + '">' +
      esc(letter.subject) + "</div>" +
      '<div class="cover-letter-salutation textblock" style="text-align:' + align + '">' +
      esc(letter.salutation) + "</div>" +
      paragraphs +
      '<div class="cover-letter-closing textblock" style="text-align:' + align + '">' +
      esc(letter.closing) + "<br>" +
      (signature
        ? '<div class="signature"><img src="' + signature +
          '" alt="Unterschrift" style="height:' + (Number(letter.signatureHeight) || 2) + 'rlh"></div>'
        : "") +
      "<span>" + esc(data.contact.name) + "</span>" +
      "</div></div></div></div>"
    );
  }

  /* -------------------------------------------------------------------- ATS */

  function buildATS(data, buckets) {
    if (!data.settings.activateATS) return "";
    var out = "";

    function section(title, events) {
      if (!events.length) return "";
      var html = "<h2>" + esc(title) + ":</h2><ul>";
      events.forEach(function (event) {
        var company = event.company ? " bei " + event.company : "";
        var place = event.place ? ", " + event.place : "";
        var end = event.present ? "heute" : event.end;
        html += "<li><strong>" + esc(event.title + company + place) + "</strong>, " +
          esc(event.start) + " &ndash; " + esc(end);
        (event.description || []).filter(Boolean).forEach(function (line) {
          html += "<br>" + esc(line);
        });
        (event.list || []).filter(Boolean).forEach(function (line) {
          html += "<br>" + esc(line);
        });
        html += "</li><p></p>";
      });
      return html + "</ul>";
    }

    function simple(title, items, format) {
      if (!items.length) return "";
      return "<h2>" + esc(title) + ":</h2><ul>" +
        items.map(function (item) { return "<li>" + esc(format(item)) + "</li>"; }).join("") +
        "</ul>";
    }

    out += section("Ausbildung", buckets.education);
    out += section("Berufliche Erfahrung", buckets.experience);
    out += section("Ehrenamtliche Erfahrung", buckets.volunteer);
    out += simple("Fähigkeiten", list(data.skills), function (skill) {
      return skill.name + ": " + Math.round(((Number(skill.rank) || 0) / 5) * 100) + "%";
    });
    out += simple("Sprachen", list(data.languages), function (language) {
      return language.name + ": " + language.percentage + "%" +
        (language.level ? " (" + language.level + ")" : "");
    });

    var contact = data.contact;
    out += "<h2>Kontaktinformationen:</h2><ul>" +
      "<li>Name: " + esc(contact.name) + "</li>" +
      "<li>Rolle: " + esc(contact.role) + "</li>" +
      "<li>Adresse: " + esc(contact.address) + ", " + esc(contact.city) + "</li>" +
      "<li>Email: " + esc(contact.email) + "</li>" +
      "<li>Telefon: " + esc(contact.phone) + "</li></ul>";

    out += simple("Interessen", list(data.interests), function (i) { return i.name; });
    out += simple("Mobilität", list(data.mobility), function (m) { return m.name; });
    out += simple("Referenzen", data.references || [], function (r) { return r.name; });

    return out;
  }

  /* ------------------------------------------------------------ Hauptrender */

  function bucketEvents(data) {
    var separateEducation = data.settings.separateEducation;
    var separateVolunteer = data.settings.separateVolunteer;

    var buckets = { education: [], experience: [], volunteer: [] };
    (data.events || []).forEach(function (event) {
      var kind = event.kind || "experience";
      if (kind === "education" && !separateEducation) kind = "experience";
      if (kind === "volunteer" && !separateVolunteer) kind = "experience";
      buckets[kind] ? buckets[kind].push(event) : buckets.experience.push(event);
    });

    // Innerhalb einer Sektion immer chronologisch aufsteigend rechnen –
    // die Anzeigerichtung macht danach das Flex-Layout.
    Object.keys(buckets).forEach(function (key) {
      buckets[key].sort(function (a, b) {
        return toComparable(a.start) - toComparable(b.start);
      });
    });
    return buckets;
  }

  function render(doc, data) {
    var buckets = bucketEvents(data);

    applyStyle(doc, data);

    var host = doc.querySelector(".document");
    if (!host) {
      host = doc.createElement("div");
      host.className = "document";
      doc.body.appendChild(host);
    }

    var ats = data.settings.activateATS
      ? '<div id="ats" class="ats">' + buildATS(data, buckets) + "</div>"
      : "";

    host.innerHTML =
      '<div id="CV"><div class="resume_wrapper">' + ats +
      buildSidebar(data) + buildMain(data, buckets) +
      "</div></div>" +
      (data.settings.showCoverLetter ? buildCoverLetter(data) : "");

    var direction = data.settings.reverseTimeline ? "column-reverse" : "column";
    var pairs = [
      [".timeline-education", buckets.education],
      [".timeline-experience", buckets.experience],
      [".timeline-volunteer", buckets.volunteer],
    ];

    pairs.forEach(function (pair) {
      var timeline = host.querySelector(pair[0]);
      if (timeline) timeline.style.flexDirection = direction;
      createTimeline(doc, pair[1], timeline, data);
    });

    // Nach dem Layout die Verbindungslinien ergaenzen.
    (doc.defaultView || global).requestAnimationFrame(function () {
      pairs.forEach(function (pair) {
        drawLines(doc, pair[1], host.querySelector(pair[0]), data);
      });
      if (typeof data.onRendered === "function") data.onRendered();
    });
  }

  global.RickCVRender = {
    render: render,
    esc: esc,
    fonts: Object.keys(FONT_STACK),
  };
})(typeof window !== "undefined" ? window : this);
