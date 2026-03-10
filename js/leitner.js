// ─────────────────────────────────────────────────────────────
// Leitner Box Inspector — shows all cards in a given box
// ─────────────────────────────────────────────────────────────

function openLeitnerModal(box) {
  const cards = allCards.filter(c => c.box === box);

  document.getElementById('leitner-modal-title').textContent =
    `Box ${box} — ${cards.length} card${cards.length === 1 ? '' : 's'}`;
  document.getElementById('leitner-modal-sub').textContent =
    `Review interval: every ${INTERVALS[box]} day${INTERVALS[box] === 1 ? '' : 's'}`;

  const tbody = document.getElementById('leitner-table-body');

  if (cards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px">No cards in this box yet.</td></tr>`;
  } else {
    // Sort by nextReviewDate ascending (soonest due first)
    const sorted = [...cards].sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0));
    tbody.innerHTML = sorted.map(c => {
      const topic    = getTopics().find(t => t.id === c.topicId);
      const topicName = topic ? topic.name  : '—';
      const level     = topic ? topic.level : '—';
      const dueDate   = c.nextReviewDate ? new Date(c.nextReviewDate) : null;
      const now       = Date.now();
      const isDue     = dueDate && c.nextReviewDate <= now;
      const dueTxt    = dueDate
        ? (isDue ? 'Due now' : formatRelativeDate(c.nextReviewDate))
        : '—';
      return `
        <tr>
          <td class="lt-front">${escapeHtml(c.front)}</td>
          <td class="lt-back">${escapeHtml(c.back)}</td>
          <td><span class="lvl lvl-${level}">${level}</span></td>
          <td class="lt-topic">${escapeHtml(topicName)}</td>
          <td class="lt-due ${isDue ? 'due-now' : ''}">${dueTxt}</td>
        </tr>`;
    }).join('');
  }

  document.getElementById('leitner-modal').classList.add('open');
}

function closeLeitnerModal() {
  document.getElementById('leitner-modal').classList.remove('open');
}

function handleLeitnerOverlayClick(e) {
  if (e.target === document.getElementById('leitner-modal')) closeLeitnerModal();
}

function formatRelativeDate(ts) {
  const diff  = ts - Date.now();
  const days  = Math.ceil(diff / 86400000);
  if (days <= 0)  return 'Due now';
  if (days === 1) return 'Tomorrow';
  if (days < 7)   return `In ${days} days`;
  if (days < 14)  return 'In 1 week';
  if (days < 30)  return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
