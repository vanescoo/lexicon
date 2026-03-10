// ─────────────────────────────────────────────────────────────
// Placement Test — onboarding flow for users with zero cards
// Adaptive: A1 → A2 → B1, advance on ≥80%, stop otherwise.
// ─────────────────────────────────────────────────────────────

const PLACEMENT_LEVELS         = ['A1', 'A2', 'B1'];
const PLACEMENT_PASS_THRESHOLD = 0.8;   // ≥80% correct → advance to next level
const PLACEMENT_Q_COUNT        = 10;    // questions per level

let _plLevel     = null;   // current level being tested
let _plQuestions = [];     // question list for current level
let _plIdx       = 0;      // index of current question
let _plCorrect   = 0;      // correct answers this level
let _plOptions   = [];     // shuffled answer options for current question

// ── Entry point ──────────────────────────────────────────────

function showPlacementModal() {
  _plLevel = null;
  setPlView('choice');
  document.getElementById('placement-modal').classList.add('open');
}

// ── User choices ─────────────────────────────────────────────

async function placementSkip() {
  await _savePlacement(null);
  document.getElementById('placement-modal').classList.remove('open');
}

async function placementStartTest() {
  _plLevel = 'A1';
  await _runLevel();
}

// ── Level runner ─────────────────────────────────────────────

async function _runLevel() {
  setPlView('loading');
  document.getElementById('pl-loading-msg').textContent =
    `Generating ${_plLevel} questions…`;
  try {
    _plQuestions = await _fetchQuestions(_plLevel);
    _plIdx     = 0;
    _plCorrect = 0;
    _showQuestion();
  } catch (e) {
    toast('Failed to generate test questions: ' + e.message, 'error');
    setPlView('choice');
  }
}

async function _fetchQuestions(level) {
  const native = langName(profile.nativeLanguage);
  const target = langName(profile.targetLanguage);

  const prompt =
`You are a language test designer. Generate exactly ${PLACEMENT_Q_COUNT} multiple-choice vocabulary questions to test a ${native} speaker's ${target} knowledge at CEFR level ${level}.

Each question must have:
- "word": a ${target} word or short phrase typical of CEFR ${level}
- "correct": the correct ${native} translation
- "distractors": exactly 3 wrong ${native} translations that are plausible but clearly distinct

RESPOND WITH ONLY A RAW JSON ARRAY. No markdown, no explanation:
[{"word":"...","correct":"...","distractors":["...","...","..."]}]`;

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
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    raw = (await res.json()).content?.[0]?.text || '';

  } else {
    res = await fetch(`${base}/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.apiKey}` },
      body:    JSON.stringify({
        model:    profile.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    raw = (await res.json()).choices?.[0]?.message?.content || '';
  }

  const json = raw.replace(/```json|```/g, '').trim();
  const qs   = JSON.parse(json);
  if (!Array.isArray(qs) || qs.length === 0) throw new Error('Invalid response format');
  return qs;
}

// ── Question UI ──────────────────────────────────────────────

function _showQuestion() {
  if (_plIdx >= _plQuestions.length) { _finishLevel(); return; }

  setPlView('question');
  const q = _plQuestions[_plIdx];

  document.getElementById('pl-word').textContent = q.word;
  document.getElementById('pl-progress-txt').textContent =
    `${_plLevel} · ${_plIdx + 1} / ${_plQuestions.length}`;
  document.getElementById('pl-prog-fill').style.width =
    `${(_plIdx / _plQuestions.length) * 100}%`;

  _plOptions = [q.correct, ...q.distractors].sort(() => Math.random() - 0.5);

  const btns = document.getElementById('pl-answer-btns');
  btns.innerHTML = _plOptions
    .map((opt, i) =>
      `<button class="pl-answer-btn" data-idx="${i}" onclick="answerPlacement(this)">${escHtml(opt)}</button>`
    )
    .join('');
}

function answerPlacement(btn) {
  const optIdx  = parseInt(btn.dataset.idx);
  const chosen  = _plOptions[optIdx];
  const correct = _plQuestions[_plIdx].correct;

  document.querySelectorAll('.pl-answer-btn').forEach(b => b.disabled = true);

  if (chosen === correct) {
    btn.classList.add('pl-correct');
    _plCorrect++;
  } else {
    btn.classList.add('pl-wrong');
    document.querySelectorAll('.pl-answer-btn').forEach(b => {
      if (_plOptions[parseInt(b.dataset.idx)] === correct) b.classList.add('pl-correct');
    });
  }

  _plIdx++;
  setTimeout(_showQuestion, 700);
}

// ── Level result ─────────────────────────────────────────────

async function _finishLevel() {
  const pct    = _plCorrect / _plQuestions.length;
  const curIdx = PLACEMENT_LEVELS.indexOf(_plLevel);
  const isLast = curIdx >= PLACEMENT_LEVELS.length - 1;

  if (pct >= PLACEMENT_PASS_THRESHOLD && !isLast) {
    const next = PLACEMENT_LEVELS[curIdx + 1];
    setPlView('transition');
    document.getElementById('pl-transition-msg').innerHTML =
      `<strong>${Math.round(pct * 100)}%</strong> on ${_plLevel} — moving to ${next}…`;
    _plLevel = next;
    setTimeout(_runLevel, 1800);
  } else {
    await _finalizePlacement(_plLevel, Math.round(pct * 100));
  }
}

async function _finalizePlacement(level, pct) {
  setPlView('result');
  document.getElementById('pl-result-level').textContent = level;

  const subtitles = {
    A1: 'Starting from the foundations — a great place to begin!',
    A2: 'You know your basics well. Starting at A2 Building Blocks.',
    B1: 'Strong vocabulary! Starting at B1 Intermediate.',
  };
  document.getElementById('pl-result-sub').textContent   = subtitles[level];
  document.getElementById('pl-result-score').textContent = `Score: ${pct}% on ${level}`;

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
  document.getElementById('pl-gen-msg').textContent = `Generating "${topic.name}"…`;

  try {
    const count = await generateCardsCore(topic.id);
    document.getElementById('placement-modal').classList.remove('open');
    await loadCards();
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

// ── View switcher ────────────────────────────────────────────

function setPlView(view) {
  ['choice', 'loading', 'question', 'transition', 'result', 'generating'].forEach(v => {
    document.getElementById(`pl-view-${v}`).style.display = v === view ? '' : 'none';
  });
}

// ── HTML escaping ─────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
