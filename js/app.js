// ─────────────────────────────────────────────────────────────
// Application bootstrap — Firebase init, auth, navigation,
// setup flow, settings, and provider helpers
// ─────────────────────────────────────────────────────────────

// ── Firebase init ────────────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
auth = firebase.auth();
db   = firebase.firestore();

// ── Provider helpers ─────────────────────────────────────────

function detectProvider(p) {
  if (p.provider && PROVIDERS[p.provider]) return p.provider;
  const u = p.apiBaseUrl || '';
  if (u.includes('anthropic.com'))                     return 'claude';
  if (u.includes('generativelanguage.googleapis.com')) return 'gemini';
  return 'openai';
}

function selectProvider(id, ctx) {
  const grid = document.getElementById(ctx + '-provider-grid');
  if (!grid) return;
  grid.querySelectorAll('.provider-btn').forEach(b =>
    b.classList.toggle('sel', b.dataset.provider === id)
  );
  const keyInput = document.getElementById(ctx + '-key');
  if (keyInput) keyInput.placeholder = PROVIDERS[id]?.placeholder || '';
}

function fillLangSelects(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
    if (profile) {
      el.value = id.includes('native')
        ? (profile.nativeLanguage || 'en')
        : (profile.targetLanguage || 'es');
    }
  });
}

// Settings page: "I speak" locked to English; "I'm learning" restricted to Dutch + Italian
const SETTINGS_TARGET_LANGS = ['nl', 'it'];

function fillSettingsLangSelects() {
  const nativeEl = document.getElementById('set-native');
  nativeEl.innerHTML = '<option value="en">English</option>';
  nativeEl.value = 'en';

  const targetEl = document.getElementById('set-target');
  targetEl.innerHTML = LANGUAGES
    .filter(l => SETTINGS_TARGET_LANGS.includes(l.code))
    .map(l => `<option value="${l.code}">${l.name}</option>`)
    .join('');
  targetEl.value = SETTINGS_TARGET_LANGS.includes(profile.targetLanguage)
    ? profile.targetLanguage
    : SETTINGS_TARGET_LANGS[0];
}

// Danger Zone: one button per distinct targetLanguage found in allCards
function renderDangerZone() {
  const body = document.getElementById('danger-zone-body');
  if (!body) return;

  // Cards with a targetLanguage field (generated after v1.5.2)
  const langs = [...new Set(allCards.map(c => c.targetLanguage).filter(Boolean))];
  // Legacy cards with no targetLanguage — group under current profile language
  const hasLegacy = allCards.some(c => !c.targetLanguage);

  if (langs.length === 0 && !hasLegacy) {
    body.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No flashcard data to delete.</p>';
    return;
  }

  const buttons = [];
  langs.forEach(lang => {
    buttons.push(`<button class="btn btn-danger" style="margin:0 10px 10px 0"
      onclick="deleteCourseCards('${lang}')">Forget ${langName(lang)}</button>`);
  });
  if (hasLegacy) {
    const label = langName(profile.targetLanguage);
    buttons.push(`<button class="btn btn-danger" style="margin:0 10px 10px 0"
      onclick="deleteCourseCards(null)">Forget ${label}</button>`);
  }
  body.innerHTML = buttons.join('');
}

async function deleteCourseCards(targetLanguage) {
  const label = langName(targetLanguage || profile.targetLanguage);
  if (!confirm(`Forget all ${label} progress? This cannot be undone.`)) return;
  try {
    const toDelete = targetLanguage
      ? allCards.filter(c => c.targetLanguage === targetLanguage)
      : allCards.filter(c => !c.targetLanguage);
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = db.batch();
      toDelete.slice(i, i + 500).forEach(c =>
        batch.delete(db.collection('users').doc(currentUser.uid).collection('cards').doc(c.id))
      );
      await batch.commit();
    }
    await loadCards();
    renderHome();
    renderCurriculum();
    renderDangerZone();
    toast(`${label} progress deleted.`, 'success');
  } catch (e) {
    toast('Failed to delete: ' + e.message, 'error');
  }
}

