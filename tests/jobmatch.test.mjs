/*  Prüft den Abgleich mit Stellenanzeigen (js/jobmatch.js).
 *
 *  Jede Anzeige hier ist ausgedacht. Geprüft wird, was eine Person am
 *  Ergebnis sieht: welche Begriffe als Anforderung erkannt werden, welche
 *  nicht (Füllwörter, "Wir bieten", AGG-Hinweis), ob Muss und Kann stimmen
 *  und ob der Lebenslauf sie belegt. Die ersten Fälle sind die Schwächen,
 *  die wir bei Reactive Resume gefunden haben – sie dürfen hier nie
 *  auftreten.
 *
 *  Aufruf aus dem Projektverzeichnis:   node tests/jobmatch.test.mjs
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

let fails = 0;
const ok = (cond, label, extra) => {
  if (cond) console.log("  ok   " + label);
  else { fails++; console.log("  FAIL " + label + (extra === undefined ? "" : " → " + extra)); }
};

function resume(fill) {
  const state = Model.createBase("de");
  fill(state);
  return state;
}

const all = (result) => result.requirements.flatMap((req) => req.terms.map((term) => ({ ...term, level: req.level })));
const labels = (result) => all(result).map((term) => term.label);
const term = (result, label) => all(result).find((t) => t.label.toLowerCase() === label.toLowerCase());
const show = (result) => all(result).map((t) => `${t.label}:${t.level}:${t.status}`).join(", ");

/* ------------------------------------------------------------------ */
console.log("\n— Normalisieren —");
//  Gendern auf jede Art – in der Anzeige und im Lebenslauf ("Köchin").
{
  const genderCases = [
 ["Pfleger:in","Pfleger"],["Erzieher*innen","Erzieher"],["Kauffrau (m/w/d)","Kaufmann"],["Entwickler/-in","Entwickler"],
 ["Pfleger_in","Pfleger"],["Pfleger·innen","Pfleger"],["Pfleger•innen","Pfleger"],["Pfleger/innen","Pfleger"],["PflegerInnen","Pfleger"],
 ["Pfleger(in)","Pfleger"],["Student(inn)en","Studenten"],["Ärzt*in","Arzt"],["Ärzt:innen","Arzt"],["Köch*in","Koch"],["Kolleg*in","Kollege"],
 ["Kolleg:innen","Kollegen"],["Kund:innen","Kunden"],["Fachärzt:in","Facharzt"],["Ärztinnen und Ärzte","Ärzte"],["Köchin/Koch","Koch"],["Koch/Köchin","Koch"],
 ["Arzt/Ärztin","Arzt"],["Erzieherin oder Erzieher","Erzieher"],["Lehrer und Lehrerinnen","Lehrer"],["Kauffrau/-mann","Kaufmann"],["Kaufmann/-frau","Kaufmann"],
 ["Kaufmann / Kauffrau","Kaufmann"],["Mitarbeitende","Mitarbeiter"],["Studierende","Studenten"],["Köchin","Koch"],["Ärztin","Arzt"],["Psychologin","Psychologe"],
 ["Altenpfleger/in","Altenpfleger"],["Gesundheits- und Krankenpfleger/in","Gesundheits- und Krankenpfleger"],["staatlich anerkannte/r Erzieher/in","staatlich anerkannte Erzieher"],
 ["Koch (w/m/div)","Koch"],["Koch (d/m/w)","Koch"],["Koch m/w/d","Koch"],["Koch (gn)","Koch"],["Koch (all genders)","Koch"],["Koch (m/f/x)","Koch"],
 ["SchülerInnenvertretung","Schülervertretung"],["LinkedIn","LinkedIn"],["Berlin","Berlin"],["Termin","Termin"],["Disziplin","Disziplin"],["Medizin","Medizin"],
 ["Hotelfachfrau","Hotelfachmann"],["Bankkauffrau","Bankkaufmann"],["Kaufleute","Kaufleute"],["Kund*innen","Kunden"],["Mitarbeiter*innen","Mitarbeiter"],
 ["Anwält*in","Anwalt"],["Rechtsanwältin","Rechtsanwalt"],["Lehrer*in","Lehrer"],["Elektroniker*in","Elektroniker"],["Instagram","Instagram"],["Login","Login"],
 ["eine/n","eine"],["Ihre/n","Ihre"],["jede*r","jede"],["Verkäufer:in","Verkäufer"],["Bürokauffrau","Bürokaufmann"],["Beamtin","Beamter"],
 ["Patientinnen und Patienten","Patienten"],["Kollegin","Kollege"],["Kundin","Kunde"],["Pädagog*in","Pädagoge"],["Sozialpädagogin","Sozialpädagoge"],
];
  const wrong = genderCases.filter(([given, want]) => Match._ungender(given).replace(/\s+/g, " ").trim() !== want)
    .map(([given]) => `${given} → ${Match._ungender(given).replace(/\s+/g, " ").trim()}`);
  ok(!wrong.length, `${genderCases.length} Genderformen auf die Grundform`, wrong.join(" · "));
}
ok(Match._fold("Größe") === "groesse", "Umlaute und ß ausgeschrieben");
ok(Match._language("Wir suchen dich und dein Team für die Station") === "de", "Deutsch erkannt");
ok(Match._language("We are looking for an engineer to join our team") === "en", "Englisch erkannt");

