/*  Misst den Abgleich mit Stellenanzeigen (js/jobmatch.js) an einem Korpus.
 *
 *  tests/fixtures/jobs/*.json sind ausgedachte Anzeigen. Zu jeder steht,
 *  was eine sorgfaeltige Recruiterin erwarten wuerde: "must" (harte
 *  Anforderungen), "nice" (Kann), "never" (darf nie als Anforderung
 *  erscheinen: Benefits, AGG/EEO, Firma, Ort, verneinte Dinge) und
 *  "alternatives" (Gruppen, von denen eine genuegt). Ein Eintrag "A|B"
 *  erlaubt zwei Schreibweisen fuer denselben Begriff.
 *
 *  Ein erwarteter Begriff gilt als gefunden, wenn ein Label der Engine ihm
 *  gleicht (Gross/klein, Umlaute, Gendern, Bindestriche, leichte Endungen
 *  wie in der Engine egal) oder eines das andere als ganzes Wort enthaelt.
 *
 *  Das ist eine Messung, kein Test: Exit-Code immer 0.
 *
 *    node tests/jobmatch-corpus.mjs            Tabelle, Summen, die 10 schlechtesten
 *    node tests/jobmatch-corpus.mjs --check    dasselbe, scheitert unter den Untergrenzen
 *    node tests/jobmatch-corpus.mjs <id> ...   Einzelheiten zu bestimmten Anzeigen
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const box = { console, Math, JSON, Date };
box.window = box;
vm.createContext(box);
for (const file of ["js/i18n.js", "js/model.js", "js/jobmatch.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), box, { filename: file });
}
const Match = box.RickCVJobMatch;
const Model = box.RickCVModel;

const dir = path.join(root, process.env.JOBS_DIR || "tests/fixtures/jobs");
const ads = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

/* ------------------------------------------------------------ Vergleich */

