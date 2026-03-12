import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ============================================================
   DATA
============================================================ */
const COUNTRIES = [
  { name:"France",        flag:"🇫🇷", neighbors:["Espagne","Andorre","Monaco","Italie","Suisse","Allemagne","Luxembourg","Belgique"] },
  { name:"Allemagne",     flag:"🇩🇪", neighbors:["France","Belgique","Luxembourg","Pays-Bas","Danemark","Pologne","Tchéquie","Autriche","Suisse"] },
  { name:"Espagne",       flag:"🇪🇸", neighbors:["France","Andorre","Portugal","Maroc"] },
  { name:"Italie",        flag:"🇮🇹", neighbors:["France","Monaco","Suisse","Autriche","Slovénie","Saint-Marin","Vatican"] },
  { name:"Russie",        flag:"🇷🇺", neighbors:["Norvège","Finlande","Estonie","Lettonie","Biélorussie","Ukraine","Pologne","Lituanie","Géorgie","Azerbaïdjan","Kazakhstan","Chine","Mongolie","Corée du Nord"] },
  { name:"Brésil",        flag:"🇧🇷", neighbors:["Venezuela","Guyane","Suriname","Guyana","Colombie","Pérou","Bolivie","Paraguay","Argentine","Uruguay"] },
  { name:"Chine",         flag:"🇨🇳", neighbors:["Russie","Mongolie","Kazakhstan","Kirghizistan","Tadjikistan","Afghanistan","Pakistan","Inde","Népal","Bhoutan","Myanmar","Laos","Vietnam","Corée du Nord"] },
  { name:"Inde",          flag:"🇮🇳", neighbors:["Pakistan","Chine","Népal","Bhoutan","Bangladesh","Myanmar"] },
  { name:"Mexique",       flag:"🇲🇽", neighbors:["États-Unis","Guatemala","Belize"] },
  { name:"Argentine",     flag:"🇦🇷", neighbors:["Chili","Bolivie","Paraguay","Brésil","Uruguay"] },
  { name:"Maroc",         flag:"🇲🇦", neighbors:["Espagne","Algérie","Mauritanie"] },
  { name:"Égypte",        flag:"🇪🇬", neighbors:["Libye","Soudan","Israël","Palestine"] },
  { name:"Nigeria",       flag:"🇳🇬", neighbors:["Bénin","Niger","Tchad","Cameroun"] },
  { name:"Turquie",       flag:"🇹🇷", neighbors:["Grèce","Bulgarie","Géorgie","Arménie","Azerbaïdjan","Iran","Irak","Syrie"] },
  { name:"Iran",          flag:"🇮🇷", neighbors:["Turquie","Irak","Arménie","Azerbaïdjan","Turkménistan","Afghanistan","Pakistan"] },
  { name:"Pologne",       flag:"🇵🇱", neighbors:["Allemagne","Tchéquie","Slovaquie","Ukraine","Biélorussie","Lituanie","Russie"] },
  { name:"Suisse",        flag:"🇨🇭", neighbors:["France","Allemagne","Autriche","Liechtenstein","Italie"] },
  { name:"Autriche",      flag:"🇦🇹", neighbors:["Allemagne","Tchéquie","Slovaquie","Hongrie","Slovénie","Italie","Suisse","Liechtenstein"] },
  { name:"Afrique du Sud",flag:"🇿🇦", neighbors:["Namibie","Botswana","Zimbabwe","Mozambique","Eswatini","Lesotho"] },
  { name:"Pérou",         flag:"🇵🇪", neighbors:["Équateur","Colombie","Brésil","Bolivie","Chili"] }
];

/* ============================================================
   STATE
============================================================ */
let difficulty = 'easy';   // easy=120s  medium=90s  hard=60s
let timeMax    = 90;
let totalRounds= 5;
let round      = 0;
let totalScore = 0;
let currentCountry = null;
let foundNeighbors = [];
let usedCountries  = [];
let timerInterval  = null;
let timeLeft       = 90;
let hintUsed       = false;

/* ============================================================
   DIFFICULTY
============================================================ */
function setDiff(btn, diff) {
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  difficulty = diff;
  timeMax = diff === 'easy' ? 120 : diff === 'medium' ? 90 : 60;
}

