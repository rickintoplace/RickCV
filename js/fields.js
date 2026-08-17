/*  fields.js – Bausteine fuer die Editor-Formulare.
 *
 *  Jede Funktion liefert ein fertiges DOM-Element, das an einem Pfad im
 *  Datenobjekt haengt ("contact.name", "events.3.title"). Aenderungen melden
 *  sich ueber den Rueckruf, den `configure()` bekommt – so weiss dieses Modul
 *  nichts von Speichern, Vorschau oder Verlauf.
 */
(function (global) {
  "use strict";

  var Icons = global.RickCVIconLib;

  var state = null;      // aktuelles Datenobjekt
  var onChange = null;   // (structural) => void
  var translate = function (key) { return key; };

  function configure(options) {
    state = options.state;
    onChange = options.onChange;
    translate = options.t;
  }

  function setState(next) {
    state = next;
  }

  /* ---------------------------------------------------------------- Pfade */

  function get(path) {
    return path.split(".").reduce(function (current, key) {
      return current === null || current === undefined ? undefined : current[key];
    }, state);
  }

  function set(path, value) {
    var keys = path.split(".");
    var last = keys.pop();
    var target = keys.reduce(function (current, key) {
      if (current[key] === null || current[key] === undefined) current[key] = {};
      return current[key];
    }, state);
    target[last] = value;
  }

  function changed(structural) {
    if (onChange) onChange(structural);
  }

  /* ------------------------------------------------------------- Elemente */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function wrap(label, control, className) {
    var field = el("div", "field" + (className ? " " + className : ""));
    if (label) field.appendChild(el("label", null, label));
    field.appendChild(control);
    return field;
  }

  function row() {
    var node = el("div", "field-row");
    Array.prototype.forEach.call(arguments, function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function hint(message) {
    return el("p", "hint", message);
  }

  function note(message, tone) {
    return el("p", "note note-" + (tone || "info"), message);
  }

  /* ------------------------------------------------------------- Eingaben */

  function text(path, label, placeholder) {
    var input = el("input");
    input.type = "text";
    input.value = get(path) || "";
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener("input", function () {
      set(path, input.value);
      changed();
    });
    return wrap(label, input);
  }

  function textarea(path, label, rows, placeholder) {
    var input = el("textarea");
    input.rows = rows || 4;
    input.value = get(path) || "";
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener("input", function () {
      set(path, input.value);
      changed();
    });
    return wrap(label, input);
  }

  /* Textfeld, bei dem jede Zeile einem Eintrag im Array entspricht. */
  function lines(path, label, placeholder) {
    var input = el("textarea");
    input.rows = 3;
    input.placeholder = placeholder || "";
    input.value = (get(path) || []).join("\n");
    input.addEventListener("input", function () {
      set(path, input.value.split("\n").filter(function (line) {
        return line.trim() !== "";
      }));
      changed();
    });
    return wrap(label, input);
  }

  function toggle(path, label) {
    var field = el("div", "field-toggle");
    var input = el("input");
    input.type = "checkbox";
    input.checked = !!get(path);
    input.id = "t-" + path.replace(/\./g, "-") + "-" + Math.random().toString(36).slice(2, 7);
    var caption = el("label", null, label);
    caption.setAttribute("for", input.id);
    input.addEventListener("change", function () {
      set(path, input.checked);
      changed();
    });
    field.appendChild(input);
    field.appendChild(caption);
    return field;
  }

  function select(path, label, options) {
    var input = el("select");
    options.forEach(function (option) {
      var node = el("option", null, option.label);
      node.value = option.value;
      input.appendChild(node);
    });
    input.value = get(path);
    input.addEventListener("change", function () {
      set(path, input.value);
      changed();
    });
    return wrap(label, input);
  }

  function number(path, label, min, max, step) {
    var input = el("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step || 1;
    input.value = get(path);
    input.addEventListener("input", function () {
      set(path, input.value === "" ? 0 : Number(input.value));
      changed();
    });
    return wrap(label, input);
  }

  function range(path, label, min, max, step, unit, onInput) {
    var field = el("div", "field field-range");
    var head = el("div", "range-head");
    head.appendChild(el("label", null, label));
    var output = el("output", null, get(path) + (unit || ""));
    head.appendChild(output);
    field.appendChild(head);

    var input = el("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = get(path);
    input.addEventListener("input", function () {
      var value = Number(input.value);
      set(path, value);
      output.textContent = value + (unit || "");
      if (onInput) onInput(value);
      changed();
    });
    field.appendChild(input);
    return field;
  }

  var SWATCHES = [
    "#286f6f", "#128c7f", "#357f2d", "#2f5d8c", "#3f4a8a",
    "#7a3f8a", "#a8432f", "#b3792b", "#4a4a52", "#1f2933",
  ];

  function color(path, label, withSwatches) {
    var field = el("div", "field");
    if (label) field.appendChild(el("label", null, label));

    var group = el("div", "color-input");
    var picker = el("input");
    picker.type = "color";
    var hex = el("input");
    hex.type = "text";
    hex.spellcheck = false;

    var current = get(path) || "#000000";
    picker.value = current;
    hex.value = current;

    function apply(value) {
      set(path, value);
      changed();
    }
    picker.addEventListener("input", function () {
      hex.value = picker.value;
      apply(picker.value);
    });
    hex.addEventListener("input", function () {
      if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
        picker.value = hex.value;
        apply(hex.value);
      }
    });

    group.appendChild(picker);
    group.appendChild(hex);
    field.appendChild(group);

    if (withSwatches) {
      var swatches = el("div", "swatches");
      SWATCHES.forEach(function (value) {
        var button = el("button", "swatch");
        button.type = "button";
        button.style.background = value;
        button.title = value;
        button.addEventListener("click", function () {
          picker.value = value;
          hex.value = value;
          apply(value);
        });
        swatches.appendChild(button);
      });
      field.appendChild(swatches);
    }
    return field;
  }

  /* ---------------------------------------------------------- Icon-Auswahl */

  function iconField(path, label) {
    var field = el("div", "field");
    if (label) field.appendChild(el("label", null, label));

    var button = el("button", "icon-button");
    button.type = "button";

    function paint() {
      var value = Icons.normalize(get(path));
      button.innerHTML = "";
      var preview = el("span", "icon-button-preview");
      preview.innerHTML = Icons.html(value);
      button.appendChild(preview);
      button.appendChild(el("span", "icon-button-name", value.name || translate("icon")));
    }

    button.addEventListener("click", function () {
      global.RickCVIconPicker.open({
        current: Icons.normalize(get(path)),
        preferredSet: state.style.iconSet,
        onPick: function (value) {
          set(path, value);
          paint();
          changed();
        },
      });
    });

    paint();
    field.appendChild(button);
    return field;
  }

  /* Farbe eines Zeitleisten-Eintrags: Schattierung der Akzentfarbe oder frei. */
  var SHADES = [
    { value: "var(--accent-color)", key: "shadeAccent" },
    { value: "var(--accent-color-shade0)", key: "shadeLightest" },
    { value: "var(--accent-color-shade1)", key: "shadeLight" },
    { value: "var(--accent-color-shade2)", key: "shadeDark" },
    { value: "var(--accent-color-shade3)", key: "shadeDarkest" },
  ];

  function shadeField(path, label) {
    var field = el("div", "field");
    field.appendChild(el("label", null, label));

    var current = get(path) || SHADES[0].value;
    var preset = SHADES.some(function (shade) { return shade.value === current; });

    var picker = el("select");
    SHADES.forEach(function (shade) {
      var option = el("option", null, translate(shade.key));
      option.value = shade.value;
      picker.appendChild(option);
    });
    var customOption = el("option", null, translate("customColor"));
    customOption.value = "custom";
    picker.appendChild(customOption);
    picker.value = preset ? current : "custom";

    var custom = el("input");
    custom.type = "color";
    custom.className = "shade-custom";
    custom.value = preset ? "#286f6f" : current;
    custom.hidden = preset;

    picker.addEventListener("change", function () {
      var isCustom = picker.value === "custom";
      custom.hidden = !isCustom;
      set(path, isCustom ? custom.value : picker.value);
      changed();
    });
    custom.addEventListener("input", function () {
      set(path, custom.value);
      changed();
    });

    field.appendChild(picker);
    field.appendChild(custom);
    return field;
  }

  /* ------------------------------------------------------------ Bildfelder */

  /*  Grosse Fotos werden verkleinert: das haelt den Browser-Speicher frei
   *  und reicht fuer den Druck vollkommen aus.
   */
  function shrinkImage(dataUrl, callback) {
    var image = new Image();
    image.onload = function () {
      var max = 900;
      var scale = Math.min(1, max / Math.max(image.width, image.height));
      if (scale === 1 && dataUrl.length < 700000) return callback(dataUrl);

      var canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = function () { callback(dataUrl); };
    image.src = dataUrl;
  }

  function readImageFile(file, callback) {
    if (!file || !/^image\//.test(file.type)) {
      global.RickCVToast(translate("pickImage"));
      return;
    }
    var reader = new FileReader();
    reader.onload = function () { shrinkImage(String(reader.result), callback); };
    reader.readAsDataURL(file);
  }

  function imageField(path, label) {
    var field = el("div", "field");
    field.appendChild(el("label", null, label));

    var input = el("input");
    input.type = "text";
    input.placeholder = "https://…";
    var current = get(path) || "";
    input.value = /^data:/.test(current) ? translate("uploadedImage") : current;
    input.addEventListener("input", function () {
      set(path, input.value);
      changed();
    });

    var picker = el("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.hidden = true;
    picker.addEventListener("change", function () {
      readImageFile(picker.files[0], function (dataUrl) {
        set(path, dataUrl);
        input.value = translate("uploadedImage");
        changed();
      });
    });

    var button = el("button", "btn btn-small", translate("chooseFile"));
    button.type = "button";
    button.addEventListener("click", function () { picker.click(); });

    var group = el("div", "color-input");
    group.appendChild(input);
    group.appendChild(button);
    group.appendChild(picker);
    field.appendChild(group);
    return field;
  }

  /* ----------------------------------------------------------- Listeneditor */

  function iconButton(label, title, handler) {
    var button = el("button", "btn btn-icon", label);
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", handler);
    return button;
  }

  /*  Liste mit Hinzufuegen, Loeschen, Duplizieren und Verschieben.
   *  `config.body(container, index, path, refresh)` fuellt einen Eintrag.
   */
  function listEditor(config) {
    var container = el("div", "list-editor");

    function rebuild() {
      container.innerHTML = "";
      var list = get(config.path) || [];

      if (!list.length) {
        container.appendChild(el("div", "empty-note", config.emptyText || translate("noEntries")));
      }

      list.forEach(function (item, index) {
        var entry = el("details", "list-item");
        var summary = el("summary");

        var title = el("span", "list-item-title", config.title(item, index) || translate("untitled"));
        summary.appendChild(title);

        var badge = null;
        if (config.badge) {
          badge = el("span", "list-item-badge", config.badge(item, index) || "");
          summary.appendChild(badge);
        }

        var actions = el("div", "list-actions");
        actions.appendChild(iconButton("↑", translate("moveUp"), function (event) {
          event.preventDefault(); event.stopPropagation();
          if (index === 0) return;
          list.splice(index - 1, 0, list.splice(index, 1)[0]);
          rebuild(); changed(true);
        }));
        actions.appendChild(iconButton("↓", translate("moveDown"), function (event) {
          event.preventDefault(); event.stopPropagation();
          if (index === list.length - 1) return;
          list.splice(index + 1, 0, list.splice(index, 1)[0]);
          rebuild(); changed(true);
        }));
        if (config.duplicate !== false) {
          actions.appendChild(iconButton("⧉", translate("duplicate"), function (event) {
            event.preventDefault(); event.stopPropagation();
            list.splice(index + 1, 0, JSON.parse(JSON.stringify(item)));
            rebuild(); changed(true);
          }));
        }
        var remove = iconButton("✕", translate("remove"), function (event) {
          event.preventDefault(); event.stopPropagation();
          if (config.confirmRemove && !config.confirmRemove(item, index)) return;
          list.splice(index, 1);
          rebuild(); changed(true);
        });
        remove.classList.add("btn-danger");
        actions.appendChild(remove);
        summary.appendChild(actions);
        entry.appendChild(summary);

        var body = el("div", "list-item-body");
        config.body(body, index, config.path + "." + index, function () {
          var fresh = get(config.path)[index];
          title.textContent = config.title(fresh, index) || translate("untitled");
          if (badge) badge.textContent = config.badge(fresh, index) || "";
        });
        entry.appendChild(body);
        container.appendChild(entry);
      });

      var addRow = el("div", "add-row");
      var add = el("button", "btn btn-small", "+ " + (config.addLabel || translate("addEntry")));
      add.type = "button";
      add.addEventListener("click", function () {
        var blank = typeof config.blank === "function" ? config.blank() : config.blank;
        get(config.path).push(JSON.parse(JSON.stringify(blank)));
        rebuild();
        var entries = container.querySelectorAll(".list-item");
        if (entries.length) entries[entries.length - 1].open = true;
        changed(true);
      });
      addRow.appendChild(add);
      container.appendChild(addRow);
    }

    rebuild();
    container.rebuild = rebuild;
    return container;
  }

  global.RickCVFields = {
    configure: configure,
    setState: setState,
    get: get,
    set: set,
    el: el,
    wrap: wrap,
    row: row,
    hint: hint,
    note: note,
    text: text,
    textarea: textarea,
    lines: lines,
    toggle: toggle,
    select: select,
    number: number,
    range: range,
    color: color,
    iconField: iconField,
    shadeField: shadeField,
    imageField: imageField,
    listEditor: listEditor,
    readImageFile: readImageFile,
    iconButton: iconButton,
  };
})(typeof window !== "undefined" ? window : this);
