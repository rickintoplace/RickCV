# Erzeugt neutrale deutsche Lebenslauf-PDFs mit festen Sollwerten.
import json, os, subprocess, html, sys
OUT = os.path.dirname(os.path.abspath(__file__))
E = html.escape
PEOPLE = [
 {"id":"pflege","name":"Sabine Krüger","role":"Gesundheits- und Krankenpflegerin","street":"Lindenallee 12","city":"04109 Leipzig",
  "email":"sabine.krueger@example.de","phone":"0341 2233445","birth":"14.05.1988 in Halle (Saale)",
  "experience":[
   {"title":"Stationsleitung Intensivstation","org":"Universitätsklinikum Leipzig","place":"Leipzig","start":"04/2020","end":"","present":True,
    "bullets":["Führung eines Teams von 24 Pflegekräften","Einführung der digitalen Pflegedokumentation"]},
   {"title":"Gesundheits- und Krankenpflegerin","org":"Klinikum St. Georg","place":"Leipzig","start":"09/2012","end":"03/2020","present":False,
    "bullets":["Pflege auf der internistischen Intensivstation","Praxisanleitung für Auszubildende"]},
   {"title":"Pflegehelferin","org":"Seniorenzentrum Am Park","place":"Halle (Saale)","start":"08/2008","end":"08/2009","present":False,"bullets":[]},
  ],
  "education":[
   {"title":"Weiterbildung Intensiv- und Anästhesiepflege","org":"Bildungszentrum Leipzig","place":"Leipzig","start":"10/2015","end":"09/2017","present":False},
   {"title":"Ausbildung Gesundheits- und Krankenpflege","org":"Medizinische Berufsfachschule","place":"Halle (Saale)","start":"09/2009","end":"08/2012","present":False},
  ],
  "skills":["Wundmanagement","Beatmungspflege","SAP IS-H","MS Office","Praxisanleitung"],
  "languages":[["Deutsch","Muttersprache"],["Englisch","B1"],["Polnisch","A2"]]},
 {"id":"elektro","name":"Mehmet Yılmaz","role":"Elektroniker für Betriebstechnik","street":"Hafenstraße 3a","city":"28217 Bremen",
  "email":"m.yilmaz@example.org","phone":"+49 421 9876543","birth":"02.11.1993 in Bremen",
  "experience":[
   {"title":"Servicetechniker","org":"Nordwerk Anlagenbau GmbH","place":"Bremen","start":"01/2021","end":"","present":True,
    "bullets":["Wartung und Instandsetzung von SPS-gesteuerten Anlagen","Fehlersuche an Siemens S7 und TIA Portal"]},
   {"title":"Elektroniker für Betriebstechnik","org":"Weserstahl AG","place":"Bremen","start":"02/2016","end":"12/2020","present":False,
    "bullets":["Instandhaltung im Dreischichtbetrieb","Prüfung ortsveränderlicher Geräte nach DGUV V3"]},
  ],
  "education":[
   {"title":"Staatlich geprüfter Techniker Elektrotechnik","org":"Technikerschule Bremen","place":"Bremen","start":"08/2018","end":"07/2020","present":False},
   {"title":"Ausbildung Elektroniker für Betriebstechnik","org":"Weserstahl AG","place":"Bremen","start":"08/2012","end":"01/2016","present":False},
   {"title":"Mittlere Reife","org":"Oberschule Findorff","place":"Bremen","start":"08/2006","end":"07/2012","present":False},
  ],
  "skills":["SPS-Programmierung","Siemens S7","TIA Portal","Schaltschrankbau","Führerschein Klasse B"],
  "languages":[["Deutsch","Muttersprache"],["Türkisch","Muttersprache"],["Englisch","B2"]]},
 {"id":"buero","name":"Dr. Johanna Weiß-Becker","role":"Referentin Controlling","street":"Kaiserstraße 77","city":"60329 Frankfurt am Main",
  "email":"johanna.weiss-becker@example.com","phone":"+49 (0)69 123 45 67","birth":"30.01.1985 in Mainz",
  "experience":[
   {"title":"Referentin Controlling","org":"Rhein-Main Versicherung AG","place":"Frankfurt am Main","start":"07/2019","end":"","present":True,
    "bullets":["Aufbau eines Kennzahlensystems mit Power BI","Budgetplanung für drei Geschäftsbereiche"]},
   {"title":"Wissenschaftliche Mitarbeiterin","org":"Goethe-Universität","place":"Frankfurt am Main","start":"10/2014","end":"06/2019","present":False,
    "bullets":["Lehre im Fach Kostenrechnung","Promotion zur Steuerung öffentlicher Unternehmen"]},
   {"title":"Werkstudentin Finanzbuchhaltung","org":"Mainzer Stadtwerke AG","place":"Mainz","start":"04/2011","end":"09/2014","present":False,"bullets":[]},
  ],
  "education":[
   {"title":"Promotion (Dr. rer. pol.)","org":"Goethe-Universität","place":"Frankfurt am Main","start":"10/2014","end":"06/2019","present":False},
   {"title":"Master of Science Betriebswirtschaftslehre","org":"Johannes Gutenberg-Universität","place":"Mainz","start":"10/2011","end":"09/2014","present":False},
  ],
  "skills":["SAP FI/CO","Power BI","Excel (VBA)","DATEV","Kostenrechnung"],
  "languages":[["Deutsch","Muttersprache"],["Englisch","verhandlungssicher"],["Französisch","B2"]]},
]
MONTHS=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
def d(v, style):
    if not v: return ""
    m,y=v.split("/")
    return {"num":v,"name":MONTHS[int(m)-1]+" "+y,"short":v[:3]+y[2:]}[style]
