// ─────────────────────────────────────────────────────────────
// App version
// ─────────────────────────────────────────────────────────────
// !! MANDATORY RULE FOR EVERY AI-ASSISTED CHANGE !!
//    1. Increment APP_VERSION (patch / minor / major as appropriate).
//    2. Append a new entry to log.txt in the repo root:
//         [YYYY-MM-DD] vX.Y.Z – short description of committed changes
//    3. Commit BOTH this file and log.txt together with each PR/push.
//    The version string is displayed to users in the UI; keep it current.
const APP_VERSION = '1.7.0';

// ─────────────────────────────────────────────────────────────
// Firebase — replace with your project's config
// See index.html comments for setup instructions
// ─────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB_Ar8Nc7sVPVWgor4b9Zm8AprFfANDUmA',
  authDomain:        'lexicon-95ce3.web.app',
  projectId:         'lexicon-95ce3',
  storageBucket:     'lexicon-95ce3.firebasestorage.app',
  messagingSenderId: '387959601596',
  appId:             '1:387959601596:web:512155582a02ccbf9b93b9',
};

// ─────────────────────────────────────────────────────────────
// CURRICULUM — 42 topics across 3 CEFR levels
//   A1: 12 topics × 20 words
//   A2: 12 topics × 40 words
//   B1: 18 topics × 60 words
// ─────────────────────────────────────────────────────────────
const CURRICULUM = [
  // A1 — Foundations
  { id:'a1_01', level:'A1', order:1,  name:'Greetings & Farewells' },
  { id:'a1_02', level:'A1', order:2,  name:'Numbers & Counting' },
  { id:'a1_03', level:'A1', order:3,  name:'Colors & Shapes' },
  { id:'a1_04', level:'A1', order:4,  name:'Days, Months & Seasons' },
  { id:'a1_05', level:'A1', order:5,  name:'Family Members' },
  { id:'a1_06', level:'A1', order:6,  name:'Food & Drinks' },
  { id:'a1_07', level:'A1', order:7,  name:'Personal Pronouns' },
  { id:'a1_08', level:'A1', order:8,  name:'Basic Verbs — To Be & To Have' },
  { id:'a1_09', level:'A1', order:9,  name:'Body Parts' },
  { id:'a1_10', level:'A1', order:10, name:'Weather & Climate' },
  { id:'a1_11', level:'A1', order:11, name:'Common Verbs — Daily Actions' },
  { id:'a1_12', level:'A1', order:12, name:'Objects Around the House' },
  // A2 — Building Blocks
  { id:'a2_01', level:'A2', order:13, name:'Shopping & Prices' },
  { id:'a2_02', level:'A2', order:14, name:'Travel & Transport' },
  { id:'a2_03', level:'A2', order:15, name:'Home & Rooms' },
  { id:'a2_04', level:'A2', order:16, name:'Clothing & Fashion' },
  { id:'a2_05', level:'A2', order:17, name:'Hobbies & Free Time' },
  { id:'a2_06', level:'A2', order:18, name:'Simple Past Tense' },
  { id:'a2_07', level:'A2', order:19, name:'Simple Future' },
  { id:'a2_08', level:'A2', order:20, name:'Descriptive Adjectives' },
  { id:'a2_09', level:'A2', order:21, name:'Prepositions of Place & Time' },
  { id:'a2_10', level:'A2', order:22, name:'Asking Questions' },
  { id:'a2_11', level:'A2', order:23, name:'Health & the Doctor' },
  { id:'a2_12', level:'A2', order:24, name:'School & Learning' },
  // B1 — Intermediate
  { id:'b1_01', level:'B1', order:25, name:'Work & Professions' },
  { id:'b1_02', level:'B1', order:26, name:'Health & the Body' },
  { id:'b1_03', level:'B1', order:27, name:'Expressing Opinions' },
  { id:'b1_04', level:'B1', order:28, name:'Conditional Sentences' },
  { id:'b1_05', level:'B1', order:29, name:'Subjunctive & Mood Intro' },
  { id:'b1_06', level:'B1', order:30, name:'Culture & Traditions' },
  { id:'b1_07', level:'B1', order:31, name:'Environment & Nature' },
  { id:'b1_08', level:'B1', order:32, name:'Technology & Devices' },
  { id:'b1_09', level:'B1', order:33, name:'Relationships & Emotions' },
  { id:'b1_10', level:'B1', order:34, name:'Linking & Complex Sentences' },
  { id:'b1_11', level:'B1', order:35, name:'Travel & Holidays' },
  { id:'b1_12', level:'B1', order:36, name:'Food & Restaurants' },
  { id:'b1_13', level:'B1', order:37, name:'Sports & Fitness' },
  { id:'b1_14', level:'B1', order:38, name:'Media & Entertainment' },
  { id:'b1_15', level:'B1', order:39, name:'Money & Finance' },
  { id:'b1_16', level:'B1', order:40, name:'Environment & Climate Change' },
  { id:'b1_17', level:'B1', order:41, name:'Social Issues & Society' },
  { id:'b1_18', level:'B1', order:42, name:'Formal & Informal Register' },
];

