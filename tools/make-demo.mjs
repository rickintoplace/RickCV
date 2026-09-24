/*  make-demo.mjs – nimmt examples/demo.mp4 und examples/demo.gif neu auf.
 *
 *  Aufruf aus dem Projektverzeichnis:   node tools/make-demo.mjs
 *  Gebraucht werden Node (ab 22, wegen WebSocket), ein Chromium
 *  (tests/chromium.mjs sagt, wo es gesucht wird) und python3 mit Pillow und
 *  numpy fuer das GIF (tools/demo-gif.py).
 *
 *  Die Vorfuehrung ist gespielt, aber nicht gestellt: Maus, Tastatur und
 *  das Hineinziehen der Datei gehen ueber das DevTools-Protokoll als echte
 *  Eingaben in den Baukasten. Der Import liest wirklich
 *  tests/fixtures/demo-cv.pdf, die Vorschau zeichnet wirklich. Nur den
 *  Mauszeiger malt die Buehne (tools/demo-stage.html) dazu – einen echten
 *  zeigt kein Bildschirmfoto.
 *
 *  Bilder im festen Takt, danach zwei Ausgaben:
 *    examples/demo.mp4  – in voller Groesse, von Chromes MediaRecorder
 *    examples/demo.gif  – 900 Punkte breit, fuer das README
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findChromium } from "../tests/chromium.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const WIDTH = 1280;
const HEIGHT = 680;
const FRAME_MS = 80;               // 12,5 Bilder je Sekunde
const GIF_WIDTH = 900;

const work = fs.mkdtempSync(path.join(os.tmpdir(), "rickcv-demo-"));
const framesDir = path.join(work, "frames");
fs.mkdirSync(framesDir);

//  Die Datei, die in der Vorfuehrung hineingezogen wird. Sie heisst dort so,
//  wie so eine Datei eben heisst.
const dropped = path.join(work, "old-resume.pdf");
fs.copyFileSync(path.join(root, "tests/fixtures/demo-cv.pdf"), dropped);

/* ----------------------------------------------------------------- Server */

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".woff2": "font/woff2", ".webp": "image/webp",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
  ".pdf": "application/pdf",
};

const server = http.createServer((request, response) => {
  const url = decodeURIComponent(request.url.split("?")[0]);
  const file = url.startsWith("/__frames/")
    ? path.join(framesDir, path.basename(url))
    : path.join(root, url === "/" ? "index.html" : url);
  fs.readFile(file, (error, body) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    response.end(body);
  });
});
//  Freie Ports vergibt das System – feste waeren irgendwann belegt.
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const PORT = server.address().port;

/* ----------------------------------------------------------------- Chrome */

const browser = findChromium();
if (!browser) throw new Error("Kein Chromium gefunden – CHROME=/pfad/zum/browser setzen.");

const profile = path.join(work, "profile");
const chrome = spawn(browser, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--hide-scrollbars",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  `--window-size=${WIDTH},${HEIGHT}`, "--force-device-scale-factor=1", "--lang=en-US",
  "--autoplay-policy=no-user-gesture-required", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

//  Welchen Port Chrome sich genommen hat, schreibt es in sein Profil.
async function target() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0];
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((entry) => entry.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* Chrome startet noch */ }
    await sleep(200);
  }
  throw new Error("Chrome antwortet nicht.");
}

const socket = new WebSocket(await target());
await new Promise((done) => socket.addEventListener("open", done, { once: true }));
let nextId = 0;
const pending = new Map();
const listeners = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else if (message.method) {
    listeners.forEach((fn) => fn(message));
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error("Im Browser: " + (result.exceptionDetails.exception || {}).description);
  }
  return result.result.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
});

async function load(url) {
  const loaded = new Promise((done) => {
    const fn = (message) => {
      if (message.method === "Page.loadEventFired") {
        listeners.splice(listeners.indexOf(fn), 1);
        done();
      }
    };
    listeners.push(fn);
  });
  await send("Page.navigate", { url });
  await loaded;
}

/* ---------------------------------------------------------------- Eingabe */

//  Der Zeiger beginnt auf dem grauen Rand neben dem Blatt: dort zeigt er
//  auf nichts, und die Vorschau bietet noch nichts zum Bearbeiten an.
const pointer = { x: 1272, y: 670 };
let dragging = false;
const DRAG = {
  items: [{ mimeType: "application/pdf", data: "" }],
  files: [dropped],
  dragOperationsMask: 1,
};