/* ------------------------------------------------------------------ */
console.log("\n— Was Reactive Resume falsch macht —");
const pflegeAd = `Pflegefachkraft (m/w/d) Intensivstation
Klinikum Süd

Ihre Aufgaben
- Pflege und Betreuung von Patientinnen und Patienten auf der Intensivstation
- Pflegedokumentation und Wundversorgung

Ihr Profil
- Abgeschlossene Ausbildung als Pflegefachfrau/-mann oder Gesundheits- und Krankenpfleger:in
- Erfahrung im Projekt-Management
- Kenntnisse in Python oder R
- Keine Java-Kenntnisse nötig
- PMP-Zertifizierung

Wir bieten
- 30 Tage Urlaub, betriebliche Altersvorsorge, JobRad
- Vergütung nach TVöD

Schwerbehinderte Bewerberinnen und Bewerber werden bei gleicher Eignung bevorzugt.`;

const pflegeCv = resume((s) => {
  s.contact.role = "Gesundheits- und Krankenpflegerin";
  s.events = [{ title: "Pflegefachkraft", company: "Uniklinik", place: "Köln", sectionId: "experience",
    description: ["Auf der Intensivstation, Pflegedokumentation"], list: ["Projektmanagement der Umstellung"] }];
  s.skills.items = [{ name: "Python", rank: 0 }, { name: "Projektleitung", rank: 0 }];
});
const pflege = Match.analyse(pflegeAd, pflegeCv, []);

ok(!labels(pflege).some((l) => /^(und|im|von|für|ihr profil|wir bieten)$/i.test(l)),
   "keine Füllwörter als Begriff", labels(pflege).join(", "));
ok(!labels(pflege).some((l) => /tvöd|jobrad|urlaub|altersvorsorge/i.test(l)),
   "„Wir bieten“ wird nicht ausgewertet", labels(pflege).join(", "));
ok(pflege.skipped.includes("Wir bieten"), "„Wir bieten“ steht als nicht ausgewertet da", pflege.skipped.join(","));
ok(!labels(pflege).some((l) => /schwerbehindert|bewerber/i.test(l)), "AGG-Hinweis zählt nicht");
ok(!labels(pflege).some((l) => /m\/w\/d/i.test(l)), "„m/w/d“ ist kein Begriff");
ok(term(pflege, "Projekt-Management") && term(pflege, "Projekt-Management").status === "found",
   "Projekt-Management findet Projektmanagement", show(pflege));
ok(term(pflege, "Intensivpflege") && term(pflege, "Intensivpflege").status === "found",
   "„die Intensivstation“ findet „auf der Intensivstation“");
ok(term(pflege, "Pflegefachkraft") && term(pflege, "Pflegefachkraft").status === "found",
   "Pflegefachfrau/-mann oder Krankenpfleger:in → Pflegefachkraft belegt");
ok(term(pflege, "R") && term(pflege, "R").status === "alternative",
   "„Python oder R“: Python genügt, R ist die Alternative", show(pflege));
