//     _____  _      _     _______      __
//    |  __ \(_)    | |   / ____\ \    / /
//    | |__) |_  ___| | _| |     \ \  / / 
//    |  _  /| |/ __| |/ / |      \ \/ /  
//    | | \ \| | (__|   <| |____   \  /   
//    |_|  \_\_|\___|_|\_\\_____|   \/  
//    A dynamic template for your resume and cover letter
                                                        
                                                        

// Experimentelle ATS-Funktion: Aktiviert ein zusätzliches, maschinenlesbares Format für Lebenslaufdaten, um die Kompatibilität mit Applicant Tracking Systems (ATS) zu erhöhen. Dies ist besonders nützlich bei komplexen Layouts.
let activateATS = 1; // 1 für aktivieren, 0 für deaktivieren

// Layout-Template auswählen
let template = "clean"; // 'clean', 'icons', 'dynaline'

// Profiltext hier anpassen
let showProfile = 1; // 1 für anzeigen, 0 für ausblenden
let profileText =
  "Bezwinger des Dunklen Lords der Eurythmie (der, dessen Name nicht getanzt werden darf) möchte Fahrkartenkontrollen in vollen Zügen genießen.";

// Profilbild hier anpassen
let showProfileImage = 1; // 1 für anzeigen, 0 für ausblenden
let profileImage = "https://i.ibb.co/QKnK1ry/image.webp"; // Profilbild-Pfad

// Kontaktinformationen hier anpassen
let contactInfo = {
  name: "Harald Töpfer",
  role: "Zugbegleiter",
  address: "Musterstraße 4",
  city: "12345 Musterstadt",
  email: "verlinkte@email.com",
  phone: "+49 123456789",
};

// Möglichkeit, Sprachkenntnisse anzugeben, inklusive eines optionalen Niveaus "level", das visuell im Balken dargestellt wird.
let showLanguages = 1; // 1 für anzeigen, 0 für ausblenden
let lang = [
  { name: "Deutsch", percentage: 100 },
  { name: "Klingonisch", percentage: 60, level: "B2" },
  { name: "Elbisch", percentage: 30, level: "A2" },
];

// Mobilität in der Sidebar hier anpassen. "icon" legt das Symbol fest. Möglich sind alle hier verfügbare Werte: https://fonts.google.com/icons
let showMobilitySB = 0; // 1 für anzeigen, 0 für ausblenden
let mobilitySB = [
  { name: "Führerschein Klasse B", icon: "directions_car_filled" },
];


// Interessen hier anpassen. "icon" legt das Symbol fest. Möglich sind alle hier verfügbaren Symbole und Icons: https://fonts.google.com/icons
let showInterests = 1; // 1 für anzeigen, 0 für ausblenden
let interests = [
  { name: "Züge", icon: "train" },
  { name: "Die Zahl 9", icon: "counter_9" },
  { name: "Zu Vino sag ich nie no", icon: "wine_bar" },
  { name: "Zaubertricks", icon: "auto_fix_high" },
];

// Projekte hier anpassen. "img" legt das Bild fest, "url" legt den Link fest. Der Link wird sowohl auf das Bild als auch auf den Namen angewendet. "alt" des Bildes ist automatisch der Projektname.
let showProjects = 1; // 1 für anzeigen, 0 für ausblenden
let projects = [
  {
    name: "aufdiepalme.de",
    img: "https://opengameart.org/sites/default/files/1_7.jpg",
    url: "https://github.com/rickintoplace/ResumeRick",
    description: "Baumschule für Problempflanzen",
  },
   {
    name: "Privatsammlung",
    img: "https://images.pexels.com/photos/1724184/pexels-photo-1724184.jpeg?auto=compress&cs=tinysrgb&w=200",
    url: "https://github.com/rickintoplace/ResumeRick",
    description: "Sammelleidenschaft für Altporzellan",
  },
];

// Hier die Fähigkeiten, Kenntnisse oder Skills eintragen von 1 bis 5. Nicht nur ganze Zahlen sind möglich, aber 2,16 oder so könnte merkwürdig aussehen.
let showSkills = 1; // 1 für anzeigen, 0 für ausblenden
let skills = [
  { name: "Modelleisenbahn", rank: 5 },
  { name: "Klemmbausteine", rank: 4 },
  { name: "MS Paint", rank: 4 },
  { name: "Internet", rank: 3.5 },

];

// Mobilität auf der großen Seite hier anpassen
let showMobility = 1; // 1 für anzeigen, 0 für ausblenden
let mobility = [{ name: "Führerschein Klasse B" }];

