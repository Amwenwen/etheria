// ===================================================
//  COMBAT.JS  — Skill execution, projectiles, AoE
// ===================================================

const Combat = {
  // Execute a hero skill
  executeSkill(caster, idx, skill, targetX, targetY, targetUnit) {
    const team = caster.team;
    const enemies = Game.getEnemiesOf(team);
    const allies  = Game.getAlliesOf(team);

    switch (skill.key) {
      // ---- THERON ----
      case 'Q': {
        if (caster.heroData && caster.heroData.id === 'theron') {
          // Blade Dash — dash forward
          const angle = Math.atan2(targetY - caster.y, targetX - caster.x);
          const dashDist = 220;
          const nx = caster.x + Math.cos(angle) * dashDist;
          const ny = caster.y + Math.sin(angle) * dashDist;
          caster.targetX = nx; caster.targetY = ny;
          caster.x = nx; caster.y = ny; // instant
          // Damage enemies in path
          enemies.forEach(e => {
            if (!e.alive) return;
            if (this._distToSeg(e.x, e.y, caster.x - Math.cos(angle)*dashDist, caster.y - Math.sin(angle)*dashDist, nx, ny) < 60) {
              const dmg = caster.takeDamage ? caster.atk * 1.5 : 0;
              const dealt = e.takeDamage(caster.atk * 1.5, caster);
              Game.spawnDamageNumber(e.x, e.y, dealt, caster.team);
            }
          });
        } else if (caster.heroData && caster.heroData.id === 'lyria') {
          // Arcane Bolt
          this._spawnProjectile(caster, targetX, targetY, { dmgMult: 1.4, color: '#a855f7', radius: 8, speed: 500 });
        } else if (caster.heroData && caster.heroData.id === 'kael') {
          // Shadow Step — teleport behind nearest enemy
          let nearest = this._getNearestEnemy(caster, enemies, 600);
          if (!nearest && targetUnit) nearest = targetUnit;
          if (nearest) {
            const angle = Math.atan2(caster.y - nearest.y, caster.x - nearest.x);
            caster.x = nearest.x + Math.cos(angle) * 45;
            caster.y = nearest.y + Math.sin(angle) * 45;
            caster.targetX = caster.x; caster.targetY = caster.y;
            const dealt = nearest.takeDamage(caster.atk * 1.8, caster);
            Game.spawnDamageNumber(nearest.x, nearest.y, dealt, caster.team);
          }
        } else if (caster.heroData && caster.heroData.id === 'sera') {
          // Holy Mend
          const target = this._getNearestAlly(caster, allies, 500) || caster;
          const amount = Math.floor(200 + target.maxHp * 0.2);
          target.heal(amount);
          Game.spawnEffect(target.x, target.y, 'heal');
          Game.spawnDamageNumber(target.x, target.y, amount, 'heal');
        } else if (caster.heroData && caster.heroData.id === 'brutus') {
          // Stone Skin shield
          caster.shielded = Math.floor(300 + caster.maxHp * 0.1);
          Game.spawnEffect(caster.x, caster.y, 'skill_cast');
        } else if (caster.heroData && caster.heroData.id === 'reva') {
          // Snipe — 3 rapid projectiles
          for (let i = 0; i < 3; i++) {
            const capturedI = i;
            setTimeout(() => {
              if (!caster.alive || !Game.state.running) return;
              const spread = (capturedI - 1) * 15;
              const angle = Math.atan2(targetY - caster.y, targetX - caster.x) + (spread * Math.PI / 180);
              const tx2 = caster.x + Math.cos(angle) * 600;
              const ty2 = caster.y + Math.sin(angle) * 600;
              Combat._spawnProjectile(caster, tx2, ty2, { dmgMult: 0.9, color: '#f97316', radius: 6, speed: 600 });
            }, capturedI * 150);
          }
        }
        break;
      }

      case 'W': {
        if (caster.heroData && caster.heroData.id === 'theron') {
          // War Cry — ATK boost
          caster.atkBoost = 0.4;
          caster.atkBoostTimer = 4000;
        } else if (caster.heroData && caster.heroData.id === 'lyria') {
          // Nova Burst AoE
          this._spawnAoE(caster, targetX, targetY, 120, 1.6, 1000, '#a855f7');
        } else if (caster.heroData && caster.heroData.id === 'kael') {
          // Poison Blade flag
          caster._nextPoison = true;
        } else if (caster.heroData && caster.heroData.id === 'sera') {
          // Radiant Aura
          allies.forEach(a => {
            if (!a.alive) return;
            if (caster.distanceTo(a) < 500) {
              a.def += 30;
              setTimeout(() => { if (a.def > 10) a.def -= 30; }, 5000);
              Game.spawnEffect(a.x, a.y, 'heal');
            }
          });
        } else if (caster.heroData && caster.heroData.id === 'brutus') {
          // Ground Slam
          this._spawnAoE(caster, caster.x, caster.y, 160, 1.2, 0, '#6b7280');
          enemies.forEach(e => {
            if (caster.distanceTo(e) < 160 && e.alive) {
              e.stunned = 1500;
            }
          });
        } else if (caster.heroData && caster.heroData.id === 'reva') {
          // Eagle Eye — crit flag
          caster._critReady = true;
        }
        break;
      }

      case 'E': {
        if (caster.heroData && caster.heroData.id === 'theron') {
          // Iron Shield — invuln
          caster.invuln = true;
          setTimeout(() => { caster.invuln = false; }, 1500);
        } else if (caster.heroData && caster.heroData.id === 'lyria') {
          // Blink
          caster.x = targetX; caster.y = targetY;
          caster.targetX = targetX; caster.targetY = targetY;
        } else if (caster.heroData && caster.heroData.id === 'kael') {
          // Smoke Bomb — invisibility
          caster.invisible = 2000;
        } else if (caster.heroData && caster.heroData.id === 'sera') {
          // Purify nearest ally
          const a = this._getNearestAlly(caster, allies, 600) || caster;
          a.stunned = 0; a.poisoned = 0;
          Game.spawnEffect(a.x, a.y, 'skill_cast');
        } else if (caster.heroData && caster.heroData.id === 'brutus') {
          // Taunt
          enemies.forEach(e => {
            if (e.alive && caster.distanceTo(e) < 200) {
              e.target = caster;
              e.targetX = caster.x; e.targetY = caster.y;
            }
          });
        } else if (caster.heroData && caster.heroData.id === 'reva') {
          // Evasive Roll
          const angle = Math.atan2(targetY - caster.y, targetX - caster.x);
          caster.x += Math.cos(angle) * 160;
          caster.y += Math.sin(angle) * 160;
          caster.speedBoost = 2000;
          Game.spawnEffect(caster.x, caster.y, 'skill_cast');
        }
        break;
      }

      case 'R': {
        // Ultimates
        if (caster.heroData && caster.heroData.id === 'theron') {
          // Titan Cleave — spin AoE
          this._spawnAoE(caster, caster.x, caster.y, 200, 3.0, 0, '#ef4444');
        } else if (caster.heroData && caster.heroData.id === 'lyria') {
          // Meteor Rain
          for (let i = 0; i < 5; i++) {
            const capturedI = i;
            setTimeout(() => {
              if (!Game.state.running) return;
              const ox = targetX + (Math.random()-0.5)*200;
              const oy = targetY + (Math.random()-0.5)*200;
              Combat._spawnAoE(caster, ox, oy, 100, 2.0, 0, '#f97316');
              Game.spawnEffect(ox, oy, 'death');
            }, capturedI * 350);
          }
        } else if (caster.heroData && caster.heroData.id === 'kael') {
          // Death Mark
          const t = targetUnit || this._getNearestEnemy(caster, enemies, 800);
          if (t && t.alive) {
            const dealt = t.takeDamage(t.maxHp * 0.4, caster);
            Game.spawnDamageNumber(t.x, t.y, dealt, caster.team);
            Game.spawnEffect(t.x, t.y, 'death');
          }
        } else if (caster.heroData && caster.heroData.id === 'sera') {
          // Divine Light — revive ally
          const dead = allies.filter(a => !a.alive && a !== caster);
          if (dead.length > 0) {
            const ally = dead[0];
            ally.hp = Math.floor(ally.maxHp * 0.5);
            ally.alive = true;
            ally.respawnTimer = 0;
            ally.x = caster.x + 50; ally.y = caster.y;
            ally.targetX = ally.x; ally.targetY = ally.y;
            Game.spawnEffect(ally.x, ally.y, 'levelup');
            Game.spawnDamageNumber(ally.x, ally.y - 30, 'REVIVED!', caster.team);
          }
        } else if (caster.heroData && caster.heroData.id === 'brutus') {
          // Fortress Wall
          caster.invuln = true;
          setTimeout(() => { caster.invuln = false; }, 3000);
          Game.spawnEffect(caster.x, caster.y, 'levelup');
        } else if (caster.heroData && caster.heroData.id === 'reva') {
          // Rain of Arrows — repeated projectiles
          let count = 0;
          const rai = setInterval(() => {
            if (!caster.alive || !Game.state.running || count >= 12) { clearInterval(rai); return; }
            const ox = targetX + (Math.random()-0.5)*250;
            const oy = targetY + (Math.random()-0.5)*250;
            Combat._spawnProjectile(caster, ox, oy, { dmgMult: 0.7, color: '#f97316', radius: 7, speed: 700 });
            count++;
          }, 300);
        }
        break;
      }
    }
  },

  _spawnProjectile(caster, tx, ty, cfg) {
    const angle = Math.atan2(ty - caster.y, tx - caster.x);
    Game.state.projectiles.push({
      x: caster.x, y: caster.y,
      vx: Math.cos(angle) * cfg.speed,
      vy: Math.sin(angle) * cfg.speed,
      team: caster.team,
      caster,
      dmgMult: cfg.dmgMult || 1,
      color: cfg.color || '#ff0',
      radius: cfg.radius || 6,
      alive: true,
      traveled: 0,
      maxRange: cfg.maxRange || 700,
    });
  },

  _spawnAoE(caster, x, y, radius, dmgMult, stunMs, color) {
    const enemies = Game.getEnemiesOf(caster.team);
    enemies.forEach(e => {
      if (!e.alive) return;
      if (Math.hypot(e.x - x, e.y - y) < radius) {
        const dealt = e.takeDamage(caster.atk * dmgMult, caster);
        Game.spawnDamageNumber(e.x, e.y, dealt, caster.team);
        if (stunMs > 0) e.stunned = stunMs;
        Game.spawnEffect(e.x, e.y, 'hit');
      }
    });
    Game.spawnEffect(x, y, 'skill_cast');
  },

  _getNearestEnemy(caster, enemies, maxRange) {
    let best = null, bd = maxRange;
    enemies.forEach(e => {
      if (!e.alive) return;
      const d = caster.distanceTo(e);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  },

  _getNearestAlly(caster, allies, maxRange) {
    let best = null, bd = maxRange;
    allies.forEach(a => {
      if (!a.alive || a === caster) return;
      const d = caster.distanceTo(a);
      if (d < bd) { bd = d; best = a; }
    });
    return best;
  },

  // Distance from point to line segment
  _distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx*dx + dy*dy;
    if (len2 === 0) return Math.hypot(px-ax, py-ay);
    let t = ((px-ax)*dx + (py-ay)*dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax+t*dx), py - (ay+t*dy));
  },

  // Update all projectiles
  updateProjectiles(dt) {
    const state = Game.state;
    state.projectiles = state.projectiles.filter(p => {
      if (!p.alive) return false;
      const step = p.vx * dt/1000;
      const stepY = p.vy * dt/1000;
      p.x += step; p.y += stepY;
      p.traveled += Math.hypot(step, stepY);

      if (p.traveled > p.maxRange) { p.alive = false; return false; }

      // Hit check
      const enemies = Game.getEnemiesOf(p.team);
      for (const e of enemies) {
        if (!e.alive) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + 18) {
          const dealt = e.takeDamage(p.caster.atk * p.dmgMult, p.caster);
          Game.spawnDamageNumber(e.x, e.y, dealt, p.team);
          Game.spawnEffect(e.x, e.y, 'hit');
          p.alive = false;
          return false;
        }
      }
      return true;
    });
  }
};
