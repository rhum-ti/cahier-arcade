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

/* Generic finite-session pool builder (for themed "défis"): same mechanics,
   but draws from an exact word list rather than the endless leveled pool. */
export function buildSessionPool(words){ return shuffle(words.map(w=>({...w, lvl:w.lvl ?? 2}))); }

/* ---------- Storage ---------- */
export const STORE_BEST = "cahierarcade_trad_best";
export const STORE_STREAK = "cahierarcade_streak";
export const STORE_DONE = "cahierarcade_theme_done";

export function loadBest(){ try{ return parseInt(localStorage.getItem(STORE_BEST)||"0",10); }catch(e){ return 0; } }
export function saveBest(v){ try{ localStorage.setItem(STORE_BEST, String(v)); }catch(e){} }

export function loadStreak(){
  try{
    const raw = localStorage.getItem(STORE_STREAK);
    const data = raw ? JSON.parse(raw) : {count:0,last:null};
    const today = new Date().toISOString().slice(0,10);
    if(data.last===today) return data.count;
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
    data.count = (data.last===yesterday) ? data.count+1 : 1;
    data.last = today;
    localStorage.setItem(STORE_STREAK, JSON.stringify(data));
    return data.count;
  }catch(e){ return 1; }
}

export function loadDone(){ try{ return JSON.parse(localStorage.getItem(STORE_DONE)||"[]"); }catch(e){ return []; } }
export function markDone(id){
  try{
    const done = loadDone();
    if(!done.includes(id)){ done.push(id); localStorage.setItem(STORE_DONE, JSON.stringify(done)); }
  }catch(e){}
}
