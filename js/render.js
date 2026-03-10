// ─────────────────────────────────────────────────────────────
// UI Rendering — Home page & Curriculum page
// ─────────────────────────────────────────────────────────────

function renderHome() {
  const due          = dueCards();
  const wordsLearned = allCards.filter(c => c.box >= 3).length;
  const mastered     = allCards.filter(c => c.box === 5).length;
  const started      = new Set(allCards.map(c => c.topicId)).size;

  document.getElementById('stat-due').textContent      = due.length;
  document.getElementById('stat-total').textContent    = wordsLearned;
  document.getElementById('stat-topics').textContent   = started;
  document.getElementById('stat-mastered').textContent = mastered;

  // Due-cards banner
  const banner = document.getElementById('due-banner');
  if (due.length > 0) {
    banner.style.display = 'flex';
    document.getElementById('banner-title').textContent = `${due.length} card${due.length === 1 ? '' : 's'} due for review`;
    document.getElementById('banner-sub').textContent   = 'Keep your memory sharp — review before they fade.';
    document.getElementById('btn-study-all').onclick    = () => startStudy(due, 'All Due Cards');
  } else {
    banner.style.display = 'none';
  }

  // Leitner box visualisation
  const row = document.getElementById('leitner-row');
  row.innerHTML = '';
  for (let b = 1; b <= 5; b++) {
    const cnt = allCards.filter(c => c.box === b).length;
    row.innerHTML += `
      <div class="leitner-box">
        <div class="leitner-box-val">${cnt}</div>
        <div class="leitner-box-name">Box ${b}</div>
        <div class="leitner-box-interval">every ${INTERVALS[b]}d</div>
      </div>`;
  }

  // Active / recent topics
  const active = getTopics()
    .filter(t => isUnlocked(t) && topicStats[t.id]?.total > 0)
    .slice(-6)
    .reverse();
  const firstUnlocked = getTopics().find(t => isUnlocked(t) && topicStats[t.id]?.total === 0);
  const showTopics    = active.length > 0 ? active : (firstUnlocked ? [firstUnlocked] : []);

  document.getElementById('recent-topics').innerHTML = showTopics.length
    ? showTopics.map(t => topicCardHTML(t)).join('')
    : `<p style="color:var(--muted)">Visit Curriculum to start your first topic.</p>`;
}

// Returns the HTML string for a single topic card (used in Home and Curriculum)
function topicCardHTML(t) {
  const s      = topicStats[t.id] || { total: 0, advanced: 0 };
  const target = TOPIC_WORD_TARGETS[t.level];
  const pct    = Math.min(100, Math.round((s.advanced / target) * 100));
  const due    = dueCards(t.id).length;
  return `
    <div class="topic-card" onclick="openGenModal('${t.id}')">
      <div class="topic-card-top">
        <span class="lvl lvl-${t.level}">${t.level}</span>
        ${due > 0 ? `<span class="due-chip">${due} due</span>` : ''}
      </div>
      <div class="topic-name">${t.name}</div>
      <div class="topic-meta"><span>${s.advanced}/${target} words</span><span>${pct}%</span></div>
      <div class="topic-bar"><div class="topic-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function renderCurriculum() {
  const levels = ['A1', 'A2', 'B1'];
  document.getElementById('curriculum-body').innerHTML = levels.map(lvl => {
    const topics       = getTopics().filter(t => t.level === lvl);
    const lvlAdvanced  = topics.reduce((sum, t) => sum + (topicStats[t.id]?.advanced || 0), 0);
    const lvlIncrement = LEVEL_WORD_INCREMENTS[lvl];
    const lvlPct       = Math.min(100, Math.round((lvlAdvanced / lvlIncrement) * 100));
    const lvlComplete  = lvlAdvanced >= lvlIncrement;
    const topicTarget  = TOPIC_WORD_TARGETS[lvl];
    const levelUnlocked = isUnlocked(topics[0]);
    const threshold    = Math.floor(lvlIncrement * 0.75);

    return `
      <div class="level-section">
        <div class="level-hd">
          <span class="lvl lvl-${lvl}">${lvl}</span>
          <h2>${LEVEL_NAMES[lvl]}</h2>
          <div class="level-progress">
            <span>${lvlAdvanced}/${lvlIncrement} words</span>
            <div class="level-progress-bar">
              <div class="level-progress-fill${lvlComplete ? ' complete' : ''}" style="width:${lvlPct}%"></div>
            </div>
            <span>${lvlPct}%</span>
          </div>
        </div>
        <div class="topics-grid">
          ${topics.map(t => {
            const s   = topicStats[t.id] || { total: 0, advanced: 0 };
            const pct = Math.min(100, Math.round((s.advanced / topicTarget) * 100));
            const due = dueCards(t.id).length;
            return `
              <div class="topic-card ${levelUnlocked ? '' : 'locked'}"
                onclick="${levelUnlocked ? `openGenModal('${t.id}')` : ''}"
                title="${levelUnlocked ? '' : `Master ${threshold} words in ${lvl === 'A2' ? 'A1' : 'A2'} (75%) to unlock this level`}">
                ${!levelUnlocked ? '<div class="lock-icon">🔒</div>' : ''}
                <div class="topic-card-top">
                  <span class="lvl lvl-${t.level}">${t.level}</span>
                  ${due > 0 ? `<span class="due-chip">${due} due</span>` : ''}
                </div>
                <div class="topic-name">${t.name}</div>
                <div class="topic-meta"><span>${s.advanced}/${topicTarget} words</span><span>${pct}%</span></div>
                <div class="topic-bar"><div class="topic-fill" style="width:${pct}%"></div></div>
              </div>`;
          }).join('')}
          <div class="topic-card topic-card-add" onclick="openAddTopicModal('${lvl}')" title="Add a custom topic to ${lvl}">
            <div class="topic-add-icon">+</div>
            <div class="topic-name">Add Topic</div>
          </div>
        </div>
      </div>`;
  }).join('');
}
