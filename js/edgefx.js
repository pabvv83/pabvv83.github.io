/* =====================================================================
   DETALHES DE BORDA — ferrugem e glitch no contorno do painel
   ---------------------------------------------------------------------
   Desenha, por cima da borda vermelha do painel central, um SVG decorativo:
     • marcas de "ferrugem": pequenos traços, pontos e lascas junto à borda;
     • glitch: de tempos em tempos, um trecho da borda se desloca para fora
       por uma fração de segundo (e some).
   Usa o contorno calculado por js/frames.js (evento "frame:update"), então
   acompanha as diagonais e se refaz sozinho quando o tamanho muda.
   As mesmas cores do site (var(--red) e var(--red-dark)); com o glitch roxo
   as marcas ficam roxas junto com a borda.

   Movimento reduzido: só as marcas estáticas; nada de glitch animado.
   Tudo é decorativo (aria-hidden) e não recebe cliques.

   AJUSTES: mexa apenas em CONFIG.
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    seed:         83,          // muda o "desenho" da ferrugem
    marksPer100:  3.2,         // marcas por 100 px de borda
    glitchEvery:  [2800, 7500],// intervalo entre glitches (ms)
    glitchLen:    [26, 90],    // comprimento do trecho deslocado (px)
    glitchShift:  [3, 7],      // quanto o trecho sai da borda (px)
    glitchTime:   150,         // duração de cada glitch (ms)
    strikeChance: 0.35         // chance de um raio da Blackwall causar glitch
  };

  var NS = 'http://www.w3.org/2000/svg';
  var wrap = document.querySelector('.panel-wrap');
  var panel = document.querySelector('.panel');
  if (!wrap || !panel) return;

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'panel-fx');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  var layerStatic = document.createElementNS(NS, 'g');
  var layerGlitch = document.createElementNS(NS, 'g');
  svg.appendChild(layerStatic);
  svg.appendChild(layerGlitch);
  wrap.appendChild(svg);

  var points = null, border = 1.5, timer = null;

  function prng(seed) {                       // gerador determinístico (mulberry32)
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function between(rnd, r) { return r[0] + rnd() * (r[1] - r[0]); }
  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function f(v) { return Math.round(v * 10) / 10; }

  /* geometria de uma aresta: ponto em t px, direção e normal para dentro */
  function edgeInfo(i) {
    var a = points[i], b = points[(i + 1) % points.length];
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy);
    return { a: a, len: len, ux: dx / (len || 1), uy: dy / (len || 1) };
  }

  /* ---------- ferrugem (estática) ---------- */
  function drawStatic(w, h) {
    while (layerStatic.firstChild) layerStatic.removeChild(layerStatic.firstChild);
    var rnd = prng(CONFIG.seed);
    for (var i = 0; i < points.length; i++) {
      var e = edgeInfo(i);
      if (e.len < 14) continue;
      var nx = -e.uy, ny = e.ux;                       // para dentro
      var count = Math.round(e.len / 100 * CONFIG.marksPer100 + rnd());
      for (var m = 0; m < count; m++) {
        var t = 6 + rnd() * Math.max(1, e.len - 12);
        var px = e.a[0] + e.ux * t, py = e.a[1] + e.uy * t;
        var kind = rnd();
        var inward = border + 1 + rnd() * 3;
        var x = px + nx * inward, y = py + ny * inward;
        if (kind < 0.42) {                              // traço curto paralelo à borda
          var L = 5 + rnd() * 20;
          layerStatic.appendChild(el('line', {
            x1: f(x), y1: f(y), x2: f(x + e.ux * L), y2: f(y + e.uy * L),
            'class': rnd() < 0.55 ? 'fx-dim' : 'fx-hot', 'stroke-width': rnd() < 0.3 ? 2 : 1
          }));
        } else if (kind < 0.68) {                       // marca perpendicular (entalhe)
          var T = 3 + rnd() * 5;
          layerStatic.appendChild(el('line', {
            x1: f(px + nx * border), y1: f(py + ny * border),
            x2: f(px + nx * (border + T)), y2: f(py + ny * (border + T)),
            'class': 'fx-hot', 'stroke-width': 1
          }));
        } else if (kind < 0.88) {                       // lasca (pixel solto)
          var s = 1.5 + rnd() * 2.5;
          layerStatic.appendChild(el('rect', {
            x: f(x), y: f(y), width: f(s), height: f(s), 'class': rnd() < 0.5 ? 'fx-dim' : 'fx-hot'
          }));
        } else {                                        // mancha de ferrugem (grupo de pontos)
          for (var k = 0; k < 4; k++) {
            layerStatic.appendChild(el('rect', {
              x: f(x + e.ux * k * 2.4 + (rnd() - .5) * 3), y: f(y + ny * rnd() * 4),
              width: 1.6, height: 1.6, 'class': 'fx-dim'
            }));
          }
        }
      }
    }
    svg.setAttribute('width', f(w));
    svg.setAttribute('height', f(h));
    svg.setAttribute('viewBox', '0 0 ' + f(w) + ' ' + f(h));
  }

  /* ---------- glitch (trecho da borda deslocado) ---------- */
  function glitchOnce() {
    if (!points || document.hidden || mq.matches) return;
    var idx = [], i;
    for (i = 0; i < points.length; i++) if (edgeInfo(i).len > 60) idx.push(i);
    if (!idx.length) return;
    var e = edgeInfo(idx[(Math.random() * idx.length) | 0]);
    var len = Math.min(e.len - 8, between(Math.random, CONFIG.glitchLen));
    var t0 = 4 + Math.random() * (e.len - len - 8);
    var shift = between(Math.random, CONFIG.glitchShift) * (Math.random() < 0.7 ? 1 : -0.6);
    var nx = -e.uy, ny = e.ux;                           // para dentro; desloca para fora
    var x1 = e.a[0] + e.ux * t0, y1 = e.a[1] + e.uy * t0;
    var x2 = x1 + e.ux * len, y2 = y1 + e.uy * len;
    var ox = -nx * shift, oy = -ny * shift;
    var g = document.createElementNS(NS, 'g');
    g.appendChild(el('line', {                           // trecho deslocado
      x1: f(x1 + ox), y1: f(y1 + oy), x2: f(x2 + ox), y2: f(y2 + oy),
      'class': 'fx-glitch', 'stroke-width': 2
    }));
    g.appendChild(el('line', {                           // eco fraco no lugar original
      x1: f(x1 + ox * 0.4 - e.ux * 8), y1: f(y1 + oy * 0.4 - e.uy * 8),
      x2: f(x2 + ox * 0.4 + e.ux * 10), y2: f(y2 + oy * 0.4 + e.uy * 10),
      'class': 'fx-dim', 'stroke-width': 1
    }));
    layerGlitch.appendChild(g);
    setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, CONFIG.glitchTime);
  }

  function schedule() {
    clearTimeout(timer);
    if (mq.matches) return;
    timer = setTimeout(function () {
      glitchOnce();
      if (Math.random() < 0.3) setTimeout(glitchOnce, 90);   // às vezes em dupla
      schedule();
    }, between(Math.random, CONFIG.glitchEvery));
  }

  /* ---------- ligações ---------- */
  panel.addEventListener('frame:update', function (ev) {
    if (ev.target !== panel) return;
    points = ev.detail.points;
    border = ev.detail.border || 1.5;
    drawStatic(ev.detail.w, ev.detail.h);
  });
  window.addEventListener('blackwall:strike', function () {
    if (Math.random() < CONFIG.strikeChance) glitchOnce();
  });
  function onMotion() { if (mq.matches) { clearTimeout(timer); layerGlitch.textContent = ''; } else schedule(); }
  if (mq.addEventListener) mq.addEventListener('change', onMotion);
  else if (mq.addListener) mq.addListener(onMotion);

  /* o painel pode ter sido moldado antes deste script: pede o recálculo */
  if (window.Frames) window.Frames.refresh();
  schedule();

  window.EdgeFX = { config: CONFIG, glitch: glitchOnce };
})();
