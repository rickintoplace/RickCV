/*  Prüft das Datenmodell: Migration älterer Stände, die Prüfung fremder
 *  Dokumente, die Rechnung mit Monaten und den Verlauf hinter
 *  "Rückgängig".
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/model.test.mjs
 *  Gebraucht wird nur Node (ab 20); der Browsercode läuft in einer
 *  vm-Sandbox.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function sandbox(files) {
  const box = {
    console, JSON, Object, Number, String, Math, RegExp, Date, Array, Error, Promise,
    TextDecoder, TextEncoder, Blob, Response, DecompressionStream, CompressionStream,
    setTimeout, clearTimeout, Uint8Array,
    document: { createElement: () => ({ style: {} }), head: { appendChild() {} } },
    navigator: { userAgent: "node" },
  };
  box.window = box; box.globalThis = box;
  vm.createContext(box);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
  }
  return box;
}

const box = sandbox(["js/i18n.js", "js/model.js", "js/ats.js", "js/import.js", "js/history.js"]);
const Model = box.RickCVModel;
const Import = box.RickCVImport;
const clone = (value) => JSON.parse(JSON.stringify(value));

/* ------------------------------------------------------------ Migration */

console.log("\n— Migration älterer Stände —");

//  v2: feste Kategorien, Schalter für getrennte Blöcke, Referenzen als Liste.
const v2 = Model.migrate({
  locale: "de",
  sectionTitles: { education: "Schule", contact: "Erreichbar" },
  settings: { separateEducation: true, separateVolunteer: 0, activateATS: true },
  contact: { name: "Alt" },
  events: [
    { title: "Lehre", start: "01/2010", end: "12/2012", kind: "education", icon: "school" },
    { title: "Verein", start: "2015", volunteer: "1", present: "1" },
    { title: "Job", start: "03/2013", end: "12/2014" },
  ],
  references: [{ name: "Frau Beispiel" }],
});
ok(v2.version === Model.VERSION, "v2 landet auf der aktuellen Fassung", v2.version);
ok(v2.sections.length === 2 && !v2.sections.some((s) => s.id === "volunteer"),
   "abgeschaltetes Ehrenamt verschwindet als Kategorie", v2.sections.map((s) => s.id));
ok(v2.sections[0].title === "Schule", "eigener Titel bleibt", v2.sections[0].title);
ok(v2.contactTitle === "Erreichbar", "Kontaktüberschrift übernommen");
ok(v2.events[1].sectionId === "experience", "Ehrenamt wandert zur Erfahrung", v2.events[1].sectionId);
ok(v2.events[1].present === true, '"1" wird zu present: true');
ok(v2.events[0].icon.name === "graduation-cap", "altes Material-Symbol wird Lucide", v2.events[0].icon.name);
ok(v2.references.items.length === 1 && v2.references.items[0].name === "Frau Beispiel",
   "Referenzliste wird zur Sektion");
ok(v2.ats.mode === "off" && v2.ats.migratedFrom === "hidden", "alte unsichtbare Textfassung aus");
ok(v2.settings.pageMode === "single", "ohne mehrseitig: ein Blatt", v2.settings.pageMode);

const v3 = Model.migrate({ version: 3, settings: { multiPage: true }, contact: { name: "Drei" },
                           sections: [{ id: "experience", title: "Werdegang", atsRole: "experience" }] });
ok(v3.settings.pageMode === "flow" && v3.settings.multiPage === undefined, "v3: mehrseitig wird flow");
ok(v3.sections[0].title === "Werdegang", "v3: Kategorien bleiben unangetastet");

const v4 = Model.migrate({ version: 4, settings: {}, coverLetter: { place: "Köln", date: "1. Mai" },
                           footers: { left: { place: "Bonn" } } });
ok(v4.settings.place === "Köln" && v4.settings.date === "1. Mai", "v4: Ort und Datum ziehen um");
ok(v4.coverLetter.place === undefined && v4.footers.left.place === undefined,
   "v4: alte Felder verschwinden");

