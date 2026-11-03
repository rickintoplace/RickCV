/*  ats-proof.mjs – Der Nachweis, dass Bewerbungssysteme RickCV lesen können.
 *
 *  Kein Punktwert und kein Versprechen, sondern ein Versuch, den jeder
 *  wiederholen kann: Jedes mitgelieferte Theme wird mit Chromium als PDF
 *  gedruckt – einmal deutsch auf A4, einmal englisch auf US Letter – und
 *  dann von mehreren unabhängigen Textlesern gelesen, wie sie in
 *  Bewerbungssystemen und Lebenslauf-Parsern stecken:
 *
 *    pdftotext -raw   Poppler, Reihenfolge wie im Datenstrom – das sieht ein
 *                     einfacher Parser, der kein Layout kennt
 *    pdftotext        Poppler mit Leselayout
 *    pdf.js           Mozilla; die Grundlage vieler Web-Parser
 *    pdfminer.six     Python; die Grundlage der meisten Python-Parser
 *                     (pyresparser u. a.) – nur, wenn installiert
 *
 *  Pro Leser wird geprüft, was ein Parser für die Felder braucht:
 *
 *    kontakt     Name, E-Mail, Telefon stehen am Stück im Text
 *    stationen   jede Station steht zusammen: Titel, Zeitraum und
 *                Arbeitgeber, ohne dass Text aus der Seitenspalte
 *                dazwischenfährt
 *    reihenfolge der Name steht vor der ersten Station
 *
 *  Und pro Datei: als PDF/UA-artig getaggt, Sprache gesetzt (/Lang), alle
 *  Schriften eingebettet, kein unsichtbarer Text (ats.mode ist "off").
 *
 *  Aufruf:   node tools/ats-proof.mjs            (schreibt docs/ats-proof.*)
 *            node tools/ats-proof.mjs --check    (vergleicht mit docs/ats-proof.json;
 *                                                  ein neuer Befund → Exit 1)
 *
 *  Gebraucht werden Node, ein Chromium, poppler-utils (pdftotext, pdfinfo,
 *  pdffonts) und vendor/pdfjs; pdfminer.six optional (pip install pdfminer.six).
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findChromium } from "../tests/chromium.mjs";

const run = promisify(execFile);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8761;
const check = process.argv.includes("--check");

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png",
  ".svg": "image/svg+xml", ".json": "application/json", ".jpg": "image/jpeg",
};

function serve() {
  const server = http.createServer((request, response) => {
    const file = path.join(root, decodeURIComponent(request.url.split("?")[0]));
    fs.readFile(file, (error, body) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    });
  });
  server.listen(PORT, "127.0.0.1");
  return server;
}

async function tool(name, args) {
  try {
    const { stdout } = await run(name, args, { maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
    return stdout;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/* ------------------------------------------------------------- Leser */

function pdfjsBox() {
  const box = {
    console: { log() {}, warn() {}, error() {} }, TextDecoder, TextEncoder, URL, atob, btoa,
    setTimeout, clearTimeout, queueMicrotask, structuredClone, Promise, Math, JSON, Date,
    Uint8Array, ReadableStream, navigator: { userAgent: "node" },
  };
  box.window = box; box.globalThis = box; box.self = box;
  vm.createContext(box);
  for (const file of ["vendor/pdfjs/pdf.worker.min.js", "vendor/pdfjs/pdf.min.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
  }
  box.pdfjsLib.GlobalWorkerOptions.workerSrc = "in-sandbox";
  return box;
}

//  pdf.js in der Reihenfolge der Textstücke, wie sie im Datenstrom stehen –
//  so lesen es die meisten Web-Parser, die pdf.js benutzen.
async function readPdfjs(box, bytes) {
  const doc = await box.pdfjsLib.getDocument({ data: new Uint8Array(bytes), disableFontFace: true }).promise;
  let text = "";
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    for (const item of content.items) text += item.str + (item.hasEOL ? "\n" : " ");
    text += "\n";
  }
  await doc.destroy();
  return text;
}

async function hasPdfminer() {
  try {
    await run("python3", ["-c", "import pdfminer.high_level"]);
    return true;
  } catch { return false; }
}

