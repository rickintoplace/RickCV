/*  cdp.mjs – ein Browser ohne Fenster, ferngesteuert.
 *
 *  Zwei Werkzeuge brauchen dasselbe: einen kleinen Server für das Verzeichnis
 *  (über file:// laedt die Seite ihre Schriften nicht), einen Chromium daneben
 *  und eine Leitung dorthin, über die man JavaScript ausführen und Bilder
 *  abholen kann. Das steht hier einmal statt zweimal.
 *
 *      import { withBrowser } from "./cdp.mjs";
 *      await withBrowser({ path: "/index.html" }, async (page) => {
 *        await page.run("document.title");
 *        await page.shot("bild.png");
 *      });
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".zip": "application/zip", ".txt": "text/plain",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function browserPath() {
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try { return execFileSync("which", [name], { encoding: "utf8" }).trim(); } catch { /* weiter */ }
  }
  throw new Error("Kein Chromium gefunden – ohne Browser geht das nicht.");
}

function serve(port) {
  const server = http.createServer((request, response) => {
    const file = path.join(ROOT, decodeURIComponent(request.url.split("?")[0]));
    fs.readFile(file, (error, body) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      });
      response.end(body);
    });
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}

export async function withBrowser(options, work) {
  const width = options.width || 1280;
  const height = options.height || 820;
  const port = options.port || 8788;
  const debugPort = options.debugPort || 9333;

  const server = await serve(port);
  const chrome = spawn(browserPath(), [
    "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--lang=" + (options.lang || "en-US"),
    `--window-size=${width},${height}`,
    `--remote-debugging-port=${debugPort}`,
    `http://127.0.0.1:${port}${options.path || "/index.html"}`,
  ], { stdio: "ignore" });

  let socket = null;
  try {
    let target = null;
    for (let tries = 0; tries < 80 && !target; tries++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        target = list.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      } catch { /* noch nicht da */ }
      if (!target) await sleep(200);
    }
    if (!target) throw new Error("Chromium meldet sich nicht am Debug-Port.");

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((done, fail) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", fail, { once: true });
    });

    let nextId = 1;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      if (message.error) waiting.fail(new Error(message.error.message));
      else waiting.done(message.result);
    });

    const send = (method, params = {}) => {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((done, fail) => pending.set(id, { done, fail }));
    };

    const page = {
      send,
      width,
      height,
      origin: `http://127.0.0.1:${port}`,
      //  JavaScript in der Seite ausführen; ein Promise wird abgewartet.
      async run(expression) {
        const result = await send("Runtime.evaluate", {
          expression, awaitPromise: true, returnByValue: true,
        });
        if (result.exceptionDetails) {
          throw new Error(result.exceptionDetails.exception?.description || "Fehler in der Seite");
        }
        return result.result.value;
      },
      //  Ein Bild, entweder auf die Platte oder als Puffer zurück.
      async shot(file) {
        const result = await send("Page.captureScreenshot", { format: "png" });
        const bytes = Buffer.from(result.data, "base64");
        if (file) fs.writeFileSync(file, bytes);
        return bytes;
      },
    };

    await send("Page.enable");
    await send("Runtime.enable");
    return await work(page);
  } finally {
    if (socket) socket.close();
    chrome.kill();
    server.close();
  }
}
