/* ===========================================================================
   Acuity — shared application script
   - single source of truth: ./data/catalog.json + ./data/stats.json
   - no inline event handlers (CSP-friendly); all listeners via addEventListener
   =========================================================================== */
'use strict';

/* ----------------------------------------------------- constants -------- */
const IQ_MAX = 200; // display scale: the Acuity Score is shown as score / 200
const SCORE_LABEL = 'Acuity Score';

const TIERS = [
  { key: 0, name: 'Idle',        color: 'var(--t0)', range: 'below 70',
    desc: 'Pure background — on while you do something else, and gone by the time it ends.' },
  { key: 1, name: 'Passive',     color: 'var(--t1)', range: '70–84',
    desc: 'Easy, low-effort company that asks little of you and leaves little behind.' },
  { key: 2, name: 'Engaging',    color: 'var(--t2)', range: '85–114',
    desc: 'Holds your attention and rewards it — solid, well-made, worth the hour.' },
  { key: 3, name: 'Stimulating', color: 'var(--t3)', range: '115–129',
    desc: 'Genuinely makes you think — structure, ideas, or craft that stay with you.' },
  { key: 4, name: 'Profound',    color: 'var(--t4)', range: '130 and up',
    desc: 'The rare title that enlarges how you see the world. Worth choosing on purpose.' },
];

const DIMS = [
  { key: 'cog', label: 'Cognitive load',  hint: 'mental challenge & complexity' },
  { key: 'edu', label: 'Knowledge value', hint: 'how much you learn' },
  { key: 'ent', label: 'Craft & execution', hint: 'how well it is made' },
];

/* ----------------------------------------------- personalized weights ---- */
/* Default blend: Cognitive 40% · Knowledge 25% · Craft 35%. Users can set
   their own weights; we recompute a personalized Acuity Score and re-rank.   */
const DEFAULT_WEIGHTS = { cog: 40, edu: 25, ent: 35 };
const IQ_MIN_DISPLAY = 10; // personalized scores land on the same ~10–200 scale

function cleanWeights(w) {
  const c = Math.max(0, Math.min(100, Math.round((w && w.cog) || 0)));
  const e = Math.max(0, Math.min(100, Math.round((w && w.edu) || 0)));
  const n = Math.max(0, Math.min(100, Math.round((w && w.ent) || 0)));
  return { cog: c, edu: e, ent: n };
}
function weightsAreDefault(w) {
  return w.cog === DEFAULT_WEIGHTS.cog && w.edu === DEFAULT_WEIGHTS.edu && w.ent === DEFAULT_WEIGHTS.ent;
}
/* weighted blend of the three 0–100 dimensions → linear onto the Acuity range.
   Monotonic in every dimension; normalized so the weights need not sum to 100. */
function personalScore(rec, w) {
  const tot = w.cog + w.edu + w.ent;
  if (tot <= 0) return rec.iq;
  const blend = (w.cog * rec.cog + w.edu * rec.edu + w.ent * rec.ent) / tot; // 0–100
  return Math.round(IQ_MIN_DISPLAY + (blend / 100) * (IQ_MAX - IQ_MIN_DISPLAY));
}
/* module-level active weights: null ⇒ default scoring (show the catalog iq)  */
let _activeWeights = null;
function weightsActive() { return !!_activeWeights; }
function setActiveWeights(w) { _activeWeights = w; }
/* the score we DISPLAY/rank by everywhere: personalized when active, else iq  */
function displayIq(rec) { return _activeWeights ? personalScore(rec, _activeWeights) : rec.iq; }

/* ------------------------------------------- streaming brand canonical --- */
/* Merge ad / distribution-channel / subscription-tier variants into one brand
   so "Netflix" + "Netflix Standard with Ads" (etc.) become a single toggle.  */
const BRAND_CANON = {
  'paramount+ premium': 'Paramount+',
  'paramount+ essential': 'Paramount+',
  'peacock premium': 'Peacock',
  'peacock premium+': 'Peacock',
  'disneynow': 'Disney+',
  'netflix kids': 'Netflix',
  'youtube free': 'YouTube',
  'youtube premium': 'YouTube',
};
/* curated short-list of the major canonical subscription brands shown by
   default in the streaming picker; the long tail (FAST/aggregator/niche
   channels) lives behind the "+ more services" expander. */
const MAJOR_BRANDS = [
  'Netflix', 'Amazon Prime Video', 'Disney+', 'HBO Max', 'Hulu', 'Apple TV',
  'Paramount+', 'Peacock', 'Starz', 'AMC+', 'MGM+', 'Crunchyroll',
  'Tubi TV', 'The Roku Channel', 'Pluto TV',
];
function canonicalBrand(raw) {
  let s = String(raw).replace(/\s+/g, ' ').trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/\s*(Standard with Ads|Free with Ads|with Ads|Amazon Channel|Apple TV Channel|Roku Premium Channel)\s*$/i, '').trim();
  } while (s !== prev);
  s = s.replace(/\bPlus\b/gi, '+').replace(/\s*\+/g, '+'); // unify "Plus" / "+"
  const key = s.toLowerCase();
  return BRAND_CANON[key] || s;
}
function canonSet(svc) {
  const out = new Set();
  (svc || []).forEach(s => out.add(canonicalBrand(s)));
  return out;
}
/* canonical brand → representative logo, from providers.json (highest-count) */
function buildBrandLogos(providers) {
  const idx = {};
  for (const raw in providers) {
    const b = canonicalBrand(raw);
    const info = providers[raw] || {};
    const c = info.count || 0;
    if (!idx[b] || c > idx[b].vcount) idx[b] = { logo: info.logo || null, vcount: c };
  }
  return idx;
}

/* ----------------------------------------------------- posters ---------- */
const IMG_BASE = 'https://image.tmdb.org/t/p/';
function posterUrl(p, size) { return p ? IMG_BASE + (size || 'w342') + p : null; }

/* ----------------------------------------------------- storage ---------- */
/* namespaced + versioned; degrades gracefully if storage unavailable */
const STORE_KEY = 'acuity_v1';
const Store = (() => {
  let mem = null;
  let usable = true;
  function read() {
    if (mem) return mem;
    const base = { watched: {}, watchlist: {}, services: [], weights: null, weightsOn: false };
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
    getWeights() { const w = read().weights; return w ? cleanWeights(w) : null; },
    setWeights(w) { read().weights = w ? cleanWeights(w) : null; write(); },
    getWeightsOn() { return !!read().weightsOn; },
    setWeightsOn(on) { read().weightsOn = !!on; write(); },
  };
})();

