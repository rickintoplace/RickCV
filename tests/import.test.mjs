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

//  Reactive Resume ist der groesste freie Mitbewerber. Wer von dort kommt,
//  soll nichts abtippen muessen – und bringt sogar etwas mit, das JSON
//  Resume nicht kennt: die Stufe einer Kenntnis als Zahl.
console.log("\n— Reactive Resume —");
const rr = Imp.parseText(fs.readFileSync(fixture("reactive-resume.json"), "utf8"), "resume.json");
ok(rr.format === "reactive", "als Reactive Resume erkannt", rr.format);
const rs = Imp.apply(base(), rr, "replace");
ok(rs.contact.name === "Tomás Berger", "Name", rs.contact.name);
ok(rs.contact.role === "Datenbankadministrator", "headline wird zur Rolle");
ok(rs.contact.city === "Leipzig", "Ort");
ok(/Hält Datenbanken am Leben/.test(rs.profile.text), "HTML im Profiltext wird zu Text", rs.profile.text);
ok(!/<p>|<strong>/.test(rs.profile.text), "keine Reste von Auszeichnungen");
ok(rs.events.length === 5, "fünf sichtbare Stationen", rs.events.length);
ok(!rs.events.some((e) => /Versteckte/.test(e.title + e.company)), "Verstecktes bleibt draußen");

const elbwerk = rs.events.find((e) => e.company === "Elbwerk GmbH");
ok(!!elbwerk && elbwerk.start === "03/2022" && elbwerk.present === true,
   "Zeitraum aus freiem Text: 'March 2022 - Present'", elbwerk && elbwerk.start + "/" + elbwerk.present);
ok(!!elbwerk && elbwerk.list.length === 2, "Listenpunkte aus dem HTML", elbwerk && elbwerk.list.length);
ok(!!elbwerk && elbwerk.description.length === 1, "Absatz bleibt Absatz");

const uni = rs.events.find((e) => e.company === "Universität Leipzig");
ok(!!uni && uni.title === "Master of Science, Informatik", "Abschluss und Fach", uni && uni.title);
ok(!!uni && uni.list.includes("1,7"), "Note als Punkt");

const roles = rs.events.map((e) => rs.sections.find((s) => s.id === e.sectionId).atsRole);
ok(roles.filter((r) => r === "volunteer").length === 1, "Ehrenamt");
ok(roles.filter((r) => r === "other").length === 1, "Auszeichnung als weitere Station");

ok(rs.skills.items[0].name === "PostgreSQL" && rs.skills.items[0].rank === 5,
   "Stufe 0–5 wird direkt übernommen", JSON.stringify(rs.skills.items[0]));
ok(rs.skills.items.length === 4, "Schlagwörter kommen als eigene Kenntnisse mit", rs.skills.items.length);
ok(rs.languages.items[1].percentage === 80, "Sprachstufe 4 von 5 wird zu 80 %", rs.languages.items[1].percentage);
ok(rs.projects.items[0].url === "https://example.org/pgstatsd", "Projektadresse aus dem Objekt");
ok(rs.footers.right.links.length === 3, "Webseite, eigenes Feld und Profil als Links",
   rs.footers.right.links.map((l) => l.text).join("|"));
ok(rs.photo.src.indexOf("data:image") === 0, "Bild übernommen");

console.log("\n— Fließtext —");
const plain = fs.readFileSync(fixture("lebenslauf.txt"), "utf8");
const txt = Imp.parseText(plain, "lebenslauf.txt");
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

//  Zweimal dieselbe Datei ergänzen ist der häufigste Fehlgriff: es soll
//  nichts doppelt danebenstehen, und ein Block, den jemand ausgeblendet
//  hat, soll ausgeblendet bleiben.
{
  const once = Imp.apply(base(), Imp.parseText(plain, "lebenslauf.txt"), "replace");
  once.interests.show = false;
  const twice = Imp.apply(once, Imp.parseText(plain, "lebenslauf.txt"), "merge");

  ok(twice.events.length === once.events.length, "dieselben Stationen kommen nicht doppelt",
     once.events.length + " → " + twice.events.length);
  ok(twice.skills.items.length === once.skills.items.length, "dieselben Kenntnisse auch nicht",
     once.skills.items.length + " → " + twice.skills.items.length);
  ok(twice.interests.show === false,
     "ein ausgeblendeter Block bleibt aus, wenn nichts Neues dazukommt");

  //  Eine geänderte Fassung soll dagegen ankommen.
  const more = Imp.apply(twice, Imp.parseText(plain + "\n\nEhrenamt\nSchatzmeister\n" +
    "Kleingartenverein Süd, Kassel | 01/2019 – 12/2020\n", "lebenslauf.txt"), "merge");
  ok(more.events.length === twice.events.length + 1, "eine neue Station kommt hinzu",
     twice.events.length + " → " + more.events.length);
}

