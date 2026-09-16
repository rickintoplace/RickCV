/*  Prüft den Import: Datumsformate, JSON Resume in beide Richtungen,
 *  LinkedIn-ZIP, Fließtext und – falls vendor/pdfjs/ vorhanden ist – die
 *  Textextraktion aus einem zweispaltigen PDF.
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/import.test.mjs
 *  Gebraucht wird nur Node (ab 20); der Browsercode läuft in einer
 *  vm-Sandbox, die ein window vortäuscht.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const fixture = (name) => path.join(here, "fixtures", name);

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function sandboxWith(files) {
  const box = {
    console, TextDecoder, TextEncoder, Blob, Response, DecompressionStream, URL,
    atob, btoa, setTimeout, clearTimeout, queueMicrotask, structuredClone, crypto,
    ReadableStream, Uint8Array, Promise, Math, JSON, Date, process,
    document: { createElement: () => ({ style: {} }), head: { appendChild() {} } },
    navigator: { userAgent: "node", platform: "linux" },
  };
  box.window = box; box.globalThis = box; box.self = box;
  vm.createContext(box);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
  }
  return box;
}

const box = sandboxWith(["js/i18n.js", "js/model.js", "js/import.js"]);
const { RickCVImport: Imp, RickCVModel: Model } = box;
const base = () => Model.createBase("de");

console.log("\n— Datumsformate —");
ok(Imp.normDate("2019-07-01") === "07/2019", "ISO mit Tag");
ok(Imp.normDate("2019-07") === "07/2019", "ISO Monat");
ok(Imp.normDate("Jan 1967") === "01/1967", "englischer Monatsname");
ok(Imp.normDate("Dez 2018") === "12/2018", "deutscher Monatsname");
ok(Imp.normDate("1930") === "1930", "nur Jahr");
ok(Imp.normDate("3/2019") === "03/2019", "Schrägstrich");

console.log("\n— JSON Resume herein —");
const jr = Imp.parseText(fs.readFileSync(fixture("resume.json"), "utf8"), "resume.json");
ok(jr.format === "jsonresume", "als JSON Resume erkannt", jr.format);
ok(jr.summary.events === 4, "vier Stationen", jr.summary.events);
const st = Imp.apply(base(), jr, "replace");
ok(st.contact.name === "Ada Lovelace", "Name", st.contact.name);
ok(st.contact.city === "10115 Berlin", "PLZ und Ort zusammengesetzt", st.contact.city);
const work = st.events.find((e) => e.title === "Chefprogrammiererin");
ok(!!work && work.present === true, "offenes Enddatum wird zu 'heute'");
ok(!!work && work.list.length === 2, "Highlights werden zur Aufzählung", work && work.list.length);
ok(st.events.every((e) => st.sections.some((s) => s.id === e.sectionId)),
   "jede Station hat eine vorhandene Kategorie");
ok(st.sections.some((s) => s.atsRole === "other"), "Kategorie für Zertifikate angelegt");
ok(st.skills.items[0].rank === 5, "Stufe 'Expert' wird zu fünf Punkten", st.skills.items[0].rank);
ok(st.languages.items[1].percentage === 70, "B2 wird zu 70 %", st.languages.items[1].percentage);
ok(st.footers.right.links.some((l) => l.icon.name === "github"), "GitHub-Symbol erkannt");

console.log("\n— JSON Resume hinaus —");
const out = Imp.toJsonResume(st);
ok(out.work[0].startDate === "2019-07", "Datum wieder in ISO-Form", out.work[0].startDate);
ok(out.work[0].endDate === undefined, "laufende Stelle ohne Enddatum");
ok(out.awards.length === 1, "Zertifikat als award", out.awards.length);
ok(out.basics.location.postalCode === "10115", "PLZ wieder herausgelöst");
const round = Imp.apply(base(), Imp.parseText(JSON.stringify(out), "resume.json"), "replace");
ok(round.events.length === st.events.length, "Rundlauf verliert keine Station",
   `${round.events.length} statt ${st.events.length}`);

console.log("\n— Fließtext —");
const txt = Imp.parseText(fs.readFileSync(fixture("lebenslauf.txt"), "utf8"), "lebenslauf.txt");
const ts = Imp.apply(base(), txt, "replace");
ok(ts.contact.name === "Max Mustermann", "Name aus dem Kopf", ts.contact.name);
ok(ts.contact.email === "max.mustermann@example.com", "E-Mail");
ok(ts.contact.phone.replace(/\s/g, "") === "+491712345678", "Telefonnummer", ts.contact.phone);
ok(ts.events.length === 3, "drei Stationen", ts.events.length);
ok(ts.events[0].company === "Beispiel GmbH" && ts.events[0].place === "München",
   "Firma und Ort getrennt");
ok(ts.events[0].list.length === 2, "Aufzählungszeichen werden zur Liste");
ok(ts.skills.items.length === 4 && ts.languages.items.length === 2, "Kenntnisse und Sprachen");
ok(txt.warnings.includes("draft"), "Entwurf ist als solcher gekennzeichnet");

console.log("\n— LinkedIn-Export —");
const zip = fs.readFileSync(fixture("linkedin-export.zip"));
const zipFile = {
  name: "linkedin-export.zip",
  arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
};
await new Promise((done) => Imp.readFile(zipFile, (error, parsed) => {
  ok(!error, "ZIP entpackt", error && error.message);
  if (error) return done();
  const ls = Imp.apply(base(), parsed, "replace");
  ok(ls.contact.name === "Grace Hopper", "Name aus Profile.csv", ls.contact.name);
  ok(ls.contact.email === "grace@example.org", "E-Mail aus eigener Datei");
  ok(ls.events.length === 3, "zwei Positionen und eine Ausbildung", ls.events.length);
  const navy = ls.events.find((e) => e.company === "US Navy");
  ok(navy.start === "01/1967" && navy.end === "08/1986", "Zeitraum umgerechnet");
  ok(navy.list.length === 2, "mehrzeilige Beschreibung wird zur Liste");
  ok(parsed.warnings.includes("skillRanks"), "warnt vor unbewerteten Kenntnissen");
  done();
}));

console.log("\n— Ergänzen statt ersetzen —");
const merged = Imp.apply(Imp.apply(base(), txt, "replace"), jr, "merge");
ok(merged.contact.name === "Max Mustermann", "vorhandener Name bleibt stehen");
ok(merged.events.length === 3 + jr.summary.events, "Stationen wurden angehängt", merged.events.length);

console.log("\n— Was nicht gehen darf —");
for (const [input, label] of [['{"foo":1}', "fremdes JSON"], ["", "leerer Text"], ["%%%", "Unsinn"]]) {
  let threw = false;
  try { Imp.parseText(input, "x.json"); } catch { threw = true; }
  ok(threw, "wird abgelehnt: " + label);
}

console.log("\n— PDF —");
const pdfLib = path.join(root, "vendor/pdfjs/pdf.min.js");
if (!fs.existsSync(pdfLib)) {
  console.log("  übersprungen (vendor/pdfjs/ fehlt)");
} else {
  const pbox = sandboxWith([
    "vendor/pdfjs/pdf.worker.min.js", "vendor/pdfjs/pdf.min.js",
    "js/i18n.js", "js/model.js", "js/import.js", "js/pdf-import.js",
  ]);
  //  Im Browser setzt pdf-import.js die Quelle selbst; hier liegt der
  //  Arbeitsprozess schon in der Sandbox.
  pbox.pdfjsLib.GlobalWorkerOptions.workerSrc = "in-sandbox";
  const pdf = fs.readFileSync(fixture("zweispaltig.pdf"));
  const pdfFile = {
    name: "zweispaltig.pdf",
    arrayBuffer: async () => pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength),
  };
  try {
    const text = await new Promise((res, rej) =>
      pbox.RickCVPdf.extract(pdfFile, (error, value) => (error ? rej(error) : res(value))));
    const parsed = pbox.RickCVImport.parseText(text, "aus-pdf.txt");
    const ps = pbox.RickCVImport.apply(pbox.RickCVModel.createBase("de"), parsed, "replace");
    ok(ps.contact.name === "Erika Musterfrau", "über zwei Zeilen umbrochener Name", ps.contact.name);
    ok(ps.contact.email === "erika.musterfrau@example.de", "E-Mail aus der Seitenspalte");
    ok(ps.contact.phone.replace(/\s/g, "") === "+49891234567", "Telefon statt Hausnummer", ps.contact.phone);
    ok(ps.contact.city === "80331 München", "Ort aus der Anschrift", ps.contact.city);
    ok(ps.events.length === 3, "Stationen aus der Hauptspalte", ps.events.length);
    ok(/wenig beweglichen Teilen\.$/.test(ps.profile.text), "Zeilenumbrüche im Profiltext geglättet");
    ok(ps.skills.items.length === 4, "Kenntnisse aus der Seitenspalte", ps.skills.items.length);
  } catch (error) {
    ok(false, "PDF gelesen", error.message);
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
