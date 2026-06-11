// ===================================================
//  ASSETS.JS  — Hero definitions, Items, Constants
// ===================================================

const HEROES = [
  {
    id: 'theron',
    name: 'Theron',
    role: 'Warrior',
    icon: '⚔️',
    color: '#c0392b',
    bgColor: '#2c0a0a',
    description: 'A fearless warrior who charges into battle, slicing through enemies with brutal force.',
    baseStats: { hp: 700, mp: 200, atk: 75, def: 45, spd: 115, range: 55 },
    growthStats: { hp: 120, mp: 20, atk: 12, def: 7, spd: 0 },
    skills: [
      { name: 'Blade Dash',    key: 'Q', icon: '💨', cost: 40, cd: 6,  desc: 'Dash forward, dealing 150% ATK to enemies hit.' },
      { name: 'War Cry',       key: 'W', icon: '😤', cost: 50, cd: 10, desc: 'Increase ATK by 40% for 4 seconds.' },
      { name: 'Iron Shield',   key: 'E', icon: '🛡️', cost: 60, cd: 12, desc: 'Block all damage for 1.5 seconds.' },
      { name: 'Titan Cleave',  key: 'R', icon: '🌪️', cost: 100,cd: 60, desc: 'Spin and deal 300% ATK to all nearby enemies. (Ultimate)' },
    ]
  },
  {
    id: 'lyria',
    name: 'Lyria',
    role: 'Mage',
    icon: '🔮',
    color: '#8e44ad',
    bgColor: '#1a0a2a',
    description: 'Ancient mage who channels cosmic energy into devastating spells.',
    baseStats: { hp: 480, mp: 450, atk: 95, def: 25, spd: 105, range: 300 },
    growthStats: { hp: 70, mp: 60, atk: 18, def: 3, spd: 0 },
    skills: [
      { name: 'Arcane Bolt',   key: 'Q', icon: '⚡', cost: 50, cd: 4,  desc: 'Fire a bolt of arcane energy at a target.' },
      { name: 'Nova Burst',    key: 'W', icon: '💥', cost: 80, cd: 9,  desc: 'Explode magic at a location, stunning for 1s.' },
      { name: 'Blink',         key: 'E', icon: '✨', cost: 60, cd: 14, desc: 'Instantly teleport to target location.' },
      { name: 'Meteor Rain',   key: 'R', icon: '☄️', cost: 130,cd: 65, desc: 'Call down 5 meteors on enemies. (Ultimate)' },
    ]
  },
  {
    id: 'kael',
    name: 'Kael',
    role: 'Assassin',
    icon: '🗡️',
    color: '#27ae60',
    bgColor: '#0a1a0a',
    description: 'Silent shadow who strikes from darkness and vanishes before the enemy can react.',
    baseStats: { hp: 520, mp: 280, atk: 110, def: 20, spd: 130, range: 50 },
    growthStats: { hp: 80, mp: 30, atk: 20, def: 2, spd: 0 },
    skills: [
      { name: 'Shadow Step',   key: 'Q', icon: '🌑', cost: 40, cd: 5,  desc: 'Teleport behind target and deal 180% ATK.' },
      { name: 'Poison Blade',  key: 'W', icon: '🐍', cost: 50, cd: 8,  desc: 'Next attack poisons enemy for 3s damage.' },
      { name: 'Smoke Bomb',    key: 'E', icon: '💨', cost: 60, cd: 12, desc: 'Become invisible for 2 seconds.' },
      { name: 'Death Mark',    key: 'R', icon: '☠️', cost: 120,cd: 70, desc: 'Mark enemy — deal 40% of their max HP. (Ultimate)' },
    ]
  },
  {
    id: 'sera',
    name: 'Sera',
    role: 'Support',
    icon: '💖',
    color: '#16a085',
    bgColor: '#0a1a18',
    description: 'Holy priestess who heals allies and blesses them with divine protection.',
    baseStats: { hp: 550, mp: 400, atk: 55, def: 35, spd: 108, range: 280 },
    growthStats: { hp: 90, mp: 55, atk: 8, def: 5, spd: 0 },
    skills: [
      { name: 'Holy Mend',     key: 'Q', icon: '💚', cost: 60, cd: 5,  desc: 'Heal an ally for 200 + 20% of their max HP.' },
      { name: 'Radiant Aura',  key: 'W', icon: '🌟', cost: 80, cd: 10, desc: 'All allies gain 30 armor and regen HP for 5s.' },
      { name: 'Purify',        key: 'E', icon: '🕊️', cost: 50, cd: 11, desc: 'Remove all debuffs from an ally.' },
      { name: 'Divine Light',  key: 'R', icon: '✨', cost: 140,cd: 75, desc: 'Revive a fallen ally with 50% HP. (Ultimate)' },
    ]
  },
  {
    id: 'brutus',
    name: 'Brutus',
    role: 'Tank',
    icon: '🛡️',
    color: '#2980b9',
    bgColor: '#0a1020',
    description: 'Immovable fortress who absorbs punishment and protects his team at all costs.',
    baseStats: { hp: 900, mp: 180, atk: 60, def: 80, spd: 100, range: 60 },
    growthStats: { hp: 180, mp: 15, atk: 8, def: 14, spd: 0 },
    skills: [
      { name: 'Stone Skin',    key: 'Q', icon: '🪨', cost: 40, cd: 7,  desc: 'Gain a shield absorbing 300 + 10% max HP damage.' },
      { name: 'Ground Slam',   key: 'W', icon: '💢', cost: 60, cd: 9,  desc: 'Slam ground, stunning all nearby enemies for 1.5s.' },
      { name: 'Taunt',         key: 'E', icon: '😡', cost: 50, cd: 13, desc: 'Force all nearby enemies to attack you for 2s.' },
      { name: 'Fortress Wall', key: 'R', icon: '🏰', cost: 110,cd: 60, desc: 'Become immune to all damage for 3 seconds. (Ultimate)' },
    ]
  },
  {
    id: 'reva',
    name: 'Reva',
    role: 'Marksman',
    icon: '🏹',
    color: '#d35400',
    bgColor: '#1a0f00',
    description: 'Deadly archer who strikes from extreme range with pinpoint accuracy.',
    baseStats: { hp: 500, mp: 250, atk: 90, def: 18, spd: 112, range: 400 },
    growthStats: { hp: 75, mp: 25, atk: 16, def: 2, spd: 0 },
    skills: [
      { name: 'Snipe',         key: 'Q', icon: '🎯', cost: 45, cd: 5,  desc: 'Rapid fire — shoot 3 arrows in quick succession.' },
      { name: 'Eagle Eye',     key: 'W', icon: '🦅', cost: 55, cd: 8,  desc: 'Next attack is a crit dealing 250% ATK.' },
      { name: 'Evasive Roll',  key: 'E', icon: '🔄', cost: 60, cd: 11, desc: 'Roll to safety, gaining speed for 2s.' },
      { name: 'Rain of Arrows',key: 'R', icon: '🌧️', cost: 120,cd: 65, desc: 'Fire arrows into an area for 4s. (Ultimate)' },
    ]
  },
];

