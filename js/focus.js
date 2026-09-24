/*  focus.js – Fokus in Dialogen.
 *
 *  Ein Dialog, der den Rest der Seite abdunkelt, muss auch die Tastatur bei
 *  sich behalten: sonst wandert Tab hinaus in eine Kopfzeile, die man nicht
 *  sieht, und Vorlesesoftware liest vor, was hinter dem Dialog liegt.
 *
 *    var release = RickCVFocus.trap(panel, onEscape);
 *    …
 *    release();   // beim Schliessen
 *
 *  Waehrend der Dialog offen ist, ist alles ausserhalb inert – nicht
 *  erreichbar, nicht vorgelesen. Tab laeuft im Kreis, Escape ruft onEscape.
 */
(function (global) {
  "use strict";

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (node) {
      return !node.hidden && node.offsetParent !== null;
    });
  }

  //  Alles neben dem Dialog – genauer: neben dem Element direkt unter
  //  <body>, in dem er steckt – wird inert. Was schon inert war, bleibt es
  //  danach auch.
  function isolate(dialog) {
    var top = dialog;
    while (top.parentNode && top.parentNode !== document.body) top = top.parentNode;
    var changed = [];
    Array.prototype.forEach.call(document.body.children, function (sibling) {
      if (sibling === top || sibling.inert || /^(SCRIPT|STYLE)$/.test(sibling.tagName)) return;
      sibling.inert = true;
      changed.push(sibling);
    });
    return function () {
      changed.forEach(function (sibling) { sibling.inert = false; });
    };
  }

  function trap(dialog, onEscape) {
    var restore = isolate(dialog);

    function onKey(event) {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      var items = focusables(dialog);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return function release() {
      document.removeEventListener("keydown", onKey, true);
      restore();
    };
  }

  global.RickCVFocus = { trap: trap, focusables: focusables };
})(typeof window !== "undefined" ? window : this);
