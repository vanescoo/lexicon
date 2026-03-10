// ─────────────────────────────────────────────────────────────
// Card Generation — LLM prompt, modal UI, Firestore batch write
// ─────────────────────────────────────────────────────────────

function openGenModal(topicId) {
  const topic = getTopics().find(t => t.id ===topicId);
  if (!topic) return;

  genTopicId = topicId;

  const target = TOPIC_WORD_TARGETS[topic.level];
  const s      = topicStats[topicId] || { total: 0, advanced: 0 };
  const due    = dueCards(topicId);

  document.getElementById('gen-title').textContent = topic.name;
  document.getElementById('gen-sub').textContent   =
    `${topic.level} · ${langName(profile.targetLanguage)} · ${s.total}/${target} generated · ${s.advanced} mastered`;
  document.getElementById('gen-form').style.display    = 'block';
  document.getElementById('gen-loading').style.display = 'none';

  // Clear previously injected buttons
  document.querySelectorAll('.gen-injected-btn').forEach(b => b.remove());

  const actions = document.getElementById('modal-actions');

  if (s.total === 0) {
    // First visit — only action is generating the full topic
    const genBtn = document.createElement('button');
    genBtn.className   = 'btn btn-primary gen-injected-btn';
    genBtn.textContent = 'Generate Topic ✨';
    genBtn.onclick     = () => generateCards('initial');
    actions.appendChild(genBtn);
  } else {
    // Return visit — study and/or generate extra
    if (due.length > 0) {
      const studyBtn = document.createElement('button');
      studyBtn.className   = 'btn btn-ghost gen-injected-btn';
      studyBtn.textContent = `Study (${due.length} due)`;
      studyBtn.onclick     = () => { closeModal(); startStudy(due, topic.name); };
      actions.prepend(studyBtn);
    }
    const extraBtn = document.createElement('button');
    extraBtn.className   = 'btn btn-primary gen-injected-btn';
    extraBtn.textContent = 'Generate Extra Words ✨';
    extraBtn.onclick     = () => generateCards('extra');
    actions.appendChild(extraBtn);
  }

  document.getElementById('gen-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('gen-modal').classList.remove('open');
  document.querySelectorAll('.gen-injected-btn').forEach(b => b.remove());
  genTopicId = null;
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('gen-modal')) closeModal();
}

async function generateCards(mode) {
  if (!genTopicId) return;

  const topic  = getTopics().find(t => t.id ===genTopicId);
  const native = langName(profile.nativeLanguage);
  const target = langName(profile.targetLanguage);
  const count  = TOPIC_WORD_TARGETS[topic.level];

  // Collect existing fronts to enforce uniqueness
  const existingFronts = allCards
    .filter(c => c.topicId === genTopicId)
    .map(c => c.front);

  document.getElementById('gen-form').style.display    = 'none';
  document.getElementById('gen-loading').style.display = 'block';

  const uniquenessNote = existingFronts.length > 0
    ? `\nDo NOT include any of these already-existing words (exact or near-duplicate):\n${existingFronts.join(', ')}`
    : '';

  const prompt = `You are an expert language teacher. Generate exactly ${count} vocabulary flashcards for a ${native} speaker learning ${target}.

Topic: "${topic.name}" (CEFR level: ${topic.level})

Each card must have:
- "type": "vocabulary"
- "front": a word or short phrase in ${target}
- "back": the ${native} translation

All ${count} words must be unique — no duplicates within this batch.${uniquenessNote}

Make the vocabulary genuinely useful and appropriate for the level and topic. Keep it accurate and culturally appropriate.

RESPOND WITH ONLY A RAW JSON ARRAY. No markdown, no backticks, no explanation. Example:
[{"type":"vocabulary","front":"bonjour","back":"hello"},{"type":"vocabulary","front":"merci","back":"thank you"}]`;

  try {
    const base     = profile.apiBaseUrl.replace(/\/$/, '');
    const isGemini = base.includes('generativelanguage.googleapis.com') && !base.includes('/openai');
    const isClaude = base.includes('anthropic.com');
    let res, raw;

    if (isGemini) {
      const geminiUrl = `${base}/models/${profile.model}:generateContent?key=${profile.apiKey}`;
      res = await fetch(geminiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents:         [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75 },
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
      const data = await res.json();
      raw = data.content?.[0]?.text || '';

    } else {
      // OpenAI-compatible (default)
      res = await fetch(`${base}/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.apiKey}` },
        body:    JSON.stringify({
          model:       profile.model,
          messages:    [{ role: 'user', content: prompt }],
          temperature: 0.75,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      raw = data.choices?.[0]?.message?.content || '';
    }

    const json  = raw.replace(/```json|```/g, '').trim();
    const cards = JSON.parse(json);
    if (!Array.isArray(cards)) throw new Error('Response was not a JSON array');

    // Deduplicate against existing fronts (case-insensitive)
    const existingSet = new Set(existingFronts.map(f => f.toLowerCase()));
    const now   = Date.now();
    const batch = db.batch();
    let count   = 0;
    cards.forEach(c => {
      if (!c.front || !c.back || !c.type) return;
      if (existingSet.has(String(c.front).toLowerCase())) return;
      existingSet.add(String(c.front).toLowerCase());
      const ref = db.collection('users').doc(currentUser.uid).collection('cards').doc();
      batch.set(ref, {
        topicId:        genTopicId,
        targetLanguage: profile.targetLanguage,
        type:           'vocabulary',
        front:          String(c.front),
        back:           String(c.back),
        box:            0,
        nextReviewDate: now,
        createdAt:      now,
        lastReviewedAt: null,
      });
      count++;
    });
    await batch.commit();

    closeModal();
    await loadCards();
    renderHome();
    renderCurriculum();
    toast(`${count} cards generated!`, 'success');

  } catch (e) {
    document.getElementById('gen-form').style.display    = 'block';
    document.getElementById('gen-loading').style.display = 'none';
    toast('Generation failed: ' + e.message, 'error');
    console.error(e);
  }
}