// Referenzen. Wird nicht sichtbar im Lebenslauf angezeigt, aber fürs ATS scanbar eingetragen, um auf Nummer Sicher zu gehen.
let references = [{ name: "Auf Anfrage verfügbar" }];

// Format Datum
let dateFormat = "short"; // 'full' für MM/YYYY, 'short' für MM/YY

// Ausbildung getrennt aufführen
let separateEducation = 1; // Setze auf 1 für separate Ausbildungs-Section

// Ehrenamt getrennt aufführen
let separateVolunteer = 1; // Setze auf 1 für separates Ehrenamt

// Chronologische Sortierung des Lebenslaufs invertieren
let reverseTimeline = 1; // 0 = normal, 1 = invertiert

// "1" Verbirgt die farbige Linie. Falls du sie in einem Template ausblenden willst, ohne in jedem Event "hideline" auf 1 setzen zu müssen
let noLine = "0";

// Steuert die Ausrichtung des Tests im Anschreiben. Geschmackssache. Linksbündig ist besser lesbar und wird deshalb meistens empfohlen, aber Blocksatz kann professioneller wirkenl. Am besten im Einzelnen checken, welches Format der Arbeitgeber bevorzugt.
let alignText = "left"; // "justify" oder "left".

// Einträge für den Lebenslauf hier bearbeiten:
// Erklärungen:
// title: "Tätigkeit oder Rolle xyz",             ist die Überschrift des Eintrags
// start: "07/2012",                              sollte immer eingetragen werden und legt den zeitlichen Beginn des Eintrags fest.
// end: "07/2015",                                definiert das zeitliche Ende des Eintrags, s.o.
// present: "1",                                  optional. Wenn 1, wird als Enddatum "heute" angezeigt.
// company: "Firma xyz",                          ist für den Namen der Firma oder Schule. Wird in Kapitälchen dargestellt.
// place: "Ort xyz",                              wird nach der Firma angezeigt.
// description: "Beschreibung xyz",               optional, aber empfohlen. Beschreibung der Tätigkeit. Mehrere Einträge möglich!
// list: "Liste",                                 optional, aber empfohlen. Für zusätzliche Informationen, die du zu diesem Eintrag vermitteln willst, i.d.R. die Beschreibung der Tätigkeit. Mehrere Einträge möglich!
// education: "1",                                optional, für Schule, Ausbildung, Studium. Wird im ATS gesondert aufgeführt und könnte auch im Lebenslauf gesondert dargestellt werden.
// volunteer: "1",                                optional, wenn du etwas als Ehrenamt aufführen willst
// Format:
// icon: "xyz",                                   legt das Symbol fest. Möglich sind alle hier verfügbaren Symbole und Icons: https://fonts.google.com/icons
// color: "var(--accent-color-shade3)",           Setzt die Farbe auf eine dynamische Schattierung der Akzentfarbe, kann aber durch jede Farbe ersetzt werden. Alle Variablen sind im CSS-Root definiert.
// hideline: "0",                                 optional, entfernt die Linie für den Eintrag. Sinnvoll für kurze Events
// hoffset: 20,                                   optional, wenn du mit der horizontalen Positionierung nicht zufrieden bist, kannst du den Eintrag hier mit positiven oder negativen Werten einrücken.
// voffset: -18,                                  optional, für die vertikale Feinjustierung nach unten oder oben
//
// Vergiss nicht, alle Einträge in Anführungszeichen ("") zu setzen (bis auf die Offsets) und mit einem Komma abzuschließen.

