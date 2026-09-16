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
  //  faellt. Das Ergebnis ist ausdruecklich ein Entwurf – es wird nichts
  //  erfunden, aber die Zuordnung kann danebenliegen.
  var HEADINGS = [
    { role: "experience", pattern: /^(berufs?erfahrung|beruflicher werdegang|praxiserfahrung|work experience|professional experience|experience|employment)\b/i },
    { role: "education", pattern: /^(ausbildung|schulbildung|studium|bildungsweg|education|academic)\b/i },
    { role: "volunteer", pattern: /^(ehrenamt|engagement|freiwillig|volunteer|volunteering)\b/i },
    { role: "skills", pattern: /^(kenntnisse|f[äa]higkeiten|skills|kompetenzen|technical skills|it-kenntnisse)\b/i },
    { role: "languages", pattern: /^(sprachen|languages|sprachkenntnisse)\b/i },
    { role: "interests", pattern: /^(interessen|hobbys?|interests|freizeit)\b/i },
    { role: "projects", pattern: /^(projekte|projects|portfolio)\b/i },
    { role: "profile", pattern: /^(profil|über mich|ueber mich|kurzprofil|summary|about|profile|objective)\b/i },
    { role: "other", pattern: /^(weiterbildung|zertifikate|certificates|awards|auszeichnungen|publikationen|publications)\b/i },
  ];

  //  Eine Zeile, die einen Zeitraum traegt: "09/2015 – 07/2021",
  //  "2015 - heute", "Jan 2015 – Dez 2018".
  var RANGE = new RegExp(
    "(\\b(?:\\d{1,2}[./])?\\d{4}\\b|\\b[A-Za-zÄÖÜäöü]{3,9}\\.?\\s+\\d{4}\\b)" +
    "\\s*(?:–|—|-|bis|to|until|\\u2013)\\s*" +
    "(\\b(?:\\d{1,2}[./])?\\d{4}\\b|\\b[A-Za-zÄÖÜäöü]{3,9}\\.?\\s+\\d{4}\\b|heute|present|current|aktuell|now|jetzt|dato)", "i");

  var SINGLE = /^\s*((?:\d{1,2}[./])?\d{4})\s*$/;

  function fromText(text) {
    var profile = emptyProfile();
    var lines = String(text).replace(/\r/g, "").split("\n").map(function (line) {
      return line.replace(/\s+$/, "");
    });

    var mail = String(text).match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
    if (mail) profile.contact.email = mail[0];
    profile.contact.phone = findPhone(lines);

    var postal = findAddress(lines);
    profile.contact.address = postal.address;
    profile.contact.city = postal.city;

    //  Der Name steht fast immer oben: eine kurze Zeile ohne Ziffern,
    //  Klammern und @. In schmalen Spalten bricht er allerdings um, dann
    //  liegen Vor- und Nachname untereinander.
    var candidates = [];
    for (var i = 0; i < Math.min(lines.length, 14) && candidates.length < 3; i++) {
      var candidate = clean(lines[i]);
      if (!candidate || /[@\d|]/.test(candidate)) continue;
      if (candidate.split(/\s+/).length > 5 || candidate.length > 48) continue;
      if (headingOf(candidate)) continue;
      candidates.push(candidate);
    }

    function oneWord(value) {
      return !!value && /^[A-ZÄÖÜ][^\s]*$/.test(value);
    }

    if (oneWord(candidates[0]) && oneWord(candidates[1])) {
      profile.contact.name = candidates[0] + " " + candidates[1];
      profile.contact.role = candidates[2] || "";
    } else {
      profile.contact.name = candidates[0] || "";
      profile.contact.role = candidates[1] || "";
    }

    var current = null;      // laufender Abschnitt
    var event = null;        // laufende Station
    var buffer = [];         // Zeilen des laufenden Abschnitts ohne Station

    function closeEvent() {
      if (event && (event.title || event.company)) profile.events.push(event);
      event = null;
    }

    function flushBuffer() {
      if (!current || !buffer.length) { buffer = []; return; }
      var joined = buffer.join("\n");
      if (current === "profile") {
        //  Im PDF bricht ein Satz mitten im Wort um – aus den Zeilen wird
        //  wieder ein Absatz.
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
        listItems(joined).forEach(function (entry) {
          var url = (entry.match(/https?:\/\/\S+/) || [""])[0];
          profile.projects.push({
            name: clean(entry.replace(url, "").replace(/[–—:-]\s*$/, "")).slice(0, 60),
            url: url,
            description: "",
          });
        });
      }
      buffer = [];
    }

    lines.forEach(function (raw) {
      var line = clean(raw);
      if (!line) return;

      var heading = headingOf(line);
      if (heading) {
        closeEvent();
        flushBuffer();
        current = heading;
        return;
      }

      var range = line.match(RANGE);
      var single = line.match(SINGLE);
      var isStation = current === "experience" || current === "education" ||
                      current === "volunteer" || current === "other";

      if (isStation && (range || single)) {
        closeEvent();
        event = newEvent(current);
        if (range) {
          event.start = normDate(range[1]);
          event.end = isPresent(range[2]) ? "" : normDate(range[2]);
          event.present = isPresent(range[2]);
          var rest = clean(line.replace(range[0], "").replace(/^[|–—,-]\s*/, ""));
          if (rest) assignStationLine(event, rest);
        } else {
          event.start = normDate(single[1]);
        }
        return;
      }

      if (event) {
        if (/^[-–—•*·]\s*/.test(line)) event.list.push(line.replace(/^[-–—•*·]\s*/, ""));
        else assignStationLine(event, line);
        return;
      }

      if (current) buffer.push(line);
    });

    closeEvent();
    flushBuffer();

    if (profile.events.length) profile.warnings.push("draft");
    return profile;
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
  //  Strasse, sofern sie wie eine aussieht.
  function findAddress(lines) {
    var found = { address: "", city: "" };

    for (var i = 0; i < lines.length; i++) {
      var line = clean(lines[i]);
      if (!/^\d{4,5}\s+[A-ZÄÖÜ][\wäöüßA-ZÄÖÜ.\- ]{2,}$/.test(line)) continue;

      found.city = line;
      var before = clean(lines[i - 1] || "");
      if (before && !/[@]/.test(before) && !headingOf(before) &&
          (/\d/.test(before) || /(stra(ß|ss)e|str\.|weg|allee|platz|gasse|ring|damm)/i.test(before))) {
        found.address = before;
      }
      break;
    }

    return found;
  }

  function assignStationLine(event, line) {
    if (!event.title) { event.title = line; return; }
    if (!event.company) {
      //  "Firma, Ort" oder "Firma | Ort"
      var parts = line.split(/\s*[|·]\s*|,\s(?=[^,]*$)/);
      event.company = clean(parts[0]);
      if (parts[1]) event.place = clean(parts[1]);
      return;
    }
    event.description.push(line);
  }

  function headingOf(line) {
    var value = clean(line).replace(/[:•]+$/, "");
    if (value.length > 40) return null;
    for (var i = 0; i < HEADINGS.length; i++) {
      if (HEADINGS[i].pattern.test(value)) return HEADINGS[i].role;
    }
    return null;
  }

  function listItems(text) {
    return String(text).split(/\n|[;,•·]|\s{3,}|\s\|\s/)
      .map(function (entry) { return clean(entry).replace(/^[-–—•*·]\s*/, ""); })
      .filter(function (entry) { return entry && entry.length < 60; });
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
    };
  }

  function result(format, profile, state) {
    return {
      format: format,
      profile: profile || null,
      state: state || null,
      summary: profile ? summarize(profile) : summarize(stateToProfile(state)),
      warnings: (profile && profile.warnings) || [],
    };
  }

  /* ------------------------------------------------------------- Eingang */

  function parseText(text, name) {
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

    var textProfile = fromText(text);
    //  Ein einzelner erkannter Name ist noch kein Lebenslauf – sonst wird
    //  aus jedem hineingeworfenen Schnipsel ein "Import".
    var substance = textProfile.events.length + textProfile.skills.length +
      textProfile.languages.length + textProfile.projects.length +
      (clean(textProfile.contact.email) ? 1 : 0) + (clean(textProfile.contact.phone) ? 1 : 0) +
      (clean(textProfile.profileText) ? 1 : 0);
    if (!substance) throw new Error("nothingFound");
    return result("text", textProfile);
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
      global.RickCVPdf.extract(file, function (error, text) {
        if (error) return callback(error);
        try {
          var parsed = parseText(text, "extracted.txt");
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
