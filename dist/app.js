/* ===========================================================================
   Acuity — shared application script
   - single source of truth: ./data/catalog.json + ./data/stats.json
   - no inline event handlers (CSP-friendly); all listeners via addEventListener
   =========================================================================== */
'use strict';

/* ----------------------------------------------------- motion ----------- */
/* Honor the user's reduced-motion preference everywhere (entrances, count-up). */
const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* Flag the document so the entrance styles apply only when scripting is live —
   with no JS every block stays fully visible. Set the instant the script runs,
   before first paint, to avoid a flash of the natural (un-animated) layout.    */
document.documentElement.classList.add('acu-motion');

/* ----------------------------------------------------- constants -------- */
const IQ_MAX = 200; // display scale: the Acuity Quotient is shown as score / 200
const SCORE_LABEL = 'Acuity Quotient';
const SCORE_ABBR = 'AQ';

const TIERS = [
  { key: 0, name: 'Idle',        color: 'var(--t0)', range: 'below 70',
    desc: 'Pure background — on while you do something else, and gone by the time it ends.' },
  { key: 1, name: 'Ambient',     color: 'var(--t1)', range: '70–84',
    desc: 'Easy, low-effort company that asks little of you and leaves little behind.' },
  { key: 2, name: 'Engaging',    color: 'var(--t2)', range: '85–114',
    desc: 'Holds your attention and rewards it — solid, well-made, worth the hour.' },
  { key: 3, name: 'Absorbing',   color: 'var(--t3)', range: '115–129',
    desc: 'Genuinely makes you think — structure, ideas, or craft that stay with you.' },
  { key: 4, name: 'Profound',    color: 'var(--t4)', range: '130 and up',
    desc: 'The rare title that enlarges how you see the world. Worth choosing on purpose.' },
];

const DIMS = [
  { key: 'cog', label: 'Depth',   hint: 'ideas, ambiguity & the thinking it demands' },
  { key: 'edu', label: 'Insight', hint: 'knowledge & perspective you carry out' },
  { key: 'ent', label: 'Craft',   hint: 'how well it is made' },
];

/* ----------------------------------------------- personalized weights ---- */
/* Default blend: Cognitive 40% · Knowledge 25% · Craft 35%. Users can set
   their own weights; we recompute a personalized Acuity Quotient and re-rank.   */
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
/* fixed cut-points on the 0–200 scale → tier index (Idle…Profound) */
function scoreTier(s) { return s < 70 ? 0 : s < 85 ? 1 : s < 115 ? 2 : s < 130 ? 3 : 4; }
/* CSS custom-property reference for a tier's color (consistent everywhere) */
function tierColorVar(t) { return 'var(--t' + t + ')'; }
/* inject the animated film-grain overlay on every page */
function injectGrain() {
  if (document.querySelector('.acu-grain')) return;
  document.body.appendChild(el('div', { class: 'acu-grain', 'aria-hidden': 'true' }));
}
const fmtVotes = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(v);
function titleHref(slug) { return './title.html?t=' + encodeURIComponent(slug); }

/* ---------------------------------------------------- entrance motion ----
   A single IntersectionObserver drives every entrance animation. Mark an
   element `.acu-anim` (optionally with a `--d` stagger delay) and it fades and
   lifts into place the first time it scrolls into view; above-the-fold marks
   fire immediately. Honors prefers-reduced-motion (jumps to the final state).  */
let _animIO = null;
function animObserver() {
  if (_animIO) return _animIO;
  if (REDUCE_MOTION || !('IntersectionObserver' in window)) {
    _animIO = { observe(node) { revealNow(node); }, unobserve() {}, disconnect() {} };
    return _animIO;
  }
  _animIO = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { revealNow(e.target); obs.unobserve(e.target); } });
  }, { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  return _animIO;
}
/* add .is-in; once the transition finishes, drop the helper classes so the
   element's own hover transitions (e.g. the card lift) are left untouched.     */
function revealNow(node) {
  node.classList.add('is-in');
  if (REDUCE_MOTION) return;
  const done = e => {
    if (e && e.target !== node) return; // ignore bubbling child transitions
    node.classList.remove('acu-anim', 'is-in');
    node.style.removeProperty('--d');
    node.style.willChange = '';
    node.removeEventListener('transitionend', done);
  };
  node.addEventListener('transitionend', done);
}
/* mark one element to animate in (optionally after `delay` ms) */
function animate(node, delay) {
  if (!node) return node;
  node.classList.add('acu-anim');
  if (delay) node.style.setProperty('--d', Math.round(delay) + 'ms');
  animObserver().observe(node);
  return node;
}
/* stagger a list/NodeList of elements; cap the index so large grids don't trail */
function animateStagger(nodes, opts) {
  opts = opts || {};
  const step = opts.step != null ? opts.step : 70;
  const base = opts.base || 0;
  const cap = opts.cap != null ? opts.cap : 10;
  Array.prototype.forEach.call(nodes, (node, i) => animate(node, base + Math.min(i, cap) * step));
}
/* observe any pre-marked `.acu-anim` already present in the static HTML, reading
   an optional `data-d` stagger delay from the markup.                          */
function initMotion() {
  document.querySelectorAll('.acu-anim').forEach(node => {
    const d = parseInt(node.getAttribute('data-d') || '0', 10);
    if (d) node.style.setProperty('--d', d + 'ms');
    animObserver().observe(node);
  });
  // failsafe: never leave a marked block hidden if a callback is somehow missed
  setTimeout(() => {
    document.querySelectorAll('.acu-motion .acu-anim:not(.is-in)').forEach(revealNow);
  }, 1600);
}
/* count a number up from 0 → `to` over `dur` ms (ease-out cubic), once */
function countUp(node, to, dur) {
  if (!node) return;
  to = Math.round(to);
  if (REDUCE_MOTION || !to) { node.textContent = String(to); return; }
  const start = performance.now();
  (function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = String(Math.round(to * eased));
    if (p < 1) requestAnimationFrame(tick);
    else node.textContent = String(to);
  })(performance.now());
}

/* ---------------------------------------------------- percentile -------- */
/* `pct` = "better than this % of the catalog" (0–100). Render concise,
   on-brand labels (mono). Near the top we flip to a "Top N%" framing.       */
