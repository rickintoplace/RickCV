/*  history.js – Der Verlauf hinter "Rueckgaengig" und "Wiederholen".
 *
 *  Ein getipptes Wort soll ein einziger Schritt sein, nicht einer pro
 *  Buchstabe. Deshalb wird der Stand VOR einer Aenderungsserie gemerkt und
 *  erst abgelegt, wenn eine Weile nichts mehr passiert. Die Serie kann aber
 *  auch vorher enden: wer mitten im Tippen auf "Rueckgaengig" oder
 *  "Beispiel" klickt, schliesst sie ab. Vorher ging genau dabei ein Stand
 *  verloren – Rueckgaengig sprang zwei Schritte zurueck, und das zuletzt
 *  Getippte war nirgends mehr zu finden.
 *
 *  Das Modul kennt kein DOM und keinen Zustand, nur Texte: `read()` liefert
 *  den aktuellen Stand als JSON. So laesst es sich ohne Browser pruefen
 *  (tests/model.test.mjs).
 */
(function (global) {
  "use strict";

  //  options:
  //    read       – () => aktueller Stand als Text
  //    delay      – Ruhezeit in ms, nach der eine Serie endet (600)
  //    limit      – wieviele Schritte zurueck (40)
  //    onChange   – nach jeder Aenderung am Verlauf, fuer den Knopf
  //    setTimeout, clearTimeout – austauschbar fuer Tests
  function create(options) {
    var read = options.read;
    var delay = options.delay === undefined ? 600 : options.delay;
    var limit = options.limit || 40;
    var onChange = options.onChange || function () {};
    var setTimer = options.setTimeout || function (fn, ms) { return global.setTimeout(fn, ms); };
    var clearTimer = options.clearTimeout || function (id) { global.clearTimeout(id); };

    var steps = [];
    //  Was Rueckgaengig zuruecknahm, fuer Wiederholen. Jede neue Aenderung
    //  verwirft es – ab dort ist es eine andere Geschichte.
    var ahead = [];
    var committed = read();
    var pending = null;   // Stand vor der laufenden Serie
    var timer = null;

    function push(snapshot) {
      if (snapshot === null || snapshot === undefined) return;
      if (steps.length && steps[steps.length - 1] === snapshot) return;
      steps.push(snapshot);
      if (steps.length > limit) steps.shift();
    }

    //  Die laufende Serie sofort abschliessen.
    function settle() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      var current = read();
      if (pending !== null && pending !== current) push(pending);
      pending = null;
      committed = current;
    }

    //  Eine Aenderung ist passiert (oder geht weiter).
    function touch() {
      if (pending === null) pending = committed;
      ahead = [];
      if (timer !== null) clearTimer(timer);
      timer = setTimer(function () {
        timer = null;
        settle();
        onChange();
      }, delay);
      onChange();
    }

    //  Vor einem Schritt, der den ganzen Stand austauscht – Beispiel, Neu,
    //  Import, ein Theme aus einer Datei. Danach fuehrt Rueckgaengig genau
    //  hierher zurueck, samt allem, was bis eben getippt wurde.
    function checkpoint() {
      settle();
      push(committed);
      ahead = [];
      onChange();
    }

    //  Der Stand, zu dem Rueckgaengig fuehrt, oder null. Wer ihn einsetzt,
    //  ruft danach reset() auf.
    function undo() {
      settle();
      var current = read();
      while (steps.length && steps[steps.length - 1] === current) steps.pop();
      var previous = steps.length ? steps.pop() : null;
      if (previous !== null) ahead.push(current);
      onChange();
      return previous;
    }

    //  Der Stand, den das letzte Rueckgaengig verlassen hat, oder null. Wer
    //  ihn einsetzt, ruft danach reset() auf.
    function redo() {
      settle();
      if (!ahead.length) return null;
      push(committed);
      var next = ahead.pop();
      onChange();
      return next;
    }

    //  Nach einem Austausch ist der neue Stand der Ausgangspunkt.
    function reset() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      pending = null;
      committed = read();
      onChange();
    }

    function canUndo() {
      return steps.length > 0 || pending !== null;
    }

    function canRedo() {
      return ahead.length > 0;
    }

    return {
      touch: touch,
      settle: settle,
      checkpoint: checkpoint,
      undo: undo,
      redo: redo,
      reset: reset,
      canUndo: canUndo,
      canRedo: canRedo,
      size: function () { return steps.length; },
    };
  }

  global.RickCVHistory = { create: create };
})(typeof window !== "undefined" ? window : this);