ok(!labels(pflege).includes("Java"), "„Keine Java-Kenntnisse nötig“ fordert kein Java");
ok(term(pflege, "PMP") && term(pflege, "PMP").status === "missing",
   "PMP ist ein Zertifikat – Projektleitung belegt es nicht");

/* ------------------------------------------------------------------ */
console.log("\n— Muss und Kann aus den eigenen Worten —");
const mixedAd = `Ihr Profil
- Sehr gute Deutschkenntnisse (C1), Englisch von Vorteil
- Führerschein Klasse B zwingend erforderlich
- Erfahrung mit SAP wünschenswert

Nice to have
- Kenntnisse in Power BI`;
const mixed = Match.analyse(mixedAd, resume((s) => {
  s.languages.items = [{ name: "Deutsch", level: "Muttersprache" }];
  s.skills.items = [{ name: "Fahrerlaubnis Klasse B", rank: 0 }];
}), []);
ok(term(mixed, "Deutsch") && term(mixed, "Deutsch").level === "must", "Deutsch ist Muss", show(mixed));
ok(term(mixed, "Englisch") && term(mixed, "Englisch").level === "nice", "Englisch „von Vorteil“ ist Kann");
ok(term(mixed, "SAP") && term(mixed, "SAP").level === "nice", "SAP „wünschenswert“ ist Kann");
ok(term(mixed, "Power BI") && term(mixed, "Power BI").level === "nice", "Abschnitt „Nice to have“ ist Kann");
ok(term(mixed, "Führerschein Klasse B") && term(mixed, "Führerschein Klasse B").level === "must",
   "„zwingend erforderlich“ ist Muss");
ok(term(mixed, "Führerschein Klasse B").status === "found", "„Fahrerlaubnis Klasse B“ belegt den Führerschein",
   term(mixed, "Führerschein Klasse B").status);
ok(!labels(mixed).includes("Klasse"), "„Klasse“ zählt nicht extra");
ok(term(mixed, "Deutsch").status === "found", "Deutsch aus den Sprachen belegt");

/* ------------------------------------------------------------------ */
console.log("\n— Englische Anzeige —");
const backendAd = `Senior Backend Engineer
Acme Payments · Remote

What you'll do
• Design and operate services in Go and PostgreSQL
• Own our CI/CD pipeline and Kubernetes clusters on AWS

What we're looking for
• 5+ years of experience with backend development in Go, Java or Kotlin
• Strong knowledge of SQL and distributed systems
• Experience with Terraform is a plus
• No prior payments experience required

Benefits
• 30 days holiday`;
const backend = Match.analyse(backendAd, resume((s) => {
  s.skills.items = [{ name: "Golang", rank: 0 }, { name: "Postgres", rank: 0 }, { name: "k8s", rank: 0 },
                    { name: "Amazon Web Services", rank: 0 }];
  s.events = [{ title: "Engineer", company: "X", sectionId: "experience", description: [],
                list: ["Built continuous integration pipelines", "Designed distributed systems"] }];
}), []);
ok(backend.lang === "en", "als Englisch erkannt");
ok(term(backend, "Go") && term(backend, "Go").status === "found", "Golang belegt Go", show(backend));
ok(term(backend, "PostgreSQL").status === "found", "Postgres belegt PostgreSQL");
ok(term(backend, "Kubernetes").status === "found", "k8s belegt Kubernetes");
ok(term(backend, "AWS").status === "found", "Amazon Web Services belegt AWS");
ok(term(backend, "CI/CD").status === "found", "continuous integration belegt CI/CD");
ok(term(backend, "distributed systems") && term(backend, "distributed systems").status === "found",
   "„distributed systems“ als Phrase erkannt und belegt");
const goGroup = all(backend).filter((t) => ["Go", "Java", "Kotlin"].includes(t.label) && t.level === "must");
ok(goGroup.length === 3 && new Set(goGroup.map((t) => t.group)).size === 1,
   "„Go, Java or Kotlin“ ist eine Auswahl", goGroup.map((t) => t.label + "#" + t.group).join(" "));