//  Ein heutiges Dokument ohne Fassungsnummer – so baut es ein Sprachmodell
//  nach AGENTS.md. Es darf nicht durch die Umstellung von v2 laufen.
const bare = Model.migrate({
  contact: { name: "Nora" },
  sections: [{ id: "experience", title: "Stationen" }, { id: "extra", title: "Sonstiges" }],
  references: { show: true, items: [{ name: "R" }] },
});
ok(bare.sections.length === 2 && bare.sections[0].title === "Stationen",
   "ohne Nummer: Kategorien bleiben", bare.sections.map((s) => s.title));
ok(bare.sections[0].atsRole === "experience" && bare.sections[1].atsRole === "other",
   "fehlende Rolle aus der id, sonst other");
ok(bare.references.show === true && bare.references.items.length === 1,
   "ohne Nummer: Referenzen bleiben");
ok(bare.settings.pageMode === "flow", "ohne Nummer: Vorgabe flow statt ein Blatt", bare.settings.pageMode);

const example = Model.createExample("de");
const again = Model.migrate(clone(example));
ok(JSON.stringify(again.events) === JSON.stringify(example.events), "Beispiel übersteht die Migration");

/* --------------------------------------------------------- Fremde Werte */

console.log("\n— Fremde Werte werden entschärft —");

const payload = 'x"><img src=x onerror=alert(1)>';
const hostile = Model.migrate({
  version: 5,
  settings: { alignText: payload, pageSize: "tabloid", pageMode: 7, page2: "nein" },
  style: { accentColor: "url(https://evil.example/p.png)", fontColor: "red;background:url(x)",
           baseFontSize: "15", sidebarWidth: "breit", iconColorCustom: "var(--a) url(//evil)" },
  photo: { shape: "band evil", src: "https://tracker.example/pixel.gif" },
  events: [
    { title: "A", start: "2019", description: "Zeile 1\nZeile 2", list: [1, {}, "Punkt"],
      icon: "cat", color: "url(https://evil.example/)" },
    "kein Objekt",
    { title: "B", icon: { set: "material", name: "school" }, dateMode: "sometimes" },
  ],
  sections: [{ id: 'a"b', title: "Q" }, { id: 'a"b', title: "Doppelt" }, { title: "ohne id" }],
  skills: { items: "keine Liste" },
  languages: { items: [{ name: "Deutsch", percentage: "90" }] },
  footers: { left: { links: [{ label: "x", icon: "globe" }], mode: "evil", page: 3 } },
  coverLetter: { paragraphs: "Ein Absatz" },
  ats: { mode: "loud" },
});
ok(hostile.settings.alignText === "left", "alignText nur aus der Auswahl", hostile.settings.alignText);
ok(hostile.settings.pageSize === "a4" && hostile.settings.pageMode === "flow", "Seitenformat und -modus");
ok(typeof hostile.settings.page2 === "object" && hostile.settings.page2.sidebar === "keep",
   "page2 wird wieder ein Objekt");
ok(hostile.style.accentColor === "#286f6f", "url() ist keine Farbe", hostile.style.accentColor);
ok(hostile.style.fontColor === "#33333b", "Stilanweisung ist keine Farbe", hostile.style.fontColor);
ok(hostile.style.iconColorCustom === "#286f6f", "var() mit url() ist keine Farbe");
ok(hostile.style.baseFontSize === 15, "Zahl als Text wird Zahl", hostile.style.baseFontSize);
ok(hostile.style.sidebarWidth === 35, "Unsinn wird Vorgabe", hostile.style.sidebarWidth);
ok(hostile.photo.shape === "band", "Bildform nur aus der Auswahl", hostile.photo.shape);
ok(hostile.events.length === 2, "Station ohne Objekt fällt weg", hostile.events.length);
ok(JSON.stringify(hostile.events[0].description) === '["Zeile 1","Zeile 2"]',
   "Beschreibung als Text wird Liste", JSON.stringify(hostile.events[0].description));
