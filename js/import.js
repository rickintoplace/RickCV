/*  import.js – Fremde Lebenslauf-Daten hereinholen und wieder herausgeben.
 *
 *  Der Kerngedanke: jedes Format wird zuerst auf eine neutrale Zwischenform
 *  gebracht (siehe `emptyProfile`), und erst die uebersetzt in das
 *  RickCV-Modell. So braucht ein neues Format nur einen kleinen Adapter und
 *  nicht nochmal das halbe Datenmodell.
 *
 *  Unterstuetzt werden:
 *    rickcv     – eigene Sicherung (.rickcv.json), wird direkt migriert
 *    jsonresume – der offene Standard resume.json, in beide Richtungen
 *    linkedin   – das ZIP aus "Download your data", oder einzelne CSV-Dateien
 *    text       – eingefuegter Text (auch das, was aus einem PDF faellt)
 *
 *  Nichts davon verlaesst das Geraet: alles laeuft im Browser.
 */
(function (global) {
  "use strict";

  var Model = global.RickCVModel;
  var I18n = global.RickCVI18n;

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clean(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* ------------------------------------------------------------- Datumsformat */

  //  RickCV schreibt Zeitraeume als freien Text, ueblich ist "MM/JJJJ".
  //  Hereinkommen koennen ISO-Daten (2019-07-01), Monatsnamen (Jul 2019)
  //  oder nur ein Jahr. Alles landet auf "MM/JJJJ" bzw. "JJJJ".
  var MONTHS = {
    jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2,
    "mär": 3, maer: 3, mrz: 3, mar: 3, march: 3, "märz": 3,
    apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7, aug: 8, august: 8,
    sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
    nov: 11, november: 11, dez: 12, dec: 12, dezember: 12, december: 12,
  };

  var PRESENT = /^(present|current|now|heute|aktuell|ongoing|bis heute|till now)$/i;

  function pad(number) {
    return (number < 10 ? "0" : "") + number;
  }

  function normDate(value) {
    var raw = clean(value);
    if (!raw || PRESENT.test(raw)) return "";

    var iso = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
    if (iso) return pad(Number(iso[2])) + "/" + iso[1];

    //  Vorlagen aus dem Netz schreiben "20XX", wo spaeter ein Jahr stehen
    //  soll. Das ist kein Datum, aber es ist auch kein Versehen: wer eine
    //  halb ausgefuellte Vorlage importiert, soll seine Stationen
    //  wiederfinden und die Jahre nachtragen koennen, statt den ganzen
    //  Werdegang von Hand einzugeben.
    var blank = raw.match(/^((?:19|20)[Xx]{2})$/);
    if (blank) return blank[1].toUpperCase();

    var blankMonth = raw.match(/^(\d{1,2})[./]((?:19|20)[Xx]{2})$/);
    if (blankMonth) return pad(Number(blankMonth[1])) + "/" + blankMonth[2].toUpperCase();

    //  "01/09/2024" – Tag, Monat, Jahr. Steht vorn etwas ueber zwoelf, ist
    //  es der Tag; steht hinten etwas ueber zwoelf, war es amerikanisch
    //  geschrieben und der Monat kam zuerst.
    var full = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (full) {
      var first = Number(full[1]);
      var second = Number(full[2]);
      return pad(second > 12 ? first : second) + "/" + full[3];
    }

    var slash = raw.match(/^(\d{1,2})[./](\d{4})$/);
    if (slash) return pad(Number(slash[1])) + "/" + slash[2];

    //  "11/13" heisst November 2013. Zweistellige Jahre unter 50 liegen im
    //  neuen Jahrhundert – ein Lebenslauf reicht nicht 80 Jahre zurueck.
    var short = raw.match(/^(\d{1,2})[./](\d{2})$/);
    if (short) {
      var year = Number(short[2]);
      return pad(Number(short[1])) + "/" + (year < 50 ? 2000 + year : 1900 + year);
    }

    var german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (german) return pad(Number(german[2])) + "/" + german[3];

    var named = raw.match(/^([A-Za-zÄÖÜäöü]+)\.?\s+(\d{4}|(?:19|20)[Xx]{2})$/);
    if (named) {
      var month = MONTHS[named[1].toLowerCase()];
      if (month) return pad(month) + "/" + named[2];
      return named[2];
    }

    var year = raw.match(/^(\d{4})$/);
    if (year) return year[1];

    return raw; // unbekannt – lieber unveraendert stehen lassen als verlieren
  }

  function isPresent(value) {
    var raw = clean(value);
    return raw === "" || PRESENT.test(raw);
  }

  /* --------------------------------------------------------- Zwischenform */

  //  Alles, was ein Adapter liefern kann. Leere Felder bleiben leer und
  //  werden beim Einspielen einfach uebersprungen.
  function emptyProfile() {
    return {
      contact: { name: "", role: "", address: "", city: "", email: "", phone: "" },
      profileText: "",
      events: [],      // { title, company, place, start, end, present, description[], list[], role }
      skills: [],      // { name, rank }
      languages: [],   // { name, level, percentage }
      interests: [],   // { name }
      projects: [],    // { name, url, description }
      references: [],  // { name, role, company, contact }
      links: [],       // { label, text, url }
      mobility: [],    // { name } – Führerschein und Ähnliches
      photo: "",       // Bewerbungsfoto als Datenadresse
      signature: "",   // Unterschrift aus dem Anschreiben
      letter: null,    // das Anschreiben selbst, falls eines dabei war
      images: 0,       // wieviele Bilder insgesamt gefunden wurden
      warnings: [],
    };
  }

  function newEvent(role) {
    return {
      title: "", company: "", place: "", start: "", end: "", present: false,
      description: [], list: [], role: role || "experience",
    };
  }

  function hasContent(profile) {
    return !!(
      clean(profile.contact.name) || clean(profile.contact.email) || profile.events.length ||
      profile.skills.length || profile.languages.length || profile.projects.length ||
      clean(profile.profileText)
    );
  }

  /* ------------------------------------------------------ JSON Resume: rein */

  //  https://jsonresume.org/schema – die Feldnamen stehen bewusst
  //  ausgeschrieben da, damit man den Abgleich nachlesen kann.
  function fromJsonResume(source) {
    var profile = emptyProfile();
    var basics = source.basics || {};
    var location = basics.location || {};

    profile.contact.name = clean(basics.name);
    profile.contact.role = clean(basics.label);
    profile.contact.email = clean(basics.email);
    profile.contact.phone = clean(basics.phone);
    profile.contact.address = clean(location.address);
    profile.contact.city = [clean(location.postalCode), clean(location.city)]
      .filter(Boolean).join(" ");
    profile.profileText = clean(basics.summary);

    if (clean(basics.url)) {
      profile.links.push({ label: "Website", text: shortUrl(basics.url), url: clean(basics.url) });
    }
    (basics.profiles || []).forEach(function (entry) {
      if (!clean(entry.url) && !clean(entry.username)) return;
      profile.links.push({
        label: clean(entry.network) || "Profil",
        text: clean(entry.username) || shortUrl(entry.url),
        url: clean(entry.url),
      });
    });

    function station(role, entry, title, company) {
      var event = newEvent(role);
      event.title = clean(title);
      event.company = clean(company);
      event.place = clean(entry.location);
      event.start = normDate(entry.startDate);
      event.end = normDate(entry.endDate);
      event.present = !!clean(entry.startDate) && isPresent(entry.endDate);
      if (clean(entry.summary)) event.description.push(clean(entry.summary));
      (entry.highlights || []).forEach(function (line) {
        if (clean(line)) event.list.push(clean(line));
      });
      return event;
    }

    (source.work || []).forEach(function (entry) {
      profile.events.push(station("experience", entry, entry.position,
        entry.name || entry.company || entry.organization));
    });

    (source.volunteer || []).forEach(function (entry) {
      profile.events.push(station("volunteer", entry, entry.position, entry.organization));
    });

    (source.education || []).forEach(function (entry) {
      var title = [clean(entry.studyType), clean(entry.area)].filter(Boolean).join(", ");
      var event = station("education", entry, title || clean(entry.institution), entry.institution);
      if (clean(entry.score)) event.list.push(clean(entry.score));
      (entry.courses || []).forEach(function (course) {
        if (clean(course)) event.list.push(clean(course));
      });
      profile.events.push(event);
    });

    //  Auszeichnungen, Zertifikate und Veroeffentlichungen haben in RickCV
    //  keinen eigenen Block – sie werden zu Stationen mit der Bedeutung
    //  "weitere", statt sie stillschweigend wegzuwerfen.
    (source.awards || []).forEach(function (entry) {
      var event = newEvent("other");
      event.title = clean(entry.title);
      event.company = clean(entry.awarder);
      event.start = normDate(entry.date);
      if (clean(entry.summary)) event.description.push(clean(entry.summary));
      profile.events.push(event);
    });

    (source.certificates || []).forEach(function (entry) {
      var event = newEvent("other");
      event.title = clean(entry.name);
      event.company = clean(entry.issuer);
      event.start = normDate(entry.date);
      profile.events.push(event);
    });

    (source.publications || []).forEach(function (entry) {
      var event = newEvent("other");
      event.title = clean(entry.name);
      event.company = clean(entry.publisher);
      event.start = normDate(entry.releaseDate);
      if (clean(entry.summary)) event.description.push(clean(entry.summary));
      profile.events.push(event);
    });

    (source.skills || []).forEach(function (entry) {
      if (!clean(entry.name)) return;
      profile.skills.push({ name: clean(entry.name), rank: levelToRank(entry.level) });
      (entry.keywords || []).forEach(function (keyword) {
        if (clean(keyword)) profile.skills.push({ name: clean(keyword), rank: 0 });
      });
    });

    (source.languages || []).forEach(function (entry) {
      var name = clean(entry.language);
      if (!name) return;
      profile.languages.push({
        name: name,
        level: clean(entry.fluency),
        percentage: fluencyToPercent(entry.fluency),
      });
    });

    (source.interests || []).forEach(function (entry) {
      if (clean(entry.name)) profile.interests.push({ name: clean(entry.name) });
    });

    (source.projects || []).forEach(function (entry) {
      if (!clean(entry.name)) return;
      profile.projects.push({
        name: clean(entry.name),
        url: clean(entry.url),
        description: clean(entry.description) ||
          (entry.highlights || []).map(clean).filter(Boolean).join(" "),
      });
    });

    (source.references || []).forEach(function (entry) {
      if (!clean(entry.name) && !clean(entry.reference)) return;
      profile.references.push({
        name: clean(entry.name), role: "", company: "", contact: clean(entry.reference),
      });
    });

    return profile;
  }

  function shortUrl(value) {
    return clean(value).replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  //  JSON Resume kennt fuenf Stufen als Text, RickCV Punkte von 0 bis 5.
  //  Was nicht in der Liste steht, bleibt bei 0 – geraten wird nicht.
  var LEVEL_RANK = {
    beginner: 1, novice: 1, elementary: 1, anfänger: 1,
    intermediate: 3, mittel: 3, fortgeschritten: 3, advanced: 4,
    proficient: 4, erfahren: 4, expert: 5, experte: 5, master: 5, native: 5,
  };

  function levelToRank(value) {
    return LEVEL_RANK[clean(value).toLowerCase()] || 0;
  }

  var FLUENCY = {
    "a1": 20, "a2": 35, "b1": 55, "b2": 70, "c1": 85, "c2": 95,
    "native speaker": 100, "native": 100, "muttersprache": 100,
    "fließend": 90, "fliessend": 90, "fluent": 90,
    "verhandlungssicher": 90, "professional working proficiency": 75,
    "full professional proficiency": 90, "limited working proficiency": 55,
    "elementary proficiency": 30, "grundkenntnisse": 30, "basic": 30,
  };

  function fluencyToPercent(value) {
    var key = clean(value).toLowerCase();
    if (FLUENCY[key]) return FLUENCY[key];
    var cefr = key.match(/\b([abc][12])\b/);
    return cefr ? FLUENCY[cefr[1]] : 0;
  }

  /* ------------------------------------------------- Reactive Resume: rein */

  //  Reactive Resume ist der groesste freie Mitbewerber, und wer von dort
  //  kommt, soll nicht abtippen. Sein Format ist verwandt mit JSON Resume,
  //  aber eigenstaendig: Zeitraeume stehen als freier Text ("March 2022 -
  //  Present"), Beschreibungen als HTML, und Kenntnisse tragen eine Stufe
  //  von 0 bis 5 – die uebernimmt RickCV eins zu eins.
  //
  //  Gelesen werden beide Fassungen: v4 nannte die Felder date, institution
  //  und summary, die heutige period, school und description.
  function htmlText(html) {
    return decodeXml(String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, ""))
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function decodeXml(value) {
    return String(value)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, function (match, code) {
        return String.fromCharCode(Number(code));
      })
      .replace(/&amp;/g, "&");
  }

  //  Eine Beschreibung aus Reactive Resume ist HTML: Absaetze werden zu
  //  Absaetzen, Listenpunkte zu Listenpunkten.
  function htmlBlocks(html) {
    var source = String(html || "");
    var list = [];

    source.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function (match, inner) {
      var text = htmlText(inner);
      if (text) list.push(text);
      return "";
    });

    var rest = source.replace(/<[ou]l[^>]*>[\s\S]*?<\/[ou]l>/gi, "");
    var description = htmlText(rest).split("\n").map(clean).filter(Boolean);

    return { description: description, list: list };
  }

  //  "March 2022 - Present", "2014 - 2018", "05/2021 - heute"
  function splitPeriod(period) {
    var value = clean(period);
    if (!value) return { start: "", end: "", present: false };

    var range = value.match(RANGE);
    if (range) {
      return {
        start: normDate(range[1]),
        end: isPresent(range[2]) ? "" : normDate(range[2]),
        present: isPresent(range[2]),
      };
    }
    return { start: normDate(value), end: "", present: false };
  }

  function visible(entry) {
    return entry && entry.hidden !== true;
  }

  function itemsOf(sections, name) {
    var block = sections && sections[name];
    if (!block || block.hidden === true || !Array.isArray(block.items)) return [];
    return block.items.filter(visible);
  }

  function fromReactiveResume(source) {
    var profile = emptyProfile();
    var basics = source.basics || {};
    var sections = source.sections || {};

    profile.contact.name = clean(basics.name);
    profile.contact.role = clean(basics.headline || basics.label);
    profile.contact.email = clean(basics.email);
    profile.contact.phone = clean(basics.phone);
    profile.contact.city = clean(basics.location);

    var picture = source.picture || basics.picture || {};
    if (clean(picture.url) && picture.hidden !== true) profile.photo = clean(picture.url);

    var summary = source.summary || sections.summary || {};
    if (summary.hidden !== true) profile.profileText = htmlText(summary.content);

    //  Webseite, eigene Felder und Profile werden zur Linkleiste.
    var website = basics.website || {};
    if (clean(website.url)) {
      profile.links.push({
        label: clean(website.label) || "Website",
        text: clean(website.label) || shortUrl(website.url),
        url: clean(website.url),
      });
    }
    (basics.customFields || []).forEach(function (field) {
      if (!clean(field.link)) return;
      profile.links.push({
        label: clean(field.icon).replace(/-logo$/, "") || clean(field.text),
        text: clean(field.text) || shortUrl(field.link),
        url: clean(field.link),
      });
    });
    itemsOf(sections, "profiles").forEach(function (entry) {
      if (!clean(entry.url && entry.url.href ? entry.url.href : entry.url)) return;
      var url = entry.url && entry.url.href ? entry.url.href : entry.url;
      profile.links.push({
        label: clean(entry.network),
        text: clean(entry.username) || shortUrl(url),
        url: clean(url),
      });
    });

    function station(role, entry, title, company) {
      var event = newEvent(role);
      var period = splitPeriod(entry.period || entry.date);
      var text = htmlBlocks(entry.description || entry.summary);

      event.title = clean(title);
      event.company = clean(company);
      event.place = clean(entry.location);
      event.start = period.start;
      event.end = period.end;
      event.present = period.present;
      event.description = text.description;
      event.list = text.list;
      return event;
    }

    itemsOf(sections, "experience").forEach(function (entry) {
      profile.events.push(station("experience", entry, entry.position, entry.company));
    });

    itemsOf(sections, "education").forEach(function (entry) {
      var title = [clean(entry.degree || entry.studyType), clean(entry.area)]
        .filter(Boolean).join(", ");
      var event = station("education", entry, title, entry.school || entry.institution);
      var grade = clean(entry.grade || entry.score);
      if (grade) event.list.push(grade);
      profile.events.push(event);
    });

    itemsOf(sections, "volunteer").forEach(function (entry) {
      profile.events.push(station("volunteer", entry,
        entry.position || entry.organization, entry.position ? entry.organization : ""));
    });

    ["awards", "certifications", "publications"].forEach(function (name) {
      itemsOf(sections, name).forEach(function (entry) {
        profile.events.push(station("other", entry,
          entry.title || entry.name, entry.awarder || entry.issuer || entry.publisher));
      });
    });

    itemsOf(sections, "skills").forEach(function (entry) {
      if (!clean(entry.name)) return;
      //  Reactive Resume zaehlt 0 bis 5 – dieselbe Skala wie RickCV.
      profile.skills.push({
        name: clean(entry.name),
        rank: Math.max(0, Math.min(5, Number(entry.level) || levelToRank(entry.proficiency))),
      });
      (entry.keywords || []).forEach(function (keyword) {
        if (clean(keyword)) profile.skills.push({ name: clean(keyword), rank: 0 });
      });
    });

    itemsOf(sections, "languages").forEach(function (entry) {
      var name = clean(entry.language || entry.name);
      if (!name) return;
      var fluency = clean(entry.fluency || entry.description);
      profile.languages.push({
        name: name,
        level: fluency,
        percentage: Number(entry.level) ? Number(entry.level) * 20 : fluencyToPercent(fluency),
      });
    });

    itemsOf(sections, "interests").forEach(function (entry) {
      if (clean(entry.name)) profile.interests.push({ name: clean(entry.name) });
    });

    itemsOf(sections, "projects").forEach(function (entry) {
      if (!clean(entry.name)) return;
      var text = htmlBlocks(entry.description || entry.summary);
      profile.projects.push({
        name: clean(entry.name),
        url: clean(entry.url && entry.url.href ? entry.url.href : entry.url),
        description: text.description.join(" ") || text.list.join(", "),
      });
    });

    itemsOf(sections, "references").forEach(function (entry) {
      if (!clean(entry.name)) return;
      profile.references.push({
        name: clean(entry.name),
        role: clean(entry.position),
        company: "",
        contact: clean(entry.phone) || htmlText(entry.description),
      });
    });

    return profile;
  }

  /* ----------------------------------------------------- JSON Resume: raus */

  function isoDate(value) {
    var raw = clean(value);
    var slash = raw.match(/^(\d{1,2})\/(\d{4})$/);
    if (slash) return slash[2] + "-" + pad(Number(slash[1]));
    var year = raw.match(/^(\d{4})$/);
    if (year) return year[1];
    return raw ? raw : undefined;
  }

  function drop(object) {
    Object.keys(object).forEach(function (key) {
      var value = object[key];
      if (value === undefined || value === "" ||
          (Array.isArray(value) && !value.length)) {
        delete object[key];
      }
    });
    return object;
  }

  function roleOf(state, event) {
    var found = (state.sections || []).filter(function (section) {
      return section.id === event.sectionId;
    })[0];
    return (found && found.atsRole) || "experience";
  }

  function toJsonResume(state) {
    //  Die Link-Leisten am Blattfuss sind das, was einem Profil am naechsten
    //  kommt: Text plus Ziel. Sie werden zuerst gesammelt, weil `drop` eine
    //  leere Liste sonst gleich wieder entfernen wuerde.
    var profiles = [];
    ["left", "right"].forEach(function (side) {
      var footer = state.footers && state.footers[side];
      if (!footer || !footer.show) return;
      (footer.links || []).forEach(function (link) {
        if (!clean(link.url)) return;
        profiles.push(drop({
          network: clean(link.label) || clean(link.text),
          username: clean(link.text),
          url: clean(link.url),
        }));
      });
    });

    var resume = {
      $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
      basics: drop({
        name: clean(state.contact.name),
        label: clean(state.contact.role),
        email: clean(state.contact.email),
        phone: clean(state.contact.phone),
        summary: state.profile && state.profile.show ? clean(state.profile.text) : "",
        location: drop({
          address: clean(state.contact.address),
          postalCode: (clean(state.contact.city).match(/^\d{4,5}/) || [""])[0],
          city: clean(state.contact.city).replace(/^\d{4,5}\s*/, ""),
        }),
        profiles: profiles,
      }),
      work: [], volunteer: [], education: [], awards: [],
      skills: [], languages: [], interests: [], projects: [], references: [],
    };

    (state.events || []).forEach(function (event) {
      var role = roleOf(state, event);
      var entry = drop({
        startDate: isoDate(event.start),
        endDate: event.present ? undefined : isoDate(event.end),
        location: clean(event.place),
        summary: (event.description || []).map(clean).filter(Boolean).join("\n"),
        highlights: (event.list || []).map(clean).filter(Boolean),
      });

      if (role === "education") {
        resume.education.push(drop(Object.assign(entry, {
          institution: clean(event.company),
          studyType: clean(event.title),
          area: "",
        })));
      } else if (role === "volunteer") {
        resume.volunteer.push(drop(Object.assign(entry, {
          organization: clean(event.company),
          position: clean(event.title),
        })));
      } else if (role === "other") {
        resume.awards.push(drop({
          title: clean(event.title),
          awarder: clean(event.company),
          date: isoDate(event.start),
          summary: entry.summary,
        }));
      } else {
        resume.work.push(drop(Object.assign(entry, {
          name: clean(event.company),
          position: clean(event.title),
        })));
      }
    });

    var RANK_LEVEL = ["", "Beginner", "Beginner", "Intermediate", "Advanced", "Expert"];
    if (state.skills && state.skills.show) {
      (state.skills.items || []).forEach(function (item) {
        if (!clean(item.name)) return;
        resume.skills.push(drop({
          name: clean(item.name),
          level: RANK_LEVEL[Math.round(Number(item.rank) || 0)] || "",
        }));
      });
    }

    if (state.languages && state.languages.show) {
      (state.languages.items || []).forEach(function (item) {
        if (!clean(item.name)) return;
        resume.languages.push(drop({
          language: clean(item.name),
          fluency: clean(item.level),
        }));
      });
    }

    if (state.interests && state.interests.show) {
      (state.interests.items || []).forEach(function (item) {
        if (clean(item.name)) resume.interests.push({ name: clean(item.name) });
      });
    }

    if (state.projects && state.projects.show) {
      (state.projects.items || []).forEach(function (item) {
        if (!clean(item.name)) return;
        resume.projects.push(drop({
          name: clean(item.name),
          description: clean(item.description),
          url: clean(item.url),
        }));
      });
    }

    if (state.references && state.references.show) {
      (state.references.items || []).forEach(function (item) {
        if (!clean(item.name)) return;
        resume.references.push(drop({
          name: clean(item.name),
          reference: [clean(item.role), clean(item.company), clean(item.contact)]
            .filter(Boolean).join(", "),
        }));
      });
    }

    return drop(resume);
  }

  /* -------------------------------------------------- RickCV <-> Zwischenform */

  //  Damit sich auch zwei eigene Staende zusammenfuehren lassen.
  function stateToProfile(state) {
    var profile = emptyProfile();
    profile.contact = copy(state.contact || {});
    profile.profileText = clean(state.profile && state.profile.text);

    (state.events || []).forEach(function (event) {
      profile.events.push({
        title: clean(event.title), company: clean(event.company), place: clean(event.place),
        start: clean(event.start), end: clean(event.end), present: !!event.present,
        description: (event.description || []).slice(),
        list: (event.list || []).slice(),
        role: roleOf(state, event),
      });
    });

    ["skills", "languages", "interests", "projects", "references"].forEach(function (key) {
      var block = state[key];
      if (block && Array.isArray(block.items)) profile[key] = copy(block.items);
    });

    var letter = state.coverLetter;
    var paragraphs = letter && Array.isArray(letter.paragraphs)
      ? letter.paragraphs.map(clean).filter(Boolean) : [];
    if (paragraphs.length) {
      profile.letter = {
        recipient: clean(letter.recipient), subject: clean(letter.subject),
        salutation: clean(letter.salutation), paragraphs: paragraphs,
        closing: clean(letter.closing),
      };
    }

    return profile;
  }

  /* --------------------------------------------------------------- CSV */

  //  Kleiner Leser nach RFC 4180: Anfuehrungszeichen, verdoppelte
  //  Anfuehrungszeichen und Zeilenumbrueche im Feld.
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var quoted = false;
    var input = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");

    for (var i = 0; i < input.length; i++) {
      var ch = input[i];
      if (quoted) {
        if (ch === '"') {
          if (input[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n") {
        row.push(field); field = "";
        if (row.some(function (value) { return clean(value); })) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(function (value) { return clean(value); })) rows.push(row);

    if (!rows.length) return [];
    var head = rows.shift().map(function (name) { return clean(name); });
    return rows.map(function (values) {
      var entry = {};
      head.forEach(function (name, index) { entry[name] = clean(values[index]); });
      return entry;
    });
  }

  /* ---------------------------------------------------------------- ZIP */

  //  Der Zwischenspeicher von LinkedIn ist ein ganz gewoehnliches ZIP mit
  //  CSV-Dateien darin. Entpackt wird mit DecompressionStream, das jeder
  //  aktuelle Browser mitbringt – kein Fremdcode noetig.
  //  Ein einzelner deflate-Block. Was vor einem Fehler herauskam, wird
  //  behalten: am Ende des Blocks folgt im ZIP der naechste Kopf, und
  //  daran verschluckt sich der Strom sonst mitsamt dem Ergebnis.
  //
  //  limit: hoechstens so viele Bytes. Gepackt schrumpft Gleichfoermiges
  //  auf einen Bruchteil – ein Link von zwei Megabyte kann zu mehr als einem
  //  Gigabyte aufgehen und den Tab mitreissen, bevor irgendein Dialog
  //  erscheint. Ein Lebenslauf braucht davon nichts. Das Budget darf auch
  //  ein Objekt { left } sein, das sich mehrere Dateien eines ZIP teilen.
  var INFLATE_LIMIT = 64 * 1024 * 1024;

  function inflateRaw(chunk, limit) {
    if (typeof global.DecompressionStream !== "function") {
      return Promise.reject(new Error("noDecompression"));
    }
    var budget = limit && typeof limit === "object" ? limit
      : { left: limit || INFLATE_LIMIT };
    var reader = new Blob([chunk]).stream()
      .pipeThrough(new global.DecompressionStream("deflate-raw"))
      .getReader();
    var parts = [];
    var tooLarge = false;

    function pump() {
      return reader.read().then(function (step) {
        if (step.done) return;
        budget.left -= step.value.length;
        if (budget.left < 0) {
          tooLarge = true;
          reader.cancel().catch(function () {});
          return;
        }
        parts.push(step.value);
        return pump();
      }, function () { /* Rest ist nicht mehr unser Block */ });
    }

    return pump().then(function () {
      if (tooLarge) throw new Error("tooLarge");
      var total = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
      var out = new Uint8Array(total);
      var at = 0;
      parts.forEach(function (part) { out.set(part, at); at += part.length; });
      return out;
    });
  }

  function decodeText(bytes) {
    return bytes ? new TextDecoder().decode(bytes) : "";
  }

  var ZIP_LIMIT = 256 * 1024 * 1024;
  var ZIP_MAX_ENTRIES = 20000;

  function readZip(buffer) {
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);

    //  Das Ende-Verzeichnis steht hinten und darf einen Kommentar hinter
    //  sich haben, deshalb rueckwaerts suchen.
    var end = -1;
    for (var i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) return Promise.reject(new Error("kein ZIP"));

    var count = view.getUint16(end + 10, true);
    var offset = view.getUint32(end + 16, true);
    var entries = [];

    //  Alle Dateien eines ZIP teilen sich ein Budget. Ein Word-Dokument
    //  oder ein LinkedIn-Export bleibt weit darunter; eine Datei, die
    //  darueber aufgeht, ist keine, die man als Lebenslauf lesen will.
    if (count > ZIP_MAX_ENTRIES) return Promise.reject(new Error("tooLarge"));
    var budget = { left: ZIP_LIMIT };

    for (var n = 0; n < count; n++) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      var method = view.getUint16(offset + 10, true);
      //  Der lokale Kopf darf die Groessen offenlassen (dann stehen sie
      //  hinter den Daten), das Zentralverzeichnis nie – also von hier.
      var packed = view.getUint32(offset + 20, true);
      var size = view.getUint32(offset + 24, true);
      var nameLength = view.getUint16(offset + 28, true);
      var extraLength = view.getUint16(offset + 30, true);
      var commentLength = view.getUint16(offset + 32, true);
      var local = view.getUint32(offset + 42, true);
      var name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
      entries.push({ name: name, method: method, packed: packed, size: size, local: local });
      offset += 46 + nameLength + extraLength + commentLength;
    }

    return Promise.all(entries.map(function (entry) {
      var head = entry.local;
      if (view.getUint32(head, true) !== 0x04034b50) return null;
      var start = head + 30 + view.getUint16(head + 26, true) + view.getUint16(head + 28, true);

      if (entry.method === 0) {
        budget.left -= entry.size;
        if (budget.left < 0) throw new Error("tooLarge");
        return { name: entry.name, bytes: bytes.slice(start, start + entry.size) };
      }
      if (entry.method !== 8) return { name: entry.name, bytes: new Uint8Array(0) };

      //  Nur den eigenen Block fuettern. Steht dort keine Laenge (Zip64
      //  oder Datenbeschreibung), nimmt inflateRaw den Rest und hoert von
      //  selbst auf, sobald der Strom nicht mehr weiss, was er liest.
      var slice = entry.packed
        ? bytes.subarray(start, start + entry.packed)
        : bytes.subarray(start);
      return inflateRaw(slice, budget).then(function (data) {
        return { name: entry.name, bytes: data };
      });
    })).then(function (files) {
      //  Zwei Schluessel je Datei: der volle Pfad (dafuer interessiert sich
      //  ein docx) und der blosse Dateiname (so sucht der LinkedIn-Adapter).
      var map = {};
      files.forEach(function (file) {
        if (!file) return;
        map[file.name] = file.bytes;
        var base = file.name.replace(/^.*\//, "");
        if (base && map[base] === undefined) map[base] = file.bytes;
      });
      return map;
    });
  }

  /* ----------------------------------------------------------- LinkedIn */

  function pick(map, name) {
    var key = Object.keys(map).filter(function (entry) {
      return entry.toLowerCase() === name.toLowerCase();
    })[0];
    return key ? decodeText(map[key]) : "";
  }

  function fromLinkedIn(files) {
    var profile = emptyProfile();

    var basics = parseCsv(pick(files, "Profile.csv"))[0];
    if (basics) {
      profile.contact.name = [basics["First Name"], basics["Last Name"]]
        .map(clean).filter(Boolean).join(" ");
      profile.contact.role = clean(basics.Headline);
      profile.contact.city = clean(basics["Geo Location"]).split(",")[0] || "";
      profile.profileText = clean(basics.Summary);
      clean(basics.Websites).split(/[,;]\s*/).forEach(function (entry) {
        var url = entry.replace(/^\[[^\]]*\]\s*[:,]?\s*/, "");
        if (/^https?:\/\//.test(url)) {
          profile.links.push({ label: "Website", text: shortUrl(url), url: url });
        }
      });
    }

    var mails = parseCsv(pick(files, "Email Addresses.csv"));
    if (mails.length) {
      var primary = mails.filter(function (entry) { return /yes/i.test(entry.Primary); })[0];
      profile.contact.email = clean((primary || mails[0])["Email Address"]);
    }

    var phones = parseCsv(pick(files, "PhoneNumbers.csv"));
    if (phones.length) profile.contact.phone = clean(phones[0].Number);

    parseCsv(pick(files, "Positions.csv")).forEach(function (entry) {
      var event = newEvent("experience");
      event.title = clean(entry.Title);
      event.company = clean(entry["Company Name"]);
      event.place = clean(entry.Location);
      event.start = normDate(entry["Started On"]);
      event.end = normDate(entry["Finished On"]);
      event.present = isPresent(entry["Finished On"]);
      splitDescription(clean(entry.Description), event);
      profile.events.push(event);
    });

    parseCsv(pick(files, "Education.csv")).forEach(function (entry) {
      var event = newEvent("education");
      event.title = clean(entry["Degree Name"]) || clean(entry["School Name"]);
      event.company = clean(entry["School Name"]);
      event.start = normDate(entry["Start Date"]);
      event.end = normDate(entry["End Date"]);
      event.present = isPresent(entry["End Date"]) && !!clean(entry["Start Date"]);
      splitDescription(clean(entry.Notes) || clean(entry.Activities), event);
      profile.events.push(event);
    });

    parseCsv(pick(files, "Volunteering.csv")).forEach(function (entry) {
      var event = newEvent("volunteer");
      event.title = clean(entry.Role);
      event.company = clean(entry["Company Name"]);
      event.start = normDate(entry["Started On"]);
      event.end = normDate(entry["Finished On"]);
      event.present = isPresent(entry["Finished On"]);
      splitDescription(clean(entry.Description), event);
      profile.events.push(event);
    });

    parseCsv(pick(files, "Certifications.csv")).forEach(function (entry) {
      var event = newEvent("other");
      event.title = clean(entry.Name);
      event.company = clean(entry.Authority);
      event.start = normDate(entry["Started On"]);
      event.end = normDate(entry["Finished On"]);
      profile.events.push(event);
    });

    parseCsv(pick(files, "Skills.csv")).forEach(function (entry) {
      if (clean(entry.Name)) profile.skills.push({ name: clean(entry.Name), rank: 0 });
    });

    parseCsv(pick(files, "Languages.csv")).forEach(function (entry) {
      if (!clean(entry.Name)) return;
      profile.languages.push({
        name: clean(entry.Name),
        level: clean(entry.Proficiency),
        percentage: fluencyToPercent(entry.Proficiency),
      });
    });

    parseCsv(pick(files, "Projects.csv")).forEach(function (entry) {
      if (!clean(entry.Title)) return;
      profile.projects.push({
        name: clean(entry.Title),
        url: clean(entry.Url),
        description: clean(entry.Description),
      });
    });

    if (profile.skills.length) profile.warnings.push("skillRanks");
    return profile;
  }

  //  Aus einem Fliesstext wird ein Absatz, aus Aufzaehlungszeichen eine
  //  Liste – das ist der Unterschied zwischen "importiert" und "brauchbar".
  function splitDescription(text, event) {
    if (!text) return;
    text.split(/\n+/).forEach(function (line) {
      var value = clean(line);
      if (!value) return;
      if (/^[-–—•*·]\s*/.test(value)) event.list.push(value.replace(/^[-–—•*·]\s*/, ""));
      else event.description.push(value);
    });
  }

  /* --------------------------------------------------------------- Text */

  //  Der Heuristik-Pfad: eingefuegter Text oder das, was aus einem PDF
  //  faellt. Aus einem PDF kommen zusaetzlich Schriftgrad und Sperrung je
  //  Zeile – damit laesst sich eine Ueberschrift erkennen, ohne sie zu
  //  kennen, und der Name ist schlicht die groesste Schrift auf dem Blatt.
  //  Das Ergebnis bleibt ein Entwurf: erfunden wird nichts, aber die
  //  Zuordnung kann danebenliegen.
  //  Ohne \b am Ende: "Weiterbildungen" ist dieselbe Ueberschrift wie
  //  "Weiterbildung", und Vorlagen setzen mal so, mal so.
  var HEADINGS = [
    { role: "experience", pattern: /^(berufs?erfahrung|beruflicher werdegang|berufliche erfahrung|berufliche stationen|berufliche laufbahn|praxiserfahrung|berufspraxis|berufstätigkeit|werdegang|praktika|work experience|professional experience|relevant experience|work history|employment history|career history|experience|employment|internships)/i },
    { role: "education", pattern: /^(ausbildung|aus- und weiterbildung|schulbildung|schulische ausbildung|studium|hochschulstudium|akademischer werdegang|bildungsweg|bildung|schulischer werdegang|schule|education and training|education|academic)/i },
    { role: "volunteer", pattern: /^(ehrenamtliche[sr]? (?:engagement|tätigkeit(?:en)?)|soziales engagement|ehrenamt|engagement|freiwillig|volunteering|volunteer)/i },
    { role: "skills", pattern: /^(kenntnisse|f[äa]higkeiten|skills|kompetenzen|kernkompetenzen|technical skills|digital skills|computer skills|it skills|soft skills|hard skills|core competencies|key skills|qualifikationen|qualifications|it-kenntnisse|edv|software|tools|werkzeuge|technologien|technologies|tech stack|programmiersprachen|programming languages|stärken|strengths)/i },
    { role: "languages", pattern: /^(sprachen|languages|language skills|sprachkenntnisse|fremdsprachen|fremdsprachenkenntnisse)/i },
    { role: "interests", pattern: /^(interessen|hobbys?|hobbies|interests|freizeit|persönliche interessen)/i },
    { role: "projects", pattern: /^(projekte|projects|portfolio|ausgewählte projekte|selected projects)/i },
    { role: "profile", pattern: /^(profil|über mich|ueber mich|kurzprofil|persönliches profil|zusammenfassung|summary|professional summary|career objective|about|profile|objective)/i },
    { role: "other", pattern: /^(weiterbildung|fortbildung|seminare|kurse|courses|zertifikate|zertifizierungen|certificates|certifications|lizenzen|licenses|awards|auszeichnungen|honou?rs|preise|stipendien|scholarships|publikationen|publications|vorträge|talks|mitgliedschaften|memberships)/i },
    { role: "mobility", pattern: /^(f[üu]hrerschein|fahrerlaubnis|driving licen[cs]e|mobilit[äa]t|mobility)/i },
    //  Bekannt, aber ohne eigenen Block: Hauptsache, die Zeilen darunter
    //  landen nicht im vorigen Abschnitt.
    { role: "ignore", pattern: /^(kontakt|contact|persönliche daten|persoenliche daten|persönliche angaben|angaben zur person|zur person|personal details|personal information|personal data|referenzen|references|anschrift|adresse|lebenslauf|curriculum vitae|resume)/i },
  ];

  //  Manche Vorlagen stellen der Ueberschrift etwas voran: "Weitere
  //  Faehigkeiten und Kenntnisse". Dann zaehlt das Schluesselwort auch
  //  mitten in der Zeile – aber nur, wenn die Zeile ueberhaupt wie eine
  //  Ueberschrift gesetzt ist.
  function headingInside(value) {
    for (var i = 0; i < HEADINGS.length; i++) {
      var body = HEADINGS[i].pattern.source.replace(/^\^/, "");
      //  Dieselbe Bedingung wie bei einer Ueberschrift am Zeilenanfang:
      //  das Wort muss dort aufhoeren.
      if (keywordFits(value, new RegExp("[\\s\\S]*?(?:^|\\s)" + body, "i"))) {
        return HEADINGS[i].role;
      }
    }
    return null;
  }

  //  Ein Zeitraum in einer Zeile: "09/2015 – 07/2021", "2015 - heute",
  //  "Jan 2015 – Dez 2018". Zweistellige Jahre sind erlaubt, die kommen aus
  //  gestalteten Lebenslaeufen ("11/13").
  //  Was als Datum gilt: Monat und Jahr ("07/21", "7.2021"), ein volles
  //  Jahr ("2021") oder ein Monatsname mit Jahr ("Jan 2015", "Summer 2016"
  //  faellt weg, das ist keine Jahreszahl mit Monat).
  //
  //  Was ausdruecklich nicht zaehlt: eine nackte zwei- oder dreistellige
  //  Zahl. Sonst wird aus "Tel. (203) 555-5555" ein Zeitraum von 555 bis
  //  5555, aus "Taught 75 students" eine Station von 1975, und aus einer
  //  Notenangabe "3.70/4.00" der April des Jahres 2000. Genau das ist in
  //  echten Lebenslaeufen passiert.
  //  Ein Jahr – oder der Platzhalter, den unausgefuellte Vorlagen an seine
  //  Stelle setzen ("20XX").
  var YEAR = "(?:19|20)(?:\\d{2}|[Xx]{2})";

  //  Monatsnamen kommen aus derselben Liste, mit der sie spaeter gelesen
  //  werden. Frueher stand hier "irgendein Wort aus 3 bis 9 Buchstaben vor
  //  einer Jahreszahl" – damit wurde aus "Operations Analyst 2021 – 2024"
  //  ein Zeitraum von "Analyst 2021" bis 2024, und der Titel hiess
  //  anschliessend nur noch "Operations".
  var MONTH_WORDS = Object.keys(MONTHS)
    .sort(function (a, b) { return b.length - a.length; })
    .join("|");

  //  Das vollstaendige Datum steht vorn: sonst liest die kuerzere Form
  //  aus "01/09/2024" ein "01/09" heraus und macht daraus September 2001.
  var DATE = "(?:\\d{1,2}[./]\\d{1,2}[./]\\d{4})" +
    "|(?:\\d{1,2}[./](?:\\d{2}|\\d{4}|(?:19|20)[Xx]{2}))|" + YEAR +
    "|(?:" + MONTH_WORDS + ")\\.?\\s+" + YEAR;
  var OPEN = "heute|present|current|aktuell|now|jetzt|dato|today|ongoing|bis heute";

  var RANGE = new RegExp(
    "(\\b(?:" + DATE + ")\\b)\\s*(?:–|—|-|bis|to|until|\\u2013)\\s*(\\b(?:" + DATE + ")\\b|" + OPEN + ")", "i");

  //  Eine Zeile, die nur ein Datum traegt – auch zweistellig ("11/13"),
  //  wie es gestaltete Lebenslaeufe setzen.
  var SINGLE = new RegExp("^\\s*(" + DATE + ")\\s*$");

  //  "2020   Schweissen unter Wasser" – Datum links, Inhalt rechts. So setzen
  //  es Weiterbildungslisten, und so setzen es die Themes von RickCV selbst
  //  ("11/13   Angefangene Ausbildung"). Ein nacktes zweistelliges Jahr ohne
  //  Monat bleibt draussen, sonst wuerde aus "10 Jahre Erfahrung" eine
  //  Station von 2010.
  var LEADING = new RegExp("^(" + DATE + ")[\\t ]+(\\S.*)$");

  //  Zwei Daten hintereinander ohne Trennzeichen: "Sep. 2023 Mar. 2024".
  //  Manche Vorlagen zeichnen den Gedankenstrich als Grafik oder mit einer
  //  Schrift ohne Zeichenzuordnung – im Text steht dann nichts zwischen den
  //  beiden Daten, obwohl ein Zeitraum gemeint ist.
  var LOOSE_RANGE = new RegExp(
    "^(.*?)[\\t ]+(" + DATE + ")[\\t ]+(" + DATE + "|" + OPEN + ")$", "i");

  //  "seit 04/2021", "since 2019", "ab 08/2020" – der offene Anfang, wie ihn
  //  deutsche Lebenslaeufe schreiben, statt einen Zeitraum bis "heute" zu
  //  setzen. Das Wort faellt weg, der Rest der Zeile wird gelesen wie jede
  //  andere Station, und das Ende bleibt offen.
  var SINCE = new RegExp("^(?:seit|since|ab|from)[\\t ]+(?=" + DATE + ")", "i");

  //  Die Fortsetzungszeile derselben Station: "– 09/15" allein oder mit dem
  //  Arbeitgeber dahinter. In Layouts mit stehendem Datum steht der Zeitraum
  //  ueber zwei Zeilen, und die zweite gehoert zur ersten.
  var CONTINUES = new RegExp(
    "^[–—-][\\t ]*(" + DATE + "|" + OPEN + ")(?:[\\t ]+(\\S.*))?$", "i");

  //  Ein Datum am Zeilenende – die haeufigste Form in gestalteten
  //  Lebenslaeufen. Steht ein Gedankenstrich davor, ist es das Ende eines
  //  Zeitraums, dessen Anfang eine Zeile hoeher steht.
  var TRAILING = new RegExp(
    "^(.*?)[\\t ]*(?:(–|—|-|bis|to)[\\t ]*)?(" + DATE + "|" + OPEN + ")[.,;]?$", "i");

  //  Steht die gefundene Zahl fuer sich, oder ist sie ein Stueck aus einer
  //  laengeren? "GPA: 3.70/4.00" enthaelt "4.00", und das sieht aus wie
  //  April 2000 – ist aber die zweite Haelfte einer Note. Entschieden wird
  //  am Zeichen davor und dahinter, nicht mit einem Rueckblick im Muster:
  //  Lookbehind kennen aeltere Browser nicht, und eine Datei, die sie nicht
  //  einmal lesen koennen, ist schlimmer als ein falsches Datum.
  function standaloneAt(line, start, length) {
    var before = start > 0 ? line.charAt(start - 1) : "";
    var after = start + length < line.length ? line.charAt(start + length) : "";
    return !/[\d.,/]/.test(before) && !/[\d./]/.test(after);
  }

  function trailingDate(text) {
    var line = String(text);
    var match = line.match(TRAILING);
    if (!match) return null;

    var rest = clean(match[1]).replace(/[\t]/g, " ").replace(/[,;–—-]\s*$/, "").trim();
    var value = clean(match[3]);

    //  Das Datum steht am Ende – wo es anfaengt, sagt die Laenge des Restes.
    var at = line.lastIndexOf(match[3]);
    if (at >= 0 && !standaloneAt(line, at, match[3].length)) return null;

    //  Eine blosse Hausnummer oder Postleitzahl ist kein Datum.
    if (!/[./]/.test(value) && !/^(19|20)\d{2}$/.test(value) &&
        !new RegExp("^(?:" + OPEN + ")$", "i").test(value) &&
        !/[A-Za-zÄÖÜäöü]/.test(value)) {
      return null;
    }

    return {
      rest: rest,
      date: isPresent(value) ? "" : normDate(value),
      isEnd: !!match[2],
      present: isPresent(value),
    };
  }

  function normalizeHeading(value) {
    return clean(value).replace(/^[•·\-–—*\s]+/, "").replace(/[:•|.\s]+$/, "");
  }

  //  Viele Vorlagen setzen Beschriftung und Inhalt nebeneinander:
  //  "Sprachkenntnisse    Deutsch, Muttersprache". Die PDF-Ebene hat den
  //  Spaltensprung als Tabulator hinterlassen – daran laesst sich beides
  //  trennen. Eine Beschriftung ist kurz, traegt keine Ziffern und endet
  //  hoechstens auf einen Doppelpunkt.
  //  Traegt die Zeile einen Zeitraum, ein Anfangs- oder ein Enddatum?
  function carriesDate(text) {
    var line = clean(text);
    if (!line) return false;
    return RANGE.test(line) || SINGLE.test(line) || LEADING.test(line) ||
      !!trailingDate(line);
  }

  //  "AUSBILDUNG Angefangene Ausbildung zum Tierpfleger   11/13" – Themes mit
  //  Ueberschriften im Rand setzen beides auf dieselbe Zeile. Getrennt wird
  //  nur, wenn hinter der Ueberschrift ein Datum steht: sonst zerschnitte die
  //  Regel auch "Ausbildung zum Berufstaucher".
  function splitLeadingHeading(text) {
    var line = clean(text);
    if (!line) return null;

    var words = line.split(/[\t ]+/);
    if (words.length < 3) return null;

    for (var take = 1; take <= 3 && take < words.length; take++) {
      var prefix = words.slice(0, take).join(" ");
      var rest = clean(words.slice(take).join(" "));
      if (!rest) continue;

      var role = headingOf(prefix);
      if (!role || role === "ignore") continue;

      //  Getrennt wird nur, wenn die Ueberschrift auch wie eine gesetzt ist:
      //  Versalien vorn, gemischter Satz dahinter. Das unterscheidet
      //  "MOBILITÄT Führerschein Klasse B" von "Software Developer 03/2016",
      //  wo "Software" zufaellig ein Ueberschriftenwort ist – und genau daran
      //  ist diese Regel beim ersten Versuch gescheitert.
      var shouts = prefix.length >= 4 && prefix === prefix.toUpperCase() &&
        /[A-ZÄÖÜ]/.test(prefix) && rest !== rest.toUpperCase();

      if (!shouts) continue;

      return { role: role, rest: rest };
    }

    return null;
  }

  //  Eine Aufzaehlung oder eine Station? "Chorleitung, Volleyball, Imkerei"
  //  sind drei Eintraege einer Liste, "Jugendtrainerin im Turnverein" ist
  //  eine einzelne Angabe. Drei kurze Glieder ohne Datum sind das eine, alles
  //  darunter das andere.
  function enumeration(value) {
    var parts = String(value).split(/[,;•·]/).map(clean).filter(Boolean);
    if (parts.length < 3) return false;

    return parts.every(function (part) {
      return part.length <= 30 && !carriesDate(part);
    });
  }

  function labelSplit(text) {
    var parts = String(text).split("\t");
    if (parts.length < 2) return null;
    var label = clean(parts[0]).replace(/:$/, "");
    var value = clean(parts.slice(1).join(" "));
    if (!label || !value || label.length > 28 || /\d/.test(label)) return null;
    return { label: label, value: value };
  }

  //  "Sprachen: Deutsch, Englisch" – eine Beschriftung, die sich als
  //  bekannte Ueberschrift liest, mit Inhalt dahinter.
  function colonLabel(text) {
    var match = clean(text).match(/^([^:\t]{2,28}):\s+(\S.*)$/);
    if (!match || /\d/.test(match[1]) || !headingOf(match[1])) return null;
    return { label: clean(match[1]), value: clean(match[2]) };
  }

  //  Woran man eine gesprochene Sprache erkennt – im Unterschied zu einer
  //  Programmiersprache, die unter "Languages:" genauso dasteht.
  var NATURAL_LANGUAGE = /\b(deutsch|englisch|französisch|franzoesisch|spanisch|italienisch|portugiesisch|russisch|polnisch|türkisch|tuerkisch|arabisch|chinesisch|japanisch|niederländisch|schwedisch|dänisch|norwegisch|finnisch|griechisch|tschechisch|ungarisch|rumänisch|ukrainisch|kroatisch|serbisch|persisch|hindi|koreanisch|german|english|french|spanish|italian|portuguese|russian|polish|turkish|arabic|chinese|mandarin|cantonese|japanese|dutch|swedish|danish|norwegian|finnish|greek|czech|hungarian|romanian|ukrainian|croatian|serbian|persian|farsi|korean|muttersprache|native|fluent|fließend|[abc][12])\b/i;

  //  Ein Schluesselwort macht die Zeile nur dann zur Ueberschrift, wenn
  //  das Wort dort auch aufhoert: "Softwareentwicklerin" faengt mit
  //  "Software" an und ist trotzdem ein Stationstitel – frueher riss sie
  //  den Abschnitt "Kenntnisse" auf und der halbe Werdegang landete
  //  darin. Eine Endung von ein, zwei Buchstaben bleibt erlaubt, sonst
  //  waere "Berufserfahrungen" nicht dieselbe Ueberschrift wie
  //  "Berufserfahrung".
  function keywordFits(value, pattern) {
    var match = value.match(pattern);
    if (!match) return false;
    return !/^[A-Za-zÄÖÜäöüß]{3}/.test(value.slice(match[0].length));
  }

  function headingOf(line) {
    var value = normalizeHeading(line);
    if (!value || value.length > 40) return null;

    for (var i = 0; i < HEADINGS.length; i++) {
      if (keywordFits(value, HEADINGS[i].pattern)) return HEADINGS[i].role;
    }

    //  Gesperrt gesetzte Ueberschriften kommen aus dem PDF in Stuecken
    //  ("BERUFSER FA HRUNG"), die sich nicht mehr zu einzelnen Buchstaben
    //  zusammenfassen lassen. Ohne Leerzeichen passt das Wort wieder.
    var tight = value.replace(/\s+/g, "");
    if (tight !== value && tight.length > 3) {
      for (var j = 0; j < HEADINGS.length; j++) {
        if (keywordFits(tight, HEADINGS[j].pattern)) return HEADINGS[j].role;
      }
    }

    return null;
  }

  //  Wie sehen die Ueberschriften in genau diesem Dokument aus? Das laesst
  //  sich an den erkannten ablesen – Schriftgrad und Sperrung. Damit wird
  //  aus "groesser als der Fliesstext" ein Vergleich mit dem, was hier
  //  tatsaechlich eine Ueberschrift ist. Ohne diesen Massstab gilt jede
  //  hervorgehobene Zeile als Ueberschrift, und ein Projektname beendet
  //  den Abschnitt, in dem er steht.
  function headingStyle(rows) {
    var sizes = [];
    var spaced = 0;
    var upper = 0;
    var bold = 0;
    var known = 0;

    rows.forEach(function (row) {
      //  Nur Zeilen, die nichts als die Ueberschrift enthalten. Eine
      //  Beschriftung mit Wert daneben ("Führerschein  Klasse B") und ein
      //  Satz, der zufaellig so anfaengt ("Ausbildung zum Berufstaucher"),
      //  wuerden den Massstab verderben.
      if (!headingOf(row.text)) return;
      if (labelSplit(row.text) || colonLabel(row.text)) return;
      if (clean(row.text).split(/\s+/).length > 3) return;
      known++;
      if (row.size) sizes.push(row.size);
      if (row.spaced) spaced++;
      if (row.bold) bold++;
      if (normalizeHeading(row.text) === normalizeHeading(row.text).toUpperCase()) upper++;
    });

    if (!known || !sizes.length) return null;
    return {
      size: median(sizes),
      spaced: spaced >= known * 0.6,
      upper: upper >= known * 0.8,
      bold: bold >= known * 0.6,
    };
  }

  //  Traegt eine Station schon etwas, das sie ausmacht? Ein Titel allein
  //  reicht nicht – der koennte noch auf seinen Zeitraum warten.
  function stationFilled(entry) {
    return !!(entry && (entry.start || entry.end || entry.present ||
      entry.list.length || entry.description.length));
  }

  //  Hebt sich eine Zeile so ab, dass sie eine Station eroeffnet? Kurz,
  //  ohne Aufzaehlungszeichen, ohne zweite Spalte – und fett *und*
  //  groesser als der Fliesstext. Fett allein reicht nicht: in
  //  Lebenslaeufen, die ihre Stationen ueber eine Beschriftungsspalte
  //  ordnen, ist auch die Zusatzzeile fett ("Schwerpunkt: Mittelspannung"),
  //  und die gehoert zur Station darueber.
  function startsEntry(row, bodySize) {
    var value = clean(row.text);
    if (!value || value.length > 60) return false;
    if (/^[-–—•*·]/.test(value)) return false;
    if (value.indexOf("\t") !== -1) return false;
    if (!bodySize || !row.size) return false;
    //  Fett und etwas groesser – oder deutlich groesser, denn nicht jede
    //  Vorlage setzt ihre Titel fett.
    if (row.bold && row.size >= bodySize * 1.08) return true;
    return row.size >= bodySize * 1.2;
  }

  //  Eine Ueberschrift ist kurz. Wo Schriftgrade vorliegen, entscheidet das
  //  Layout; ohne sie bleibt nur die Form der Zeile.
  function headingShape(line) {
    var value = normalizeHeading(line);
    if (value.split(/\s+/).length <= 2 || /:$/.test(clean(line))) return true;
    //  "Education and training", "Aus- und Weiterbildung": laenger, aber
    //  nichts als die Ueberschrift selbst.
    return HEADINGS.some(function (heading) {
      var match = value.match(heading.pattern);
      return !!match && match[0].length >= value.length;
    });
  }

  //  Eine unbekannte Ueberschrift soll den laufenden Abschnitt trotzdem
  //  beenden – sonst sammelt "Kenntnisse" den halben Rest des Blattes ein.
  //  Ohne Schriftgrade (eingefuegter Text) wird nicht geraten.
  function looksLikeHeading(row, bodySize, style) {
    if (!row || !bodySize) return false;
    var value = normalizeHeading(row.text);
    if (!value || value.length > 34 || /\d/.test(value) || value.indexOf(",") !== -1) return false;
    if (value.indexOf("\t") !== -1) return false;

    if (style) {
      //  Sind die Ueberschriften dieses Dokuments gesperrt, ist eine nicht
      //  gesperrte Zeile keine – egal wie gross sie ist.
      if (style.spaced && !row.spaced) return false;
      //  Und schreibt dieses Dokument seine Ueberschriften in Versalien,
      //  ist eine gemischt gesetzte Zeile keine. In Word-Vorlagen tragen
      //  Abschnitt und Stationstitel oft denselben Grad – "BERUFSERFAHRUNG"
      //  und "Gesundheits- und Krankenpflegerin" unterscheiden sich dann
      //  nur noch darin.
      if (style.upper && value !== value.toUpperCase()) return false;
      if (!row.size) return false;
      //  Liegt der Ueberschriftsgrad dicht am Fliesstext (12 zu 11 Punkt
      //  ist ueblich), traefe die blosse Aehnlichkeit jede Zeile. Eine
      //  Ueberschrift muss sich auch vom Fliesstext abheben.
      //  Ausnahme: Versalien in Fett, wenn dieses Dokument seine
      //  Ueberschriften so setzt (Europass: "WORK EXPERIENCE" fett in
      //  Grundschrift). Die Pruefung auf Versalien steht oben.
      if (!row.spaced && row.size < bodySize * 1.08 && !(style.upper && style.bold && row.bold)) {
        return false;
      }
      return Math.abs(row.size - style.size) <= style.size * 0.15;
    }

    if (row.spaced) return true;
    return row.size >= bodySize * 1.12 && value === value.toUpperCase();
  }

  //  Eine Zeile, die nichts als eine Adresse ist, gehoert in die
  //  Linkleiste – nicht in den Abschnitt, unter dem sie zufaellig steht.
  //  Ein blosser Netzwerkname ohne Ziel ("LinkedIn") ist dagegen nichts,
  //  womit sich etwas anfangen liesse.
  var LINK_LINE = /^(https?:\/\/\S+|www\.\S+|[\w.-]{2,}\.(?:de|com|org|net|io|dev|eu|ch|at|me|page|place|blog|xyz|design|studio|app|info|co|uk|nl|fr|be|es|it|pl|se|dk|no|fi|pt|cz|ai|tech|online|site|website|art|work|social|link|cloud|codes|engineer|photography|pro)(?:\/\S*)?)$/i;

  //  Eine Kontaktzeile setzt ihre Angaben mit Trennern nebeneinander:
  //  Tabulator, senkrechter Strich, Mittelpunkt, Aufzaehlungspunkt oder
  //  ein breiter Abstand.
  function splitContactLine(line) {
    return String(line).split(/\t|\s*\|\s*|\s+[·•◦▪|]\s+|\s{3,}/)
      .map(clean).filter(Boolean);
  }

  //  Beschriftete Angaben aus den persoenlichen Daten.
  function labelledContact(rows) {
    var found = { name: "" };
    rows.forEach(function (row) {
      var parts = String(row.text).split("\t").map(clean).filter(Boolean);
      var match = parts.length === 2 ? [null, parts[0], parts[1]]
        : clean(row.text).match(/^(name|vor- und nachname|full name)\s*:\s*(.+)$/i);
      if (!match) return;
      if (/^(name|vor- und nachname|full name)\s*:?$/i.test(match[1]) && !found.name &&
          /^[A-ZÄÖÜ][^\d@]{2,48}$/.test(match[2])) {
        found.name = match[2];
      }
    });
    return found;
  }

  //  Die Kontaktzeile im Kopf ("Seattle, WA · (206) 555-0142 · sam@… ·
  //  linkedin.com/in/sam") traegt neben Mail und Telefon auch Ort und
  //  Profile. Ein Ort ist dort, was weder Nummer noch Adresse noch Link ist –
  //  aber nur in einer Zeile, die sich durch eine Mailadresse oder Nummer
  //  als Kontaktzeile ausweist, und nur ganz oben auf dem ersten Blatt.
  function headerContact(rows, profile) {
    rows.slice(0, 12).forEach(function (row) {
      if (row.page !== 1) return;
      var parts = splitContactLine(row.text);
      if (parts.length < 2) return;
      var isContact = parts.some(function (part) {
        return /@/.test(part) || /^[+(]?\d[\d\s().\/-]{6,}$/.test(part);
      });
      if (!isContact) return;

      parts.forEach(function (part) {
        if (/@/.test(part)) return;
        if (LINK_LINE.test(part)) {
          var url = /^https?:\/\//i.test(part) ? part : "https://" + part;
          var known = profile.links.some(function (link) { return link.url === url; });
          if (!known) profile.links.push({ label: shortUrl(part).split("/")[0], text: shortUrl(part), url: url });
          return;
        }
        if (!profile.contact.city && !/\d/.test(part) && part.length <= 40 &&
            /^[A-ZÄÖÜ][\wäöüßéèáàóòúùâêîôûç.'-]*(?:[\s-][A-ZÄÖÜa-zäöü][\wäöüßéèáàóòúùâêîôûç.'-]*){0,3}(?:,\s*[A-Z]{2,3})?$/.test(part) &&
            clean(part).toLowerCase() !== clean(profile.contact.name).toLowerCase() &&
            clean(part).toLowerCase() !== clean(profile.contact.role).toLowerCase() &&
            !headingOf(part) && !NETWORK_NAME.test(part)) {
          profile.contact.city = part;
        }
      });
    });
  }

  //  Eingefuegter Text kommt heute oft aus einem Sprachmodell – als
  //  Markdown. Rauten vor Ueberschriften, Sternchen um Fettes und die
  //  Striche einer Tabelle sind dann Satzzeichen, die jede Erkennung
  //  stoeren. Sie fallen weg; eine Tabellenzeile wird zu Spalten mit
  //  Tabulator, so wie sie auch aus einem PDF kommt.
  function textLinesOf(text) {
    return String(text).replace(/\r/g, "").split("\n").map(function (line) {
      var value = line;
      if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(value)) return { text: "" };
      if (/^\s*\|.*\|\s*$/.test(value)) {
        value = value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
          .map(function (cell) { return cell.trim(); }).filter(Boolean).join("\t");
      }
      value = value
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*[*+]\s+/, "• ")
        .replace(/\*\*(.+?)\*\*|__(.+?)__/g, function (match, a, b) { return a || b; })
        .replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s),.;:]|$)/g, "$1$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 $2");
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(value)) value = "";
      return { text: value };
    });
  }
  var NETWORK_NAME = /^(linked ?in|github|gitlab|xing|mastodon|bluesky|twitter|instagram|portfolio|webseite|website)$/i;

  //  Abschnitte, die eine Liste fuellen – im Gegensatz zu den Stationen.
  var LIST_SECTIONS = ["skills", "languages", "interests", "projects", "mobility", "profile"];

  function isStationSection(name) {
    return name === "experience" || name === "education" ||
           name === "volunteer" || name === "other";
  }

  function isContactLine(line, profile) {
    var value = clean(line);
    if (!value) return false;
    if (/[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(value)) return true;
    if (/^\+?[\d][\d\s().\/-]{6,}$/.test(value)) return true;
    if (/^\d{4,5}\s+[A-ZÄÖÜ]/.test(value)) return true;
    var name = clean(profile.contact.name);
    return !!name && value.toLowerCase() === name.toLowerCase();
  }

  /* ---------------------------------------------------------- Anschreiben */

  //  Liegt dem Lebenslauf ein Anschreiben bei, steht es vorn (die klassische
  //  Bewerbungsmappe) oder hinten (so druckt RickCV selbst). Frueher endete
  //  das Lesen an der Anrede – bei einer Mappe, die mit dem Anschreiben
  //  beginnt, fiel damit der ganze Lebenslauf weg. Jetzt wird das
  //  Anschreiben vorab herausgeloest und fuer sich gelesen; der Rest ist der
  //  Lebenslauf, egal wo das Anschreiben stand.

  //  Eine Anrede. Die festen Formeln gelten immer; die lockeren nur mit
  //  Komma am Ende – "Liebe zum Detail" ist eine Kenntnis, keine Anrede.
  var GREETING_FIRM = /^(sehr geehrte[rs]?\b|dear\s|to whom it may concern)/i;
  var GREETING_LOOSE = /^(liebe[rs]?|hallo|guten tag|moin|servus|hello|hi|greetings)\b.{0,60}[,!]$/i;

  //  Die Grussformel. Nur als Zeile fuer sich – "Regards" mitten im Satz
  //  beendet kein Anschreiben.
  var VALEDICTION = new RegExp("^(" + [
    "mit (?:den )?(?:freundlichen|besten|herzlichen|lieben|sonnigen|vielen) gr(?:ü|ue)(?:ß|ss)en",
    "mit freundlichem gru(?:ß|ss)",
    "(?:freundliche|beste|herzliche|viele|liebe|sonnige) gr(?:ü|ue)(?:ß|ss)e(?: aus .{2,30})?",
    "hochachtungsvoll",
    "(?:yours )?(?:sincerely|faithfully|truly|respectfully)(?: yours)?",
    "(?:with )?(?:kind|kindest|best|warm|warmest) (?:regards|wishes)",
    "regards", "best", "cheers", "thank you", "many thanks",
  ].join("|") + ")[,.!]?$", "i");

  //  "Anlagen: Lebenslauf, Zeugnisse" – steht unter der Unterschrift und
  //  gehoert noch zum Anschreiben.
  var ENCLOSURE = /^(anlagen?|enclosures?|attachments?|encl\.?)\b/i;

  //  Die Datumszeile: "Leipzig, 12. März 2026", "12.03.2026",
  //  "March 12, 2026", "12 March 2026".
  var LETTER_DATE = new RegExp(
    "^(?:([^,\\d]{2,40}),\\s*(?:den\\s+)?)?(?:\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{2,4}|" +
    "\\d{1,2}\\.?\\s+(?:" + MONTH_WORDS + ")\\.?\\s+\\d{4}|" +
    "(?:" + MONTH_WORDS + ")\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|" +
    "\\d{4}-\\d{2}-\\d{2})$", "i");

  //  Eine Zeile, die wie der Ort einer Postanschrift aussieht – deutsch,
  //  oesterreichisch, schweizerisch, amerikanisch oder britisch.
  var POSTAL_LINE = /(^|\s)(?:[A-Z]{1,2}-)?\d{4,5}\s+[A-ZÄÖÜ]|,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$|\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}$/;

  var SUBJECT_PREFIX = /^(betreff|betr\.|subject|re|ref)\s*:\s*/i;

  function isGreeting(line) {
    var value = clean(line);
    if (!value || value.length > 80) return false;
    return GREETING_FIRM.test(value) || GREETING_LOOSE.test(value);
  }

  function isValediction(line) {
    var value = clean(line);
    return value.length <= 60 && VALEDICTION.test(value);
  }

  //  Wo liegt das Anschreiben? Zurueck kommen die Grenzen [start, end] in
  //  der Zeilenliste und die Stellen von Anrede und Grussformel – oder null.
  function findLetter(rows) {
    for (var s = 0; s < rows.length; s++) {
      if (!isGreeting(rows[s].text)) continue;

      //  Die Grussformel folgt innerhalb von gut einer Seite.
      var v = -1;
      for (var i = s + 1; i < rows.length && i < s + 90; i++) {
        if (rows[i].page > rows[s].page + 1) break;
        if (isValediction(rows[i].text)) { v = i; break; }
      }

      //  Eine lockere Anrede ohne Grussformel ist zu wenig Beweis.
      if (v < 0 && !GREETING_FIRM.test(clean(rows[s].text))) continue;
      //  Und zwischen Anrede und Gruss muss ein Brief stehen, keine Zeile.
      if (v >= 0 && v - s < 2) continue;

      return { start: letterStart(rows, s), greeting: s, closing: v, end: letterEnd(rows, s, v) };
    }
    return null;
  }

  //  Der Briefkopf: Absender, Empfaenger, Datum, Betreff. Er beginnt oben
  //  auf dem Blatt der Anrede – ohne Blattgrenzen (eingefuegter Text) nach
  //  hoechstens vier Absaetzen. Eine Ueberschrift des Lebenslaufs oder ein
  //  Zeitraum beendet ihn in jedem Fall.
  function letterStart(rows, s) {
    var page = rows[s].page;
    var geometric = rows.some(function (row) { return row.y; });
    var blocks = 0;
    var start = s;

    for (var i = s - 1; i >= 0 && s - i <= 24; i--) {
      var row = rows[i];
      if (row.page !== page) break;
      var role = headingOf(row.text);
      if (role && !/^(kontakt|contact|anschrift|adresse)/i.test(normalizeHeading(row.text))) break;
      if (RANGE.test(row.text) || /^[-–—•*·]/.test(row.text)) break;
      if (!geometric && rows[i + 1].gap) {
        if (++blocks > 4) break;
      }
      start = i;
    }
    return start;
  }

  //  Hinter der Grussformel: der Name, vielleicht "Anlagen" samt Liste.
  function letterEnd(rows, s, v) {
    if (v < 0) {
      //  Ohne Grussformel endet der Brief mit seinem Blatt – oder, ohne
      //  Blaetter, an der naechsten Ueberschrift.
      var geometric = rows.some(function (row) { return row.y; });
      for (var i = s + 1; i < rows.length; i++) {
        if (geometric ? rows[i].page !== rows[s].page : headingOf(rows[i].text)) return i - 1;
      }
      return rows.length - 1;
    }

    var end = v;
    var enclosure = false;
    for (var j = v + 1; j < rows.length && j <= v + 8; j++) {
      var row = rows[j];
      var value = clean(row.text);
      if (row.page !== rows[v].page || headingOf(value)) break;
      if (ENCLOSURE.test(value)) { enclosure = true; end = j; continue; }
      if (enclosure && /^[-–—•*·]/.test(value)) { end = j; continue; }
      //  Name und Zusatz unter dem Gruss: kurz, ohne Datum.
      if (!enclosure && j <= v + 2 && value.length <= 60 && !carriesDate(value)) { end = j; continue; }
      break;
    }
    return end;
  }

  //  Zeilen, die im Briefkopf beieinanderstehen, bilden einen Block –
  //  Absender, Empfaenger, Datum, Betreff. Getrennt wird an Leerzeilen
  //  (eingefuegter Text) oder an Luecken und Spaltenwechseln (PDF, Word).
  function letterBlocks(rows) {
    //  Was eine Luecke ist, misst sich am engsten Zeilenabstand dieses
    //  Briefkopfs: Word setzt zwischen Absaetze gern ein paar Punkt, dann
    //  steht schon eine Anschrift weiter gesperrt als ein PDF sie setzt.
    var steps = [];
    rows.forEach(function (row, index) {
      var previous = rows[index - 1];
      if (previous && previous.y && row.y && previous.page === row.page) {
        steps.push(Math.abs(previous.y - row.y));
      }
    });
    steps.sort(function (a, b) { return a - b; });
    var pitch = steps.length ? steps[Math.floor((steps.length - 1) / 4)] : 0;

    //  Aus Word weiss jede Zeile, ob sie einen Absatz beginnt. Stehen
    //  mehrzeilige Absaetze darunter (Zeilen mit Umbruch), ist jeder Absatz
    //  ein Block. Hat dagegen jede Zeile ihren eigenen Absatz – so tippt man
    //  eine Anschrift mit der Eingabetaste –, sagt das nichts.
    var paragraphs = rows.some(function (row) { return row.para === false; });

    var blocks = [];
    var current = null;
    rows.forEach(function (row, index) {
      var previous = rows[index - 1];
      var together = !!previous && !row.gap && !(paragraphs && row.para);
      if (together && previous.y && row.y) {
        var size = Math.max(row.size || 10, previous.size || 10);
        var dy = Math.abs(previous.y - row.y);
        var sameSide = Math.abs(previous.x - row.x) < 60 || (previous.x > 250 && row.x > 250);
        together = previous.page === row.page && sameSide &&
          dy <= Math.max(size * 1.7, pitch * 1.4) && dy <= size * 3;
      }
      if (!together) {
        current = [];
        blocks.push(current);
      }
      current.push(row);
    });
    return blocks;
  }

  //  Absaetze des Brieftextes. Eine Luecke, die deutlich groesser ist als
  //  der Zeilenabstand, beginnt einen neuen – ebenso eine Leerzeile im
  //  eingefuegten Text. Fehlt beides, ist jede Zeile ein Absatz: so fuegt
  //  man einen Brief aus einer Mail oder einem Chat ein.
  function letterParagraphs(rows) {
    var geometric = rows.some(function (row) { return row.y; });
    var pitches = [];
    if (geometric) {
      rows.forEach(function (row, index) {
        var previous = rows[index - 1];
        if (previous && previous.page === row.page) pitches.push(Math.abs(previous.y - row.y));
      });
    }
    //  Der Zeilenabstand ist der engere der gemessenen Abstaende: bei
    //  kurzen Absaetzen gibt es kaum mehr Luecken als Zeilen, und der
    //  Median laege dann schon auf der Luecke.
    pitches.sort(function (a, b) { return a - b; });
    var pitch = pitches.length ? pitches[Math.floor((pitches.length - 1) / 4)] : 0;
    var anyGap = rows.some(function (row, index) { return index && row.gap; });
    //  Aus Word weiss jede Zeile, ob sie einen Absatz beginnt. Das ist
    //  genauer als jede Luecke.
    var marked = rows.some(function (row) { return row.para !== undefined; });
    var longest = rows.reduce(function (most, row) {
      return Math.max(most, clean(row.text).length);
    }, 0);

    var paragraphs = [];
    var current = null;
    rows.forEach(function (row, index) {
      var previous = rows[index - 1];
      var fresh = !current;
      if (!fresh) {
        //  Eine kurze Zeile, die mit dem Satz endet, schliesst ihren Absatz –
        //  auch wo zwischen den Absaetzen kein Abstand steht.
        var closes = /[.!?]$/.test(clean(previous.text)) &&
          clean(previous.text).length < longest * 0.8;
        if (marked) {
          fresh = !!row.para;
        } else if (geometric && pitch) {
          if (closes) fresh = true;
          else if (previous.page === row.page) fresh = Math.abs(previous.y - row.y) > pitch * 1.35;
          //  Ueber den Seitenwechsel laeuft ein Satz weiter; ein Absatz
          //  endet dort nur, wenn der Satz schon zu Ende war.
          else fresh = /[.!?:]$/.test(clean(previous.text));
        } else if (anyGap) {
          fresh = !!row.gap;
        } else {
          fresh = true;
        }
      }
      if (fresh) {
        current = [];
        paragraphs.push(current);
      }
      current.push(clean(row.text).replace(/\t+/g, " "));
    });

    return paragraphs.map(joinLines).filter(Boolean);
  }

  //  Umbrochene Zeilen wieder zu einem Satz. Ein Trennstrich am Zeilenende
  //  faellt weg, wenn danach klein weitergeschrieben wird ("Wasser-" /
  //  "versorgung"); vor "und", "oder" und Grossbuchstaben bleibt er stehen
  //  ("Wohn- und Gewerbebau", "SPS-" / "Fachkraft").
  function joinLines(lines) {
    return lines.reduce(function (text, line) {
      if (!text) return line;
      if (/[A-Za-zÄÖÜäöüß]-$/.test(text)) {
        if (/^(und|oder|bzw|sowie|bis|and|or|to)\b/.test(line)) return text + " " + line;
        if (/^[a-zäöüß]/.test(line)) return text.slice(0, -1) + line;
        return text + line;
      }
      return text + " " + line;
    }, "").replace(/\s+/g, " ").trim();
  }

  function readLetter(rows, found, profile) {
    var head = rows.slice(found.start, found.greeting);
    var body = rows.slice(found.greeting + 1, found.closing < 0 ? found.end + 1 : found.closing);
    var letter = {
      recipient: "", subject: "", salutation: clean(rows[found.greeting].text),
      paragraphs: letterParagraphs(body),
      closing: found.closing >= 0 ? clean(rows[found.closing].text) : "",
      signer: "", place: "",
    };

    if (found.closing >= 0) {
      var signer = rows[found.closing + 1];
      if (signer && found.closing + 1 <= found.end && !ENCLOSURE.test(clean(signer.text))) {
        letter.signer = clean(signer.text).split("\t")[0];
      }
    }

    var contact = profile.contact;
    function isSender(block) {
      return block.some(function (row) {
        var value = clean(row.text).toLowerCase();
        if (/@/.test(value) || /(?:tel|phone|mobil|fon)\b/.test(value)) return true;
        if (contact.phone && value.replace(/\D/g, "").indexOf(contact.phone.replace(/\D/g, "")) !== -1 &&
            contact.phone.replace(/\D/g, "").length >= 6) return true;
        var name = clean(contact.name || letter.signer).toLowerCase();
        return !!name && value.indexOf(name) === 0;
      }) || (block.length === 1 && / [·•|] .* [·•|] /.test(block[0].text));
    }

    var blocks = letterBlocks(head);
    var dateIndex = -1;
    blocks.forEach(function (block, index) {
      if (block.length === 1 && LETTER_DATE.test(clean(block[0].text))) {
        dateIndex = index;
        var place = clean(block[0].text).match(LETTER_DATE)[1];
        if (place) letter.place = clean(place);
      }
    });

    var recipient = -1;
    blocks.forEach(function (block, index) {
      if (recipient >= 0 || index === dateIndex || isSender(block)) return;
      if (block.length < 2 || block.length > 8) return;
      if (block.some(function (row) { return POSTAL_LINE.test(clean(row.text)); })) recipient = index;
    });
    //  Ohne erkennbare Postleitzahl: der erste mehrzeilige Block, der nicht
    //  der Absender ist und vor dem Betreff steht.
    if (recipient < 0) {
      for (var b = 0; b < blocks.length - 1; b++) {
        if (b !== dateIndex && blocks[b].length >= 2 && blocks[b].length <= 8 && !isSender(blocks[b])) {
          recipient = b;
          break;
        }
      }
    }
    if (recipient >= 0) {
      letter.recipient = blocks[recipient].map(function (row) {
        return clean(row.text).replace(/\t+/g, " ");
      }).join("\n");
    }

    //  Der Betreff ist der letzte Block vor der Anrede – sofern er nicht
    //  schon etwas anderes ist.
    for (var k = blocks.length - 1; k >= 0; k--) {
      if (k === dateIndex || k === recipient) continue;
      var block = blocks[k];
      if (isSender(block) && !SUBJECT_PREFIX.test(clean(block[0].text))) break;
      if (block.length > 3) break;
      letter.subject = block.map(function (row) { return clean(row.text); })
        .join("\n").replace(SUBJECT_PREFIX, "");
      break;
    }

    return letter;
  }

  //  "Musterstadt, 16.09.2026" unter dem Lebenslauf ist die Schlussformel
  //  vor der Unterschrift – ab da kommt nichts Inhaltliches mehr.
  var CLOSING = new RegExp(
    "^[A-ZÄÖÜ][\\wäöüß.\\- ]{1,30},\\s*(?:\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}|" +
    "\\d{1,2}\\.?\\s+[A-Za-zÄÖÜäöü]{3,9}\\.?\\s+\\d{4})$");

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  //  Der Fliesstext eines Dokuments ist der haeufigste Schriftgrad, nicht
  //  der mittlere. Der Unterschied zaehlt, sobald ein Blatt dazwischen
  //  liegt, das anders gesetzt ist – Vorlagen aus dem Netz stellen dem
  //  Lebenslauf gern eine Seite Werbung voran, und deren Grad zoege den
  //  Mittelwert genau auf die Groesse der Ueberschriften.
  function commonSize(values) {
    var counts = {};
    var best = 0;
    var bestCount = 0;

    values.forEach(function (value) {
      if (!value) return;
      var key = Math.round(value * 2) / 2; // halbe Punkt genuegen
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] > bestCount || (counts[key] === bestCount && key < best)) {
        best = key;
        bestCount = counts[key];
      }
    });

    return best || median(values);
  }

  function fromText(text, lines) {
    var profile = emptyProfile();

    //  Aus einem PDF kommen fertige Zeilen mit Zusatzwissen, aus der
    //  Zwischenablage nur Text. Beides wird hier zur selben Form.
    //  Eine Leerzeile im eingefuegten Text ist das einzige, was dort Absaetze
    //  trennt. Sie wird an der Zeile danach vermerkt, bevor die leeren Zeilen
    //  wegfallen – das Anschreiben braucht sie.
    var blank = false;
    var allRows = (lines && lines.length ? lines : textLinesOf(text))
      .map(function (row) {
        return {
          text: clean(row.text), size: row.size || 0, spaced: !!row.spaced,
          bold: !!row.bold, para: row.para,
          x: row.x || 0, y: row.y || 0, page: row.page || 1,
        };
      })
      .filter(function (row) {
        if (row.text) { row.gap = blank; blank = false; return true; }
        blank = true;
        return false;
      });

    if (!allRows.length) return profile;

    //  Das Anschreiben zuerst heraus: es hat seinen eigenen Aufbau, und
    //  seine Anschriften und Daten gehoeren nicht in den Lebenslauf.
    var letterSpan = findLetter(allRows);
    var rows = allRows;
    var letterRows = [];
    if (letterSpan) {
      letterRows = allRows.slice(letterSpan.start, letterSpan.end + 1);
      rows = allRows.slice(0, letterSpan.start).concat(allRows.slice(letterSpan.end + 1));
      letterSpan = {
        start: 0, greeting: letterSpan.greeting - letterSpan.start,
        closing: letterSpan.closing < 0 ? -1 : letterSpan.closing - letterSpan.start,
        end: letterSpan.end - letterSpan.start,
      };
    }

    //  Der Fliesstext wird je Blatt bestimmt. Vorlagen aus dem Netz legen
    //  dem Lebenslauf gern eine Werbeseite bei, die groesser gesetzt ist –
    //  ueber das ganze Dokument gemittelt waere deren Grad der "normale",
    //  und die Ueberschriften des Lebenslaufs faenden sich darunter wieder.
    var sizesByPage = {};
    rows.forEach(function (row) {
      if (!row.size) return;
      (sizesByPage[row.page] = sizesByPage[row.page] || []).push(row.size);
    });

    var bodyByPage = {};
    Object.keys(sizesByPage).forEach(function (page) {
      bodyByPage[page] = commonSize(sizesByPage[page]);
    });

    var bodySize = commonSize(rows.map(function (row) { return row.size; })
      .filter(function (size) { return size > 0; }));

    function bodyFor(row) {
      return bodyByPage[row.page] || bodySize;
    }

    var style = headingStyle(rows);

    var plain = rows.map(function (row) { return row.text; });

    //  Der Briefkopf traegt oft dieselben Kontaktdaten wie der Lebenslauf –
    //  und bei einem Anschreiben ohne Lebenslauf die einzigen. Gelesen wird
    //  er nach dem Lebenslauf, und die Anschrift des Empfaengers bleibt
    //  draussen: sie ist nicht die eigene.
    var letter = letterSpan ? readLetter(letterRows, letterSpan, profile) : null;
    if (letter) {
      var recipientLines = letter.recipient.split("\n");
      letterRows.slice(0, letterSpan.greeting).forEach(function (row) {
        if (recipientLines.indexOf(clean(row.text).replace(/\t+/g, " ")) === -1) plain.push(row.text);
      });
    }

    var mail = plain.join("\n").match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
    if (mail) profile.contact.email = mail[0];

    //  Kopfzeilen setzen mehrere Angaben nebeneinander: "Musterstraße 78 |
    //  23456 Musterstadt", "Seattle, WA · (206) 555-0142 · sam@…". Fuer
    //  Telefon und Anschrift wird deshalb an den Trennern zerlegt, sonst
    //  passt keine Zeile auf ihr Muster.
    var segments = [];
    plain.forEach(function (line) {
      splitContactLine(line).forEach(function (value) { segments.push(value); });
    });

    profile.contact.phone = findPhone(segments);

    var postal = findAddress(segments);
    profile.contact.address = postal.address;
    profile.contact.city = postal.city;

    var named = findName(rows, bodySize);
    profile.contact.name = named.name;
    profile.contact.role = named.role;

    //  "Name<TAB>Jonas Weber" – der tabellarische Lebenslauf nennt den
    //  Namen unter den persoenlichen Daten und setzt "Lebenslauf" darueber.
    //  Dann ist die Beschriftung die sicherere Quelle als die Schriftgroesse.
    var labelled = labelledContact(rows);
    if (labelled.name && (!named.name || !named.bySize)) {
      profile.contact.name = labelled.name;
      if (!named.bySize) {
        //  Was vorher als Name und Rolle geraten war, ist wieder Inhalt.
        profile.contact.role = "";
        named.nameIndex = -1;
        named.roleIndex = -1;
      }
    }
    if (!profile.contact.name && letter && letter.signer &&
        /^[A-ZÄÖÜ][\wäöüß.'-]+(?:\s+[A-ZÄÖÜ][\wäöüß.'-]+){1,3}$/.test(letter.signer)) {
      profile.contact.name = letter.signer;
    }

    headerContact(rows, profile);

    if (letter && letter.paragraphs.length) profile.letter = letter;

    var current = null;      // laufender Abschnitt
    var event = null;        // laufende Station
    var pending = [];        // Zeilen ohne Datum, die auf ihre Station warten
    var pendingTitled = false;   // war die erste davon ein Titel?

    //  Zuruecklegen, bis die Station kommt, zu der die Zeile gehoert. Eine
    //  zweite Zeile wartet mit, wenn die erste ein Titel war oder die zweite
    //  direkt darunter steht: manche Vorlagen setzen Titel, Arbeitgeber und
    //  Zeitraum untereinander ("ARCHITEKTIN" / "Müller & Partner
    //  Architekten" / "01/20xx – heute"). Sonst ist die wartende Zeile ein
    //  Eintrag fuer sich – in einer Liste ohne Daten steht jede Zeile allein.
    //  Frueher ersetzte die neue Zeile die alte, und die alte war verloren.
    function hold(row, line, titled) {
      var entry = { text: line, x: row.x, y: row.y, page: row.page, size: row.size, bold: row.bold };
      var last = pending[pending.length - 1];
      var below = !!last && last.y && row.y && last.page === row.page &&
        Math.abs(last.y - row.y) <= Math.max(row.size || 10, last.size || 10) * 1.7;
      //  Folgt gleich darauf der Zeitraum, gehoeren die wartenden Zeilen zu
      //  dieser einen Station – auch wenn nichts hervorgehoben ist und Word
      //  zwischen die Absaetze Abstand gesetzt hat.
      var dated = cursor + 1 < rows.length && carriesDate(rows[cursor + 1].text) &&
        !headingOf(rows[cursor + 1].text);
      if (pending.length && pending.length < 2 && (pendingTitled || below || dated)) {
        pending.push(entry);
        return;
      }
      if (pending.length) closeEvent();
      pending = [entry];
      pendingTitled = !!titled;
    }
    var cursor = 0;          // welche Zeile gerade gelesen wird
    var buffer = [];         // Zeilen des Abschnitts ausserhalb einer Station
    var stopped = false;
    var stopIndex = rows.length;
    var sawHeading = false;  // wurde ueberhaupt eine Ueberschrift gefunden?

    //  Wo der Text einer Station anfaengt. Was weiter eingerueckt darunter
    //  steht, ist eine Aufzaehlung – auch wenn die Punkte davor nur
    //  gezeichnet waren und im Text fehlen.
    function noteIndent(target, row, line) {
      if (!target || target.textX !== undefined || !row || !row.x) return;
      if (LEADING.test(line) || RANGE.test(line.split("\t")[0]) || SINGLE.test(line)) return;
      target.textX = row.x;
    }

    //  Eine neue Station beginnt: was zurueckgestellt wurde, gehoert zu ihr.
    //  Erst uebernehmen, dann die vorige schliessen – closeEvent macht aus
    //  einer liegengebliebenen Zeile sonst eine eigene Station.
    //  Wieviele Zeilen stehen in diesem Dokument ueber einem Zeitraum, der
    //  allein in seiner Zeile steht? "Senior UX Designerin" / "Pflegewerk
    //  GmbH | Hamburg" / "03/2021 – heute" sind zwei. Gelernt an der ersten
    //  solchen Station; daran erkennt sich die naechste, auch wenn nichts
    //  an ihr hervorgehoben ist.
    var headSize = 0;

    //  Und wie sieht hier ein Stationstitel aus? Die erste Station, deren
    //  Titel sich vom Fliesstext abhebt (fetter, groesser), sagt es. Danach
    //  eroeffnet jede Zeile in genau dieser Schrift die naechste Station –
    //  auch dort, wo der Titel nur fett in Grundschrift steht, was fuer die
    //  allgemeine Regel zu wenig ist.
    var titleStyle = null;

    function titleLike(row) {
      if (!titleStyle || !row.size) return false;
      return !!row.bold === titleStyle.bold && Math.abs(row.size - titleStyle.size) < 0.3 &&
        clean(row.text).length <= 80 && !/^[-–—•*·]/.test(clean(row.text));
    }

    function dateOnly(text) {
      var value = clean(text).replace(SINCE, "");
      var range = value.match(RANGE);
      if (range) return !clean(value.replace(range[0], "").replace(/^[|–—,\t-]\s*/, ""));
      return SINGLE.test(value);
    }

    function dateOnlyAhead(from, span) {
      for (var i = from; i < rows.length && i < from + span; i++) {
        var text = clean(rows[i].text);
        if (/^[-–—•*·]/.test(text) || headingOf(text)) return false;
        if (dateOnly(text)) return true;
        if (carriesDate(text)) return false;
      }
      return false;
    }

    function startEvent(row, line) {
      var carried = pending;
      pending = [];
      pendingTitled = false;
      if (carried.length && line && dateOnly(line)) headSize = Math.max(headSize, carried.length);
      var first = carried[0];
      if (!titleStyle && first && first.size &&
          (first.bold || first.size >= bodyFor(first) * 1.08) && !/^[A-ZÄÖÜ][\wäöüß ]{2,24}:\s/.test(first.text)) {
        titleStyle = { size: first.size, bold: !!first.bold };
      }

      closeEvent();
      event = newEvent(current);

      carried.forEach(function (entry) {
        noteIndent(event, entry, entry.text);
        assignStationLine(event, entry.text);
      });
      if (row) noteIndent(event, row, line);
      return event;
    }

    function closeEvent() {
      //  Blieb eine zurueckgestellte Zeile ohne Station, ist sie selbst eine:
      //  "Engagement im Sportverein" unter "Ehrenamt" hat kein Datum und
      //  bleibt trotzdem ein Eintrag.
      if (pending.length && !event) {
        event = newEvent(current || "experience");
        pending.forEach(function (entry) { assignStationLine(event, entry.text); });
      }
      pending = [];
      pendingTitled = false;

      //  Stand am Ende nur die Einrichtung da ("Engagement im Sportverein"),
      //  ist sie der Eintrag – eine Station ohne Titel zeigt nichts an.
      if (event && !clean(event.title) && clean(event.company)) {
        event.title = event.company;
        event.company = "";
      }
      if (event && (event.title || event.company)) profile.events.push(event);
      event = null;
    }

    function flushBuffer() {
      if (!current || !buffer.length) { buffer = []; return; }
      var joined = buffer.map(function (row) { return row.text; }).join("\n");

      if (current === "profile") {
        //  Im PDF bricht ein Satz mitten im Wort um – daraus wird wieder
        //  ein Absatz.
        profile.profileText = clean(profile.profileText + " " + joined.replace(/\n/g, " "))
          .replace(/\s+/g, " ").trim();
      } else if (current === "skills") {
        skillEntries(buffer).forEach(function (entry) { profile.skills.push(entry); });
      } else if (current === "interests") {
        listItems(joined).forEach(function (name) { profile.interests.push({ name: name }); });
      } else if (current === "mobility") {
        //  "Führerschein Klasse B, C1" ist eine Angabe: das Komma trennt
        //  hier Klassen, keine Eintraege.
        joined.split(/\n|\t|[;•·|]/).map(clean).filter(Boolean).forEach(function (name) {
          profile.mobility.push({ name: name.replace(/^[-–—*]\s*/, "") });
        });
      } else if (current === "languages") {
        //  "Deutsch" / "(Muttersprache)" untereinander ist ein Umbruch,
        //  keine zweite Sprache. Und "Deutsch<TAB>Muttersprache" ist eine
        //  Sprache mit Stufe, keine zwei Sprachen: zweispaltige Listen sind
        //  in Lebenslaeufen die Regel, nicht die Ausnahme.
        //  Europass beschriftet: "Mother tongue(s)  Portuguese",
        //  "Other language(s)  English – C1". Die Beschriftung sagt bei der
        //  Muttersprache die Stufe, sonst nichts.
        joined = joined.split("\n").map(function (line) {
          var native = line.match(/^(?:mother tongues?(?:\(s\))?|muttersprachen?(?:\(n\))?|native languages?)\s*:?\s+(.+)$/i);
          if (native) return native[1].split(/\s*,\s*/).map(function (name) {
            return name + " (" + (/^[a-z]/i.test(line) && /mother|native/i.test(line) ? "native" : "Muttersprache") + ")";
          }).join("\n");
          return line.replace(/^(?:other languages?(?:\(s\))?|weitere sprachen|fremdsprachen)\s*:?\s+/i, "");
        }).join("\n");
        var glued = pairColumns(joined).replace(/\n\s*\(/g, " (");
        languageEntries(glued).forEach(function (entry) {
          profile.languages.push(entry);
        });
      } else if (current === "projects") {
        collectProjects(buffer, bodySize).forEach(function (project) {
          profile.projects.push(project);
        });
      }
      buffer = [];
    }

    //  Der Inhalt einer Zeile – getrennt vom Erkennen der Ueberschrift,
    //  weil hinter einer Beschriftung derselbe Inhalt stehen kann:
    //  "Ehrenamt    Engagement im Sportverein".
    function content(row, text) {
      var line = clean(text);
      if (!line) return;

      //  Kopf- und Fusszeilen wiederholen Name und Kontakt. In einer Liste
      //  von Kenntnissen hat beides nichts verloren.
      if (LIST_SECTIONS.indexOf(current) !== -1 && isContactLine(line, profile)) return;

      //  In der Projektliste ist eine Adresse das Ziel des Projekts, sonst
      //  ein Link fuer die Fussleiste. Eine Fussleiste setzt ihre Links
      //  gern nebeneinander, deshalb wird an der Spalte zerlegt.
      if (current !== "projects") {
        var parts = line.split("\t").map(clean).filter(Boolean);
        var onlyLinks = parts.length && parts.every(function (part) {
          return LINK_LINE.test(part) || NETWORK_NAME.test(part);
        });

        if (onlyLinks) {
          parts.forEach(function (part) {
            if (!LINK_LINE.test(part)) return; // blosser Name ohne Ziel
            profile.links.push({
              label: shortUrl(part).split("/")[0],
              text: shortUrl(part),
              url: /^https?:\/\//i.test(part) ? part : "https://" + part,
            });
          });
          return;
        }
      }

      if (isStationSection(current)) {
        //  "seit 04/2021 Teamleiterin" – das Wort davor sagt nur, dass die
        //  Station noch laeuft. Ohne diese Regel faellt die Zeile durch alle
        //  Muster, und ihr Inhalt haengt sich an die Station darunter.
        var since = line.match(SINCE);
        if (since) {
          var before = event;
          content(row, line.slice(since[0].length));

          //  Offen ist nur die Station, die diese Zeile eroeffnet hat. Haengt
          //  der Rest an der Station darueber, bleibt deren Ende stehen.
          if (event && event !== before && !event.end) event.present = true;
          return;
        }

        //  Erst die Fortsetzung: "– 09/15 ZOOLINO, Bad Wimpeln" schliesst die
        //  Station darueber ab. Ohne diese Regel faengt hier eine neue an –
        //  mit einem Gedankenstrich als Titel.
        var continues = event && line.match(CONTINUES);
        if (continues) {
          if (isPresent(continues[1])) event.present = true;
          else event.end = normDate(continues[1]);
          if (continues[2]) assignStationLine(event, continues[2]);
          return;
        }

        var range = line.match(RANGE);
        if (range) {
          //  Ein vollstaendiger Zeitraum beginnt immer eine neue Station.
          startEvent(row, line);
          event.start = normDate(range[1]);
          event.present = isPresent(range[2]);
          event.end = event.present ? "" : normDate(range[2]);
          var rest = clean(line.replace(range[0], "").replace(/^[|–—,\t-]\s*/, "")
            .replace(/\s*[|–—,-]\s*$/, ""));
          if (rest) assignStationLine(event, rest);
          return;
        }

        //  "Danggeun Pay Inc.        Seoul, S.Korea" – eine Kopfzeile ohne
        //  Datum, wie englische Vorlagen sie ueber jede Station setzen. Sie
        //  beendet die vorige Station und wartet auf die naechste, statt als
        //  Beschreibung an der falschen zu haengen.
        if (line.indexOf("\t") !== -1 && !carriesDate(line)) {
          var head = line.split("\t").map(clean).filter(Boolean);
          if (head.length === 2 && head[1].length <= 30 && !/\d/.test(head[1]) &&
              head[0].length > 2) {
            //  Hat die laufende Station gerade erst ihren Titel samt
            //  Zeitraum bekommen und noch keinen Arbeitgeber, ist das hier
            //  ihre zweite Zeile: "Software Engineer   Jun 2021 – Present" /
            //  "Northwind Labs   Remote". So setzen es die meisten
            //  amerikanischen Vorlagen.
            if (event && event.title && !event.company && !event.list.length &&
                !event.description.length && (event.start || event.present)) {
              event.company = head[0];
              event.place = head[1];
              return;
            }
            closeEvent();
            hold(row, line, true);
            return;
          }
        }

        //  "DevOps Engineer   Sep. 2023 Mar. 2024" – zwei Daten am Zeilenende,
        //  dazwischen fehlt nur der Strich.
        var loose = line.match(LOOSE_RANGE);
        if (loose && !isPresent(loose[2])) {
          startEvent(row, line);
          event.start = normDate(loose[2]);
          event.present = isPresent(loose[3]);
          event.end = event.present ? "" : normDate(loose[3]);
          if (clean(loose[1])) assignStationLine(event, loose[1]);
          return;
        }

        var leading = line.match(LEADING);
        if (leading) {
          startEvent(row, line);
          event.start = normDate(leading[1]);
          assignStationLine(event, leading[2]);
          return;
        }

        var single = line.match(SINGLE);
        if (single) {
          startEvent(row, line);
          event.start = normDate(single[1]);
          return;
        }

        var trailing = trailingDate(line);
        //  "Teamleiterin Einkauf   seit 05/2022": das "seit" steht vor dem
        //  Datum am Zeilenende und sagt nur, dass die Station noch laeuft.
        var ongoing = trailing && !trailing.isEnd && trailing.rest.match(/\s*\b(seit|since|ab|from)$/i);
        if (ongoing) trailing.rest = clean(trailing.rest.slice(0, ongoing.index));
        if (trailing) {
          //  "ZOOLINO, Bad Wimpeln – 09/15" schliesst die Station ab,
          //  "Praktikum 07/13" beginnt eine neue.
          if (trailing.isEnd && event) {
            event.end = trailing.date;
            event.present = trailing.present;
            if (trailing.rest) assignStationLine(event, trailing.rest);
          } else {
            startEvent(row, line);
            if (trailing.present) event.present = true;
            else event.start = trailing.date;
            if (ongoing) event.present = true;
            if (trailing.rest) assignStationLine(event, trailing.rest);
          }
          return;
        }

        //  Eine Zeile ohne Datum, waehrend keine Station offen ist: In
        //  englischen Lebenslaeufen steht dort der Arbeitgeber, und die
        //  Taetigkeit mit dem Zeitraum kommt erst darunter
        //  ("UBS INVESTMENT BANK, New York" / "Summer Associate  2016").
        //  Sie wird deshalb zurueckgestellt und der naechsten Station
        //  vorangestellt – kommt keine, wird sie selbst zur Station.
        if (!event) {
          hold(row, line, startsEntry(row, bodyFor(row)) || row.bold);
          return;
        }

        //  Dasselbe, waehrend eine Station laeuft: Word-Vorlagen setzen den
        //  Titel ueber die Station und Arbeitgeber samt Zeitraum darunter
        //  ("Krankenschwester" / "Seniorenresidenz Sonnenhof | 20XX – 20XX").
        //  Eine hervorgehobene kurze Zeile ohne Datum gehoert dann der
        //  naechsten Station. Ohne diese Regel haengt sie als Beschreibung
        //  an der vorigen, und samtliche Titel liegen eine Station zu tief.
        if ((startsEntry(row, bodyFor(row)) || titleLike(row)) && stationFilled(event)) {
          closeEvent();
          hold(row, line, true);
          return;
        }

        //  Ohne jede Hervorhebung bleibt der Aufbau: steht nach so vielen
        //  Zeilen, wie die Stationen hier ueber ihrem Zeitraum tragen, ein
        //  Zeitraum fuer sich, beginnt mit dieser Zeile die naechste. Nicht
        //  aber, wenn eine der Zeilen dazwischen hervorgehoben ist – dann
        //  beginnt die Station dort – und nicht bei einer Angabe mit
        //  Beschriftung ("Abschlussnote: 1,8"), die immer zur Station
        //  darueber gehoert.
        var deeper = event.textX !== undefined && row.x &&
          row.x > event.textX + Math.max(3, (row.size || 10) * 0.6);
        var boldAhead = !row.bold && rows.slice(cursor + 1, cursor + 1 + headSize)
          .some(function (next) { return next.bold && !dateOnly(next.text); });
        if (headSize && stationFilled(event) && !deeper && !boldAhead &&
            !/^[-–—•*·]/.test(line) && !/^[A-ZÄÖÜ][\wäöüß ]{2,24}:\s/.test(line) &&
            dateOnlyAhead(cursor + 1, headSize)) {
          closeEvent();
          hold(row, line, false);
          return;
        }
      }

      if (event) {
        var indented = event.textX !== undefined && row.x &&
          row.x > event.textX + Math.max(3, (row.size || 10) * 0.6);
        var marked = /^[-–—•*·▪◦‣➢➤✓]\s*/.test(line);
        var item = line.replace(/^[-–—•*·▪◦‣➢➤✓]\s*/, "");
        var last = event.list.length - 1;
        var wasItem = event.lastWasItem;
        event.lastWasItem = true;
        if (!marked && indented && wasItem && /^[a-zäöüß(]/.test(item)) {
          //  Ein umbrochener Punkt: klein weitergeschrieben, gleich tief.
          event.list[last] = joinLines([event.list[last], item]);
        } else if (marked || (indented && (event.company || event.list.length ||
                                           event.description.length))) {
          event.list.push(item);
        } else {
          //  Wo der letzte gewoehnliche Text der Station stand, ist ihre
          //  Textspalte. Manche Vorlagen ruecken den Arbeitgeber unter dem
          //  Titel ein – dann gilt ab da dessen Einzug.
          event.lastWasItem = false;
          if (row.x) event.textX = row.x;
          assignStationLine(event, line);
        }
        return;
      }

      if (current) {
        buffer.push({ text: line, size: row.size, bold: row.bold,
                      x: row.x, y: row.y, page: row.page });
      }
    }

    var page = null;

    function farBelow(row) {
      var tail = buffer[buffer.length - 1];
      if (!tail || !tail.y || !row.y || tail.page !== row.page) return false;
      var jump = tail.y - row.y;
      var steps = [];
      for (var i = 1; i < buffer.length; i++) {
        if (buffer[i].page === buffer[i - 1].page) steps.push(buffer[i - 1].y - buffer[i].y);
      }
      var size = row.size || 10;
      if (steps.length >= 2) return jump > Math.max(Math.max.apply(null, steps) * 2, size * 4);
      return jump > size * 8;
    }

    //  Steht in den naechsten Zeilen ein Zeitraum?
    function dateWithin(from, span) {
      for (var i = from; i < rows.length && i < from + span; i++) {
        if (carriesDate(rows[i].text)) return true;
      }
      return false;
    }

    rows.forEach(function (row, index) {
      if (stopped) return;
      cursor = index;
      var line = row.text;

      //  Ein Seitenwechsel beendet die Listenabschnitte. Stationen laufen
      //  ueber Seiten hinweg weiter, Kenntnisse und Interessen nicht – und
      //  auf dem naechsten Blatt faengt sonst gern ein Anschreiben an,
      //  dessen Briefkopf dann unter "Mobilität" landet.
      //  Stand die Ueberschrift allein unten auf dem Blatt, gehoert der
      //  Inhalt oben auf dem naechsten noch zu ihr.
      //  Und steht die erste Zeile des neuen Blattes genau dort, wo die
      //  letzte des Abschnitts stand – gleiche Flucht, gleiche Schrift –,
      //  laeuft die Liste einfach weiter.
      var tail = buffer[buffer.length - 1];
      var runsOn = !!tail && tail.x !== undefined && Math.abs(tail.x - row.x) <= 8 &&
        Math.abs((tail.size || 0) - (row.size || 0)) < 0.5 && !carriesDate(row.text) &&
        !headingOf(row.text);
      if (page !== null && row.page !== page && buffer.length && !runsOn &&
          current && LIST_SECTIONS.indexOf(current) !== -1) {
        closeEvent(); flushBuffer();
        current = null;
      }
      page = row.page;

      //  Das erkannte Anschreiben ist schon heraus. Steht trotzdem noch eine
      //  Anrede da, beginnt dort ein Brief, der sich nicht lesen liess; ab
      //  der Schlussformel ("Ort, Datum") steht nur noch die Unterschrift.
      //  Beides gehoert nicht in den Lebenslauf.
      if (isGreeting(line) || CLOSING.test(line)) {
        closeEvent(); flushBuffer(); stopped = true; stopIndex = index; return;
      }

      //  Mit dem Namen faengt der Hauptteil an. Was davor lief – in
      //  zweispaltigen Vorlagen die Seitenspalte – ist damit zu Ende; sonst
      //  landet die Rolle darunter ("ZUGBEGLEITER") als dritter Eintrag in
      //  der Projektliste.
      if (named.nameIndex >= 0 && index === named.nameIndex) {
        closeEvent(); flushBuffer(); current = null;
      }

      if (index === named.roleIndex) return;
      if (named.nameIndex >= 0 && index >= named.nameIndex &&
          index <= (named.nameEnd === undefined ? named.nameIndex : named.nameEnd)) return;

      var styled = looksLikeHeading(row, bodyFor(row), style);

      //  Beschriftung und Inhalt nebeneinander: die Beschriftung sagt, wohin
      //  es gehoert, der Wert ist der Inhalt.
      var label = labelSplit(line);
      if (label) {
        var labelRole = headingOf(label.label);

        //  "Software Developer<TAB>03/2016 – 07/2018" ist eine Station,
        //  keine Ueberschrift – auch wenn "Software" als Ueberschrift fuer
        //  Kenntnisse durchgeht. Eine Ueberschrift traegt kein Datum neben
        //  sich; frueher riss so ein Stationstitel den Abschnitt auf, und
        //  der Rest des Werdegangs landete unter Kenntnissen.
        if (labelRole && carriesDate(label.value)) labelRole = null;

        //  "Ehrenamt<TAB>Chorleitung, Volleyball, Imkerei" mitten in einer
        //  Liste ist eine Zeile dieser Liste und keine neue Station: eine
        //  Aufzaehlung hat keinen Zeitraum und keinen Arbeitgeber. Steht dort
        //  dagegen eine einzelne Angabe ("Ehrenamt<TAB>Jugendtrainerin im
        //  Turnverein"), bleibt es dabei, dass die Beschriftung den Abschnitt
        //  aufmacht.
        if (labelRole && LIST_SECTIONS.indexOf(current) !== -1 &&
            LIST_SECTIONS.indexOf(labelRole) === -1 && enumeration(label.value)) {
          labelRole = null;
          content(row, label.value);
          return;
        }

        if (labelRole) {
          closeEvent(); flushBuffer();
          sawHeading = true;
          current = labelRole === "ignore" ? null : labelRole;
          //  Beim Fuehrerschein gehoert die Beschriftung zum Inhalt:
          //  "Führerschein Klasse B" ist der ganze Eintrag.
          if (current === "mobility") content(row, label.label + " " + label.value);
          else if (current) content(row, label.value);
          return;
        }

        //  Traegt die Beschriftung keine Bedeutung, bleibt sie stehen: der
        //  Tabulator kann auch zwei nebeneinander gesetzte Eintraege
        //  trennen ("Modelleisenbahn    Klemmbausteine"), und dann waere
        //  das Weglassen der linken Spalte ein Datenverlust.
      }

      //  "Sprachen: Deutsch, Englisch" – dieselbe Beschriftung mit
      //  Doppelpunkt, wie sie in eingefuegtem Text und in Kenntnislisten
      //  steht. Innerhalb einer laufenden Station ist sie dagegen Teil der
      //  Station ("Tools: Jira, Confluence" unter einer Stelle).
      var colon = !label && !(isStationSection(current) && event) && colonLabel(line);
      if (colon) {
        var colonRole = headingOf(colon.label);
        //  In einer Kenntnisliste sind "Languages:", "Tools:" und
        //  "Frameworks:" Gruppen dieser Liste. Nur echte Sprachen machen
        //  aus "Sprachen:" den Sprachenblock.
        var grouped = current === "skills" && colonRole !== "mobility" &&
          !(colonRole === "languages" && NATURAL_LANGUAGE.test(colon.value));
        if (grouped || colonRole === current) {
          content(row, current === "mobility" ? colon.label + " " + colon.value : colon.value);
          return;
        }
        if (colonRole && colonRole !== "ignore" && !carriesDate(colon.value)) {
          closeEvent(); flushBuffer();
          sawHeading = true;
          current = colonRole;
          if (current === "mobility") content(row, colon.label + " " + colon.value);
          else content(row, colon.value);
          return;
        }
      }

      //  "Führerschein Klasse B" steht, wo Platz war – unter Kenntnissen,
      //  unter Sonstiges, hinter den Sprachen. Es gehoert immer zur
      //  Mobilitaet, und der laufende Abschnitt bleibt, wie er ist.
      if (current !== "mobility" && /^(f(?:ü|ue)hrerschein|fahrerlaubnis|driving licen[cs]e)\b\s*:?\s*\S/i.test(line) &&
          !carriesDate(line) && !(isStationSection(current) && event)) {
        profile.mobility.push({ name: clean(line.replace(/\t+/g, " ").replace(/^([^:]+):\s*/, "$1 ")) });
        return;
      }

      //  "Ausbildung" ist eine Ueberschrift, "Ausbildung zum Berufstaucher"
      //  ist eine Station. Liegen Schriftgrade vor, entscheidet das Layout;
      //  sonst die Kuerze der Zeile.
      //  Ueberschrift und erster Eintrag in derselben Zeile: erst die
      //  Ueberschrift setzen, dann den Rest als Inhalt behandeln.
      var glued = splitLeadingHeading(line);
      if (glued) {
        closeEvent(); flushBuffer();
        sawHeading = true;
        current = glued.role;
        //  Die Zeile beginnt mit der Ueberschrift im Rand – wo ihr Text
        //  anfaengt, ist damit unbekannt.
        content(Object.assign({}, row, { x: 0 }), glued.rest);
        return;
      }

      var keyword = headingOf(line);
      var heading = null;
      if (keyword && (styled || headingShape(line) || !bodySize)) heading = keyword;
      else if (styled) heading = headingInside(line);

      if (heading) {
        closeEvent(); flushBuffer();
        sawHeading = true;
        current = heading === "ignore" ? null : heading;
        return;
      }

      //  In der Projektliste ist eine hervorgehobene Zeile der Projektname
      //  und keine neue Ueberschrift – dort endet der Abschnitt erst bei
      //  einer bekannten Ueberschrift. Ueberall sonst beendet eine
      //  unbekannte Ueberschrift den Abschnitt, sonst sammelt er den Rest
      //  des Blattes ein.
      if (current !== "projects" && styled) {
        //  In einer Stationsliste ist eine hervorgehobene Zeile aber oft
        //  der Titel der naechsten Station: Word-Vorlagen setzen
        //  "ARCHITEKTIN" in genau derselben Schrift wie
        //  "BERUFSERFAHRUNG". Wer nur die Schrift misst, wirft den halben
        //  Werdegang weg. Was darunter steht, entscheidet: folgt in den
        //  naechsten Zeilen ein Zeitraum, war es ein Titel.
        if (isStationSection(current) && dateWithin(index + 1, 3)) {
          closeEvent(); flushBuffer();
          hold(row, line, true);
          return;
        }

        closeEvent(); flushBuffer();
        current = null;
        return;
      }

      //  Ein grosser Sprung nach unten beendet eine Liste: darunter steht
      //  die Fusszeile ("Mehr dazu im Portfolio: …"), nicht das naechste
      //  Projekt. Gemessen am Abstand, den die Liste bisher hatte – manche
      //  Vorlagen setzen ihre Eintraege weit auseinander.
      if (LIST_SECTIONS.indexOf(current) !== -1 && farBelow(row)) {
        flushBuffer();
        current = null;
      }

      content(row, line);
    });

    closeEvent();
    flushBuffer();

    //  Manche PDFs enthalten ihre Ueberschriften gar nicht als Text: wird
    //  fett gesetzter Text beim Druck als Vektorkontur gezeichnet – Firefox
    //  macht das mit variablen Schriften –, fehlen Name, Ueberschriften und
    //  Titel vollstaendig. Dann bleibt der Aufbau aus Datum, Arbeitgeber
    //  und Beschreibung, und der ist immer noch etwas wert.
    if (!sawHeading && !profile.events.length) {
      current = "experience";
      event = null;
      var lastY = null;
      var lastPage = null;

      //  Im Notlauf wird keine Zeile als Name ausgespart: was ohne
      //  Ueberschriften als Name geraten wurde, war ohnehin nur die erste
      //  brauchbare Zeile – und die gehoert meistens zum Inhalt.
      rows.forEach(function (row, index) {
        if (index >= stopIndex) return;
        cursor = index;

        var line = row.text;
        var carriesDate = RANGE.test(line) || SINGLE.test(line) ||
                          LEADING.test(line) || !!trailingDate(line);

        //  Ein grosser senkrechter Sprung heisst: hier endet der Block.
        //  Ohne das sammelt die letzte Station den Rest des Blattes ein.
        if (event && row.size && lastY !== null &&
            (row.page !== lastPage || Math.abs(lastY - row.y) > row.size * 3)) {
          closeEvent();
        }

        if (!carriesDate && !event) return;

        content(row, line);
        lastY = row.y;
        lastPage = row.page;
      });

      closeEvent();
      if (profile.events.length) {
        profile.warnings.push("noStructure");
        //  Stand der Name in derselben fett gesetzten Ebene wie die
        //  Ueberschriften, fehlt er ebenfalls – und was hier geraten wurde,
        //  ist dann ein Satzanfang aus dem Profiltext.
        profile.contact.name = "";
        profile.contact.role = "";
      }
    }

    if (profile.events.length) profile.warnings.push("draft");
    return profile;
  }

  //  Ein Projekt ist ueblich gesetzt: Name hervorgehoben (groesser, in
  //  Grossbuchstaben oder eine Adresse), darunter ein paar Zeilen Text.
  //  Ohne diese Unterscheidung wird aus jeder Zeile ein eigenes Projekt.
  function collectProjects(rows, bodySize) {
    var projects = [];
    var current = null;

    function isName(row) {
      var value = clean(row.text);
      if (!value) return false;
      if (/https?:\/\//.test(value)) return true;
      if (/^[\w.-]+\.(de|com|org|net|io|dev|eu|ch|at)$/i.test(value)) return true;
      if (bodySize && row.size > bodySize * 1.1) return true;
      //  Viele Vorlagen setzen den Projektnamen nicht groesser, sondern
      //  fett. Ohne das wird aus drei Projekten eines mit einer sehr
      //  langen Beschreibung.
      if (row.bold && value.length < 60) return true;
      return value.length < 40 && value === value.toUpperCase() && /[A-ZÄÖÜ]/.test(value);
    }

    rows.forEach(function (row) {
      var value = clean(row.text).replace(/\t+/g, " ");
      if (!value) return;

      if (isName(row) || !current) {
        //  "Tidepool | Rust, WebAssembly   Jan. 2023 – Present": der
        //  Zeitraum hat in der Projektliste keinen Platz, und hinter dem
        //  Strich steht, womit es gebaut ist – das ist Beschreibung.
        var range = value.match(RANGE);
        if (range && value.indexOf(range[0]) > 0) value = clean(value.replace(range[0], ""));
        var stack = "";
        var piped = value.match(/^(.{2,60}?)\s+[|–—]\s+(.{2,80})$/);
        if (piped && !/https?:/.test(piped[1])) { value = piped[1]; stack = clean(piped[2]); }

        var url = (value.match(/https?:\/\/\S+/) || [""])[0];
        var name = clean(value.replace(url, "")) || shortUrl(url);
        if (!url && /^[\w.-]+\.(de|com|org|net|io|dev|eu|ch|at)$/i.test(name)) {
          url = "https://" + name.toLowerCase();
        }
        //  y und Seite bleiben stehen: daran wird gleich das Bild
        //  gefunden, das neben dem Projekt liegt.
        current = { name: name.slice(0, 60), url: url, description: stack ? stack + " –" : "",
                    img: "", y: row.y || 0, page: row.page || 1 };
        projects.push(current);
        return;
      }

      current.description = clean(current.description + " " + value);
    });

    return projects.filter(function (project) {
      project.description = project.description.replace(/\s+–$/, "");
      return project.name;
    });
  }

  //  Der Name ist die groesste Schrift auf dem Blatt – das gilt quer durch
  //  alle Vorlagen und ist verlaesslicher als "steht oben": in
  //  zweispaltigen Lebenslaeufen kommt zuerst die Seitenspalte. Fehlen die
  //  Schriftgrade, bleibt es bei der Suche von oben.
  function findName(rows, bodySize) {
    //  "PERSONAL INFORMATION<TAB>Inês Carvalho" – Europass setzt die
    //  Beschriftung links neben den Namen.
    function nameText(row) {
      var parts = String(row.text).split("\t").map(clean).filter(Boolean);
      return parts.length === 2 && headingOf(parts[0]) ? parts[1] : row.text;
    }

    function usable(row, maxWords, allowSpaced) {
      var value = clean(nameText(row));
      if (!value || /[@|]/.test(value) || /\d/.test(value)) return false;
      //  Ein Aufzaehlungspunkt ist nie ein Name.
      if (/^[-–—•*·]/.test(value)) return false;
      if (value.split(/\s+/).length > (maxWords || 5) || value.length > 48) return false;
      //  Gesperrter Satz spricht gegen einen Namen – bei der Rolle darunter
      //  ist er dagegen die Regel ("Z U G B E G L E I T E R").
      return !headingOf(value) && (allowSpaced || !row.spaced);
    }

    if (bodySize) {
      var best = -1;
      rows.forEach(function (row, index) {
        if (!usable(row) || row.size <= bodySize) return;
        if (best < 0 || row.size > rows[best].size) best = index;
      });

      if (best >= 0) {
        //  Steht rechts daneben noch etwas ("DAN BULLDOG   Finance"), gehoert
        //  nur die erste Spalte zum Namen.
        var name = nameText(rows[best]).split("\t")[0].trim();
        var after = best + 1;
        if (rows[after] && usable(rows[after]) &&
            Math.abs(rows[after].size - rows[best].size) <= rows[best].size * 0.05 &&
            (name + " " + rows[after].text).split(/\s+/).length <= 4) {
          name += " " + rows[after].text;
          after++;
        }

        //  Die Rolle steht direkt darunter: kurz, keine Ueberschrift.
        var roleIndex = -1;
        for (var i = after; i < Math.min(rows.length, after + 2); i++) {
          if (usable(rows[i], 5, true) && rows[i].size < rows[best].size) {
            roleIndex = i;
            break;
          }
        }

        return {
          name: name,
          role: roleIndex >= 0 ? rows[roleIndex].text : "",
          nameIndex: best,
          nameEnd: after - 1,
          roleIndex: roleIndex,
          bySize: true,
        };
      }
    }

    //  Ohne Schriftgrade als Anhalt ist jede kurze Zeile ein Kandidat –
    //  dann darf es wenigstens kein ganzer Satz sein. Drei Woerter reichen
    //  fuer einen Namen.
    //  Eine Zeile mit Beschriftung ("Name<TAB>Jonas Weber",
    //  "Staatsangehörigkeit<TAB>deutsch") ist kein Name und keine Rolle.
    var candidates = [];
    for (var n = 0; n < Math.min(rows.length, 14) && candidates.length < 3; n++) {
      if (/\t|:/.test(rows[n].text)) continue;
      if (usable(rows[n], 3)) candidates.push({ text: rows[n].text, index: n });
    }

    function oneWord(entry) {
      return !!entry && /^[A-ZÄÖÜ][^\s]*$/.test(entry.text);
    }

    //  In schmalen Spalten bricht der Name um, dann stehen Vor- und
    //  Nachname untereinander.
    if (oneWord(candidates[0]) && oneWord(candidates[1])) {
      return {
        name: candidates[0].text + " " + candidates[1].text,
        role: candidates[2] ? candidates[2].text : "",
        nameIndex: candidates[0].index,
        roleIndex: candidates[1].index,
      };
    }

    return {
      name: candidates[0] ? candidates[0].text : "",
      role: candidates[1] ? candidates[1].text : "",
      nameIndex: candidates[0] ? candidates[0].index : -1,
      roleIndex: candidates[1] ? candidates[1].index : -1,
    };
  }

  //  Eine Telefonnummer ist entweder eine Zeile, die aus nichts anderem
  //  besteht, oder steht hinter einer Beschriftung. Alles andere waere
  //  geraten – eine Hausnummer neben einer Postleitzahl sieht sonst
  //  taeuschend aehnlich aus.
  function findPhone(lines) {
    var labelled = null;
    var standalone = null;

    lines.forEach(function (raw) {
      var line = clean(raw);
      if (!line) return;

      var label = line.match(/(?:tel|telefon|phone|mobil|handy|fon)[.:\s]*([+(]?[\d][\d\s().\/-]{6,})$/i);
      if (label && !labelled) labelled = clean(label[1]);

      if (!standalone && /^[+(]?[\d][\d\s().\/-]{6,}$/.test(line) &&
          (line.match(/\d/g) || []).length >= 7) {
        standalone = line;
      }
    });

    return labelled || standalone || "";
  }

  //  Anschrift: gesucht wird die Zeile "PLZ Ort"; die Zeile davor ist die
  //  Strasse, sofern sie wie eine aussieht. Beides kann auch in einer
  //  Zeile stehen ("Musterstrasse 4, 12345 Musterstadt").
  function findAddress(lines) {
    var found = { address: "", city: "" };

    for (var i = 0; i < lines.length; i++) {
      var line = clean(lines[i]).replace(/,\s*$/, "");

      var together = line.match(/^(.{3,60}?),\s*(\d{4,5}\s+[A-ZÄÖÜ][\wäöüßA-ZÄÖÜ.()\- ]{2,})$/);
      if (together && /\d/.test(together[1])) {
        found.address = clean(together[1]);
        found.city = clean(together[2]);
        return found;
      }

      //  "Lower Piddling, LP3 4RW", "Seattle, WA 98101", "SW1A 1AA London":
      //  britische und amerikanische Anschriften tragen die Postleitzahl
      //  hinter dem Ort.
      var foreign = /^[A-Z][\w .'-]{1,40},\s*(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/.test(line) ||
        /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\s+[A-Z][a-z]/.test(line);
      if (!foreign && !/^\d{4,5}\s+[A-ZÄÖÜ][\wäöüßA-ZÄÖÜ.\- ]{2,}$/.test(line)) continue;

      found.city = line;
      var before = clean(lines[i - 1] || "").replace(/,\s*$/, "");
      if (before && !/[@]/.test(before) && !headingOf(before) &&
          (/\d/.test(before) || /(stra(ß|ss)e|str\.|weg|allee|platz|gasse|ring|damm)/i.test(before))) {
        found.address = before;
      }
      break;
    }

    return found;
  }

  //  Woran man einen Arbeitgeber oder eine Schule erkennt. Steht so etwas
  //  in der ersten Zeile einer Station, ist es die Einrichtung und nicht
  //  die Taetigkeit – die kommt dann eine Zeile spaeter.
  var ORGANISATION = /(gmbh|mbh|\bllc\b|\bplc\b|\bcorp\b|corporation|insurance|\bbank\b|\bgroup\b|\blabs?\b|foundation|stiftung|hospital|college|\bschool\b|\bag\b|\bkg\b|\bse\b|\bohg\b|\be\.?\s?v\b|\binc\b|\bltd\b|schule|gymnasium|universit|hochschule|akademie|institut|klinik|krankenhaus|betrieb\b|werke?\b|zentrum|verein|kanzlei|praxis|agentur|\bamt\b|bundes|stadt\b|gemeinde)/i;

  function splitPlace(event, value) {
    var parts = value.split(/\s*[|·]\s*|,\s(?=[^,]*$)/);
    event.company = clean(parts[0]);
    if (parts[1]) event.place = clean(parts[1]);
  }

  //  Sieht das aus wie ein Ort? "Hamburg", "Frankfurt (Oder)",
  //  "Toronto, ON", "Remote". Eine Einrichtung ist es jedenfalls nicht.
  function placeLike(value) {
    var text = clean(value);
    if (!text || text.length > 32 || ORGANISATION.test(text) || /\d/.test(text)) return false;
    return /^[A-ZÄÖÜ][\wäöüßéèáàóòúùç.'-]+(?:[ -][A-ZÄÖÜ(][\wäöüßéèáàóòúùç.()'-]+){0,2}(?:,\s*[A-Z]{2,3}|,\s*[A-ZÄÖÜ][\wäöüß]+)?$/.test(text);
  }

  //  Eine Kopfzeile in einem Stueck: "Fachkrankenpflegerin | Uniklinik
  //  Freiburg", "Senior Data Analyst, Maple Grocers Inc. — Toronto, ON".
  //  Getrennt wird an senkrechtem Strich, Mittelpunkt und langem
  //  Gedankenstrich; ein Ort steht hinten. Was bleibt, ist Taetigkeit und
  //  Einrichtung – in dieser Reihenfolge, ausser die erste gibt sich als
  //  Einrichtung zu erkennen.
  function splitHead(value) {
    var parts = value.split(/\s+[|·—]\s+/).map(clean).filter(Boolean);
    if (parts.length < 2) return null;

    var head = { title: "", company: "", place: "" };
    if (parts.length > 2 || placeLike(parts[parts.length - 1])) head.place = parts.pop();

    if (parts.length === 1) {
      //  "Senior Data Analyst, Maple Grocers Inc." – der Ort ist schon
      //  abgetrennt, also steht hinter dem Komma die Einrichtung.
      var comma = parts[0].match(/^(.{2,80}?),\s+(.{2,60})$/);
      if (!comma) return null;
      if (ORGANISATION.test(comma[1]) && !ORGANISATION.test(comma[2])) {
        head.company = comma[1];
        head.title = comma[2];
      } else {
        head.title = comma[1];
        head.company = comma[2];
      }
      return head;
    }

    if (ORGANISATION.test(parts[0]) && !ORGANISATION.test(parts[1])) {
      head.company = parts[0];
      head.title = parts[1];
    } else {
      head.title = parts[0];
      head.company = parts[1];
    }
    //  "St. Josefskrankenhaus, Freiburg": der Ort haengt an der Einrichtung.
    var located = !head.place && head.company.match(/^(.{2,60}),\s+([^,]{2,32})$/);
    if (located && placeLike(located[2])) {
      head.company = located[1];
      head.place = located[2];
    }
    return head;
  }

  function assignStationLine(event, line) {
    var raw = String(line);
    var value = clean(line).replace(/\t+/g, " ");
    if (!value) return;

    if (!event.title && !event.company && raw.indexOf("\t") === -1) {
      var head = splitHead(value);
      if (head) {
        event.title = head.title;
        event.company = head.company;
        if (head.place) event.place = head.place;
        return;
      }
    }

    //  "UBS INVESTMENT BANK        New York, NY" – englische Lebenslaeufe
    //  setzen den Ort an den rechten Rand. Der Spaltensprung ist als
    //  Tabulator erhalten; was rechts steht, ist kurz und traegt kein Datum.
    if (!event.title && !event.company && raw.indexOf("\t") !== -1) {
      var columns = raw.split("\t").map(clean).filter(Boolean);
      if (columns.length === 2 && columns[1].length <= 30 &&
          !/\d/.test(columns[1]) && columns[0].length > 2) {
        event.company = columns[0];
        event.place = columns[1];
        return;
      }
    }

    //  "Werkstudent Marketing - TechNova GmbH" ist beides in einer Zeile,
    //  und dort steht rechts der Arbeitgeber. Getrennt wird nur, wenn er
    //  sich als Einrichtung zu erkennen gibt: "Master of Education –
    //  Deutsch & Geschichte" ist ein Titel mit Fach, kein Arbeitgeber.
    if (!event.title && !event.company) {
      var pair = value.match(/^(.{3,60}?)\s+[–—-]\s+(.{2,60})$/);
      if (pair && ORGANISATION.test(pair[2]) && !ORGANISATION.test(pair[1])) {
        event.title = clean(pair[1]);
        splitPlace(event, clean(pair[2]));
        return;
      }
    }

    //  "SPS-Fachkraft, TÜV Rheinland Akademie" – vorn die Taetigkeit oder
    //  der Abschluss, hinter dem letzten Komma die Einrichtung.
    if (!event.title && !event.company) {
      var comma = value.match(/^(.{3,80}),\s+([^,]{3,60})$/);
      if (comma && ORGANISATION.test(comma[2]) && !ORGANISATION.test(comma[1])) {
        event.title = clean(comma[1]);
        event.company = clean(comma[2]);
        return;
      }
    }

    if (!event.title) {
      //  "Mechaniker GmbH, Standort" ist der Arbeitgeber, nicht der Titel –
      //  und "ZOOLINO, Bad Wimpeln" ebenso: ein angehaengter Ort macht aus
      //  der Zeile eine Angabe zur Einrichtung, nicht zur Taetigkeit.
      if (!event.company &&
          (ORGANISATION.test(value) || /,\s*[A-ZÄÖÜ][\wäöüß.() -]{2,25}$/.test(value))) {
        splitPlace(event, value);
        return;
      }
      //  Bleibt nur "Abschluss: Mittlere Reife" uebrig, ist der Abschluss
      //  der Eintrag – die Beschriftung davor sagt nichts Eigenes.
      event.title = value.replace(/^(abschluss|abgeschlossen als|degree|qualification)\s*:\s*/i, "");
      return;
    }

    if (!event.company) { splitPlace(event, value); return; }

    //  "(Berlin)" hinter dem Zeitraum ist der Ort und keine Beschreibung.
    //  Ohne Klammer bleibt es dabei, dass eine Zeile unter Titel und
    //  Arbeitgeber zum Text gehoert – ein Ort steht dort selten allein.
    if (!event.place && /^\(.{2,30}\)$/.test(value)) {
      event.place = value.slice(1, -1);
      return;
    }

    //  "Abschluss: Geprüfter Taucher" liest sich als Aufzählungspunkt
    //  besser denn als Absatz.
    if (/^[A-ZÄÖÜ][\wäöüß ]{2,24}:\s/.test(value)) { event.list.push(value); return; }

    //  Ein Satz, der in der naechsten Zeile klein weitergeht, ist umbrochen
    //  und kein neuer Absatz.
    var previous = event.description[event.description.length - 1];
    if (previous && !/[.!?:;]$/.test(previous) && /^[a-zäöüß(]/.test(value)) {
      event.description[event.description.length - 1] = joinLines([previous, value]);
      return;
    }
    event.description.push(value);
  }

  //  Eine Sprachangabe ist ein Paar: "Englisch, fliessend in Wort und
  //  Schrift", "Deutsch (Muttersprache)", "Spanisch - B1". Am Komma zu
  //  trennen wie bei Kenntnissen wuerde die Stufe zur eigenen Sprache
  //  machen – ausser es stehen erkennbar mehrere Paare in einer Zeile.
  function languageEntries(text) {
    var out = [];

    //  Stufen, die ohne Trennzeichen hinter der Sprache stehen:
    //  "Klingonisch B2", "Deutsch Muttersprache".
    var BARE_LEVEL = /^(.{2,30}?)\s+([ABC][12]|muttersprache|native speaker|native|verhandlungssicher|fließend|fliessend|fluent|grundkenntnisse|basic)$/i;

    function add(value) {
      //  Ein Aufzaehlungszeichen gehoert nicht zum Namen der Sprache.
      var entry = clean(value).replace(/^[-–—•*·]\s*/, "");
      if (!entry) return;
      var match = entry.match(/^(.{2,30}?)\s*(?:[,(:–—]|\s-\s|\s{2,})\s*(.+?)\)?$/) ||
        entry.match(BARE_LEVEL);
      var name = clean(match ? match[1] : entry);
      var level = clean(match ? match[2] : "");
      //  Die Stufe endet oft in einer Klammer, die zur Sprache gehoerte
      //  ("Deutsch (Muttersprache)") – steht die Klammer aber in der Stufe
      //  selbst ("Fließend (C1)"), fehlt sonst ihr Schluss.
      if (level.indexOf("(") !== -1 && level.indexOf(")") === -1) level += ")";
      if (!name || name.length > 30) return;
      out.push({ name: name, level: level, percentage: fluencyToPercent(level) });
    }

    String(text).split(/\n|\t/).forEach(function (part) {
      var value = clean(part);
      if (!value) return;
      //  "Deutsch (Muttersprache), Englisch (B2)" – zwei Klammern, also
      //  zwei Sprachen in einer Zeile.
      if ((value.match(/\(/g) || []).length >= 2) value.split(/,\s*/).forEach(add);
      else add(value);
    });

    return out;
  }

  //  Nebeneinander gesetzte Eintraege (Kenntnisse stehen gern in zwei
  //  Spalten) trennt der Tabulator, den die PDF-Ebene gesetzt hat.
  //  Punkte, Sterne, Balken: die Selbsteinschaetzung steht in Lebenslaeufen
  //  als Zeichenkette neben der Kenntnis. Gefuellt und leer sind
  //  unterschiedliche Zeichen – daraus laesst sich die Stufe zaehlen,
  //  statt sie auf null zu lassen.
  var FULL_MARK = /[●◆■★▰▮⬤•]/g;
  var EMPTY_MARK = /[○◇□☆▱▯◯]/g;

  function rankFromMarks(text) {
    var value = String(text || "");
    var full = (value.match(FULL_MARK) || []).length;
    var empty = (value.match(EMPTY_MARK) || []).length;
    if (!full && !empty) return 0;
    //  Nur Marken und Leerraum duerfen dastehen, sonst ist es Text.
    if (clean(value.replace(FULL_MARK, "").replace(EMPTY_MARK, ""))) return 0;
    var total = full + empty;
    if (!total) return 0;
    return Math.max(1, Math.min(5, Math.round(full / total * 5)));
  }

  //  Zweispaltige Listen: "Go<TAB>●●●●○". Der Tabulator trennt Name und
  //  Wert – ohne ihn zu beachten, wird aus einer Kenntnis mit Stufe ein
  //  Paar aus zwei Kenntnissen.
  function skillEntries(rows) {
    var out = [];

    rows.forEach(function (row) {
      var line = clean(row.text);
      if (!line) return;

      //  "Languages: Go, Rust, SQL" – eine Gruppe in der Kenntnisliste. Die
      //  Beschriftung ordnet nur; die Eintraege dahinter sind die Kenntnisse.
      var group = line.match(/^([^:\t]{2,30}):\s+(.+)$/);
      if (group && /[,;·•|]/.test(group[2])) line = group[2];

      var parts = line.split("\t").map(clean).filter(Boolean);
      if (parts.length === 2) {
        var rank = rankFromMarks(parts[1]);
        if (rank) { out.push({ name: parts[0], rank: rank }); return; }
        //  Zwei Eintraege nebeneinander ("Modelleisenbahn  Klemmbausteine")
        //  bleiben zwei Eintraege.
      }

      listItems(line).forEach(function (name) {
        var rank = rankFromMarks(name);
        if (rank) {
          //  Die Marken hingen an der Kenntnis davor.
          if (out.length) out[out.length - 1].rank = rank;
          return;
        }
        out.push({ name: name, rank: 0 });
      });
    });

    return out;
  }

  //  "Deutsch<TAB>Muttersprache" zu "Deutsch (Muttersprache)": danach sieht
  //  es aus wie die Schreibweise, die languageEntries ohnehin versteht.
  function pairColumns(text) {
    return String(text).split("\n").map(function (line) {
      var parts = clean(line).split("\t").map(clean).filter(Boolean);
      if (parts.length !== 2) return line;
      if (parts[0].length > 30 || parts[1].length > 30) return line;
      return parts[0] + " (" + parts[1] + ")";
    }).join("\n");
  }

  function listItems(text) {
    return String(text).split(/\n|\t|[;,•·]|\s{3,}|\s\|\s/)
      .map(function (entry) { return clean(entry).replace(/^[-–—•*·]\s*/, ""); })
      .filter(function (entry) { return entry && entry.length < 60; });
  }

  /* -------------------------------------------------------------- Bilder */

  //  Ein PDF kennt keine Bildunterschriften – nur Rechtecke auf Papier.
  //  Zugeordnet wird deshalb nach Lage und Form: das grosse Bild oben auf
  //  Seite eins ist das Bewerbungsfoto, ein breites flaches auf einer
  //  spaeteren Seite die Unterschrift, und was neben einem Projekt liegt,
  //  gehoert zu diesem Projekt. Was uebrig bleibt – Ziersymbole, Logos
  //  ohne Bezug – bleibt liegen, statt irgendwo aufzutauchen.
  function attachImages(profile, images) {
    if (!images || !images.length) return;
    profile.images = images.length;

    var free = images.slice().sort(function (a, b) { return b.area - a.area; });

    function take(test) {
      for (var i = 0; i < free.length; i++) {
        if (test(free[i])) return free.splice(i, 1)[0];
      }
      return null;
    }

    //  Ein Bewerbungsfoto ist hochkant bis quadratisch, nicht klein und
    //  steht oben auf dem Blatt. Welches Blatt, ist nicht gesetzt: Vorlagen
    //  aus dem Netz stellen dem Lebenslauf gern ein, zwei Seiten voran.
    //  Gesucht wird deshalb das fruehste Blatt, auf dem so ein Bild steht.
    function photoShaped(image) {
      if (image.w < 60) return false;
      if (image.ratio < 0.45 || image.ratio > 1.9) return false;
      return image.y + image.h >= image.pageHeight * 0.6;
    }

    var firstPhotoPage = free.reduce(function (earliest, image) {
      if (!photoShaped(image)) return earliest;
      return earliest === null ? image.page : Math.min(earliest, image.page);
    }, null);

    var photo = firstPhotoPage === null ? null : take(function (image) {
      return image.page === firstPhotoPage && photoShaped(image);
    });
    if (photo) profile.photo = photo.src;

    //  Eine Unterschrift ist breit, flach und steht unten – im Anschreiben
    //  ebenso wie unter einem Lebenslauf, der mit Ort und Datum schliesst.
    var signature = take(function (image) {
      if (image.ratio < 1.5 || image.h > image.pageHeight * 0.12) return false;
      return image.page > 1 || image.y < image.pageHeight * 0.25;
    });
    if (signature) profile.signature = signature.src;

    profile.projects.forEach(function (project) {
      if (!project.y) return;
      var near = take(function (image) {
        return image.page === project.page && Math.abs(image.y - project.y) < 160;
      });
      if (near) project.img = near.src;
    });
  }

  /* ------------------------------------------------------------ Einspielen */

  var ROLE_ICON = {
    experience: "briefcase", education: "graduation-cap",
    volunteer: "heart-handshake", other: "award",
  };

  //  Zu jeder Bedeutung muss es eine Kategorie geben, sonst haette die
  //  Station keinen Platz. Vorhandene werden wiederverwendet.
  function sectionFor(state, role, locale) {
    var found = (state.sections || []).filter(function (section) {
      return section.atsRole === role;
    })[0];
    if (found) return found.id;

    var d = I18n.doc(locale || state.locale || "de");
    var titles = { experience: "experience", education: "education",
                   volunteer: "volunteer", other: "other" };
    var section = {
      id: "imp-" + role,
      title: d(titles[role]) || role,
      icon: Model.icon("lucide", ROLE_ICON[role] || "briefcase"),
      atsRole: role,
      show: true,
      page: 1,
    };
    state.sections.push(section);
    return section.id;
  }

  function fillEmpty(target, source, keys) {
    keys.forEach(function (key) {
      if (!clean(target[key]) && clean(source[key])) target[key] = clean(source[key]);
    });
  }

  //  mode: "replace" – frisches Dokument, nur Stil und Sprache bleiben
  //        "merge"   – an den vorhandenen Stand anhaengen
  function applyProfile(state, profile, mode) {
    var locale = state.locale || "de";
    var target = mode === "merge" ? copy(state) : freshFrom(state);

    fillEmpty(target.contact, profile.contact,
      ["name", "role", "address", "city", "email", "phone"]);

    if (clean(profile.profileText)) {
      //  Beim Ergaenzen bleibt ein vorhandener Profiltext stehen – und
      //  dann wird der Block auch nicht eingeschaltet: was schon da war,
      //  war ausgeblendet, weil es jemand ausgeblendet hat.
      var keepProfile = mode === "merge" && clean(target.profile.text);
      if (!keepProfile) {
        target.profile.text = clean(profile.profileText);
        target.profile.show = true;
      }
    }

    //  Beim Ergaenzen kommt oft dieselbe Datei ein zweites Mal – oder eine
    //  neuere Fassung desselben Lebenslaufs. Was schon dasteht, soll dann
    //  nicht noch einmal danebenstehen.
    var known = {};
    if (mode === "merge") {
      target.events.forEach(function (event) { known[eventKey(event)] = true; });
    }

    profile.events.forEach(function (entry) {
      if (mode === "merge" && known[eventKey(entry)]) return;
      known[eventKey(entry)] = true;

      var event = Model.emptyEvent(sectionFor(target, entry.role || "experience", locale));
      event.title = clean(entry.title);
      event.company = clean(entry.company);
      event.place = clean(entry.place);
      event.start = clean(entry.start);
      event.end = clean(entry.end);
      event.present = !!entry.present;
      event.description = (entry.description || []).map(clean).filter(Boolean);
      event.list = (entry.list || []).map(clean).filter(Boolean);
      event.icon = Model.icon("lucide", ROLE_ICON[entry.role] || "briefcase");
      target.events.push(event);
    });

    appendItems(target, "skills", profile.skills, function (item) {
      return { name: clean(item.name), rank: Number(item.rank) || 0 };
    });
    appendItems(target, "languages", profile.languages, function (item) {
      return {
        name: clean(item.name), level: clean(item.level),
        percentage: Number(item.percentage) || 0,
      };
    });
    appendItems(target, "interests", profile.interests, function (item) {
      return { name: clean(item.name), icon: Model.icon("lucide", "star") };
    });
    appendItems(target, "mobility", profile.mobility, function (item) {
      return { name: clean(item.name) };
    });
    appendItems(target, "projects", profile.projects, function (item) {
      return {
        name: clean(item.name), url: clean(item.url), img: clean(item.img),
        description: clean(item.description),
      };
    });
    appendItems(target, "references", profile.references, function (item) {
      return {
        name: clean(item.name), role: clean(item.role),
        company: clean(item.company), contact: clean(item.contact),
      };
    });

    if (clean(profile.photo)) {
      target.photo.src = profile.photo;
      target.photo.show = true;
    }

    if (clean(profile.signature)) target.coverLetter.signatureImg = profile.signature;

    //  Das Anschreiben. Beim Ergaenzen nur, wenn noch keines dasteht – ein
    //  geschriebener Brief wird nicht still durch einen anderen ersetzt.
    var letter = profile.letter;
    if (letter && letter.paragraphs && letter.paragraphs.length) {
      var written = (target.coverLetter.paragraphs || []).some(function (text) { return clean(text); });
      if (mode !== "merge" || !written) {
        target.coverLetter.recipient = clean(letter.recipient).replace(/[ \t]*\n[ \t]*/g, "\n");
        target.coverLetter.subject = clean(letter.subject).replace(/\s*\n\s*/g, " – ");
        target.coverLetter.salutation = clean(letter.salutation);
        target.coverLetter.paragraphs = letter.paragraphs.map(clean).filter(Boolean);
        target.coverLetter.closing = clean(letter.closing);
        target.settings.showCoverLetter = true;
      }
    }

    if (profile.links && profile.links.length) {
      var footer = target.footers.right;
      profile.links.slice(0, 4).forEach(function (link) {
        if (!clean(link.url)) return;
        var entry = Model.emptyFooterLink();
        entry.label = clean(link.label);
        entry.text = clean(link.text) || clean(link.label);
        entry.url = clean(link.url);
        entry.icon = Model.icon("lucide", guessLinkIcon(link));
        footer.links.push(entry);
      });
      if (footer.links.length) footer.show = true;
    }

    //  Stationen ohne Titel helfen niemandem.
    target.events = target.events.filter(function (event) {
      return clean(event.title) || clean(event.company);
    });

    if (mode !== "merge") hideEmptyBlocks(target);

    return Model.migrate(target);
  }

  var LINK_ICONS = [
    { pattern: /github/i, icon: "github", set: "brands" },
    { pattern: /linked ?in/i, icon: "linkedin", set: "brands" },
    { pattern: /mastodon|bluesky|twitter|^x$/i, icon: "at-sign", set: "lucide" },
    { pattern: /gitlab|bitbucket/i, icon: "git-branch", set: "lucide" },
  ];

  function guessLinkIcon(link) {
    var haystack = clean(link.label) + " " + clean(link.url);
    for (var i = 0; i < LINK_ICONS.length; i++) {
      if (LINK_ICONS[i].pattern.test(haystack)) return LINK_ICONS[i].icon;
    }
    return "globe";
  }

  //  Zwei Stationen sind dieselbe, wenn Titel, Arbeitgeber und Beginn
  //  uebereinstimmen. Gross- und Kleinschreibung und die Zeichensetzung
  //  zaehlen nicht mit: derselbe Lebenslauf, einmal aus dem PDF und einmal
  //  aus dem Word-Dokument gelesen, schreibt "GmbH," und "GmbH".
  function eventKey(event) {
    return [event.title, event.company, event.start]
      .map(function (part) {
        return clean(part).toLowerCase().replace(/[^\wäöüß]+/g, "");
      })
      .join("|");
  }

  function appendItems(target, key, items, map) {
    if (!items || !items.length) return;
    var block = target[key];
    if (!block) return;
    var seen = {};
    block.items.forEach(function (item) { seen[clean(item.name).toLowerCase()] = true; });

    var added = 0;
    items.forEach(function (item) {
      var name = clean(item.name);
      if (!name || seen[name.toLowerCase()]) return;
      seen[name.toLowerCase()] = true;
      block.items.push(map(item));
      added++;
    });

    //  Eingeschaltet wird nur, was der Import tatsaechlich gefuellt hat.
    //  Ein Block, der schon Eintraege hatte und trotzdem ausgeblendet war,
    //  war mit Absicht ausgeblendet.
    if (added) block.show = true;
  }

  //  Beim Ersetzen bleibt, was zum Aussehen gehoert: Stil, Vorlage,
  //  Sprache. Der Inhalt geht – auch der, den ein leeres Dokument von sich
  //  aus mitbringt. Ein frischer Stand traegt zum Beispiel schon einen
  //  Fuehrerschein ein, damit der Abschnitt nicht leer wirkt; in einem
  //  Import waere das eine Angabe, die niemand gemacht hat.
  function freshFrom(state) {
    var base = Model.createBase(state.locale || "de");
    base.style = copy(state.style);
    base.settings = copy(state.settings);
    base.photo = copy(state.photo);
    base.contactTitle = state.contactTitle;
    //  Das Theme gehoert zum Aussehen, nicht zum Inhalt. Der Dialog sagt
    //  zu "Ersetzen": Gestaltung, Vorlage und Sprache bleiben – ohne diese
    //  Zeile sprang das Dokument beim Import zurueck auf Clean.
    if (state.theme) base.theme = copy(state.theme);

    ["skills", "languages", "interests", "projects", "references",
     "mobility", "mobilitySB"].forEach(function (key) {
      if (base[key] && Array.isArray(base[key].items)) base[key].items = [];
    });

    return base;
  }

  //  Ein Block ohne Eintraege ist eine Ueberschrift ueber nichts.
  function hideEmptyBlocks(state) {
    ["skills", "languages", "interests", "projects", "references",
     "mobility", "mobilitySB"].forEach(function (key) {
      var block = state[key];
      if (block && Array.isArray(block.items) && !block.items.length) block.show = false;
    });
    return state;
  }

  /* ---------------------------------------------------------- Erkennung */

  //  Die Antwort eines Sprachmodells, so wie man sie aus dem Chat kopiert:
  //  mit einem Satz davor, in einem Codeblock mit ```json, manchmal mit
  //  einem Komma zu viel vor der schliessenden Klammer. Darin steckt ein
  //  Dokument, und das soll ankommen – nicht als Fliesstext gelesen werden.
  //  Herausgeloest wird nur, was sich danach als JSON lesen laesst und nach
  //  einem Lebenslauf aussieht; ein Lebenslauf mit geschweiften Klammern im
  //  Text bleibt Text.
  function unwrapJson(text) {
    var value = String(text || "").replace(/^\uFEFF/, "").trim();
    if (value.charAt(0) === "{") return value;

    var candidates = [];
    var fence = /```[a-zA-Z]*[ \t]*\n?([\s\S]*?)```/g;
    var match;
    while ((match = fence.exec(value)) !== null) candidates.push(match[1].trim());
    var first = value.indexOf("{");
    var last = value.lastIndexOf("}");
    if (first !== -1 && last > first) candidates.push(value.slice(first, last + 1));

    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate.charAt(0) !== "{") continue;
      var data = parseLoose(candidate);
      if (data && typeof data === "object" &&
          (data.contact || data.basics || data.settings || data.events || data.coverLetter ||
           data.work || data.sections)) {
        return JSON.stringify(data);
      }
    }
    return value;
  }

  //  JSON, wie Menschen und Modelle es schreiben: ein Komma vor der
  //  schliessenden Klammer ist kein Grund, ein ganzes Dokument abzulehnen.
  function parseLoose(text) {
    try { return JSON.parse(text); } catch (error) { /* weiter unten */ }
    try { return JSON.parse(String(text).replace(/,(\s*[}\]])/g, "$1")); } catch (error) {
      return null;
    }
  }

  function detect(name, text) {
    var filename = clean(name).toLowerCase();
    if (/\.docx$/.test(filename)) return "docx";
    if (/\.zip$/.test(filename)) return "linkedin-zip";
    if (/\.csv$/.test(filename)) return "linkedin-csv";
    if (/\.pdf$/.test(filename)) return "pdf";

    var trimmed = clean(text);
    if (trimmed.charAt(0) === "{") {
      var data = null;
      //  Beginnt es wie JSON und endet es wie JSON, ist es als JSON gemeint –
      //  kaputt, meist von Hand oder von einem Sprachmodell geschrieben. Das
      //  als Fliesstext zu lesen, ergaebe nur "nichts erkannt".
      data = parseLoose(trimmed);
      if (data === null) {
        return trimmed.charAt(trimmed.length - 1) === "}" ? "json-broken" : "text";
      }
      if (!data || typeof data !== "object") return "json-unknown";
      if ((data.settings || data.contactTitle) && data.contact) return "rickcv";
      //  Reactive Resume legt seine Bloecke in ein Objekt "sections"; JSON
      //  Resume kennt stattdessen Listen auf oberster Ebene.
      if (data.sections && typeof data.sections === "object" &&
          !Array.isArray(data.sections)) return "reactive";
      if (data.basics || data.work || data.education ||
          /jsonresume/i.test(clean(data.$schema))) return "jsonresume";
      //  AGENTS.md sagt: alles ist optional, die Fassung eingeschlossen. Ein
      //  Dokument, das nur Kontaktdaten traegt – so schreibt es ein Chat
      //  gern –, ist trotzdem eines von RickCV.
      if (isObject(data.contact) || Array.isArray(data.events) || isObject(data.coverLetter) ||
          isObject(data.profile)) return "rickcv";
      return "json-unknown";
    }
    return "text";
  }

  function summarize(profile) {
    var roles = { experience: 0, education: 0, volunteer: 0, other: 0 };
    profile.events.forEach(function (event) {
      roles[event.role] = (roles[event.role] || 0) + 1;
    });
    return {
      name: clean(profile.contact.name),
      contact: ["email", "phone", "address", "city", "role"].filter(function (key) {
        return clean(profile.contact[key]);
      }).length,
      profileText: clean(profile.profileText).length,
      events: profile.events.length,
      roles: roles,
      skills: profile.skills.length,
      languages: profile.languages.length,
      interests: profile.interests.length,
      mobility: profile.mobility.length,
      projects: profile.projects.length,
      references: profile.references.length,
      links: profile.links.length,
      letter: profile.letter && profile.letter.paragraphs.length ? 1 : 0,
      images: (profile.photo ? 1 : 0) + (profile.signature ? 1 : 0) +
        profile.projects.filter(function (project) { return clean(project.img); }).length,
    };
  }

  function result(format, profile, state, text) {
    return {
      format: format,
      profile: profile || null,
      state: state || null,
      summary: profile ? summarize(profile) : summarize(stateToProfile(state)),
      warnings: (profile && profile.warnings) || [],
      //  Bei Text und PDF steht daneben, was gelesen wurde: findet die
      //  Heuristik wenig, kann man immer noch selbst zuordnen.
      text: text || "",
    };
  }

  /* ------------------------------------------------------------- Eingang */

  //  lines: die Zeilen aus dem PDF mitsamt Schriftgrad – sie machen aus
  //  Raten eine Auswertung. Fehlen sie, bleibt es beim reinen Text.
  function parseText(text, name, lines, images) {
    if (!lines) text = unwrapJson(text);
    var format = detect(name, text);

    if (format === "json-broken") throw new Error("brokenJson");

    if (format === "rickcv" || format === "jsonresume" || format === "reactive" ||
        format === "json-unknown") {
      var data = parseLoose(clean(text));
      if (format === "rickcv") {
        var newer = Number(data.version) > Model.VERSION;
        var migrated = Model.migrate(data);
        if (!migrated) throw new Error("unreadable");
        var own = result("rickcv", null, migrated);
        //  Was das Dokument ausser Inhalt noch mitbringt, steht in der
        //  Bestaetigung – nicht erst hinterher im Editor.
        if (newer) own.warnings.push("newer");
        if (migrated.theme && migrated.theme.css) own.warnings.push("customTheme");
        //  Unsichtbarer Text zaehlt bei Bewerbungssystemen als Manipulation
        //  (siehe ats.js). Ein Import schaltet ihn deshalb nicht still mit
        //  ein, sondern aus – und sagt es.
        if (migrated.ats && migrated.ats.mode === "hidden") {
          migrated.ats.mode = "off";
          own.warnings.push("hiddenAts");
        }
        return own;
      }
      if (format === "json-unknown") throw new Error("unknownJson");
      if (format === "reactive") {
        var reactive = fromReactiveResume(data);
        if (!hasContent(reactive)) throw new Error("unknownJson");
        return result("reactive", reactive);
      }
      return result("jsonresume", fromJsonResume(data));
    }

    if (format === "linkedin-csv") {
      var files = {};
      files[clean(name).replace(/^.*[/\\]/, "")] = text;
      var profile = fromLinkedIn(files);
      if (!hasContent(profile)) throw new Error("emptyCsv");
      return result("linkedin", profile);
    }

    var textProfile = fromText(text, lines);
    attachImages(textProfile, images);
    //  Ein einzelner erkannter Name ist noch kein Lebenslauf – sonst wird
    //  aus jedem hineingeworfenen Schnipsel ein "Import".
    var substance = textProfile.events.length + textProfile.skills.length +
      textProfile.languages.length + textProfile.projects.length +
      (clean(textProfile.contact.email) ? 1 : 0) + (clean(textProfile.contact.phone) ? 1 : 0) +
      (clean(textProfile.profileText) ? 1 : 0) + (textProfile.letter ? 1 : 0);
    if (!substance) throw new Error("nothingFound");

    //  Kontaktdaten allein sind ein schlechter Import. Dann lieber sagen,
    //  dass wenig erkannt wurde, statt es als Erfolg auszugeben – es sei
    //  denn, es war nur ein Anschreiben: das hat keine Stationen.
    if (!textProfile.events.length && !textProfile.letter) textProfile.warnings.push("thin");
    if (textProfile.letter) textProfile.warnings.push("letter");
    if (textProfile.images) textProfile.warnings.push("images");

    //  Aus Text laesst sich keine Selbsteinschaetzung lesen: die Punkte
    //  eines Kenntnis-Balkens sind Grafik. Lieber sagen, dass sie auf null
    //  stehen, als sie stillschweigend zu erfinden.
    var unrated = textProfile.skills.length && textProfile.skills.every(function (skill) {
      return !Number(skill.rank);
    });
    if (unrated) textProfile.warnings.push("skillRanks");

    return result("text", textProfile, null, text);
  }

  //  readFile(file, callback) – callback(error, result)
  function readFile(file, callback) {
    var name = file.name || "";
    var format = detect(name, "");

    if (format === "linkedin-zip") {
      //  Der Rueckruf steht ausserhalb der Kette: wirft er selbst, soll er
      //  nicht ein zweites Mal – dann mit seinem eigenen Fehler – kommen.
      file.arrayBuffer().then(readZip).then(function (files) {
        var profile = fromLinkedIn(files);
        if (!hasContent(profile)) throw new Error("emptyZip");
        return result("linkedin", profile);
      }).then(function (parsed) { callback(null, parsed); },
              function (error) { callback(error); });
      return;
    }

    if (format === "docx") {
      if (!global.RickCVDocx) return callback(new Error("noDocxSupport"));
      global.RickCVDocx.read(file, function (error, data) {
        if (error) return callback(error);
        var parsed;
        try {
          parsed = parseText(data.text, "extracted.txt", data.lines, data.images);
          parsed.format = "docx";
        } catch (parseError) { return callback(parseError); }
        callback(null, parsed);
      });
      return;
    }

    if (format === "pdf") {
      if (!global.RickCVPdf) return callback(new Error("noPdfSupport"));
      global.RickCVPdf.extract(file, function (error, data) {
        if (error) return callback(error);
        var parsed;
        try {
          parsed = parseText(data.text, "extracted.txt", data.lines, data.images);
          parsed.format = "pdf";
          //  Fehlende Zeichenzuordnung betrifft den Text, nicht den Aufbau –
          //  deshalb steht die Warnung hier und nicht in der Auswertung.
          if (data.unmapped && parsed.warnings.indexOf("unmapped") === -1) {
            parsed.warnings.push("unmapped");
          }
        } catch (parseError) { return callback(parseError); }
        callback(null, parsed);
      });
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () { callback(new Error("unreadable")); };
    reader.onload = function () {
      var parsed;
      try {
        parsed = parseText(String(reader.result), name);
      } catch (error) { return callback(error); }
      callback(null, parsed);
    };
    reader.readAsText(file);
  }

  global.RickCVImport = {
    readFile: readFile,
    parseText: parseText,
    detect: detect,
    apply: function (state, parsed, mode) {
      if (parsed.state) {
        return mode === "merge"
          ? applyProfile(state, stateToProfile(parsed.state), "merge")
          : parsed.state;
      }
      return applyProfile(state, parsed.profile, mode);
    },
    toJsonResume: toJsonResume,
    fromJsonResume: fromJsonResume,
    fromReactiveResume: fromReactiveResume,
    stateToProfile: stateToProfile,
    parseCsv: parseCsv,
    normDate: normDate,
    //  Der ZIP-Leser wird auch vom docx-Import gebraucht: ein Word-Dokument
    //  ist nichts anderes als ein ZIP mit XML darin.
    readZip: readZip,
    inflateRaw: inflateRaw,
    decodeText: decodeText,
    emptyProfile: emptyProfile,
    newEvent: newEvent,
    attachImages: attachImages,
    summarize: summarize,
    result: result,
    hasContent: hasContent,
    clean: clean,
  };
})(typeof window !== "undefined" ? window : this);
