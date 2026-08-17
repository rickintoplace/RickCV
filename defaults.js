/*     _____  _      _     _______      __
 *    |  __ \(_)    | |   / ____\ \    / /
 *    | |__) |_  ___| | _| |     \ \  / /
 *    |  _  /| |/ __| |/ / |      \ \/ /
 *    | | \ \| | (__|   <| |____   \  /
 *    |_|  \_\_|\___|_|\_\\_____|   \/
 *
 *  defaults.js – Datenmodell und Beispieldaten.
 *  Klassisches Script (kein Modul), damit die Seite auch per Doppelklick
 *  ohne Webserver funktioniert.
 */

window.RickCVDefaults = {
  version: 2,

  settings: {
    template: "clean", // 'clean' | 'icons' | 'dynaline'
    activateATS: true, // maschinenlesbare Kopie für Bewerbungssysteme
    dateFormat: "short", // 'short' = MM/YY, 'full' = MM/YYYY
    separateEducation: true,
    separateVolunteer: true,
    reverseTimeline: true,
    noLine: false,
    alignText: "left", // 'left' | 'justify'
    showCoverLetter: true,
  },

  style: {
    fontFamily: "Open Sans",
    accentColor: "#286f6f",
    fontColor: "#33333b",
    backgroundColor: "#ffffff",
    sidebarMode: "light", // 'light' | 'dark' | 'custom'
    sidebarColor: "#d3e2e2",
    sidebarFontColor: "#33333b",
    emptyColor: "#d9d9d9",
    sidebarWidth: 35, // %
    titleSize: 32, // px
    headlineSize: 16, // px
    border: 0, // mm Rand um die Seite
    leftMargin: 2.5, // cm – Anschreiben, DIN 5008
    rightMargin: 2,
    bottomMargin: 2,
    headerHeight: 10, // em
  },

  photo: {
    show: true,
    src: "https://i.ibb.co/QKnK1ry/image.webp",
    shape: "band", // 'band' | 'rounded' | 'circle'
    height: 7, // cm ? Bandhöhe bzw. Kreisdurchmesser
    posX: 50, // % – horizontaler Bildausschnitt
    posY: 50, // % – vertikaler Bildausschnitt
    scale: 1, // Zoom
    radius: 12, // px – nur bei 'rounded'
  },

  profile: {
    show: true,
    title: "Profil",
    text: "Bezwinger des Dunklen Lords der Eurythmie (der, dessen Name nicht getanzt werden darf) möchte Fahrkartenkontrollen in vollen Zügen genießen.",
  },

  contact: {
    name: "Harald Töpfer",
    role: "Zugbegleiter",
    address: "Musterstraße 4",
    city: "12345 Musterstadt",
    email: "verlinkte@email.com",
    phone: "+49 123456789",
  },

  languages: {
    show: false,
    title: "Sprachen",
    items: [
      { name: "Deutsch", percentage: 100, level: "" },
      { name: "Klingonisch", percentage: 60, level: "B2" },
      { name: "Elbisch", percentage: 30, level: "A2" },
    ],
  },

  mobilitySB: {
    show: false,
    title: "Mobilität",
    items: [{ name: "Führerschein Klasse B", icon: "directions_car_filled" }],
  },

  interests: {
    show: true,
    title: "Interessen",
    items: [
      { name: "Züge", icon: "train" },
      { name: "Die Zahl 9", icon: "counter_9" },
      { name: "Zu Vino sag ich nie no", icon: "wine_bar" },
      { name: "Zaubertricks", icon: "auto_fix_high" },
    ],
  },

  projects: {
    show: true,
    title: "Projekte",
    items: [
      {
        name: "aufdiepalme.de",
        img: "https://opengameart.org/sites/default/files/1_7.jpg",
        url: "https://github.com/rickintoplace/RickCV",
        description: "Baumschule für Problempflanzen",
      },
      {
        name: "Privatsammlung",
        img: "https://images.pexels.com/photos/1724184/pexels-photo-1724184.jpeg?auto=compress&cs=tinysrgb&w=200",
        img_note: "",
        url: "https://github.com/rickintoplace/RickCV",
        description: "Sammelleidenschaft für Altporzellan",
      },
    ],
  },

  skills: {
    show: true,
    title: "Kenntnisse",
    icon: "star",
    items: [
      { name: "Modelleisenbahn", rank: 5 },
      { name: "Klemmbausteine", rank: 4 },
      { name: "MS Paint", rank: 4 },
      { name: "Internet", rank: 3.5 },
    ],
  },

  mobility: {
    show: true,
    title: "Mobilität",
    icon: "directions_car_filled",
    items: [{ name: "Führerschein Klasse B" }],
  },

  sectionTitles: {
    contact: "Kontakt",
    education: "Ausbildung",
    experience: "Berufserfahrung",
    volunteer: "Ehrenamt",
  },

  sectionIcons: {
    education: "school",
    experience: "work",
    volunteer: "volunteer_activism",
  },

  references: [{ name: "Auf Anfrage verfügbar" }],

  events: [
    {
      title: "Abitur",
      start: "10/2010",
      end: "11/2013",
      present: false,
      icon: "school",
      color: "var(--accent-color-shade3)",
      company: "IGS für Zauberei und Kunst",
      place: "Bad Wimpeln",
      description: [],
      list: [],
      kind: "education",
      hideline: false,
      hoffset: 0,
      voffset: 0,
    },
    {
      title: "Praktikum",
      start: "07/2013",
      end: "11/2013",
      present: false,
      icon: "stadia_controller",
      color: "var(--accent-color-shade1)",
      company: "Bei einem Freund",
      place: "Frankfurt",
      description: [],
      list: [],
      kind: "experience",
      hideline: false,
      hoffset: 20,
      voffset: 0,
    },
    {
      title: "Angefangene Ausbildung zum Tierpfleger",
      start: "11/2013",
      end: "09/2015",
      present: false,
      icon: "cruelty_free",
      color: "var(--accent-color-shade3)",
      company: "Zoolino",
      place: "Bad Wimpeln",
      description: ["Tierpflege im Kontaktbereich"],
      list: ["Schildkröten streicheln", "Kaninchen streicheln"],
      kind: "education",
      hideline: false,
      hoffset: 0,
      voffset: 0,
    },
    {
      title: "Umweltengagement",
      start: "09/2015",
      end: "07/2021",
      present: false,
      icon: "recycling",
      color: "var(--accent-color-shade1)",
      company: "Aldi Ost",
      place: "Frankfurt (Oder)",
      description: ["Tägliche Leergutrückgabe"],
      list: [],
      kind: "volunteer",
      hideline: false,
      hoffset: 0,
      voffset: 0,
    },
    {
      title: "Ferienspaß",
      start: "07/2021",
      end: "10/2021",
      present: false,
      icon: "train",
      color: "var(--accent-color-shade2)",
      company: "Spaß AG",
      place: "Frankfurt",
      description: ["Bildungsfahrt mit ein bisschen Freizeit"],
      list: [
        "Wir sind mit dem Zug hingefahren",
        "Wir waren im Museum für Schienenverkehr",
      ],
      kind: "experience",
      hideline: false,
      hoffset: 0,
      voffset: 0,
    },
    {
      title: "Selbstständigkeit",
      start: "07/2021",
      end: "05/2022",
      present: false,
      icon: "work",
      color: "var(--accent-color-shade2)",
      company: "Ebay Kleinanzeigen",
      place: "Frankfurt",
      description: ["Auktionsbetreiber von Privatsammlungen im Homeoffice"],
      list: [],
      kind: "experience",
      hideline: false,
      hoffset: 0,
      voffset: 0,
    },
    {
      title: "Nachhaltigkeitsprojekt im Naturschutz",
      start: "09/2021",
      end: "05/2023",
      present: false,
      icon: "spa",
      color: "var(--accent-color-shade1)",
      company: "Krombacher",
      place: "Kreuztal-Krombach",
      description: ["Unterstützung beim Erhalt von Regenwaldflächen"],
      list: [],
      kind: "volunteer",
      hideline: false,
      hoffset: 20,
      voffset: 0,
    },
    {
      title: "Soziale Leistungen",
      start: "05/2023",
      end: "01/2025",
      present: true,
      icon: "liquor",
      color: "var(--accent-color-shade3)",
      company: "Bundesagentur für Arbeit",
      place: "Frankfurt",
      description: ["Größtenteils als Empfänger"],
      list: [],
      kind: "volunteer",
      hideline: false,
      hoffset: 0,
      voffset: 0,
    },
  ],

  coverLetter: {
    recipient:
      "Firma Beispiel GmbH\nAnsprechpartner Beate Beispiel\nBeispielstraße 2\n54321 Beispielstadt",
    place: "Musterstadt",
    date: "01. Januar 2025",
    subject: "Bewerbung als Zugbegleiter",
    salutation: "Sehr geehrte Damen und Herren,",
    paragraphs: [
      "hiermit bewerbe ich mich um die Stelle des Zugbegleiters und Fahrkartenkontrolleurs bei der Deutschen Bahn.",
      "Als begeisterter Modelleisenbahnkenner habe ich bereits Erfahrung in diesem Bereich und bin überzeugt, dass ich eine wertvolle Ergänzung für Ihr Team sein kann.",
      "Gern überzeuge ich Sie bei einem anregenden Glas Wein persönlich von meiner Kompetenz und erkläre Ihnen, warum die 9 seit der Grundschule meine Lieblingszahl ist.",
    ],
    closing: "Mit freundlichen Grüßen",
    signatureImg: "",
    signatureHeight: 2, // in Zeilenhöhen (rlh)
  },
};