// ─────────────────────────────────────────────────────────────
// CEFR level display names
// ─────────────────────────────────────────────────────────────
const LEVEL_NAMES = {
  A1: 'Foundations',
  A2: 'Building Blocks',
  B1: 'Intermediate',
};

// ─────────────────────────────────────────────────────────────
// Word targets per CEFR level
//   LEVEL_WORD_TARGETS    — cumulative words needed to "pass" a level
//   LEVEL_WORD_INCREMENTS — words each level adds on top of the previous
//   TOPIC_WORD_TARGETS    — words generated per topic (also the unlock unit)
//
// A1: 12 topics × 20 words =  240 words
// A2: 12 topics × 40 words =  480 words  (cumulative: 720)
// B1: 18 topics × 60 words = 1080 words  (cumulative: 1800)
//
// Next level unlocks when 75% of the previous level's words are mastered.
// ─────────────────────────────────────────────────────────────
const LEVEL_WORD_TARGETS    = { A1:  240, A2:  720, B1: 1800 };
const LEVEL_WORD_INCREMENTS = { A1:  240, A2:  480, B1: 1080 };
const TOPIC_WORD_TARGETS    = { A1:   20, A2:   40, B1:   60 };

// ─────────────────────────────────────────────────────────────
// Leitner review intervals in days (index = box number)
// ─────────────────────────────────────────────────────────────
const INTERVALS = [0, 1, 2, 4, 8, 16];

// ─────────────────────────────────────────────────────────────
// Supported languages
// ─────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code:'en', name:'English' },          { code:'es', name:'Spanish' },
  { code:'fr', name:'French' },           { code:'de', name:'German' },
  { code:'it', name:'Italian' },          { code:'pt', name:'Portuguese' },
  { code:'ru', name:'Russian' },          { code:'ja', name:'Japanese' },
  { code:'zh', name:'Chinese (Mandarin)' },{ code:'ko', name:'Korean' },
  { code:'ar', name:'Arabic' },           { code:'nl', name:'Dutch' },
  { code:'sv', name:'Swedish' },          { code:'pl', name:'Polish' },
  { code:'tr', name:'Turkish' },          { code:'hi', name:'Hindi' },
  { code:'vi', name:'Vietnamese' },       { code:'th', name:'Thai' },
  { code:'he', name:'Hebrew' },           { code:'uk', name:'Ukrainian' },
  { code:'id', name:'Indonesian' },       { code:'cs', name:'Czech' },
  { code:'ro', name:'Romanian' },         { code:'hu', name:'Hungarian' },
];

// ─────────────────────────────────────────────────────────────
// Supported LLM providers
// ─────────────────────────────────────────────────────────────
const PROVIDERS = {
  openai: { baseUrl: 'https://api.openai.com/v1',                               model: 'gpt-4o',           placeholder: 'sk-...' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta',        model: 'gemini-2.5-flash', placeholder: 'AIza...' },
  claude: { baseUrl: 'https://api.anthropic.com',                               model: 'claude-opus-4-6',  placeholder: 'sk-ant-...' },
};
