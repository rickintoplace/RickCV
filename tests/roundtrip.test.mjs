/*  Der Rundlauf: was RickCV druckt, muss RickCV wieder einlesen können.
 *
 *  Für jedes Theme wird das Beispieldokument gedruckt, die PDF durch den
 *  Import geschickt und mit dem Ausgangsdokument verglichen – Name, Rolle,
 *  Kontakt, jede Station mit Zeitraum, Arbeitgeber und Ort, dazu Kenntnisse,
 *  Sprachen, Interessen, Projekte und der Profiltext.
 *
 *  Geprüft wird der Import, nicht das Theme. Die Themes setzen dasselbe
 *  Dokument sehr verschieden – Datum links, Datum rechts, Überschriften im
 *  Rand, dunkle Seitenspalte –, und genau deshalb sind sie ein brauchbares
 *  Übungsfeld: jedes Layout ist ein Fall, den der Import beherrschen muss.
 *  Bleibt eine Zeile aus, gehört die Arbeit in js/import.js. Ein Theme ist
 *  nicht dafür da, leicht lesbar zu sein; der Import ist dafür da, mit dem
 *  zurechtzukommen, was auf dem Papier steht – hier wie bei fremden Vorlagen
 *  (tests/fixtures/).
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/roundtrip.test.mjs
 *  Gebraucht werden Node, ein Chromium und vendor/pdfjs.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const PORT = 8751;

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function browser() {
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const found = process.env.PATH.split(":")
      .map((dir) => path.join(dir, name))
      .find((file) => fs.existsSync(file));
    if (found) return found;
  }
  return null;
}

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png",
  ".svg": "image/svg+xml", ".json": "application/json",
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

//  Node kennt keine Leinwand; die Attrappe meldet nur Maße zurück.
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

const chrome = browser();
const hasPdfjs = fs.existsSync(path.join(root, "vendor/pdfjs/pdf.min.js"));

console.log("\n— Gedruckt und wieder eingelesen —");

if (!chrome || !hasPdfjs) {
  console.log(chrome ? "  übersprungen (vendor/pdfjs/ fehlt)" : "  übersprungen (kein Chromium gefunden)");
} else {
  const box = sandboxWith([
    "vendor/pdfjs/pdf.worker.min.js", "vendor/pdfjs/pdf.min.js",
    "js/i18n.js", "js/model.js", "js/import.js", "js/pdf-import.js",
  ]);
  box.pdfjsLib.GlobalWorkerOptions.workerSrc = "in-sandbox";

  //  Das Dokument, das gedruckt wird – und mit dem verglichen wird.
  const want = box.RickCVModel.createExample("de");
  want.languages.show = true;

  const slugs = fs.readdirSync(path.join(root, "themes"))
    .filter((name) => name.endsWith(".css") && !name.startsWith("_"))
    .map((name) => name.replace(/\.css$/, ""))
    .sort();

  const server = serve();
  await new Promise((done) => setTimeout(done, 400));

  const probe = path.join(root, ".roundtrip-probe.html");
  const pdfFile = path.join(root, ".roundtrip.pdf");

  try {
    for (const slug of slugs) {
      fs.writeFileSync(probe, `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css"><link rel="stylesheet" href="styles.css"></head>
<body><div class="document"></div>
<script src="js/i18n.js"></script><script src="js/icon-data.js"></script>
<script src="js/icons.js"></script><script src="js/theme-data.js"></script>
<script src="js/themes.js"></script><script src="js/model.js"></script>
<script src="js/ats.js"></script><script src="js/render.js"></script>
<script>
  var data = RickCVModel.createExample("de");
  data.languages.show = true;
  data.theme = { slug: ${JSON.stringify(slug)}, name: "", css: "", source: "builtin" };
  RickCVRender.render(document, data);
  //  Noch einmal, sobald die Schriften da sind: mit einer Ersatzschrift
  //  faellt der Satz anders aus, und der Druck zeigte etwas anderes als die App.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { RickCVRender.render(document, data); });
  }
</script></body></html>`);

      await run(chrome, [
        "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
        "--virtual-time-budget=12000", `--print-to-pdf=${pdfFile}`,
        `http://127.0.0.1:${PORT}/.roundtrip-probe.html`,
      ], { maxBuffer: 64 * 1024 * 1024, timeout: 120000 });

      const bytes = fs.readFileSync(pdfFile);
      const file = {
        name: `${slug}.pdf`,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };

      const data = await new Promise((res, rej) =>
        box.RickCVPdf.extract(file, (error, value) => (error ? rej(error) : res(value))));
      const parsed = box.RickCVImport.parseText(data.text, "aus-pdf.txt", data.lines, data.images);
      const got = box.RickCVImport.apply(box.RickCVModel.createBase("de"), parsed, "replace");

      const trouble = [];
      const tight = (value) => String(value || "").toUpperCase().replace(/\s+/g, "");

      if (got.contact.name !== want.contact.name) trouble.push(`Name ${JSON.stringify(got.contact.name)}`);
      if (tight(got.contact.role) !== tight(want.contact.role)) trouble.push(`Rolle ${JSON.stringify(got.contact.role)}`);
      if (got.contact.email !== want.contact.email) trouble.push(`E-Mail ${JSON.stringify(got.contact.email)}`);
      if (tight(got.contact.phone) !== tight(want.contact.phone)) trouble.push(`Telefon ${JSON.stringify(got.contact.phone)}`);
      if (!got.contact.city.includes("Musterstadt")) trouble.push(`Ort ${JSON.stringify(got.contact.city)}`);
      if (!got.profile.text.startsWith(want.profile.text.slice(0, 26))) {
        trouble.push(`Profiltext ${JSON.stringify(got.profile.text.slice(0, 30))}`);
      }

      want.events.forEach((event) => {
        const hit = got.events.find((candidate) => candidate.title === event.title);
        if (!hit) { trouble.push(`Station fehlt: ${event.title}`); return; }
        if (hit.start !== event.start) trouble.push(`${event.title}: Beginn ${hit.start}`);
        if (event.present && !hit.present) trouble.push(`${event.title}: "heute" verloren`);
        if (!event.present && hit.end !== event.end) trouble.push(`${event.title}: Ende ${hit.end}`);
        if (event.company && !tight(hit.company).includes(tight(event.company).slice(0, 8))) {
          trouble.push(`${event.title}: Arbeitgeber ${JSON.stringify(hit.company)}`);
        }
        if (event.place && hit.place !== event.place) trouble.push(`${event.title}: Ort ${JSON.stringify(hit.place)}`);
        if ((event.list || []).length && (hit.list || []).length !== event.list.length) {
          trouble.push(`${event.title}: ${(hit.list || []).length} von ${event.list.length} Punkten`);
        }
      });

      const compare = (key, label) => {
        want[key].items.forEach((item) => {
          if (!got[key].items.some((candidate) => tight(candidate.name) === tight(item.name))) {
            trouble.push(`${label} fehlt: ${item.name}`);
          }
        });
        if (got[key].items.length > want[key].items.length) {
          trouble.push(`${label}: ${got[key].items.length} statt ${want[key].items.length}`);
        }
      };

      compare("skills", "Kenntnis");
      compare("languages", "Sprache");
      compare("interests", "Interesse");
      compare("projects", "Projekt");

      ok(trouble.length === 0, `${slug}: vollständig zurückgelesen`, trouble.slice(0, 4).join(" · "));
    }
  } finally {
    server.close();
    fs.rmSync(probe, { force: true });
    fs.rmSync(pdfFile, { force: true });
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
