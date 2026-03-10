// ─────────────────────────────────────────────────────────────
// Typing Practice — active recall by typing translations
//
// Pool  : all cards with box ≥ 1 (studied at least once).
//
// Queue : each card produces two items:
//   • fwd — show the target-language word, type the native translation
//   • rev — show the native-language word, type the target translation
//
// Ordering algorithm (non-sequential, non-obvious):
//   1. Assign each item a score = boxWeight + rand(0,6)
//      where weight = (6 − box), so box-1 cards (weight 5) cluster
//      near the front but random noise ensures unpredictable ordering.
//   2. Sort descending by score.
//   3. Deinterlace: if two adjacent items belong to the same card
//      (fwd + rev would appear back-to-back), swap the second with
//      the nearest item that belongs to a different card.
//
// On wrong answer : item is re-inserted 3–5 positions ahead so the
//   user sees it again soon but not immediately.
//
// Answer tolerance (Levenshtein):
//   • ≤ 4 chars : exact match only
//   • 5–8 chars : 1 edit allowed → "close" (accepted + spelling note)
//   • ≥ 9 chars : 2 edits allowed → "close"
//
// Does NOT modify Leitner box values — purely a practice mode.
// ─────────────────────────────────────────────────────────────

let typingQueue   = [];   // [{card, dir:'fwd'|'rev'}, ...]
let typingIdx     = 0;    // pointer into queue (grows when wrong answers re-inserted)
let typingTotal   = 0;    // original queue length (denominator for progress)
let typingDone    = 0;    // items resolved (correct + close)
let typingCorrect = 0;
let typingClose   = 0;
let typingWrong   = 0;

// ── Lobby ─────────────────────────────────────────────────────

function showTypingPage() {
  showPage('typing');
  renderTypingLobby();
}

function renderTypingLobby() {
  const el = document.getElementById('typing-lobby-body');
  if (!el) return;
  const eligible = allCards.filter(c => c.box >= 1);

  if (eligible.length === 0) {
    el.innerHTML = `
      <div class="typing-empty">
        <div style="font-size:2.8rem;margin-bottom:18px">📚</div>
        <h3 style="font-family:var(--font-d);font-size:1.3rem;margin-bottom:10px">No words ready yet</h3>
        <p style="color:var(--muted);max-width:380px;margin:0 auto">
          Study some flashcards first. Words that reach Box&nbsp;1 or above
          will appear here for typing practice.
        </p>
      </div>`;
    return;
  }

  const tl = _getLangName(profile.targetLanguage);
  const nl = _getLangName(profile.nativeLanguage);

  el.innerHTML = `
    <div class="typing-lobby">
      <div class="stats-row" style="margin-bottom:28px">
        <div class="stat-card"><div class="stat-val">${eligible.length}</div><div class="stat-lbl">Words Available</div></div>
        <div class="stat-card"><div class="stat-val">${eligible.length * 2}</div><div class="stat-lbl">Total Prompts</div></div>
      </div>
      <div class="tl-info">
        <p>Each word appears <strong>twice</strong> — once showing the
          <strong>${tl}</strong> word so you type the <strong>${nl}</strong>
          translation, and once in reverse.</p>
        <p>The word is read aloud automatically. Press <kbd>Enter</kbd> or
          click <strong>Check</strong> to submit. Wrong answers cycle back
          until you get them right.</p>
      </div>
      <button class="btn btn-primary" onclick="startTyping()"
        style="margin-top:24px;padding:14px 48px;font-size:1rem">
        Start Session →
      </button>
    </div>`;
}

// ── Session start ─────────────────────────────────────────────

function startTyping() {
  const eligible = allCards.filter(c => c.box >= 1);
  if (!eligible.length) return;

  typingQueue   = _buildTypingQueue(eligible);
  typingIdx     = 0;
  typingTotal   = typingQueue.length;
  typingDone    = 0;
  typingCorrect = 0;
  typingClose   = 0;
  typingWrong   = 0;

  document.getElementById('tp-card-area').style.display   = 'block';
  document.getElementById('tp-session-end').style.display = 'none';
  showScreen('typing');
  _updateTypingSpeakerBtn();
  _renderTypingCard();
}

// ── Queue builder ─────────────────────────────────────────────

function _buildTypingQueue(cards) {
  // Two items per card: forward and reverse
  const items = [];
  for (const card of cards) {
    items.push({ card, dir: 'fwd' });
    items.push({ card, dir: 'rev' });
  }

  // Weighted shuffle — harder cards (lower box) score higher → appear earlier,
  // but wide random noise keeps the order feeling natural and unpredictable.
  const w = box => Math.max(1, 6 - box);  // box 1→5 … box 5→1
  const scored = items.map(item => ({
    item,
    score: w(item.card.box) + Math.random() * 6,
  }));
  scored.sort((a, b) => b.score - a.score);
  const q = scored.map(s => s.item);

  // Deinterlace: same card must not appear in consecutive positions
  for (let i = 0; i < q.length - 1; i++) {
    if (q[i].card.id === q[i + 1].card.id) {
      const j = q.findIndex((x, idx) => idx > i + 1 && x.card.id !== q[i].card.id);
      if (j !== -1) [q[i + 1], q[j]] = [q[j], q[i + 1]];
    }
  }
  return q;
}

// ── Card rendering ────────────────────────────────────────────

