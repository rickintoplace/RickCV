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

    var named = raw.match(/^([A-Za-zÄÖÜäöü]+)\.?\s+(\d{4})$/);
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
      photo: "",       // Bewerbungsfoto als Datenadresse
      signature: "",   // Unterschrift aus dem Anschreiben
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
  function inflateRaw(chunk) {
    if (typeof global.DecompressionStream !== "function") {
      return Promise.reject(new Error("noDecompression"));
    }
    var reader = new Blob([chunk]).stream()
      .pipeThrough(new global.DecompressionStream("deflate-raw"))
      .getReader();
    var parts = [];

    function pump() {
      return reader.read().then(function (step) {
        if (step.done) return;
        parts.push(step.value);
        return pump();
      }, function () { /* Rest ist nicht mehr unser Block */ });
    }

    return pump().then(function () {
      var total = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
      var out = new Uint8Array(total);
      var at = 0;
      parts.forEach(function (part) { out.set(part, at); at += part.length; });
      return new TextDecoder().decode(out);
    });
  }

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
        return {
          name: entry.name,
          text: new TextDecoder().decode(bytes.subarray(start, start + entry.size)),
        };
      }
      if (entry.method !== 8) return { name: entry.name, text: "" };

      //  Nur den eigenen Block fuettern. Steht dort keine Laenge (Zip64
      //  oder Datenbeschreibung), nimmt inflateRaw den Rest und hoert von
      //  selbst auf, sobald der Strom nicht mehr weiss, was er liest.
      var slice = entry.packed
        ? bytes.subarray(start, start + entry.packed)
        : bytes.subarray(start);
      return inflateRaw(slice).then(function (text) {
        return { name: entry.name, text: text };
      });
    })).then(function (files) {
      var map = {};
      files.forEach(function (file) {
        if (file) map[file.name.replace(/^.*\//, "")] = file.text;
      });
      return map;
    });
  }

  /* ----------------------------------------------------------- LinkedIn */

  function pick(map, name) {
    var key = Object.keys(map).filter(function (entry) {
      return entry.toLowerCase() === name.toLowerCase();
    })[0];
    return key ? map[key] : "";
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
  var HEADINGS = [
    { role: "experience", pattern: /^(berufs?erfahrung|beruflicher werdegang|berufliche erfahrung|praxiserfahrung|werdegang|work experience|professional experience|experience|employment)\b/i },
    { role: "education", pattern: /^(ausbildung|schulbildung|studium|bildungsweg|schule|education|academic)\b/i },
    { role: "volunteer", pattern: /^(ehrenamt|engagement|freiwillig|volunteer|volunteering)\b/i },
    { role: "skills", pattern: /^(kenntnisse|f[äa]higkeiten|skills|kompetenzen|technical skills|it-kenntnisse|edv)\b/i },
    { role: "languages", pattern: /^(sprachen|languages|sprachkenntnisse)\b/i },
    { role: "interests", pattern: /^(interessen|hobbys?|interests|freizeit)\b/i },
    { role: "projects", pattern: /^(projekte|projects|portfolio)\b/i },
    { role: "profile", pattern: /^(profil|über mich|ueber mich|kurzprofil|summary|about|profile|objective)\b/i },
    { role: "other", pattern: /^(weiterbildung|fortbildung|zertifikate|zertifizierungen|certificates|certifications|awards|auszeichnungen|publikationen|publications)\b/i },
    //  Bekannt, aber ohne eigenen Block: Hauptsache, die Zeilen darunter
    //  landen nicht im vorigen Abschnitt.
    { role: "ignore", pattern: /^(kontakt|contact|persönliche daten|persoenliche daten|personal details|mobilit[äa]t|mobility|referenzen|references|anschrift|adresse)\b/i },
  ];

  //  Ein Zeitraum in einer Zeile: "09/2015 – 07/2021", "2015 - heute",
  //  "Jan 2015 – Dez 2018". Zweistellige Jahre sind erlaubt, die kommen aus
  //  gestalteten Lebenslaeufen ("11/13").
  var DATE = "(?:\\d{1,2}[./])?\\d{2,4}|[A-Za-zÄÖÜäöü]{3,9}\\.?\\s+\\d{2,4}";
  var OPEN = "heute|present|current|aktuell|now|jetzt|dato|today|ongoing|bis heute";

  var RANGE = new RegExp(
    "(\\b(?:" + DATE + ")\\b)\\s*(?:–|—|-|bis|to|until|\\u2013)\\s*(\\b(?:" + DATE + ")\\b|" + OPEN + ")", "i");

  var SINGLE = new RegExp("^\\s*((?:\\d{1,2}[./])?\\d{4})\\s*$");

  //  Ein Datum am Zeilenende – die haeufigste Form in gestalteten
  //  Lebenslaeufen. Steht ein Gedankenstrich davor, ist es das Ende eines
  //  Zeitraums, dessen Anfang eine Zeile hoeher steht.
  var TRAILING = new RegExp(
    "^(.*?)[\\t ]*(?:(–|—|-|bis|to)[\\t ]*)?(" + DATE + "|" + OPEN + ")[.,;]?$", "i");

  function trailingDate(text) {
    var match = String(text).match(TRAILING);
    if (!match) return null;

    var rest = clean(match[1]).replace(/[\t]/g, " ").replace(/[,;–—-]\s*$/, "").trim();
    var value = clean(match[3]);

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

  function headingOf(line) {
    var value = normalizeHeading(line);
    if (!value || value.length > 40) return null;
    for (var i = 0; i < HEADINGS.length; i++) {
      if (HEADINGS[i].pattern.test(value)) return HEADINGS[i].role;
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
    var known = 0;

    rows.forEach(function (row) {
      if (!headingOf(row.text)) return;
      known++;
      if (row.size) sizes.push(row.size);
      if (row.spaced) spaced++;
    });

    if (!known || !sizes.length) return null;
    return { size: median(sizes), spaced: spaced >= known * 0.6 };
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
      if (!row.size) return false;
      //  Liegt der Ueberschriftsgrad dicht am Fliesstext (12 zu 11 Punkt
      //  ist ueblich), traefe die blosse Aehnlichkeit jede Zeile. Eine
      //  Ueberschrift muss sich auch vom Fliesstext abheben.
      if (!row.spaced && row.size < bodySize * 1.08) return false;
      return Math.abs(row.size - style.size) <= style.size * 0.15;
    }

    if (row.spaced) return true;
    return row.size >= bodySize * 1.12 && value === value.toUpperCase();
  }

  var SALUTATION = /^(sehr geehrte|liebe[rs]?\s|dear\s|hallo\s)/i;

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  function fromText(text, lines) {
    var profile = emptyProfile();

    //  Aus einem PDF kommen fertige Zeilen mit Zusatzwissen, aus der
    //  Zwischenablage nur Text. Beides wird hier zur selben Form.
    var rows = (lines && lines.length ? lines : String(text).replace(/\r/g, "").split("\n")
      .map(function (line) { return { text: line }; }))
      .map(function (row) {
        return {
          text: clean(row.text), size: row.size || 0, spaced: !!row.spaced,
          x: row.x || 0, y: row.y || 0, page: row.page || 1,
        };
      })
      .filter(function (row) { return row.text; });

    if (!rows.length) return profile;

    var bodySize = median(rows.map(function (row) { return row.size; })
      .filter(function (size) { return size > 0; }));
    var style = headingStyle(rows);

    var plain = rows.map(function (row) { return row.text; });

    var mail = plain.join("\n").match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
    if (mail) profile.contact.email = mail[0];
    profile.contact.phone = findPhone(plain);

    var postal = findAddress(plain);
    profile.contact.address = postal.address;
    profile.contact.city = postal.city;

    var named = findName(rows, bodySize);
    profile.contact.name = named.name;
    profile.contact.role = named.role;

    var current = null;      // laufender Abschnitt
    var event = null;        // laufende Station
    var buffer = [];         // Zeilen des Abschnitts ausserhalb einer Station
    var stopped = false;

    function closeEvent() {
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
        listItems(joined).forEach(function (name) { profile.skills.push({ name: name, rank: 0 }); });
      } else if (current === "interests") {
        listItems(joined).forEach(function (name) { profile.interests.push({ name: name }); });
      } else if (current === "languages") {
        //  "Deutsch" / "(Muttersprache)" untereinander ist ein Umbruch,
        //  keine zweite Sprache.
        var glued = joined.replace(/\n\s*\(/g, " (");
        listItems(glued).forEach(function (entry) {
          var parts = entry.split(/\s*[:–—-]\s*|\s{2,}|\s*\(/);
          var name = clean(parts[0]);
          var level = clean((parts[1] || "").replace(/\)$/, ""));
          if (name) {
            profile.languages.push({ name: name, level: level, percentage: fluencyToPercent(level) });
          }
        });
      } else if (current === "projects") {
        collectProjects(buffer, bodySize).forEach(function (project) {
          profile.projects.push(project);
        });
      }
      buffer = [];
    }

    rows.forEach(function (row, index) {
      if (stopped) return;
      var line = row.text;

      //  Ab der Anrede beginnt das Anschreiben. Was danach kommt, gehoert
      //  nicht in den Lebenslauf.
      if (SALUTATION.test(line)) {
        closeEvent(); flushBuffer(); stopped = true; return;
      }

      if (index === named.roleIndex) return;
      if (index >= named.nameIndex && index <= (named.nameEnd === undefined ? named.nameIndex : named.nameEnd)
          && named.nameIndex >= 0) return;

      var heading = headingOf(line);
      if (heading) {
        closeEvent(); flushBuffer();
        current = heading === "ignore" ? null : heading;
        return;
      }

      //  In der Projektliste ist eine hervorgehobene Zeile der Projektname
      //  und keine neue Ueberschrift – dort endet der Abschnitt erst bei
      //  einer bekannten Ueberschrift. Ueberall sonst beendet eine
      //  unbekannte Ueberschrift den Abschnitt, sonst sammelt er den Rest
      //  des Blattes ein.
      if (current !== "projects" && looksLikeHeading(row, bodySize, style)) {
        closeEvent(); flushBuffer();
        current = null;
        return;
      }

      var isStation = current === "experience" || current === "education" ||
                      current === "volunteer" || current === "other";

      if (isStation) {
        var range = line.match(RANGE);
        var single = line.match(SINGLE);

        if (range) {
          //  Ein vollstaendiger Zeitraum beginnt immer eine neue Station.
          closeEvent();
          event = newEvent(current);
          event.start = normDate(range[1]);
          event.present = isPresent(range[2]);
          event.end = event.present ? "" : normDate(range[2]);
          var rest = clean(line.replace(range[0], "").replace(/^[|–—,\t-]\s*/, ""));
          if (rest) assignStationLine(event, rest);
          return;
        }

        if (single) {
          closeEvent();
          event = newEvent(current);
          event.start = normDate(single[1]);
          return;
        }

        var trailing = trailingDate(line);
        if (trailing) {
          //  "ZOOLINO, Bad Wimpeln – 09/15" schliesst die Station ab,
          //  "Praktikum 07/13" beginnt eine neue.
          if (trailing.isEnd && event) {
            event.end = trailing.date;
            event.present = trailing.present;
            if (trailing.rest) assignStationLine(event, trailing.rest);
          } else {
            closeEvent();
            event = newEvent(current);
            if (trailing.present) event.present = true;
            else event.start = trailing.date;
            if (trailing.rest) assignStationLine(event, trailing.rest);
          }
          return;
        }
      }

      if (event) {
        if (/^[-–—•*·]\s*/.test(line)) event.list.push(line.replace(/^[-–—•*·]\s*/, ""));
        else assignStationLine(event, line);
        return;
      }

      if (current) buffer.push(row);
    });

    closeEvent();
    flushBuffer();

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
      return value.length < 40 && value === value.toUpperCase() && /[A-ZÄÖÜ]/.test(value);
    }

    rows.forEach(function (row) {
      var value = clean(row.text).replace(/\t+/g, " ");
      if (!value) return;

      if (isName(row) || !current) {
        var url = (value.match(/https?:\/\/\S+/) || [""])[0];
        var name = clean(value.replace(url, "")) || shortUrl(url);
        if (!url && /^[\w.-]+\.(de|com|org|net|io|dev|eu|ch|at)$/i.test(name)) {
          url = "https://" + name.toLowerCase();
        }
        //  y und Seite bleiben stehen: daran wird gleich das Bild
        //  gefunden, das neben dem Projekt liegt.
        current = { name: name.slice(0, 60), url: url, description: "",
                    img: "", y: row.y || 0, page: row.page || 1 };
        projects.push(current);
        return;
      }

      current.description = clean(current.description + " " + value);
    });

    return projects.filter(function (project) { return project.name; });
  }

  //  Der Name ist die groesste Schrift auf dem Blatt – das gilt quer durch
  //  alle Vorlagen und ist verlaesslicher als "steht oben": in
  //  zweispaltigen Lebenslaeufen kommt zuerst die Seitenspalte. Fehlen die
  //  Schriftgrade, bleibt es bei der Suche von oben.
  function findName(rows, bodySize) {
    function usable(row) {
      var value = clean(row.text);
      if (!value || /[@|]/.test(value) || /\d/.test(value)) return false;
      if (value.split(/\s+/).length > 5 || value.length > 48) return false;
      return !headingOf(value) && !row.spaced;
    }

    if (bodySize) {
      var best = -1;
      rows.forEach(function (row, index) {
        if (!usable(row) || row.size <= bodySize) return;
        if (best < 0 || row.size > rows[best].size) best = index;
      });

      if (best >= 0) {
        //  In einer schmalen Spalte bricht auch der Name um. Die
        //  Folgezeile im selben Schriftgrad gehoert dann noch dazu.
        var name = rows[best].text;
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
          if (usable(rows[i]) && rows[i].size < rows[best].size) { roleIndex = i; break; }
        }

        return {
          name: name,
          role: roleIndex >= 0 ? rows[roleIndex].text : "",
          nameIndex: best,
          nameEnd: after - 1,
          roleIndex: roleIndex,
        };
      }
    }

    var candidates = [];
    for (var n = 0; n < Math.min(rows.length, 14) && candidates.length < 3; n++) {
      if (usable(rows[n])) candidates.push({ text: rows[n].text, index: n });
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

      var together = line.match(/^(.{3,60}?),\s*(\d{4,5}\s+[A-ZÄÖÜ][\wäöüßA-ZÄÖÜ.\- ]{2,})$/);
      if (together && /\d/.test(together[1])) {
        found.address = clean(together[1]);
        found.city = clean(together[2]);
        return found;
      }

      if (!/^\d{4,5}\s+[A-ZÄÖÜ][\wäöüßA-ZÄÖÜ.\- ]{2,}$/.test(line)) continue;

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

  function assignStationLine(event, line) {
    var value = clean(line).replace(/\t+/g, " ");
    if (!value) return;
    if (!event.title) { event.title = value; return; }
    if (!event.company) {
      //  "Firma, Ort" oder "Firma | Ort"
      var parts = value.split(/\s*[|·]\s*|,\s(?=[^,]*$)/);
      event.company = clean(parts[0]);
      if (parts[1]) event.place = clean(parts[1]);
      return;
    }
    event.description.push(value);
  }

  //  Nebeneinander gesetzte Eintraege (Kenntnisse stehen gern in zwei
  //  Spalten) trennt der Tabulator, den die PDF-Ebene gesetzt hat.
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

    var photo = take(function (image) {
      if (image.page !== 1 || image.w < 60) return false;
      if (image.ratio < 0.45 || image.ratio > 1.9) return false;
      //  Im oberen Drittel des Blattes – dort steht ein Bewerbungsfoto.
      return image.y + image.h >= image.pageHeight * 0.6;
    });
    if (photo) profile.photo = photo.src;

    var signature = take(function (image) {
      return image.page > 1 && image.ratio >= 1.5 && image.h <= image.pageHeight * 0.12;
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
      target.profile.text = mode === "merge" && clean(target.profile.text)
        ? target.profile.text
        : clean(profile.profileText);
      target.profile.show = true;
    }

    profile.events.forEach(function (entry) {
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

  function appendItems(target, key, items, map) {
    if (!items || !items.length) return;
    var block = target[key];
    if (!block) return;
    var seen = {};
    block.items.forEach(function (item) { seen[clean(item.name).toLowerCase()] = true; });

    items.forEach(function (item) {
      var name = clean(item.name);
      if (!name || seen[name.toLowerCase()]) return;
      seen[name.toLowerCase()] = true;
      block.items.push(map(item));
    });
    if (block.items.length) block.show = true;
  }

  //  Beim Ersetzen bleibt, was zum Aussehen gehoert: Stil, Vorlage,
  //  Sprache. Der Inhalt geht.
  function freshFrom(state) {
    var base = Model.createBase(state.locale || "de");
    base.style = copy(state.style);
    base.settings = copy(state.settings);
    base.photo = copy(state.photo);
    base.contactTitle = state.contactTitle;
    return base;
  }

  /* ---------------------------------------------------------- Erkennung */

  function detect(name, text) {
    var filename = clean(name).toLowerCase();
    if (/\.zip$/.test(filename)) return "linkedin-zip";
    if (/\.csv$/.test(filename)) return "linkedin-csv";
    if (/\.pdf$/.test(filename)) return "pdf";

    var trimmed = clean(text);
    if (trimmed.charAt(0) === "{") {
      var data = null;
      try { data = JSON.parse(trimmed); } catch (error) { return "text"; }
      if (data && (data.settings || data.contactTitle) && data.contact) return "rickcv";
      if (data && (data.basics || data.work || data.education ||
                   /jsonresume/i.test(clean(data.$schema)))) return "jsonresume";
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
      projects: profile.projects.length,
      references: profile.references.length,
      links: profile.links.length,
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
    var format = detect(name, text);

    if (format === "rickcv" || format === "jsonresume" || format === "json-unknown") {
      var data = JSON.parse(text);
      if (format === "rickcv") {
        var migrated = Model.migrate(data);
        if (!migrated) throw new Error("unreadable");
        return result("rickcv", null, migrated);
      }
      if (format === "json-unknown") throw new Error("unknownJson");
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
      (clean(textProfile.profileText) ? 1 : 0);
    if (!substance) throw new Error("nothingFound");

    //  Kontaktdaten allein sind ein schlechter Import. Dann lieber sagen,
    //  dass wenig erkannt wurde, statt es als Erfolg auszugeben.
    if (!textProfile.events.length) textProfile.warnings.push("thin");
    if (textProfile.images) textProfile.warnings.push("images");

    return result("text", textProfile, null, text);
  }

  //  readFile(file, callback) – callback(error, result)
  function readFile(file, callback) {
    var name = file.name || "";
    var format = detect(name, "");

    if (format === "linkedin-zip") {
      file.arrayBuffer().then(readZip).then(function (files) {
        var profile = fromLinkedIn(files);
        if (!hasContent(profile)) throw new Error("emptyZip");
        callback(null, result("linkedin", profile));
      }).catch(function (error) { callback(error); });
      return;
    }

    if (format === "pdf") {
      if (!global.RickCVPdf) return callback(new Error("noPdfSupport"));
      global.RickCVPdf.extract(file, function (error, data) {
        if (error) return callback(error);
        try {
          var parsed = parseText(data.text, "extracted.txt", data.lines, data.images);
          parsed.format = "pdf";
          callback(null, parsed);
        } catch (parseError) { callback(parseError); }
      });
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () { callback(new Error("unreadable")); };
    reader.onload = function () {
      try {
        callback(null, parseText(String(reader.result), name));
      } catch (error) { callback(error); }
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
    stateToProfile: stateToProfile,
    parseCsv: parseCsv,
    normDate: normDate,
  };
})(typeof window !== "undefined" ? window : this);