def period(e, style, seit=False):
    if e["present"]:
        return ("seit " + d(e["start"],style)) if seit else d(e["start"],style)+" – heute"
    return d(e["start"],style)+" – "+d(e["end"],style)

CSS_BASE="@page{size:A4;margin:0} body{margin:0;font-family:'DejaVu Sans',Arial,sans-serif;font-size:10pt;color:#222} ul{margin:2px 0 0 0;padding-left:16px} li{margin:0}"

def l1(p):  # tabellarisch klassisch
    rows=lambda items,kind: "".join(f"<tr><td class=d>{E(period(e,'num'))}</td><td><b>{E(e['title'])}</b><br>{E(e['org'])}, {E(e['place'])}"+("<ul>"+"".join(f"<li>{E(b)}</li>" for b in e.get('bullets',[]))+"</ul>" if e.get('bullets') else "")+"</td></tr>" for e in items)
    return f"""<style>{CSS_BASE} .page{{padding:20mm 20mm 20mm 25mm}} h1{{font-size:20pt;margin:0 0 6mm}} h2{{font-size:12pt;border-bottom:1px solid #444;margin:6mm 0 2mm}} td{{vertical-align:top;padding:2px 6px 4px 0}} td.d{{width:38mm;white-space:nowrap}}</style>
<div class=page><h1>Lebenslauf</h1><h2>Persönliche Daten</h2><table>
<tr><td class=d>Name</td><td>{E(p['name'])}</td></tr><tr><td class=d>Anschrift</td><td>{E(p['street'])}, {E(p['city'])}</td></tr>
<tr><td class=d>Telefon</td><td>{E(p['phone'])}</td></tr><tr><td class=d>E-Mail</td><td>{E(p['email'])}</td></tr><tr><td class=d>Geburtsdatum</td><td>{E(p['birth'])}</td></tr></table>
<h2>Berufserfahrung</h2><table>{rows(p['experience'],'x')}</table><h2>Ausbildung</h2><table>{rows(p['education'],'x')}</table>
<h2>Kenntnisse</h2><table><tr><td class=d>EDV und Fachliches</td><td>{E(', '.join(p['skills']))}</td></tr>
<tr><td class=d>Sprachen</td><td>{E(', '.join(f'{a} ({b})' for a,b in p['languages']))}</td></tr></table>
<p style="margin-top:10mm">{E(p['city'].split(' ',1)[1])}, 1. Oktober 2026</p></div>"""

def l2(p):  # zweispaltig modern
    ent=lambda items: "".join(f"<div class=e><div class=h><b>{E(e['title'])}</b><span>{E(period(e,'name'))}</span></div><div class=o>{E(e['org'])} · {E(e['place'])}</div>"+("<ul>"+"".join(f"<li>{E(b)}</li>" for b in e.get('bullets',[]))+"</ul>" if e.get('bullets') else "")+"</div>" for e in items)
    return f"""<style>{CSS_BASE} .wrap{{display:flex;min-height:297mm}} .side{{width:62mm;background:#e4ecf3;padding:14mm 8mm}} .main{{flex:1;padding:14mm 12mm}}
h1{{font-size:24pt;margin:0}} .role{{font-size:12pt;color:#2a5b8a;margin:2mm 0 6mm}} h2{{font-size:11pt;text-transform:uppercase;letter-spacing:1px;color:#2a5b8a;margin:6mm 0 2mm}}
.h{{display:flex;justify-content:space-between}} .h span{{color:#666;white-space:nowrap;margin-left:4mm}} .o{{color:#555;font-style:italic}} .e{{margin-bottom:3mm}} .side p{{margin:1mm 0}}</style>
<div class=wrap><div class=side><h2>Kontakt</h2><p>{E(p['street'])}</p><p>{E(p['city'])}</p><p>{E(p['phone'])}</p><p>{E(p['email'])}</p>
<h2>Kenntnisse</h2>{''.join(f'<p>{E(s)}</p>' for s in p['skills'])}<h2>Sprachen</h2>{''.join(f'<p>{E(a)} – {E(b)}</p>' for a,b in p['languages'])}</div>
<div class=main><h1>{E(p['name'])}</h1><div class=role>{E(p['role'])}</div><h2>Berufserfahrung</h2>{ent(p['experience'])}<h2>Ausbildung</h2>{ent(p['education'])}</div></div>"""

