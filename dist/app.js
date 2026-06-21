/* ===========================================================================
   Acuity — shared application script
   - single source of truth: ./data/catalog.json + ./data/stats.json
   - no inline event handlers (CSP-friendly); all listeners via addEventListener
   =========================================================================== */
'use strict';

/* ----------------------------------------------------- constants -------- */
const IQ_MAX = 200; // display scale: scores shown as iq / 200

const TIERS = [
  { key: 0, name: 'Blur',      color: 'var(--t0)', range: 'below 70',
    desc: 'Background noise — diverting, maybe, but little of it survives the credits.' },
  { key: 1, name: 'Haze',      color: 'var(--t1)', range: '70–84',
    desc: 'Easy company. Pleasant and forgettable, light on ideas and lighter on demands.' },
  { key: 2, name: 'Clear',     color: 'var(--t2)', range: '85–114',
    desc: 'Well-made viewing that rewards your attention without insisting on it.' },
  { key: 3, name: 'Sharp',     color: 'var(--t3)', range: '115–129',
    desc: 'Genuinely stimulating — structure, ideas, or craft that leave you thinking.' },
  { key: 4, name: 'Brilliant', color: 'var(--t4)', range: '130 and up',
    desc: 'The rare title that enlarges how you see the world. Worth choosing on purpose.' },
];

const DIMS = [
  { key: 'cog', label: 'Cognitive load',  hint: 'mental challenge & complexity' },
  { key: 'edu', label: 'Knowledge value', hint: 'how much you learn' },
  { key: 'ent', label: 'Craft & execution', hint: 'how well it is made' },
];

/* ----------------------------------------------------- storage ---------- */
/* namespaced + versioned; degrades gracefully if storage unavailable */
const STORE_KEY = 'acuity_v1';
const Store = (() => {
  let mem = null;
  let usable = true;
  function read() {
    if (mem) return mem;
    const base = { watched: {}, watchlist: {}, services: [] };
    try {
      const raw = localStorage.getItem(STORE_KEY);
      mem = raw ? Object.assign(base, JSON.parse(raw)) : base;
    } catch (e) { usable = false; mem = base; }
    return mem;
  }
  function write() {
    if (!usable) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); }
    catch (e) { usable = false; }
  }
  return {
    get available() { return usable; },
    state: read,
    save: write,
    toggleSet(group, slug) {
      const s = read(); s[group] = s[group] || {};
      if (s[group][slug]) delete s[group][slug]; else s[group][slug] = Date.now();
      write(); return !!s[group][slug];
    },
    has(group, slug) { const s = read(); return !!(s[group] && s[group][slug]); },
    getServices() { return read().services || []; },
    setServices(arr) { read().services = arr; write(); },
  };
})();

/* ----------------------------------------------------- data ------------- */
let _catalogPromise = null;
let _statsPromise = null;
function loadCatalog() {
  if (!_catalogPromise) {
    _catalogPromise = fetch('./data/catalog.json').then(r => {
      if (!r.ok) throw new Error('catalog ' + r.status);
      return r.json();
    });
  }
  return _catalogPromise;
}
function loadStats() {
  if (!_statsPromise) {
    _statsPromise = fetch('./data/stats.json').then(r => {
      if (!r.ok) throw new Error('stats ' + r.status);
      return r.json();
    });
  }
  return _statsPromise;
}

/* ----------------------------------------------------- helpers ---------- */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'text') node.textContent = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (k.startsWith('data-')) node.setAttribute(k, attrs[k]);
    else if (k in node) node[k] = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}
const tierOf = t => TIERS[t] || TIERS[2];
const genreSummary = g => (g || []).slice(0, 3).join(' · ');
const fmtVotes = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(v);
function titleHref(slug) { return './title.html?t=' + encodeURIComponent(slug); }

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* tier chip element */
function tierChip(tier) {
  const t = tierOf(tier);
  return el('span', { class: 'tier-chip ' + 't' + tier },
    [el('span', { class: 'swatch' }), document.createTextNode(t.name)]);
}

