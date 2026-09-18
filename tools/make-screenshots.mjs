/*  make-screenshots.mjs – die Bilder, die im README stehen.
 *
 *  Aufruf:
 *      node tools/make-screenshots.mjs
 *
 *  Legt examples/builder.webp und examples/icon-picker.webp an. Gebraucht
 *  werden ein Chromium und ffmpeg. Wozu: die alten Bilder im README zeigten
 *  eine Oberfläche, die es so nicht mehr gibt – wer sie von Hand macht, macht
 *  sie einmal und danach nie wieder.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { withBrowser, sleep, ROOT } from "./cdp.mjs";

const out = path.join(ROOT, "examples");
fs.mkdirSync(out, { recursive: true });

function toWebp(pngFile, webpFile, width) {
  execFileSync("ffmpeg", ["-y", "-i", pngFile,
    "-vf", `scale=${width}:-1:flags=lanczos`,
    "-c:v", "libwebp", "-quality", "80", webpFile], { stdio: "ignore" });
  fs.rmSync(pngFile, { force: true });
}

await withBrowser({ width: 1440, height: 900 }, async (page) => {
  await sleep(2500); // Schriften, Beispiel, erste Vorschau

  const builder = path.join(out, ".builder.png");
  await page.shot(builder);
  toWebp(builder, path.join(out, "builder.webp"), 1200);

  //  Für das zweite Bild muss der Symbolwähler offen sein: Werdegang
  //  aufklappen, erstes Symbolfeld anklicken.
  await page.run(`(function () {
    var section = [].filter.call(document.querySelectorAll("summary"), function (node) {
      return /^Career/.test(node.textContent.trim());
    })[0];
    if (section) section.click();
    return !!section;
  })()`);
  await sleep(600);
  await page.run(`(function () {
    var button = document.querySelector(".icon-button");
    if (button) { button.scrollIntoView({ block: "center" }); button.click(); }
    return !!button;
  })()`);
  await sleep(1200);

  const picker = path.join(out, ".icon-picker.png");
  await page.shot(picker);
  toWebp(picker, path.join(out, "icon-picker.webp"), 1200);
});

for (const name of ["builder.webp", "icon-picker.webp"]) {
  const file = path.join(out, name);
  console.log(`  ${name.padEnd(18)} ${(fs.statSync(file).size / 1024).toFixed(0)} kB`);
}
process.exit(0);