const READERS = [
  { id: "pdftotext-raw", label: "pdftotext -raw", read: (file) => tool("pdftotext", ["-raw", "-enc", "UTF-8", file, "-"]) },
  { id: "pdftotext", label: "pdftotext", read: (file) => tool("pdftotext", ["-enc", "UTF-8", file, "-"]) },
  { id: "pdfjs", label: "pdf.js", read: null },
  { id: "pdfminer", label: "pdfminer.six", read: (file) => tool("python3", ["-c",
    "import sys; from pdfminer.high_level import extract_text; sys.stdout.write(extract_text(sys.argv[1]))", file]) },
];

/* ------------------------------------------------------------- Prüfen */

//  Verglichen wird ohne Leerraum und ohne Groß/klein: ein Parser, der
//  "Harald Töpfer" als "Harald  Töpfer" liest, hat den Namen trotzdem.
//  ß und ss gelten gleich: Kapitälchen setzt Chromium als "SS", und ein
//  Parser liest dann "Spass AG" – das ist derselbe Arbeitgeber.
const tight = (text) => String(text || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase().replace(/ß/g, "ss");

function sidebarWords(data) {
  return [].concat(
    data.skills.show ? data.skills.items.map((item) => item.name) : [],
    data.languages.show ? data.languages.items.map((item) => item.name) : [],
    data.interests.show ? data.interests.items.map((item) => item.name) : [],
  ).filter((word) => word && word.length >= 5);
}

function checkText(text, data) {
  const flat = tight(text);
  const problems = [];
  const contact = data.contact;
  for (const [label, value] of [["Name", contact.name], ["E-Mail", contact.email], ["Telefon", contact.phone]]) {
    if (value && !flat.includes(tight(value))) problems.push(`${label} fehlt`);
  }
  const first = data.events[0];
  if (first && flat.indexOf(tight(contact.name)) > flat.indexOf(tight(first.title))) {
    problems.push("Name steht nach der ersten Station");
  }
  const sidebar = sidebarWords(data).map(tight);
  for (const event of data.events) {
    const at = flat.indexOf(tight(event.title));
    if (at === -1) { problems.push(`Station fehlt: ${event.title}`); continue; }
    //  Titel, Arbeitgeber und Zeitraum liegen nah beieinander – höchstens
    //  ein paar hundert Zeichen, die Aufzählung der Station eingeschlossen.
    const window = flat.slice(Math.max(0, at - 160), at + 260);
    if (event.company && !window.includes(tight(event.company))) {
      problems.push(`${event.title}: Arbeitgeber nicht dabei`);
    }
    //  Der Zeitraum steht direkt bei seiner Station: kurz davor (Datum
    //  links oder vor dem Titel) oder kurz danach (unter Titel und
    //  Arbeitgeber). Gesucht wird der Beginn, nicht ein Ende – "– 11/13"
    //  gehoert zur Station davor. Eine Spalte mit allen Zeitraeumen eines
    //  Abschnitts faellt so auf, auch wenn die Jahre irgendwo in der Naehe
    //  vorkommen.
    const [first, second] = String(event.start || "").split("/");
    const month = second ? first : "";
    const year = (second || first || "").slice(-2);
    if (year) {
      const near = flat.slice(Math.max(0, at - 40), at + tight(event.title).length + 140);
      const start = new RegExp(`(?:^|[^–—-])${month ? month + "/" : ""}(?:\\d\\d)?${year}(?!\\d)`);
      if (!start.test(near)) problems.push(`${event.title}: Zeitraum nicht bei der Station`);
    }
    const company = event.company ? window.indexOf(tight(event.company)) : -1;
    const local = window.slice(Math.min(160, company === -1 ? 160 : company), 160 + tight(event.title).length);
    const intruder = sidebar.find((word) => local.includes(word));
    if (intruder) problems.push(`${event.title}: Seitenspalte dazwischen („${intruder}“)`);
  }
  return problems;
}

async function checkFile(file, bytes) {
  const problems = [];
  const info = await tool("pdfinfo", [file]);
  if (info === null) problems.push("pdfinfo fehlt");
  else if (!/Tagged:\s+yes/.test(info)) problems.push("nicht getaggt");
  //  /Lang steht im Katalog, der bei Chromium unkomprimiert ist.
  if (!/\/Lang\s*\(/.test(bytes.toString("latin1"))) problems.push("keine Sprache (/Lang)");
  const fonts = await tool("pdffonts", [file]);
  if (fonts !== null) {
    const rows = fonts.split("\n").slice(2).filter(Boolean);
    if (rows.some((row) => /\sno\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/.test(row))) problems.push("Schrift nicht eingebettet");
    if (rows.some((row) => /Type 3/.test(row))) problems.push("Type-3-Schrift (Text als Grafik)");
  }
  return problems;
}

/* ------------------------------------------------------------- Ablauf */

const chrome = findChromium();
if (!chrome) {
  console.error("Kein Chromium gefunden.");
  process.exit(check ? 1 : 0);
}

const only = (process.env.ONLY || "").split(",").filter(Boolean);
const slugs = fs.readdirSync(path.join(root, "themes"))
  .filter((name) => name.endsWith(".css") && !name.startsWith("_"))
  .map((name) => name.replace(/\.css$/, "")).sort()
  .filter((slug) => !only.length || only.includes(slug));

const VARIANTS_ALL = [
  { id: "de-a4", locale: "de", pageSize: "a4" },
  { id: "en-letter", locale: "en", pageSize: "letter" },
];
const VARIANTS = VARIANTS_ALL.filter((variant) => !process.env.VARIANT || variant.id === process.env.VARIANT);

const modelBox = { console, Math, JSON, Date };
modelBox.window = modelBox;
vm.createContext(modelBox);
for (const file of ["js/i18n.js", "js/model.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), modelBox, { filename: file });
}

const pdfminer = await hasPdfminer();
const readers = READERS.filter((reader) => reader.id !== "pdfminer" || pdfminer);
const box = pdfjsBox();
const server = serve();
await new Promise((done) => setTimeout(done, 400));

const probe = path.join(root, ".ats-probe.html");
const pdfFile = path.join(root, ".ats-probe.pdf");
const results = [];
const chromeVersion = (await tool(chrome, ["--version"]) || "").trim();
const popplerVersion = ((await run("pdftotext", ["-v"]).catch((e) => e)).stderr || "").split("\n")[0].trim();

try {
  for (const slug of slugs) {
    for (const variant of VARIANTS) {
      const data = modelBox.RickCVModel.createExample(variant.locale);
      data.languages.show = true;
      data.settings.pageSize = variant.pageSize;
      data.ats.mode = "off";
      data.theme = { slug, name: "", css: "", source: "builtin", extra: "" };

      fs.writeFileSync(probe, `<!DOCTYPE html><html lang="${variant.locale}"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="styles.css"></head>
<body><div class="document"></div>
<script src="js/i18n.js"></script><script src="js/icon-data.js"></script>
<script src="js/icons.js"></script><script src="js/theme-data.js"></script>
<script src="js/themes.js"></script><script src="js/model.js"></script>
<script src="js/ats.js"></script><script src="js/render.js"></script>
<script>
  var data = ${JSON.stringify(data)};
  RickCVRender.render(document, data);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { RickCVRender.render(document, data); });
  }
</script></body></html>`);

      await run(chrome, [
        "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
        "--virtual-time-budget=12000", `--print-to-pdf=${pdfFile}`,
        `http://127.0.0.1:${PORT}/.ats-probe.html`,
      ], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 });

      const bytes = fs.readFileSync(pdfFile);
      const row = { theme: slug, variant: variant.id, file: await checkFile(pdfFile, bytes), readers: {} };
      for (const reader of readers) {
        const text = reader.id === "pdfjs" ? await readPdfjs(box, bytes) : await reader.read(pdfFile);
        row.readers[reader.id] = text === null ? ["Leser fehlt"] : checkText(text, data);
      }
      results.push(row);
      const bad = row.file.length + Object.values(row.readers).reduce((sum, list) => sum + list.length, 0);
      console.log(`${bad ? "FAIL" : "ok  "} ${slug} ${variant.id}` + (bad ? " → " + JSON.stringify(row) : ""));
    }
  }
} finally {
  server.close();
  if (!process.env.KEEP) for (const file of [probe, pdfFile]) if (fs.existsSync(file)) fs.unlinkSync(file);
}

/* ------------------------------------------------------------- Bericht */

const date = new Date().toISOString().slice(0, 10);
const failures = results.filter((row) => row.file.length || Object.values(row.readers).some((list) => list.length));
const report = {
  date, chromium: chromeVersion, poppler: popplerVersion, pdfminer,
  readers: readers.map((reader) => reader.label), results,
};
//  Mit --check wird gegen den eingecheckten Stand verglichen: Was dort
//  bestanden hat, muss weiter bestehen. Neue Befunde lassen den Lauf
//  scheitern; bekannte stehen im Bericht und bleiben sichtbar, bis sie
//  behoben sind. Die Prüfung der Datei (Tags, Sprache, Schriften) muss
//  immer bestehen.
const baselineFile = path.join(root, "docs", "ats-proof.json");
const regressions = [];
if (check) {
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : { results: [] };
  for (const row of results) {
    if (row.file.length) regressions.push(`${row.theme} ${row.variant}: Datei – ${row.file.join("; ")}`);
    const before = baseline.results.find((old) => old.theme === row.theme && old.variant === row.variant);
    for (const [reader, problems] of Object.entries(row.readers)) {
      const known = before && before.readers[reader];
      //  Ein Leser, den der eingecheckte Stand nicht kennt (pdfminer.six
      //  laeuft nur in der CI), wird berichtet, aber nicht verglichen.
      if (!known) {
        if (problems.length) console.log(`  INFO ${row.theme} ${row.variant} ${reader}: ${problems.join("; ")}`);
        continue;
      }
      const fresh = problems.filter((problem) => !known.includes(problem));
      if (fresh.length) regressions.push(`${row.theme} ${row.variant} ${reader}: ${fresh.join("; ")}`);
    }
  }
}

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
if (!check) fs.writeFileSync(baselineFile, JSON.stringify(report, null, 2) + "\n");

const mark = (list) => (list.length ? "✗ " + list.join("; ") : "✓");
const lines = [
  "# ATS-Nachweis",
  "",
  "Erzeugt von `node tools/ats-proof.mjs` – jeder kann es wiederholen. Jedes Theme wird mit Chromium",
  "gedruckt (deutsches Beispiel auf A4, englisches auf US Letter) und von unabhängigen Textlesern",
  "gelesen, wie sie in Bewerbungssystemen stecken. ✓ heißt: Name, E-Mail und Telefon stehen am Stück",
  "im Text, der Name steht vor der ersten Station, und jede Station steht zusammen – Titel, Zeitraum",
  "und Arbeitgeber, ohne dass Text aus der Seitenspalte dazwischenfährt. „Datei“ prüft Tags,",
  "Sprachangabe und eingebettete Schriften.",
  "",
  "Das ist kein Versprechen für ein bestimmtes System: kommerzielle Parser (Textkernel bei Personio",
  "und SAP SuccessFactors, Workday, Greenhouse) sind nicht frei verfügbar und nicht Teil dieses Tests.",
  "",
  `Stand ${date} · ${chromeVersion} · ${popplerVersion}` + (pdfminer ? " · pdfminer.six" : " · pdfminer.six nicht installiert"),
  "",
  "| Theme | Fassung | Datei | " + readers.map((reader) => reader.label).join(" | ") + " |",
  "| --- | --- | --- | " + readers.map(() => "---").join(" | ") + " |",
  ...results.map((row) => `| ${row.theme} | ${row.variant} | ${mark(row.file)} | ` +
    readers.map((reader) => mark(row.readers[reader.id] || [])).join(" | ") + " |"),
  "",
  failures.length ? `**${failures.length} von ${results.length} Fassungen mit Befund.**` : `**Alle ${results.length} Fassungen bestanden.**`,
  "",
];
if (!check) fs.writeFileSync(path.join(root, "docs", "ats-proof.md"), lines.join("\n"));
console.log(`\n${results.length - failures.length}/${results.length} bestanden` + (check ? "" : " – docs/ats-proof.md"));
if (check) {
  regressions.forEach((line) => console.log("  NEU  " + line));
  console.log(regressions.length ? `\n${regressions.length} neue Befunde\n` : "\nkeine neuen Befunde\n");
}
process.exit(check && regressions.length ? 1 : 0);
