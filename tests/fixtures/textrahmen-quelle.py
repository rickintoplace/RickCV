# -*- coding: utf-8 -*-
"""Baut tests/fixtures/textrahmen.docx: ein Lebenslauf, der ganz aus
   Textrahmen besteht – wie die Vorlagen, die man im Netz herunterlaedt."""
import zipfile, os

EMU = 12700  # je Punkt

def box(x_pt, y_pt, w_pt, h_pt, paragraphs, anchor_id):
    """Ein verankerter Textrahmen mit Ersatzdarstellung (wie Word sie schreibt)."""
    inner = "".join(paragraphs)
    vml_inner = inner  # dieselbe Sache noch einmal – der Leser muss sie verwerfen
    return f"""<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>
<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{anchor_id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
<wp:simplePos x="0" y="0"/>
<wp:positionH relativeFrom="page"><wp:posOffset>{int(x_pt*EMU)}</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="paragraph"><wp:posOffset>{int(y_pt*EMU)}</wp:posOffset></wp:positionV>
<wp:extent cx="{int(w_pt*EMU)}" cy="{int(h_pt*EMU)}"/>
<wp:wrapNone/><wp:docPr id="{anchor_id}" name="Rahmen {anchor_id}"/>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
<wps:wsp><wps:cNvSpPr/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{int(w_pt*EMU)}" cy="{int(h_pt*EMU)}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr>
<wps:txbx><w:txbxContent>{inner}</w:txbxContent></wps:txbx>
<wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>
<mc:Fallback><w:pict><v:shape id="s{anchor_id}" style="position:absolute;margin-left:{x_pt}pt;margin-top:{y_pt}pt;width:{w_pt}pt;height:{h_pt}pt">
<v:textbox><w:txbxContent>{vml_inner}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback>
</mc:AlternateContent></w:r>"""

def para(text, size=11, bold=False, bullet=False, font=None, symbol=None):
    rpr = "<w:rPr>"
    if font:
        rpr += f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}"/>'
    if bold:
        rpr += "<w:b/>"
    rpr += f'<w:sz w:val="{size*2}"/><w:szCs w:val="{size*2}"/></w:rPr>'
    ppr = "<w:pPr>"
    if bullet:
        ppr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
    ppr += rpr.replace("<w:rPr>", "<w:rPr>").replace("</w:rPr>", "</w:rPr>") + "</w:pPr>"
    runs = ""
    if symbol:
        #  Ein Zeichen aus einer Symbolschrift, wie Word es fuer Haken und
        #  Pfeile schreibt – im Text hat es nichts zu suchen.
        runs += (f'<w:r><w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings"/>'
                 f'<w:sz w:val="{size*2}"/></w:rPr><w:t>{symbol}</w:t></w:r>')
    runs += f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>'
    return f'<w:p>{ppr}{runs}</w:p>'

boxes = []
n = 100

def add(x, y, w, h, paras):
    global n
    n += 1
    boxes.append(box(x, y, w, h, paras, n))

#  Kopf: Name und Rolle, mittig ueber beiden Spalten
add(150, 10, 300, 34, [para("JONNA WIEDEMANN", 24, True)])
add(150, 46, 300, 18, [para("Fachinformatikerin", 13)])

#  Seitenspalte
add(40, 90, 150, 16, [para("KONTAKT", 12, True)])
add(40, 112, 150, 44, [para("0151 22334455", 10), para("jonna.wiedemann@example.de", 10),
                       para("Wiesenweg 4, 30159 Hannover", 10)])
add(40, 175, 150, 16, [para("KENNTNISSE", 12, True)])
add(40, 197, 150, 56, [para("Java", 10, bullet=True), para("Kubernetes", 10, bullet=True),
                       para("PostgreSQL", 10, bullet=True)])
add(40, 265, 150, 16, [para("SPRACHEN", 12, True)])
add(40, 287, 150, 54, [para("Deutsch: Muttersprache", 10, bullet=True),
                       para("Englisch: C1", 10, bullet=True),
                       para("Norwegisch: A2", 10, bullet=True)])
add(40, 350, 150, 16, [para("INTERESSEN", 12, True)])
add(40, 372, 150, 40, [para("Kanusport", 10, bullet=True),
                       para("Imkerei", 10, bullet=True)])

#  Hauptspalte: Ueberschrift, Titel, Arbeitgeber mit Zeitraum, Punkte
add(240, 90, 300, 16, [para("BERUFSERFAHRUNG", 12, True)])
add(240, 112, 300, 16, [para("Softwareentwicklerin", 12, True)])
add(240, 130, 300, 14, [para("Weserwerk Digital GmbH, Hannover | 03/2021 – heute", 10)])
add(240, 148, 300, 44, [para("Ablösung der nächtlichen Stapelverarbeitung", 10, bullet=True),
                        para("Betreuung von drei Auszubildenden", 10, bullet=True),
                        para("Umstellung der Auslieferung auf Container", 10, bullet=True)])
add(240, 190, 300, 16, [para("Werkstudentin Entwicklung", 12, True)])
add(240, 208, 300, 14, [para("Leinetal Software AG, Hannover | 09/2018 – 02/2021", 10)])
add(240, 226, 300, 30, [para("Schnittstellen für die Warenwirtschaft", 10, bullet=True),
                        para("Testdaten für die Abnahme", 10, bullet=True)])

add(240, 260, 300, 16, [para("AUSBILDUNG", 12, True)])
add(240, 282, 300, 16, [para("B.Sc. Informatik", 12, True)])
add(240, 300, 300, 14, [para("Leibniz Universität Hannover | 10/2015 – 08/2018", 10)])
add(240, 318, 300, 14, [para("Schwerpunkt verteilte Systeme", 10, bullet=True)])

#  Ein Zeichen aus einer Symbolschrift: es darf nicht als Buchstabe erscheinen.
add(240, 330, 300, 14, [para("Mobilität: Führerschein Klasse B", 10, symbol=chr(0xF0E0))])

document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:v="urn:schemas-microsoft-com:vml"
  mc:Ignorable="w14 wp14">
<w:body><w:p>""" + "".join(boxes) + """</w:p>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body></w:document>"""

styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>
</w:styles>"""

content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""

rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textrahmen.docx")
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document)
    z.writestr("word/styles.xml", styles)
    z.writestr("word/_rels/document.xml.rels", doc_rels)
print("geschrieben:", target, os.path.getsize(target), "Bytes")
