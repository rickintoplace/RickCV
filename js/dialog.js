/*  dialog.js – Rueckfragen und kleine Dialoge im Stil des Baukastens.
 *
 *  Statt window.confirm: dessen Kasten sieht in jedem Browser anders aus,
 *  traegt "Diese Seite sagt" im Kopf und haelt die ganze Seite an. Dieser
 *  hier sieht aus wie der Rest, sagt in seinen Knoepfen, was passiert
 *  ("Ersetzen" statt "OK"), und haelt nichts an – er gibt ein Promise
 *  zurueck.
 *
 *    RickCVDialog.confirm({
 *      title: "…", message: "…", confirm: "Ersetzen", cancel: "Abbrechen", danger: true,
 *    }).then(function (yes) { … });
 *
 *    RickCVDialog.open({ title, body: [Knoten…], actions: [{ label, value, primary }] })
 *      .then(function (value) { … });   // null, wenn abgebrochen
 */
(function (global) {
  "use strict";

  var count = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function open(options) {
    return new Promise(function (resolve) {
      var id = "rc-dialog-" + (++count);
      var overlay = el("div", "imp-overlay rc-dialog" + (options.className ? " " + options.className : ""));
      var panel = el("div", "imp-panel");
      panel.setAttribute("role", options.alert ? "alertdialog" : "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-labelledby", id + "-title");

      var head = el("div", "imp-head");
      var title = el("h2", "imp-title", options.title || "");
      title.id = id + "-title";
      head.appendChild(title);

      var body = el("div", "imp-body");
      if (options.message) {
        var message = el("p", "rc-dialog-message", options.message);
        message.id = id + "-message";
        panel.setAttribute("aria-describedby", message.id);
        body.appendChild(message);
      }
      (options.body || []).forEach(function (node) { body.appendChild(node); });

      var foot = el("div", "imp-foot");
      var focus = null;
      (options.actions || []).forEach(function (action) {
        var button = el("button", "btn" + (action.primary ? " btn-primary" : "") +
          (action.danger ? " btn-primary-danger" : ""), action.label);
        button.type = "button";
        button.addEventListener("click", function () { close(action.value); });
        foot.appendChild(button);
        if (action.focus || (!focus && action.primary)) focus = button;
      });

      panel.appendChild(head);
      panel.appendChild(body);
      panel.appendChild(foot);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      document.body.classList.add("picker-open");

      var before = document.activeElement;
      var release = global.RickCVFocus.trap(panel, function () { close(null); });
      var closed = false;

      function close(value) {
        if (closed) return;
        closed = true;
        release();
        overlay.parentNode.removeChild(overlay);
        if (!document.querySelector(".imp-overlay:not([hidden])")) {
          document.body.classList.remove("picker-open");
        }
        if (before && before.focus) before.focus();
        resolve(value === undefined ? null : value);
      }

      overlay.addEventListener("mousedown", function (event) {
        if (event.target === overlay) close(null);
      });
      (focus || foot.querySelector(".btn") || panel).focus();
    });
  }

  function confirm(options) {
    return open({
      title: options.title,
      message: options.message,
      alert: true,
      className: "rc-dialog-confirm",
      actions: [
        { label: options.cancel, value: false, focus: !options.focusConfirm },
        { label: options.confirm, value: true, primary: true, danger: options.danger,
          focus: !!options.focusConfirm },
      ],
    }).then(function (value) { return value === true; });
  }

  global.RickCVDialog = { open: open, confirm: confirm };
})(typeof window !== "undefined" ? window : this);
