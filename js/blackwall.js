/* =====================================================================
   BLACKWALL — descargas vermelhas no fundo do site
   ---------------------------------------------------------------------
   Camada puramente decorativa (canvas fixo, pointer-events:none, atrás
   do conteúdo). Evoluída a partir da implementação original: continua
   sendo Canvas 2D, com raios ramificados, faíscas, flash nas bordas e
   barras de interferência — agora com posições por toda a tela,
   trajetórias angulares, brilho em camadas, iluminação do ambiente e
   dissipação gradual.

   O efeito é independente da navegação: nada aqui depende das seções.
   O laço de animação só roda enquanto existe algum raio na tela.

   AJUSTES: mexa apenas em CONFIG (logo abaixo).
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    /* frequência */
    interval:        [1800, 6500],  // ms entre descargas (mín, máx)
    surgeChance:     0.06,          // chance de uma descarga forte (rara)
    perDischarge:    [1, 2],        // raios por descarga normal
    surgeBolts:      [5, 7],        // raios numa descarga forte
    maxBolts:        9,             // máximo simultâneo na tela

    /* duração e dissipação */
    duration:        [520, 1150],   // vida de cada raio (ms)
    growth:          0.16,          // fração da vida em que o raio "cresce"
    flicker:         0.35,          // 0 = sem tremulação, 1 = muito instável
    restrikePulse:   true,          // pequeno pulso de reacendimento

    /* trajetória */
    length:          [0.16, 0.46],  // comprimento do tronco (× maior dimensão da tela)
    step:            [12, 30],      // px por segmento (menor = mais irregular)
    turn:            0.55,          // variação angular normal (rad)
    sharpTurnChance: 0.18,          // viradas bruscas (visual angular/digital)
    branchChance:    0.2,           // chance de ramificar a cada vértice
    branchDepth:     2,             // níveis de ramificação
    edgeBias:        0.7,           // 0..1: tendência a nascer perto das bordas

    /* aparência */
    glow:            1,             // multiplicador do brilho (0 a 2)
    coreWidth:       1.4,           // espessura do núcleo (px)
    lightRadius:     [150, 320],    // raio da área iluminada ao redor (px)
    lightIntensity:  0.16,          // 0..1 — intensidade da iluminação
    sparks:          6,             // faíscas por raio

    /* surto raro: flash lateral + barras de interferência */
    edgeFlash:       true,
    glitchBars:      true,

    /* movimento reduzido: mantém os raios, sem tremulação nem surtos */
    reduced: {
      interval:  [9000, 16000],
      maxBolts:  1,
      duration:  [2400, 3400],
      intensity: 0.55           // multiplica a opacidade
    }
  };

  var canvas = document.getElementById('bolts');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var flashEl = document.getElementById('flash');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  var W = 0, H = 0, dpr = 1;
  var bolts = [];
  var running = false;
  var quality = 1;          // cai para 0.5 se o dispositivo estiver lento
  var calm = mq.matches;    // modo movimento reduzido
  var timer = null;
  var slowFrames = 0, lastTs = 0;
  var stats = { discharges: 0, surges: 0 };
  var history = [];         // últimas origens (para inspeção/teste)

  function rand(a, b) { return a + Math.random() * (b - a); }
  function range(r) { return rand(r[0], r[1]); }
  function pick(n) { return Math.floor(Math.random() * n); }

  /* ---------- tamanho / proporção de pixels ---------- */
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    // telas enormes: limita a resolução interna para manter o desempenho
    var cap = (W * H > 1.4e6) ? 1.5 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
  }

  /* ---------- geração do raio ---------- */
  function pickOrigin() {
    var x, y, base, style = Math.random() < 0.5 ? 'strike' : 'arc';
    if (Math.random() < CONFIG.edgeBias) {
      var r = Math.random();
      if (r < 0.35) {            // borda esquerda
        x = rand(-10, W * 0.12); y = rand(0, H);
        base = style === 'arc' ? rand(-0.5, 0.5) : Math.PI / 2 + rand(-0.4, 0.4);
      } else if (r < 0.70) {     // borda direita
        x = rand(W * 0.88, W + 10); y = rand(0, H);
        base = style === 'arc' ? Math.PI + rand(-0.5, 0.5) : Math.PI / 2 + rand(-0.4, 0.4);
      } else if (r < 0.85) {     // topo
        x = rand(0, W); y = rand(-10, H * 0.1);
        base = Math.PI / 2 + rand(-0.6, 0.6);
      } else {                   // base
        x = rand(0, W); y = rand(H * 0.9, H + 10);
        base = -Math.PI / 2 + rand(-0.6, 0.6);
      }
    } else {                     // região livre
      x = rand(W * 0.1, W * 0.9); y = rand(0, H * 0.9);
      base = rand(0, Math.PI * 2);
    }
    return { x: x, y: y, heading: base };
  }

  function trace(paths, x, y, heading, len, depth, width) {
    var pts = [[x, y]], d = 0, base = heading, gen = CONFIG;
    var guard = 0;
    while (d < len && guard++ < 160) {
      var s = range(gen.step);
      var dh = Math.random() < gen.sharpTurnChance
        ? (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.0)     // virada brusca
        : rand(-gen.turn, gen.turn) * 0.6;
      heading += dh;
      heading += (base - heading) * 0.25;                      // evita espirais
      x += Math.cos(heading) * s;
      y += Math.sin(heading) * s;
      d += s;
      pts.push([x, y]);
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120) break;
      if (depth < gen.branchDepth && Math.random() < gen.branchChance) {
        var side = Math.random() < 0.5 ? -1 : 1;
        trace(paths, x, y, heading + side * rand(0.5, 1.1),
          len * rand(0.16, 0.38), depth + 1, width * 0.6);
      }
    }
    paths.push({ pts: pts, w: width, depth: depth });
  }

  function makeBolt() {
    var o = pickOrigin();
    var paths = [];
    var len = rand(CONFIG.length[0], CONFIG.length[1]) * Math.max(W, H);
    trace(paths, o.x, o.y, o.heading, len, 0, 1);
    var main = paths[paths.length - 1];          // o tronco é o último inserido
    for (var i = 0; i < paths.length; i++) if (paths[i].depth === 0) main = paths[i];
    var byDepth = [];
    for (var j = 0; j < paths.length; j++) {
      (byDepth[paths[j].depth] = byDepth[paths[j].depth] || []).push(paths[j]);
    }
    var mid = main.pts[Math.floor(main.pts.length / 2)];
    var end = main.pts[main.pts.length - 1];
    var sparks = [];
    if (!calm) {
      for (var k = 0; k < CONFIG.sparks; k++) {
        var p = main.pts[pick(main.pts.length)];
        sparks.push({ x: p[0], y: p[1], vx: rand(-1, 1) * 1.3, vy: rand(-0.7, 1.3) });
      }
    }
    var dur = calm ? range(CONFIG.reduced.duration) : range(CONFIG.duration);
    return {
      paths: paths, byDepth: byDepth, main: main, mid: mid, end: end, sparks: sparks,
      t0: performance.now(), dur: dur,
      light: range(CONFIG.lightRadius),
      pulseAt: rand(0.3, 0.5),
      origin: o
    };
  }

  /* ---------- desenho ---------- */
  function alphaAt(p, b) {
    var a;
    if (calm) {                                    // fade suave, sem tremulação
      a = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
      return Math.max(0, a) * CONFIG.reduced.intensity;
    }
    var g = CONFIG.growth;
    a = p < g ? 1 : Math.pow(1 - (p - g) / (1 - g), 1.7);
    if (CONFIG.restrikePulse && p > b.pulseAt && p < b.pulseAt + 0.07) a += 0.5;
    if (p > g) a *= 1 - CONFIG.flicker * Math.random();
    return Math.max(0, Math.min(1, a));
  }

  /* Um único traçado por camada e nível de ramificação (menos chamadas,
     menos pixels borrados). growth < 1 revela o raio progressivamente. */
  function strokeGroup(group, growth, color, width, blur) {
    ctx.beginPath();
    for (var g = 0; g < group.length; g++) {
      var pts = group[g].pts;
      var n = Math.max(2, Math.min(pts.length, Math.ceil(pts.length * growth) + 1));
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = blur;
    if (blur) ctx.shadowColor = '#FF1738';
    ctx.stroke();
  }

  function lightAt(x, y, radius, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(255,23,56,' + alpha + ')');
    g.addColorStop(0.45, 'rgba(122,16,32,' + (alpha * 0.45) + ')');
    g.addColorStop(1, 'rgba(122,16,32,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawBolt(b, p, dt) {
    var a = alphaAt(p, b);
    if (a <= 0.003) return;
    var growth = calm ? 1 : Math.min(1, p / CONFIG.growth);
    var gl = CONFIG.glow * quality;

    // iluminação do ambiente (aditiva) — sempre atrás das linhas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    lightAt(b.mid[0], b.mid[1], b.light, CONFIG.lightIntensity * a);
    if (bolts.length <= 4) {                      // em surtos, só a luz principal
      lightAt(b.end[0], b.end[1], b.light * 0.55, CONFIG.lightIntensity * 0.8 * a * growth);
    }
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    var depths = b.byDepth.length;
    var d, grp, w;
    // 1) sombra vermelho-escura (profundidade)
    for (d = 0; d < depths; d++) if ((grp = b.byDepth[d])) {
      w = Math.pow(0.6, d);
      strokeGroup(grp, growth, 'rgba(122,16,32,' + (0.6 * a) + ')', 3.4 * w, 0);
    }
    // 2) brilho difuso: traços largos e translúcidos empilhados (barato)
    if (gl > 0) {
      for (d = 0; d < depths; d++) if ((grp = b.byDepth[d])) {
        w = Math.pow(0.6, d);
        strokeGroup(grp, growth, 'rgba(255,23,56,' + (0.07 * a * gl) + ')', 11 * w, 0);
        strokeGroup(grp, growth, 'rgba(255,23,56,' + (0.16 * a * gl) + ')', 5.5 * w, 0);
      }
    }
    // 3) corpo vermelho neon (único passo com desfoque real)
    for (d = 0; d < depths; d++) if ((grp = b.byDepth[d])) {
      w = Math.pow(0.6, d);
      strokeGroup(grp, growth, 'rgba(255,23,56,' + a + ')', 1.9 * w, quality >= 1 ? 10 * gl : 0);
    }
    // 4) núcleo quente
    for (d = 0; d < depths; d++) if ((grp = b.byDepth[d])) {
      w = Math.pow(0.6, d);
      strokeGroup(grp, growth, 'rgba(255,176,186,' + (0.9 * a) + ')', CONFIG.coreWidth * w, 0);
    }
    ctx.shadowBlur = 0;

    // faíscas
    for (var k = 0; k < b.sparks.length; k++) {
      var s = b.sparks[k];
      s.x += s.vx * dt * 0.06;
      s.y += s.vy * dt * 0.06;
      ctx.fillStyle = 'rgba(255,23,56,' + (a * 0.9) + ')';
      ctx.fillRect(s.x, s.y, 2, 2);
    }
  }

  /* ---------- laço (só roda com raios ativos) ---------- */
  function frame(ts) {
    var now = performance.now();
    if (!bolts.length) {
      running = false;
      ctx.clearRect(0, 0, W, H);
      return;
    }
    var dt = lastTs ? Math.min(64, ts - lastTs) : 16;
    lastTs = ts;
    // desempenho adaptativo: reduz o brilho se os quadros estiverem lentos
    if (quality === 1) {
      slowFrames = dt > 34 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 8) quality = 0.5;
    }

    ctx.clearRect(0, 0, W, H);
    for (var i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i];
      var p = Math.max(0, (now - b.t0) / b.dur);
      if (p >= 1) { bolts.splice(i, 1); continue; }
      drawBolt(b, p, dt);
    }
    if (bolts.length) requestAnimationFrame(frame);
    else { running = false; lastTs = 0; ctx.clearRect(0, 0, W, H); }
  }

  function start() {
    if (running) return;
    running = true;
    lastTs = 0;
    requestAnimationFrame(frame);
  }

  /* ---------- disparo ---------- */
  function limit() {
    var m = calm ? CONFIG.reduced.maxBolts : CONFIG.maxBolts;
    return quality < 1 ? Math.max(2, Math.floor(m * 0.6)) : m;
  }

  function spawn() {
    if (bolts.length >= limit()) return;
    var b = makeBolt();
    bolts.push(b);
    stats.discharges++;
    history.push({ x: Math.round(b.origin.x), y: Math.round(b.origin.y) });
    if (history.length > 40) history.shift();
    // avisa o fundo (js/abyss.js), que acende o horizonte por um instante
    window.dispatchEvent(new CustomEvent('blackwall:strike', { detail: { x: b.origin.x, y: b.origin.y } }));
    start();
  }

  function fire(n) {
    n = n || 1;
    for (var i = 0; i < n; i++) spawn();
  }

  function glitchBar() {
    var d = document.createElement('div');
    d.className = 'glitch-bar';
    var left = Math.random() < 0.5;
    d.style.cssText = 'top:' + rand(0, H) + 'px;height:' + rand(2, 6) + 'px;width:' +
      rand(40, 160) + 'px;' + (left ? 'left:0' : 'right:0');
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, rand(70, 160));
  }

  function surge() {
    stats.surges++;
    fire(Math.round(range(CONFIG.surgeBolts)));
    if (calm) return;                       // sem flashes em movimento reduzido
    if (CONFIG.edgeFlash && flashEl) {
      flashEl.classList.remove('on');
      void flashEl.offsetWidth;
      flashEl.classList.add('on');
    }
    if (CONFIG.glitchBars) for (var i = 0; i < 4; i++) setTimeout(glitchBar, i * 60);
  }

  function schedule() {
    clearTimeout(timer);
    var iv = calm ? CONFIG.reduced.interval : CONFIG.interval;
    timer = setTimeout(function () {
      if (!document.hidden) {
        var r = Math.random();
        if (!calm && r < CONFIG.surgeChance) surge();
        else {
          fire(calm ? 1 : Math.round(range(CONFIG.perDischarge)));
          if (!calm && CONFIG.glitchBars && Math.random() < 0.4) glitchBar();
        }
      }
      schedule();
    }, rand(iv[0], iv[1]));
  }

  /* ---------- ciclo de vida ---------- */
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  function onMotionChange() {
    calm = mq.matches;
    bolts.length = 0;
    ctx.clearRect(0, 0, W, H);
    schedule();
  }
  if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
  else if (mq.addListener) mq.addListener(onMotionChange);

  resize();
  setTimeout(function () { fire(1); }, 900);
  schedule();

  /* API pública (útil para ajustes e testes no console) */
  window.Blackwall = {
    config: CONFIG,
    fire: fire,
    surge: surge,
    history: history,
    stats: stats,
    get active() { return bolts.length; },
    get calm() { return calm; },
    get quality() { return quality; }
  };
})();