async function place(x, y) {
  pointer.x = x;
  pointer.y = y;
  await evaluate(`demo.pointer(${x}, ${y})`);
  if (dragging) {
    await send("Input.dispatchDragEvent", { type: "dragOver", x, y, data: DRAG });
  } else {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  }
}

async function click() {
  await evaluate("demo.ring()");
  const at = { x: pointer.x, y: pointer.y, button: "left", clickCount: 1 };
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...at });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at });
}

async function key(name, code, keyCode) {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: name, code, windowsVirtualKeyCode: keyCode });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: keyCode });
}

/* ---------------------------------------------------------------- Bilder */

let frame = 0;
let clock = 0;

//  Ein Bild, im festen Takt: die Uhr der Vorfuehrung laeuft mit der echten
//  mit, damit Uebergaenge im Baukasten so lange dauern, wie sie dauern.
async function shoot() {
  const due = clock + frame * FRAME_MS;
  const wait = due - Date.now();
  if (wait > 0) await sleep(wait);
  //  Verlustfrei: in einem JPEG unterschiede sich jedes Bild durch sein
  //  Kompressionsrauschen in jedem Pixel vom vorigen – das GIF koennte dann
  //  nicht nur die Aenderungen speichern und muesste das Rauschen mit einer
  //  gemeinsamen Palette zukleistern. Das sah posterisiert aus.
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(framesDir, String(frame).padStart(4, "0") + ".png"),
    Buffer.from(data, "base64"));
  frame++;
}

async function hold(count) {
  for (let i = 0; i < count; i++) await shoot();
}

//  Eine Bewegung, sanft beschleunigt und abgebremst.
async function move(to, count) {
  const from = { x: pointer.x, y: pointer.y };
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    await place(Math.round(from.x + (to.x - from.x) * ease), Math.round(from.y + (to.y - from.y) * ease));
    await shoot();
  }
}

//  So lange Bilder, bis im Baukasten etwas eingetreten ist – hoechstens max.
async function until(expression, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await evaluate(expression)) return;
    await shoot();
  }
  throw new Error("Nicht eingetreten: " + expression);
}

const at = (expression) => evaluate(expression);

/* --------------------------------------------------------------- Drehbuch */

