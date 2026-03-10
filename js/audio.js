// ─────────────────────────────────────────────────────────────
// Audio — LLM TTS (OpenAI /audio/speech · Gemini generateContent)
//         with Web Speech API fallback for Claude
//
// Uses Web Audio API (AudioContext) for LLM TTS so that:
//   • Playback is never blocked by browser autoplay policy after async fetches
//   • Volume is always consistent (no browser fade-in ramp)
//
// Overlap prevention — two layers:
//   1. AbortController  — cancels the in-flight HTTP fetch immediately
//   2. Sequence ID (_seqId) — guards against stale audio that arrives after
//      a new play request has already started (e.g. very fast flips)
// ─────────────────────────────────────────────────────────────

// Map app language codes → BCP-47 locales (used by Web Speech fallback)
const LANG_LOCALES = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
  pt: 'pt-PT', ru: 'ru-RU', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR',
  ar: 'ar-SA', nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL', tr: 'tr-TR',
  hi: 'hi-IN', vi: 'vi-VN', th: 'th-TH', he: 'he-IL', uk: 'uk-UA',
  id: 'id-ID', cs: 'cs-CZ', ro: 'ro-RO', hu: 'hu-HU',
};

let audioMuted     = false;
let _audioCtx      = null;   // shared AudioContext — stays unlocked after first gesture
let _currentSource = null;   // active AudioBufferSourceNode
let _currentAbort  = null;   // AbortController for the in-flight TTS fetch
let _seqId         = 0;      // incremented on every new play; stale completions are dropped

function getLocale(langCode) {
  return LANG_LOCALES[langCode] || langCode;
}

// Create (or resume) the AudioContext.  Called inside user-gesture handlers so
// the context starts in "running" state and stays that way for the session.
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

// Unlock the AudioContext on the very first user click anywhere on the page.
document.addEventListener('click', () => {
  const ctx = _getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
});

// Stop everything: cancel in-flight fetch, stop playing source, stop Web Speech.
function stopSpeech() {
  _seqId++;                                         // invalidate any in-flight sequence
  if (_currentAbort)  { _currentAbort.abort(); _currentAbort = null; }
  if (_currentSource) { try { _currentSource.stop(); } catch (_) {} _currentSource = null; }
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

// Play an AudioBuffer through the shared AudioContext.
// Resolves when playback finishes.
function _playAudioBuffer(audioBuffer) {
  const ctx = _getAudioCtx();
  return new Promise(resolve => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    _currentSource = source;
    source.onended = () => { _currentSource = null; resolve(); };
    source.start(0);
  });
}

// Decode Gemini's base64 L16 PCM (mono, 24 kHz) directly into an AudioBuffer.
function _pcmToAudioBuffer(base64pcm) {
  const ctx        = _getAudioCtx();
  const raw        = atob(base64pcm);
  const numSamples = raw.length / 2;
  const abuf       = ctx.createBuffer(1, numSamples, 24000);
  const ch         = abuf.getChannelData(0);
  for (let i = 0; i < numSamples; i++) {
    let s = (raw.charCodeAt(i * 2)) | (raw.charCodeAt(i * 2 + 1) << 8);
    if (s > 32767) s -= 65536;
    ch[i] = s / 32768.0;
  }
  return abuf;
}

// Speak via OpenAI-compatible /audio/speech endpoint.
// Returns early (silently) if superseded by a newer sequence.
async function _speakViaOpenAI(text, id) {
  const ctrl = new AbortController();
  _currentAbort = ctrl;
  const base = profile.apiBaseUrl.replace(/\/$/, '');
  const res  = await fetch(`${base}/audio/speech`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${profile.apiKey}` },
    body:    JSON.stringify({ model: 'tts-1', input: text, voice: 'alloy' }),
    signal:  ctrl.signal,
  });
  _currentAbort = null;
  if (_seqId !== id) return;
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  const ctx         = _getAudioCtx();
  const audioBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
  if (_seqId !== id) return;
  return _playAudioBuffer(audioBuffer);
}

// Speak via Gemini generateContent with AUDIO response modality.
// Returns early (silently) if superseded by a newer sequence.
async function _speakViaGemini(text, id) {
  const ctrl = new AbortController();
  _currentAbort = ctrl;
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
    signal: ctrl.signal,
  });
  _currentAbort = null;
  if (_seqId !== id) return;
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${await res.text()}`);
  const data   = await res.json();
  const b64pcm = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64pcm) throw new Error('Gemini TTS: no audio in response');
  if (_seqId !== id) return;
  return _playAudioBuffer(_pcmToAudioBuffer(b64pcm));
}

// Speak via browser Web Speech API.
function _speakViaWebSpeech(text, langCode, id) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || _seqId !== id) { resolve(); return; }
    const utt   = new SpeechSynthesisUtterance(text);
    utt.lang    = getLocale(langCode);
    utt.onend   = resolve;
    utt.onerror = resolve;
    window.speechSynthesis.speak(utt);
  });
}

// Play an ordered list of {text, langCode} items one after another.
// Each item checks the sequence ID before and after its fetch so that
// any flip or card advance immediately silences everything in progress.
async function _speakSequence(items) {
  const id       = ++_seqId;
  const provider = _ttsProvider();
  for (const { text, langCode } of items) {
    if (audioMuted || _seqId !== id) return;
    try {
      if      (provider === 'openai') await _speakViaOpenAI(text, id);
      else if (provider === 'gemini') await _speakViaGemini(text, id);
      else                            await _speakViaWebSpeech(text, langCode, id);
    } catch (_) {
      if (_seqId !== id) return;
      await _speakViaWebSpeech(text, langCode, id);
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

function speakCardFront() {
  const card = studyQueue[studyIdx];
  if (!card) return;
  stopSpeech();
  _speakSequence([{ text: card.front, langCode: getFrontLang(card) }]);
}

function speakCardBack() {
  const card = studyQueue[studyIdx];
  if (!card) return;
  stopSpeech();
  _speakSequence([{ text: card.back, langCode: getBackLang(card) }]);
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