let events = [
  {
    title: "Abitur",
    start: "10/2010",
    end: "11/2013",
    icon: "school",
    color: "var(--accent-color-shade3)",
    company: "IGS für Zauberei und Kunst",
    place: "Bad Wimpeln",
    education: "1",
  },
  {
    title: "Praktikum",
    start: "07/2013",
    end: "11/2013",
    icon: "stadia_controller",
    color: "var(--accent-color-shade1)",
    company: "Bei einemn Freund",
    place: "Frankfurt",
/*     description: [
      "Freier Mitarbeiter für lokale Wochenzeitung",
    ], */
    hoffset: 20,
  },
  {
    title: "Angefangene Ausbildung zum Tierpfleger",
    start: "11/2013",
    end: "09/2015",
    icon: "cruelty_free",
    color: "var(--accent-color-shade3)",
    company: "Zoolino",
    place: "Bad Wimpeln",
    description: [
"Tierpflege im Kontaktbereich",
    ],
    list: [
      "Schildkröten streicheln",
      "Kaninchen streicheln",
          ],
    education: "1",
    hoffset: 0,
    voffset: 0,
  },
  {
    title: "Umweltengagement",
    start: "09/2015",
    end: "07/2021",
    present: "0",
    icon: "recycling",
    color: "var(--accent-color-shade1)",
    company: "Aldi Ost",
    place: "Frankfurt (Oder)",
    description: [
      "Tägliche Leergutrückgabe",
    ],
    volunteer: "1",
    hoffset: 0,
    voffset: 0,
  },
  {
    title: "Ferienspaß",
    start: "07/2021",
    end: "10/2021",
    icon: "train",
    color: "var(--accent-color-shade2)",
    company: "Spaß AG",
    place: "Frankfurt",
    description: [
      "Bildungsfahrt mit ein bisschen Freizeit",
          ],
    list: [
      "Wir sind mit dem Zug hingefahren",
      "Wir waren im Museum für Schienenverkehr",
    ],
    hoffset: 0,
    voffset: 0,
  },
  {
    title: "Selbstständigkeit",
    start: "07/2021",
    end: "05/2022",
    icon: "work",
    color: "var(--accent-color-shade2)",
    company: "Ebay Kleinanzeigen",
    place: "Frankfurt",
    description: [
      "Auktionsbetreiber von Privatsammlungen im Homeoffice",
          ],
    hoffset: 0,
    voffset: 0,
  },
  {
    title: "Nachhaltigkeitsprojekt im Naturschutz",
    start: "09/2021",
    end: "05/2023",
    icon: "spa",
    color: "var(--accent-color-shade1)",
    company: "Krombacher",
    place: "Kreuztal-Krombach",
     description: [
"Unterstütung beim Erhalt von Regenwaldflächen"
    ],
    volunteer: "1",
    hoffset: 20,
    voffset: 0,
  },
  {
    title: "Soziale Leistungen",
    start: "05/2023",
    end: "01/2025",
    present: "1",
    icon: "liquor",
    color: "var(--accent-color-shade3)",
    company: "Bundesagentur für Arbeit",
    place: "Frankfurt",
     description: [
"Größtenteils als Empfänger"
    ],
    volunteer: "1",
    hoffset: 0,
    voffset: 0,
  },
];

// Ab hier keine Anpassungen mehr vornehmen, wenn du nicht weißt, was du tust


// Layout entsprechend dem gewählten Template anwenden
function applyTemplate(template) {
  switch (template) {
    case "clean":
      document.body.classList.add("template-clean");
      break;
    case "dynaline":
      document.body.classList.add("template-dynaline");
      break;
    case "icons":
      document.body.classList.add("template-icons");
      break;
      case "test":
        document.body.classList.add("template-test");
        break;
    // Weitere Templates können hier hinzugefügt werden
    default:
      document.body.classList.add("default-style");
  }
}

// Anwendung des Templates
applyTemplate(template);

function calculateMonthsDifference(start, end) {
  const [startMonth, startYear] = start.split("/").map(Number);
  const [endMonth, endYear] = end.split("/").map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth);
}

function calculateTotalMonths(events) {
  const startDates = events.map((event) => event.start);
  const endDates = events.map((event) => event.end);

  // Überprüfen, ob startDates oder endDates leer sind
  if (startDates.length === 0 || endDates.length === 0) {
    return 0; // Wenn leer, gib 0 zurück
  }

  const earliestStart = startDates.reduce((min, date) =>
    new Date(date.split("/").reverse().join("-")) <
    new Date(min.split("/").reverse().join("-"))
      ? date
      : min
  );

  const latestEnd = endDates.reduce((max, date) =>
    new Date(date.split("/").reverse().join("-")) >
    new Date(max.split("/").reverse().join("-"))
      ? date
      : max
  );

  return calculateMonthsDifference(earliestStart, latestEnd);
}


function setTimelineHeight(timelineSelector) {
  const timeline = document.querySelector(timelineSelector);

  // Warte, bis die Timeline vollständig gerendert ist
  setTimeout(() => {
    const timelineHeight = timeline.offsetHeight;
    timeline.style.setProperty("--timeline-height", `${timelineHeight}px`);
  }, 0);
}

function ensureDefaultValues(event) {
  // Setze education und volunteer auf 0, wenn sie nicht definiert sind
  return {
    ...event,
    education: event.education !== undefined ? event.education : "0",
    volunteer: event.volunteer !== undefined ? event.volunteer : "0",
  };
}

