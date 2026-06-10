// ===================================================
//  GAME.JS  — Main game loop & state management
// ===================================================

const Game = {
  canvas: null,
  ctx: null,
  miniCtx: null,
  player: null,
  animId: null,
  lastTime: 0,

  // Game state
  state: {
    running: false,
    elapsed: 0,     // ms
    units: [],      // all heroes (player + AI)
    minions: [],
    towers: [],
    nexuses: [],
    jungleCamps: [],
    projectiles: [],
    effects: [],
    kills: { blue: 0, red: 0 },
    minionTimer: 0,
    jungleTimers: [],
  },

  // Input
  input: {
    keys: {},
    mouseX: 0,
    mouseY: 0,
    rightClickTarget: null,
  },

  // Timing
  camScrollSpeed: 400,

  // Multiplayer flag
  isMultiplayer: false,

  // ---- INIT ----
  init() {
    this.canvas  = document.getElementById('gameCanvas');
    this.ctx     = this.canvas.getContext('2d');
    this.miniCtx = document.getElementById('minimap').getContext('2d');
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
    UI.init();
    Auth.init();
    this._bindNetworkUI();
  },

  // ---- BIND NETWORK UI ----
  _bindNetworkUI() {
    // Profile button
    document.getElementById('btnProfile')?.addEventListener('click', () => Profile.show());
    document.getElementById('btnBackProfile')?.addEventListener('click', () => Profile.hide());
    document.getElementById('avatarUploadBtn')?.addEventListener('click', () => {});

    // Matchmaking from hero select
    document.getElementById('btnFindMatch')?.addEventListener('click', async () => {
      if (!UI._selectedHero) { UI_Net.showToast('Select a hero first!'); return; }
      await Matchmaking.joinQueue(UI._selectedHero.id);
    });

    document.getElementById('btnCancelQueue')?.addEventListener('click', () => {
      Matchmaking.cancelQueue();
    });

    // Invite
    document.getElementById('btnSendInvite')?.addEventListener('click', async () => {
      if (!UI._selectedHero) { UI_Net.showToast('Select a hero first!'); return; }
      const pid = document.getElementById('invitePlayerIdInput')?.value.trim();
      if (!pid) { UI_Net.showInviteError('Enter a Player ID (e.g. ETH#1234)'); return; }
      await Matchmaking.inviteByPlayerId(pid, UI._selectedHero.id);
    });

    // Incoming invite buttons
    document.getElementById('btnAcceptInvite')?.addEventListener('click', async () => {
      const panel = document.getElementById('incomingInvitePanel');
      const inviteId = panel?.dataset.inviteId;
      if (!inviteId || !UI._selectedHero) { UI_Net.showToast('Select a hero first!'); return; }
      await Matchmaking.acceptInvite(inviteId, UI._selectedHero.id);
      UI_Net.hideIncomingInvite();
    });

    document.getElementById('btnDeclineInvite')?.addEventListener('click', async () => {
      const panel = document.getElementById('incomingInvitePanel');
      const inviteId = panel?.dataset.inviteId;
      if (inviteId) await Matchmaking.declineInvite(inviteId);
    });

    // Lobby ready
    document.getElementById('btnReady')?.addEventListener('click', () => LobbyManager.setReady());
    document.getElementById('btnLeaveLobby')?.addEventListener('click', () => LobbyManager.leaveLobby());

    // Play solo (original single-player mode)
    document.getElementById('btnConfirm')?.addEventListener('click', () => {
      if (!UI._selectedHero) return;
      document.getElementById('heroSelect').classList.add('hidden');
      document.getElementById('gameScreen').classList.remove('hidden');
      this.isMultiplayer = false;
      this.start(UI._selectedHero);
    });
  },

  _resizeCanvas() {
    const screen = document.getElementById('gameScreen');
    const hud    = document.getElementById('topHud');
    const bottom = document.getElementById('bottomHud');
    if (!screen.classList.contains('hidden')) {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight - hud.offsetHeight - bottom.offsetHeight;
      MapRenderer.camW = this.canvas.width;
      MapRenderer.camH = this.canvas.height;
      MapRenderer.clampCamera();
    }
  },

  // ---- START MULTIPLAYER ----
  // Called by MultiplayerGame after match is confirmed
  startMultiplayer(myHeroData, myTeam, opHeroData, opponentUid) {
    this.reset();
    this.isMultiplayer = true;
    this._resizeCanvas();
    MapRenderer.init(this.canvas.width, this.canvas.height);

    // Spawn player
    const base = myTeam === TEAM_BLUE ? { x: 200, y: 1760 } : { x: 1760, y: 200 };
    const playerStats = { ...myHeroData.baseStats };
    this.player = new Unit({
      id: 'player',
      name: myHeroData.name,
      team: myTeam,
      type: 'hero',
      role: myHeroData.role,
      icon: myHeroData.icon,
      color: myHeroData.color,
      bgColor: myHeroData.bgColor,
      heroData: myHeroData,
      stats: playerStats,
      growthStats: myHeroData.growthStats,
      gold: 500,
      x: base.x, y: base.y,
      aggroRange: 500,
      lane: 'mid',
    });
    this.state.units.push(this.player);

    // Spawn opponent hero (controlled remotely)
    if (opHeroData && opponentUid) {
      const opTeam = myTeam === TEAM_BLUE ? TEAM_RED : TEAM_BLUE;
      const opBase = opTeam === TEAM_BLUE ? { x: 200, y: 1760 } : { x: 1760, y: 200 };
      const opponentUnit = new Unit({
        id: 'opponent_hero',
        name: opHeroData.name,
        team: opTeam,
        type: 'hero',
        role: opHeroData.role,
        icon: opHeroData.icon,
        color: opHeroData.color,
        bgColor: opHeroData.bgColor,
        heroData: opHeroData,
        stats: { ...opHeroData.baseStats },
        growthStats: opHeroData.growthStats,
        gold: 500,
        x: opBase.x, y: opBase.y,
        aggroRange: 500,
        lane: 'mid',
      });
      opponentUnit._isRemote = true; // flag: don't run local AI
      this.state.units.push(opponentUnit);
    }

    // Spawn 2 AI allies per team (fill remaining slots)
    const laneWps  = buildLaneWaypoints();
    const myAlliesPool = HEROES.filter(h => h.id !== myHeroData.id && h.id !== opHeroData?.id);
    const shuffled = [...myAlliesPool].sort(() => Math.random() - 0.5);

    // Blue AI allies
    const blueTeam = myTeam === TEAM_BLUE ? TEAM_BLUE : TEAM_RED;
    const redTeam  = myTeam === TEAM_BLUE ? TEAM_RED  : TEAM_BLUE;

    [[shuffled[0],'top'],[shuffled[1],'bot']].forEach(([h, lane]) => {
      if (!h) return;
      const u = this._spawnAIHero(h, blueTeam, lane, laneWps[lane][blueTeam], blueTeam === TEAM_BLUE ? {x:200,y:1760} : {x:1760,y:200});
      this.state.units.push(u);
    });
    [[shuffled[2],'top'],[shuffled[3],'bot']].forEach(([h, lane]) => {
      if (!h) return;
      const u = this._spawnAIHero(h, redTeam, lane, laneWps[lane][redTeam], redTeam === TEAM_BLUE ? {x:200,y:1760} : {x:1760,y:200});
      this.state.units.push(u);
    });

    this._spawnStructures();
    this._spawnJungleCamps();

    MapRenderer.centerOn(base.x, base.y);
    this._bindInput();

    this.player.laneWPs = laneWps.mid[myTeam];
    this.player.laneWpIdx = 0;

    this.state.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);

    UI_Net.showToast('⚔️ Match started! Destroy the enemy Nexus!');
  },

  // ---- START (solo) ----
  start(heroData) {
    this.reset();
    this._resizeCanvas();

    // Build map
    MapRenderer.init(this.canvas.width, this.canvas.height);

    // Spawn player hero (Blue team)
    const playerStats = { ...heroData.baseStats };
    this.player = new Unit({
      id: 'player',
      name: heroData.name,
      team: TEAM_BLUE,
      type: 'hero',
      role: heroData.role,
      icon: heroData.icon,
      color: heroData.color,
      bgColor: heroData.bgColor,
      heroData: heroData,
      stats: playerStats,
      growthStats: heroData.growthStats,
      gold: 500,
      x: 200, y: 1760,
      aggroRange: 500,
      lane: 'mid',
    });
    this.state.units.push(this.player);

    // Pick 2 random allies
    const alliesPool = HEROES.filter(h => h.id !== heroData.id);
    const ally1 = alliesPool[Math.floor(Math.random() * alliesPool.length)];
    let ally2 = alliesPool.filter(h => h.id !== ally1.id)[Math.floor(Math.random() * (alliesPool.length-1))];
    const laneWps = buildLaneWaypoints();

    [[ally1,'top'],[ally2,'bot']].forEach(([h, lane]) => {
      const unit = this._spawnAIHero(h, TEAM_BLUE, lane, laneWps[lane].blue, { x:200, y:1760 });
      this.state.units.push(unit);
    });

    // Spawn 3 red AI heroes
    const redHeroes = [...HEROES].sort(() => Math.random()-0.5).slice(0, 3);
    const redLanes  = ['top','mid','bot'];
    redHeroes.forEach((h, i) => {
      const lane = redLanes[i];
      const unit = this._spawnAIHero(h, TEAM_RED, lane, laneWps[lane].red, { x:1760, y:200 });
      this.state.units.push(unit);
    });

    // Spawn structures
    this._spawnStructures();

    // Spawn jungle camps
    this._spawnJungleCamps();

    // Camera start
    MapRenderer.centerOn(200, 1760);

    // Bind input
    this._bindInput();

    // Player lane waypoints
    this.player.laneWPs = laneWps.mid.blue;
    this.player.laneWpIdx = 0;

    // Start
    this.state.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  },

  _spawnAIHero(heroData, team, lane, wps, base) {
    const unit = new Unit({
      id: heroData.id + '_' + team,
      name: heroData.name,
      team: team,
      type: 'hero',
      role: heroData.role,
      icon: heroData.icon,
      color: heroData.color,
      bgColor: heroData.bgColor,
      heroData: heroData,
      stats: { ...heroData.baseStats },
      growthStats: heroData.growthStats,
      gold: 500,
      x: base.x + (Math.random()-0.5)*80,
      y: base.y + (Math.random()-0.5)*80,
      aggroRange: 500,
      lane: lane,
      laneWPs: wps,
    });
    unit.laneWpIdx = 0;
    unit.aiState = 'lane';
    return unit;
  },

  _spawnStructures() {
    // Towers
    TOWER_DEFS.forEach(def => {
      const tower = new Unit({
        id: `tower_${def.team}_${def.lane}_${def.tier}`,
        name: `${def.team === TEAM_BLUE ? 'Blue' : 'Red'} Tower`,
        team: def.team,
        type: 'tower',
        icon: '🏰',
        color: def.team === TEAM_BLUE ? '#4a7aff' : '#ff4a4a',
        bgColor: '#333',
        stats: { hp: 1500 + def.tier*500, mp: 0, atk: 100 + def.tier*40, def: 40, spd: 0, range: 350 },
        x: def.x, y: def.y,
        aggroRange: 380,
      });
      this.state.towers.push(tower);
      this.state.units.push(tower);
    });

    // Nexuses
    NEXUS_DEFS.forEach(def => {
      const nexus = new Unit({
        id: `nexus_${def.team}`,
        name: `${def.team === TEAM_BLUE ? 'Blue' : 'Red'} Nexus`,
        team: def.team,
        type: 'nexus',
        icon: def.team === TEAM_BLUE ? '💠' : '❤️‍🔥',
        color: def.team === TEAM_BLUE ? '#2a5aff' : '#ff2a2a',
        bgColor: '#111',
        stats: { hp: 4000, mp: 0, atk: 0, def: 30, spd: 0, range: 0 },
        x: def.x, y: def.y,
        aggroRange: 0,
      });
      this.state.nexuses.push(nexus);
      this.state.units.push(nexus);
    });
  },

  _spawnJungleCamps() {
    this.state.jungleCamps = JUNGLE_CAMPS.map((c, i) => {
      const camp = {
        ...c,
        id: 'jungle_' + i,
        maxHp: c.hp,
        alive: true,
        attackTimer: 0,
        atk: c.type === 'boss' ? 60 : 25,
        goldReward: c.reward,
        team: 'jungle',
        type: 'jungle',
        level: c.type === 'boss' ? 5 : 3,
        distanceTo(other) { return Math.hypot(this.x - other.x, this.y - other.y); },
        takeDamage(amount, attacker) {
          if (!this.alive) return 0;
          const actual = Math.max(1, Math.floor(amount * 0.6));
          this.hp = Math.max(0, this.hp - actual);
          if (this.hp <= 0) {
            this.alive = false;
            if (attacker && attacker.type === 'hero') {
              attacker.gold += this.goldReward;
              attacker.addXP(80 + this.level * 15);
              UI.addKillFeed(`${attacker.icon} ${attacker.name} slew ${this.name}! (+${this.goldReward}g)`, attacker.team);
            }
            // Schedule respawn
            setTimeout(() => {
              this.hp = this.maxHp;
              this.alive = true;
            }, JUNGLE_RESPAWN);
          }
          return actual;
        },
      };
      return camp;
    });
  },

  // ---- GAME LOOP ----
  _loop(timestamp) {
    if (!this.state.running) return;
    const dt = Math.min(timestamp - this.lastTime, 100); // cap delta
    this.lastTime = timestamp;
    this.state.elapsed += dt;

    this._update(dt);
    this._render();

    this.animId = requestAnimationFrame(ts => this._loop(ts));
  },

  _update(dt) {
    // Timer
    UI.updateTimer(this.state.elapsed);

    // Minion waves
    this.state.minionTimer += dt;
    if (this.state.minionTimer >= MINION_SPAWN_INTERVAL) {
      this.state.minionTimer = 0;
      this._spawnMinionWave();
    }

    // Camera scroll (WASD / Arrows)
    const spd = this.camScrollSpeed * dt / 1000;
    const k = this.input.keys;
    if (k['ArrowLeft']  || k['a'] || k['A']) MapRenderer.panBy(-spd, 0);
    if (k['ArrowRight'] || k['d'] || k['D']) MapRenderer.panBy( spd, 0);
    if (k['ArrowUp']    || k['w'] || k['W']) MapRenderer.panBy(0, -spd);
    if (k['ArrowDown']  || k['s'] || k['S']) MapRenderer.panBy(0,  spd);
    if (k[' '] || k['Space']) {
      if (this.player) MapRenderer.centerOn(this.player.x, this.player.y);
    }

    // Edge scroll (mouse near edge)
    const edgeZone = 40;
    const cw = this.canvas.width, ch = this.canvas.height;
    const mx = this.input.mouseX, my = this.input.mouseY;
    if (mx < edgeZone) MapRenderer.panBy(-spd * ((edgeZone - mx) / edgeZone), 0);
    if (mx > cw-edgeZone) MapRenderer.panBy(spd * ((mx - (cw-edgeZone)) / edgeZone), 0);
    if (my < edgeZone) MapRenderer.panBy(0, -spd * ((edgeZone - my) / edgeZone));
    if (my > ch-edgeZone) MapRenderer.panBy(0, spd * ((my - (ch-edgeZone)) / edgeZone));

    // Update all units
    const allUnits = [...this.state.units, ...this.state.minions];

    allUnits.forEach(u => {
      if (!u.alive && u.type !== 'hero') return;
      if (u.type === 'tower')  { AI.updateTower(u, dt); return; }
      if (u.type === 'nexus')  return; // static
      if (u === this.player)   { u.update(dt, allUnits); return; }
      if (u._isRemote)         { u.update(dt, allUnits); return; } // opponent — state from RTDB
      if (u.type === 'hero')   { u.update(dt, allUnits); AI.updateHero(u, dt); }
      if (u.type === 'minion') { u.update(dt, allUnits); AI.updateMinion(u, dt); }
    });

    // Jungle camp AI
    this.state.jungleCamps.forEach(c => AI.updateJungleCamp(c, dt));

    // Projectiles
    Combat.updateProjectiles(dt);

    // Visual effects
    this.state.effects = this.state.effects.filter(e => { e.timer -= dt; return e.timer > 0; });

    // Clean dead minions
    this.state.minions = this.state.minions.filter(m => m.alive);

    // Player respawn check
    if (this.player && !this.player.alive && this.player.respawnTimer > 0) {
      // already handled inside unit._die → respawnTimer
    }

    // HUD
    UI.updateHUD(this.player, this.state);
    if (this.input.rightClickTarget) {
      UI.updateTargetPanel(this.input.rightClickTarget);
    }
  },

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    MapRenderer.draw(ctx, {
      units:       this.state.units,
      minions:     this.state.minions,
      towers:      this.state.towers,
      nexuses:     this.state.nexuses,
      jungleCamps: this.state.jungleCamps,
      effects:     this.state.effects,
      projectiles: this.state.projectiles,
      player:      this.player,
    });

    // Range indicator for player when hovering
    if (this.player && this.player.alive) {
      const ps = MapRenderer.toScreen(this.player.x, this.player.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, this.player.range * MapRenderer.zoom, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    MapRenderer.drawMinimap(this.miniCtx, {
      units:       this.state.units,
      minions:     this.state.minions,
      towers:      this.state.towers,
      nexuses:     this.state.nexuses,
      jungleCamps: this.state.jungleCamps,
      player:      this.player,
    });
  },

  // ---- MINION WAVES ----
  _spawnMinionWave() {
    const laneWps = buildLaneWaypoints();
    ['top','mid','bot'].forEach(lane => {
      for (let i = 0; i < MINION_WAVE_COUNT; i++) {
        const offset = i * 40;
        this._spawnMinion(TEAM_BLUE, lane, laneWps[lane].blue, offset);
        this._spawnMinion(TEAM_RED,  lane, laneWps[lane].red,  offset);
      }
    });
  },

  _spawnMinion(team, lane, wps, offset) {
    const base = wps[0];
    const minion = new Unit({
      id: `minion_${team}_${lane}_${Date.now()}_${offset}`,
      name: team === TEAM_BLUE ? 'Blue Soldier' : 'Red Soldier',
      team, type: 'minion',
      icon: team === TEAM_BLUE ? '🔵' : '🔴',
      color: team === TEAM_BLUE ? '#4a9eff' : '#ff4a4a',
      bgColor: '#222',
      stats: {
        hp: 300 + Math.floor(this.state.elapsed / 60000) * 40,
        mp: 0, atk: 30 + Math.floor(this.state.elapsed / 60000) * 5,
        def: 10, spd: 95, range: 55,
      },
      x: base.x + (Math.random()-0.5)*60 + offset,
      y: base.y + (Math.random()-0.5)*60,
      aggroRange: 180,
      laneWPs: wps,
    });
    minion.laneWpIdx = 0;
    minion.targetX = wps[0].x;
    minion.targetY = wps[0].y;
    this.state.minions.push(minion);
  },

  // ---- INPUT ----
  _bindInput() {
    const canvas = this.canvas;

    // Right-click to move/attack
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.player || !this.player.alive) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = MapRenderer.toWorld(sx, sy);

      // Check if clicking on an enemy
      const clicked = this._getUnitAtWorld(world.x, world.y);
      if (clicked && clicked !== this.player) {
        if (clicked.team !== this.player.team) {
          this.player.target = clicked;
          this.player.targetX = clicked.x;
          this.player.targetY = clicked.y;
          this.player.waypoints = [];
          this.input.rightClickTarget = clicked;
        } else {
          // Ally clicked — show target panel
          this.input.rightClickTarget = clicked;
          UI.updateTargetPanel(clicked);
        }
      } else {
        // Move
        this.player.target = null;
        this.player.targetX = world.x;
        this.player.targetY = world.y;
        this.player.waypoints = [];
        this.input.rightClickTarget = null;
        UI.updateTargetPanel(null);
        // Spawn move indicator
        this.spawnEffect(world.x, world.y, 'move_click');
      }
    });

    // Left-click — select unit
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = MapRenderer.toWorld(sx, sy);
      const unit = this._getUnitAtWorld(world.x, world.y);
      this.input.rightClickTarget = unit;
      UI.updateTargetPanel(unit);
    });

    // Mouse move
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.input.mouseX = e.clientX - rect.left;
      this.input.mouseY = e.clientY - rect.top;
    });

    // Scroll zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      MapRenderer.zoom = Math.max(0.4, Math.min(2.0, MapRenderer.zoom * zoomDelta));
    }, { passive: false });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.input.keys[e.key] = true;

      if (!this.player || !this.player.alive) return;
      if (!this.state.running) return;

      // Skill hotkeys
      const skillMap = { 'q':0, 'Q':0, 'w':1, 'W':1, 'e':2, 'E':2, 'r':3, 'R':3 };
      const sx = this.input.mouseX;
      const sy = this.input.mouseY;
      const world = MapRenderer.toWorld(sx, sy);

      if (skillMap[e.key] !== undefined) {
        const idx = skillMap[e.key];
        const target = this.input.rightClickTarget;
        this.player.useSkill(idx, world.x, world.y, target);
        return;
      }

      // Shop
      if (e.key === 'b' || e.key === 'B') {
        const shopEl = document.getElementById('shopOverlay');
        if (shopEl.classList.contains('hidden')) {
          UI.toggleShop(true);
        } else {
          UI.toggleShop(false);
        }
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        UI.toggleShop(false);
        this.input.rightClickTarget = null;
        UI.updateTargetPanel(null);
      }
    });

    window.addEventListener('keyup', (e) => {
      delete this.input.keys[e.key];
    });

    // Skill buttons in HUD
    [['skillQ',0],['skillW',1],['skillE',2],['skillR',3]].forEach(([id, idx]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => {
        if (!this.player || !this.player.alive) return;
        const world = MapRenderer.toWorld(this.input.mouseX, this.input.mouseY);
        this.player.useSkill(idx, world.x, world.y, this.input.rightClickTarget);
      });
    });
  },

  _getUnitAtWorld(wx, wy) {
    const all = [...this.state.units, ...this.state.minions, ...this.state.jungleCamps];
    let best = null, bd = 30;
    all.forEach(u => {
      if (!u.alive) return;
      const r = (u.type === 'tower' || u.type === 'nexus') ? 40 : 22;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < r && d < bd) { bd = d; best = u; }
    });
    return best;
  },

  // ---- BUY ITEM ----
  buyItem(item) {
    if (!this.player) return;
    if (this.player.gold < item.cost) {
      UI.addKillFeed('Not enough gold!', this.player.team);
      return;
    }
    if (this.player.items.length >= 6) {
      UI.addKillFeed('Inventory full!', this.player.team);
      return;
    }
    if (this.player.items.includes(item.id)) {
      UI.addKillFeed(`Already have ${item.name}!`, this.player.team);
      return;
    }
    this.player.gold -= item.cost;
    this.player.items.push(item.id);
    this.player.applyItemBonus(item);
    UI.addKillFeed(`${this.player.icon} Bought ${item.icon} ${item.name}!`, this.player.team);
    UI.refreshShop();
  },

  // ---- EVENTS ----
  onHeroDeath(hero, killer) {
    // Kill count
    if (killer && killer.team) {
      this.state.kills[killer.team] = (this.state.kills[killer.team] || 0) + 1;
    }

    const killerName = killer ? `${killer.icon} ${killer.name}` : 'the map';
    UI.addKillFeed(`${hero.icon} ${hero.name} was slain by ${killerName}`, killer ? killer.team : 'blue');

    if (hero === this.player) {
      const respawnSec = Math.ceil(hero.respawnTimer / 1000);
      UI.showRespawn(respawnSec);
    }
  },

  onStructureDestroyed(structure) {
    UI.addKillFeed(`🏰 ${structure.name} has been destroyed!`,
      structure.team === TEAM_BLUE ? TEAM_RED : TEAM_BLUE);

    if (structure.type === 'nexus') {
      const winTeam = structure.team === TEAM_BLUE ? TEAM_RED : TEAM_BLUE;
      const playerWon = (winTeam === this.player.team);
      this.state.running = false;
      cancelAnimationFrame(this.animId);

      const mm = String(Math.floor(this.state.elapsed / 60000)).padStart(2,'0');
      const ss = String(Math.floor((this.state.elapsed % 60000)/1000)).padStart(2,'0');

      // Notify multiplayer layer
      if (this.isMultiplayer) {
        MultiplayerGame.reportNexusDestroyed(structure.team);
      }

      setTimeout(() => {
        UI.showGameOver(playerWon, {
          kills:    this.player.kills,
          deaths:   this.player.deaths,
          assists:  this.player.assists,
          gold:     Math.floor(this.player.gold),
          duration: `${mm}:${ss}`,
        });
        // Save match history (solo mode — multiplayer handled by MultiplayerGame listener)
        if (!this.isMultiplayer) {
          MatchHistory.save(playerWon, this.player, `${mm}:${ss}`, 'solo_' + Date.now());
        }
      }, 1500);
    }
  },

  // ---- EFFECTS / NUMBERS ----
  spawnEffect(x, y, type) {
    this.state.effects.push({ x, y, type, duration: 500, timer: 500 });
  },

  spawnDamageNumber(wx, wy, text, team) {
    const s = MapRenderer.toScreen(wx, wy);
    const rect = this.canvas.getBoundingClientRect();
    const sy = s.y + rect.top + document.getElementById('topHud').offsetHeight;
    UI.showDamageNumber(s.x + rect.left, sy, text, team);
  },

  // ---- TEAM HELPERS ----
  getEnemiesOf(team) {
    const allUnits = [...this.state.units, ...this.state.minions, ...this.state.jungleCamps];
    return allUnits.filter(u => {
      if (!u.alive) return false;
      if (team === 'jungle') return false;
      if (u.team === 'jungle') return true;
      return u.team !== team;
    });
  },

  getAlliesOf(team) {
    const allUnits = [...this.state.units, ...this.state.minions];
    return allUnits.filter(u => u.alive && u.team === team);
  },

  // ---- RESET ----
  reset() {
    if (this.animId) cancelAnimationFrame(this.animId);
    // Stop multiplayer sync
    if (this.isMultiplayer) MultiplayerGame.stop();
    this.isMultiplayer = false;
    this.state = {
      running: false,
      elapsed: 0,
      units: [], minions: [], towers: [], nexuses: [],
      jungleCamps: [], projectiles: [], effects: [],
      kills: { blue: 0, red: 0 },
      minionTimer: MINION_SPAWN_INTERVAL * 0.5, // first wave at 15s
      jungleTimers: [],
    };
    this.player = null;
    this.input  = { keys:{}, mouseX:0, mouseY:0, rightClickTarget:null };

    document.getElementById('killFeed').innerHTML = '';
    document.getElementById('damageLayer').innerHTML = '';
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('respawnOverlay').classList.add('hidden');
    document.getElementById('shopOverlay').classList.add('hidden');
    document.getElementById('targetPanel').classList.add('hidden');
  },
};

// ---- BOOT ----
window.addEventListener('load', () => {
  Game.init();
});
