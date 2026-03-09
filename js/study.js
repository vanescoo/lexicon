// ─────────────────────────────────────────────────────────────
// Study Session — Leitner spaced-repetition card review
// ─────────────────────────────────────────────────────────────

function startStudy(cards, label) {
  studyQueue  = shuffle([...cards]);
  studyIdx    = 0;
  studyGot    = 0;
  studyMissed = 0;
  flipped     = false;

  document.getElementById('study-title').textContent        = label;
  document.getElementById('card-area').style.display        = 'block';
  document.getElementById('session-end').style.display      = 'none';
  showScreen('study');
  renderStudyCard();
}

function renderStudyCard() {
  if (studyIdx >= studyQueue.length) { endStudy(); return; }

  const card = studyQueue[studyIdx];
  flipped = false;
  document.getElementById('card-3d').classList.remove('flipped');
  document.getElementById('ans-btns').classList.remove('show');

  const pct = (studyIdx / studyQueue.length) * 100;
  document.getElementById('prog-fill').style.width    = pct + '%';
  document.getElementById('study-count').textContent  = `${studyIdx + 1} / ${studyQueue.length}`;

  const typeLabel = (card.type || 'card').replace(/_/g, ' ');
  document.getElementById('card-front').textContent = card.front;
  document.getElementById('card-back').textContent  = card.back;
  document.getElementById('type-front').textContent = typeLabel;
  document.getElementById('type-back').textContent  = typeLabel;

  let dots = '';
  for (let i = 1; i <= 5; i++) dots += `<div class="dot ${i <= card.box ? 'on' : ''}"></div>`;
  document.getElementById('box-dots').innerHTML = dots;
}

function flipCard() {
  if (flipped) return;
  flipped = true;
  document.getElementById('card-3d').classList.add('flipped');
  setTimeout(() => document.getElementById('ans-btns').classList.add('show'), 300);
}

async function answerCard(correct) {
  const card   = studyQueue[studyIdx];
  const newBox = correct ? Math.min(5, card.box + 1) : 1;
  if (correct) studyGot++; else studyMissed++;

  const now      = Date.now();
  const interval = INTERVALS[newBox] * 86400000;
  await db.collection('users').doc(currentUser.uid).collection('cards').doc(card.id).update({
    box:            newBox,
    nextReviewDate: now + interval,
    lastReviewedAt: now,
  });

  const local = allCards.find(c => c.id === card.id);
  if (local) { local.box = newBox; local.nextReviewDate = now + interval; }

  studyIdx++;
  renderStudyCard();
}

function endStudy() {
  document.getElementById('card-area').style.display   = 'none';
  document.getElementById('session-end').style.display = 'block';
  document.getElementById('sc-got').textContent        = studyGot;
  document.getElementById('sc-missed').textContent     = studyMissed;
  recomputeStats();
}

function exitStudy() {
  showScreen('dashboard');
  renderHome();
  renderCurriculum();
}