ok(goGroup.filter((t) => t.status === "alternative").length === 2, "mit Go sind Java und Kotlin erledigt");
ok(term(backend, "Terraform").level === "nice", "„is a plus“ ist Kann");
ok(!labels(backend).some((l) => /payment/i.test(l)), "„No prior payments experience required“ fordert nichts");
ok(!labels(backend).some((l) => /holiday/i.test(l)), "Benefits nicht ausgewertet");

/* ------------------------------------------------------------------ */
console.log("\n— Kurze Fachbegriffe —");
const shortAd = `Anforderungen
- Programmierkenntnisse in C oder C++
- Erfahrung mit R und SQL`;
const short = Match.analyse(shortAd, resume((s) => {
  s.skills.items = [{ name: "C++", rank: 0 }, { name: "R (tidyverse)", rank: 0 }];
}), []);
ok(term(short, "C") && term(short, "C++"), "C und C++ beide erkannt", labels(short).join(", "));
ok(term(short, "C++").status === "found" && term(short, "C").status === "alternative",
   "C++ belegt, C als Alternative erledigt", show(short));
ok(term(short, "R") && term(short, "R").status === "found", "R wird erkannt und belegt", show(short));
ok(term(short, "SQL") && term(short, "SQL").status === "missing", "SQL fehlt");
const goVerb = Match.analyse("Your profile\n- You go the extra mile for customers", resume(() => {}), []);
ok(!labels(goVerb).includes("Go"), "„go the extra mile“ ist keine Programmiersprache", labels(goVerb).join(","));

/* ------------------------------------------------------------------ */
console.log("\n— Verwandt ist nicht gleich —");
const softAd = `Das bringst du mit
- Teamfähigkeit und Kundenbetreuung
- Erfahrung in der Buchhaltung`;
const soft = Match.analyse(softAd, resume((s) => {
  s.profile.text = "Ich arbeite gern im Team (Teamarbeit) und habe Kundenservice gemacht.";
  s.events = [{ title: "Sachbearbeiterin", company: "Firma", sectionId: "experience",
                description: ["Finanzbuchhaltung und Mahnwesen"], list: [] }];
}), []);
ok(term(soft, "Kundenbetreuung").status === "similar", "Kundenservice ist „anders formuliert“, kein Treffer", show(soft));
//  Persoenliche Eigenschaften stehen fuer sich, nicht als Luecke.
ok(all(soft).some((t) => t.label === "Teamfähigkeit" && t.level === "soft" && t.status === "found"),
   "Teamfähigkeit ist eine Eigenschaft, „Teamarbeit“ im Profil zeigt sie", show(soft));
ok(term(soft, "Kundenbetreuung").status === "similar", "Kundenservice ist „anders formuliert“");
ok(term(soft, "Buchhaltung").status === "found", "Finanzbuchhaltung belegt Buchhaltung");
ok(term(soft, "Teamfähigkeit").evidence.includes("Team"), "mit Fundstelle", term(soft, "Teamfähigkeit").evidence);
ok(term(soft, "Teamfähigkeit").path === "profile.text", "Fundstelle führt zum Profiltext", term(soft, "Teamfähigkeit").path);

/* ------------------------------------------------------------------ */
console.log("\n— Nur im Anschreiben, ausgeblendet —");
const letterCv = resume((s) => {
  s.settings.showCoverLetter = true;
  s.coverLetter.paragraphs = ["Mit Excel arbeite ich täglich."];
});
const letter = Match.analyse("Anforderungen\n- Sehr gute Excel-Kenntnisse\n- Erfahrung mit DATEV", letterCv, ["DATEV"]);
ok(term(letter, "Excel") && term(letter, "Excel").status === "letter", "nur im Anschreiben", show(letter));
ok(term(letter, "DATEV").status === "dismissed", "„trifft nicht zu“ bleibt ausgeblendet");

