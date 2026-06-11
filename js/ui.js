// ===================================================
//  UI.JS  — HUD updates, menus, shop, kill feed
// ===================================================

const UI = {
  init() {
    this._buildHeroGrid('heroGrid', true);
    this._buildHeroGrid('galleryGrid', false);
    this._buildShopItems();
    this._bindMenuButtons();
  },

  _buildHeroGrid(gridId, selectable) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    HEROES.forEach(hero => {
      const card = document.createElement('div');
      card.className = 'hero-card';
      card.innerHTML = `
        <div class="hero-card-avatar" style="background:${hero.bgColor}; border-color:${hero.color}">
          ${hero.icon}
        </div>
        <div class="hero-card-name">${hero.name}</div>
        <div class="hero-card-role">
          <span class="hero-card-role-badge role-${hero.role.toLowerCase()}">${hero.role}</span>
        </div>
        <div style="margin-top:6px;font-size:0.7rem;color:#888">
          HP: ${hero.baseStats.hp} | ATK: ${hero.baseStats.atk}
        </div>
      `;
      if (selectable) {
        card.addEventListener('click', () => this._selectHero(hero, card));
      } else {
        // Gallery — show full details on click
        card.innerHTML += `<div style="margin-top:6px;font-size:0.68rem;color:#777;line-height:1.5">${hero.description}</div>`;
      }
      grid.appendChild(card);
    });
  },

  _selectHero(hero, card) {
    document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    UI._selectedHero = hero;

    const preview = document.getElementById('heroPreview');
    preview.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
        <div style="width:72px;height:72px;border-radius:50%;background:${hero.bgColor};border:3px solid ${hero.color};
          display:flex;align-items:center;justify-content:center;font-size:2.5rem;flex-shrink:0">${hero.icon}</div>
        <div>
          <div style="font-size:1.3rem;font-weight:900;color:${hero.color}">${hero.name}</div>
          <div style="color:#888;font-size:0.8rem;text-transform:uppercase;letter-spacing:2px">${hero.role}</div>
          <div style="color:#aaa;font-size:0.8rem;margin-top:4px">${hero.description}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${hero.skills.map((s, i) => `
          <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center">
            <div style="font-size:1.5rem">${s.icon}</div>
            <div style="font-size:0.7rem;font-weight:700;color:#f5a623">[${s.key}] ${s.name}</div>
            <div style="font-size:0.65rem;color:#888;margin-top:3px">${s.desc}</div>
            <div style="font-size:0.65rem;color:#4a9eff;margin-top:2px">CD: ${s.cd}s | Cost: ${s.cost}MP</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;display:flex;gap:16px;justify-content:center;color:#aaa;font-size:0.8rem">
        <span>❤️ HP: ${hero.baseStats.hp}</span>
        <span>💙 MP: ${hero.baseStats.mp}</span>
        <span>⚔️ ATK: ${hero.baseStats.atk}</span>
        <span>🛡️ DEF: ${hero.baseStats.def}</span>
        <span>💨 SPD: ${hero.baseStats.spd}</span>
      </div>
    `;

    document.getElementById('selectedInfo').classList.remove('hidden');
  },

  _buildShopItems() {
    const container = document.getElementById('shopItems');
    if (!container) return;
    container.innerHTML = '';
    ITEMS.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-item';
      div.id = 'shop_' + item.id;
      div.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-cost">💰 ${item.cost}</div>
        <div class="shop-item-stat">${item.stat}</div>
      `;
      div.addEventListener('click', () => {
        if (Game && Game.buyItem) Game.buyItem(item);
      });
      container.appendChild(div);
    });
  },

  _bindMenuButtons() {
    document.getElementById('btnPlay').onclick = () => {
      document.getElementById('mainMenu').classList.add('hidden');
      document.getElementById('heroSelect').classList.remove('hidden');
    };

    document.getElementById('btnHeroes').onclick = () => {
      document.getElementById('mainMenu').classList.add('hidden');
      document.getElementById('heroesGallery').classList.remove('hidden');
    };

    document.getElementById('btnHowToPlay').onclick = () => {
      document.getElementById('mainMenu').classList.add('hidden');
      document.getElementById('howToPlay').classList.remove('hidden');
    };

    document.getElementById('btnBackFromHow').onclick = () => {
      document.getElementById('howToPlay').classList.add('hidden');
      document.getElementById('mainMenu').classList.remove('hidden');
    };

    document.getElementById('btnBackGallery').onclick = () => {
      document.getElementById('heroesGallery').classList.add('hidden');
      document.getElementById('mainMenu').classList.remove('hidden');
    };

    // btnConfirm (solo play) and network buttons are bound in Game._bindNetworkUI

    document.getElementById('btnBack').onclick = () => {
      document.getElementById('selectedInfo').classList.add('hidden');
      document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
      UI._selectedHero = null;
    };

    document.getElementById('btnBackMenu').onclick = () => {
      document.getElementById('heroSelect').classList.add('hidden');
      document.getElementById('mainMenu').classList.remove('hidden');
    };

    document.getElementById('btnShop').onclick = () => UI.toggleShop(true);
    document.getElementById('closeShop').onclick = () => UI.toggleShop(false);

    document.getElementById('btnPlayAgain').onclick = () => {
      document.getElementById('gameOver').classList.add('hidden');
      document.getElementById('gameScreen').classList.add('hidden');
      document.getElementById('heroSelect').classList.remove('hidden');
      Game.reset();
    };

    document.getElementById('btnMainMenu').onclick = () => {
      document.getElementById('gameOver').classList.add('hidden');
      document.getElementById('gameScreen').classList.add('hidden');
      document.getElementById('mainMenu').classList.remove('hidden');
      Game.reset();
    };

    // Minimap click
    document.getElementById('minimap').addEventListener('click', (e) => {
      const rect = e.target.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      MapRenderer.centerOn(mx * MAP_PX, my * MAP_PY);
    });
  },

  toggleShop(open) {
    const overlay = document.getElementById('shopOverlay');
    if (open) {
      overlay.classList.remove('hidden');
      this.refreshShop();
    } else {
      overlay.classList.add('hidden');
    }
  },

  refreshShop() {
    const player = Game && Game.player;
    if (!player) return;
    document.getElementById('shopGoldDisplay').textContent = '💰 ' + Math.floor(player.gold);
    ITEMS.forEach(item => {
      const el = document.getElementById('shop_' + item.id);
      if (!el) return;
      el.classList.remove('cant-afford', 'owned');
      if (player.items.includes(item.id)) {
        el.classList.add('owned');
      } else if (player.gold < item.cost) {
        el.classList.add('cant-afford');
      }
    });
  },

  // ---- HUD UPDATES ----
  updateHUD(player, state) {
    if (!player) return;

    // HP / MP / XP bars
    const hpPct  = Math.max(0, player.hp / player.maxHp) * 100;
    const mpPct  = Math.max(0, player.mp / player.maxMp) * 100;
    const xpPct  = (player.xp / player.xpNext) * 100;

    document.getElementById('hpBar').style.width = hpPct + '%';
    document.getElementById('mpBar').style.width = mpPct + '%';
    document.getElementById('xpBar').style.width = xpPct + '%';
    document.getElementById('hpText').textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    document.getElementById('mpText').textContent = `${Math.ceil(player.mp)}/${player.maxMp}`;
    document.getElementById('heroLevel').textContent = player.level;
    document.getElementById('heroNameHud').textContent = player.name;
    document.getElementById('goldAmount').textContent = Math.floor(player.gold);

    // Portrait
    const portrait = document.getElementById('portraitIcon');
    portrait.textContent = player.icon;
    portrait.style.background = player.bgColor;
    portrait.style.borderColor = player.color;

    // Skill cooldowns
    player.skills.forEach((skill, i) => {
      const cdKeys = ['cdQ','cdW','cdE','cdR'];
      const btnIds = ['skillQ','skillW','skillE','skillR'];
      const iconIds = ['skillIconQ','skillIconW','skillIconE','skillIconR'];
      const cdEl = document.getElementById(cdKeys[i]);
      const btn  = document.getElementById(btnIds[i]);
      const iconEl = document.getElementById(iconIds[i]);
      if (!cdEl || !btn) return;
      iconEl.textContent = skill.icon;
      if (player.skillCDs[i] > 0) {
        cdEl.style.display = 'flex';
        cdEl.textContent = Math.ceil(player.skillCDs[i] / 1000);
        btn.classList.add('on-cooldown');
      } else {
        cdEl.style.display = 'none';
        btn.classList.remove('on-cooldown');
        btn.classList.toggle('no-mana', player.mp < skill.cost);
      }
    });

    // Items
    for (let i = 0; i < 6; i++) {
      const slot = document.getElementById('item' + i);
      if (!slot) continue;
      const itemId = player.items[i];
      if (itemId) {
        const item = ITEMS.find(it => it.id === itemId);
        slot.textContent = item ? item.icon : '';
        slot.title = item ? `${item.name} (${item.stat})` : '';
      } else {
        slot.textContent = '';
        slot.title = `Slot ${i+1}`;
      }
    }

    // Score board
    document.getElementById('blueKills').textContent = state.kills.blue;
    document.getElementById('redKills').textContent  = state.kills.red;
    document.getElementById('blueTowers').textContent = state.towers.filter(t=>t.team===TEAM_BLUE&&t.alive).length;
    document.getElementById('redTowers').textContent  = state.towers.filter(t=>t.team===TEAM_RED&&t.alive).length;

    // Game phase
    const mins = state.elapsed / 60000;
    document.getElementById('phaseLabel').textContent =
      mins < 5 ? 'Early Game' : mins < 15 ? 'Mid Game' : 'Late Game';

    // Team hero icons
    this._updateTeamIcons(state);
  },

  _updateTeamIcons(state) {
    const blueIcons = document.getElementById('blueHeroIcons');
    const redIcons  = document.getElementById('redHeroIcons');
    if (!blueIcons || !redIcons) return;
    const blueHeroes = (state.units || []).filter(u => u.team === TEAM_BLUE);
    const redHeroes  = (state.units || []).filter(u => u.team === TEAM_RED);
    blueIcons.innerHTML = blueHeroes.map(u =>
      `<div class="hero-icon-small ${!u.alive?'dead':''}" style="background:${u.bgColor};border-color:${u.color}" title="${u.name}">${u.icon}</div>`
    ).join('');
    redIcons.innerHTML = redHeroes.map(u =>
      `<div class="hero-icon-small ${!u.alive?'dead':''}" style="background:${u.bgColor};border-color:${u.color}" title="${u.name}">${u.icon}</div>`
    ).join('');
  },

  // Game timer
  updateTimer(ms) {
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    document.getElementById('gameTimer').textContent = `${mm}:${ss}`;
  },

  // Kill Feed
  addKillFeed(msg, team) {
    const feed = document.getElementById('killFeed');
    const entry = document.createElement('div');
    entry.className = `kill-entry ${team === TEAM_BLUE ? 'blue-kill' : 'red-kill'}`;
    entry.textContent = msg;
    feed.appendChild(entry);
    setTimeout(() => entry.remove(), 4000);
    // Keep max 5 entries
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
  },

  // Floating damage numbers
  showDamageNumber(screenX, screenY, text, team) {
    const layer = document.getElementById('damageLayer');
    const el = document.createElement('div');
    el.className = 'dmg-num';
    el.style.left = (screenX - 20) + 'px';
    el.style.top  = (screenY - 20) + 'px';
    const isHeal = (team === 'heal');
    el.style.color = isHeal ? '#2dff2d' : (team === TEAM_BLUE ? '#4affff' : '#ff6464');
    el.style.fontSize = (typeof text === 'number' && text > 200) ? '1.1rem' : '0.85rem';
    el.textContent = isHeal ? '+' + text : (typeof text === 'string' ? text : '-' + text);
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },

  // Target panel
  updateTargetPanel(unit) {
    const panel = document.getElementById('targetPanel');
    if (!unit || !unit.alive) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    document.getElementById('targetName').textContent = `${unit.icon} ${unit.name} Lv${unit.level||''}`;
    document.getElementById('targetName').style.color = unit.team === TEAM_BLUE ? '#4a9eff' : '#ff4a4a';
    const pct = unit.hp / unit.maxHp;
    document.getElementById('targetHpBar').style.width = (pct * 100) + '%';
    document.getElementById('targetHpText').textContent = `${Math.ceil(unit.hp)}/${unit.maxHp}`;
  },

  showRespawn(seconds) {
    const overlay = document.getElementById('respawnOverlay');
    overlay.classList.remove('hidden');
    let t = seconds;
    document.getElementById('respawnTimer').textContent = t;
    const iv = setInterval(() => {
      t--;
      document.getElementById('respawnTimer').textContent = t;
      if (t <= 0) { clearInterval(iv); overlay.classList.add('hidden'); }
    }, 1000);
  },

  showGameOver(victory, stats) {
    const go = document.getElementById('gameOver');
    go.classList.remove('hidden');
    const title = document.getElementById('gameOverTitle');
    title.textContent = victory ? '🏆 VICTORY!' : '💀 DEFEAT';
    title.className = 'gameover-title ' + (victory ? 'victory' : 'defeat');
    document.getElementById('gameOverStats').innerHTML = `
      <div>KDA: <b>${stats.kills}/${stats.deaths}/${stats.assists}</b></div>
      <div>Gold Earned: <b>${stats.gold}</b></div>
      <div>Match Duration: <b>${stats.duration}</b></div>
    `;
  }
};
