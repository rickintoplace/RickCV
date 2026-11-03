import json, os, subprocess, html, sys
OUT=os.path.dirname(os.path.abspath(__file__)); E=html.escape
PEOPLE=[
 {"id":"koch","name":"Lukas Brandt","role":"Küchenchef","street":"Am Markt 5","city":"79098 Freiburg im Breisgau","email":"lukas.brandt@example.net","phone":"0761 445566",
  "experience":[{"title":"Küchenchef","org":"Hotel Schwarzwaldblick","place":"Titisee-Neustadt","start":"03/2021","end":"","present":True,"bullets":["Leitung einer Brigade mit 9 Köchinnen und Köchen","Einführung eines saisonalen Menükonzepts"]},
                {"title":"Sous-Chef","org":"Restaurant Kornhaus","place":"Freiburg im Breisgau","start":"06/2016","end":"02/2021","present":False,"bullets":["Warenwirtschaft und HACCP-Dokumentation"]},
                {"title":"Jungkoch","org":"Gasthaus Zur Linde","place":"Emmendingen","start":"09/2013","end":"05/2016","present":False,"bullets":[]}],
  "education":[{"title":"Küchenmeister (IHK)","org":"IHK Südlicher Oberrhein","place":"Freiburg im Breisgau","start":"09/2018","end":"07/2019","present":False},
               {"title":"Ausbildung zum Koch","org":"Gasthaus Zur Linde","place":"Emmendingen","start":"08/2010","end":"07/2013","present":False}],
  "skills":["HACCP","Menüplanung","Warenwirtschaft","Personalführung"],"languages":[["Deutsch","Muttersprache"],["Französisch","B1"]]},
 {"id":"lehrerin","name":"Anna-Lena Schäfer","role":"Grundschullehrerin","street":"Rosenweg 18","city":"01067 Dresden","email":"al.schaefer@example.de","phone":"+49 351 7788990",
  "experience":[{"title":"Lehrerin für Deutsch und Mathematik","org":"Grundschule am Elbufer","place":"Dresden","start":"08/2019","end":"","present":True,"bullets":["Klassenleitung einer dritten Klasse","Koordination der Leseförderung"]},
                {"title":"Referendarin","org":"Grundschule Pieschen","place":"Dresden","start":"02/2018","end":"07/2019","present":False,"bullets":["Unterricht in Deutsch, Mathematik und Sachunterricht"]}],
  "education":[{"title":"Zweites Staatsexamen Lehramt an Grundschulen","org":"Landesamt für Schule und Bildung","place":"Dresden","start":"02/2018","end":"07/2019","present":False},
               {"title":"Studium Lehramt an Grundschulen","org":"Technische Universität Dresden","place":"Dresden","start":"10/2013","end":"09/2017","present":False}],
  "skills":["Leseförderung","Inklusion","Elternarbeit","Smartboard"],"languages":[["Deutsch","Muttersprache"],["Englisch","C1"],["Tschechisch","A2"]]},
]
def y(v): return v.split("/")[1] if v else ""
def per_years(e): return y(e["start"])+" – "+("heute" if e["present"] else y(e["end"]))
def per_num(e): return e["start"]+" – "+("heute" if e["present"] else e["end"])
CSS="@page{size:A4;margin:0} body{margin:0;font-family:'DejaVu Sans',Arial,sans-serif;font-size:10pt;color:#222} ul{margin:2px 0 0;padding-left:16px}"
def bl(e): return ("<ul>"+"".join(f"<li>{E(b)}</li>" for b in e.get("bullets",[]))+"</ul>") if e.get("bullets") else ""
def a(p):  # nur Jahre, Datum links, Titel fett, darunter Einrichtung – Ort
    rows=lambda L: "".join(f"<tr><td style='width:28mm;vertical-align:top'>{E(per_years(e))}</td><td><b>{E(e['title'])}</b><br>{E(e['org'])} – {E(e['place'])}{bl(e)}</td></tr>" for e in L)
    return f"<style>{CSS} .p{{padding:20mm}} h1{{margin:0}} h3{{margin:7mm 0 2mm;color:#7a2e10}}</style><div class=p><h1>{E(p['name'])}</h1><div>{E(p['role'])}</div><div>{E(p['street'])} · {E(p['city'])} · {E(p['phone'])} · {E(p['email'])}</div><h3>Beruflicher Werdegang</h3><table>{rows(p['experience'])}</table><h3>Ausbildung</h3><table>{rows(p['education'])}</table><h3>Kenntnisse</h3><div>{E(', '.join(p['skills']))}</div><h3>Sprachen</h3><div>{E(', '.join(x+' ('+l+')' for x,l in p['languages']))}</div></div>"