//  Die Anleitung für Sprachmodelle zeigt ein Beispieldokument. Wenn das
//  nicht mehr stimmt, schickt jeder Agent kaputte Links – deshalb wird es
//  hier aus AGENTS.md gelesen und wirklich importiert.
console.log("\n— Das Beispiel aus AGENTS.md —");
{
  const doc = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const block = (doc.match(/```json\n([\s\S]*?)```/) || [])[1];
  ok(!!block, "AGENTS.md enthält ein JSON-Beispiel");

  if (block) {
    let parsed = null;
    try { parsed = Imp.parseText(block, "link.json"); } catch (error) {
      ok(false, "Beispiel ist importierbar", error.message);
    }

    if (parsed) {
      const as = Imp.apply(base(), parsed, "replace");
      ok(parsed.format === "rickcv", "wird als RickCV-Dokument erkannt", parsed.format);
      ok(!!as.contact.name && !!as.contact.email, "Kontaktdaten kommen an");
      ok(as.events.length >= 2, "Stationen kommen an", as.events.length);
      ok(as.events.some((e) => e.present === true), "'bis heute' funktioniert wie beschrieben");
      ok(as.skills.items.length >= 2, "Kenntnisse mit Stufe", as.skills.items.length);
      ok(as.coverLetter.paragraphs.length >= 2, "Anschreiben kommt mit");
      ok(as.settings.pageSize === "a4" || as.settings.pageSize === "letter",
         "Blattformat ist gesetzt", as.settings.pageSize);
      ok(!!as.theme.slug, "Theme ist benannt", as.theme.slug);

      //  Genau der Weg, den die Anleitung beschreibt: base64url in den Link.
      const token = Buffer.from(JSON.stringify(JSON.parse(block)), "utf8")
        .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const back = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      ok(JSON.parse(back).contact.name === as.contact.name, "base64url hin und zurück");
      ok(token.length < 8000, "Link bleibt handhabbar", token.length + " Zeichen");
    }
  }
}

console.log("\n— Was nicht gehen darf —");
for (const [input, label] of [['{"foo":1}', "fremdes JSON"], ["", "leerer Text"], ["%%%", "Unsinn"]]) {
  let threw = false;
  try { Imp.parseText(input, "x.json"); } catch { threw = true; }
  ok(threw, "wird abgelehnt: " + label);
}

//  Word-Dokumente sind der haeufigste Ausgangspunkt ueberhaupt, und sie
//  sind der bessere: im .docx steht ausgeschrieben, was im PDF erraten
//  werden muss – Ueberschrift, Tabellenzelle, Aufzaehlung, Bild.
console.log("\n— Word (.docx) —");
{
  const dbox = sandboxWith(["js/i18n.js", "js/model.js", "js/import.js", "js/layout.js",
                            "js/docx-import.js"]);
  const bytes = fs.readFileSync(fixture("beschriftungsspalten.docx"));
  const file = {
    name: "lebenslauf.docx",
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };

  try {
    const data = await new Promise((res, rej) =>
      dbox.RickCVDocx.read(file, (error, value) => (error ? rej(error) : res(value))));
    const parsed = dbox.RickCVImport.parseText(data.text, "aus-docx.txt", data.lines, data.images);
    const ws = dbox.RickCVImport.apply(dbox.RickCVModel.createBase("de"), parsed, "replace");

    ok(ws.contact.name === "Mara Kessler", "Name", ws.contact.name);
    ok(ws.contact.address === "Ahornweg 12" && ws.contact.city === "34117 Beispielstadt",
       "Anschrift", ws.contact.address + " / " + ws.contact.city);
    ok(ws.contact.phone.replace(/\s/g, "") === "015198765432", "Telefon", ws.contact.phone);
    ok(ws.events.length === 7, "sieben Stationen", ws.events.length);

    const netz = ws.events.find((e) => /Netzausbau/.test(e.title));
    ok(!!netz && netz.company === "Nordwind Energie GmbH" && netz.place === "Kassel",
       "Arbeitgeber und Ort aus derselben Tabellenzelle", netz && netz.company);
    ok(!!netz && netz.present === true, "'heute' als laufende Stelle");
    ok(!!netz && netz.list.length === 1, "Zeilenumbruch in der Zelle wird ein eigener Punkt");

    ok(ws.skills.items.length === 3, "Kenntnisse hinter der Beschriftung",
       ws.skills.items.map((i) => i.name).join("|"));
    ok(ws.languages.items.length === 3, "drei Sprachen aus einer Zelle",
       ws.languages.items.map((i) => i.name).join("|"));
    ok(ws.languages.items[1].level === "verhandlungssicher", "Stufe als Text",
       ws.languages.items[1].level);
    ok(ws.mobility.items.some((i) => /Führerschein Klasse B/.test(i.name)), "Führerschein");
    ok(/^data:image/.test(ws.photo.src), "Bild aus word/media wird zum Foto");
    ok(/^data:image/.test(ws.coverLetter.signatureImg), "flaches Bild unten wird zur Unterschrift");
    ok(data.lines.some((l) => l.text === "Berufserfahrung" && l.size > 13),
       "Word-Formatvorlage macht die Überschrift erkennbar",
       JSON.stringify(data.lines.filter((l) => l.text === "Berufserfahrung")));
  } catch (error) {
    ok(false, "Word-Dokument gelesen", error.message);
  }
}