function ordinal(n) { const v = n % 100; const s = ['th', 'st', 'nd', 'rd']; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function pctTag(pct) {
  if (pct == null) return null;
  return pct >= 90 ? 'Top ' + Math.max(1, 100 - pct) + '%' : ordinal(pct) + ' pct';
}
function pctPhrase(pct) {
  if (pct == null) return null;
  return pct >= 90 ? 'In the top ' + Math.max(1, 100 - pct) + '% of the catalog'
                   : 'Scores better than ' + pct + '% of the catalog';
}

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

/* ----------------------------------------------------------- title card ----
   THE single canonical card, used on every grid: the home "top of the curve",
   the Explore/catalog grid, the Kids grid, and the "similar titles" row.
   Layout: a 2:3 poster with the tier badge on it (top-right) and an optional
   rank pill (top-left, home only); below the poster a row with the title, the
   YEAR · TYPE meta and a percentile tag on the left, and the big tier-colored
   AQ number on the right; then three thin dimension mini-bars. The whole card
   links to the title page. Pass { rank: n } to show the rank pill.            */
function titleCard(rec, opts) {
  opts = opts || {};
  const t = tierOf(rec.tier);
  const score = displayIq(rec);
  const pz = weightsActive();
  const card = el('a', {
    class: 'tcard t' + rec.tier + (pz ? ' is-personal' : ''),
    href: titleHref(rec.slug),
    'aria-label': rec.n + ', ' + (pz ? 'personalized ' : '') + SCORE_LABEL + ' ' + score + ' of ' + IQ_MAX + ', tier ' + t.name,
  });

  // poster block (real cover, or a hatched violet placard with faint mono title)
  const poster = el('div', { class: 'tcard-poster' + (rec.p ? ' has-poster' : ' hatch') });
  if (rec.p) {
    poster.appendChild(el('img', {
      class: 'tcard-img', loading: 'lazy', decoding: 'async', alt: '',
      src: posterUrl(rec.p, 'w342'), width: 342, height: 513,
    }));
  } else {
    poster.appendChild(el('span', { class: 'tcard-placard', text: rec.n }));
  }
  // rank pill, top-left — only where rank is meaningful (home top-of-curve)
  if (opts.rank != null) {
    poster.appendChild(el('span', { class: 'tcard-rank', text: '#' + String(opts.rank).padStart(2, '0') }));
  }
  // tier badge, top-right, ON the poster — fully inside (max-width + ellipsis guard)
  poster.appendChild(el('span', { class: 'tcard-badge', text: t.name }));
  card.appendChild(poster);

  // below the poster: title + meta + percentile (left), big AQ number (right)
  const info = el('div', { class: 'tcard-info' }, [
    el('div', { class: 'tcard-title', text: rec.n }),
    el('div', { class: 'tcard-meta', text: rec.year + ' · ' + kindOf(rec) }),
  ]);
  const ptag = pctTag(rec.pct);
  if (ptag) info.appendChild(el('span', { class: 'tcard-pct', title: pctPhrase(rec.pct), text: ptag }));
  card.appendChild(el('div', { class: 'tcard-row' }, [
    info,
    el('div', { class: 'tcard-aq', title: pz ? 'Personalized ' + SCORE_LABEL : SCORE_LABEL, text: String(score) }),
  ]));

  // three thin dimension mini-bars: Depth (cog) · Insight (edu) · Craft (ent)
  const bars = el('div', { class: 'tcard-bars' });
  ['cog', 'edu', 'ent'].forEach(k => {
    bars.appendChild(el('div', { class: 'tcard-bar' },
      [el('div', { class: 'tcard-bar-fill', style: 'width:' + rec[k] + '%;' })]));
  });
  card.appendChild(bars);
  return card;
}

/* ------------------------------------------------- poster-overlay card ----
   The catalog / "in the same vein" card per the redesign: a 2:3 poster with
   the tier badge top-right, the AQ + /200 bottom-left over a bottom gradient,
   and the ★IMDb rating bottom-right (gold). Title + `year · genres` sit below
   the poster. The whole card links to the title page; metadata stays legible.  */
function posterCard(rec, opts) {
  opts = opts || {};
  const t = tierOf(rec.tier);
  const score = displayIq(rec);
  const pz = weightsActive();
  const card = el('a', {
    class: 'pcard t' + rec.tier + (pz ? ' is-personal' : ''),
    href: titleHref(rec.slug),
    'aria-label': rec.n + ', ' + (pz ? 'personalized ' : '') + SCORE_LABEL + ' ' + score + ' of ' + IQ_MAX + ', tier ' + t.name + ', IMDb ' + rec.rating.toFixed(1),
  });

  const poster = el('div', { class: 'pcard-poster' + (rec.p ? ' has-poster' : ' hatch') });
  if (rec.p) {
    poster.appendChild(el('img', {
      class: 'pcard-img', loading: 'lazy', decoding: 'async', alt: '',
      src: posterUrl(rec.p, 'w342'), width: 342, height: 513,
    }));
  } else {
    poster.appendChild(el('span', { class: 'pcard-placard', text: rec.n }));
  }
  poster.appendChild(el('span', { class: 'pcard-badge', text: t.name }));
  poster.appendChild(el('div', { class: 'pcard-grad', 'aria-hidden': 'true' }));
  poster.appendChild(el('span', { class: 'pcard-aq', title: pz ? 'Personalized ' + SCORE_LABEL : SCORE_LABEL }, [
    el('b', { text: String(score) }),
    el('span', { class: 'pcard-of', text: '/' + IQ_MAX }),
  ]));
  poster.appendChild(el('span', { class: 'pcard-imdb', title: 'IMDb rating' }, [
    el('span', { class: 'star', 'aria-hidden': 'true', text: '★' }),
    document.createTextNode(rec.rating.toFixed(1)),
  ]));
  card.appendChild(poster);

  const genres = (rec.g || []).slice(0, 2).join(', ');
  card.appendChild(el('div', { class: 'pcard-info' }, [
    el('div', { class: 'pcard-title', text: rec.n }),
    el('div', { class: 'pcard-meta', text: rec.year + (genres ? ' · ' + genres : '') }),
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

/* ----------------------------------------------------- reception -------- */
/* The AQ already folds these in; we surface them so the score story is legible.
   Audience (IMDb 0–10) is present for every title; critic scores (Metacritic
   /100, Rotten Tomatoes %) appear only where a professional verdict exists.   */
function receptionBlock(rec) {
  function cell(label, valNode, src) {
    return el('div', { class: 'rc-cell' }, [
      el('span', { class: 'rc-label', text: label }),
      el('span', { class: 'rc-val' }, valNode),
      el('span', { class: 'rc-src', text: src }),
    ]);
  }
  const cells = [
    cell('Audience', [
      el('b', { text: rec.rating.toFixed(1) }),
      el('span', { class: 'rc-unit', text: '/10' }),
    ], 'IMDb'),
  ];
  if (rec.mc != null) {
    cells.push(cell('Critic', [
      el('b', { text: String(rec.mc) }),
      el('span', { class: 'rc-unit', text: '/100' }),
    ], 'Metacritic'));
  }
  if (rec.rt != null) {
    cells.push(cell('Critic', [
      el('b', { text: String(rec.rt) }),
      el('span', { class: 'rc-unit', text: '%' }),
    ], 'Rotten Tomatoes'));
  }
  const row = el('div', { class: 'reception-row' }, cells);
  if (rec.mc == null && rec.rt == null) {
    row.appendChild(el('span', { class: 'rc-empty', text: 'No critic score yet.' }));
  }
  return el('div', { class: 'reception' }, [
    el('div', { class: 'reception-head' }, [
      el('h3', { text: 'Reception' }),
      el('span', { class: 'reception-note', text: 'folded into the AQ' }),
    ]),
    row,
  ]);
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

/* ----------------------------------------------- attribution footer ----- */
/* Legally-required data credits, rendered once from here (single source of
   truth) and appended into whatever footer the page already has, so the
   wording stays consistent and DRY across every page. Text-only: the page
   CSP (img-src 'self' data:) does not allow an external logo, and posters are
   hotlinked from image.tmdb.org — we credit them rather than vendor anything. */
function injectAttribution() {
  const footer = document.querySelector('footer');
  if (!footer || footer.querySelector('.attrib-credit')) return;
  const tmdbLink = el('a', { class: 'attrib-link', href: 'https://www.themoviedb.org/', target: '_blank', rel: 'noopener noreferrer', text: 'TMDB' });
  const imdbLink = el('a', { class: 'attrib-link', href: 'https://www.imdb.com/interfaces/', target: '_blank', rel: 'noopener noreferrer', text: 'IMDb' });
  const omdbLink = el('a', { class: 'attrib-link', href: 'https://www.omdbapi.com/', target: '_blank', rel: 'noopener noreferrer', text: 'OMDb' });
  const block = el('div', { class: 'attrib-credit' }, [
    el('div', { class: 'attrib-inner' }, [
      // verbatim TMDB attribution wording (TMDB term-of-use requirement)
      el('p', { class: 'attrib-line' }, ['This product uses the ', tmdbLink, ' API but is not endorsed or certified by TMDB.']),
      el('p', { class: 'attrib-line' }, ['Title data from ', imdbLink, '. For non-commercial use.']),
      el('p', { class: 'attrib-line' }, ['Reception scores via ', omdbLink, ' (Metacritic, Rotten Tomatoes, IMDb).']),
    ]),
  ]);
  footer.appendChild(block);
}

/* ----------------------------------------------------- nav -------------- */
function initNav() {
  injectGrain();
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

/* ====================================================================== */
/* HOME — the Acuity design, wired to real data                            */
/* ====================================================================== */
const kindOf = r => (r.type === 'series' ? 'Series' : 'Film');

/* a poster tile (real cover when available, hatched placard otherwise) */
function posterTile(rec, w, sizeName) {
  const tile = el('div', { class: 'acu-tile' + (rec.p ? '' : ' hatch') });
  if (w) tile.style.width = w + 'px';
  if (rec.p) {
    tile.appendChild(el('img', { loading: 'lazy', decoding: 'async', alt: '',
      src: posterUrl(rec.p, sizeName || 'w154') }));
  } else {
    tile.appendChild(el('span', { class: 'acu-tile-t', text: rec.n }));
  }
  return tile;
}

function initHome() {
  const root = document.querySelector('.acu-home');
  if (!root) return;

  Promise.all([loadCatalog(), loadStats()]).then(([cat, stats]) => {
    const tagline = document.querySelector('[data-hero-tagline]');
    if (tagline) tagline.textContent = stats.n.toLocaleString() + ' titles scored · Method v2.0 · No studio money';
    const stTitles = document.querySelector('[data-stat-titles]');
    if (stTitles) stTitles.textContent = stats.n.toLocaleString();

    buildMarquee(cat);
    const focus = buildInstrument(cat);
    buildFeatured(cat, focus);
    buildTitleChips(cat, focus);
    buildHeroSearch(cat, focus);
    buildCurve(stats);
    buildCompare(cat);

    focus(cat[0]); // default the instrument to the top title
  }).catch(err => {
    console.error(err);
    const feat = document.querySelector('[data-feat]');
    if (feat) feat.appendChild(el('p', { class: 'muted', text: 'Could not load the catalog right now.' }));
  });

  /* -------- hero poster marquee (6 scrolling columns) -------- */
  function buildMarquee(cat) {
    const cols = document.querySelectorAll('[data-marq-col]');
    if (!cols.length) return;
    const withP = cat.filter(r => r.p);
    const pool = (withP.length >= 60 ? withP : cat).slice(0, 120);
    const per = 10;
    cols.forEach((col, ci) => {
      const items = [];
      for (let n = 0; n < per; n++) items.push(pool[(ci * 7 + n) % pool.length]);
      const fill = list => list.forEach(r => col.appendChild(posterTile(r, 150, 'w154')));
      fill(items); fill(items); // duplicate for a seamless loop
    });
  }

  /* -------- the Acuity Instrument focus card -------- */
  function buildInstrument() {
    const posterBox = document.querySelector('[data-inst-poster]');
    const titleEl = document.querySelector('[data-inst-title]');
    const metaEl = document.querySelector('[data-inst-meta]');
    const aqEl = document.querySelector('[data-inst-aq]');
    const tierEl = document.querySelector('[data-inst-tier]');
    const barEl = document.querySelector('[data-inst-bar]');
    const dims = {
      cog: [document.querySelector('[data-inst-depth-v]'), document.querySelector('[data-inst-depth-bar]')],
      edu: [document.querySelector('[data-inst-insight-v]'), document.querySelector('[data-inst-insight-bar]')],
      ent: [document.querySelector('[data-inst-craft-v]'), document.querySelector('[data-inst-craft-bar]')],
    };
    return function focus(rec) {
      if (!rec) return;
      const tc = tierColorVar(rec.tier), t = tierOf(rec.tier);
      posterBox.innerHTML = '';
      posterBox.classList.toggle('hatch', !rec.p);
      if (rec.p) {
        posterBox.appendChild(el('img', { loading: 'lazy', decoding: 'async', alt: 'Poster for ' + rec.n,
          src: posterUrl(rec.p, 'w185'),
          style: 'width:100%;height:100%;object-fit:cover;' }));
      } else {
        posterBox.style.display = 'flex'; posterBox.style.alignItems = 'center'; posterBox.style.justifyContent = 'center';
        posterBox.appendChild(el('span', { class: 'acu-tile-t', text: rec.n,
          style: 'text-align:center;padding:0 6px;width:100%;' }));
      }
      titleEl.textContent = rec.n;
      titleEl.setAttribute('href', titleHref(rec.slug));
      metaEl.textContent = rec.year + ' · ' + kindOf(rec);
      aqEl.textContent = String(rec.iq);
      aqEl.style.color = tc;
      tierEl.textContent = t.name;
      tierEl.style.color = tc;
      barEl.style.width = (rec.iq / IQ_MAX * 100).toFixed(1) + '%';
      barEl.style.background = tc;
      ['cog', 'edu', 'ent'].forEach(k => {
        const [vEl, bEl] = dims[k];
        vEl.textContent = String(rec[k]);
        bEl.style.width = rec[k] + '%';
      });
    };
  }

  /* -------- top-of-the-curve featured grid (the canonical title card) -------- */
  function buildFeatured(cat, focus) {
    const grid = document.querySelector('[data-feat]');
    if (!grid) return;
    const frag = document.createDocumentFragment();
    const cards = cat.slice(0, 6).map((rec, i) => titleCard(rec, { rank: i + 1 }));
    cards.forEach(c => frag.appendChild(c));
    grid.appendChild(frag);
    animateStagger(cards, { step: 75, cap: 6 }); // stagger the top-of-curve cards in
  }

  /* -------- title chips that focus the instrument (top of the curve) -------- */
  function buildTitleChips(cat, focus) {
    const host = document.querySelector('[data-inst-chips]');
    if (!host) return;
    const chips = [];
    cat.slice(0, 6).forEach(rec => {
      const btn = el('button', { class: 'acu-chip', type: 'button', text: rec.n });
      btn.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        focus(rec);
      });
      chips.push(btn);
      host.appendChild(btn);
    });
  }

  /* -------- head-to-head compare: two titles, delta, swap the right one -------- */
  function buildCompare(cat) {
    const cardHost = document.querySelector('[data-compare-cards]');
    const swapHost = document.querySelector('[data-compare-swap]');
    if (!cardHost || !swapHost) return;
    const n = cat.length;
    const left = cat[0]; // the highest-scoring title anchors the left
    // a varied swap pool spread across the distribution (deduped, never the left title)
    const picks = [];
    const seen = new Set([left.slug]);
    [Math.floor(n * 0.5), Math.floor(n * 0.18), Math.floor(n * 0.82), 4].forEach(i => {
      const r = cat[Math.max(0, Math.min(n - 1, i))];
      if (r && !seen.has(r.slug)) { seen.add(r.slug); picks.push(r); }
    });
    if (!picks.length) return;
    let right = picks[0];

    // one compare card (real data, design styles); `accent` highlights the left card
    function compareCard(rec, accent) {
      const tc = tierColorVar(rec.tier), t = tierOf(rec.tier);
      const poster = el('div', { class: 'acu-cmp-poster' + (rec.p ? '' : ' hatch') });
      if (rec.p) poster.appendChild(el('img', { loading: 'lazy', decoding: 'async', alt: '', src: posterUrl(rec.p, 'w185') }));
      else poster.appendChild(el('span', { class: 'acu-tile-t', text: rec.n }));
      const head = el('div', { class: 'acu-cmp-head' }, [
        poster,
        el('div', { class: 'acu-cmp-meta' }, [
          el('a', { class: 'acu-cmp-title', href: titleHref(rec.slug), text: rec.n }),
          el('div', { class: 'acu-cmp-sub', text: rec.year + ' · ' + kindOf(rec) }),
          el('div', { class: 'acu-cmp-aq', style: 'color:' + tc + ';', text: String(rec.iq) }),
          el('span', { class: 'acu-cmp-tier', style: 'color:' + tc + ';', text: t.name }),
        ]),
      ]);
      const bars = el('div', { class: 'acu-cmp-bars' });
      [['DEPTH', 'cog'], ['INSIGHT', 'edu'], ['CRAFT', 'ent']].forEach(([lbl, k]) => {
        bars.appendChild(el('div', { class: 'acu-cmp-bar' }, [
          el('div', { class: 'acu-cmp-bar-top' }, [el('span', { text: lbl }), el('span', { text: String(rec[k]) })]),
          el('div', { class: 'acu-cmp-track' }, [el('div', { class: 'acu-cmp-fill', style: 'width:' + rec[k] + '%;' })]),
        ]));
      });
      return el('div', { class: 'acu-cmp-card' + (accent ? ' is-accent' : '') }, [head, bars]);
    }

    function renderCmp() {
      cardHost.innerHTML = '';
      const dd = left.iq - right.iq;
      const delta = el('div', { class: 'acu-cmp-delta' }, [
        el('span', { class: 'acu-cmp-delta-l', text: 'DELTA' }),
        el('span', { class: 'acu-cmp-delta-n', style: 'color:' + (dd >= 0 ? 'var(--acc)' : 'var(--t0)') + ';', text: (dd > 0 ? '+' : '') + dd }),
        el('span', { class: 'acu-cmp-delta-l', text: 'AQ' }),
      ]);
      cardHost.appendChild(compareCard(left, true));
      cardHost.appendChild(delta);
      cardHost.appendChild(compareCard(right, false));
      swapHost.querySelectorAll('.acu-cmp-swap').forEach(b => b.classList.toggle('active', b._slug === right.slug));
    }

    picks.forEach(rec => {
      const btn = el('button', { class: 'acu-cmp-swap', type: 'button', text: rec.n });
      btn._slug = rec.slug;
      btn.addEventListener('click', () => { right = rec; renderCmp(); });
      swapHost.appendChild(btn);
    });
    renderCmp();
  }

  /* -------- hero search with live autocomplete dropdown -------- */
  function buildHeroSearch(cat, focus) {
    const input = document.querySelector('[data-hero-input]');
    const list = document.querySelector('[data-hero-results]');
    if (!input || !list) return;
    let timer = null;

    function close() { list.setAttribute('hidden', ''); list.innerHTML = ''; }
    function run() {
      const q = input.value.trim();
      if (!q) { close(); return; }
      const items = searchTitles(cat, q, 6);
      if (items.length) focus(items[0]); // searching focuses the instrument on the best match
      list.innerHTML = '';
      if (!items.length) { close(); return; }
      items.forEach(rec => {
        const tc = tierColorVar(rec.tier);
        // mini poster thumbnail (2:3, rounded) — real cover, hatched fallback
        const thumb = el('span', { class: 'acu-res-thumb' + (rec.p ? '' : ' noimg') });
        if (rec.p) thumb.appendChild(el('img', { loading: 'lazy', decoding: 'async', alt: '', src: posterUrl(rec.p, 'w92'), width: 30, height: 45 }));
        const a = el('a', { class: 'acu-res', role: 'option', href: titleHref(rec.slug) }, [
          thumb,
          el('span', { text: String(rec.iq), style: 'font-family:var(--mono); font-size:17px; font-weight:600; color:' + tc + '; min-width:34px;' }),
          el('span', { style: 'flex:1; min-width:0;' }, [
            el('span', { text: rec.n, style: 'display:block; font-size:14px; color:var(--text); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' }),
            el('span', { text: rec.year + ' · ' + kindOf(rec) + ' · ' + tierOf(rec.tier).name, style: 'display:block; font-family:var(--mono); font-size:10.5px; color:#8f8a9e; letter-spacing:0.5px;' }),
          ]),
          el('span', { text: 'Inspect →', style: 'font-size:12px; color:var(--muted-2);' }),
        ]);
        list.appendChild(a);
      });
      list.removeAttribute('hidden');
    }
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 110); });
    input.addEventListener('focus', () => { if (input.value.trim()) run(); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); input.blur(); } });
    document.addEventListener('click', e => { if (!list.contains(e.target) && e.target !== input) close(); });
  }

  /* -------- flat-curve histogram from stats.json -------- */
  function buildCurve(stats) {
    const host = document.querySelector('[data-curve]');
    const tip = document.querySelector('[data-curve-tip]');
    const legendHost = document.querySelector('[data-legend]');
    if (!host) return;

    const plottedEl = document.querySelector('[data-plotted]');
    const tailEl = document.querySelector('[data-tailpct]');
    if (plottedEl) plottedEl.textContent = stats.n.toLocaleString();
    const tc = stats.tier_counts || {};
    const tail = (tc['0'] || 0) + (tc['4'] || 0);
    if (tailEl) tailEl.textContent = Math.round(tail / stats.n * 100) + '%';

    const hist = stats.histogram || {};
    const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
    const maxCount = Math.max.apply(null, keys.map(k => hist[k]));
    let activeTier = null;
    const bars = [];

    keys.forEach((k, i) => {
      const tier = scoreTier(k);
      const bar = el('div', { class: 'acu-bar' });
      bar.style.height = (3 + (hist[k] / maxCount) * 97).toFixed(1) + '%';
      bar.style.background = tierColorVar(tier);
      bar._tier = tier;
      bar.addEventListener('mouseenter', () => {
        if (!tip) return;
        tip.style.left = (((i + 0.5) / keys.length) * 100).toFixed(1) + '%';
        tip.style.borderColor = tierColorVar(tier);
        tip.innerHTML = '';
        tip.appendChild(el('div', { text: 'AQ ' + k + ' · ' + tierOf(tier).name, style: 'font-family:var(--mono); font-size:11px; color:' + tierColorVar(tier) + '; font-weight:600;' }));
        tip.appendChild(el('div', { text: hist[k] + ' titles', style: 'font-family:var(--mono); font-size:10px; color:#8f8a9e; margin-top:2px;' }));
        tip.removeAttribute('hidden');
      });
      bars.push(bar);
      host.appendChild(bar);
    });
    host.addEventListener('mouseleave', () => { if (tip) tip.setAttribute('hidden', ''); });

    function applyActive() {
      bars.forEach(b => { b.style.opacity = (activeTier != null && b._tier !== activeTier) ? '0.16' : '1'; });
    }
    if (legendHost) {
      const legBtns = [];
      [4, 3, 2, 1, 0].forEach(tk => {
        const t = tierOf(tk), col = tierColorVar(tk);
        const btn = el('button', { class: 'acu-legend', type: 'button' }, [
          el('span', { style: 'width:8px; height:8px; border-radius:50%; background:' + col + '; flex:none;' }),
          document.createTextNode(t.name),
          el('span', { text: t.range, style: 'font-family:var(--mono); font-size:10px; color:#8f8a9e; margin-left:2px;' }),
        ]);
        btn.addEventListener('click', () => {
          activeTier = (activeTier === tk) ? null : tk;
          legBtns.forEach(b => b.el.classList.toggle('active', b.tk === activeTier));
          applyActive();
        });
        legBtns.push({ el: btn, tk });
        legendHost.appendChild(btn);
      });
    }
  }

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
    const cards = kids.slice(0, 12).map(r => titleCard(r));
    cards.forEach(c => grid.appendChild(c));
    animateStagger(cards, { step: 60, cap: 12 });
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
    maxAge: null,
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
  const elMaxAge = document.querySelector('#maxAge');
  const elMinRating = document.querySelector('#minRating');
  const elVotesChips = document.querySelector('#votesChips');
  // live value read-outs for the slider-based filters (dimension mins / age / IMDb)
  const elDmVal = {
    cog: document.querySelector('[data-dm="cog"]'),
    edu: document.querySelector('[data-dm="edu"]'),
    ent: document.querySelector('[data-dm="ent"]'),
  };
  const elAgeVal = document.querySelector('[data-ageval]');
  const elRatingVal = document.querySelector('[data-ratingval]');
  // label text: age slider reads "any age" at the top, else "a N-year-old"
  function ageLabelText(v) { return (v == null || v >= 18) ? 'any age' : ('a ' + v + '-year-old'); }
  function ratingLabelText(v) { return v > 0 ? '★ ' + v.toFixed(1) : 'Any'; }
  // push current slider state into the read-out labels
  function syncSliderLabels() {
    DIMS.forEach(d => {
      const prop = 'min' + d.key.charAt(0).toUpperCase() + d.key.slice(1);
      if (elDmVal[d.key]) elDmVal[d.key].textContent = String(state[prop] || 0);
    });
    if (elAgeVal) elAgeVal.textContent = ageLabelText(state.maxAge);
    if (elRatingVal) elRatingVal.textContent = ratingLabelText(state.minRating);
  }
  const elGenreSearch = document.querySelector('#genreSearch');
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
  // mobile filter drawer chrome
  const elFilterPanel = document.querySelector('#filterPanel');
  const elFilterToggle = document.querySelector('#filterToggle');
  const elFilterClose = document.querySelector('#filterClose');
  const elFilterScrim = document.querySelector('#filterScrim');
  const elFilterApply = document.querySelector('#filterApply');
  const elFilterBadge = document.querySelector('#filterBadge');

  // minimum-IMDb-vote bands rendered as chip toggles
  const VOTE_BANDS = [[1000, '1k+'], [10000, '10k+'], [50000, '50k+'], [100000, '100k+'], [500000, '500k+']];
  let allGenres = []; // every genre (for the genre search box)

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
    if (params.has('age')) { const a = parseInt(params.get('age'), 10); if (a >= 0 && a <= 18) state.maxAge = a; }
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
    allGenres = Object.keys(gc).sort((a, b) => gc[b] - gc[a]);
    allGenres.forEach(g => {
      const chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', 'data-genre': g, text: g });
      chip.addEventListener('click', () => { toggle(state.genres, g, chip); resetPage(); apply(); });
      elGenreChips.appendChild(chip);
    });
    // genre search box — hides chips that do not match (picked ones always stay)
    if (elGenreSearch) elGenreSearch.addEventListener('input', () => {
      const q = elGenreSearch.value.trim().toLowerCase();
      elGenreChips.querySelectorAll('.chip').forEach(c => {
        const g = c.getAttribute('data-genre');
        const show = !q || g.toLowerCase().includes(q) || state.genres.has(g);
        c.hidden = !show;
      });
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
    // IMDb minimum-vote bands as exclusive chip toggles
    if (elVotesChips) {
      VOTE_BANDS.forEach(([val, lbl]) => {
        const chip = el('button', { class: 'chip votechip', type: 'button', 'aria-pressed': 'false', 'data-votes': val, text: lbl });
        chip.addEventListener('click', () => {
          state.minVotes = (state.minVotes === val) ? 0 : val;
          syncVoteChips();
          resetPage(); apply();
        });
        elVotesChips.appendChild(chip);
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
    });
    if (elMinRating) elMinRating.value = String(state.minRating || 0);
    if (elMaxAge) elMaxAge.value = state.maxAge == null ? '18' : String(state.maxAge);
    syncSliderLabels();
    syncVoteChips();
    if (elSort) elSort.value = state.sort;
    elSvc.querySelectorAll('input[data-svc]').forEach(cb => { cb.checked = state.services.has(cb.getAttribute('data-svc')); });
    if (state.services.size) Store.setServices([...state.services]);
    updateSvcCount();
  }

  function syncVoteChips() {
    if (!elVotesChips) return;
    elVotesChips.querySelectorAll('.votechip').forEach(c => {
      const v = parseInt(c.getAttribute('data-votes'), 10);
      c.setAttribute('aria-pressed', state.minVotes === v ? 'true' : 'false');
    });
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
      // audience age: keep only titles rated suitable for a viewer ≤ maxAge;
      // titles whose maturity is higher or unknown are hidden when the cap is set
      if (state.maxAge != null && (r.maxage == null || r.maxage > state.maxAge)) return false;
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
      if (s === 'year-asc') return a.year - b.year || a.n.localeCompare(b.n);
      return 0;
    });
  }

  function render(mode) {
    elGrid.innerHTML = '';
    elCount.innerHTML = '';
    elCount.appendChild(el('b', { text: filtered.length.toLocaleString() }));
    elCount.appendChild(document.createTextNode(' ' + (filtered.length === 1 ? 'title' : 'titles')));
    if (weightsActive()) elCount.appendChild(el('span', { class: 'personal-flag', text: '★ re-ranked to your priorities' }));
    updateDrawerMeta();

    if (!filtered.length) {
      elGrid.appendChild(el('div', { class: 'empty' }, [
        el('h3', { text: 'Nothing matches.' }),
        el('p', { text: 'Loosen a filter, widen the score range, or clear your search to see more of the catalog.' }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Clear all filters' }),
      ]));
      elGrid.querySelector('.empty .btn').addEventListener('click', resetAll);
      elMoreWrap.innerHTML = '';
      return;
    }
    const slice = filtered.slice(0, state.shown);
    const frag = document.createDocumentFragment();
    const cards = slice.map(r => posterCard(r));
    cards.forEach(c => frag.appendChild(c));
    elGrid.appendChild(frag);
    // entrance: on a fresh result set animate the first screen of cards in;
    // on "show more" only the newly appended batch animates (the rest stay put)
    const from = mode === 'more' ? Math.max(0, state.shown - PAGE) : 0;
    animateStagger(cards.slice(from), { step: 40, cap: 10 });

    elMoreWrap.innerHTML = '';
    if (filtered.length > state.shown) {
      const remaining = filtered.length - state.shown;
      const btn = el('button', { class: 'btn btn-ghost', type: 'button',
        text: 'Show more (' + Math.min(PAGE, remaining) + ' of ' + remaining.toLocaleString() + ')' });
      btn.addEventListener('click', () => { state.shown += PAGE; render('more'); });
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
        state[prop] = 0; if (dimMin[key]) dimMin[key].value = '0';
      }]);
    });
    if (state.minRating > 0) pills.push(['IMDb ≥ ' + state.minRating.toFixed(1), () => { state.minRating = 0; if (elMinRating) elMinRating.value = '0'; }]);
    if (state.minVotes > 0) pills.push(['≥ ' + fmtVotes(state.minVotes) + ' votes', () => { state.minVotes = 0; syncVoteChips(); }]);
    if (state.maxAge != null) pills.push(['Age ≤ ' + state.maxAge, () => { state.maxAge = null; if (elMaxAge) elMaxAge.value = '18'; }]);

    pills.forEach(([label, undo]) => {
      const x = el('button', { type: 'button', 'aria-label': 'Remove ' + label, text: '×' });
      const pill = el('span', { class: 'active-pill' }, [document.createTextNode(label), x]);
      x.addEventListener('click', () => { undo(); syncSliderLabels(); resetPage(); apply(); });
      elActive.appendChild(pill);
    });

    // active-count badge on the mobile "Filters" trigger
    if (elFilterBadge) {
      elFilterBadge.textContent = String(pills.length);
      elFilterBadge.hidden = pills.length === 0;
    }
  }

  // keep the drawer's sticky "Show N titles" button in sync with the result count
  function updateDrawerMeta() {
    if (elFilterApply) elFilterApply.textContent = 'Show ' + filtered.length.toLocaleString() + ' title' + (filtered.length === 1 ? '' : 's');
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
    state.maxAge = null;
    if (elMaxAge) elMaxAge.value = '18';
    DIMS.forEach(d => { if (dimMin[d.key]) dimMin[d.key].value = '0'; });
    if (elMinRating) elMinRating.value = '0';
    syncSliderLabels();
    syncVoteChips();
    if (elGenreSearch) { elGenreSearch.value = ''; elGenreChips.querySelectorAll('.chip').forEach(c => { c.hidden = false; }); }
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

  // per-dimension minimums — sliders (0–100, step 5)
  DIMS.forEach(d => {
    const sl = dimMin[d.key];
    if (!sl) return;
    const prop = 'min' + d.key.charAt(0).toUpperCase() + d.key.slice(1);
    sl.addEventListener('input', () => {
      state[prop] = Math.max(0, Math.min(100, parseInt(sl.value, 10) || 0));
      if (elDmVal[d.key]) elDmVal[d.key].textContent = String(state[prop]);
      resetPage(); apply();
    });
  });
  // IMDb rating minimum — slider (0–9.5, step 0.5; 0 = Any)
  if (elMinRating) elMinRating.addEventListener('input', () => {
    state.minRating = Math.max(0, Math.min(10, parseFloat(elMinRating.value) || 0));
    if (elRatingVal) elRatingVal.textContent = ratingLabelText(state.minRating);
    resetPage(); apply();
  });
  // audience-age cap — slider (6–18; 18 = any age, otherwise "suitable for age ≤ N")
  if (elMaxAge) elMaxAge.addEventListener('input', () => {
    const v = parseInt(elMaxAge.value, 10);
    state.maxAge = (isNaN(v) || v >= 18) ? null : Math.max(0, v);
    if (elAgeVal) elAgeVal.textContent = ageLabelText(state.maxAge);
    resetPage(); apply();
  });

  // collapsible filter groups — click/keyboard toggles each block open/closed
  document.querySelectorAll('.filter-block.collapsible > .fb-toggle').forEach(h => {
    function toggle() {
      const block = h.parentNode;
      const open = !block.classList.contains('collapsed');
      block.classList.toggle('collapsed', open);
      h.setAttribute('aria-expanded', String(!open));
    }
    h.addEventListener('click', e => {
      // let inner controls (e.g. the weight Reset button) act without toggling
      if (e.target.closest('button') && e.target.closest('button') !== h) return;
      toggle();
    });
    h.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  elSort.addEventListener('change', () => { state.sort = elSort.value; resetPage(); apply(); });
  elReset.addEventListener('click', resetAll);

  // ---- mobile filter drawer: open / close + scrim ----
  function openDrawer() {
    if (!elFilterPanel) return;
    elFilterPanel.classList.add('open');
    if (elFilterScrim) elFilterScrim.hidden = false;
    document.body.classList.add('drawer-open');
    if (elFilterToggle) elFilterToggle.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    if (!elFilterPanel) return;
    elFilterPanel.classList.remove('open');
    if (elFilterScrim) elFilterScrim.hidden = true;
    document.body.classList.remove('drawer-open');
    if (elFilterToggle) elFilterToggle.setAttribute('aria-expanded', 'false');
  }
  if (elFilterToggle) elFilterToggle.addEventListener('click', () => {
    if (elFilterPanel.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  if (elFilterClose) elFilterClose.addEventListener('click', closeDrawer);
  if (elFilterScrim) elFilterScrim.addEventListener('click', closeDrawer);
  if (elFilterApply) elFilterApply.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && elFilterPanel && elFilterPanel.classList.contains('open')) closeDrawer(); });

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
      on = false;                       // return to the default Acuity Quotient
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

    const score = displayIq(rec);
    const pz = weightsActive();

    // back to catalog
    root.appendChild(el('a', { class: 'back-link', href: './explore.html' }, [
      el('span', { class: 'bl-arrow', 'aria-hidden': 'true', text: '←' }),
      document.createTextNode(' Catalog'),
    ]));

    /* ---------------- HERO: poster + headline + AQ card + where-to-watch ---- */
    const hero = el('div', { class: 'title-hero' });

    // left: poster (~286px, 2:3) — real cover or hatched placard
    const media = el('div', { class: 'th-poster' + (rec.p ? ' has-poster' : ' hatch') });
    if (rec.p) {
      media.appendChild(el('img', { class: 'th-poster-img', loading: 'eager', decoding: 'async',
        src: posterUrl(rec.p, 'w500'), alt: 'Poster for ' + rec.n, width: 500, height: 750 }));
    } else {
      media.appendChild(el('span', { class: 'th-placard', text: rec.n }));
    }
    hero.appendChild(media);

    const main = el('div', { class: 'th-main' });

    // chips row: kind · year · cert · ★IMDb·votes (gold)
    const chips = el('div', { class: 'th-chips' });
    chips.appendChild(metaLink(kindOf(rec), { type: rec.type }, 'th-chip'));
    chips.appendChild(metaLink(String(rec.year), { year: rec.year }, 'th-chip'));
    if (rec.cert) chips.appendChild(el('span', { class: 'th-chip rated', title: 'Content rating', text: rec.cert }));
    chips.appendChild(el('span', { class: 'th-chip imdb' }, [
      el('span', { class: 'star', 'aria-hidden': 'true', text: '★' }),
      el('b', { text: rec.rating.toFixed(1) }),
      el('span', { class: 'th-votes', text: ' · ' + fmtVotes(rec.votes) + ' votes' }),
    ]));
    main.appendChild(chips);

    // title (54px serif)
    main.appendChild(el('h1', { class: 'th-title', text: rec.n }));

    // genres → filtered Explore
    const genreRow = el('div', { class: 'th-genres' });
    (rec.g || []).forEach(g => genreRow.appendChild(metaLink(g, { genre: g }, 'th-genre')));
    main.appendChild(genreRow);

    // the big AQ card
    const pp = pctPhrase(rec.pct);
    const aqCard = el('div', { class: 'aq-card t' + rec.tier + (pz ? ' personal' : '') });
    const aqcBig = el('span', { class: 'aqc-big', title: pz ? 'Personalized ' + SCORE_LABEL : SCORE_LABEL, text: REDUCE_MOTION ? String(score) : '0' });
    aqCard.appendChild(el('div', { class: 'aqc-top' }, [
      el('div', { class: 'aqc-num' }, [
        aqcBig,
        el('span', { class: 'aqc-of', text: '/' + IQ_MAX + ' ' + SCORE_ABBR }),
      ]),
      el('div', { class: 'aqc-side' }, [
        tierChipLink(rec.tier),
        pp ? el('span', { class: 'aqc-pct', text: pp }) : null,
        pz ? el('a', { class: 'ds-personal', href: './explore.html', text: '★ personalized — see priorities' }) : null,
      ]),
    ]));
    const aqBar = el('div', { class: 'aqc-bar' }, [el('div', { class: 'aqc-bar-fill' })]);
    aqCard.appendChild(aqBar);
    aqCard.appendChild(el('p', { class: 'aqc-blurb' }, [
      el('a', { class: 'aqc-tier tier-name-link t' + rec.tier, href: exploreHref({ tier: rec.tier }), text: t.name }),
      document.createTextNode(' — ' + t.desc),
    ]));
    main.appendChild(aqCard);
    // reveal once: fill the AQ bar (CSS width transition) and count the number up
    requestAnimationFrame(() => {
      const f = aqBar.querySelector('.aqc-bar-fill');
      if (f) f.style.width = (score / IQ_MAX * 100).toFixed(1) + '%';
      countUp(aqcBig, score, 720);
    });

    // mark watched / add to watchlist (kept from prior build, placed in the hero)
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
    const actions = el('div', { class: 'detail-actions' }, [watchedBtn, listBtn]);
    if (!Store.available) actions.appendChild(el('span', { class: 'muted', text: ' (browser storage is off — picks won’t persist)' }));
    main.appendChild(actions);

    // where to watch — provider chips with official logos
    main.appendChild(el('h2', { class: 'subhead', text: 'Where to watch (US)' }));
    watchHost = el('div', { class: 'watch-host' });
    main.appendChild(watchHost);
    renderWatch(rec);

    hero.appendChild(main);
    root.appendChild(hero);
    // entrance: poster then the hero column lift in (above the fold → on load)
    animate(media, 0);
    animate(main, 110);

    /* ---------------- RECEPTION (audience + critic; AQ folds these in) ------ */
    const reception = receptionBlock(rec);
    root.appendChild(reception);
    animate(reception);

    /* ---------------- THE BREAKDOWN — three lenses, scored ----------------- */
    const bd = el('section', { class: 'breakdown' });
    bd.appendChild(el('div', { class: 'sec-head' }, [
      el('h2', { text: 'The breakdown' }),
      el('span', { class: 'sec-sub', text: 'Three lenses, scored' }),
    ]));
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
    bd.appendChild(dims);
    root.appendChild(bd);
    animate(bd);

    /* ---------------- THE RATIONALE + "how this was scored" sidecard ------- */
    const rg = el('div', { class: 'rationale-grid' });
    rg.appendChild(el('div', { class: 'rationale' }, [
      el('h3', { text: 'The rationale — Why this score' }),
      el('p', { text: makeRationale(rec) }),
    ]));
    rg.appendChild(el('aside', { class: 'score-sidecard' }, [
      el('h4', { text: 'How this was scored' }),
      el('p', { text: 'Every title runs through the same three lenses — Depth, Insight and Craft — blended into one Acuity Quotient on a fixed 0–' + IQ_MAX + ' scale. Audience and critic reception are folded in, never published as the verdict.' }),
      el('a', { class: 'sidecard-link', href: './methodology.html', text: 'Read the methodology →' }),
    ]));
    root.appendChild(rg);
    animate(rg);

    /* ---------------- IN THE SAME VEIN — same genre, near this score -------- */
    const primary = rec.g[0];
    const similar = cat
      .filter(r => r.slug !== rec.slug && r.g.includes(primary))
      .sort((a, b) => Math.abs(a.iq - rec.iq) - Math.abs(b.iq - rec.iq))
      .slice(0, 5);
    if (similar.length) {
      const rel = el('section', { class: 'related' });
      rel.appendChild(el('div', { class: 'sec-head' }, [
        el('h2', { text: 'In the same vein' }),
        el('span', { class: 'sec-sub', text: primary + ' · near this score' }),
      ]));
      const sg = el('div', { class: 'grid grid-poster' });
      const relCards = similar.map(r => posterCard(r));
      relCards.forEach(c => sg.appendChild(c));
      rel.appendChild(sg);
      root.appendChild(rel);
      animate(rel.querySelector('.sec-head'));
      animateStagger(relCards, { step: 70, cap: 6 });
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
  svg.setAttribute('aria-label', 'Histogram of cognitive-value scores across the catalog, forming a single, deliberately flattened hump centred on ' + stats.mean + ' with weighted tails.');

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

  // each bar is colored by the tier its Acuity Quotient falls into, so the
  // five tier bands are visible across the distribution.
  const barsByTier = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  keys.forEach(k => {
    const tier = scoreTier(k);
    const h = (hist[k] / maxCount) * plotH;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', (xFor(k) - barW / 2).toFixed(2));
    rect.setAttribute('y', (padT + plotH - h).toFixed(2));
    rect.setAttribute('width', barW.toFixed(2));
    rect.setAttribute('height', h.toFixed(2));
    rect.setAttribute('class', 'bar t' + tier);
    rect.style.fill = tierColorVar(tier);
    const tt = document.createElementNS(NS, 'title');
    tt.textContent = SCORE_LABEL + ' ' + k + ' · ' + tierOf(tier).name + ': ' + hist[k] + ' titles';
    rect.appendChild(tt);
    barsByTier[tier].push(rect);
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

  // tier legend / key — swatch + name + AQ range; click a tier to isolate its bars
  const legendHost = document.querySelector('[data-hist-legend]');
  if (legendHost) {
    legendHost.innerHTML = '';
    let activeTier = null;
    const btns = [];
    function applyActive() {
      svg.classList.toggle('has-active', activeTier != null);
      for (const tk in barsByTier) {
        const lit = (+tk === activeTier);
        barsByTier[tk].forEach(b => b.classList.toggle('lit', lit));
      }
      btns.forEach(b => {
        const on = b.tk === activeTier;
        b.el.classList.toggle('active', on);
        b.el.setAttribute('aria-pressed', String(on));
      });
    }
    [0, 1, 2, 3, 4].forEach(tk => {
      const t = tierOf(tk);
      const btn = el('button', { class: 'hist-key t' + tk, type: 'button', 'aria-pressed': 'false' }, [
        el('span', { class: 'hk-swatch', 'aria-hidden': 'true' }),
        el('span', { class: 'hk-name', text: t.name }),
        el('span', { class: 'hk-range', text: SCORE_ABBR + ' ' + t.range }),
      ]);
      btn.addEventListener('click', () => { activeTier = (activeTier === tk) ? null : tk; applyActive(); });
      btns.push({ el: btn, tk: tk });
      legendHost.appendChild(btn);
    });
  }
}

/* ----------------------------------------------------- boot ------------- */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  injectAttribution();
  loadWeightPrefs();
  const page = document.body.getAttribute('data-page');
  if (page === 'home') initHome();
  else if (page === 'explore') initExplore();
  else if (page === 'title') initTitle();
  else if (page === 'methodology') initMethodology();
  else if (page === 'kids') initKids();
  initMotion(); // observe any static `.acu-anim` blocks marked in the HTML
});