/* the poster-replacement title card */
function titleCard(rec) {
  const t = tierOf(rec.tier);
  const tile = el('a', { class: 'card t' + rec.tier, href: titleHref(rec.slug), 'aria-label': rec.n + ', score ' + rec.iq + ' of ' + IQ_MAX + ', tier ' + t.name });

  const tileTop = el('div', { class: 'tile' }, [
    tierChip(rec.tier),
    el('span', { class: 'type-tag', text: rec.type === 'series' ? 'Series' : 'Film' }),
    el('div', { class: 'tile-iq', text: String(rec.iq) }),
    el('div', { class: 'tile-of', text: 'IQ / ' + IQ_MAX }),
  ]);

  const flags = el('div', { class: 'tracker-flags' });
  if (Store.has('watched', rec.slug)) flags.appendChild(el('span', { class: 'flag on-watched', text: 'Watched' }));
  if (Store.has('watchlist', rec.slug)) flags.appendChild(el('span', { class: 'flag on-list', text: 'List' }));

  const body = el('div', { class: 'card-body' }, [
    el('div', { class: 'card-title', text: rec.n }),
    el('div', { class: 'card-meta', text: rec.year + '  ·  ' + (genreSummary(rec.g) || '—') }),
    el('div', { class: 'card-foot' }, [
      el('span', { class: 'iq-badge t' + rec.tier }, [
        el('span', { class: 'big', text: String(rec.iq) }),
        el('span', { class: 'max', text: '/' + IQ_MAX }),
      ]),
      flags,
    ]),
  ]);
  tile.appendChild(tileTop);
  tile.appendChild(body);
  return tile;
}

/* ----------------------------------------------------- rationale -------- */
/* ORIGINAL, deterministic prose generated from THIS title's own numbers */
function makeRationale(rec) {
  const t = tierOf(rec.tier);
  const dims = [
    { k: 'cog', v: rec.cog, strong: 'demands real attention to follow', label: 'cognitive challenge' },
    { k: 'edu', v: rec.edu, strong: 'leaves you knowing more than you did', label: 'knowledge value' },
    { k: 'ent', v: rec.ent, strong: 'is built and performed with evident care', label: 'craft' },
  ];
  const sorted = dims.slice().sort((a, b) => b.v - a.v);
  const top = sorted[0], low = sorted[2];
  const g = (rec.g && rec.g.length) ? rec.g.slice(0, 2).join(' / ').toLowerCase() : 'this';
  const kind = rec.type === 'series' ? 'series' : 'film';

  const lead = {
    cog: `As a ${g} ${kind}, its strength is the way it ${top.strong}`,
    edu: `This ${g} ${kind} earns its score chiefly because it ${top.strong}`,
    ent: `What carries this ${g} ${kind} is craft: it ${top.strong}`,
  }[top.k];

  let middle;
  if (low.v < 35 && top.v - low.v > 30) {
    middle = `, even as its ${low.label} runs thin`;
  } else if (sorted[1].v > 60) {
    middle = `, with its ${sorted[1].label} not far behind`;
  } else {
    middle = ` while staying even across the rest`;
  }

  const ratingNote = rec.rating >= 8
    ? `Audiences rate it highly (${rec.rating.toFixed(1)} on ${fmtVotes(rec.votes)} votes), and our model agrees it belongs in the ${t.name} band.`
    : rec.rating >= 6.5
      ? `It holds a respectable ${rec.rating.toFixed(1)} from viewers, placing it firmly in the ${t.name} band.`
      : `Viewer reception is mixed (${rec.rating.toFixed(1)}), which keeps it in the ${t.name} band rather than higher.`;

  return `${lead}${middle}. ${ratingNote}`;
}

/* ----------------------------------------------------- nav -------------- */
function initNav() {
  const burger = document.querySelector('.hamburger');
  const menu = document.querySelector('.mobile-menu');
  if (burger && menu) {
    burger.addEventListener('click', () => {
      const open = menu.hasAttribute('hidden');
      if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
      burger.setAttribute('aria-expanded', String(open));
    });
  }
  // active link highlight
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.replace('./', '') === here) a.classList.add('active');
  });
  // wire any newsletter / CTA forms to a friendly local confirmation
  document.querySelectorAll('form[data-newsletter]').forEach(f => {
    f.addEventListener('submit', e => {
      e.preventDefault();
      const input = f.querySelector('input[type="email"]');
      if (input && input.value) { toast('You are on the list — thanks for reading deliberately.'); f.reset(); }
    });
  });
}

/* ----------------------------------------------------- HERO SEARCH ------ */
function initHeroSearch() {
  const form = document.querySelector('[data-hero-search]');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = form.querySelector('input').value.trim();
    location.href = './explore.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
}