// ── Navigation ───────────────────────────────────────────────

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-page="${name}"]`)?.classList.add('active');
}

// ── App init (called after sign-in + data load) ──────────────

function initApp() {
  document.getElementById('app-version-label').textContent = 'v' + APP_VERSION;

  const h = new Date().getHours();
  document.getElementById('home-greeting').textContent =
    h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('home-sub').textContent  =
    `Your ${langName(profile.targetLanguage)} learning overview`;
  document.getElementById('cur-sub').textContent   =
    `Your complete ${langName(profile.targetLanguage)} path · ${getTopics().length} topics across 3 CEFR levels`;

  fillSettingsLangSelects();
  selectProvider(detectProvider(profile), 'set');
  document.getElementById('set-key').value = profile.apiKey || '';

  renderHome();
  renderCurriculum();
  renderDangerZone();
}

// ── Auth lifecycle ───────────────────────────────────────────

function initAuth() {
  auth.onAuthStateChanged(async u => {
    if (u) {
      currentUser = u;
      const doc = await db.collection('users').doc(u.uid).get();
      if (doc.exists) {
        profile = doc.data();
        await loadCards();
        await loadCustomTopics();
        showScreen('dashboard');
        initApp();
      } else {
        showScreen('setup');
        fillLangSelects(['setup-native', 'setup-target']);
      }
    } else {
      showScreen('auth');
    }
  });
}

// ── Event wiring: auth buttons ───────────────────────────────

document.getElementById('btn-signin').onclick = async () => {
  try {
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e) {
    if (e.code === 'auth/popup-blocked') {
      toast('Popup blocked — please allow popups for this site and try again.', 'error');
    } else {
      toast('Sign-in failed: ' + e.message, 'error');
    }
  }
};

document.getElementById('btn-signout').onclick = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    toast('Sign-out failed: ' + e.message, 'error');
  }
};

// ── Event wiring: setup form ─────────────────────────────────

document.getElementById('btn-setup').onclick = async () => {
  const n       = document.getElementById('setup-native').value;
  const t       = document.getElementById('setup-target').value;
  const k       = document.getElementById('setup-key').value.trim();
  const provBtn = document.querySelector('#setup-provider-grid .provider-btn.sel');
  const provId  = provBtn?.dataset.provider || 'openai';
  const prov    = PROVIDERS[provId];

  if (!k)      { toast('Please enter your API key', 'error'); return; }
  if (n === t) { toast('Native and target language must differ', 'error'); return; }

  profile = {
    nativeLanguage: n,
    targetLanguage: t,
    provider:    provId,
    apiBaseUrl:  prov.baseUrl,
    model:       prov.model,
    apiKey:      k,
    createdAt:   Date.now(),
  };
  await db.collection('users').doc(currentUser.uid).set(profile);
  await loadCards();
  await loadCustomTopics();
  showScreen('dashboard');
  initApp();
};

// ── Event wiring: settings form ──────────────────────────────

document.getElementById('btn-save-settings').onclick = async () => {
  const provBtn = document.querySelector('#set-provider-grid .provider-btn.sel');
  const provId  = provBtn?.dataset.provider || detectProvider(profile);
  const prov    = PROVIDERS[provId];
  const updated = {
    ...profile,
    nativeLanguage: document.getElementById('set-native').value,
    targetLanguage: document.getElementById('set-target').value,
    provider:   provId,
    apiBaseUrl: prov.baseUrl,
    model:      prov.model,
    apiKey:     document.getElementById('set-key').value.trim(),
  };
  try {
    await db.collection('users').doc(currentUser.uid).set(updated);
    profile = updated;
    initApp();
    toast('Settings saved!', 'success');
  } catch (e) {
    toast('Failed to save settings: ' + e.message, 'error');
  }
};

// ── Boot ─────────────────────────────────────────────────────
initAuth();
