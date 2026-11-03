/*  Prueft den Abgleich mit Stellenanzeigen (js/jobmatch.js) so, wie er
 *  benutzt wird: eine Anzeige im Stil echter Anzeigen und ein Lebenslauf,
 *  wie ihn jemand mit diesem Beruf tatsaechlich hat.
 *
 *  tests/fixtures/jobs-praxis/*.json – zu jeder Anzeige:
 *    must, nice      harte Anforderungen ("A|B": zwei Schreibweisen)
 *    alternatives    Gruppen, von denen eine genuegt
 *    soft            persoenliche Eigenschaften – eigene Gruppe, keine Luecke
 *    covered         was der Lebenslauf erfuellt (Status "found"/"alternative")
 *    gaps            was ihm wirklich fehlt (Status "missing")
 *    degree          Abschluesse: "Habe ich" darf sie nie unter Kenntnisse setzen
 *    never           darf nie als Anforderung erscheinen
 *    ok              darf erscheinen, muss aber nicht
 *  Alles andere, was als Anforderung erscheint, zaehlt als Rauschen: ein
 *  Begriff, mit dem die Person nichts anfangen kann ("Situationen", "Rat").
 *
 *    node tests/jobmatch-praxis.mjs            Tabelle und Einzelheiten
 *    node tests/jobmatch-praxis.mjs --check    scheitert bei jeder Abweichung
 *    node tests/jobmatch-praxis.mjs <id> ...   nur diese Anzeigen
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

const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter((arg) => !arg.startsWith("--"));
const dir = path.join(root, "tests/fixtures/jobs-praxis");
const ads = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
  .filter((ad) => !only.length || only.includes(ad.id));

const spaced = (text) => " " + Match._fold(Match._ungender(text)).replace(/[^a-z0-9+#]+/g, " ").trim() + " ";
const compactOf = (text) => spaced(text).replace(/ /g, "");
const stemmed = (text) => spaced(text).trim().split(" ").map(Match._stem).join(" ");
function same(expected, label) {
  const b = spaced(label);
  return String(expected).split("|").some((variant) => {
    const a = spaced(variant);
    if (a === b || compactOf(variant) === compactOf(label) || stemmed(variant) === stemmed(label)) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.trim().length >= 3 && long.includes(short);
  });
}

function stateFor(ad) {
  if (ad.cv === "example") return Model.createExample(ad.lang);
  const state = Model.createBase(ad.lang);
  const cv = ad.cv || {};
  Object.assign(state.contact, cv.contact || {});
  Object.assign(state.profile, cv.profile || {});
  state.events = (cv.events || []).map((event) => Object.assign({ description: [], list: [] }, event));
  for (const key of ["skills", "languages", "mobility"]) if (cv[key]) Object.assign(state[key], cv[key]);
  return state;
}

let failures = 0;
const totals = { must: [0, 0], nice: [0, 0], soft: [0, 0], covered: [0, 0], gaps: [0, 0], degree: [0, 0], noise: 0, never: 0 };

for (const ad of ads) {
  const result = Match.analyse(ad.ad, stateFor(ad), []);
  const occ = [];
  result.requirements.forEach((req) => req.terms.forEach((term) =>
    occ.push(Object.assign({ level: req.level, text: req.text }, term))));
  const hard = occ.filter((o) => o.level !== "soft");
  const soft = occ.filter((o) => o.level === "soft");
  const problems = [];

  const find = (term, list = hard) => list.filter((o) => same(term, o.label));
  for (const level of ["must", "nice"]) {
    for (const term of ad[level]) {
      totals[level][1]++;
      const hits = find(term);
      if (!hits.length) problems.push(`fehlt ${level}: ${term}`);
      else if (!hits.some((o) => o.level === level)) problems.push(`Stufe ${term}: ${[...new Set(hits.map((o) => o.level))].join("/")} statt ${level}`);
      else totals[level][0]++;
    }
  }
  for (const term of ad.soft) {
    totals.soft[1]++;
    if (find(term, soft).length) totals.soft[0]++;
    else problems.push(`fehlt persönlich: ${term}` + (find(term).length ? " (steht als Anforderung)" : ""));
  }
  for (const term of ad.covered) {
    totals.covered[1]++;
    const hits = find(term);
    if (hits.some((o) => o.status === "found" || o.status === "alternative")) totals.covered[0]++;
    else problems.push(`nicht erkannt, obwohl im Lebenslauf: ${term}` + (hits.length ? ` (${hits.map((o) => o.status).join("/")})` : " (kein Begriff)"));
  }
  for (const term of ad.gaps) {
    totals.gaps[1]++;
    const hits = find(term);
    if (hits.some((o) => o.status === "missing")) totals.gaps[0]++;
    else problems.push(`Lücke nicht gemeldet: ${term}` + (hits.length ? ` (${hits.map((o) => o.status).join("/")})` : " (kein Begriff)"));
  }
  for (const term of ad.degree) {
    totals.degree[1]++;
    const hits = find(term);
    if (hits.length && hits.every((o) => o.kind === "degree")) totals.degree[0]++;
    else problems.push(`kein Abschluss: ${term}` + (hits.length ? ` (${hits.map((o) => o.kind || "?").join("/")})` : " (kein Begriff)"));
  }
  const expected = [...ad.must, ...ad.nice, ...ad.alternatives.flat(), ...ad.ok, ...ad.covered, ...ad.gaps, ...ad.degree];
  for (const o of hard) {
    //  Unter "Aufgaben" zeigt der Abgleich nur, was der Lebenslauf schon
    //  belegt – das ist ein Beleg, kein Rauschen.
    if (o.level === "task" && (o.status === "found" || o.status === "similar")) continue;
    if (ad.never.some((term) => same(term, o.label))) {
      totals.never++;
      problems.push(`verboten: ${o.label} (${o.level})`);
    } else if (!expected.some((term) => same(term, o.label))) {
      totals.noise++;
      problems.push(`Rauschen: ${o.label} (${o.level}, aus „${o.text.slice(0, 50)}“)`);
    }
  }
  if (problems.length) failures += problems.length;
  console.log(`${problems.length ? "✗" : "✓"} ${ad.id}`);
  for (const problem of problems) console.log("    " + problem);
}

const pct = ([a, b]) => (b ? Math.round((a / b) * 100) + " %" : "–");
console.log(`\nMuss ${pct(totals.must)} · Kann ${pct(totals.nice)} · Persönlich ${pct(totals.soft)} · ` +
  `erkannt ${pct(totals.covered)} · Lücken ${pct(totals.gaps)} · Abschlüsse ${pct(totals.degree)} · ` +
  `Rauschen ${totals.noise} · Verbotenes ${totals.never}`);
if (check && failures) {
  console.log(`\n${failures} Abweichungen`);
  process.exit(1);
}
console.log(check ? "\nalles grün\n" : "");
