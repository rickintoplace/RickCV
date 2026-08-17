/*  icons.js – Icon-Katalog und Darstellung.
 *
 *  Zwei Sets:
 *    lucide   – SVG-Pfade, eingebettet in icon-data.js. Funktioniert ohne
 *               Netzwerk und hinterlaesst keinen Text im PDF.
 *    material – Google Material Symbols, per Webfont. Der Iconname ist eine
 *               Ligatur und landet daher als Wort im extrahierten Text; fuer
 *               maschinenlesbare Lebenslaeufe ist Lucide die bessere Wahl.
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

  var LUCIDE_BY_NAME = {};
  LUCIDE.forEach(function (entry) {
    LUCIDE_BY_NAME[entry[0]] = entry;
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
