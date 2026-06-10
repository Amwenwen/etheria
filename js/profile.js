// ===================================================
//  PROFILE.JS  — Player profile screen + match history
// ===================================================

const Profile = {
  historyListener: null,

  async show() {
    const uid = Auth.currentUser?.uid;
    if (!uid) return;

    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('profileScreen').classList.remove('hidden');

    await this.refreshProfile();
  },

  async refreshProfile() {
    const uid = Auth.currentUser?.uid;
    if (!uid) return;

    // Re-fetch latest player data
    const snap = await FS.playerRef(uid).get();
    const d    = snap.data();
    if (!d) return;
    Auth.playerData = d;

    // Fill profile fields
    const avatar = document.getElementById('profileAvatar');
    if (d.avatarUrl) {
      avatar.style.backgroundImage = `url(${d.avatarUrl})`;
      avatar.style.backgroundSize  = 'cover';
      avatar.textContent = '';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = '👤';
    }

    document.getElementById('profileUsername').textContent = d.username || 'Warrior';
    document.getElementById('profilePlayerId').textContent = d.playerId || '';
    document.getElementById('profileEmail').textContent    = d.email   || '';

    const gp = d.gamesPlayed || 0;
    const wr = gp > 0 ? Math.round(((d.wins||0) / gp) * 100) : 0;

    document.getElementById('profileWins').textContent   = d.wins   || 0;
    document.getElementById('profileLosses').textContent = d.losses || 0;
    document.getElementById('profileWR').textContent     = `${wr}%`;
    document.getElementById('profileGames').textContent  = gp;

    const avgK = gp > 0 ? ((d.totalKills||0)   / gp).toFixed(1) : '0.0';
    const avgD = gp > 0 ? ((d.totalDeaths||0)  / gp).toFixed(1) : '0.0';
    const avgA = gp > 0 ? ((d.totalAssists||0) / gp).toFixed(1) : '0.0';
    document.getElementById('profileAvgKDA').textContent = `${avgK}/${avgD}/${avgA}`;
    document.getElementById('profileTotalGold').textContent = (d.totalGold || 0).toLocaleString();

    // Load match history
    await this._loadMatchHistory(uid);
  },

  async _loadMatchHistory(uid) {
    const list = document.getElementById('matchHistoryList');
    list.innerHTML = '<div class="history-loading">Loading...</div>';

    const records = await MatchHistory.fetchRecent(uid, 15);

    if (records.length === 0) {
      list.innerHTML = '<div class="history-empty">No matches yet. Play a game!</div>';
      return;
    }

    list.innerHTML = records.map(r => {
      const resultClass = r.result === 'win' ? 'history-win' : 'history-loss';
      const resultIcon  = r.result === 'win' ? '🏆' : '💀';
      const kda = `${r.kills}/${r.deaths}/${r.assists}`;
      const heroData = HEROES.find(h => h.id === r.heroId);
      const heroIcon = heroData ? heroData.icon : '⚔️';
      const date = r.playedAt?.toDate ? r.playedAt.toDate().toLocaleDateString() : 'Recently';

      return `
        <div class="history-row ${resultClass}">
          <div class="history-result">${resultIcon} ${r.result.toUpperCase()}</div>
          <div class="history-hero">${heroIcon} ${r.hero}</div>
          <div class="history-kda">KDA: <b>${kda}</b></div>
          <div class="history-gold">💰 ${r.gold.toLocaleString()}</div>
          <div class="history-lvl">Lv ${r.level}</div>
          <div class="history-dur">⏱ ${r.duration}</div>
          <div class="history-date">${date}</div>
          ${r.screenshotUrl ? `<a href="${r.screenshotUrl}" target="_blank" class="history-shot">📸</a>` : ''}
        </div>
      `;
    }).join('');
  },

  hide() {
    document.getElementById('profileScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
  },
};

// ===================================================
//  UI_Net  — Network-aware UI pieces (lobby, toasts, 
//            matchmaking status, invites)
// ===================================================

const UI_Net = {
  toastTimer: null,

  // ---- MATCHMAKING ----
  setMatchmakingStatus(msg) {
    const el = document.getElementById('matchmakingStatus');
    if (el) el.textContent = msg;
  },

  showCancelQueue(show) {
    const el = document.getElementById('btnCancelQueue');
    if (el) el.classList.toggle('hidden', !show);
  },

  // ---- INVITE SENT ----
  showInviteSent(fromId, toId, matchId) {
    this.showToast(`📨 Invite sent to ${toId}! Waiting...`);
    document.getElementById('matchmakingStatus').textContent = `⏳ Waiting for ${toId} to accept...`;
    document.getElementById('btnCancelQueue').classList.remove('hidden');
  },

  showInviteError(msg) {
    const el = document.getElementById('inviteError');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    setTimeout(() => el?.classList.add('hidden'), 4000);
  },

  // ---- INCOMING INVITE ----
  showIncomingInvite(invite) {
    const panel = document.getElementById('incomingInvitePanel');
    if (!panel) return;
    document.getElementById('inviteFromName').textContent = invite.fromUsername;
    document.getElementById('inviteFromId').textContent   = invite.fromPlayerId;
    const heroData = HEROES.find(h => h.id === invite.heroId);
    document.getElementById('inviteHeroName').textContent = heroData ? `${heroData.icon} ${heroData.name}` : '?';
    panel.dataset.inviteId = invite.inviteId;
    panel.classList.remove('hidden');
  },

  hideIncomingInvite() {
    document.getElementById('incomingInvitePanel')?.classList.add('hidden');
  },

  // ---- LOBBY ----
  setLobbyMatchId(matchId) {
    const el = document.getElementById('lobbyMatchId');
    if (el) el.textContent = `Match: ${matchId}`;
  },

  renderLobby(matchData, myUid) {
    const container = document.getElementById('lobbyPlayers');
    if (!container) return;
    const players = matchData.players || {};
    container.innerHTML = Object.values(players).map(p => {
      const heroData = HEROES.find(h => h.id === p.heroId);
      const isMe = p.uid === myUid;
      const readyBadge = p.ready
        ? '<span class="ready-badge">✅ READY</span>'
        : '<span class="not-ready-badge">⏳ Not Ready</span>';
      const teamColor = p.team === 'blue' ? '#4a9eff' : '#ff4a4a';
      return `
        <div class="lobby-player ${isMe ? 'lobby-me' : ''}" style="border-color:${teamColor}">
          <div class="lobby-team" style="color:${teamColor}">${p.team.toUpperCase()}</div>
          <div class="lobby-hero">${heroData ? heroData.icon + ' ' + heroData.name : '❓ Picking...'}</div>
          <div class="lobby-uid">${isMe ? '(You)' : '(Opponent)'}</div>
          ${readyBadge}
        </div>
      `;
    }).join('');

    // Status
    const allReady = Object.values(players).every(p => p.ready && p.heroId);
    document.getElementById('lobbyStatus').textContent = allReady
      ? '🚀 All ready! Starting...'
      : '⏳ Waiting for all players to ready up...';
  },

  // ---- TOAST ----
  showToast(msg, duration) {
    duration = duration || 3500;
    let toast = document.getElementById('toastNotification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastNotification';
      toast.className = 'toast-notification';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove('hidden', 'toast-hide');
    toast.classList.add('toast-show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
    }, duration);
  },
};