/* ------------------------------------------------------------------ */
console.log("\n— Ohne Gliederung —");
const plain = Match.analyse(`Wir suchen eine Verkäuferin für unsere Bäckerei in Leipzig.
Du hast Erfahrung im Verkauf und arbeitest gern im Schichtdienst.
Ein Gesundheitszeugnis ist Voraussetzung.`, resume((s) => {
  s.events = [{ title: "Verkäuferin", company: "Bäckerei Klein", sectionId: "experience",
                description: ["Verkauf an der Theke, Schichtdienst"], list: [] }];
}), []);
ok(!plain.structured, "keine Gliederung erkannt – und das wird gesagt");
ok(term(plain, "Schichtdienst") && term(plain, "Schichtdienst").status === "found", "Schichtdienst belegt", show(plain));
ok(term(plain, "Gesundheitszeugnis") && term(plain, "Gesundheitszeugnis").status === "missing",
   "Gesundheitszeugnis fehlt");
ok(term(plain, "Gesundheitszeugnis").level === "must", "„ist Voraussetzung“ ist Muss");

/* ------------------------------------------------------------------ */
console.log("\n— Weitere Berufe —");
const kitaAd = `Erzieher*in (m/w/d) in Teilzeit

Deine Aufgaben
- Pädagogische Begleitung von Kindern zwischen 1 und 6 Jahren
- Elternarbeit und Entwicklungsdokumentation

Dein Profil
- Staatlich anerkannte*r Erzieher*in oder Kindheitspädagog*in
- Erfahrung in der Krippenpädagogik von Vorteil
- Erste-Hilfe-Kurs am Kind`;
const kita = Match.analyse(kitaAd, resume((s) => {
  s.contact.role = "Erzieherin";
  s.events = [{ title: "Erzieherin", company: "Kita Sonnenschein", sectionId: "experience",
                description: ["Elternarbeit, Portfolioarbeit"], list: ["Erste Hilfe am Kind (2024)"] }];
}), []);
ok(term(kita, "Erzieher") && term(kita, "Erzieher").status === "found", "Erzieher*in findet Erzieherin", show(kita));
ok(term(kita, "Elternarbeit") && term(kita, "Elternarbeit").status === "found", "Elternarbeit belegt");
ok(term(kita, "Krippenpädagogik") && term(kita, "Krippenpädagogik").level === "nice", "Krippenpädagogik ist Kann");
ok(term(kita, "Erste Hilfe") && term(kita, "Erste Hilfe").status === "found", "Erste-Hilfe-Kurs belegt");
ok(!labels(kita).some((l) => /^(kindern|jahren|teilzeit)$/i.test(l)), "keine Allerweltswörter", labels(kita).join(", "));

const salesAd = `Your role
- Win new B2B customers in the DACH region
- Maintain our Salesforce CRM

Your profile
- 3+ years in B2B sales
- Fluent German and English
- Experience with HubSpot or Salesforce`;
const sales = Match.analyse(salesAd, resume((s) => {
  s.languages.items = [{ name: "Deutsch", level: "C2" }, { name: "Englisch", level: "C1" }];
  s.skills.items = [{ name: "HubSpot", rank: 0 }];
  s.events = [{ title: "Account Executive", company: "Y", sectionId: "experience",
                description: ["Vertrieb an Geschäftskunden"], list: [] }];
}), []);
ok(term(sales, "German").status === "found" && term(sales, "English").status === "found",
   "German/English belegt durch Deutsch/Englisch", show(sales));
ok(term(sales, "Salesforce") && term(sales, "HubSpot") && term(sales, "HubSpot").status === "found",
   "HubSpot belegt", show(sales));
ok(all(sales).some((t) => t.label === "Salesforce" && t.level === "must" && t.status === "alternative"),
   "„HubSpot or Salesforce“: Salesforce erledigt");
ok(term(sales, "Sales") && ["found", "similar"].includes(term(sales, "Sales").status),
   "„sales“ findet „Vertrieb“", show(sales));

