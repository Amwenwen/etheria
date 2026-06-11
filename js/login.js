// ===================================================
//  LOGIN.JS  — Standalone auth logic for login.html
//             Redirects to index.html on success
// ===================================================

const Login = {
  _redirecting: false,

  // ---- INIT ----
  init() {
    // If already signed in on page load, redirect immediately
    FB.auth.onAuthStateChanged(async (user) => {
      if (user && !this._redirecting) {
        this._redirecting = true;
        try {
          await this._ensureProfile(user);
        } catch (e) {
          console.warn('[Login] Profile ensure failed:', e);
        }
        window.location.replace('index.html');
      }
    });

    this._bindUI();
  },

  // ---- BIND UI ----
  _bindUI() {
    document.getElementById('tabLogin').addEventListener('click', () => this._showTab('login'));
    document.getElementById('tabRegister').addEventListener('click', () => this._showTab('register'));

    document.getElementById('btnGoogleLogin').addEventListener('click', () => this._googleSignIn());
    document.getElementById('btnGoogleRegister').addEventListener('click', () => this._googleSignIn());

    document.getElementById('btnEmailLogin').addEventListener('click', () => this._emailLogin());
    document.getElementById('btnEmailRegister').addEventListener('click', () => this._emailRegister());

    document.getElementById('loginEmail').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._emailLogin();
    });
    document.getElementById('loginPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') this._emailLogin();
    });
  },

  _showTab(tab) {
    document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tabLogin').classList.toggle('active-tab', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active-tab', tab === 'register');
    this._clearError();
  },

  // ---- GOOGLE SIGN-IN ----
  async _googleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      this._setLoading(true);
      this._clearError();
      const cred = await FB.auth.signInWithPopup(provider);
      await this._ensureProfile(cred.user);
      this._redirecting = true;
      window.location.replace('index.html');
    } catch (err) {
      console.error('[Login] Google error:', err);
      this._showError(err.message);
      this._setLoading(false);
    }
  },

  // ---- EMAIL LOGIN ----
  async _emailLogin() {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { this._showError('Fill in all fields'); return; }
    try {
      this._setLoading(true);
      this._clearError();
      const cred = await FB.auth.signInWithEmailAndPassword(email, password);
      await this._ensureProfile(cred.user);
      this._redirecting = true;
      window.location.replace('index.html');
    } catch (err) {
      console.error('[Login] Email login error:', err.code, err.message);
      this._showError(this._friendlyError(err.code));
      this._setLoading(false);
    }
  },

  // ---- EMAIL REGISTER ----
  async _emailRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm  = document.getElementById('regConfirm').value;

    if (!username || !email || !password) { this._showError('Fill in all fields'); return; }
    if (password !== confirm) { this._showError('Passwords do not match'); return; }
    if (password.length < 6)  { this._showError('Password must be at least 6 characters'); return; }

    try {
      this._setLoading(true);
      this._clearError();
      const cred = await FB.auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: username });
      await this._createPlayerProfile(cred.user, username);
      this._redirecting = true;
      window.location.replace('index.html');
    } catch (err) {
      console.error('[Login] Register error:', err.code, err.message);
      this._showError(this._friendlyError(err.code));
      this._setLoading(false);
    }
  },

  // ---- ENSURE PROFILE EXISTS ----
  async _ensureProfile(user) {
    const snap = await FS.playerRef(user.uid).get();
    if (!snap.exists()) {
      await this._createPlayerProfile(user, user.displayName || 'Warrior');
    }
  },

  // ---- CREATE PLAYER PROFILE ----
  async _createPlayerProfile(user, username) {
    const playerId = generatePlayerId();
    const profile = {
      uid:          user.uid,
      username:     username,
      playerId:     playerId,
      email:        user.email || '',
      avatarUrl:    user.photoURL || '',
      level:        1,
      xp:           0,
      wins:         0,
      losses:       0,
      totalKills:   0,
      totalDeaths:  0,
      totalAssists: 0,
      totalGold:    0,
      gamesPlayed:  0,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
      lastSeen:     firebase.firestore.FieldValue.serverTimestamp(),
      online:       true,
    };
    await FS.playerRef(user.uid).set(profile);
  },

  // ---- HELPERS ----
  _showError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  _clearError() {
    const el = document.getElementById('authError');
    el.textContent = '';
    el.classList.add('hidden');
  },

  _setLoading(on) {
    document.querySelectorAll('#authScreen button').forEach(b => b.disabled = on);
    const spinner = document.getElementById('authSpinner');
    if (spinner) spinner.classList.toggle('hidden', !on);
  },

  _friendlyError(code) {
    const map = {
      'auth/user-not-found':         'No account with that email.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/email-already-in-use':   'Email already in use.',
      'auth/invalid-email':          'Invalid email address.',
      'auth/weak-password':          'Password is too weak.',
      'auth/too-many-requests':      'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/unauthorized-domain':    'This domain is not authorized. Contact the developer.',
      'auth/operation-not-allowed':  'Sign-in method not enabled. Contact the developer.',
      'auth/invalid-credential':     'Incorrect email or password.',
    };
    return map[code] || 'Something went wrong. Try again.';
  },
};

// Boot
window.addEventListener('load', () => {
  Login.init();
});
