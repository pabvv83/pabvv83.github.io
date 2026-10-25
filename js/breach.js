/* =====================================================================
   BLACKWALL BREACH PROTOCOL — v2.1
   ---------------------------------------------------------------------
   Easter egg escondido no fundo: clicar numa região vazia (fora do painel,
   dos menus e de qualquer controle) tem uma chance de disparar uma
   dramatização visual — algo tenta atravessar a Blackwall, a barreira
   reage e tudo volta à calma. É só estética: nada aqui acessa rede,
   executa código externo ou guarda dados.

   MÁQUINA DE ESTADOS
     STABLE → INTRUSION → DEFENSE → RECOVERY → STABLE
   Um único relógio (performance.now) coordena tudo, então a sequência não
   depende da taxa de quadros:
     INTRUSION  linhas do fundo se deformam, fragmentos vermelhos surgem,
                uma onda de distorção avança e tentáculos angulares sondam
                a moldura do painel;
     DEFENSE    a Blackwall responde: descargas dirigidas (js/blackwall.js),
                clarão no ponto de impacto, onda de energia, interferência e
                brilho/distorção da moldura (js/edgefx.js);
     RECOVERY   raios, fragmentos e brilho se dissipam gradualmente.

   Camadas reaproveitadas: os raios são os do blackwall.js (função strike),
   o fundo é o abyss.js (reage ao evento "breach:phase") e a moldura é a do
   edgefx.js. Este arquivo só adiciona um canvas próprio (#breach), que
   existe apenas durante o evento, mais o alerta de HUD (#secAlert).

   Eventos: "breach:phase" no window, {state, level, name, zone}.
   Atributo: <html data-breach="intrusion|defense|recovery"> (removido ao
   voltar a STABLE). Nenhum estado persiste entre sessões.

   AJUSTES: mexa apenas em CONFIG.
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    clickChance:  0.20,             // chance de ativar por clique elegível
    cooldown:     [15000, 20000],   // ms de espera, depois do fim, antes de aceitar outro evento
    levelWeights: [60, 30, 10],     // chance (%) dos níveis 1, 2 e 3 — só sorteada quando o evento ativa
    nearClick:    0.6,              // chance de a invasão acontecer perto de onde você clicou
    jitterStep:   70,               // ms entre "tremidas" das linhas (passo discreto, sem tremor contínuo)
    reducedMotion: { level: 1, soft: 0.45 },   // movimento reduzido: só o nível 1, bem suave

    /* os três níveis. Tempos em ms; quantidades são tetos (desempenho). */
    levels: [
      { name: 'ANOMALY', intrusion: 1400, defense: 1200, recovery: 1800,
        lines: [7, 4], amp: 9, fragments: 34, burst: 16, tendrils: 1, waveReach: 0.20, slices: 3,
        flash: 0.45, flashR: 200, rings: 1, ringReach: 0.34, interference: 0,
        glitches: 2, edge: 90, hit: 0.55, impactMs: 1000,
        bolts: [
          { delay: 0,   scale: 1.3, dur: 900,  sparks: 8,  gen: { branchChance: 0.22, branchDepth: 2 } }
        ] },
      { name: 'BREACH ATTEMPT', intrusion: 1700, defense: 1500, recovery: 2000,
        lines: [12, 7], amp: 16, fragments: 75, burst: 38, tendrils: 3, waveReach: 0.32, slices: 6,
        flash: 0.75, flashR: 300, rings: 1, ringReach: 0.5, interference: 3,
        glitches: 4, edge: 150, hit: 0.75, impactMs: 1250,
        bolts: [
          { delay: 0,   scale: 2.0, dur: 1100, sparks: 12, gen: { branchChance: 0.30, branchDepth: 3 } },
          { delay: 170, scale: 1.4, dur: 950,  sparks: 8,  gen: { branchChance: 0.25, branchDepth: 2 } }
        ] },
      { name: 'CRITICAL BREACH', intrusion: 2000, defense: 1700, recovery: 2300,
        lines: [18, 11], amp: 26, fragments: 130, burst: 64, tendrils: 5, waveReach: 0.5, slices: 10,
        flash: 1, flashR: 440, rings: 2, ringReach: 0.7, interference: 5,
        glitches: 7, edge: 260, hit: 1, impactMs: 1500,
        bolts: [
          { delay: 0,   scale: 3.4, dur: 1500, sparks: 18, light: 420, lightIntensity: 1.8,
            gen: { branchChance: 0.38, branchDepth: 3, step: [10, 24] } },
          { delay: 150, scale: 1.7, dur: 1200, sparks: 10, gen: { branchChance: 0.3, branchDepth: 2 } },
          { delay: 300, scale: 1.5, dur: 1100, sparks: 8,  gen: { branchChance: 0.3, branchDepth: 2 } },
          { delay: 430, scale: 1.4, dur: 1000, sparks: 8,  gen: { branchChance: 0.25, branchDepth: 2 } }
        ] }
    ],

    /* textos do alerta de HUD */
    text: {
      title:   'BLACKWALL SECURITY // ALERT',
      detect:  ['UNAUTHORIZED ENTITY DETECTED', 'INTEGRITY BREACH ATTEMPT'],
      defense: ['COUNTERMEASURES ACTIVE', 'FIREWALL RESPONSE ENGAGED'],
      repel:   ['BREACH REPELLED', 'SYSTEM STABLE']
    }
  };

  var canvas = document.getElementById('breach');
  var hudEl = document.getElementById('secAlert');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var htmlEl = document.documentElement;

  var hud = {
    title: hudEl && hudEl.querySelector('.sa-title'),
    lvl:   hudEl && hudEl.querySelector('.sa-lvl'),
    body:  hudEl && hudEl.querySelector('.sa-body')
  };

  /* ---------- utilidades ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
  function hash(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function easeOut(p) { return 1 - Math.pow(1 - clamp(p, 0, 1), 3); }
  function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }

  var W = 0, H = 0;
  function sizeCanvas() {
    var w = window.innerWidth, h = window.innerHeight;
    if (w === W && h === H && canvas.width === w) return;
    W = w; H = h;
    canvas.width = W;                 // mesma escala do #abyss (permite copiar fatias dele)
    canvas.height = H;
  }

  /* ---------- estado ---------- */
  var S = {
    state: 'STABLE', level: 0, L: null, raf: 0, t0: 0, P1: 0, P2: 0, P3: 0,
    zone: null, E: null, T: null, soft: 1, reduced: false,
    lines: [], tendrils: [], frags: [], rings: [], bars: [], flash: null,
    timeline: [], fragAcc: 0, lastTs: 0
  };
  var cooldownUntil = 0;
  var stats = { clicks: 0, ignored: 0, busy: 0, cooling: 0, missed: 0, started: 0, levels: { 1: 0, 2: 0, 3: 0 }, aborted: 0 };
  var lastZone = '';

  /* ---------- alerta de HUD ---------- */
  function hudShow(levelName) {
    if (!hudEl) return;
    if (hud.title) hud.title.textContent = CONFIG.text.title;
    if (hud.lvl) hud.lvl.textContent = levelName;
    hudEl.hidden = false;
    void hudEl.offsetWidth;                // permite a transição de entrada
    hudEl.classList.add('on');
  }
  function hudText(str, tone) {
    if (!hudEl || !hud.body) return;
    hud.body.textContent = str;
    hudEl.setAttribute('data-tone', tone || 'alert');
    hudEl.classList.remove('sa-swap');
    void hudEl.offsetWidth;
    hudEl.classList.add('sa-swap');
  }
  function hudFadeOut() { if (hudEl) hudEl.classList.remove('on'); }
  function hudHide() {
    if (!hudEl) return;
    hudEl.classList.remove('on', 'sa-swap');
    hudEl.hidden = true;
    hudEl.removeAttribute('data-tone');
    if (hud.body) hud.body.textContent = '';
  }

  /* ---------- geometria: zonas do fundo ---------- */
  function pickZoneName(click) {
    if (click && Math.random() < CONFIG.nearClick) {
      var nx = click.x / W, ny = click.y / H;
      var edgeX = nx < 0.2 || nx > 0.8, edgeY = ny < 0.22 || ny > 0.78;
      if (edgeX && edgeY) return (ny < 0.5 ? 't' : 'b') + (nx < 0.5 ? 'l' : 'r');
      if (ny < 0.2) return 'top';
      return nx < 0.5 ? 'left' : 'right';
    }
    var r = Math.random(), name;
    if (r < 0.26) name = 'left';
    else if (r < 0.52) name = 'right';
    else if (r < 0.70) name = 'top';
    else name = ['tl', 'tr', 'bl', 'br'][(Math.random() * 4) | 0];
    return name;
  }

  function makeZone(name) {
    var sw = clamp(W * 0.2, 140, 340), sh = clamp(H * 0.22, 90, 230);
    var z = { name: name };
    switch (name) {
      case 'left':  z.x0 = 0;      z.x1 = sw;     z.y0 = H * 0.08; z.y1 = H * 0.92;
                    z.ex = rand(0.1, 0.75) * sw;      z.ey = rand(0.2, 0.8) * H; break;
      case 'right': z.x0 = W - sw; z.x1 = W;      z.y0 = H * 0.08; z.y1 = H * 0.92;
                    z.ex = W - rand(0.1, 0.75) * sw;  z.ey = rand(0.2, 0.8) * H; break;
      case 'top':   z.x0 = W * 0.12; z.x1 = W * 0.88; z.y0 = 0;    z.y1 = sh;
                    z.ex = rand(0.12, 0.88) * W;      z.ey = rand(0.15, 0.7) * sh; break;
      case 'tl':    z.x0 = 0;      z.x1 = sw * 1.2; z.y0 = 0;      z.y1 = sh * 1.5;
                    z.ex = rand(0.1, 0.6) * sw * 1.2; z.ey = rand(0.1, 0.6) * sh * 1.5; break;
      case 'tr':    z.x0 = W - sw * 1.2; z.x1 = W; z.y0 = 0;      z.y1 = sh * 1.5;
                    z.ex = W - rand(0.1, 0.6) * sw * 1.2; z.ey = rand(0.1, 0.6) * sh * 1.5; break;
      case 'bl':    z.x0 = 0;      z.x1 = sw * 1.2; z.y0 = H - sh * 1.5; z.y1 = H;
                    z.ex = rand(0.1, 0.6) * sw * 1.2; z.ey = H - rand(0.1, 0.6) * sh * 1.5; break;
      default:      z.x0 = W - sw * 1.2; z.x1 = W; z.y0 = H - sh * 1.5; z.y1 = H;
                    z.ex = W - rand(0.1, 0.6) * sw * 1.2; z.ey = H - rand(0.1, 0.6) * sh * 1.5;
    }
    z.diag = dist(z.x0, z.y0, z.x1, z.y1);
    return z;
  }

  /* ponto da moldura do painel mais próximo de (x, y); se o EdgeFX ainda não
     calculou o contorno, usa o retângulo do painel */
  function nearestFrame(x, y) {
    var n = window.EdgeFX && window.EdgeFX.nearest && window.EdgeFX.nearest(x, y);
    if (n) return { x: n.x, y: n.y };
    var p = document.querySelector('.panel');
    if (!p) return { x: W / 2, y: H / 2 };
    var r = p.getBoundingClientRect();
    return { x: clamp(x, r.left, r.right), y: clamp(y, r.top, r.bottom) };
  }

  /* ---------- construção dos elementos de cada evento ---------- */
  function buildLines(z, L) {
    var arr = [], i, ln, len;
    for (i = 0; i < L.lines[0]; i++) {                 // verticais
      len = rand(0.35, 0.95) * (z.y1 - z.y0);
      ln = { v: true, p: rand(z.x0, z.x1), a: 0, b: 0 };
      ln.a = rand(z.y0, Math.max(z.y0, z.y1 - len)); ln.b = ln.a + len;
      arr.push(ln);
    }
    for (i = 0; i < L.lines[1]; i++) {                 // horizontais
      len = rand(0.35, 0.95) * (z.x1 - z.x0);
      ln = { v: false, p: rand(z.y0, z.y1), a: 0, b: 0 };
      ln.a = rand(z.x0, Math.max(z.x0, z.x1 - len)); ln.b = ln.a + len;
      arr.push(ln);
    }
    arr.forEach(function (l, k) {
      l.alpha = rand(0.25, 0.7); l.w = Math.random() < 0.2 ? 2 : 1;
      l.dark = Math.random() < 0.3; l.seed = Math.random() * 1000 + k; l.dir = Math.random() < 0.5 ? -1 : 1;
    });
    return arr;
  }

  function buildTendril(E, T, delay, reach) {           // caminho angular (45°/90°) até a moldura
    var pts = [[E.x, E.y]], x = E.x, y = E.y, total = dist(E.x, E.y, T.x, T.y), steps = 0;
    var turns = [0, 0, 0, 1, -1, 2, -2];
    while (steps++ < 70) {
      var want = Math.atan2(T.y - y, T.x - x), q = Math.round(want / (Math.PI / 4));
      var ang = (q + turns[(Math.random() * turns.length) | 0]) * Math.PI / 4, s = rand(14, 40);
      x += Math.cos(ang) * s; y += Math.sin(ang) * s;
      pts.push([x, y]);
      if (dist(x, y, T.x, T.y) < 16 || dist(x, y, E.x, E.y) > total * reach + 10) break;
    }
    var cum = [0], i;
    for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1]));
    return { pts: pts, cum: cum, len: cum[cum.length - 1] || 1, delay: delay };
  }

  /* ---------- envelope de intensidade (0..1) ---------- */
  function envelope(el) {
    var L = S.L;
    if (el < S.P1) { var p = el / S.P1; return 0.12 + 0.88 * p * p; }
    if (el < S.P2) { var q = (el - S.P1) / L.defense; return q < 0.2 ? 1 : 1 - 0.5 * ((q - 0.2) / 0.8); }
    var r = (el - S.P2) / L.recovery;
    return 0.5 * Math.pow(Math.max(0, 1 - r), 1.7);                // recuperação gradual
  }

  /* ---------- desenho ---------- */
  function drawLocalLight(env) {
    var R = Math.max(W, H) * 0.22 * (0.7 + S.level * 0.2);
    var a = 0.2 * env * S.soft * (0.7 + S.level * 0.2);
    var g = ctx.createRadialGradient(S.E.x, S.E.y, 0, S.E.x, S.E.y, R);
    g.addColorStop(0, 'rgba(255,23,56,' + a.toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(122,16,32,' + (a * 0.45).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(122,16,32,0)');
    ctx.fillStyle = g;
    ctx.fillRect(S.E.x - R, S.E.y - R, R * 2, R * 2);
  }

  function ringPath(cx, cy, r, tick, seed) {              // anel "digital": polígono irregular
    var n = 28, k;
    ctx.beginPath();
    for (k = 0; k <= n; k++) {
      var a = (k % n) / n * Math.PI * 2, rr = r * (1 + (hash(tick * 0.7 + seed + k * 3.1) - 0.5) * 0.07);
      var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  }

  /* onda de distorção: anel que avança + fatias do fundo (#abyss) deslocadas */
  function drawWave(now, el, env, tick) {
    var L = S.L, R = L.waveReach * Math.max(W, H);
    var p = clamp(el / (S.P1 + L.defense * 0.5), 0, 1);
    var r = R * easeOut(p);
    if (r < 4) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,23,56,' + (0.32 * env * S.soft).toFixed(3) + ')';
    ringPath(S.E.x, S.E.y, r, tick, 11); ctx.stroke();
    ctx.strokeStyle = 'rgba(122,16,32,' + (0.5 * env * S.soft).toFixed(3) + ')';
    ringPath(S.E.x, S.E.y, r * 0.72, tick, 29); ctx.stroke();
    var src = window.Abyss && window.Abyss.canvas;
    if (src && !S.reduced) {
      ctx.globalAlpha = clamp(env, 0, 1);
      for (var j = 0; j < L.slices; j++) {
        var y = S.E.y + (hash(tick * 0.9 + j * 3.1) - 0.5) * 2 * r;
        var sh = 4 + hash(tick * 1.3 + j * 7.7) * 12;
        var hw = Math.sqrt(Math.max(0, r * r - (y - S.E.y) * (y - S.E.y)));
        var sx = Math.max(0, S.E.x - hw), sw = Math.min(W - sx, hw * 2);
        if (sw < 12 || y < 0 || y + sh > H) continue;
        var dx = (hash(tick * 0.5 + j * 5.3) - 0.5) * 2 * (8 + L.amp) * env;
        try { ctx.drawImage(src, sx, y, sw, sh, sx + dx, y, sw, sh); } catch (e) { /* canvas ainda sem tamanho */ }
      }
    }
    ctx.restore();
  }

  function drawLines(now, env, tick) {
    var L = S.L, lines = S.lines, bt = Math.floor(tick / 3);
    ctx.lineJoin = 'miter';
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var blink = S.reduced ? 1 : (hash(tick * 0.37 + ln.seed) > 0.12 ? 1 : 0.15);
      var A = ln.alpha * env * blink * (S.reduced ? S.soft : 1);
      if (A < 0.01) continue;
      ctx.strokeStyle = (ln.dark ? 'rgba(122,16,32,' : 'rgba(255,23,56,') + A.toFixed(3) + ')';
      ctx.lineWidth = ln.w;
      var k0 = hash(bt * 3.1 + ln.seed), k1 = k0 + 0.1 + 0.25 * hash(bt * 5.7 + ln.seed);
      var jump = hash(bt * 2.2 + ln.seed) > 0.55 ? (hash(bt * 7.3 + ln.seed) - 0.5) * 2 * L.amp * 1.6 : 0;
      var steps = Math.max(2, Math.round((ln.b - ln.a) / 16));
      ctx.beginPath();
      for (var k = 0; k <= steps; k++) {
        var f = k / steps, s = ln.a + (ln.b - ln.a) * f;
        var px = ln.v ? ln.p : s, py = ln.v ? s : ln.p;
        var d = dist(px, py, S.E.x, S.E.y), dd = S.zone.diag * 0.45;
        var fall = 0.35 + 0.65 * Math.exp(-(d * d) / (2 * dd * dd));
        var off = ((hash(tick * 1.7 + ln.seed + k * 5.3) - 0.5) * 1.2 + Math.sin(s * 0.05 + now * 0.003 * ln.dir) * 0.7)
                  * L.amp * env * fall * S.soft;
        if (f > k0 && f < k1) off += jump * env * S.soft;          // trecho corrompido, deslocado
        if (ln.v) px += off; else py += off;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  function strokeRange(tn, a, b) {                          // traça o trecho [a,b] (px) do tentáculo
    var started = false, head = null;
    ctx.beginPath();
    for (var i = 0; i < tn.pts.length - 1; i++) {
      var c0 = tn.cum[i], c1 = tn.cum[i + 1];
      if (c1 < a || c0 > b || c1 === c0) continue;
      var t0 = Math.max(a, c0), t1 = Math.min(b, c1), span = c1 - c0;
      var f0 = (t0 - c0) / span, f1 = (t1 - c0) / span;
      var x0 = tn.pts[i][0] + (tn.pts[i + 1][0] - tn.pts[i][0]) * f0, y0 = tn.pts[i][1] + (tn.pts[i + 1][1] - tn.pts[i][1]) * f0;
      var x1 = tn.pts[i][0] + (tn.pts[i + 1][0] - tn.pts[i][0]) * f1, y1 = tn.pts[i][1] + (tn.pts[i + 1][1] - tn.pts[i][1]) * f1;
      if (!started) { ctx.moveTo(x0, y0); started = true; }
      ctx.lineTo(x1, y1);
      head = [x1, y1];
    }
    if (started) ctx.stroke();
    return head;
  }

  function drawTendrils(now, el, env) {
    var L = S.L, cutP = el < S.P1 ? 0 : easeOut((el - S.P1) / (L.defense * 0.4));
    ctx.save();
    ctx.lineJoin = 'miter';
    for (var i = 0; i < S.tendrils.length; i++) {
      var tn = S.tendrils[i];
      var g = clamp((Math.min(el, S.P1) - S.P1 * 0.12 - tn.delay) / (S.P1 * 0.78), 0, 1);
      var head = tn.len * g, tail = tn.len * cutP * (g > 0 ? 1 : 0);
      if (head <= tail + 1) continue;
      var fade = el > S.P2 ? envelope(el) * 2 : 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,23,56,' + (0.14 * fade * S.soft).toFixed(3) + ')';
      ctx.lineWidth = 5; strokeRange(tn, tail, head);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,23,56,' + (0.7 * fade * S.soft).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      var hp = strokeRange(tn, tail, head);
      if (hp && cutP === 0) {                                  // ponta exploratória
        ctx.fillStyle = 'rgba(255,176,186,' + (0.9 * S.soft).toFixed(3) + ')';
        ctx.fillRect(hp[0] - 2, hp[1] - 2, 4, 4);
      }
    }
    ctx.restore();
  }

  function spawnFrag(now, burst) {
    var L = S.L, z = S.zone, f = { t0: now, vx: 0, vy: 0 };
    if (burst) {
      var a = Math.random() * Math.PI * 2, sp = rand(60, 380);
      f.x = S.E.x + gauss() * 10; f.y = S.E.y + gauss() * 10;
      f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp; f.life = rand(250, 700);
    } else {
      f.x = clamp(S.E.x + gauss() * z.diag * 0.28, z.x0 - 30, z.x1 + 30);
      f.y = clamp(S.E.y + gauss() * z.diag * 0.28, z.y0 - 30, z.y1 + 30);
      f.life = rand(160, 700);
    }
    f.horiz = Math.random() < 0.6;
    f.w = f.horiz ? rand(6, 42) : rand(1, 3);
    f.h = f.horiz ? rand(1, 3) : rand(8, 60);
    f.hot = Math.random() < 0.08; f.dark = Math.random() < 0.3; f.seed = Math.random() * 100;
    S.frags.push(f);
  }

  function drawFragments(now, dt, env, canSpawn) {
    var L = S.L, i, f;
    if (canSpawn && !S.reduced) {
      S.fragAcc += dt * (L.fragments / 0.45) * env;
      while (S.fragAcc >= 1) { S.fragAcc -= 1; if (S.frags.length < L.fragments + L.burst) spawnFrag(now, false); }
    }
    for (i = S.frags.length - 1; i >= 0; i--) {
      f = S.frags[i];
      var age = (now - f.t0) / f.life;
      if (age >= 1) { S.frags.splice(i, 1); continue; }
      var a = (1 - age) * (hash(f.seed + Math.floor(now / 55)) > 0.2 ? 0.85 : 0.3) * S.soft;
      var x = f.x + f.vx * (now - f.t0) / 1000, y = f.y + f.vy * (now - f.t0) / 1000;
      ctx.fillStyle = f.hot ? 'rgba(216,216,220,' + a.toFixed(3) + ')'
        : (f.dark ? 'rgba(122,16,32,' : 'rgba(255,23,56,') + a.toFixed(3) + ')';
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(f.w), Math.round(f.h));
    }
  }

  function drawDefenseFx(now) {
    var i, e, p;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // ondas de energia a partir do ponto de impacto
    for (i = 0; i < S.rings.length; i++) {
      var rg = S.rings[i];
      e = now - rg.t0 - rg.delay;
      if (e < 0 || e > rg.dur) continue;
      p = e / rg.dur;
      ctx.lineWidth = 1 + 3 * (1 - p);
      ctx.strokeStyle = 'rgba(255,23,56,' + (0.55 * Math.pow(1 - p, 1.4) * S.soft).toFixed(3) + ')';
      ringPath(S.E.x, S.E.y, rg.R * easeOut(p), Math.floor(now / 70), i * 17);
      ctx.stroke();
    }
    // clarão curto (um único pulso, sem repetição)
    var fl = S.flash;
    if (fl && !S.reduced) {
      e = now - fl.t0;
      if (e >= 0 && e < 320) {
        var a = (e < 45 ? e / 45 : Math.pow(Math.max(0, 1 - (e - 45) / 275), 2)) * fl.power;
        var g = ctx.createRadialGradient(S.E.x, S.E.y, 0, S.E.x, S.E.y, fl.R);
        g.addColorStop(0, 'rgba(255,150,160,' + (a * 0.85).toFixed(3) + ')');
        g.addColorStop(0.18, 'rgba(255,23,56,' + (a * 0.6).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(122,16,32,0)');
        ctx.fillStyle = g;
        ctx.fillRect(S.E.x - fl.R, S.E.y - fl.R, fl.R * 2, fl.R * 2);
      }
    }
    // interferência: barras horizontais curtas (a barreira absorvendo o golpe)
    for (i = 0; i < S.bars.length; i++) {
      var b = S.bars[i];
      e = now - b.t0;
      if (e < 0 || e > b.life) continue;
      ctx.fillStyle = 'rgba(255,23,56,' + (0.34 * (1 - e / b.life)).toFixed(3) + ')';
      ctx.fillRect(b.x0, b.y, b.x1 - b.x0, b.h);
      var src = window.Abyss && window.Abyss.canvas;
      if (src && b.x1 - b.x0 > 8) {
        try { ctx.drawImage(src, b.x0, b.y, b.x1 - b.x0, b.h, b.x0 + b.dx, b.y, b.x1 - b.x0, b.h); } catch (err) { /* sem tamanho */ }
      }
    }
    ctx.restore();
  }

  function draw(now, el, dt) {
    var env = envelope(el) * S.soft, tick = Math.floor(now / (S.reduced ? 600 : CONFIG.jitterStep));
    ctx.clearRect(0, 0, W, H);
    drawLocalLight(envelope(el));
    drawWave(now, el, envelope(el), tick);
    drawLines(now, envelope(el), tick);
    drawTendrils(now, el, envelope(el));
    drawFragments(now, dt, envelope(el), el < S.P2);
    if (S.state === 'DEFENSE' || S.state === 'RECOVERY') drawDefenseFx(now);
    return env;
  }

  /* ---------- defesa: o que acontece no instante do impacto ---------- */
  function later(ms, fn) { S.timeline.push({ t: (performance.now() - S.t0) + ms, fn: fn, done: false }); }

  function fireBolt(b, i) {
    var BW = window.Blackwall;
    if (!BW || !BW.strike || S.state === 'STABLE') return;
    var from = S.T, to = { x: S.E.x, y: S.E.y };
    if (i > 0) {                                                   // raios secundários partem de pontos próximos da moldura
      from = nearestFrame(S.T.x + rand(-1, 1) * 150, S.T.y + rand(-1, 1) * 150);
      to = { x: S.E.x + rand(-1, 1) * 70, y: S.E.y + rand(-1, 1) * 70 };
    }
    BW.strike({
      x: from.x, y: from.y, heading: Math.atan2(to.y - from.y, to.x - from.x), target: to,
      length: dist(from.x, from.y, to.x, to.y) * 1.7 + 120,
      scale: b.scale, gen: b.gen, dur: b.dur, sparks: b.sparks, light: b.light, lightIntensity: b.lightIntensity
    });
  }

  function onDefense(now) {
    var L = S.L, i;
    S.flash = { t0: now, power: L.flash, R: L.flashR };
    for (i = 0; i < L.rings; i++) S.rings.push({ t0: now, delay: i * 140, dur: 700, R: L.ringReach * Math.max(W, H) });
    for (i = 0; i < L.interference; i++) {
      var half = (S.zone.x1 - S.zone.x0) * rand(0.4, 1);
      var x0 = clamp(S.E.x - half * rand(0.2, 0.8), 0, W), x1 = clamp(x0 + half, 0, W);
      S.bars.push({ t0: now + rand(0, 200), life: rand(80, 160), y: clamp(S.E.y + rand(-0.5, 0.5) * (S.zone.y1 - S.zone.y0), 0, H - 8),
                    h: rand(2, 8), x0: x0, x1: x1, dx: (Math.random() < 0.5 ? -1 : 1) * rand(10, 40) });
    }
    if (!S.reduced) for (i = 0; i < L.burst; i++) spawnFrag(now, true);
    L.bolts.forEach(function (b, k) {
      if (S.reduced && k > 0) return;
      if (b.delay === 0) fireBolt(b, k); else later(b.delay, function () { fireBolt(b, k); });
    });
    if (window.EdgeFX && window.EdgeFX.impact) {
      window.EdgeFX.impact(S.T.x, S.T.y, { edge: L.edge, glitches: L.glitches, dur: L.impactMs, peak: L.hit, soft: S.reduced });
    }
  }

  /* ---------- fases ---------- */
  function enter(state) {
    S.state = state;
    htmlEl.setAttribute('data-breach', state.toLowerCase());
    htmlEl.setAttribute('data-breach-level', String(S.level));
    window.dispatchEvent(new CustomEvent('breach:phase', {
      detail: { state: state, level: S.level, name: S.L ? S.L.name : '', zone: S.zone ? S.zone.name : '' }
    }));
  }

  function loop(ts) {
    if (S.state === 'STABLE') return;
    S.raf = requestAnimationFrame(loop);
    var now = performance.now(), el = now - S.t0;
    var dt = S.lastTs ? Math.min(0.1, (now - S.lastTs) / 1000) : 0;
    S.lastTs = now;
    for (var i = 0; i < S.timeline.length; i++) {            // pode crescer durante o laço (later)
      var it = S.timeline[i];
      if (!it.done && el >= it.t) {
        it.done = true;
        it.fn(now);
        if (S.state === 'STABLE') return;                   // o evento terminou dentro do callback
      }
    }
    draw(now, el, dt);
  }

  function start(level, click, opts) {
    opts = opts || {};
    if (S.state !== 'STABLE') return false;
    sizeCanvas();
    S.reduced = mq.matches;
    S.soft = S.reduced ? CONFIG.reducedMotion.soft : 1;
    S.level = S.reduced ? CONFIG.reducedMotion.level : level;
    S.L = CONFIG.levels[S.level - 1];
    var L = S.L;

    S.zone = makeZone(opts.zone || pickZoneName(click));
    lastZone = S.zone.name;
    S.E = { x: S.zone.ex, y: S.zone.ey };
    S.T = nearestFrame(S.E.x, S.E.y);
    S.lines = buildLines(S.zone, L);
    S.tendrils = [];
    for (var i = 0; i < L.tendrils; i++) {
      var Tj = i === 0 ? S.T : nearestFrame(S.E.x + rand(-1, 1) * 140, S.E.y + rand(-1, 1) * 180);
      S.tendrils.push(buildTendril(S.E, Tj, i * S.L.intrusion * 0.06, rand(0.75, 1)));
    }
    S.frags = []; S.rings = []; S.bars = []; S.flash = null; S.fragAcc = 0; S.lastTs = 0;

    S.P1 = L.intrusion; S.P2 = S.P1 + L.defense; S.P3 = S.P2 + L.recovery;
    var T = CONFIG.text, P1 = S.P1, P2 = S.P2, P3 = S.P3;
    S.timeline = [
      { t: P1 * 0.55, fn: function () { hudText(T.detect[1], 'alert'); } },
      { t: P1,        fn: function (now) { enter('DEFENSE'); hudText(T.defense[0], 'defense'); onDefense(now); } },
      { t: P1 + L.defense * 0.5, fn: function () { hudText(T.defense[1], 'defense'); } },
      { t: P2,        fn: function () { enter('RECOVERY'); hudText(T.repel[0], 'ok'); } },
      { t: P2 + L.recovery * 0.5, fn: function () { hudText(T.repel[1], 'ok'); } },
      { t: P3 - 380,  fn: function () { hudFadeOut(); } },
      { t: P3,        fn: function () { end(false); } }
    ].map(function (x) { x.done = false; return x; });

    canvas.hidden = false;
    S.t0 = performance.now();
    if (window.Blackwall && window.Blackwall.hold) window.Blackwall.hold(true);
    stats.started++; stats.levels[S.level]++;
    enter('INTRUSION');
    hudShow(L.name);
    hudText(T.detect[0], 'alert');
    S.raf = requestAnimationFrame(loop);
    return true;
  }

  function end(aborted) {
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
    S.timeline = []; S.frags = []; S.rings = []; S.bars = []; S.tendrils = []; S.lines = []; S.flash = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
    hudHide();
    if (window.EdgeFX && window.EdgeFX.clearImpact) window.EdgeFX.clearImpact();
    if (window.Blackwall && window.Blackwall.hold) window.Blackwall.hold(false);
    S.state = 'STABLE';
    htmlEl.removeAttribute('data-breach');
    htmlEl.removeAttribute('data-breach-level');
    window.dispatchEvent(new CustomEvent('breach:phase', { detail: { state: 'STABLE', level: S.level, aborted: !!aborted } }));
    if (aborted) stats.aborted++;
    cooldownUntil = performance.now() + rand(CONFIG.cooldown[0], CONFIG.cooldown[1]);
  }

  /* ---------- sorteio do nível ---------- */
  function pickLevel() {
    var w = CONFIG.levelWeights, total = w[0] + w[1] + w[2], r = Math.random() * total;
    return r < w[0] ? 1 : (r < w[0] + w[1] ? 2 : 3);
  }

  /* ---------- clique no fundo ---------- */
  function onBackgroundClick(e) {
    // só conta o clique que caiu diretamente neste elemento (o fundo), nunca
    // um clique que subiu de um filho (painel, menu, botão, link...)
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0 || e.defaultPrevented) return;
    if (!e.isTrusted) return;                                   // ignora cliques sintéticos de scripts
    stats.clicks++;
    if (S.state !== 'STABLE') { stats.busy++; return; }
    if (performance.now() < cooldownUntil) { stats.cooling++; return; }
    if (Math.random() >= CONFIG.clickChance) { stats.missed++; return; }
    start(pickLevel(), { x: e.clientX, y: e.clientY });
  }

  /* Áreas de fundo: só os próprios contêineres, nunca o que há dentro deles.
     .panel-wrap entra porque as reentrâncias do painel deixam o fundo à mostra. */
  [document.documentElement, document.body, document.getElementById('conteudo'),
   document.querySelector('.panel-wrap'), document.querySelector('.topbar'), document.querySelector('.foot')
  ].forEach(function (n) { if (n) n.addEventListener('click', onBackgroundClick); });

  /* ---------- ciclo de vida ---------- */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && S.state !== 'STABLE') { end(true); stats.hiddenAbort = (stats.hiddenAbort || 0) + 1; }
  });
  if (mq.addEventListener) mq.addEventListener('change', function () { if (S.state !== 'STABLE') end(true); });
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (S.state !== 'STABLE') sizeCanvas(); }, 120);
  });

  canvas.hidden = true;

  /* API pública (ajustes e testes no console) */
  window.Breach = {
    config: CONFIG,
    stats: stats,
    /* trigger(1|2|3, {zone}) inicia um evento ignorando probabilidade e espera */
    trigger: function (level, opts) { return start(level || pickLevel(), null, opts); },
    abort: function () { if (S.state !== 'STABLE') end(true); },
    get state() { return S.state; },
    get level() { return S.level; },
    get zone() { return lastZone; },
    get cooldownLeft() { return Math.max(0, cooldownUntil - performance.now()); },
    resetCooldown: function () { cooldownUntil = 0; }
  };
})();
