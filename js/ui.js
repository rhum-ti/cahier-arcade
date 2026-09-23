/* ---------- DOM rendering & state ---------- */
import { loadAllVocab, LEVELS, levelName, STARTER_VOCAB, THEME_SESSIONS } from "./data.js";
import {
  buildPool, buildSessionPool, createDirectionPicker, genTranslationQuestion, baseScore,
  loadBest, saveBest, loadStreak, loadDone, markDone
} from "./game.js";

/* How many words per level enter an endless-mode pool. Keeps level progression snappy
   regardless of the underlying vocab size (see buildPool's perLevel param). */
const WORDS_PER_LEVEL = 25;

const app = document.getElementById("app");
let best = loadBest();
let streakDays = loadStreak();
let doneThemes = loadDone();
let allVocab = null;

let pool=[], chain=0, score=0, multiplier=1, locked=false, current=null;
let timerId=null, timeLimit=6000, remaining=6000;
let mode="endless", activeSession=null, lastMistake=null;
let directionPicker = createDirectionPicker();

/* ---------- Home ---------- */
function renderHome(){
  app.innerHTML = `
    <div class="screen home-screen">
      <h1 class="home-title">Le Petit Cahier — Arcade</h1>
      <p class="home-sub">Deux façons de jouer avec le vocabulaire français.</p>

      <button class="mode-card" id="cardTrad">
        <span class="emoji">🔤</span>
        <span class="txt">
          <div class="title">Traduction</div>
          <div class="desc">FR ↔ KO, difficulté progressive, jamais le même mot</div>
        </span>
      </button>

      <button class="mode-card" id="cardTheme">
        <span class="emoji">🎯</span>
        <span class="txt">
          <div class="title">Défis à thème</div>
          <div class="desc">Vocabulaire TCF Canada, classé par thème</div>
        </span>
        <span class="badge">${THEME_SESSIONS.length} défis</span>
      </button>
      <button class="back" id="creditsLink" style="align-self:center; margin-top:6px;">Crédits</button>
    </div>`;
  document.getElementById("cardTrad").onclick = goToLevelSelect;
  document.getElementById("cardTheme").onclick = renderThemeList;
  document.getElementById("creditsLink").onclick = renderCredits;
}

/* Ensures the (large, lazily-fetched) endless-mode vocab is loaded before showing level
   select, since level select leads straight into a run that needs it. */
async function goToLevelSelect(){
  if(allVocab){ renderLevelSelect(); return; }
  renderLoading();
  try{
    allVocab = [...STARTER_VOCAB, ...await loadAllVocab()];
    renderLevelSelect();
  }catch(err){
    renderLoadError(err);
  }
}

function renderLoading(){
  app.innerHTML = `
    <div class="screen stub-screen">
      <div class="stub-emoji">📖</div>
      <div class="stub-title">Chargement…</div>
      <p class="stub-text">Préparation du vocabulaire.</p>
    </div>`;
}

function renderLoadError(err){
  app.innerHTML = `
    <div class="screen stub-screen">
      <div class="stub-emoji">⚠️</div>
      <div class="stub-title">Chargement impossible</div>
      <p class="stub-text">Le vocabulaire n'a pas pu être chargé. Vérifie ta connexion et réessaie.</p>
      <div class="btn-row">
        <button class="btn3d" id="retryLoadBtn">Réessayer</button>
        <button class="back" id="backHomeBtn">Accueil</button>
      </div>
    </div>`;
  document.getElementById("retryLoadBtn").onclick = goToLevelSelect;
  document.getElementById("backHomeBtn").onclick = renderHome;
}

function renderCredits(){
  app.innerHTML = `
    <div class="screen home-screen">
      <button class="back" id="backBtn">← Retour</button>
      <h1 class="home-title" style="font-size:1.6rem; margin-top:10px;">Crédits</h1>
      <p class="home-sub">
        Le vocabulaire du mode Traduction (8000 mots) est dérivé de
        <strong>Lexique 3.83</strong> (New, Pallier, Brysbaert, Ferrand — lexique.org),
        sous licence CC BY-SA 4.0. Niveaux A1-C1 approximatifs, basés sur la fréquence
        d'usage, pas une certification CEFR officielle. Traductions coréennes générées puis
        vérifiées par relecture. Détails complets dans data/LICENSE-DATA.md.
      </p>
    </div>`;
  document.getElementById("backBtn").onclick = renderHome;
}