def b(p):  # Beschriftungen "Zeitraum:", "Arbeitgeber:", "Position:"
    ent=lambda L,lab: "".join(f"<div style='margin:3mm 0'><div><b>Position:</b> {E(e['title'])}</div><div><b>{lab}:</b> {E(e['org'])}, {E(e['place'])}</div><div><b>Zeitraum:</b> {E(per_num(e))}</div>{bl(e)}</div>" for e in L)
    return f"<style>{CSS} .p{{padding:18mm 24mm}} h2{{border-bottom:1px solid #999}}</style><div class=p><h1>Lebenslauf {E(p['name'])}</h1><p>{E(p['street'])}<br>{E(p['city'])}<br>Telefon: {E(p['phone'])}<br>E-Mail: {E(p['email'])}</p><h2>Berufserfahrung</h2>{ent(p['experience'],'Arbeitgeber')}<h2>Ausbildung</h2>{ent(p['education'],'Einrichtung')}<h2>Kenntnisse</h2><p>{E(', '.join(p['skills']))}</p><h2>Sprachen</h2><p>{E(', '.join(x+': '+l for x,l in p['languages']))}</p></div>"
def c(p):  # Karten: Titel oben, Einrichtung links und Datum rechts in einer Zeile
    ent=lambda L: "".join(f"<div style='border:1px solid #ccc;border-radius:6px;padding:3mm;margin:3mm 0'><div style='font-weight:bold;font-size:11pt'>{E(e['title'])}</div><div style='display:flex;justify-content:space-between'><span>{E(e['org'])}, {E(e['place'])}</span><span style='color:#666'>{E(per_num(e))}</span></div>{bl(e)}</div>" for e in L)
    return f"<style>{CSS} .p{{padding:16mm 20mm}} h2{{color:#0b6e4f;margin:6mm 0 1mm}}</style><div class=p><div style='display:flex;justify-content:space-between;align-items:end'><div><h1 style='margin:0'>{E(p['name'])}</h1><div>{E(p['role'])}</div></div><div style='text-align:right'>{E(p['email'])}<br>{E(p['phone'])}<br>{E(p['street'])}, {E(p['city'])}</div></div><h2>Erfahrung</h2>{ent(p['experience'])}<h2>Bildung</h2>{ent(p['education'])}<h2>Fähigkeiten</h2><p>{E(' · '.join(p['skills']))}</p><h2>Sprachkenntnisse</h2><p>{E(' · '.join(x+' – '+l for x,l in p['languages']))}</p></div>"
for p in PEOPLE:
    for n,fn in [("jahre",a),("beschriftet",b),("karten",c)]:
        base=os.path.join(OUT,f"{p['id']}-{n}")
        open(base+".html","w").write("<!DOCTYPE html><html lang=de><head><meta charset=utf-8></head><body>"+fn(p)+"</body></html>")
        subprocess.run([sys.argv[1],"--headless","--disable-gpu","--no-sandbox","--no-pdf-header-footer","--print-to-pdf="+base+".pdf","file://"+base+".html"],capture_output=True,timeout=120)
    json.dump(p,open(os.path.join(OUT,p["id"]+".truth.json"),"w"),ensure_ascii=False,indent=1)
print("ok")
