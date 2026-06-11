// ===================================================
//  MULTIPLAYER.JS  — Real-time game state via RTDB
//                   Syncs player positions, HP, skills
// ===================================================

const MultiplayerGame = {
  matchId:    null,
  myUid:      null,
  myTeam:     null,
  opponentUid: null,
  matchData:  null,

  syncInterval: null,    // push state every N ms
  stateListener: null,   // listen to opponent state

  SYNC_RATE: 100,        // ms between state pushes (10/s)

  // ---- START MULTIPLAYER GAME ----
  start(matchData, myHeroData) {
    this.matchId     = matchData.matchId;
    this.myUid       = Auth.currentUser.uid;
    this.matchData   = matchData;

    const players  = matchData.players;
    const myEntry  = players[this.myUid];
    this.myTeam    = myEntry.team;

    // Find opponent
    this.opponentUid = Object.keys(players).find(uid => uid !== this.myUid);
    const opEntry    = this.opponentUid ? players[this.opponentUid] : null;
    const opHeroData = opEntry ? (HEROES.find(h => h.id === opEntry.heroId) || HEROES[1]) : null;

    // Initialize the single-player Game engine but in multiplayer mode
    Game.startMultiplayer(myHeroData, this.myTeam, opHeroData, this.opponentUid);

    // Start syncing own state
    this._startStatePush();

    // Listen to opponent state
    if (this.opponentUid) {
      this._listenToOpponent();
    }

    // Listen for match events (disconnect, surrender, game over)
    this._listenMatchEvents();

    // Write match started
    RTDB.matchStateRef(this.matchId).update({ status: 'live', startedAt: firebase.database.ServerValue.TIMESTAMP });
  },

  // ---- PUSH OWN STATE ----
  _startStatePush() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncInterval = setInterval(async () => {
      const p = Game.player;
      if (!p || !p.alive) return;
      if (!Game.state.running) return;

      const state = {
        x:      Math.round(p.x),
        y:      Math.round(p.y),
        hp:     Math.round(p.hp),
        mp:     Math.round(p.mp),
        alive:  p.alive,
        level:  p.level,
        kills:  p.kills,
        deaths: p.deaths,
        gold:   Math.round(p.gold),
        targetX: Math.round(p.targetX),
        targetY: Math.round(p.targetY),
        skillCDs: p.skillCDs.map(cd => Math.round(cd)),
        items:   p.items,
        effects: p.effects.map(e => ({ type: e.type })),
        ts:     firebase.database.ServerValue.TIMESTAMP,
      };

      await RTDB.playerStateRef(this.matchId, this.myUid).set(state).catch(() => {});
    }, this.SYNC_RATE);
  },

  // ---- LISTEN TO OPPONENT ----
  _listenToOpponent() {
    const opRef = RTDB.playerStateRef(this.matchId, this.opponentUid);

    this.stateListener = opRef.on('value', (snap) => {
      const data = snap.val();
      if (!data) return;
      this._applyOpponentState(data);
    });
  },

  _applyOpponentState(data) {
    // Find opponent unit in Game
    const opUnit = Game.state.units.find(u => u.id === 'opponent_hero');
    if (!opUnit) return;

    // Smooth interpolate position
    opUnit.targetX = data.x;
    opUnit.targetY = data.y;
    opUnit.hp      = data.hp;
    opUnit.mp      = data.mp;
    opUnit.level   = data.level;
    opUnit.kills   = data.kills;
    opUnit.deaths  = data.deaths;
    opUnit.gold    = data.gold;
    opUnit.skillCDs = data.skillCDs || opUnit.skillCDs;
    opUnit.items    = data.items || opUnit.items;

    if (!data.alive && opUnit.alive) {
      opUnit.alive = false;
      Game.spawnEffect(opUnit.x, opUnit.y, 'death');
    } else if (data.alive && !opUnit.alive) {
      opUnit.alive = true;
      opUnit.hp = opUnit.maxHp * 0.5;
      Game.spawnEffect(opUnit.x, opUnit.y, 'spawn');
    }
  },

  // ---- LISTEN FOR MATCH EVENTS ----
  _listenMatchEvents() {
    RTDB.matchStateRef(this.matchId).on('value', (snap) => {
      const data = snap.val();
      if (!data) return;

      if (data.status === 'ended' && Game.state.running) {
        const winTeam = data.winTeam;
        Game.state.running = false;
        const playerWon = (winTeam === this.myTeam);

        const mm = String(Math.floor(Game.state.elapsed / 60000)).padStart(2,'0');
        const ss = String(Math.floor((Game.state.elapsed % 60000)/1000)).padStart(2,'0');
        setTimeout(() => {
          UI.showGameOver(playerWon, {
            kills:    Game.player.kills,
            deaths:   Game.player.deaths,
            assists:  Game.player.assists,
            gold:     Math.floor(Game.player.gold),
            duration: `${mm}:${ss}`,
          });
          MatchHistory.save(playerWon, Game.player, `${mm}:${ss}`, this.matchId);
        }, 1500);
      }

      // Opponent disconnected
      if (data.opponentLeft && !data[`${this.opponentUid}_left_handled`]) {
        UI_Net.showToast('⚠️ Opponent disconnected. You win!');
        setTimeout(() => {
          this._endMatch(this.myTeam);
        }, 3000);
      }
    });
  },

  // ---- BROADCAST GAME EVENT (nexus destroyed etc.) ----
  async broadcastEvent(type, data) {
    await RTDB.matchStateRef(this.matchId).update({
      lastEvent: { type, data, ts: firebase.database.ServerValue.TIMESTAMP },
    }).catch(() => {});
  },

  // ---- END MATCH ----
  async _endMatch(winTeam) {
    if (!Game.state.running) return;
    Game.state.running = false;
    await RTDB.matchStateRef(this.matchId).update({
      status:  'ended',
      winTeam,
    }).catch(() => {});
  },

  // ---- REPORT NEXUS DESTROYED ----
  async reportNexusDestroyed(destroyedTeam) {
    const winTeam = destroyedTeam === TEAM_BLUE ? TEAM_RED : TEAM_BLUE;
    await this._endMatch(winTeam);
  },

  // ---- CLEANUP ----
  stop() {
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.stateListener && this.opponentUid) {
      RTDB.playerStateRef(this.matchId, this.opponentUid).off('value', this.stateListener);
    }
    if (this.matchId) {
      RTDB.matchStateRef(this.matchId).off();
    }
    // Mark self as left
    if (this.matchId && this.myUid) {
      RTDB.matchStateRef(this.matchId).update({
        opponentLeft: true,
        [`${this.opponentUid}_left_handled`]: false,
      }).catch(() => {});
      RTDB.playerStateRef(this.matchId, this.myUid).onDisconnect().update({ alive: false });
    }
    this.matchId = null;
  },
};

