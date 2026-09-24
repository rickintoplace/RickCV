/*  ui-icons.js – Symbole der Oberflaeche.
 *
 *  Nicht zu verwechseln mit dem Katalog in js/icon-data.js, aus dem die
 *  Symbole des Dokuments kommen: der ist auf Lebenslauf-Inhalte kuratiert
 *  und soll nicht mit Werkzeugsymbolen zugestellt werden. Es sind dieselben
 *  Striche (Lucide, ISC – siehe licenses/), nur eben die des Baukastens.
 *
 *  Steht ein Name hier nicht, fragt icon() den Katalog: die Abschnitte des
 *  Editors tragen Symbole wie "briefcase" oder "palette", die dort ohnehin
 *  liegen.
 */
(function (global) {
  "use strict";

  var UI_ICONS = {
    undo: '<path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />',
    sparkles:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936' +
      'A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937' +
      'l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />',
    bot:
      '<path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />' +
      '<path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />',
    "file-plus":
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />' +
      '<path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M12 18v-6" /><path d="M9 15h6" />',
    upload:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />' +
      '<path d="m17 8-5-5-5 5" /><path d="M12 3v12" />',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />' +
      '<path d="m7 10 5 5 5-5" /><path d="M12 15V3" />',
    "external-link":
      '<path d="M15 3h6v6" /><path d="M10 14 21 3" />' +
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />',
    printer:
      '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />' +
      '<path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />' +
      '<rect x="6" y="14" width="12" height="8" rx="1" />',
    link:
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />' +
      '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />',
    copy:
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />' +
      '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
    braces:
      '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />' +
      '<path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />',
    "file-text":
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />' +
      '<path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" />' +
      '<path d="M16 13H8" /><path d="M16 17H8" />',
    redo:
      '<path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />',
    more:
      '<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />',
    "chevron-down": '<path d="m6 9 6 6 6-6" />',
    "chevron-right": '<path d="m9 18 6-6-6-6" />',
    check: '<path d="M20 6 9 17l-5-5" />',
    x: '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
    "arrow-up": '<path d="m5 12 7-7 7 7" /><path d="M12 19V5" />',
    "arrow-down": '<path d="M12 5v14" /><path d="m19 12-7 7-7-7" />',
    trash:
      '<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />' +
      '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />' +
      '<path d="M10 11v6" /><path d="M14 11v6" />',
    "eye-off":
      '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />' +
      '<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />' +
      '<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />' +
      '<path d="m2 2 20 20" />',
    plus: '<path d="M5 12h14" /><path d="M12 5v14" />',
    settings:
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />' +
      '<circle cx="12" cy="12" r="3" />',
  };

  function icon(name) {
    var paths = UI_ICONS[name];
    if (!paths) {
      var Icons = global.RickCVIconLib;
      return Icons ? Icons.html({ set: "lucide", name: name }) : "";
    }
    return '<svg class="rc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
      'focusable="false">' + paths + "</svg>";
  }

  global.RickCVUi = { icon: icon };
})(typeof window !== "undefined" ? window : this);
