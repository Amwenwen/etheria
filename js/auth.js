// ===================================================
//  AUTH.JS  — Authentication (Google + Email/Password)
//             Player profile creation
// ===================================================

const Auth = {
  currentUser: null,   // Firebase user object
  playerData:  null,   // Firestore player document

  // ---- INIT ----
  init() {
    FB.auth.onAuthStateChanged(async (user) => {
      if (user) {
        await this._onSignedIn(user);
      } else {
        this._onSignedOut();
      }
    });

    this._bindAuthUI();
  },

  // ---- BIND UI EVENTS ----
  _bindAuthUI() {
    // Switch tabs
    document.getElementById('tabLogin').addEventListener('click', () => this._showTab('login'));
    document.getElementById('tabRegister').addEventListener('click', () => this._showTab('register'));

    // Google sign-in
    document.getElementById('btnGoogleLogin').addEventListener('click', () => this._googleSignIn());
    document.getElementById('btnGoogleRegister').addEventListener('click', () => this._googleSignIn());

    // Email login
    document.getElementById('btnEmailLogin').addEventListener('click', () => this._emailLogin());

    // Email register
    document.getElementById('btnEmailRegister').addEventListener('click', () => this._emailRegister());

    // Sign out
    document.getElementById('btnSignOut').addEventListener('click', () => this._signOut());

    // Avatar upload
    document.getElementById('avatarInput').addEventListener('change', (e) => {
      this._handleAvatarUpload(e.target.files[0]);
    });
    document.getElementById('avatarUploadBtn').addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });

    // Enter key on login form
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
      await FB.auth.signInWithPopup(provider);
    } catch (err) {
      this._showError(err.message);
    } finally {
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
      await FB.auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      this._showError(this._friendlyError(err.code));
    } finally {
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
      const cred = await FB.auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: username });
      await this._createPlayerProfile(cred.user, username);
    } catch (err) {
      this._showError(this._friendlyError(err.code));
    } finally {
      this._setLoading(false);
    }
  },

  // ---- SIGN OUT ----
  async _signOut() {
    await Auth._setOffline();
    await FB.auth.signOut();
    document.getElementById('profileScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    this.currentUser = null;
    this.playerData  = null;
  },

  // ---- ON SIGNED IN ----
  async _onSignedIn(user) {
    this.currentUser = user;
    // Get or create player profile
    const snap = await FS.playerRef(user.uid).get();
    if (!snap.exists()) {
      await this._createPlayerProfile(user, user.displayName || 'Warrior');
    }
    this.playerData = (await FS.playerRef(user.uid).get()).data();

    // Set online presence
    await this._setOnline();

    // Start listening for invites now that we have a UID
    Matchmaking.listenForInvites();

    // Hide auth, show main menu
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');

    // Update profile badge in menu
    this._updateMenuBadge();

    console.log('[Auth] Signed in:', user.uid, 'Player ID:', this.playerData.playerId);
  },

  _onSignedOut() {
    this.currentUser = null;
    this.playerData  = null;
    // Show auth screen
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('heroSelect').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.getElementById('profileScreen').classList.add('hidden');
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
    this.playerData = profile;
  },

  // ---- PRESENCE ----
  async _setOnline() {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    // Firestore last seen
    await FS.playerRef(uid).update({
      online:   true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    // RTDB presence with auto-disconnect
    const presRef = RTDB.presenceRef(uid);
    await presRef.set({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    presRef.onDisconnect().set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
  },

  async _setOffline() {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    await FS.playerRef(uid).update({ online: false }).catch(() => {});
    await RTDB.presenceRef(uid).set({ online: false }).catch(() => {});
  },

  // ---- AVATAR UPLOAD ----
  async _handleAvatarUpload(file) {
    if (!file || !this.currentUser) return;
    try {
      document.getElementById('avatarUploadBtn').textContent = '⏳ Uploading...';
      const url = await uploadAvatarToCloudinary(file);
      if (url) {
        await FS.playerRef(this.currentUser.uid).update({ avatarUrl: url });
        await FB.auth.currentUser.updateProfile({ photoURL: url });
        this.playerData.avatarUrl = url;
        this._updateMenuBadge();
        Profile.refreshProfile();
        document.getElementById('avatarUploadBtn').textContent = '✅ Uploaded!';
        setTimeout(() => document.getElementById('avatarUploadBtn').textContent = '📷 Change Avatar', 2000);
      } else {
        document.getElementById('avatarUploadBtn').textContent = '⚠️ Cloudinary not set';
        setTimeout(() => document.getElementById('avatarUploadBtn').textContent = '📷 Change Avatar', 3000);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      document.getElementById('avatarUploadBtn').textContent = '❌ Failed';
      setTimeout(() => document.getElementById('avatarUploadBtn').textContent = '📷 Change Avatar', 3000);
    }
  },

  // ---- MENU BADGE ----
  _updateMenuBadge() {
    const d = this.playerData;
    if (!d) return;
    document.getElementById('menuPlayerName').textContent   = d.username || 'Warrior';
    document.getElementById('menuPlayerId').textContent     = d.playerId || '';
    document.getElementById('menuPlayerAvatar').textContent = d.avatarUrl ? '' : '👤';
    if (d.avatarUrl) {
      document.getElementById('menuPlayerAvatar').style.backgroundImage = `url(${d.avatarUrl})`;
      document.getElementById('menuPlayerAvatar').style.backgroundSize  = 'cover';
    }
    document.getElementById('menuPlayerWins').textContent  = `${d.wins || 0}W`;
    document.getElementById('menuPlayerLosses').textContent = `${d.losses || 0}L`;
    document.getElementById('menuBadge').classList.remove('hidden');
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
    const btns = document.querySelectorAll('#authScreen button');
    btns.forEach(b => b.disabled = on);
    const spinner = document.getElementById('authSpinner');
    if (spinner) spinner.classList.toggle('hidden', !on);
  },

  _friendlyError(code) {
    const map = {
      'auth/user-not-found':      'No account with that email.',
      'auth/wrong-password':      'Incorrect password.',
      'auth/email-already-in-use':'Email already in use.',
      'auth/invalid-email':       'Invalid email address.',
      'auth/weak-password':       'Password is too weak.',
      'auth/too-many-requests':   'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] || 'Something went wrong. Try again.';
  },
};
