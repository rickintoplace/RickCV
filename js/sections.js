/*  sections.js – Beschreibt die Abschnitte des Editors.
 *
 *  Jeder Abschnitt hat eine id, einen Titelschluessel und eine build()-
 *  Funktion, die ihre Felder in den uebergebenen Container haengt. Die
 *  Verkabelung (Zustand, Vorschau, Speichern) macht builder.js.
 */
(function (global) {
  "use strict";

  var F = global.RickCVFields;
  var Model = global.RickCVModel;
  var Ats = global.RickCVAts;

  function build(context) {
    var state = context.state;
    var t = context.t;
    var refreshSection = context.refreshSection;
    var onChange = context.onChange;
    var el = F.el;

    /* ------------------------------------------------------- Hilfsbausteine */

    function nameFirst(container, path, refresh, label) {
      var field = F.text(path + ".name", label || t("name"));
      field.querySelector("input").addEventListener("input", refresh);
      container.appendChild(field);
      return field;
    }

    //  Seitenauswahl. Sie erscheint nur, wenn es ueberhaupt eine zweite Seite
    //  gibt – sonst waere es eine Einstellung ohne Wirkung.
    function pageField(path) {
      if (state.settings.pageMode !== "two") return null;
      return F.select(path + ".page", t("pageField"), [
        { value: 1, label: t("page1") },
        { value: 2, label: t("page2") },
      ]);
    }

    //  F.select liefert Zeichenketten zurueck; die Seitenzahl soll aber eine
    //  Zahl bleiben, damit der Renderer nicht raten muss.
    function addPageField(body, path) {
      var field = pageField(path);
      if (!field) return;
      var input = field.querySelector("select");
      input.value = String(F.get(path + ".page") || 1);
      input.addEventListener("change", function () {
        F.set(path + ".page", Number(input.value));
      });
      body.appendChild(field);
    }

    function iconListEditor(path, addLabel, blankIcon) {
      return F.listEditor({
        path: path,
        addLabel: addLabel,
        blank: function () {
          return { name: "", icon: Model.icon(state.style.iconSet, blankIcon) };
        },
        title: function (item) { return item.name; },
        body: function (container, index, itemPath, refresh) {
          nameFirst(container, itemPath, refresh);
          container.appendChild(F.iconField(itemPath + ".icon", t("icon")));
        },
      });
    }

    /* -------------------------------------------------------------- Person */

    function buildPerson(body) {
      body.appendChild(F.row(
        F.text("contact.name", t("fieldName")),
        F.text("contact.role", t("fieldRole"))
      ));
      body.appendChild(F.row(
        F.text("contact.address", t("fieldStreet")),
        F.text("contact.city", t("fieldCity"))
      ));
      //  Das Feld fuer den eigenen Kartenlink erscheint nur, wenn es auch
      //  gebraucht wird – wie das Farbfeld im Abschnitt "Design".
      var mapToggle = F.toggle("contact.mapLink", t("mapLink"));
      mapToggle.querySelector("input").addEventListener("change", function () {
        setTimeout(function () { refreshSection("person"); }, 0);
      });
      body.appendChild(mapToggle);
      body.appendChild(F.hint(t("mapLinkHint")));

      if (state.contact.mapLink) {
        body.appendChild(F.text("contact.mapUrl", t("mapUrl")));
        body.appendChild(F.hint(t("mapUrlHint")));
      }
      body.appendChild(F.row(
        F.text("contact.email", t("fieldEmail")),
        F.text("contact.phone", t("fieldPhone"))
      ));
      body.appendChild(F.text("contactTitle", t("contactHeading")));
    }

    /* --------------------------------------------------------- Profilbild */

    function buildPhoto(body) {
      body.appendChild(F.toggle("photo.show", t("showPhoto")));

      var drop = el("div", "drop-zone", t("dropPhoto"));
      var picker = el("input");
      picker.type = "file";
      picker.accept = "image/*";
      picker.hidden = true;

      function accept(file) {
        F.readImageFile(file, function (dataUrl) {
          state.photo.src = dataUrl;
          state.photo.show = true;
          refreshSection("photo");
          context.onChange();
        });
      }

      drop.addEventListener("click", function () { picker.click(); });
      picker.addEventListener("change", function () { accept(picker.files[0]); });
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
      drop.addEventListener("drop", function (event) { accept(event.dataTransfer.files[0]); });

      body.appendChild(drop);
      body.appendChild(picker);

      // Ausschnitt-Editor
      var editorRow = el("div", "photo-editor");
      var stage = el("div", "photo-stage");
      var controls = el("div", "photo-controls");
      var image = null;

      if (state.photo.src) {
        image = el("img");
        image.src = state.photo.src;
        image.alt = "";
        stage.appendChild(image);
      } else {
        stage.appendChild(el("div", "photo-stage-empty", t("noPhoto")));
      }

      var posX, posY, scale;

      function sync() {
        var photo = state.photo;
        var widthCm = photo.shape === "band"
          ? (21 * state.style.sidebarWidth) / 100
          : photo.height;
        stage.style.height = (150 * photo.height) / widthCm + "px";
        stage.classList.toggle("is-circle", photo.shape === "circle");
        stage.style.borderRadius = photo.shape === "rounded" ? photo.radius + "px" : "";
        if (image) {
          image.style.objectPosition = photo.posX + "% " + photo.posY + "%";
          image.style.transform = "scale(" + photo.scale + ")";
        }
        if (posX) posX.value = photo.posX;
        if (posY) posY.value = photo.posY;
      }

      var dragging = false, lastX = 0, lastY = 0;

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
        var stepX = (100 * (event.clientX - lastX)) / Math.max(40, rect.width);
        var stepY = (100 * (event.clientY - lastY)) / Math.max(40, rect.height);
        lastX = event.clientX;
        lastY = event.clientY;
        state.photo.posX = Math.round(Math.max(0, Math.min(100, state.photo.posX - stepX)));
        state.photo.posY = Math.round(Math.max(0, Math.min(100, state.photo.posY - stepY)));
        sync();
        context.onChange();
      });
      ["pointerup", "pointercancel"].forEach(function (type) {
        stage.addEventListener(type, function () {
          dragging = false;
          stage.classList.remove("dragging");
        });
      });
      stage.addEventListener("wheel", function (event) {
        if (!state.photo.src) return;
        event.preventDefault();
        var next = state.photo.scale + (event.deltaY < 0 ? 0.05 : -0.05);
        state.photo.scale = Math.round(Math.max(1, Math.min(3, next)) * 100) / 100;
        sync();
        if (scale) {
          scale.value = state.photo.scale;
          scale.parentNode.querySelector("output").textContent = state.photo.scale + "×";
        }
        context.onChange();
      }, { passive: false });

      var shape = F.select("photo.shape", t("photoShape"), [
        { value: "band", label: t("shapeBand") },
        { value: "rounded", label: t("shapeRounded") },
        { value: "circle", label: t("shapeCircle") },
      ]);
      // Der Regler fuer die Eckenrundung gilt nur fuer das abgerundete Quadrat.
      shape.querySelector("select").addEventListener("change", function () {
        setTimeout(function () { refreshSection("photo"); }, 0);
      });
      controls.appendChild(shape);
      controls.appendChild(F.range("photo.height", t("photoSize"), 3, 12, 0.1, " cm", sync));

      var scaleField = F.range("photo.scale", t("photoZoom"), 1, 3, 0.01, "×", sync);
      scale = scaleField.querySelector("input");
      controls.appendChild(scaleField);

      editorRow.appendChild(stage);
      editorRow.appendChild(controls);
      body.appendChild(editorRow);
      body.appendChild(F.hint(t("photoHint")));

      var posXField = F.range("photo.posX", t("cropX"), 0, 100, 1, " %", sync);
      var posYField = F.range("photo.posY", t("cropY"), 0, 100, 1, " %", sync);
      posX = posXField.querySelector("input");
      posY = posYField.querySelector("input");
      body.appendChild(F.row(posXField, posYField));

      if (state.photo.shape === "rounded") {
        body.appendChild(F.range("photo.radius", t("cornerRadius"), 0, 60, 1, " px", sync));
      }

      var buttons = el("div", "add-row");
      var reset = el("button", "btn btn-small", t("resetCrop"));
      reset.type = "button";
      reset.addEventListener("click", function () {
        state.photo.posX = 50;
        state.photo.posY = 50;
        state.photo.scale = 1;
        refreshSection("photo");
        context.onChange();
      });
      var remove = el("button", "btn btn-small btn-danger", t("removePhoto"));
      remove.type = "button";
      remove.addEventListener("click", function () {
        state.photo.src = "";
        refreshSection("photo");
        context.onChange();
      });
      buttons.appendChild(reset);
      buttons.appendChild(remove);
      body.appendChild(buttons);

      var url = F.text("photo.src", t("photoUrl"), "https://…");
      url.querySelector("input").addEventListener("change", function () {
        refreshSection("photo");
      });
      body.appendChild(url);

      sync();
    }

    /* ------------------------------------------------------------- Profil */

    function buildProfile(body) {
      body.appendChild(F.toggle("profile.show", t("showProfile")));
      body.appendChild(F.text("profile.title", t("headline")));
      body.appendChild(F.textarea("profile.text", t("text"), 5, t("profilePlaceholder")));
      body.appendChild(F.select("style.profileAlign", t("profileAlign"), [
        { value: "auto", label: t("profileAlignAuto") },
        { value: "left", label: t("profileAlignLeft") },
        { value: "center", label: t("profileAlignCenter") },
        { value: "justify", label: t("profileAlignJustify") },
      ]));
      addPageField(body, "profile");
    }

    /* ---------------------------------------------------------- Werdegang */

    function buildTimeline(body) {
      body.appendChild(F.hint(t("timelineHint")));

      // --- Kategorien ---
      var categories = el("details", "sub-block");
      categories.appendChild(el("summary", null, t("categories")));
      var categoryBody = el("div", "sub-block-body");
      categoryBody.appendChild(F.hint(t("categoriesHint")));

      categoryBody.appendChild(F.listEditor({
        path: "sections",
        addLabel: t("addCategory"),
        blank: function () {
          return {
            id: "s" + Date.now().toString(36),
            title: t("newCategory"),
            icon: Model.icon(state.style.iconSet, "briefcase"),
            atsRole: "other",
            show: true,
            page: 1,
          };
        },
        title: function (section) { return section.title; },
        badge: function (section) {
          var count = state.events.filter(function (event) {
            return event.sectionId === section.id;
          }).length;
          return count ? count + "" : "";
        },
        confirmRemove: function (section) {
          var used = state.events.filter(function (event) {
            return event.sectionId === section.id;
          });
          if (!used.length) return true;
          if (state.sections.length < 2) {
            global.RickCVToast(t("lastCategory"));
            return false;
          }
          if (!global.confirm(t("categoryHasEntries").replace("{n}", used.length))) return false;
          // Eintraege nicht wegwerfen, sondern in die erste andere Kategorie schieben
          var fallback = state.sections.filter(function (other) {
            return other.id !== section.id;
          })[0];
          used.forEach(function (event) { event.sectionId = fallback.id; });
          setTimeout(function () { refreshSection("events"); }, 0);
          return true;
        },
        body: function (container, index, path, refresh) {
          var title = F.text(path + ".title", t("headline"));
          title.querySelector("input").addEventListener("input", refresh);
          container.appendChild(title);
          container.appendChild(F.row(
            F.iconField(path + ".icon", t("icon")),
            F.select(path + ".atsRole", t("atsRole"), [
              { value: "experience", label: t("roleExperience") },
              { value: "education", label: t("roleEducation") },
              { value: "volunteer", label: t("roleVolunteer") },
              { value: "other", label: t("roleOther") },
            ])
          ));
          container.appendChild(F.hint(t("atsRoleHint")));
          container.appendChild(F.toggle(path + ".show", t("showCategory")));
          addPageField(container, path);
        },
      }));
      categories.appendChild(categoryBody);
      body.appendChild(categories);

      // --- Stationen ---
      body.appendChild(F.listEditor({
        path: "events",
        addLabel: t("addStation"),
        emptyText: t("noStations"),
        blank: function () {
          var event = Model.emptyEvent((state.sections[0] || {}).id);
          event.title = t("newStation");
          event.icon = Model.icon(state.style.iconSet, "briefcase");
          return event;
        },
        title: function (event) { return event.title; },
        badge: function (event) {
          var mode = event.dateMode || "auto";
          if (mode === "none") return "";
          if (!event.start && !event.end && !event.present) return "";
          if (mode === "start" || (mode === "auto" && !event.end && !event.present)) {
            return event.start;
          }
          return event.start + " – " + (event.present ? t("today") : event.end);
        },
        body: function (container, index, path, refresh) {
          var title = F.text(path + ".title", t("title"));
          title.querySelector("input").addEventListener("input", refresh);
          container.appendChild(title);

          container.appendChild(F.select(path + ".sectionId", t("category"),
            state.sections.map(function (section) {
              return { value: section.id, label: section.title };
            })));

          var start = F.text(path + ".start", t("from"), "07/2019");
          var end = F.text(path + ".end", t("to"), "09/2021");
          start.querySelector("input").addEventListener("input", refresh);
          end.querySelector("input").addEventListener("input", refresh);
          container.appendChild(F.row(start, end));

          var present = F.toggle(path + ".present", t("untilToday"));
          present.querySelector("input").addEventListener("change", refresh);
          container.appendChild(present);

          //  Nicht jede Station hat einen Zeitraum: eine Weiterbildung
          //  traegt ein Jahr, eine Auszeichnung manchmal gar nichts.
          var dateMode = F.select(path + ".dateMode", t("dateDisplay"), [
            { value: "auto", label: t("dateAuto") },
            { value: "range", label: t("dateRange") },
            { value: "start", label: t("dateStart") },
            { value: "none", label: t("dateNone") },
          ]);
          dateMode.querySelector("select").addEventListener("change", refresh);
          container.appendChild(dateMode);

          container.appendChild(F.row(
            F.text(path + ".company", t("company")),
            F.text(path + ".place", t("place"))
          ));
          container.appendChild(F.lines(path + ".description", t("description"), t("onePerLine")));
          container.appendChild(F.lines(path + ".list", t("tasks"), t("onePerLine")));
          container.appendChild(F.row(
            F.iconField(path + ".icon", t("icon")),
            F.shadeField(path + ".color", t("color"))
          ));

          var advanced = el("details", "sub-block");
          advanced.appendChild(el("summary", null, t("fineTuning")));
          var advancedBody = el("div", "sub-block-body");
          advancedBody.appendChild(F.toggle(path + ".hideline", t("hideLine")));
          advancedBody.appendChild(F.row(
            F.number(path + ".hoffset", t("indent"), -100, 200, 1),
            F.number(path + ".voffset", t("shiftVertical"), -200, 200, 1)
          ));
          advanced.appendChild(advancedBody);
          container.appendChild(advanced);
        },
      }));
    }

    /* ------------------------------------------------------- Listen-Sektionen */

    function buildSkills(body) {
      body.appendChild(F.toggle("skills.show", t("showSection")));
      body.appendChild(F.row(
        F.text("skills.title", t("headline")),
        F.iconField("skills.icon", t("icon"))
      ));
      body.appendChild(F.listEditor({
        path: "skills.items",
        addLabel: t("addSkill"),
        blank: { name: "", rank: 3 },
        title: function (item) { return item.name; },
        badge: function (item) { return item.rank + "/5"; },
        body: function (container, index, path, refresh) {
          nameFirst(container, path, refresh);
          var rank = F.range(path + ".rank", t("level"), 0.5, 5, 0.5, " / 5");
          rank.querySelector("input").addEventListener("input", refresh);
          container.appendChild(rank);
        },
      }));
      addPageField(body, "skills");
    }

    function buildLanguages(body) {
      body.appendChild(F.toggle("languages.show", t("showSection")));
      body.appendChild(F.text("languages.title", t("headline")));
      body.appendChild(F.listEditor({
        path: "languages.items",
        addLabel: t("addLanguage"),
        blank: { name: "", percentage: 60, level: "" },
        title: function (item) { return item.name; },
        badge: function (item) { return item.level || item.percentage + " %"; },
        body: function (container, index, path, refresh) {
          nameFirst(container, path, refresh, t("language"));
          container.appendChild(F.range(path + ".percentage", t("barLength"), 0, 100, 5, " %"));
          var level = F.text(path + ".level", t("levelOptional"), "B2");
          level.querySelector("input").addEventListener("input", refresh);
          container.appendChild(level);
        },
      }));
      addPageField(body, "languages");
    }

    function buildInterests(body) {
      body.appendChild(F.toggle("interests.show", t("showSection")));
      body.appendChild(F.text("interests.title", t("headline")));
      body.appendChild(iconListEditor("interests.items", t("addInterest"), "star"));
      addPageField(body, "interests");
    }

    function buildMobility(body) {
      body.appendChild(F.hint(t("mobilityHint")));
      body.appendChild(F.toggle("mobility.show", t("showOnMainPage")));
      body.appendChild(F.row(
        F.text("mobility.title", t("headline")),
        F.iconField("mobility.icon", t("icon"))
      ));
      body.appendChild(F.listEditor({
        path: "mobility.items",
        addLabel: t("addEntry"),
        blank: { name: "" },
        title: function (item) { return item.name; },
        body: function (container, index, path, refresh) {
          nameFirst(container, path, refresh);
        },
      }));
      addPageField(body, "mobility");
      body.appendChild(el("hr"));
      body.appendChild(F.toggle("mobilitySB.show", t("showInSidebar")));
      body.appendChild(F.text("mobilitySB.title", t("sidebarHeading")));
      body.appendChild(iconListEditor("mobilitySB.items", t("addEntry"), "car-front"));
      addPageField(body, "mobilitySB");
    }

    function buildProjects(body) {
      body.appendChild(F.toggle("projects.show", t("showSection")));
      body.appendChild(F.text("projects.title", t("headline")));
      body.appendChild(F.select("settings.projectsColumn", t("projectsColumn"), [
        { value: "sidebar", label: t("projectsColumnSidebar") },
        { value: "main", label: t("projectsColumnMain") },
      ]));
      body.appendChild(F.hint(t("projectsColumnHint")));
      body.appendChild(F.listEditor({
        path: "projects.items",
        addLabel: t("addProject"),
        blank: { name: "", img: "", url: "", description: "" },
        title: function (item) { return item.name; },
        body: function (container, index, path, refresh) {
          nameFirst(container, path, refresh);
          container.appendChild(F.text(path + ".description", t("shortDescription")));
          container.appendChild(F.text(path + ".url", t("link"), "https://…"));
          container.appendChild(F.imageField(path + ".img", t("image")));
        },
      }));
      addPageField(body, "projects");
    }

    function buildReferences(body) {
      body.appendChild(F.hint(t("referencesHint")));
      body.appendChild(F.toggle("references.show", t("showSection")));
      body.appendChild(F.row(
        F.text("references.title", t("headline")),
        F.iconField("references.icon", t("icon"))
      ));
      body.appendChild(F.listEditor({
        path: "references.items",
        addLabel: t("addReference"),
        blank: { name: "", role: "", company: "", contact: "" },
        title: function (item) { return item.name; },
        badge: function (item) { return item.company || ""; },
        body: function (container, index, path, refresh) {
          nameFirst(container, path, refresh, t("fieldName"));
          container.appendChild(F.row(
            F.text(path + ".role", t("fieldRole")),
            F.text(path + ".company", t("company"))
          ));
          var company = container.lastChild.querySelectorAll("input")[1];
          if (company) company.addEventListener("input", refresh);
          container.appendChild(F.text(path + ".contact", t("referenceContact"), "…"));
        },
      }));
      addPageField(body, "references");
    }

    /* ---------------------------------------------------------- Fusszeile */

    //  Beide Leisten werden gleich bedient, nur an unterschiedlichen Stellen
    //  im Datenobjekt. Deshalb eine Funktion mit der Seite als Parameter.
    function footerEditor(body, side, headingKey) {
      var path = "footers." + side;
      var block = el("details", "sub-block");
      block.appendChild(el("summary", null, t(headingKey)));
      var inner = el("div", "sub-block-body");

      inner.appendChild(F.toggle(path + ".show", t("footerShow")));
      inner.appendChild(F.select(path + ".mode", t("footerMode"), [
        { value: "iconText", label: t("footerModeIconText") },
        { value: "icons", label: t("footerModeIcons") },
      ]));
      inner.appendChild(F.text(path + ".intro", t("footerIntro"), t("footerIntroPlaceholder")));

      //  Die Auswahl des Blattes hat nur bei zwei Seiten eine Wirkung.
      if (state.settings.pageMode === "two") {
        inner.appendChild(F.select(path + ".page", t("footerPage"), [
          { value: "last", label: t("footerPageLast") },
          { value: "1", label: t("page1") },
          { value: "2", label: t("page2") },
          { value: "all", label: t("footerPageAll") },
        ]));
      }

      inner.appendChild(F.listEditor({
        path: path + ".links",
        addLabel: t("footerAddLink"),
        emptyText: t("footerNoLinks"),
        blank: function () { return Model.emptyFooterLink(); },
        title: function (link) { return link.label || link.text || link.url; },
        badge: function (link) { return link.url ? "↗" : ""; },
        body: function (container, index, linkPath, refresh) {
          var label = F.text(linkPath + ".label", t("footerLinkLabel"), t("footerLinkLabelPlaceholder"));
          label.querySelector("input").addEventListener("input", refresh);
          container.appendChild(label);

          var visible = F.text(linkPath + ".text", t("footerLinkText"), t("footerLinkTextPlaceholder"));
          visible.querySelector("input").addEventListener("input", refresh);
          container.appendChild(visible);

          var url = F.text(linkPath + ".url", t("link"), "https://…");
          url.querySelector("input").addEventListener("input", refresh);
          container.appendChild(url);

          container.appendChild(F.iconField(linkPath + ".icon", t("icon")));
        },
      }));

      block.appendChild(inner);
      body.appendChild(block);
    }

    function buildFooter(body) {
      body.appendChild(F.hint(t("footerHint")));
      body.appendChild(F.hint(t("footerBrandHint")));
      footerEditor(body, "left", "footerLeft");
      footerEditor(body, "right", "footerRight");
    }

    /* -------------------------------------------------------- Anschreiben */

    function buildLetter(body) {
      body.appendChild(F.toggle("settings.showCoverLetter", t("createLetter")));
      body.appendChild(F.textarea("coverLetter.recipient", t("recipient"), 4, t("recipientPlaceholder")));
      body.appendChild(F.row(
        F.text("coverLetter.place", t("place")),
        F.text("coverLetter.date", t("date"))
      ));
      body.appendChild(F.text("coverLetter.subject", t("subject")));
      body.appendChild(F.text("coverLetter.salutation", t("salutation")));
      body.appendChild(F.listEditor({
        path: "coverLetter.paragraphs",
        addLabel: t("addParagraph"),
        blank: "",
        emptyText: t("noParagraphs"),
        title: function (item, index) {
          var preview = String(item || "").slice(0, 40);
          return t("paragraph") + " " + (index + 1) + (preview ? ": " + preview + "…" : "");
        },
        body: function (container, index, path, refresh) {
          var field = F.textarea(path, t("text"), 4);
          field.querySelector("textarea").addEventListener("input", refresh);
          container.appendChild(field);
        },
      }));
      body.appendChild(F.text("coverLetter.closing", t("closing")));
      body.appendChild(F.imageField("coverLetter.signatureImg", t("signature")));
      body.appendChild(F.range("coverLetter.signatureHeight", t("signatureHeight"), 1, 5, 0.1, " " + t("linesUnit")));
      body.appendChild(F.select("settings.alignText", t("textAlign"), [
        { value: "left", label: t("alignLeft") },
        { value: "justify", label: t("alignJustify") },
      ]));

      body.appendChild(el("hr"));

      //  Die Warnung steht immer im Markup und wird vom Baukasten ein- und
      //  ausgeblendet, sobald die Vorschau die Seitenzahl meldet. Sie neu zu
      //  bauen wuerde beim Tippen den Schreibcursor aus dem Textfeld werfen.
      var warn = F.note("", "warn");
      warn.id = "letter-length-warn";
      warn.hidden = true;
      body.appendChild(warn);

      //  Wieviele Blaetter es werden, entscheidet der Text. Einzustellen
      //  bleibt nur, wie die Folgeblaetter aussehen – deshalb ein eigener,
      //  zugeklappter Block statt vier Feldern im Weg.
      var letterPages = el("details", "sub-block");
      letterPages.appendChild(el("summary", null, t("letterPagesBlock")));
      var letterBody = el("div", "sub-block-body");

      letterBody.appendChild(F.hint(t("letterPagesHint")));
      letterBody.appendChild(F.toggle("settings.letterPages.repeatHeader",
        t("letterRepeatHeader")));
      letterBody.appendChild(F.hint(t("letterRepeatHeaderHint")));

      var numbers = F.toggle("settings.letterPages.pageNumbers", t("letterPageNumbers"));
      numbers.querySelector("input").addEventListener("change", function () {
        setTimeout(function () { refreshSection("letter"); }, 0);
      });
      letterBody.appendChild(numbers);
      letterBody.appendChild(F.hint(t("letterPageNumbersHint")));

      //  Die Beschriftung steht nur zur Wahl, wenn es ueberhaupt eine
      //  Seitenzahl gibt.
      if (state.settings.letterPages.pageNumbers) {
        letterBody.appendChild(F.text("settings.letterPages.numberFormat",
          t("letterNumberFormat"), "Seite {page} von {pages}"));
        letterBody.appendChild(F.hint(t("letterNumberFormatHint")));
      }

      letterPages.appendChild(letterBody);
      body.appendChild(letterPages);
    }

    /* -------------------------------------------------------------- Design */

    function buildDesign(body) {
      //  Die Vorlagenauswahl stand frueher hier. Sie ist in den Abschnitt
      //  "Themes" gewandert, wo sie hingehoert – mit Vorschau statt drei
      //  Wörtern in einem Auswahlfeld.
      body.appendChild(F.hint(t("designThemeHint")));
      body.appendChild(F.select("style.fontFamily", t("font"),
        global.RickCVRender.fonts.map(function (name) {
          return { value: name, label: name };
        })));
      body.appendChild(F.range("style.baseFontSize", t("fontSize"), 11, 17, 0.5, " px"));
      body.appendChild(F.hint(t("fontSizeHint")));
      body.appendChild(F.range("style.pageBottom", t("pageBottom"), 0, 2, 0.1, " cm"));
      body.appendChild(F.hint(t("pageBottomHint")));

      // --- Symbolstil ---
      var iconBlock = el("details", "sub-block");
      iconBlock.appendChild(el("summary", null, t("iconStyle")));
      var iconBody = el("div", "sub-block-body");

      iconBody.appendChild(F.select("style.iconSet", t("iconSet"), [
        { value: "lucide", label: "Lucide" },
        { value: "material", label: "Material Symbols" },
      ]));
      iconBody.appendChild(F.hint(t("iconSetHint")));

      iconBody.appendChild(F.range("style.iconStroke", t("iconStroke"), 1, 3, 0.05, ""));
      iconBody.appendChild(F.hint(t("iconStrokeHint")));
      iconBody.appendChild(F.range("style.iconScale", t("iconSize"), 0.7, 1.6, 0.05, "×"));

      var iconColor = F.select("style.iconColor", t("iconColorLabel"), [
        { value: "accent", label: t("iconColorAccent") },
        { value: "text", label: t("iconColorText") },
        { value: "custom", label: t("iconColorCustom") },
      ]);
      // Das Farbfeld erscheint nur, wenn es auch gebraucht wird.
      iconColor.querySelector("select").addEventListener("change", function () {
        setTimeout(function () { refreshSection("design"); }, 0);
      });
      iconBody.appendChild(iconColor);
      if (state.style.iconColor === "custom") {
        iconBody.appendChild(F.color("style.iconColorCustom", t("iconColorCustom"), true));
      }

      var iconBg = F.select("style.iconBg", t("iconBgLabel"), [
        { value: "none", label: t("iconBgNone") },
        { value: "circle", label: t("iconBgCircle") },
        { value: "rounded", label: t("iconBgRounded") },
      ]);
      iconBg.querySelector("select").addEventListener("change", function () {
        setTimeout(function () { refreshSection("design"); }, 0);
      });
      iconBody.appendChild(iconBg);
      if (state.style.iconBg !== "none") {
        iconBody.appendChild(F.color("style.iconBgColor", t("iconBgColor"), true));
      }

      iconBlock.appendChild(iconBody);
      body.appendChild(iconBlock);

      body.appendChild(el("hr"));
      body.appendChild(F.color("style.accentColor", t("accentColor"), true));
      body.appendChild(F.select("style.sidebarMode", t("sidebar"), [
        { value: "light", label: t("sidebarLight") },
        { value: "dark", label: t("sidebarDark") },
        { value: "custom", label: t("sidebarCustom") },
      ]));
      body.appendChild(F.color("style.sidebarColor", t("sidebarColor")));
      body.appendChild(F.row(
        F.color("style.fontColor", t("fontColor")),
        F.color("style.backgroundColor", t("pageBackground"))
      ));
      body.appendChild(F.color("style.sidebarFontColor", t("sidebarFontColor")));
      body.appendChild(F.color("style.emptyColor", t("emptyDotColor")));

      //  Sobald jemand eine Farbe angefasst hat, gewinnt sie gegen die Palette
      //  des Themes. Der Hinweis darauf und der Weg zurueck stehen schon im
      //  Formular und werden nur eingeblendet – die Felder neu aufzubauen,
      //  waehrend jemand im Farbwaehler zieht, wuerde ihm den Waehler unter
      //  der Hand austauschen.
      var ownBlock = el("div");
      ownBlock.appendChild(F.hint(t("ownColorsHint")));
      var backRow = el("div", "add-row");
      var back = el("button", "btn btn-small", t("ownColorsReset"));
      back.type = "button";
      back.addEventListener("click", function () {
        state.style.ownColors = {};
        ownBlock.hidden = true;
        context.onChange();
      });
      backRow.appendChild(back);
      ownBlock.appendChild(backRow);
      ownBlock.hidden = !Object.keys(state.style.ownColors || {}).length;
      body.appendChild(ownBlock);

      var reveal = function () {
        if (Object.keys(state.style.ownColors || {}).length) ownBlock.hidden = false;
      };
      body.addEventListener("input", reveal);
      body.addEventListener("change", reveal);
      body.appendChild(F.range("style.sidebarWidth", t("sidebarWidth"), 20, 50, 1, " %"));
      body.appendChild(F.range("style.titleSize", t("nameSize"), 18, 48, 1, " px"));
      body.appendChild(F.row(
        F.range("style.headlineSize", t("headlineSideLabel"), 10, 26, 1, " px"),
        F.range("style.mainHeadlineSize", t("headlineMainLabel"), 12, 34, 1, " px")
      ));
      body.appendChild(F.range("style.titleGap", t("titleGapLabel"), 0, 20, 1, " px"));
      body.appendChild(F.hint(t("titleGapHint")));
      body.appendChild(F.range("style.border", t("pageBorder"), 0, 15, 0.5, " mm"));

      body.appendChild(el("hr"));
      body.appendChild(F.hint(t("marginHint")));
      body.appendChild(F.row(
        F.number("style.leftMargin", t("marginLeft"), 0, 6, 0.1),
        F.number("style.rightMargin", t("marginRight"), 0, 6, 0.1)
      ));
      body.appendChild(F.row(
        F.number("style.bottomMargin", t("marginBottom"), 0, 6, 0.1),
        F.number("style.headerHeight", t("headerHeight"), 4, 20, 0.5)
      ));
    }

    /* ------------------------------------------------- Maschinenlesbarkeit */

    function buildAts(body) {
      body.appendChild(F.note(t("atsIntro"), "info"));

      var mode = F.select("ats.mode", t("atsMode"), [
        { value: "off", label: t("atsOff") },
        { value: "appendix", label: t("atsAppendix") },
        { value: "hidden", label: t("atsHidden") },
      ]);
      mode.querySelector("select").addEventListener("change", function () {
        setTimeout(function () { refreshSection("ats"); }, 0);
      });
      body.appendChild(mode);

      if (state.ats.mode === "hidden") {
        body.appendChild(F.note(t("atsHiddenWarning"), "warn"));
      }
      if (state.ats.mode === "off") {
        body.appendChild(F.hint(t("atsOffHint")));
      }

      body.appendChild(el("hr"));

      // Vorschau bzw. Bearbeitung des tatsaechlich eingebetteten Textes
      var custom = F.toggle("ats.custom", t("atsCustom"));
      custom.querySelector("input").addEventListener("change", function () {
        if (state.ats.custom && !state.ats.text.trim()) {
          state.ats.text = Ats.toText(state);
        }
        setTimeout(function () { refreshSection("ats"); }, 0);
      });
      body.appendChild(custom);

      var area = el("textarea", "ats-preview");
      area.rows = 16;
      area.spellcheck = false;
      area.value = Ats.effectiveText(state);
      area.readOnly = !state.ats.custom;
      area.setAttribute("aria-label", t("atsText"));

      if (state.ats.custom) {
        area.addEventListener("input", function () {
          state.ats.text = area.value;
          context.onChange();
        });
      }
      body.appendChild(F.wrap(state.ats.custom ? t("atsText") : t("atsPreviewLabel"), area));

      var buttons = el("div", "add-row");
      var regenerate = el("button", "btn btn-small", t("atsRegenerate"));
      regenerate.type = "button";
      regenerate.addEventListener("click", function () {
        state.ats.text = Ats.toText(state);
        area.value = state.ats.text;
        context.onChange();
        global.RickCVToast(t("atsRegenerated"));
      });
      var copy = el("button", "btn btn-small", t("atsCopy"));
      copy.type = "button";
      copy.addEventListener("click", function () {
        navigator.clipboard.writeText(area.value).then(function () {
          global.RickCVToast(t("atsCopied"));
        }, function () {
          area.select();
        });
      });
      if (state.ats.custom) buttons.appendChild(regenerate);
      buttons.appendChild(copy);
      body.appendChild(buttons);
    }

    /* ------------------------------------------------------------ Optionen */

    function buildOptions(body) {
      var language = F.select("locale", t("language"), [
        { value: "de", label: "Deutsch" },
        { value: "en", label: "English" },
      ]);
      language.querySelector("select").addEventListener("change", function () {
        setTimeout(context.onLocaleChange, 0);
      });
      body.appendChild(language);
      body.appendChild(F.hint(t("languageHint")));

      body.appendChild(el("hr"));
      body.appendChild(F.select("settings.dateFormat", t("dateFormat"), [
        { value: "short", label: t("dateShort") },
        { value: "full", label: t("dateFull") },
      ]));
      body.appendChild(F.toggle("settings.reverseTimeline", t("newestFirst")));
      body.appendChild(F.toggle("settings.noLine", t("hideAllLines")));

      body.appendChild(el("hr"));

      //  Der Wechsel des Seitenmodus blendet in allen anderen Abschnitten die
      //  Seitenauswahl ein oder aus – deshalb wird der Editor neu aufgebaut.
      //  Blattmass zuerst: davon haengt ab, wieviel ueberhaupt auf eine
      //  Seite passt.
      body.appendChild(F.select("settings.pageSize", t("pageSize"), [
        { value: "a4", label: t("pageSizeA4") },
        { value: "letter", label: t("pageSizeLetter") },
      ]));
      body.appendChild(F.hint(t("pageSizeHint")));

      var pageMode = F.select("settings.pageMode", t("pageMode"), [
        { value: "single", label: t("pageSingle") },
        { value: "two", label: t("pageTwo") },
        { value: "flow", label: t("pageFlow") },
      ]);
      pageMode.querySelector("select").addEventListener("change", function () {
        setTimeout(context.rebuildEditor, 0);
      });
      body.appendChild(pageMode);
      body.appendChild(F.hint(t("pageModeHint")));

      //  Folgeblaetter gibt es in beiden mehrseitigen Betriebsarten.
      if (state.settings.pageMode !== "single") {
        var page2 = el("details", "sub-block");
        page2.open = true;
        page2.appendChild(el("summary", null, t("page2Block")));
        var page2Body = el("div", "sub-block-body");

        page2Body.appendChild(F.hint(t("page2Hint")));
        page2Body.appendChild(F.select("settings.page2.sidebar", t("page2Sidebar"), [
          { value: "keep", label: t("page2SidebarKeep") },
          { value: "none", label: t("page2SidebarNone") },
        ]));
        page2Body.appendChild(F.hint(t("page2SidebarHint")));
        page2Body.appendChild(F.toggle("settings.page2.repeatHeader", t("page2RepeatHeader")));
        page2Body.appendChild(F.toggle("settings.page2.repeatContact", t("page2RepeatContact")));
        page2Body.appendChild(F.toggle("settings.page2.repeatPhoto", t("page2RepeatPhoto")));
        page2Body.appendChild(F.toggle("settings.page2.pageNumbers", t("page2Numbers")));
        page2Body.appendChild(F.hint(t("page2NumbersHint")));
        page2Body.appendChild(F.hint(t("pageOverflowHint")));

        page2.appendChild(page2Body);
        body.appendChild(page2);
      }
    }

    /* ---------------------------------------------------------------- Themes */

    //  Ein Theme ist eine CSS-Datei. Damit das nicht nur fuer Leute gilt,
    //  die das Projekt auskennen: die Werkstatt schreibt dieselbe Datei im
    //  Baukasten, mit der Vorschau daneben. Wer sie fertig hat, laedt sie
    //  herunter – und genau die Datei ist der Beitrag.
    function buildTheme(body) {
      var Themes = global.RickCVThemes;
      if (!Themes) return;

      var locale = state.locale || "de";
      var theme = state.theme || (state.theme = { slug: "clean", name: "", css: "", source: "" });

      body.appendChild(F.hint(t("themeHint")));

      /* -- Mitgelieferte ------------------------------------------------- */

      var gallery = el("div", "theme-gallery");
      Themes.builtin(locale).forEach(function (entry) {
        var card = el("button", "theme-card");
        card.type = "button";
        if (!theme.css && theme.slug === entry.slug) card.classList.add("active");

        //  Ein Bild sagt hier mehr als der beste Satz. Die Beschreibung
        //  bleibt trotzdem im Dokument stehen – für Vorlesesoftware, für
        //  die Suche und für den Fall, dass das Bild fehlt.
        var shot = el("img", "theme-shot");
        shot.src = "themes/previews/" + entry.slug + ".webp";
        shot.alt = entry.name + (entry.about ? " – " + entry.about : "");
        shot.loading = "lazy";
        shot.addEventListener("error", function () { shot.hidden = true; });
        card.appendChild(shot);

        card.appendChild(el("strong", null, entry.name));
        if (entry.about) {
          card.title = entry.about;
          card.appendChild(el("small", "visually-hidden", entry.about));
        }
        card.addEventListener("click", function () {
          state.theme = { slug: entry.slug, name: entry.name, css: "", source: "builtin" };
          //  Die Vorlage steckte frueher in den Einstellungen; der Wert
          //  bleibt gepflegt, damit aeltere Staende weiter passen.
          state.settings.template = entry.slug;
          onChange(true);
          refreshSection("theme");
        });
        gallery.appendChild(card);
      });
      body.appendChild(gallery);

      /* -- Werkstatt ----------------------------------------------------- */

      var workshop = el("details", "sub-block");
      workshop.open = !!theme.css;
      workshop.appendChild(el("summary", null, t("themeWorkshop")));
      var shop = el("div", "sub-block-body");
      workshop.appendChild(shop);
      body.appendChild(workshop);

      shop.appendChild(F.hint(t("themeWorkshopHint")));

      var actions = el("div", "theme-actions");

      function useCss(css, name, note) {
        state.theme = { slug: "", name: name || t("themeMine"), css: css, source: "workshop" };
        state.settings.template = "custom";
        onChange(true);
        refreshSection("theme");
        if (note) global.RickCVToast(note);
      }

      var base = Themes.builtin(locale).filter(function (entry) {
        return entry.slug === theme.slug;
      })[0];

      if (!theme.css) {
        var fork = el("button", "btn", t("themeFrom").replace("{name}", (base && base.name) || "Clean"));
        fork.type = "button";
        fork.addEventListener("click", function () {
          useCss(Themes.source((base && base.slug) || "clean"), (base ? base.name + " ✳" : t("themeMine")));
        });
        actions.appendChild(fork);

        var fresh = el("button", "btn", t("themeStarter"));
        fresh.type = "button";
        fresh.addEventListener("click", function () { useCss(Themes.starter(locale)); });
        actions.appendChild(fresh);
      }

      var loadBtn = el("button", "btn", t("themeLoad"));
      loadBtn.type = "button";
      var file = el("input");
      file.type = "file";
      file.accept = ".css,text/css";
      file.hidden = true;
      file.addEventListener("change", function () {
        if (!file.files[0]) return;
        var reader = new FileReader();
        reader.onload = function () {
          var read = Themes.read(String(reader.result), file.files[0].name.replace(/\.css$/i, ""));
          useCss(String(reader.result), read.name, t("themeLoaded"));
        };
        reader.readAsText(file.files[0]);
        file.value = "";
      });
      loadBtn.addEventListener("click", function () { file.click(); });
      actions.appendChild(loadBtn);
      actions.appendChild(file);

      if (theme.css) {
        var save = el("button", "btn", t("themeSave"));
        save.type = "button";
        save.addEventListener("click", function () {
          var name = (theme.name || "theme").toLowerCase()
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
          var blob = new Blob([theme.css], { type: "text/css" });
          var url = URL.createObjectURL(blob);
          var link = el("a");
          link.href = url;
          link.download = name + ".css";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
        actions.appendChild(save);

        var drop = el("button", "btn btn-danger-ghost", t("themeDiscard"));
        drop.type = "button";
        drop.addEventListener("click", function () {
          state.theme = { slug: "clean", name: "", css: "", source: "builtin" };
          state.settings.template = "clean";
          onChange(true);
          refreshSection("theme");
        });
        actions.appendChild(drop);
      }

      shop.appendChild(actions);

      if (!theme.css) return;

      /* -- Der Editor ---------------------------------------------------- */

      shop.appendChild(F.text("theme.name", t("themeName")));

      var editor = F.textarea("theme.css", t("themeCss"), 16);
      var area = editor.querySelector("textarea");
      area.className = "theme-editor";
      area.spellcheck = false;
      area.wrap = "off";
      shop.appendChild(editor);

      //  Was die Pruefung entfernt hat, steht direkt darunter – sonst
      //  sucht man den Fehler in der eigenen Regel.
      var checked = Themes.read(theme.css, theme.name);
      var NOTES = {
        imports: "themeNoteImports", remote: "themeNoteRemote",
        ats: "themeNoteAts", truncated: "themeNoteTruncated", contract: "themeNoteContract",
      };
      checked.notes.forEach(function (key) {
        if (NOTES[key]) shop.appendChild(F.note(t(NOTES[key])));
      });

      /* -- Haken zum Einsetzen ------------------------------------------- */

      function insert(text) {
        var start = area.selectionStart;
        var value = area.value;
        area.value = value.slice(0, start) + text + value.slice(area.selectionEnd);
        area.selectionStart = area.selectionEnd = start + text.length;
        area.focus();
        //  Denselben Weg nehmen wie beim Tippen: Zustand, Vorschau, Verlauf.
        area.dispatchEvent(new Event("input", { bubbles: true }));
      }

      var reference = el("details", "sub-block");
      reference.appendChild(el("summary", null, t("themeHooks")));
      var refBody = el("div", "sub-block-body");
      refBody.appendChild(F.hint(t("themeHooksHint")));

      Themes.hooks(locale).forEach(function (group) {
        refBody.appendChild(el("div", "theme-hook-title", group.title));
        var list = el("div", "theme-hooks");
        group.items.forEach(function (item) {
          var chip = el("button", "theme-hook");
          chip.type = "button";
          chip.title = item.about;
          chip.appendChild(el("code", null, item.sel));
          chip.appendChild(el("small", null, item.about));
          chip.addEventListener("click", function () {
            insert(item.sel.indexOf("--") === 0
              ? "  " + item.sel + ": ;\n"
              : "\n" + item.sel + " {\n  \n}\n");
          });
          list.appendChild(chip);
        });
        refBody.appendChild(list);
      });

      reference.appendChild(refBody);
      shop.appendChild(reference);

      shop.appendChild(F.hint(t("themeShareHint")));
    }

    /* ------------------------------------------------------------- Register */

    return [
      { id: "person", title: t("secPerson"), open: true, build: buildPerson },
      { id: "photo", title: t("secPhoto"), build: buildPhoto },
      { id: "profile", title: t("secProfile"), build: buildProfile },
      { id: "events", title: t("secTimeline"), build: buildTimeline,
        count: function () { return state.events.length; } },
      { id: "skills", title: t("secSkills"), build: buildSkills,
        count: function () { return state.skills.items.length; } },
      { id: "languages", title: t("secLanguages"), build: buildLanguages,
        count: function () { return state.languages.items.length; } },
      { id: "interests", title: t("secInterests"), build: buildInterests,
        count: function () { return state.interests.items.length; } },
      { id: "mobility", title: t("secMobility"), build: buildMobility },
      { id: "projects", title: t("secProjects"), build: buildProjects,
        count: function () { return state.projects.items.length; } },
      { id: "references", title: t("secReferences"), build: buildReferences,
        count: function () { return state.references.items.length; } },
      { id: "footer", title: t("secFooter"), build: buildFooter,
        count: function () {
          return state.footers.left.links.length + state.footers.right.links.length;
        } },
      { id: "letter", title: t("secLetter"), build: buildLetter },
      { id: "design", title: t("secDesign"), build: buildDesign },
      { id: "theme", title: t("secTheme"), build: buildTheme },
      { id: "ats", title: t("secAts"), build: buildAts },
      { id: "options", title: t("secOptions"), build: buildOptions },
    ];
  }

  global.RickCVSections = { build: build };
})(typeof window !== "undefined" ? window : this);
