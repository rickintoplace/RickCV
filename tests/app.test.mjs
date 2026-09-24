/*  Prüft den Baukasten im Browser: so, wie ihn jemand öffnet.
 *
 *    – Die Content-Security-Policy hält, ohne etwas Eigenes zu blockieren:
 *      keine Verstöße, keine Skriptfehler – über http wie per Doppelklick
 *      (file://), denn beides muss gehen.
 *    – Die Vorschau zeichnet das Beispiel samt Foto aus dem Projekt.
 *    – Nur der eigene Rahmen darf das Dokument befüllen: eine fremde Seite
 *      schreibt weder Daten in cv.html noch ein Theme in den Baukasten.
 *    – Ein Wert, der aus einem Attribut ausbrechen will, bleibt Text.
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/app.test.mjs
 *  Gebraucht wird ein Chromium (tests/chromium.mjs sagt, wo er gesucht
 *  wird) und python3 für einen kurzlebigen Server.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { findChromium, browserRequired } from "./chromium.mjs";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const PORT = 8764;
const origin = `http://127.0.0.1:${PORT}`;

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

//  Headless-Chrome beginnt jedes Mal mit leerem Profil: kein Speicherstand
//  aus einem früheren Lauf, die Startkarte erscheint. Ein eigenes
//  --user-data-dir hielte Chrome nach dem Ende noch vierzig Sekunden fest.
async function chrome(browser, url, budget = 8000) {
  const { stdout, stderr } = await run(browser, [
    "--headless", "--disable-gpu", "--no-sandbox", "--no-first-run", "--lang=de-DE",
    "--enable-logging=stderr", "--v=0",
    "--window-size=1400,1000", `--virtual-time-budget=${budget}`,
    "--dump-dom", url,
  ], { encoding: "utf8", timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
  return { dom: stdout, log: stderr };
}

//  Was die Konsole zu beanstanden hat: Verstöße gegen die Policy und
//  Skriptfehler. Meldungen fremder Herkunft (Erweiterungen, Chrome selbst)
//  zählen nicht.
function complaints(log) {
  return log.split("\n").filter((line) =>
    /CONSOLE/.test(line) &&
    /Content Security Policy|Uncaught|TypeError|ReferenceError|SyntaxError/.test(line));
}

function result(dom) {
  const match = dom.match(/<title>RESULT:([\s\S]*?)<\/title>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  } catch {
    return null;
  }
}

function probe(name, html) {
  const file = path.join(root, `.app-${name}-probe.html`);
  fs.writeFileSync(file, `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>wartet</title></head><body>${html}</body></html>`);
  return { url: `${origin}/.app-${name}-probe.html`, file };
}

const browser = findChromium();
console.log("\n— Der Baukasten im Browser —");

if (!browser) {
  if (browserRequired()) ok(false, "Chromium gefunden", "CHROME=/pfad/zum/browser setzen");
  else console.log("  übersprungen (kein Chromium gefunden – CHROME=… setzen)");
} else {
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"],
                       { cwd: root, stdio: "ignore" });
  await new Promise((done) => setTimeout(done, 800));
  const probes = [];

  try {
    /* -- Policy und Fehler ---------------------------------------------- */

    for (const [label, url] of [
      ["index.html über http", `${origin}/index.html`],
      ["cv.html über http", `${origin}/cv.html`],
      ["index.html per Doppelklick", "file://" + path.join(root, "index.html")],
      ["cv.html per Doppelklick", "file://" + path.join(root, "cv.html")],
    ]) {
      const { dom, log } = await chrome(browser, url);
      const trouble = complaints(log);
      ok(trouble.length === 0, `${label}: keine Verstöße, keine Fehler`, trouble.slice(0, 2).join(" | "));
      if (label.startsWith("index")) {
        ok(/class="welcome"/.test(dom), `${label}: Startkarte beim ersten Besuch`);
      }
    }

    /* -- Die Vorschau zeichnet -------------------------------------------- */

    const builder = probe("builder", `
<iframe id="app" src="index.html" style="width:1400px;height:900px"></iframe>
<script>
  setTimeout(function () {
    var app = document.getElementById("app").contentWindow.document;
    var doc = app.getElementById("preview-frame").contentDocument;
    var name = doc.querySelector("h1.name");
    var photo = doc.querySelector('[data-block="photo"] img');
    var projects = doc.querySelectorAll(".project img");
    document.title = "RESULT:" + JSON.stringify({
      name: name ? name.textContent : null,
      photo: photo ? photo.getAttribute("src") : null,
      photoWidth: photo ? photo.naturalWidth : 0,
      projects: Array.prototype.map.call(projects, function (img) { return img.naturalWidth; }),
      labelled: app.querySelectorAll("label[for]").length,
    });
  }, 4000);
</script>`);
    probes.push(builder.file);
    const shown = result((await chrome(browser, builder.url, 9000)).dom);
    ok(shown && /Töpfer|Poppins/.test(shown.name || ""), "Vorschau zeigt das Beispiel", shown && shown.name);
    ok(shown && shown.photo === "./img/example/photo.webp" && shown.photoWidth > 0,
       "Foto kommt aus dem Projekt und lädt", shown && `${shown.photo} (${shown.photoWidth} px)`);
    ok(shown && shown.projects.length === 2 && shown.projects.every((w) => w > 0),
       "Projektbilder laden", shown && JSON.stringify(shown.projects));
    ok(shown && shown.labelled > 5, "Beschriftungen zeigen auf ihre Felder", shown && shown.labelled);

    /* -- Bedienbarkeit ------------------------------------------------------ */

    //  Was Vorlesesoftware und Tastatur brauchen, im echten Editor gezählt:
    //  jedes Bedienelement hat einen Namen, kein Knopf steckt in einem
    //  <summary>, die Reiter sind Reiter, ein Dialog sperrt den Rest der
    //  Seite, und Löschen lässt sich zurücknehmen.
    const usable = probe("usable", `
<iframe id="app" src="index.html" style="width:1400px;height:900px"></iframe>
<script>
  function nameOf(d, node) {
    if (node.getAttribute("aria-label")) return node.getAttribute("aria-label");
    if (node.getAttribute("aria-labelledby")) {
      var ref = d.getElementById(node.getAttribute("aria-labelledby"));
      if (ref) return ref.textContent.trim();
    }
    if (node.id && d.querySelector('label[for="' + node.id + '"]')) return "label";
    if (node.closest("label")) return "label";
    if (node.tagName === "BUTTON" && node.textContent.trim()) return node.textContent.trim();
    return node.title || "";
  }
  setTimeout(function () {
    var w = document.getElementById("app").contentWindow, d = w.document, r = {};
    //  Alle Reiter und Abschnitte aufklappen, damit alles gebaut ist.
    var unnamed = [], checked = 0;
    ["resume", "letter", "design", "settings"].forEach(function (group) {
      d.getElementById("tab-" + group).click();
      d.querySelectorAll("#editor details").forEach(function (node) {
        node.open = true; node.dispatchEvent(new w.Event("toggle"));
      });
      d.querySelectorAll("#editor .list-item-toggle").forEach(function (node) { node.click(); });
      d.querySelectorAll("#editor input, #editor select, #editor textarea, #editor button")
        .forEach(function (node) {
          if (node.type === "file" || node.hidden || node.offsetParent === null) return;
          checked++;
          if (!nameOf(d, node)) unnamed.push(group + ":" + node.tagName + "." + node.className);
        });
    });
    r.unnamed = unnamed;
    r.checked = checked;
    r.buttonsInSummary = d.querySelectorAll("summary button").length;
    r.tabs = d.querySelectorAll('#editor-tabs [role="tab"]').length;
    r.selectedTabs = d.querySelectorAll('#editor-tabs [aria-selected="true"]').length;

    //  Löschen und zurücknehmen.
    d.getElementById("tab-resume").click();
    var skills = d.querySelector('[data-section="skills"]');
    skills.open = true; skills.dispatchEvent(new w.Event("toggle"));
    var before = skills.querySelectorAll(".list-item").length;
    skills.querySelector(".list-item .btn-danger").click();
    //  Löschen wartet eine Runde: die Rückfrage davor darf ein Dialog sein.
    setTimeout(function () {
    var after = skills.querySelectorAll(".list-item").length;
    r.focusAfterRemove = d.activeElement && d.activeElement.className;
    var undo = d.querySelector("#toast .toast-action");
    r.toast = d.getElementById("toast").textContent;
    if (undo) undo.click();
    r.removed = before - after;
    r.restored = d.querySelectorAll('[data-section="skills"] .list-item').length === before;

    //  Der Import-Dialog sperrt den Rest der Seite.
    d.getElementById("btn-import").click();
    r.headerInert = d.querySelector(".app-chrome").inert === true;
    r.focusInDialog = !!d.activeElement.closest(".imp-panel");
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    r.closedByEscape = d.querySelector(".imp-overlay").hidden === true;
    r.headerFreeAgain = d.querySelector(".app-chrome").inert === false;
    document.title = "RESULT:" + JSON.stringify(r);
    }, 50);
  }, 2500);
</script>`);
    probes.push(usable.file);
    const used = result((await chrome(browser, usable.url, 9000)).dom);
    ok(used && used.checked > 300 && used.unnamed.length === 0,
       "jedes Bedienelement hat einen Namen",
       used && `${used.checked} geprüft: ${used.unnamed.slice(0, 5).join(", ")}`);
    ok(used && used.buttonsInSummary === 0, "kein Knopf steckt in einem <summary>",
       used && used.buttonsInSummary);
    ok(used && used.tabs === 4 && used.selectedTabs === 1, "vier Reiter, einer gewählt",
       used && `${used.tabs}/${used.selectedTabs}`);
    ok(used && used.removed === 1 && used.restored, "Löschen lässt sich im Hinweis zurücknehmen",
       used && JSON.stringify({ removed: used.removed, restored: used.restored, toast: used.toast }));
    ok(used && /list-item-toggle|btn/.test(used.focusAfterRemove || ""),
       "nach dem Löschen bleibt der Fokus in der Liste", used && used.focusAfterRemove);
    ok(used && used.headerInert && used.focusInDialog, "ein Dialog sperrt die Seite dahinter",
       used && JSON.stringify({ inert: used.headerInert, focus: used.focusInDialog }));
    ok(used && used.closedByEscape && used.headerFreeAgain, "Escape schließt und gibt die Seite frei");

    /* -- Aus der Vorschau in den Editor, Rückfragen, Sprache --------------- */

    //  Die Maus fährt über eine Station der Vorschau, der Knopf "Bearbeiten"
    //  erscheint, ein Klick darauf öffnet genau diese Station im Editor. Ein
    //  gedrückter Mausknopf (Markieren) blendet ihn aus.
    const flows = probe("flows", `
<iframe id="app" src="index.html" style="width:1400px;height:900px"></iframe>
<script>
  setTimeout(function () {
    var w = document.getElementById("app").contentWindow, d = w.document, r = {};
    var native = 0;
    w.confirm = function () { native++; return true; };
    w.alert = function () { native++; };

    var pv = d.getElementById("preview-frame").contentWindow, pd = pv.document;
    var event = pd.querySelectorAll('[data-edit^="events."]')[2];
    var box = event.getBoundingClientRect();
    event.dispatchEvent(new pv.MouseEvent("mousemove", { clientX: box.left + 20, clientY: box.top + 5, bubbles: true }));
    var button = pd.querySelector(".rickcv-edit-button");
    r.button = !!button && !button.hidden;
    pd.dispatchEvent(new pv.MouseEvent("mousedown", { bubbles: true }));
    r.hiddenWhileSelecting = button.hidden;
    pd.dispatchEvent(new pv.MouseEvent("mouseup", { bubbles: true }));
    event.dispatchEvent(new pv.MouseEvent("mousemove", { clientX: box.left + 25, clientY: box.top + 6, bubbles: true }));
    var wanted = event.getAttribute("data-edit") + ".title";
    button.click();

    setTimeout(function () {
      r.focused = d.activeElement && d.activeElement.dataset.path;
      r.wanted = wanted;

      //  Deutsches Beispiel, dann Englisch: das Beispiel wechselt mit.
      var sw = d.getElementById("lang-switch");
      sw.value = "de"; sw.dispatchEvent(new w.Event("change"));
      r.german = d.querySelector('[data-section="person"] input').value;
      sw.value = "en"; sw.dispatchEvent(new w.Event("change"));
      r.english = d.querySelector('[data-section="person"] input').value;

      //  Etwas Eigenes, dann "Neu": ein Dialog des Baukastens, kein Kasten
      //  des Browsers.
      var name = d.querySelector('[data-section="person"] input');
      name.value = "Nora"; name.dispatchEvent(new w.Event("input", { bubbles: true }));
      d.getElementById("btn-more").click();
      d.querySelectorAll(".menu-item")[0].click();
      var dialog = d.querySelector(".rc-dialog [role=alertdialog]");
      r.dialog = !!dialog;
      r.stillThere = name.value;
      if (dialog) dialog.querySelector(".btn-primary").click();
      setTimeout(function () {
        r.afterNew = d.querySelector('[data-section="person"] input').value;
        r.native = native;
        document.title = "RESULT:" + JSON.stringify(r);
      }, 300);
    }, 600);
  }, 2500);
</script>`);
    probes.push(flows.file);
    const flowed = result((await chrome(browser, flows.url, 9000)).dom);
    ok(flowed && flowed.button, "über einer Station erscheint der Knopf „Bearbeiten“");
    ok(flowed && flowed.hiddenWhileSelecting, "beim Markieren verschwindet er");
    ok(flowed && flowed.focused === flowed.wanted, "der Knopf öffnet genau diese Station",
       flowed && `${flowed.focused} statt ${flowed.wanted}`);
    ok(flowed && flowed.german === "Harald Töpfer" && flowed.english === "Harold Poppins",
       "das unveränderte Beispiel wechselt die Sprache mit",
       flowed && `${flowed.german} / ${flowed.english}`);
    ok(flowed && flowed.dialog && flowed.stillThere === "Nora" && flowed.afterNew === "",
       "„Neu“ fragt im eigenen Dialog nach und wartet auf die Antwort",
       flowed && JSON.stringify({ dialog: flowed.dialog, before: flowed.stillThere, after: flowed.afterNew }));
    ok(flowed && flowed.native === 0, "keine Rückfrage des Browsers", flowed && flowed.native);

    /* -- Fremde Absender ---------------------------------------------------- */

    //  Ein Geschwisterrahmen spielt die fremde Seite: gleiche Adresse, aber
    //  nicht der Rahmen, in dem cv.html steckt. Danach schickt der echte
    //  Elternrahmen ein Dokument, dessen Bündigkeit aus dem Attribut
    //  ausbrechen will – ungeprüft, so wie es aus einem Link käme.
    const intruder = probe("intruder", `
<iframe id="doc" src="cv.html" style="width:900px;height:1300px"></iframe>
<iframe id="other" srcdoc="<script>setTimeout(function () {
  parent.frames[0].postMessage({ type: 'rickcv:data', data: parent.hostile('Eindringling') }, '*');
}, 1200);<\/script>"></iframe>
<script>
  window.hostile = function (name) {
    var data = RickCVModel.createExample('de');
    data.contact.name = name;
    data.settings.showCoverLetter = true;
    data.settings.alignText = 'x"><img src=x id=pwned onerror=parent.pwned=1>';
    data.photo.shape = 'band evil';
    return data;
  };
  setTimeout(function () {
    var frame = document.getElementById("doc");
    var before = frame.contentDocument.body.innerHTML.indexOf("Eindringling") !== -1;
    frame.contentWindow.postMessage({ type: "rickcv:data", data: hostile("Rahmen") }, location.origin);
    setTimeout(function () {
      var doc = frame.contentDocument;
      document.title = "RESULT:" + JSON.stringify({
        intruder: before,
        parent: doc.body.innerHTML.indexOf("Rahmen") !== -1,
        injected: !!doc.getElementById("pwned") || !!window.pwned,
        align: (doc.querySelector(".cover-letter-body") || { getAttribute: function () { return ""; } })
          .getAttribute("style"),
      });
    }, 1200);
  }, 2600);
</script>
<script src="js/i18n.js"></script><script src="js/model.js"></script>`);
    probes.push(intruder.file);
    const guarded = result((await chrome(browser, intruder.url, 9000)).dom);
    ok(guarded && guarded.intruder === false, "fremder Absender schreibt nichts ins Dokument");
    ok(guarded && guarded.parent === true, "der eigene Rahmen befüllt es weiterhin");
    ok(guarded && guarded.injected === false, "ausbrechende Bündigkeit bleibt wirkungslos",
       guarded && guarded.align);

    //  Dasselbe für den Baukasten: eine CSS-Datei, gemeldet von einem Rahmen,
    //  der nicht die Vorschau ist, wird nicht zum Theme.
    const theme = probe("theme", `
<iframe id="app" src="index.html" style="width:1400px;height:900px"></iframe>
<iframe id="other" srcdoc="<script>setTimeout(function () {
  var file = new File(['.x{color:red} /* eingeschmuggelt */'], 'boese.css', { type: 'text/css' });
  parent.frames[0].postMessage({ type: 'rickcv:file', file: file }, '*');
}, 2000);<\/script>"></iframe>
<script>
  setTimeout(function () {
    var app = document.getElementById("app").contentWindow;
    var stored = app.localStorage.getItem("rickcv.data.v3") || "";
    document.title = "RESULT:" + JSON.stringify({ smuggled: stored.indexOf("eingeschmuggelt") !== -1 });
  }, 4500);
</script>`);
    probes.push(theme.file);
    const themed = result((await chrome(browser, theme.url, 9000)).dom);
    ok(themed && themed.smuggled === false, "fremder Rahmen installiert kein Theme");
  } finally {
    server.kill();
    probes.forEach((file) => fs.rmSync(file, { force: true }));
  }
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