/* ------------------------------------------------------------------ */
console.log("\n— Aus der Korpusmessung (tests/jobmatch-corpus.mjs) —");
{
  const empty = resume(() => {});
  const ce = Match.analyse("Ihr Profil\n- Führerschein Klasse CE mit Modul 95", empty, []);
  ok(labels(ce).includes("Führerschein Klasse CE") && !labels(ce).includes("Führerschein Klasse B"),
     "Klasse CE wird nicht zu Klasse B", labels(ce).join(", "));
  const ceCv = resume((s) => { s.skills.items = [{ name: "Führerschein Klasse CE", rank: 0 }]; });
  const needB = Match.analyse("Ihr Profil\n- Führerschein Klasse B", ceCv, []);
  ok(term(needB, "Führerschein Klasse B").status === "found", "wer CE hat, hat auch B", show(needB));
  const next = Match.analyse("Requirements\n- Experience with Next.js or Storybook", empty, []);
  ok(!labels(next).includes("JavaScript"), "Next.js ist kein JavaScript-Treffer", labels(next).join(", "));
  const tails = Match.analyse("Ihr Profil\n- Mehrjährige Berufserfahrung und Führungserfahrung", empty, []);
  ok(!labels(tails).some((l) => /^(Berufs|Führungs)$/.test(l)), "„Berufserfahrung“ wird nicht zu „Berufs“", labels(tails).join(", "));
  const similarAd = Match.analyse("Ihr Profil\n- Studium der Wirtschaftsinformatik, Statistik, Mathematik oder vergleichbar", empty, []);
  ok(new Set(all(similarAd).map((t) => t.group)).size === 1, "„… oder vergleichbar“ ist eine Auswahl", show(similarAd));
  const lean = Match.analyse("Ihr Profil\n- Erfahrung mit Lean Management und Six Sigma", empty, []);
  ok(labels(lean).includes("Lean Management") && !labels(lean).includes("Management"),
     "„Lean Management“ bleibt ein Begriff", labels(lean).join(", "));
  const prose = Match.analyse(`Wir suchen ab sofort Reinigungskräfte in Chemnitz. Arbeitszeit montags bis freitags.
Wichtig sind uns Zuverlässigkeit und Sorgfalt sowie Grundkenntnisse in Deutsch. Ein Führerschein Klasse B ist von Vorteil.
Wir zahlen Tariflohn und gewähren anteilig Urlaub.
Rufen Sie an: Frau Petra Schöne, 0371 555 1212.`, empty, []);
  ok(labels(prose).includes("Deutsch") && labels(prose).includes("Zuverlässigkeit"), "Fließtext: Anforderungen erkannt", labels(prose).join(", "));
  ok(!labels(prose).some((l) => /chemnitz|urlaub|tarif|petra|schöne/i.test(l)), "Fließtext: Ort, Lohn, Kontakt bleiben draußen");
  ok(term(prose, "Führerschein Klasse B").level === "nice" && term(prose, "Deutsch").level === "must",
     "„von Vorteil“ im zweiten Satz gilt nur dort", show(prose));
  const eeo = Match.analyse("Requirements\n- Strong knife skills\n\nWe are an equal opportunity employer without regard to race, color, religion, sex or national origin.", empty, []);
  ok(labels(eeo).some((l) => /knife skills/i.test(l)), "„knife skills“ erkannt", labels(eeo).join(", "));
  ok(!labels(eeo).some((l) => /religion|color|origin/i.test(l)), "EEO-Hinweis zählt nicht");
}

/* ------------------------------------------------------------------ */
console.log("\n— Robustheit —");
ok(Match.analyse("", resume(() => {}), []).requirements.length === 0, "leere Anzeige");
const huge = ("- Kenntnisse in Excel und SAP\n").repeat(400);
const started = Date.now();
Match.analyse("Ihr Profil\n" + huge, resume(() => {}), []);
ok(Date.now() - started < 1500, "400 Zeilen in unter 1,5 s", (Date.now() - started) + " ms");
ok(Match.titleOf("Pflegefachkraft (m/w/d)\nKlinikum") === "Pflegefachkraft", "Titel ohne (m/w/d)",
   Match.titleOf("Pflegefachkraft (m/w/d)\nKlinikum"));

