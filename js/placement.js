// ─────────────────────────────────────────────────────────────
// Placement Test — adaptive test across all CEFR levels
//
// Flow:
//  1. "Take Levelling Test" → single API call fetches 5 questions
//     for every CEFR level (A1–C2) simultaneously while showing
//     "Loading your levelling test…"
//  2. Test starts at A2; each correct answer bumps the level up,
//     each wrong answer drops it down.
//  3. After 15 questions, placement = mode of all levels tested,
//     capped at B1 (highest curriculum level).
//  4. Result: unlock detected level + auto-generate first topic.
// ─────────────────────────────────────────────────────────────

const PLACEMENT_ALL_LEVELS  = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PLACEMENT_CURRICULUM  = ['A1', 'A2', 'B1'];
const PLACEMENT_TOTAL_Q     = 15;
const PLACEMENT_Q_PER_LEVEL = 5;
const PLACEMENT_START_LEVEL = 'A2';

let _plAllQ        = {};   // { A1:[...], A2:[...], ... } — pre-fetched questions
let _plUsed        = {};   // { A1: 0, A2: 3, ... }       — pool index per level
let _plCurLevel    = null; // current difficulty level
let _plCurQ        = null; // current question object
let _plOptions     = [];   // shuffled answer options for current question
let _plHistory     = [];   // [{ level, correct }, ...] one entry per answered Q
let _plFromSettings = false; // true when opened from Settings (retake)

// ── Entry point ──────────────────────────────────────────────

// fromSettings=true → closing without finishing preserves existing placement.
// fromSettings=false (first-time) → closing treats as "Start from Beginning".
function showPlacementModal(fromSettings = false) {
  _plFromSettings = fromSettings;
  setPlView('choice');
  document.getElementById('placement-modal').classList.add('open');
}

// X button — behaviour depends on how modal was opened
function closePlacementModal() {
  if (_plFromSettings) {
    document.getElementById('placement-modal').classList.remove('open');
  } else {
    placementSkip(); // first-time: mark done, stay at A1
  }
}

// ── User choices ─────────────────────────────────────────────

async function placementSkip() {
  await _savePlacement(null);
  document.getElementById('placement-modal').classList.remove('open');
}

async function placementStartTest() {
  setPlView('loading');
  try {
    _plAllQ     = await _fetchAllQuestions();
    _plUsed     = {};
    _plCurLevel = PLACEMENT_START_LEVEL;
    _plHistory  = [];
    _showQuestion();
  } catch (e) {
    toast('Failed to load test: ' + e.message, 'error');
    setPlView('choice');
  }
}

// ── Fetch all levels at once ──────────────────────────────────

