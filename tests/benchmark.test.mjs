/*  Prüfstand: RickCVs PDF-Import auf fremden Vorlagen.
 *
 *  Die 18 Vorlagen-PDFs von Reactive Resume und deren unabhängige
 *  Sollwerte (tests/fixtures/reactive-resume/, MIT). Gemessen wird Feld für
 *  Feld; die Untergrenzen unten sind der erreichte Stand. Wer den Import
 *  verbessert, hebt sie an – sinken dürfen sie nicht.
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/benchmark.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "tests", "fixtures", "reactive-resume");

//  Erreichter Stand am 3. November 2026 (vorher: Telefon 9, Ort 2,
//  Webseite 12, Stationen 40 von 45, Punkte 103 von 126).
const FLOOR = {
  "basics.name": 18, "basics.headline": 17, "basics.email": 18, "basics.phone": 18,
  "basics.location": 18, "basics.website": 18,
  "exp.found": 45, "exp.company": 45, "exp.position": 45, "exp.location": 45, "exp.period": 45,
  "exp.bullets": 125,
};

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function fakeCanvas() {
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => ({
    fillStyle: "", fillRect() {}, drawImage() {},
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  });
  canvas.toDataURL = () => "data:image/jpeg;base64,X";
  return canvas;
}

const box = {
  console: { log() {}, warn() {}, error() {} }, TextDecoder, TextEncoder, Blob, Response,
  DecompressionStream, URL, atob, btoa, setTimeout, clearTimeout, queueMicrotask, structuredClone,
  crypto, ReadableStream, Uint8Array, Uint8ClampedArray, Promise, Math, JSON, Date, process,
  document: { createElement: (tag) => (tag === "canvas" ? fakeCanvas() : { style: {} }), head: { appendChild() {} } },
  navigator: { userAgent: "node", platform: "linux" },
};
box.window = box; box.globalThis = box; box.self = box;
vm.createContext(box);
for (const file of ["vendor/pdfjs/pdf.worker.min.js", "vendor/pdfjs/pdf.min.js", "js/i18n.js", "js/model.js",
                    "js/import.js", "js/layout.js", "js/pdf-import.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
}
box.pdfjsLib.GlobalWorkerOptions.workerSrc = "in-sandbox";

async function read(file) {
  const bytes = fs.readFileSync(file);
  const handle = { name: path.basename(file),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  const data = await new Promise((res, rej) => box.RickCVPdf.extract(handle, (e, v) => (e ? rej(e) : res(v))));
  const parsed = box.RickCVImport.parseText(data.text, "aus-pdf.txt", data.lines, data.images);
  return box.RickCVImport.apply(box.RickCVModel.createBase("en"), parsed, "replace");
}

const fold = (text) => String(text || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").normalize("NFKC")
  .toLowerCase().replace(/[–—-]/g, "-").replace(/[^\p{L}\p{N}@+.\-/ ]/gu, " ").replace(/\s+/g, " ").trim();
const digits = (text) => String(text || "").replace(/\D/g, "");
const years = (text) => String(text || "").match(/(?:19|20)\d\d/g) || [];

function similarity(a, b) {
  a = fold(a); b = fold(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (text) => new Set(Array.from({ length: Math.max(1, text.length - 1) }, (_, i) => text.slice(i, i + 2)));
  const x = grams(a), y = grams(b);
  let common = 0;
  x.forEach((gram) => { if (y.has(gram)) common++; });
  return (2 * common) / (x.size + y.size);
}

const truth = JSON.parse(fs.readFileSync(path.join(dir, "shipped-import.json"), "utf8"));
const totals = {};
const add = (key, hit) => { totals[key] = totals[key] || [0, 0]; totals[key][1]++; if (hit) totals[key][0]++; };
const misses = [];

for (const want of truth) {
  const state = await read(path.join(dir, want.template + ".pdf"));
  const c = state.contact;
  const b = want.basics;
  const blob = fold(JSON.stringify(state));
  add("basics.name", fold(c.name) === fold(b.name));
  add("basics.headline", fold(c.role) === fold(b.headline));
  add("basics.email", fold(c.email) === fold(b.email));
  add("basics.phone", digits(c.phone) === digits(b.phone));
  add("basics.location", fold(c.city + " " + c.address).includes(fold(b.location)));
  add("basics.website", blob.includes(fold(b.website.url).replace("https://", "")) || blob.includes(fold(b.website.label)));

  const events = state.events.filter((event) => event.sectionId !== "education");
  const used = new Set();
  for (const ex of want.experience) {
    let best = -1, score = 0;
    events.forEach((event, index) => {
      if (used.has(index)) return;
      const value = similarity(event.company, ex.company) + similarity(event.title, ex.position);
      if (value > score) { best = index; score = value; }
    });
    const event = score > 0.8 ? events[best] : null;
    if (event) used.add(best);
    else misses.push(`${want.template}: ${ex.position} @ ${ex.company}`);
    const e = event || {};
    add("exp.found", !!event);
    add("exp.company", fold(e.company) === fold(ex.company));
    add("exp.position", fold(e.title) === fold(ex.position));
    add("exp.location", fold(e.place) === fold(ex.location));
    const present = /present/i.test(ex.period);
    add("exp.period", !!event && years(ex.period).join() === years(e.start).concat(years(e.end)).join() &&
      !!e.present === present);
    const bullets = (ex.description.match(/<li>(.*?)<\/li>/g) || [ex.description]).map(fold);
    const got = fold([].concat(e.description || [], e.list || []).join(" "));
    bullets.forEach((bullet) => add("exp.bullets", !!bullet && got.includes(bullet)));
  }
}

console.log("\n— Reactive-Resume-Vorlagen, Feld für Feld —");
for (const [key, floor] of Object.entries(FLOOR)) {
  const [hit, all] = totals[key] || [0, 0];
  ok(hit >= floor, `${key.padEnd(16)} ${hit}/${all} (Untergrenze ${floor})`, misses.slice(0, 5).join(" | "));
}

/* ------------------------------------------------------------------ */
//  Deutsche Lebensläufe mit festen Sollwerten (tests/fixtures/deutsch/).
//  Alles muss stimmen; einzige Ausnahme ist der Monat in Layouts, die nur
//  Jahreszahlen drucken ("-jahre").
console.log("\n— Deutsche Lebensläufe, Feld für Feld —");
{
  const german = path.join(root, "tests", "fixtures", "deutsch");
  const ym = (value) => { const m = String(value || "").match(/^(\d{2})\/(\d{4})$/); return m ? m[2] + "-" + m[1] : String(value || ""); };
  const digitsDe = (text) => { let d = digits(text); if (d.startsWith("49")) d = "0" + d.slice(2); return d; };
  const counts = {};
  const tally = (key, hit, note) => {
    counts[key] = counts[key] || [0, 0, []]; counts[key][1]++;
    if (hit) counts[key][0]++; else if (note) counts[key][2].push(note);
  };
  for (const file of fs.readdirSync(german).filter((name) => name.endsWith(".pdf")).sort()) {
    const id = file.replace(/\.pdf$/, "");
    const truth = JSON.parse(fs.readFileSync(path.join(german, id.split("-")[0] + ".truth.json"), "utf8"));
    const state = await read(path.join(german, file));
    const years = id.endsWith("-jahre");
    tally("Name", fold(state.contact.name) === fold(truth.name), `${id}: ${state.contact.name}`);
    tally("E-Mail", fold(state.contact.email) === fold(truth.email), `${id}: ${state.contact.email}`);
    tally("Telefon", digitsDe(state.contact.phone) === digitsDe(truth.phone), `${id}: ${state.contact.phone}`);
    for (const [kind, list] of [["experience", truth.experience], ["education", truth.education]]) {
      for (const want of list) {
        const event = state.events.find((e) => fold(e.title) === fold(want.title));
        tally("Station", !!event, `${id}: ${want.title}`);
        if (!event) continue;
        tally("Abschnitt", event.sectionId === kind, `${id}: ${want.title} in ${event.sectionId}`);
        tally("Einrichtung", fold(event.company) === fold(want.org), `${id}: ${event.company}`);
        tally("Ort", fold(event.place) === fold(want.place), `${id}: ${event.place}`);
        const start = years ? String(event.start).slice(-4) === want.start.slice(-4) : ym(event.start) === ym(want.start);
        tally("Beginn", start, `${id}: ${want.title} ${event.start}`);
        const end = want.present ? !!event.present
          : years ? String(event.end).slice(-4) === want.end.slice(-4) && !event.present : ym(event.end) === ym(want.end);
        tally("Ende", end, `${id}: ${want.title} ${event.end}`);
        const got = fold([].concat(event.description || [], event.list || []).join(" "));
        for (const bullet of want.bullets || []) tally("Punkte", got.includes(fold(bullet)), `${id}: ${bullet}`);
      }
    }
  }
  for (const [key, [hit, all, notes]] of Object.entries(counts)) {
    ok(hit === all, `${key.padEnd(12)} ${hit}/${all}`, notes.slice(0, 4).join(" | "));
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