// Reverse Timeline wenn reverseTimeline = 1
if (reverseTimeline === 1) {
  const timelines = document.querySelectorAll(".timeline");
  timelines.forEach((timeline) => {
    timeline.style.flexDirection = "column-reverse";
  });
}

// Entferne ungenutzte Sections
if (separateVolunteer === 0) {
  const volunteerSection = document.getElementById("volunteer-section");
  if (volunteerSection) {
    volunteerSection.style.display = "none";
  }
}
if (separateEducation === 0) {
  const educationSection = document.getElementById("education-section");
  if (educationSection) {
    educationSection.style.display = "none";
  }
}

// Dynamische Erstellung der Events
function createTimeline(events, timelineSelector) {
  const totalMonths = calculateTotalMonths(events);
  const timeline = document.querySelector(timelineSelector);

  events.forEach((event) => {
    const eventElement = document.createElement("div");
    eventElement.classList.add("event");

    // Funktion zur Formatierung des Datums
    function formatDate(date, format) {
      if (!date) {
        throw new Error("Datum darf nicht leer sein");
      }
      const [month, year] = date.split("/");
      if (!month || !year) {
        throw new Error("Datum muss im Format MM/YYYY sein");
      }
      if (format === "short") {
        if (year.length !== 4) {
          throw new Error("Jahr muss vierstellig sein");
        }
        return `${month}/${year.slice(-2)}`; // nur die letzten zwei Ziffern des Jahres (MM/YY)
      }
      return date; // Standardformat (MM/YYYY)
    }

    // Datum hinzufügen
    const dateElement = document.createElement("div");
    dateElement.classList.add("date");
    dateElement.innerHTML = `${formatDate(
      event.start,
      dateFormat
    )}<br>– ${formatDate(event.end, dateFormat)}`;
    eventElement.appendChild(dateElement);

    // Setze das Enddatum auf 'heute', falls 'present' auf 1 gesetzt ist
const endDate = event.present === "1" ? "heute" : formatDate(event.end, dateFormat);
dateElement.innerHTML = `${formatDate(event.start, dateFormat)}<br>– ${endDate}`;
eventElement.appendChild(dateElement);

    // Icon und Titel
    const dotElement = document.createElement("div");
    dotElement.classList.add("dot");
    dotElement.innerHTML = `<span class="material-symbols-outlined">${event.icon}</span>`;
    dotElement.style.backgroundColor = event.color;
    eventElement.appendChild(dotElement);

    const contentElement = document.createElement("div");
    contentElement.classList.add("content");
    contentElement.innerHTML = `<h3>${event.title}</h3>`;

    // Optionale Firmenangabe und Ort
    if (event.company && event.place) {
      contentElement.innerHTML += `<p><span class="event-company";">${event.company}</span>, <span class="event-place">${event.place}</span></p>`;
    } else if (event.company) {
      contentElement.innerHTML += `<p><span class="event-company";">${event.company}</span></p>`;
    } else if (event.place) {
      contentElement.innerHTML += `<p>${event.place}</p>`;
    }

// Optionale Beschreibung
if (event.description && event.description.length > 0) {
  const descriptionHtml = `
  <span class="event-description">
    <ul>
      ${event.description.map(desc => `<li>${desc.replace(/\n/g, "<br>")}</li>`).join('')}
    </ul>
  </span>
  `;
  contentElement.innerHTML += descriptionHtml;
}
eventElement.appendChild(contentElement);

// Optionale Liste
if (event.list && event.list.length > 0) {
  const listHtml = `
  <span class="event-list">
    <ul>
      ${event.list.map(desc => `<li>${desc.replace(/\n/g, "<br>")}</li>`).join('')}
    </ul>
  </span>
  `;
  contentElement.innerHTML += listHtml;
}
eventElement.appendChild(contentElement);


    // Berechne die Dauer des Events in Monaten
    const eventMonths = calculateMonthsDifference(event.start, event.end);
    const monthsRatio = eventMonths / totalMonths;

    // Berechne die Position des Events basierend auf dem Startdatum
    const startMonths = calculateMonthsDifference(events[0].start, event.start);
    const topPosition = (startMonths / totalMonths) * 100;

    // Setze die Custom Properties für das Event
    eventElement.style.setProperty("--color", event.color);
    eventElement.style.setProperty("--months-duration", monthsRatio);
    eventElement.style.setProperty("--offset", `${event.hoffset || 0}px`);
    eventElement.style.top = `${topPosition}%`;
    eventElement.style.marginTop = `${event.voffset || 0}px`;

    timeline.appendChild(eventElement);
  });

  // Setze die Timeline-Höhe nach dem Hinzufügen der Events
  setTimelineHeight(timelineSelector);

  // Berechne und setze die Linienhöhen nach dem Rendern
  setTimeout(() => {
    const eventElements = document.querySelectorAll(
      `${timelineSelector} .event`
    );
    eventElements.forEach((eventElement, index) => {
      const event = events[index];
      const startPosition = eventElement.offsetTop;
      const eventEndPosition = calculateEndPosition(
        event.end,
        events,
        totalMonths,
        timeline.offsetHeight
      );

      // Finde die tatsächliche Endposition, die nicht über das nächste Event hinausgeht
      let adjustedEndPosition = eventEndPosition;

      for (let j = index + 1; j < events.length; j++) {
        const nextEvent = events[j];
        const nextStartPosition = eventElements[j].offsetTop;

        if (calculateMonthsDifference(event.end, nextEvent.start) >= 0) {
          adjustedEndPosition = nextStartPosition; // Beende die Linie am Start des nächsten Events
          break;
        }
      }

      const lineHeight = adjustedEndPosition - startPosition;

      // Zeichne die Linie für die Dauer des Events
      const lineElement = document.createElement("div");
      lineElement.classList.add("line");
      lineElement.style.height = `${lineHeight}px`; // Höhe der Linie basierend auf der Dauer
      eventElement.appendChild(lineElement);

      // Setze die lineHeight auf 0, wenn hideline = "1" ist
      if (event["hideline"] === "1" || noLine === "1") {
        lineElement.style.height = "0"; // Höhe auf 0 setzen
      }
    });
  }, 100);
}