/* hydrate the active personalized weights from storage (run once at boot) */
function loadWeightPrefs() {
  if (Store.getWeightsOn()) setActiveWeights(Store.getWeights() || Object.assign({}, DEFAULT_WEIGHTS));
  else setActiveWeights(null);
}

/* ----------------------------------------------------- data ------------- */
let _catalogPromise = null;
let _statsPromise = null;
let _providersPromise = null;
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
function loadProviders() {
  if (!_providersPromise) {
    _providersPromise = fetch('./data/providers.json').then(r => {
      if (!r.ok) throw new Error('providers ' + r.status);
      return r.json();
    });
  }
  return _providersPromise;
}

/* ----------------------------------------------------- helpers ---------- */
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'text') node.textContent = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, attrs[k]);
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
const fmtVotes = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(v);
function titleHref(slug) { return './title.html?t=' + encodeURIComponent(slug); }

/* build an explore.html URL that pre-applies filters via query params */
function exploreHref(params) {
  const p = new URLSearchParams();
  for (const k in params) {
    const v = params[k];
    if (v == null || v === '') continue;
    p.set(k, v);
  }
  const s = p.toString();
  return './explore.html' + (s ? '?' + s : '');
}
/* a small clickable metadata chip that links into a filtered Explore */
function metaLink(text, params, cls) {
  return el('a', { class: 'meta-link' + (cls ? ' ' + cls : ''), href: exploreHref(params), text: text });
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* tier chip element (static) */
function tierChip(tier) {
  const t = tierOf(tier);
  return el('span', { class: 'tier-chip t' + tier },
    [el('span', { class: 'swatch' }), document.createTextNode(t.name)]);
}
/* tier chip that links into Explore filtered by that tier */
function tierChipLink(tier, cls) {
  const t = tierOf(tier);
  return el('a', { class: 'tier-chip tier-chip-link t' + tier + (cls ? ' ' + cls : ''), href: exploreHref({ tier: tier }) },
    [el('span', { class: 'swatch' }), document.createTextNode(t.name)]);
}

/* the title card (poster when available, score-tile fallback otherwise) */
function titleCard(rec) {
  const t = tierOf(rec.tier);
  const score = displayIq(rec);
  const pz = weightsActive();
  const card = el('div', { class: 'card t' + rec.tier + (pz ? ' is-personal' : '') });

  const tile = el('div', { class: 'tile' + (rec.p ? ' has-poster' : '') });
  if (rec.p) {
    tile.appendChild(el('img', {
      class: 'poster', loading: 'lazy', decoding: 'async',
      src: posterUrl(rec.p, 'w342'), alt: '', width: 342, height: 513,
    }));
    tile.appendChild(el('div', { class: 'tile-grad' }));
  } else {
    tile.appendChild(el('div', { class: 'tile-iq', text: String(score) }));
    tile.appendChild(el('div', { class: 'tile-of', text: (pz ? 'Your ' : '') + SCORE_LABEL + ' / ' + IQ_MAX }));
  }
  // single Acuity Score — a corner overlay on poster cards, the centerpiece on
  // placard cards (never duplicated in the body below)
  if (rec.p) {
    tile.appendChild(el('span', { class: 'tile-score-badge' + (pz ? ' personal' : ''), title: pz ? 'Personalized Acuity Score' : SCORE_LABEL }, [
      el('span', { class: 'b-num', text: String(score) }),
      el('span', { class: 'b-of', text: '/' + IQ_MAX }),
      pz ? el('span', { class: 'pz-dot', 'aria-label': 'personalized', text: '★' }) : null,
    ]));
  }
  // clickable overlays (links sit above the stretched cover)
  tile.appendChild(tierChipLink(rec.tier));
  tile.appendChild(el('a', { class: 'type-tag', href: exploreHref({ type: rec.type }),
    text: rec.type === 'series' ? 'Series' : 'Film' }));
  // stretched cover link → the title detail page (whole card clickable)
  tile.appendChild(el('a', { class: 'card-cover', href: titleHref(rec.slug),
    'aria-label': rec.n + ', ' + (pz ? 'personalized ' : '') + SCORE_LABEL + ' ' + score + ' of ' + IQ_MAX + ', tier ' + t.name }));
  card.appendChild(tile);

  const flags = el('div', { class: 'tracker-flags' });
  if (Store.has('watched', rec.slug)) flags.appendChild(el('span', { class: 'flag on-watched', text: 'Watched' }));
  if (Store.has('watchlist', rec.slug)) flags.appendChild(el('span', { class: 'flag on-list', text: 'List' }));

  const meta = el('div', { class: 'card-meta' });
  meta.appendChild(metaLink(String(rec.year), { year: rec.year }));
  (rec.g || []).slice(0, 2).forEach(g => {
    meta.appendChild(el('span', { class: 'dotsep', text: '·' }));
    meta.appendChild(metaLink(g, { genre: g }));
  });

  card.appendChild(el('div', { class: 'card-body' }, [
    el('a', { class: 'card-title', href: titleHref(rec.slug), text: rec.n }),
    meta,
    el('div', { class: 'card-foot' }, [flags]),
  ]));
  return card;
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

/* ====================================================================== */
/* SEARCH — ranked, typo-tolerant autocomplete shared across pages         */
/* ====================================================================== */

/* bounded Levenshtein: returns a distance, or > max if it exceeds the cap */
function boundedLev(a, b, max) {
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  let prev = new Array(bl + 1), cur = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    let best = cur[0];
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      let v = prev[j] + 1;
      const d = cur[j - 1] + 1; if (d < v) v = d;
      const e = prev[j - 1] + cost; if (e < v) v = e;
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[bl];
}

/* rank titles for a query: exact < prefix < word-prefix < substring < fuzzy */
function searchTitles(cat, query, limit) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const res = [];
  for (let i = 0; i < cat.length; i++) {
    const r = cat[i];
    const name = r._ln || (r._ln = r.n.toLowerCase());
    const idx = name.indexOf(q);
    let rank = -1;
    if (idx === 0) rank = name.length === q.length ? 0 : 1;
    else if (idx > 0) {
      const ch = name.charCodeAt(idx - 1); // space : - & ( . => word boundary
      rank = (ch === 32 || ch === 58 || ch === 45 || ch === 38 || ch === 40 || ch === 46) ? 2 : 3;
    }
    if (rank >= 0) res.push([r, rank]);
  }
  // typo tolerance only when exact/substring matches are thin
  if (res.length < limit && q.length >= 4 && q.length <= 22) {
    const maxD = q.length >= 7 ? 2 : 1;
    for (let i = 0; i < cat.length; i++) {
      const r = cat[i];
      const name = r._ln;
      if (name.indexOf(q) >= 0) continue;
      const words = r._w || (r._w = name.split(/[\s:,'\-()\.]+/).filter(Boolean));
      let best = maxD + 1;
      const fd = boundedLev(q, name, maxD); if (fd < best) best = fd;
      for (let w = 0; w < words.length && best > 0; w++) {
        const d = boundedLev(q, words[w], maxD); if (d < best) best = d;
      }
      if (best <= maxD) res.push([r, 4 + best]);
    }
  }
  res.sort((a, b) => a[1] - b[1] || b[0].iq - a[0].iq || b[0].votes - a[0].votes);
  const out = [];
  for (let i = 0; i < res.length && i < limit; i++) out.push(res[i][0]);
  return out;
}

let _acSeq = 0;
function attachAutocomplete(input, cfg) {
  cfg = cfg || {};
  const limit = cfg.limit || 8;
  const host = input.closest('.search-bar, .hero-search') || input.parentNode;
  host.classList.add('ac-host');
  const list = el('div', { class: 'ac-list', role: 'listbox', id: 'ac_' + (++_acSeq) });
  list.setAttribute('hidden', '');
  host.appendChild(list);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('autocomplete', 'off');

  let cat = null, items = [], active = -1, timer = null;
  loadCatalog().then(c => { cat = c; }).catch(() => {});

  function isOpen() { return !list.hasAttribute('hidden'); }
  function close() {
    list.setAttribute('hidden', '');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function open() { if (list.children.length) { list.removeAttribute('hidden'); input.setAttribute('aria-expanded', 'true'); } }

  function setActive(i) {
    const opts = list.children;
    if (active >= 0 && opts[active]) opts[active].classList.remove('active');
    active = i;
    if (i >= 0 && opts[i]) {
      opts[i].classList.add('active');
      input.setAttribute('aria-activedescendant', opts[i].id);
      opts[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function pick(r) { close(); if (cfg.onpick) cfg.onpick(r); else location.href = titleHref(r.slug); }

  function render() {
    list.innerHTML = '';
    active = -1;
    if (!items.length) { close(); return; }
    items.forEach((r, i) => {
      const opt = el('a', { class: 'ac-item t' + r.tier, role: 'option', id: list.id + '_o' + i, href: titleHref(r.slug) });
      const thumb = el('span', { class: 'ac-thumb' });
      if (r.p) thumb.appendChild(el('img', { loading: 'lazy', decoding: 'async', src: posterUrl(r.p, 'w92'), alt: '', width: 34, height: 51 }));
      else { thumb.classList.add('noimg'); thumb.textContent = String(r.iq); }
      opt.appendChild(thumb);
      opt.appendChild(el('span', { class: 'ac-main' }, [
        el('span', { class: 'ac-name', text: r.n }),
        el('span', { class: 'ac-sub', text: (r.type === 'series' ? 'Series' : 'Film') + ' · ' + r.year + ' · ' + tierOf(r.tier).name }),
      ]));
      opt.appendChild(el('span', { class: 'ac-score', text: String(r.iq) }));
      opt.addEventListener('mousedown', e => { e.preventDefault(); pick(r); });
      opt.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
      list.appendChild(opt);
    });
    open();
  }

  function run() {
    if (!cat) return;
    const q = input.value.trim();
    if (!q) { items = []; list.innerHTML = ''; close(); return; }
    items = searchTitles(cat, q, limit);
    render();
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 110); });
  input.addEventListener('focus', () => { if (input.value.trim() && list.children.length) open(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      if (!isOpen()) { run(); } else { e.preventDefault(); setActive(Math.min(active + 1, list.children.length - 1)); }
    } else if (e.key === 'ArrowUp') {
      if (isOpen()) { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    } else if (e.key === 'Enter') {
      if (isOpen() && active >= 0) { e.preventDefault(); pick(items[active]); }
    } else if (e.key === 'Escape') {
      if (isOpen()) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }
  });
  document.addEventListener('click', e => { if (!host.contains(e.target)) close(); });
  return { isOpen: isOpen, close: close, refresh: run };
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
    const href = (a.getAttribute('href') || '').replace('./', '').split('?')[0];
    if (href && href === here) a.classList.add('active');
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
  const input = form.querySelector('input');
  if (input) attachAutocomplete(input);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    location.href = './explore.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
}

/* ====================================================================== */
/* HOME                                                                    */
/* ====================================================================== */
function initHome() {
  Promise.all([loadCatalog(), loadStats()]).then(([cat, stats]) => {
    const band = document.querySelector('[data-statband]');
    if (band) {
      const films = stats.n_films, series = stats.n_series;
      const profound = stats.tier_counts['4'];
      const stat = (num, unit, lbl) => el('div', { class: 'stat' }, [
        el('div', { class: 'num', html: num + (unit ? ' <span class="unit">' + unit + '</span>' : '') }),
        el('div', { class: 'lbl', text: lbl }),
      ]);
      band.appendChild(stat(stats.n.toLocaleString(), '', 'titles scored on one fixed scale'));
      band.appendChild(stat(films.toLocaleString() + '·' + series.toLocaleString(), '', 'films and series, side by side'));
      band.appendChild(stat(String(Math.round(stats.mean)), '/' + IQ_MAX, 'median score — a true bell curve, sd ' + Math.round(stats.sd)));
      band.appendChild(stat(profound.toLocaleString(), '', 'titles in the top “Profound” tier'));
    }
    const grid = document.querySelector('[data-featured]');
    if (grid) { grid.removeAttribute('aria-busy'); cat.slice(0, 8).forEach(r => grid.appendChild(titleCard(r))); }
  }).catch(err => {
    const grid = document.querySelector('[data-featured]');
    if (grid) grid.appendChild(el('p', { class: 'muted', text: 'Could not load the catalog right now.' }));
    console.error(err);
  });
  initHeroSearch();
}

/* ====================================================================== */
/* KIDS                                                                    */
/* ====================================================================== */
function initKids() {
  const grid = document.querySelector('[data-kids-grid]');
  if (!grid) return;
  loadCatalog().then(cat => {
    const kids = cat.filter(r => r.kids); // catalog is pre-sorted by score desc
    const count = document.querySelector('[data-kids-count]');
    if (count) count.textContent = kids.length.toLocaleString();
    grid.removeAttribute('aria-busy');
    kids.slice(0, 12).forEach(r => grid.appendChild(titleCard(r)));
  }).catch(err => {
    grid.appendChild(el('p', { class: 'muted', text: 'Could not load the catalog right now.' }));
    console.error(err);
  });
}

/* ====================================================================== */
/* EXPLORE                                                                 */
/* ====================================================================== */
function initExplore() {
  const root = document.querySelector('[data-explore]');
  if (!root) return;

  const PAGE = 48;
  const params = new URLSearchParams(location.search);
  const state = {
    q: params.get('q') || '',
    tiers: new Set(),
    genres: new Set(),
    types: new Set(),
    min: 0, max: IQ_MAX,
    minCog: 0, minEdu: 0, minEnt: 0,
    minRating: 0, minVotes: 0,
    year: null,
    kids: false,
    services: new Set(Store.getServices()),
    sort: 'iq-desc',
    shown: PAGE,
  };

  const elSearch = document.querySelector('#searchInput');
  const elClear = document.querySelector('#searchClear');
  const elTierChips = document.querySelector('#tierChips');
  const elGenreChips = document.querySelector('#genreChips');
  const elTypeChips = document.querySelector('#typeChips');
  const elKidsToggle = document.querySelector('#kidsToggle');
  const elMin = document.querySelector('#iqMin');
  const elMax = document.querySelector('#iqMax');
  const dimMin = {
    cog: document.querySelector('#minCog'),
    edu: document.querySelector('#minEdu'),
    ent: document.querySelector('#minEnt'),
  };
  const dimMinOut = {
    cog: document.querySelector('#minCogVal'),
    edu: document.querySelector('#minEduVal'),
    ent: document.querySelector('#minEntVal'),
  };
  const elMinRating = document.querySelector('#minRating');
  const elMinRatingVal = document.querySelector('#minRatingVal');
  const elMinVotes = document.querySelector('#minVotes');
  const elSvc = document.querySelector('#svcList');
  const elSvcCount = document.querySelector('#svcCount');
  const elSvcSearch = document.querySelector('#svcSearch');
  const elSvcSearchWrap = document.querySelector('#svcSearchWrap');
  const elSvcShowAll = document.querySelector('#svcShowAll');
  const elSort = document.querySelector('#sortSelect');
  const elGrid = document.querySelector('#resultGrid');
  const elCount = document.querySelector('#resultCount');
  const elActive = document.querySelector('#activeFilters');
  const elReset = document.querySelector('#resetFilters');
  const elMoreWrap = document.querySelector('#loadMoreWrap');

  // attach the ranked autocomplete first so it owns Escape while open
  if (elSearch) attachAutocomplete(elSearch);

  let CAT = [];
  let filtered = [];
  let brandLogos = {};       // canonical brand → { logo }
  let brandCount = {};       // canonical brand → distinct-title count
  let brandsSorted = [];     // canonical brands, most titles first
  let svcExpanded = false;   // long-tail "show all" state
  let majorBrands = [];      // curated major subscription brands shown by default

  loadProviders().then(p => { brandLogos = buildBrandLogos(p); if (brandsSorted.length) renderServices(); }).catch(() => { brandLogos = {}; });

  loadCatalog().then(cat => {
    CAT = cat;
    cat.forEach(r => { if (!r._csvc) r._csvc = canonSet(r.svc); });
    readParams();
    buildFacets(cat);
    syncControls();
    if (state.q) elSearch.value = state.q;
    elClear.hidden = !state.q;
    apply();
  }).catch(err => {
    elGrid.appendChild(el('div', { class: 'empty' }, [el('h3', { text: 'Catalog unavailable' }), el('p', { text: 'Please refresh to try again.' })]));
    console.error(err);
  });

  function readParams() {
    params.getAll('genre').forEach(g => state.genres.add(g));
    params.getAll('type').forEach(t => { if (t === 'film' || t === 'series') state.types.add(t); });
    params.getAll('tier').forEach(t => { const n = parseInt(t, 10); if (n >= 0 && n <= 4) state.tiers.add(n); });
    params.getAll('svc').forEach(s => { if (s) state.services.add(s); });
    const yr = parseInt(params.get('year'), 10);
    if (yr) state.year = yr;
    if (params.get('kids') === '1') state.kids = true;
    const clamp100 = v => Math.max(0, Math.min(100, parseInt(v, 10) || 0));
    if (params.has('mincog')) state.minCog = clamp100(params.get('mincog'));
    if (params.has('minedu')) state.minEdu = clamp100(params.get('minedu'));
    if (params.has('minent')) state.minEnt = clamp100(params.get('minent'));
    if (params.has('minrating')) state.minRating = Math.max(0, Math.min(10, parseFloat(params.get('minrating')) || 0));
    if (params.has('minvotes')) state.minVotes = Math.max(0, parseInt(params.get('minvotes'), 10) || 0);
    if (params.has('sort')) state.sort = params.get('sort');
  }

  function buildFacets(cat) {
    [4, 3, 2, 1, 0].forEach(tk => {
      const t = tierOf(tk);
      const chip = el('button', { class: 'chip tierchip t' + tk, type: 'button', 'aria-pressed': 'false', 'data-tier': tk },
        [el('span', { class: 'swatch' }), document.createTextNode(t.name)]);
      chip.addEventListener('click', () => { toggle(state.tiers, tk, chip); resetPage(); apply(); });
      elTierChips.appendChild(chip);
    });
    const gc = {};
    cat.forEach(r => r.g.forEach(g => gc[g] = (gc[g] || 0) + 1));
    Object.keys(gc).sort((a, b) => gc[b] - gc[a]).forEach(g => {
      const chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', 'data-genre': g, text: g });
      chip.addEventListener('click', () => { toggle(state.genres, g, chip); resetPage(); apply(); });
      elGenreChips.appendChild(chip);
    });
    [['film', 'Films'], ['series', 'Series']].forEach(([val, lbl]) => {
      const chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', 'data-type': val, text: lbl });
      chip.addEventListener('click', () => { toggle(state.types, val, chip); resetPage(); apply(); });
      elTypeChips.appendChild(chip);
    });
    if (elKidsToggle) {
      elKidsToggle.addEventListener('click', () => {
        state.kids = !state.kids;
        elKidsToggle.setAttribute('aria-pressed', String(state.kids));
        resetPage(); apply();
      });
    }
    // services — canonical brands (ad/channel/tier variants merged), counted by
    // distinct titles; major subscription brands first, long tail behind "show all"
    brandCount = {};
    cat.forEach(r => (r._csvc || canonSet(r.svc)).forEach(b => { brandCount[b] = (brandCount[b] || 0) + 1; }));
    brandsSorted = Object.keys(brandCount).sort((a, b) => brandCount[b] - brandCount[a] || a.localeCompare(b));
    // curated majors that actually exist in the catalog, ordered by title count
    majorBrands = MAJOR_BRANDS.filter(b => brandCount[b]).sort((a, b) => brandCount[b] - brandCount[a]);
    if (elSvcSearch) elSvcSearch.addEventListener('input', renderServices);
    if (elSvcShowAll) elSvcShowAll.addEventListener('click', () => {
      svcExpanded = !svcExpanded;
      if (elSvcSearchWrap) elSvcSearchWrap.hidden = !svcExpanded;
      if (!svcExpanded && elSvcSearch) elSvcSearch.value = '';
      renderServices();
      if (svcExpanded && elSvcSearch) elSvcSearch.focus();
    });
    renderServices();
    updateSvcCount();
  }

  function svcOption(b) {
    const id = 'svc_' + b.replace(/\W+/g, '_');
    const cb = el('input', { type: 'checkbox', id, 'data-svc': b });
    cb.checked = state.services.has(b);
    cb.addEventListener('change', () => {
      if (cb.checked) state.services.add(b); else state.services.delete(b);
      Store.setServices([...state.services]);
      updateSvcCount(); resetPage(); apply();
    });
    const logo = brandLogos[b] && brandLogos[b].logo;
    const media = logo
      ? el('img', { class: 'svc-logo', src: logo, alt: '', loading: 'lazy', decoding: 'async', width: 22, height: 22 })
      : el('span', { class: 'svc-logo ph', 'aria-hidden': 'true' });
    return el('label', { class: 'svc-opt', for: id }, [
      cb, media, el('span', { class: 'svc-name', text: b }), el('span', { class: 'c', text: String(brandCount[b] || 0) }),
    ]);
  }

  function renderServices() {
    if (!elSvc) return;
    elSvc.innerHTML = '';
    const q = (elSvcSearch && elSvcSearch.value || '').trim().toLowerCase();
    let list;
    if (q) {
      list = brandsSorted.filter(b => b.toLowerCase().includes(q));
    } else if (svcExpanded) {
      list = brandsSorted;
    } else {
      const major = majorBrands;
      // keep any picked long-tail service visible even in the collapsed view
      const extra = brandsSorted.filter(b => state.services.has(b) && major.indexOf(b) < 0);
      list = major.concat(extra);
    }
    if (!list.length) {
      elSvc.appendChild(el('p', { class: 'filter-hint', text: 'No services match.' }));
    } else {
      list.forEach(b => elSvc.appendChild(svcOption(b)));
    }
    if (elSvcShowAll) {
      if (q) { elSvcShowAll.hidden = true; }
      else {
        const more = brandsSorted.length - majorBrands.length;
        elSvcShowAll.hidden = more <= 0;
        elSvcShowAll.textContent = svcExpanded ? 'Show fewer' : ('+ ' + more + ' more services');
      }
    }
  }

  // reflect any query-param / stored state onto the facet controls
  function syncControls() {
    elTierChips.querySelectorAll('.chip').forEach(c => {
      const tk = parseInt(c.getAttribute('data-tier'), 10);
      c.setAttribute('aria-pressed', state.tiers.has(tk) ? 'true' : 'false');
    });
    elGenreChips.querySelectorAll('.chip').forEach(c => {
      c.setAttribute('aria-pressed', state.genres.has(c.getAttribute('data-genre')) ? 'true' : 'false');
    });
    elTypeChips.querySelectorAll('.chip').forEach(c => {
      c.setAttribute('aria-pressed', state.types.has(c.getAttribute('data-type')) ? 'true' : 'false');
    });
    if (elKidsToggle) elKidsToggle.setAttribute('aria-pressed', String(state.kids));
    if (elMin && state.min > 0) elMin.value = state.min;
    if (elMax && state.max < IQ_MAX) elMax.value = state.max;
    DIMS.forEach(d => {
      const key = d.key, v = state['min' + key.charAt(0).toUpperCase() + key.slice(1)];
      if (dimMin[key]) dimMin[key].value = String(v);
      if (dimMinOut[key]) dimMinOut[key].textContent = v > 0 ? '≥ ' + v : 'any';
    });
    if (elMinRating) elMinRating.value = String(state.minRating);
    if (elMinRatingVal) elMinRatingVal.textContent = state.minRating > 0 ? '≥ ' + state.minRating.toFixed(1) : 'any';
    if (elMinVotes) elMinVotes.value = String(state.minVotes);
    if (elSort) elSort.value = state.sort;
    elSvc.querySelectorAll('input[data-svc]').forEach(cb => { cb.checked = state.services.has(cb.getAttribute('data-svc')); });
    if (state.services.size) Store.setServices([...state.services]);
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
      if (state.kids && !r.kids) return false;
      if (state.year && r.year !== state.year) return false;
      if (state.tiers.size && !state.tiers.has(r.tier)) return false;
      if (state.types.size && !state.types.has(r.type)) return false;
      if (r.cog < state.minCog || r.edu < state.minEdu || r.ent < state.minEnt) return false;
      if (state.minRating > 0 && r.rating < state.minRating) return false;
      if (state.minVotes > 0 && r.votes < state.minVotes) return false;
      const s = displayIq(r);
      if (s < lo || s > hi) return false;
      if (state.genres.size) { if (!r.g.some(g => state.genres.has(g))) return false; }
      if (state.services.size) {
        const cs = r._csvc || (r._csvc = canonSet(r.svc));
        let hit = false;
        state.services.forEach(b => { if (cs.has(b)) hit = true; });
        if (!hit) return false;
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
      if (s === 'iq-desc') return displayIq(b) - displayIq(a) || a.n.localeCompare(b.n);
      if (s === 'iq-asc') return displayIq(a) - displayIq(b) || a.n.localeCompare(b.n);
      if (s === 'cog-desc') return b.cog - a.cog || displayIq(b) - displayIq(a) || a.n.localeCompare(b.n);
      if (s === 'edu-desc') return b.edu - a.edu || displayIq(b) - displayIq(a) || a.n.localeCompare(b.n);
      if (s === 'ent-desc') return b.ent - a.ent || displayIq(b) - displayIq(a) || a.n.localeCompare(b.n);
      if (s === 'rating-desc') return b.rating - a.rating || b.votes - a.votes || a.n.localeCompare(b.n);
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
    if (weightsActive()) elCount.appendChild(el('span', { class: 'personal-flag', text: '★ ranked by your priorities' }));

    if (!filtered.length) {
      elGrid.appendChild(el('div', { class: 'empty' }, [
        el('h3', { text: 'Nothing matches — yet' }),
        el('p', { text: 'Loosen a filter, widen the score range, or clear your search to see more of the catalog.' }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Clear all filters' }),
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
    if (state.q) pills.push(['Search: “' + state.q + '”', () => { state.q = ''; elSearch.value = ''; elClear.hidden = true; }]);
    if (state.kids) pills.push(['Kids & family', () => { state.kids = false; if (elKidsToggle) elKidsToggle.setAttribute('aria-pressed', 'false'); }]);
    if (state.year) pills.push(['Year: ' + state.year, () => { state.year = null; }]);
    state.tiers.forEach(tk => pills.push(['Tier: ' + tierOf(tk).name, () => { state.tiers.delete(tk); syncChip(elTierChips, 'tier', tk); }]));
    state.types.forEach(tp => pills.push([tp === 'film' ? 'Films' : 'Series', () => { state.types.delete(tp); syncChip(elTypeChips, 'type', tp); }]));
    state.genres.forEach(g => pills.push(['Genre: ' + g, () => { state.genres.delete(g); syncChip(elGenreChips, 'genre', g); }]));
    if (state.services.size) pills.push([state.services.size + ' service' + (state.services.size > 1 ? 's' : ''), () => { state.services.clear(); Store.setServices([]); renderServices(); updateSvcCount(); }]);
    if (state.min > 0 || state.max < IQ_MAX) pills.push([SCORE_LABEL + ' ' + state.min + '–' + state.max, () => { state.min = 0; state.max = IQ_MAX; elMin.value = ''; elMax.value = ''; }]);
    DIMS.forEach(d => {
      const key = d.key, prop = 'min' + key.charAt(0).toUpperCase() + key.slice(1);
      if (state[prop] > 0) pills.push([d.label + ' ≥ ' + state[prop], () => {
        state[prop] = 0; if (dimMin[key]) dimMin[key].value = '0'; if (dimMinOut[key]) dimMinOut[key].textContent = 'any';
      }]);
    });
    if (state.minRating > 0) pills.push(['IMDb ≥ ' + state.minRating.toFixed(1), () => { state.minRating = 0; if (elMinRating) elMinRating.value = '0'; if (elMinRatingVal) elMinRatingVal.textContent = 'any'; }]);
    if (state.minVotes > 0) pills.push(['≥ ' + fmtVotes(state.minVotes) + ' votes', () => { state.minVotes = 0; if (elMinVotes) elMinVotes.value = '0'; }]);

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

  function resetAll() {
    state.q = ''; elSearch.value = ''; elClear.hidden = true;
    state.tiers.clear(); state.genres.clear(); state.types.clear();
    state.year = null; state.kids = false;
    state.min = 0; state.max = IQ_MAX; elMin.value = ''; elMax.value = '';
    state.minCog = 0; state.minEdu = 0; state.minEnt = 0;
    state.minRating = 0; state.minVotes = 0;
    DIMS.forEach(d => { if (dimMin[d.key]) dimMin[d.key].value = '0'; if (dimMinOut[d.key]) dimMinOut[d.key].textContent = 'any'; });
    if (elMinRating) { elMinRating.value = '0'; if (elMinRatingVal) elMinRatingVal.textContent = 'any'; }
    if (elMinVotes) elMinVotes.value = '0';
    if (elKidsToggle) elKidsToggle.setAttribute('aria-pressed', 'false');
    // keep service subscriptions (that is a user profile, not a transient filter)
    document.querySelectorAll('#tierChips .chip, #genreChips .chip, #typeChips .chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    resetPage(); apply();
  }

  // search input — live grid filter (autocomplete dropdown handled separately)
  elSearch.addEventListener('input', () => {
    state.q = elSearch.value; elClear.hidden = !elSearch.value; resetPage(); apply();
  });
  elSearch.addEventListener('keydown', e => { if (e.key === 'Escape') { elSearch.value = ''; state.q = ''; elClear.hidden = true; resetPage(); apply(); } });
  elClear.addEventListener('click', () => { elSearch.value = ''; state.q = ''; elClear.hidden = true; elSearch.focus(); resetPage(); apply(); });
  elClear.hidden = !state.q;

  function onRange() {
    state.min = elMin.value === '' ? 0 : Math.max(0, parseInt(elMin.value, 10) || 0);
    state.max = elMax.value === '' ? IQ_MAX : Math.min(IQ_MAX, parseInt(elMax.value, 10) || IQ_MAX);
    resetPage(); apply();
  }
  elMin.addEventListener('input', onRange);
  elMax.addEventListener('input', onRange);

  // per-dimension minimum sliders (Cognitive load / Knowledge value / Craft)
  DIMS.forEach(d => {
    const slider = dimMin[d.key];
    if (!slider) return;
    const prop = 'min' + d.key.charAt(0).toUpperCase() + d.key.slice(1);
    slider.addEventListener('input', () => {
      const v = Math.max(0, Math.min(100, parseInt(slider.value, 10) || 0));
      state[prop] = v;
      if (dimMinOut[d.key]) dimMinOut[d.key].textContent = v > 0 ? '≥ ' + v : 'any';
      resetPage(); apply();
    });
  });
  // IMDb rating minimum (0–10)
  if (elMinRating) elMinRating.addEventListener('input', () => {
    state.minRating = Math.max(0, Math.min(10, parseFloat(elMinRating.value) || 0));
    if (elMinRatingVal) elMinRatingVal.textContent = state.minRating > 0 ? '≥ ' + state.minRating.toFixed(1) : 'any';
    resetPage(); apply();
  });
  // IMDb minimum-votes threshold (select)
  if (elMinVotes) elMinVotes.addEventListener('change', () => {
    state.minVotes = Math.max(0, parseInt(elMinVotes.value, 10) || 0);
    resetPage(); apply();
  });

  elSort.addEventListener('change', () => { state.sort = elSort.value; resetPage(); apply(); });
  elReset.addEventListener('click', resetAll);

  const ftog = document.querySelector('#filterToggle');
  const fpanel = document.querySelector('#filterPanel');
  if (ftog && fpanel) ftog.addEventListener('click', () => fpanel.classList.toggle('open'));

  initWeightControls();

  /* -------- personalized weights: three sliders + toggle + reset -------- */
  function initWeightControls() {
    const block = document.querySelector('#weightBlock');
    if (!block) return;
    const onBox = document.querySelector('#weightOn');
    const resetBtn = document.querySelector('#weightReset');
    const sliders = {
      cog: document.querySelector('#wCog'),
      edu: document.querySelector('#wEdu'),
      ent: document.querySelector('#wEnt'),
    };
    if (!sliders.cog || !sliders.edu || !sliders.ent) return;

    // hydrate from storage (loadWeightPrefs already set the active scoring)
    let weights = Store.getWeights() || Object.assign({}, DEFAULT_WEIGHTS);
    let on = Store.getWeightsOn();

    function syncSliders() {
      DIMS.forEach(d => { sliders[d.key].value = String(weights[d.key]); });
      updatePcts();
    }
    function updatePcts() {
      const tot = weights.cog + weights.edu + weights.ent;
      DIMS.forEach(d => {
        const pctEl = block.querySelector('[data-pct="' + d.key + '"]');
        if (pctEl) pctEl.textContent = tot > 0 ? Math.round((weights[d.key] / tot) * 100) + '%' : '—';
      });
    }
    function reflectState() {
      block.classList.toggle('on', on);
      if (onBox) onBox.checked = on;
      if (resetBtn) resetBtn.hidden = !on && weightsAreDefault(weights);
    }
    // push current control values into the live scoring + re-render
    function commit() {
      Store.setWeights(weights);
      Store.setWeightsOn(on);
      setActiveWeights(on ? Object.assign({}, weights) : null);
      reflectState();
      resetPage(); apply();
    }

    DIMS.forEach(d => {
      sliders[d.key].addEventListener('input', () => {
        weights[d.key] = Math.max(0, Math.min(100, parseInt(sliders[d.key].value, 10) || 0));
        if (!on) on = true;            // adjusting a slider switches personalization on
        updatePcts();
        commit();
      });
    });
    if (onBox) onBox.addEventListener('change', () => { on = onBox.checked; commit(); });
    if (resetBtn) resetBtn.addEventListener('click', () => {
      weights = Object.assign({}, DEFAULT_WEIGHTS);
      on = false;                       // return to the default Acuity Score
      syncSliders();
      commit();
    });

    syncSliders();
    reflectState();
  }
}

/* ====================================================================== */
/* TITLE DETAIL                                                            */
/* ====================================================================== */
function initTitle() {
  const root = document.querySelector('[data-title-page]');
  if (!root) return;
  const slug = new URLSearchParams(location.search).get('t');
  let brandLogos = {};
  let watchHost = null;

  function renderWatch(rec) {
    if (!watchHost) return;
    watchHost.innerHTML = '';
    if (rec.svc && rec.svc.length) {
      const seen = new Set();
      const brands = [];
      rec.svc.forEach(raw => { const b = canonicalBrand(raw); if (!seen.has(b)) { seen.add(b); brands.push(b); } });
      const row = el('div', { class: 'watch-row' });
      brands.forEach(b => {
        const logo = brandLogos[b] && brandLogos[b].logo;
        const chip = el('a', { class: 'svc-chip', href: exploreHref({ svc: b }) });
        if (logo) chip.appendChild(el('img', { class: 'svc-logo', src: logo, alt: '', loading: 'lazy', decoding: 'async', width: 20, height: 20 }));
        chip.appendChild(el('span', { text: b }));
        row.appendChild(chip);
      });
      watchHost.appendChild(row);
    } else {
      watchHost.appendChild(el('p', { class: 'muted', text: 'No US streaming availability on record right now.' }));
    }
  }

  loadCatalog().then(cat => {
    const rec = cat.find(r => r.slug === slug);
    if (!rec) { renderMissing(); return; }
    document.title = rec.n + ' — Acuity';
    // providers are optional chrome — render immediately, then upgrade chips
    renderTitle(rec, cat);
    loadProviders().then(p => { brandLogos = buildBrandLogos(p); renderWatch(rec); }).catch(() => {});
  }).catch(err => { renderMissing(); console.error(err); });

  function renderMissing() {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'empty' }, [
      el('h3', { text: 'Title not found' }),
      el('p', { text: 'We could not find that entry. Browse the full catalog instead.' }),
      el('a', { class: 'btn btn-primary', href: './explore.html', text: 'Open the catalog' }),
    ]));
  }

  function sep() { return el('span', { class: 'sep', text: '·' }); }

  function renderTitle(rec, cat) {
    const t = tierOf(rec.tier);
    root.innerHTML = '';
    root.className = 'detail t' + rec.tier;
    root.removeAttribute('aria-busy');

    root.appendChild(el('nav', { class: 'breadcrumb' }, [
      el('a', { href: './explore.html', text: 'Catalog' }),
      document.createTextNode('  /  ' + rec.n),
    ]));

    const grid = el('div', { class: 'detail-grid' });

    // left: real poster when available, score-tile fallback otherwise
    const score = displayIq(rec);
    const pz = weightsActive();
    const ofLabel = (pz ? 'Your ' : '') + SCORE_LABEL + ' / ' + IQ_MAX;
    const left = el('div', { class: 'detail-media' });
    if (rec.p) {
      left.appendChild(el('img', {
        class: 'detail-poster', loading: 'lazy', decoding: 'async',
        src: posterUrl(rec.p, 'w500'), alt: 'Poster for ' + rec.n, width: 500, height: 750,
      }));
      left.appendChild(el('div', { class: 'detail-score t' + rec.tier + (pz ? ' personal' : '') }, [
        el('span', { class: 'ds-num', text: String(score) }),
        el('span', { class: 'ds-of', text: ofLabel }),
        pz ? el('a', { class: 'ds-personal', href: './explore.html', text: '★ personalized — see priorities' }) : null,
        tierChipLink(rec.tier),
      ]));
    } else {
      left.appendChild(el('div', { class: 'hero-tile t' + rec.tier + (pz ? ' personal' : '') }, [
        el('div', { class: 'big-iq', text: String(score) }),
        el('div', { class: 'of', text: ofLabel }),
        pz ? el('a', { class: 'ds-personal', href: './explore.html', text: '★ personalized' }) : null,
        tierChipLink(rec.tier),
      ]));
    }
    grid.appendChild(left);

    // right column
    const right = el('div', {});
    const meta = el('div', { class: 'meta' });
    meta.appendChild(metaLink(rec.type === 'series' ? 'Series' : 'Film', { type: rec.type }));
    meta.appendChild(sep());
    meta.appendChild(metaLink(String(rec.year), { year: rec.year }));
    meta.appendChild(sep());
    (rec.g || []).forEach((g, i) => {
      if (i) meta.appendChild(document.createTextNode(', '));
      meta.appendChild(metaLink(g, { genre: g }));
    });
    meta.appendChild(sep());
    meta.appendChild(el('span', { class: 'imdb', text: 'IMDb ' + rec.rating.toFixed(1) + ' (' + fmtVotes(rec.votes) + ')' }));
    right.appendChild(el('div', { class: 'detail-head' }, [el('h1', { text: rec.n }), meta]));

    right.appendChild(el('p', { class: 'tier-desc' }, [
      el('a', { class: 'tier-name-link t' + rec.tier, href: exploreHref({ tier: rec.tier }), text: t.name }),
      document.createTextNode(' — ' + t.desc),
    ]));

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

    // where to watch — each provider chip (official logo) links into the streaming filter
    right.appendChild(el('h2', { class: 'subhead', text: 'Where to watch (US)' }));
    watchHost = el('div', { class: 'watch-host' });
    right.appendChild(watchHost);
    renderWatch(rec);

    grid.appendChild(right);
    root.appendChild(grid);

    // similar titles: same primary genre, nearest score
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

  // fill any inline prose numbers from stats.json (no hard-coded figures)
  loadStats().then(stats => {
    const fmt = {
      mean: Math.round(stats.mean),
      sd: Math.round(stats.sd),
      min: stats.min,
      max: stats.max,
      range: stats.min + '–' + stats.max,
      n: stats.n.toLocaleString(),
      profound: (stats.tier_counts['4'] || 0).toLocaleString(),
    };
    document.querySelectorAll('[data-stat]').forEach(node => {
      const k = node.getAttribute('data-stat');
      if (k in fmt) node.textContent = String(fmt[k]);
    });
  }).catch(() => {});

  const tt = document.querySelector('[data-tier-table]');
  if (tt) {
    loadStats().then(stats => {
      [4, 3, 2, 1, 0].forEach(tk => {
        const t = tierOf(tk);
        tt.appendChild(el('a', { class: 'tier-row t' + tk, href: exploreHref({ tier: tk }) }, [
          el('div', { class: 'tname', text: t.name }),
          el('div', { class: 'trange', text: SCORE_LABEL + ' ' + t.range + ' · ' + stats.tier_counts[tk].toLocaleString() + ' titles' }),
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

  keys.forEach(k => {
    const h = (hist[k] / maxCount) * plotH;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', (xFor(k) - barW / 2).toFixed(2));
    rect.setAttribute('y', (padT + plotH - h).toFixed(2));
    rect.setAttribute('width', barW.toFixed(2));
    rect.setAttribute('height', h.toFixed(2));
    rect.setAttribute('class', 'bar');
    const tt = document.createElementNS(NS, 'title');
    tt.textContent = SCORE_LABEL + ' ' + k + ': ' + hist[k] + ' titles';
    rect.appendChild(tt);
    svg.appendChild(rect);
  });

  for (let v = stats.mean - 4 * stats.sd; v <= stats.mean + 4 * stats.sd; v += stats.sd) {
    const vv = Math.round(v);
    if (vv < minX || vv > maxX) continue;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', xFor(vv)); t.setAttribute('y', H - 14);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'tick');
    t.textContent = vv; svg.appendChild(t);
  }

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
      const q = input.value.trim();
      results.innerHTML = '';
      if (!q) { close(); return; }
      items = searchTitles(CAT, q, 18);
      if (!items.length) { close(); return; }
      items.forEach((r, i) => {
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
    if (isWinner) card.appendChild(el('span', { class: 'winner-tag', text: '★ Higher ' + SCORE_LABEL }));
    card.appendChild(el('h3', {}, [el('a', { href: titleHref(rec.slug), text: rec.n })]));
    card.appendChild(el('div', { class: 'vs-meta', text: (rec.type === 'series' ? 'Series' : 'Film') + ' · ' + rec.year + ' · ' + ((rec.g || []).slice(0, 3).join(' · ') || '—') }));
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
        ? '<b>' + escapeHtml(a.n) + '</b> and <b>' + escapeHtml(b.n) + '</b> are dead even at ' + a.iq + ' on the ' + SCORE_LABEL + '.'
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
  loadWeightPrefs();
  const page = document.body.getAttribute('data-page');
  if (page === 'home') initHome();
  else if (page === 'explore') initExplore();
  else if (page === 'title') initTitle();
  else if (page === 'methodology') initMethodology();
  else if (page === 'compare') initCompare();
  else if (page === 'kids') initKids();
});
