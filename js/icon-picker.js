/*  icon-picker.js – Modaler Dialog zur Symbolauswahl.
 *
 *  Suche laeuft ueber Name, Gruppe und deutsche wie englische Schlagworte.
 *  Bedienbar per Tastatur: Tippen filtert, Pfeiltasten wandern durch das
 *  Raster, Eingabe uebernimmt, Escape schliesst.
 */
(function (global) {
  "use strict";

  var Icons = global.RickCVIconLib;

  var overlay = null;
  var grid = null;
  var input = null;
  var setTabs = null;
  var current = null;
  var activeSet = "lucide";
  var onPick = null;
  var lastFocused = null;
  var translate = function (key) { return key; };

  function setTranslator(fn) {
    translate = fn;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function build() {
    overlay = el("div", "picker-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.hidden = true;

    var panel = el("div", "picker-panel");

    var head = el("div", "picker-head");
    input = el("input", "picker-search");
    input.type = "search";
    input.autocomplete = "off";
    head.appendChild(input);

    var close = el("button", "btn btn-icon picker-close", "✕");
    close.type = "button";
    close.addEventListener("click", hide);
    head.appendChild(close);
    panel.appendChild(head);

    setTabs = el("div", "picker-sets");
    Object.keys(Icons.sets).forEach(function (id) {
      var set = Icons.sets[id];
      var tab = el("button", "picker-set", set.label);
      tab.type = "button";
      tab.dataset.set = id;
      tab.title = set.note;
      tab.addEventListener("click", function () {
        activeSet = id;
        paintTabs();
        paintGrid();
        input.focus();
      });
      setTabs.appendChild(tab);
    });
    panel.appendChild(setTabs);

    var setNote = el("p", "picker-note");
    setNote.id = "picker-note";
    panel.appendChild(setNote);

    grid = el("div", "picker-grid");
    grid.setAttribute("role", "listbox");
    panel.appendChild(grid);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", function (event) {
      if (event.target === overlay) hide();
    });
    input.addEventListener("input", paintGrid);
    overlay.addEventListener("keydown", handleKeys);
  }

  function paintTabs() {
    setTabs.querySelectorAll(".picker-set").forEach(function (tab) {
      var active = tab.dataset.set === activeSet;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("picker-note").textContent = Icons.sets[activeSet].note;
  }

  function paintGrid() {
    var results = Icons.search(input.value, activeSet);
    grid.innerHTML = "";

    if (!results.length) {
      grid.appendChild(el("p", "picker-empty", translate("noIconsFound")));
      return;
    }

    var lastGroup = null;
    results.forEach(function (result) {
      if (result.group !== lastGroup) {
        lastGroup = result.group;
        grid.appendChild(el("div", "picker-group", result.group));
      }

      var button = el("button", "picker-item");
      button.type = "button";
      button.title = result.name;
      button.dataset.name = result.name;
      button.setAttribute("role", "option");
      button.innerHTML = Icons.html({ set: result.set, name: result.name });

      if (current && current.set === result.set && current.name === result.name) {
        button.classList.add("is-current");
        button.setAttribute("aria-selected", "true");
      }
      button.addEventListener("click", function () {
        if (onPick) onPick({ set: result.set, name: result.name });
        hide();
      });
      grid.appendChild(button);
    });
  }

  function handleKeys(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }

    var buttons = Array.prototype.slice.call(grid.querySelectorAll(".picker-item"));
    if (!buttons.length) return;

    // Spaltenzahl aus dem tatsaechlichen Layout ableiten, damit ↑/↓ stimmen
    var perRow = 1;
    if (buttons.length > 1) {
      var top = buttons[0].offsetTop;
      perRow = buttons.filter(function (button) { return button.offsetTop === top; }).length || 1;
    }

    var index = buttons.indexOf(document.activeElement);
    var next = null;

    if (event.key === "ArrowRight") next = index + 1;
    else if (event.key === "ArrowLeft") next = index - 1;
    else if (event.key === "ArrowDown") next = index < 0 ? 0 : index + perRow;
    else if (event.key === "ArrowUp") next = index - perRow;
    else if (event.key === "Enter" && index < 0) next = 0;
    else return;

    event.preventDefault();
    if (next === null) return;
    next = Math.max(0, Math.min(buttons.length - 1, next));

    if (event.key === "Enter") buttons[next].click();
    else buttons[next].focus();
  }

  function open(options) {
    if (!overlay) build();
    current = options.current || null;
    onPick = options.onPick;
    activeSet = (current && current.set) || options.preferredSet || "lucide";
    if (!Icons.sets[activeSet]) activeSet = "lucide";

    lastFocused = document.activeElement;
    input.value = "";
    input.placeholder = translate("searchIcons");
    paintTabs();
    paintGrid();

    overlay.hidden = false;
    document.body.classList.add("picker-open");
    input.focus();
  }

  function hide() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("picker-open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  global.RickCVIconPicker = { open: open, hide: hide, setTranslator: setTranslator };
})(typeof window !== "undefined" ? window : this);