// ---- ITEMS ----
const ITEMS = [
  { id: 'longsword',   name: 'Long Sword',     icon: '⚔️',  cost: 300,  stat: '+40 ATK',     bonus: { atk: 40 } },
  { id: 'chainmail',   name: 'Chain Mail',     icon: '🛡️', cost: 300,  stat: '+40 DEF',     bonus: { def: 40 } },
  { id: 'ruby',        name: 'Ruby Crystal',   icon: '💎',  cost: 400,  stat: '+250 HP',     bonus: { hp: 250 } },
  { id: 'sapphire',    name: 'Sapphire Gem',   icon: '🔵',  cost: 350,  stat: '+150 MP',     bonus: { mp: 150 } },
  { id: 'speedboots',  name: 'Swift Boots',    icon: '👟',  cost: 350,  stat: '+25 SPD',     bonus: { spd: 25 } },
  { id: 'vorpal',      name: 'Vorpal Blade',   icon: '🗡️', cost: 700,  stat: '+80 ATK',     bonus: { atk: 80 } },
  { id: 'aegis',       name: 'Aegis Shield',   icon: '🔰',  cost: 700,  stat: '+80 DEF +HP', bonus: { def: 60, hp: 200 } },
  { id: 'lifesteal',   name: 'Vamp Scepter',   icon: '🩸',  cost: 600,  stat: '+50ATK+Lifesteal', bonus: { atk: 50, lifesteal: 0.15 } },
  { id: 'enchant',     name: 'Mage Staff',     icon: '🪄',  cost: 650,  stat: '+90 ATK (Magic)', bonus: { atk: 90, magic: true } },
  { id: 'frozen',      name: 'Frozen Heart',   icon: '❄️',  cost: 750,  stat: '+80DEF+Slow Aura', bonus: { def: 80, slowAura: true } },
  { id: 'berserker',   name: "Berserker's Fury",icon: '🔥', cost: 800,  stat: '+100 ATK',   bonus: { atk: 100 } },
  { id: 'godplate',    name: 'God Plate',      icon: '⚜️', cost: 1200, stat: '+150DEF+500HP', bonus: { def: 150, hp: 500 } },
];