function calculateEndPosition(endDate, events, totalMonths, timelineHeight) {
  const startMonths = calculateMonthsDifference(events[0].start, endDate);
  const endPositionRatio = startMonths / totalMonths;
  return endPositionRatio * timelineHeight;
}

// Anwenden der Funktion auf alle Events, um Standardwerte sicherzustellen
const updatedEvents = events.map(ensureDefaultValues);

// Anpassen der Variablen für die Kopie der Events basierend auf den Optionen
updatedEvents.forEach((event) => {
  // Wenn separate Ausbildung nicht gewünscht ist, setze education auf "0"
  if (!separateEducation && event.education === "1") {
    event.education = "0";
  }

  // Wenn separates Ehrenamt nicht gewünscht ist, setze volunteer auf "0"
  if (!separateVolunteer && event.volunteer === "1") {
    event.volunteer = "0";
  }
});

// Filter Events nach "Ausbildung", "Ehrenamt" und "Berufliche Erfahrung"
const educationEvents = updatedEvents.filter(
  (event) => event.education === "1"
);
const volunteerEvents = updatedEvents.filter(
  (event) => event.volunteer === "1"
);
const experienceEvents = updatedEvents.filter(
  (event) => event.education === "0" && event.volunteer === "0"
);

// Erstelle die drei Timelines
createTimeline(educationEvents, ".timeline-education");
createTimeline(volunteerEvents, ".timeline-volunteer");
createTimeline(experienceEvents, ".timeline-experience");

// Skills
const maxRank = 5; // Maximale Bewertung
const skillsContainer = document.getElementById("skills-container");

skills.forEach((skill) => {
  // Erstelle ein neues <ul>-Element für den Skill
  const skillItem = document.createElement("ul");
  skillItem.classList.add("skills");

  // Berechne das Verhältnis für den Rank
  const ratio = (skill.rank / maxRank) * 100 + "%";

  // Setze den HTML-Inhalt für den Skill und den Rank mit Material Symbols
  /*
  skillItem.innerHTML = `
    <li class="skill-description">${skill.name}</li>
    <li id="rank" style="--ratio: ${ratio};">
      <span class="material-symbols-outlined">stroke_full</span>
      <span class="material-symbols-outlined">stroke_full</span>
      <span class="material-symbols-outlined">stroke_full</span>
      <span class="material-symbols-outlined">stroke_full</span>
      <span class="material-symbols-outlined">stroke_full</span>
    </li>
  `;
*/
  // Hier mit normalen Symbolen statt Material Symbols:
  // Setze den HTML-Inhalt für den Skill und den Rank
  skillItem.innerHTML = `
<li class="skill-description">${skill.name}</li>
<li id="rank" style="--ratio: ${ratio};">●●●●●</li>
`;

  // Füge das <ul>-Element dem Container hinzu
  skillsContainer.appendChild(skillItem);
});
if (!showSkills) {
  const skillsElement = document.querySelector(".resume_item.resmue_skills");
  if (skillsElement) {
    skillsElement.style.display = "none";
  }
}



