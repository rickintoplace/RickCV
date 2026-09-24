# -*- coding: utf-8 -*-
"""Baut word-nativ.docx: ein Lebenslauf, wie man ihn in Word selbst tippt –
   Formatvorlagen fuer Titel und Ueberschriften, rechter Tabstopp fuer den
   Zeitraum, echte Aufzaehlungen, jede Zeile der Anschrift ein eigener
   Absatz mit Leerabsaetzen dazwischen, und nach einem Seitenumbruch das
   Anschreiben. Word-Standard: 8 pt Abstand nach jedem Absatz.

   Aufruf: python3 tests/fixtures/word-nativ-quelle.py tests/fixtures/word-nativ.docx"""
import zipfile, sys
from xml.sax.saxutils import escape

def run(text, bold=False, italic=False, size=None):
    rpr = ""
    if bold: rpr += "<w:b/>"
    if italic: rpr += "<w:i/>"
    if size: rpr += f'<w:sz w:val="{size*2}"/>'
    parts = text.split("\t")
    out = ""
    for i, part in enumerate(parts):
        if i: out += f"<w:r><w:rPr>{rpr}</w:rPr><w:tab/></w:r>"
        if part: out += f'<w:r><w:rPr>{rpr}</w:rPr><w:t xml:space="preserve">{escape(part)}</w:t></w:r>'
    return out

def para(*runs, style=None, bullet=False, jc=None, tabs=False, brk=False):
    ppr = ""
    if style: ppr += f'<w:pStyle w:val="{style}"/>'
    if bullet: ppr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
    if tabs: ppr += '<w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs>'
    if jc: ppr += f'<w:jc w:val="{jc}"/>'
    body = "".join(runs)
    if brk: body = '<w:r><w:br w:type="page"/></w:r>' + body
    return f"<w:p><w:pPr>{ppr}</w:pPr>{body}</w:p>"

P = []
P.append(para(run("Katharina Wolff"), style="Title"))
P.append(para(run("Industriekauffrau")))
P.append(para(run("Birkenweg 17 | 90402 Nürnberg | 0911 7788990 | k.wolff@example.com")))
P.append(para(run("Berufserfahrung"), style="Heading1"))
P.append(para(run("Teamleiterin Einkauf", bold=True), run("\tseit 05/2022"), tabs=True))
P.append(para(run("Frankenguss AG, Nürnberg", italic=True)))
P.append(para(run("Verantwortung für ein Einkaufsvolumen von 18 Mio. Euro"), bullet=True))
P.append(para(run("Führung von vier Mitarbeitenden und Lieferantenaudits im In- und Ausland, dabei Aufbau eines"), bullet=True))
P.append(para(run("Sachbearbeiterin Einkauf", bold=True), run("\t08/2017 – 04/2022"), tabs=True))
P.append(para(run("Medi-Tex GmbH, Erlangen", italic=True)))
P.append(para(run("Bestellabwicklung und Rechnungsprüfung in SAP MM"), bullet=True))
P.append(para(run("Ausbildung"), style="Heading1"))
P.append(para(run("Ausbildung zur Industriekauffrau", bold=True), run("\t09/2014 – 07/2017"), tabs=True))
P.append(para(run("Medi-Tex GmbH, Erlangen", italic=True)))
P.append(para(run("Allgemeine Hochschulreife", bold=True), run("\t2014"), tabs=True))
P.append(para(run("Dürer-Gymnasium, Nürnberg", italic=True)))
P.append(para(run("Kenntnisse"), style="Heading1"))
P.append(para(run("SAP MM, MS Excel (sehr gut), Power BI")))
P.append(para(run("Sprachen"), style="Heading1"))
P.append(para(run("Deutsch – Muttersprache"), bullet=True))
P.append(para(run("Englisch – verhandlungssicher (C1)"), bullet=True))
P.append(para(run("Ehrenamt"), style="Heading1"))
P.append(para(run("Kassenwartin, Kanuclub Pegnitz e.V.", bold=True), run("\tseit 2019"), tabs=True))

# Anschreiben nach Seitenumbruch
P.append(para(run("Katharina Wolff"), brk=True))
P.append(para(run("Birkenweg 17")))
P.append(para(run("90402 Nürnberg")))
P.append(para())
P.append(para(run("Kühlwerk Süd GmbH")))
P.append(para(run("Frau Sabine Albrecht")))
P.append(para(run("Industriestraße 40")))
P.append(para(run("91052 Erlangen")))
P.append(para())
P.append(para(run("Nürnberg, 12.03.2026"), jc="right"))
P.append(para())
P.append(para(run("Bewerbung als Leiterin Einkauf", bold=True)))
P.append(para())
P.append(para(run("Sehr geehrte Frau Albrecht,")))
P.append(para(run("als Teamleiterin im Einkauf der Frankenguss AG verantworte ich heute ein Volumen von 18 Mio. Euro. Diese Erfahrung möchte ich gern bei Ihnen einsetzen.")))
P.append(para(run("Besonders reizt mich, den Einkauf strategisch neu aufzustellen.")))
P.append(para(run("Ich freue mich auf Ihre Einladung zu einem Gespräch.")))
P.append(para(run("Freundliche Grüße")))
P.append(para())
P.append(para(run("Katharina Wolff")))

doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'
  + "".join(P) +
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1134" w:bottom="1134" w:left="1417"/></w:sectPr>'
  '</w:body></w:document>')
styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>'
  '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:sz w:val="56"/></w:rPr></w:style>'
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:spacing w:before="240" w:after="0"/></w:pPr><w:rPr><w:sz w:val="32"/></w:rPr></w:style>'
  '</w:styles>')
numbering = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>')
ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  '<Default Extension="xml" ContentType="application/xml"/>'
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
  '</Types>')
rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
drels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')
out = sys.argv[1] if len(sys.argv) > 1 else "word-nativ.docx"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", doc); z.writestr("word/styles.xml", styles)
    z.writestr("word/numbering.xml", numbering); z.writestr("word/_rels/document.xml.rels", drels)
