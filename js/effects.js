/* =====================================================================
   EFEITOS COMPLEMENTARES
   - Colunas de código binário nas bordas (alteram aos poucos)
   - Indicadores de rede/sessão ligados a dados reais do navegador
   - Glitch roxo em rajada no painel e nos menus (raro, a cada 2–3 min)
   Tudo decorativo, sem capturar eventos. Movimento reduzido desativa
   as animações (binário parado, glitch roxo nunca é disparado).
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    purpleInterval: [120000, 180000],  // ms entre rajadas roxas
    purpleDuration: 400,               // ms (deve casar com o CSS)
    binaryTick:     900                // ms entre trocas de bits
  };

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------- binário nas bordas ---------- */
  var SEED = ['01001000', '01001111', '01000101', '01001100'];
  function bits() {
    var s = '';
    for (var i = 0; i < 8; i++) s += Math.random() < 0.5 ? '0' : '1';
    return s;
  }
  function buildBin(el) {
    if (!el) return [];
    var rule = document.createElement('div'); rule.className = 'rule';
    var col = document.createElement('div'); col.className = 'col';
    var lines = [];
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span');
      s.textContent = i < 4 ? SEED[i] : bits();
      col.appendChild(s); lines.push(s);
      if (i === 3 || i === 9) {
        var q = document.createElement('div'); q.className = 'sq'; col.appendChild(q);
      }
    }
    el.appendChild(rule); el.appendChild(col);
    return lines;
  }
  var linesL = buildBin(document.getElementById('binL'));
  var linesR = buildBin(document.getElementById('binR'));
  setInterval(function () {
    if (document.hidden || mq.matches) return;
    var set = Math.random() < 0.5 ? linesL : linesR;
    if (!set.length) return;
    var s = set[Math.floor(Math.random() * set.length)];
    s.textContent = bits();
    s.classList.add('hot');
    setTimeout(function () { s.classList.remove('hot'); }, 700);
  }, CONFIG.binaryTick);

  /* ---------- rede e sessão (dados reais do navegador) ---------- */
  function updateNet() {
    var online = navigator.onLine !== false;
    document.documentElement.setAttribute('data-net', online ? 'online' : 'offline');
    var t = document.querySelectorAll('[data-net-text]');
    for (var i = 0; i < t.length; i++) {
      var kind = t[i].getAttribute('data-net-text');
      t[i].textContent = kind === 'status'
        ? (online ? 'ONLINE' : 'OFFLINE')
        : (online ? 'CONEXÃO ESTÁVEL' : 'SEM CONEXÃO');
    }
  }
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function updateClock() {
    var el = document.getElementById('session-time');
    if (!el) return;
    var d = new Date();
    el.textContent = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    el.setAttribute('datetime', d.toISOString());
  }
  updateClock();
  setInterval(updateClock, 30000);

  /* ---------- glitch roxo em rajada ---------- */
  var purpleCount = 0;
  function purpleBurst() {
    var root = document.body;
    purpleCount++;
    root.classList.add('glitch-purple');
    setTimeout(function () { root.classList.remove('glitch-purple'); }, CONFIG.purpleDuration);
  }
  function schedulePurple() {
    setTimeout(function () {
      if (!document.hidden && !mq.matches) purpleBurst();
      schedulePurple();
    }, rand(CONFIG.purpleInterval[0], CONFIG.purpleInterval[1]));
  }
  schedulePurple();

  window.Effects = {
    config: CONFIG,
    purpleBurst: function () { if (!mq.matches) purpleBurst(); },
    get purpleCount() { return purpleCount; }
  };
})();