//  Vorlagen aus dem Netz bauen ihren Lebenslauf nicht aus Absaetzen,
//  sondern aus zwei Dutzend Textrahmen, die ueber das Blatt verteilt sind –
//  und legen jeden davon zweimal ab: einmal als Zeichnung, einmal als
//  Ersatzdarstellung fuer alte Word-Versionen. Gelesen wird nach Lage, und
//  die Ersatzdarstellung bleibt liegen.
console.log("\n— Word aus Textrahmen —");
{
  const dbox = sandboxWith(["js/i18n.js", "js/model.js", "js/import.js", "js/layout.js",
                            "js/docx-import.js"]);
  const bytes = fs.readFileSync(fixture("textrahmen.docx"));
  const file = {
    name: "vorlage.docx",
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };

  try {
    const data = await new Promise((res, rej) =>
      dbox.RickCVDocx.read(file, (error, value) => (error ? rej(error) : res(value))));
    const parsed = dbox.RickCVImport.parseText(data.text, "aus-docx.txt", data.lines, data.images);
    const tb = dbox.RickCVImport.apply(dbox.RickCVModel.createBase("de"), parsed, "replace");

    const once = (data.text.match(/JONNA WIEDEMANN/g) || []).length;
    ok(once === 1, "die Ersatzdarstellung verdoppelt den Text nicht", once);

    ok(tb.contact.name === "JONNA WIEDEMANN", "Name", tb.contact.name);
    ok(tb.contact.role === "Fachinformatikerin", "Rolle", tb.contact.role);
    ok(tb.contact.city === "30159 Hannover", "Ort aus der Seitenspalte", tb.contact.city);

    //  Seitenspalte und Hauptteil stehen nebeneinander auf dem Blatt: ohne
    //  Spaltenrechnung waeren "KONTAKT" und "BERUFSERFAHRUNG" eine Zeile.
    ok(data.lines.some((l) => l.text === "KONTAKT"), "Seitenspalte steht fuer sich",
       data.lines.slice(0, 4).map((l) => l.text).join(" / "));

    ok(tb.events.length === 3, "drei Stationen", tb.events.length);
    const first = tb.events[0];
    ok(!!first && first.title === "Softwareentwicklerin", "Titel ueber der Station",
       first && first.title);
    ok(!!first && first.company === "Weserwerk Digital GmbH" && first.place === "Hannover",
       "Arbeitgeber und Ort", first && first.company + " / " + first.place);
    ok(!!first && first.start === "03/2021" && first.present === true, "Zeitraum, offen",
       first && first.start + "–" + first.present);
    ok(!!first && first.list.length === 3, "Aufzaehlung der Station",
       first && first.list.length);

    ok(tb.skills.items.length === 3, "Kenntnisse aus der Seitenspalte",
       tb.skills.items.map((i) => i.name).join("|"));
    ok(tb.languages.items.length === 3, "Sprachen aus der Seitenspalte",
       tb.languages.items.map((i) => i.name).join("|"));
    ok(tb.interests.items.length === 2, "Interessen aus der Seitenspalte",
       tb.interests.items.map((i) => i.name).join("|"));

    //  Das Zeichen aus der Symbolschrift ist ein Bild und kein Buchstabe.
    ok(data.text.indexOf("\uf0e0") === -1, "Zeichen aus Wingdings faellt weg");
    ok(/Führerschein Klasse B/.test(data.text), "der Text daneben bleibt");
  } catch (error) {
    ok(false, "Textrahmen gelesen", error.message);
  }
}