try {
  await load(`http://127.0.0.1:${PORT}/tools/demo-stage.html`);
  for (let i = 0; i < 100 && !(await evaluate("demo.ready()")); i++) await sleep(100);
  //  Die Startkarte beim ersten Besuch gehoert nicht in die Vorfuehrung.
  await evaluate(`(function () {
    var close = demo.app().document.querySelector(".welcome-close");
    if (close) close.click();
  })()`);
  await sleep(1200);
  await place(1272, 670);
  clock = Date.now();

  //  1. Der Baukasten mit dem Beispiel.
  await hold(12);

  //  2. Eine alte Bewerbung als PDF auf die Vorschau ziehen.
  await evaluate('demo.chip("old-resume.pdf")');
  dragging = true;
  await send("Input.dispatchDragEvent", { type: "dragEnter", x: pointer.x, y: pointer.y, data: DRAG });
  await move(await at('demo.previewPoint("h1.name", 0)'), 16);
  await hold(4);
  await send("Input.dispatchDragEvent", { type: "drop", x: pointer.x, y: pointer.y, data: DRAG });
  dragging = false;
  await evaluate("demo.chip(null)");

  //  3. Der Import zeigt, was er gefunden hat.
  await until(`!!demo.app().document.querySelector(".imp-foot .btn-primary")`, 80);
  await hold(16);

  //  4. Uebernehmen.
  await move(await at('demo.center(".imp-foot .btn-primary")'), 12);
  await hold(2);
  await click();
  await hold(18);

  //  5. In der Vorschau auf eine Station zeigen, "Bearbeiten" nehmen.
  //  Die erste Berufsstation: vor ihr stehen die beiden der Ausbildung.
  await move(await at('demo.previewPoint("[data-edit^=\\"events.\\"]", 2, 90, 10)'), 14);
  await hold(8);
  await move(await at('demo.previewPoint(".rickcv-edit-button", 0)'), 6);
  await hold(2);
  await click();
  await hold(10);

  //  6. Weiterschreiben – die Vorschau zieht mit.
  await key("End", "End", 35);
  for (const char of " · Team Lead") {
    await send("Input.insertText", { text: char });
    await shoot();
  }
  await hold(12);

  //  7. Zum Aussehen: Farbe, dann zwei Themes.
  await move(await at('demo.center("#tab-design")'), 14);
  await click();
  await hold(8);
  await evaluate('demo.reveal(".swatch[title=\\"#a8432f\\"]")');
  await hold(8);
  await move(await at('demo.center(".swatch[title=\\"#a8432f\\"]")'), 12);
  await click();
  await hold(12);
  const card = (name) => `demo.center(Array.prototype.filter.call(
    demo.app().document.querySelectorAll(".theme-card"),
    function (node) { return node.textContent.indexOf(${JSON.stringify(name)}) !== -1; })[0])`;
  await evaluate('demo.revealText(".theme-card", "Right Rail")');
  await hold(6);
  await move(await at(card("Right Rail")), 12);
  await click();
  await hold(18);
  await evaluate('demo.revealText(".theme-card", "Banner")');
  await hold(8);
  await move(await at(card("Banner")), 10);
  await click();
  await hold(18);

  //  8. Als PDF speichern: erst sagt der Baukasten, was im Druckdialog gilt.
  await move(await at('demo.center("#btn-print")'), 14);
  await hold(2);
  await click();
  await hold(26);

  console.log(`  ${frame} Bilder, ${(frame * FRAME_MS / 1000).toFixed(1)} s`);

  //  Zum Nachsehen: DEMO_FRAMES=verzeichnis behaelt die Einzelbilder.
  if (process.env.DEMO_FRAMES) {
    fs.mkdirSync(process.env.DEMO_FRAMES, { recursive: true });
    fs.readdirSync(framesDir).forEach((name) =>
      fs.copyFileSync(path.join(framesDir, name), path.join(process.env.DEMO_FRAMES, name)));
  }

  /* -------------------------------------------------------------- MP4 */

  //  Chrome packt das Video selbst: die Bilder werden auf eine Leinwand
  //  gemalt, im selben Takt, und der MediaRecorder nimmt sie auf.
  await load(`http://127.0.0.1:${PORT}/tools/demo-stage.html?encode`);
  const video = await evaluate(`(async function () {
    var count = ${frame}, step = ${FRAME_MS};
    var canvas = document.createElement("canvas");
    canvas.width = ${WIDTH}; canvas.height = ${HEIGHT};
    var context = canvas.getContext("2d");
    var images = await Promise.all(Array.from({ length: count }, function (_, i) {
      return new Promise(function (done, fail) {
        var image = new Image();
        image.onload = function () { done(image); };
        image.onerror = fail;
        image.src = "/__frames/" + String(i).padStart(4, "0") + ".png";
      });
    }));
    var stream = canvas.captureStream(0);
    var track = stream.getVideoTracks()[0];
    var recorder = new MediaRecorder(stream, {
      mimeType: "video/mp4;codecs=avc1.42E01E", videoBitsPerSecond: 2500000,
    });
    var chunks = [];
    recorder.ondataavailable = function (event) { if (event.data.size) chunks.push(event.data); };
    var stopped = new Promise(function (done) { recorder.onstop = done; });
    context.drawImage(images[0], 0, 0);
    recorder.start();
    var start = performance.now();
    for (var i = 0; i < count; i++) {
      context.drawImage(images[i], 0, 0);
      track.requestFrame();
      var wait = start + (i + 1) * step - performance.now();
      await new Promise(function (done) { setTimeout(done, Math.max(0, wait)); });
    }
    recorder.stop();
    await stopped;
    var bytes = new Uint8Array(await new Blob(chunks, { type: "video/mp4" }).arrayBuffer());
    var binary = "";
    for (var j = 0; j < bytes.length; j += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(j, j + 8192));
    }
    return btoa(binary);
  })()`);
  fs.writeFileSync(path.join(root, "examples/demo.mp4"), Buffer.from(video, "base64"));
  console.log(`  examples/demo.mp4  ${Math.round(fs.statSync(path.join(root, "examples/demo.mp4")).size / 1024)} kB`);

  /* -------------------------------------------------------------- GIF */

  //  Das GIF rechnet tools/demo-gif.py (Pillow und numpy): eine Palette mit
  //  exakten Flaechenfarben und gerasterten Fotos. Warum so, steht dort.
  execFileSync("python3", [path.join(here, "demo-gif.py"), framesDir,
    path.join(root, "examples/demo.gif"), String(GIF_WIDTH), String(FRAME_MS)],
  { stdio: "inherit" });
  console.log(`  examples/demo.gif  ${Math.round(fs.statSync(path.join(root, "examples/demo.gif")).size / 1024)} kB`);
} finally {
  socket.close();
  //  Erst aufraeumen, wenn Chrome wirklich fort ist – sonst schreibt es
  //  noch in sein Profil, waehrend das Verzeichnis geloescht wird.
  const exited = new Promise((done) => chrome.once("exit", done));
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  server.close();
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
