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
  //  Vor einem Eingriff in eine Liste die laufende Tipp-Serie abschliessen:
  //  sonst naehme Rueckgaengig das Loeschen und das eben Getippte in einem
  //  Schritt zurueck.
  var commit = function () {};
  //  Eine Meldung mit Rueckweg, etwa nach dem Loeschen eines Eintrags.
  var notify = function () {};

  function configure(options) {
    state = options.state;
    onChange = options.onChange;
    translate = options.t;
    if (options.commit) commit = options.commit;
    if (options.notify) notify = options.notify;
  }

  function uiIcon(name) {
    return global.RickCVUi ? global.RickCVUi.icon(name) : "";
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

  //  Ein Theme bringt oft eine eigene Palette mit (Terminal etwa eine dunkle
  //  Seitenspalte). Damit die Farbwahl im Editor trotzdem etwas bewirkt,
  //  merken wir uns, welche Farbe jemand tatsaechlich angefasst hat – der
  //  Renderer setzt genau diese am <body>, wo sie gegen das Theme gewinnt.
  var OWN_COLOR = {
    "style.accentColor": "accent",
    "style.fontColor": "font",
    "style.backgroundColor": "background",
    "style.sidebarColor": "sidebar",
    "style.sidebarMode": "sidebar",
    "style.sidebarFontColor": "sidebarFont",
    "style.emptyColor": "empty",
  };

  function set(path, value) {
    if (OWN_COLOR[path] && state && state.style) {
      if (!state.style.ownColors) state.style.ownColors = {};
      state.style.ownColors[OWN_COLOR[path]] = true;
    }
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

  //  Jedes Eingabefeld bekommt eine Kennung, damit seine Beschriftung auf
  //  es zeigen kann. Ohne diese Verbindung las ein Bildschirmleser bei den
  //  meisten Feldern nur "Eingabefeld" vor – ohne zu sagen, wofuer.
  var fieldCount = 0;

  function idFor(control) {
    if (!control.id) control.id = "f-" + (++fieldCount);
    return control.id;
  }

  function labelFor(text, control) {
    var label = el("label", null, text);
    if (control) label.htmlFor = idFor(control);
    return label;
  }

  //  Welches Element die Beschriftung meint: das Feld selbst oder, wenn es
  //  ein Behaelter ist, das erste Eingabeelement darin.
  function firstControl(node) {
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(node.tagName)) return node;
    return node.querySelector("input:not([type=hidden]):not([hidden]), select, textarea, button");
  }

  function wrap(label, control, className) {
    var field = el("div", "field" + (className ? " " + className : ""));
    if (label) field.appendChild(labelFor(label, firstControl(control)));
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

  //  Dasselbe Feld kann an zwei Stellen im Editor stehen – Ort und Datum
  //  etwa im Anschreiben und unter der Fusszeile. Getippt wird in eines,
  //  nachgezogen werden beide; sonst zeigt das andere noch den alten Wert,
  //  und wer dort weitertippt, ueberschreibt den neuen.
  function mirror(path, value, source) {
    var others = document.querySelectorAll('[data-path="' + path + '"]');
    Array.prototype.forEach.call(others, function (node) {
      if (node !== source && node.value !== value) node.value = value;
    });
  }

  //  Adressen und Telefonnummern bekommen ihre eigene Tastatur und das
  //  Ausfuellen des Browsers. Der Typ bleibt "text", wo die Pruefung des
  //  Browsers im Weg waere – eine Telefonnummer mit Leerzeichen etwa.
  var INPUT_HINTS = {
    "contact.name": { autocomplete: "name" },
    "contact.role": { autocomplete: "organization-title" },
    "contact.address": { autocomplete: "street-address" },
    "contact.city": { autocomplete: "address-level2" },
    "contact.email": { type: "email", autocomplete: "email", inputmode: "email" },
    "contact.phone": { type: "tel", autocomplete: "tel", inputmode: "tel" },
  };

  function text(path, label, placeholder) {
    var input = el("input");
    input.type = "text";
    var extra = INPUT_HINTS[path];
    if (extra) {
      if (extra.type) input.type = extra.type;
      if (extra.autocomplete) input.autocomplete = extra.autocomplete;
      if (extra.inputmode) input.setAttribute("inputmode", extra.inputmode);
    }
    input.value = get(path) || "";
    input.dataset.path = path;
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener("input", function () {
      set(path, input.value);
      mirror(path, input.value, input);
      changed();
    });
    return wrap(label, input);
  }

  function textarea(path, label, rows, placeholder) {
    var input = el("textarea");
    input.dataset.path = path;
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
    input.dataset.path = path;
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
    input.dataset.path = path;
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
    var input = el("input");
    head.appendChild(labelFor(label, input));
    var output = el("output", null, get(path) + (unit || ""));
    output.htmlFor = idFor(input);
    head.appendChild(output);
    field.appendChild(head);

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

  //  Alle anderen Farbfelder mit demselben Pfad auf den neuen Wert bringen.
  function syncColor(path, value, source) {
    var fields = document.querySelectorAll('.field[data-path="' + path + '"]');
    Array.prototype.forEach.call(fields, function (field) {
      if (field === source) return;
      Array.prototype.forEach.call(field.querySelectorAll("input"), function (input) {
        input.value = value;
      });
    });
  }

  function color(path, label, withSwatches) {
    var field = el("div", "field");
    var group = el("div", "color-input");
    var picker = el("input");
    picker.type = "color";
    var hex = el("input");
    hex.type = "text";
    hex.spellcheck = false;
    if (label) {
      field.appendChild(labelFor(label, picker));
      //  Zwei Felder, eine Farbe: das Textfeld sagt, dass es der Hexwert ist.
      hex.setAttribute("aria-label", label + " (Hex)");
    }

    var current = get(path) || "#000000";
    picker.value = current;
    hex.value = current;
    //  Dieselbe Farbe kann an zwei Stellen im Formular stehen (die
    //  Akzentfarbe etwa unter Design und unter Themes). Der Pfad am Feld
    //  laesst die eine Stelle die andere nachziehen, ohne dass ein
    //  Abschnitt neu gebaut werden muss.
    field.dataset.path = path;
    picker.dataset.path = path;
    hex.dataset.path = path;

    function apply(value) {
      set(path, value);
      syncColor(path, value, field);
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
        button.setAttribute("aria-label", (label ? label + ": " : "") + value);
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
    var button = el("button", "icon-button");
    button.type = "button";
    if (label) field.appendChild(labelFor(label, button));

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
    var picker = el("select");
    field.appendChild(labelFor(label, picker));

    var current = get(path) || SHADES[0].value;
    var preset = SHADES.some(function (shade) { return shade.value === current; });

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
    custom.setAttribute("aria-label", label + " – " + translate("customColor"));
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

  /*  Ein Bild in kleinerer Groesse als data:-Adresse.
   *
   *  JPEG kennt keine Transparenz: was durchsichtig war, kam frueher
   *  schwarz heraus – eine eingescannte Unterschrift mit freigestelltem
   *  Hintergrund stand dann als schwarzer Kasten unter dem Anschreiben.
   *  Traegt das Bild Transparenz, bleibt es deshalb ein PNG; sonst wird es
   *  auf Weiss gelegt und als JPEG gepackt, das ist bei Fotos ein
   *  Bruchteil der Groesse.
   */
  function encodeImage(image, width, height, quality) {
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    var context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (hasTransparency(context, canvas.width, canvas.height)) {
      return canvas.toDataURL("image/png");
    }
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }

  function hasTransparency(context, width, height) {
    var pixels;
    try {
      pixels = context.getImageData(0, 0, width, height).data;
    } catch (error) {
      return false; // fremde Herkunft: dann eben JPEG
    }
    for (var i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 250) return true;
    }
    return false;
  }

  /*  Grosse Fotos werden verkleinert: das haelt den Browser-Speicher frei
   *  und reicht fuer den Druck vollkommen aus.
   */
  function shrinkImage(dataUrl, callback) {
    var image = new Image();
    image.onload = function () {
      var max = 900;
      var scale = Math.min(1, max / Math.max(image.width, image.height));
      if (scale === 1 && dataUrl.length < 700000) return callback(dataUrl);
      callback(encodeImage(image, image.width * scale, image.height * scale, 0.88));
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

  //  Ein Bild im Dokument: hochladen oder entfernen. Eine Adresse im Netz
  //  laesst sich nicht mehr eintragen – RickCV laedt solche Bilder nicht
  //  (RickCVModel.isLocalImage). Steht aus einem aelteren Dokument noch
  //  eine da, sagt das Feld es, statt ein kaputtes Bild zu zeigen.
  function imageField(path, label) {
    var field = el("div", "field");
    var status = el("span", "image-status");
    var picker = el("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.hidden = true;

    var button = el("button", "btn btn-small", translate("chooseFile"));
    button.type = "button";
    button.addEventListener("click", function () { picker.click(); });
    field.appendChild(labelFor(label, button));

    var remove = el("button", "btn btn-small btn-danger-ghost", translate("removeImage"));
    remove.type = "button";

    function paint() {
      var current = get(path) || "";
      var local = global.RickCVModel.isLocalImage(current);
      status.textContent = !current ? translate("noImage")
        : local ? translate("uploadedImage") : translate("remoteImage");
      status.classList.toggle("image-status-warn", !!current && !local);
      remove.hidden = !current;
    }

    picker.addEventListener("change", function () {
      readImageFile(picker.files[0], function (dataUrl) {
        set(path, dataUrl);
        paint();
        changed();
      });
      picker.value = "";
    });
    remove.addEventListener("click", function () {
      set(path, "");
      paint();
      changed();
    });

    var group = el("div", "image-input");
    group.appendChild(status);
    group.appendChild(button);
    group.appendChild(remove);
    group.appendChild(picker);
    field.appendChild(group);
    paint();
    return field;
  }

  /* ----------------------------------------------------------- Listeneditor */

  //  Ein Knopf, der nur ein Symbol zeigt. Sein Name steht in aria-label und
  //  im Titel – sonst hoerte man nur "Taste".
  function iconButton(label, title, handler, icon) {
    var button = el("button", "btn btn-icon", icon ? undefined : label);
    button.type = "button";
    if (icon) button.innerHTML = uiIcon(icon);
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", handler);
    return button;
  }

  var listCount = 0;

  /*  Liste mit Hinzufuegen, Loeschen, Duplizieren und Verschieben.
   *
   *  config:
   *    path, blank, title(item, i), body(container, i, path, refresh)
   *    subtitle(item, i)  – zweite Zeile unter dem Titel (optional)
   *    badge(item, i)     – kurze Angabe rechts (optional)
   *    movable            – false: keine Pfeile, die Reihenfolge ergibt sich
   *    order(list)        – Reihenfolge der Anzeige als Liste von Indizes
   *    duplicate, confirmRemove, addLabel, emptyText
   *
   *  Frueher standen die Knoepfe im <summary> eines <details>. Das ist
   *  verschachtelte Bedienung, die Vorlesesoftware zu einem Knaeuel
   *  zusammenzieht, und jeder Neuaufbau klappte alle Eintraege zu und warf
   *  den Fokus auf die Seite zurueck. Jetzt oeffnet ein eigener Knopf den
   *  Eintrag, die Aktionen stehen daneben, und Aufklappzustand wie Fokus
   *  ueberstehen das Verschieben.
   */
  function listEditor(config) {
    var container = el("div", "list-editor");
    container.dataset.path = config.path;
    var id = "list-" + (++listCount);
    var open = [];   // parallel zur Liste: welcher Eintrag aufgeklappt ist
    var movable = config.movable !== false;

    function list() {
      return get(config.path) || [];
    }

    function label(item, index) {
      return config.title(item, index) || translate("untitled");
    }

    //  Nach dem Neuaufbau dorthin zurueck, wo man war.
    function focusLater(index, action) {
      var entry = container.querySelector('.list-item[data-index="' + index + '"]');
      var target = entry && (action
        ? entry.querySelector('[data-action="' + action + '"]:not(:disabled)')
        : null);
      if (!target && entry) target = entry.querySelector(".list-item-toggle");
      if (!target) target = container.querySelector(".add-row .btn");
      if (target) target.focus();
    }

    function structural(fn) {
      commit();
      fn();
      rebuild();
      changed(true);
    }

    function rebuild() {
      container.textContent = "";
      var items = list();
      while (open.length < items.length) open.push(false);
      open.length = items.length;

      if (!items.length) {
        container.appendChild(el("div", "empty-note", config.emptyText || translate("noEntries")));
      }

      var order = config.order ? config.order(items)
        : items.map(function (item, index) { return index; });

      order.forEach(function (index, position) {
        var item = items[index];
        var entry = el("div", "list-item");
        entry.dataset.index = String(index);

        var head = el("div", "list-item-head");
        var toggle = el("button", "list-item-toggle");
        toggle.type = "button";
        var bodyId = id + "-" + index;
        toggle.setAttribute("aria-controls", bodyId);

        var chevron = el("span", "list-item-chevron");
        chevron.innerHTML = uiIcon("chevron-right");
        chevron.setAttribute("aria-hidden", "true");
        toggle.appendChild(chevron);

        var text = el("span", "list-item-text");
        var title = el("span", "list-item-title", label(item, index));
        text.appendChild(title);
        var subtitle = null;
        if (config.subtitle) {
          subtitle = el("span", "list-item-sub", config.subtitle(item, index) || "");
          text.appendChild(subtitle);
        }
        toggle.appendChild(text);

        var badge = null;
        if (config.badge) {
          badge = el("span", "list-item-badge", config.badge(item, index) || "");
          toggle.appendChild(badge);
        }
        head.appendChild(toggle);

        var actions = el("div", "list-actions");
        if (movable) {
          var up = iconButton("↑", translate("moveUp"), function () {
            structural(function () {
              items.splice(index - 1, 0, items.splice(index, 1)[0]);
              open.splice(index - 1, 0, open.splice(index, 1)[0]);
            });
            focusLater(index - 1, "up");
          }, "arrow-up");
          up.dataset.action = "up";
          up.disabled = position === 0;
          actions.appendChild(up);

          var down = iconButton("↓", translate("moveDown"), function () {
            structural(function () {
              items.splice(index + 1, 0, items.splice(index, 1)[0]);
              open.splice(index + 1, 0, open.splice(index, 1)[0]);
            });
            focusLater(index + 1, "down");
          }, "arrow-down");
          down.dataset.action = "down";
          down.disabled = position === order.length - 1;
          actions.appendChild(down);
        }
        if (config.duplicate !== false) {
          var copy = iconButton("⧉", translate("duplicate"), function () {
            structural(function () {
              items.splice(index + 1, 0, JSON.parse(JSON.stringify(item)));
              open.splice(index + 1, 0, false);
            });
            focusLater(index + 1);
          }, "copy");
          actions.appendChild(copy);
        }
        var remove = iconButton("✕", translate("remove"), function () {
          //  Die Rueckfrage darf ein Dialog sein, der erst spaeter antwortet.
          var allowed = config.confirmRemove ? config.confirmRemove(item, index) : true;
          Promise.resolve(allowed).then(function (yes) {
            if (!yes) return;
            var name = typeof item === "string" ? "" : config.title(item, index);
            structural(function () {
              items.splice(index, 1);
              open.splice(index, 1);
            });
            notify(name ? translate("removedNamed").replace("{name}", name)
                        : translate("removedEntry"));
            var next = order[position + 1] !== undefined ? order[position + 1] : order[position - 1];
            if (next !== undefined && next > index) next -= 1;
            focusLater(next);
          });
        }, "trash");
        remove.classList.add("btn-danger");
        actions.appendChild(remove);
        head.appendChild(actions);
        entry.appendChild(head);

        var body = el("div", "list-item-body");
        body.id = bodyId;
        body.setAttribute("role", "region");
        body.setAttribute("aria-label", label(item, index));

        //  Der Inhalt entsteht erst beim ersten Aufklappen: acht Stationen
        //  mit je fuenfzehn Feldern wollen nicht bei jedem Neuaufbau gebaut
        //  werden, solange sie niemand ansieht.
        var built = false;
        function show(state) {
          open[index] = state;
          toggle.setAttribute("aria-expanded", String(state));
          entry.classList.toggle("is-open", state);
          body.hidden = !state;
          if (state && !built) {
            built = true;
            config.body(body, index, config.path + "." + index, function () {
              var fresh = list()[index];
              title.textContent = label(fresh, index);
              body.setAttribute("aria-label", label(fresh, index));
              if (subtitle) subtitle.textContent = config.subtitle(fresh, index) || "";
              if (badge) badge.textContent = config.badge(fresh, index) || "";
            });
          }
        }
        toggle.addEventListener("click", function () { show(!open[index]); });
        show(!!open[index]);

        entry.appendChild(body);
        container.appendChild(entry);
      });

      var addRow = el("div", "add-row");
      var add = el("button", "btn btn-small btn-add");
      add.type = "button";
      add.innerHTML = uiIcon("plus");
      add.appendChild(el("span", null, config.addLabel || translate("addEntry")));
      add.addEventListener("click", function () {
        var blank = typeof config.blank === "function" ? config.blank() : config.blank;
        var index = list().length;
        structural(function () {
          get(config.path).push(JSON.parse(JSON.stringify(blank)));
          open[index] = true;
        });
        //  Gleich ins erste Feld des neuen Eintrags.
        var entry = container.querySelector('.list-item[data-index="' + index + '"]');
        var first = entry && entry.querySelector(".list-item-body input, .list-item-body textarea");
        if (first) first.focus();
        if (entry && entry.scrollIntoView) entry.scrollIntoView({ block: "nearest" });
      });
      addRow.appendChild(add);
      container.appendChild(addRow);
    }

    rebuild();
    container.rebuild = rebuild;
    //  Einen Eintrag von aussen aufklappen – die Vorschau fuehrt so direkt
    //  zu einer Station. Gibt den Eintrag zurueck.
    container.openItem = function (index) {
      var entry = container.querySelector('.list-item[data-index="' + index + '"]');
      if (!entry) return null;
      if (!open[index]) entry.querySelector(".list-item-toggle").click();
      return entry;
    };
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
    encodeImage: encodeImage,
    iconButton: iconButton,
  };
})(typeof window !== "undefined" ? window : this);
