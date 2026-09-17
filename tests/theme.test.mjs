/*  Prüft den Theme-Vertrag und die mitgelieferten Themes.
 *
 *  Zwei Teile:
 *
 *    Ohne Browser  – Kopf, Vertragsfassung und Entschärfung jeder Datei in
 *                    themes/, und ob js/theme-data.js zum Ordner passt.
 *
 *    Mit Browser   – rendert das Beispieldokument und hält jeden Haken fest,
 *                    der in themes/CONTRACT.md dokumentiert ist. Fehlt ein
 *                    Chromium, wird dieser Teil übersprungen statt zu
 *                    scheitern; ohne ihn kann man den Vertrag aber brechen,
 *                    ohne es zu merken.
 *
 *  Aufruf aus dem Projektverzeichnis:  node tests/theme.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function sandbox(files) {
  const box = { console, JSON, Object, Number, String, Math, RegExp, Date, Array };
  box.window = box; box.globalThis = box;
  vm.createContext(box);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
  }
  return box;
}

const box = sandbox(["js/theme-data.js", "js/themes.js"]);
const Themes = box.RickCVThemes;

console.log("\n— Mitgelieferte Themes —");
const files = fs.readdirSync(path.join(root, "themes"))
  .filter((name) => name.endsWith(".css") && !name.startsWith("_"));

ok(files.length >= 3, "themes/ enthält Themes", files.join(", "));

for (const name of files) {
  const slug = name.replace(/\.css$/, "");
  const css = fs.readFileSync(path.join(root, "themes", name), "utf8");
  const meta = Themes.parseMeta(css);

  ok(!!meta.name, `${name}: hat einen Namen`, meta.name);
  ok(meta.contract === Themes.CONTRACT, `${name}: Vertragsfassung ${Themes.CONTRACT}`, meta.contract);
  ok(!!meta.licence, `${name}: nennt eine Lizenz`, meta.licence);

  //  Ein mitgeliefertes Theme darf nichts enthalten, was beim Laden
  //  entfernt würde – sonst sähe es im Baukasten anders aus als im Ordner.
  const read = Themes.read(css, slug);
  ok(read.notes.length === 0, `${name}: übersteht die Prüfung unverändert`, read.notes.join(","));

  ok(box.RickCVThemeData[slug] === css, `${name}: Bündel ist auf dem Stand`,
     box.RickCVThemeData[slug] === undefined ? "fehlt in js/theme-data.js"
       : "tools/build-themes.py erneut laufen lassen");
}

ok(Object.keys(box.RickCVThemeData).length === files.length,
   "Bündel enthält genau die Dateien aus themes/",
   Object.keys(box.RickCVThemeData).join(","));

console.log("\n— Entschärfung —");
const nasty = [
  '@import url("https://example.invalid/x.css");',
  '.ats-raw { display: none }',
  '[data-block="profile"] { background: url(https://tracker.invalid/p.png) }',
  '@media print { .keep { background: url(data:image/png;base64,AAA) } }',
  '[data-column="main"] { color: red }',
].join("\n");
const checked = Themes.read(nasty, "Probe");

ok(!/@import/.test(checked.css), "@import fliegt raus");
ok(!/ats-raw/.test(checked.css), "Regeln für die Textfassung fliegen raus");
ok(!/tracker\.invalid/.test(checked.css), "entfernte Adresse in url() fliegt raus");
ok(/data:image\/png/.test(checked.css), "data:-Adressen bleiben");
ok(/\[data-column="main"\] \{ color: red \}/.test(checked.css), "harmloses CSS bleibt unverändert");
ok(checked.notes.includes("imports") && checked.notes.includes("ats") && checked.notes.includes("remote"),
   "alle drei Eingriffe werden gemeldet", checked.notes.join(","));

const big = Themes.read("a{}".repeat(40000), "Groß");
ok(big.notes.includes("truncated"), "Übergroßes Theme wird gekappt");

console.log("\n— Werkstatt-Gerüst —");
const starter = Themes.starter("de");
ok(/@rickcv-theme/.test(starter), "Gerüst hat einen Kopf");
ok(Themes.parseMeta(starter).contract === Themes.CONTRACT, "Gerüst nennt die aktuelle Fassung");
ok(Themes.hooks("de").length >= 4 && Themes.hooks("en").length >= 4, "Hakenliste in beiden Sprachen");

console.log("\n— Der Vertrag am gerenderten Dokument —");

function findChromium() {
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      return execFileSync("command", ["-v", name], { shell: true, encoding: "utf8" }).trim();
    } catch { /* nächster Versuch */ }
  }
  return null;
}

const browser = findChromium();
if (!browser) {
  console.log("  übersprungen (kein Chromium gefunden)");
} else {
  const probe = path.join(root, ".theme-contract-probe.html");
  fs.writeFileSync(probe, `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="styles.css"></head><body><div class="document"></div>
<script src="js/i18n.js"></script><script src="js/icon-data.js"></script>
<script src="js/icons.js"></script><script src="js/theme-data.js"></script>
<script src="js/themes.js"></script><script src="js/model.js"></script>
<script src="js/ats.js"></script><script src="js/render.js"></script>
<script>
  var data = RickCVModel.createExample("de");
  data.languages.show = true; data.references.show = true; data.mobilitySB.show = true;
  data.theme = { slug: "clean", name: "", css: "", source: "builtin" };
  RickCVRender.render(document, data);
</script></body></html>`);

  let dom = "";
  try {
    dom = execFileSync(browser, [
      "--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
      "--virtual-time-budget=8000", "--dump-dom", probe,
    ], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    ok(false, "Dokument gerendert", error.message);
  } finally {
    fs.unlinkSync(probe);
  }

  if (dom) {
    const hooks = [
      'data-contract="1"', 'data-template="clean"', 'data-icon-set=',
      'data-page="1"', 'data-column="sidebar"', 'data-column="main"',
      'data-block="photo"', 'data-block="profile"', 'data-block="contact"',
      'data-block="languages"', 'data-block="interests"', 'data-block="projects"',
      'data-block="namerole"', 'data-block="section"', 'data-block="skills"',
      'data-block="mobility"', 'data-block="references"',
      'data-role="experience"', 'data-role="education"', 'data-role="volunteer"',
      'data-date-mode=', 'class="resume_item', 'class="resume_title"',
      'class="timeline"', 'class="event"',
    ];
    hooks.forEach((hook) => ok(dom.includes(hook), `Haken vorhanden: ${hook}`));

    ok(dom.includes('id="rickcv-theme"'), "Theme wird als Stil-Knoten eingesetzt");
    ok(/@layer theme \{/.test(dom), "Theme liegt in der oberen Kaskadenebene");
    ok(dom.includes("Harald Töpfer"), "Beispieldaten sind im Dokument");
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
