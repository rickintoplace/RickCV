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

  //  Die Bilder des Beispiels liegen im Projekt (img/example/; die
  //  Projektbilder sind in tools/example-images/ gezeichnet). Frueher kamen
  //  sie von ibb.co, pexels und opengameart – wer den Baukasten oeffnete,
  //  meldete sich damit bei drei Fremden.
  var EXAMPLE_IMAGES = {
    photo: "./img/example/photo.webp",
    palm: "./img/example/project-palm.webp",
    porcelain: "./img/example/project-porcelain.webp",
  };

  //  Wer mit dem Beispiel angefangen hat, traegt dessen alte Adressen noch
  //  im Speicher. Sie werden gegen die neuen Bilder getauscht – geladen
  //  wuerden sie ohnehin nicht mehr (siehe isLocalImage).
  var OLD_EXAMPLE_IMAGES = {
    "https://i.ibb.co/QKnK1ry/image.webp": EXAMPLE_IMAGES.photo,
    "https://opengameart.org/sites/default/files/1_7.jpg": EXAMPLE_IMAGES.palm,
    "https://images.pexels.com/photos/1724184/pexels-photo-1724184.jpeg?auto=compress&cs=tinysrgb&w=200":
      EXAMPLE_IMAGES.porcelain,
  };

  //  Ein Bild, das ohne Netz auskommt: eingebettet (data:) oder eine Datei
  //  neben dem Baukasten. Adressen im Netz laedt RickCV nicht – ein
  //  Lebenslauf soll nicht verraten, wann und wo er geoeffnet wird, und
  //  cv.html verbietet es per Content-Security-Policy ohnehin.
  function isLocalImage(value) {
    var src = String(value === null || value === undefined ? "" : value).trim();
    if (/^data:image\//i.test(src)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || /^\/\//.test(src)) return false;
    return /^[\w./-]+$/.test(src) && !/\.\./.test(src);
  }

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
        img: EXAMPLE_IMAGES.palm,
        url: "https://github.com/rickintoplace/RickCV",
        description: "Baumschule für Problempflanzen",
      },
      {
        name: "Privatsammlung",
        img: EXAMPLE_IMAGES.porcelain,
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
        img: EXAMPLE_IMAGES.palm,
        url: "https://github.com/rickintoplace/RickCV",
        description: "A nursery for difficult houseplants",
      },
      {
        name: "The collection",
        img: EXAMPLE_IMAGES.porcelain,
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

    data.photo.src = EXAMPLE_IMAGES.photo;
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

  /* ---------------------------------------------------------------- Datum */

  //  Ein Zeitpunkt als fortlaufende Monatszahl: "04/2019" und "2019" – so
  //  steht es in AGENTS.md, und so schreibt es der Import. Frueher rechneten
  //  Renderer und Textfassung jeder fuer sich, und "2019" kam dabei als
  //  2019 heraus, "04/2019" als 24232: eine Station mit blosser Jahreszahl
  //  sortierte vor jede andere. atEnd: ein blosses Jahr als Ende meint
  //  dessen Dezember. Was sich nicht lesen laesst ("20XX"), ergibt null.
  function monthIndex(value, atEnd) {
    var text = String(value === null || value === undefined ? "" : value).trim();
    var match = /^(\d{1,2})\/(\d{4})$/.exec(text);
    if (match) {
      var month = Number(match[1]);
      return month >= 1 && month <= 12 ? Number(match[2]) * 12 + month - 1 : null;
    }
    match = /^(\d{4})$/.exec(text);
    return match ? Number(match[1]) * 12 + (atEnd ? 11 : 0) : null;
  }

  function currentMonth(now) {
    var date = now || new Date();
    return date.getFullYear() * 12 + date.getMonth();
  }

  //  Beginn und Ende einer Station. "bis heute" endet diesen Monat; ohne
  //  Ende ist eine Station ein Zeitpunkt.
  function eventStart(event) {
    return monthIndex(event && event.start, false);
  }

  function eventEnd(event, now) {
    if (!event) return null;
    if (event.present) return currentMonth(now);
    var end = monthIndex(event.end, true);
    return end === null ? monthIndex(event.start, true) : end;
  }

  //  Zum Sortieren: neueste zuerst oder zuletzt – undatierte Stationen
  //  zaehlen als 0 und bleiben damit beisammen am Anfang der Reihe.
  function compareStart(a, b) {
    return (eventStart(a) || 0) - (eventStart(b) || 0);
  }

  /* --------------------------------------------------------------- Pruefung */

  //  Ein Dokument kommt nicht nur aus dem eigenen Editor, sondern aus
  //  Dateien, Links und Sprachmodellen. Was dort an einer Stelle steht, an
  //  der der Editor nur eine Auswahl anbietet, landet im Dokument als
  //  Klasse, als Stilangabe oder in einem Attribut – ein fremder Wert hat
  //  dort nichts verloren. Also gilt, was der Editor anbietet, und sonst die
  //  Vorgabe.
  var CHOICES = {
    "settings.pageSize": ["a4", "letter"],
    "settings.dateFormat": ["short", "full"],
    "settings.alignText": ["left", "justify"],
    "settings.pageMode": ["flow", "single", "two"],
    "settings.projectsColumn": ["sidebar", "main"],
    "settings.page2.sidebar": ["keep", "none"],
    "style.sidebarMode": ["light", "dark", "custom"],
    "style.profileAlign": ["auto", "left", "center", "justify"],
    "style.iconSet": ["lucide", "material"],
    "style.iconColor": ["accent", "text", "custom"],
    "style.iconBg": ["none", "circle", "rounded"],
    "photo.shape": ["band", "rounded", "circle"],
    "languages.levelMode": ["inside", "below", "none"],
    "ats.mode": ["off", "appendix", "hidden"],
    "footers.left.mode": ["iconText", "icons"],
    "footers.right.mode": ["iconText", "icons"],
    "footers.left.page": ["last", "all", "1", "2"],
    "footers.right.page": ["last", "all", "1", "2"],
  };

  var DATE_MODES = ["auto", "range", "start", "none"];

  var COLORS = [
    "accentColor", "fontColor", "backgroundColor", "sidebarColor",
    "sidebarFontColor", "emptyColor", "iconColorCustom", "iconBgColor",
  ];

  //  Eine Farbe ist eine Farbe: Hexwert, Name oder eine Farbfunktion wie
  //  rgb() und var(). Was sonst in einer Stilangabe stehen kann – url()
  //  vor allem –, laedt im Zweifel etwas aus dem Netz, und genau das soll
  //  ein Lebenslauf nicht tun.
  var COLOR_VALUE = /^(#[0-9a-f]{3,8}|[a-z]+|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|var)\([-\w\s.,%#()/]*\))$/i;

  function isColor(value) {
    var text = String(value === null || value === undefined ? "" : value).trim();
    return COLOR_VALUE.test(text) && !/url\s*\(|image|\\/i.test(text);
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function pathGet(data, path) {
    return path.split(".").reduce(function (current, key) {
      return current && typeof current === "object" ? current[key] : undefined;
    }, data);
  }

  function pathSet(data, path, value) {
    var keys = path.split(".");
    var last = keys.pop();
    var target = keys.reduce(function (current, key) {
      return current && typeof current === "object" ? current[key] : null;
    }, data);
    if (target && typeof target === "object") target[last] = value;
  }

  //  Jeder Wert bekommt den Typ, den die Vorlage an dieser Stelle hat. Eine
  //  Zahl als Text wird zur Zahl, ein Text an der Stelle einer Liste zur
  //  Vorgabe – was der Renderer nicht versteht, soll ihn nicht zum Absturz
  //  bringen, und ein Absturz beim Laden wuerde sich bei jedem Neuladen
  //  wiederholen.
  function conform(target, template) {
    Object.keys(template).forEach(function (key) {
      var fallback = template[key];
      var value = target[key];

      if (typeof fallback === "number") {
        var number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
        target[key] = typeof number === "number" && isFinite(number) ? number : fallback;
      } else if (typeof fallback === "boolean") {
        if (typeof value === "boolean") return;
        target[key] = value === 1 || value === "1" || value === "true" ? true
          : value === 0 || value === "0" || value === "false" || value === "" ? false
          : fallback;
      } else if (typeof fallback === "string") {
        if (typeof value === "string") return;
        target[key] = typeof value === "number" && isFinite(value) ? String(value) : fallback;
      } else if (Array.isArray(fallback)) {
        if (!Array.isArray(value)) target[key] = copy(fallback);
      } else if (isObject(fallback)) {
        if (!isObject(value)) target[key] = copy(fallback);
        else conform(value, fallback);
      }
    });
    return target;
  }

  //  Ein Symbol steht als { set, name } im Dokument. Ein Sprachmodell
  //  schreibt gern nur den Namen – Lucide trennt mit Bindestrich, Material
  //  Symbols mit Unterstrich.
  function iconOf(value, fallback) {
    if (isObject(value) && typeof value.name === "string" && value.name) {
      return { set: typeof value.set === "string" && value.set ? value.set : "lucide",
               name: value.name };
    }
    if (typeof value === "string" && value.trim()) {
      return upgradeIcon(value.trim(), /_/.test(value) ? "material" : "lucide");
    }
    return copy(fallback);
  }

  //  Zeilen einer Station: eine Liste von Texten. Ein einzelner Text mit
  //  Zeilenumbruechen ist dieselbe Liste, nur anders aufgeschrieben.
  function textLines(value) {
    if (typeof value === "string") {
      return value.split("\n").filter(function (line) { return line.trim(); });
    }
    if (!Array.isArray(value)) return [];
    return value.filter(function (line) {
      return typeof line === "string" || (typeof line === "number" && isFinite(line));
    }).map(String);
  }

  //  Eintraege einer Liste: jeder ein Objekt mit den Feldern der Vorlage.
  //  fillMissing laesst Listen bewusst in Ruhe – deshalb dieser Durchgang.
  function conformItems(list, template, extra) {
    return (Array.isArray(list) ? list : []).filter(isObject).map(function (item, index) {
      //  Vor dem Angleichen festhalten: conform ersetzt ein Symbol, das nur
      //  als Name dasteht, sonst gleich durch die Vorgabe.
      var original = item.icon;
      var result = conform(fillMissing(item, template), template);
      if (template.icon) result.icon = iconOf(original, template.icon);
      if (extra) extra(result, index);
      return result;
    });
  }

  var ITEM_TEMPLATES = {
    skills: { name: "", rank: 0 },
    languages: { name: "", level: "", percentage: 0 },
    interests: { name: "", icon: icon("lucide", "star") },
    projects: { name: "", img: "", url: "", description: "" },
    mobility: { name: "" },
    mobilitySB: { name: "", icon: icon("lucide", "car-front") },
    references: { name: "", role: "", company: "", contact: "" },
  };

  //  Absaetze des Anschreibens. Ein einzelner Text ist einer oder mehrere,
  //  getrennt durch Leerzeilen – innerhalb eines Absatzes bleibt ein
  //  Zeilenumbruch ein Zeilenumbruch.
  function paragraphsOf(value) {
    if (typeof value === "string") {
      return value.split(/\n\s*\n/).filter(function (part) { return part.trim(); });
    }
    return textLines(value);
  }

  function conformDocument(data, base) {
    //  Vor dem Angleichen lesen: conform ersetzt einen Text, wo eine Liste
    //  stehen sollte, sonst gleich durch die Vorgabe.
    var paragraphs = isObject(data.coverLetter) ? paragraphsOf(data.coverLetter.paragraphs) : [];
    conform(data, base);

    Object.keys(CHOICES).forEach(function (path) {
      if (CHOICES[path].indexOf(pathGet(data, path)) === -1) {
        pathSet(data, path, pathGet(base, path));
      }
    });

    COLORS.forEach(function (key) {
      if (!isColor(data.style[key])) data.style[key] = base.style[key];
    });

    ["skills", "mobility", "references"].forEach(function (key) {
      data[key].icon = iconOf(data[key].icon, base[key].icon);
    });

    Object.keys(ITEM_TEMPLATES).forEach(function (key) {
      data[key].items = conformItems(data[key].items, ITEM_TEMPLATES[key]);
    });

    //  Die Kategorien. Ihre id steht im Dokument als Attribut und wird dort
    //  wiedergefunden; sie muss deshalb ein Text sein und eindeutig.
    var seen = {};
    data.sections = conformItems(data.sections, {
      id: "", title: "", icon: icon("lucide", "briefcase"), atsRole: "", show: true, page: 1,
    }, function (section, index) {
      if (!section.id || seen[section.id]) section.id = "s" + index + "-" + (section.id || "x");
      seen[section.id] = true;
      if (ATS_ROLES.indexOf(section.atsRole) === -1) {
        section.atsRole = ATS_ROLES.indexOf(section.id) !== -1 ? section.id : "other";
      }
    });

    data.events = (Array.isArray(data.events) ? data.events : []).filter(isObject)
      .map(function (event) {
        var template = emptyEvent("");
        var description = textLines(event.description);
        var list = textLines(event.list);
        var original = event.icon;
        var result = conform(fillMissing(event, template), template);
        result.description = description;
        result.list = list;
        result.icon = iconOf(original, template.icon);
        if (!isColor(result.color)) result.color = template.color;
        if (DATE_MODES.indexOf(result.dateMode) === -1) result.dateMode = "auto";
        if (!result.sectionId && data.sections[0]) result.sectionId = data.sections[0].id;
        return result;
      });

    ["left", "right"].forEach(function (side) {
      data.footers[side].links = conformItems(data.footers[side].links, emptyFooterLink());
    });

    if (OLD_EXAMPLE_IMAGES[data.photo.src]) data.photo.src = OLD_EXAMPLE_IMAGES[data.photo.src];
    data.projects.items.forEach(function (item) {
      if (OLD_EXAMPLE_IMAGES[item.img]) item.img = OLD_EXAMPLE_IMAGES[item.img];
    });

    data.coverLetter.paragraphs = paragraphs.length ? paragraphs : [""];

    return data;
  }

  //  Welche Fassung ein Dokument hat, wenn es keine angibt. Nur sehr alte
  //  Staende (v2) kamen ohne Nummer aus, und die erkennt man an ihren
  //  Feldern. Alles andere – ein Link, den ein Sprachmodell gebaut hat,
  //  eine Datei nach AGENTS.md – ist ein heutiges Dokument, dem nur die
  //  Nummer fehlt; es durch die Umstellung von v2 zu schicken, wuerde seine
  //  Kategorien und Referenzen ueberschreiben.
  function versionOf(data) {
    var version = Number(data.version);
    if (isFinite(version) && version >= 1) return version;

    var settings = isObject(data.settings) ? data.settings : {};
    var legacy = data.sectionTitles || data.sectionIcons || Array.isArray(data.references) ||
      settings.separateEducation !== undefined || settings.separateVolunteer !== undefined ||
      settings.activateATS !== undefined ||
      (Array.isArray(data.events) && data.events.some(function (event) {
        return event && (event.kind !== undefined || event.education !== undefined ||
                         event.volunteer !== undefined);
      }));
    if (legacy) return 2;
    //  v4 und nicht v5: der Schritt nach v5 zieht nur Ort und Datum um und
    //  schadet einem heutigen Dokument nicht; der nach v4 dagegen wuerde
    //  den fehlenden Seitenmodus auf "ein Blatt" setzen.
    return 4;
  }

  function migrate(data) {
    if (!isObject(data)) return null;
    var locale = data.locale === "en" ? "en" : "de";
    data.version = versionOf(data);
    if (!isObject(data.settings)) data.settings = {};

    // v2 -> v3: feste Kategorien werden zu frei definierbaren Sektionen
    if (data.version < 3) {
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
      var settings = data.settings;
      var merge = {
        education: settings.separateEducation === false || settings.separateEducation === 0,
        volunteer: settings.separateVolunteer === false || settings.separateVolunteer === 0,
      };

      (Array.isArray(data.events) ? data.events : []).filter(isObject).forEach(function (event) {
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
      var hadAts = data.settings.activateATS;
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
        if (isObject(data[key])) data[key].icon = upgradeIcon(data[key].icon);
      });
      ["interests", "mobilitySB"].forEach(function (key) {
        if (isObject(data[key]) && Array.isArray(data[key].items)) {
          data[key].items.filter(isObject).forEach(function (item) {
            item.icon = upgradeIcon(item.icon);
          });
        }
      });

      data.sections = data.sections.filter(function (section) {
        return !merge[section.id];
      });

      delete data.sectionTitles;
      delete data.sectionIcons;
      delete data.settings.separateEducation;
      delete data.settings.separateVolunteer;
      delete data.settings.activateATS;
      data.version = 3;
    }

    //  v3 -> v4: aus dem Schalter "mehrseitig" wird eine Auswahl mit drei
    //  Moeglichkeiten, und jeder Block bekommt eine Seitenzuordnung.
    if (data.version < 4) {
      var oldSettings = data.settings;
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
      var into = data.settings;
      var footers = isObject(data.footers) ? data.footers : {};
      var sources = [data.coverLetter, footers.left, footers.right];

      sources.forEach(function (source) {
        if (!isObject(source)) return;
        if (!into.place && source.place) into.place = source.place;
        if (!into.date && source.date) into.date = source.date;
        delete source.place;
        delete source.date;
      });

      data.version = 5;
    }

    //  v4 -> Themes: die Vorlage war eine Einstellung, jetzt ist sie ein
    //  Theme. Der alte Wert wird zu dessen Namen.
    if (!isObject(data.theme) || (!data.theme.slug && !data.theme.css)) {
      data.theme = {
        slug: typeof data.settings.template === "string" && data.settings.template
          ? data.settings.template : "clean",
        name: "", css: "", source: "",
      };
    }

    //  Kurzzeitig gab es fuer das Anschreiben einen eigenen Seitenmodus. Es
    //  bricht jetzt von selbst um, sobald der Text nicht mehr passt – der
    //  Schluessel soll nicht in Ausgabedateien weiterleben.
    delete data.settings.letterPageMode;

    data.locale = locale;
    var base = createBase(locale);
    data = conformDocument(fillMissing(data, base), base);

    //  Alles, was nicht Seite 2 heisst, ist Seite 1 – auch dann, wenn eine
    //  fremde Datei etwas anderes hineingeschrieben hat.
    ["profile", "skills", "languages", "interests", "projects", "mobility",
     "mobilitySB", "references"].forEach(function (key) {
      data[key].page = Number(data[key].page) === 2 ? 2 : 1;
    });
    data.sections.forEach(function (section) {
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
    isColor: isColor,
    isLocalImage: isLocalImage,
    monthIndex: monthIndex,
    currentMonth: currentMonth,
    eventStart: eventStart,
    eventEnd: eventEnd,
    compareStart: compareStart,
    EXAMPLE_IMAGES: EXAMPLE_IMAGES,
  };
})(typeof window !== "undefined" ? window : this);