async function _fetchAllQuestions() {
  const native = langName(profile.nativeLanguage);
  const target = langName(profile.targetLanguage);

  const prompt =
`You are a language test designer. Generate vocabulary questions to assess a ${native} speaker's ${target} proficiency across all 6 CEFR levels.

For each level (A1, A2, B1, B2, C1, C2) provide exactly ${PLACEMENT_Q_PER_LEVEL} multiple-choice questions.

Each question must have:
- "word": a ${target} word or short phrase characteristic of that CEFR level
- "correct": the correct ${native} translation
- "distractors": exactly 3 wrong ${native} translations that are plausible but clearly distinct

RESPOND WITH ONLY A RAW JSON OBJECT. No markdown, no explanation:
{"A1":[{"word":"...","correct":"...","distractors":["...","...","..."]},...], "A2":[...], "B1":[...], "B2":[...], "C1":[...], "C2":[...]}`;

  const base     = profile.apiBaseUrl.replace(/\/$/, '');
  const isGemini = base.includes('generativelanguage.googleapis.com') && !base.includes('/openai');
  const isClaude = base.includes('anthropic.com');
  let res, raw;

  if (isGemini) {
    const url = `${base}/models/${profile.model}:generateContent?key=${profile.apiKey}`;
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    raw = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (isClaude) {
    res = await fetch(`${base}/v1/messages`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         profile.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      profile.model,
        max_tokens: 4096,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    raw = (await res.json()).content?.[0]?.text || '';

  } else {
    res = await fetch(`${base}/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.apiKey}` },
      body:    JSON.stringify({ model: profile.model, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    raw = (await res.json()).choices?.[0]?.message?.content || '';
  }

  const json = raw.replace(/```json|```/g, '').trim();
  const data = JSON.parse(json);
  if (typeof data !== 'object' || !data.A1) throw new Error('Invalid response format');
  return data;
}

// ── Adaptive question rendering ───────────────────────────────

function _showQuestion() {
  const answered = _plHistory.length;
  if (answered >= PLACEMENT_TOTAL_Q) { _computeAndFinalize(); return; }

  setPlView('question');

  // Draw next question from the pool for the current level (wrap if exhausted)
  const pool  = _plAllQ[_plCurLevel] || [];
  const idx   = _plUsed[_plCurLevel] || 0;
  _plCurQ = pool[idx % Math.max(pool.length, 1)];
  _plUsed[_plCurLevel] = idx + 1;

  // Level badge
  const badge = document.getElementById('pl-level-badge');
  badge.textContent = _plCurLevel;
  badge.className   = `lvl lvl-${_plCurLevel}`;

  document.getElementById('pl-word').textContent         = _plCurQ.word;
  document.getElementById('pl-progress-txt').textContent = `Question ${answered + 1} of ${PLACEMENT_TOTAL_Q}`;
  document.getElementById('pl-prog-fill').style.width    = `${(answered / PLACEMENT_TOTAL_Q) * 100}%`;

  _plOptions = [_plCurQ.correct, ..._plCurQ.distractors].sort(() => Math.random() - 0.5);

  const btns = document.getElementById('pl-answer-btns');
  btns.innerHTML = _plOptions
    .map((opt, i) =>
      `<button class="pl-answer-btn" data-idx="${i}" onclick="answerPlacement(this)">${escHtml(opt)}</button>`
    )
    .join('');
}

function answerPlacement(btn) {
  const optIdx    = parseInt(btn.dataset.idx);
  const chosen    = _plOptions[optIdx];
  const correct   = _plCurQ.correct;
  const isCorrect = chosen === correct;

  document.querySelectorAll('.pl-answer-btn').forEach(b => b.disabled = true);

  if (isCorrect) {
    btn.classList.add('pl-correct');
  } else {
    btn.classList.add('pl-wrong');
    document.querySelectorAll('.pl-answer-btn').forEach(b => {
      if (_plOptions[parseInt(b.dataset.idx)] === correct) b.classList.add('pl-correct');
    });
  }

  // Record answer and shift difficulty
  _plHistory.push({ level: _plCurLevel, correct: isCorrect });
  const i = PLACEMENT_ALL_LEVELS.indexOf(_plCurLevel);
  _plCurLevel = isCorrect
    ? PLACEMENT_ALL_LEVELS[Math.min(i + 1, PLACEMENT_ALL_LEVELS.length - 1)]
    : PLACEMENT_ALL_LEVELS[Math.max(i - 1, 0)];

  setTimeout(_showQuestion, 700);
}

// ── Compute final placement from history ──────────────────────

function _computeAndFinalize() {
  // Count how many questions were asked at each level
  const counts = {};
  _plHistory.forEach(h => { counts[h.level] = (counts[h.level] || 0) + 1; });

  // Mode level (lowest wins on tie → conservative placement)
  let modeLevel = PLACEMENT_ALL_LEVELS[0];
  let modeCount = 0;
  PLACEMENT_ALL_LEVELS.forEach(l => {
    if ((counts[l] || 0) > modeCount) { modeCount = counts[l]; modeLevel = l; }
  });

  // Cap to highest curriculum level (B1)
  const cappedIdx  = Math.min(PLACEMENT_ALL_LEVELS.indexOf(modeLevel), PLACEMENT_CURRICULUM.length - 1);
  const finalLevel = PLACEMENT_CURRICULUM[cappedIdx];

  _finalizePlacement(finalLevel);
}

async function _finalizePlacement(level) {
  setPlView('result');

  const badge = document.getElementById('pl-result-level');
  badge.textContent = level;
  badge.className   = `pl-result-level lvl-${level}`;

  const subtitles = {
    A1: 'Starting from the foundations — a great place to begin!',
    A2: 'You know your basics well. Starting at A2 Building Blocks.',
    B1: 'Strong vocabulary! Starting at B1 Intermediate.',
  };
  document.getElementById('pl-result-sub').textContent = subtitles[level];

  await _savePlacement(level !== 'A1' ? level : null);

  const firstTopic = getTopics().find(t => t.level === level);
  if (firstTopic) {
    setTimeout(() => _autoGenerate(firstTopic), 1400);
  } else {
    setTimeout(() => document.getElementById('placement-modal').classList.remove('open'), 1800);
  }
}

async function _autoGenerate(topic) {
  setPlView('generating');

  const msgEl    = document.getElementById('pl-gen-msg');
  const progWrap = document.getElementById('pl-audio-prog');
  const progFill = document.getElementById('pl-audio-fill');
  const progLabel= document.getElementById('pl-audio-label');

  msgEl.textContent      = `Generating "${topic.name}"…`;
  progWrap.style.display = 'none';

  try {
    const { count, newCards } = await generateCardsCore(topic.id);
    await loadCards();

    // Pre-cache TTS audio for all new cards
    if (newCards.length > 0 && _ttsProvider() !== 'none') {
      msgEl.textContent      = 'Pre-loading audio…';
      progWrap.style.display = '';
      await preCacheCardAudio(newCards, (done, total) => {
        progFill.style.width  = `${done / total * 100}%`;
        progLabel.textContent = `${done} / ${total} clips`;
      });
    }

    document.getElementById('placement-modal').classList.remove('open');
    renderHome();
    renderCurriculum();
    toast(
      `Placed at ${topic.level} · "${topic.name}" ready — ${count} cards generated!`,
      'success'
    );
  } catch (e) {
    document.getElementById('placement-modal').classList.remove('open');
    renderHome();
    renderCurriculum();
    toast(`Placed at ${topic.level}. Open a topic to start generating cards.`, 'success');
  }
}

// ── Persistence ──────────────────────────────────────────────

async function _savePlacement(level) {
  profile.placementDone = true;
  if (level) profile.placementLevel = level;
  await db.collection('users').doc(currentUser.uid).set(profile);
}

// ── Helpers ──────────────────────────────────────────────────

function setPlView(view) {
  ['choice', 'loading', 'question', 'result', 'generating'].forEach(v => {
    document.getElementById(`pl-view-${v}`).style.display = v === view ? '' : 'none';
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
