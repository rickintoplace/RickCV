/*  Abläufe im Baukasten, die echte Zeit brauchen.
 *
 *  tests/app.test.mjs lässt Chromium in virtueller Zeit laufen – schnell,
 *  aber IndexedDB antwortet darin nicht verlässlich. Was am Speicher hängt,
 *  läuft deshalb hier, gesteuert über das DevTools-Protokoll:
 *
 *    - "Neu" legt ein zweites Dokument an, das erste bleibt erhalten
 *    - vor dem Beispiel wird der Stand als Version gesichert, und er
 *      lässt sich zurückholen
 *    - die Stellenanzeige wird im Reiter "Stelle" ausgewertet
 *    - "Als Datei speichern" schreibt eine Datei ohne Skript, die wieder
 *      dasselbe Dokument ergibt
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/flows.test.mjs
 *  Gebraucht werden Node (ab 22, für WebSocket) und ein Chromium.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findChromium, browserRequired } from "./chromium.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json",
};

async function open(browser) {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(request.url.split("?")[0]);
    const file = path.join(root, url === "/" ? "index.html" : url);
    fs.readFile(file, (error, body) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rickcv-flows-"));
  const chrome = spawn(browser, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1400,900",
    "--lang=de-DE", "about:blank"], { stdio: "ignore" });

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((entry) => entry.type === "page");
    } catch { /* noch nicht bereit */ }
    if (!target) await sleep(150);
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener("open", done, { once: true }));
  let id = 0;
  const pending = new Map();
  const events = [];
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      data.error ? reject(new Error(data.error.message)) : resolve(data.result);
    } else if (data.method) {
      events.push(data);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 300));
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  const load = async () => {
    events.length = 0;
    await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/index.html` });
    for (let i = 0; i < 100 && !events.some((e) => e.method === "Page.loadEventFired"); i++) await sleep(100);
    await sleep(1500);
  };
  const close = async () => {
    try { await send("Browser.close"); } catch { /* schon zu */ }
    //  Erst warten, bis Chrome wirklich weg ist: sonst schreibt es noch ins
    //  Profil, waehrend es geloescht wird (ENOTEMPTY in der CI). Das
    //  Aufraeumen darf den Testlauf nicht kippen.
    if (chrome.exitCode === null) {
      const gone = new Promise((done) => chrome.once("exit", done));
      chrome.kill();
      await Promise.race([gone, sleep(5000)]);
    }
    server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (error) {
      console.log(`  (Profil ${profile} nicht entfernt: ${error.code})`);
    }
  };
  const errors = () => events.filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => JSON.stringify(e.params.exceptionDetails).slice(0, 200));
  return { evaluate, load, close, errors };
}

const browser = findChromium();
console.log("\n— Dokumente, Versionen, Stelle, Datei —");

if (!browser) {
  if (browserRequired()) ok(false, "Chromium gefunden", "CHROME=/pfad/zum/browser setzen");
  else console.log("  übersprungen (kein Chromium gefunden – CHROME=… setzen)");
} else {
  const b = await open(browser);
  try {
    await b.load();
    const E = b.evaluate;
    //  Ohne gespeicherten Stand richtet sich die Sprache nach dem Browser;
    //  die Prüfungen unten sprechen die deutsche Oberfläche an.
    await E(`(function () { var s = document.getElementById("lang-switch");
      if (s.value !== "de") { s.value = "de"; s.dispatchEvent(new Event("change")); } })()`);
    await sleep(600);
    const helpers = `
      var name = function () { return document.querySelector('[data-section="person"] input'); };
      var type = function (value) { name().value = value; name().dispatchEvent(new Event("input", { bubbles: true })); };
      var menu = function (label) {
        document.getElementById("btn-more").click();
        var item = Array.prototype.find.call(document.querySelectorAll(".menu-pop .menu-item"),
          function (x) { return x.querySelector("strong").textContent === label; });
        if (item) item.click();
        return !!item;
      };
      var wait = function (ms) { return new Promise(function (done) { setTimeout(done, ms); }); };`;

    ok(await E("RickCVLibrary.ready()"), "Dokumentspeicher (IndexedDB) bereit");

    const created = await E(`(async function () { ${helpers}
      var welcome = document.querySelector(".welcome .btn-primary"); if (welcome) welcome.click();
      type("Nora Feldmann"); await wait(800); RickCVLibrary.flush(); await wait(300);
      var found = menu("Neu"); await wait(900);
      var docs = (await RickCVStore.listDocs()).filter(function (x) { return !x.deletedAt; });
      return { found: found, after: name().value, docs: docs.length,
               kept: docs.some(function (x) { return x.data.indexOf("Nora Feldmann") !== -1; }) };
    })()`);
    ok(created.found && created.after === "" && created.docs === 2 && created.kept,
       "„Neu“ legt ein zweites Dokument an, das erste bleibt", JSON.stringify(created));

    const backed = await E(`(async function () { ${helpers}
      type("Zweite Fassung"); await wait(700);
      menu("Beispiel"); await wait(250);
      var go = document.querySelector(".rc-dialog-confirm .btn-primary"); if (go) go.click();
      await wait(900);
      var versions = await RickCVStore.listVersions(RickCVLibrary.currentId());
      var kept = versions.find(function (v) { return v.kind === "before" && v.data.indexOf("Zweite Fassung") !== -1; });
      var replaced = name().value;
      menu("Frühere Stände"); await wait(600);
      var row = Array.prototype.find.call(document.querySelectorAll(".lib-dialog .lib-item"),
        function (x) { return /vor dem Beispiel/.test(x.textContent); });
      if (row) row.querySelector("button").click();
      await wait(900);
      return { kept: !!kept, replaced: replaced, restored: name().value };
    })()`);
    ok(backed.kept, "vor dem Beispiel wird der Stand gesichert", JSON.stringify(backed));
    ok(backed.replaced === "Harald Töpfer" && backed.restored === "Zweite Fassung",
       "der gesicherte Stand lässt sich zurückholen", JSON.stringify(backed));

    await b.load();
    ok(await E(`document.querySelector('[data-section="person"] input').value`) === "Zweite Fassung",
       "nach dem Neuladen ist das zuletzt geöffnete Dokument da");

    const job = await E(`(async function () { ${helpers}
      var tab = Array.prototype.find.call(document.querySelectorAll(".editor-tab"),
        function (x) { return /Stelle/.test(x.textContent); });
      tab.click(); await wait(300);
      var ad = document.querySelector('textarea[data-path="job.ad"]');
      ad.value = "Ihr Profil\\n- Kenntnisse in SAP\\n- Erfahrung mit Python\\n- Abgeschlossenes Masterstudium\\n- Bereitschaft zum Schichtdienst";
      ad.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(800);
      var terms = function () { return Array.prototype.map.call(document.querySelectorAll(".job-term"), function (x) {
        return x.className.replace("job-term ", "") + ":" + x.querySelector(".job-term-main").textContent.slice(1);
      }); };
      var before = terms();
      var python = Array.prototype.find.call(document.querySelectorAll(".job-term"),
        function (x) { return /Python/.test(x.textContent); });
      python.querySelector(".job-term-action").click();
      await wait(600);
      var have = function (label) {
        var chip = Array.prototype.find.call(document.querySelectorAll(".job-term"),
          function (x) { return x.querySelector(".job-term-main").textContent.slice(1) === label; });
        if (chip) chip.querySelector(".job-term-action").click();
        return !!chip;
      };
      var clicked = [have("Masterstudium"), have("Schichtdienst")];
      await wait(600);
      var doc = JSON.parse(localStorage.getItem("rickcv.data.v3"));
      var skills = doc.skills.items.map(function (x) { return x.name; });
      return { before: before, after: terms(), skills: skills, clicked: clicked,
               education: doc.events.filter(function (e) { return e.sectionId === "education"; }).map(function (e) { return e.title; }),
               confirmed: doc.job.confirmed };
    })()`);
    ok(job.before.includes("job-missing:SAP") && job.before.includes("job-missing:Python"),
       "die Stellenanzeige wird ausgewertet", JSON.stringify(job.before));
    ok(job.after.includes("job-found:Python") && job.skills.includes("Python"),
       "„Habe ich“ trägt den Begriff unter Kenntnisse ein", JSON.stringify(job));
    ok(job.clicked[0] && job.education.includes("Masterstudium") && !job.skills.includes("Masterstudium"),
       "„Habe ich“ bei einem Abschluss: unter Ausbildung, nie unter Kenntnisse", JSON.stringify(job));
    ok(job.clicked[1] && job.confirmed.includes("Schichtdienst") && !job.skills.includes("Schichtdienst") &&
       job.after.includes("job-confirmed:Schichtdienst"),
       "„Habe ich“ bei einer Bedingung: vermerkt, nicht als Kenntnis", JSON.stringify(job));

    const saved = await E(`(async function () { ${helpers}
      var captured = null;
      window.showSaveFilePicker = undefined;
      var create = URL.createObjectURL;
      URL.createObjectURL = function (blob) { captured = blob; return create.call(URL, blob); };
      HTMLAnchorElement.prototype.click = function () {};
      RickCVSaveFile.save(false);
      for (var i = 0; i < 40 && !captured; i++) await wait(200);
      if (!captured) return { missing: true };
      var html = await captured.text();
      var back = RickCVImport.parseText(html, "datei.html");
      return { scripts: (html.match(/<script/g) || []).length, data: html.indexOf('id="rickcv-data"') !== -1,
               fonts: /@font-face/.test(html), back: back.format + ":" + back.state.contact.name };
    })()`);
    ok(saved.scripts === 1 && saved.data, "gespeicherte Datei: nur der Datenblock, kein Skript", JSON.stringify(saved));
    ok(saved.fonts, "gespeicherte Datei bringt ihre Schriften mit");
    ok(saved.back === "rickcv:Zweite Fassung", "gespeicherte Datei ergibt wieder das Dokument", saved.back);

    //  Ein Theme mit "example: short" bekommt das kuerzere Beispiel, solange
    //  das Beispiel unveraendert dasteht – und ein anderes Theme wieder das
    //  ganze. Eigener Inhalt bleibt, wie er ist.
    const fitted = await E(`(async function () { ${helpers}
      menu("Beispiel"); await wait(250);
      var go = document.querySelector(".rc-dialog-confirm .btn-primary"); if (go) go.click();
      await wait(900);
      var tab = Array.prototype.find.call(document.querySelectorAll(".editor-tab"),
        function (x) { return /Aussehen|Design|Theme/.test(x.textContent); });
      if (tab) tab.click();
      await wait(300);
      var open = document.querySelector('[data-section="theme"] .section-head, [data-section="theme"] summary');
      var card = function (name) {
        return Array.prototype.find.call(document.querySelectorAll(".theme-card"),
          function (x) { return x.querySelector("strong").textContent === name; });
      };
      if (!card("Gut lesbar") && open) { open.click(); await wait(300); }
      var stored = function () { var d = JSON.parse(localStorage.getItem("rickcv.data.v3")); return d.events.length + "/" + d.projects.items.length; };
      var full = stored();
      card("Gut lesbar").click(); await wait(600);
      var short = stored();
      card("Clean").click(); await wait(600);
      var back = stored();
      document.querySelectorAll(".editor-tab")[0].click(); await wait(300);
      type("Eigene Fassung"); await wait(600);
      if (tab) tab.click();
      await wait(300);
      card("Gut lesbar").click(); await wait(600);
      return { full: full, short: short, back: back, own: stored() };
    })()`);
    ok(fitted.full === "8/2" && fitted.short === "5/0" && fitted.back === "8/2",
       "„example: short“: das Beispiel passt sich dem Theme an", JSON.stringify(fitted));
    ok(fitted.own === "8/2", "eigener Inhalt bleibt beim Themewechsel unverändert", JSON.stringify(fitted));

    ok(b.errors().length === 0, "keine Skriptfehler", b.errors().join(" | "));
  } finally {
    await b.close();
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