//  Gross/klein, Umlaute, Akzente, Gendern, Bindestriche egal.
const spaced = (text) => " " + Match._fold(Match._ungender(text)).replace(/[^a-z0-9+#]+/g, " ").trim() + " ";
//  "Deutschkenntnisse" und "Deutsch", "SAP-Erfahrung" und "SAP": dasselbe.
const compactOf = (text) => spaced(text).replace(/ /g, "").replace(/(kenntnisse|kenntnissen|erfahrung|erfahrungen)$/, "");
const stemmed = (text) => spaced(text).trim().split(" ").map(Match._stem).join(" ");

function same(expected, label) {
  const b = spaced(label);
  return String(expected).split("|").some((variant) => {
    const a = spaced(variant);
    if (a === b || compactOf(variant) === compactOf(label) || stemmed(variant) === stemmed(label)) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.trim().length >= 2 && long.includes(short);
  });
}

/* -------------------------------------------------------------- Messen */

function measure(ad) {
  const state = Model.createBase(ad.lang);
  const result = Match.analyse(ad.ad, state, []);
  const occ = [];
  result.requirements.forEach((req, r) => req.terms.forEach((t) =>
    occ.push({ label: t.label, level: req.level, group: t.group, req: r })));

  //  "zuverlässig" erwartet, "Zuverlässigkeit" als Eigenschaft geliefert:
  //  dieselbe Eigenschaft, nur in ihrer Grundform.
  const softOf = (term) => String(term).split("|").flatMap((variant) => [...Match._soft(variant, "de"), ...Match._soft(variant, "en")]);
  const expect = (list, level) => list.map((term) => {
    const hits = occ.filter((o) => same(term, o.label) || (o.level === "soft" && softOf(term).includes(o.label)));
    //  Persoenliche Eigenschaften stehen seit November 2026 in einer eigenen
    //  Gruppe ("soft") statt als Muss oder Kann – dort sind sie richtig.
    return { term, found: hits.length > 0, levelOk: hits.some((o) => o.level === level || o.level === "soft"),
             levels: [...new Set(hits.map((o) => o.level))] };
  });
  const must = expect(ad.must, "must");
  const nice = expect(ad.nice, "nice");

  const wanted = [...ad.must, ...ad.nice, ...(ad.alternatives || []).flat()];
  const labels = new Map();               // eindeutig nach Normalform
  occ.forEach((o) => {
    const key = compactOf(o.label);
    if (!labels.has(key)) labels.set(key, { label: o.label, levels: new Set() });
    labels.get(key).levels.add(o.level);
  });
  const neverHits = [];
  const noise = [];
  labels.forEach(({ label, levels }) => {
    const never = ad.never.find((n) => same(n, label));
    if (never) neverHits.push(`${label} (≙ ${never})`);
    else if (!wanted.some((w) => same(w, label))) noise.push({ label, task: !levels.has("must") && !levels.has("nice") });
  });

  const groups = (ad.alternatives || []).map((group) => {
    const per = group.map((member) => occ.filter((o) => same(member, o.label)));
    if (per.some((hits) => !hits.length)) return { group, state: "incomplete" };
    const ok = per[0].some((first) => per.every((hits) =>
      hits.some((o) => o.req === first.req && o.group === first.group)));
    return { group, state: ok ? "ok" : "split" };
  });

  return { ad, result, must, nice, neverHits, noise, groups };
}

const runs = ads.map(measure);

/* ------------------------------------------------------------- Ausgabe */

const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–").padStart(4);
const pad = (s, n) => String(s).padEnd(n);
const count = (list, key) => list.filter((x) => x[key]).length;

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (only.length) {
  runs.filter((r) => only.includes(r.ad.id)).forEach((r) => {
    console.log(`\n${r.ad.id}  (lang ${r.result.lang}, ${r.result.structured ? "gegliedert" : "ohne Gliederung"}, übersprungen: ${r.result.skipped.join(" | ") || "–"})`);
    r.result.requirements.forEach((req) => console.log(
      `  [${req.level.padEnd(4)}] ${req.text.slice(0, 70).padEnd(70)} → ${req.terms.map((t) => t.label + "#" + t.group).join(", ")}`));
    const fmt = (e) => `${e.found ? "✓" : "✗"} ${e.term}${e.found ? " (" + e.levels.join("/") + ")" : ""}`;
    console.log("  must:  " + r.must.map(fmt).join(", "));
    console.log("  nice:  " + (r.nice.map(fmt).join(", ") || "–"));
    console.log("  never: " + (r.neverHits.join(", ") || "–"));
    console.log("  noise: " + (r.noise.map((n) => n.label + (n.task ? "ᵗ" : "")).join(", ") || "–"));
    r.groups.forEach((g) => console.log(`  alt:   [${g.group.join(" | ")}] ${g.state}`));
  });
  process.exit(0);
}

console.log(`\nJobmatch-Korpus: ${runs.length} Anzeigen (${runs.filter((r) => r.ad.lang === "de").length} de, ${runs.filter((r) => r.ad.lang === "en").length} en), leerer Lebenslauf\n`);
console.log(pad("id", 22) + "  must  nice  lvl  never  noise(req/task)  alt");
const tot = { must: 0, mustF: 0, nice: 0, niceF: 0, lvl: 0, lvlOk: 0, never: 0, noiseReq: 0, noiseTask: 0, alt: 0, altOk: 0 };
runs.forEach((r) => {
  const found = [...r.must, ...r.nice].filter((e) => e.found);
  const lvlOk = count(found, "levelOk");
  const noiseTask = r.noise.filter((n) => n.task).length;
  const noiseReq = r.noise.length - noiseTask;
  const altOk = r.groups.filter((g) => g.state === "ok").length;
  tot.must += r.must.length; tot.mustF += count(r.must, "found");
  tot.nice += r.nice.length; tot.niceF += count(r.nice, "found");
  tot.lvl += found.length; tot.lvlOk += lvlOk;
  tot.never += r.neverHits.length; tot.noiseReq += noiseReq; tot.noiseTask += noiseTask;
  tot.alt += r.groups.length; tot.altOk += altOk;
  r.badness = 2 * (r.must.length - count(r.must, "found")) + (r.nice.length - count(r.nice, "found")) +
    (found.length - lvlOk) + 2 * r.neverHits.length + 0.25 * noiseReq;
  console.log(pad(r.ad.id, 22) + "  " +
    pad(`${count(r.must, "found")}/${r.must.length}`, 6) + pad(`${count(r.nice, "found")}/${r.nice.length}`, 6) +
    pad(`${lvlOk}/${found.length}`, 5) + pad(r.neverHits.length || "·", 7) +
    pad(`${noiseReq}/${noiseTask}`, 17) + (r.groups.length ? `${altOk}/${r.groups.length}` : "–"));
});

const byLang = (lang) => {
  const rs = runs.filter((r) => r.ad.lang === lang);
  const m = rs.reduce((a, r) => a + r.must.length, 0), mf = rs.reduce((a, r) => a + count(r.must, "found"), 0);
  const n = rs.reduce((a, r) => a + r.nice.length, 0), nf = rs.reduce((a, r) => a + count(r.nice, "found"), 0);
  return `${lang}: must ${pct(mf, m)}  nice ${pct(nf, n)}`;
};
console.log(`
Summe
  Recall must        ${pct(tot.mustF, tot.must)}  (${tot.mustF}/${tot.must})
  Recall nice        ${pct(tot.niceF, tot.nice)}  (${tot.niceF}/${tot.nice})
  Stufe richtig      ${pct(tot.lvlOk, tot.lvl)}  (${tot.lvlOk}/${tot.lvl} der gefundenen)
  never-Treffer      ${tot.never}   (Soll: 0)
  Rauschen           ${tot.noiseReq + tot.noiseTask}   (${tot.noiseReq} als Muss/Kann, ${tot.noiseTask} nur aus Aufgaben), ⌀ ${((tot.noiseReq + tot.noiseTask) / runs.length).toFixed(1)} je Anzeige
  Alternativen       ${tot.altOk}/${tot.alt} richtig gruppiert
  ${byLang("de")}   ${byLang("en")}`);

console.log("\nDie 10 schlechtesten (ᵗ = nur aus „Aufgaben“):");
[...runs].sort((a, b) => b.badness - a.badness).slice(0, 10).forEach((r) => {
  const missed = (list) => list.filter((e) => !e.found).map((e) => e.term).join(", ") || "–";
  const wrong = [...r.must, ...r.nice].filter((e) => e.found && !e.levelOk)
    .map((e) => `${e.term}→${e.levels.join("/")}`).join(", ");
  console.log(`\n  ${r.ad.id}${r.result.structured ? "" : " (ohne Gliederung)"}`);
  console.log(`    fehlt must: ${missed(r.must)}`);
  console.log(`    fehlt nice: ${missed(r.nice)}`);
  if (wrong) console.log(`    Stufe falsch: ${wrong}`);
  if (r.neverHits.length) console.log(`    never: ${r.neverHits.join(", ")}`);
  if (r.noise.length) console.log(`    Rauschen: ${r.noise.map((n) => n.label + (n.task ? "ᵗ" : "")).join(", ")}`);
  const bad = r.groups.filter((g) => g.state !== "ok");
  if (bad.length) console.log(`    Alternativen: ${bad.map((g) => `[${g.group.join("|")}] ${g.state}`).join("; ")}`);
});
console.log("");

//  Mit --check ist die Messung eine Untergrenze fuer die CI: erreichter
//  Stand am 3. November 2026. Wer die Erkennung verbessert, hebt sie an.
if (process.argv.includes("--check")) {
  const FLOOR = { must: 0.95, nice: 0.95, level: 0.96, never: 0, alternatives: 28, noise: 190 };
  const fails = [];
  if (tot.mustF / tot.must < FLOOR.must) fails.push(`Muss ${pct(tot.mustF, tot.must)} < ${FLOOR.must * 100} %`);
  if (tot.niceF / tot.nice < FLOOR.nice) fails.push(`Kann ${pct(tot.niceF, tot.nice)} < ${FLOOR.nice * 100} %`);
  if (tot.lvlOk / tot.lvl < FLOOR.level) fails.push(`Stufe ${pct(tot.lvlOk, tot.lvl)} < ${FLOOR.level * 100} %`);
  if (tot.never > FLOOR.never) fails.push(`${tot.never} verbotene Begriffe als Anforderung`);
  if (tot.altOk < FLOOR.alternatives) fails.push(`Alternativen ${tot.altOk} < ${FLOOR.alternatives}`);
  if (tot.noiseReq + tot.noiseTask > FLOOR.noise) fails.push(`Rauschen ${tot.noiseReq + tot.noiseTask} > ${FLOOR.noise}`);
  console.log(fails.length ? "FAIL " + fails.join("; ") + "\n" : "alles grün\n");
  process.exit(fails.length ? 1 : 0);
}
process.exit(0);
