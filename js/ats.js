/*  ats.js – Erzeugt die maschinenlesbare Textfassung des Lebenslaufs.
 *
 *  Hintergrund: Chrome exportiert getaggte PDFs, die Leserichtung folgt also
 *  der DOM-Reihenfolge. Ein sauber strukturiertes Dokument wird damit von
 *  Bewerbungssystemen bereits gut ausgelesen – eine Zusatzfassung ist die
 *  Absicherung fuer stark grafische Layouts, kein Pflichtprogramm.
 *
 *  Bewusst NICHT: unsichtbarer Text. Untersuchungen zu Bewerbungssystemen
 *  behandeln unsichtbar eingebettete Inhalte (unter 4 pt, hinter dem Layout,
 *  in Hintergrundfarbe) als Manipulationsversuch, und die haeufigste dort
 *  gefundene Variante ist genau das Einbetten zusaetzlicher Skill- und
 *  Erfahrungslisten. Der unsichtbare Modus bleibt waehlbar, ist aber
 *  abgeschaltet und im Editor als riskant gekennzeichnet.
 */
(function (global) {
  "use strict";

  var ROLE_HEADINGS = {
    de: {
      experience: "Berufserfahrung",
      education: "Ausbildung",
      volunteer: "Ehrenamt",
      other: "Weitere Stationen",
      profile: "Profil",
      contact: "Kontakt",
      skills: "Kenntnisse",
      languages: "Sprachen",
      interests: "Interessen",
      projects: "Projekte",
      mobility: "Mobilität",
      references: "Referenzen",
      present: "heute",
      until: "bis",
    },
    en: {
      experience: "Professional experience",
      education: "Education",
      volunteer: "Volunteering",
      other: "Further activities",
      profile: "Profile",
      contact: "Contact",
      skills: "Skills",
      languages: "Languages",
      interests: "Interests",
      projects: "Projects",
      mobility: "Mobility",
      references: "References",
      present: "present",
      until: "to",
    },
  };

  function heading(locale, key) {
    var table = ROLE_HEADINGS[locale] || ROLE_HEADINGS.de;
    return table[key] || ROLE_HEADINGS.de[key] || key;
  }

  function clean(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  /*  Baut den Text als Liste von Bloecken. Jeder Block ist eine Ueberschrift
   *  mit Zeilen darunter – das laesst sich sowohl zu reinem Text als auch zu
   *  HTML ausgeben, ohne die Logik zu wiederholen.
   */
  function buildBlocks(data) {
    var locale = data.locale || "de";
    var h = function (key) { return heading(locale, key); };
    var blocks = [];

    function add(title, lines) {
      var kept = lines.filter(function (line) { return clean(line); });
      if (kept.length) blocks.push({ title: title, lines: kept });
    }

    // Kontakt zuerst: Bewerbungssysteme suchen die Stammdaten am Anfang.
    var contact = data.contact;

    //  Die Links aus den Fusszeilen gehoeren zu den Stammdaten: als Symbol mit
    //  Text sind sie fuer eine Maschine sonst kaum zu greifen.
    var footers = data.footers || {};
    var links = [];
    ["left", "right"].forEach(function (side) {
      var footer = footers[side];
      if (!footer || !footer.show) return;
      (footer.links || []).forEach(function (link) {
        var url = clean(link.url);
        if (!url) return;
        var label = clean(link.label) || clean(link.text);
        links.push(label && label !== url ? label + ": " + url : url);
      });
    });

    add(h("contact"), [
      contact.name,
      contact.role,
      [clean(contact.address), clean(contact.city)].filter(Boolean).join(", "),
      contact.email,
      contact.phone,
    ].concat(links));

    if (data.profile.show && clean(data.profile.text)) {
      add(h("profile"), [data.profile.text]);
    }

    // Werdegang, gruppiert nach der ATS-Rolle der jeweiligen Sektion
    var byRole = {};
    (data.sections || []).forEach(function (section) {
      var events = (data.events || []).filter(function (event) {
        return event.sectionId === section.id;
      });
      if (!events.length) return;
      var role = section.atsRole || "other";
      byRole[role] = (byRole[role] || []).concat(events);
    });

    ["experience", "education", "volunteer", "other"].forEach(function (role) {
      var events = byRole[role];
      if (!events) return;

      // Neueste zuerst – das erwartete Format fuer Lebenslaeufe.
      events = events.slice().sort(function (a, b) {
        return compareDate(b.start, a.start);
      });

      add(h(role), events.map(function (event) {
        var period =
          clean(event.start) +
          (event.present ? " " + h("until") + " " + h("present")
                         : clean(event.end) ? " " + h("until") + " " + clean(event.end) : "");
        var where = [clean(event.company), clean(event.place)].filter(Boolean).join(", ");
        var head = [clean(event.title), where, period].filter(Boolean).join(" | ");
        var details = (event.description || []).concat(event.list || [])
          .filter(function (line) { return clean(line); })
          .map(function (line) { return "  - " + clean(line); });
        return [head].concat(details).join("\n");
      }));
    });

    if (data.skills.show) {
      add(h("skills"), (data.skills.items || []).map(function (skill) {
        return clean(skill.name);
      }));
    }
    if (data.languages.show) {
      add(h("languages"), (data.languages.items || []).map(function (language) {
        return clean(language.name) + (clean(language.level) ? " (" + clean(language.level) + ")" : "");
      }));
    }
    if (data.projects.show) {
      add(h("projects"), (data.projects.items || []).map(function (project) {
        return [clean(project.name), clean(project.description), clean(project.url)]
          .filter(Boolean).join(" | ");
      }));
    }
    if (data.mobility.show) {
      add(h("mobility"), (data.mobility.items || []).map(function (item) { return clean(item.name); }));
    }
    if (data.interests.show) {
      add(h("interests"), (data.interests.items || []).map(function (item) { return clean(item.name); }));
    }
    if (data.references.show) {
      add(h("references"), (data.references.items || []).map(function (reference) {
        return [clean(reference.name), clean(reference.role), clean(reference.company), clean(reference.contact)]
          .filter(Boolean).join(" | ");
      }));
    }

    return blocks;
  }

  function compareDate(a, b) {
    var pa = String(a || "").split("/");
    var pb = String(b || "").split("/");
    return (Number(pa[1] || 0) * 12 + Number(pa[0] || 0)) - (Number(pb[1] || 0) * 12 + Number(pb[0] || 0));
  }

  /* Reiner Text – das ist die Fassung, die der Nutzer im Editor sieht. */
  function toText(data) {
    return buildBlocks(data)
      .map(function (block) {
        return block.title + "\n" + block.lines.join("\n");
      })
      .join("\n\n");
  }

  /*  Der wirksame Text: entweder selbst gepflegt oder aus den Daten erzeugt.
   *  So sieht der Nutzer im Editor immer genau das, was im PDF landet.
   */
  function effectiveText(data) {
    if (data.ats.custom && clean(data.ats.text)) return data.ats.text;
    return toText(data);
  }

  global.RickCVAts = {
    buildBlocks: buildBlocks,
    toText: toText,
    effectiveText: effectiveText,
    heading: heading,
  };
})(typeof window !== "undefined" ? window : this);
