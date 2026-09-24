/*  ai-help.js – "Mit deiner KI erstellen".
 *
 *  RickCV hat kein Sprachmodell eingebaut und schickt nichts irgendwohin.
 *  Wer ohnehin eines benutzt, bekommt hier einen fertigen Auftrag zum
 *  Kopieren – mit allem, was das Modell ueber RickCV wissen muss. Zwei
 *  Faelle, weil die Werkzeuge verschieden viel koennen:
 *
 *    – Ein Chat im Browser (ChatGPT, Claude, Gemini, Le Chat …) kann nicht
 *      verlaesslich Base64 rechnen; ein Link, in dem ein Zeichen falsch
 *      steht, oeffnet nichts. Der Chat antwortet deshalb mit dem JSON, und
 *      das kommt hier in dasselbe Feld zurueck – durch dieselbe Bestaetigung
 *      wie jeder Import. Das Format steht vollstaendig im Auftrag, denn nicht
 *      jeder Chat liest Seiten im Netz.
 *
 *    – Ein Agent (Claude Code, Codex, ChatGPT-Agent …) kann Code ausfuehren
 *      und Seiten lesen. Er bekommt nur den Verweis auf AGENTS.md und baut
 *      den Link selbst.
 *
 *  Was jemand seiner KI gibt, liegt danach bei deren Anbieter. Das steht im
 *  Dialog, und der eigene Stand geht nur mit, wenn man es so ankreuzt – ohne
 *  Foto und ohne Bilder.
 */
