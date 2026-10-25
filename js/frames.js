/* =====================================================================
   MOLDURAS ANGULARES — a geometria das janelas
   ---------------------------------------------------------------------
   Dá às janelas (painel central, caixas de detalhe, itens da lista,
   botões, gerenciador de arquivos) o recorte agressivo das interfaces do
   Cyberpunk 2077: chanfros grandes, "ombros" e entalhes em 45°.

   Como funciona: para cada elemento listado em TARGETS, calcula o polígono
   do tamanho real dele e o entrega ao CSS por variáveis:
     --clip-out   contorno externo (recorta o elemento)
     --clip-ring  só a linha da borda (acompanha as diagonais)
     --clip-band  faixa fina junto à borda, onde aparece a ferrugem
   O CSS (css/style.css, seção "molduras") usa essas variáveis. Elementos
   criados depois (itens e botões gerados por app.js) são moldados
   automaticamente, e tudo é recalculado quando o tamanho muda.

   Para mudar o desenho de uma janela, edite a função em SHAPES.
   Só use ângulos de 0°, 45° e 90° para a borda ficar perfeita.
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    border:   { panel: 1.5, box: 1, item: 1, btn: 1 },  // espessura da borda por tipo (px)
    rustBand: { panel: 8, box: 7 }                      // largura da faixa de ferrugem (px)
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- formas ----------
     Vértices em sentido horário (y cresce para baixo), em px. */
  var SHAPES = {

    /* Painel central: chanfro grande no canto superior esquerdo, "ombro" e
       chanfro no superior direito, entalhe na lateral direita, chanfro grande
       embaixo à direita, entalhe na borda inferior e outro na lateral esquerda. */
    panel: function (w, h) {
      var s = clamp(w / 1000, 0.55, 1);                 // encolhe os recortes em telas pequenas
      var a = h * 0.30, b = h * 0.62, nx = w * 0.30;
      return [
        [46 * s, 0], [w - 128 * s, 0], [w - 120 * s, 8 * s], [w - 34 * s, 8 * s], [w, 42 * s],
        [w, a], [w - 8 * s, a + 8 * s], [w - 8 * s, a + 64 * s], [w, a + 72 * s],
        [w, h - 52 * s], [w - 52 * s, h],
        [nx + 116 * s, h], [nx + 108 * s, h - 8 * s], [nx + 8 * s, h - 8 * s], [nx, h],
        [22 * s, h], [0, h - 22 * s],
        [0, b + 72 * s], [8 * s, b + 64 * s], [8 * s, b + 8 * s], [0, b],
        [0, 46 * s]
      ];
    },

    /* Caixas médias (detalhes, sistema, arquivos): chanfros em cantos opostos
       com um "ombro" em cada um. */
    box: function (w, h) {
      var s = clamp(Math.min(w, h * 1.6) / 420, 0.6, 1);
      function c(n) { return n * s; }
      return [
        [c(22), 0], [w - c(46), 0], [w - c(38), c(8)], [w - c(14), c(8)], [w, c(22)],
        [w, h - c(30)], [w - c(30), h],
        [c(46), h], [c(38), h - c(8)], [c(14), h - c(8)], [0, h - c(22)],
        [0, c(22)]
      ];
    },

    /* Itens da lista de quickhacks. */
    item: function (w, h) {
      var c = Math.min(16, h * 0.32), d = Math.min(10, h * 0.2);
      return [[0, 0], [w - c, 0], [w, c], [w, h], [d, h], [0, h - d]];
    },

    /* Botões. */
    btn: function (w, h) {
      var c = Math.min(10, h * 0.3);
      return [[c, 0], [w, 0], [w, h - c], [w - c, h], [0, h], [0, c]];
    }
  };

  /* O que recebe moldura. ring: desenha a borda; band: faixa de ferrugem. */
  var TARGETS = [
    { sel: '.panel',         shape: 'panel', border: 'panel', ring: true,  band: 'panel' },
    { sel: '.panel-glow i',  shape: 'panel',                  ring: false },
    { sel: '.qh-detail',     shape: 'box',   border: 'box',   ring: true,  band: 'box' },
    { sel: '.sysbox',        shape: 'box',   border: 'box',   ring: true,  band: 'box' },
    { sel: '.fm',            shape: 'box',   border: 'box',   ring: true,  band: 'box' },
    { sel: '.qh-item',       shape: 'item',  border: 'item',  ring: true },
    { sel: '.btn',           shape: 'btn',   border: 'btn',   ring: true }
  ];

  /* ---------- geometria ---------- */
  function fmt(v) { return Math.round(v * 10) / 10; }
  function pts(list) {
    return list.map(function (p) { return fmt(p[0]) + 'px ' + fmt(p[1]) + 'px'; }).join(',');
  }

  /* Recua o polígono t px para dentro (interseção das arestas deslocadas). */
  function inset(poly, t) {
    var n = poly.length, lines = [], i;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len; dy /= len;
      // normal para dentro (horário, y para baixo): (-dy, dx)
      lines.push({ px: a[0] - dy * t, py: a[1] + dx * t, dx: dx, dy: dy });
    }
    var out = [];
    for (i = 0; i < n; i++) {
      var l1 = lines[(i + n - 1) % n], l2 = lines[i];
      var cross = l1.dx * l2.dy - l1.dy * l2.dx;
      if (Math.abs(cross) < 1e-6) { out.push([l2.px, l2.py]); continue; }
      var s = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / cross;
      out.push([l1.px + s * l1.dx, l1.py + s * l1.dy]);
    }
    return out;
  }

  /* Anel entre o contorno e o contorno recuado (regra par-ímpar). */
  function ring(outer, inner) {
    return 'polygon(evenodd,' + pts(outer.concat([outer[0]])) + ',' + pts(inner.concat([inner[0]])) + ')';
  }

  /* ---------- aplicação ---------- */
  var registry = new WeakMap();
  var ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) update(entries[i].target);
      })
    : null;

  function update(el) {
    var cfg = registry.get(el);
    if (!cfg) return;
    var r = el.getBoundingClientRect();
    var w = r.width, h = r.height;
    if (w < 12 || h < 12) return;                              // oculto (display:none) ou vazio
    if (el.__fw === w && el.__fh === h) return;
    el.__fw = w; el.__fh = h;

    var outer = SHAPES[cfg.shape](w, h);
    el.style.setProperty('--clip-out', 'polygon(' + pts(outer) + ')');
    var t = 0;
    if (cfg.ring) {
      t = CONFIG.border[cfg.border] || 1;
      el.style.setProperty('--clip-ring', ring(outer, inset(outer, t)));
      if (cfg.band) el.style.setProperty('--clip-band', ring(outer, inset(outer, CONFIG.rustBand[cfg.band] || 7)));
    }
    el.dispatchEvent(new CustomEvent('frame:update', {
      bubbles: true,
      detail: { shape: cfg.shape, w: w, h: h, points: outer, border: t }
    }));
  }

  function attach(el, cfg) {
    if (registry.has(el)) return;
    registry.set(el, cfg);
    el.classList.add(cfg.ring ? 'frame' : 'frame-clip');
    if (ro) ro.observe(el);
    update(el);
  }

  function detach(el) {
    if (!registry.has(el)) return;
    registry.delete(el);
    if (ro) ro.unobserve(el);
  }

  function each(root, fn) {
    TARGETS.forEach(function (cfg) {
      if (root.matches && root.matches(cfg.sel)) fn(root, cfg);
      if (root.querySelectorAll) {
        var found = root.querySelectorAll(cfg.sel);
        for (var i = 0; i < found.length; i++) fn(found[i], cfg);
      }
    });
  }

  /* Itens e botões são criados depois pelo app.js: observa o DOM. */
  var mo = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i], j, n;
      for (j = 0; j < m.addedNodes.length; j++) {
        n = m.addedNodes[j];
        if (n.nodeType === 1) each(n, attach);
      }
      for (j = 0; j < m.removedNodes.length; j++) {
        n = m.removedNodes[j];
        if (n.nodeType === 1) each(n, detach);
      }
    }
  });

  function init() {
    each(document.documentElement, attach);
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);

  window.Frames = {
    config: CONFIG,
    shapes: SHAPES,
    /* recalcula tudo (útil depois de mudar uma forma no console) */
    refresh: function () {
      each(document.documentElement, function (el) { el.__fw = 0; update(el); });
    }
  };
})();