/* ====================================================================== */
/* HOME                                                                    */
/* ====================================================================== */
function initHome() {
  Promise.all([loadCatalog(), loadStats()]).then(([cat, stats]) => {
    // stat band
    const band = document.querySelector('[data-statband]');
    if (band) {
      const films = stats.n_films, series = stats.n_series;
      const brilliant = stats.tier_counts['4'];
      const stat = (num, unit, lbl) => el('div', { class: 'stat' }, [
        el('div', { class: 'num', html: num + (unit ? ' <span class="unit">' + unit + '</span>' : '') }),
        el('div', { class: 'lbl', text: lbl }),
      ]);
      band.appendChild(stat(stats.n.toLocaleString(), '', 'titles scored on one fixed scale'));
      band.appendChild(stat(films.toLocaleString() + '·' + series.toLocaleString(), '', 'films and series, side by side'));
      band.appendChild(stat(String(stats.mean), '/' + IQ_MAX, 'mean score — a true bell curve, sd ' + stats.sd));
      band.appendChild(stat(brilliant.toLocaleString(), '', 'titles in the top “Brilliant” tier'));
    }
    // featured grid: top scoring (catalog is pre-sorted desc) — a varied slice of the top
    const grid = document.querySelector('[data-featured]');
    if (grid) {
      cat.slice(0, 8).forEach(r => grid.appendChild(titleCard(r)));
    }
  }).catch(err => {
    const grid = document.querySelector('[data-featured]');
    if (grid) grid.appendChild(el('p', { class: 'muted', text: 'Could not load the catalog right now.' }));
    console.error(err);
  });
  initHeroSearch();
}