ok(JSON.stringify(hostile.events[0].list) === '["1","Punkt"]', "Punkte: nur Texte und Zahlen");
ok(hostile.events[0].icon.set === "lucide" && hostile.events[0].icon.name === "cat",
   "Symbol als Name wird Objekt");
ok(hostile.events[0].color === "var(--accent-color-shade2)", "Farbe der Station entschärft");
ok(hostile.events[1].dateMode === "auto", "unbekannter Datumsmodus wird auto");
ok(hostile.events[1].color && hostile.events[1].hoffset === 0, "fehlende Felder ergänzt");
ok(hostile.events.every((e) => hostile.sections.some((s) => s.id === e.sectionId)),
   "jede Station hat eine Kategorie");
const ids = hostile.sections.map((s) => s.id);
ok(new Set(ids).size === ids.length && ids.every(Boolean), "Kategorie-ids eindeutig und gesetzt", ids);
ok(Array.isArray(hostile.skills.items) && hostile.skills.items.length === 0, "Liste statt Text");
ok(hostile.languages.items[0].percentage === 90 && hostile.languages.items[0].level === "",
   "Sprache: Zahl und fehlendes Feld");
ok(hostile.footers.left.mode === "iconText" && hostile.footers.left.page === "last",
   "Fußzeile: Modus und Blatt aus der Auswahl");
ok(hostile.footers.left.links[0].icon.name === "globe", "Link-Symbol als Name");
ok(JSON.stringify(hostile.coverLetter.paragraphs) === '["Ein Absatz"]', "Absatz als Text wird Liste");
const letter = Model.migrate({ version: 5, coverLetter: { paragraphs: "Eins\nweiter\n\nZwei" } });
ok(JSON.stringify(letter.coverLetter.paragraphs) === '["Eins\\nweiter","Zwei"]',
   "Leerzeile trennt Absätze, einfacher Umbruch bleibt", JSON.stringify(letter.coverLetter.paragraphs));
const kept = Model.migrate(clone(example));
ok(JSON.stringify(kept.coverLetter.paragraphs) === JSON.stringify(example.coverLetter.paragraphs),
   "Absätze des Beispiels bleiben");
ok(hostile.ats.mode === "off", "unbekannter ATS-Modus wird off");

ok(Model.migrate("Text") === null && Model.migrate([1, 2]) === null, "kein Objekt: null");
ok(Model.migrate({ settings: "kaputt", events: { a: 1 }, contact: 5 }).contact.name === "",
   "kaputte Blöcke werden ersetzt statt zu werfen");

console.log("\n— Farben und Bilder —");
for (const good of ["#286f6f", "red", "rgb(1 2 3 / 50%)", "var(--accent-color-shade1)",
                    "color-mix(in oklab, #fff, #000 20%)"]) {
  ok(Model.isColor(good), `Farbe: ${good}`);
}
for (const bad of ["url(x)", "red; x: y", "\\75 rl(x)", "image-set('a' 1x)", "", "var(--a) url(//e)"]) {
  ok(!Model.isColor(bad), `keine Farbe: ${bad}`);
}
for (const local of ["./img/example/photo.webp", "data:image/png;base64,AA", "img/a.png"]) {
  ok(Model.isLocalImage(local), `lokales Bild: ${local}`);
}
for (const remote of ["https://x.example/a.png", "//x.example/a.png", "javascript:alert(1)",
                      "../geheim.png", "blob:abc"]) {
  ok(!Model.isLocalImage(remote), `kein lokales Bild: ${remote}`);
}
const legacy = Model.migrate({
  version: 5, settings: {}, contact: { name: "x" },
  photo: { src: "https://i.ibb.co/QKnK1ry/image.webp" },
  projects: { items: [{ name: "p", img: "https://opengameart.org/sites/default/files/1_7.jpg" }] },
});
ok(legacy.photo.src === Model.EXAMPLE_IMAGES.photo, "altes Beispielfoto wird das neue");
ok(legacy.projects.items[0].img === Model.EXAMPLE_IMAGES.palm, "altes Projektbild wird das neue");
for (const file of Object.values(Model.EXAMPLE_IMAGES)) {
  ok(fs.existsSync(path.join(root, file)), `Beispielbild liegt im Projekt: ${file}`);
}
const allExampleImages = [example.photo.src].concat(example.projects.items.map((p) => p.img));
ok(allExampleImages.every(Model.isLocalImage), "Beispiel lädt nichts aus dem Netz", allExampleImages);

