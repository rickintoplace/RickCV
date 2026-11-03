/*  layout.js – Aus Stücken auf einem Blatt werden Zeilen.
 *
 *  Ein PDF und ein Word-Dokument sind sich unähnlich, solange man sie
 *  liest; sobald man sie ausmisst, sind sie dasselbe: Textstücke mit einer
 *  Stelle, einer Breite und einer Höhe. Was daraus Zeilen macht – welche
 *  Stücke nebeneinander stehen, wo eine Spalte anfängt, wo eine Lücke ein
 *  Tabulator ist und wo nur ein Leerzeichen –, steht deshalb hier und
 *  nicht zweimal daneben.
 *
 *  Gerechnet wird in Punkt, mit dem Nullpunkt unten links: so liefert es
 *  pdf.js, und so rechnet der Word-Leser es um.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------- Spalten */

  //  Eine senkrechte Bahn, durch die keine Zeile laeuft, trennt zwei
  //  Spalten. Gesucht wird die breiteste solche Bahn, die beide Seiten
  //  nennenswert fuellt – sonst waere jeder Einzug schon eine Spalte.
  //
  //  "slack" sagt, wieviele Stuecke trotzdem hindurchlaufen duerfen. Aus
  //  einem PDF kommt die Breite jedes Stuecks gemessen, dort ist jedes
  //  Stueck, das die Bahn kreuzt, ein Beweis gegen die Spalte – also null.
  //  Aus einem Word-Dokument ist sie geschaetzt: dort kippt sonst eine
  //  einzige lange Zeile in der Seitenspalte die ganze Aufteilung.
  function splitColumns(items, width, slack) {
    //  Unter einem Dutzend Stuecken ist jede gefundene Bahn Zufall. Aus
    //  einem PDF sind es Wortstuecke, da kommt die Zahl schnell zusammen;
    //  aus Word sind es ganze Zeilen, und ein einseitiger Lebenslauf hat
    //  davon nicht viele.
    if (items.length < 14) return [items];

    var allowed = slack || 0;

    //  Ein Band ueber dem Satz – der Name, eine Kopfzeile – laeuft ueber
    //  beide Spalten und sitzt mittig auf dem Blatt. Es spricht nicht
    //  gegen die Spalten darunter; es steht nur nicht in ihnen. Erkannt
    //  wird es an seiner Mitte, und nur dort, wo Breiten geschaetzt sind:
    //  aus einem PDF gemessen ist jedes Stueck ueber der Bahn ein Beweis.
    function isBanner(item) {
      if (!allowed || item.w < width * 0.12) return false;
      return Math.abs(item.x + item.w / 2 - width / 2) < width * 0.15;
    }

    //  Wo Breiten geschaetzt sind, zaehlt zuerst die Flucht: Textrahmen
    //  fangen alle an derselben Stelle an, und zwei weit auseinander
    //  liegende Haeufungen von Anfaengen sind zwei Spalten. Das traegt
    //  auch dort, wo zwischen den Spalten gar keine Gasse bleibt, weil die
    //  Zeilen der Seitenspalte bis an den Hauptteil heranreichen – nach
    //  Luecken gesucht faende man dann irgendeine Bahn mitten im Text.
    function alignedEdge() {
      var starts = items.map(function (item) { return item.x; })
        .sort(function (a, b) { return a - b; });

      var widest = null;
      for (var i = 6; i <= starts.length - 6; i++) {
        var span = starts[i] - starts[i - 1];
        if (span < width * 0.15) continue;

        var edge = (starts[i - 1] + starts[i]) / 2;
        if (edge < width * 0.15 || edge > rightmost) continue;
        if (!widest || span > widest.span) widest = { edge: edge, span: span };
      }
      return widest;
    }

    function divide(edge) {
      var leftItems = [], rightItems = [];
      items.forEach(function (item) {
        (item.x < edge ? leftItems : rightItems).push(item);
      });
      return [leftItems, rightItems];
    }

    var aligned = allowed ? alignedEdge() : null;
    if (aligned) return divide(aligned.edge);

    var edges = [];
    items.forEach(function (item) { edges.push(item.x + item.w); });
    edges.sort(function (a, b) { return a - b; });

    //  Wie weit rechts darf eine Bahn liegen? Weiter aussen steht keine
    //  Spalte mehr, sondern die Datumsspalte am rechten Rand – und deren
    //  Eintraege gehoeren zu den Zeilen daneben und nicht hinter sie.
    //  Gemessene Breiten (PDF) vertragen die weite Grenze, geschaetzte
    //  nicht: dort ist die Gasse vor der Datumsspalte oft die breiteste,
    //  weil in der Seitenspalte jede Zeile ein wenig zu breit geraet.
    var rightmost = allowed ? width * 0.72 : width * 0.8;

    //  Wie breit muss die Gasse sein, um als Spaltenrand zu gelten? Ein
    //  fester Anteil der Seitenbreite war zu grob: ein Theme mit schmalem
    //  Steg (Terminal: knapp vier Millimeter) fiel durch, und seine
    //  Seitenspalte landete Zeile fuer Zeile im Werdegang. Gemessen wird
    //  deshalb in Zeilenhoehen, mit einem Boden fuer sehr grosse Schriften.
    var heights = items.map(function (item) { return item.h; })
      .sort(function (a, b) { return a - b; });
    var middle = heights[Math.floor(heights.length / 2)] || 10;
    var minGap = Math.max(middle * 0.8, width * 0.012);
    var line = Math.max(2, middle * 0.5);
    var inkLeft = Math.min.apply(null, items.map(function (item) { return item.x; }));
    var inkRight = Math.max.apply(null, items.map(function (item) { return item.x + item.w; }));

    var best = null;
    edges.forEach(function (edge) {
      if (edge < width * 0.2 || edge > rightmost) return;

      var through = 0;
      var crossing = [];
      var beside = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.x < edge && item.x + item.w > edge + 1) {
          //  Laeuft hindurch. Ein Band laeuft ueber allem und zaehlt nicht;
          //  sonst ist es erlaubt, solange es fast ganz auf einer Seite
          //  liegt und es bei Ausnahmen bleibt. Beides kommt vor, wenn die
          //  Breite geschaetzt ist: ein zu breit geratenes Stueck in der
          //  Seitenspalte, und ein Aufzaehlungspunkt, dessen Zeichen im
          //  Hauptteil ein Stueck nach links haengt. Die Gasse misst so ein
          //  Stueck nicht mit, sonst waere sie null.
          if (isBanner(item)) continue;
          if (!allowed) { crossing.push(item); continue; }
          if (++through > allowed) return;
          if (Math.min(edge - item.x, item.x + item.w - edge) > item.w * 0.25) return;
          continue;
        }
        beside.push(item);
      }

      //  Gemessene Breiten (PDF): Was die Bahn kreuzt, spricht gegen sie –
      //  ausser es steht ueber allem anderen. Das ist der Kopf ueber beiden
      //  Spalten (Name, Kontaktzeile, ein Profil in voller Breite). Mitten
      //  zwischen den Spalten waere es dagegen der Beweis, dass es keine
      //  sind – und darunter auch: ein Brief mit Absender rechts und
      //  Empfaenger links ueber dem Brieftext hat keine zwei Spalten. Was in
      //  derselben Zeile wie ein kreuzendes Stueck steht, gehoert zum Band.
      var inBand = function (item) {
        return crossing.some(function (cross) { return Math.abs(cross.y - item.y) <= line; });
      };
      //  Massgeblich ist der Bereich, in dem beide Seiten Text tragen: Ein
      //  Name links oben ueber der Kontaktzeile steht zwar hoeher als das
      //  Band, aber noch nicht in einer Spalte.
      var left = 0, right = 0, gap = width;
      var span = { left: [-Infinity, Infinity], right: [-Infinity, Infinity] };
      beside.forEach(function (item) {
        if (crossing.length && inBand(item)) return;
        var side = item.x + item.w <= edge ? span.left : span.right;
        side[0] = Math.max(side[0], item.y);
        side[1] = Math.min(side[1], item.y);
        if (side === span.left) left++;
        else { right++; gap = Math.min(gap, item.x - edge); }
      });
      var top = Math.min(span.left[0], span.right[0]);
      //  Und ein Band reicht ueber die ganze bedruckte Breite. Eine lange
      //  Mailadresse in der Seitenspalte, die ueber die Gasse ragt, steht
      //  zwar unter dem Hauptteil, ist aber noch lange keine Fusszeile.
      var wide = function (cross) {
        var from = Infinity, to = -Infinity;
        items.forEach(function (item) {
          if (Math.abs(item.y - cross.y) > line) return;
          from = Math.min(from, item.x);
          to = Math.max(to, item.x + item.w);
        });
        return to - from >= (inkRight - inkLeft) * 0.6;
      };
      var bands = { above: [] };
      for (var c = 0; c < crossing.length; c++) {
        if (!wide(crossing[c])) return;
        if (crossing[c].y > top + 1) bands.above.push(crossing[c]);
        else return;
      }

      //  Beide Seiten muessen genug Text tragen, sonst ist es keine Spalte,
      //  sondern ein verirrtes Stueck. Frueher standen hier 15 Prozent je
      //  Seite – eine schmale Seitenspalte mit wenigen, langen Textstuecken
      //  (Terminal: 23 von 217) fiel damit durch, und ihr Inhalt landete
      //  zeilenweise im Werdegang.
      if (left < 6 || right < 6) return;
      if (left < items.length * 0.05 || right < items.length * 0.05) return;
      //  Eine Spalte reicht ueber einen guten Teil des Blattes. Drei kurze
      //  Bloecke nebeneinander (Sprachen | Interessen | Projekte unter dem
      //  Kopf) sind ein Raster in einer Zeile, keine Seitenspalte – sonst
      //  stuende der rechte Block im Text erst ganz am Ende.
      var full = Math.max(span.left[0], span.right[0]) - Math.min(span.left[1], span.right[1]);
      if (full > 0 && Math.min(span.left[0] - span.left[1], span.right[0] - span.right[1]) < full * 0.25) return;

      if (!best || gap > best.gap) best = { edge: edge, gap: gap, bands: bands };
    });

    if (!best || best.gap < minGap) return [items];

    //  Wo ein Stueck anfaengt, dorthin gehoert es – auch das seltene, das
    //  ueber die Kante hinausragt. Ein Band ueber oder unter den Spalten
    //  wird vorher bzw. nachher gelesen, mitsamt den Stuecken, die in
    //  seinen Zeilen stehen, ohne selbst die Bahn zu kreuzen.
    var above = best.bands.above;
    if (!above.length) return divide(best.edge);

    var head = [], body = [];
    var lowestHead = Math.min.apply(null, above.map(function (item) { return item.y; }));
    items.forEach(function (item) {
      (item.y >= lowestHead - line ? head : body).push(item);
    });
    return [head].concat(body.length ? splitColumns(body, width, slack) : []);
  }

  /* -------------------------------------------------------------- Zeilen */

  //  Gesperrte Ueberschriften ("P R O F I L") kommen aus dem PDF als
  //  einzelne Buchstaben. Drei oder mehr davon hintereinander waren einmal
  //  ein Wort – und sind fast immer eine Ueberschrift, was die Auswertung
  //  spaeter wissen will.
  function unspace(text) {
    var tokens = String(text).split(" ");
    var out = [];
    var run = [];
    var spaced = false;

    function flush() {
      if (run.length >= 3) { out.push(run.join("")); spaced = true; }
      else out.push.apply(out, run);
      run = [];
    }

    //  Ein leeres Stueck kommt aus einem doppelten Leerzeichen, der Wortgrenze
    //  (siehe toLines); es beendet ein gesperrtes Wort.
    tokens.forEach(function (token) {
      if (token.length === 1 && /[^\s\d]/.test(token)) run.push(token);
      else { flush(); if (token) out.push(token); }
    });
    flush();

    //  Nur Leerzeichen zusammenfassen: der Tabulator aus toLines markiert
    //  eine Spalte und muss die Normalisierung ueberleben.
    return { text: out.join(" ").replace(/[ ]+/g, " ").trim(), spaced: spaced };
  }

  //  Eine Zeile ist mehr als ihr Text: Schriftgrad trennt Ueberschrift von
  //  Fliesstext, und ein breiter Abstand mitten in der Zeile ist eine
  //  Spalte (Kenntnisse stehen gern zu zweit nebeneinander). Der Abstand
  //  wird als Tabulator festgehalten.
  function toLines(items, page) {
    if (!items.length) return [];

    var heights = items.map(function (item) { return item.h; })
      .sort(function (a, b) { return a - b; });
    var tolerance = Math.max(2, heights[Math.floor(heights.length / 2)] * 0.5);

    var sorted = items.slice().sort(function (a, b) {
      return b.y - a.y || a.x - b.x; // im PDF waechst y nach oben
    });

    var rows = [];
    var current = null;
    sorted.forEach(function (item) {
      if (!current || Math.abs(current.y - item.y) > tolerance) {
        current = { y: item.y, parts: [] };
        rows.push(current);
      }
      current.parts.push(item);
    });

    return rows.map(function (row) {
      var parts = row.parts.sort(function (a, b) { return a.x - b.x; });
      var text = "";
      var previous = null;
      var size = 0;

      var pendingSpace = false;
      //  Wo jede Zelle anfaengt, die ein Tabulator abtrennt: eine
      //  Ueberschrift im Rand steht mit der ersten Station in einer Zeile,
      //  und die Station braucht ihren eigenen Einzug.
      var cells = [];

      parts.forEach(function (item) {
        //  Ein Platzhalter traegt nur noch seine Breite bei: kein Text,
        //  kein Leerzeichen, aber die Geometrie laeuft weiter.
        if (item.ghost) { previous = item; return; }

        //  Ein Stueck, das nur ein Leerzeichen ist, wird gemerkt, aber nicht
        //  gemessen: sein Text gehoert in die Zeile, seine Breite gehoert zur
        //  Luecke. Sonst zerfaellt eine Spaltenluecke in zwei kleine
        //  Abstaende, und aus zwei Kenntnissen nebeneinander wird eine.
        if (!item.str.trim()) { pendingSpace = true; return; }

        size = Math.max(size, item.h);
        if (previous) {
          var gap = item.x - (previous.x + previous.w);
          //  Schnipsel stossen im PDF oft mitten im Wort aneinander; erst
          //  ab einem Viertel Zeichenbreite ist es ein Leerzeichen. Ab dem
          //  Doppelten der Zeilenhoehe ist es keine Luecke mehr, sondern
          //  eine eigene Spalte.
          if (gap > item.h * 2) { text += "\t"; cells.push({ x: item.x, size: 0, heavy: 0, total: 0 }); }
          //  Ein Stueck, das eine ganze Zeile ist (so kommen sie aus Word),
          //  gehoert nie mitten in ein Wort: zwei davon nebeneinander sind
          //  zwei Rahmen, und dazwischen gehoert ein Leerzeichen – auch
          //  wenn die Rahmen sich ueberlappen und die Luecke rechnerisch
          //  verschwindet.
          //  Ein echtes Leerzeichen-Stueck ist eine Wortgrenze. In gesperrter
          //  Schrift ("B A C K E N D   E N G I N E E R") steht zwischen den
          //  Buchstaben nur Abstand, zwischen den Woertern aber dieses
          //  Stueck – es wird doppelt notiert, damit unspace() dort das Wort
          //  beendet, statt "BACKENDENGINEER" daraus zu machen.
          else if (pendingSpace) text += "  ";
          else if (gap > item.h * 0.25 || item.whole || previous.whole) text += " ";
        }
        pendingSpace = false;
        text += item.str;
        previous = item;
        if (!cells.length) cells.push({ x: item.x, size: 0, heavy: 0, total: 0 });
        var cell = cells[cells.length - 1];
        cell.size = Math.max(cell.size, item.h);
        cell.total += item.str.length;
        if (item.bold) cell.heavy += item.str.length;
      });

      var cleaned = unspace(text.replace(/[ ]{3,}/g, "  ").trim());
      var real = parts.filter(function (item) { return !item.ghost; });
      var first = real[0] || parts[0];

      //  Fett ist die Zeile, wenn der groessere Teil ihrer Zeichen fett
      //  gesetzt ist – ein fett gesetztes Wort mitten im Satz macht noch
      //  keine Ueberschrift.
      var heavy = 0;
      var total = 0;
      real.forEach(function (item) {
        var length = (item.str || "").length;
        total += length;
        if (item.bold) heavy += length;
      });

      return {
        text: cleaned.text,
        spaced: cleaned.spaced,
        //  Aus Word bekannt: die Zeile beginnt einen Absatz. Ein PDF weiss
        //  das nicht – dann bleibt es offen, statt "nein" zu sagen.
        para: parts.some(function (item) { return item.para !== undefined; })
          ? parts.some(function (item) { return item.para; }) : undefined,
        bold: total > 0 && heavy / total > 0.6,
        size: size,
        x: first.x,
        cells: cells.map(function (cell) {
          return { x: cell.x, size: cell.size, bold: cell.total > 0 && cell.heavy / cell.total > 0.6 };
        }),
        y: row.y,
        page: page,
      };
    }).filter(function (row) { return row.text; });
  }

  global.RickCVLayout = {
    splitColumns: splitColumns,
    toLines: toLines,
    unspace: unspace,
  };
})(typeof window !== "undefined" ? window : this);