/* ====================================================================== */
/* EXPLORE                                                                 */
/* ====================================================================== */
function initExplore() {
  const root = document.querySelector('[data-explore]');
  if (!root) return;

  const PAGE = 48;
  const state = {
    q: new URLSearchParams(location.search).get('q') || '',
    tiers: new Set(),
    genres: new Set(),
    types: new Set(),
    min: 0, max: IQ_MAX,
    services: new Set(Store.getServices()),
    sort: 'iq-desc',
    shown: PAGE,
  };

  const elSearch = document.querySelector('#searchInput');
  const elClear = document.querySelector('#searchClear');
  const elTierChips = document.querySelector('#tierChips');
  const elGenreChips = document.querySelector('#genreChips');
  const elTypeChips = document.querySelector('#typeChips');
  const elMin = document.querySelector('#iqMin');
  const elMax = document.querySelector('#iqMax');
  const elSvc = document.querySelector('#svcList');
  const elSvcCount = document.querySelector('#svcCount');
  const elSort = document.querySelector('#sortSelect');
  const elGrid = document.querySelector('#resultGrid');
  const elCount = document.querySelector('#resultCount');
  const elActive = document.querySelector('#activeFilters');
  const elReset = document.querySelector('#resetFilters');
  const elMoreWrap = document.querySelector('#loadMoreWrap');

  let CAT = [];
  let filtered = [];

  loadCatalog().then(cat => {
    CAT = cat;
    buildFacets(cat);
    if (state.q) elSearch.value = state.q;
    apply();
  }).catch(err => {
    elGrid.appendChild(el('div', { class: 'empty' }, [el('h3', { text: 'Catalog unavailable' }), el('p', { text: 'Please refresh to try again.' })]));
    console.error(err);
  });

  function buildFacets(cat) {
    // tiers (high to low for display)
    [4, 3, 2, 1, 0].forEach(tk => {
      const t = tierOf(tk);
      const chip = el('button', { class: 'chip tierchip t' + tk, type: 'button', 'aria-pressed': 'false', 'data-tier': tk },
        [el('span', { class: 'swatch' }), document.createTextNode(t.name)]);
      chip.addEventListener('click', () => { toggle(state.tiers, tk, chip); resetPage(); apply(); });
      elTierChips.appendChild(chip);
    });
    // genres by frequency
    const gc = {};
    cat.forEach(r => r.g.forEach(g => gc[g] = (gc[g] || 0) + 1));
    Object.keys(gc).sort((a, b) => gc[b] - gc[a]).forEach(g => {
      const chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', text: g });
      chip.addEventListener('click', () => { toggle(state.genres, g, chip); resetPage(); apply(); });
      elGenreChips.appendChild(chip);
    });
    // type
    [['film', 'Films'], ['series', 'Series']].forEach(([val, lbl]) => {
      const chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', text: lbl });
      chip.addEventListener('click', () => { toggle(state.types, val, chip); resetPage(); apply(); });
      elTypeChips.appendChild(chip);
    });
    // services — show those above a popularity threshold to keep it tidy
    const sc = {};
    cat.forEach(r => (r.svc || []).forEach(s => sc[s] = (sc[s] || 0) + 1));
    const services = Object.keys(sc).filter(s => sc[s] >= 25).sort((a, b) => sc[b] - sc[a]);
    services.forEach(s => {
      const id = 'svc_' + s.replace(/\W+/g, '_');
      const cb = el('input', { type: 'checkbox', id });
      cb.checked = state.services.has(s);
      cb.addEventListener('change', () => {
        if (cb.checked) state.services.add(s); else state.services.delete(s);
        Store.setServices([...state.services]);
        updateSvcCount(); resetPage(); apply();
      });
      const opt = el('label', { class: 'svc-opt', for: id }, [
        cb, el('span', { text: s }), el('span', { class: 'c', text: String(sc[s]) }),
      ]);
      elSvc.appendChild(opt);
    });
    updateSvcCount();
  }

  function updateSvcCount() {
    const n = state.services.size;
    elSvcCount.textContent = n ? n + ' selected' : '';
  }

  function toggle(set, val, chip) {
    if (set.has(val)) { set.delete(val); chip.setAttribute('aria-pressed', 'false'); }
    else { set.add(val); chip.setAttribute('aria-pressed', 'true'); }
  }
  function resetPage() { state.shown = PAGE; }

  function apply() {
    const q = state.q.trim().toLowerCase();
    const lo = Math.min(state.min, state.max), hi = Math.max(state.min, state.max);
    filtered = CAT.filter(r => {
      if (q && !r.n.toLowerCase().includes(q)) return false;
      if (state.tiers.size && !state.tiers.has(r.tier)) return false;
      if (state.types.size && !state.types.has(r.type)) return false;
      if (r.iq < lo || r.iq > hi) return false;
      if (state.genres.size) { if (!r.g.some(g => state.genres.has(g))) return false; }
      if (state.services.size) {
        if (!r.svc || !r.svc.some(s => state.services.has(s))) return false;
      }
      return true;
    });
    sortList();
    render();
    renderActive();
  }

  function sortList() {
    const s = state.sort;
    filtered.sort((a, b) => {
      if (s === 'iq-desc') return b.iq - a.iq || a.n.localeCompare(b.n);
      if (s === 'iq-asc') return a.iq - b.iq || a.n.localeCompare(b.n);
      if (s === 'az') return a.n.localeCompare(b.n);
      if (s === 'za') return b.n.localeCompare(a.n);
      if (s === 'year-desc') return b.year - a.year || a.n.localeCompare(b.n);
      return 0;
    });
  }

  function render() {
    elGrid.innerHTML = '';
    elCount.innerHTML = '';
    elCount.appendChild(el('b', { text: filtered.length.toLocaleString() }));
    elCount.appendChild(document.createTextNode(' ' + (filtered.length === 1 ? 'title' : 'titles')));

    if (!filtered.length) {
      elGrid.appendChild(el('div', { class: 'empty' }, [
        el('h3', { text: 'Nothing matches — yet' }),
        el('p', { text: 'Loosen a filter, widen the score range, or clear your search to see more of the catalog.' }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Clear all filters', onclick: null }),
      ]));
      elGrid.querySelector('.empty .btn').addEventListener('click', resetAll);
      elMoreWrap.innerHTML = '';
      return;
    }
    const slice = filtered.slice(0, state.shown);
    const frag = document.createDocumentFragment();
    slice.forEach(r => frag.appendChild(titleCard(r)));
    elGrid.appendChild(frag);

    elMoreWrap.innerHTML = '';
    if (filtered.length > state.shown) {
      const remaining = filtered.length - state.shown;
      const btn = el('button', { class: 'btn btn-ghost', type: 'button',
        text: 'Show more (' + Math.min(PAGE, remaining) + ' of ' + remaining.toLocaleString() + ')' });
      btn.addEventListener('click', () => { state.shown += PAGE; render(); });
      elMoreWrap.appendChild(btn);
    }
  }

  function renderActive() {
    elActive.innerHTML = '';
    const pills = [];
    if (state.q) pills.push(['Search: “' + state.q + '”', () => { state.q = ''; elSearch.value = ''; }]);
    state.tiers.forEach(tk => pills.push(['Tier: ' + tierOf(tk).name, () => { state.tiers.delete(tk); syncChip(elTierChips, 'tier', tk); }]));
    state.types.forEach(tp => pills.push([tp === 'film' ? 'Films' : 'Series', () => { state.types.delete(tp); syncChipText(elTypeChips, tp === 'film' ? 'Films' : 'Series'); }]));
    state.genres.forEach(g => pills.push(['Genre: ' + g, () => { state.genres.delete(g); syncChipText(elGenreChips, g); }]));
    if (state.services.size) pills.push([state.services.size + ' service' + (state.services.size > 1 ? 's' : ''), () => { state.services.clear(); Store.setServices([]); elSvc.querySelectorAll('input').forEach(c => c.checked = false); updateSvcCount(); }]);
    if (state.min > 0 || state.max < IQ_MAX) pills.push(['IQ ' + state.min + '–' + state.max, () => { state.min = 0; state.max = IQ_MAX; elMin.value = ''; elMax.value = ''; }]);

    pills.forEach(([label, undo]) => {
      const x = el('button', { type: 'button', 'aria-label': 'Remove ' + label, text: '×' });
      const pill = el('span', { class: 'active-pill' }, [document.createTextNode(label), x]);
      x.addEventListener('click', () => { undo(); resetPage(); apply(); });
      elActive.appendChild(pill);
    });
  }
  function syncChip(container, attr, val) {
    const c = container.querySelector('[data-' + attr + '="' + val + '"]');
    if (c) c.setAttribute('aria-pressed', 'false');
  }
  function syncChipText(container, text) {
    container.querySelectorAll('.chip').forEach(c => { if (c.textContent === text) c.setAttribute('aria-pressed', 'false'); });
  }

  function resetAll() {
    state.q = ''; elSearch.value = '';
    state.tiers.clear(); state.genres.clear(); state.types.clear();
    state.min = 0; state.max = IQ_MAX; elMin.value = ''; elMax.value = '';
    // keep service subscriptions (that is a user profile, not a transient filter)
    document.querySelectorAll('#tierChips .chip, #genreChips .chip, #typeChips .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    resetPage(); apply();
  }

  // search input
  elSearch.addEventListener('input', () => {
    state.q = elSearch.value; elClear.hidden = !elSearch.value; resetPage(); apply();
  });
  elSearch.addEventListener('keydown', e => { if (e.key === 'Escape') { elSearch.value = ''; state.q = ''; elClear.hidden = true; resetPage(); apply(); } });
  elClear.addEventListener('click', () => { elSearch.value = ''; state.q = ''; elClear.hidden = true; elSearch.focus(); resetPage(); apply(); });
  elClear.hidden = !state.q;

  // range
  function onRange() {
    state.min = elMin.value === '' ? 0 : Math.max(0, parseInt(elMin.value, 10) || 0);
    state.max = elMax.value === '' ? IQ_MAX : Math.min(IQ_MAX, parseInt(elMax.value, 10) || IQ_MAX);
    resetPage(); apply();
  }
  elMin.addEventListener('input', onRange);
  elMax.addEventListener('input', onRange);

  elSort.addEventListener('change', () => { state.sort = elSort.value; resetPage(); apply(); });
  elReset.addEventListener('click', resetAll);

  // mobile filter toggle
  const ftog = document.querySelector('#filterToggle');
  const fpanel = document.querySelector('#filterPanel');
  if (ftog && fpanel) ftog.addEventListener('click', () => fpanel.classList.toggle('open'));
}

/* ====================================================================== */
/* TITLE DETAIL                                                            */
/* ====================================================================== */
function initTitle() {
  const root = document.querySelector('[data-title-page]');
  if (!root) return;
  const slug = new URLSearchParams(location.search).get('t');

  loadCatalog().then(cat => {
    const rec = cat.find(r => r.slug === slug);
    if (!rec) { renderMissing(); return; }
    document.title = rec.n + ' — Acuity';
    renderTitle(rec, cat);
  }).catch(err => { renderMissing(); console.error(err); });

  function renderMissing() {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'empty' }, [
      el('h3', { text: 'Title not found' }),
      el('p', { text: 'We could not find that entry. Browse the full catalog instead.' }),
      el('a', { class: 'btn btn-primary', href: './explore.html', text: 'Open the catalog' }),
    ]));
  }

  function renderTitle(rec, cat) {
    const t = tierOf(rec.tier);
    root.innerHTML = '';
    root.className = 'detail t' + rec.tier;

    root.appendChild(el('nav', { class: 'breadcrumb' }, [
      el('a', { href: './explore.html', text: 'Catalog' }),
      document.createTextNode('  /  ' + rec.n),
    ]));

    const grid = el('div', { class: 'detail-grid' });

    // left: hero tile
    const tile = el('div', { class: 'hero-tile' }, [
      el('div', { class: 'big-iq', text: String(rec.iq) }),
      el('div', { class: 'of', text: 'IQ  /  ' + IQ_MAX }),
      tierChip(rec.tier),
    ]);
    grid.appendChild(el('div', {}, [tile]));

    // right column
    const right = el('div', {});
    right.appendChild(el('div', { class: 'detail-head' }, [
      el('h1', { text: rec.n }),
      el('div', { class: 'meta', html: (rec.type === 'series' ? 'Series' : 'Film') + '<span class="sep">·</span>' + rec.year + '<span class="sep">·</span>' + (genreSummary(rec.g) || '—') + '<span class="sep">·</span>IMDb ' + rec.rating.toFixed(1) + ' (' + fmtVotes(rec.votes) + ')' }),
    ]));
    right.appendChild(el('p', { class: 'tier-desc', text: t.name + ' — ' + t.desc }));

    // dimension bars
    const dims = el('div', { class: 'dims' });
    DIMS.forEach(d => {
      const v = rec[d.key];
      const row = el('div', { class: 'dim ' + d.key }, [
        el('div', { class: 'dim-top' }, [
          el('span', { class: 'name', html: d.label + ' <small>' + d.hint + '</small>' }),
          el('span', { class: 'val', text: v + ' / 100' }),
        ]),
        el('div', { class: 'dim-track' }, [el('div', { class: 'dim-fill' })]),
      ]);
      dims.appendChild(row);
      requestAnimationFrame(() => row.querySelector('.dim-fill').style.setProperty('--w', v + '%'));
    });
    right.appendChild(dims);

    // rationale (original, generated)
    right.appendChild(el('div', { class: 'rationale' }, [
      el('h3', { text: 'Why this score' }),
      el('p', { text: makeRationale(rec) }),
    ]));

    // actions
    const watchedBtn = el('button', { class: 'btn btn-ghost', type: 'button' });
    const listBtn = el('button', { class: 'btn btn-ghost', type: 'button' });
    function syncBtns() {
      const w = Store.has('watched', rec.slug), l = Store.has('watchlist', rec.slug);
      watchedBtn.textContent = w ? '✓ Watched' : 'Mark watched';
      watchedBtn.classList.toggle('is-on', w);
      listBtn.textContent = l ? '✓ On your list' : '+ Add to watchlist';
      listBtn.classList.toggle('is-on', l);
    }
    watchedBtn.addEventListener('click', () => { const on = Store.toggleSet('watched', rec.slug); syncBtns(); toast(on ? 'Marked as watched.' : 'Removed from watched.'); });
    listBtn.addEventListener('click', () => { const on = Store.toggleSet('watchlist', rec.slug); syncBtns(); toast(on ? 'Added to your watchlist.' : 'Removed from watchlist.'); });
    syncBtns();
    const actions = el('div', { class: 'detail-actions' }, [watchedBtn, listBtn,
      el('a', { class: 'btn btn-ghost', href: './compare.html?a=' + encodeURIComponent(rec.slug), text: 'Compare ↔' })]);
    if (!Store.available) actions.appendChild(el('span', { class: 'muted', text: ' (browser storage is off — picks won’t persist)' }));
    right.appendChild(actions);

    // where to watch
    right.appendChild(el('h2', { class: 'subhead', text: 'Where to watch (US)' }));
    if (rec.svc && rec.svc.length) {
      const row = el('div', { class: 'watch-row' });
      rec.svc.forEach(s => row.appendChild(el('span', { class: 'svc-chip', text: s })));
      right.appendChild(row);
    } else {
      right.appendChild(el('p', { class: 'muted', text: 'No US streaming availability on record right now.' }));
    }

    grid.appendChild(right);
    root.appendChild(grid);

    // similar titles: same primary genre, nearest IQ
    const primary = rec.g[0];
    const similar = cat
      .filter(r => r.slug !== rec.slug && r.g.includes(primary))
      .sort((a, b) => Math.abs(a.iq - rec.iq) - Math.abs(b.iq - rec.iq))
      .slice(0, 4);
    if (similar.length) {
      root.appendChild(el('h2', { class: 'subhead', text: 'Close in spirit — ' + primary }));
      const sg = el('div', { class: 'grid' });
      similar.forEach(r => sg.appendChild(titleCard(r)));
      root.appendChild(sg);
    }
  }
}

