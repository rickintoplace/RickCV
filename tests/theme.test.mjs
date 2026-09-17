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
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

//  Asynchron aufrufen, wo der Server nebenher antworten muss.
const run = promisify(execFile);

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

//  Über file:// lädt Chromium die Webfonts nicht – Schriftdateien
//  unterliegen dort der Ursprungsprüfung. Ohne die echten Schriften fällt
//  der Satz anders aus und jede Höhenmessung wäre wertlos. Also ein Server,
//  und zwar derselbe wie in tools/make-theme-previews.py: ein eigener in
//  Node hing sich mit Chromiums virtueller Zeit auf, weil deren Uhr auf
//  offene Verbindungen wartet.
const PORT = 8762;

function serve() {
  return spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: root, stdio: "ignore",
  });
}

//  Den Browser im PATH suchen, ohne eine Shell zu bemühen: das spart eine
//  Warnung und eine Angriffsfläche.
function findChromium() {
  const names = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);

  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch { /* nächster Kandidat */ }
    }
  }
  return null;
}

const browser = findChromium();
if (!browser) {
  console.log("  übersprungen (kein Chromium gefunden)");
} else {
  const server = serve();
  await new Promise((done) => setTimeout(done, 800));
  const origin = `http://127.0.0.1:${PORT}`;
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
      "--window-size=900,1300", "--virtual-time-budget=8000",
      "--dump-dom", origin + "/.theme-contract-probe.html",
    ], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    ok(false, "Dokument gerendert", error.message);
  } finally {
    fs.unlinkSync(probe);
  }

  //  Wieviel Papier braucht ein Theme für dasselbe Beispiel? Seit
  //  "automatisch mehrseitig" die Vorgabe ist, wird nichts abgeschnitten –
  //  die ehrliche Frage ist deshalb nicht "läuft es über", sondern
  //  "wieviele Bögen". Ein Theme mit einem Layoutfehler braucht sofort vier.
  async function sheetsFor(slug) {
    const probe = path.join(root, ".theme-overflow-probe.html");
    //  Mit den echten Schriften messen: mit einer Ersatzschrift fällt der
    //  Satz anders aus, und die Zahl wäre wertlos.
    fs.writeFileSync(probe, `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<link rel="stylesheet" href="fonts/fonts.css">
<link rel="stylesheet" href="styles.css"></head><body><div class="document"></div>
<script src="js/i18n.js"></script><script src="js/icon-data.js"></script>
<script src="js/icons.js"></script><script src="js/theme-data.js"></script>
<script src="js/themes.js"></script><script src="js/model.js"></script>
<script src="js/ats.js"></script><script src="js/render.js"></script>
<script>
  var data = RickCVModel.createExample("de");
  data.settings.showCoverLetter = false;
  data.settings.pageMode = "flow";
  data.theme = { slug: ${JSON.stringify(slug)}, name: "", css: "", source: "builtin" };
  RickCVRender.render(document, data);
  setTimeout(function () {
    var sheet = document.querySelector(".resume_wrapper");
    document.title = "sheets:" + (sheet.getAttribute("data-sheets") || "0");
  }, 600);
</script></body></html>`);

    try {
      const { stdout } = await run(browser, [
        "--headless", "--disable-gpu", "--no-sandbox",
        "--window-size=900,1300", "--virtual-time-budget=9000",
        "--dump-dom", origin + "/.theme-overflow-probe.html",
      ], { encoding: "utf8", timeout: 90000, maxBuffer: 32 * 1024 * 1024 });
      const match = stdout.match(/<title>sheets:(\d+)<\/title>/);
      return match ? Number(match[1]) : null;
    } catch {
      return null;
    } finally {
      fs.unlinkSync(probe);
    }
  }

  console.log("\n— Papierbedarf für das Beispiel —");
  for (const name of files) {
    const slug = name.replace(/\.css$/, "");
    const sheets = await sheetsFor(slug);
    //  Zwei Bögen sind für das reichlich gefüllte Beispiel in Ordnung; drei
    //  wären ein Hinweis auf verschwendeten Platz oder einen Layoutfehler.
    ok(sheets !== null && sheets <= 2, `${slug}: höchstens zwei Bögen`,
       sheets === null ? "nicht messbar" : sheets + " Bögen");
    if (sheets !== null) console.log(`       ${slug}: ${sheets}`);
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

  server.kill();
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