// Dynamische Zuweisung der Variablen zu den HTML-Elementen
document.querySelectorAll(".document [data-info]").forEach((element) => {
  const infoType = element.getAttribute("data-info");
  if (infoType && contactInfo[infoType]) {
    element.textContent = contactInfo[infoType];
  }
});

const atsDiv = document.getElementById("ats");

// HTML anpassen und Variablen einfügen

// Entferne die ATS-Div, wenn activateATS gleich 0 ist
if (activateATS === 0) {
  // Blende die gesamte ATS-Div aus
  const atsDiv = document.querySelector(
    ".ats"
  );
  atsDiv.style.display = "none"; // Ausblenden
}

//Profiltext
// Funktion zum Generieren der Profil-Ausgabe
function generateProfileOutput(profileText) {
  return profileText; // Gib den Profiltext zurück
}

// Finde das Element mit der Klasse "profile-container"
const profileContainer = document.querySelector(".profile-container");

// Füge den Profiltext in die Container-Div ein, wenn showProfile gleich 1 ist
if (showProfile === 1) {
  profileContainer.innerHTML = generateProfileOutput(profileText);
} else {
  // Blende die gesamte Profil-Sektion aus
  const resumeProfileContainer = document.querySelector(
    ".resume_item.resume_profile"
  );
  resumeProfileContainer.style.display = "none"; // Ausblenden
}

//Profilbild
// Finde das Element mit der Klasse "profile-image-container"
const profileImageContainer = document.querySelector(
  ".profile-image-container"
);

// Füge das Profilbild in die Container-Div ein, wenn showProfileImage gleich 1 ist
if (showProfileImage === 1) {
  profileImageContainer.innerHTML = `<img src="${profileImage}" alt="Profilbild" />`;
} else {
  // Blende die gesamte Profilbild-Sektion aus
  profileImageContainer.style.display = "none"; // Ausblenden
}

// Kontakt
// Funktion zum Generieren der Kontaktdaten
function generateContactOutput(contactInfo) {
  let contactOutput = ""; // Container für die Kontaktdaten

  if (contactInfo.address) {
    contactOutput += `
      <div class="resume_subinfo">
        <i class="material-icons">location_on</i>
        <div class="address-wrapper">
          <div class="contact-info" data-info="address">${
            contactInfo.address
          }</div>
          <div class="contact-info" data-info="city">${
            contactInfo.city ? contactInfo.city : ""
          }</div>
        </div>
      </div>`;
  }

  if (contactInfo.email) {
    contactOutput += `
      <div class="resume_subinfo">
        <i class="material-icons">email</i>
        <div class="contact-info" data-info="email">
          <a href="mailto:${contactInfo.email}">${contactInfo.email}</a>
        </div>
      </div>`;
  }
  
  if (contactInfo.phone) {
    // Telefonnummer formatieren
    const formattedPhone = contactInfo.phone
      .replace(/\s+/g, "") // Leerzeichen entfernen
      .replace(/^0/, "+49"); // führende Null durch +49 ersetzen

    contactOutput += `
      <div class="resume_subinfo">
        <i class="material-icons">phone</i>
        <div class="contact-info" data-info="phone">
          <a href="tel:${formattedPhone}">${contactInfo.phone}</a>
        </div>
      </div>`;
  }

  return contactOutput; // Gib die Kontaktdaten zurück
}

// Finde das Element mit der Klasse "contact_container"
const contactContainer = document.querySelector(".contact_container");

// Füge die Kontaktdaten in die Container-Div ein
contactContainer.innerHTML = generateContactOutput(contactInfo);

// Finde das Element für die header-contact-section
const headerLowerSection = document.querySelector(".header-contact-section");

// Füge die Kontaktdaten in die header-contact-section ein
headerLowerSection.innerHTML = generateContactOutput(contactInfo);

// Sprachen
// Funktion zum Generieren der Sprachliste
function generateLanguageOutput(lang) {
  let languageOutput = ""; // Container für die Sprachlisten

  lang.forEach((language) => {
    languageOutput += `
      <div class="language_list">
        <div class="language_left">${language.name}</div>
        <div class="language_bar">
          <p>
            <span style="width: ${language.percentage}%;">${
      language.level ? language.level : ""
    }</span>
          </p>
        </div>
      </div>`;
  });

  return languageOutput; // Gib die Sprachliste zurück
}

