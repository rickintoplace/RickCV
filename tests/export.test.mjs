/*  Prüft den Export als Markdown und Word (js/export-docs.js).
 *
 *  Für Word gilt derselbe Maßstab wie für das PDF: was RickCV schreibt,
 *  muss RickCV wieder lesen. Die erzeugte .docx geht deshalb durch den
 *  eigenen Word-Import (js/docx-import.js) und wird mit dem Ausgangsdokument
 *  verglichen.
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/export.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function sandbox(files) {
  const box = {
    console: { log() {}, warn() {}, error() {} }, TextDecoder, TextEncoder, Blob, Response,
    DecompressionStream, CompressionStream, URL, atob, btoa, crypto, setTimeout, clearTimeout, queueMicrotask, structuredClone,
    Promise, Math, JSON, Date, Uint8Array, Uint32Array, DataView, ArrayBuffer, ReadableStream,
  };
  box.window = box; box.globalThis = box; box.self = box;
  vm.createContext(box);
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
  return box;
}

const box = sandbox(["js/i18n.js", "js/model.js", "js/import.js", "js/layout.js", "js/docx-import.js",
                     "js/export-docs.js"]);
const Docs = box.RickCVExportDocs;

function example(locale) {
  const state = box.RickCVModel.createExample(locale);
  state.languages.show = true;
  state.settings.showCoverLetter = true;
  state.coverLetter.recipient = "Klinikum Süd\nFrau Dr. Beispiel\nSüdstraße 3\n12345 Berlin";
  state.coverLetter.subject = "Bewerbung als Zugbegleiter";
  state.coverLetter.salutation = "Sehr geehrte Frau Dr. Beispiel,";
  state.coverLetter.paragraphs = ["Mit <spitzen> Klammern & \"Zeichen\".", "Zweiter Absatz."];
  state.coverLetter.closing = "Mit freundlichen Grüßen";
  return state;
}

console.log("\n— Markdown —");
{
  const state = example("de");
  state.skills.items.push({ name: "C++ und *Sternchen*", rank: 0 });
  const text = Docs.markdown(state);
  ok(text.startsWith("# Harald Töpfer\n"), "Name als Hauptüberschrift");
  ok(text.includes("## Berufserfahrung"), "Abschnitt als Überschrift");
  ok(/### Ferienspaß · 07\/2021 – 10\/2021/.test(text), "Station mit Zeitraum");
  ok(text.includes("- Wir sind mit dem Zug hingefahren"), "Aufzählung als Liste");
  ok(text.includes("C\\+\\+") === false && text.includes("C++ und \\*Sternchen\\*"),
     "Auszeichnungszeichen maskiert", text.match(/C\+\+.*$/m)?.[0]);
  ok(text.includes("Bewerbung als Zugbegleiter"), "Anschreiben dabei");
  ok(text.indexOf("## Ausbildung") < text.indexOf("Abitur"), "Reihenfolge wie im Dokument");
  const order = ["Angefangene Ausbildung", "Abitur"].map((title) => text.indexOf(title));
  ok(order[0] < order[1], "neueste Station zuerst");
}

console.log("\n— Word (.docx): Aufbau —");
const state = example("de");
const bytes = await Docs.docx(state);
const files = await box.RickCVImport.readZip(bytes.buffer);
const names = Object.keys(files);
for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml",
                    "word/numbering.xml", "docProps/core.xml"]) {
  ok(names.includes(part), `enthält ${part}`, names.join(", "));
}
const decode = (value) => typeof value === "string" ? value : new TextDecoder().decode(value);
const documentXml = decode(files["word/document.xml"]);
ok(documentXml.includes("&lt;spitzen&gt;") && documentXml.includes("&amp;"), "Sonderzeichen maskiert");
ok(/<w:pStyle w:val="Heading1"\/>/.test(documentXml), "Überschriften als Formatvorlage");
ok(documentXml.includes('w:type="page"'), "Anschreiben auf eigener Seite");
ok(decode(files["word/styles.xml"]).includes('w:lang w:val="de-DE"'), "Sprache des Dokuments gesetzt");
ok(decode(files["docProps/core.xml"]).includes("Bewerbung – Harald Töpfer"), "Titel in den Eigenschaften");
const english = await Docs.docx(Object.assign(example("en"), { settings: Object.assign(example("en").settings, { pageSize: "letter" }) }));
const englishFiles = await box.RickCVImport.readZip(english.buffer);
ok(decode(englishFiles["word/styles.xml"]).includes('w:val="en-US"'), "US Letter auf Englisch: en-US");
ok(decode(englishFiles["word/document.xml"]).includes('w:w="12240"'), "US-Letter-Format");

console.log("\n— Word (.docx): Rückweg durch den eigenen Import —");
{
  const file = { name: "export.docx", arrayBuffer: async () => bytes.buffer.slice(0) };
  const data = await new Promise((res, rej) =>
    box.RickCVDocx.read(file, (error, value) => (error ? rej(error) : res(value))));
  const parsed = box.RickCVImport.parseText(data.text, "aus-docx.txt", data.lines, data.images);
  const back = box.RickCVImport.apply(box.RickCVModel.createBase("de"), parsed, "replace");

  ok(back.contact.name === "Harald Töpfer", "Name", back.contact.name);
  ok(back.contact.email === "verlinkte@email.com", "E-Mail", back.contact.email);
  ok(back.contact.phone.replace(/\s/g, "") === "+49123456789", "Telefon", back.contact.phone);
  for (const event of state.events) {
    const hit = back.events.find((candidate) => candidate.title === event.title);
    ok(!!hit, `Station: ${event.title}`, back.events.map((e) => e.title).join(" | "));
    if (!hit) continue;
    ok(hit.company === event.company, `  Arbeitgeber: ${event.company}`, hit.company);
    ok(hit.start === event.start, `  Beginn: ${event.start}`, hit.start);
  }
  ok(back.skills.items.some((item) => item.name === "Modelleisenbahn"), "Kenntnisse",
     back.skills.items.map((item) => item.name).join(", "));
  ok(back.coverLetter.paragraphs.some((text) => text.includes("Zweiter Absatz")), "Anschreiben",
     JSON.stringify(back.coverLetter.paragraphs));
}

console.log("\n— Word (.docx): das Dokument reist mit —");
{
  //  Wie js/builder.js es mitgibt: der ganze Stand als Datenteil. Zurueck
  //  kommt genau dieses Dokument.
  const original = example("de");
  original.theme = { slug: "banner", name: "", css: "", source: "builtin" };
  original.settings.showCoverLetter = true;
  const json = JSON.stringify(original);
  const packed = new Uint8Array(await new Response(new Blob([json]).stream()
    .pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  const link = "https://cv.rickinto.place/#z=" + Buffer.from(packed).toString("base64url");
  const same = (back) => JSON.stringify(box.RickCVModel.migrate(JSON.parse(json))) === JSON.stringify(back);

  const withData = await Docs.docx(original, { json });
  const readBack = (bytes, name) => new Promise((res, rej) => box.RickCVImport.readFile(
    { name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
    (error, value) => (error ? rej(error) : res(value))));
  const parsed = await readBack(withData, "bewerbung.docx");
  ok(parsed.format === "docx" && parsed.warnings.includes("embedded"), "eingebettetes Dokument erkannt", parsed.format + " " + parsed.warnings);
  ok(parsed.state && same(parsed.state), "Datenteil: verlustfrei, Theme und Anschreiben eingeschlossen");

  const files = await box.RickCVImport.readZip(withData.buffer);
  //  Nichts, was ein Bewerbungssystem auslesen koennte: kein Link, kein
  //  zusaetzlicher Text – der Datenteil liegt neben dem Dokument.
  ok(!/<w:hyperlink/.test(decode(files["word/document.xml"])) && !decode(files["word/document.xml"]).includes(link.slice(30, 60)),
     "kein Link und kein Datentext im Dokument selbst");
  ok(decode(files["[Content_Types].xml"]).includes("customXmlProperties"), "Datenteil ordentlich angemeldet");

  //  In Word bearbeitet: der Text ist neuer als der Datenteil. Dann zaehlt
  //  der Text, das Aussehen kommt aus dem Datenteil.
  const zipped = await box.RickCVImport.readZip(withData.buffer);
  const edited = Object.assign({}, zipped);
  edited["word/document.xml"] = new TextEncoder().encode(decode(zipped["word/document.xml"])
    .replace("Harald Töpfer", "Harald Töpfer-Krause").replace("Zugbegleiter", "Lokführer"));
  const editedBytes = Docs._zip(Object.keys(edited).map((name) => ({ name, data: edited[name] })));
  const afterWord = await readBack(editedBytes, "bearbeitet.docx");
  ok(afterWord.warnings.includes("embeddedEdited") && afterWord.state.contact.name === "Harald Töpfer-Krause" &&
     afterWord.state.theme.slug === "banner", "in Word geändert: Inhalt aus dem Text, Aussehen aus RickCV",
     afterWord.warnings + " " + (afterWord.state && afterWord.state.contact.name));

  //  Eine fremde Word-Datei bleibt beim Lesen aus dem Text.
  const plain = await readBack(await Docs.docx(original), "fremd.docx");
  ok(!plain.warnings.includes("embedded") && !plain.state, "ohne Datenteil: wie bisher aus dem Text");
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
