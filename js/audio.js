// ─────────────────────────────────────────────────────────────
// Audio — Web Speech API text-to-speech for card playback
// ─────────────────────────────────────────────────────────────

// Map app language codes → BCP-47 locales for SpeechSynthesis
const LANG_LOCALES = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
  pt: 'pt-PT', ru: 'ru-RU', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR',
  ar: 'ar-SA', nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL', tr: 'tr-TR',
  hi: 'hi-IN', vi: 'vi-VN', th: 'th-TH', he: 'he-IL', uk: 'uk-UA',
  id: 'id-ID', cs: 'cs-CZ', ro: 'ro-RO', hu: 'hu-HU',
};

let audioMuted = false;

function getLocale(langCode) {
  return LANG_LOCALES[langCode] || langCode;
}

function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakText(text, langCode) {
  if (!('speechSynthesis' in window)) return;
  stopSpeech();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = getLocale(langCode);
  window.speechSynthesis.speak(utt);
}

// Determine which language to use for a card face based on card type
function getFrontLang(card) {
  // sentence_translation and qa have native-language fronts
  if (card.type === 'sentence_translation' || card.type === 'qa') {
    return profile ? profile.nativeLanguage : 'en';
  }
  return profile ? profile.targetLanguage : 'en';
}

function getBackLang(card) {
  // sentence_translation has target-language back (the translated result)
  if (card.type === 'sentence_translation') {
    return profile ? profile.targetLanguage : 'en';
  }
  // fill_blank back is also in target language (the complete sentence)
  if (card.type === 'fill_blank') {
    return profile ? profile.targetLanguage : 'en';
  }
  return profile ? profile.nativeLanguage : 'en';
}

function speakCardFront() {
  const card = studyQueue[studyIdx];
  if (!card) return;
  speakText(card.front, getFrontLang(card));
}

function speakCardBack() {
  const card = studyQueue[studyIdx];
  if (!card) return;
  speakText(card.back, getBackLang(card));
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
    // Unmuting — replay whichever side is currently visible
    if (!flipped) speakCardFront();
    else speakCardBack();
  }
  updateSpeakerBtn();
}

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