/* ------------------------------------------------------------------ */
console.log("\n— Abschlüsse auf einer Leiter —");
{
  //  [Satz in der Anzeige, Abschluss im Lebenslauf, erfüllt?]
  const ladder = [
    ["Du bringst mindestens einen Hauptschulabschluss mit", "Abitur", true],
    ["Mindestens Hauptschulabschluss", "Allgemeine Hochschulreife", true],
    ["Mittlere Reife oder höher", "Hauptschulabschluss", false],
    ["Realschulabschluss", "Mittlerer Schulabschluss (MSA)", true],
    ["Mittlerer Schulabschluss", "Fachoberschulreife", true],
    ["Fachhochschulreife", "Matura", true],
    ["Abitur", "Fachabitur", false],
    ["Abitur oder Fachabitur", "Fachabitur", true],
    ["Allgemeine Hochschulreife", "Maturität (Gymnasium Bern)", true],
    ["Hochschulreife", "A-Levels", true],
    ["Abgeschlossenes Studium mit technischer oder betriebswirtschaftlicher Ausrichtung", "M.Sc. Wirtschaftsinformatik", true],
    ["Abgeschlossenes Studium", "B.A. Soziale Arbeit", true],
    ["Abgeschlossenes Studium", "Diplom-Kaufmann", true],
    ["Abgeschlossenes Studium", "Dipl.-Ing. (FH) Maschinenbau", true],
    ["Master oder vergleichbarer Abschluss", "Dipl.-Ing. Elektrotechnik", true],
    ["Master", "Bachelor of Science Informatik", false],
    ["Master", "Magister Artium Germanistik", true],
    ["Master", "Zweites Staatsexamen Jura", true],
    ["Abgeschlossene Promotion", "Dr. rer. nat. Chemie", true],
    ["Abgeschlossene Promotion", "Master of Science Chemie", false],
    ["Promotion in Physik", "PhD in Physics", true],
    ["Habilitation", "Promotion (Dr. phil.)", false],
    ["Abgeschlossenes Hochschulstudium oder vergleichbare Qualifikation", "Industriemeister Metall (IHK), Meisterbrief", true],
    ["Abgeschlossenes Hochschulstudium", "Industriemeister Metall (IHK), Meisterbrief", false],
    ["Abgeschlossene Berufsausbildung", "Gesellenbrief Tischler", true],
    ["Abgeschlossene Berufsausbildung", "Lehrabschluss Einzelhandel (Österreich)", true],
    ["Abgeschlossene Berufsausbildung", "Angefangene Ausbildung zum Koch", false],
    ["Abgeschlossenes Studium", "Studium der Informatik (läuft)", false],
    ["High school diploma or GED", "GED", true],
    ["Bachelor's degree required", "Associate Degree in Nursing", false],
    ["Bachelor's degree required", "MBA", true],
    ["Allgemeine Hochschulreife", "Reifeprüfung (Österreich)", true],
    ["Abitur", "International Baccalaureate (IB Diploma)", true],
    ["Hochschulzugangsberechtigung", "Abitur", true],
    ["Fachhochschulreife", "Berufsmaturität (Schweiz)", true],
    ["Mittlere Reife", "Erweiterter Sekundarabschluss I", true],
    ["Hauptschulabschluss", "Berufsbildungsreife", true],
    ["Mittlere Reife", "Berufsbildungsreife", false],
    ["Master", "Diplom-Ingenieur (TU)", true],
    ["Master", "Diplom (FH) Sozialwesen", false],
    ["Abgeschlossene Promotion", "Habilitation (venia legendi)", true],
    ["Habilitation", "Habilitation in Neuerer Geschichte", true],
    ["Zweites Staatsexamen oder Master of Education", "Master of Education", true],
    ["MSc or PhD in Statistics", "M.Sc. Statistik", true],
  ];
  const wrong = ladder.filter(([ad, cv, met]) => {
    const result = Match.analyse("Dein Profil\n- " + ad, resume((s) => {
      s.events = [{ title: cv, company: "", sectionId: "education", description: [], list: [],
                    present: /läuft/.test(cv) }];
    }), []);
    const degree = all(result).filter((t) => t.kind === "degree");
    const ok = degree.length > 0 && degree.some((t) => t.status === "found" || t.status === "alternative");
    return ok !== met;
  }).map(([ad, cv, met]) => `„${ad}“ mit „${cv}“ sollte ${met ? "" : "nicht "}erfüllt sein`);
  ok(!wrong.length, `${ladder.length} Paare aus Anzeige und Lebenslauf`, wrong.join(" · "));
}