//  Ein Word-Dokument, wie man es selbst tippt: Formatvorlagen, rechter
//  Tabstopp für den Zeitraum, "seit" vor dem Datum, Anschrift Zeile für Zeile
//  als eigene Absätze, Seitenumbruch vor dem Anschreiben.
console.log("\n— Word, selbst getippt, mit Anschreiben —");
{
  const dbox = sandboxWith(["js/i18n.js", "js/model.js", "js/import.js", "js/layout.js",
                            "js/docx-import.js"]);
  const bytes = fs.readFileSync(fixture("word-nativ.docx"));
  const file = {
    name: "word.docx",
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
  try {
    const data = await new Promise((res, rej) =>
      dbox.RickCVDocx.read(file, (error, value) => (error ? rej(error) : res(value))));
    const parsed = dbox.RickCVImport.parseText(data.text, "aus-docx.txt", data.lines, data.images);
    const wn = dbox.RickCVImport.apply(dbox.RickCVModel.createBase("de"), parsed, "replace");
    ok(wn.contact.name === "Katharina Wolff" && wn.contact.role === "Industriekauffrau", "Name und Rolle");
    ok(wn.events.length === 5, "fünf Stationen", wn.events.length);
    const lead = wn.events[0];
    ok(lead.title === "Teamleiterin Einkauf" && lead.start === "05/2022" && lead.present,
       "„seit 05/2022“ am Tabstopp", JSON.stringify([lead.title, lead.start, lead.present]));
    ok(lead.company === "Frankenguss AG" && lead.place === "Nürnberg", "Arbeitgeber darunter");
    ok(data.lines.find((l) => l.text === "Birkenweg 17").page === 2, "der Seitenumbruch steht vor dem Brief");
    ok(wn.coverLetter.recipient === "Kühlwerk Süd GmbH\nFrau Sabine Albrecht\nIndustriestraße 40\n91052 Erlangen",
       "Empfänger aus Absätzen mit Leerabsätzen dazwischen", JSON.stringify(wn.coverLetter.recipient));
    ok(wn.coverLetter.subject === "Bewerbung als Leiterin Einkauf" && wn.coverLetter.paragraphs.length === 3 &&
       wn.coverLetter.closing === "Freundliche Grüße", "Betreff, drei Absätze, Gruß",
       JSON.stringify([wn.coverLetter.subject, wn.coverLetter.paragraphs.length, wn.coverLetter.closing]));
  } catch (error) {
    ok(false, "selbst getipptes Word-Dokument gelesen", error.message);
  }
}

console.log("\n— Eingefügt: Markdown, nur ein Anschreiben, Antwort einer KI —");
{
  const md = [
    "# Miriam Hofstetter", "**Pflegefachfrau (B.Sc.)**",
    "Kastanienallee 9, 79098 Freiburg · 0761 334455 · miriam.hofstetter@example.de", "",
    "## Berufserfahrung",
    "**Fachkrankenpflegerin Intensivpflege** | Universitätsklinikum Freiburg | 04/2020 – heute",
    "- Versorgung beatmeter Patientinnen und Patienten", "",
    "**Gesundheits- und Krankenpflegerin** | St. Josefskrankenhaus, Freiburg | 10/2017 – 03/2020", "",
    "## Kenntnisse", "- Beatmungsmanagement", "- Liebe zum Detail", "",
    "## Sprachen", "- Deutsch: Muttersprache", "- Englisch: B2", "", "---", "",
    "Sehr geehrte Frau Dr. Lang,", "", "mit großer Freude habe ich Ihre Ausschreibung gelesen.", "",
    "Ich freue mich auf ein Gespräch.", "", "Mit freundlichen Grüßen", "Miriam Hofstetter",
  ].join("\n");
  const mdParsed = Imp.parseText(md, "eingefuegt.txt");
  const ms = Imp.apply(base(), mdParsed, "replace");
  ok(ms.contact.name === "Miriam Hofstetter" && ms.contact.city === "79098 Freiburg", "Kopf aus Markdown",
     ms.contact.name + " / " + ms.contact.city);
  ok(ms.events.length === 2 && ms.events[0].title === "Fachkrankenpflegerin Intensivpflege" &&
     ms.events[0].company === "Universitätsklinikum Freiburg", "Zeile mit senkrechten Strichen",
     ms.events.map((e) => e.title + "@" + e.company).join(" | "));
  ok(ms.events[1].company === "St. Josefskrankenhaus" && ms.events[1].place === "Freiburg",
     "Ort hinter dem Komma", ms.events[1].company + " / " + ms.events[1].place);
  ok(ms.skills.items.some((i) => i.name === "Liebe zum Detail"), "„Liebe zum Detail“ ist keine Anrede");
  ok(ms.languages.items.length === 2, "Sprachen mit Doppelpunkt", ms.languages.items.length);
  ok(ms.coverLetter.paragraphs.length === 2 && ms.coverLetter.salutation === "Sehr geehrte Frau Dr. Lang,",
     "Anschreiben hinter dem Lebenslauf, Absätze an Leerzeilen", JSON.stringify(ms.coverLetter.paragraphs));

  const only = Imp.parseText([
    "Tom Berger", "Hauptstraße 5", "01067 Dresden", "tom.berger@example.org", "",
    "Elbe Logistik GmbH", "Herr Klaus Richter", "Hafenweg 12", "01139 Dresden", "",
    "Dresden, 3. Februar 2026", "", "Bewerbung als Disponent", "",
    "Sehr geehrter Herr Richter,", "hiermit bewerbe ich mich als Disponent.",
    "Ich habe Touren für 40 Fahrzeuge geplant.", "Mit freundlichen Grüßen", "Tom Berger",
  ].join("\n"), "eingefuegt.txt");
  const os = Imp.apply(base(), only, "replace");
  ok(!only.warnings.includes("thin") && only.summary.letter === 1, "ein Anschreiben allein ist ein Import");
  ok(os.contact.name === "Tom Berger" && os.contact.city === "01067 Dresden", "Absender wird Kontakt",
     os.contact.name + " / " + os.contact.city);
  ok(os.coverLetter.recipient === "Elbe Logistik GmbH\nHerr Klaus Richter\nHafenweg 12\n01139 Dresden" &&
     os.coverLetter.subject === "Bewerbung als Disponent" && os.coverLetter.paragraphs.length === 2,
     "Empfänger, Betreff, eine Zeile je Absatz", JSON.stringify(os.coverLetter));

  const merged = Imp.apply(Model.createExample("de"), only, "merge");
  ok(merged.coverLetter.subject === Model.createExample("de").coverLetter.subject,
     "beim Ergänzen bleibt ein vorhandenes Anschreiben stehen");

  const answer = "Gern! Hier ist dein Dokument:\n\n```json\n" + JSON.stringify({
    version: 5, locale: "de", contact: { name: "Nora Feldmann" },
    events: [{ sectionId: "experience", title: "Hebamme", start: "04/2019", present: true }],
  }, null, 2).replace(/\n}$/, ",\n}") + "\n```\n\nViel Erfolg!";
  const fromChat = Imp.parseText(answer, "eingefuegt.txt");
  ok(fromChat.format === "rickcv" && fromChat.state.contact.name === "Nora Feldmann",
     "JSON aus einer Chat-Antwort, trotz Codeblock und Komma zu viel", fromChat.format);
  const braces = Imp.parseText("Max Muster\nmax@example.org\nKenntnisse\nC {Grundlagen}, Java", "x.txt");
  ok(braces.format === "text", "ein Lebenslauf mit Klammern bleibt Text", braces.format);
}

