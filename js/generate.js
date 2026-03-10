// ─────────────────────────────────────────────────────────────
// Card Generation — LLM prompt, modal UI, Firestore batch write
// ─────────────────────────────────────────────────────────────

function openGenModal(topicId) {
  const topic = CURRICULUM.find(t => t.id === topicId);
  if (!topic) return;

  genTopicId = topicId;
  genCount   = TOPIC_GEN_DEFAULTS[topic.level];

  const topicTarget = TOPIC_WORD_TARGETS[topic.level];
  const s           = topicStats[topicId] || { total: 0, advanced: 0 };

  document.getElementById('gen-title').textContent = topic.name;
  document.getElementById('gen-sub').textContent   =
    `${topic.level} · ${langName(profile.targetLanguage)} · Target: ${topicTarget} words (${s.advanced} mastered)`;
  document.getElementById('gen-form').style.display    = 'block';
  document.getElementById('gen-loading').style.display = 'none';
  document.querySelectorAll('.cnt-btn').forEach(b => b.classList.toggle('sel', +b.textContent === genCount));

  // Inject a Study button when there are due cards for this topic
  const due = dueCards(topicId);
  let studyBtn = document.getElementById('modal-study-btn');
  if (due.length > 0) {
    if (!studyBtn) {
      studyBtn = document.createElement('button');
      studyBtn.id        = 'modal-study-btn';
      studyBtn.className = 'btn btn-ghost';
      document.getElementById('modal-actions').prepend(studyBtn);
    }
    studyBtn.textContent = `Study (${due.length} due)`;
    studyBtn.onclick     = () => { closeModal(); startStudy(due, topic.name); };
    studyBtn.style.display = '';
  } else if (studyBtn) {
    studyBtn.style.display = 'none';
  }

  document.getElementById('gen-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('gen-modal').classList.remove('open');
  genTopicId = null;
  const b = document.getElementById('modal-study-btn');
  if (b) b.remove();
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('gen-modal')) closeModal();
}

function setCount(n) {
  genCount = n;
  document.querySelectorAll('.cnt-btn').forEach(b => b.classList.toggle('sel', +b.textContent === n));
}

async function generateCards() {
  if (!genTopicId) return;

  const topic  = CURRICULUM.find(t => t.id === genTopicId);
  const native = langName(profile.nativeLanguage);
  const target = langName(profile.targetLanguage);

  document.getElementById('gen-form').style.display    = 'none';
  document.getElementById('gen-loading').style.display = 'block';

  const prompt = `You are an expert language teacher. Generate exactly ${genCount} vocabulary flashcards for a ${native} speaker learning ${target}.

Topic: "${topic.name}" (CEFR level: ${topic.level})

Each card must have:
- "type": "vocabulary"
- "front": a word or short phrase in ${target}
- "back": the ${native} translation

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

    const now   = Date.now();
    const batch = db.batch();
    let count   = 0;
    cards.forEach(c => {
      if (!c.front || !c.back || !c.type) return;
      const ref = db.collection('users').doc(currentUser.uid).collection('cards').doc();
      batch.set(ref, {
        topicId:        genTopicId,
        type:           'vocabulary',
        front:          String(c.front),
        back:           String(c.back),
        box:            1,
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
