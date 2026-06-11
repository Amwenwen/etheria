// ===================================================
//  FIREBASE.JS  — Init, Auth, Firestore, RTDB
// ===================================================

// Using Firebase CDN (compat mode — no bundler needed)
// Loaded via <script> tags in index.html

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDuZJ2iV8WXRPKol4OFlOtUKWifabu9jF0",
  authDomain:        "warriors-of-etheria.firebaseapp.com",
  projectId:         "warriors-of-etheria",
  storageBucket:     "warriors-of-etheria.firebasestorage.app",
  messagingSenderId: "607146552762",
  appId:             "1:607146552762:web:90872651a4ba26802f8183",
  measurementId:     "G-48NCDBP3E4",
  // Realtime Database URL (add yours from Firebase Console → RTDB)
  databaseURL:       "https://warriors-of-etheria-default-rtdb.firebaseio.com",
};

// ---- Cloudinary config ----
const CLOUDINARY_CONFIG = {
  cloudName:    "dn4hgcdbg",
  uploadPreset: "etheria",
};

// ---- Initialize Firebase ----
firebase.initializeApp(FIREBASE_CONFIG);

const FB = {
  auth:      firebase.auth(),
  db:        firebase.firestore(),
  rtdb:      firebase.database(),
  // analytics optional
};

// ---- Firestore helpers ----
const FS = {
  // Players collection
  playerRef(uid) {
    return FB.db.collection('players').doc(uid);
  },

  // Match history collection (sub-collection under player)
  matchHistoryRef(uid) {
    return FB.db.collection('players').doc(uid).collection('matchHistory');
  },

  // Matchmaking queue
  queueRef() {
    return FB.db.collection('matchmakingQueue');
  },

  // Invites
  inviteRef(inviteId) {
    return FB.db.collection('invites').doc(inviteId);
  },

  // Active matches (metadata)
  matchRef(matchId) {
    return FB.db.collection('matches').doc(matchId);
  },
};

// ---- Realtime Database helpers (low-latency game state) ----
const RTDB = {
  // Live match state
  matchStateRef(matchId) {
    return FB.rtdb.ref(`matches/${matchId}`);
  },

  // Player's live state inside a match
  playerStateRef(matchId, uid) {
    return FB.rtdb.ref(`matches/${matchId}/players/${uid}`);
  },

  // Presence
  presenceRef(uid) {
    return FB.rtdb.ref(`presence/${uid}`);
  },
};

// ---- Generate unique Player ID (e.g. ETH#4821) ----
function generatePlayerId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ETH#${num}`;
}

// ---- Upload avatar to Cloudinary ----
async function uploadAvatarToCloudinary(file) {
  if (CLOUDINARY_CONFIG.cloudName === 'YOUR_CLOUD_NAME') {
    console.warn('Cloudinary not configured yet. Skipping avatar upload.');
    return null;
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json();
  return data.secure_url;
}

// ---- Upload match screenshot to Cloudinary ----
async function uploadMatchScreenshot(dataUrl) {
  if (CLOUDINARY_CONFIG.cloudName === 'YOUR_CLOUD_NAME') return null;
  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', 'match_screenshots');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.secure_url;
}

console.log('[Firebase] Initialized');
