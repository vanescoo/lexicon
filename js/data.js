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

// All topics in a level unlock together.
// A1 is always unlocked. A2 unlocks when 75% of A1 words are mastered.
// B1 unlocks when 75% of A2 words are mastered.
function isUnlocked(topic) {
  const levelOrder = ['A1', 'A2', 'B1'];
  const levelIdx   = levelOrder.indexOf(topic.level);
  if (levelIdx <= 0) return true;
  const prevLevel    = levelOrder[levelIdx - 1];
  const prevTopics   = CURRICULUM.filter(t => t.level === prevLevel);
  const prevAdvanced = prevTopics.reduce((sum, t) => sum + (topicStats[t.id]?.advanced || 0), 0);
  const threshold    = Math.floor(LEVEL_WORD_INCREMENTS[prevLevel] * 0.75);
  return prevAdvanced >= threshold;
}

function langName(code) {
  return LANGUAGES.find(l => l.code === code)?.name || code;
}
