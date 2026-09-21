/*  model.js – Datenmodell, Beispieldaten und Migration.
 *
 *  Ein Dokument ist ein einziges JSON-Objekt. `createDefault(locale)` baut
 *  einen frischen Stand, `migrate(data)` hebt aeltere Staende auf die
 *  aktuelle Fassung, damit gespeicherte Daten nie verloren gehen.
 */
(function (global) {
  "use strict";

  var VERSION = 5;

  function icon(set, name) {
    return { set: set, name: name };
  }

  /* ------------------------------------------------------------ Grundgeruest */

  //  Die Werdegangs-Sektionen sind frei definierbar. `atsRole` bleibt dabei
  //  die maschinenlesbare Bedeutung: die Ueberschrift darf "Meine Reise"
  //  heissen und trotzdem als Berufserfahrung exportiert werden.
  var ATS_ROLES = ["experience", "education", "volunteer", "other"];

  function defaultSections(locale) {
    var d = RickCVI18n.doc(locale);
    return [
      { id: "education", title: d("education"), icon: icon("lucide", "graduation-cap"), atsRole: "education", show: true, page: 1 },
      { id: "experience", title: d("experience"), icon: icon("lucide", "briefcase"), atsRole: "experience", show: true, page: 1 },
      { id: "volunteer", title: d("volunteer"), icon: icon("lucide", "heart-handshake"), atsRole: "volunteer", show: true, page: 1 },
    ];
  }

  //  Ein Footer-Link ist bewusst schlicht: ein Symbol aus dem vorhandenen
  //  Katalog, ein sichtbarer Text und ein Ziel. Kein freies HTML – der
  //  Renderer maskiert alles, damit eine importierte Datei nichts einschleusen
  //  kann.
  function emptyFooterLink() {
    return { label: "", text: "", url: "", icon: icon("lucide", "link") };
  }

  //  page: auf welchem Blatt der Footer erscheint.
  //  "last" – letzte Seite (Vorgabe), "all" – auf jeder, "1"/"2" – genau dort.
  function emptyFooter() {
    return {
      show: false, mode: "iconText", intro: "", page: "last", links: [],
      //  "Ort, Datum" unter dem Lebenslauf – in deutschen Bewerbungen
      //  ueblich, anderswo unbekannt, deshalb ausgeschaltet. Was dort steht,
      //  steht in settings.place und settings.date: dieselbe Angabe wie im
      //  Anschreiben, an einer Stelle gepflegt.
      dateLine: false,
    };
  }

  function emptyEvent(sectionId) {
    return {
      title: "",
      start: "",
      end: "",
      present: false,
      //  Wie der Zeitraum erscheint: "auto" richtet sich nach dem, was
      //  eingetragen ist – ohne Enddatum steht nur der Beginn da, ohne
      //  beides gar nichts. Sonst laesst sich das Datum auch von Hand auf
      //  Zeitraum, nur Beginn oder gar nichts stellen.
      dateMode: "auto",
      icon: icon("lucide", "briefcase"),
      color: "var(--accent-color-shade2)",
      company: "",
      place: "",
      description: [],
      list: [],
      sectionId: sectionId,
      hideline: false,
      hoffset: 0,
      voffset: 0,
    };
  }

  function createBase(locale) {
    var d = RickCVI18n.doc(locale);
    return {
      version: VERSION,
      locale: locale,

      settings: {
        template: "clean",
        //  "a4" (210 x 297 mm) oder "letter" (8,5 x 11 Zoll). Wer sich in
        //  den USA bewirbt, druckt auf Letter – ein A4-PDF kommt dort auf
        //  jedem Drucker skaliert oder beschnitten heraus.
        pageSize: "a4",
        dateFormat: "short",

        //  Ort und Datum, wie sie im Anschreiben und unter dem Lebenslauf
        //  stehen. Beides bleibt am besten leer: dann nimmt das Dokument
        //  den Wohnort und den heutigen Tag – eines, das in vier Wochen
        //  wieder geoeffnet wird, traegt dann nicht mehr das Datum von
        //  damals.
        place: "",
        date: "",
        reverseTimeline: true,
        alignText: "left",
        showCoverLetter: true,

        //  "flow"   – laengerer Inhalt bekommt weitere Boegen (Vorgabe)
        //  "single" – ein festes Blatt, alles darueber wird abgeschnitten
        //  "two"    – zwei Blaetter, jeder Block wird einem zugeordnet
        //
        //  Vorgabe ist "flow": ein abgeschnittener Lebenslauf ist der
        //  schlimmere Fehler von beiden, und wer auf ein Blatt will, sieht
        //  an der Schnittkante sofort, wieviel zu streichen ist.
        pageMode: "flow",

        //  Wie Folgeblaetter aussehen – gilt fuer "zwei Seiten" wie fuer
        //  "automatisch mehrseitig".
        //  Projekte stehen im Grundriss in der Seitenspalte. Wer sie als
        //  Portfolio versteht, stellt sie in den Hauptteil – dort haben sie
        //  die ganze Breite.
        projectsColumn: "sidebar",
        page2: {
          //  "keep" – Folgeblaetter haben dieselbe Seitenspalte
          //  "none" – Folgeblaetter sind einspaltig, der Hauptteil nimmt
          //           die ganze Breite (die Spaltenbloecke laufen dort
          //           weiter, wo sonst der Hauptteil steht)
          sidebar: "keep",
          repeatPhoto: false,
          repeatContact: true,
          repeatHeader: true,
          pageNumbers: false,
        },

        //  Das Anschreiben bricht von selbst um, sobald der Text nicht mehr
        //  auf ein Blatt passt – hier steht nur, wie die Folgeblaetter
        //  aussehen. Die Vorgaben folgen DIN 5008: kein Briefkopf auf
        //  Folgeseiten, dafuer Seitenzahlen.
        letterPages: {
          repeatHeader: false,
          pageNumbers: true,
          numberFormat: "", // leer = "Seite {page} von {pages}"
        },
      },

      style: {
        fontFamily: "Open Sans",
        baseFontSize: 14, // px – Grundschriftgrad des Dokuments
        accentColor: "#286f6f",
        fontColor: "#33333b",
        backgroundColor: "#ffffff",
        sidebarMode: "light",
        sidebarColor: "#d3e2e2",
        sidebarFontColor: "#33333b",
        emptyColor: "#d9d9d9",
        //  Welche Farben jemand im Editor selbst gewaehlt hat. Nur die
        //  stehen spaeter am <body> und gewinnen damit gegen die Palette
        //  eines Themes; die uebrigen bleiben dem Theme ueberlassen.
        ownColors: {},
        sidebarWidth: 35,
        titleSize: 32,
        headlineSize: 16,      // Ueberschriften der Seitenspalte
        mainHeadlineSize: 21,  // Ueberschriften im Hauptteil
        titleGap: 5,           // Abstand unter den Ueberschriften des Hauptteils
        //  "auto" laesst dem Theme die Entscheidung; alles andere ueberstimmt es.
        profileAlign: "auto",
        iconSet: "lucide", // Vorgabe fuer neue Symbole
        //  Strichstaerke auf der Lucide-Skala (1 = fein, 3 = fett). Material
        //  Symbols wird ueber seine wght-Achse darauf abgebildet, damit beide
        //  Saetze nebeneinander gleich kraeftig wirken.
        iconStroke: 2,
        iconScale: 1, // Groesse relativ zur Ueberschrift
        iconColor: "accent", // 'accent' | 'text' | 'custom'
        iconColorCustom: "#286f6f",
        iconBg: "none", // 'none' | 'circle' | 'rounded'
        iconBgColor: "#e6f0ef",
        border: 0,
        leftMargin: 2.5,
        rightMargin: 2,
        bottomMargin: 2,
        headerHeight: 10,
        //  Wieviel Luft unter dem letzten Block bleibt, in Zentimetern.
        //  Weniger heisst: mehr passt auf ein Blatt.
        pageBottom: 0.5,
      },

      photo: {
        show: true,
        src: "",
        shape: "band",
        height: 7,
        posX: 50,
        posY: 50,
        scale: 1,
        radius: 12,
      },

      profile: { show: true, title: d("profile"), text: "", page: 1 },

      //  mapLink: Anschrift wahlweise als Link auf OpenStreetMap,
      //  mapUrl: eigene Adresse, falls die Suche daneben liegt
      contact: { name: "", role: "", address: "", city: "", email: "", phone: "",
                 mapLink: false, mapUrl: "" },

      contactTitle: d("contact"),

      sections: defaultSections(locale),
      events: [],

      skills: { show: true, title: d("skills"), icon: icon("lucide", "star"), items: [], page: 1 },
      //  Wo die Stufe steht: "inside" im Balken (Vorgabe, kurze Angaben wie
      //  "B2"), "below" darunter (auch "verhandlungssicher"), "none" gar
      //  nicht. Frueher entschied das die Laenge des Wortes – dann stand in
      //  derselben Liste eines drin und eines darunter.
      languages: { show: false, title: d("languages"), levelMode: "inside",
                   items: [], page: 1 },
      interests: { show: true, title: d("interests"), items: [], page: 1 },
      projects: { show: true, title: d("projects"), items: [], page: 1 },
      //  Leer und ausgeschaltet. Frueher stand hier ein Fuehrerschein als
      //  Beispiel – der ueberlebte aber jedes "Neu" und jeden Import und
      //  landete so in Lebenslaeufen von Leuten, die keinen haben.
      mobility: { show: false, title: d("mobility"), icon: icon("lucide", "car-front"),
                  items: [], page: 1 },
      mobilitySB: { show: false, title: d("mobility"), items: [], page: 1 },
      references: { show: false, title: d("references"), icon: icon("lucide", "users"), items: [], page: 1 },

      //  Zwei unabhaengige Link-Leisten am unteren Rand: eine in der Sidebar,
      //  eine im Hauptbereich.
      footers: { left: emptyFooter(), right: emptyFooter() },

      //  Das Aussehen als Datei. Ein mitgeliefertes Theme steht nur als
      //  Name da – dann wirken spaetere Verbesserungen auch auf alte
      //  Dokumente. Ein eigenes reist als CSS im Dokument mit, damit ein
      //  Export vollstaendig ist und cv.html ohne Baukasten gleich aussieht.
      theme: { slug: "clean", name: "", css: "", source: "" },

      ats: {
        //  "off"      – nichts einbetten (Vorgabe)
        //  "appendix" – gut lesbare Zusatzseite in Textform
        //  "hidden"   – unsichtbar hinter dem Layout (nicht empfohlen)
        mode: "off",
        custom: false, // true = der Nutzer pflegt den Text selbst
        text: "",
      },

      coverLetter: {
        recipient: "",
        subject: "",
        salutation: "",
        paragraphs: [""],
        closing: "",
        signatureImg: "",
        signatureHeight: 2,
      },
    };
  }

  /* -------------------------------------------------------------- Beispiel */

  var EXAMPLE_DE = {
    place: "Musterstadt",
    profileText:
      "Bezwinger des Dunklen Lords der Eurythmie (der, dessen Name nicht getanzt " +
      "werden darf) möchte Fahrkartenkontrollen in vollen Zügen genießen.",
    contact: {
      name: "Harald Töpfer",
      role: "Zugbegleiter",
      address: "Musterstraße 4",
      city: "12345 Musterstadt",
      email: "verlinkte@email.com",
      phone: "+49 123456789",
    },
    interests: [
      { name: "Züge", icon: icon("lucide", "train-front") },
      { name: "Die Zahl 9", icon: icon("lucide", "dices") },
      { name: "Zu Vino sag ich nie no", icon: icon("lucide", "wine") },
      { name: "Zaubertricks", icon: icon("lucide", "wand-sparkles") },
    ],
    skills: [
      { name: "Modelleisenbahn", rank: 5 },
      { name: "Klemmbausteine", rank: 4 },
      { name: "MS Paint", rank: 4 },
      { name: "Internet", rank: 3.5 },
    ],
    languages: [
      { name: "Deutsch", percentage: 100, level: "" },
      { name: "Klingonisch", percentage: 60, level: "B2" },
      { name: "Elbisch", percentage: 30, level: "A2" },
    ],
    mobility: [{ name: "Führerschein Klasse B" }],
    projects: [
      {
        name: "aufdiepalme.de",
        img: "https://opengameart.org/sites/default/files/1_7.jpg",
        url: "https://github.com/rickintoplace/RickCV",
        description: "Baumschule für Problempflanzen",
      },
      {
        name: "Privatsammlung",
        img: "https://images.pexels.com/photos/1724184/pexels-photo-1724184.jpeg?auto=compress&cs=tinysrgb&w=200",
        url: "https://github.com/rickintoplace/RickCV",
        description: "Sammelleidenschaft für Altporzellan",
      },
    ],
    references: [
      { name: "Auf Anfrage verfügbar", role: "", company: "", contact: "" },
    ],
    events: [
      { title: "Abitur", start: "10/2010", end: "11/2013", icon: icon("lucide", "graduation-cap"),
        color: "var(--accent-color-shade3)", company: "IGS für Zauberei und Kunst",
        place: "Bad Wimpeln", sectionId: "education" },
      { title: "Praktikum", start: "07/2013", end: "11/2013", icon: icon("lucide", "gamepad-2"),
        color: "var(--accent-color-shade1)", company: "Bei einem Freund",
        place: "Frankfurt", sectionId: "experience", hoffset: 20 },
      { title: "Angefangene Ausbildung zum Tierpfleger", start: "11/2013", end: "09/2015",
        icon: icon("lucide", "cat"), color: "var(--accent-color-shade3)", company: "Zoolino",
        place: "Bad Wimpeln", description: ["Tierpflege im Kontaktbereich"],
        list: ["Schildkröten streicheln", "Kaninchen streicheln"], sectionId: "education" },
      { title: "Umweltengagement", start: "09/2015", end: "07/2021", icon: icon("lucide", "recycle"),
        color: "var(--accent-color-shade1)", company: "Aldi Ost", place: "Frankfurt (Oder)",
        description: ["Tägliche Leergutrückgabe"], sectionId: "volunteer" },
      { title: "Ferienspaß", start: "07/2021", end: "10/2021", icon: icon("lucide", "train-front"),
        color: "var(--accent-color-shade2)", company: "Spaß AG", place: "Frankfurt",
        description: ["Bildungsfahrt mit ein bisschen Freizeit"],
        list: ["Wir sind mit dem Zug hingefahren", "Wir waren im Museum für Schienenverkehr"],
        sectionId: "experience" },
      { title: "Selbstständigkeit", start: "07/2021", end: "05/2022", icon: icon("lucide", "briefcase"),
        color: "var(--accent-color-shade2)", company: "Ebay Kleinanzeigen", place: "Frankfurt",
        description: ["Auktionsbetreiber von Privatsammlungen im Homeoffice"],
        sectionId: "experience" },
      { title: "Nachhaltigkeitsprojekt im Naturschutz", start: "09/2021", end: "05/2023",
        icon: icon("lucide", "sprout"), color: "var(--accent-color-shade1)", company: "Krombacher",
        place: "Kreuztal-Krombach", description: ["Unterstützung beim Erhalt von Regenwaldflächen"],
        sectionId: "volunteer", hoffset: 20 },
      { title: "Soziale Leistungen", start: "05/2023", end: "01/2025", present: true,
        icon: icon("lucide", "wine"), color: "var(--accent-color-shade3)",
        company: "Bundesagentur für Arbeit", place: "Frankfurt",
        description: ["Größtenteils als Empfänger"], sectionId: "volunteer" },
    ],
    footers: {
      left: {
        show: true,
        mode: "iconText",
        intro: "Mehr dazu im Portfolio:",
        page: "last",
        links: [
          { label: "Portfolio", text: "rickinto.place", url: "https://rickinto.place",
            icon: icon("lucide", "globe") },
        ],
      },
      right: {
        show: true,
        mode: "iconText",
        intro: "",
        page: "last",
        links: [
          { label: "GitHub", text: "github.com/rickintoplace",
            url: "https://github.com/rickintoplace", icon: icon("brands", "github") },
          { label: "LinkedIn", text: "LinkedIn", url: "https://www.linkedin.com/",
            icon: icon("brands", "linkedin") },
        ],
      },
    },
    coverLetter: {
      recipient: "Firma Beispiel GmbH\nAnsprechpartner Beate Beispiel\nBeispielstraße 2\n54321 Beispielstadt",
      subject: "Bewerbung als Zugbegleiter",
      salutation: "Sehr geehrte Damen und Herren,",
      paragraphs: [
        "hiermit bewerbe ich mich um die Stelle des Zugbegleiters und Fahrkartenkontrolleurs bei der Deutschen Bahn.",
        "Als begeisterter Modelleisenbahnkenner habe ich bereits Erfahrung in diesem Bereich und bin überzeugt, dass ich eine wertvolle Ergänzung für Ihr Team sein kann.",
        "Gern überzeuge ich Sie bei einem anregenden Glas Wein persönlich von meiner Kompetenz und erkläre Ihnen, warum die 9 seit der Grundschule meine Lieblingszahl ist.",
      ],
      closing: "Mit freundlichen Grüßen",
    },
  };

  var EXAMPLE_EN = {
    place: "Lower Piddling",
    profileText:
      "The conqueror of the Dark Lord of Eurythmy (he whose name must not be danced) aims to enchant passengers with his charm.",
    contact: {
      name: "Harold Poppins",
      role: "Train Conductor",
      address: "12 Sidings Lane",
      city: "Lower Piddling, LP3 4RW",
      email: "linked@email.com",
      phone: "+44 7700 900123",
    },
    interests: [
      { name: "Trains", icon: icon("lucide", "train-front") },
      { name: "Dices", icon: icon("lucide", "dices") },
      { name: "Rosé all day", icon: icon("lucide", "wine") },
      { name: "Magic tricks", icon: icon("lucide", "wand-sparkles") },
    ],
    skills: [
      { name: "Model railways", rank: 5 },
      { name: "Construction toys", rank: 4 },
      { name: "MS Paint", rank: 4 },
      { name: "The internet", rank: 3.5 },
    ],
    languages: [
      { name: "English", percentage: 100, level: "Native" },
      { name: "Klingon", percentage: 60, level: "B2" },
      { name: "Elvish", percentage: 30, level: "A2" },
    ],
    mobility: [{ name: "Driving licence category B" }],
    projects: [
      {
        name: "outonalimb.co.uk",
        img: "https://opengameart.org/sites/default/files/1_7.jpg",
        url: "https://github.com/rickintoplace/RickCV",
        description: "A nursery for difficult houseplants",
      },
      {
        name: "The collection",
        img: "https://images.pexels.com/photos/1724184/pexels-photo-1724184.jpeg?auto=compress&cs=tinysrgb&w=200",
        url: "https://github.com/rickintoplace/RickCV",
        description: "Devoted hoarding of antique porcelain",
      },
    ],
    references: [
      { name: "Available on request", role: "", company: "", contact: "" },
    ],
    events: [
      { title: "A-levels", start: "10/2010", end: "11/2013", icon: icon("lucide", "graduation-cap"),
        color: "var(--accent-color-shade3)", company: "St Cuthbert's School of Magic and Art",
        place: "Lower Piddling", sectionId: "education" },
      { title: "Work experience", start: "07/2013", end: "11/2013", icon: icon("lucide", "gamepad-2"),
        color: "var(--accent-color-shade1)", company: "A friend's garage",
        place: "Manchester", sectionId: "experience", hoffset: 20 },
      { title: "Apprenticeship in animal care (unfinished)", start: "11/2013", end: "09/2015",
        icon: icon("lucide", "cat"), color: "var(--accent-color-shade3)", company: "Zoolino",
        place: "Lower Piddling", description: ["Hands-on care in the petting section"],
        list: ["Stroking tortoises", "Stroking rabbits"], sectionId: "education" },
      { title: "Environmental commitment", start: "09/2015", end: "07/2021",
        icon: icon("lucide", "recycle"), color: "var(--accent-color-shade1)",
        company: "Discount supermarket", place: "Salford",
        description: ["Returning bottles, daily, without fail"], sectionId: "volunteer" },
      { title: "Summer programme", start: "07/2021", end: "10/2021", icon: icon("lucide", "train-front"),
        color: "var(--accent-color-shade2)", company: "Jolly Outings Ltd", place: "Manchester",
        description: ["An educational trip with a little free time"],
        list: ["We went there by train", "We visited the railway museum"], sectionId: "experience" },
      { title: "Self-employment", start: "07/2021", end: "05/2022", icon: icon("lucide", "briefcase"),
        color: "var(--accent-color-shade2)", company: "An online marketplace", place: "The sofa",
        description: ["Auctioneer of private collections, working from home"],
        sectionId: "experience" },
      { title: "Rainforest project", start: "09/2021", end: "05/2023",
        icon: icon("lucide", "sprout"), color: "var(--accent-color-shade1)", company: "A large brewery",
        place: "Burton upon Trent", description: ["Helping preserve rainforest"],
        sectionId: "volunteer", hoffset: 20 },
      { title: "Social security", start: "05/2023", end: "01/2025", present: true,
        icon: icon("lucide", "wine"), color: "var(--accent-color-shade3)",
        company: "The Jobcentre", place: "Manchester",
        description: ["Largely on the receiving end"], sectionId: "volunteer" },
    ],
    footers: {
      left: {
        show: true,
        mode: "iconText",
        intro: "More of this in the portfolio:",
        page: "last",
        links: [
          { label: "Portfolio", text: "rickinto.place", url: "https://rickinto.place",
            icon: icon("lucide", "globe") },
        ],
      },
      right: {
        show: true,
        mode: "iconText",
        intro: "",
        page: "last",
        links: [
          { label: "GitHub", text: "github.com/rickintoplace",
            url: "https://github.com/rickintoplace", icon: icon("brands", "github") },
          { label: "LinkedIn", text: "LinkedIn", url: "https://www.linkedin.com/",
            icon: icon("brands", "linkedin") },
        ],
      },
    },
    coverLetter: {
      recipient: "Northern Rail Ltd\nAttn. Ms Beatrice Sample\n2 Station Approach\nManchester M1 2AB",
      subject: "Application for the position of train conductor",
      salutation: "Dear Sir or Madam,",
      paragraphs: [
        "I am writing to apply for the position of train conductor and ticket inspector with Northern Rail.",
        "As a lifelong enthusiast of model railways I bring considerable relevant experience, at a scale of 1:87, and I am convinced that I would be a valuable addition to your team.",
        "I would be glad to convince you in person over a pleasant glass of wine, and to explain why 9 has been my favourite number since primary school.",
      ],
      closing: "Yours faithfully,",
    },
  };

  function createExample(locale) {
    var data = createBase(locale || "de");
    var ex = (locale || "de") === "en" ? EXAMPLE_EN : EXAMPLE_DE;

    data.photo.src = "https://i.ibb.co/QKnK1ry/image.webp";
    data.profile.text = ex.profileText;
    data.contact = JSON.parse(JSON.stringify(ex.contact));
    data.interests.items = JSON.parse(JSON.stringify(ex.interests));
    data.skills.items = JSON.parse(JSON.stringify(ex.skills));
    data.languages.items = JSON.parse(JSON.stringify(ex.languages));
    //  Drei Sprachen im Beispiel, die niemand sieht: der Block stand auf
    //  "aus", waehrend die Eintraege darunter lagen.
    data.languages.show = true;
    data.mobility.items = JSON.parse(JSON.stringify(ex.mobility));
    data.mobility.show = true;
    data.projects.items = JSON.parse(JSON.stringify(ex.projects));
    data.references.items = JSON.parse(JSON.stringify(ex.references));
    data.footers = JSON.parse(JSON.stringify(ex.footers));
    data.settings.place = ex.place;
    data.events = ex.events.map(function (event) {
      return Object.assign(emptyEvent(event.sectionId), event);
    });
    Object.assign(data.coverLetter, ex.coverLetter);
    return data;
  }

  /* ------------------------------------------------------------- Migration */

  var LEGACY_ICONS = {
    school: "graduation-cap", work: "briefcase", volunteer_activism: "heart-handshake",
    star: "star", home: "house", mail: "mail", phone: "phone", location_on: "map-pin",
    directions_car_filled: "car-front", train: "train-front", counter_9: "dices",
    wine_bar: "wine", auto_fix_high: "wand-sparkles", stadia_controller: "gamepad-2",
    cruelty_free: "cat", recycling: "recycle", spa: "sprout", liquor: "wine",
    mindfulness: "brain", nutrition: "utensils", music_note: "music",
  };

  function upgradeIcon(value, fallbackSet) {
    if (value && typeof value === "object" && value.name) return value;
    var name = String(value || "").trim();
    if (!name) return icon("lucide", "star");
    if (LEGACY_ICONS[name]) return icon("lucide", LEGACY_ICONS[name]);
    return icon(fallbackSet || "material", name);
  }

  //  Fehlende Felder aus einer Vorlage ergaenzen, vorhandene unangetastet
  //  lassen. Arrays werden nie zusammengefuehrt – sie gehoeren dem Nutzer.
  function fillMissing(target, template) {
    Object.keys(template).forEach(function (key) {
      var fallback = template[key];
      if (target[key] === undefined || target[key] === null) {
        target[key] = JSON.parse(JSON.stringify(fallback));
      } else if (
        fallback && typeof fallback === "object" && !Array.isArray(fallback) &&
        target[key] && typeof target[key] === "object" && !Array.isArray(target[key])
      ) {
        fillMissing(target[key], fallback);
      }
    });
    return target;
  }

  function migrate(data) {
    if (!data || typeof data !== "object") return null;
    var locale = data.locale || "de";

    // v2 -> v3: feste Kategorien werden zu frei definierbaren Sektionen
    if (!data.version || data.version < 3) {
      var titles = data.sectionTitles || {};
      var icons = data.sectionIcons || {};
      var d = RickCVI18n.doc(locale);

      data.sections = [
        { id: "education", title: titles.education || d("education"),
          icon: upgradeIcon(icons.education || "school"), atsRole: "education", show: true },
        { id: "experience", title: titles.experience || d("experience"),
          icon: upgradeIcon(icons.experience || "work"), atsRole: "experience", show: true },
        { id: "volunteer", title: titles.volunteer || d("volunteer"),
          icon: upgradeIcon(icons.volunteer || "volunteer_activism"), atsRole: "volunteer", show: true },
      ];
      data.contactTitle = titles.contact || d("contact");

      //  Frueher bestimmten zwei Schalter, ob Ausbildung und Ehrenamt eigene
      //  Bloecke bekamen; standen sie auf 0, liefen die Eintraege unter
      //  Berufserfahrung. Das bilden wir ab, indem die Stationen umgehaengt
      //  werden – die Kategorie auszublenden wuerde sie verschwinden lassen.
      var settings = data.settings || {};
      var merge = {
        education: settings.separateEducation === false || settings.separateEducation === 0,
        volunteer: settings.separateVolunteer === false || settings.separateVolunteer === 0,
      };

      (data.events || []).forEach(function (event) {
        if (!event.sectionId) {
          event.sectionId =
            event.kind === "education" || event.education === "1" ? "education"
            : event.kind === "volunteer" || event.volunteer === "1" ? "volunteer"
            : "experience";
        }
        if (merge[event.sectionId]) event.sectionId = "experience";
        event.icon = upgradeIcon(event.icon);
        event.present = event.present === true || event.present === "1";
        event.hideline = event.hideline === true || event.hideline === "1";
        delete event.kind; delete event.education; delete event.volunteer;
      });

      // Alte, unsichtbare ATS-Fassung nicht stillschweigend uebernehmen:
      // sie wird auf "aus" gesetzt und der Nutzer entscheidet neu.
      var hadAts = data.settings && data.settings.activateATS;
      data.ats = { mode: "off", custom: false, text: "", migratedFrom: hadAts ? "hidden" : null };

      // Referenzen waren eine reine ATS-Liste, jetzt eine echte Sektion
      var oldReferences = Array.isArray(data.references) ? data.references : [];
      data.references = {
        show: false, title: d("references"), icon: icon("lucide", "users"),
        items: oldReferences.map(function (entry) {
          return { name: entry.name || "", role: "", company: "", contact: "" };
        }),
      };

      ["skills", "mobility"].forEach(function (key) {
        if (data[key]) data[key].icon = upgradeIcon(data[key].icon);
      });
      ["interests", "mobilitySB"].forEach(function (key) {
        if (data[key] && Array.isArray(data[key].items)) {
          data[key].items.forEach(function (item) { item.icon = upgradeIcon(item.icon); });
        }
      });

      data.sections = data.sections.filter(function (section) {
        return !merge[section.id];
      });

      delete data.sectionTitles;
      delete data.sectionIcons;
      if (data.settings) {
        delete data.settings.separateEducation;
        delete data.settings.separateVolunteer;
        delete data.settings.activateATS;
      }
      data.version = 3;
    }

    //  v3 -> v4: aus dem Schalter "mehrseitig" wird eine Auswahl mit drei
    //  Moeglichkeiten, und jeder Block bekommt eine Seitenzuordnung.
    if (data.version < 4) {
      var oldSettings = data.settings || (data.settings = {});
      if (!oldSettings.pageMode) {
        oldSettings.pageMode = oldSettings.multiPage ? "flow" : "single";
      }
      delete oldSettings.multiPage;
      data.version = 4;
    }

    //  v4 -> v5: Ort und Datum standen dreimal im Dokument – im
    //  Anschreiben und in jeder der beiden Fusszeilen. Wer das Anschreiben
    //  datierte, hatte den Lebenslauf darunter noch nicht datiert. Jetzt
    //  steht beides einmal in den Einstellungen; uebernommen wird der
    //  erste Wert, den das alte Dokument traegt.
    if (data.version < 5) {
      var into = data.settings || (data.settings = {});
      var sources = [data.coverLetter,
                     data.footers && data.footers.left,
                     data.footers && data.footers.right];

      sources.forEach(function (source) {
        if (!source) return;
        if (!into.place && source.place) into.place = source.place;
        if (!into.date && source.date) into.date = source.date;
        delete source.place;
        delete source.date;
      });

      data.version = 5;
    }

    //  v4 -> Themes: die Vorlage war eine Einstellung, jetzt ist sie ein
    //  Theme. Der alte Wert wird zu dessen Namen.
    if (!data.theme || (!data.theme.slug && !data.theme.css)) {
      data.theme = {
        slug: (data.settings && data.settings.template) || "clean",
        name: "", css: "", source: "",
      };
    }

    //  Kurzzeitig gab es fuer das Anschreiben einen eigenen Seitenmodus. Es
    //  bricht jetzt von selbst um, sobald der Text nicht mehr passt – der
    //  Schluessel soll nicht in Ausgabedateien weiterleben.
    if (data.settings) delete data.settings.letterPageMode;

    //  Seitenzuordnung nachtragen. Arrays ruehrt fillMissing nicht an, die
    //  Sektionen brauchen deshalb einen eigenen Durchgang.
    (data.sections || []).forEach(function (section) {
      if (!section.page) section.page = 1;
    });

    data.locale = locale;
    data = fillMissing(data, createBase(locale));

    //  Alles, was nicht Seite 2 heisst, ist Seite 1 – auch dann, wenn eine
    //  fremde Datei etwas anderes hineingeschrieben hat.
    ["profile", "skills", "languages", "interests", "projects", "mobility",
     "mobilitySB", "references"].forEach(function (key) {
      data[key].page = Number(data[key].page) === 2 ? 2 : 1;
    });
    (data.sections || []).forEach(function (section) {
      section.page = Number(section.page) === 2 ? 2 : 1;
    });

    return data;
  }

  global.RickCVModel = {
    VERSION: VERSION,
    ATS_ROLES: ATS_ROLES,
    icon: icon,
    createBase: createBase,
    createExample: createExample,
    emptyEvent: emptyEvent,
    emptyFooter: emptyFooter,
    emptyFooterLink: emptyFooterLink,
    migrate: migrate,
    fillMissing: fillMissing,
  };
})(typeof window !== "undefined" ? window : this);
