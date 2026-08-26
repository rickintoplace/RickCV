/*  icons.js – Icon-Katalog und Darstellung.
 *
 *  Zwei Sets:
 *    lucide   – SVG-Pfade, eingebettet in icon-data.js. Hinterlaesst keinen
 *               Text im PDF.
 *    material – Google Material Symbols, als Webfont aus fonts/. Der
 *               Iconname ist eine Ligatur und landet daher als Wort im
 *               extrahierten Text; fuer maschinenlesbare Lebenslaeufe ist
 *               Lucide die bessere Wahl. Die mitgelieferte Schrift enthaelt
 *               nur die Symbole aus MATERIAL – siehe tools/fetch-fonts.py.
 *    brands   – Wortmarken (GitHub, LinkedIn). Flaechig statt gestrichelt,
 *               deshalb eigene Darstellung. Handgepflegt: ein neuer Eintrag
 *               ist eine Zeile in BRANDS.
 *
 *  Ein Icon wird als { set, name } gespeichert.
 */
(function (global) {
  "use strict";

  var LUCIDE = (global.RickCVIcons && global.RickCVIcons.lucide) || [];

  // Kuratierte Material-Symbole: [name, gruppe, suchbegriffe]
  var MATERIAL = [
    ["school", "Bildung", "schule studium abitur education university"],
    ["menu_book", "Bildung", "buch lernen lesen book study"],
    ["science", "Bildung", "forschung labor science research"],
    ["calculate", "Bildung", "rechnen mathematik math"],
    ["translate", "Bildung", "sprachen uebersetzen language"],
    ["history_edu", "Bildung", "geschichte schreiben history"],
    ["work", "Arbeit", "arbeit beruf job briefcase"],
    ["business_center", "Arbeit", "beruf koffer business"],
    ["apartment", "Arbeit", "firma gebaeude company building"],
    ["factory", "Arbeit", "fabrik industrie factory"],
    ["storefront", "Arbeit", "laden handel shop retail"],
    ["engineering", "Arbeit", "technik ingenieur engineering"],
    ["handyman", "Arbeit", "handwerk werkzeug craft tools"],
    ["construction", "Arbeit", "bau construction"],
    ["support_agent", "Arbeit", "service kundendienst support"],
    ["groups", "Arbeit", "team gruppe kollegen people"],
    ["handshake", "Arbeit", "vertrieb partnerschaft deal"],
    ["gavel", "Arbeit", "recht jura anwalt law"],
    ["trending_up", "Arbeit", "wachstum erfolg growth"],
    ["analytics", "Arbeit", "analyse statistik data"],
    ["computer", "Technik", "computer it laptop"],
    ["code", "Technik", "programmieren entwicklung code"],
    ["terminal", "Technik", "konsole terminal shell"],
    ["database", "Technik", "datenbank daten database"],
    ["cloud", "Technik", "cloud hosting"],
    ["security", "Technik", "sicherheit schutz security"],
    ["lock", "Technik", "sicherheit datenschutz lock"],
    ["smartphone", "Technik", "handy mobil phone"],
    ["memory", "Technik", "hardware chip cpu"],
    ["palette", "Kreativ", "design farbe kunst art"],
    ["brush", "Kreativ", "malen kunst paint"],
    ["photo_camera", "Kreativ", "fotografie foto camera"],
    ["movie", "Kreativ", "film video movie"],
    ["music_note", "Kreativ", "musik music"],
    ["headphones", "Kreativ", "musik audio podcast"],
    ["mic", "Kreativ", "mikrofon gesang moderation"],
    ["theater_comedy", "Kreativ", "theater schauspiel drama"],
    ["medical_services", "Gesundheit", "medizin arzt health"],
    ["favorite", "Gesundheit", "herz gesundheit heart"],
    ["fitness_center", "Gesundheit", "sport fitness gym"],
    ["psychology", "Gesundheit", "psychologie denken brain"],
    ["volunteer_activism", "Soziales", "ehrenamt soziales charity"],
    ["diversity_3", "Soziales", "vielfalt gemeinschaft diversity"],
    ["pets", "Soziales", "tiere haustier pets"],
    ["eco", "Soziales", "umwelt natur nachhaltigkeit eco"],
    ["recycling", "Soziales", "recycling umwelt"],
    ["park", "Soziales", "natur baum park"],
    ["public", "Soziales", "welt global international"],
    ["directions_car_filled", "Mobilität", "auto fuehrerschein car"],
    ["train", "Mobilität", "zug bahn train"],
    ["directions_bus", "Mobilität", "bus nahverkehr"],
    ["directions_bike", "Mobilität", "fahrrad bike"],
    ["flight", "Mobilität", "flugzeug reisen flight"],
    ["local_shipping", "Mobilität", "lkw logistik truck"],
    ["home", "Kontakt", "adresse zuhause home"],
    ["mail", "Kontakt", "email post mail"],
    ["phone", "Kontakt", "telefon anruf phone"],
    ["location_on", "Kontakt", "ort standort adresse location"],
    ["link", "Kontakt", "link webseite url"],
    ["calendar_month", "Kontakt", "termin kalender calendar"],
    ["star", "Freizeit", "favorit bewertung stern star"],
    ["emoji_events", "Freizeit", "erfolg pokal trophy"],
    ["military_tech", "Freizeit", "auszeichnung medaille medal"],
    ["workspace_premium", "Freizeit", "zertifikat auszeichnung award"],
    ["lightbulb", "Freizeit", "idee innovation idea"],
    ["rocket_launch", "Freizeit", "start rakete rocket"],
    ["sports_esports", "Freizeit", "gaming videospiele games"],
    ["extension", "Freizeit", "puzzle raetsel puzzle"],
    ["restaurant", "Freizeit", "kochen essen food"],
    ["local_cafe", "Freizeit", "kaffee cafe coffee"],
    ["wine_bar", "Freizeit", "wein wine"],
    ["hiking", "Freizeit", "wandern outdoor hiking"],
    ["sailing", "Freizeit", "segeln boot sailing"],
    ["self_improvement", "Freizeit", "meditation achtsamkeit yoga"],
  ];

  /*  Wortmarken. Anders als Lucide und Material sind das Flaechenformen:
   *  sie werden mit fill gezeichnet, nicht mit einer Strichstaerke, und
   *  ignorieren deshalb die Einstellung "Strichstaerke".
   *
   *  Format je Eintrag: [name, gruppe, svg, suchbegriffe, viewBox]
   *  Ein weiteres Logo braucht nur eine weitere Zeile – Pfad aus der
   *  jeweiligen Marken- oder Icon-Quelle einsetzen und die viewBox
   *  danebenschreiben, falls sie nicht 0 0 24 24 ist.
   */
  var BRANDS = [
    ["github", "Marken",
      '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',
      "github git code repository quellcode projekte", "0 0 24 24"],
    ["linkedin", "Marken",
      '<path d="M347.445,0H34.555C15.471,0,0,15.471,0,34.555v312.889C0,366.529,15.471,382,34.555,382h312.889 C366.529,382,382,366.529,382,347.444V34.555C382,15.471,366.529,0,347.445,0z M118.207,329.844c0,5.554-4.502,10.056-10.056,10.056 H65.345c-5.554,0-10.056-4.502-10.056-10.056V150.403c0-5.554,4.502-10.056,10.056-10.056h42.806 c5.554,0,10.056,4.502,10.056,10.056V329.844z M86.748,123.432c-22.459,0-40.666-18.207-40.666-40.666S64.289,42.1,86.748,42.1 s40.666,18.207,40.666,40.666S109.208,123.432,86.748,123.432z M341.91,330.654c0,5.106-4.14,9.246-9.246,9.246H286.73 c-5.106,0-9.246-4.14-9.246-9.246v-84.168c0-12.556,3.683-55.021-32.813-55.021c-28.309,0-34.051,29.066-35.204,42.11v97.079 c0,5.106-4.139,9.246-9.246,9.246h-44.426c-5.106,0-9.246-4.14-9.246-9.246V149.593c0-5.106,4.14-9.246,9.246-9.246h44.426 c5.106,0,9.246,4.14,9.246,9.246v15.655c10.497-15.753,26.097-27.912,59.312-27.912c73.552,0,73.131,68.716,73.131,106.472 L341.91,330.654L341.91,330.654z"/>',
      "linkedin netzwerk beruf profil social", "0 0 382 382"],
  ];

  var LUCIDE_BY_NAME = {};
  LUCIDE.forEach(function (entry) {
    LUCIDE_BY_NAME[entry[0]] = entry;
  });

  var BRANDS_BY_NAME = {};
  BRANDS.forEach(function (entry) {
    BRANDS_BY_NAME[entry[0]] = entry;
  });

  //  Die beiden Kataloge haben unterschiedliche Spalten, weil Lucide zusaetzlich
  //  die SVG-Pfade mitfuehrt. `keywordIndex` sagt, wo die Suchbegriffe stehen.
  var SETS = {
    lucide: {
      id: "lucide",
      label: "Lucide",
      note: "SVG – hinterlässt keinen Text im PDF",
      entries: LUCIDE,
      keywordIndex: 3,
    },
    material: {
      id: "material",
      label: "Material Symbols",
      note: "Webfont – Iconname erscheint im extrahierten Text",
      entries: MATERIAL,
      keywordIndex: 2,
    },
    brands: {
      id: "brands",
      label: "Marken",
      note: "Wortmarken als Flaeche – die Strichstaerke wirkt hier nicht",
      entries: BRANDS,
      keywordIndex: 3,
    },
  };

  function normalize(value, fallbackSet) {
    if (value && typeof value === "object" && value.name) return value;
    return { set: fallbackSet || "material", name: String(value || "") };
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  /*  HTML fuer das Dokument. Icons sind Dekoration, deshalb aria-hidden:
   *  Vorlesehilfen und PDF-Textextraktion sollen sie ueberspringen.
   */
  function html(value, className) {
    var iconValue = normalize(value);
    if (!iconValue.name) return "";
    var cls = className ? " " + escapeAttr(className) : "";

    if (iconValue.set === "brands") {
      var brand = BRANDS_BY_NAME[iconValue.name];
      if (!brand) return "";
      return (
        '<svg class="rc-icon rc-icon-brand' + cls + '" viewBox="' + brand[4] + '" ' +
        'fill="currentColor" aria-hidden="true" focusable="false">' + brand[2] + "</svg>"
      );
    }

    if (iconValue.set === "lucide") {
      var entry = LUCIDE_BY_NAME[iconValue.name];
      if (!entry) return "";
      return (
        '<svg class="rc-icon' + cls + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        entry[2] + "</svg>"
      );
    }
    return (
      '<span class="material-symbols-outlined' + cls + '" aria-hidden="true">' +
      escapeAttr(iconValue.name) + "</span>"
    );
  }

  /* Dasselbe als DOM-Knoten fuer die Editor-Oberflaeche. */
  function element(value, className) {
    var wrapper = document.createElement("span");
    wrapper.className = "icon-slot";
    wrapper.innerHTML = html(value, className);
    return wrapper;
  }

  function exists(value) {
    var iconValue = normalize(value);
    if (!iconValue.name) return false;
    if (iconValue.set === "lucide") return !!LUCIDE_BY_NAME[iconValue.name];
    if (iconValue.set === "brands") return !!BRANDS_BY_NAME[iconValue.name];
    return true; // Material erlaubt jeden Namen aus der Google-Bibliothek
  }

  /*  Suche ueber Name, Gruppe und Schlagworte. Ohne Suchbegriff kommt der
   *  vollstaendige Katalog zurueck, damit der Picker sofort etwas zeigt.
   */
  function search(query, setId) {
    var set = SETS[setId] || SETS.lucide;
    var needle = String(query || "").trim().toLowerCase();
    var results = set.entries;

    if (needle) {
      var words = needle.split(/\s+/);
      results = results.filter(function (entry) {
        var haystack = (
          entry[0] + " " + entry[1] + " " + (entry[set.keywordIndex] || "")
        ).toLowerCase();
        return words.every(function (word) {
          return haystack.indexOf(word) !== -1;
        });
      });
    }
    return results.map(function (entry) {
      return { set: set.id, name: entry[0], group: entry[1] };
    });
  }

  function groups(setId) {
    var set = SETS[setId] || SETS.lucide;
    var seen = [];
    set.entries.forEach(function (entry) {
      if (seen.indexOf(entry[1]) === -1) seen.push(entry[1]);
    });
    return seen;
  }

  global.RickCVIconLib = {
    sets: SETS,
    normalize: normalize,
    html: html,
    element: element,
    exists: exists,
    search: search,
    groups: groups,
  };
})(typeof window !== "undefined" ? window : this);