/* ============================================================
   SCREENS
============================================================ */
function show(id) {
  ['screen-home','screen-game','screen-round-end','screen-result'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.classList.remove('fadein');
  void el.offsetWidth; // reflow
  el.classList.add('fadein');
}

/* ============================================================
   FIREBASE SETUP
============================================================ */


const firebaseConfig = {
  apiKey: "AIzaSyCUAX4KHrzFjULBUkhiH-XEU2mb3lB7q4E",
  authDomain: "devine-pays-voisin.firebaseapp.com",
  projectId: "devine-pays-voisin",
  storageBucket: "devine-pays-voisin.firebasestorage.app",
  messagingSenderId: "369727800455",
  appId: "1:369727800455:web:dd3ff9a4879b24f1f36422"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

/* ============================================================
   LEADERBOARD (Firestore — classement global partagé)
============================================================ */
async function renderLeaderboard(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = '<div class="lb-empty">Chargement...</div>';
  try {
    const q = query(collection(db, "scores"), orderBy("score", "desc"), limit(8));
    const snap = await getDocs(q);
    if (snap.empty) {
      el.innerHTML = '<div class="lb-empty">Aucun score encore — soyez le premier !</div>';
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = snap.docs.map((doc, i) => {
      const d = doc.data();
      return `
        <div class="lb-row">
          <div class="medal-ico">${medals[i] || (i+1)}</div>
          <div class="name">${d.name}</div>
          <div class="pts">${d.score} pts</div>
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="lb-empty">Erreur de chargement du classement.</div>';
  }
}

/* ============================================================
   NORMALIZE
============================================================ */
function norm(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

/* ============================================================
   GAME LOGIC
============================================================ */
function goHome() {
  renderLeaderboard('lb-home-list');
  show('screen-home');
}

function startGame() {
  round = 0;
  totalScore = 0;
  usedCountries = [];
  nextRound();
}

function pickCountry() {
  const avail = COUNTRIES.filter(c => !usedCountries.includes(c.name));
  return avail[Math.floor(Math.random() * avail.length)];
}

function nextRound() {
  round++;
  if (round > totalRounds) { showResult(); return; }

  currentCountry = pickCountry();
  usedCountries.push(currentCountry.name);
  foundNeighbors = [];
  hintUsed = false;
  timeLeft = timeMax;

  // Update UI
  document.getElementById('round-label').textContent = `MANCHE ${round}/${totalRounds}`;
  document.getElementById('score-label').textContent  = `⭐ ${totalScore} pts`;
  document.getElementById('flag-display').textContent = currentCountry.flag;
  document.getElementById('country-name').textContent = currentCountry.name;
  document.getElementById('guess-input').value = '';
  document.getElementById('hint-text').textContent = 'cliquez pour un indice';
  updateProgress();
  renderChips();
  updateTimerBar();

  const card = document.getElementById('country-card');
  card.classList.remove('correct','wrong');

  show('screen-game');
  setTimeout(() => document.getElementById('guess-input').focus(), 150);

  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 1000);
}

function tick() {
  timeLeft--;
  updateTimerBar();
  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    showRoundEnd();
  }
}

function updateTimerBar() {
  const bar  = document.getElementById('timer-bar');
  const text = document.getElementById('timer-text');
  const pct  = (timeLeft / timeMax) * 100;
  bar.style.width = pct + '%';
  if (pct > 50)      bar.style.background = 'var(--green)';
  else if (pct > 25) bar.style.background = '#facc15';
  else               bar.style.background = 'var(--accent2)';
  text.textContent = timeLeft + 's';
  // pulse red when low
  text.style.color = timeLeft <= 10 ? 'var(--accent2)' : 'var(--muted)';
}

function updateProgress() {
  document.getElementById('progress-text').textContent =
    `${foundNeighbors.length}/${currentCountry.neighbors.length} voisins trouvés`;
  document.getElementById('score-label').textContent = `⭐ ${totalScore} pts`;
}

function renderChips() {
  const c = document.getElementById('chips-container');
  c.innerHTML = currentCountry.neighbors.map(n => {
    const f = foundNeighbors.includes(n);
    return `<div class="chip ${f ? 'found' : ''}">${f ? '✓ '+n : '?'}</div>`;
  }).join('');
}

function submitGuess() {
  const input = document.getElementById('guess-input');
  const val   = input.value.trim();
  if (!val) return;

  const match = currentCountry.neighbors.find(n => norm(n) === norm(val));

  if (match && !foundNeighbors.includes(match)) {
    // ✅ Correct
    foundNeighbors.push(match);
    const bonus = difficulty === 'hard' ? 2 : 1;
    totalScore += bonus;
    updateProgress();
    renderChips();

    const card = document.getElementById('country-card');
    card.classList.add('correct');
    setTimeout(() => card.classList.remove('correct'), 500);

    if (foundNeighbors.length === currentCountry.neighbors.length) {
      clearInterval(timerInterval);
      // Bonus time: +5 pts for all found
      totalScore += 5;
      setTimeout(() => showRoundEnd(), 700);
    }
  } else {
    // ❌ Wrong
    const inp = document.getElementById('guess-input');
    inp.classList.add('shake');
    setTimeout(() => inp.classList.remove('shake'), 450);
    const card = document.getElementById('country-card');
    card.classList.add('wrong');
    setTimeout(() => card.classList.remove('wrong'), 400);
  }

  input.value = '';
  input.focus();
}

function showHint() {
  const remaining = currentCountry.neighbors.filter(n => !foundNeighbors.includes(n));
  if (!remaining.length) return;
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  // Show first 2 letters + length hint
  const hint = pick.slice(0,2).toUpperCase() + '... (' + pick.length + ' lettres)';
  document.getElementById('hint-text').textContent = hint;
  // Small penalty on hard mode
  if (difficulty === 'hard') totalScore = Math.max(0, totalScore - 1);
}

/* ============================================================
   ROUND END
============================================================ */
function showRoundEnd() {
  const missed = currentCountry.neighbors.filter(n => !foundNeighbors.includes(n));

  document.getElementById('re-flag').textContent        = currentCountry.flag;
  document.getElementById('re-country-name').textContent = currentCountry.name;
  document.getElementById('re-sub').textContent          = `Manche ${round}/${totalRounds}`;
  document.getElementById('re-score').textContent        = `Score total : ${totalScore} pts`;

  document.getElementById('re-found').innerHTML = foundNeighbors.length
    ? foundNeighbors.map(n => `<span class="re-chip-ok">✓ ${n}</span>`).join('')
    : '<span style="color:var(--muted);font-size:13px">Aucun</span>';

  const missedCard = document.getElementById('re-missed-card');
  if (missed.length) {
    missedCard.style.display = '';
    document.getElementById('re-missed').innerHTML = missed.map(n => `<span class="re-chip-miss">✗ ${n}</span>`).join('');
  } else {
    missedCard.style.display = 'none';
  }

  const btnNext = document.getElementById('btn-next');
  if (round >= totalRounds) {
    btnNext.textContent = '🏆 VOIR LES RÉSULTATS';
  } else {
    btnNext.textContent = 'MANCHE SUIVANTE →';
  }

  show('screen-round-end');
}

/* ============================================================
   RESULTS
============================================================ */
function showResult() {
  const score = totalScore;
  let medal, msg;
  if (score >= 30) { medal='🥇'; msg='Géographe en chef !'; }
  else if (score >= 20) { medal='🥈'; msg='Excellent géographe !'; }
  else if (score >= 10) { medal='🥉'; msg='Pas mal du tout !'; }
  else { medal='🌍'; msg='Continue à explorer le monde !'; }

  document.getElementById('result-medal').textContent = medal;
  document.getElementById('result-msg').textContent   = msg;
  document.getElementById('result-score').textContent = score;
  document.getElementById('player-name').value        = '';

  renderLeaderboard('lb-result-list');
  show('screen-result');
}

async function saveScore() {
  const name = document.getElementById('player-name').value.trim();
  if (!name) { alert('Entrez votre prénom !'); return; }
  const btn = document.querySelector('.btn-save');
  btn.textContent = '⏳ Envoi...';
  btn.disabled = true;
  try {
    await addDoc(collection(db, "scores"), {
      name,
      score: totalScore,
      date: new Date().toLocaleDateString('fr-FR'),
      ts: Date.now()
    });
    document.getElementById('player-name').disabled = true;
    btn.textContent = '✅ Sauvegardé !';
    btn.style.opacity = '0.6';
    renderLeaderboard('lb-result-list');
  } catch(e) {
    btn.textContent = '❌ Erreur, réessayez';
    btn.disabled = false;
  }
}

/* ============================================================
   KEYBOARD
============================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const gameVisible = !document.getElementById('screen-game').classList.contains('hidden');
    if (gameVisible) submitGuess();
  }
});

/* ============================================================
   EXPOSE TO WINDOW (needed for inline onclick with type=module)
============================================================ */
window.setDiff      = setDiff;
window.startGame    = startGame;
window.nextRound    = nextRound;
window.submitGuess  = submitGuess;
window.showHint     = showHint;
window.saveScore    = saveScore;
window.goHome       = async function() {
  await renderLeaderboard('lb-home-list');
  show('screen-home');
};

/* ============================================================
   INIT
============================================================ */
renderLeaderboard('lb-home-list');
