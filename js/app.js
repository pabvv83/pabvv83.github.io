/* =====================================================================
   APP — navegação por seções, listas interativas (Links e Contato) e
   gerenciador de arquivos. Os dados vêm de js/data.js; os ícones, de
   js/icons.js. A Blackwall (js/blackwall.js) é independente deste arquivo.
   ===================================================================== */
(function () {
  'use strict';

  var DATA = window.SITE_DATA || {};
  var ICONS = window.SITE_ICONS || { svg: function () { return ''; } };
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrowMQ = window.matchMedia('(max-width: 760px)');

  /* ---------- utilitários ---------- */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;          // somente SVGs internos
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* Aceita apenas https/http/mailto ou caminhos relativos. */
  function safeUrl(u) {
    if (typeof u !== 'string') return null;
    u = u.trim();
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) {
      try { new URL(u); return u; } catch (e) { return null; }
    }
    if (/^mailto:[^\s@]+@[^\s@]+$/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.indexOf('//') === 0) return null;
    return u;
  }
  function isHttp(u) { return /^https?:\/\//i.test(u); }
  function kindOf(u) {
    if (/^mailto:/i.test(u)) return 'E-MAIL';
    if (isHttp(u)) return 'LINK EXTERNO';
    return 'ARQUIVO LOCAL';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- roteamento por hash (botão voltar funciona) ---------- */
  var ROUTES = {
    inicio:   { bar: 'pabvv83.github.io // início',  title: 'Início' },
    sobre:    { bar: 'user_profile // sobre',         title: 'Sobre' },
    links:    { bar: 'links // projetos e perfis',    title: 'Links' },
    contato:  { bar: 'contato // canais',             title: 'Contato' },
    arquivos: { bar: 'arquivos // gerenciador',       title: 'Arquivos' }
  };
  var views = Array.prototype.slice.call(document.querySelectorAll('[data-view]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var barTitle = document.getElementById('tb-title');
  var currentRoute = null;

  function routeFromHash() {
    var h = location.hash.replace(/^#\/?/, '').split(/[?&]/)[0];
    return ROUTES[h] ? h : 'inicio';
  }

  function applyRoute(initial) {
    var id = routeFromHash();
    if (id === currentRoute) return;
    currentRoute = id;
    views.forEach(function (v) {
      v.classList.toggle('is-active', v.getAttribute('data-view') === id);
    });
    navLinks.forEach(function (a) {
      if (a.getAttribute('data-nav') === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (barTitle) barTitle.textContent = ROUTES[id].bar;
    document.title = (id === 'inicio' ? '' : ROUTES[id].title + ' · ') + 'Site do Pab*';
    if (!initial) {
      window.scrollTo(0, 0);
      var active = document.getElementById(id);
      if (active) active.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', function () { applyRoute(false); });

  /* ---------- lista interativa estilo quickhacks ---------- */
  function normalizeItems(list, kind) {
    var out = [];
    (list || []).forEach(function (raw) {
      if (!raw || !raw.id || !raw.name) return;
      var item = {
        id: String(raw.id),
        name: String(raw.name),
        category: raw.category || '',
        description: raw.description || '',
        url: raw.url ? safeUrl(raw.url) : null,
        icon: raw.icon || 'link',
        status: raw.status || '',
        value: raw.value || '',
        actionLabel: raw.actionLabel || (kind === 'contacts' ? 'ABRIR CANAL' : 'ACESSAR'),
        extra: Array.isArray(raw.extra) ? raw.extra : [],
        copy: null
      };
      if (raw.copy) {
        var cv = (raw.copy && raw.copy.value) || raw.value;
        if (cv) item.copy = { value: String(cv), label: (raw.copy && raw.copy.label) || 'COPIAR' };
      }
      if (raw.url && !item.url) {
        console.warn('[site] URL ignorada (inválida):', raw.id);
      }
      if (!item.url && !item.copy) return;               // sem ação real → não exibe
      out.push(item);
    });
    return out;
  }

  function buildDetail(item, mode) {
    var frag = document.createDocumentFragment();

    frag.appendChild(el('div', { class: 'd-head' }, [
      el('span', { class: 'd-tab', text: 'DADOS' }),
      el('span', {
        class: 'd-mode ' + (mode === 'selected' ? 'is-sel' : 'is-prev'),
        text: mode === 'selected' ? '■ SELECIONADO' : '□ PRÉVIA'
      })
    ]));

    frag.appendChild(el('div', { class: 'd-title' }, [
      el('span', { class: 'd-icon', html: ICONS.svg(item.icon) }),
      el('div', null, [
        el('h3', { class: 'd-name', text: item.name }),
        el('p', { class: 'd-cat', text: item.category })
      ])
    ]));

    if (item.description) frag.appendChild(el('p', { class: 'd-desc', text: item.description }));

    var rows = [];
    if (item.value) rows.push([/^mailto:/i.test(item.url || '') ? 'ENDEREÇO' : 'IDENTIFICADOR', item.value]);
    if (item.url && !(item.value && /^mailto:/i.test(item.url))) rows.push(['DESTINO', item.url]);
    rows.push(['TIPO', item.url ? kindOf(item.url) : 'IDENTIFICADOR']);
    if (item.status) rows.push(['STATUS', item.status]);
    item.extra.forEach(function (x) { if (x && x.label && x.value) rows.push([String(x.label), String(x.value)]); });
    rows.push(['ID', item.id.toUpperCase()]);

    var dl = el('dl', { class: 'd-meta' });
    rows.forEach(function (r) {
      dl.appendChild(el('dt', { text: r[0] }));
      dl.appendChild(el('dd', { text: r[1] }));
    });
    frag.appendChild(dl);

    var actions = el('div', { class: 'd-actions' });
    if (item.url) {
      var ext = isHttp(item.url);
      actions.appendChild(el('a', {
        class: 'btn primary', href: item.url,
        target: ext ? '_blank' : null,
        rel: ext ? 'noopener noreferrer' : null
      }, [
        el('span', { text: item.actionLabel }),
        el('span', { html: ICONS.svg('arrow') }),
        ext ? el('span', { class: 'sr-only', text: ' (abre em nova aba)' }) : null
      ]));
    }
    if (item.copy) {
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn ' + (item.url ? 'ghost' : 'primary'),
        'data-copy': item.copy.value,
        'data-label': item.copy.label
      }, [
        el('span', { html: ICONS.svg('copy') }),
        el('span', { class: 'lbl', text: item.copy.label })
      ]));
    }
    frag.appendChild(actions);
    return frag;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = el('textarea', { 'aria-hidden': 'true', readonly: true });
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) { reject(e); }
    });
  }

  function mountQuickList(root, kind) {
    if (!root) return null;
    var items = normalizeItems(DATA[kind], kind);
    var list = root.querySelector('.qh-list');
    var detail = root.querySelector('.qh-detail');
    var countEl = root.querySelector('[data-count]');
    if (countEl) countEl.textContent = items.length + (items.length === 1 ? ' ENTRADA' : ' ENTRADAS');

    if (!items.length) {
      list.setAttribute('hidden', '');
      detail.appendChild(el('p', { class: 'empty-note', text: 'Nenhuma entrada configurada.' }));
      return null;
    }

    var nodes = [];
    var selected = 0;
    var shown = { idx: -1, mode: '' };
    var ready = false;                       // evita anunciar a seleção inicial
    var live = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    root.appendChild(live);

    items.forEach(function (it, i) {
      var li = el('li', {
        class: 'qh-item', role: 'option', id: kind + '-' + it.id,
        tabindex: i === 0 ? '0' : '-1',
        'aria-selected': i === 0 ? 'true' : 'false',
        'data-index': String(i)
      }, [
        el('span', { class: 'qh-idx', text: pad2(i + 1) }),
        el('span', { class: 'qh-ico', html: ICONS.svg(it.icon) }),
        el('span', { class: 'qh-txt' }, [
          el('span', { class: 'qh-name', text: it.name }),
          el('span', { class: 'qh-cat', text: it.category })
        ]),
        el('span', { class: 'qh-chev', html: ICONS.svg('arrow') })
      ]);
      nodes.push(li);
      list.appendChild(li);
    });

    function render(idx, mode, force) {
      if (!force && shown.idx === idx && shown.mode === mode) return;
      shown = { idx: idx, mode: mode };
      clear(detail);
      detail.appendChild(buildDetail(items[idx], mode));
      detail.setAttribute('data-mode', mode);
      detail.classList.remove('swap');
      void detail.offsetWidth;                  // reinicia a animação curta
      detail.classList.add('swap');
    }

    function select(idx, opts) {
      opts = opts || {};
      selected = idx;
      nodes.forEach(function (n, i) {
        var on = i === idx;
        n.setAttribute('aria-selected', on ? 'true' : 'false');
        n.setAttribute('tabindex', on ? '0' : '-1');
        n.classList.toggle('is-selected', on);
      });
      render(idx, 'selected', true);
      if (ready) live.textContent = items[idx].name + ' selecionado';
      if (opts.focus) nodes[idx].focus();
    }

    function preview(idx) {
      // não substitui o painel enquanto o foco está dentro dele
      if (detail.contains(document.activeElement)) return;
      if (idx === null) render(selected, 'selected');
      else render(idx, idx === selected ? 'selected' : 'preview');
    }

    function indexOf(target) {
      var li = target.closest ? target.closest('.qh-item') : null;
      return li ? parseInt(li.getAttribute('data-index'), 10) : -1;
    }

    list.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var i = indexOf(e.target);
      if (i >= 0) preview(i);
    });
    list.addEventListener('pointerleave', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      preview(null);
    });
    list.addEventListener('click', function (e) {
      var i = indexOf(e.target);
      if (i < 0) return;
      select(i);
      // celular: leva o painel de detalhes para a vista, se estiver fora dela
      if (narrowMQ.matches && e.detail > 0) {
        var r = detail.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.8) {
          detail.scrollIntoView({ block: 'nearest', behavior: reduceMQ.matches ? 'auto' : 'smooth' });
        }
      }
    });
    list.addEventListener('keydown', function (e) {
      var cur = indexOf(document.activeElement);
      if (cur < 0) cur = selected;
      var next = -1;
      switch (e.key) {
        case 'ArrowDown': case 'ArrowRight': next = (cur + 1) % items.length; break;
        case 'ArrowUp': case 'ArrowLeft': next = (cur - 1 + items.length) % items.length; break;
        case 'Home': next = 0; break;
        case 'End': next = items.length - 1; break;
        case 'Enter': case ' ': next = cur; break;
        default: return;
      }
      e.preventDefault();
      select(next, { focus: true });
    });

    detail.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!btn) return;
      var lbl = btn.querySelector('.lbl');
      var base = btn.getAttribute('data-label') || 'COPIAR';
      copyText(btn.getAttribute('data-copy')).then(function () {
        if (lbl) lbl.textContent = 'COPIADO';
        btn.classList.add('done');
      }, function () {
        if (lbl) lbl.textContent = 'FALHOU';
      }).then(function () {
        setTimeout(function () {
          if (lbl) lbl.textContent = base;
          btn.classList.remove('done');
        }, 1600);
      });
    });

    select(0);
    ready = true;
    return { items: items, select: select, get selected() { return selected; } };
  }

  /* ---------- gerenciador de arquivos ---------- */
  function iconForType(type) {
    var t = String(type || '').toLowerCase();
    if (/^(zip|rar|7z|tar|gz)$/.test(t)) return 'archive';
    if (/^(png|jpe?g|gif|webp|svg|image|img)$/.test(t)) return 'image';
    if (t === 'folder' || t === 'pasta') return 'folder';
    return 'file';
  }

  function mountFiles(root) {
    if (!root) return;
    var files = [];
    (DATA.files || []).forEach(function (f) {
      if (!f || !f.id || !f.name) return;
      var url = safeUrl(f.url);
      if (!url) { console.warn('[site] arquivo ignorado (URL inválida):', f.id); return; }
      files.push({
        id: String(f.id), name: String(f.name), type: f.type || 'arquivo',
        description: f.description || '', size: f.size || '', url: url,
        download: !!f.download,
        actionLabel: f.actionLabel || (f.download ? 'BAIXAR' : 'ABRIR')
      });
    });

    var grid = root.querySelector('.fm-grid');
    var empty = root.querySelector('.fm-empty');
    var status = root.querySelector('[data-fm-status]');
    var filter = root.querySelector('.fm-filter');
    var toggles = root.querySelectorAll('[data-view-mode]');

    function draw(query) {
      clear(grid);
      var q = (query || '').trim().toLowerCase();
      var shownFiles = files.filter(function (f) {
        return !q || (f.name + ' ' + f.type + ' ' + f.description).toLowerCase().indexOf(q) >= 0;
      });
      shownFiles.forEach(function (f) {
        var ext = isHttp(f.url);
        var a = el('a', {
          class: 'fm-tile', href: f.url,
          download: f.download ? '' : null,
          target: ext && !f.download ? '_blank' : null,
          rel: ext ? 'noopener noreferrer' : null,
          title: f.description || f.name
        }, [
          el('span', { class: 'fm-ico', html: ICONS.svg(iconForType(f.type)) }),
          el('span', { class: 'fm-name', text: f.name }),
          el('span', { class: 'fm-meta', text: String(f.type).toUpperCase() + (f.size ? ' · ' + f.size : '') }),
          el('span', { class: 'fm-act', text: f.actionLabel })
        ]);
        grid.appendChild(a);
      });
      var none = files.length === 0;
      empty.hidden = !none;
      grid.hidden = none;
      if (!none && !shownFiles.length) {
        grid.appendChild(el('p', { class: 'empty-note', text: 'Nenhum resultado para o filtro.' }));
        grid.hidden = false;
      }
      status.textContent = none ? '0 ARQUIVOS' :
        shownFiles.length + ' DE ' + files.length + (files.length === 1 ? ' ARQUIVO' : ' ARQUIVOS');
    }

    if (filter) {
      filter.disabled = files.length === 0;
      filter.addEventListener('input', function () { draw(filter.value); });
    }
    Array.prototype.forEach.call(toggles, function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-view-mode');
        grid.classList.toggle('is-list', mode === 'list');
        Array.prototype.forEach.call(toggles, function (o) {
          o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
        });
      });
    });
    draw('');
  }

  /* ---------- inicialização ---------- */
  var links = mountQuickList(document.querySelector('[data-qh="links"]'), 'links');
  var contacts = mountQuickList(document.querySelector('[data-qh="contacts"]'), 'contacts');
  mountFiles(document.querySelector('[data-fm]'));
  applyRoute(true);

  window.SiteApp = { links: links, contacts: contacts, route: function () { return currentRoute; } };
})();
