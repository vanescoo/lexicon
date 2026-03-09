// ─────────────────────────────────────────────────────────────
// Data layer — Firestore operations & derived data helpers
// ─────────────────────────────────────────────────────────────

async function loadCards() {
  const snap = await db.collection('users').doc(currentUser.uid).collection('cards').get();
  allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  recomputeStats();
}

function recomputeStats() {
  topicStats = {};
  CURRICULUM.forEach(t => { topicStats[t.id] = { total: 0, advanced: 0 }; });
  allCards.forEach(c => {
    if (!topicStats[c.topicId]) return;
    topicStats[c.topicId].total++;
    if (c.box >= 3) topicStats[c.topicId].advanced++;
  });
}

// Returns cards due for review, optionally filtered to a single topic
function dueCards(ofTopicId = null) {
  const now = Date.now();
  return allCards.filter(c =>
    (!c.nextReviewDate || c.nextReviewDate <= now) &&
    (!ofTopicId || c.topicId === ofTopicId)
  );
}

// A topic unlocks when the previous topic has reached its word target
function isUnlocked(topic) {
  if (topic.order <= 1) return true;
  const prev = CURRICULUM.find(t => t.order === topic.order - 1);
  if (!prev) return true;
  const s = topicStats[prev.id];
  if (!s || s.total === 0) return topic.order <= 2;
  return s.advanced >= TOPIC_WORD_TARGETS[prev.level];
}

function langName(code) {
  return LANGUAGES.find(l => l.code === code)?.name || code;
}