/* ---------- Theme list ---------- */
function renderThemeList(){
  app.innerHTML = `
    <div class="screen home-screen">
      <button class="back" id="backBtn">← Retour</button>
      <h1 class="home-title" style="font-size:1.6rem; margin-top:10px;">Défis à thème</h1>
      <p class="home-sub">Vocabulaire TCF Canada — chaque défi se joue d'une traite, une erreur y met fin.</p>
      ${THEME_SESSIONS.map(s=>`
        <button class="mode-card" data-id="${s.id}">
          <span class="emoji">${s.emoji}</span>
          <span class="txt">
            <div class="title">${s.title}</div>
            <div class="desc">${s.words.length} mots</div>
          </span>
          ${doneThemes.includes(s.id) ? '<span class="badge" style="color:var(--success-dark)">✓ Terminé</span>' : ''}
        </button>`).join("")}
    </div>`;
  document.getElementById("backBtn").onclick = renderHome;
  document.querySelectorAll(".mode-card[data-id]").forEach(b=>{
    b.onclick = ()=>{
      const session = THEME_SESSIONS.find(s=>s.id===b.dataset.id);
      startThemedRun(session);
    };
  });
}

/* ---------- Level select ---------- */
function renderLevelSelect(){
  app.innerHTML = `
    <div class="screen level-screen">
      <button class="back" id="backBtn">← Retour</button>
      <div class="lvl-title">Par quel niveau on commence ?</div>
      <p class="lvl-sub">La difficulté grimpe automatiquement ensuite — record : ${best} · 🔥 ${streakDays} jour${streakDays>1?"s":""} de suite</p>
      <div class="lvl-grid" id="lvlGrid">
        ${LEVELS.map(l=>`<button class="lvl-chip" data-lvl="${l.lvl}">${l.name}</button>`).join("")}
      </div>
    </div>`;
  document.getElementById("backBtn").onclick = renderHome;
  document.querySelectorAll(".lvl-chip").forEach(b=>{
    b.onclick = ()=>startTranslationRun(parseInt(b.dataset.lvl,10));
  });
}

/* ---------- Run ---------- */
function startTranslationRun(startLevel){
  mode="endless"; activeSession=null;
  pool = buildPool(startLevel, allVocab, 4, WORDS_PER_LEVEL);
  chain=0; score=0; multiplier=1; locked=false; lastMistake=null;
  directionPicker = createDirectionPicker();
  nextQuestion();
}

function startThemedRun(session){
  mode="theme"; activeSession=session;
  pool = buildSessionPool(session.words);
  chain=0; score=0; multiplier=1; locked=false; lastMistake=null;
  directionPicker = createDirectionPicker();
  nextQuestion();
}

function nextQuestion(){
  if(pool.length===0){ endRun(true); return; }
  const item = pool.shift();
  const sourcePool = mode==="theme" ? activeSession.words : allVocab;
  current = genTranslationQuestion(item, sourcePool, directionPicker);
  timeLimit = Math.max(3500, 9000 - chain*60);
  remaining = timeLimit;
  locked = false;
  renderRun();
  clearInterval(timerId);
  const t0 = Date.now();
  timerId = setInterval(()=>{
    remaining = timeLimit - (Date.now()-t0);
    if(remaining<=0){
      remaining=0; updateTimerBar(); clearInterval(timerId);
      if(!locked){ handleTimeout(); }
    } else { updateTimerBar(); }
  }, 60);
}

function handleTimeout(){
  locked = true;
  document.querySelectorAll(".opt").forEach(b=>{
    b.disabled = true;
    if(b.textContent===current.correct) b.classList.add("correct");
  });
  lastMistake = { dir:current.dir, word:current.word, yourAnswer:"—", correctAnswer:current.correct };
  setTimeout(()=>endRun(false), 1600);
}

function updateTimerBar(){
  const bar = document.getElementById("timerFill");
  if(!bar) return;
  const pct = Math.max(0,(remaining/timeLimit)*100);
  bar.style.width = pct+"%";
  bar.classList.toggle("urgent", pct<30);
}

