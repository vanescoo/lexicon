// ─────────────────────────────────────────────────────────────
// Shared mutable application state
// All modules read/write these variables directly (global scope).
// ─────────────────────────────────────────────────────────────

// Firebase handles
let db, auth, currentUser, profile;

// Card data
let allCards   = [];   // full list of user cards loaded from Firestore
let topicStats = {};   // topicId → { total: number, advanced: number }

// Generation modal state
let genTopicId = null;

// Study session state
let studyQueue  = [];
let studyIdx    = 0;
let studyGot    = 0;
let studyMissed = 0;
let flipped     = false;
