/* =====================================================================
   ABISMO DIGITAL — fundo da Blackwall
   ---------------------------------------------------------------------
   Camada puramente decorativa, atrás de tudo (canvas fixo, sem eventos):
   linhas verticais irregulares que caem como código, mais densas perto do
   horizonte vermelho. O brilho do horizonte e o escurecimento são CSS
   (.horizon, em css/style.css); aqui só são desenhadas as linhas.

   Os raios da Blackwall (js/blackwall.js) ficam por cima e iluminam este
   fundo: cada descarga dispara o evento "blackwall:strike".

   Independe da navegação e das seções. Pausa com a aba oculta. Com
   movimento reduzido, desenha um quadro estático (identidade preservada).

   AJUSTES: mexa apenas em CONFIG.
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    horizon:        0.62,         // altura do horizonte (0 = topo, 1 = base)
    density:        1,            // multiplicador da quantidade de linhas (0.5 a 1.6)
    perHundred:     14,           // linhas por 100 px de largura (antes da densidade)
    maxColumns:     320,          // teto de linhas (desempenho)
    clusterShare:   0.45,         // fração das linhas agrupadas em "feixes"
    clusters:       7,            // quantidade de feixes
    structureShare: 0.16,         // fração de linhas fixas (estrutura, sem queda)
    speed:          [14, 78],     // velocidade de queda (px/s)
    dash:           [18, 300],    // comprimento de cada linha que cai (px)
    gap:            [90, 520],    // vazio entre uma linha e a próxima na mesma coluna (px)
    alpha:          [0.12, 0.55], // opacidade base (as mais fortes são raras)
    headBoost:      2.6,          // brilho da "cabeça" de cada linha
    fps:            30,           // limite de quadros por segundo
    strikeBoost:    0.9           // quanto cada raio da Blackwall acende o fundo
  };

  var canvas = document.getElementById('abyss');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var horizonEl = document.querySelector('.horizon');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.documentElement.style.setProperty('--hy', (CONFIG.horizon * 100) + '%');

  var W = 0, H = 0;
  var cols = [];
  var mask = null;
  var t = 0, last = 0, raf = 0;
  var pulse = 0;
  var quality = 1, slow = 0;
  var animate = !mq.matches;
  var hitTimer = null;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

  /* ---------- geração das colunas ---------- */
  function build() {
    var n = Math.round(W / 100 * CONFIG.perHundred * CONFIG.density * quality);
    n = Math.max(20, Math.min(Math.round(CONFIG.maxColumns * quality), n));
    var centers = [];
    for (var k = 0; k < CONFIG.clusters; k++) centers.push(rand(0, W));
    cols = [];
    for (var i = 0; i < n; i++) {
      var clustered = Math.random() < CONFIG.clusterShare;
      var x = clustered ? centers[(Math.random() * centers.length) | 0] + gauss() * 55 : rand(0, W);
      x = Math.round(Math.max(0, Math.min(W, x))) + 0.5;           // +0.5 mantém a linha de 1 px nítida
      var c = {
        x: x,
        w: Math.random() < 0.16 ? 2 : 1,
        a: CONFIG.alpha[0] + (CONFIG.alpha[1] - CONFIG.alpha[0]) * Math.pow(Math.random(), 2.2),
        dark: Math.random() < 0.3,                                  // parte usa o vermelho escuro
        hot: Math.random() < 0.08                                   // poucas cabeças claras
      };
      if (Math.random() < CONFIG.structureShare) {
        c.fixed = true; c.a = rand(0.04, 0.10); c.w = 1;
      } else {
        c.len = rand(CONFIG.dash[0], CONFIG.dash[1]);
        c.head = Math.max(6, c.len * rand(0.10, 0.22));
        c.period = c.len + rand(CONFIG.gap[0], CONFIG.gap[1]);
        c.speed = rand(CONFIG.speed[0], CONFIG.speed[1]);
        c.phase = Math.random() * c.period;
      }
      cols.push(c);
    }
  }

  /* ---------- desenho ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'butt';
    var boost = 1 + pulse * CONFIG.strikeBoost;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var a = Math.min(1, c.a * boost);
      var rgb = c.dark ? '122,16,32' : '255,23,56';
      ctx.lineWidth = c.w;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(c.x, 0);
      ctx.lineTo(c.x, H);
      if (c.fixed) {
        ctx.setLineDash([]);
        ctx.stroke();
        continue;
      }
      var pos = (t * c.speed + c.phase) % c.period;
      ctx.setLineDash([c.len, c.period - c.len]);
      ctx.lineDashOffset = -pos;                                    // desloca o padrão para baixo
      ctx.stroke();
      // cabeça brilhante na ponta de baixo de cada linha
      ctx.setLineDash([c.head, c.period - c.head]);
      ctx.lineDashOffset = -(pos + c.len - c.head);
      ctx.strokeStyle = c.hot
        ? 'rgba(216,216,220,' + Math.min(1, a * 1.8).toFixed(3) + ')'
        : 'rgba(255,23,56,' + Math.min(1, a * CONFIG.headBoost).toFixed(3) + ')';
      ctx.stroke();
    }
    // escurece longe do horizonte (uma única máscara vertical)
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- laço (limitado a CONFIG.fps, pausa com a aba oculta) ---------- */
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var step = 1000 / CONFIG.fps;
    if (last && ts - last < step - 2) return;
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;
    t += dt;
    pulse *= 0.9;
    var t0 = performance.now();
    draw();
    // desempenho adaptativo: se desenhar custar caro, reduz a quantidade de linhas
    if (quality === 1) {
      slow = (performance.now() - t0) > 10 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45) { quality = 0.55; build(); }
    }
  }
  function start() {
    if (raf || !animate || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

  /* ---------- tamanho ---------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    var widthChanged = Math.abs(w - W) > 1;
    W = w; H = h;
    canvas.width = W;
    canvas.height = H;
    var hz = CONFIG.horizon;
    mask = ctx.createLinearGradient(0, 0, 0, H);                    // opacidade por altura
    mask.addColorStop(0,                 'rgba(0,0,0,0.30)');
    mask.addColorStop(hz * 0.55,         'rgba(0,0,0,0.60)');
    mask.addColorStop(hz,                'rgba(0,0,0,1)');
    mask.addColorStop(hz + (1 - hz) * .5,'rgba(0,0,0,0.70)');
    mask.addColorStop(1,                 'rgba(0,0,0,0.25)');
    if (widthChanged || !cols.length) build();
    if (!animate) draw();
  }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  /* ---------- reação aos raios da Blackwall ---------- */
  window.addEventListener('blackwall:strike', function () {
    if (!animate) return;
    pulse = Math.min(1.2, pulse + 0.7);
    if (horizonEl) {
      horizonEl.classList.add('hit');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(function () { horizonEl.classList.remove('hit'); }, 420);
    }
  });

  /* ---------- movimento reduzido ---------- */
  function onMotionChange() {
    animate = !mq.matches;
    stop();
    if (animate) start(); else draw();
  }
  if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
  else if (mq.addListener) mq.addListener(onMotionChange);

  resize();
  draw();
  start();

  /* API pública (ajustes e testes no console) */
  window.Abyss = {
    config: CONFIG,
    get columns() { return cols.length; },
    get running() { return !!raf; },
    get quality() { return quality; }
  };
})();
