// ─────────────────────────────────────────────────────────────
// Custom Topic Management — add-topic modal & Firestore write
// ─────────────────────────────────────────────────────────────

let addTopicLevel = null;

function openAddTopicModal(level) {
  addTopicLevel = level;
  document.getElementById('add-topic-title').textContent = `Add Topic to ${level}`;
  document.getElementById('add-topic-sub').textContent   =
    `${LEVEL_NAMES[level]} · ${TOPIC_WORD_TARGETS[level]} words will be generated when you visit it`;
  document.getElementById('add-topic-input').value       = '';
  document.getElementById('add-topic-form').style.display    = 'block';
  document.getElementById('add-topic-loading').style.display = 'none';
  document.getElementById('add-topic-modal').classList.add('open');
  document.getElementById('add-topic-input').focus();
}

function closeAddTopicModal() {
  document.getElementById('add-topic-modal').classList.remove('open');
  addTopicLevel = null;
}

function handleAddTopicOverlayClick(e) {
  if (e.target === document.getElementById('add-topic-modal')) closeAddTopicModal();
}

async function suggestTopicName() {
  if (!addTopicLevel) return;

  const existing = getTopics()
    .filter(t => t.level === addTopicLevel)
    .map(t => t.name);

  document.getElementById('add-topic-form').style.display    = 'none';
  document.getElementById('add-topic-loading').style.display = 'block';

  const prompt = `You are an expert language teacher designing a vocabulary curriculum.
Suggest ONE new topic name for CEFR level ${addTopicLevel} (${LEVEL_NAMES[addTopicLevel]}).
The topic must be different from these already-existing topics: ${existing.join(', ')}.
Reply with ONLY the topic name — no explanation, no punctuation at the end, no quotes.
Example output: Animals & Pets`;

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
        body:    JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      raw = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else if (isClaude) {
      res = await fetch(`${base}/v1/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': profile.apiKey, 'anthropic-version': '2023-06-01' },
        body:    JSON.stringify({ model: profile.model, max_tokens: 64, messages: [{ role: 'user', content: prompt }] }),
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

    document.getElementById('add-topic-input').value = raw.trim().replace(/^["'`]|["'`]$/g, '');
    document.getElementById('add-topic-form').style.display    = 'block';
    document.getElementById('add-topic-loading').style.display = 'none';

  } catch (e) {
    document.getElementById('add-topic-form').style.display    = 'block';
    document.getElementById('add-topic-loading').style.display = 'none';
    toast('Suggestion failed: ' + e.message, 'error');
  }
}

async function saveCustomTopic() {
  const name = document.getElementById('add-topic-input').value.trim();
  if (!name)        { toast('Please enter a topic name', 'error'); return; }
  if (!addTopicLevel) return;

  const maxOrder = getTopics()
    .filter(t => t.level === addTopicLevel)
    .reduce((max, t) => Math.max(max, t.order), 0);

  const topic = {
    id:        `custom_${addTopicLevel.toLowerCase()}_${Date.now()}`,
    level:     addTopicLevel,
    name,
    order:     maxOrder + 1,
    createdAt: Date.now(),
  };

  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('customTopics').doc(topic.id).set(topic);
    closeAddTopicModal();
    await loadCustomTopics();
    renderHome();
    renderCurriculum();
    toast(`"${name}" added to ${addTopicLevel}!`, 'success');
  } catch (e) {
    toast('Failed to add topic: ' + e.message, 'error');
  }
}
