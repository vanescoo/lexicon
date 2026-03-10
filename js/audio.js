// ─────────────────────────────────────────────────────────────
// Audio — LLM TTS (OpenAI-compatible /audio/speech) with
//         Web Speech API fallback for providers without TTS
// ─────────────────────────────────────────────────────────────

// Map app language codes → BCP-47 locales (used by Web Speech fallback)
const LANG_LOCALES = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
  pt: 'pt-PT', ru: 'ru-RU', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR',
  ar: 'ar-SA', nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL', tr: 'tr-TR',
  hi: 'hi-IN', vi: 'vi-VN', th: 'th-TH', he: 'he-IL', uk: 'uk-UA',
  id: 'id-ID', cs: 'cs-CZ', ro: 'ro-RO', hu: 'hu-HU',
};

let audioMuted    = false;
let _currentAudio = null;   // Active <Audio> element for LLM TTS playback

function getLocale(langCode) {
  return LANG_LOCALES[langCode] || langCode;
}

// Stop whatever is currently playing (LLM audio or Web Speech)
function stopSpeech() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Returns true when the configured provider supports OpenAI-compatible TTS
function _llmTTSAvailable() {
  if (!profile) return false;
  const base = profile.apiBaseUrl.replace(/\/$/, '');
  const isGemini = base.includes('generativelanguage.googleapis.com') && !base.includes('/openai');
  const isClaude = base.includes('anthropic.com');
  return !isGemini && !isClaude;
}

// Speak via OpenAI-compatible /audio/speech endpoint.
// Returns a Promise that resolves when the audio finishes playing.
async function _speakViaLLM(text) {
  const base = profile.apiBaseUrl.replace(/\/$/, '');
  const res  = await fetch(`${base}/audio/speech`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy' }),
  });
  if (!res.ok) throw new Error(`TTS API ${res.status}: ${await res.text()}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    _currentAudio = audio;
    audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; reject(new Error('Audio playback error')); };
    audio.play().catch(reject);
  });
}

// Speak via browser Web Speech API.
// Returns a Promise that resolves when the utterance ends (or on error).
function _speakViaWebSpeech(text, langCode) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = getLocale(langCode);
    utt.onend  = resolve;
    utt.onerror = resolve;  // resolve so sequence continues even on error
    window.speechSynthesis.speak(utt);
  });
}

// Play an ordered list of {text, langCode} items one after another.
// LLM TTS is used when available; Web Speech is the fallback.
async function _speakSequence(items) {
  for (const { text, langCode } of items) {
    if (audioMuted) break;
    if (_llmTTSAvailable()) {
      try {
        await _speakViaLLM(text);
      } catch (_) {
        // LLM TTS failed — fall back to Web Speech for this item
        await _speakViaWebSpeech(text, langCode);
      }
    } else {
      await _speakViaWebSpeech(text, langCode);
    }
  }
}

// ── Language helpers ──────────────────────────────────────────

function getFrontLang(card) {
  if (card.type === 'sentence_translation' || card.type === 'qa') {
    return profile ? profile.nativeLanguage : 'en';
  }
  return profile ? profile.targetLanguage : 'en';
}

function getBackLang(card) {
  if (card.type === 'sentence_translation') return profile ? profile.targetLanguage : 'en';
  if (card.type === 'fill_blank')           return profile ? profile.targetLanguage : 'en';
  return profile ? profile.nativeLanguage : 'en';
}

// ── Public playback functions ─────────────────────────────────

// Front side: speak the word / term / question
function speakCardFront() {
  const card = studyQueue[studyIdx];
  if (!card) return;
  stopSpeech();
  _speakSequence([{ text: card.front, langCode: getFrontLang(card) }]);
}

// Back side: speak word/term first, then the translation / answer.
// This covers word + example sentence + translation in one pass.
function speakCardBack() {
  const card = studyQueue[studyIdx];
  if (!card) return;
  stopSpeech();
  _speakSequence([
    { text: card.front, langCode: getFrontLang(card) },
    { text: card.back,  langCode: getBackLang(card)  },
  ]);
}

function autoPlayFront() {
  updateSpeakerBtn();
  if (!audioMuted) speakCardFront();
}

function autoPlayBack() {
  updateSpeakerBtn();
  if (!audioMuted) speakCardBack();
}

function toggleMute() {
  audioMuted = !audioMuted;
  if (audioMuted) {
    stopSpeech();
  } else {
    if (!flipped) speakCardFront();
    else          speakCardBack();
  }
  updateSpeakerBtn();
}

// ── Speaker button UI ─────────────────────────────────────────

function updateSpeakerBtn() {
  const btn = document.getElementById('btn-speaker');
  if (!btn) return;
  btn.title     = audioMuted ? 'Unmute audio (U)' : 'Mute audio (U)';
  btn.innerHTML = audioMuted ? _svgSpeakerOff() : _svgSpeakerOn();
}

function _svgSpeakerOn() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>`;
}

function _svgSpeakerOff() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>`;
}

// Keyboard shortcut: U to toggle mute while in study screen
document.addEventListener('keydown', e => {
  if (e.key === 'u' || e.key === 'U') {
    if (document.getElementById('screen-study').classList.contains('active')) {
      toggleMute();
    }
  }
});
