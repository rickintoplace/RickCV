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

//  Node kennt keine Leinwand. Die Attrappe zeichnet nichts, meldet aber
//  ihre Maße zurück – damit lassen sich Zuordnung und Verkleinerung der
//  Bilder prüfen, ohne einen Browser zu starten.
function fakeCanvas() {
  const canvas = { width: 0, height: 0 };
  canvas.getContext = () => ({
    fillStyle: "", fillRect() {}, drawImage() {},
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  });
  canvas.toDataURL = () => `data:image/jpeg;base64,W${canvas.width}H${canvas.height}`;
  return canvas;
}

function sandboxWith(files) {
  const box = {
    console, TextDecoder, TextEncoder, Blob, Response, DecompressionStream, URL,
    atob, btoa, setTimeout, clearTimeout, queueMicrotask, structuredClone, crypto,
    ReadableStream, Uint8Array, Uint8ClampedArray, Promise, Math, JSON, Date, process,
    document: {
      createElement: (tag) => (tag === "canvas" ? fakeCanvas() : { style: {} }),
      head: { appendChild() {} },
    },
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
  const readPdf = async (name) => {
    const bytes = fs.readFileSync(fixture(name));
    const file = {
      name,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
    const data = await new Promise((res, rej) =>
      pbox.RickCVPdf.extract(file, (error, value) => (error ? rej(error) : res(value))));
    const parsed = pbox.RickCVImport.parseText(data.text, "aus-pdf.txt", data.lines, data.images);
    return {
      data,
      parsed,
      state: pbox.RickCVImport.apply(pbox.RickCVModel.createBase("de"), parsed, "replace"),
    };
  };

  try {
    const { data, state: ps } = await readPdf("zweispaltig.pdf");
    ok(data.lines.length > 0 && data.lines[0].size > 0, "Zeilen tragen einen Schriftgrad");
    ok(ps.contact.name === "Erika Musterfrau", "über zwei Zeilen umbrochener Name", ps.contact.name);
    ok(ps.contact.email === "erika.musterfrau@example.de", "E-Mail aus der Seitenspalte");
    ok(ps.contact.phone.replace(/\s/g, "") === "+49891234567", "Telefon statt Hausnummer", ps.contact.phone);
    ok(ps.contact.city === "80331 München", "Ort aus der Anschrift", ps.contact.city);
    ok(ps.events.length === 3, "Stationen aus der Hauptspalte", ps.events.length);
    ok(/wenig beweglichen Teilen\.$/.test(ps.profile.text), "Zeilenumbrüche im Profiltext geglättet");
    ok(ps.skills.items.length === 4, "Kenntnisse aus der Seitenspalte", ps.skills.items.length);
  } catch (error) {
    ok(false, "zweispaltiges PDF gelesen", error.message);
  }

  //  RickCVs eigene Ausgabe ist der härteste Fall: gesperrt gesetzte
  //  Überschriften ("B E R U F S E R F A H R U N G"), der Name erst nach
  //  der Seitenspalte, Datum am Zeilenende mit zweistelligem Jahr,
  //  Kenntnisse nebeneinander – und hinten dran ein Anschreiben.
  console.log("\n— PDF: eigene Ausgabe —");
  try {
    const { state: rs } = await readPdf("rickcv-ausgabe.pdf");
    ok(rs.contact.name === "Harald Töpfer", "Name über den größten Schriftgrad", rs.contact.name);
    ok(rs.contact.role === "ZUGBEGLEITER", "Rolle darunter", rs.contact.role);
    ok(rs.contact.email === "verlinkte@email.com", "E-Mail");
    ok(rs.contact.address === "Musterstraße 4" && rs.contact.city === "12345 Musterstadt",
       "Anschrift aus zwei Zeilen", rs.contact.address + " / " + rs.contact.city);
    ok(rs.events.length === 8, "alle acht Stationen", rs.events.length);

    const tier = rs.events.find((e) => /Tierpfleger/.test(e.title));
    ok(!!tier && tier.start === "11/2013" && tier.end === "09/2015",
       "zweistelliges Jahr am Zeilenende", tier && tier.start + "–" + tier.end);
    ok(!!tier && tier.company === "ZOOLINO" && tier.place === "Bad Wimpeln",
       "Firma und Ort aus der Folgezeile");
    ok(!!tier && tier.list.length === 2, "Aufzählung unter der Station", tier && tier.list.length);

    const heute = rs.events.find((e) => e.present);
    ok(!!heute && heute.company === "BUNDESAGENTUR FÜR ARBEIT", "'heute' als offenes Ende");

    const roles = rs.events.map((e) => rs.sections.find((s) => s.id === e.sectionId).atsRole);
    ok(roles.filter((r) => r === "education").length === 2, "zwei Ausbildungen");
    ok(roles.filter((r) => r === "volunteer").length === 3, "drei Ehrenämter");

    ok(rs.skills.items.length === 4, "nebeneinander gesetzte Kenntnisse getrennt",
       rs.skills.items.map((i) => i.name).join("|"));
    ok(rs.interests.items.length === 4, "Interessen", rs.interests.items.length);
    ok(rs.projects.items.length === 2, "Projekte statt einer Zeile je Wort",
       rs.projects.items.map((i) => i.name).join("|"));
    ok(/Bezwinger des Dunklen Lords/.test(rs.profile.text), "Profiltext aus der Seitenspalte");
    ok(!/Sehr geehrte/.test(JSON.stringify(rs.events)), "das Anschreiben bleibt draußen");
  } catch (error) {
    ok(false, "eigene Ausgabe gelesen", error.message);
  }

  //  Vorlagen mit Beschriftungsspalten: links die Bezeichnung oder das
  //  Datum, rechts der Inhalt. Sehr verbreitet in deutschen Vorlagen und
  //  die Form, an der die erste Fassung scheiterte.
  console.log("\n— PDF: Beschriftungsspalten —");
  try {
    const { state: ks } = await readPdf("beschriftungsspalten.pdf");
    ok(ks.contact.name === "Mara Kessler", "Name", ks.contact.name);
    ok(ks.contact.address === "Ahornweg 12" && ks.contact.city === "34117 Beispielstadt",
       "Anschrift aus einer Zeile mit Trennstrich", ks.contact.address + " / " + ks.contact.city);
    ok(ks.contact.phone.replace(/\s/g, "") === "015198765432", "Telefon neben der E-Mail", ks.contact.phone);
    ok(ks.events.length === 7, "sieben Stationen", ks.events.length);

    const role = (event) => ks.sections.find((s) => s.id === event.sectionId).atsRole;
    const netz = ks.events.find((e) => /Netzausbau/.test(e.title));
    ok(!!netz && role(netz) === "experience", "Berufserfahrung erkannt");
    ok(!!netz && netz.company === "Nordwind Energie GmbH" && netz.place === "Kassel",
       "Arbeitgeber steht vor der Tätigkeit und wird trotzdem als Arbeitgeber gelesen",
       netz && netz.company);
    ok(!!netz && netz.present === true, "'heute' als laufende Stelle");
    ok(!!netz && netz.list.length === 1, "'Schwerpunkt: …' wird ein Aufzählungspunkt");

    ok(ks.events.filter((e) => role(e) === "education").length === 2, "zwei Ausbildungen");
    ok(ks.events.filter((e) => role(e) === "other").length === 2,
       "Weiterbildungen mit Jahr links", ks.events.filter((e) => role(e) === "other").length);
    const weiter = ks.events.find((e) => /IPMA/.test(e.title));
    ok(!!weiter && weiter.start === "2023", "Jahr am Zeilenanfang", weiter && weiter.start);

    const ehren = ks.events.find((e) => /Turnverein/.test(e.title));
    ok(!!ehren && role(ehren) === "volunteer", "Beschriftung 'Ehrenamt' setzt den Abschnitt");

    ok(ks.skills.items.length === 3, "Kenntnisse hinter der Beschriftung 'EDV'",
       ks.skills.items.map((i) => i.name).join("|"));
    ok(ks.languages.items.length === 3, "drei Sprachen", ks.languages.items.length);
    ok(ks.languages.items[0].name === "Deutsch" && ks.languages.items[0].level === "Muttersprache",
       "Sprache und Stufe getrennt", ks.languages.items[0].name + "/" + ks.languages.items[0].level);
    ok(ks.mobility.items.some((i) => /Führerschein Klasse B/.test(i.name)),
       "Führerschein landet in der Mobilität", ks.mobility.items.map((i) => i.name).join("|"));
    ok(/^data:image/.test(ks.photo.src), "Foto oben rechts");
    ok(/^data:image/.test(ks.coverLetter.signatureImg), "Unterschrift unten auf Seite eins");
    ok(!ks.events.some((e) => /16\.09\.2026/.test(e.title + e.company)),
       "Ort und Datum am Schluss werden keine Station");
  } catch (error) {
    ok(false, "Vorlage mit Beschriftungsspalten gelesen", error.message);
  }

  //  Symbolschriften: RickCV kann seine Symbole als Schrift setzen, und
  //  deren Zeichen liegen im privaten Unicode-Bereich. Unentfernt kleben
  //  sie an den Überschriften und zerlegen die Zuordnung.
  console.log("\n— PDF: Symbolschrift und Projektbilder —");
  try {
    const { data, state: ms } = await readPdf("rickcv-material.pdf");
    ok(!/[\uE000-\uF8FF]/.test(data.text), "keine Symbolzeichen im Text");
    ok(data.lines.some((l) => l.text === "AUSBILDUNG"),
       "Überschrift bleibt lesbar, obwohl ein Symbol davor stand");
    ok(ms.events.length === 8, "alle acht Stationen trotz Symbolschrift", ms.events.length);
    ok(ms.skills.items.length === 4, "Kenntnisse", ms.skills.items.length);
    ok(ms.languages.items.length === 3, "Sprachen", ms.languages.items.length);
    ok(ms.languages.items[1].level === "B2", "Stufe ohne Trennzeichen erkannt",
       ms.languages.items[1].name + "/" + ms.languages.items[1].level);
    ok(ms.projects.items.length === 2 && ms.projects.items.every((p) => /^data:image/.test(p.img)),
       "beide Projekte behalten ihr Bild",
       ms.projects.items.map((p) => p.name + (p.img ? "+Bild" : "-")).join(" "));
    ok(/^data:image/.test(ms.photo.src), "Bewerbungsfoto");
    ok(!ms.mobility.items.some((i) => /github|linkedin/i.test(i.name)),
       "Fußzeilen-Links landen nicht in der Mobilität",
       ms.mobility.items.map((i) => i.name).join("|"));
  } catch (error) {
    ok(false, "PDF mit Symbolschrift gelesen", error.message);
  }

  //  Bilder: Foto, zwei Projektlogos und eine Unterschrift auf Seite zwei.
  //  Geprüft wird die Zuordnung nach Lage und Form – die Pixel selbst
  //  entstehen im Browser.
  console.log("\n— PDF: Bilder und Logos —");
  try {
    const { data, parsed, state: bs } = await readPdf("mit-bildern.pdf");
    ok(data.images.length === 4, "vier Bilder gefunden", data.images.length);
    ok(/^data:image\/jpeg/.test(bs.photo.src), "Hochformat oben wird zum Bewerbungsfoto",
       bs.photo.src.slice(0, 30));
    ok(bs.photo.show === true, "Foto ist eingeschaltet");
    ok(bs.photo.src.indexOf("W240H320") !== -1, "Foto behält sein Seitenverhältnis",
       bs.photo.src.slice(23));
    ok(/^data:image\/jpeg/.test(bs.coverLetter.signatureImg),
       "flaches Bild im Anschreiben wird zur Unterschrift");
    ok(bs.projects.items.length === 2, "zwei Projekte", bs.projects.items.length);
    ok(bs.projects.items.every((p) => /^data:image/.test(p.img)),
       "jedes Projekt bekommt das Logo daneben",
       bs.projects.items.map((p) => p.name + ":" + (p.img ? "Bild" : "—")).join(" "));
    ok(bs.projects.items[0].name === "Fahrplanquelle" &&
       bs.projects.items[0].description === "Offene Daten für Nahverkehr",
       "Projektname und Beschreibung getrennt", bs.projects.items[0].name);
    ok(parsed.summary.images === 4, "alle vier in der Zusammenfassung", parsed.summary.images);
    ok(parsed.warnings.includes("images"), "weist auf übernommene Bilder hin");
  } catch (error) {
    ok(false, "PDF mit Bildern gelesen", error.message);
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