def l3(p):  # einspaltig schlicht, Datum unter dem Titel, "seit"
    ent=lambda items: "".join(f"<p class=t><b>{E(e['title'])}</b>, {E(e['org'])}, {E(e['place'])}</p><p class=d>{E(period(e,'num',seit=True))}</p>"+("<ul>"+"".join(f"<li>{E(b)}</li>" for b in e.get('bullets',[]))+"</ul>" if e.get('bullets') else "") for e in items)
    return f"""<style>{CSS_BASE} .page{{padding:18mm 22mm}} h1{{font-size:22pt;margin:0}} .c{{margin:2mm 0 6mm;color:#444}} h2{{font-size:11pt;text-transform:uppercase;margin:6mm 0 2mm;letter-spacing:.5px}} p{{margin:0}} .t{{margin-top:3mm}} .d{{color:#555}}</style>
<div class=page><h1>{E(p['name'])}</h1><p>{E(p['role'])}</p><p class=c>{E(p['street'])}, {E(p['city'])} | {E(p['phone'])} | {E(p['email'])}</p>
<h2>Berufserfahrung</h2>{ent(p['experience'])}<h2>Ausbildung</h2>{ent(p['education'])}
<h2>Kenntnisse</h2><p>{E(' · '.join(p['skills']))}</p><h2>Sprachen</h2><p>{E(' · '.join(f'{a}: {b}' for a,b in p['languages']))}</p></div>"""

def l4(p):  # europass-aehnlich, Datumsspalte links, Ueberschriften mit Linie
    ent=lambda items: "".join(f"<div class=r><div class=l>{E(period(e,'short'))}</div><div class=c><b>{E(e['title'])}</b><br>{E(e['org'])}, {E(e['place'])}"+("<ul>"+"".join(f"<li>{E(b)}</li>" for b in e.get('bullets',[]))+"</ul>" if e.get('bullets') else "")+"</div></div>" for e in items)
    return f"""<style>{CSS_BASE} .page{{padding:15mm 18mm}} .r{{display:flex;margin-bottom:3mm}} .l{{width:42mm;text-align:right;padding-right:6mm;color:#1f4e79}} .c{{flex:1}}
h2{{font-size:11pt;color:#1f4e79;border-bottom:2px solid #1f4e79;margin:6mm 0 3mm;text-transform:uppercase}} .head{{display:flex;justify-content:space-between}} h1{{font-size:20pt;margin:0;color:#1f4e79}}</style>
<div class=page><div class=head><div><h1>{E(p['name'])}</h1><p>{E(p['role'])}</p></div><div style="text-align:right">{E(p['street'])}<br>{E(p['city'])}<br>{E(p['phone'])}<br>{E(p['email'])}</div></div>
<h2>Berufserfahrung</h2>{ent(p['experience'])}<h2>Schul- und Berufsbildung</h2>{ent(p['education'])}
<h2>Persönliche Fähigkeiten</h2><div class=r><div class=l>Sprachen</div><div class=c>{E('; '.join(f'{a} ({b})' for a,b in p['languages']))}</div></div>
<div class=r><div class=l>Fachkenntnisse</div><div class=c>{E(', '.join(p['skills']))}</div></div></div>"""

def l5(p):  # Word-artig, ueber LibreOffice
    ent=lambda items: "".join(f"<p><b>{E(e['title'])}</b>\t{E(period(e,'num'))}<br>{E(e['org'])}, {E(e['place'])}</p>"+("<ul>"+"".join(f"<li>{E(b)}</li>" for b in e.get('bullets',[]))+"</ul>" if e.get('bullets') else "") for e in items)
    return f"""<html><head><meta charset=utf-8></head><body style="font-family:Liberation Serif">
<p align=center style="font-size:20pt"><b>{E(p['name'])}</b></p><p align=center>{E(p['street'])} · {E(p['city'])} · {E(p['phone'])} · {E(p['email'])}</p>
<h2>Berufliche Stationen</h2>{ent(p['experience'])}<h2>Bildungsweg</h2>{ent(p['education'])}
<h2>Fähigkeiten</h2><p>{E(', '.join(p['skills']))}</p><h2>Sprachen</h2><p>{E(', '.join(f'{a} – {b}' for a,b in p['languages']))}</p></body></html>"""

CHROME=sys.argv[1]
for p in PEOPLE:
    for name,fn in [("tabelle",l1),("zweispaltig",l2),("einspaltig",l3),("europass",l4),("word",l5)]:
        base=os.path.join(OUT,f"{p['id']}-{name}")
        doc=fn(p)
        if name=="word":
            open(base+".html","w").write(doc)
            subprocess.run(["soffice","--headless","-env:UserInstallation=file://"+OUT+"/lo","--convert-to","pdf:writer_web_pdf_Export","--outdir",OUT,base+".html"],capture_output=True,timeout=120)
        else:
            open(base+".html","w").write("<!DOCTYPE html><html lang=de><head><meta charset=utf-8></head><body>"+doc+"</body></html>")
            subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--no-pdf-header-footer","--print-to-pdf="+base+".pdf","file://"+base+".html"],capture_output=True,timeout=120)
    json.dump(p,open(os.path.join(OUT,p["id"]+".truth.json"),"w"),ensure_ascii=False,indent=1)
print("ok")
