// ─────────────────────────────────────────────────────────────
// Utilities — shuffle & toast
// ─────────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let _toastTimer;

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

// Toast button wiring
document.getElementById('toast-close').onclick = () => {
  clearTimeout(_toastTimer);
  document.getElementById('toast').classList.remove('show');
};

document.getElementById('toast-copy').onclick = () => {
  const msg = document.getElementById('toast-msg').textContent;
  navigator.clipboard.writeText(msg).then(() => {
    const btn = document.getElementById('toast-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  }).catch(() => {
    const btn = document.getElementById('toast-copy');
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
};