function _renderTypingCard() {
  if (typingIdx >= typingQueue.length) { endTyping(); return; }

  const { card, dir } = typingQueue[typingIdx];
  const isFwd = dir === 'fwd';

  // Progress (based on items resolved, not queue position — re-inserts don't move bar back)
  const pct = Math.min(100, (typingDone / typingTotal) * 100);
  document.getElementById('tp-prog-fill').style.width = pct + '%';
  document.getElementById('tp-count').textContent     = `${typingDone} / ${typingTotal}`;

  // Direction label: "Type in English" / "Type in Spanish"
  const answerLangName = _getLangName(
    profile[isFwd ? 'nativeLanguage' : 'targetLanguage']
  );
  document.getElementById('tp-dir').textContent = `Type in ${answerLangName}`;

  // Prompt word
  document.getElementById('tp-prompt').textContent = isFwd ? card.front : card.back;

  // Reset input + feedback
  const input = document.getElementById('tp-input');
  input.value    = '';
  input.disabled = false;
  document.getElementById('tp-feedback').style.display  = 'none';
  document.getElementById('tp-next-btn').style.display  = 'none';
  document.getElementById('tp-check-btn').style.display = '';

  setTimeout(() => input.focus(), 40);

  // Auto-play prompt
  if (!audioMuted) speakTypingItem();
}

// ── Audio ─────────────────────────────────────────────────────

function speakTypingItem() {
  if (typingIdx >= typingQueue.length) return;
  const { card, dir } = typingQueue[typingIdx];
  const isFwd = dir === 'fwd';
  stopSpeech();
  _speakSequence([{
    text:    isFwd ? card.front : card.back,
    langCode: isFwd ? getFrontLang(card) : getBackLang(card),
    cardId:  card.id,
    side:    isFwd ? 'front' : 'back',
  }]);
}

function toggleTypingMute() {
  audioMuted = !audioMuted;
  if (audioMuted) {
    stopSpeech();
  } else {
    speakTypingItem();
  }
  _updateTypingSpeakerBtn();
}

function _updateTypingSpeakerBtn() {
  const btn = document.getElementById('tp-btn-speaker');
  if (!btn) return;
  btn.innerHTML = audioMuted
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  btn.title = audioMuted ? 'Unmute audio' : 'Mute audio';
}

// ── Answer checking ───────────────────────────────────────────

function checkTypingAnswer() {
  if (typingIdx >= typingQueue.length) return;
  const input = document.getElementById('tp-input');
  if (!input.value.trim()) { input.focus(); return; }

  const { card, dir } = typingQueue[typingIdx];
  const correct = dir === 'fwd' ? card.back : card.front;
  const result  = _evalAnswer(input.value, correct);

  input.disabled = true;
  document.getElementById('tp-check-btn').style.display = 'none';
  const nextBtn = document.getElementById('tp-next-btn');
  nextBtn.style.display = '';
  setTimeout(() => nextBtn.focus(), 40);

  const fb = document.getElementById('tp-feedback');
  fb.style.display = '';

  if (result === 'correct') {
    typingCorrect++;
    typingDone++;
    fb.className  = 'tp-feedback tp-correct';
    fb.textContent = '✓ Correct!';
  } else if (result === 'close') {
    typingClose++;
    typingDone++;
    fb.className = 'tp-feedback tp-close';
    fb.innerHTML = `~ Close! The correct answer is: <strong>${_esc(correct)}</strong>`;
  } else {
    typingWrong++;
    // Re-insert item 3–5 positions ahead so user sees it again soon
    const gap      = 3 + Math.floor(Math.random() * 3);
    const insertAt = Math.min(typingIdx + 1 + gap, typingQueue.length);
    typingQueue.splice(insertAt, 0, { card, dir });
    fb.className = 'tp-feedback tp-wrong';
    fb.innerHTML = `✗ The answer was: <strong>${_esc(correct)}</strong>`;
  }

  // Update count immediately so user sees progress on correct answers
  const pct = Math.min(100, (typingDone / typingTotal) * 100);
  document.getElementById('tp-prog-fill').style.width = pct + '%';
  document.getElementById('tp-count').textContent     = `${typingDone} / ${typingTotal}`;
}

function nextTypingCard() {
  typingIdx++;
  _renderTypingCard();
}

// ── Levenshtein & evaluation ──────────────────────────────────

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  // Use single-row DP for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

function _evalAnswer(typed, correct) {
  const t = typed.trim().toLowerCase();
  const c = correct.trim().toLowerCase();
  if (t === c) return 'correct';
  // Tolerance: 0 for very short words, 1 for medium, 2 for long
  const tol = c.length <= 4 ? 0 : c.length <= 8 ? 1 : 2;
  return _levenshtein(t, c) <= tol ? 'close' : 'wrong';
}

// ── Session end ───────────────────────────────────────────────

function endTyping() {
  stopSpeech();
  document.getElementById('tp-card-area').style.display   = 'none';
  document.getElementById('tp-session-end').style.display = '';
  document.getElementById('tp-sc-correct').textContent    = typingCorrect;
  document.getElementById('tp-sc-close').textContent      = typingClose;
  document.getElementById('tp-sc-wrong').textContent      = typingWrong;
  document.getElementById('tp-prog-fill').style.width     = '100%';
  document.getElementById('tp-count').textContent         = `${typingTotal} / ${typingTotal}`;
}

function exitTyping() {
  stopSpeech();
  showScreen('dashboard');
  renderHome();
  renderCurriculum();
}

// ── Utility ───────────────────────────────────────────────────

function _getLangName(code) {
  return (LANGUAGES.find(l => l.code === code) || { name: code }).name;
}

// Minimal HTML escape for user-generated content in innerHTML
function _esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
