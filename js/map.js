// ===================================================
//  MAP.JS  — Renders the game world
// ===================================================

const MapRenderer = {
  // Camera
  camX: 0,
  camY: 0,
  camW: 0,
  camH: 0,
  zoom: 1,

  init(canvasW, canvasH) {
    this.camW = canvasW;
    this.camH = canvasH;
    // Start camera centered on blue base
    this.camX = 0;
    this.camY = MAP_PY - canvasH;
    this._buildGradients();
  },

  _buildGradients() {
    // Pre-define terrain colors per tile type
    this.tileColors = {
      grass:   '#2d5a1b',
      grass2:  '#356b22',
      path:    '#7a6040',
      path2:   '#8a7050',
      river:   '#1a4a7a',
      river2:  '#1e5a8a',
      jungle:  '#1a3a0a',
      base_b:  '#0a1a3a',
      base_r:  '#3a0a0a',
    };
  },

  // World -> Screen
  toScreen(wx, wy) {
    return {
      x: (wx - this.camX) * this.zoom,
      y: (wy - this.camY) * this.zoom,
    };
  },

  // Screen -> World
  toWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.camX,
      y: sy / this.zoom + this.camY,
    };
  },

  clampCamera() {
    this.camX = Math.max(0, Math.min(MAP_PX - this.camW / this.zoom, this.camX));
    this.camY = Math.max(0, Math.min(MAP_PY - this.camH / this.zoom, this.camY));
  },

  centerOn(wx, wy) {
    this.camX = wx - (this.camW / this.zoom) / 2;
    this.camY = wy - (this.camH / this.zoom) / 2;
    this.clampCamera();
  },

  panBy(dx, dy) {
    this.camX += dx / this.zoom;
    this.camY += dy / this.zoom;
    this.clampCamera();
  },

  isOnScreen(wx, wy, margin) {
    margin = margin || 80;
    const s = this.toScreen(wx, wy);
    return s.x > -margin && s.x < this.camW + margin &&
           s.y > -margin && s.y < this.camH + margin;
  },

  // ---- DRAW ----
  draw(ctx, gameState) {
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    this._drawTerrain(ctx);
    this._drawLanePaths(ctx);
    this._drawRiver(ctx);
    this._drawBases(ctx);
    this._drawJungleCamps(ctx, gameState.jungleCamps);
    this._drawTowers(ctx, gameState.towers);
    this._drawNexuses(ctx, gameState.nexuses);
    this._drawMinions(ctx, gameState.minions);
    this._drawHeroes(ctx, gameState.units, gameState.player);
    this._drawEffects(ctx, gameState.effects);
    this._drawProjectiles(ctx, gameState.projectiles);

    ctx.restore();
  },

  _drawTerrain(ctx) {
    const startTX = Math.floor(this.camX / TILE);
    const startTY = Math.floor(this.camY / TILE);
    const endTX = Math.ceil((this.camX + this.camW / this.zoom) / TILE) + 1;
    const endTY = Math.ceil((this.camY + this.camH / this.zoom) / TILE) + 1;

    for (let ty = Math.max(0, startTY); ty < Math.min(MAP_H, endTY); ty++) {
      for (let tx = Math.max(0, startTX); tx < Math.min(MAP_W, endTX); tx++) {
        const wx = tx * TILE;
        const wy = ty * TILE;

        // Determine tile type by position
        let color = this._getTileColor(tx, ty);
        ctx.fillStyle = color;
        ctx.fillRect(wx, wy, TILE, TILE);

        // Subtle grid lines for path tiles
        if (color === this.tileColors.path || color === this.tileColors.path2) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(wx, wy, TILE, TILE);
        }
      }
    }
  },

  _getTileColor(tx, ty) {
    const tc = this.tileColors;
    // Blue base area
    if (tx < 8 && ty > MAP_H - 8) return tc.base_b;
    // Red base area
    if (tx > MAP_W - 8 && ty < 8) return tc.base_r;
    // Jungle zones
    if ((tx > 14 && tx < 26 && ty > 14 && ty < 26) ||
        (tx > 34 && tx < 46 && ty > 34 && ty < 46) ||
        (tx > 14 && tx < 26 && ty > 34 && ty < 46) ||
        (tx > 34 && tx < 46 && ty > 14 && ty < 26)) {
      return ((tx + ty) % 2 === 0) ? tc.jungle : '#1e4210';
    }
    // River (diagonal band)
    const mid = Math.abs(tx + ty - MAP_W);
    if (mid < 3) return (mid === 0) ? tc.river : tc.river2;
    // Lanes (horizontal top, mid diagonal, bottom)
    if (ty < 6 && tx > 6 && tx < MAP_W - 6) return (tx % 2) ? tc.path : tc.path2;
    if (ty > MAP_H - 6 && tx > 6 && tx < MAP_W - 6) return (tx % 2) ? tc.path : tc.path2;
    if (Math.abs(tx - ty) < 4) return (tx % 2) ? tc.path : tc.path2;
    // Default grass
    return ((tx + ty) % 3 === 0) ? tc.grass : tc.grass2;
  },

  _drawLanePaths(ctx) {
    ctx.strokeStyle = 'rgba(200,180,120,0.25)';
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const wps = buildLaneWaypoints();
    [wps.top.blue, wps.mid.blue, wps.bot.blue].forEach(lane => {
      ctx.beginPath();
      ctx.moveTo(lane[0].x, lane[0].y);
      for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x, lane[i].y);
      ctx.stroke();
    });
  },

  _drawRiver(ctx) {
    // River diagonal band
    ctx.fillStyle = 'rgba(30,90,140,0.4)';
    ctx.beginPath();
    ctx.moveTo(960 - 60, 0);
    ctx.lineTo(960 + 60, 0);
    ctx.lineTo(MAP_PX, MAP_PY - 960 + 60);
    ctx.lineTo(MAP_PX, MAP_PY - 960 - 60);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 960 - 60);
    ctx.lineTo(0, 960 + 60);
    ctx.lineTo(MAP_PX - 960 + 60, MAP_PY);
    ctx.lineTo(MAP_PX - 960 - 60, MAP_PY);
    ctx.closePath();
    ctx.fill();
  },

  _drawBases(ctx) {
    // Blue base
    ctx.fillStyle = 'rgba(30,70,160,0.35)';
    ctx.beginPath();
    ctx.arc(160, 1760, 200, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,120,255,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Red base
    ctx.fillStyle = 'rgba(160,30,30,0.35)';
    ctx.beginPath();
    ctx.arc(1760, 160, 200, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,60,60,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();
  },

  _drawJungleCamps(ctx, camps) {
    if (!camps) return;
    camps.forEach(camp => {
      if (!camp.alive) return;
      const s = this.toScreen(camp.x, camp.y);
      if (!this.isOnScreen(camp.x, camp.y, 100)) return;

      // Draw camp circle
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(camp.x, camp.y, 40, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = camp.type === 'boss' ? '#ff4' : '#6a4';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.font = camp.type === 'boss' ? '28px serif' : '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(camp.icon, camp.x, camp.y);

      // HP bar
      this._drawHpBar(ctx, camp.x, camp.y - 50, 60, 8, camp.hp / camp.maxHp, '#ff4444', '#222');

      // Name
      ctx.fillStyle = '#ddd';
      ctx.font = '10px sans-serif';
      ctx.fillText(camp.name, camp.x, camp.y + 52);
    });
  },

  _drawTowers(ctx, towers) {
    if (!towers) return;
    towers.forEach(t => {
      if (!t.alive) return;
      const color = t.team === TEAM_BLUE ? '#4a7aff' : '#ff4a4a';
      const glow  = t.team === TEAM_BLUE ? 'rgba(74,122,255,0.4)' : 'rgba(255,74,74,0.4)';

      // Base
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 36, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 24, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏰', t.x, t.y);

      // HP bar
      this._drawHpBar(ctx, t.x, t.y - 44, 56, 8, t.hp / t.maxHp,
        t.team === TEAM_BLUE ? '#4a9eff' : '#ff4a4a', '#333');

      // Attack range indicator (faint)
      if (t._attacking) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.range, 0, Math.PI*2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  },

  _drawNexuses(ctx, nexuses) {
    if (!nexuses) return;
    nexuses.forEach(n => {
      if (!n.alive) return;
      const color = n.team === TEAM_BLUE ? '#2a5aff' : '#ff2a2a';
      const glow  = n.team === TEAM_BLUE ? 'rgba(42,90,255,0.5)' : 'rgba(255,42,42,0.5)';

      // Glow
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 70, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 44, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.team === TEAM_BLUE ? '💠' : '❤️‍🔥', n.x, n.y);

      // HP bar
      this._drawHpBar(ctx, n.x, n.y - 60, 80, 10, n.hp / n.maxHp, color, '#222');

      ctx.fillStyle = '#eee';
      ctx.font = '11px sans-serif';
      ctx.fillText('NEXUS', n.x, n.y + 60);
    });
  },

  _drawMinions(ctx, minions) {
    if (!minions) return;
    minions.forEach(m => {
      if (!m.alive) return;
      if (!this.isOnScreen(m.x, m.y, 40)) return;
      const color = m.team === TEAM_BLUE ? '#4a9eff' : '#ff4a4a';

      ctx.fillStyle = m.team === TEAM_BLUE ? 'rgba(30,60,150,0.5)' : 'rgba(150,30,30,0.5)';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 16, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 12, 0, Math.PI*2);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '12px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.team === TEAM_BLUE ? '🟦' : '🟥', m.x, m.y);

      this._drawHpBar(ctx, m.x, m.y - 22, 30, 4, m.hp / m.maxHp, color, '#333');
    });
  },

  _drawHeroes(ctx, units, player) {
    if (!units) return;
    units.forEach(u => {
      if (!u.alive || !this.isOnScreen(u.x, u.y, 60)) return;
      this._drawHeroUnit(ctx, u, u === player);
    });
  },

  _drawHeroUnit(ctx, u, isPlayer) {
    const color = u.team === TEAM_BLUE ? '#4a9eff' : '#ff4a4a';
    const r = isPlayer ? 22 : 18;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(u.x, u.y + r + 2, r * 0.8, r * 0.3, 0, 0, Math.PI*2);
    ctx.fill();

    // Invisible effect
    if (u.invisible > 0 && u.team !== (Game && Game.player ? Game.player.team : 'blue')) {
      return;
    }
    const alpha = (u.invisible > 0) ? 0.4 : 1.0;
    ctx.globalAlpha = alpha;

    // Glow ring for player
    if (isPlayer) {
      ctx.fillStyle = 'rgba(245,166,35,0.25)';
      ctx.beginPath();
      ctx.arc(u.x, u.y, r + 10, 0, Math.PI*2);
      ctx.fill();
    }

    // Team ring
    ctx.strokeStyle = color;
    ctx.lineWidth = isPlayer ? 3 : 2;
    ctx.beginPath();
    ctx.arc(u.x, u.y, r + 3, 0, Math.PI*2);
    ctx.stroke();

    // Hero body circle
    ctx.fillStyle = u.bgColor || '#333';
    ctx.beginPath();
    ctx.arc(u.x, u.y, r, 0, Math.PI*2);
    ctx.fill();

    // Hero icon
    ctx.font = `${isPlayer ? 20 : 16}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.icon, u.x, u.y);

    ctx.globalAlpha = 1;

    // HP bar
    this._drawHpBar(ctx, u.x, u.y - r - 18, r * 2.5, 5, u.hp / u.maxHp,
      u.hp / u.maxHp > 0.5 ? '#3a3' : u.hp / u.maxHp > 0.25 ? '#aa3' : '#a33', '#222');

    // Name + level
    ctx.fillStyle = isPlayer ? '#f5a623' : '#fff';
    ctx.font = `${isPlayer ? '10px' : '9px'} sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${u.name} ${u.level}`, u.x, u.y + r + 4);

    // Status icons
    let sx = u.x - 20;
    if (u.stunned > 0)    { ctx.font='12px serif'; ctx.fillText('😵', sx, u.y - r - 30); sx += 15; }
    if (u.shielded > 0)   { ctx.font='12px serif'; ctx.fillText('🛡️', sx, u.y - r - 30); sx += 15; }
    if (u.invisible > 0)  { ctx.font='12px serif'; ctx.fillText('👁️', sx, u.y - r - 30); }
  },

  _drawHpBar(ctx, cx, cy, w, h, pct, fillColor, bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(cx - w/2, cy, w, h);
    ctx.fillStyle = fillColor;
    ctx.fillRect(cx - w/2, cy, w * Math.max(0, Math.min(1, pct)), h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - w/2, cy, w, h);
  },

  _drawEffects(ctx, effects) {
    if (!effects) return;
    effects.forEach(e => {
      const prog = 1 - (e.timer / e.duration);
      const alpha = 1 - prog;
      ctx.globalAlpha = Math.max(0, alpha);

      if (e.type === 'hit') {
        ctx.fillStyle = '#ff6';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 12 * prog, 0, Math.PI*2);
        ctx.fill();
      } else if (e.type === 'death') {
        ctx.fillStyle = `rgba(255,50,50,${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 40 * prog, 0, Math.PI*2);
        ctx.fill();
      } else if (e.type === 'levelup') {
        ctx.fillStyle = `rgba(245,166,35,${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 50 * prog, 0, Math.PI*2);
        ctx.fill();
      } else if (e.type === 'skill_cast') {
        ctx.strokeStyle = `rgba(100,200,255,${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 35 * prog, 0, Math.PI*2);
        ctx.stroke();
      } else if (e.type === 'spawn') {
        ctx.fillStyle = `rgba(100,255,100,${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 30 * prog, 0, Math.PI*2);
        ctx.fill();
      } else if (e.type === 'move_click') {
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16 * (1 - prog * 0.5), 0, Math.PI*2);
        ctx.stroke();
      } else if (e.type === 'heal') {
        ctx.fillStyle = `rgba(50,255,50,${alpha})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 25 * prog, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    });
  },

  _drawProjectiles(ctx, projs) {
    if (!projs) return;
    projs.forEach(p => {
      ctx.fillStyle = p.color || '#ff0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 6, 0, Math.PI*2);
      ctx.fill();
      // Trail
      ctx.strokeStyle = p.color || '#ff0';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.15, p.y - p.vy * 0.15);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  },

  // ---- MINIMAP ----
  drawMinimap(ctx, gameState) {
    const mw = ctx.canvas.width;
    const mh = ctx.canvas.height;
    const scaleX = mw / MAP_PX;
    const scaleY = mh / MAP_PY;

    ctx.clearRect(0, 0, mw, mh);

    // Background
    ctx.fillStyle = '#1a2a12';
    ctx.fillRect(0, 0, mw, mh);

    // Terrain color zones
    ctx.fillStyle = '#0a1a3a';
    ctx.fillRect(0, mh * 0.85, mw * 0.15, mh * 0.15);
    ctx.fillStyle = '#3a0a0a';
    ctx.fillRect(mw * 0.85, 0, mw * 0.15, mh * 0.15);

    // Lane paths
    ctx.strokeStyle = 'rgba(200,180,120,0.35)';
    ctx.lineWidth = 3;
    const wps = buildLaneWaypoints();
    [wps.top.blue, wps.mid.blue, wps.bot.blue].forEach(lane => {
      ctx.beginPath();
      ctx.moveTo(lane[0].x * scaleX, lane[0].y * scaleY);
      for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x * scaleX, lane[i].y * scaleY);
      ctx.stroke();
    });

    // Jungle camps
    if (gameState.jungleCamps) {
      gameState.jungleCamps.forEach(camp => {
        if (!camp.alive) return;
        ctx.fillStyle = '#4a8a20';
        ctx.beginPath();
        ctx.arc(camp.x * scaleX, camp.y * scaleY, 3, 0, Math.PI*2);
        ctx.fill();
      });
    }

    // Towers
    if (gameState.towers) {
      gameState.towers.forEach(t => {
        if (!t.alive) return;
        ctx.fillStyle = t.team === TEAM_BLUE ? '#6a9aff' : '#ff6a6a';
        ctx.fillRect(t.x * scaleX - 3, t.y * scaleY - 3, 6, 6);
      });
    }

    // Nexuses
    if (gameState.nexuses) {
      gameState.nexuses.forEach(n => {
        if (!n.alive) return;
        ctx.fillStyle = n.team === TEAM_BLUE ? '#2a5aff' : '#ff2a2a';
        ctx.beginPath();
        ctx.arc(n.x * scaleX, n.y * scaleY, 5, 0, Math.PI*2);
        ctx.fill();
      });
    }

    // Minions
    if (gameState.minions) {
      gameState.minions.forEach(m => {
        if (!m.alive) return;
        ctx.fillStyle = m.team === TEAM_BLUE ? '#4a9eff' : '#ff4a4a';
        ctx.beginPath();
        ctx.arc(m.x * scaleX, m.y * scaleY, 2, 0, Math.PI*2);
        ctx.fill();
      });
    }

    // Heroes
    if (gameState.units) {
      gameState.units.forEach(u => {
        if (!u.alive) return;
        ctx.fillStyle = u.team === TEAM_BLUE ? '#4affff' : '#ffaa4a';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(u.x * scaleX, u.y * scaleY, u === gameState.player ? 4 : 3, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Camera viewport
    const vx = this.camX * scaleX;
    const vy = this.camY * scaleY;
    const vw = (this.camW / this.zoom) * scaleX;
    const vh = (this.camH / this.zoom) * scaleY;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, mw, mh);
  }
};
