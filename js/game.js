/* ---------- Pure game logic (no DOM) ---------- */

export function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

export function sample(arr,n){ return shuffle(arr).slice(0,n); }

/* perLevel caps how many words from each level enter the pool. Without a cap, a level with
   thousands of words (e.g. the full frequency-based vocab) would have to be fully exhausted
   before the run ever advances to the next level — perLevel keeps level progression snappy
   regardless of how large the underlying word list is. */
export function buildPool(startLevel, vocab, maxLevel=4, perLevel=null){
  const pool=[];
  for(let lvl=startLevel; lvl<=maxLevel; lvl++){
    const levelWords = vocab.filter(v=>v.lvl===lvl);
    pool.push(...(perLevel==null ? shuffle(levelWords) : sample(levelWords, perLevel)));
  }
  return pool;
}

/* Avoids the same translation direction three times in a row. */
export function createDirectionPicker(){
  let lastToKorean = null, sameDirStreak = 0;
  return {
    pick(){
      let toKorean;
      if(sameDirStreak>=2){ toKorean = !lastToKorean; }
      else { toKorean = Math.random()<0.5; }
      sameDirStreak = (lastToKorean===toKorean) ? sameDirStreak+1 : 1;
      lastToKorean = toKorean;
      return toKorean;
    },
    reset(){ lastToKorean=null; sameDirStreak=0; }
  };
}

export function pickDistractorPool(item, sourcePool){
  let candidates = sourcePool.filter(v=>v.lvl===item.lvl && v.ko!==item.ko && v.fr!==item.fr);
  if(candidates.length<3){
    candidates = sourcePool.filter(v=>Math.abs(v.lvl-item.lvl)<=1 && v.ko!==item.ko && v.fr!==item.fr);
  }
  if(candidates.length<3){
    candidates = sourcePool.filter(v=>v.ko!==item.ko && v.fr!==item.fr);
  }
  return candidates;
}

export function genTranslationQuestion(item, sourcePool, directionPicker){
  const toKorean = directionPicker.pick();
  const candidates = pickDistractorPool(item, sourcePool);
  if(toKorean){
    const distractors = sample(candidates,3).map(v=>v.ko);
    return { dir:"FR → KO", word:item.fr, options:shuffle([item.ko,...distractors]), correct:item.ko, lvl:item.lvl };
  }
  const distractors = sample(candidates,3).map(v=>v.fr);
  return { dir:"KO → FR", word:item.ko, options:shuffle([item.fr,...distractors]), correct:item.fr, lvl:item.lvl };
}

/* Points awarded for a correct answer at a given level, before the combo multiplier.
   +2 (not +1) so the lowest playable level (Débutant, lvl:-1) still scores above zero. */
export function baseScore(lvl){ return (lvl+2)*10; }

/* Generic finite-session pool builder (for themed "défis"): same mechanics,
   but draws from an exact word list rather than the endless leveled pool. */
export function buildSessionPool(words){ return shuffle(words.map(w=>({...w, lvl:w.lvl ?? 2}))); }

/* ---------- Storage ---------- */
export const STORE_BEST = "cahierarcade_trad_best";
export const STORE_STREAK = "cahierarcade_streak";
export const STORE_DONE = "cahierarcade_theme_done";

export function loadBest(){ try{ return parseInt(localStorage.getItem(STORE_BEST)||"0",10); }catch(e){ return 0; } }
export function saveBest(v){ try{ localStorage.setItem(STORE_BEST, String(v)); }catch(e){} }

/* localStorage is trusted for shape but not for type: a hand-edited or corrupted value
   (via devtools, or an old format from a future version of this app) must never come back
   out as something other than the type the caller expects — count is always a finite
   number here, never whatever raw value happened to be stored, since callers interpolate
   it straight into innerHTML with no further check. */
export function loadStreak(){
  try{
    const raw = localStorage.getItem(STORE_STREAK);
    const parsed = raw ? JSON.parse(raw) : {};
    const count = Number.isFinite(parsed.count) ? parsed.count : 0;
    const last = typeof parsed.last==="string" ? parsed.last : null;
    const today = new Date().toISOString().slice(0,10);
    if(last===today) return count;
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
    const nextCount = (last===yesterday) ? count+1 : 1;
    localStorage.setItem(STORE_STREAK, JSON.stringify({count:nextCount, last:today}));
    return nextCount;
  }catch(e){ return 1; }
}

export function loadDone(){
  try{
    const parsed = JSON.parse(localStorage.getItem(STORE_DONE)||"[]");
    return Array.isArray(parsed) ? parsed.filter(x=>typeof x==="string") : [];
  }catch(e){ return []; }
}
export function markDone(id){
  try{
    const done = loadDone();
    if(!done.includes(id)){ done.push(id); localStorage.setItem(STORE_DONE, JSON.stringify(done)); }
  }catch(e){}
}

/* ---------- Local leaderboard (per-device, no server — like an arcade cabinet's own
   high-score table) ---------- */
export const STORE_LEADERBOARD = "cahierarcade_leaderboard";
const LEADERBOARD_MAX = 10;

export function loadLeaderboard(){
  try{
    const parsed = JSON.parse(localStorage.getItem(STORE_LEADERBOARD)||"[]");
    if(!Array.isArray(parsed)) return [];
    // ui.js renders .name and .score straight into innerHTML with no further check —
    // reject any entry that isn't shaped the way this module itself ever writes one.
    return parsed.filter(e => e && typeof e.name==="string" && Number.isFinite(e.score));
  }catch(e){ return []; }
}
export function saveLeaderboard(entries){
  try{ localStorage.setItem(STORE_LEADERBOARD, JSON.stringify(entries)); }catch(e){}
}

export function qualifiesForLeaderboard(score, entries, maxEntries=LEADERBOARD_MAX){
  if(score<=0) return false;
  if(entries.length<maxEntries) return true;
  return score>Math.min(...entries.map(e=>e.score));
}

/* Pure: returns a new, sorted, capped entry list rather than mutating — the caller
   (ui.js) is responsible for persisting it via saveLeaderboard. */
export function withLeaderboardEntry(entries, name, score, maxEntries=LEADERBOARD_MAX){
  const cleanName = (name||"").trim().slice(0,12) || "???";
  const next = [...entries, { name:cleanName, score, date:new Date().toISOString().slice(0,10) }];
  next.sort((a,b)=>b.score-a.score);
  return next.slice(0,maxEntries);
}

/* Player-supplied text (the leaderboard pseudo) ends up interpolated into innerHTML
   elsewhere in the app — unlike the developer-authored vocab data, this needs escaping. */
export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