// ===================================================
//  MATCH HISTORY  — Save and fetch match records
// ===================================================

const MatchHistory = {
  async save(won, player, duration, matchId) {
    const uid = Auth.currentUser?.uid;
    if (!uid) return;

    // Try screenshot
    let screenshotUrl = null;
    try {
      const canvas = document.getElementById('gameCanvas');
      screenshotUrl = await uploadMatchScreenshot(canvas.toDataURL('image/jpeg', 0.5));
    } catch (e) { /* ignore */ }

    const record = {
      matchId,
      result:   won ? 'win' : 'loss',
      hero:     player.name,
      heroId:   player.heroData?.id || '',
      kills:    player.kills,
      deaths:   player.deaths,
      assists:  player.assists,
      gold:     Math.floor(player.gold),
      level:    player.level,
      duration,
      screenshotUrl: screenshotUrl || '',
      playedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Save to match history sub-collection
    await FS.matchHistoryRef(uid).add(record);

    // Update player stats
    const updates = {
      gamesPlayed:  firebase.firestore.FieldValue.increment(1),
      totalKills:   firebase.firestore.FieldValue.increment(player.kills),
      totalDeaths:  firebase.firestore.FieldValue.increment(player.deaths),
      totalAssists: firebase.firestore.FieldValue.increment(player.assists),
      totalGold:    firebase.firestore.FieldValue.increment(Math.floor(player.gold)),
      lastSeen:     firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (won) updates.wins   = firebase.firestore.FieldValue.increment(1);
    else     updates.losses = firebase.firestore.FieldValue.increment(1);

    await FS.playerRef(uid).update(updates);

    // Refresh player data cache
    Auth.playerData = (await FS.playerRef(uid).get()).data();
    Auth._updateMenuBadge();

    console.log('[MatchHistory] Saved match record');
  },

  async fetchRecent(uid, limit) {
    uid   = uid   || Auth.currentUser?.uid;
    limit = limit || 10;
    if (!uid) return [];

    const snap = await FS.matchHistoryRef(uid)
      .orderBy('playedAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map(d => d.data());
  },
};
