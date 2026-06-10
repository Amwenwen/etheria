// ===================================================
//  AI.JS  — Enemy hero and minion AI behavior
// ===================================================

const AI = {
  // ---- HERO AI TICK ----
  updateHero(hero, dt) {
    if (!hero.alive || hero.stunned > 0) return;

    const enemies = Game.getEnemiesOf(hero.team);
    const allies  = Game.getAlliesOf(hero.team);
    const aliveEnemies = enemies.filter(e => e.alive);
    const nearbyEnemies = aliveEnemies.filter(e => hero.distanceTo(e) < hero.aggroRange);
    const nearbyAllies  = allies.filter(a => a.alive && a !== hero && hero.distanceTo(a) < 400);

    const hpPct = hero.hp / hero.maxHp;

    // ---- DECISION MAKING ----

    // Retreat if low HP
    if (hpPct < 0.2 && hero.aiState !== 'retreat') {
      hero.aiState = 'retreat';
    }

    // Back to lane if healed up
    if (hpPct > 0.6 && hero.aiState === 'retreat') {
      hero.aiState = 'lane';
    }

    switch (hero.aiState) {
      case 'retreat':
        this._doRetreat(hero);
        // Try to use heal skill
        this._tryHealSkill(hero, allies);
        break;

      case 'fight':
        if (nearbyEnemies.length === 0) {
          hero.aiState = 'lane';
          hero.target = null;
          break;
        }
        this._doFight(hero, nearbyEnemies, allies, dt);
        break;

      case 'jungle':
        this._doJungle(hero, dt);
        break;

      case 'lane':
      default:
        if (nearbyEnemies.length > 0) {
          hero.aiState = 'fight';
          break;
        }
        this._doLane(hero, dt);
        break;
    }
  },

  _doRetreat(hero) {
    const bases = {
      blue: { x: 200, y: 1760 },
      red:  { x: 1760, y: 200 },
    };
    const b = bases[hero.team];
    hero.targetX = b.x + (Math.random()-0.5)*100;
    hero.targetY = b.y + (Math.random()-0.5)*100;
    hero.waypoints = [];
    hero.target = null;
  },

  _doLane(hero, dt) {
    // Follow lane waypoints
    if (!hero.laneWPs || hero.laneWPs.length === 0) return;

    // Check if near current waypoint, advance
    const wpIdx = Math.min(hero.laneWpIdx, hero.laneWPs.length - 1);
    const wp = hero.laneWPs[wpIdx];
    const dist = Math.hypot(hero.x - wp.x, hero.y - wp.y);

    if (dist < 80 && hero.laneWpIdx < hero.laneWPs.length - 1) {
      hero.laneWpIdx++;
    }

    hero.targetX = wp.x + (Math.random()-0.5)*40;
    hero.targetY = wp.y + (Math.random()-0.5)*40;
    hero.waypoints = [];

    // Also push minions forward along their lane
  },

  _doFight(hero, enemies, allies, dt) {
    // Pick weakest or nearest target
    let target = null;
    let bestScore = Infinity;
    enemies.forEach(e => {
      if (!e.alive) return;
      const dist = hero.distanceTo(e);
      const score = dist * 0.5 + (e.hp / e.maxHp) * 200;
      if (score < bestScore) { bestScore = score; target = e; }
    });

    if (!target) { hero.aiState = 'lane'; return; }
    hero.target = target;
    hero.targetX = target.x;
    hero.targetY = target.y;

    // Try to use skills
    this._tryUseSkills(hero, enemies, allies);
  },

  _doJungle(hero, dt) {
    const camps = Game.state.jungleCamps.filter(c => c.alive);
    if (camps.length === 0) { hero.aiState = 'lane'; return; }
    // Go to nearest camp
    let nearest = null, nd = Infinity;
    camps.forEach(c => {
      const d = hero.distanceTo(c);
      if (d < nd) { nd = d; nearest = c; }
    });
    if (!nearest) { hero.aiState = 'lane'; return; }
    hero.targetX = nearest.x;
    hero.targetY = nearest.y;
    hero.target = nearest;
  },

  _tryHealSkill(hero, allies) {
    // If support, use heal skill Q
    if (hero.heroData && hero.heroData.id === 'sera') {
      hero.useSkill(0, hero.x, hero.y, hero);
    }
  },

  _tryUseSkills(hero, enemies, allies) {
    if (!hero.skills || hero.skills.length === 0) return;
    const t = hero.target;
    if (!t || !t.alive) return;

    // Randomly use skills based on cooldowns and distance
    const roll = Math.random();

    // Ultimate (R) — use when 3+ enemies nearby or boss
    if (roll < 0.02) {
      const nearby = enemies.filter(e => e.alive && hero.distanceTo(e) < 300);
      if (nearby.length >= 2 || (t && t.type === 'jungle')) {
        hero.useSkill(3, t.x, t.y, t);
        return;
      }
    }

    // Skill Q
    if (roll < 0.05) {
      hero.useSkill(0, t.x, t.y, t);
      return;
    }

    // Skill W
    if (roll < 0.04) {
      hero.useSkill(1, t.x, t.y, t);
      return;
    }

    // Skill E
    if (roll < 0.03) {
      hero.useSkill(2, t.x, t.y, t);
      return;
    }
  },

  // ---- MINION AI ----
  updateMinion(minion, dt) {
    if (!minion.alive) return;

    const enemies = Game.getEnemiesOf(minion.team);

    // Check for nearby threats
    let target = null;
    let nd = minion.aggroRange;
    enemies.forEach(e => {
      if (!e.alive) return;
      const d = minion.distanceTo(e);
      if (d < nd) { nd = d; target = e; }
    });

    if (target) {
      minion.target = target;
      minion.targetX = target.x;
      minion.targetY = target.y;
    } else {
      // Follow lane waypoints
      minion.target = null;
      if (minion.laneWPs && minion.laneWPs.length > 0) {
        const wpIdx = Math.min(minion.laneWpIdx || 0, minion.laneWPs.length - 1);
        const wp = minion.laneWPs[wpIdx];
        const dist = Math.hypot(minion.x - wp.x, minion.y - wp.y);
        if (dist < 60 && (minion.laneWpIdx || 0) < minion.laneWPs.length - 1) {
          minion.laneWpIdx = (minion.laneWpIdx || 0) + 1;
        }
        minion.targetX = wp.x;
        minion.targetY = wp.y;
      }
    }
  },

  // ---- TOWER AI ----
  updateTower(tower, dt) {
    if (!tower.alive) return;
    tower.attackTimer = Math.max(0, tower.attackTimer - dt);
    tower._attacking = false;

    const enemies = Game.getEnemiesOf(tower.team);
    // Prioritize heroes, then minions
    let target = null;
    let nd = tower.range;
    // Hero priority
    enemies.filter(e => e.type === 'hero' && e.alive).forEach(e => {
      const d = tower.distanceTo(e);
      if (d < nd) { nd = d; target = e; }
    });
    // Minion fallback
    if (!target) {
      nd = tower.range;
      enemies.filter(e => e.type === 'minion' && e.alive).forEach(e => {
        const d = tower.distanceTo(e);
        if (d < nd) { nd = d; target = e; }
      });
    }

    if (target && tower.attackTimer <= 0) {
      tower._attacking = true;
      const dealt = target.takeDamage(tower.atk, tower);
      Game.spawnDamageNumber(target.x, target.y, dealt, tower.team);
      Game.spawnEffect(target.x, target.y, 'hit');
      tower.attackTimer = 1500;
    }
  },

  // ---- JUNGLE CAMP AI ----
  updateJungleCamp(camp, dt) {
    if (!camp.alive) return;
    camp.attackTimer = Math.max(0, (camp.attackTimer || 0) - dt);

    const all = [...(Game.state.units || []), ...(Game.state.minions || [])];
    let target = null, nd = 80;
    all.forEach(u => {
      if (!u.alive) return;
      const d = Math.hypot(u.x - camp.x, u.y - camp.y);
      if (d < nd) { nd = d; target = u; }
    });

    if (target && camp.attackTimer <= 0) {
      const dealt = target.takeDamage(camp.atk || 30, { team: 'jungle', type: 'jungle' });
      Game.spawnDamageNumber(target.x, target.y, dealt, 'jungle');
      camp.attackTimer = 2000;
    }
  }
};