/* ====================================================================== */
/* METHODOLOGY (histogram)                                                 */
/* ====================================================================== */
function initMethodology() {
  const root = document.querySelector('[data-histogram]');
  if (!root) return;

  // tier table
  const tt = document.querySelector('[data-tier-table]');
  if (tt) {
    loadStats().then(stats => {
      [4, 3, 2, 1, 0].forEach(tk => {
        const t = tierOf(tk);
        tt.appendChild(el('div', { class: 'tier-row t' + tk }, [
          el('div', { class: 'tname', text: t.name }),
          el('div', { class: 'trange', text: 'IQ ' + t.range + ' · ' + stats.tier_counts[tk].toLocaleString() + ' titles' }),
          el('div', { class: 'tdesc', text: t.desc }),
        ]));
      });
    });
  }

  loadStats().then(stats => drawHistogram(root, stats)).catch(err => {
    root.appendChild(el('p', { class: 'muted', text: 'Distribution chart unavailable.' }));
    console.error(err);
  });
}

function drawHistogram(root, stats) {
  // stat callouts
  const sc = document.querySelector('[data-chart-stats]');
  if (sc) {
    const items = [
      [stats.mean, 'mean'],
      [stats.sd.toFixed(0), 'standard deviation'],
      [stats.skew.toFixed(2), 'skew (≈0 = symmetric)'],
      [stats.min + '–' + stats.max, 'observed range'],
      [stats.n.toLocaleString(), 'titles plotted'],
    ];
    items.forEach(([n, l]) => sc.appendChild(el('div', { class: 's' }, [
      el('div', { class: 'n', text: String(n) }), el('div', { class: 'l', text: l }),
    ])));
  }

  const hist = stats.histogram;
  const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
  const minX = keys[0], maxX = keys[keys.length - 1];
  const maxCount = Math.max(...keys.map(k => hist[k]));

  const W = 820, H = 360, padL = 44, padR = 16, padB = 38, padT = 14;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('class', 'hist');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Histogram of cognitive-value scores across the catalog, forming a symmetric bell curve centred on ' + stats.mean + '.');

  const xFor = v => padL + ((v - minX) / (maxX - minX)) * plotW;
  const span = maxX - minX;
  const barW = Math.max(1, plotW / (span + 1) - 0.6);

  // y gridlines
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const y = padT + plotH - f * plotH;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('class', 'grid'); svg.appendChild(line);
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', padL - 8); lbl.setAttribute('y', y + 4);
    lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('class', 'tick');
    lbl.textContent = Math.round(f * maxCount); svg.appendChild(lbl);
  });

  // bars
  keys.forEach(k => {
    const h = (hist[k] / maxCount) * plotH;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', (xFor(k) - barW / 2).toFixed(2));
    rect.setAttribute('y', (padT + plotH - h).toFixed(2));
    rect.setAttribute('width', barW.toFixed(2));
    rect.setAttribute('height', h.toFixed(2));
    rect.setAttribute('class', 'bar');
    const tt = document.createElementNS(NS, 'title');
    tt.textContent = 'IQ ' + k + ': ' + hist[k] + ' titles';
    rect.appendChild(tt);
    svg.appendChild(rect);
  });

  // x ticks every 15 (sd) around mean
  for (let v = stats.mean - 4 * stats.sd; v <= stats.mean + 4 * stats.sd; v += stats.sd) {
    const vv = Math.round(v);
    if (vv < minX || vv > maxX) continue;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', xFor(vv)); t.setAttribute('y', H - 14);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'tick');
    t.textContent = vv; svg.appendChild(t);
  }

  // mean line
  const ml = document.createElementNS(NS, 'line');
  ml.setAttribute('x1', xFor(stats.mean)); ml.setAttribute('x2', xFor(stats.mean));
  ml.setAttribute('y1', padT); ml.setAttribute('y2', padT + plotH);
  ml.setAttribute('class', 'meanline'); svg.appendChild(ml);
  const mlab = document.createElementNS(NS, 'text');
  mlab.setAttribute('x', xFor(stats.mean) + 6); mlab.setAttribute('y', padT + 12);
  mlab.setAttribute('class', 'meanlbl'); mlab.textContent = 'mean ' + stats.mean; svg.appendChild(mlab);

  root.appendChild(svg);
}

