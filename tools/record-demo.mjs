/*  record-demo.mjs – nimmt die Vorführung auf, die oben im README steht.
 *
 *  Aufruf:
 *      node tools/record-demo.mjs            → examples/demo.gif + demo.mp4
 *      node tools/record-demo.mjs --keep     → Einzelbilder behalten
 *
 *  Gebraucht werden ein Chromium und ffmpeg. Der Ablauf ist echt: die Datei
 *  wird wirklich fallen gelassen, wirklich gelesen, das Dokument wirklich neu
 *  gesetzt. Nur zwei Dinge sind gemalt – der Mauszeiger und die Datei, die
 *  hereinfliegt. Beides zeichnet ein Browser ohne Fenster nicht selbst, und
 *  ohne sie sähe man einen Sprung statt einer Bewegung.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { withBrowser, sleep, ROOT } from "./cdp.mjs";

const keep = process.argv.includes("--keep");
const work = fs.mkdtempSync(path.join(ROOT, ".demo-"));
const WIDTH = 1280;
const HEIGHT = 820;
const FPS = 10;

//  Die Beispieldatei: ein erfundener Lebenslauf in fremdem Aufbau, mit
//  Foto, drei Projektmarken und einer Unterschrift. Gebaut von
//  tools/make-demo-cv.py, gelesen von tests/import.test.mjs – was das GIF
//  zeigt, haelt also ein Test fest.
const FILE = "/tests/fixtures/demo-cv.pdf";

//  Bricht etwas ab, bleiben sonst ein paar hundert Einzelbilder liegen.
process.on("uncaughtException", (error) => {
  fs.rmSync(work, { recursive: true, force: true });
  console.error(error.message);
  process.exit(1);
});

const frames = await withBrowser({ width: WIDTH, height: HEIGHT }, async (page) => {
  //  Werkzeug in der Seite: Mauszeiger, Dateikarte, Warten auf ein Element.
  await page.run(`(function () {
    var style = document.createElement("style");
    style.textContent = [
      ".demo-cursor{position:fixed;top:0;left:0;z-index:99999;width:26px;height:26px;pointer-events:none;",
      "transition:transform .7s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}",
      ".demo-file{position:fixed;top:0;left:0;z-index:99998;pointer-events:none;display:flex;align-items:center;",
      "gap:.5em;padding:.6em .9em;border-radius:8px;background:#fff;color:#1f2933;font:600 15px/1.2 system-ui;",
      "box-shadow:0 8px 24px rgba(0,0,0,.28);transition:transform .9s cubic-bezier(.4,0,.2,1),opacity .3s}",
      ".demo-file b{display:inline-block;padding:.15em .4em;border-radius:3px;background:#c0392b;color:#fff;font-size:12px}",
    ].join("");
    document.head.appendChild(style);

    var cursor = document.createElement("div");
    cursor.className = "demo-cursor";
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 2l14 9-6 1 3.5 7-2.6 1.2L10.4 13 5 17z" fill="#fff" stroke="#111" stroke-width="1.2"/></svg>';
    document.body.appendChild(cursor);

    var file = document.createElement("div");
    file.className = "demo-file";
    file.style.opacity = "0";
    file.innerHTML = '<b>PDF</b><span>old-resume.pdf</span>';
    document.body.appendChild(file);

    window.demo = {
      at: function (x, y) { cursor.style.transform = "translate(" + x + "px," + y + "px)"; },
      fileAt: function (x, y) { file.style.transform = "translate(" + x + "px," + y + "px)"; },
      showFile: function () { file.style.opacity = "1"; },
      hideFile: function () { file.style.opacity = "0"; },
      click: function (node) { if (node) node.click(); return !!node; },
      byText: function (selector, text) {
        return [].filter.call(document.querySelectorAll(selector), function (node) {
          return node.textContent.trim() === text;
        })[0] || null;
      },
      waitFor: function (find, limit) {
        var deadline = Date.now() + (limit || 15000);
        return new Promise(function (done, fail) {
          (function look() {
            var hit = find();
            if (hit) return done(hit);
            if (Date.now() > deadline) return fail(new Error("nicht gefunden"));
            setTimeout(look, 100);
          })();
        });
      },
    };
    window.demo.at(${WIDTH - 120}, 150);
    window.demo.fileAt(${WIDTH - 150}, 120);
  })()`);

  //  Ab hier laufen Aufnahme und Vorführung nebeneinander.
  let frame = 0;
  let running = true;
  const recorder = (async () => {
    while (running) {
      const started = Date.now();
      try {
        await page.shot(path.join(work, `f${String(frame++).padStart(4, "0")}.png`));
      } catch { /* ein verlorenes Bild ist kein Grund abzubrechen */ }
      const rest = 1000 / FPS - (Date.now() - started);
      if (rest > 0) await sleep(rest);
    }
  })();

  await sleep(1400); // Ruhiger Anfang: erst das fertige Dokument zeigen

  //  Erster Griff: ein anderes Aussehen. Die Abschnitte sind
  //  <details>-Bloecke, die Ueberschrift ist ein <summary>, kein Knopf.
  await page.run(`(function () {
    var themes = window.demo.byText("summary", "Themes");
    if (!themes) return false;
    themes.scrollIntoView({ block: "center" });
    var box = themes.getBoundingClientRect();
    window.demo.at(Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2));
    return true;
  })()`);
  await sleep(700);
  await page.run(`(function () { var t = window.demo.byText("summary", "Themes"); if (t) t.click(); })()`);
  await sleep(1100);

  //  Right Rail statt Terminal: die Seitenspalte wandert nach rechts, der
  //  Werdegang faengt links an – ein Wechsel, den man auf einen Blick sieht.
  await page.run(`window.demo.waitFor(function () {
    var cards = document.querySelectorAll(".theme-card");
    return cards.length ? cards : null;
  }).then(function () {
    var card = [].filter.call(document.querySelectorAll(".theme-card"), function (node) {
      return /Right Rail|Rechte Spalte/.test(node.textContent);
    })[0] || document.querySelectorAll(".theme-card")[7];
    card.scrollIntoView({ block: "center" });
    var box = card.getBoundingClientRect();
    window.demo.at(Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2));
    window.demo.card = card;
    return true;
  })`);
  await sleep(800);
  await page.run(`window.demo.click(window.demo.card)`);
  await sleep(1800);

  //  Und gleich daneben die Farbe – dafuer muss niemand mehr den Abschnitt
  //  wechseln.
  await page.run(`(function () {
    var field = document.querySelector('.field[data-path="style.accentColor"]');
    if (!field) return false;
    field.scrollIntoView({ block: "center" });
    var swatches = field.querySelectorAll(".swatch");
    var swatch = swatches[6] || swatches[swatches.length - 1];
    var box = swatch.getBoundingClientRect();
    window.demo.at(Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2));
    window.demo.swatch = swatch;
    return true;
  })()`);
  await sleep(800);
  await page.run(`window.demo.click(window.demo.swatch)`);
  await sleep(1600);

  //  Zweiter Griff: eine fremde Datei. Sie fliegt ueber die Vorschau und
  //  wird dort fallen gelassen.
  //  Erst faehrt der Zeiger an den Rand und nimmt die Datei auf, dann
  //  ziehen beide gemeinsam auf das Blatt. Vorher liefen sie aus
  //  verschiedenen Ecken aufeinander zu, und es sah aus, als haette die
  //  Datei mit dem Zeiger nichts zu tun.
  await page.run(`(function(){ window.demo.at(${WIDTH - 170}, 150); })()`);
  await sleep(700);
  await page.run(`(function(){
    window.demo.fileAt(${WIDTH - 150}, 128);
    window.demo.showFile();
  })()`);
  await sleep(700);
  await page.run(`(function(){ window.demo.at(760, 420); window.demo.fileAt(782, 398); })()`);
  await sleep(1200);

  await page.run(`(async function () {
    var response = await fetch(${JSON.stringify(FILE)});
    var blob = await response.blob();
    var file = new File([blob], "old-resume.pdf", { type: "application/pdf" });
    var data = new DataTransfer();
    data.items.add(file);

    var target = document.elementFromPoint(760, 420) || document.body;
    ["dragenter", "dragover", "drop"].forEach(function (name) {
      target.dispatchEvent(new DragEvent(name, {
        bubbles: true, cancelable: true, dataTransfer: data,
      }));
    });
    window.demo.hideFile();
  })()`);

  //  Der Dialog zeigt erst, was gefunden wurde – und sagt dazu, dass es ein
  //  Entwurf ist. Das ist der ehrliche Teil und darf ruhig lange stehen.
  await page.run(`window.demo.waitFor(function () {
    var overlay = document.querySelector(".imp-overlay");
    if (!overlay || overlay.hidden) return null;
    return overlay.querySelector(".imp-foot .btn-primary");
  }).then(function () { return true; })`);
  await sleep(2600);

  await page.run(`(function () {
    var apply = document.querySelector(".imp-overlay .imp-foot .btn-primary");
    if (!apply) return false;
    var box = apply.getBoundingClientRect();
    window.demo.at(Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2));
    return true;
  })()`);
  await sleep(800);
  await page.run(`window.demo.click(document.querySelector(".imp-overlay .imp-foot .btn-primary"))`);
  await sleep(2600);

  //  Zum Schluss ein Stueck weiter nach unten: dort stehen die Projekte mit
  //  ihren Marken, und die sind der Beleg dafuer, dass die Bilder nicht
  //  irgendwo, sondern an ihrer Stelle landen.
  await page.run(`(function () {
    var view = document.getElementById("preview-scroll");
    if (!view) return false;
    var step = 0;
    var timer = setInterval(function () {
      step += 14;
      view.scrollTop = step;
      if (step >= 430) clearInterval(timer);
    }, 26);
    return true;
  })()`);
  await sleep(2600);

  running = false;
  await recorder;
  return frame;
});

/* ------------------------------------------------------------------ Schnitt */

const out = path.join(ROOT, "examples");
fs.mkdirSync(out, { recursive: true });
const gif = path.join(out, "demo.gif");
const mp4 = path.join(out, "demo.mp4");

execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", path.join(work, "f%04d.png"),
  "-vf", "scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];" +
         "[b][p]paletteuse=dither=bayer:bayer_scale=3",
  "-loop", "0", gif], { stdio: "ignore" });

execFileSync("ffmpeg", ["-y", "-framerate", String(FPS), "-i", path.join(work, "f%04d.png"),
  "-vf", "scale=1100:-2:flags=lanczos", "-c:v", "libx264", "-pix_fmt", "yuv420p",
  "-crf", "26", "-movflags", "+faststart", mp4], { stdio: "ignore" });

console.log(`${frames} Bilder`);
for (const file of [gif, mp4]) {
  console.log(`  ${path.relative(ROOT, file).padEnd(18)} ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
}

if (!keep) fs.rmSync(work, { recursive: true, force: true });
else console.log(`Einzelbilder: ${path.relative(ROOT, work)}`);

process.exit(0);
