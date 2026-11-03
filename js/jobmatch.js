/*  jobmatch.js – Stellenanzeige gegen Lebenslauf, ohne Punktzahl.
 *
 *  Eine Zahl wie "73 % Match" waere erfunden: dieselben Bewerbungssysteme
 *  geben demselben Lebenslauf mal 66, mal 99 Punkte. Was sich dagegen
 *  ehrlich sagen laesst, ist, welche Anforderung der Anzeige im Lebenslauf
 *  belegt ist, welche dort anders heisst und welche fehlt. Genau das steht
 *  hier – pro Zeile der Anzeige, mit der Fundstelle.
 *
 *  Ablauf:
 *
 *    1. Sprache erkennen (Deutsch oder Englisch).
 *    2. Die Anzeige an ihren Ueberschriften gliedern: Aufgaben, Profil/
 *       Anforderungen – und was nicht zaehlt: "Wir bieten", "Ueber uns",
 *       Kontakt, AGG-Hinweis. Was nicht zaehlt, wird gezeigt, aber nicht
 *       ausgewertet.
 *    3. Jede Zeile bekommt ihr Gewicht aus ihren eigenen Worten: "von
 *       Vorteil", "idealerweise" macht sie zum Kann, "zwingend",
 *       "Voraussetzung" zum Muss. "keine Vorkenntnisse noetig" streicht sie.
 *    4. Begriffe gewinnen: aus einem kuratierten Lexikon (mit echten
 *       Synonymen wie JS = JavaScript und nur verwandten Begriffen wie
 *       Kundenbetreuung ~ Kundenservice), aus Mustern ("Kenntnisse in X",
 *       "Ausbildung als X", "experience with X") und aus den Substantiven
 *       einer deutschen Zeile. "A oder B" wird zu einer Gruppe, die ein
 *       Treffer erfuellt.
 *    5. Im Lebenslauf suchen – Gross/klein, Umlaute, Bindestriche,
 *       Gendersternchen und Wortendungen egal. "Projekt-Management" ist
 *       "Projektmanagement", "Pfleger:in" ist "Pfleger".
 *
 *  Alles laeuft im Browser, deterministisch und ohne Netz. Die Datei kennt
 *  kein DOM; tests/jobmatch.test.mjs prueft sie in Node.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------- Normalisieren */

  var UMLAUT = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" };

  //  Fuer den Vergleich: klein, Umlaute ausgeschrieben, Akzente weg,
  //  alle Striche gleich.
  function fold(text) {
    return String(text || "").normalize("NFKC").toLowerCase()
      .replace(/[äöüß]/g, function (c) { return UMLAUT[c]; })
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[‐‑‒–—―]/g, "-");
  }

  //  Gendern faellt weg – Anzeigen gendern auf jede erdenkliche Art, und
  //  Lebenslaeufe stehen oft in der weiblichen Form. Beide werden auf eine
  //  Grundform gebracht, damit "Köch*in" in der Anzeige und "Köchin" im
  //  Lebenslauf dasselbe Wort sind. Die Faelle folgen dem, was Werkzeuge wie
  //  "Binnen-I be gone" und "entgender" abdecken (eigener Code, gleiche
  //  Liste der Faelle):
  //    Kennzeichen      (m/w/d), (w/m/div), (d/m/w), m/w/d, (gn), (all genders)
  //    Zeichen          Pfleger*in, Pfleger:innen, Pfleger_in, Pfleger·in,
  //                     Pfleger/-in, Pfleger/innen, PflegerInnen, Pfleger(in)
  //    Umlaut und -e    Ärzt*in → Arzt, Köch:in → Koch, Kolleg*in → Kollege
  //    Doppelformen     Ärztinnen und Ärzte, Köchin/Koch, Kauffrau/-mann
  //    Partizipien      Mitarbeitende, Studierende, Teilnehmende, Lehrende
  //    Weiblich allein  Köchin, Ärztin, Kauffrau, Psychologin (im Lebenslauf)
  var L = "A-Za-zÄÖÜäöüß";
  var MARK = "[:*_·•’'·•∗✱⚧|]";
  var UMLAUT_BASE = [
    [/ärzt$/i, "arzt"], [/köch$/i, "koch"], [/anwält$/i, "anwalt"], [/bäuer$/i, "bauer"],
    [/rät$/i, "rat"], [/präsident$/i, "präsident"],
  ];
  //  Stamm ohne "-in"/"-innen" → maennliche Grundform: "Ärzt" → "Arzt",
  //  "Kolleg" → "Kollege", "Psycholog" → "Psychologe", "Kund" → "Kunde".
  function baseOf(stem) {
    for (var i = 0; i < UMLAUT_BASE.length; i++) {
      if (UMLAUT_BASE[i][0].test(stem)) {
        var fixed = stem.replace(UMLAUT_BASE[i][0], UMLAUT_BASE[i][1]);
        return /^[A-ZÄÖÜ]/.test(stem) ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
      }
    }
    if (/(kolleg|kund|[a-zäöüß]{3,}og)$/i.test(stem)) return stem + "e";
    if (/beamt$/i.test(stem)) return stem + "er";
    return stem;
  }
  function deumlaut(word) {
    return String(word).toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
  }
  //  "Ärztinnen und Ärzte": ist das eine die weibliche Form des anderen?
  function pairOf(fem, masc) {
    var f = deumlaut(fem.replace(/in(nen)?$/i, ""));
    var m = deumlaut(masc);
    return f === m || f === m.replace(/(en|e|n)$/, "") || f + "e" === m || f + "en" === m;
  }
  var PARTICIPLES = {
    mitarbeitende: "Mitarbeiter", mitarbeitenden: "Mitarbeiter", studierende: "Studenten", studierenden: "Studenten",
    teilnehmende: "Teilnehmer", teilnehmenden: "Teilnehmer", lehrende: "Lehrer", lehrenden: "Lehrer",
    beschaeftigte: "Beschäftigte", dozierende: "Dozenten", dozierenden: "Dozenten", forschende: "Forscher",
    lernende: "Lernende", pflegende: "Pfleger", kundinnen: "Kunden",
  };
  //  Woerter, die wie Binnen-I aussehen, aber keins sind.
  var NOT_BINNEN = /^(LinkedIn|PlugIn|CheckIn|LogIn|SignIn|BuiltIn|DropIn|AddIn|WalkIn)$/;

  function ungender(text) {
    var out = String(text || "");
    //  Kennzeichen
    out = out
      .replace(/\(\s*(?:[mwdfxi]|div|divers|weiblich|maennlich|männlich)\s*(?:[\/|,.*]\s*(?:[mwdfxi]|div|divers|weiblich|maennlich|männlich)\s*){1,3}\)/gi, " ")
      .replace(/\(\s*(?:gn|all genders?|alle geschlechter|genderneutral|geschlechtsneutral|m\s*\/\s*w\s*\/\s*x)\s*\)/gi, " ")
      .replace(/(^|[^A-Za-z])[mwd]\s*\/\s*[mwd]\s*\/\s*[mwdx]\b/gi, "$1 ");
    //  Doppelformen: "Kauffrau/-mann", "Kaufmann / Kauffrau", "Fachfrau/-mann"
    out = out
      .replace(new RegExp("([" + L + "]+)frau\\s*\\/\\s*-?\\s*(?:\\1)?mann\\b", "gi"), "$1mann")
      .replace(new RegExp("([" + L + "]+)mann\\s*\\/\\s*-?\\s*(?:\\1)?frau\\b", "gi"), "$1mann")
      .replace(/(kauf|fach)frauen\b/gi, "$1leute")
      .replace(/(kauf|fach)frau\b/gi, "$1mann");
    //  "Ärztinnen und Ärzte", "Köchin/Koch", "Erzieherin oder Erzieher" –
    //  und umgekehrt "Arzt/Ärztin", "Lehrer und Lehrerinnen".
    out = out.replace(new RegExp("(?<![" + L + "])([" + L + "]+in(?:nen)?)\\s*(?:\\/|\\bund\\b|\\boder\\b|\\bbzw\\.?|&)\\s*(?:(?:der|die|den|dem|des)\\s+)?([" + L + "]+)", "g"),
      function (all, fem, masc) { return pairOf(fem, masc) ? masc : all; });
    out = out.replace(new RegExp("(?<![" + L + "])([" + L + "]+)\\s*(?:\\/|\\bund\\b|\\boder\\b|\\bbzw\\.?|&)\\s*(?:(?:der|die|den|dem|des)\\s+)?([" + L + "]+in(?:nen)?)\\b", "g"),
      function (all, masc, fem) { return pairOf(fem, masc) ? masc : all; });
    //  Zeichen vor -in/-innen
    out = out
      .replace(/\b(Kund|Kolleg|Patient|Student|Assistent|Praktikant|Absolvent|Klient|Interessent|Referent|Dozent)(?:[:*_·•’'\/]-?|·)innen\b/g, "$1en")
      .replace(new RegExp("([" + L + "]+?)" + MARK + "-?in(nen)?\\b", "g"), function (all, stem, plural) {
        var base = baseOf(stem);
        return plural && base !== stem && /e$/.test(base) ? base + "n" : base;
      })
      .replace(new RegExp("([" + L + "]+?)\\/-?in(nen)?\\b", "g"), function (all, stem) { return baseOf(stem); })
      .replace(/([a-zäöüß])\(inn\)en\b/g, "$1en")
      .replace(/([a-zäöüß])\((?:in|innen)\)/gi, "$1")
      .replace(/([a-zäöüß])\/(r|n|s|e)\b/gi, "$1")
      .replace(/([a-zäöüß])[:*_·](r|n|s|e)\b/gi, "$1");
    //  Binnen-I: "PflegerInnen", "SchülerInnenvertretung"
    out = out.replace(new RegExp("[" + L + "]+In(?:nen)?[a-zäöüß]*", "g"), function (word) {
      if (NOT_BINNEN.test(word)) return word;
      return word.replace(/([a-zäöüß])In(?:nen)?(?=[a-zäöüß]{3,}|$)/, "$1");
    });
    //  Partizipien und weibliche Formen ohne Zeichen
    out = out.replace(new RegExp("[" + L + "]+", "g"), function (word) {
      var key = deumlaut(word).replace(/ß/g, "ss");
      if (PARTICIPLES[key]) return PARTICIPLES[key];
      var fem = word.match(/^(.*?(?:ärzt|köch|anwält|bäuer|kolleg|kund|beamt|[a-zäöüß]{4,}og))in(nen)?$/i);
      if (fem && !/^(log|login)$/i.test(word)) return baseOf(fem[1]);
      return word;
    });
    return out;
  }

  //  Zum Suchen: nur Buchstaben und Ziffern, durch je ein Leerzeichen
  //  getrennt. "+" und "#" bleiben, sonst wuerden C++ und C# zu C.
  function spaced(text) {
    return " " + fold(ungender(text)).replace(/[^a-z0-9+#]+/g, " ").trim() + " ";
  }

  function compact(text) {
    return fold(ungender(text)).replace(/[^a-z0-9+#]+/g, "");
  }

  //  Eine leichte Wortstammbildung: genug, damit "Pflegekraefte" und
  //  "Pflegekraft" oder "projects" und "project" sich finden. Kurze Woerter
  //  bleiben, wie sie sind – sonst wird aus "Java" ein "Jav".
  function stem(word) {
    var w = word;
    if (w.length < 6) return w;
    if (/(kraefte)$/.test(w)) return w.replace(/kraefte$/, "kraft");
    w = w.replace(/(ungen|heiten|keiten|ern|en|er|es|e|n|s)$/, function (end) {
      return end === "ungen" ? "ung" : end === "heiten" ? "heit" : end === "keiten" ? "keit" : "";
    });
    w = w.replace(/(ies)$/, "y").replace(/(ing|ed)$/, "");
    return w.length >= 4 ? w : word;
  }

  /* ---------------------------------------------------------- Lexikon */

  //  keys: was als dasselbe gilt (ein Treffer). Gross geschriebene Kurz-
  //  formen mit "cs" werden nur in genau dieser Schreibweise erkannt – "Go"
  //  ist eine Sprache, "go" ein Verb; "R" eine Sprache, "r" ein Buchstabe.
  var LEXICON = [
    // Programmiersprachen und Technik
    { label: "JavaScript", keys: ["javascript", "js", "ecmascript"] },
    { label: "TypeScript", keys: ["typescript", "ts"], cs: ["TS"] },
    { label: "Python", keys: ["python"] },
    { label: "Java", keys: ["java"] },
    { label: "Kotlin", keys: ["kotlin"] },
    { label: "C#", keys: ["c#", "csharp"] },
    { label: "C++", keys: ["c++", "cpp"] },
    { label: "C", cs: ["C"], keys: [] },
    { label: "R", cs: ["R"], keys: [] },
    { label: "Go", cs: ["Go", "Golang"], keys: ["golang"] },
    { label: "Rust", keys: ["rust"] },
    { label: "PHP", keys: ["php"] },
    { label: "Ruby", keys: ["ruby"] },
    { label: "Ruby on Rails", keys: ["ruby on rails", "rails"], cs: ["Rails"] },
    { label: "Swift", cs: ["Swift"], keys: [] },
    { label: "SQL", keys: ["sql"] },
    { label: "PostgreSQL", keys: ["postgresql", "postgres"] },
    { label: "MySQL", keys: ["mysql"] },
    { label: "MongoDB", keys: ["mongodb", "mongo"] },
    { label: "HTML", keys: ["html", "html5"] },
    { label: "CSS", keys: ["css", "css3"] },
    { label: "React", keys: ["react", "reactjs", "react js"] },
    { label: "Vue", keys: ["vue", "vuejs", "vue js"] },
    { label: "Angular", keys: ["angular"] },
    { label: "Node.js", keys: ["node js", "nodejs", "node"] },
    { label: ".NET", keys: ["net", "dotnet"], cs: [".NET"] },
    { label: "Spring", cs: ["Spring", "Spring Boot"], keys: ["spring boot"] },
    { label: "Django", keys: ["django"] },
    { label: "Docker", keys: ["docker"] },
    { label: "Kubernetes", keys: ["kubernetes", "k8s"] },
    { label: "AWS", keys: ["aws", "amazon web services"] },
    { label: "Azure", keys: ["azure", "microsoft azure"] },
    { label: "Google Cloud", keys: ["google cloud", "gcp", "google cloud platform"] },
    { label: "Git", keys: ["git"] },
    { label: "Linux", keys: ["linux"] },
    { label: "CI/CD", keys: ["ci cd", "cicd", "continuous integration", "continuous delivery"] },
    { label: "Terraform", keys: ["terraform"] },
    { label: "REST", keys: ["rest", "rest api", "restful"], cs: ["REST"] },
    { label: "GraphQL", keys: ["graphql"] },
    { label: "Machine Learning", keys: ["machine learning", "maschinelles lernen", "ml"], cs: ["ML"] },
    { label: "Figma", keys: ["figma"] },
    { label: "Jira", keys: ["jira"] },
    { label: "Confluence", keys: ["confluence"] },
    { label: "Salesforce", keys: ["salesforce"] },
    { label: "HubSpot", keys: ["hubspot"] },
    { label: "Power BI", keys: ["power bi", "powerbi"] },
    { label: "Tableau", keys: ["tableau"] },
    { label: "Photoshop", keys: ["photoshop", "adobe photoshop"] },
    { label: "InDesign", keys: ["indesign", "adobe indesign"] },
    { label: "Illustrator", keys: ["illustrator", "adobe illustrator"] },
    { label: "SAP", keys: ["sap", "sap erp", "sap s 4hana", "s 4hana"] },
    { label: "DATEV", keys: ["datev"] },
    { label: "Lexware", keys: ["lexware"] },
    { label: "Excel", implies: [], keys: ["excel", "ms excel", "microsoft excel"] },
    { label: "Word", cs: ["Word"], keys: ["ms word", "microsoft word"] },
    { label: "PowerPoint", keys: ["powerpoint", "ms powerpoint"] },
    { label: "MS Office", keys: ["ms office", "microsoft office", "office paket", "office"] , cs: [] },
    { label: "Microsoft 365", implies: ["MS Office"], keys: ["microsoft 365", "m365", "office 365", "o365"] },
    { label: "Windows Server", keys: ["windows server"] },
    { label: "Active Directory", keys: ["active directory", "ad ds"] },
    { label: "TCP/IP", keys: ["tcp ip", "tcpip"] },
    { label: "VMware", keys: ["vmware", "vsphere", "esxi"] },
    { label: "PowerShell", keys: ["powershell"] },
    { label: "Intune", keys: ["intune", "microsoft intune"] },
    { label: "Instagram", keys: ["instagram"] },
    { label: "TikTok", keys: ["tiktok"] },
    { label: "LinkedIn", keys: ["linkedin"] },
    { label: "Facebook", keys: ["facebook", "meta business suite"] },
    { label: "Google Analytics", keys: ["google analytics", "ga4"] },
    { label: "Espresso", keys: ["espresso"] },
    { label: "Latte Art", keys: ["latte art"] },
    { label: "Führungszeugnis", labelEn: "Criminal record check", keys: ["fuehrungszeugnis", "erweitertes fuehrungszeugnis", "fuehrungszeugnisses", "erweiterten fuehrungszeugnisses"], kind: "condition" },
    { label: "Background check", keys: ["background check", "criminal background check", "dbs check"], kind: "condition" },
    { label: "Gesundheitszeugnis", labelEn: "Health certificate", keys: ["gesundheitszeugnis", "belehrung nach 43 ifsg", "43 ifsg", "ifsg", "infektionsschutzgesetz", "infektionsschutzbelehrung"], kind: "condition" },
    { label: "Food handler card", keys: ["food handler", "food handlers", "food handler card", "food handler s card", "food handler certificate", "food handlers card"], kind: "cert" },
    { label: "RN license", keys: ["rn license", "rn licence", "registered nurse license", "nursing license"], kind: "cert" },
    { label: "BLS", keys: ["bls", "basic life support"], kind: "cert" },
    { label: "ACLS", keys: ["acls", "advanced cardiac life support"], kind: "cert" },
    { label: "BSN", keys: ["bsn", "bachelor of science in nursing"], kind: "degree" },
    { label: "KNX", keys: ["knx"] },
    { label: "KI", labelEn: "AI", keys: ["ki", "kuenstliche intelligenz", "artificial intelligence"], cs: ["AI"] },
    { label: "GenAI", keys: ["genai", "gen ai", "generative ki", "generative ai", "generative kuenstliche intelligenz"] },
    { label: "Softwareentwicklung", labelEn: "Software development", keys: ["softwareentwicklung", "software entwicklung", "software development", "software engineering"] },
    { label: "IT-Architektur", labelEn: "IT architecture", keys: ["it architektur", "it architecture", "enterprise architecture", "unternehmensarchitektur"] },
    { label: "Governance", keys: ["governance", "it governance", "data governance", "ai governance", "ki governance"] },
    { label: "Prototyping", keys: ["prototyping", "prototypen", "prototypenbau"] },
    { label: "Data Science", keys: ["data science", "datenwissenschaft"] },
    { label: "Stakeholder-Management", keys: ["stakeholder management", "stakeholdermanagement"] },
    { label: "Change Management", keys: ["change management", "changemanagement", "veraenderungsmanagement", "veraenderungsprozesse", "veraenderungsprozessen"] },
    { label: "Product Owner", keys: ["product owner", "produktverantwortung"] },
    { label: "Produktmanagement", labelEn: "Product management", keys: ["produktmanagement", "produktmanager", "product management", "product manager"] },
    { label: "Informationssicherheit", labelEn: "Information security", keys: ["informationssicherheit", "information security", "it sicherheit", "isms"] },
    { label: "Datenschutz", labelEn: "Data protection", keys: ["datenschutz", "dsgvo", "gdpr", "data protection"] },
    { label: "Geschäftsprozesse", labelEn: "Business processes", keys: ["geschaeftsprozesse", "geschaeftsprozessen", "geschaeftsprozess", "business processes", "prozessmanagement"] },
    { label: "Google Ads", keys: ["google ads", "adwords", "google adwords"] },
    { label: "Meta Ads", keys: ["meta ads", "facebook ads", "instagram ads"] },
    { label: "Looker Studio", keys: ["looker studio", "google data studio", "data studio"] },
    { label: "Performance Marketing", keys: ["performance marketing", "performancemarketing", "paid media"] },
    { label: "A/B-Tests", labelEn: "A/B testing", keys: ["a b tests", "a b test", "a b testing", "ab tests", "ab testing", "split tests"] },
    { label: "Webanalyse", labelEn: "Web analytics", keys: ["webanalyse", "web analytics", "webtracking"] },
    { label: "WordPress", keys: ["wordpress"] },
    { label: "Content-Management-System", labelEn: "Content system", keys: ["content management system", "content management systeme", "content management systemen", "cms"] },
    { label: "Arbeitsrecht", labelEn: "Employment law", keys: ["arbeitsrecht", "arbeitsrechtliche", "employment law", "labour law", "labor law"] },
    { label: "Betriebsverfassungsgesetz", keys: ["betriebsverfassungsgesetz", "betrvg", "betriebsverfassungsrecht"] },
    { label: "Personalwesen", labelEn: "Human resources", keys: ["personalwesen", "personalmanagement", "personalarbeit", "human resources", "hr management"] },
    { label: "SAP CO", implies: ["SAP"], keys: ["sap co"] },
    { label: "SAP FI", implies: ["SAP"], keys: ["sap fi"] },
    { label: "SAP HCM", implies: ["SAP"], keys: ["sap hcm", "sap hr"] },
    { label: "SAP MM", implies: ["SAP"], keys: ["sap mm"] },
    { label: "SAP SD", implies: ["SAP"], keys: ["sap sd"] },
    { label: "SAP PM", implies: ["SAP"], keys: ["sap pm"] },
    { label: "SAP EWM", implies: ["SAP"], keys: ["sap ewm"] },
    { label: "Fachinformatiker Systemintegration", keys: ["fachinformatiker fuer systemintegration", "fachinformatiker systemintegration", "fachinformatiker si"] },
    { label: "Fachinformatiker Anwendungsentwicklung", keys: ["fachinformatiker fuer anwendungsentwicklung", "fachinformatiker anwendungsentwicklung", "fachinformatiker ae"] },
    { label: "Anlagenmechaniker SHK", keys: ["anlagenmechaniker shk", "anlagenmechaniker fuer sanitaer heizungs und klimatechnik", "anlagenmechaniker sanitaer heizung klima"] },
    { label: "Gas- und Wasserinstallateur", keys: ["gas und wasserinstallateur", "gas wasserinstallateur"] },
    { label: "Soziale Arbeit", labelEn: "Social work", keys: ["soziale arbeit", "sozialen arbeit", "sozialpaedagogik", "social work"] },
    { label: "À-la-carte-Küche", labelEn: "À la carte", keys: ["a la carte", "a la carte kueche", "a la carte geschaeft"] },
    { label: "Wochenendarbeit", labelEn: "Weekend work", keys: ["wochenendarbeit", "arbeit am wochenende", "wochenenddienst", "wochenenddienste", "weekend work", "work weekends", "early mornings and weekends"], kind: "condition" },
    { label: "Forklift certification", keys: ["forklift certification", "forklift license", "forklift licence", "forklift certified"] },
    { label: "SQL Server", keys: ["sql server", "mssql", "ms sql"] },
    { label: "iOS", keys: ["ios"] },
    { label: "macOS", keys: ["macos", "mac os"] },
    { label: "CompTIA A+", keys: ["comptia a+", "comptia a"], cert: true },
    { label: "HACCP", keys: ["haccp"] },
    { label: "ServSafe", keys: ["servsafe"], cert: true },
    { label: "Next.js", keys: ["next js", "nextjs"] },
    { label: "Customer service", keys: ["customer service"] },
    { label: "Outlook", keys: ["outlook"] },
    { label: "CAD", keys: ["cad", "autocad"] },
    { label: "SolidWorks", keys: ["solidworks"] },
    { label: "Scrum", keys: ["scrum"] },
    { label: "Kanban", keys: ["kanban"] },
    { label: "Agile Methoden", labelEn: "Agile methods", keys: ["agile methoden", "agile methods", "agil", "agile"] },
    // Zertifikate – nie durch die blosse Faehigkeit belegt
    { label: "PMP", keys: ["pmp"], cert: true },
    { label: "PRINCE2", keys: ["prince2"], cert: true },
    { label: "ITIL", keys: ["itil"], cert: true },
    { label: "Scrum Master", keys: ["scrum master", "psm", "csm"], cert: true },
    { label: "Führerschein Klasse B", labelEn: "Driver's license (class B)", kind: "licence", implies: ["Führerschein"], keys: ["fuehrerschein klasse b", "fuehrerschein b", "fahrerlaubnis klasse b", "klasse b", "pkw fuehrerschein"] },
    { label: "Führerschein Klasse CE", kind: "licence", implies: ["Führerschein Klasse C", "Führerschein Klasse B", "Führerschein"], keys: ["fuehrerschein klasse ce", "fuehrerschein ce", "fahrerlaubnis klasse ce", "klasse ce", "klasse c e", "lkw fuehrerschein"] },
    { label: "Führerschein Klasse C", kind: "licence", implies: ["Führerschein Klasse B", "Führerschein"], keys: ["fuehrerschein klasse c", "fahrerlaubnis klasse c", "klasse c", "klasse c1"] },
    { label: "Führerschein Klasse D", kind: "licence", implies: ["Führerschein Klasse B", "Führerschein"], keys: ["fuehrerschein klasse d", "klasse d", "busfuehrerschein"] },
    { label: "Führerschein", labelEn: "Driver's license", kind: "licence", keys: ["fuehrerschein", "fahrerlaubnis", "driving licence", "driver s license", "drivers license", "driver license"] },
    { label: "Staplerschein", labelEn: "Forklift license", keys: ["staplerschein", "gabelstaplerschein", "flurfoerderzeugschein"] },
    // Sprachen
    { label: "Deutsch", labelEn: "German", keys: ["deutsch", "german", "deutschkenntnisse", "deutsche sprache", "deutschen sprache", "deutscher sprache"], language: true },
    { label: "Englisch", labelEn: "English", keys: ["englisch", "english", "englischkenntnisse", "englische sprache", "englischen sprache"], language: true },
    { label: "Französisch", labelEn: "French", keys: ["franzoesisch", "french"], language: true },
    { label: "Spanisch", labelEn: "Spanish", keys: ["spanisch", "spanish"], language: true },
    { label: "Italienisch", labelEn: "Italian", keys: ["italienisch", "italian"], language: true },
    { label: "Polnisch", labelEn: "Polish", keys: ["polnisch", "polish"], language: true },
    { label: "Türkisch", labelEn: "Turkish", keys: ["tuerkisch", "turkish"], language: true },
    { label: "Russisch", labelEn: "Russian", keys: ["russisch", "russian"], language: true },
    { label: "Arabisch", labelEn: "Arabic", keys: ["arabisch", "arabic"], language: true },
    { label: "Niederländisch", labelEn: "Dutch", keys: ["niederlaendisch", "dutch"], language: true },
    // Pflege, Gesundheit, Handwerk – haeufig in deutschen Anzeigen
    { label: "Pflegefachkraft", labelEn: "Registered nurse", keys: ["pflegefachkraft", "pflegefachfrau", "pflegefachmann", "examinierte pflegekraft", "gesundheits und krankenpfleger", "krankenpfleger", "krankenschwester", "registered nurse"] },
    { label: "Intensivpflege", labelEn: "Intensive care", keys: ["intensivpflege", "intensivstation", "intensive care", "icu"] },
    { label: "Wundversorgung", labelEn: "Wound care", keys: ["wundversorgung", "wundmanagement", "wound care"] },
    { label: "Pflegedokumentation", labelEn: "Care documentation", keys: ["pflegedokumentation"] },
    { label: "Erste Hilfe", labelEn: "First aid", keys: ["erste hilfe", "first aid"] },
    { label: "Schichtdienst", labelEn: "Shift work", kind: "condition", keys: ["schichtdienst", "schichtarbeit", "wechselschicht", "shift work", "schichtsystem", "2 schicht system", "3 schicht system", "zweischichtsystem", "dreischichtsystem", "2 schichtsystem", "3 schichtsystem", "schichtbetrieb", "wechseldienst", "schicht und wechseldienst"] },
    // Wirtschaft
    { label: "Finanzbuchhaltung", labelEn: "Financial accounting", keys: ["finanzbuchhaltung", "fibu", "financial accounting"], implies: ["Buchhaltung"] },
    { label: "Lohnbuchhaltung", labelEn: "Payroll", keys: ["lohnbuchhaltung", "lohn und gehaltsabrechnung", "entgeltabrechnung", "payroll"], implies: ["Buchhaltung"] },
    { label: "Buchhaltung", labelEn: "Accounting", keys: ["buchhaltung", "bookkeeping", "accounting"] },
    { label: "Controlling", keys: ["controlling"] },
    { label: "Vertrieb", labelEn: "Sales", keys: ["vertrieb", "sales"] },
    { label: "Marketing", keys: ["marketing"] },
    { label: "SEO", keys: ["seo", "suchmaschinenoptimierung", "search engine optimization"] },
    { label: "Projektmanagement", labelEn: "Project management", keys: ["projektmanagement", "project management", "projektleitung"] },
  ];

  //  Verwandt, aber nicht dasselbe: zaehlt als "anders formuliert", nie als
  //  Treffer. Die Person soll entscheiden, ob ihr Wort das gemeinte ist.
  var RELATED = [
    ["fuehrungszeugnis", "background check", "dbs check"],
    ["staplerschein", "gabelstaplerschein", "forklift certification", "forklift license"],
    ["kundenbetreuung", "kundenservice", "kundensupport", "kundenkontakt", "kundenberatung", "kundendienst", "customer service", "customer support", "customer care"],
    ["teamfaehigkeit", "teamarbeit", "teamplayer", "teamfaehig", "teamwork", "team player", "teamorientiert"],
    ["kommunikationsfaehigkeit", "kommunikationsstaerke", "kommunikationsstark", "kommunikativ", "communication skills", "kommunikationsgeschick"],
    ["belastbarkeit", "belastbar", "stressresistenz", "stressresistent", "resilience"],
    ["zuverlaessigkeit", "zuverlaessig", "verlaesslich", "reliability", "reliable"],
    ["selbststaendigkeit", "selbststaendig", "eigenverantwortlich", "eigeninitiative", "independent", "self motivated"],
    ["organisationstalent", "organisationsfaehigkeit", "organisiert", "strukturiert", "organisational skills", "organizational skills"],
    ["fuehrungserfahrung", "fuehrungskompetenz", "personalverantwortung", "teamleitung", "leadership", "team lead"],
    ["projektmanagement", "projektleitung", "projektkoordination", "project management", "project coordination"],
    ["dokumentation", "documentation", "pflegedokumentation"],
    ["beratung", "consulting", "beratend"],
    ["analyse", "analysis", "analytics", "datenanalyse", "data analysis"],
    ["kubernetes", "openshift", "eks", "aks", "gke"],
    ["vertrieb", "verkauf", "sales", "akquise", "neukundengewinnung"],
    ["buchhaltung", "rechnungswesen", "finanzbuchhaltung", "accounting"],
    ["ms office", "excel", "word", "powerpoint", "outlook"],
  ];

  /* -------------------------------------------------------- Stoppwoerter */

  var STOP_DE = ("und oder der die das den dem des ein eine einer eines einem einen mit von zu zur zum im in an am auf aus bei fuer ueber unter nach vor durch sowie als wie auch sie du wir ihr ihre ihren ihrem ihrer dein deine deinen deiner unser unsere uns euch sich ist sind sein bist hast hat haben wird werden bzw idealerweise sehr gute guter gutes gut erste ersten mehrjaehrige mehrjaehriger mehrjaehrigen fundierte fundierten ausgepraegte ausgepraegtes ausgepraegter hohe hohes hohen sichere sicherer sicheres sicheren selbststaendige strukturierte eigenverantwortliche abgeschlossene abgeschlossenes abgeschlossenen relevante relevanten entsprechende entsprechenden vergleichbare vergleichbaren einschlaegige einschlaegigen gerne gern wuenschenswert vorteil vorteilhaft").split(" ");
  var STOP_EN = ("and or the a an of to in on at for with from by as is are be you your we our us their they it this that these those will would can could should must have has had strong solid good excellent proven ideally preferably plus nice bonus etc e g i e including within across years year experience").split(" ");

  //  Allgemeine Substantive, die in jeder Anzeige stehen und nichts ueber
  //  die Stelle sagen. Ohne diese Liste waere "Erfahrung" die haeufigste
  //  Anforderung jeder Anzeige.
  var GENERIC = ("erfahrung erfahrungen kenntnis kenntnisse bereich bereichen bereichs aufgabe aufgaben team teams unternehmen firma mitarbeiter mitarbeiterin mitarbeitende kollegen kollegin kolleginnen faehigkeit faehigkeiten arbeit arbeiten jahr jahre jahren stelle position moeglichkeit moeglichkeiten umgang weiterbildung weiterbildungen weiterentwicklung profil bewerbung bewerbungen unterlagen freude spass interesse bereitschaft sinn art weise rahmen zusammenarbeit kunde kunden kundinnen anforderungen anforderung qualifikation qualifikationen voraussetzung voraussetzungen kompetenz kompetenzen know how wissen grundkenntnisse vorkenntnisse niveau level aufgabenbereich taetigkeit taetigkeiten verantwortung schwerpunkt schwerpunkte einsatz arbeitsweise denken handeln persoenlichkeit motivation engagement leidenschaft begeisterung herz ziel ziele zukunft welt menschen mensch tag tage woche monat zeit ort standort hause homeoffice umfeld bereichen vergleichbares vergleichbare abschluss ausbildung studium hochschulstudium berufsausbildung berufserfahrung sprache sprachen wort schrift mindestens sicher sichere sicheren sicherer erstellen planen bauen betreuen pruefen durchfuehren beraten unterstuetzen koordinieren organisieren entwickeln steuern fuehren leiten bearbeiten verwalten erstellung bearbeitung durchfuehrung pruefung abstimmung beteiligung erteilung patient patienten patientin patientinnen bewohner bewohnerin bewohnerinnen kind kinder kindern jugendliche jugendlichen eltern begleitung unterstuetzung durchfuehrung umsetzung mitwirkung betreuung mitarbeit station stationen klasse einrichtung haus abteilung gruppe bereitschaft situation situationen ruhe ordnung sicherheit frage fragen rat tat bord zug zuege zuegen alle alles wohl qualitaet servicequalitaet wochenende wochenenden feiertag feiertage feiertagen sonntag sonntage nacht naechte auftreten freude humor spass quereinsteiger quereinsteigerin quereinsteigende quereinstieg umsteiger umsteigerin berufseinsteiger berufseinsteigerin einsteiger wiedereinsteiger schulabgaenger interesse neugier lust herausforderung herausforderungen loesung loesungen vorstellung vorstellungen alltag umgang wert werte vorbereitung reisende reisenden fahrgaeste gaeste gast besucher muss pflicht einstellung frueh spaet grundlagen grundlage wenn dazu dann damit zudem ausserdem ebenso daher dabei hierbei dafuer stets aber verstaendnis grundverstaendnis ebene ebenen themen staerke staerken innovation innovationen blick augen auge bedarf beduerfnis beduerfnisse anwender nutzer nutzerin potenzial potenziale potential potentiale idee ideen einordnung einfuehrung nutzung betrieb ausrichtung schwerpunkt fokus fachbereich fachbereiche fachbereichen optimalfall idealfall chance chancen risiko risiken abwaegung abwaegungen praxis ganze augenhoehe mission vision basis entscheidung entscheidungen tool tools text texte arbeitslast ueberblick gespuer zahlen zusammenhang zusammenhaenge gespraech gespraeche gespraechen kampagne kampagnen erfolg erfolge ziele ergebnis ergebnisse rolle rollen zukunft wandel weg wege schritt schritte impuls impulse mehrwert verantwortlichkeit art niveau qualifikationen qualifikation dienstleistung dienstleistungen branche branchen geschaeftsfuehrung leitung fuehrungskraefte fuehrungskraeften stellen leidenschaft neugier offenheit begeisterung affinitaet expertise routine hintergrund background mittelpunkt alltag anspruch ansprueche erfolgreich daten erfolgreiche erfolgreichen niveau").split(" ");
  var GENERIC_EN = ("alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming ontario quebec manager expert thrives building production older stand walk clear comfortable core availability nights weekends holidays grades foundation shifts shift lift able ability willingness eligible eligibility applicants applicant role team members member opportunity opportunities day days week weeks hours hour work environment duties duty experience knowledge skill skills ability abilities team teams company work role position environment understanding opportunity candidate candidates degree background familiarity proficiency field level years year requirements requirement qualification qualifications responsibility responsibilities tasks task mindset passion attitude communication customers customer people time things way state states hire apis api pipelines pipeline tools systems platform platforms equivalent practical career changers changers welcome early mornings morning evenings evening nights").split(" ");

  function asSet(list) {
    var set = {};
    list.forEach(function (word) { set[word] = true; });
    return set;
  }
  var STOP = asSet(STOP_DE.concat(STOP_EN));
  var GENERIC_SET = asSet(GENERIC.concat(GENERIC_EN));

  /* ------------------------------------------------------------ Sprache */

  function language(text) {
    var words = spaced(text).trim().split(" ");
    var de = 0, en = 0;
    var DE = asSet("und der die das mit fuer sie du wir ihr ist sind von zu auf bei".split(" "));
    var EN = asSet("and the with for you we our is are of to on at in".split(" "));
    words.forEach(function (word) {
      if (DE[word]) de++;
      if (EN[word]) en++;
    });
    return en > de ? "en" : "de";
  }

  /* ------------------------------------------------------------ Gliedern */

  //  kind: was der Abschnitt ist. "req" und "tasks" werden ausgewertet,
  //  "offer", "about", "apply", "legal" nicht. "nice" heisst: alles darin
  //  ist ein Kann.
  var HEADINGS = [
    { kind: "skip", re: /^(was|das) (ist )?(nicht|kein)\b.*(noetig|zwingend|erforderlich|muss|brauchst)|^nicht (noetig|erforderlich|zwingend|notwendig)$|^(not|no) (required|needed|necessary)$|^what you (don t|do not) need|^you don t need/ },
    { kind: "req", re: /^(muss|must|pflicht|zwingend|unbedingt|required|essential|minimum)$|^wir suchen (sie|dich)( wenn)?|^(sie|du) passt zu uns|^sie passen zu uns|^you re (a great fit|the right|a fit)|^you ll thrive|^you ll be a great fit/ },
    { kind: "nice", re: /^(kann|optional|gern gesehen|schoen waere|extra|nice)$/ },
    { kind: "offer", re: /^(was|das) (du|sie) (bekommst|bekommen|erhaelst|erhalten)|^what you ll get|^you ll get|^dafuer bekommst du/ },
    { kind: "tasks", re: /^darum geht s|^worum es geht|^was dich erwartet|^the job$|^the work$|^about the job$/ },
    { kind: "tasks", re: /^(ihre|deine|eure)?\s*(aufgaben(gebiet|bereich)?|taetigkeiten|verantwortung(en|sbereich)?)$|^(das|was) (erwartet|erwarten) (dich|sie|euch)|^dein(e)? (job|rolle|alltag)|^ihr(e)? (rolle|alltag)|^was (du|sie) (bewegst|bewegen|tun wirst|tust|machst)|^(your )?(tasks|responsibilities|duties)$|^(the )?role$|^what (you ll|you will) do|^your (role|day|mission|impact)|^in this role|^about the role/ },
    { kind: "nice", re: /^(nice to have|wuenschenswert|von vorteil|bonus( points)?|ein plus|pluspunkte|idealerweise( bringst du mit)?|it s a plus|nice to haves|preferred( qualifications| skills| experience)?|desired( qualifications| skills)?|bonus if you have|das waere toll|was schoen waere|optional|plus)$/ },
    { kind: "req", re: /^(ihr|dein|euer)? ?profil$|^who we re looking for|^who we are looking for|^we re looking for|^you are$|^about you$|^the ideal candidate|^(was|das) (sie|du) mitbringen|^(was|das) wir uns (von dir |von ihnen )?wuenschen|^das wuenschen wir uns|^(minimum|basic|required|key)( qualifications| requirements| skills)?$|^requirements?( and qualifications)?$|^what (you ll|you will) bring|^you ll (bring|have|need)|^what you need|^what we expect|^anforderungsprofil|^ihre qualifikationen|^deine skills|^dein rucksack|^das solltest du mitbringen|^das sollten sie mitbringen|^skills and experience|^experience and skills|^qualifications and experience|^(das|was) (bringst|bringen) (du|sie) mit|^(was|das) (du|sie) mit ?bringst|^(was|das) wir (von dir|von ihnen)? ?(erwarten|suchen|uns wuenschen)|^(ihre|deine)? ?(qualifikation(en)?|kenntnisse|kompetenzen|faehigkeiten)$|^anforderung(en|sprofil)?$|^voraussetzung(en)?$|^das zeichnet (dich|sie) aus|^damit ueberzeugst du|^(your )?(profile|requirements|qualifications|skills)$|^what (you|we) (bring|need|re looking for|are looking for|look for)|^who you are|^about you|^must haves?$|^you have$|^you bring/ },
    { kind: "offer", re: /^(wir bieten|was wir (dir|ihnen|euch)? ?bieten|unser angebot|deine vorteile|ihre vorteile|benefits?|what we offer|we offer|our offer|perks|why (join )?(us|[a-z]+)$|why work (with|for)|what s in it for you|compensation|salary|pay and benefits|darauf kannst du dich freuen|das bieten wir|wir bieten dir|wir bieten ihnen|unsere leistungen|das erwartet sie bei uns|das erwartet dich bei uns|deine benefits|ihre benefits|verguetung)/ },
    { kind: "about", re: /^(ueber uns|wer wir sind|das sind wir|unternehmen|about us|who we are|our company|the company|about [a-z]+$|ueber [a-z]+$|unser team|our team|die stelle|zur stelle)/ },
    { kind: "apply", re: /^(interessiert|neugierig geworden|kontakt|ansprechpartner(in)?|bewerbung|so bewirbst du dich|interesse geweckt|klingt gut|bist du interessiert|haben wir (ihr|dein) interesse geweckt|how to apply|apply now|contact)/ },
  ];

  //  Zeilen, die in keiner Anzeige eine Anforderung sind – wichtig vor
  //  allem ohne Gliederung, wo sonst Urlaub und Ansprechpartner mitzaehlen.
  var OFFER_LINE = /\b(urlaub|urlaubstage|jobrad|jobticket|deutschlandticket|verguetung|gehalt|tarif|tvoed|tv l|tv-l|entgeltgruppe|eg \d|jahressonderzahlung|weihnachtsgeld|altersvorsorge|zusatzversorgung|gleitzeit|homeoffice|mobiles arbeiten|firmenwagen|dienstwagen|zuschuss|zuschuesse|zulage|fitness|kantine|kita|kinderbetreuung|benefits?|salary|compensation|pto|paid time off|401 ?k|dental|vision insurance|health insurance|stock options|equity|holiday|vacation|bonus scheme|remote friendly|relocation|wir bieten|we offer|sie erwartet|freuen sie sich|freu dich|weekly pay|overtime|per hour|hourly|paid training|we (can )?(train|certify) you|we provide|what you get|sign on bonus|tuition|employee discount|uniforms? provided|bezahlte einarbeitung|einarbeitung|wir zahlen|tarifliche|bezahlung|zuschlaege|sonn und feiertag|probezeit|uebernahme|unbefristet|befristet|minijob|\d+ ?% bonus|annual bonus|quarterly incentives|pension|healthcare|cycle to work|bank holidays|days holiday|wochenstunden)\b|\$\s?\d|\d\s?(€|eur|euro)\b|\/hr\b/;
  var CONTACT_LINE = /@|https?:|www\.|\bruf (uns |einfach |gern )*an\b|\bcall us\b|\b(tel|telefon|phone|ansprechpartner|ansprechpartnerin|kontakt|bewerbung (bitte |an |ueber )|bewerben sie sich|bewirb dich|apply (now|online|via|at)|send (your|us)|richten sie|fragen beantwortet|rueckfragen|stellen-?id|referenznummer|kennziffer|bewerbungsfrist|bewerbungsschluss)\b/;
  //  "Interessiert?", "Dann freuen wir uns über deine Bewerbung!"
  var APPLY_LINE = /^(interessiert|neugierig|lust bekommen|klingt gut|ueberzeugt|bereit fuer|haben wir dein interesse|bist du dabei)\b[^.]{0,30}\??$|freuen (uns|wir uns) (auf|ueber) (deine|ihre|eure|dich|sie)|\b(dann )?bewirb dich|jetzt bewerben|apply today|apply now|we d love to hear from you|we look forward to (your|hearing)/;
  //  "Ordnung, Sicherheit und Servicequalität sind uns sehr wichtig" – was
  //  dem Unternehmen wichtig ist, ist keine Anforderung an eine Person.
  var VALUES_LINE = /\b(sind|ist) uns (sehr |besonders |enorm |ausgesprochen )?wichtig\b|liegt uns (sehr )?am herzen|fuehlen sich [^.]{0,40}\bwohl\b|wir stehen fuer|we value|we believe/;
  var ABOUT_LINE = /^(wir sind|unser unternehmen|das unternehmen|als (fuehrend|mittelstaendisch|international)|we are|our company|founded in|gegruendet|seit \d{4} )/;
  //  Ohne Gliederung zaehlt nur, was nach Anforderung klingt.
  var REQUIREMENT_CUE = /(erfahrung|kenntnis|ausbildung|studium|abschluss|qualifikation|wichtig|zuverlaessig|sorgfalt|belastbar|teamfaehig|bringst|bringen|mitbringen|erwarten|setzen voraus|voraussetzung|sicher|sicherer|sicheren|sehr gute|gute|fundierte|fuehrerschein|zertifi|bereitschaft|faehigkeit|staerke|denken|kompetenz|beherrsch|verfuegst|verfuegen|hast du|haben sie|required|requirement|experience|knowledge|degree|must|ability|able to|proficien|familiar|skills?|certif|license|licence|you have|you bring|you should|you ll need|you need|should have|fluent|bachelor|master|years|bilingual)/;

  var LEGAL = /herkunft|weltanschauung|sexuellen identitaet|bei gleicher eignung|gleichstellung|frauen sind|ausdruecklich erwuenscht|schwerbehindert|without regard|regardless of race|race, (color|colour|religion)|national origin|sexual orientation|gender identity|veteran status|protected (veteran|status|characteristic)|equal employment|eeo\b|we celebrate diversity|reasonable accommodation|schwerbehindert|gleichgestellt|agg\b|allgemeinen gleichbehandlung|equal opportunit|regardless of|unabhaengig von (geschlecht|alter|herkunft)|diversity|vielfalt/;
  var NEGATED = /\b(keine|kein|ohne)\s+(wochenendarbeit|wochenenddienste?|schichtdienst|schichtarbeit|nachtschicht(en)?|nachtdienste?|ueberstunden|winterdienst)\b|\b(keine|kein|ohne)\b[^.]{0,40}\b(vorkenntnisse|kenntnisse|erfahrung|ausbildung)\b|\b(nicht|keine) (erforderlich|notwendig|noetig|voraussetzung)|\bno\b[^.]{0,40}\b(experience|knowledge|degree|diploma|background|certification|license|licence)\b[^.]{0,20}\b(required|needed|necessary)\b|\bno (prior |previous )?(experience|knowledge)\b|\b(not|no) (required|necessary|needed)\b|\b(isn t|is not|aren t|are not|won t be) (needed|required|necessary|a must)\b|\b(ist|sind) (nicht|kein) (noetig|erforderlich|notwendig|zwingend)\b|\bnicht (noetig|erforderlich|notwendig)\b|\bnot (a )?(requirement|must)\b/;
  var NICE = /\b(wuenschenswert|von vorteil|vorteilhaft|idealerweise|ideal ?erweise|gern(e)? gesehen|gerne auch|gern auch|optional|ein plus|pluspunkt|nice to have|a plus|bonus|preferred|preferably|ideally|beneficial|desirable|advantageous|an asset|an advantage|is helpful|would be great|nice if|encouraged to apply|wuerden wir uns freuen|waere schoen|schadet nicht|ist hilfreich|hilfreich|kein muss|keine pflicht|nicht zwingend|not required but|im optimalfall|im idealfall|optimalerweise|bestenfalls|im besten fall|ein plus|sind ein plus|waere ein plus|rundet [^.]{0,40} ab|runden [^.]{0,40} ab|on top|ein bonus|wuenschenswerterweise)\b/;
  var MUST = /\b(zwingend|voraussetzung|erforderlich|setzen wir voraus|unbedingt|unabdingbar|required|must|mandatory|essential|a must)\b/;

  //  Wo die festen Muster nichts finden, entscheiden Stichwoerter – eine
  //  Anzeige formuliert ihre Ueberschriften auf hundert Arten ("WAS DU
  //  MITBRINGST", "Dein Rucksack", "Who you are"). Die Reihenfolge zaehlt:
  //  "Was wir uns von dir wuenschen" ist Profil, nicht Angebot.
  var HEADING_WORDS = [
    { kind: "offer", re: /\b(wir bieten|bieten wir|wir dir bieten|was wir dir|was wir ihnen|unser angebot|benefits?|perks|what we offer|we offer|what you get|why (you ll love|join)|verguetung|gehalt|deine vorteile|ihre vorteile|darauf kannst du dich freuen|compensation)\b/ },
    { kind: "nice", re: /\b(nice to have|von vorteil|wuenschenswert|bonus|preferred|a plus|pluspunkte|idealerweise)\b/ },
    { kind: "req", re: /\b(profil|mitbringen|mitbringst|bringst du mit|bringen sie mit|voraussetzung|voraussetzungen|anforderung|anforderungen|qualifikation|qualifikationen|requirements?|qualifications?|looking for|you bring|you ll need|you need|you have|who you are|about you|skills|kenntnisse|was wir erwarten|wuenschen wir uns|uns wichtig|must haves?|erwarten wir)\b/ },
    { kind: "tasks", re: /\b(aufgaben|taetigkeiten|taetigkeit|deine rolle|ihre rolle|dein job|ihr job|der job|your role|the role|responsibilities|duties|what you ll do|what you will do|day to day|dein alltag|ihr alltag|erwartet dich|erwartet sie)\b/ },
    { kind: "about", re: /\b(ueber uns|wer wir sind|about us|who we are|about the company|unser team)\b/ },
    { kind: "apply", re: /\b(bewerbung|bewirb|bewerben|interesse geweckt|how to apply|apply|kontakt|contact|ansprechpartner)\b/ },
  ];

  //  shaped: die Zeile sieht aus wie eine Ueberschrift (Doppelpunkt am
  //  Ende, Versalien, hoechstens drei Woerter). Nur dann duerfen Stichwoerter
  //  entscheiden – "Erfahrung mit SAP wuenschenswert" ist eine Anforderung.
  function headingKind(line, shaped) {
    var value = spaced(stripDecor(line)).trim().replace(/\s+/g, " ");
    //  Mit Doppelpunkt darf eine Ueberschrift laenger sein: "You'll be a
    //  great fit if you have:" sind zehn Woerter.
    if (!value || value.split(" ").length > (shaped ? 10 : 8)) return null;
    for (var i = 0; i < HEADINGS.length; i++) {
      if (HEADINGS[i].re.test(value)) return HEADINGS[i].kind;
    }
    var letters = stripDecor(line).replace(/[^A-Za-zÄÖÜäöüß]/g, "");
    var caps = letters.length > 3 && letters === letters.toUpperCase();
    if (!(shaped || caps || value.split(" ").length <= 3) || value.split(" ").length > 6) return null;
    for (var j = 0; j < HEADING_WORDS.length; j++) {
      if (HEADING_WORDS[j].re.test(value)) return HEADING_WORDS[j].kind;
    }
    return null;
  }

  //  Emoji und Zierzeichen vor einer Zeile ("✅", "👉", "🚀 Deine Aufgaben")
  //  tragen nichts zur Bedeutung bei.
  function stripDecor(text) {
    return String(text).replace(/^[\s\u2190-\u2BFF\u2600-\u27BF\uFE0F\u200D]+|^(?:[\uD83C-\uDBFF][\uDC00-\uDFFF][\s\uFE0F\u200D]*)+/g, "").trim();
  }

  //  Aufzaehlungen, Zeilen und – innerhalb einer langen Zeile – Saetze.
  //  out.bullet[i] sagt, ob Zeile i ein Aufzaehlungspunkt war – der ist nie
  //  eine Ueberschrift, auch wenn er kurz ist ("Strong knife skills").
  function linesOf(text) {
    var out = [];
    out.bullet = [];
    //  Fliesstext mit festem Zeilenumbruch: eine Zeile ohne Satzende, auf
    //  die eine klein beginnende folgt, ist derselbe Satz.
    var rows = [];
    String(text || "").replace(/\r/g, "").split("\n").forEach(function (raw) {
      var last = rows[rows.length - 1];
      var plain = raw.trim();
      if (last && plain && last.trim() && !/[.!?:;…]\s*$/.test(last) &&
          /^[a-zäöüß(]/.test(plain) && !/^\s*([-–—•*·▪◦‣➢➤✓✔→>»›…]|\d+[.)])/.test(raw)) {
        rows[rows.length - 1] = last.replace(/\s+$/, "") + " " + plain;
      } else {
        rows.push(raw);
      }
    });
    rows.forEach(function (raw) {
      var bullet = /^\s*([-–—•*·▪◦‣➢➤✓✔→>»›…]|\.\.\.|\d+[.)]|\u2705|\u2611)\s*/.test(raw);
      var line = stripDecor(raw).replace(/^\s*([-–—•*·▪◦‣➢➤✓✔→>»›…]|\.\.\.|\d+[.)])\s*/, "").trim();
      line = stripDecor(line);
      if (!line) return;
      var before = out.length;
      //  Eine lange Fliesstextzeile in Saetze teilen; Aufzaehlungen bleiben.
      //  Ein Absatz Fliesstext wird in Saetze geteilt: "von Vorteil" im
      //  zweiten Satz gilt nicht fuer den ersten.
      if (line.length > 80 && /[.;!?]\s+[A-ZÄÖÜ]/.test(line)) {
        //  Nicht nach einer Abkuerzung: "bzw. Zahnarzthelferin", "z. B.
        //  Kauffrau", "(B. A.", "Dipl.-Ing.", "ca. 20".
        var pieces = [];
        line.split(/(?<=[.;!?])\s+(?=[A-ZÄÖÜ])/).forEach(function (part) {
          var last = pieces[pieces.length - 1];
          if (last && /(?:^|[\s(\/-])(?:bzw|z|b|u|a|d|h|o|s|ca|inkl|ggf|evtl|bspw|vgl|usw|etc|nr|dr|dipl|ing|prof|abs|str|sog|max|min|mind|ggfs|zzgl|insb|i\.?\s?d\.?\s?r|u\.?\s?a|z\.?\s?b|[A-Z])\.$/i.test(last)) {
            pieces[pieces.length - 1] = last + " " + part;
          } else {
            pieces.push(part);
          }
        });
        pieces.forEach(function (part) {
          if (part.trim()) out.push(part.trim());
        });
      } else {
        out.push(line);
      }
      for (var i = before; i < out.length; i++) out.bullet[i] = bullet;
    });
    return out;
  }

  function segment(text) {
    var sections = [];
    var current = { kind: "intro", heading: "", lines: [] };
    sections.push(current);
    var all = linesOf(text);
    all.forEach(function (line, index) {
      if (all.bullet[index]) { current.lines.push(line); return; }
      //  "Das bringst du mit: Führerschein Klasse D, Deutsch C1" – die
      //  Ueberschrift steht vor dem Doppelpunkt, der Inhalt dahinter.
      var inline = line.match(/^([^:：]{3,45})[:：]\s+(.{3,})$/);
      var inlineKind = inline && !/\d/.test(inline[1]) ? headingKind(inline[1], true) : null;
      if (inlineKind) {
        current = { kind: inlineKind, heading: inline[1].trim(), lines: [] };
        sections.push(current);
        inline[2].split(/;\s+|\s+[•·]\s+/).forEach(function (part) { if (part.trim()) current.lines.push(part.trim()); });
        return;
      }
      var kind = line.length <= 70 && !/[.;]$/.test(line)
        ? headingKind(line.replace(/\s*([:：]|…|\.\.\.)\s*$/, ""), /([:：]|…|\.\.\.)\s*$/.test(line)) : null;
      //  Eine Zeile, die wie eine Ueberschrift gesetzt ist, aber nichts
      //  Bekanntes sagt ("Darauf kommt es an:", "DEIN WERKZEUGKOFFER"): ein
      //  eigener Abschnitt, der nach seinem Inhalt beurteilt wird – sonst
      //  fiele alles darunter dem Vorspann zu und ginge verloren.
      if (!kind && line.length <= 50 && (!/[.;,]$/.test(line) || /(…|\.\.\.)$/.test(line))) {
        var plain = stripDecor(line).replace(/\s*([:：]|…|\.\.\.)\s*$/, "");
        var letters = plain.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
        var words = plain.split(/\s+/).length;
        if (words <= 6 && (/([:：]|…|\.\.\.)\s*$/.test(line) || (letters.length > 3 && letters === letters.toUpperCase()))) kind = "unknown";
      }
      if (kind) {
        current = { kind: kind, heading: line.replace(/\s*([:：]|…|\.\.\.)\s*$/, ""), lines: [] };
        sections.push(current);
        return;
      }
      current.lines.push(line);
    });
    return sections.filter(function (section) { return section.lines.length || section.heading; });
  }

  /* ---------------------------------------------------- Begriffe finden */

  //  Fuer jede Lexikon-Zeile die Suchform ihrer Schluessel, einmal.
  //  kind: was "Habe ich" damit tut – eine Kenntnis kommt unter Kenntnisse,
  //  eine Sprache unter Sprachen, ein Fuehrerschein unter Mobilitaet. Ein
  //  Abschluss, ein Zertifikat oder eine Bedingung (Schichtdienst,
  //  Fuehrungszeugnis) ist keine Kenntnis und landet nie dort.
  function kindOf(entry) {
    if (entry.kind) return entry.kind;
    if (entry.cert) return "cert";
    if (entry.language) return "language";
    return "skill";
  }

  var LEX = LEXICON.map(function (entry) {
    return {
      label: entry.label, labelEn: entry.labelEn || "", kind: kindOf(entry),
      cert: !!entry.cert || entry.kind === "cert", language: !!entry.language,
      keys: (entry.keys || []).map(function (key) { return spaced(key).trim(); }).filter(Boolean),
      cs: entry.cs || [], implies: entry.implies || [],
    };
  });

  function escapeRe(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  //  Steht ein Lexikon-Eintrag in einer Zeile? Liefert die Stelle im
  //  Suchtext (fuer "A oder B") oder -1.
  function lexIn(entry, line, lineSpaced, lineExpanded) {
    for (var i = 0; i < entry.cs.length; i++) {
      var re = new RegExp("(^|[^\\w+#.])" + escapeRe(entry.cs[i]) + "(?![\\w+#])");
      var hit = re.exec(line);
      if (hit) return { at: hit.index + hit[1].length, length: entry.cs[i].length };
    }
    for (var k = 0; k < entry.keys.length; k++) {
      var at = lineSpaced.indexOf(" " + entry.keys[k] + " ");
      if (at !== -1) return { at: at, length: entry.keys[k].length, spacedHit: true };
    }
    //  "KI- und GenAI-Anwendungen" ausgeschrieben: "GenAI" steht dann fuer sich.
    if (lineExpanded && lineExpanded !== lineSpaced) {
      for (var x = 0; x < entry.keys.length; x++) {
        var spot = lineExpanded.indexOf(" " + entry.keys[x] + " ");
        if (spot !== -1) return { at: Math.min(spot, lineSpaced.length - 1), length: entry.keys[x].length, spacedHit: true };
      }
    }
    return null;
  }

  /* --------------------------------------------- Persoenliches, Abschluesse */

  //  Persoenliche Eigenschaften. Ein Lebenslauf belegt sie selten mit einem
  //  Wort – "kommunikativ" als fehlende Kenntnis zu melden hilft niemandem.
  //  Sie stehen fuer sich, ohne Luecke, mit dem Rat, sie im Anschreiben zu
  //  zeigen. re: auf dem gefalteten Text (klein, Umlaute ausgeschrieben).
  var SOFT = [
    { label: "Kommunikationsstärke", en: "Communication", re: /kommunizierst (klar|souveraen|offen|ueberzeugend)|kommunizieren (klar|souveraen|offen|ueberzeugend)|kommunikativ|kommunikationsstaerke|kommunikationsstark|kommunikationsfaehig|kommunikationsgeschick|kommunikationskompetenz|communication skills|communicative|\bcommunication\b/ },
    { label: "Teamfähigkeit", en: "Teamwork", re: /teamfaehig|teamgeist|teamplayer|team player|teamorientiert|teamwork|teamarbeit|im team arbeit|arbeitest gerne im team|arbeiten gerne im team|work(s|ing)? well (in|with) (a )?team/ },
    { label: "Zuverlässigkeit", en: "Reliability", re: /zuverlaessig|verlaesslich|\breliab(le|ility)\b|dependab(le|ility)/ },
    { label: "Pünktlichkeit", en: "Punctuality", re: /puenktlich|\bpunctual/ },
    { label: "Belastbarkeit", en: "Resilience", re: /belastbar|stressresisten|die ruhe (bewahr|behaelt|behaeltst|behalten)|behaeltst [^.]{0,60}die ruhe|behaelt [^.]{0,60}die ruhe|kuehlen kopf|ruhe bewahren|under pressure|resilien|fast paced environment|(behaeltst|behalten|behaelt) [^.]{0,60}den ueberblick|den ueberblick (behaeltst|behalten)/ },
    { label: "Verantwortungsbewusstsein", en: "Responsibility", re: /verantwortungsbewusst|verantwortung (uebernimmst|uebernehmen|zu uebernehmen)|(uebernimmst|uebernehmen) (gerne |gern )?verantwortung|take ownership|sense of responsibility/ },
    { label: "Selbstständigkeit", en: "Independence", re: /selbststaendig|eigenverantwortlich|eigeninitiative|self motivated|self starter|work(s|ing)? independently/ },
    { label: "Sorgfalt", en: "Attention to detail", re: /sorgfalt|sorgfaeltig|gruendlich|genauigkeit|attention to detail|detail oriented|meticulous/ },
    { label: "Strukturierte Arbeitsweise", en: "Organisation", re: /strukturiert|organisationstalent|organisationsfaehig|organisiert|\borgani[sz]ed\b|organi[sz]ational skills/ },
    { label: "Freundlichkeit", en: "Friendliness", re: /freundlich|\bfriendly\b|warm welcome|positive attitude/ },
    { label: "Kundenorientierung", en: "Customer focus", re: /kundenorientier|serviceorientier|customer focus|customer oriented|service minded/ },
    { label: "Flexibilität", en: "Flexibility", re: /flexibilitaet|\bflexibel\b|\bflexible\b(?! (scheduling|hours|working|arbeitszeit))/ },
    { label: "Einfühlungsvermögen", en: "Empathy", re: /einfuehlungsvermoegen|empathie|empathisch|empathy|empathetic|einfuehlsam|fingerspitzengefuehl/ },
    { label: "Geduld", en: "Patience", re: /geduld|\bpatience\b/ },
    { label: "Lösungsorientierung", en: "Problem solving", re: /loesungsorientiert|problem solving|problemloesung/ },
    { label: "Analytisches Denken", en: "Analytical thinking", re: /analytisch|analytical/ },
    { label: "Lernbereitschaft", en: "Willingness to learn", re: /lernbereit|lernbereitschaft|eager to learn|willingness to learn|wissbegier/ },
    { label: "Durchsetzungsvermögen", en: "Assertiveness", re: /durchsetzungsvermoegen|durchsetzungsstark|assertive/ },
    { label: "Konfliktfähigkeit", en: "Conflict resolution", re: /konfliktfaehig|konfliktloesung|conflict resolution/ },
    { label: "Engagement", en: "Motivation", re: /\bmotiviert|\bengagiert|\bmotivated\b|hohe einsatzbereitschaft/ },
    { label: "Höflichkeit", en: "Courtesy", re: /hoeflich|\bcourteous/ },
    { label: "Hilfsbereitschaft", en: "Helpfulness", re: /hilfsbereit/ },
    { label: "Sicheres Auftreten", en: "Confident manner", re: /(sicheres|souveraenes|selbstbewusstes|verbindliches|professionelles) auftreten|souveraen (auftreten|auftrittst|moderierst)|moderierst souveraen|moderieren souveraen/ },
    { label: "Zahlenaffinität", en: "Numeracy", re: /zahlenaffin|gespuer fuer zahlen|zahlenverstaendnis|affinitaet (zu|fuer) zahlen|freude an zahlen/ },
  ];

  function softIn(line, lang) {
    var folded = fold(ungender(line)).replace(/[^a-z0-9+#]+/g, " ");
    var out = [];
    SOFT.forEach(function (entry) {
      if (entry.re.test(folded)) out.push(lang === "en" ? entry.en : entry.label);
    });
    return out;
  }

  //  Die Woerter, an denen eine Eigenschaft hing, sind danach verbraucht –
  //  sonst kaeme "Teamfähigkeit" ein zweites Mal als Kenntnis herein.
  var SOFT_WORDS = /\b(kommunikativ\w*|kommunikations\w*|team(faehig|geist|player|orientiert|work|arbeit)\w*|zuverlaessig\w*|verlaesslich\w*|puenktlich\w*|belastbar\w*|stressresisten\w*|verantwortungsbewusst\w*|selbststaendig\w*|eigenverantwortlich\w*|eigeninitiative|sorgfalt\w*|sorgfaeltig\w*|gruendlich\w*|genauigkeit|strukturiert\w*|organisationstalent|organisiert\w*|freundlich\w*|kundenorientier\w*|serviceorientier\w*|flexib\w*|einfuehlungsvermoegen|empathi\w*|einfuehlsam\w*|geduld\w*|loesungsorientier\w*|analytisch\w*|lernbereit\w*|durchsetzungs\w*|konfliktfaehig\w*|motiviert\w*|engagiert\w*|hoeflich\w*|hilfsbereit\w*|ruhe|humor|denkvermoegen|arbeitsweise|teamwork|reliab\w*|punctual\w*|communication|empath\w*|patience|independen\w*|friendly|motivated|fingerspitzengefuehl|auftreten|zahlenaffin\w*)\b/g;

  //  Abschluesse. Schulabschluesse und akademische Grade stehen auf einer
  //  Leiter: wer Abitur hat, hat "mindestens einen Hauptschulabschluss".
  //  voc: eine abgeschlossene Berufsausbildung (ohne Fach). field: ein
  //  Fach, das im Lebenslauf stehen muss ("kaufmaennische Ausbildung").
  var DEGREES = [
    //  Schule. Die deutschen Laender, Oesterreich und die Schweiz nennen
    //  dieselbe Stufe verschieden.
    { label: "Fachhochschulreife", re: /fachhochschulreife|fachgebundene[nrs]? hochschulreife|berufsmatur(a|itaet)|fachmatura/, level: 3 },
    { label: "Fachabitur", re: /fachabitur|\bfachabi\b/, level: 3 },
    { label: "Abitur", re: /\babitur\b|\babi\b|allgemeine[nrs]? hochschulreife|\bhochschulreife\b|hochschulzugangsberechtigung|\bmatura\b|\bmaturitaet\b|reifepruefung|reifezeugnis|gymnasialabschluss|\ba levels?\b|international baccalaureate|\bib diploma\b|baccalaureat/, level: 4 },
    { label: "Hauptschulabschluss", re: /hauptschulabschluss|\bhauptschule\b|mittelschulabschluss|(erweiterte[nrs]? )?berufsbildungsreife|\bberufsreife\b|erste[nrs]? (allgemeinbildende[nrs]? )?schulabschluss|\besa\b|qualifizierende[nrs]? hauptschulabschluss|\bquali\b|pflichtschulabschluss|abschluss der pflichtschule/, level: 1 },
    { label: "Realschulabschluss", re: /realschulabschluss|\brealschule\b|erweiterte[nrs]? realschulabschluss/, level: 2 },
    { label: "Mittlere Reife", re: /mittlere[nrs]? reife/, level: 2 },
    { label: "Mittlerer Schulabschluss", re: /mittlere[nrs]? (schul|bildungs)?abschluss|\bmsa\b|fachoberschulreife|sekundarabschluss i\b|erweiterte[nrs]? sekundarabschluss/, level: 2 },
    { label: "Schulabschluss", re: /\bschulabschluss\b/, level: 1 },
    { label: "High school diploma", re: /high school (diploma|degree|education|graduate)|\bged\b|high school equivalen|\bgcses?\b/, level: 2 },
    //  Hochschule
    { label: "Associate degree", re: /associate s? degree|\bassociate of (arts|science)\b|\badn\b/, level: 4.5 },
    { label: "Hochschulabschluss", en: "University degree", re: /hochschulabschluss|universitaetsabschluss|fachhochschulabschluss|akademische[nrs]? (abschluss|grad)|abgeschlossene[nrs]? (hochschul|fachhochschul|universitaets)?studium\b(?! (der|des|im|in|als))|college degree|university degree|undergraduate degree|\bdegree\b(?= (required|preferred|or equivalent))/, level: 5 },
    { label: "Bachelor", re: /\bbachelor|bachelorstudium|\bb (sc|a|eng|ed)\b|\bll b\b|\bbba\b|\bbsc\b|diplom (\()?fh|dipl [a-z]+ (\()?fh/, level: 5 },
    { label: "Master", re: /\bmaster\b(?! ?(of )?(the )?(scrum|craft|data))|masterstudium|\bmaster s\b|\bm (sc|a|eng|ed)\b|\bll m\b|\bmba\b|\bmsc\b|graduate degree|postgraduate/, level: 6 },
    { label: "Diplom", re: /\bdiplom\b(?! ?(\()?fh)|\bdipl\b(?! [a-z]+ (\()?fh)/, level: 6 },
    { label: "Magister", re: /\bmagister\b/, level: 6 },
    { label: "Staatsexamen", re: /staatsexamen|staatspruefung/, level: 6 },
    { label: "Promotion", en: "PhD", re: /abgeschlossene[nrs]? promotion|\bpromotion (in|im|zum|zur)\b|\bphd\b|\bph d\b|doktorgrad|\bdoktorat\b|\bpromoviert|\bdr (rer|phil|med|ing|jur|oec|sc|pol|theol|des)\b|doctorate|doctoral degree/, level: 7 },
    { label: "Habilitation", re: /habilitation|habilitiert|venia legendi/, level: 8 },
    //  Berufliche Aufstiegsfortbildung (DQR 6, wie ein Bachelor): genuegt
    //  dort, wo die Anzeige "oder vergleichbar" sagt.
    { label: "Meister", re: /meisterbrief|meisterpruefung|\b[a-z]*meister(in)? \(?hwk\)?|staatlich gepruefte[nrs]? techniker|\btechniker(in)? \(?staatlich|\bfachwirt|\bbetriebswirt(in)? \(?(ihk|hwk|vwa)|bilanzbuchhalter/, level: 5, advanced: true },
    { label: "Kaufmännische Ausbildung", re: /kaufmaennische[nrs]? (berufs)?ausbildung/, voc: true, field: /kauf(mann|frau|leute)|kaufmaennisch/ },
    { label: "Abgeschlossene Berufsausbildung", en: "Completed vocational training", re: /abgeschlossene[nrs]? (berufs)?ausbildung\b(?! (als|zum|zur|im|in|zu))|\bberufsabschluss\b|abgeschlossene[nrs]? lehre\b|lehrabschluss|gesellenbrief|gesellenpruefung|facharbeiterbrief|\befz\b|faehigkeitszeugnis|completed apprenticeship|vocational qualification/, voc: true },
  ];


  //  Was der Lebenslauf an Abschluessen hat: die hoechste Stufe der Leiter,
  //  ob eine Ausbildung abgeschlossen ist, und woran man es sieht.
  var UNFINISHED = /angefangen|abgebrochen|ohne abschluss|nicht abgeschlossen|unfinished|incomplete|in progress|laufend|ongoing/;
  var COMPLETED_VOC = /ausbildung|gesellenbrief|gesellenpruefung|ausgebildet|\blehre\b|lehrabschluss|facharbeiter|\befz\b|faehigkeitszeugnis|apprenticeship|staatlich anerkannt|staatlich gepruef|examen|examiniert/;

  function degreesOf(state) {
    var found = { level: 0, voc: false, text: "", path: null, vocText: "", vocPath: null, titles: "",
                  advanced: false, advancedText: "", advancedPath: null };
    (state && state.events || []).forEach(function (event, index) {
      var text = fold(ungender([event.title, event.company].concat(event.description || []).join(" ")))
        .replace(/[^a-z0-9+#]+/g, " ");
      if (UNFINISHED.test(text)) return;
      //  Ein Studium, das noch laeuft, ist kein Abschluss.
      if (event.sectionId === "education" && event.present) return;
      var title = String(event.title || "");
      DEGREES.forEach(function (entry) {
        if (!entry.level || !entry.re.test(text)) return;
        if (entry.advanced) {
          found.advanced = true;
          found.advancedText = found.advancedText || title;
          found.advancedPath = found.advancedPath || "events." + index;
          return;
        }
        //  Ein Studium belegt den Schulabschluss, der es moeglich machte.
        if (entry.level > found.level) {
          found.level = entry.level;
          found.text = title;
          found.path = "events." + index;
        }
      });
      if (event.sectionId === "education" && !event.present && (COMPLETED_VOC.test(text) || found.advanced)) {
        if (!found.voc) { found.voc = true; found.vocText = title; found.vocPath = "events." + index; }
        found.titles += " " + text;
        //  Eine abgeschlossene Ausbildung setzt einen Schulabschluss voraus.
        if (found.level < 1) { found.level = 1; found.text = found.text || title; found.path = found.path || "events." + index; }
      }
    });
    return found;
  }

  //  Abschluesse in einer Zeile der Anzeige.
  //  Das Wort der Anzeige statt des Leiternamens: "MSc", "Zweites
  //  Staatsexamen", "Matura" – so steht es da, so sucht man es.
  function surfaceOf(line, entry) {
    var words = String(line).split(/\s+/);
    for (var size = 4; size >= 1; size--) {
      for (var i = 0; i + size <= words.length; i++) {
        var text = words.slice(i, i + size).join(" ").replace(/^[^A-Za-zÄÖÜäöüß]+|[^A-Za-zÄÖÜäöüß.)]+$/g, "");
        //  Eine Klammer, die hier nicht aufgeht, gehoert nicht dazu.
        if ((text.match(/\)/g) || []).length > (text.match(/\(/g) || []).length) text = text.replace(/\)+$/, "");
        var key = fold(ungender(text)).replace(/[^a-z0-9+#]+/g, " ").trim();
        var hit = key && key.match(entry.re);
        if (hit && hit[0].length >= key.length - 1) return text.replace(/^(eine[nmrs]?|einen|ein|den|die|das|der)\s+/i, "");
      }
    }
    return "";
  }

  function degreesIn(line, lang) {
    var folded = fold(ungender(line)).replace(/[^a-z0-9+#]+/g, " ");
    var hits = DEGREES.filter(function (entry) { return !entry.advanced && entry.re.test(folded); });
    if (hits.some(function (e) { return e.label === "Kaufmännische Ausbildung"; })) {
      hits = hits.filter(function (e) { return e.label !== "Abgeschlossene Berufsausbildung"; });
    }
    //  Mehrere Stufen der Leiter in einer Zeile ("Abitur oder Fachabitur",
    //  "Bachelor/Master", "Hochschulabschluss (Master)"): es genuegt die
    //  niedrigste. Gleichwertige Namen derselben Stufe ("Realschulabschluss
    //  oder Mittlere Reife") bleiben nebeneinander stehen.
    var ladder = hits.filter(function (e) { return e.level; });
    var specific = ladder.filter(function (e) { return e.label !== "Schulabschluss" && e.label !== "Hochschulabschluss"; });
    if (specific.length) ladder = specific;
    var lowest = ladder.reduce(function (low, e) { return low === null || e.level < low ? e.level : low; }, null);
    var comparable = /vergleichbar|gleichwertig|aequivalent|equivalent|comparable|or similar|oder aehnlich/.test(folded);
    return hits.filter(function (e) { return !e.level || (e.level === lowest && ladder.indexOf(e) !== -1); }).map(function (entry) {
      var surface = surfaceOf(line, entry);
      var label = surface && surface.length <= 40 && !/^(abgeschlossene|erfolgreich)/i.test(surface) && entry.level
        ? surface.charAt(0).toUpperCase() + surface.slice(1)
        : (lang === "en" && entry.en ? entry.en : entry.label);
      return { entry: entry, label: label, comparable: comparable };
    });
  }

  function degreeStatus(entry, cv, comparable) {
    if (entry.field) {
      if (cv.voc && entry.field.test(cv.titles)) return { status: "found", path: cv.vocPath, evidence: cv.vocText };
      return null;
    }
    if (entry.voc) return cv.voc ? { status: "found", path: cv.vocPath, evidence: cv.vocText } : null;
    if (cv.level >= entry.level) return { status: "found", path: cv.path, evidence: cv.text };
    //  Meister, Techniker, Fachwirt: "oder vergleichbare Qualifikation".
    if (comparable && cv.advanced && entry.level <= 5) return { status: "found", path: cv.advancedPath, evidence: cv.advancedText };
    return null;
  }

  //  Bedingungen, die als Wortgruppe kommen: "Ability to lift up to 50 lbs",
  //  "Must be 18 years or older", "Mindestalter 18 Jahre".
  var CONDITIONS = [
    { re: /\blift (up to )?(\d+) ?(lbs|pounds|kg)\b/, label: function (m) { return "Lift up to " + m[2] + " " + m[3]; } },
    { re: /\b(be )?(18|21) (years|yrs)( of age| old)? or older\b|\bat least (18|21) years/, label: function (m) { return (m[2] || m[5]) + " years or older"; } },
    { re: /\bmindestalter (18|21)|\bmindestens (18|21) jahre alt|\bvolljaehrig/, label: function (m) { return "Mindestalter " + (m[1] || m[2] || "18"); } },
  ];

  function conditionsIn(line) {
    var folded = fold(ungender(line)).replace(/[^a-z0-9+#]+/g, " ");
    var out = [];
    CONDITIONS.forEach(function (entry) {
      var match = folded.match(entry.re);
      if (match) out.push(entry.label(match));
    });
    return out;
  }

  //  Zusammengesetzte Woerter mit einem Anhaengsel, das nichts zur Sache
  //  tut: "SAP-Kenntnisse", "Excelkenntnisse", "Pythonerfahrung".
  var TAIL = /-?(kenntnisse|kenntnissen|erfahrung|erfahrungen|kompetenz|kompetenzen|know-how|skills|wissen)$/i;

  //  Abgeschnitten wird die Endung nur, wo davor sicher ein Begriff steht:
  //  mit Bindestrich ("SAP-Kenntnisse") oder ein bekannter Begriff
  //  ("Excelkenntnisse"). Aus "Berufserfahrung" wurde sonst "Berufs".
  var LEX_KEYS = null;
  function knownKey(text) {
    if (!LEX_KEYS) {
      LEX_KEYS = {};
      LEX.forEach(function (entry) { entry.keys.forEach(function (key) { LEX_KEYS[key.replace(/ /g, "")] = true; }); });
    }
    return !!LEX_KEYS[compact(text)];
  }

  function cleanTerm(text) {
    var value = ungender(text);
    var tail = value.match(TAIL);
    if (tail) {
      var rest = value.slice(0, value.length - tail[0].length);
      if (/-$/.test(tail[0].charAt(0) === "-" ? "-" : "") || tail[0].charAt(0) === "-" || knownKey(rest) || /^[A-Z0-9]{2,}$/.test(rest)) {
        value = rest;
      }
    }
    return value.replace(/^[\s,;:(]+|[\s,;:.)]+$/g, "").replace(/\s+/g, " ").trim();
  }

  function isGeneric(word) {
    var key = fold(word);
    return !key || STOP[key] || GENERIC_SET[key] || GENERIC_SET[stem(key)] || key.length < 3;
  }

  //  Muster, die in fast jeder Anzeige das Eigentliche einleiten.
  //  degree: was dahinter steht, ist ein Abschluss ("Ausbildung als
  //  Elektroniker", "Studium der Informatik", "degree in Computer Science")
  //  und darf bis zum Satzende reichen – mit Kommas und "oder" dazwischen
  //  ("als Pflegefachkraft, Altenpfleger/in oder Krankenpfleger/in").
  var PATTERNS = [
    { re: /\b(?:kenntnisse|erfahrung(?:en)?|know-how|erfahrungen|kompetenz(?:en)?|verst(?:ae|ä)ndnis|grundverst(?:ae|ä)ndnis|expertise|affinit(?:ae|ä)t|gesp(?:ue|ü)r|hintergrund|background|routine|wissen)\s+(?:in|im|mit|bei|als|f(?:ue|ü)r|von|(?:ue|ü)ber|auf dem gebiet|im bereich|im umgang mit)\s+(?:de[rmns]?\s+|eine[mnrs]?\s+)?([^.;()]+)/i, list: true },
    { re: /\bumgang\s+mit\s+(?:de[rmns]?\s+|eine[mnrs]?\s+)?([^.;()]+)/i, list: true },
    { re: /\bmit\s+([A-ZÄÖÜ][^.;()]{1,60}?)\s+(?:gearbeitet|vertraut|umgehen|umgegangen|gute erfahrungen|erfahrung gesammelt)/i, list: true },
    { re: /\b(?:berufsausbildung|ausbildung|weiterbildung|qualifikation|abschluss|berufsabschluss|umschulung)(?:,?\s*(?:z\.?\s?b\.?|zum beispiel|etwa|beispielsweise|bevorzugt|vorzugsweise|idealerweise|gerne|gern))?\s+(?:als|zum|zur|im|in|zum\/zur)\s+([^.;()]+)/i, degree: true },
    { re: /\b(?:studium|hochschulstudium|bachelor|master|diplom)\s+(?:der|des|im|in|im bereich|im fach|der fachrichtung)\s*([^.;()]+)/i, degree: true },
    { re: /\b(?:experience|expertise|proficiency|familiarity|background|knowledge)\s+(?:with|in|of|using)\s+([^,.;()]+)/i },
    { re: /\b(?:degree|bachelor'?s?|master'?s?|diploma)\s+(?:degree\s+)?(?:in|of)\s+([^.;()]+)/i, degree: true },
  ];

  //  Was nach einem Muster steht, endet am naechsten Satzzeichen – oder an
  //  einem Wort, das klar nicht mehr dazugehoert.
  function trimPhrase(text) {
    return String(text).split(/\s+(?:sowie|as well as|is|are|ist|sind|wird|werden|wuenschenswert|von vorteil|idealerweise|preferred|required|erforderlich|vorausgesetzt|for|to|in order)\s+/i)[0];
  }

  //  Ergaenzungsstriche ausschreiben: "KI- und GenAI-Anwendungen" →
  //  "KI-Anwendungen und GenAI-Anwendungen", "Wirtschafts-, Sozial- oder
  //  Rechtswissenschaften" → "Wirtschaftswissenschaften, Sozialwissenschaften
  //  oder Rechtswissenschaften". Fuer ein Wort ohne Bindestrich am Ende muss
  //  sein Grundwort bekannt sein.
  var HEADS = /(wissenschaften|wissenschaft|technik|technologien|management|entwicklung|wesen|wirtschaft|recht|informatik|paedagogik|pädagogik|arbeit|planung|analyse|anwendungen|grundlagen|kenntnisse|erfahrung|bereich|prozesse|systeme|tools|methoden|steuerung|pflege|medizin|therapie|versicherung|buchhaltung|marketing|vertrieb|lehre|bau)$/i;
  function expandSuspended(text) {
    return String(text).replace(/((?:\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*-,\s*)*\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*-)\s+(und|oder|sowie|bzw\.?)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*?)(-?)([A-ZÄÖÜa-zäöüß][a-zäöüß]{3,})\b/g,
      function (all, firsts, joint, lastStem, dash, head) {
        var whole = lastStem + dash + head;
        var base = dash ? head : (whole.match(HEADS) || [])[0];
        if (!base) return all;
        if (!dash) { lastStem = whole.slice(0, whole.length - base.length); head = base; }
        if (!lastStem) return all;
        var sep = dash ? "-" : "";
        var heads = dash ? head : head.toLowerCase();
        var stems = firsts.split(/-,?\s*/).filter(Boolean);
        return stems.map(function (stem) { return stem + sep + heads; }).join(", ") + " " + joint + " " + lastStem + sep + heads;
      });
  }

  //  "KI-Technologien", "GenAI-Grundlagen", "KI-Risiken": die Nachsilbe sagt
  //  nichts, gemeint ist das Vordere. Bleibt nichts, war es kein Begriff
  //  ("Chancen-Risiko-Abwägungen").
  var GENERIC_TAIL = asSet(("grundlagen grundlage anwendungen anwendung technologien technologie risiken risiko themen thema tools tool loesungen loesung kenntnisse kenntnis projekte projekt systeme system umfeld bereich bereiche methoden methode modelle modell abwaegungen abwaegung ansaetze ansatz aspekte aspekt fragen frage aufgaben aufgabe potenziale potenzial einsatz einsaetze welt welten landschaft themenfelder umgebung umgebungen kompetenz kompetenzen know how wissen erfahrung erfahrungen chancen chance").split(" "));
  function stripTails(word) {
    var parts = word.split("-");
    if (parts.length < 2) return word;
    while (parts.length > 1 && GENERIC_TAIL[fold(parts[parts.length - 1])]) parts.pop();
    return parts.join("-");
  }

  //  Ein Satz in Prosa ("Du moderierst souverän auf allen Ebenen …"): seine
  //  einfachen Substantive sind Satzbau, keine Anforderungen. Dort zaehlt
  //  nur, was erkennbar ein Fachbegriff ist.
  function isProse(line) {
    var words = String(line).split(/\s+/).length;
    return words >= 9 && /\b(du|dich|dir|dein\w*|sie|ihr\w*|ihnen|wir|uns|unser\w*)\b/i.test(line);
  }
  function strongTerm(term) {
    return /-/.test(term) || term.replace(/\s/g, "").length >= 14 || /[a-zäöü][A-Z]|\d/.test(term) ||
      /^[A-Z]{2,}$/.test(term);
  }

  //  Substantive einer deutschen Zeile: gross geschrieben, nicht am
  //  Satzanfang ein Adjektiv ("Gute", "Abgeschlossene"), nicht allgemein.
  //  Grosse Woerter direkt hintereinander sind ein Begriff ("Lean
  //  Management", "Six Sigma") und keine drei. Nach "des"/"eines" steht der
  //  Genitiv: "Studium des Maschinenbaus" sucht "Maschinenbau".
  function nounsDe(line, prose) {
    var out = [];
    expandSuspended(ungender(line)).split(/\s*(?:[,;:()"„“”\/]|\s(?:und|oder|sowie|bzw\.?|mit|in|im|für|fuer|von|zur|zum)\s)\s*/).forEach(function (part) {
      var words = part.split(/\s+/).filter(Boolean);
      var run = [];
      function flush() {
        if (!run.length) return;
        var term = cleanTerm(run.join(" "));
        var parts = term.split(" ");
        //  Allgemeine Woerter am Rand einer Gruppe fallen weg.
        while (parts.length && isGeneric(parts[0])) parts.shift();
        while (parts.length && isGeneric(parts[parts.length - 1])) parts.pop();
        if (parts.length && parts.length <= 3 && (!prose || strongTerm(parts.join(" ")))) out.push(parts.join(" "));
        run = [];
      }
      words.forEach(function (raw, index) {
        var word = raw.replace(/[.!?]+$/, "");
        var noun = /^[A-ZÄÖÜ][\wäöüßÄÖÜ\-+#./]*[\wäöüß+#]$/.test(word) && !(/^[A-ZÄÖÜ]{2,}$/.test(word) && word.length <= 5);
        var key = fold(word);
        if (noun && index === 0 && /(ige[rns]?|ig|lich|liche[rns]?|isch|ische[rns]?|ene[rns]?|ete[rns]?|te[rns]?|ste[rns]?|gute[rns]?|sichere[rns]?|hohe[rns]?|ende[rns]?)$/.test(key) &&
            !/(kraft|schaft|heit|keit|ung|ion|taet|ist|ent)$/.test(key)) noun = false;
        if (noun && /^(des|eines)$/i.test(words[index - 1] || "") && /[a-zäöü]s$/.test(word) && word.length > 6) {
          word = word.slice(0, -1);
        }
        if (noun && word.indexOf("-") !== -1) {
          word = stripTails(word);
          if (!word) noun = false;
        }
        if (noun) run.push(word);
        else flush();
      });
      flush();
    });
    return out.filter(function (term, index, all) {
      return term && !isGeneric(term) && all.indexOf(term) === index;
    });
  }

  //  Grosse Woerter einer englischen Zeile mitten im Satz: Produktnamen.
  function namesEn(line) {
    var out = [];
    var words = line.split(/[\s,;:()"]+/);
    words.forEach(function (raw, index) {
      var word = raw.replace(/[.!?]+$/, "");
      if (index === 0 || !/^[A-Z][A-Za-z0-9+#.]{2,}$/.test(word)) return;
      if (isGeneric(word)) return;
      out.push(word);
    });
    return out;
  }

  //  Abkuerzungen in Grossbuchstaben sind fast immer ein Fachbegriff:
  //  BLS, HOAI, VOB, HACCP, EKG. Ausgenommen, was nie eine Anforderung ist.
  var ACRONYM_STOP = asSet("AG KG SE GMBH UG OHG EV DE EN UK US USA EU IT TV EG PDF CV HR OR AND THE IN TO OF FOR MWD WMD DWM ID NR ZB BZW USW CA PS".split(" "));

  function acronyms(line) {
    var out = [];
    String(line).replace(/(^|[^\w.+#-])([A-Z][A-Z0-9]*(?:[+&\/-][A-Z0-9]+)*\+?)(?![\w+#])/g, function (all, before, word) {
      var letters = word.replace(/[^A-Z]/g, "");
      if (letters.length >= 2 && word.length <= 9 && !ACRONYM_STOP[word.replace(/[^A-Z0-9]/g, "")]) out.push(word);
      return all;
    });
    return out;
  }

  //  Englische Anforderungen stehen oft klein und aus mehreren Woertern da:
  //  "strong knife skills", "experience with classroom management", "must
  //  pass a background check". Gesucht wird, was nach dem Abstreifen der
  //  Fuellwoerter uebrig bleibt.
  var EN_LEAD = /^(?:(?:strong|excellent|outstanding|solid|proven|good|great|basic|advanced|working|demonstrated|deep|hands-on|prior|previous|relevant|current|valid|active|effective|clear|professional|exceptional|superb|sound|a|an|the|your|any|some|must|have|has|having|be|being|pass|passing|possess|hold|holds|maintain|willing to|willingness to|ability to|able to|capable of|comfortable with|at least|minimum(?: of)?|min\.?|\d+\+?\s*(?:years?|yrs?|months?)(?: of)?|years?(?: of)?|of|plus|and|or|ideally|preferably|also|with|in|on|using)\s+)+/;
  var EN_TAIL = /(?:\s+(?:is|are|would be|will be)?\s*(?:a plus|preferred|required|desired|an asset|a must|helpful|beneficial|necessary|needed|is required|strongly preferred|highly desirable|encouraged))+$|\s+(?:experience|knowledge|background|abilities|ability|is|are)$/;

  function phrasesEn(line) {
    var out = [];
    var text = ungender(line).replace(/^\s*[-•*·]\s*/, "");
    text.split(/\s*(?:[,;:()]|\s\/\s|\.\s|\s(?:and|or|as well as|including|such as|e\.g\.|incl\.|plus|with|in|of|for|using|via|across)\s)\s*/i)
      .forEach(function (chunk) {
        var value = chunk.replace(/[.!?]+$/, "").trim();
        var previous;
        do {
          previous = value;
          value = value.replace(new RegExp(EN_LEAD.source, "i"), "").replace(new RegExp(EN_TAIL.source, "i"), "").trim();
        } while (value !== previous);
        var words = value.split(/\s+/).filter(Boolean);
        if (!words.length || words.length > 4 || value.length < 3) return;
        //  Reste von Zahlen, Lohnangaben und Satzanfaengen sind keine Begriffe.
        if (/[$€£%]|^[\d\s–—\/.+-]+$|^\d/.test(value) || /^(not|including|incl|especially|e g|ideally|which|who|that|this|these|our|we|you)\b/i.test(value)) return;
        if (words.every(function (word) { return isGeneric(word) || /^\d+$/.test(word); })) return;
        if (isGeneric(words[0]) && words.length === 1) return;
        out.push(value.charAt(0).toUpperCase() + value.slice(1));
      });
    return out;
  }

  //  Ist ein Begriff schon ein Abschluss oder eine Eigenschaft? Dann kommt
  //  er nicht noch einmal als Kenntnis herein ("Hauptschulabschluss",
  //  "Teamfähigkeit", "Bachelor's degree").
  var SOFT_WORD = new RegExp("^(?:" + SOFT_WORDS.source.replace(/^\\b\(|\)\\b$/g, "") + ")$");
  function special(term) {
    var key = spaced(term).trim();
    if (DEGREES.some(function (entry) { return !entry.advanced && entry.re.test(key); })) return true;
    if (/^(bachelor|master|degree|diploma|abschluss|studium|ausbildung)( s)?( degree)?$/.test(key)) return true;
    if (/^(a|b|c)[12]( niveau| level)?$/.test(key)) return true;
    return key.split(" ").some(function (word) { return SOFT_WORD.test(word); });
  }

  function extractTerms(line, lang, level, lexiconOnly) {
    var found = [];
    var lineSpaced = spaced(line);
    var lineExpanded = spaced(expandSuspended(ungender(line)));
    var taken = {};

    function add(label, keys, extra) {
      var id = compact(label);
      if (!id || taken[id]) return;
      taken[id] = true;
      found.push(Object.assign({ label: label, keys: keys }, extra || {}));
    }

    //  Der laengste Treffer gewinnt: "Führerschein Klasse CE" ist nicht
    //  "Führerschein Klasse B", und "Next.js" ist kein "JavaScript".
    var hits = [];
    LEX.forEach(function (entry) {
      var hit = lexIn(entry, line, lineSpaced, lineExpanded);
      if (hit) hits.push({ entry: entry, hit: hit });
    });
    hits.filter(function (one) {
      return !one.hit.spacedHit || !hits.some(function (other) {
        return other !== one && other.hit.spacedHit && other.hit.length > one.hit.length &&
          other.hit.at <= one.hit.at && other.hit.at + other.hit.length >= one.hit.at + one.hit.length;
      });
    }).forEach(function (one) {
      var entry = one.entry;
      add(lang === "en" && entry.labelEn ? entry.labelEn : entry.label, entry.keys.slice(),
          { at: one.hit.at, lex: entry, cert: entry.cert, language: entry.language, kind: entry.kind });
    });

    //  Was schon ein Lexikon-Eintrag ist, kommt nicht ein zweites Mal ueber
    //  Muster oder Substantive herein: "Deutschkenntnisse" ist Deutsch.
    function covered(term) {
      var key = spaced(cleanTerm(term)).trim();
      if (!key || special(term)) return true;
      return found.some(function (entry) {
        if (!entry.lex) return false;
        var words = entry.keys.concat([spaced(entry.label).trim()]);
        return words.some(function (k) {
          return key === k || key.indexOf(k + " ") === 0 || (" " + k + " ").indexOf(" " + key + " ") !== -1;
        });
      });
    }

    var degreeText = [];
    PATTERNS.forEach(function (pattern) {
      if (lexiconOnly) return;
      //  "bzw." und "z. B." beenden keinen Satz.
      var match = pattern.re.exec(ungender(line).replace(/\bbzw\./gi, "bzw").replace(/\bz\.\s?b\./gi, "zB"));
      if (!match) return;
      var phrase = pattern.degree || pattern.list
        ? expandSuspended(match[1]).split(/\s+(?:sowie (?:erfahrung|kenntnisse)|as well as|und (?:erfahrung|kenntnisse)|and (?:experience|knowledge))\b/i)[0]
        : trimPhrase(match[1]);
      if (pattern.degree) degreeText.push(spaced(phrase), spaced(match[1]));
      //  "Ausbildung als A, B oder C": eine Auswahl, alle in einer Gruppe.
      var choice = pattern.degree && /\s(oder|bzw\.?|or)\s/i.test(phrase) ? {} : null;
      //  "Sanitär-, Heizungs- und Klimatechnik": vor dem Komma oder "und"
      //  steht ein Ergaenzungsstrich – dort wird nicht getrennt.
      phrase.split(/\s*(?:(?<!-),|\/|(?<!-\s?)\bund\b|(?<!-\s?)\boder\b|\band\b|\bor\b|\bbzw\.?|\bz\.? ?b\.?|\bzB\b)\s*/).forEach(function (part) {
        //  "staatlich anerkannte Erzieher", "ein Studium der Kindheitspädagogik":
        //  vorn steht, was den Abschluss beschreibt, nicht der Abschluss.
        if (pattern.degree) {
          part = part.replace(/^\s*(?:ein(?:e[nmrs]?)?\s+)?(?:studium\s+(?:der|des|im|in)\s+|ausbildung\s+(?:als|zum|zur)\s+)?/i, "");
          if (lang === "de") part = part.replace(/^(?:[a-zäöüß][\wäöüß-]*\s+)+(?=[A-ZÄÖÜ])/, "");
          part = part.replace(/\b(?:oder )?(?:vergleichbar\w*|equivalent|similar|related)\b.*$/i, "");
          //  "Betriebswirtschaftslehre mit Schwerpunkt Controlling": das Fach
          //  ist das Vordere.
          part = part.replace(/\s+(?:mit|im|und)\s+(?:dem\s+)?(?:schwerpunkt|fokus|vertiefung|ausrichtung|spezialisierung)\b.*$/i, "");
        }
        //  Nach einem Leitwort ("Verständnis für …") ist die Liste das
        //  Eigentliche; was nach einem Verb kommt, nicht mehr.
        if (pattern.list) part = part.split(/\s+(?:zu|und (?:du|sie|bist|hast|kannst)|sowie (?:du|sie))\s+/i)[0];
        var term = cleanTerm(part.split(/\s+/).slice(0, pattern.degree ? 8 : 4).join(" "));
        if (term.indexOf("-") !== -1) term = term.split(" ").map(stripTails).filter(Boolean).join(" ");
        //  Fuellwoerter nur am Rand weg: "Fachkraft für Lagerlogistik"
        //  behaelt sein "für".
        var words = term.split(" ");
        while (words.length && isGeneric(words[0])) words.shift();
        while (words.length && isGeneric(words[words.length - 1])) words.pop();
        if (!words.length || covered(term)) return;
        //  Im Deutschen ist ein Substantiv gross; ein klein geschriebenes
        //  Wort hinter "Erfahrung in" ist meist schon der Rest des Satzes.
        if (lang === "de" && !/^[A-ZÄÖÜ0-9]/.test(words[0])) return;
        add(words.join(" "), [spaced(words.join(" ")).trim()],
            { at: lineSpaced.indexOf(spaced(words[0]).trim()), kind: pattern.degree ? "degree" : undefined, choice: choice });
      });
    });

    //  Ein Satz ohne Anforderungsmerkmal in einer Anzeige ohne Gliederung
    //  ("Wir sind ein Team in Chemnitz …"): nur, was das Lexikon sicher kennt.
    acronyms(line).forEach(function (term) {
      //  In Saetzen ohne Anforderungsmerkmal nur laengere Kuerzel: DNS, VLAN,
      //  HACCP – kein "FL" aus "Tampa, FL".
      //  Bei Aufgaben gar keine: "Be- und Entladen von LKW" verlangt nichts.
      if (level === "task" || covered(term) || (lexiconOnly && term.replace(/[^A-Z]/g, "").length < 3)) return;
      add(term, [spaced(term).trim()], { at: lineSpaced.indexOf(" " + spaced(term).trim() + " "), acronym: true });
    });
    if (lexiconOnly) return groupAlternatives();

    //  Fuer englische Anforderungen (nicht fuer Aufgaben) auch die
    //  klein geschriebenen Wortgruppen.
    if (lang === "en" && level !== "task") {
      phrasesEn(line).forEach(function (term) {
        if (covered(term) || found.some(function (entry) {
          return spaced(term).indexOf(" " + spaced(entry.label).trim() + " ") !== -1 && entry.lex;
        })) return;
        add(term, [spaced(term).trim()], { at: lineSpaced.indexOf(" " + spaced(term).trim().split(" ")[0] + " ") });
      });
    }

    var examples = lang === "de" && isProse(line) ? line.search(/\b(wie|z\. ?b\.|zb|etwa|beispielsweise|insbesondere|namentlich|darunter)\s/i) : -1;
    var nouns = lang !== "de" ? namesEn(line)
      : examples === -1 ? nounsDe(line, isProse(line))
      : nounsDe(line.slice(0, examples), true).concat(nounsDe(line.slice(examples), false));
    nouns.forEach(function (term) {
      if (covered(term)) return;
      add(term, [spaced(term).trim()], { at: lineSpaced.indexOf(" " + spaced(term).trim() + " ") });
    });

    //  Ein Begriff aus dem Lexikon in "Ausbildung als Pflegefachkraft" ist
    //  der Abschluss, nicht die Taetigkeit.
    var choices = degreeText.filter(function (text) { return /\s(oder|bzw|or)\s/.test(text); });
    found.forEach(function (term) {
      if (term.language || term.kind === "licence") return;
      var keys = [spaced(term.label)].concat((term.keys || []).map(function (k) { return " " + k + " "; }));
      if (degreeText.some(function (text) {
        return keys.some(function (key) { return text.indexOf(key) !== -1; });
      })) term.kind = "degree";
      if (term.kind === "degree" && choices.some(function (text) {
        return keys.some(function (key) { return text.indexOf(key) !== -1; });
      })) term.choice = true;
    });

    //  "React oder Vue", "Python bzw. R", "Excel/Google Sheets": eine Gruppe,
    //  die ein Treffer erfuellt.
    //  "Six Sigma Yellow Belt" und zusaetzlich "Six", "Sigma", "Belt": ein
    //  Wort, das schon in einer laengeren Wortgruppe steckt, faellt weg.
    found = found.filter(function (term) {
      if (term.lex || term.acronym) return true;
      var own = " " + spaced(term.label).trim() + " ";
      return !found.some(function (other) {
        if (other === term) return false;
        var big = " " + spaced(other.label).trim() + " ";
        return big.length > own.length && big.indexOf(own) !== -1;
      });
    });
    return groupAlternatives();

    function groupAlternatives() {
    //  Eine Aufzaehlung, die mit "oder" endet ("Go, Java or Kotlin"), ist
    //  als Ganzes eine Auswahl.
    found.sort(function (a, b) { return a.at - b.at; });
    var lineText = fold(ungender(line));
    function wordAt(word, from) {
      var re = new RegExp("(^|[^a-z0-9+#])" + escapeRe(fold(word)) + "(?![a-z0-9+#])", "g");
      re.lastIndex = Math.max(0, from);
      var hit = re.exec(lineText);
      return hit ? hit.index + hit[1].length : -1;
    }
    var cursor = 0;
    var spots = found.map(function (term) {
      var at = wordAt(term.label, cursor);
      if (at === -1) at = wordAt(term.label, 0);
      if (at !== -1) cursor = at + fold(term.label).length;
      return at;
    });
    var seps = found.map(function (term, index) {
      var next = found[index + 1];
      if (!next) return "end";
      var from = spots[index];
      var to = spots[index + 1];
      var between = from !== -1 && to !== -1 && to > from ? lineText.slice(from + fold(term.label).length, to)
        : lineSpaced.slice(term.at, next.at);
      if (/^[\s-]*(oder|bzw\.?|beziehungsweise|or|alternativ|\/)[\s]*$/.test(between)) return "alt";
      if (/^[\s-]*,[\s]*$/.test(between)) return "list";
      return "break";
    });
    var group = 0;
    var runStart = 0;
    found.forEach(function (term, index) {
      term.group = group;
      if (seps[index] === "alt") {
        //  Was davor nur mit Komma angereiht war, gehoert mit dazu.
        for (var back = runStart; back < index; back++) found[back].group = group;
      } else if (seps[index] === "break" || seps[index] === "end") {
        group++;
        runStart = index + 1;
      } else if (seps[index] === "list") {
        group++;
      }
    });
    //  "Wirtschaftsinformatik, Statistik, Mathematik oder vergleichbar":
    //  alles vor "oder vergleichbar" ist eine Auswahl.
    var similar = lineText.search(/\s(oder|or)\s+(eine?n?\s+)?(vergleichbar|aehnlich|aehnlichen|aehnliche|similar|equivalent|related|a related)/);
    if (similar !== -1) {
      var anchor = null;
      found.forEach(function (term, index) {
        if (spots[index] === -1 || spots[index] > similar) return;
        if (anchor === null) anchor = term.group;
        term.group = anchor;
      });
    }

    //  Abschluesse aus "als A, B oder C" sind eine Auswahl.
    var chosen = found.filter(function (term) { return term.choice; });
    if (chosen.length > 1) {
      var first = Math.min.apply(null, chosen.map(function (term) { return term.group; }));
      chosen.forEach(function (term) { term.group = first; });
    }

    //  Gruppen durchnummerieren, damit Luecken nicht stoeren.
    var seen = {};
    var number = 0;
    found.forEach(function (term) {
      if (!(term.group in seen)) seen[term.group] = number++;
      term.group = seen[term.group];
    });
    return found;
    }
  }

  /* ----------------------------------------------------- Im Lebenslauf */

  function corpus(state) {
    var parts = [];
    function push(path, text, kind) {
      text = String(text || "").trim();
      if (text) parts.push({ path: path, text: text, kind: kind || "resume", spaced: spaced(text) });
    }
    var s = state || {};
    var contact = s.contact || {};
    push("contact.role", contact.role);
    if (s.profile && s.profile.show !== false) push("profile.text", s.profile.text);
    (s.events || []).forEach(function (event, index) {
      push("events." + index, [event.title, event.company, event.place]
        .concat(event.description || [], event.list || []).join("\n"));
    });
    ["skills", "languages", "interests", "projects", "mobility", "mobilitySB"].forEach(function (key) {
      var block = s[key];
      if (!block || !Array.isArray(block.items)) return;
      block.items.forEach(function (item, index) {
        push(key + ".items." + index, [item.name, item.level, item.description, item.text]
          .filter(function (value) { return typeof value === "string"; }).join(" "));
      });
    });
    var letter = s.coverLetter || {};
    if (s.settings && s.settings.showCoverLetter) {
      push("coverLetter.paragraphs", (letter.paragraphs || []).join("\n"), "letter");
    }
    parts.forEach(function (part) {
      part.tokens = part.spaced.trim().split(" ");
      part.stems = part.tokens.map(stem);
    });
    return parts;
  }

  function snippet(text, key) {
    var plain = String(text).replace(/\s+/g, " ").trim();
    var at = fold(plain).indexOf(key.split(" ")[0]);
    if (at < 0) return plain.slice(0, 70);
    var start = Math.max(0, at - 25);
    return (start ? "…" : "") + plain.slice(start, start + 70) + (start + 70 < plain.length ? "…" : "");
  }

  //  Ein Schluessel in einem Teil des Lebenslaufs? "exact": als Wort oder
  //  Wortfolge, auch mit Bindestrich oder Leerzeichen anders gesetzt, oder
  //  mit anderer Endung. "part": als Teil eines zusammengesetzten Wortes
  //  ("Dokumentation" in "Pflegedokumentation").
  function findKey(key, part) {
    if (part.spaced.indexOf(" " + key + " ") !== -1) return "exact";
    var target = key.replace(/ /g, "");
    var n = key.split(" ").length;
    var stemmed = key.split(" ").map(stem).join(" ");
    for (var size = 1; size <= 3; size++) {
      for (var i = 0; i + size <= part.tokens.length; i++) {
        var joined = part.tokens.slice(i, i + size).join("");
        //  "Erzieherin" ist "Erzieher", "Pflegerinnen" ist "Pfleger".
        if (joined === target || joined === target + "in" || joined === target + "innen") return "exact";
        if (size === n && part.stems.slice(i, i + size).join(" ") === stemmed) return "exact";
      }
    }
    if (target.length >= 6) {
      for (var j = 0; j < part.tokens.length; j++) {
        var token = part.tokens[j];
        if (token.length > target.length && (token.slice(-target.length) === target ||
            token.indexOf(target) === 0)) return "part";
      }
    }
    return null;
  }

  function caseSensitiveIn(term, part) {
    return (term.lex && term.lex.cs || []).some(function (word) {
      return new RegExp("(^|[^\\w+#.])" + escapeRe(word) + "(?![\\w+#])").test(part.text);
    });
  }

  function relatedKeys(term) {
    var mine = term.keys.concat([spaced(term.label).trim()]);
    var out = [];
    RELATED.forEach(function (group) {
      var keys = group.map(function (key) { return spaced(key).trim(); });
      if (keys.some(function (key) { return mine.indexOf(key) !== -1; })) {
        keys.forEach(function (key) { if (mine.indexOf(key) === -1) out.push(key); });
      }
    });
    return out;
  }

  //  Was das Speziellere belegt: "Finanzbuchhaltung" belegt "Buchhaltung",
  //  Klasse CE belegt Klasse B. Nie umgekehrt.
  function impliedKeys(term) {
    var out = [];
    LEX.forEach(function (entry) {
      if (entry.implies.indexOf(term.label) !== -1) out = out.concat(entry.keys);
    });
    return out;
  }

  function locate(term, parts) {
    var best = null;
    function consider(status, part, key) {
      var rank = { found: 3, similar: 2, letter: 1 }[status];
      if (!best || rank > best.rank) best = { rank: rank, status: status, path: part.path, evidence: snippet(part.text, key || "") };
    }
    parts.forEach(function (part) {
      var hit = caseSensitiveIn(term, part) ? "exact" : null;
      term.keys.forEach(function (key) {
        if (hit === "exact") return;
        var result = findKey(key, part);
        if (result === "exact" || (result === "part" && !hit)) hit = result;
      });
      if (hit === "exact") consider(part.kind === "letter" ? "letter" : "found", part, term.keys[0]);
      else if (hit === "part" && part.kind !== "letter") consider("similar", part, term.keys[0]);
    });
    if (!best || best.status !== "found") {
      impliedKeys(term).forEach(function (key) {
        parts.forEach(function (part) {
          if (findKey(key, part) === "exact") consider(part.kind === "letter" ? "letter" : "found", part, key);
        });
      });
    }
    if (!best || best.status !== "found") {
      relatedKeys(term).forEach(function (key) {
        parts.forEach(function (part) {
          if (part.kind === "letter") return;
          if (findKey(key, part) === "exact") consider("similar", part, key);
        });
      });
    }
    return best;
  }

  /* ---------------------------------------------------------- Auswerten */

  //  Steht eine Eigenschaft schon im Lebenslauf (Profil, Kenntnisse,
  //  Anschreiben)? Dann ein Haken; sonst bleibt sie offen, ohne Luecke.
  function softStatus(label, parts) {
    var entry = SOFT.filter(function (one) { return one.label === label || one.en === label; })[0];
    if (!entry) return null;
    var best = null;
    parts.forEach(function (part) {
      if (best && best.status === "found") return;
      if (entry.re.test(fold(ungender(part.text)).replace(/[^a-z0-9+#]+/g, " "))) {
        best = { status: part.kind === "letter" ? "letter" : "found", path: part.path, evidence: snippet(part.text, "") };
      }
    });
    return best;
  }

  function analyse(adText, state, dismissed, confirmed) {
    var lang = language(adText);
    var cvDegrees = degreesOf(state);
    var sure = asSet((confirmed || []).map(function (label) { return compact(label); }));
    var sections = segment(adText);
    var structured = sections.some(function (section) {
      return section.kind === "req" || section.kind === "tasks" || section.kind === "nice" || section.kind === "unknown";
    });
    var parts = corpus(state);
    var gone = asSet((dismissed || []).map(function (label) { return compact(label); }));
    var requirements = [];
    var skipped = [];

    sections.forEach(function (section) {
      var counted = structured
        ? (section.kind === "req" || section.kind === "tasks" || section.kind === "nice" || section.kind === "unknown")
        : section.kind === "intro";
      //  Wie ohne Gliederung: nach den Merkmalen der Zeile.
      var byCue = !structured || section.kind === "unknown";
      if (!counted) {
        if (section.heading || section.kind !== "intro") skipped.push(section.heading || section.kind);
        return;
      }
      //  "Sehr gute Deutschkenntnisse, Englisch von Vorteil": das "von
      //  Vorteil" gilt nur fuer den Teil, in dem es steht. Eine Zeile mit
      //  gemischtem Gewicht wird deshalb an ihren Kommas geteilt.
      var lines = [];
      section.lines.forEach(function (line, index) {
        //  Die erste Zeile ohne Gliederung ist meist der Titel der Stelle.
        if (!structured && index === 0 && section.lines.length > 2) return;
        var clauses = line.split(/,\s+|;\s+/);
        var marked = clauses.filter(function (clause) { return NICE.test(fold(clause)); }).length;
        //  "Java, Kotlin or AWS is a plus": eine Aufzaehlung, die mit "oder"
        //  endet, ist eine Angabe – das "a plus" gilt fuer alle.
        var last = fold(clauses[clauses.length - 1]);
        var oneList = /\s(or|oder|and|und|bzw)\s/.test(last) && clauses.slice(0, -1).every(function (clause) {
          return clause.split(/\s+/).length <= 4;
        });
        if (clauses.length > 1 && marked && marked < clauses.length && !oneList) {
          clauses.forEach(function (clause) { lines.push(clause); });
        } else {
          lines.push(line);
        }
      });
      lines.forEach(function (line) {
        var folded = fold(line);
        if (LEGAL.test(folded) || NEGATED.test(folded)) return;
        //  Eine Lohnangabe in Klammern hinter einer Anforderung ("Bilingual
        //  English/Spanish (+$1.50/hr)") macht die Zeile nicht zum Angebot.
        var bare = folded.replace(/\([^)]*\)/g, " ");
        var plain = spaced(line).trim();
        if (OFFER_LINE.test(bare) || CONTACT_LINE.test(bare) || ABOUT_LINE.test(folded) || APPLY_LINE.test(plain)) return;
        //  Ohne Gliederung: Saetze ohne Anforderungsmerkmal sind Taetigkeiten.
        var cue = !byCue || REQUIREMENT_CUE.test(folded);
        var level = section.kind === "tasks" || !cue ? "task" : section.kind === "nice" ? "nice" : "must";
        if (NICE.test(folded)) level = "nice";
        else if (MUST.test(folded) && level !== "task") level = "must";
        //  Persoenliche Eigenschaften stehen fuer sich – nicht bei Aufgaben,
        //  dort beschreiben sie die Arbeit, nicht die Person.
        if (level !== "task") {
          var soft = softIn(line, lang).filter(function (label) {
            return !requirements.some(function (req) {
              return req.level === "soft" && req.terms.some(function (term) { return term.label === label; });
            });
          });
          if (soft.length) {
            requirements.push({ text: line, level: "soft", terms: soft.map(function (label) {
              var at = softStatus(label, parts);
              return { label: label, group: 0, status: at ? at.status : "open", kind: "soft",
                       path: at ? at.path : null, evidence: at ? at.evidence : "", language: false, cert: false };
            }) });
          }
        }
        //  Was dem Unternehmen wichtig ist, verlangt nichts von der Person.
        if (VALUES_LINE.test(plain)) return;

        function finish(term, at, status) {
          if (gone[compact(term.label)]) status = "dismissed";
          else if (status === "missing" && sure[compact(term.label)]) status = "confirmed";
          return {
            label: term.label, group: term.group, status: status,
            path: at ? at.path : null, evidence: at ? at.evidence : "",
            language: !!term.language, cert: !!term.cert || term.kind === "cert",
            kind: term.kind || (term.language ? "language" : term.cert ? "cert" : "skill"),
          };
        }

        //  Abschluesse: gemessen an dem, was der Lebenslauf hat – wer Abitur
        //  hat, hat "mindestens einen Hauptschulabschluss".
        var special = [];
        if (level !== "task") {
          var degrees = degreesIn(line, lang);
          var together = degrees.length > 1 && /\s(oder|or|bzw)\s/.test(spaced(line));
          degrees.forEach(function (one, index) {
            var at = degreeStatus(one.entry, cvDegrees, one.comparable);
            special.push(finish({ label: one.label, group: 1000 + (together ? 0 : index), kind: "degree" },
              at, at ? at.status : "missing"));
          });
          conditionsIn(line).forEach(function (label, index) {
            var term = { label: label, keys: [spaced(label).trim()], group: 2000 + index, kind: "condition" };
            var at = locate(term, parts);
            special.push(finish(term, at, at ? at.status : "missing"));
          });
        }

        //  Unter "Deine Aufgaben" wird alles gesucht und nur gezeigt, was der
        //  Lebenslauf hat. Ein Satz ohne Anforderungsmerkmal in einer Anzeige
        //  ohne Gliederung: nur, was das Lexikon sicher kennt.
        var taskSection = section.kind === "tasks";
        var terms = special.concat(extractTerms(line, lang, level, !cue && !taskSection).filter(function (term) {
          //  Eine Bedingung als Wortgruppe ist schon da ("Lift up to 50 lbs").
          return !special.some(function (one) { return spaced(one.label).indexOf(spaced(term.label)) !== -1; });
        }).map(function (term) {
          var at = locate(term, parts);
          var status = at ? at.status : "missing";
          //  Ein Zertifikat belegt nur das Zertifikat selbst, nie ein
          //  verwandtes Wort.
          if ((term.cert || term.kind === "cert") && status === "similar") status = "missing";
          //  Ein Fach als Teil eines Abschlusses: "Kommunikation" in "B.A.
          //  Kommunikationsmanagement" ist das Fach, nicht bloss aehnlich.
          if (term.kind === "degree" && status === "similar" && at && /^events\.\d+$/.test(at.path) &&
              ((state.events || [])[Number(at.path.split(".")[1])] || {}).sectionId === "education") status = "found";
          //  "… oder eine vergleichbare Qualifikation": ein anderer Abschluss
          //  derselben Stufe ist nicht dasselbe, aber vielleicht gemeint.
          if (term.kind === "degree" && status === "missing" && cvDegrees.level >= 5 &&
              /vergleichbar|gleichwertig|equivalent|comparable|related field/.test(folded)) {
            status = "similar";
            at = { path: cvDegrees.path, evidence: cvDegrees.text };
          }
          //  Ein Abschluss mit Fach ("Ausbildung als Elektroniker"): steht
          //  das Fach in einer abgeschlossenen Ausbildung, ist er erfuellt.
          return finish(term, at, status);
        }).filter(function (term) {
          //  Bei Aufgaben zaehlt nur, was der Lebenslauf schon zeigt
          //  ("Elternarbeit ✓"). Was fehlt, lernt man im Job – als Luecke
          //  waere es nur Rauschen ("Rat", "Tat", "Fragen").
          return !taskSection || term.status === "found" || term.status === "similar";
        }));
        //  "Bachelor's degree in Computer Science": das Fach sagt mehr als
        //  die Stufe; die Stufe allein kaeme als zweite Forderung daher.
        var withField = terms.some(function (term) { return term.kind === "degree" && term.group < 1000; });
        if (withField) {
          terms = terms.filter(function (term) {
            return !(term.group >= 1000 && term.group < 2000 && /^(Bachelor|Master|Hochschulabschluss|University degree)$/.test(term.label));
          });
        }
        //  "kaufmännische Ausbildung, z. B. als Kauffrau für Büromanagement":
        //  das Beispiel ist eine Moeglichkeit, keine zweite Forderung.
        if (/\b(z\.? ?b\.?|zum beispiel|beispielsweise|e\.g\.|such as)\s/i.test(line) &&
            terms.some(function (term) { return term.group >= 1000 && term.group < 2000; })) {
          terms.forEach(function (term) { if (term.kind === "degree") term.group = 1000; });
        }
        if (!terms.length) return;
        //  In einer Gruppe "A oder B" genuegt einer: dann gilt die ganze
        //  Gruppe als belegt.
        var groups = {};
        terms.forEach(function (term) {
          groups[term.group] = groups[term.group] || [];
          groups[term.group].push(term);
        });
        Object.keys(groups).forEach(function (key) {
          var members = groups[key];
          var met = members.filter(function (term) { return term.status === "found"; })[0];
          if (met && members.length > 1) {
            members.forEach(function (term) { if (term !== met) term.status = "alternative"; });
          }
        });
        requirements.push({ text: line, level: level, terms: terms });
      });
    });

    var counts = { must: {}, nice: {}, task: {}, soft: {} };
    requirements.forEach(function (req) {
      req.terms.forEach(function (term) {
        var bucket = counts[req.level];
        bucket[term.status] = (bucket[term.status] || 0) + 1;
      });
    });

    return {
      lang: lang, structured: structured, requirements: requirements,
      skipped: skipped, counts: counts,
    };
  }

  //  Der Titel der Stelle, fuer die Bibliothek: die erste kurze Zeile.
  function titleOf(adText) {
    var first = linesOf(adText)[0] || "";
    return first.length <= 90 ? ungender(first).replace(/\s+/g, " ").trim() : "";
  }

  global.RickCVJobMatch = {
    analyse: analyse,
    titleOf: titleOf,
    // fuer die Tests
    _fold: fold, _ungender: ungender, _segment: segment, _extract: extractTerms,
    _language: language, _stem: stem, _soft: softIn,
  };
})(typeof window !== "undefined" ? window : this);