// ---- GAME CONSTANTS ----
const TILE = 32;
const MAP_W = 60;   // tiles wide
const MAP_H = 60;   // tiles tall
const MAP_PX = MAP_W * TILE;  // 1920px
const MAP_PY = MAP_H * TILE;  // 1920px

const TEAM_BLUE = 'blue';
const TEAM_RED  = 'red';

const MINION_SPAWN_INTERVAL = 30000; // 30s
const MINION_WAVE_COUNT = 3;
const JUNGLE_RESPAWN = 45000; // 45s

// Waypoints for lanes (in world pixels)
// Map is 1920x1920. Blue base bottom-left, Red base top-right.
function buildLaneWaypoints() {
  const BX = 160, BY = 1760; // blue base
  const RX = 1760, RY = 160; // red base

  return {
    top: {
      blue: [ {x:BX,y:BY}, {x:BX,y:300}, {x:RX,y:300}, {x:RX,y:RY} ],
      red:  [ {x:RX,y:RY}, {x:RX,y:300}, {x:BX,y:300}, {x:BX,y:BY} ],
    },
    mid: {
      blue: [ {x:BX,y:BY}, {x:960,y:960}, {x:RX,y:RY} ],
      red:  [ {x:RX,y:RY}, {x:960,y:960}, {x:BX,y:BY} ],
    },
    bot: {
      blue: [ {x:BX,y:BY}, {x:1600,y:BY}, {x:1600,y:RY}, {x:RX,y:RY} ],
      red:  [ {x:RX,y:RY}, {x:1600,y:RY}, {x:1600,y:BY}, {x:BX,y:BY} ],
    }
  };
}

// Jungle camp positions
const JUNGLE_CAMPS = [
  { x: 600,  y: 600,  type: 'wolf',    reward: 80,  name: 'Wolf Pack',   icon: '🐺', hp: 400 },
  { x: 1320, y: 1320, type: 'wolf',    reward: 80,  name: 'Wolf Pack',   icon: '🐺', hp: 400 },
  { x: 600,  y: 1320, type: 'lizard',  reward: 120, name: 'Fire Lizard', icon: '🦎', hp: 600 },
  { x: 1320, y: 600,  type: 'lizard',  reward: 120, name: 'Fire Lizard', icon: '🦎', hp: 600 },
  { x: 960,  y: 400,  type: 'boss',    reward: 300, name: 'Forest Troll',icon: '👹', hp: 1500 },
  { x: 960,  y: 1520, type: 'boss',    reward: 300, name: 'Stone Golem', icon: '🗿', hp: 1500 },
];

// Tower positions: [x, y, team, lane]
const TOWER_DEFS = [
  // Blue towers
  { x: 320,  y: 1600, team: TEAM_BLUE, lane: 'top',  tier: 1 },
  { x: 320,  y: 400,  team: TEAM_BLUE, lane: 'top',  tier: 2 },
  { x: 960,  y: 1600, team: TEAM_BLUE, lane: 'mid',  tier: 1 },
  { x: 960,  y: 960,  team: TEAM_BLUE, lane: 'mid',  tier: 2 },
  { x: 1600, y: 1600, team: TEAM_BLUE, lane: 'bot',  tier: 1 },
  { x: 1600, y: 400,  team: TEAM_BLUE, lane: 'bot',  tier: 2 },
  // Red towers
  { x: 1600, y: 320,  team: TEAM_RED,  lane: 'top',  tier: 1 },
  { x: 400,  y: 320,  team: TEAM_RED,  lane: 'top',  tier: 2 },
  { x: 960,  y: 320,  team: TEAM_RED,  lane: 'mid',  tier: 1 },
  { x: 960,  y: 960,  team: TEAM_RED,  lane: 'mid',  tier: 2 },
  { x: 320,  y: 320,  team: TEAM_RED,  lane: 'bot',  tier: 1 },
  { x: 1600, y: 320,  team: TEAM_RED,  lane: 'bot',  tier: 2 },
];

// Nexus positions
const NEXUS_DEFS = [
  { x: 160,  y: 1760, team: TEAM_BLUE },
  { x: 1760, y: 160,  team: TEAM_RED  },
];
