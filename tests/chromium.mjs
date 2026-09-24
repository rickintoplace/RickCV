/*  Findet ein Chromium für die Tests, die ein Dokument rendern oder drucken.
 *
 *  Reihenfolge – dieselbe wie in tools/chromium.py:
 *
 *    1. die Umgebungsvariable CHROME, wenn sie gesetzt ist
 *    2. ein Chromium oder Chrome im PATH
 *    3. die üblichen Installationsorte unter macOS und Windows
 *
 *  Früher suchten die Tests nur im PATH. Auf einem Mac liegt Chrome aber in
 *  /Applications – die Tests übersprangen dann ihren wichtigsten Teil und
 *  meldeten trotzdem "alles grün".
 *
 *  Überspringen ist nur noch erlaubt, solange niemand es verbietet: mit
 *  REQUIRE_BROWSER=1 (so läuft die CI) oder CI=true ist ein fehlendes
 *  Chromium ein Fehler.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NAMES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
               "chrome", "msedge"];

const PLACES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  path.join(os.homedir(), "Applications/Chromium.app/Contents/MacOS/Chromium"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function runnable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

//  Ohne Shell suchen: das spart eine Warnung und eine Angriffsfläche.
export function findChromium() {
  const own = (process.env.CHROME || "").trim();
  if (own) return runnable(own) ? own : null;

  const exts = process.platform === "win32" ? ["", ".exe"] : [""];
  const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const name of NAMES) {
      for (const ext of exts) {
        const candidate = path.join(dir, name + ext);
        if (runnable(candidate)) return candidate;
      }
    }
  }
  return PLACES.find(runnable) || null;
}

export function browserRequired() {
  const flag = (name) => /^(1|true|yes)$/i.test(process.env[name] || "");
  return flag("REQUIRE_BROWSER") || flag("CI");
}