(function (global) {
  "use strict";

  var SITE = "https://cv.rickinto.place/";
  var AGENTS = SITE + "AGENTS.md";

  //  Das Beispiel aus AGENTS.md, knapp: jedes Feld einmal, damit das Modell
  //  die Form sieht, und nichts, was es fuer Inhalt halten koennte.
  var EXAMPLE = {
    de: {
      version: 5,
      locale: "de",
      settings: { pageSize: "a4", showCoverLetter: true },
      theme: { slug: "clean" },
      contact: {
        name: "Vorname Nachname", role: "Berufsbezeichnung",
        address: "Straße 1", city: "12345 Ort",
        email: "name@example.org", phone: "+49 30 1234567",
      },
      profile: { show: true, text: "Zwei, drei Sätze über dich." },
      events: [
        {
          sectionId: "experience", title: "Tätigkeit", company: "Arbeitgeber",
          place: "Ort", start: "04/2019", present: true,
          description: ["Ein Absatz"], list: ["Ein Aufzählungspunkt"],
        },
        {
          sectionId: "education", title: "Abschluss", company: "Hochschule",
          place: "Ort", start: "10/2013", end: "09/2016",
        },
      ],
      skills: { show: true, items: [{ name: "Kenntnis", rank: 0 }] },
      languages: { show: true, items: [{ name: "Englisch", level: "B2", percentage: 70 }] },
      interests: { show: true, items: [{ name: "Interesse" }] },
      coverLetter: {
        recipient: "Firma GmbH\nFrau Beispiel\nStraße 3\n12345 Ort",
        subject: "Bewerbung als …",
        salutation: "Sehr geehrte Frau Beispiel,",
        paragraphs: ["Erster Absatz.", "Zweiter Absatz."],
        closing: "Mit freundlichen Grüßen",
      },
    },
    en: {
      version: 5,
      locale: "en",
      settings: { pageSize: "letter", showCoverLetter: true },
      theme: { slug: "clean" },
      contact: {
        name: "First Last", role: "Job title",
        address: "1 Main Street", city: "Springfield, IL 62701",
        email: "name@example.org", phone: "+1 555 123 4567",
      },
      profile: { show: true, text: "Two or three sentences about you." },
      events: [
        {
          sectionId: "experience", title: "Position", company: "Employer",
          place: "City", start: "04/2019", present: true,
          description: ["A paragraph"], list: ["A bullet point"],
        },
        {
          sectionId: "education", title: "Degree", company: "University",
          place: "City", start: "09/2013", end: "06/2017",
        },
      ],
      skills: { show: true, items: [{ name: "Skill", rank: 0 }] },
      languages: { show: true, items: [{ name: "Spanish", level: "B2", percentage: 70 }] },
      interests: { show: true, items: [{ name: "Interest" }] },
      coverLetter: {
        recipient: "Company Inc.\nMs Sample\n3 Market Street\nSpringfield, IL 62701",
        subject: "Application for the position of …",
        salutation: "Dear Ms Sample,",
        paragraphs: ["First paragraph.", "Second paragraph."],
        closing: "Sincerely,",
      },
    },
  };

  //  Was vom eigenen Stand mitgeht: der Inhalt. Bilder bleiben daheim – sie
  //  sind gross, sagen dem Modell nichts, und ein Foto gehoert niemandem
  //  sonst. Ebenso ein eigenes Theme (CSS) und alles, was nur das Aussehen
  //  steuert.
  function snapshot(state) {
    var copy = JSON.parse(JSON.stringify(state || {}));
    delete copy.photo;
    delete copy.style;
    delete copy.ats;
    delete copy.footers;
    if (copy.theme) copy.theme = { slug: copy.theme.slug || "" };
    if (copy.settings) {
      copy.settings = {
        pageSize: copy.settings.pageSize,
        showCoverLetter: copy.settings.showCoverLetter,
      };
    }
    if (copy.coverLetter) {
      delete copy.coverLetter.signatureImg;
      delete copy.coverLetter.signatureHeight;
    }
    (copy.events || []).forEach(function (event) {
      delete event.icon;
      delete event.color;
      Object.keys(event).forEach(function (key) {
        if (event[key] === "" || event[key] === false ||
            (Array.isArray(event[key]) && !event[key].length)) delete event[key];
      });
    });
    (copy.sections || []).forEach(function (section) { delete section.icon; });
    ["skills", "languages", "interests", "projects", "references", "mobility", "mobilitySB"]
      .forEach(function (key) {
        var block = copy[key];
        if (!block || !Array.isArray(block.items)) return;
        delete block.icon;
        block.items.forEach(function (item) {
          delete item.icon;
          delete item.img;
        });
      });
    return copy;
  }

  var TEXT = {
    de: {
      chat: [
        "Du hilfst mir, meine Bewerbung mit RickCV zu erstellen (" + SITE + "). " +
        "RickCV ist ein Lebenslauf- und Anschreiben-Baukasten im Browser; er liest ein JSON-Dokument, dessen Aufbau unten steht.",
        "",
        "So gehst du vor:",
        "1. Frag mich nach allem, was fehlt – Stationen mit Zeitraum, Ausbildung, Kenntnisse, Sprachen – und, " +
        "wenn ich mich auf eine bestimmte Stelle bewerbe, nach der Stellenanzeige. Schreib erst, wenn du genug weißt.",
        "2. Erfinde nichts: keine Stationen, Noten, Zahlen oder Selbsteinschätzungen, die ich nicht genannt habe. " +
        "Kennst du die Stufe einer Kenntnis nicht, setz \"rank\": 0.",
        "3. Kein versteckter Text und keine unsichtbaren Schlagwörter – Bewerbungssysteme werten das als Manipulation.",
        "4. Ein deutsches Anschreiben folgt DIN 5008: Empfänger mit Anschrift, ein Betreff (ohne das Wort „Betreff“), " +
        "Anrede, drei bis vier Absätze, Gruß. Ort und Datum lässt du weg, die setzt RickCV.",
        "5. Antworte am Ende mit genau einem vollständigen JSON-Codeblock. Kürze nichts, lass nichts weg, schreib keine Kommentare hinein.",
        "",
        "Aufbau (alles ist optional; was fehlt, füllt RickCV mit Vorgaben):",
        "{example}",
        "",
        "Zu den Feldern:",
        "- locale: \"de\" oder \"en\"; settings.pageSize: \"a4\" oder \"letter\" (USA, Kanada)",
        "- events[].sectionId: \"experience\", \"education\" oder \"volunteer\"; start/end als \"MM/YYYY\" oder \"YYYY\"; present: true heißt „bis heute“",
        "- events[].description sind Absätze, events[].list Aufzählungspunkte",
        "- skills.items[].rank 0 bis 5 (0 = nicht angegeben); languages.items[].percentage 0 bis 100",
        "- theme.slug: clean, dynaline, icons, klassisch, kompakt, terminal, rightrail, marginheads oder banner",
        "{state}",
        "Meine Angaben und, falls vorhanden, die Stellenanzeige:",
        "[hier einfügen]",
      ],
      agent: [
        "Erstelle meine Bewerbung mit RickCV (" + SITE + "), einem Lebenslauf- und Anschreiben-Baukasten im Browser.",
        "Lies zuerst " + AGENTS + " – dort stehen das Datenformat und wie du den Link baust.",
        "",
        "- Frag nach, was fehlt, bevor du schreibst. Erfinde nichts; kennst du die Stufe einer Kenntnis nicht, setz \"rank\": 0.",
        "- Kein versteckter Text, keine unsichtbaren Schlagwörter.",
        "- Ein deutsches Anschreiben folgt DIN 5008; Ort und Datum lässt du weg.",
        "- Gib mir am Ende den fertigen Link (" + SITE + "#data=…). Wird er länger als 100 000 Zeichen, gib mir stattdessen das JSON.",
        "{state}",
        "Meine Angaben und, falls vorhanden, die Stellenanzeige:",
        "[hier einfügen]",
      ],
      state: "Mein bisheriger Stand in RickCV – überarbeite ihn, statt neu anzufangen, und behalte die sectionId-Werte bei:",
    },
    en: {
      chat: [
        "Help me build my job application with RickCV (" + SITE + "). " +
        "RickCV is a resume and cover-letter builder that runs in the browser; it reads a JSON document whose structure is below.",
        "",
        "How to go about it:",
        "1. Ask me for anything that is missing – positions with dates, education, skills, languages – and, " +
        "if I am applying for a particular job, for the job posting. Only write once you know enough.",
        "2. Invent nothing: no positions, grades, figures or self-assessments I did not give you. " +
        "If you do not know a skill level, use \"rank\": 0.",
        "3. No hidden text and no invisible keywords – applicant tracking systems treat that as manipulation.",
        "4. Leave out the place and date line of the cover letter; RickCV fills it in.",
        "5. Finish with exactly one complete JSON code block. Do not shorten anything, leave nothing out, add no comments.",
        "",
        "Structure (everything is optional; RickCV fills in defaults):",
        "{example}",
        "",
        "About the fields:",
        "- locale: \"en\" or \"de\"; settings.pageSize: \"letter\" (US, Canada) or \"a4\"",
        "- events[].sectionId: \"experience\", \"education\" or \"volunteer\"; start/end as \"MM/YYYY\" or \"YYYY\"; present: true means \"to date\"",
        "- events[].description holds paragraphs, events[].list bullet points",
        "- skills.items[].rank 0 to 5 (0 = not stated); languages.items[].percentage 0 to 100",
        "- theme.slug: clean, dynaline, icons, klassisch, kompakt, terminal, rightrail, marginheads or banner",
        "{state}",
        "My details and, if there is one, the job posting:",
        "[paste here]",
      ],
      agent: [
        "Build my job application with RickCV (" + SITE + "), a resume and cover-letter builder that runs in the browser.",
        "First read " + AGENTS + " – it describes the data format and how to build the link.",
        "",
        "- Ask for whatever is missing before you write. Invent nothing; if you do not know a skill level, use \"rank\": 0.",
        "- No hidden text, no invisible keywords.",
        "- Leave out the place and date line of the cover letter.",
        "- Finish by giving me the finished link (" + SITE + "#data=…). If it would be longer than 100,000 characters, give me the JSON instead.",
        "{state}",
        "My details and, if there is one, the job posting:",
        "[paste here]",
      ],
      state: "My current document in RickCV – revise it instead of starting over, and keep the sectionId values:",
    },
  };

  //  kind: "chat" | "agent"; state: der aktuelle Stand oder null.
  function prompt(kind, locale, state) {
    var lang = locale === "en" ? "en" : "de";
    var text = TEXT[lang];
    var block = state
      ? "\n" + text.state + "\n```json\n" + JSON.stringify(snapshot(state), null, 1) + "\n```\n"
      : "";
    return text[kind === "agent" ? "agent" : "chat"].join("\n")
      .replace("{example}", "```json\n" + JSON.stringify(EXAMPLE[lang], null, 1) + "\n```")
      .replace("{state}", block);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /*  Der Dialog.
   *
   *  config: {
   *    t, locale, state(),       – Uebersetzung, Sprache, aktueller Stand
   *    ownContent,               – steht etwas Eigenes da (nicht das Beispiel)?
   *    copy(text, done),         – in die Zwischenablage
   *    toast(message),
   *    onAnswer(text),           – die Antwort des Chats, weiter zum Import
   *  }
   */
  function open(config) {
    var t = config.t;
    var kind = "chat";
    var withState = !!config.ownContent;

    var intro = el("p", "imp-intro", t("aiIntro"));

    var modes = el("div", "imp-modes");
    [
      { value: "chat", label: "aiChat", hint: "aiChatHint" },
      { value: "agent", label: "aiAgent", hint: "aiAgentHint" },
    ].forEach(function (entry) {
      var option = el("label", "imp-mode");
      var radio = el("input");
      radio.type = "radio";
      radio.name = "ai-kind";
      radio.value = entry.value;
      radio.checked = kind === entry.value;
      radio.addEventListener("change", function () {
        kind = entry.value;
        refresh();
      });
      var text = el("span", "imp-mode-text");
      text.appendChild(el("strong", null, t(entry.label)));
      text.appendChild(el("small", null, t(entry.hint)));
      option.appendChild(radio);
      option.appendChild(text);
      modes.appendChild(option);
    });

    var include = el("label", "ai-include");
    var box = el("input");
    box.type = "checkbox";
    box.checked = withState;
    box.addEventListener("change", function () {
      withState = box.checked;
      refresh();
    });
    include.appendChild(box);
    include.appendChild(el("span", null, t("aiIncludeState")));

    var promptLabel = el("p", "imp-label", t("aiPromptLabel"));
    var area = el("textarea", "imp-textarea ai-prompt");
    area.readOnly = true;
    area.rows = 7;
    area.setAttribute("aria-label", t("aiPromptLabel"));
    area.addEventListener("focus", function () { area.select(); });

    var copyButton = el("button", "btn btn-primary ai-copy", t("aiCopy"));
    copyButton.type = "button";
    copyButton.addEventListener("click", function () {
      config.copy(area.value, function (worked) {
        config.toast(worked ? t("aiCopied") : t("expCopyFailed"));
        if (!worked) area.select();
      });
    });

    var steps = el("p", "imp-note ai-steps");

    //  Nur beim Chat: die Antwort kommt hier zurueck.
    var answer = el("div", "ai-answer");
    var answerLabel = el("label", "imp-label", t("aiAnswerLabel"));
    var answerArea = el("textarea", "imp-textarea");
    answerArea.id = "ai-answer-text";
    answerArea.rows = 4;
    answerArea.placeholder = t("aiAnswerHint");
    answerLabel.htmlFor = answerArea.id;
    var take = el("button", "btn", t("aiAnswerApply"));
    take.type = "button";
    answer.appendChild(answerLabel);
    answer.appendChild(answerArea);
    answer.appendChild(take);

    var privacy = el("p", "imp-note ai-privacy", t("aiPrivacy"));

    function refresh() {
      area.value = prompt(kind, config.locale, withState ? config.state() : null);
      steps.textContent = t(kind === "agent" ? "aiAgentSteps" : "aiChatSteps");
      answer.hidden = kind === "agent";
    }
    refresh();

    var closeDialog = null;
    take.addEventListener("click", function () {
      var text = answerArea.value.trim();
      if (!text) { answerArea.focus(); return; }
      if (closeDialog) closeDialog("answer");
      config.onAnswer(text);
    });

    return global.RickCVDialog.open({
      title: t("aiTitle"),
      className: "ai-dialog",
      body: [intro, modes, include, promptLabel, area, copyButton, steps, answer, privacy],
      actions: [{ label: t("close"), value: null }],
      ready: function (close) {
        closeDialog = close;
        copyButton.focus();
      },
    });
  }

  global.RickCVAi = { prompt: prompt, snapshot: snapshot, open: open };
})(typeof window !== "undefined" ? window : this);