// Finde das Element mit der Klasse "language_container"
const languageContainer = document.querySelector(".language_container");

// Füge die Sprachliste in die Container-Div ein
languageContainer.innerHTML = generateLanguageOutput(lang);

// Mobilität Sidebar
// Funktion zum Generieren der Mobilität-Section in der Sidebar
function generateMobilitySBOutput(mobilitySB) {
  let mobilitySBOutput = ""; // Container für Mobilität in Sidebar

  mobilitySB.forEach((mobilitySB) => {
    mobilitySBOutput += `
      <div class="resume_subinfo">
        ${
          mobilitySB.icon
            ? `<span class="material-symbols-outlined">${mobilitySB.icon}</span>`
            : ""
        }
        ${mobilitySB.name}
      </div>`;
  });

  return mobilitySBOutput; // Gib die Interessenliste zurück
}

// Interessen
// Funktion zum Generieren der Interessen
function generateInterestsOutput(interests) {
  let interestsOutput = ""; // Container für die Interessen

  interests.forEach((interest) => {
    interestsOutput += `
      <div class="resume_subinfo">
        ${
          interest.icon
            ? `<span class="material-symbols-outlined">${interest.icon}</span>`
            : ""
        }
        ${interest.name}
      </div>`;
  });

  return interestsOutput; // Gib die Interessenliste zurück
}



// Finde das Element mit der Klasse "mobilitySB_container"
const mobilitySBContainer = document.querySelector(".mobilitySB_container");

// Füge die Interessenliste in die Container-Div ein
mobilitySBContainer.innerHTML = generateMobilitySBOutput(mobilitySB);

// Steuere die Sichtbarkeit des Containers
const resumeMobilitySBContainer = document.querySelector(
  ".resume_item.resume_mobilitySB"
);
if (showMobilitySB === 0) {
  resumeMobilitySBContainer.style.display = "none"; // Ausblenden
}

// Steuere die Sichtbarkeit des Language-Containers
const resumeLanguageContainer = document.querySelector(
  ".resume_item.resume_language"
);
if (showLanguages === 0) {
  resumeLanguageContainer.style.display = "none"; // Ausblenden
}
// Finde das Element mit der Klasse "interests_container"
const interestsContainer = document.querySelector(".interests_container");

// Füge die Interessenliste in die Container-Div ein
interestsContainer.innerHTML = generateInterestsOutput(interests);

// Steuere die Sichtbarkeit des Containers
const resumeInterestsContainer = document.querySelector(
  ".resume_item.resume_interests"
);
if (showInterests === 0) {
  resumeInterestsContainer.style.display = "none"; // Ausblenden
}

// Funktion zum Generieren der Projekte
function generateProjectsOutput(projects) {
  let projectsOutput = ""; // Container für die Projekte

  projects.forEach((project) => {
    projectsOutput += `
      <div class="resume_info project">
        <div class="project-img-holder">
          <a href="${project.url}">
            <img src="${project.img}" alt="${project.name}" />
          </a>
        </div>
        <div class="project-txt">
          <a href="${project.url}">
            <h3 class="project-title">${project.name}</h3>
          </a>
          <span>${project.description}</span>
        </div>
      </div>`;
  });

  return projectsOutput; // Gib die Projekte zurück
}

// Finde das Element mit der Klasse "projects_container"
const projectsContainer = document.querySelector(".projects_container");

// Füge die Projekte in die Container-Div ein, wenn showProjects gleich 1 ist
if (showProjects === 1) {
  projectsContainer.innerHTML = generateProjectsOutput(projects);
} else {
  // Blende die gesamte Projekte-Sektion aus
  const resumeProjectsContainer = document.querySelector(
    ".resume_item.resume_projects"
  );
  resumeProjectsContainer.style.display = "none"; // Ausblenden
}

// Für Textausrichtung des Anschreibens
const textBlocks = document.querySelectorAll(".textblock");
// Funktion zum Setzen der Textausrichtung
const setAlignment = (alignText) => {
  textBlocks.forEach((block) => {
    block.style.textAlign = alignText;
  });
};
// Textausrichtung anwenden
setAlignment(alignText);



// ATS --------------------------------------------------------- HTML Struktur erstellen für ATS
let htmlOutput = "";