console.log("\n— PDF —");
const pdfLib = path.join(root, "vendor/pdfjs/pdf.min.js");
if (!fs.existsSync(pdfLib)) {
  console.log("  übersprungen (vendor/pdfjs/ fehlt)");
} else {
  const pbox = sandboxWith([
    "vendor/pdfjs/pdf.worker.min.js", "vendor/pdfjs/pdf.min.js",
    "js/i18n.js", "js/model.js", "js/import.js", "js/layout.js", "js/pdf-import.js",
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
    ok(ms.mobility.items.length === 1, "der Briefkopf der zweiten Seite bleibt draußen",
       ms.mobility.items.map((i) => i.name).join("|"));
    ok(!/Beate Beispiel|Beispielstraße/.test(JSON.stringify(ms.skills.items) +
       JSON.stringify(ms.interests.items)), "kein Anschreiben in den Listen");
    ok(!data.text.split("\n").some((line) => /^(school|work|volunteer_activism|star|favorite)$/.test(line)),
       "Symbolnamen stehen nicht als Wörter im Text");
  } catch (error) {
    ok(false, "PDF mit Symbolschrift gelesen", error.message);
  }

  //  Fremde Vorlagen. Die drei Dateien sind nach dem Vorbild verbreiteter
  //  Muster gesetzt – amerikanische Schule, LaTeX-Vorlage, deutscher
  //  tabellarischer Lebenslauf – und decken je eine Eigenheit ab, an der
  //  der Import einmal gescheitert ist.
  console.log("\n— PDF: fremde Vorlagen —");
  try {
    const { state: us } = await readPdf("us-spalten.pdf");
    ok(us.contact.name === "MARA LINDQVIST", "Name ohne die zweite Spalte", us.contact.name);
    ok(us.events.length === 4, "zwei Stellen und zwei Abschlüsse", us.events.length);

    const analyst = us.events.find((e) => /Operations/.test(e.title));
    ok(!!analyst && analyst.title === "Operations Analyst",
       "der Titel bleibt ganz, obwohl ein Wort davor wie ein Monat aussieht",
       analyst && analyst.title);
    ok(!!analyst && analyst.start === "2021" && analyst.end === "2024",
       "Zeitraum aus der rechten Spalte", analyst && analyst.start + "–" + analyst.end);
    ok(!!analyst && analyst.company === "HARBORLINE FREIGHT" && analyst.place === "Seattle, WA",
       "Arbeitgeber steht eine Zeile höher", analyst && analyst.company + " / " + analyst.place);

    const msc = us.events.find((e) => /Master of Science/.test(e.title));
    ok(!!msc && msc.title === "Master of Science (MSc), Logistics",
       "Studienfach bleibt am Abschluss", msc && msc.title);
    ok(!us.events.some((e) => /555|3\.70/.test(e.title + e.start + e.end)),
       "Telefonnummer und Note werden kein Datum");
    ok(us.skills.items.length === 4, "Kenntnisse in einer Zeile", us.skills.items.length);
  } catch (error) {
    ok(false, "amerikanische Vorlage gelesen", error.message);
  }

  try {
    const { state: st } = await readPdf("strichlos.pdf");
    ok(st.events.length === 3, "drei Stationen", st.events.length);
    ok(st.events[0].start === "03/2022" && st.events[0].end === "09/2025",
       "Zeitraum ohne Gedankenstrich dazwischen",
       st.events[0].start + "–" + st.events[0].end);
    ok(st.events[0].company === "Nordwind Systems GmbH" && st.events[0].place === "Hamburg",
       "Kopfzeile aus Arbeitgeber und Ort", st.events[0].company);
    ok(st.events[0].title === "Site Reliability Engineer", "Tätigkeit darunter", st.events[0].title);
  } catch (error) {
    ok(false, "LaTeX-Vorlage gelesen", error.message);
  }

  try {
    const { state: tb } = await readPdf("tabelle.pdf");
    ok(tb.contact.name === "Annika Rosenberg", "Name", tb.contact.name);
    ok(tb.contact.email === "annika.rosenberg@example.de" &&
       tb.contact.address === "Lindenstraße 14" && tb.contact.city === "50667 Köln",
       "Kontakt aus der Beschriftungstabelle",
       tb.contact.email + " / " + tb.contact.address + " / " + tb.contact.city);
    ok(tb.events.length === 5, "drei Stellen und zwei Abschlüsse", tb.events.length);

    const leitung = tb.events.find((e) => /Teamleiterin/.test(e.title));
    ok(!!leitung && leitung.start === "04/2021" && leitung.present === true,
       "'seit 04/2021' ist ein offener Anfang",
       leitung && leitung.start + "/" + leitung.present);
    ok(!!leitung && leitung.company === "Rheinpharm GmbH" && leitung.place === "Köln",
       "Arbeitgeber und Ort unter der Tätigkeit", leitung && leitung.company);
    //  Chromium setzt die Punkte einer Liste ohne Marke in die Textebene:
    //  ohne Zeichen davor ist das ein Absatz, und mehr ist daraus nicht zu
    //  holen. Hauptsache, der Text geht nicht verloren.
    ok(!!leitung && /Prüflabors/.test(leitung.description.concat(leitung.list).join(" ")) &&
       /Chargenfreigabe/.test(leitung.description.concat(leitung.list).join(" ")),
       "beide Zeilen unter der Station bleiben erhalten",
       leitung && JSON.stringify(leitung.description.concat(leitung.list)));

    const werk = tb.events.find((e) => /Werkstudentin/.test(e.title));
    ok(!!werk && werk.start === "08/2016" && werk.end === "07/2017",
       "ausgeschriebene Monatsnamen", werk && werk.start + "–" + werk.end);

    ok(tb.languages.items.length === 3, "drei Sprachen", tb.languages.items.length);
    ok(tb.skills.items.length === 4, "Kenntnisse hinter der Beschriftung", tb.skills.items.length);
    ok(tb.interests.items.length === 3,
       "die Aufzählung hinter 'Ehrenamt' bleibt eine Liste",
       tb.interests.items.map((i) => i.name).join("|"));
  } catch (error) {
    ok(false, "tabellarischen Lebenslauf gelesen", error.message);
  }

  //  Firefox zeichnet fett Gesetztes über cairo als Vektorkontur. Dann
  //  fehlen Überschriften, Name und Titel vollständig – übrig bleiben
  //  Zeiträume, Arbeitgeber und Beschreibungen. Hier als Zeilen gestellt,
  //  wie sie aus so einer Datei fallen.
  console.log("\n— PDF ohne Textebene für fett Gesetztes —");
  {
    const lines = [
      { text: "Bezwinger des Dunklen Lords", size: 10.5, page: 1, y: 700 },
      { text: "verlinkte@email.com", size: 10.5, page: 1, y: 660 },
      { text: "11/13", size: 10.5, page: 1, y: 600 },
      { text: "ZOOLINO, Bad Wimpeln\t– 09/15", size: 10.5, page: 1, y: 588 },
      { text: "Tierpflege im Kontaktbereich", size: 10, page: 1, y: 576 },
      { text: "• Schildkröten streicheln", size: 10, page: 1, y: 564 },
      { text: "07/21", size: 10.5, page: 1, y: 500 },
      { text: "SPASS AG, Frankfurt\t– 10/21", size: 10.5, page: 1, y: 488 },
      { text: "Bildungsfahrt mit ein bisschen Freizeit", size: 10, page: 1, y: 476 },
    ];
    const text = lines.map((l) => l.text).join("\n");
    const parsed = Imp.parseText(text, "aus-pdf.txt", lines);
    const fs2 = Imp.apply(base(), parsed, "replace");
    ok(parsed.warnings.includes("noStructure"), "meldet die fehlende Struktur",
       parsed.warnings.join(","));
    ok(fs2.events.length === 2, "Stationen trotz fehlender Überschriften", fs2.events.length);
    ok(fs2.events[0].start === "11/2013" && fs2.events[0].end === "09/2015",
       "Zeitraum aus zwei Zeilen", fs2.events[0].start + "–" + fs2.events[0].end);
    ok(fs2.events[0].company === "ZOOLINO" && fs2.events[0].place === "Bad Wimpeln",
       "Arbeitgeber und Ort", fs2.events[0].company);
    ok(fs2.events[0].list.length === 1, "Aufzählung bleibt erhalten");
    ok(fs2.contact.name === "", "kein geratener Name aus dem Profiltext",
       JSON.stringify(fs2.contact.name));
    ok(fs2.contact.email === "verlinkte@email.com", "Kontaktdaten kommen trotzdem durch");
  }

  //  Das Anschreiben: vorn in der Bewerbungsmappe oder hinten, wie RickCV
  //  druckt. Frueher endete das Lesen an der Anrede – bei einer Mappe, die
  //  mit dem Anschreiben beginnt, fehlte danach der ganze Lebenslauf.
  console.log("\n— PDF: Bewerbungsmappe mit Anschreiben vorn —");
  for (const name of ["mappe.pdf", "mappe-libreoffice.pdf"]) {
    try {
      const { parsed, state: mp } = await readPdf(name);
      const role = (event) => mp.sections.find((s) => s.id === event.sectionId).atsRole;
      ok(mp.contact.name === "Jonas Weber", `${name}: Name aus den persönlichen Daten`, mp.contact.name);
      ok(mp.contact.address === "Gartenweg 3" && mp.contact.city === "04109 Leipzig",
         `${name}: eigene Anschrift, nicht die des Empfängers`, mp.contact.address + " / " + mp.contact.city);
      ok(mp.events.length === 6, `${name}: alle sechs Stationen hinter dem Anschreiben`, mp.events.length);
      const job = mp.events.find((e) => /Betriebstechnik/.test(e.title) && role(e) === "experience");
      ok(!!job && job.company === "Leipziger Wasserwerke GmbH" && job.place === "Leipzig" &&
         job.start === "01/2021" && job.present, `${name}: Monat mit Punkt, Titel und Arbeitgeber`,
         job && JSON.stringify([job.title, job.company, job.place, job.start]));
      ok(!!job && job.list.length === 2, `${name}: eingerückte Punkte ohne Zeichen werden Aufzählung`,
         job && JSON.stringify(job.list));
      const sps = mp.events.find((e) => /SPS/.test(e.title));
      ok(!!sps && sps.company === "TÜV Rheinland Akademie", `${name}: Einrichtung hinter dem Komma`,
         sps && sps.company);
      ok(mp.mobility.items.length === 1 && mp.mobility.items[0].name === "Führerschein Klasse B, C1",
         `${name}: Führerschein mit zwei Klassen bleibt eine Angabe`,
         mp.mobility.items.map((i) => i.name).join("|"));
      ok(mp.interests.items.length === 3, `${name}: Interessen nach dem Seitenwechsel`,
         mp.interests.items.map((i) => i.name).join("|"));

      const letter = mp.coverLetter;
      ok(parsed.summary.letter === 1 && parsed.warnings.includes("letter"),
         `${name}: Anschreiben in Zusammenfassung und Hinweis`);
      ok(letter.recipient === "Stadtwerke Muldental GmbH\nFrau Katrin Hoffmann\nPersonalabteilung\nAm Wasserturm 8\n04808 Wurzen",
         `${name}: Empfänger`, JSON.stringify(letter.recipient));
      ok(/^Bewerbung als Elektroniker für Betriebstechnik – Ihre Stellenanzeige/.test(letter.subject),
         `${name}: zweizeiliger Betreff`, letter.subject);
      ok(letter.salutation === "Sehr geehrte Frau Hoffmann," && letter.closing === "Mit freundlichen Grüßen",
         `${name}: Anrede und Gruß`);
      ok(letter.paragraphs.length === 4 && /^mit großem Interesse/.test(letter.paragraphs[0]) &&
         /Wasserversorgung am Laufen/.test(letter.paragraphs[0]),
         `${name}: vier Absätze, Zeilen wieder zusammengesetzt`,
         JSON.stringify(letter.paragraphs.map((p) => p.slice(0, 30))));
      ok(mp.settings.showCoverLetter === true, `${name}: Anschreiben eingeschaltet`);
      ok(!/Stadtwerke|Hoffmann/.test(JSON.stringify(mp.events)), `${name}: der Brief bleibt aus dem Lebenslauf`);
    } catch (error) {
      ok(false, `${name} gelesen`, error.message);
    }
  }

  console.log("\n— PDF: amerikanisch einspaltig, Anschreiben hinten —");
  try {
    const { state: us } = await readPdf("us-einspaltig.pdf");
    ok(us.contact.phone === "(206) 555-0142" && us.contact.city === "Seattle, WA",
       "Telefon und Ort aus der Kontaktzeile mit Mittelpunkten", us.contact.phone + " / " + us.contact.city);
    ok(us.footers.right.links.length === 2, "LinkedIn und GitHub aus der Kontaktzeile",
       us.footers.right.links.map((l) => l.url).join(" "));
    ok(us.events.length === 4, "drei Stellen und ein Abschluss", us.events.length);
    const swe = us.events.find((e) => e.title === "Software Engineer II");
    ok(!!swe && swe.company === "Northwind Labs" && swe.place === "Remote" && swe.present,
       "Titel mit Zeitraum, darunter Arbeitgeber mit Ort", swe && swe.company + " / " + swe.place);
    ok(!!swe && swe.list.length === 2, "Punkte ohne Zeichen am Einzug erkannt", swe && swe.list.length);
    ok(us.skills.items.length === 12 && us.skills.items[0].name === "Go",
       "Gruppen wie „Languages:“ bleiben Kenntnisse", us.skills.items.map((i) => i.name).join("|"));
    ok(us.languages.items.length === 0, "„Languages: Go, Rust“ wird kein Sprachenblock");
    ok(us.projects.items[0] && us.projects.items[0].name === "Tidepool",
       "Projektname ohne Technik und Zeitraum", us.projects.items[0] && us.projects.items[0].name);
    ok(us.coverLetter.recipient === "Hiring Team\nCascade Robotics\n400 Pine Street\nSeattle, WA 98101" &&
       us.coverLetter.salutation === "Dear Hiring Manager," && us.coverLetter.closing === "Sincerely," &&
       us.coverLetter.paragraphs.length === 3, "englisches Anschreiben",
       JSON.stringify([us.coverLetter.recipient, us.coverLetter.paragraphs.length]));
  } catch (error) {
    ok(false, "amerikanische einspaltige Vorlage gelesen", error.message);
  }

  console.log("\n— PDF: Europass und Seitenspalte rechts —");
  try {
    const { state: eu } = await readPdf("europass.pdf");
    const role = (event) => eu.sections.find((s) => s.id === event.sectionId).atsRole;
    ok(eu.contact.city === "1040 Brussels (Belgium)", "Ort mit Land in Klammern", eu.contact.city);
    ok(eu.events.filter((e) => role(e) === "education").length === 2,
       "„EDUCATION AND TRAINING“ fett in Grundschrift ist eine Überschrift");
    ok(eu.events[0].description.length === 1, "umbrochener Satz bleibt ein Absatz",
       JSON.stringify(eu.events[0].description));
    ok(eu.languages.items.map((i) => i.name + ":" + i.level).join("|") ===
       "Portuguese:native|English:C1|French:B2|German:A2", "Muttersprache aus der Beschriftung",
       eu.languages.items.map((i) => i.name + ":" + i.level).join("|"));
    ok(eu.skills.items.length === 4, "„Digital skills“", eu.skills.items.length);

    const { state: rs } = await readPdf("rechtsspalte.pdf");
    ok(rs.contact.name === "LENA BRANDT" && rs.contact.role === "UX Designerin",
       "Name auf zwei Zeilen", rs.contact.name);
    ok(rs.contact.city === "Hamburg" && rs.contact.phone === "0170 5566778",
       "Ort und Telefon aus der Kopfzeile", rs.contact.city + " / " + rs.contact.phone);
    ok(rs.events.length === 4 && rs.events[0].title === "Senior UX Designerin" &&
       rs.events[0].company === "Pflegewerk Digital GmbH", "Titel, Arbeitgeber, dann Zeitraum",
       rs.events.map((e) => e.title + "@" + e.company).join(" | "));
    ok(rs.events[3].title === "B.A. Kommunikationsdesign" && rs.events[3].company === "HAW Hamburg",
       "Abschluss und Hochschule", rs.events[3].title + "@" + rs.events[3].company);
    ok(rs.skills.items.length === 7, "„Tools“ gehört zu den Kenntnissen",
       rs.skills.items.map((i) => i.name).join("|"));
  } catch (error) {
    ok(false, "Europass und Seitenspalte rechts gelesen", error.message);
  }

  //  Ein frisches Dokument bringt einen Führerschein mit, damit der
  //  Abschnitt nicht leer wirkt. In einem Import wäre das eine Angabe, die
  //  niemand gemacht hat.
  console.log("\n— Keine Vorgaben aus dem leeren Dokument —");
  {
    const imported = Imp.apply(base(), jr, "replace");
    ok(imported.mobility.items.length === 0, "kein voreingetragener Führerschein",
       imported.mobility.items.map((i) => i.name).join("|"));
    ok(imported.mobility.show === false, "leerer Abschnitt bleibt aus");
    ok(imported.skills.items.length > 0 && imported.skills.show === true,
       "gefüllte Abschnitte bleiben an");
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

  //  Die Datei aus der Vorfuehrung im README: ein fremder
  //  Lebenslauf in der Form, die am haeufigsten vorkommt – Seitenspalte mit
  //  Kenntnissen in zwei Spalten, Titel und Zeitraum nebeneinander, fett
  //  gesetzte Projektnamen. Was das GIF im README zeigt, steht hier als
  //  Zusicherung.
  console.log("\n— PDF: die Datei aus der Vorführung —");
  try {
    const { state: ds, parsed } = await readPdf("demo-cv.pdf");
    ok(ds.contact.name === "Nora Feldkamp", "Name", ds.contact.name);
    //  Gesperrt gesetzt: zwischen den Buchstaben Abstand, zwischen den
    //  Woertern ein Leerzeichen. Beim Zusammenziehen bleibt die Wortgrenze.
    ok(/^backend engineer$/i.test(ds.contact.role), "gesperrte Rolle behält ihre Wortgrenze",
       ds.contact.role);
    ok(ds.events.length === 6, "alle sechs Stationen", ds.events.length);
    ok(ds.events.some((e) => e.title === "Software Developer"),
       "ein Stationstitel, der wie eine Überschrift klingt, bleibt eine Station",
       ds.events.map((e) => e.title).join(" | "));
    ok(ds.skills.items.length === 6, "sechs Kenntnisse statt Name und Punkte getrennt",
       ds.skills.items.length);
    ok(ds.skills.items[0].name === "Go" && ds.skills.items[0].rank === 5,
       "die Punkte werden zur Stufe",
       ds.skills.items.map((s) => s.name + ":" + s.rank).join(" "));
    ok(ds.languages.items.length === 3, "drei Sprachen mit Stufe", ds.languages.items.length);
    ok(ds.languages.items[0].level === "native", "Stufe neben der Sprache",
       ds.languages.items[0].level);
    ok(ds.projects.items.length === 3, "drei Projekte", ds.projects.items.length);
    ok(ds.projects.items.every((p) => /^data:image/.test(p.img)),
       "jedes Projekt mit seiner Marke");
    ok(!parsed.warnings.includes("skillRanks"),
       "keine Warnung über fehlende Stufen, weil sie gelesen wurden");

    //  "Ersetzen" verspricht im Dialog, dass Gestaltung und Vorlage bleiben.
    const styled = pbox.RickCVModel.createBase("de");
    styled.theme = { slug: "rightrail", name: "Right Rail", css: "", source: "builtin" };
    styled.style.accentColor = "#a8432f";
    const after = pbox.RickCVImport.apply(styled, parsed, "replace");
    ok(after.theme.slug === "rightrail", "das gewählte Theme übersteht den Import",
       after.theme.slug);
    ok(after.style.accentColor === "#a8432f", "die gewählte Farbe auch",
       after.style.accentColor);
  } catch (error) {
    ok(false, "Vorführ-PDF gelesen", error.message);
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
