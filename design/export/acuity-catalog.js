// Acuity — canonical catalog module (single source of truth).
// Schema matches DATA.md: n, year, type, g, iq, cog, edu, ent, tier, rating, votes, slug, svc, p, kids, rationale.
// Drop-in: if ./data/catalog.json exists it is used; otherwise the embedded SAMPLE renders.

export const TIERS = [
  { name: 'Idle',     color: '#c66a86' }, // 0
  { name: 'Ambient',  color: '#6a6580' }, // 1
  { name: 'Engaging', color: '#6f63c4' }, // 2
  { name: 'Absorbing',color: '#8a78ff' }, // 3
  { name: 'Profound', color: '#b9acff' }  // 4
];
// Tier bands by IQ (DATA.md): 4>=130, 3=115-129, 2=85-114, 1=70-84, 0<70.
export function tierFromIq(iq){ return iq>=130?4 : iq>=115?3 : iq>=85?2 : iq>=70?1 : 0; }
export function tierName(t){ return (TIERS[t]||TIERS[0]).name; }
export function tierColor(t){ return (TIERS[t]||TIERS[0]).color; }

export const TIER_BLURB = [
  'Comfort viewing — easy on the mind, light on returns.',
  'Fine to have on, but it asks little and leaves little.',
  'Solid, watchable, and a cut above the autoplay feed.',
  'Pulls you in and gives plenty back; worth a deliberate evening.',
  'Among the highest cognitive value in the catalog — it rewards full attention.'
];

export function makeSlug(n, year){
  return n.toLowerCase().replace(/['\u2019]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') + '-' + year;
}
// Overall score calibration (sample data only; real catalog.json ships iq precomputed).
export function calibIq(cog, edu, ent){
  const raw = 0.45*cog + 0.30*edu + 0.25*ent;          // 0..100, Depth-led
  return Math.max(40, Math.min(176, Math.round(100 + (raw - 60) * 1.05)));
}
// Content-rating -> minimum recommended age (for the "suitable for age" filter).
export function certAge(cert){
  if(['G','TV-Y','TV-G','TV-Y7'].includes(cert)) return 6;
  if(['PG','TV-PG'].includes(cert)) return 8;
  if(['PG-13','TV-14'].includes(cert)) return 13;
  if(['R','TV-MA','NC-17'].includes(cert)) return 17;
  return 18;
}

export const MAJOR_SERVICES = ['Netflix','Prime Video','Max','Hulu','Disney+','Apple TV+'];
export const EXTRA_SERVICES = ['Peacock','Paramount+','Tubi','Criterion','MUBI','Starz','AMC+','BritBox'];

// ---- TMDB poster resolution (hotlinked, never stored) ----
const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4NjE3NWE0N2IzY2FhZjExZjMyMWVjNTYxYmQwNjQzZSIsIm5iZiI6MTc4MjA1ODEwMy43OTEwMDAxLCJzdWIiOiI2YTM4MGM3NzZkMDU0MjUxZjgyODRlMTciLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.CPqBPrUXZ-2Sa7HEtFdf5mKQttd6g1mSm2nG0CabcNs';
const PCACHE_KEY = 'acuity_posters_v1';
let _pcache = null;
function pcache(){ if(_pcache) return _pcache; try { _pcache = JSON.parse(localStorage.getItem(PCACHE_KEY) || '{}'); } catch(e){ _pcache = {}; } return _pcache; }
function savePcache(){ try { localStorage.setItem(PCACHE_KEY, JSON.stringify(_pcache)); } catch(e){} }
export function tmdbImg(path, size){ return path ? ('https://image.tmdb.org/t/p/' + (size||'w342') + path) : null; }

export async function resolvePoster(rec){
  if(rec.p) return tmdbImg(rec.p);
  const c = pcache();
  if(Object.prototype.hasOwnProperty.call(c, rec.slug)) return c[rec.slug];
  let full = null;
  try {
    const kind = rec.type === 'film' ? 'movie' : 'tv';
    const url = 'https://api.themoviedb.org/3/search/' + kind + '?query=' + encodeURIComponent(rec.n) + '&include_adult=false';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + TMDB_TOKEN, accept: 'application/json' } });
    const j = await res.json();
    if(j && j.results && j.results.length){
      const yr = String(rec.year);
      const hit = j.results.find(r => (r.release_date || r.first_air_date || '').startsWith(yr)) || j.results[0];
      full = hit && hit.poster_path ? tmdbImg(hit.poster_path) : null;
    }
  } catch(e){ full = null; }
  c[rec.slug] = full; savePcache();
  return full;
}

