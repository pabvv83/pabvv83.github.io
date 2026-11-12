/* Ícones técnicos em SVG (traço, 24×24). Herdam a cor via currentColor.
   Para adicionar um ícone: inclua uma entrada em PATHS e use o nome em data.js. */
window.SITE_ICONS = (function () {
  'use strict';

  var PATHS = {
    code:      '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13"/>',
    broadcast: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    chat:      '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    music:     '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
    game:      '<rect x="3" y="8" width="18" height="9" rx="3"/><path d="M7.5 10.5v4M5.5 12.5h4M15.5 11.5h.01M18 13.5h.01"/>',
    mail:      '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 6l9 7 9-7"/>',
    shield:    '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    user:      '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
    link:      '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    folder:    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    file:      '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/>',
    archive:   '<path d="M4 7h16v13H4zM3 4h18v3H3zM10 11h4"/>',
    image:     '<rect x="3" y="5" width="18" height="14"/><circle cx="9" cy="10" r="1.5"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
    download:  '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
    terminal:  '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 10l3 2-3 2M12 15h5"/>',
    arrow:     '<path d="M5 12h14M13 6l6 6-6 6"/>',
    home:      '<path d="M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6"/>',
    info:      '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    copy:      '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    grid:      '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    list:      '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    search:    '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    check:     '<path d="M5 12.5l4.5 4.5L19 7"/>'
  };

  function svg(name, cls) {
    var d = PATHS[name] || PATHS.link;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  return { svg: svg, has: function (n) { return !!PATHS[n]; }, names: Object.keys(PATHS) };
})();
