// ─────────────────────────────────────────────────────────────
// App version
// ─────────────────────────────────────────────────────────────
// !! MANDATORY RULE FOR EVERY AI-ASSISTED CHANGE !!
//    1. Increment APP_VERSION (patch / minor / major as appropriate).
//    2. Append a new entry to log.txt in the repo root:
//         [YYYY-MM-DD] vX.Y.Z – short description of committed changes
//    3. Commit BOTH this file and log.txt together with each PR/push.
//    The version string is displayed to users in the UI; keep it current.
const APP_VERSION = '1.4.4';

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
// CURRICULUM — 60 hardcoded topics across 6 CEFR levels
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
  // A2 — Building Blocks
  { id:'a2_01', level:'A2', order:11, name:'Shopping & Prices' },
  { id:'a2_02', level:'A2', order:12, name:'Travel & Transport' },
  { id:'a2_03', level:'A2', order:13, name:'Home & Rooms' },
  { id:'a2_04', level:'A2', order:14, name:'Clothing & Fashion' },
  { id:'a2_05', level:'A2', order:15, name:'Hobbies & Free Time' },
  { id:'a2_06', level:'A2', order:16, name:'Simple Past Tense' },
  { id:'a2_07', level:'A2', order:17, name:'Simple Future' },
  { id:'a2_08', level:'A2', order:18, name:'Descriptive Adjectives' },
  { id:'a2_09', level:'A2', order:19, name:'Prepositions of Place & Time' },
  { id:'a2_10', level:'A2', order:20, name:'Asking Questions' },
  // B1 — Intermediate
  { id:'b1_01', level:'B1', order:21, name:'Work & Professions' },
  { id:'b1_02', level:'B1', order:22, name:'Health & the Body' },
  { id:'b1_03', level:'B1', order:23, name:'Expressing Opinions' },
  { id:'b1_04', level:'B1', order:24, name:'Conditional Sentences' },
  { id:'b1_05', level:'B1', order:25, name:'Subjunctive & Mood Intro' },
  { id:'b1_06', level:'B1', order:26, name:'Culture & Traditions' },
  { id:'b1_07', level:'B1', order:27, name:'Environment & Nature' },
  { id:'b1_08', level:'B1', order:28, name:'Technology & Devices' },
  { id:'b1_09', level:'B1', order:29, name:'Relationships & Emotions' },
  { id:'b1_10', level:'B1', order:30, name:'Linking & Complex Sentences' },
  // B2 — Upper Intermediate
  { id:'b2_01', level:'B2', order:31, name:'Abstract Nouns' },
  { id:'b2_02', level:'B2', order:32, name:'Advanced Conditionals' },
  { id:'b2_03', level:'B2', order:33, name:'Passive Voice' },
  { id:'b2_04', level:'B2', order:34, name:'Idioms & Expressions' },
  { id:'b2_05', level:'B2', order:35, name:'News & Media Language' },
  { id:'b2_06', level:'B2', order:36, name:'Politics & Society' },
  { id:'b2_07', level:'B2', order:37, name:'Science & Research' },
  { id:'b2_08', level:'B2', order:38, name:'Literature & Arts' },
  { id:'b2_09', level:'B2', order:39, name:'Advanced Verb Forms' },
  { id:'b2_10', level:'B2', order:40, name:'Nuance, Register & Tone' },
  // C1 — Advanced
  { id:'c1_01', level:'C1', order:41, name:'Formal Writing & Register' },
  { id:'c1_02', level:'C1', order:42, name:'Rhetoric & Persuasion' },
  { id:'c1_03', level:'C1', order:43, name:'Regional Dialects & Accents' },
  { id:'c1_04', level:'C1', order:44, name:'False Friends & Pitfalls' },
  { id:'c1_05', level:'C1', order:45, name:'Advanced Grammar Structures' },
  { id:'c1_06', level:'C1', order:46, name:'Philosophy & Abstract Ideas' },
  { id:'c1_07', level:'C1', order:47, name:'Economics & Finance' },
  { id:'c1_08', level:'C1', order:48, name:'Advanced Idioms & Metaphors' },
  { id:'c1_09', level:'C1', order:49, name:'Collocations & Word Pairs' },
  { id:'c1_10', level:'C1', order:50, name:'Style & Register Shifting' },
  // C2 — Mastery
  { id:'c2_01', level:'C2', order:51, name:'Native Flow & Expressions' },
  { id:'c2_02', level:'C2', order:52, name:'Proverbs & Sayings' },
  { id:'c2_03', level:'C2', order:53, name:'Literary & Poetic Style' },
  { id:'c2_04', level:'C2', order:54, name:'Academic & Scholarly Language' },
  { id:'c2_05', level:'C2', order:55, name:'Humor & Wordplay' },
  { id:'c2_06', level:'C2', order:56, name:'Slang & Colloquialisms' },
  { id:'c2_07', level:'C2', order:57, name:'Complex Syntax' },
  { id:'c2_08', level:'C2', order:58, name:'Rare & Elevated Vocabulary' },
  { id:'c2_09', level:'C2', order:59, name:'Cultural References & Allusions' },
  { id:'c2_10', level:'C2', order:60, name:'Full Mastery Review' },
];

// ─────────────────────────────────────────────────────────────
// CEFR level display names
// ─────────────────────────────────────────────────────────────
const LEVEL_NAMES = {
  A1: 'Foundations',
  A2: 'Building Blocks',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Mastery',
};

// ─────────────────────────────────────────────────────────────
// Word targets per CEFR level
//   LEVEL_WORD_TARGETS    — cumulative words needed to "pass" a level
//   LEVEL_WORD_INCREMENTS — words each level adds on top of the previous
//   TOPIC_WORD_TARGETS    — minimum advanced cards per topic (increment / 10)
//   TOPIC_GEN_DEFAULTS    — sensible default card count in the generation modal
// ─────────────────────────────────────────────────────────────
const LEVEL_WORD_TARGETS    = { A1:  750, A2: 1500, B1:  2500, B2:  5000, C1:  8000, C2: 16000 };
const LEVEL_WORD_INCREMENTS = { A1:  750, A2:  750, B1:  1000, B2:  2500, C1:  3000, C2:  8000 };
const TOPIC_WORD_TARGETS    = { A1:   75, A2:   75, B1:   100, B2:   250, C1:   300, C2:   800 };
const TOPIC_GEN_DEFAULTS    = { A1:   10, A2:   10, B1:    20, B2:    30, C1:    30, C2:    30 };

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
