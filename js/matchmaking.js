// ===================================================
//  MATCHMAKING.JS  — Random match queue + Invite by ID
// ===================================================

const Matchmaking = {
  queueListener:  null,
  inviteListener: null,
  currentMatchId: null,
  pendingInviteId: null,
  isHost: false,

  // ---- JOIN RANDOM QUEUE ----
  async joinQueue(heroId) {
    const user = Auth.currentUser;
    const pd   = Auth.playerData;
    if (!user || !pd) return;

    UI_Net.setMatchmakingStatus('🔍 Searching for match...');
    UI_Net.showCancelQueue(true);

    const queueEntry = {
      uid:       user.uid,
      playerId:  pd.playerId,
      username:  pd.username,
      avatarUrl: pd.avatarUrl || '',
      heroId:    heroId,
      rating:    pd.wins || 0,
      joinedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      status:    'waiting',
      matchId:   null,
    };

    // Write entry to queue
    await FS.queueRef().doc(user.uid).set(queueEntry);

    // Listen for match assignment on own queue entry
    this.queueListener = FS.queueRef().doc(user.uid)
      .onSnapshot(async (snap) => {
        const data = snap.data();
        if (!data) return;
        if (data.status === 'matched' && data.matchId) {
          // Detach listener immediately to avoid double-firing
          if (this.queueListener) {
            this.queueListener();
            this.queueListener = null;
          }
          await this._onMatchFound(data.matchId, heroId, false);
        }
      });

    // Try to find an existing waiting player
    await this._tryMatchWithQueue(user.uid, heroId);
  },

  async _tryMatchWithQueue(myUid, heroId) {
    // Use a transaction to safely claim an opponent
    const queueSnap = await FS.queueRef()
      .where('status', '==', 'waiting')
      .where('uid', '!=', myUid)
      .limit(1)
      .get();

    if (queueSnap.empty) return; // wait for others

    const opponent = queueSnap.docs[0];
    const opData   = opponent.data();

    // Guard: don't match if opponent already got matched
    if (opData.status !== 'waiting') return;

    const matchId = 'match_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    const matchDoc = {
      matchId,
      status:    'lobby',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      players: {
        [myUid]:      { uid: myUid,      team: 'blue', heroId,          ready: false },
        [opData.uid]: { uid: opData.uid, team: 'red',  heroId: opData.heroId, ready: false },
      },
      hostUid: myUid,
    };

    const batch = FB.db.batch();
    batch.set(FS.matchRef(matchId), matchDoc);
    batch.update(FS.queueRef().doc(myUid),      { status: 'matched', matchId });
    batch.update(FS.queueRef().doc(opData.uid), { status: 'matched', matchId });
    await batch.commit();

    this.isHost = true;
  },

  // ---- CANCEL QUEUE ----
  async cancelQueue() {
    const uid = Auth.currentUser?.uid;
    if (!uid) return;
    if (this.queueListener) { this.queueListener(); this.queueListener = null; }
    await FS.queueRef().doc(uid).delete().catch(() => {});
    UI_Net.setMatchmakingStatus('');
    UI_Net.showCancelQueue(false);
  },

  // ---- INVITE BY PLAYER ID ----
  async inviteByPlayerId(targetPlayerId, heroId) {
    const user = Auth.currentUser;
    const pd   = Auth.playerData;
    if (!user || !pd) return;

    // Find player by playerId
    const snap = await FB.db.collection('players')
      .where('playerId', '==', targetPlayerId.trim().toUpperCase())
      .limit(1)
      .get();

    if (snap.empty) {
      UI_Net.showInviteError(`Player "${targetPlayerId}" not found`);
      return;
    }

    const targetDoc = snap.docs[0];
    const targetUid = targetDoc.id;

    if (targetUid === user.uid) {
      UI_Net.showInviteError("You can't invite yourself!");
      return;
    }

    // Create invite
    const inviteId = `inv_${user.uid}_${Date.now()}`;
    const matchId  = `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const inviteDoc = {
      inviteId,
      matchId,
      fromUid:      user.uid,
      fromPlayerId: pd.playerId,
      fromUsername: pd.username,
      fromAvatarUrl:pd.avatarUrl || '',
      heroId,
      toUid:        targetUid,
      toPlayerId:   targetPlayerId,
      status:       'pending',
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    };

    await FS.inviteRef(inviteId).set(inviteDoc);

    // Pre-create match doc
    await FS.matchRef(matchId).set({
      matchId,
      status:    'lobby',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      players: {
        [user.uid]:  { uid: user.uid,  team: 'blue', heroId, ready: false },
        [targetUid]: { uid: targetUid, team: 'red',  heroId: null, ready: false },
      },
      hostUid: user.uid,
    });

    this.currentMatchId = matchId;
    this.isHost = true;
    this.pendingInviteId = inviteId;

    UI_Net.showInviteSent(pd.playerId, targetPlayerId, matchId);

    // Listen for invite acceptance
    FS.inviteRef(inviteId).onSnapshot(async (snap) => {
      const d = snap.data();
      if (!d) return;
      if (d.status === 'accepted') {
        UI_Net.setMatchmakingStatus(`✅ ${d.toPlayerId} accepted! Entering lobby...`);
        await this._onMatchFound(matchId, heroId, true);
      } else if (d.status === 'declined') {
        UI_Net.showInviteError(`${d.toPlayerId} declined your invite.`);
        this.currentMatchId = null;
        this.pendingInviteId = null;
      }
    });
  },

  // ---- LISTEN FOR INCOMING INVITES ----
  listenForInvites() {
    const uid = Auth.currentUser?.uid;
    if (!uid) return;

    this.inviteListener = FB.db.collection('invites')
      .where('toUid',   '==', uid)
      .where('status',  '==', 'pending')
      .onSnapshot((snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added') {
            const invite = change.doc.data();
            UI_Net.showIncomingInvite(invite);
          }
        });
      });
  },

  // ---- ACCEPT INVITE ----
  async acceptInvite(inviteId, heroId) {
    const inv = (await FS.inviteRef(inviteId).get()).data();
    if (!inv) return;

    const uid = Auth.currentUser.uid;

    // Update invite status
    await FS.inviteRef(inviteId).update({ status: 'accepted' });

    // Update match — add self with chosen hero
    await FS.matchRef(inv.matchId).update({
      [`players.${uid}.heroId`]: heroId,
      [`players.${uid}.ready`]:  false,
    });

    this.currentMatchId = inv.matchId;
    this.isHost = false;

    await this._onMatchFound(inv.matchId, heroId, false);
  },

  // ---- DECLINE INVITE ----
  async declineInvite(inviteId) {
    await FS.inviteRef(inviteId).update({ status: 'declined' });
    UI_Net.hideIncomingInvite();
  },

  // ---- ON MATCH FOUND ----
  async _onMatchFound(matchId, heroId, isHost) {
    if (this.queueListener) { this.queueListener(); this.queueListener = null; }
    this.currentMatchId = matchId;
    this.isHost = isHost;

    // Clean up queue entry
    const uid = Auth.currentUser?.uid;
    if (uid) await FS.queueRef().doc(uid).delete().catch(() => {});

    UI_Net.setMatchmakingStatus('⚔️ Match found! Loading lobby...');
    UI_Net.showCancelQueue(false);

    // Open lobby
    await LobbyManager.enter(matchId, heroId);
  },

  stopListeners() {
    if (this.queueListener)  { this.queueListener();  this.queueListener  = null; }
    if (this.inviteListener) { this.inviteListener(); this.inviteListener = null; }
  },
};

// ===================================================
//  LOBBY  — Pre-match room, ready check, hero confirm
// ===================================================

const LobbyManager = {
  matchListener: null,
  matchId: null,
  heroId:  null,

  async enter(matchId, heroId) {
    this.matchId = matchId;
    this.heroId  = heroId;

    // Show lobby screen
    document.getElementById('heroSelect').classList.add('hidden');
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('lobbyScreen').classList.remove('hidden');

    UI_Net.setLobbyMatchId(matchId);

    // Update own hero in match
    const uid = Auth.currentUser?.uid;
    if (uid) {
      await FS.matchRef(matchId).update({
        [`players.${uid}.heroId`]: heroId,
      });
    }

    // Listen to match doc for player updates
    this.matchListener = FS.matchRef(matchId).onSnapshot((snap) => {
      const data = snap.data();
      if (!data) return;
      UI_Net.renderLobby(data, uid);

      // If all human players ready → start game
      if (data.status === 'starting') {
        this._startGame(data);
      }
    });
  },

  async setReady() {
    const uid = Auth.currentUser?.uid;
    if (!uid || !this.matchId) return;
    await FS.matchRef(this.matchId).update({
      [`players.${uid}.ready`]: true,
    });

    // Check if all human players are ready (host triggers start)
    if (Matchmaking.isHost) {
      const snap = await FS.matchRef(this.matchId).get();
      const data = snap.data();
      const players = Object.values(data.players || {});
      const allReady = players.every(p => p.ready && p.heroId);
      if (allReady) {
        await FS.matchRef(this.matchId).update({ status: 'starting' });
      }
    }
  },

  async leaveLobby() {
    if (this.matchListener) { this.matchListener(); this.matchListener = null; }
    if (this.matchId) {
      const uid = Auth.currentUser?.uid;
      if (uid) {
        await FS.matchRef(this.matchId).update({
          [`players.${uid}.left`]: true,
          status: 'cancelled',
        }).catch(() => {});
      }
    }
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    this.matchId = null;
    this.heroId  = null;
  },

  _startGame(matchData) {
    if (this.matchListener) { this.matchListener(); this.matchListener = null; }
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');

    // Determine my team and opponent's hero
    const uid      = Auth.currentUser?.uid;
    const myPlayer = matchData.players[uid];
    const myHeroData = HEROES.find(h => h.id === myPlayer.heroId) || HEROES[0];

    // Start multiplayer game
    MultiplayerGame.start(matchData, myHeroData);
  },
};