/* ----------------------------------------------------------------- Datum */

console.log("\n— Monate —");
ok(Model.monthIndex("04/2019") === 2019 * 12 + 3, "MM/YYYY");
ok(Model.monthIndex("2019") === 2019 * 12, "YYYY als Beginn: Januar");
ok(Model.monthIndex("2019", true) === 2019 * 12 + 11, "YYYY als Ende: Dezember");
ok(Model.monthIndex("20XX") === null && Model.monthIndex("13/2019") === null, "Unlesbares: null");
ok(Model.compareStart({ start: "2019" }, { start: "04/2018" }) > 0,
   "Jahreszahl sortiert nach ihrem Jahr, nicht vor alles");
ok(Model.compareStart({ start: "2019" }, { start: "04/2019" }) < 0, "…und innerhalb des Jahres vorn");
const now = new Date(2026, 8, 1);
ok(Model.eventEnd({ start: "01/2020", present: true }, now) === 2026 * 12 + 8, '"bis heute" endet jetzt');
ok(Model.eventEnd({ start: "05/2020" }) === 2020 * 12 + 4, "ohne Ende: ein Zeitpunkt");

const events = [
  { title: "Neu", start: "2021", sectionId: "experience" },
  { title: "Alt", start: "06/2015", end: "2018", sectionId: "experience" },
  { title: "Mitte", start: "03/2019", end: "12/2020", sectionId: "experience" },
];
const text = box.RickCVAts.toText(Object.assign(Model.createBase("de"), { events }));
ok(text.indexOf("Neu") < text.indexOf("Mitte") && text.indexOf("Mitte") < text.indexOf("Alt"),
   "Textfassung: neueste zuerst, auch mit Jahreszahlen");

/* ---------------------------------------------------------------- Import */

console.log("\n— Import: Erkennung und Hinweise —");
const brokenError = (() => {
  try { Import.parseText('{"contact": {"name": "x}}', "eingefuegt.txt"); return null; }
  catch (error) { return error.message; }
})();
ok(brokenError === "brokenJson", "kaputtes JSON wird als solches gemeldet", brokenError);

//  Ein Komma vor der Klammer schreiben Menschen und Sprachmodelle gleichermaßen.
//  Das ist kein Grund, das Dokument abzulehnen – und ohne Fassung ist es
//  trotzdem eines von RickCV (AGENTS.md: alles ist optional).
const lenient = Import.parseText('{"contact": {"name": "x",}}', "eingefuegt.txt");
ok(lenient.format === "rickcv" && lenient.state.contact.name === "x",
   "ein Komma zu viel und keine Fassung", lenient.format);

const agentDoc = JSON.stringify({ version: 5, contact: { name: "Agent" } });
const agentParsed = Import.parseText(agentDoc, "link.json");
ok(agentParsed.format === "rickcv", "Dokument ohne settings, aber mit Fassung", agentParsed.format);

const loud = Import.parseText(JSON.stringify({
  version: 5, settings: {}, contact: { name: "L" }, ats: { mode: "hidden" },
  theme: { slug: "", css: ".x{color:red}" },
}), "link.json");
ok(loud.state.ats.mode === "off", "unsichtbarer Text wird beim Import ausgeschaltet");
ok(loud.warnings.includes("hiddenAts") && loud.warnings.includes("customTheme"),
   "…und die Bestätigung sagt es, samt eigenem Theme", loud.warnings);