console.log("\n— Bewerbungsteil ohne Überschrift —");
{
  const ad = "Ausbildung zur Kauffrau für Büromanagement (m/w/d)\n\nDas bringst du mit\n- Realschulabschluss\n- sicheren Umgang mit Word und Excel\n" +
    "- Freude am Kontakt mit Menschen\n\nBewerbung bis 31. Januar 2027 als PDF an Frau Petra Hahn, Personalabteilung:\n" +
    "ausbildung@brandt-haustechnik.example\nBrandt Haustechnik GmbH, Industriestraße 8, 37079 Göttingen";
  const found = labels(Match.analyse(ad, resume(() => {}), []));
  const noise = found.filter((label) => /Januar|Hahn|Personal|Brandt|Industrie|Göttingen/.test(label));
  ok(!noise.length, "Frist, Ansprechperson und Anschrift sind keine Anforderungen", noise.join(", "));
  ok(found.includes("Word") && found.includes("Excel"), "die Anforderungen davor bleiben", found.join(", "));
  ok(found.includes("Kontaktfreude") && !found.includes("Kontakt"), "„Freude am Kontakt mit Menschen“ ist Persönliches", found.join(", "));
  const agg = labels(Match.analyse("Dein Profil\n- SAP\nBewerbungen von Menschen mit Schwerbehinderung sind willkommen.\nDein Profil\n- Excel",
    resume(() => {}), []));
  ok(agg.includes("Excel"), "der AGG-Satz öffnet keinen Bewerbungsteil", agg.join(", "));
}

console.log("\n— Abschluss in Arbeit —");
{
  const pupil = resume((s) => {
    s.events = [{ title: "Oberschule, zurzeit 10. Klasse", company: "Oberschule am Rosengarten", sectionId: "education",
                  start: "08/2020", present: true, description: [],
                  list: ["Angestrebter Abschluss: Realschulabschluss im Sommer 2027"] }];
  });
  const status = (ad, state = pupil) => (all(Match.analyse(ad, state, [])).find((t) => t.kind === "degree") || {}).status;
  ok(status("Dein Profil\n- Realschulabschluss (oder du machst ihn gerade)") === "pending",
     "„oder du machst ihn gerade“: kommt noch, keine Lücke");
  ok(status("Dein Profil\n- voraussichtlicher Realschulabschluss bis zum Ausbildungsbeginn") === "pending",
     "„voraussichtlich … bis zum Ausbildungsbeginn“");
  ok(status("Ausbildung zum Elektroniker (m/w/d)\n\nDein Profil\n- Mittlere Reife") === "pending",
     "Ausbildungsstelle: der Schulabschluss darf noch kommen");
  ok(status("Sachbearbeitung (m/w/d)\n\nDein Profil\n- Realschulabschluss") === "unfinished",
     "sonst angestrebt, aber nicht erreicht");
  ok(status("Sachbearbeitung (m/w/d)\n\nDein Profil\n- Abgeschlossene Ausbildung zur Kauffrau, Realschulabschluss") !== "pending",
     "„Abgeschlossene Ausbildung zur …“ ist keine Ausbildungsstelle");
  ok(status("Dein Profil\n- Abitur (oder du machst es gerade)") === "missing",
     "ein höherer Abschluss als der angestrebte fehlt weiter");
  const dropped = resume((s) => {
    s.events = [{ title: "Realschule, abgebrochen", company: "", sectionId: "education", start: "2019", present: false,
                  description: [], list: [] }];
  });
  ok(status("Dein Profil\n- Realschulabschluss (oder du machst ihn gerade)", dropped) === "missing",
     "abgebrochen ist nicht in Arbeit");
  const trainee = resume((s) => {
    s.events = [{ title: "Ausbildung zur Kauffrau für Büromanagement", company: "Stadtwerke", sectionId: "education",
                  start: "08/2024", end: "07/2099", present: false, description: [], list: [] }];
  });
  ok(status("Dein Profil\n- Abgeschlossene kaufmännische Ausbildung oder kurz vor dem Abschluss", trainee) === "pending",
     "eine Ausbildung kurz vor dem Abschluss");
}

console.log(fails ? `\n${fails} Fehler\n` : "\nalles grün\n");
process.exit(fails ? 1 : 0);
