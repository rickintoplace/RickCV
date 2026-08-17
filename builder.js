/*  builder.js – Der Editor. Baut die Formulare, haelt den Zustand und
 *  schickt ihn bei jeder Aenderung an die Vorschau im iframe.
 *
 *  Klassisches Script (kein Modul), damit index.html auch per Doppelklick
 *  ohne Webserver funktioniert.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "rickcv.data.v2";
  var state = null;
  var frame = null;
  var frameReady = false;
  var history = [];
  var historyTimer = null;
  var pendingSnapshot = null;
  var committed = "";

  /* =============================================================== Werkzeuge */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function get(object, path) {
    return path.split(".").reduce(function (current, key) {
      return current === null || current === undefined ? undefined : current[key];
    }, object);
  }

  function set(object, path, value) {
    var keys = path.split(".");
    var last = keys.pop();
    var target = keys.reduce(function (current, key) {
      if (current[key] === null || current[key] === undefined) current[key] = {};
      return current[key];
    }, object);
    target[last] = value;
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  // Fehlende Felder aus den Standardwerten ergaenzen, damit aeltere
  // gespeicherte Staende nach einem Update weiterhin vollstaendig sind.
  function fillMissing(target, defaults) {
    Object.keys(defaults).forEach(function (key) {
      var fallback = defaults[key];
      if (target[key] === undefined || target[key] === null) {
        target[key] = clone(fallback);
      } else if (
        typeof fallback === "object" &&
        !Array.isArray(fallback) &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
        fillMissing(target[key], fallback);
      }
    });
    return target;
  }

  var toastTimer = null;
  function toast(message) {
    var node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove("visible");
    }, 2200);
  }

  /* ================================================================ Zustand */

  function load() {
    var data = null;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) data = JSON.parse(stored);
    } catch (error) {
      console.warn("Gespeicherte Daten konnten nicht gelesen werden:", error);
    }
    return fillMissing(data || clone(window.RickCVDefaults), window.RickCVDefaults);
  }

  var save = debounce(function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      document.getElementById("status").textContent = "Gespeichert";
    } catch (error) {
      // Meist ein zu grosses Profilbild fuer den Browser-Speicher.
      document.getElementById("status").textContent =
        "Nicht gespeichert (Speicher voll)";
    }
  }, 500);

  //  Vor einer Aenderungsserie den bisherigen Stand merken und ihn erst
  //  ablegen, wenn 600 ms lang nichts mehr passiert ist. So wird aus dem
  //  Tippen eines Wortes ein einziger Undo-Schritt.
  function pushHistory() {
    if (pendingSnapshot === null) pendingSnapshot = committed;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(function () {
      var current = JSON.stringify(state);
      if (pendingSnapshot !== null && pendingSnapshot !== current) {
        history.push(pendingSnapshot);
        if (history.length > 40) history.shift();
      }
      pendingSnapshot = null;
      committed = current;
    }, 600);
  }

  function undo() {
    if (!history.length) {
      toast("Nichts zum Rückgängigmachen");
      return;
    }
    clearTimeout(historyTimer);
    pendingSnapshot = null;
    state = JSON.parse(history.pop());
    committed = JSON.stringify(state);
    buildEditor();
    sendToPreview();
    save();
    toast("Rückgängig gemacht");
  }

  /* =============================================================== Vorschau */

  var sendToPreview = debounce(function () {
    if (!frameReady || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "rickcv:data", data: state }, "*");
  }, 120);

  function changed(structural) {
    pushHistory();
    sendToPreview();
    save();
    document.getElementById("status").textContent = "…";
    if (structural) updateCounts();
  }

  /* ======================================================= Formularbausteine */

  var MATERIAL_ICONS = [
    "school", "work", "volunteer_activism", "star", "home", "mail", "phone",
    "location_on", "person", "badge", "engineering", "science", "computer",
    "code", "terminal", "design_services", "brush", "palette", "camera_alt",
    "movie", "music_note", "headphones", "sports_soccer", "sports_esports",
    "stadia_controller", "fitness_center", "directions_bike", "directions_run",
    "hiking", "sailing", "flight", "train", "directions_car_filled",
    "two_wheeler", "local_shipping", "restaurant", "local_cafe", "wine_bar",
    "liquor", "nutrition", "spa", "recycling", "eco", "park", "pets",
    "cruelty_free", "agriculture", "construction", "handyman", "build",
    "factory", "storefront", "shopping_cart", "attach_money", "savings",
    "trending_up", "insights", "analytics", "database", "cloud", "security",
    "lock", "vpn_key", "support_agent", "groups", "diversity_3", "handshake",
    "campaign", "record_voice_over", "translate", "menu_book", "auto_stories",
    "history_edu", "psychology", "medical_services", "health_and_safety",
    "local_hospital", "gavel", "account_balance", "apartment", "public",
    "language", "emoji_objects", "lightbulb", "auto_fix_high", "extension",
    "rocket_launch", "military_tech", "workspace_premium", "verified",
    "mindfulness", "self_improvement", "theater_comedy", "piano",
    "sports_martial_arts", "counter_9", "hive", "diamond", "celebration",
  ];

  var COLOR_SWATCHES = [
    "#286f6f", "#128c7f", "#357f2d", "#2f5d8c", "#3f4a8a",
    "#7a3f8a", "#a8432f", "#b3792b", "#4a4a52", "#1f2933",
  ];

  var SHADE_OPTIONS = [
    { value: "var(--accent-color)", label: "Akzentfarbe" },
    { value: "var(--accent-color-shade0)", label: "Akzent – sehr hell" },
    { value: "var(--accent-color-shade1)", label: "Akzent – hell" },
    { value: "var(--accent-color-shade2)", label: "Akzent – dunkel" },
    { value: "var(--accent-color-shade3)", label: "Akzent – sehr dunkel" },
    { value: "custom", label: "Eigene Farbe …" },
  ];

  function fieldWrap(label, control, className) {
    var wrap = el("div", "field" + (className ? " " + className : ""));
    if (label) wrap.appendChild(el("label", null, label));
    wrap.appendChild(control);
    return wrap;
  }

  function text(path, label, placeholder) {
    var input = el("input");
    input.type = "text";
    input.value = get(state, path) || "";
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener("input", function () {
      set(state, path, input.value);
      changed();
    });
    return fieldWrap(label, input);
  }

  function textarea(path, label, rows, placeholder) {
    var input = el("textarea");
    input.rows = rows || 4;
    input.value = get(state, path) || "";
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener("input", function () {
      set(state, path, input.value);
      changed();
    });
    return fieldWrap(label, input);
  }

  // Textfeld, bei dem jede Zeile einem Eintrag im Array entspricht.
  function lines(path, label, placeholder) {
    var input = el("textarea");
    input.rows = 3;
    input.placeholder = placeholder || "Eine Zeile pro Eintrag";
    input.value = (get(state, path) || []).join("\n");
    input.addEventListener("input", function () {
      set(
        state,
        path,
        input.value.split("\n").filter(function (line) {
          return line.trim() !== "";
        })
      );
      changed();
    });
    return fieldWrap(label, input);
  }

  function toggle(path, label) {
    var wrap = el("div", "field-toggle");
    var input = el("input");
    input.type = "checkbox";
    input.checked = !!get(state, path);
    input.id = "t-" + path.replace(/\./g, "-");
    var caption = el("label", null, label);
    caption.setAttribute("for", input.id);
    input.addEventListener("change", function () {
      set(state, path, input.checked);
      changed();
    });
    wrap.appendChild(input);
    wrap.appendChild(caption);
    return wrap;
  }

  function select(path, label, options) {
    var input = el("select");
    options.forEach(function (option) {
      var node = el("option", null, option.label);
      node.value = option.value;
      input.appendChild(node);
    });
    input.value = get(state, path);
    input.addEventListener("change", function () {
      var value = input.value;
      if (value === "true") value = true;
      else if (value === "false") value = false;
      set(state, path, value);
      changed();
    });
    return fieldWrap(label, input);
  }

  function number(path, label, min, max, step) {
    var input = el("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step || 1;
    input.value = get(state, path);
    input.addEventListener("input", function () {
      set(state, path, input.value === "" ? 0 : Number(input.value));
      changed();
    });
    return fieldWrap(label, input);
  }

  function range(path, label, min, max, step, unit, onInput) {
    var wrap = el("div", "field field-range");
    var head = el("div", "range-head");
    head.appendChild(el("label", null, label));
    var output = el("output", null, get(state, path) + (unit || ""));
    head.appendChild(output);
    wrap.appendChild(head);

    var input = el("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = get(state, path);
    input.addEventListener("input", function () {
      var value = Number(input.value);
      set(state, path, value);
      output.textContent = value + (unit || "");
      if (onInput) onInput(value);
      changed();
    });
    wrap.appendChild(input);
    return wrap;
  }

  function color(path, label, withSwatches) {
    var wrap = el("div", "field");
    if (label) wrap.appendChild(el("label", null, label));

    var row = el("div", "color-input");
    var picker = el("input");
    picker.type = "color";
    var hex = el("input");
    hex.type = "text";
    hex.spellcheck = false;

    var current = get(state, path) || "#000000";
    picker.value = current;
    hex.value = current;

    function apply(value) {
      set(state, path, value);
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

    row.appendChild(picker);
    row.appendChild(hex);
    wrap.appendChild(row);

    if (withSwatches) {
      var swatches = el("div", "swatches");
      COLOR_SWATCHES.forEach(function (value) {
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
      wrap.appendChild(swatches);
    }
    return wrap;
  }

  function iconField(path, label) {
    var wrap = el("div", "field");
    if (label) wrap.appendChild(el("label", null, label));

    var row = el("div", "icon-input");
    var preview = el("span", "icon-preview");
    var glyph = el("span", "material-symbols-outlined", get(state, path) || "");
    preview.appendChild(glyph);

    var input = el("input");
    input.type = "text";
    input.setAttribute("list", "material-icons");
    input.placeholder = "z. B. school";
    input.value = get(state, path) || "";
    input.addEventListener("input", function () {
      set(state, path, input.value.trim());
      glyph.textContent = input.value.trim();
      changed();
    });

    row.appendChild(preview);
    row.appendChild(input);
    wrap.appendChild(row);
    return wrap;
  }

  // Farbe eines Zeitleisten-Eintrags: Schattierung der Akzentfarbe oder frei.
  function shadeField(path, label) {
    var wrap = el("div", "field");
    wrap.appendChild(el("label", null, label));

    var current = get(state, path) || SHADE_OPTIONS[0].value;
    var isPreset = SHADE_OPTIONS.some(function (option) {
      return option.value === current;
    });

    var picker = el("select");
    SHADE_OPTIONS.forEach(function (option) {
      var node = el("option", null, option.label);
      node.value = option.value;
      picker.appendChild(node);
    });
    picker.value = isPreset ? current : "custom";

    var custom = el("input");
    custom.type = "color";
    custom.style.marginTop = "8px";
    custom.value = isPreset ? "#286f6f" : current;
    custom.style.display = isPreset ? "none" : "block";

    picker.addEventListener("change", function () {
      if (picker.value === "custom") {
        custom.style.display = "block";
        set(state, path, custom.value);
      } else {
        custom.style.display = "none";
        set(state, path, picker.value);
      }
      changed();
    });
    custom.addEventListener("input", function () {
      set(state, path, custom.value);
      changed();
    });

    wrap.appendChild(picker);
    wrap.appendChild(custom);
    return wrap;
  }

  function row() {
    var wrap = el("div", "field-row");
    Array.prototype.forEach.call(arguments, function (field) {
      wrap.appendChild(field);
    });
    return wrap;
  }

  function hint(message) {
    return el("p", "hint", message);
  }

  /* ================================================================= Listen */

  /*  Baut einen Listeneditor mit Hinzufuegen, Loeschen, Duplizieren und
   *  Verschieben. `config.body(index)` liefert die Felder eines Eintrags.
   */
  function listEditor(config) {
    var container = el("div", "list-editor");

    function rebuild() {
      container.innerHTML = "";
      var items = get(state, config.path) || [];

      if (!items.length) {
        container.appendChild(
          el("div", "empty-note", config.emptyText || "Noch keine Einträge.")
        );
      }

      items.forEach(function (item, index) {
        var details = el("details", "list-item");
        if (config.openFirst && index === 0 && items.length === 1) {
          details.open = true;
        }

        var summary = el("summary");
        summary.appendChild(
          el("span", "list-item-title", config.title(item, index) || "(ohne Titel)")
        );
        if (config.badge) {
          var badgeText = config.badge(item, index);
          if (badgeText) summary.appendChild(el("span", "list-item-badge", badgeText));
        }

        var actions = el("div", "list-actions");
        actions.appendChild(
          iconButton("↑", "Nach oben", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (index === 0) return;
            items.splice(index - 1, 0, items.splice(index, 1)[0]);
            rebuild();
            changed(true);
          })
        );
        actions.appendChild(
          iconButton("↓", "Nach unten", function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (index === items.length - 1) return;
            items.splice(index + 1, 0, items.splice(index, 1)[0]);
            rebuild();
            changed(true);
          })
        );
        actions.appendChild(
          iconButton("⧉", "Duplizieren", function (event) {
            event.preventDefault();
            event.stopPropagation();
            items.splice(index + 1, 0, clone(item));
            rebuild();
            changed(true);
          })
        );
        var remove = iconButton("✕", "Löschen", function (event) {
          event.preventDefault();
          event.stopPropagation();
          items.splice(index, 1);
          rebuild();
          changed(true);
        });
        remove.classList.add("btn-danger");
        actions.appendChild(remove);
        summary.appendChild(actions);

        details.appendChild(summary);
        var body = el("div", "list-item-body");
        config.body(body, index, config.path + "." + index, function () {
          // Titel in der Kopfzeile mitziehen lassen
          summary.querySelector(".list-item-title").textContent =
            config.title(items[index], index) || "(ohne Titel)";
          if (config.badge) {
            var badge = summary.querySelector(".list-item-badge");
            if (badge) badge.textContent = config.badge(items[index], index) || "";
          }
        });
        details.appendChild(body);
        container.appendChild(details);
      });

      var addRow = el("div", "add-row");
      var add = el("button", "btn btn-small", "+ " + (config.addLabel || "Eintrag hinzufügen"));
      add.type = "button";
      add.addEventListener("click", function () {
        (get(state, config.path) || []).push(clone(config.blank));
        rebuild();
        var last = container.querySelectorAll(".list-item");
        if (last.length) last[last.length - 1].open = true;
        changed(true);
      });
      addRow.appendChild(add);
      container.appendChild(addRow);
    }

    rebuild();
    return container;
  }

  function iconButton(label, title, handler) {
    var button = el("button", "btn btn-icon", label);
    button.type = "button";
    button.title = title;
    button.addEventListener("click", handler);
    return button;
  }

  /* ============================================================ Bild-Editor */

  function readImageFile(file, callback) {
    if (!file || !/^image\//.test(file.type)) {
      toast("Bitte eine Bilddatei auswählen");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      shrinkImage(String(reader.result), callback);
    };
    reader.readAsDataURL(file);
  }

  /*  Grosse Fotos werden auf max. 900px verkleinert. Das haelt den
   *  Browser-Speicher frei und reicht fuer den Druck vollkommen aus.
   */
  function shrinkImage(dataUrl, callback) {
    var image = new Image();
    image.onload = function () {
      var max = 900;
      var scale = Math.min(1, max / Math.max(image.width, image.height));
      if (scale === 1 && dataUrl.length < 700000) {
        callback(dataUrl);
        return;
      }
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = function () {
      callback(dataUrl);
    };
    image.src = dataUrl;
  }

  function photoEditor() {
    var wrap = el("div");

    // Ablage- und Auswahlflaeche
    var drop = el("div", "drop-zone", "Foto hierher ziehen oder klicken zum Auswählen");
    var picker = el("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.style.display = "none";

    drop.addEventListener("click", function () {
      picker.click();
    });
    picker.addEventListener("change", function () {
      readImageFile(picker.files[0], function (dataUrl) {
        state.photo.src = dataUrl;
        state.photo.show = true;
        rebuildSection("photo");
        changed();
      });
    });
    ["dragenter", "dragover"].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.add("over");
      });
    });
    ["dragleave", "drop"].forEach(function (type) {
      drop.addEventListener(type, function (event) {
        event.preventDefault();
        drop.classList.remove("over");
      });
    });
    drop.addEventListener("drop", function (event) {
      var file = event.dataTransfer.files[0];
      readImageFile(file, function (dataUrl) {
        state.photo.src = dataUrl;
        state.photo.show = true;
        rebuildSection("photo");
        changed();
      });
    });

    wrap.appendChild(drop);
    wrap.appendChild(picker);

    // Ausschnitt-Editor: ziehen verschiebt, Mausrad zoomt
    var editorRow = el("div", "photo-editor");
    var stage = el("div", "photo-stage");
    var controls = el("div", "photo-controls");

    var image = null;
    if (state.photo.src) {
      image = el("img");
      image.src = state.photo.src;
      image.alt = "Profilbild";
      stage.appendChild(image);
    } else {
      stage.appendChild(el("div", "photo-stage-empty", "kein Foto"));
    }

    function syncStage() {
      var photo = state.photo;
      // Seitenverhaeltnis des echten Bildbereichs nachbilden
      var widthCm =
        photo.shape === "band" ? (21 * state.style.sidebarWidth) / 100 : photo.height;
      stage.style.height = (150 * photo.height) / widthCm + "px";
      stage.classList.toggle("is-circle", photo.shape === "circle");
      if (image) {
        image.style.objectPosition = photo.posX + "% " + photo.posY + "%";
        image.style.transform = "scale(" + photo.scale + ")";
      }
    }

    // Verschieben des Bildausschnitts
    var dragging = false;
    var lastX = 0;
    var lastY = 0;

    stage.addEventListener("pointerdown", function (event) {
      if (!state.photo.src) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.classList.add("dragging");
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      var rect = stage.getBoundingClientRect();
      // Empfindlichkeit: eine volle Bildbreite entspricht 100 %
      var stepX = (100 * (event.clientX - lastX)) / Math.max(40, rect.width);
      var stepY = (100 * (event.clientY - lastY)) / Math.max(40, rect.height);
      lastX = event.clientX;
      lastY = event.clientY;
      state.photo.posX = Math.round(Math.max(0, Math.min(100, state.photo.posX - stepX)));
      state.photo.posY = Math.round(Math.max(0, Math.min(100, state.photo.posY - stepY)));
      syncStage();
      if (posXRange) posXRange.value = state.photo.posX;
      if (posYRange) posYRange.value = state.photo.posY;
      changed();
    });

    ["pointerup", "pointercancel"].forEach(function (type) {
      stage.addEventListener(type, function () {
        dragging = false;
        stage.classList.remove("dragging");
      });
    });

    stage.addEventListener(
      "wheel",
      function (event) {
        if (!state.photo.src) return;
        event.preventDefault();
        var next = state.photo.scale + (event.deltaY < 0 ? 0.05 : -0.05);
        state.photo.scale = Math.round(Math.max(1, Math.min(3, next)) * 100) / 100;
        syncStage();
        if (scaleRange) {
          scaleRange.value = state.photo.scale;
          scaleRange.parentNode.querySelector("output").textContent =
            state.photo.scale + "×";
        }
        changed();
      },
      { passive: false }
    );

    // Regler neben dem Ausschnitt
    var shapeSelect = select("photo.shape", "Form", [
      { value: "band", label: "Band über die volle Breite" },
      { value: "rounded", label: "Abgerundetes Quadrat" },
      { value: "circle", label: "Kreis" },
    ]);
    shapeSelect.querySelector("select").addEventListener("change", function () {
      syncStage();
      // Der Regler fuer die Eckenrundung gilt nur fuer "Abgerundetes Quadrat".
      setTimeout(function () {
        rebuildSection("photo");
      }, 0);
    });
    controls.appendChild(shapeSelect);

    var heightRange = range("photo.height", "Größe", 3, 12, 0.1, " cm", syncStage);
    controls.appendChild(heightRange);

    var scaleField = range("photo.scale", "Zoom", 1, 3, 0.01, "×", syncStage);
    var scaleRange = scaleField.querySelector("input");
    controls.appendChild(scaleField);

    editorRow.appendChild(stage);
    editorRow.appendChild(controls);
    wrap.appendChild(editorRow);
    wrap.appendChild(
      hint("Im Bild ziehen verschiebt den Ausschnitt, Mausrad zoomt.")
    );

    var posXField = range("photo.posX", "Ausschnitt horizontal", 0, 100, 1, " %", syncStage);
    var posXRange = posXField.querySelector("input");
    var posYField = range("photo.posY", "Ausschnitt vertikal", 0, 100, 1, " %", syncStage);
    var posYRange = posYField.querySelector("input");
    wrap.appendChild(row(posXField, posYField));

    if (state.photo.shape === "rounded") {
      wrap.appendChild(range("photo.radius", "Eckenrundung", 0, 60, 1, " px", syncStage));
    }

    var reset = el("button", "btn btn-small", "Ausschnitt zurücksetzen");
    reset.type = "button";
    reset.addEventListener("click", function () {
      state.photo.posX = 50;
      state.photo.posY = 50;
      state.photo.scale = 1;
      rebuildSection("photo");
      changed();
    });

    var remove = el("button", "btn btn-small btn-danger", "Foto entfernen");
    remove.type = "button";
    remove.addEventListener("click", function () {
      state.photo.src = "";
      rebuildSection("photo");
      changed();
    });

    var buttons = el("div", "add-row");
    buttons.appendChild(reset);
    buttons.appendChild(remove);
    wrap.appendChild(buttons);

    var url = text("photo.src", "…oder Bild-Adresse (URL)", "https://…");
    url.querySelector("input").addEventListener("change", function () {
      rebuildSection("photo");
    });
    wrap.appendChild(url);

    syncStage();
    return wrap;
  }

  /* ============================================================== Abschnitte */

  var SECTIONS = [
    {
      id: "person",
      title: "Person & Kontakt",
      open: true,
      build: function (body) {
        body.appendChild(row(text("contact.name", "Name"), text("contact.role", "Rolle / Beruf")));
        body.appendChild(row(text("contact.address", "Straße"), text("contact.city", "PLZ & Ort")));
        body.appendChild(row(text("contact.email", "E-Mail"), text("contact.phone", "Telefon")));
        body.appendChild(text("sectionTitles.contact", "Überschrift des Kontaktblocks"));
      },
    },
    {
      id: "photo",
      title: "Profilbild",
      build: function (body) {
        body.appendChild(toggle("photo.show", "Profilbild anzeigen"));
        body.appendChild(photoEditor());
      },
    },
    {
      id: "profile",
      title: "Kurzprofil",
      build: function (body) {
        body.appendChild(toggle("profile.show", "Kurzprofil anzeigen"));
        body.appendChild(text("profile.title", "Überschrift"));
        body.appendChild(
          textarea("profile.text", "Text", 5, "Zwei bis drei Sätze über dich.")
        );
      },
    },
    {
      id: "events",
      title: "Werdegang",
      count: function () {
        return state.events.length;
      },
      build: function (body) {
        body.appendChild(
          hint(
            "Ausbildung, Berufserfahrung und Ehrenamt in einer Liste. " +
              "Die Zuordnung steuert, in welchem Block der Eintrag erscheint."
          )
        );
        body.appendChild(
          listEditor({
            path: "events",
            addLabel: "Station hinzufügen",
            emptyText: "Noch keine Stationen im Werdegang.",
            blank: {
              title: "Neue Station",
              start: "01/2020",
              end: "01/2022",
              present: false,
              icon: "work",
              color: "var(--accent-color-shade2)",
              company: "",
              place: "",
              description: [],
              list: [],
              kind: "experience",
              hideline: false,
              hoffset: 0,
              voffset: 0,
            },
            title: function (item) {
              return item.title;
            },
            badge: function (item) {
              return item.start + " – " + (item.present ? "heute" : item.end);
            },
            body: function (container, index, path, refresh) {
              var titleField = text(path + ".title", "Titel");
              titleField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(titleField);

              container.appendChild(
                select(path + ".kind", "Zuordnung", [
                  { value: "experience", label: "Berufserfahrung" },
                  { value: "education", label: "Ausbildung / Schule / Studium" },
                  { value: "volunteer", label: "Ehrenamt" },
                ])
              );

              var startField = text(path + ".start", "Von (MM/JJJJ)", "07/2019");
              var endField = text(path + ".end", "Bis (MM/JJJJ)", "09/2021");
              startField.querySelector("input").addEventListener("input", refresh);
              endField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(row(startField, endField));

              var presentToggle = toggle(path + ".present", "läuft bis heute");
              presentToggle.querySelector("input").addEventListener("change", refresh);
              container.appendChild(presentToggle);

              container.appendChild(
                row(text(path + ".company", "Firma / Schule"), text(path + ".place", "Ort"))
              );
              container.appendChild(
                lines(path + ".description", "Beschreibung", "Eine Zeile pro Punkt")
              );
              container.appendChild(
                lines(path + ".list", "Aufgaben / Details", "Eine Zeile pro Stichpunkt")
              );

              container.appendChild(row(iconField(path + ".icon", "Symbol"), shadeField(path + ".color", "Farbe")));

              var advanced = el("details", "list-item");
              advanced.appendChild(el("summary", null, "Feinjustierung"));
              var advancedBody = el("div", "list-item-body");
              advancedBody.appendChild(toggle(path + ".hideline", "Verbindungslinie ausblenden"));
              advancedBody.appendChild(
                row(
                  number(path + ".hoffset", "Einrückung (px)", -100, 200, 1),
                  number(path + ".voffset", "Höhe verschieben (px)", -200, 200, 1)
                )
              );
              advanced.appendChild(advancedBody);
              container.appendChild(advanced);
            },
          })
        );

        body.appendChild(el("hr"));
        body.appendChild(
          row(
            text("sectionTitles.education", "Überschrift Ausbildung"),
            iconField("sectionIcons.education", "Symbol")
          )
        );
        body.appendChild(
          row(
            text("sectionTitles.experience", "Überschrift Berufserfahrung"),
            iconField("sectionIcons.experience", "Symbol")
          )
        );
        body.appendChild(
          row(
            text("sectionTitles.volunteer", "Überschrift Ehrenamt"),
            iconField("sectionIcons.volunteer", "Symbol")
          )
        );
      },
    },
    {
      id: "skills",
      title: "Kenntnisse",
      count: function () {
        return state.skills.items.length;
      },
      build: function (body) {
        body.appendChild(toggle("skills.show", "Kenntnisse anzeigen"));
        body.appendChild(row(text("skills.title", "Überschrift"), iconField("skills.icon", "Symbol")));
        body.appendChild(
          listEditor({
            path: "skills.items",
            addLabel: "Kenntnis hinzufügen",
            blank: { name: "Neue Kenntnis", rank: 3 },
            title: function (item) {
              return item.name;
            },
            badge: function (item) {
              return item.rank + "/5";
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Bezeichnung");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
              var rankField = range(path + ".rank", "Ausprägung", 0.5, 5, 0.5, " / 5");
              rankField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(rankField);
            },
          })
        );
      },
    },
    {
      id: "languages",
      title: "Sprachen",
      count: function () {
        return state.languages.items.length;
      },
      build: function (body) {
        body.appendChild(toggle("languages.show", "Sprachen anzeigen"));
        body.appendChild(text("languages.title", "Überschrift"));
        body.appendChild(
          listEditor({
            path: "languages.items",
            addLabel: "Sprache hinzufügen",
            blank: { name: "Neue Sprache", percentage: 60, level: "B2" },
            title: function (item) {
              return item.name;
            },
            badge: function (item) {
              return item.level || item.percentage + " %";
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Sprache");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
              container.appendChild(
                range(path + ".percentage", "Balkenlänge", 0, 100, 5, " %")
              );
              var levelField = text(path + ".level", "Niveau (optional)", "z. B. B2");
              levelField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(levelField);
            },
          })
        );
      },
    },
    {
      id: "interests",
      title: "Interessen",
      count: function () {
        return state.interests.items.length;
      },
      build: function (body) {
        body.appendChild(toggle("interests.show", "Interessen anzeigen"));
        body.appendChild(text("interests.title", "Überschrift"));
        body.appendChild(
          listEditor({
            path: "interests.items",
            addLabel: "Interesse hinzufügen",
            blank: { name: "Neues Interesse", icon: "star" },
            title: function (item) {
              return item.name;
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Bezeichnung");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
              container.appendChild(iconField(path + ".icon", "Symbol"));
            },
          })
        );
      },
    },
    {
      id: "mobility",
      title: "Mobilität",
      build: function (body) {
        body.appendChild(hint("Führerschein, Reisebereitschaft, Umzugsbereitschaft …"));
        body.appendChild(toggle("mobility.show", "Auf der Hauptseite anzeigen"));
        body.appendChild(row(text("mobility.title", "Überschrift"), iconField("mobility.icon", "Symbol")));
        body.appendChild(
          listEditor({
            path: "mobility.items",
            addLabel: "Eintrag hinzufügen",
            blank: { name: "Führerschein Klasse B" },
            title: function (item) {
              return item.name;
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Bezeichnung");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
            },
          })
        );
        body.appendChild(el("hr"));
        body.appendChild(toggle("mobilitySB.show", "Zusätzlich in der Seitenleiste anzeigen"));
        body.appendChild(text("mobilitySB.title", "Überschrift in der Seitenleiste"));
        body.appendChild(
          listEditor({
            path: "mobilitySB.items",
            addLabel: "Eintrag hinzufügen",
            blank: { name: "Führerschein Klasse B", icon: "directions_car_filled" },
            title: function (item) {
              return item.name;
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Bezeichnung");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
              container.appendChild(iconField(path + ".icon", "Symbol"));
            },
          })
        );
      },
    },
    {
      id: "projects",
      title: "Projekte",
      count: function () {
        return state.projects.items.length;
      },
      build: function (body) {
        body.appendChild(toggle("projects.show", "Projekte anzeigen"));
        body.appendChild(text("projects.title", "Überschrift"));
        body.appendChild(
          listEditor({
            path: "projects.items",
            addLabel: "Projekt hinzufügen",
            blank: { name: "Neues Projekt", img: "", url: "", description: "" },
            title: function (item) {
              return item.name;
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Name");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
              container.appendChild(text(path + ".description", "Kurzbeschreibung"));
              container.appendChild(text(path + ".url", "Link", "https://…"));
              container.appendChild(imageField(path + ".img", "Bild"));
            },
          })
        );
      },
    },
    {
      id: "letter",
      title: "Anschreiben",
      build: function (body) {
        body.appendChild(toggle("settings.showCoverLetter", "Anschreiben erzeugen"));
        body.appendChild(
          textarea("coverLetter.recipient", "Empfänger", 4, "Firma\nAnsprechpartner\nStraße\nPLZ Ort")
        );
        body.appendChild(row(text("coverLetter.place", "Ort"), text("coverLetter.date", "Datum")));
        body.appendChild(text("coverLetter.subject", "Betreff"));
        body.appendChild(text("coverLetter.salutation", "Anrede"));
        body.appendChild(
          listEditor({
            path: "coverLetter.paragraphs",
            addLabel: "Absatz hinzufügen",
            blank: "",
            emptyText: "Noch keine Absätze.",
            title: function (item, index) {
              var preview = String(item || "").slice(0, 40);
              return "Absatz " + (index + 1) + (preview ? ": " + preview + "…" : "");
            },
            body: function (container, index, path, refresh) {
              var field = textarea(path, "Text", 4);
              field.querySelector("textarea").addEventListener("input", refresh);
              container.appendChild(field);
            },
          })
        );
        body.appendChild(text("coverLetter.closing", "Grußformel"));
        body.appendChild(imageField("coverLetter.signatureImg", "Unterschrift (Bild)"));
        body.appendChild(
          range("coverLetter.signatureHeight", "Höhe der Unterschrift", 1, 5, 0.1, " Zeilen")
        );
        body.appendChild(
          select("settings.alignText", "Textausrichtung", [
            { value: "left", label: "Linksbündig (besser lesbar)" },
            { value: "justify", label: "Blocksatz" },
          ])
        );
      },
    },
    {
      id: "design",
      title: "Design",
      build: function (body) {
        body.appendChild(
          select("settings.template", "Layout", [
            { value: "clean", label: "Clean – aufgeräumt" },
            { value: "icons", label: "Icons – mit Symbolen" },
            { value: "dynaline", label: "Dynaline – mit Zeitachse" },
          ])
        );
        body.appendChild(
          select(
            "style.fontFamily",
            "Schriftart",
            (window.RickCVRender ? window.RickCVRender.fonts : ["Open Sans"]).map(function (name) {
              return { value: name, label: name };
            })
          )
        );
        body.appendChild(color("style.accentColor", "Akzentfarbe", true));
        body.appendChild(
          select("style.sidebarMode", "Seitenleiste", [
            { value: "light", label: "Hell (aus Akzentfarbe abgeleitet)" },
            { value: "dark", label: "Dunkel (aus Akzentfarbe abgeleitet)" },
            { value: "custom", label: "Eigene Farbe" },
          ])
        );
        body.appendChild(color("style.sidebarColor", "Farbe der Seitenleiste (bei „Eigene Farbe“)"));
        body.appendChild(row(color("style.fontColor", "Schriftfarbe"), color("style.backgroundColor", "Seitenhintergrund")));
        body.appendChild(color("style.sidebarFontColor", "Schriftfarbe Seitenleiste"));
        body.appendChild(range("style.sidebarWidth", "Breite der Seitenleiste", 20, 50, 1, " %"));
        body.appendChild(
          row(
            range("style.titleSize", "Größe des Namens", 18, 48, 1, " px"),
            range("style.headlineSize", "Größe der Überschriften", 11, 24, 1, " px")
          )
        );
        body.appendChild(color("style.emptyColor", "Farbe leerer Skill-Punkte"));
        body.appendChild(range("style.border", "Rand um die Seite", 0, 15, 0.5, " mm"));
        body.appendChild(el("hr"));
        body.appendChild(hint("Anschreiben nach DIN 5008: links 2,5 cm, rechts 2 cm, unten 2 cm."));
        body.appendChild(
          row(
            number("style.leftMargin", "Rand links (cm)", 0, 6, 0.1),
            number("style.rightMargin", "Rand rechts (cm)", 0, 6, 0.1)
          )
        );
        body.appendChild(
          row(
            number("style.bottomMargin", "Rand unten (cm)", 0, 6, 0.1),
            number("style.headerHeight", "Höhe der Kopfzeile (em)", 4, 20, 0.5)
          )
        );
      },
    },
    {
      id: "options",
      title: "Optionen",
      build: function (body) {
        body.appendChild(
          select("settings.dateFormat", "Datumsformat", [
            { value: "short", label: "MM/JJ (kompakt)" },
            { value: "full", label: "MM/JJJJ (ausgeschrieben)" },
          ])
        );
        body.appendChild(toggle("settings.reverseTimeline", "Neueste Station zuerst"));
        body.appendChild(toggle("settings.separateEducation", "Ausbildung als eigenen Block zeigen"));
        body.appendChild(toggle("settings.separateVolunteer", "Ehrenamt als eigenen Block zeigen"));
        body.appendChild(toggle("settings.noLine", "Verbindungslinien komplett ausblenden"));
        body.appendChild(el("hr"));
        body.appendChild(toggle("settings.activateATS", "ATS-Fassung einbetten"));
        body.appendChild(
          hint(
            "Legt eine winzige, maschinenlesbare Kopie deiner Daten ins PDF. " +
              "Bewerbungssysteme können sie auslesen, im Ausdruck fällt sie kaum auf."
          )
        );
        body.appendChild(
          listEditor({
            path: "references",
            addLabel: "Referenz hinzufügen",
            blank: { name: "Auf Anfrage verfügbar" },
            emptyText: "Keine Referenzen hinterlegt.",
            title: function (item) {
              return item.name;
            },
            body: function (container, index, path, refresh) {
              var nameField = text(path + ".name", "Referenz");
              nameField.querySelector("input").addEventListener("input", refresh);
              container.appendChild(nameField);
            },
          })
        );
      },
    },
  ];

  // Bildfeld mit Upload oder URL – fuer Projekte und Unterschrift.
  function imageField(path, label) {
    var wrap = el("div", "field");
    wrap.appendChild(el("label", null, label));

    var input = el("input");
    input.type = "text";
    input.placeholder = "https://… oder Datei wählen";
    var current = get(state, path) || "";
    input.value = /^data:/.test(current) ? "(hochgeladenes Bild)" : current;
    input.addEventListener("input", function () {
      set(state, path, input.value);
      changed();
    });

    var picker = el("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.style.display = "none";
    picker.addEventListener("change", function () {
      readImageFile(picker.files[0], function (dataUrl) {
        set(state, path, dataUrl);
        input.value = "(hochgeladenes Bild)";
        changed();
      });
    });

    var button = el("button", "btn btn-small", "Datei…");
    button.type = "button";
    button.addEventListener("click", function () {
      picker.click();
    });

    var group = el("div", "color-input");
    group.appendChild(input);
    group.appendChild(button);
    group.appendChild(picker);
    wrap.appendChild(group);
    return wrap;
  }

  /* ============================================================ Editor bauen */

  function rebuildSection(id) {
    var section = SECTIONS.filter(function (item) {
      return item.id === id;
    })[0];
    var node = document.querySelector('[data-section="' + id + '"] .section-body');
    if (!section || !node) return;
    node.innerHTML = "";
    section.build(node);
  }

  function updateCounts() {
    SECTIONS.forEach(function (section) {
      if (!section.count) return;
      var badge = document.querySelector('[data-section="' + section.id + '"] .section-count');
      if (badge) badge.textContent = section.count();
    });
  }

  function buildEditor() {
    var editor = document.getElementById("editor");
    var openState = {};
    editor.querySelectorAll(".section").forEach(function (node) {
      openState[node.dataset.section] = node.open;
    });
    editor.innerHTML = "";

    SECTIONS.forEach(function (section) {
      var details = el("details", "section");
      details.dataset.section = section.id;
      details.open =
        openState[section.id] !== undefined ? openState[section.id] : !!section.open;

      var summary = el("summary");
      summary.appendChild(el("span", null, section.title));
      if (section.count) {
        summary.appendChild(el("span", "section-count", String(section.count())));
      }
      details.appendChild(summary);

      var body = el("div", "section-body");
      section.build(body);
      details.appendChild(body);
      editor.appendChild(details);
    });
  }

  /* ============================================================ Kopfzeilen-UI */

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function slug(value) {
    return (
      String(value || "lebenslauf")
        .toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "lebenslauf"
    );
  }

  function exportJson() {
    download(slug(state.contact.name) + ".rickcv.json", JSON.stringify(state, null, 2), "application/json");
    toast("Daten exportiert");
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        history.push(committed);
        state = fillMissing(data, window.RickCVDefaults);
        committed = JSON.stringify(state);
        buildEditor();
        sendToPreview();
        save();
        toast("Daten importiert");
      } catch (error) {
        toast("Datei konnte nicht gelesen werden");
      }
    };
    reader.readAsText(file);
  }

  function printCv() {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: "rickcv:print" }, "*");
    toast("Im Druckdialog: A4, Ränder „Keine“, Hintergrundgrafiken an");
  }

  /* ========================================================== Vorschau-Zoom */

  var previewHeight = 1200;
  var zoomMode = "fit";

  function applyZoom() {
    var scroll = document.getElementById("preview-scroll");
    var canvas = document.getElementById("preview-canvas");
    var stage = document.getElementById("preview-stage");

    var available = scroll.clientWidth - 32;
    var scale = zoomMode === "fit" ? Math.min(1, available / 820) : Number(zoomMode);

    stage.style.transform = "scale(" + scale + ")";
    canvas.style.width = 820 * scale + "px";
    canvas.style.height = previewHeight * scale + "px";
    frame.style.height = previewHeight + "px";
  }

  /* ================================================================== Start */

  function init() {
    state = load();
    committed = JSON.stringify(state);
    frame = document.getElementById("preview-frame");

    // Icon-Vorschlagsliste
    var datalist = document.getElementById("material-icons");
    MATERIAL_ICONS.forEach(function (name) {
      var option = el("option");
      option.value = name;
      datalist.appendChild(option);
    });

    window.addEventListener("message", function (event) {
      var message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "rickcv:ready") {
        frameReady = true;
        frame.contentWindow.postMessage({ type: "rickcv:data", data: state }, "*");
      } else if (message.type === "rickcv:height") {
        previewHeight = Math.max(600, message.height);
        applyZoom();
        document.getElementById("status").textContent = "Gespeichert";
      } else if (message.type === "rickcv:error") {
        document.getElementById("status").textContent = "Fehler: " + message.message;
      }
    });

    buildEditor();

    // Kopfzeile
    document.getElementById("btn-print").addEventListener("click", printCv);
    document.getElementById("btn-export").addEventListener("click", exportJson);
    document.getElementById("btn-import").addEventListener("click", function () {
      document.getElementById("import-file").click();
    });
    document.getElementById("import-file").addEventListener("change", function (event) {
      if (event.target.files[0]) importJson(event.target.files[0]);
      event.target.value = "";
    });
    document.getElementById("btn-example").addEventListener("click", function () {
      history.push(committed);
      state = clone(window.RickCVDefaults);
      committed = JSON.stringify(state);
      buildEditor();
      sendToPreview();
      save();
      toast("Beispiel geladen");
    });
    document.getElementById("btn-reset").addEventListener("click", function () {
      if (!confirm("Alle Eingaben löschen und leer neu beginnen?")) return;
      history.push(committed);
      state = emptyState();
      committed = JSON.stringify(state);
      buildEditor();
      sendToPreview();
      save();
      toast("Neu begonnen");
    });
    document.getElementById("btn-open").addEventListener("click", function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        /* Vorschau nutzt dann die zuletzt gespeicherten Daten */
      }
      window.open("cv.html", "_blank");
    });

    document.getElementById("zoom").addEventListener("change", function (event) {
      zoomMode = event.target.value;
      applyZoom();
    });

    // Umschalter fuer schmale Bildschirme
    document.getElementById("tab-edit").addEventListener("click", function () {
      document.body.classList.remove("show-preview");
    });
    document.getElementById("tab-preview").addEventListener("click", function () {
      document.body.classList.add("show-preview");
    });

    // Breite des Editors ziehen
    var resizer = document.getElementById("resizer");
    var resizing = false;
    resizer.addEventListener("pointerdown", function (event) {
      resizing = true;
      resizer.setPointerCapture(event.pointerId);
    });
    resizer.addEventListener("pointermove", function (event) {
      if (!resizing) return;
      var width = Math.max(300, Math.min(window.innerWidth * 0.7, event.clientX));
      document.documentElement.style.setProperty("--ui-sidebar-w", width + "px");
      applyZoom();
    });
    ["pointerup", "pointercancel"].forEach(function (type) {
      resizer.addEventListener(type, function () {
        resizing = false;
      });
    });

    window.addEventListener("resize", debounce(applyZoom, 100));

    document.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        var tag = (event.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return; // dort gilt die Browser-Undo
        event.preventDefault();
        undo();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        printCv();
      }
    });

    applyZoom();
  }

  function emptyState() {
    var empty = clone(window.RickCVDefaults);
    empty.contact = { name: "", role: "", address: "", city: "", email: "", phone: "" };
    empty.profile.text = "";
    empty.photo.src = "";
    empty.events = [];
    empty.skills.items = [];
    empty.languages.items = [];
    empty.interests.items = [];
    empty.projects.items = [];
    empty.mobility.items = [];
    empty.mobilitySB.items = [];
    empty.coverLetter.recipient = "";
    empty.coverLetter.subject = "";
    empty.coverLetter.paragraphs = [""];
    empty.coverLetter.signatureImg = "";
    return empty;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
