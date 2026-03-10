// ─────────────────────────────────────────────────────────────
// Topic Inspector Modal — word table + action buttons
// ─────────────────────────────────────────────────────────────

let inspectorTopicId = null;

function openTopicInspector(topicId) {
  const topic = getTopics().find(t => t.id === topicId);
  if (!topic) return;
  inspectorTopicId = topicId;

  const s    = topicStats[topicId] || { total: 0, advanced: 0 };
  const due  = dueCards(topicId);
  const target = TOPIC_WORD_TARGETS[topic.level];

  // Header
  document.getElementById('ti-topic-name').textContent  = topic.name;
  document.getElementById('ti-topic-level').textContent = topic.level;
  document.getElementById('ti-topic-level').className   = `lvl lvl-${topic.level}`;
  document.getElementById('ti-topic-sub').textContent   =
    `${s.total}/${target} words generated · ${s.advanced} advanced · ${due.length} due`;

  // Action buttons
  const bar = document.getElementById('ti-action-bar');
  bar.innerHTML = '';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = 'Close';
  cancelBtn.onclick = closeTopicInspector;
  bar.appendChild(cancelBtn);

  if (due.length > 0) {
    const studyBtn = document.createElement('button');
    studyBtn.className   = 'btn btn-ghost';
    studyBtn.textContent = `Study (${due.length} due)`;
    studyBtn.onclick     = () => { closeTopicInspector(); startStudy(due, topic.name); };
    bar.appendChild(studyBtn);
  }

  const genBtn = document.createElement('button');
  genBtn.className   = 'btn btn-primary';
  genBtn.textContent = 'Generate Extra Words ✨';
  genBtn.onclick     = () => { closeTopicInspector(); openGenModal(topicId); };
  bar.appendChild(genBtn);

  // Word table
  const cards = allCards
    .filter(c => c.topicId === topicId)
    .sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));

  const tbody = document.getElementById('ti-table-body');
  tbody.innerHTML = cards.map(c => {
    const dueDate = c.nextReviewDate ? new Date(c.nextReviewDate) : null;
    const isDue   = dueDate && c.nextReviewDate <= Date.now();
    const dueTxt  = dueDate ? (isDue ? 'Due now' : formatRelativeDate(c.nextReviewDate)) : '—';
    return `
      <tr>
        <td class="ti-front">${escapeHtml(c.front)}</td>
        <td class="ti-back">${escapeHtml(c.back)}</td>
        <td><span class="ti-box-badge ti-box-${c.box}">Box ${c.box}</span></td>
        <td class="ti-due ${isDue ? 'due-now' : ''}">${dueTxt}</td>
      </tr>`;
  }).join('');

  document.getElementById('topic-inspector-modal').classList.add('open');
}

function closeTopicInspector() {
  document.getElementById('topic-inspector-modal').classList.remove('open');
  inspectorTopicId = null;
}

function handleTopicInspectorOverlayClick(e) {
  if (e.target === document.getElementById('topic-inspector-modal')) closeTopicInspector();
}