// Ausbildung
htmlOutput += "<h2>Ausbildung:</h2><ul>";
events.forEach((event) => {
  if (event.education === "1") {
    const company = event.company ? ` bei ${event.company}` : "";
    const place = event.place ? `, ${event.place}` : "";
    htmlOutput += `<li><strong>${event.title}${company}${place}</strong>, ${event.start} – ${event.end}`;
    if (event.description) {
      htmlOutput += `<br>${event.description}`;
    }
    if (event.list) {
      htmlOutput += `<br>${event.list}`;
    }
    htmlOutput += "</li><p></p>";
  }
});
htmlOutput += "</ul>";

// Berufliche Erfahrung
htmlOutput += "<h2>Berufliche Erfahrung:</h2><ul>";
events.forEach((event) => {
  if (!event.education && !event.volunteer) {
    const company = event.company ? ` bei ${event.company}` : "";
    const place = event.place ? `, ${event.place}` : "";
    htmlOutput += `<li><strong>${event.title}${company}${place}</strong>, ${event.start} – ${event.end}`;
    if (event.description) {
      htmlOutput += `<br>${event.description}`;
    }
    if (event.list) {
      htmlOutput += `<br>${event.list}`;
    }
    htmlOutput += "</li><p></p>";
  }
});
htmlOutput += "</ul>";

// Ehrenamtliche Erfahrung
htmlOutput += "<h2>Ehrenamtliche Erfahrung:</h2><ul>";
events.forEach((event) => {
  if (event.volunteer === "1") {
    const company = event.company ? ` bei ${event.company}` : "";
    const place = event.place ? `, ${event.place}` : "";
    htmlOutput += `<li><strong>${event.title}${company}${place}</strong>, ${event.start} – ${event.end}`;
    if (event.description) {
      htmlOutput += `<br>${event.description}`;
    }
    if (event.list) {
      htmlOutput += `<br>${event.list}`;
    }
    htmlOutput += "</li><p></p>";
  }
});
htmlOutput += "</ul>";

// Fähigkeiten, Kenntnisse, Skills
htmlOutput += "<h2>Fähigkeiten:</h2><ul>";
skills.forEach((skill) => {
  const ratio = (skill.rank / maxRank) * 100;
  htmlOutput += `<li>${skill.name}: ${ratio.toFixed(0)}%</li>`;
});
htmlOutput += "</ul>";

// Mobilität
// Funktion zum Generieren der Mobilitäts-Ausgabe
function generateMobilityOutput(mobility) {
  let mobilityOutput = ""; // Container für die Mobilitätsinformationen

  mobility.forEach((item) => {
    mobilityOutput += `
      <div class="resume_subinfo">
        ${item.name}
      </div>`;
  });

  return mobilityOutput; // Gib die Mobilitätsinformationen zurück
}

// Verstecke die Mobilität-Sektion wenn showMobility === 0 ist
const resumeMobilityContainer = document.querySelector(
  ".resume_item.resmue_mobility"
);
if (showMobility === 0) {
  resumeMobilityContainer.style.display = "none"; // Ausblenden
}


// Sprachen
htmlOutput += "<h2>Sprachen:</h2><ul>";
lang.forEach((language) => {
  htmlOutput += `<li>${language.name}: ${language.percentage}%${
    language.level ? ` (${language.level})` : ""
  }</li>`;
});
htmlOutput += "</ul>";

// Kontaktinformationen
htmlOutput += "<h2>Kontaktinformationen:</h2><ul>";
htmlOutput += `<li>Name: ${contactInfo.name}</li>`;
htmlOutput += `<li>Rolle: ${contactInfo.role}</li>`;
htmlOutput += `<li>Adresse: ${contactInfo.address}, ${contactInfo.city}</li>`;
htmlOutput += `<li>Email: ${contactInfo.email}</li>`;
htmlOutput += `<li>Telefon: ${contactInfo.phone}</li>`;
htmlOutput += "</ul>";

// Interessen
htmlOutput += "<h2>Interessen:</h2><ul>";
interests.forEach((interest) => {
  htmlOutput += `<li>${interest.name}</li>`;
});
htmlOutput += "</ul>";

// Mobilität
htmlOutput += "<h2>Mobilität:</h2><ul>";
mobility.forEach((mob) => {
  htmlOutput += `<li>${mob.name}</li>`;
});
htmlOutput += "</ul>";

// Referenzen
htmlOutput += "<h2>Referenzen:</h2><ul>";
references.forEach((ref) => {
  htmlOutput += `<li>${ref.name}</li>`;
});
htmlOutput += "</ul>";

// Ausgabe in das div-Element
atsDiv.innerHTML = htmlOutput;


