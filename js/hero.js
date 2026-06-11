// ===================================================
//  HERO.JS  — Unit class (heroes, minions, towers)
// ===================================================

class Unit {
  constructor(cfg) {
    this.id       = cfg.id || Math.random().toString(36).slice(2);
    this.name     = cfg.name || 'Unit';
    this.team     = cfg.team;           // 'blue' | 'red'
    this.type     = cfg.type || 'hero'; // 'hero' | 'minion' | 'tower' | 'nexus' | 'jungle'
    this.role     = cfg.role || '';
    this.icon     = cfg.icon || '•';
    this.color    = cfg.color || '#fff';
    this.bgColor  = cfg.bgColor || '#333';
    this.heroData = cfg.heroData || null;

    // Position
    this.x = cfg.x || 0;
    this.y = cfg.y || 0;

    // Stats
    this.level  = 1;
    this.xp     = 0;
    this.xpNext = 100;

    const s = cfg.stats || {};
    this.maxHp  = s.hp  || 300;
    this.hp     = this.maxHp;
    this.maxMp  = s.mp  || 100;
    this.mp     = this.maxMp;
    this.atk    = s.atk || 40;
    this.def    = s.def || 10;
    this.spd    = s.spd || 110;
    this.range  = s.range || 60;

    this.growthStats = cfg.growthStats || { hp:50, mp:10, atk:8, def:4, spd:0 };

    // Combat state
    this.alive       = true;
    this.respawnTimer= 0;
    this.invuln      = false;
    this.shielded    = 0;   // shield HP
    this.stunned     = 0;   // stun duration ms
    this.invisible   = 0;   // invisibility ms
    this.speedBoost  = 0;   // ms duration
    this.atkBoost    = 0;   // % bonus
    this.atkBoostTimer = 0;
    this.lifesteal   = 0;
    this.poisoned    = 0;   // ms duration

    // Movement
    this.targetX     = this.x;
    this.targetY     = this.y;
    this.waypoints   = [];  // path waypoints
    this.wpIdx       = 0;

    // Combat targeting
    this.target      = null; // current attack target
    this.attackTimer = 0;    // ms until next attack
    this.attackRate  = 1200; // ms between attacks

    // Gold
    this.gold = cfg.gold || 500;
    this.kills = 0;
    this.deaths = 0;
    this.assists = 0;

    // Skills
    this.skills   = (cfg.heroData && cfg.heroData.skills) ? cfg.heroData.skills : [];
    this.skillCDs = this.skills.map(() => 0); // remaining cooldown ms

    // Items
    this.items = []; // item ids

    // AI state
    this.aiState    = 'lane';   // 'lane' | 'fight' | 'retreat' | 'jungle'
    this.laneWPs    = cfg.laneWPs || [];
    this.laneWpIdx  = 0;

    // Visual effects
    this.effects    = []; // [{type, duration, timer, ...}]

    // Lane assignment
    this.lane       = cfg.lane || 'mid';

    // Aggro radius
    this.aggroRange = cfg.aggroRange || (this.type === 'tower' ? 400 : 600);
  }

