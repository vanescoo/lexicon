// ─────────────────────────────────────────────────────────────
// Audio Cache — IndexedDB storage for pre-generated TTS clips
//
// Keys:   "{cardId}_front" | "{cardId}_back"
// Values: { format: 'openai'|'gemini', data: ArrayBuffer|string }
//   openai → ArrayBuffer (raw MP3/Ogg bytes from /audio/speech)
//   gemini → string (base64 L16 PCM from generateContent AUDIO)
// ─────────────────────────────────────────────────────────────

const _AC_DB_NAME    = 'lexicon-audio';
const _AC_DB_VERSION = 1;
const _AC_STORE      = 'clips';

let _acDbPromise = null; // singleton DB connection

function _acOpen() {
  if (_acDbPromise) return _acDbPromise;
  _acDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(_AC_DB_NAME, _AC_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_AC_STORE)) {
        db.createObjectStore(_AC_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => { _acDbPromise = null; reject(req.error); };
  });
  return _acDbPromise;
}

async function audioCacheGet(key) {
  try {
    const db = await _acOpen();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(_AC_STORE, 'readonly')
                    .objectStore(_AC_STORE)
                    .get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch (_) {
    return null; // cache unavailable — fall back to live TTS
  }
}

async function audioCacheSet(key, value) {
  try {
    const db = await _acOpen();
    await new Promise((resolve, reject) => {
      const req = db.transaction(_AC_STORE, 'readwrite')
                    .objectStore(_AC_STORE)
                    .put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (_) {
    // Silently ignore write failures; live TTS will cover playback
  }
}
