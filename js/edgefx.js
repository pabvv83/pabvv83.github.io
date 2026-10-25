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
  var layerImpact = document.createElementNS(NS, 'g');   // brilho da moldura (BREACH)
  var layerGlitch = document.createElementNS(NS, 'g');
  svg.appendChild(layerStatic);
  svg.appendChild(layerImpact);
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

  /* ---------- glitch (trecho da borda deslocado) ----------
     opts (opcional, usado pelo impacto do BREACH): edge, t (posição na aresta),
     len, shift, time. Sem opções: trecho aleatório, como antes. */
  function glitchOnce(o) {
    o = (o && o.type === undefined && typeof o === 'object') ? o : {};
    if (!points || document.hidden || mq.matches) return;
    var idx = [], i;
    for (i = 0; i < points.length; i++) if (edgeInfo(i).len > 60) idx.push(i);
    if (!idx.length) return;
    var e = o.edge !== undefined ? edgeInfo(o.edge) : edgeInfo(idx[(Math.random() * idx.length) | 0]);
    if (e.len < 24) return;
    var len = Math.min(e.len - 8, o.len || between(Math.random, CONFIG.glitchLen));
    var t0 = o.t !== undefined
      ? Math.max(4, Math.min(e.len - len - 4, o.t - len / 2))
      : 4 + Math.random() * (e.len - len - 8);
    var shift = o.shift || between(Math.random, CONFIG.glitchShift) * (Math.random() < 0.7 ? 1 : -0.6);
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
    setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, o.time || CONFIG.glitchTime);
  }

  /* ---------- reação a um impacto (BREACH PROTOCOL) ----------
     nearest(): ponto da moldura mais próximo de (x, y) da tela.
     impact():  acende trechos da moldura a partir desse ponto, com brilho que
                se propaga e depois se apaga; distorce a borda por instantes e
                reforça o brilho externo do painel (--hit). Nada move o painel. */
  function panelOrigin() { var r = panel.getBoundingClientRect(); return { x: r.left, y: r.top }; }

  function nearest(vx, vy) {
    if (!points) return null;
    var o = panelOrigin(), lx = vx - o.x, ly = vy - o.y, best = null;
    for (var i = 0; i < points.length; i++) {
      var e = edgeInfo(i);
      var t = Math.max(0, Math.min(e.len, (lx - e.a[0]) * e.ux + (ly - e.a[1]) * e.uy));
      var px = e.a[0] + e.ux * t, py = e.a[1] + e.uy * t;
      var d = Math.sqrt((lx - px) * (lx - px) + (ly - py) * (ly - py));
      if (!best || d < best.d) best = { d: d, i: i, t: t, x: px, y: py };
    }
    return { x: best.x + o.x, y: best.y + o.y, i: best.i, t: best.t, d: best.d };
  }

  function walk(i, t, L, dir) {                  // caminha pelo perímetro a partir de (aresta i, posição t)
    var n = points.length, idx = i, pos = t, left = L, e = edgeInfo(idx);
    var out = [[e.a[0] + e.ux * pos, e.a[1] + e.uy * pos]], guard = 0;
    while (left > 0 && guard++ < n + 2) {
      e = edgeInfo(idx);
      var room = dir > 0 ? e.len - pos : pos;
      if (left <= room) { pos += dir * left; out.push([e.a[0] + e.ux * pos, e.a[1] + e.uy * pos]); break; }
      left -= room;
      idx = (idx + dir + n) % n; e = edgeInfo(idx);
      pos = dir > 0 ? 0 : e.len;
      out.push([e.a[0] + e.ux * pos, e.a[1] + e.uy * pos]);
    }
    return out;
  }
  function polyStr(list) { return list.map(function (p) { return f(p[0]) + ',' + f(p[1]); }).join(' '); }

  var impacts = [], impactTimers = [], hitRaf = 0;

  function hitFrame() {
    var now = performance.now(), maxHit = 0;
    for (var k = impacts.length - 1; k >= 0; k--) {
      var im = impacts[k], e = now - im.t0;
      if (e >= im.dur) {
        if (im.glow.parentNode) im.glow.parentNode.removeChild(im.glow);
        if (im.core.parentNode) im.core.parentNode.removeChild(im.core);
        impacts.splice(k, 1);
        continue;
      }
      var grow = Math.min(1, e / 260), ease = 1 - Math.pow(1 - grow, 3);       // o brilho se espalha pela moldura
      var fade = e < 70 ? e / 70 : Math.pow(1 - (e - 70) / (im.dur - 70), 1.6); // e se apaga aos poucos
      var Lc = im.L * (0.25 + 0.75 * ease);
      var back = walk(im.i, im.t, Lc, -1).reverse(), fwd = walk(im.i, im.t, Lc, 1);
      var str = polyStr(back.concat(fwd.slice(1)));
      im.glow.setAttribute('points', str); im.core.setAttribute('points', str);
      im.glow.style.opacity = (im.peak * fade * 0.55).toFixed(3);
      im.core.style.opacity = (im.peak * fade).toFixed(3);
      if (im.peak * fade > maxHit) maxHit = im.peak * fade;
    }
    wrap.style.setProperty('--hit', maxHit.toFixed(3));
    if (impacts.length) hitRaf = requestAnimationFrame(hitFrame);
    else { hitRaf = 0; wrap.style.removeProperty('--hit'); }
  }

  /* o: { edge (px de moldura acesa de cada lado), glitches, dur (ms), peak (0..1), soft } */
  function impact(vx, vy, o) {
    o = o || {};
    var n = nearest(vx, vy);
    if (!n) return null;
    var peak = (o.peak === undefined ? 0.8 : o.peak) * (o.soft ? 0.5 : 1);
    var glow = el('polyline', { 'class': 'fx-impact-glow' });
    var core = el('polyline', { 'class': 'fx-impact-core' });
    layerImpact.appendChild(glow); layerImpact.appendChild(core);
    impacts.push({ i: n.i, t: n.t, t0: performance.now(), dur: o.dur || 1200, peak: peak,
                   L: (o.edge || 120) * (o.soft ? 0.6 : 1), glow: glow, core: core });
    if (!hitRaf) hitRaf = requestAnimationFrame(hitFrame);
    if (!o.soft && !mq.matches) {                       // distorção curta da borda, junto ao impacto
      var count = o.glitches || 0, N = points.length;
      for (var k = 0; k < count; k++) {
        (function (k) {
          impactTimers.push(setTimeout(function () {
            var side = k === 0 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 0 : 1);
            var ei = (n.i + side + N) % N;
            glitchOnce({ edge: ei, t: ei === n.i ? n.t : undefined, len: 40 + Math.random() * 90,
                         shift: 4 + Math.random() * 6 * (1 + (o.glitches || 0) / 6), time: 110 + Math.random() * 90 });
          }, 30 + k * 65 + Math.random() * 40));
        })(k);
      }
    }
    return n;
  }

  function clearImpact() {
    impactTimers.forEach(clearTimeout); impactTimers = [];
    impacts.forEach(function (im) {
      if (im.glow.parentNode) im.glow.parentNode.removeChild(im.glow);
      if (im.core.parentNode) im.core.parentNode.removeChild(im.core);
    });
    impacts = [];
    if (hitRaf) { cancelAnimationFrame(hitRaf); hitRaf = 0; }
    wrap.style.removeProperty('--hit');
    layerGlitch.textContent = '';
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

  window.EdgeFX = {
    config: CONFIG, glitch: glitchOnce,
    nearest: nearest, impact: impact, clearImpact: clearImpact,
    get ready() { return !!points; },
    get active() { return impacts.length; }
  };
})();
