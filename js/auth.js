// ===================================================
//  AUTH.JS  — Session management for the game lobby
//             (login.html handles sign-in/register)
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
        // Not signed in — redirect to login page
        window.location.href = 'login.html';
      }
    });

    this._bindLobbyUI();
  },

  // ---- BIND LOBBY-SPECIFIC UI ----
  _bindLobbyUI() {
    // Sign out button (in main menu badge)
    document.getElementById('btnSignOut')?.addEventListener('click', () => this._signOut());

    // Avatar upload (in profile screen)
    document.getElementById('avatarInput')?.addEventListener('change', (e) => {
      this._handleAvatarUpload(e.target.files[0]);
    });
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });
  },

  // ---- SIGN OUT ----
  async _signOut() {
    await Auth._setOffline();
    await FB.auth.signOut();
    // Firebase onAuthStateChanged will fire and redirect to login.html
  },

  // ---- ON SIGNED IN ----
  async _onSignedIn(user) {
    this.currentUser = user;
    try {
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

      // Show main menu
      document.getElementById('mainMenu').classList.remove('hidden');

      // Update profile badge in menu
      this._updateMenuBadge();

      console.log('[Auth] Signed in:', user.uid, 'Player ID:', this.playerData.playerId);
    } catch (err) {
      console.error('[Auth] _onSignedIn error:', err);
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
    this.playerData = profile;
  },

  // ---- PRESENCE ----
  async _setOnline() {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    await FS.playerRef(uid).update({
      online:   true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

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
    document.getElementById('menuPlayerWins').textContent   = `${d.wins || 0}W`;
    document.getElementById('menuPlayerLosses').textContent = `${d.losses || 0}L`;
    document.getElementById('menuBadge').classList.remove('hidden');
  },
};