const newer = Import.parseText(JSON.stringify({ version: 99, settings: {}, contact: { name: "N" } }),
                               "x.json");
ok(newer.warnings.includes("newer"), "neuere Fassung wird angesagt");

const bomb = new Uint8Array(2 * 1024 * 1024);
const packed = new Uint8Array(await new Response(
  new Blob([bomb]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
const limited = await Import.inflateRaw(packed, 1024 * 1024).then(() => "ok", (e) => e.message);
ok(limited === "tooLarge", "Entpacken hält an der Grenze an", limited);
const fine = await Import.inflateRaw(packed, 4 * 1024 * 1024).then((b) => b.length, (e) => e.message);
ok(fine === bomb.length, "…und darunter kommt alles heraus", fine);

/* ---------------------------------------------------------------- Verlauf */

console.log("\n— Rückgängig —");

//  Eine Uhr zum Weiterdrehen: die Ruhezeit läuft nur, wenn der Test es sagt.
function fakeClock() {
  let timers = [];
  let id = 0;
  return {
    setTimeout(fn, ms) { timers.push({ id: ++id, fn }); return id; },
    clearTimeout(which) { timers = timers.filter((t) => t.id !== which); },
    tick() { const due = timers; timers = []; due.forEach((t) => t.fn()); },
  };
}

function editor() {
  const clock = fakeClock();
  let doc = "S0";
  const steps = box.RickCVHistory.create({
    read: () => doc, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
  });
  return {
    clock, steps,
    type(next) { doc = next; steps.touch(); },
    get doc() { return doc; },
    set doc(next) { doc = next; },
    undo() { const back = steps.undo(); if (back !== null) { doc = back; steps.reset(); } return back; },
    replace(next) { steps.checkpoint(); doc = next; steps.reset(); },
  };
}

let e = editor();
e.type("S1"); e.type("S1b");
ok(e.steps.canUndo(), "Rückgängig ist schon während des Tippens möglich");
e.clock.tick();
e.type("S2");
ok(e.undo() === "S1b" && e.doc === "S1b", "mitten im Tippen: genau ein Schritt zurück", e.doc);
ok(e.undo() === "S0", "…und dann der nächste");
ok(e.undo() === null, "…bis nichts mehr da ist");

e = editor();
e.type("S1"); e.clock.tick();
e.type("S2");                       // noch in der Serie
e.replace("Beispiel");
ok(e.undo() === "S2", "Beispiel mitten im Tippen: Rückgängig bringt das zuletzt Getippte", e.doc);
ok(e.undo() === "S1", "…und davor den Stand vor der Serie");
e.clock.tick();
ok(e.steps.size() === 1, "ein später feuernder Zeitgeber legt nichts doppelt ab", e.steps.size());
ok(e.undo() === "S0", "…ganz zurück bis zum Anfang");

e = editor();
e.replace("S0");
ok(e.undo() === null, "Austausch gegen denselben Stand ist kein Schritt");

e = editor();
e.redo = function () { const next = e.steps.redo(); if (next !== null) { e.doc = next; e.steps.reset(); } return next; };
e.type("S1"); e.clock.tick(); e.type("S2"); e.clock.tick();
e.undo(); e.undo();
ok(e.doc === "S0" && e.steps.canRedo(), "nach zweimal Rückgängig lässt sich wiederholen");
ok(e.redo() === "S1" && e.redo() === "S2", "Wiederholen geht Schritt für Schritt vor");
ok(e.redo() === null, "…bis zum letzten Stand");
ok(e.undo() === "S1", "danach wieder zurück");
e.type("S3");
ok(!e.steps.canRedo(), "eine neue Änderung verwirft das Wiederholen");
ok(e.undo() === "S1" && e.undo() === "S0", "…und der Verlauf dahinter bleibt heil");

e = editor();
for (let i = 1; i <= 50; i++) { e.type("S" + i); e.clock.tick(); }
ok(e.steps.size() === 40, "höchstens vierzig Schritte", e.steps.size());

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
