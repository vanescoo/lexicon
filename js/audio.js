// ─────────────────────────────────────────────────────────────
// Audio — LLM TTS (OpenAI /audio/speech · Gemini generateContent)
//         with Web Speech API fallback for Claude
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

// Returns 'openai' | 'gemini' | 'none' for the active provider
function _ttsProvider() {
  if (!profile) return 'none';
  const base = profile.apiBaseUrl.replace(/\/$/, '');
  if (base.includes('generativelanguage.googleapis.com') && !base.includes('/openai')) return 'gemini';
  if (base.includes('anthropic.com')) return 'none';
  return 'openai';
}

// Play an audio blob URL; resolves when playback ends.
function _playBlobUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    _currentAudio = audio;
    audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; reject(new Error('Audio playback error')); };
    audio.play().catch(reject);
  });
}

// Wrap raw L16 PCM (base64) in a WAV container so the browser can play it.
// Gemini TTS returns mono 16-bit PCM at 24 000 Hz.
function _pcmToWavBlob(base64pcm) {
  const raw    = atob(base64pcm);
  const pcm    = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) pcm[i] = raw.charCodeAt(i);

  const sampleRate    = 24000;
  const numChannels   = 1;
  const bitsPerSample = 16;
  const byteRate      = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign    = numChannels * bitsPerSample / 8;

  const buf  = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buf);
  const str  = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  str(0,  'RIFF'); view.setUint32(4,  36 + pcm.length, true); str(8,  'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16,              true);
  view.setUint16(20, 1,            true);   // PCM
  view.setUint16(22, numChannels,  true);
  view.setUint32(24, sampleRate,   true);
  view.setUint32(28, byteRate,     true);
  view.setUint16(32, blockAlign,   true);
  view.setUint16(34, bitsPerSample,true);
  str(36, 'data'); view.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);

  return new Blob([buf], { type: 'audio/wav' });
}

// Speak via OpenAI-compatible /audio/speech endpoint.
async function _speakViaOpenAI(text) {
  const base = profile.apiBaseUrl.replace(/\/$/, '');
  const res  = await fetch(`${base}/audio/speech`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.apiKey}` },
    body:    JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy' }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  return _playBlobUrl(URL.createObjectURL(await res.blob()));
}

// Speak via Gemini generateContent with AUDIO response modality.
// Uses the dedicated TTS model, not the chat model.
async function _speakViaGemini(text) {
  const base = profile.apiBaseUrl.replace(/\/$/, '');
  const url  = `${base}/models/gemini-2.5-flash-preview-tts:generateContent?key=${profile.apiKey}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      contents:         [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${await res.text()}`);
  const data   = await res.json();
  const b64pcm = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64pcm) throw new Error('Gemini TTS: no audio in response');
  return _playBlobUrl(URL.createObjectURL(_pcmToWavBlob(b64pcm)));
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
// Routes to the provider's TTS; falls back to Web Speech on error or for Claude.
async function _speakSequence(items) {
  const provider = _ttsProvider();
  for (const { text, langCode } of items) {
    if (audioMuted) break;
    try {
      if      (provider === 'openai') await _speakViaOpenAI(text);
      else if (provider === 'gemini') await _speakViaGemini(text);
      else                            await _speakViaWebSpeech(text, langCode);
    } catch (_) {
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