/* ====================================================================== */
/* COMPARE                                                                 */
/* ====================================================================== */
function initCompare() {
  const root = document.querySelector('[data-compare]');
  if (!root) return;
  let CAT = [];
  const params = new URLSearchParams(location.search);
  const sel = { a: null, b: null };

  loadCatalog().then(cat => {
    CAT = cat;
    wirePicker('a'); wirePicker('b');
    if (params.get('a')) preset('a', params.get('a'));
    if (params.get('b')) preset('b', params.get('b'));
    renderVersus();
  }).catch(err => console.error(err));

  function preset(side, slug) {
    const rec = CAT.find(r => r.slug === slug);
    if (rec) { sel[side] = rec; document.querySelector('#pick_' + side + ' input').value = rec.n; }
  }

  function wirePicker(side) {
    const box = document.querySelector('#pick_' + side);
    const input = box.querySelector('input');
    const results = box.querySelector('.picker-results');
    let active = -1, items = [];

    function close() { results.setAttribute('hidden', ''); active = -1; }
    function search() {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!q) { close(); return; }
      items = CAT.filter(r => r.n.toLowerCase().includes(q)).slice(0, 24);
      if (!items.length) { close(); return; }
      items.forEach((r, i) => {
        const t = tierOf(r.tier);
        const btn = el('button', { type: 'button', class: 't' + r.tier, 'data-i': i }, [
          el('span', {}, [document.createTextNode(r.n + ' '), el('span', { class: 'pr-meta', text: '(' + r.year + ')' })]),
          el('span', { class: 'pr-iq', text: String(r.iq) }),
        ]);
        btn.addEventListener('click', () => { choose(side, r); input.value = r.n; close(); });
        results.appendChild(btn);
      });
      results.removeAttribute('hidden');
    }
    input.addEventListener('input', search);
    input.addEventListener('focus', () => { if (input.value.trim()) search(); });
    input.addEventListener('keydown', e => {
      if (results.hasAttribute('hidden')) return;
      const btns = [...results.querySelectorAll('button')];
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, btns.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) btns[active].click(); return; }
      else if (e.key === 'Escape') { close(); return; }
      btns.forEach((b, i) => b.classList.toggle('active', i === active));
      if (btns[active]) btns[active].scrollIntoView({ block: 'nearest' });
    });
    document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
  }

  function choose(side, rec) { sel[side] = rec; syncUrl(); renderVersus(); }
  function syncUrl() {
    const p = new URLSearchParams();
    if (sel.a) p.set('a', sel.a.slug);
    if (sel.b) p.set('b', sel.b.slug);
    history.replaceState(null, '', './compare.html' + (p.toString() ? '?' + p : ''));
  }

  function sideCard(rec, isWinner) {
    if (!rec) return el('div', { class: 'vs-empty', text: 'Search and pick a title to compare.' });
    const t = tierOf(rec.tier);
    const card = el('div', { class: 'vs-card t' + rec.tier + (isWinner ? ' winner' : '') });
    if (isWinner) card.appendChild(el('span', { class: 'winner-tag', text: '★ Higher IQ' }));
    card.appendChild(el('h3', {}, [el('a', { href: titleHref(rec.slug), text: rec.n })]));
    card.appendChild(el('div', { class: 'vs-meta', text: (rec.type === 'series' ? 'Series' : 'Film') + ' · ' + rec.year + ' · ' + (genreSummary(rec.g) || '—') }));
    card.appendChild(el('div', { class: 'vs-iq' }, [
      el('span', { class: 'n', text: String(rec.iq) }), el('span', { class: 'm', text: '/ ' + IQ_MAX }),
    ]));
    card.appendChild(tierChip(rec.tier));
    card.appendChild(el('p', { class: 'muted', html: '<br>' + t.name + ' tier — ' + t.desc }));
    return card;
  }

  function renderVersus() {
    const wrap = document.querySelector('#versus');
    const gap = document.querySelector('#gapSummary');
    const dimWrap = document.querySelector('#cmpDims');
    wrap.innerHTML = ''; gap.innerHTML = ''; dimWrap.innerHTML = '';

    const a = sel.a, b = sel.b;
    const aWin = a && b && a.iq > b.iq, bWin = a && b && b.iq > a.iq;
    wrap.appendChild(sideCard(a, aWin));
    wrap.appendChild(el('div', { class: 'vs-mid' }, [el('span', { text: 'vs' })]));
    wrap.appendChild(sideCard(b, bWin));

    if (a && b) {
      const diff = Math.abs(a.iq - b.iq);
      const hi = a.iq >= b.iq ? a : b, lo = a.iq >= b.iq ? b : a;
      gap.innerHTML = diff === 0
        ? '<b>' + escapeHtml(a.n) + '</b> and <b>' + escapeHtml(b.n) + '</b> are dead even at ' + a.iq + ' IQ.'
        : '<b>' + escapeHtml(hi.n) + '</b> leads <b>' + escapeHtml(lo.n) + '</b> by <b>' + diff + ' points</b> — ' + gapWord(diff) + '.';

      DIMS.forEach(d => {
        const av = a[d.key], bv = b[d.key];
        const block = el('div', { class: 'cmp-dim ' + d.key });
        block.appendChild(el('div', { class: 'cd-label' }, [
          el('span', { text: d.label }),
          el('span', { text: av + '  ·  ' + bv }),
        ]));
        const bars = el('div', { class: 'cmp-bars' });
        const leftTrack = el('div', { class: 'cmp-bar-track right' }, [el('div', { class: 'cmp-bar-fill', style: '--dc:var(--' + d.key + ')' })]);
        const rightTrack = el('div', { class: 'cmp-bar-track' }, [el('div', { class: 'cmp-bar-fill', style: '--dc:var(--' + d.key + ')' })]);
        bars.appendChild(leftTrack); bars.appendChild(rightTrack);
        block.appendChild(bars);
        dimWrap.appendChild(block);
        requestAnimationFrame(() => {
          leftTrack.querySelector('.cmp-bar-fill').style.setProperty('--w', av + '%');
          rightTrack.querySelector('.cmp-bar-fill').style.setProperty('--w', bv + '%');
        });
      });
    }
  }
  function gapWord(d) {
    if (d <= 5) return 'a near dead heat';
    if (d <= 15) return 'a clear but modest edge';
    if (d <= 30) return 'a decisive gap';
    return 'a different league entirely';
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ----------------------------------------------------- boot ------------- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  const page = document.body.getAttribute('data-page');
  if (page === 'home') initHome();
  else if (page === 'explore') initExplore();
  else if (page === 'title') initTitle();
  else if (page === 'methodology') initMethodology();
  else if (page === 'compare') initCompare();
});