function renderRun(){
  app.innerHTML = `
    <div class="screen run-screen">
      <div class="run-top">
        <div class="run-head-row">
          <span class="lvl-badge">${mode==="theme" ? activeSession.title : levelName(current.lvl)}</span>
          <span class="mult-tag">x${multiplier}</span>
        </div>
        <div class="timerbar-track"><div class="timerbar-fill" id="timerFill"></div></div>
        <div class="score-row"><span class="score-num" id="scoreNum">${score}</span></div>
      </div>
      <div class="prompt-box">
        <span class="dir-tag">${current.dir}</span>
        <span class="prompt-word">${current.word}</span>
      </div>
      <div class="options-grid" id="optionsGrid"></div>
    </div>
    <div class="combo-pop" id="comboPop"></div>`;
  const grid = document.getElementById("optionsGrid");
  current.options.forEach(opt=>{
    const b=document.createElement("button");
    b.className="opt"; b.textContent=opt;
    b.addEventListener("click", ()=>handleAnswer(opt,b));
    grid.appendChild(b);
  });
}

function handleAnswer(opt, btnEl){
  if(locked) return;
  locked=true;
  clearInterval(timerId);
  const correct = opt===current.correct;
  document.querySelectorAll(".opt").forEach(b=>{
    b.disabled=true;
    if(b.textContent===current.correct) b.classList.add("correct");
    else if(b===btnEl && !correct) b.classList.add("wrong");
  });
  if(correct){
    chain++;
    if(chain%5===0){ multiplier*=2; showCombo("COMBO x"+multiplier); }
    const base = baseScore(current.lvl);
    score += base*multiplier;
    animateScore();
    setTimeout(nextQuestion, 380);
  } else {
    lastMistake = { dir:current.dir, word:current.word, yourAnswer:opt, correctAnswer:current.correct };
    setTimeout(()=>endRun(false), 1600);
  }
}

function animateScore(){
  const el=document.getElementById("scoreNum");
  if(!el) return;
  el.textContent=score;
  el.classList.add("pop");
  setTimeout(()=>el.classList.remove("pop"),180);
}

function showCombo(text){
  const el=document.getElementById("comboPop");
  if(!el) return;
  el.classList.remove("show"); void el.offsetWidth;
  el.textContent=text; el.classList.add("show");
}

function endRun(exhausted){
  clearInterval(timerId);
  let isRecord = false;
  if(mode==="endless"){
    isRecord = score>best;
    if(isRecord){ best=score; saveBest(best); }
  }
  if(mode==="theme" && exhausted){ markDone(activeSession.id); doneThemes = loadDone(); }
  renderEnd(isRecord, exhausted);
}

function renderEnd(isRecord, exhausted){
  const themeDone = mode==="theme" && exhausted;
  let chainMsg;
  if(mode==="endless"){
    chainMsg = exhausted ? "Série sans faute jusqu'au bout — bravo !" : `Chaîne : ${chain} mot${chain>1?"s":""}`;
  } else {
    chainMsg = themeDone ? `Défi terminé : ${activeSession.title} 🎉` : `Interrompu à ${chain} / ${activeSession.words.length} mots`;
  }
  app.innerHTML = `
    <div class="screen end-screen">
      ${isRecord ? '<div class="record-banner">Nouveau record</div>' : ''}
      <p class="end-chain">${chainMsg}</p>
      ${lastMistake && !exhausted ? `
        <div class="mistake-box">
          <div class="mistake-tag">${lastMistake.dir}</div>
          <div class="mistake-word">${lastMistake.word}</div>
          <div class="mistake-rows">
            <span class="wrong-ans">${lastMistake.yourAnswer==="—" ? "Temps écoulé" : lastMistake.yourAnswer}</span>
            <span class="arrow">→</span>
            <span class="right-ans">${lastMistake.correctAnswer}</span>
          </div>
        </div>` : ''}
      <p class="end-score">${score}</p>
      ${mode==="endless" ? `<p class="best-line">Record : ${best}</p>` : ''}
      <div class="btn-row">
        <button class="btn3d" id="retryBtn">${mode==="theme" ? "Réessayer" : "Rejouer"}</button>
        <button class="back" id="backNavBtn">${mode==="theme" ? "Autres défis" : "Accueil"}</button>
      </div>
    </div>`;
  document.getElementById("retryBtn").onclick = mode==="theme" ? ()=>startThemedRun(activeSession) : renderLevelSelect;
  document.getElementById("backNavBtn").onclick = mode==="theme" ? renderThemeList : renderHome;
}

export function init(){
  renderHome();
}