// Normalize a raw record into the full schema (fills iq/tier/slug/derived fields).
export function normalize(r){
  const cog = r.cog, edu = r.edu, ent = r.ent;
  const iq = (r.iq != null) ? r.iq : calibIq(cog, edu, ent);
  const tier = (r.tier != null) ? r.tier : tierFromIq(iq);
  return Object.assign({}, r, {
    iq, tier,
    slug: r.slug || makeSlug(r.n, r.year),
    minAge: certAge(r.cert),
    svc: r.svc || []
  });
}

export async function loadCatalog(){
  try {
    const res = await fetch('./data/catalog.json', { cache: 'no-store' });
    if(res.ok){
      const arr = await res.json();
      if(Array.isArray(arr) && arr.length) return arr.map(normalize);
    }
  } catch(e){ /* fall through to sample */ }
  return SAMPLE.map(normalize);
}

// ---- Embedded representative sample (real schema; stands in for catalog.json) ----
export const SAMPLE = [
  { n:'The Wire', year:2002, type:'series', g:['Crime','Drama'], cog:98, edu:92, ent:96, rating:9.3, votes:380000, cert:'TV-MA', kids:false, svc:['Max'],
    rationale:"The Wire treats a city as a system and refuses to let any one season stand in for the whole. It asks you to hold dozens of threads — institutions, not just characters — and rewards that patience with the most complete portrait of urban America on television. Depth and craft both sit near the ceiling because nothing is wasted and nothing is simplified." },
  { n:'Chernobyl', year:2019, type:'series', g:['Drama','History'], cog:95, edu:96, ent:92, rating:9.3, votes:920000, cert:'TV-MA', kids:false, svc:['Max'],
    rationale:"Chernobyl turns a procedural about a reactor failure into an argument about the cost of lies. Its Knowledge score is among the highest in the catalog — you leave understanding RBMK design, radiation, and Soviet bureaucracy — and it never sacrifices tension to teach. The craft is exact: every frame is doing work." },
  { n:'2001: A Space Odyssey', year:1968, type:'film', g:['Sci-Fi','Adventure'], cog:97, edu:88, ent:97, rating:8.3, votes:720000, cert:'G', kids:false, svc:['Max'] },
  { n:'Severance', year:2022, type:'series', g:['Sci-Fi','Thriller','Drama'], cog:96, edu:84, ent:95, rating:8.7, votes:290000, cert:'TV-MA', kids:false, svc:['Apple TV+'],
    rationale:"Severance takes a premise that could have been a gimmick — surgically splitting your work self from your home self — and treats it as a serious question about consent and grief. It trusts you to sit in ambiguity for whole episodes, which is why its cognitive load runs so high. The symmetry and silence carry meaning rather than decorate it." },
  { n:'Oppenheimer', year:2023, type:'film', g:['Biography','Drama','History'], cog:90, edu:86, ent:92, rating:8.3, votes:870000, cert:'R', kids:false, svc:['Prime Video'] },
  { n:'Arrival', year:2016, type:'film', g:['Sci-Fi','Drama','Mystery'], cog:92, edu:82, ent:90, rating:7.9, votes:800000, cert:'PG-13', kids:false, svc:['Hulu','Prime Video'] },
  { n:'Breaking Bad', year:2008, type:'series', g:['Crime','Drama','Thriller'], cog:90, edu:72, ent:92, rating:9.5, votes:2200000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Mad Men', year:2007, type:'series', g:['Drama'], cog:86, edu:78, ent:90, rating:8.7, votes:250000, cert:'TV-14', kids:false, svc:['Prime Video','Netflix'] },
  { n:'Succession', year:2018, type:'series', g:['Drama','Comedy'], cog:87, edu:72, ent:92, rating:8.9, votes:230000, cert:'TV-MA', kids:false, svc:['Max'] },
  { n:'Better Call Saul', year:2015, type:'series', g:['Crime','Drama'], cog:85, edu:72, ent:90, rating:9.0, votes:650000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'The Bear', year:2022, type:'series', g:['Comedy','Drama'], cog:84, edu:70, ent:90, rating:8.6, votes:230000, cert:'TV-MA', kids:false, svc:['Hulu','Disney+'] },
  { n:'Dark', year:2017, type:'series', g:['Sci-Fi','Mystery','Thriller'], cog:88, edu:74, ent:86, rating:8.7, votes:470000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Andor', year:2022, type:'series', g:['Sci-Fi','Action','Drama'], cog:85, edu:76, ent:88, rating:8.4, votes:230000, cert:'TV-14', kids:false, svc:['Disney+'] },
  { n:'The Leftovers', year:2014, type:'series', g:['Drama','Mystery','Fantasy'], cog:89, edu:70, ent:90, rating:8.5, votes:130000, cert:'TV-MA', kids:false, svc:['Max'] },
  { n:'True Detective', year:2014, type:'series', g:['Crime','Drama','Mystery'], cog:82, edu:68, ent:88, rating:8.9, votes:660000, cert:'TV-MA', kids:false, svc:['Max'] },
  { n:'Planet Earth II', year:2016, type:'series', g:['Documentary'], cog:80, edu:95, ent:96, rating:9.5, votes:160000, cert:'TV-G', kids:true, svc:['Max','Netflix','BritBox'] },
  { n:'Cosmos', year:1980, type:'series', g:['Documentary'], cog:84, edu:96, ent:88, rating:9.3, votes:22000, cert:'TV-PG', kids:true, svc:['Disney+'] },
  { n:"Schindler's List", year:1993, type:'film', g:['Biography','Drama','History'], cog:94, edu:90, ent:97, rating:9.0, votes:1500000, cert:'R', kids:false, svc:['Prime Video'],
    rationale:"Schindler's List earns its craft score the honest way: every formal choice is load-bearing. The black-and-white isn't nostalgia, it's distance; the handheld camera isn't style, it's witness. It refuses the easy redemption arc, sitting with complicity and luck instead of resolving them — so you leave understanding how ordinary machinery enables atrocity." },
  { n:'Spirited Away', year:2001, type:'film', g:['Animation','Adventure','Fantasy'], cog:86, edu:74, ent:97, rating:8.6, votes:880000, cert:'PG', kids:true, svc:['Max'] },
  { n:'The Last Dance', year:2020, type:'series', g:['Documentary','Sport','Biography'], cog:78, edu:82, ent:90, rating:9.1, votes:130000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Band of Brothers', year:2001, type:'series', g:['War','Drama','History'], cog:84, edu:82, ent:92, rating:9.4, votes:540000, cert:'TV-MA', kids:false, svc:['Max'] },
  { n:'Blade Runner 2049', year:2017, type:'film', g:['Sci-Fi','Drama','Mystery'], cog:88, edu:76, ent:95, rating:8.0, votes:720000, cert:'R', kids:false, svc:['Netflix'] },
  { n:'Parasite', year:2019, type:'film', g:['Thriller','Drama','Comedy'], cog:90, edu:80, ent:94, rating:8.5, votes:1000000, cert:'R', kids:false, svc:['Hulu'] },
  { n:'The Sopranos', year:1999, type:'series', g:['Crime','Drama'], cog:91, edu:78, ent:93, rating:9.2, votes:480000, cert:'TV-MA', kids:false, svc:['Max'] },
  { n:'Fleabag', year:2016, type:'series', g:['Comedy','Drama'], cog:82, edu:70, ent:90, rating:8.7, votes:200000, cert:'TV-MA', kids:false, svc:['Prime Video'] },
  { n:'Twin Peaks', year:1990, type:'series', g:['Drama','Mystery','Crime'], cog:86, edu:66, ent:88, rating:8.6, votes:230000, cert:'TV-14', kids:false, svc:['Paramount+'] },
  { n:"The Queen's Gambit", year:2020, type:'series', g:['Drama'], cog:78, edu:72, ent:90, rating:8.5, votes:600000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Interstellar', year:2014, type:'film', g:['Sci-Fi','Adventure','Drama'], cog:88, edu:80, ent:92, rating:8.7, votes:2200000, cert:'PG-13', kids:false, svc:['Prime Video','Paramount+'] },
  { n:'No Country for Old Men', year:2007, type:'film', g:['Crime','Thriller','Drama'], cog:86, edu:70, ent:93, rating:8.2, votes:1000000, cert:'R', kids:false, svc:['Prime Video'] },
  { n:'The Social Network', year:2010, type:'film', g:['Biography','Drama'], cog:82, edu:74, ent:90, rating:7.8, votes:800000, cert:'PG-13', kids:false, svc:['Netflix'] },
  { n:'Spider-Man: Into the Spider-Verse', year:2018, type:'film', g:['Animation','Action','Adventure'], cog:80, edu:68, ent:96, rating:8.4, votes:700000, cert:'PG', kids:true, svc:['Netflix'] },
  { n:'Frozen', year:2013, type:'film', g:['Animation','Family','Musical'], cog:58, edu:52, ent:82, rating:7.4, votes:680000, cert:'PG', kids:true, svc:['Disney+'] },
  { n:'Bluey', year:2018, type:'series', g:['Animation','Family','Comedy'], cog:72, edu:80, ent:86, rating:9.5, votes:25000, cert:'TV-Y', kids:true, svc:['Disney+'] },
  { n:'The Office', year:2005, type:'series', g:['Comedy'], cog:55, edu:48, ent:70, rating:9.0, votes:700000, cert:'TV-14', kids:false, svc:['Peacock'] },
  { n:'Friends', year:1994, type:'series', g:['Comedy','Romance'], cog:48, edu:40, ent:72, rating:8.9, votes:1100000, cert:'TV-14', kids:false, svc:['Max'] },
  { n:'Stranger Things', year:2016, type:'series', g:['Sci-Fi','Horror','Fantasy'], cog:64, edu:52, ent:84, rating:8.7, votes:1400000, cert:'TV-14', kids:false, svc:['Netflix'] },
  { n:'The Mandalorian', year:2019, type:'series', g:['Sci-Fi','Action','Adventure'], cog:60, edu:54, ent:86, rating:8.6, votes:560000, cert:'TV-14', kids:true, svc:['Disney+'] },
  { n:'Wednesday', year:2022, type:'series', g:['Comedy','Horror','Mystery'], cog:52, edu:46, ent:76, rating:8.1, votes:410000, cert:'TV-14', kids:true, svc:['Netflix'] },
  { n:'Emily in Paris', year:2020, type:'series', g:['Comedy','Romance','Drama'], cog:32, edu:28, ent:52, rating:6.9, votes:110000, cert:'TV-MA', kids:false, svc:['Netflix'],
    rationale:"Emily in Paris is engineered for frictionlessness, and the score reads exactly that. Conflicts resolve within a scene; the city, the work, and the relationships are postcards rather than perspectives. Craft carries the number almost single-handedly — competence in the service of comfort rather than ambition." },
  { n:'The Bachelor', year:2002, type:'series', g:['Romance'], cog:24, edu:22, ent:46, rating:3.9, votes:14000, cert:'TV-14', kids:false, svc:['Hulu'] },
  { n:'Selling Sunset', year:2019, type:'series', g:['Documentary'], cog:22, edu:24, ent:44, rating:5.4, votes:12000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Top Gun: Maverick', year:2022, type:'film', g:['Action','Drama'], cog:56, edu:48, ent:88, rating:8.2, votes:750000, cert:'PG-13', kids:false, svc:['Prime Video','Paramount+'] },
  { n:'Dune', year:2021, type:'film', g:['Sci-Fi','Adventure','Drama'], cog:82, edu:74, ent:94, rating:8.0, votes:850000, cert:'PG-13', kids:false, svc:['Max'] },
  { n:'Toy Story', year:1995, type:'film', g:['Animation','Family','Comedy'], cog:70, edu:60, ent:92, rating:8.3, votes:1100000, cert:'G', kids:true, svc:['Disney+'] },
  { n:'Avatar', year:2009, type:'film', g:['Sci-Fi','Action','Adventure'], cog:58, edu:56, ent:88, rating:7.9, votes:1400000, cert:'PG-13', kids:false, svc:['Disney+'] },
  { n:'Game of Thrones', year:2011, type:'series', g:['Fantasy','Drama','Adventure'], cog:76, edu:64, ent:90, rating:9.2, votes:2300000, cert:'TV-MA', kids:false, svc:['Max'] },
  { n:'The Crown', year:2016, type:'series', g:['Biography','Drama','History'], cog:74, edu:78, ent:88, rating:8.6, votes:230000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Apollo 13', year:1995, type:'film', g:['Drama','History','Adventure'], cog:72, edu:80, ent:88, rating:7.7, votes:300000, cert:'PG', kids:true, svc:['Starz'] },
  { n:'Moonlight', year:2016, type:'film', g:['Drama'], cog:84, edu:72, ent:92, rating:7.4, votes:340000, cert:'R', kids:false, svc:['Netflix','MUBI'] },
  { n:'Sherlock', year:2010, type:'series', g:['Crime','Drama','Mystery'], cog:80, edu:62, ent:88, rating:9.1, votes:980000, cert:'TV-14', kids:false, svc:['BritBox'] },
  { n:'Black Mirror', year:2011, type:'series', g:['Sci-Fi','Drama','Thriller'], cog:84, edu:70, ent:84, rating:8.7, votes:680000, cert:'TV-MA', kids:false, svc:['Netflix'] },
  { n:'Ted Lasso', year:2020, type:'series', g:['Comedy','Drama','Sport'], cog:58, edu:54, ent:84, rating:8.8, votes:380000, cert:'TV-MA', kids:false, svc:['Apple TV+'] }
];