  // ---- LEVEL UP ----
  addXP(amount) {
    if (!this.alive) return;
    this.xp += amount;
    while (this.xp >= this.xpNext && this.level < 15) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.floor(this.xpNext * 1.3);
      this._applyLevelUp();
    }
  }

  _applyLevelUp() {
    const g = this.growthStats;
    const prevMaxHp = this.maxHp;
    this.maxHp += g.hp || 0;
    this.maxMp += g.mp || 0;
    this.atk   += g.atk || 0;
    this.def   += g.def || 0;
    // Restore a portion of HP on level up
    this.hp = Math.min(this.hp + (this.maxHp - prevMaxHp), this.maxHp);
    this.mp = Math.min(this.mp + 50, this.maxMp);
    Game.spawnEffect(this.x, this.y, 'levelup');
  }

  // ---- ITEM BONUSES ----
  applyItemBonus(item) {
    const b = item.bonus;
    if (b.atk)      this.atk    += b.atk;
    if (b.def)      this.def    += b.def;
    if (b.hp)     { this.maxHp  += b.hp; this.hp  += b.hp; }
    if (b.mp)     { this.maxMp  += b.mp; this.mp  += b.mp; }
    if (b.spd)      this.spd    += b.spd;
    if (b.lifesteal)this.lifesteal += b.lifesteal;
  }

  // ---- TAKING DAMAGE ----
  takeDamage(amount, attacker) {
    if (!this.alive || this.invuln) return 0;
    if (this.shielded > 0) {
      const absorbed = Math.min(this.shielded, amount);
      this.shielded -= absorbed;
      amount -= absorbed;
      if (amount <= 0) return 0;
    }
    const reduction = this.def / (this.def + 100);
    const actual = Math.max(1, Math.floor(amount * (1 - reduction)));
    this.hp = Math.max(0, this.hp - actual);
    if (this.hp <= 0) this._die(attacker);
    return actual;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // ---- DEATH ----
  _die(killer) {
    this.alive = false;
    this.target = null;

    if (killer) {
      // Gold reward
      let goldReward = 0;
      if (this.type === 'hero')   goldReward = 200 + this.level * 15;
      if (this.type === 'minion') goldReward = 40;
      if (this.type === 'jungle') goldReward = this.goldReward || 80;
      if (this.type === 'tower')  goldReward = 150;

      if (killer.type === 'hero' || killer.type === 'player') {
        killer.gold += goldReward;
        killer.kills++;
        killer.addXP(60 + this.level * 10);
      }

      if (this.type === 'hero') {
        this.deaths++;
        this.respawnTimer = 5000 + this.level * 1000;
        Game.onHeroDeath(this, killer);
      }
    }

    if (this.type === 'tower' || this.type === 'nexus') {
      Game.onStructureDestroyed(this);
    }

    Game.spawnEffect(this.x, this.y, 'death');
  }

  // ---- PASSIVE REGEN ----
  regen(dt) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + (this.maxHp * 0.0008 * dt / 1000));
    this.mp = Math.min(this.maxMp, this.mp + (this.maxMp * 0.004 * dt / 1000));
  }

  // ---- SKILL USE ----
  useSkill(idx, targetX, targetY, targetUnit) {
    if (!this.alive) return false;
    const skill = this.skills[idx];
    if (!skill) return false;
    if (this.skillCDs[idx] > 0) return false;
    if (this.mp < skill.cost) return false;

    this.mp -= skill.cost;
    this.skillCDs[idx] = skill.cd * 1000;

    Combat.executeSkill(this, idx, skill, targetX, targetY, targetUnit);
    Game.spawnEffect(this.x, this.y, 'skill_cast');
    return true;
  }

  // ---- UPDATE COOLDOWNS / BUFFS ----
  update(dt, allUnits) {
    if (!this.alive) {
      if (this.type === 'hero' && this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this._respawn();
      }
      return;
    }

    // Regen
    this.regen(dt);

    // Cooldowns
    this.skillCDs = this.skillCDs.map(cd => Math.max(0, cd - dt));

    // Attack cooldown
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    // Buffs duration
    if (this.stunned > 0)      this.stunned     -= dt;
    if (this.invisible > 0)    this.invisible   -= dt;
    if (this.speedBoost > 0)   this.speedBoost  -= dt;
    if (this.poisoned > 0) {
      this.poisoned -= dt;
      this.takeDamage(5 * (dt / 1000), null);
    }
    if (this.atkBoostTimer > 0) {
      this.atkBoostTimer -= dt;
      if (this.atkBoostTimer <= 0) this.atkBoost = 0;
    }

    // Move toward target
    if (this.stunned <= 0) this._move(dt);

    // Auto-attack
    if (this.target && this.attackTimer <= 0) {
      this._autoAttack(this.target);
    }

    // Update visual effects
    this.effects = this.effects.filter(e => { e.timer -= dt; return e.timer > 0; });
  }

  _move(dt) {
    // Move toward current waypoint or targetX/Y
    let tx = this.targetX, ty = this.targetY;
    if (this.waypoints.length > this.wpIdx) {
      tx = this.waypoints[this.wpIdx].x;
      ty = this.waypoints[this.wpIdx].y;
    }

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const stop = (this.target && this.target.alive) ? this.range : 4;

    if (dist > stop) {
      const spd = (this.spd + (this.speedBoost > 0 ? 40 : 0)) * dt / 1000;
      const step = Math.min(spd, dist);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    } else if (this.waypoints.length > this.wpIdx) {
      this.wpIdx++;
    }
  }

  _autoAttack(target) {
    if (!target.alive) { this.target = null; return; }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    if (Math.hypot(dx, dy) > this.range + 20) {
      // Move toward target
      this.targetX = target.x;
      this.targetY = target.y;
      return;
    }
    const dmg = this.atk * (1 + (this.atkBoost || 0));
    const dealt = target.takeDamage(dmg, this);
    if (this.lifesteal > 0) this.heal(dealt * this.lifesteal);
    this.attackTimer = this.attackRate;
    Game.spawnDamageNumber(target.x, target.y, dealt, this.team);
    Game.spawnEffect(target.x, target.y, 'hit');
  }

  _respawn() {
    const bases = { blue: {x:200, y:1760}, red: {x:1760, y:200} };
    const b = bases[this.team];
    this.x = b.x + (Math.random()-0.5)*80;
    this.y = b.y + (Math.random()-0.5)*80;
    this.targetX = this.x;
    this.targetY = this.y;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.alive = true;
    this.target = null;
    this.wpIdx = 0;
    if (this.laneWPs.length) {
      this.waypoints = [...this.laneWPs];
      this.laneWpIdx = 0;
    }
    Game.spawnEffect(this.x, this.y, 'spawn');
  }

  distanceTo(other) {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }
}
