import { useEffect, useMemo, useRef, useState } from "react";
import MiniMap from "../MiniMap/MiniMap";
import PixiArenaRenderer from "../PixiArenaRenderer/PixiArenaRenderer";
import "../GameArena/GameArena.css";
import "./BattleRoyaleMode";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const COLORS = ["cyan", "green", "orange", "purple", "red", "pink"];

const WORLD_WIDTH = 15000;
const WORLD_HEIGHT = 15000;
const VIEW_PADDING = 160;

const MAX_ORBS = 300;
const MIN_ORBS = 80;
const ORBS_PER_ALIVE_PLAYER = 5;
const ORB_ZONE_DENSITY = 0.0000036;
const VIEW_DISTANCE = 1400;

const BOT_RENDER_DISTANCE = 900;
const MAX_FULL_RENDER_BOTS = 10;
const BOT_SIMPLE_RENDER_DISTANCE = 1400;

const MAX_FULL_PROJECTILES = 18;
const MAX_SIMPLE_PROJECTILES = 80;
const PROJECTILE_RENDER_DISTANCE = 1650;

// VITEZA DRONEI PRINCIPALE. Identica cu GameArena.jsx (Play vs AI) si cu
// GAME_FRAME_SPEED din PvpArena.jsx, ca senzatia de miscare sa fie aceeasi
// in toate modurile de joc.
const PLAYER_SPEED = 2.5;

const PROJECTILE_SPEED = 4.2;
const PROJECTILE_MAX_DISTANCE = 1500;
const FIRE_COOLDOWN = 3000;

const MAX_DRONES = 4;
const START_HP = 100;
const MAX_HP = 150;
const SHIELD_COST = 20;
const SHIELD_DURATION = 3000;
const HIT_DAMAGE = 50;
const DRONE_HIT_DAMAGE = 25;

const BODY_COLLISION_DISTANCE = 145;
const BODY_COLLISION_COOLDOWN = 650;

const BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE = 10;
const BODY_COLLISION_BOTH_NO_DRONES_DAMAGE = 35;
const BODY_COLLISION_WITH_DRONES_DAMAGE = 5;
const BODY_COLLISION_WITHOUT_DRONES_DAMAGE = 45;

const BODY_COLLISION_LIGHT_PUSH = 6;
const BODY_COLLISION_MEDIUM_PUSH = 9;
const BODY_COLLISION_STRONG_PUSH = 12;
const BODY_COLLISION_PUSH_DECAY = 0.95;
const BODY_COLLISION_PUSH_MIN = 0.04;

const CORE_WAVE_SIZE = 9;
const CORE_RESPAWN_DELAY = 60000;
const CORE_WARNING_DELAY = 5000;
const CORE_COLLECT_DISTANCE = 120;
const ROTOR_MAX_LEVEL = 2;

const OVERCLOCK_DURATION = 25000;
const BERSERK_DURATION = 10000;
const VAMPIRE_DURATION = 15000;
const MAX_ACTIVE_CORES = 2;
const EMP_RADIUS = 560;
const EMP_DRONE_DAMAGE = 1;
const SWARM_CORE_DRONES = 2;
const SHIELD_BREAKER_SHOTS = 1;
const BERSERK_PROJECTILE_DAMAGE = 75;
const VAMPIRE_HEAL_RATIO = 0.25;

const START_ENERGY = 50;
const ENERGY_DRAIN_INTERVAL = 600;
const ENERGY_DRAIN_AMOUNT = 1;
const MAX_ENERGY_CELLS = 100;
const MIN_ENERGY_CELLS = 18;
const ENERGY_PER_ALIVE_PLAYER = 1;
const ENERGY_ZONE_DENSITY = 0.00000055;
const ENERGY_CELL_COLLECT_DISTANCE = 90;

const BOT_NAMES = ["DarkNova", "SkyHunter", "CyberCore", "NanoByte", "RedPulse"];
const BOT_SKINS = [
  "cyan",
  "red",
  "purple",
  "orange",
  "green",
  "pink",
  "ice-blue",
  "solar-gold",
  "shadow-black",
  "toxic-lime",
  "royal-violet",
  "crimson-white",
  "neon-teal",
  "ember-red",
  "arctic-silver",
  "void-purple",
  "plasma-pink",
  "jade-black",
  "azure-white",
  "inferno-orange",
  "midnight-blue",
  "acid-green",
  "ruby-black",
  "ghost-white",
  "cyber-yellow",
  "deep-ocean",
  "magenta-cyan",
  "bronze-steel",
  "electric-indigo",
  "dark-emerald",
  "emerald-rift-a",
  "emerald-rift-b",
  "emerald-rift-c",
];

const DRONE_SKIN_THEMES = {
  cyan: ["#00eaff", "#78f7ff", "#003140", "#ffffff", "rgba(0, 234, 255, 0.78)"],
  red: ["#ff4040", "#ff9a9a", "#380000", "#ffffff", "rgba(255, 64, 64, 0.72)"],
  purple: ["#9b5cff", "#d5b6ff", "#180034", "#ffffff", "rgba(155, 92, 255, 0.74)"],
  orange: ["#ff9f1c", "#ffd166", "#4b2100", "#fff7e6", "rgba(255, 159, 28, 0.72)"],
  green: ["#19ff8a", "#8cffc4", "#00391f", "#ffffff", "rgba(25, 255, 138, 0.72)"],
  pink: ["#ff4fd8", "#ffb8ef", "#4d003c", "#ffffff", "rgba(255, 79, 216, 0.72)"],
  "ice-blue": ["#7de7ff", "#e7fbff", "#07314a", "#ffffff", "rgba(125, 231, 255, 0.78)"],
  "solar-gold": ["#ffd447", "#fff0a8", "#513a00", "#ffffff", "rgba(255, 212, 71, 0.75)"],
  "shadow-black": ["#2e3440", "#6b7280", "#05070c", "#bdeeff", "rgba(75, 85, 99, 0.82)"],
  "toxic-lime": ["#b6ff00", "#e8ff8a", "#284000", "#ffffff", "rgba(182, 255, 0, 0.76)"],
  "royal-violet": ["#6d28d9", "#c4b5fd", "#14002e", "#f8f5ff", "rgba(109, 40, 217, 0.78)"],
  "crimson-white": ["#dc143c", "#ffffff", "#43000d", "#fff5f7", "rgba(220, 20, 60, 0.75)"],
  "neon-teal": ["#00ffcc", "#a7ffee", "#003c33", "#ffffff", "rgba(0, 255, 204, 0.76)"],
  "ember-red": ["#ff5a1f", "#ffb86b", "#451100", "#fff0e6", "rgba(255, 90, 31, 0.78)"],
  "arctic-silver": ["#c7d2fe", "#f8fafc", "#1e293b", "#ffffff", "rgba(199, 210, 254, 0.78)"],
  "void-purple": ["#4c1d95", "#a78bfa", "#070012", "#e9d5ff", "rgba(76, 29, 149, 0.84)"],
  "plasma-pink": ["#ff00aa", "#ff7adf", "#3f0030", "#ffffff", "rgba(255, 0, 170, 0.8)"],
  "jade-black": ["#00a86b", "#86efac", "#001e14", "#eafff5", "rgba(0, 168, 107, 0.78)"],
  "azure-white": ["#38bdf8", "#ffffff", "#082f49", "#ffffff", "rgba(56, 189, 248, 0.78)"],
  "inferno-orange": ["#ff6b00", "#ffcf33", "#4a1300", "#fff4df", "rgba(255, 107, 0, 0.82)"],
  "midnight-blue": ["#1e3a8a", "#60a5fa", "#020617", "#dbeafe", "rgba(30, 58, 138, 0.84)"],
  "acid-green": ["#39ff14", "#c6ff8a", "#0f2b00", "#ffffff", "rgba(57, 255, 20, 0.8)"],
  "ruby-black": ["#e11d48", "#fb7185", "#09090b", "#ffe4e6", "rgba(225, 29, 72, 0.82)"],
  "ghost-white": ["#e5e7eb", "#ffffff", "#334155", "#ffffff", "rgba(229, 231, 235, 0.76)"],
  "cyber-yellow": ["#faff00", "#fff7ad", "#3a3800", "#ffffff", "rgba(250, 255, 0, 0.76)"],
  "deep-ocean": ["#006994", "#67e8f9", "#001b2e", "#e0ffff", "rgba(0, 105, 148, 0.82)"],
  "magenta-cyan": ["#ff00ff", "#00ffff", "#250033", "#ffffff", "rgba(255, 0, 255, 0.78)"],
  "bronze-steel": ["#b87333", "#d1d5db", "#2b1605", "#fff7ed", "rgba(184, 115, 51, 0.72)"],
  "electric-indigo": ["#4f46e5", "#93c5fd", "#0b102f", "#eef2ff", "rgba(79, 70, 229, 0.82)"],
  "dark-emerald": ["#047857", "#34d399", "#001f16", "#d1fae5", "rgba(4, 120, 87, 0.82)"],
  "emerald-rift-a": ["#00ff99", "#a7ffd7", "#00291a", "#ffffff", "rgba(0, 255, 153, 0.82)"],
  "emerald-rift-b": ["#00d47a", "#7cffc4", "#001f14", "#ffffff", "rgba(0, 212, 122, 0.82)"],
  "emerald-rift-c": ["#45ffb0", "#d8ffef", "#003322", "#ffffff", "rgba(69, 255, 176, 0.82)"],
};

function getProjectileSkinStyle(skin = "cyan") {
  const [primary, secondary, dark, highlight, glow] =
    DRONE_SKIN_THEMES[skin] || DRONE_SKIN_THEMES.cyan;

  return {
    "--drone-primary": primary,
    "--drone-secondary": secondary,
    "--drone-dark": dark,
    "--drone-highlight": highlight,
    "--drone-glow": glow,
    "--shell-radius": "48% 48% 36% 36%",
    "--mini-shell-radius": "48% 48% 36% 36%",
    "--shell-x": 1,
    "--shell-y": 1,
  };
}

function normalizeArenaSkin(skin) {
  const normalized = String(skin || "cyan")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (!normalized || normalized === "basic" || normalized === "basic-drone") {
    return "cyan";
  }

  return DRONE_SKIN_THEMES[normalized] ? normalized : "cyan";
}

function getSelectedUserSkin(user) {
  return normalizeArenaSkin(
    user?.selectedSkin ||
      user?.selectedDroneSkin ||
      user?.selectedDrone ||
      user?.skin ||
      "cyan"
  );
}

// ---------------------------------------------------------------------------
// 59 boti + 1 player = 60 participanti total, exact cerinta.
// ---------------------------------------------------------------------------
const BOT_COUNT = 59;
const BOT_SPEED = PLAYER_SPEED;
const BOT_VIEW_RANGE = 1900;
const BOT_ATTACK_RANGE = 900;
const BOT_FIRE_COOLDOWN = 1650;
const BOT_LOW_HP = 30;

// IMPORTANT: boti mult mai agresivi decat Play vs AI normal, conform cerintei
// ("super inteligenti si agresivi"). Reducem cat farmeaza inainte sa atace
// si cat de mult stoc de drone vor sa acumuleze inainte sa intre in lupta.
const BOT_FARM_UNTIL_DRONES = 2;
const BOT_SAFE_DISTANCE = 620;
const BOT_ZONE_MEMORY_TIME = 14000;
const BOT_ZONE_EDGE_BUFFER = 560;

const BOT_MIN_SPAWN_DISTANCE = 1250;
const PLAYER_BOT_SPAWN_DISTANCE = 1450;
const SPAWN_SAFE_ZONE_MARGIN = 1250;

const MAP_MIN_SIZE = Math.min(WORLD_WIDTH, WORLD_HEIGHT);

const ZONE_START_RADIUS = MAP_MIN_SIZE * 0.47;
const ZONE_END_RADIUS = MAP_MIN_SIZE * 0.07;

// IMPORTANT: cerinta explicita - fumul verde vine catre centru timp de
// 10 minute (600000ms), nu 5 minute ca in Play vs AI standard.
const ZONE_SHRINK_DURATION = 600000;

// IMPORTANT: cerinta explicita - 10 HP pe secunda in afara zonei.
const ZONE_DAMAGE = 10;
const ZONE_DAMAGE_INTERVAL = 1000;

const CORE_TYPES = [
  { type: "nano", name: "Nano Core", shortName: "Nano", color: "#00eaff", effect: "+10 MAX HP" },
  { type: "rotor", name: "Rotor Core", shortName: "Rotor", color: "#ffae3d", effect: "+Attack drone speed" },
  { type: "piercing", name: "Piercing Core", shortName: "Piercing", color: "#b45cff", effect: "Next 3 shots pierce" },
  { type: "overclock", name: "Overclock Core", shortName: "Overclock", color: "#ff4040", effect: "25s rapid fire" },
  { type: "berserk", name: "Berserk Core", shortName: "Berserk", color: "#ff7a18", effect: "10s 75 damage shots" },
  { type: "shield-breaker", name: "Shield Breaker Core", shortName: "Shield Breaker", color: "#d946ef", effect: "Next shot ignores shield" },
  { type: "swarm", name: "Swarm Core", shortName: "Swarm", color: "#00ffd5", effect: "+2 drones instantly" },
  { type: "vampire", name: "Vampire Core", shortName: "Vampire", color: "#00c46a", effect: "15s lifesteal" },
  { type: "emp", name: "EMP Core", shortName: "EMP", color: "#faff00", effect: "EMP burst around you" },
];

function getCoreMeta(type) {
  return CORE_TYPES.find((core) => core.type === type) || CORE_TYPES[0];
}

function getNextDroneAt(currentDrones = 0) {
  const requirements = [5, 15, 25, 35];
  const index = Math.max(0, Math.min(currentDrones, requirements.length - 1));
  return requirements[index];
}

function getEffectiveFireCooldown(unit, baseCooldown) {
  const now = Date.now();
  let cooldown = baseCooldown;

  if (unit?.rapidFireUntil && unit.rapidFireUntil > now) {
    cooldown = Math.floor(cooldown * (unit.attackCooldownMultiplier || 0.65));
  }

  if (unit?.overclockUntil && unit.overclockUntil > now) {
    cooldown = Math.floor(cooldown * 0.5);
  }

  return Math.max(420, cooldown);
}

function getEffectiveProjectileSpeed(unit) {
  const now = Date.now();
  const rapidBonus = unit?.rapidFireUntil && unit.rapidFireUntil > now ? 0.75 : 0;
  const overclockBonus = unit?.overclockUntil && unit.overclockUntil > now ? 1.25 : 0;

  return PROJECTILE_SPEED + (unit?.projectileSpeedBonus || 0) + rapidBonus + overclockBonus;
}

function getProjectileDamage(unit) {
  const now = Date.now();

  if (unit?.berserkUntil && unit.berserkUntil > now) {
    return BERSERK_PROJECTILE_DAMAGE;
  }

  return HIT_DAMAGE;
}

function getActiveEffectBadges(unit, now = Date.now()) {
  if (!unit) return [];

  const badges = [];

  const addTimed = (key, label, until, className) => {
    if (!until || until <= now) return;

    badges.push({
      key,
      label,
      seconds: Math.max(0, Math.ceil((until - now) / 1000)),
      className,
    });
  };

  const addReady = (key, label, className) => {
    badges.push({
      key,
      label,
      seconds: null,
      className,
    });
  };

  if (unit.nanoCoreActive) {
    addReady("nano", "NANO CORE", "nano");
  }

  if (unit.rotorCoreActive) {
    addReady("rotor", "ROTOR CORE", "rotor");
  }

  addTimed("overclock", "OVERCLOCK", unit.overclockUntil, "overclock");
  addTimed("berserk", "BERSERK", unit.berserkUntil, "berserk");
  addTimed("vampire", "VAMPIRE", unit.vampireUntil, "vampire");
  addTimed("emp", "EMP", unit.empPulseUntil, "emp");
  addTimed("rapid", "RAPID FIRE", unit.rapidFireUntil, "rapid");

  if (unit.swarmCoreActive) {
    addReady("swarm", "SWARM CORE", "swarm");
  }

  if ((unit.shieldBreakerShots || 0) > 0) {
    badges.push({
      key: "shield-breaker",
      label: `SHIELD BREAKER x${unit.shieldBreakerShots}`,
      seconds: null,
      className: "shield-breaker",
    });
  }

  if ((unit.piercingShots || 0) > 0) {
    badges.push({
      key: "piercing",
      label: `PIERCING x${unit.piercingShots}`,
      seconds: null,
      className: "piercing",
    });
  }

  return badges.slice(0, MAX_ACTIVE_CORES);
}

function getCoreNoticeMessage(type) {
  if (type === "nano") return "+10 MAX HP and +10 HP.";
  if (type === "rotor") return "Attack drones fly faster.";
  if (type === "piercing") return "Next 3 shots pierce extra drones.";
  if (type === "overclock") return "25s rapid fire and faster attack drones.";
  if (type === "berserk") return "10s attacks deal 75 damage.";
  if (type === "shield-breaker") return "Next shot ignores shield.";
  if (type === "swarm") return "+2 drones instantly.";
  if (type === "vampire") return "15s lifesteal from damage dealt.";
  if (type === "emp") return "EMP burst removes enemy drones nearby.";

  return getCoreMeta(type).effect || "Core effect activated.";
}

function getCoreFloatingText(type) {
  if (type === "nano") return "+MAX HP";
  if (type === "rotor") return "+ROTOR";
  if (type === "piercing") return "+PIERCING";
  if (type === "overclock") return "OVERCLOCK";
  if (type === "berserk") return "BERSERK";
  if (type === "shield-breaker") return "SHIELD BREAKER";
  if (type === "swarm") return "+2 DRONES";
  if (type === "vampire") return "VAMPIRE";
  if (type === "emp") return "EMP BLAST";

  return "+CORE";
}

function applyKillRewardToUnit(unit) {
  const nextKills = (unit.kills || 0) + 1;
  const nextKillStreak = (unit.killStreak || 0) + 1;

  const nextDrones = Math.min(MAX_DRONES, (unit.drones || 0) + 1);

  const hasRapidFireReward = nextKillStreak >= 3;

  return {
    ...unit,
    kills: nextKills,
    killStreak: nextKillStreak,
    drones: nextDrones,
    progress: 0,
    nextDroneAt: getNextDroneAt(nextDrones),
    rapidFireUntil: hasRapidFireReward
      ? Date.now() + 10000
      : unit.rapidFireUntil || 0,
    attackCooldownMultiplier:
      nextKillStreak >= 5 ? 0.5 : nextKillStreak >= 3 ? 0.65 : 1,
  };
}

function getBodyCollisionOutcome(unitA, unitB) {
  const aHasDrones = (unitA?.drones || 0) > 0;
  const bHasDrones = (unitB?.drones || 0) > 0;

  if (aHasDrones && bHasDrones) {
    return {
      aHpDamage: BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE,
      bHpDamage: BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE,
      aDroneLoss: 1,
      bDroneLoss: 1,
      push: BODY_COLLISION_MEDIUM_PUSH,
      type: "both-drones",
    };
  }

  if (!aHasDrones && !bHasDrones) {
    return {
      aHpDamage: BODY_COLLISION_BOTH_NO_DRONES_DAMAGE,
      bHpDamage: BODY_COLLISION_BOTH_NO_DRONES_DAMAGE,
      aDroneLoss: 0,
      bDroneLoss: 0,
      push: BODY_COLLISION_STRONG_PUSH,
      type: "no-drones",
    };
  }

  if (aHasDrones && !bHasDrones) {
    return {
      aHpDamage: BODY_COLLISION_WITH_DRONES_DAMAGE,
      bHpDamage: BODY_COLLISION_WITHOUT_DRONES_DAMAGE,
      aDroneLoss: 1,
      bDroneLoss: 0,
      push: BODY_COLLISION_STRONG_PUSH,
      type: "advantage-a",
    };
  }

  return {
    aHpDamage: BODY_COLLISION_WITHOUT_DRONES_DAMAGE,
    bHpDamage: BODY_COLLISION_WITH_DRONES_DAMAGE,
    aDroneLoss: 0,
    bDroneLoss: 1,
    push: BODY_COLLISION_STRONG_PUSH,
    type: "advantage-b",
  };
}

function applyBodyCollisionDamage(unit, hpDamage, droneLoss = 0) {
  const currentDrones = unit.drones || 0;
  const nextDrones = Math.max(0, currentDrones - droneLoss);
  const nextHp = Math.max(0, (unit.hp || 0) - hpDamage);

  return {
    ...unit,
    hp: nextHp,
    alive: nextHp > 0,
    drones: nextDrones,
    progress: droneLoss > 0 ? 0 : unit.progress,
    nextDroneAt: droneLoss > 0 ? getNextDroneAt(nextDrones) : unit.nextDroneAt,
    killStreak: nextHp > 0 ? unit.killStreak || 0 : 0,
    rapidFireUntil: nextHp > 0 ? unit.rapidFireUntil || 0 : 0,
    attackCooldownMultiplier: nextHp > 0 ? unit.attackCooldownMultiplier || 1 : 1,
  };
}

function applySmoothKnockback(unit, dirX, dirY, strength) {
  return {
    ...unit,
    knockbackX: (unit.knockbackX || 0) + dirX * strength,
    knockbackY: (unit.knockbackY || 0) + dirY * strength,
    moveX: dirX,
    moveY: dirY,
    moveAngle: Math.atan2(dirY, dirX),
    isMoving: true,
    collisionFlashUntil: Date.now() + 160,
  };
}

function applyKnockbackStep(unit, currentZoneRadius) {
  const kx = unit.knockbackX || 0;
  const ky = unit.knockbackY || 0;
  const power = Math.hypot(kx, ky);

  if (power < BODY_COLLISION_PUSH_MIN) {
    if (!kx && !ky) return unit;

    return {
      ...unit,
      knockbackX: 0,
      knockbackY: 0,
    };
  }

  const rawX = unit.x + kx;
  const rawY = unit.y + ky;

  const safePos = keepInsideSafeZone(rawX, rawY, currentZoneRadius, 45);

  return {
    ...unit,
    x: Math.max(VIEW_PADDING, Math.min(WORLD_WIDTH - VIEW_PADDING, safePos.x)),
    y: Math.max(VIEW_PADDING, Math.min(WORLD_HEIGHT - VIEW_PADDING, safePos.y)),
    knockbackX: kx * BODY_COLLISION_PUSH_DECAY,
    knockbackY: ky * BODY_COLLISION_PUSH_DECAY,
  };
}

function getRandomSpawnPoint(existingPoints = [], minDistance = BOT_MIN_SPAWN_DISTANCE) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const safeSpawnRadius = Math.max(
    800,
    ZONE_START_RADIUS - SPAWN_SAFE_ZONE_MARGIN
  );

  for (let attempt = 0; attempt < 2500; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * safeSpawnRadius;

    const point = {
      x: Math.max(
        VIEW_PADDING,
        Math.min(WORLD_WIDTH - VIEW_PADDING, centerX + Math.cos(angle) * distance)
      ),
      y: Math.max(
        VIEW_PADDING,
        Math.min(WORLD_HEIGHT - VIEW_PADDING, centerY + Math.sin(angle) * distance)
      ),
    };

    const isFarEnough = existingPoints.every((other) => {
      return Math.hypot(point.x - other.x, point.y - other.y) >= minDistance;
    });

    if (isFarEnough && isPointSafeFromZone(point.x, point.y, ZONE_START_RADIUS, 700)) {
      return point;
    }
  }

  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * safeSpawnRadius;

    const point = {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
    };

    const isFarEnough = existingPoints.every((other) => {
      return Math.hypot(point.x - other.x, point.y - other.y) >= minDistance * 0.62;
    });

    if (isFarEnough && isPointSafeFromZone(point.x, point.y, ZONE_START_RADIUS, 500)) {
      return point;
    }
  }

  return {
    x: centerX + (Math.random() - 0.5) * safeSpawnRadius * 0.5,
    y: centerY + (Math.random() - 0.5) * safeSpawnRadius * 0.5,
  };
}

function normalizeMove(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function getZoneInfo(x, y, radius) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;

  const dx = centerX - x;
  const dy = centerY - y;
  const distanceFromCenter = Math.hypot(dx, dy) || 1;

  return {
    distanceFromCenter,
    isInZone: distanceFromCenter > radius,
    dangerDistance: radius - distanceFromCenter,
    moveToCenterX: dx / distanceFromCenter,
    moveToCenterY: dy / distanceFromCenter,
  };
}

function keepInsideSafeZone(x, y, radius, margin = 70) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.hypot(dx, dy) || 1;
  const maxDistance = Math.max(120, radius - margin);

  if (distance <= maxDistance) return { x, y };

  return {
    x: centerX + (dx / distance) * maxDistance,
    y: centerY + (dy / distance) * maxDistance,
  };
}

function getBotAvoidance(bot, bots, avoidRadius = 300) {
  let avoidX = 0;
  let avoidY = 0;

  bots.forEach((other) => {
    if (!other.alive || other.id === bot.id) return;

    const dx = bot.x - other.x;
    const dy = bot.y - other.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance < avoidRadius) {
      const force = (avoidRadius - distance) / avoidRadius;
      avoidX += (dx / distance) * force;
      avoidY += (dy / distance) * force;
    }
  });

  return { avoidX, avoidY };
}

function getSafeZoneMargin(x, y, radius) {
  const info = getZoneInfo(x, y, radius);
  return info.dangerDistance;
}

function isPointSafeFromZone(x, y, radius, margin = BOT_ZONE_EDGE_BUFFER) {
  return getSafeZoneMargin(x, y, radius) > margin;
}

function cleanDangerMemory(memory, now) {
  return (memory || []).filter((item) => item.expiresAt > now);
}

function addZoneDangerMemory(bot, now, radius) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const dx = bot.x - centerX;
  const dy = bot.y - centerY;
  const distance = Math.hypot(dx, dy) || 1;

  const dangerPoint = {
    x: centerX + (dx / distance) * radius,
    y: centerY + (dy / distance) * radius,
    expiresAt: now + BOT_ZONE_MEMORY_TIME,
  };

  return [dangerPoint, ...cleanDangerMemory(bot.dangerMemory, now)].slice(0, 5);
}

function getDangerMemoryRepulsion(bot, now) {
  let dangerX = 0;
  let dangerY = 0;
  const memory = cleanDangerMemory(bot.dangerMemory, now);

  memory.forEach((danger) => {
    const dx = bot.x - danger.x;
    const dy = bot.y - danger.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance < 950) {
      const force = (950 - distance) / 950;
      dangerX += (dx / distance) * force;
      dangerY += (dy / distance) * force;
    }
  });

  return { dangerX, dangerY, memory };
}

function getCenterPressureMove(bot, radius, strength = 1) {
  const zoneInfo = getZoneInfo(bot.x, bot.y, radius);

  if (zoneInfo.dangerDistance < BOT_ZONE_EDGE_BUFFER) {
    return {
      x: zoneInfo.moveToCenterX * strength,
      y: zoneInfo.moveToCenterY * strength,
    };
  }

  return { x: 0, y: 0 };
}

function applyBotMovement(bot, desiredMove, botDelta, currentZoneRadius, speedMultiplier = 1, extra = {}) {
  const move = normalizeMove(desiredMove.x, desiredMove.y);

  const vx = (bot.vx || 0) * 0.78 + move.x * 0.22;
  const vy = (bot.vy || 0) * 0.78 + move.y * 0.22;
  const smoothed = normalizeMove(vx, vy);

  const rawX = bot.x + smoothed.x * BOT_SPEED * botDelta * speedMultiplier;
  const rawY = bot.y + smoothed.y * BOT_SPEED * botDelta * speedMultiplier;

  const safePos = keepInsideSafeZone(rawX, rawY, currentZoneRadius, 35);

  const nextBotX = Math.max(
    VIEW_PADDING,
    Math.min(WORLD_WIDTH - VIEW_PADDING, safePos.x)
  );

  const nextBotY = Math.max(
    VIEW_PADDING,
    Math.min(WORLD_HEIGHT - VIEW_PADDING, safePos.y)
  );

  const baseBot = {
    ...bot,
    ...extra,
    x: nextBotX,
    y: nextBotY,
    vx: smoothed.x,
    vy: smoothed.y,
    moveX: smoothed.x,
    moveY: smoothed.y,
    moveAngle: Math.atan2(smoothed.y, smoothed.x),
    isMoving: true,
    mouseX: extra.mouseX ?? nextBotX + smoothed.x * 240,
    mouseY: extra.mouseY ?? nextBotY + smoothed.y * 240,
  };

  return applyKnockbackStep(baseBot, currentZoneRadius);
}

function createEnergyCell(playerX = null, playerY = null, zoneRadius = ZONE_START_RADIUS) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const safeRadius = Math.max(260, (zoneRadius || ZONE_START_RADIUS) - 140);

  const spawnNearPlayer =
    playerX !== null &&
    playerY !== null &&
    Math.random() < 0.72 &&
    isPointSafeFromZone(playerX, playerY, zoneRadius, 330);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    let x;
    let y;

    if (spawnNearPlayer && attempt < 35) {
      const distance = 260 + Math.random() * 950;
      const angle = Math.random() * Math.PI * 2;

      x = playerX + Math.cos(angle) * distance;
      y = playerY + Math.sin(angle) * distance;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * safeRadius;

      x = centerX + Math.cos(angle) * distance;
      y = centerY + Math.sin(angle) * distance;
    }

    x = Math.max(VIEW_PADDING, Math.min(WORLD_WIDTH - VIEW_PADDING, x));
    y = Math.max(VIEW_PADDING, Math.min(WORLD_HEIGHT - VIEW_PADDING, y));

    if (isPointSafeFromZone(x, y, zoneRadius, 120)) {
      return {
        id: crypto.randomUUID(),
        x,
        y,
      };
    }
  }

  const fallbackAngle = Math.random() * Math.PI * 2;
  const fallbackDistance = Math.sqrt(Math.random()) * Math.max(220, safeRadius * 0.75);

  return {
    id: crypto.randomUUID(),
    x: centerX + Math.cos(fallbackAngle) * fallbackDistance,
    y: centerY + Math.sin(fallbackAngle) * fallbackDistance,
  };
}

function createEnergyCells(count = MAX_ENERGY_CELLS, zoneRadius = ZONE_START_RADIUS) {
  return Array.from({ length: count }, () => createEnergyCell(null, null, zoneRadius));
}

function getDynamicOrbTarget(alivePlayersCount, zoneRadius) {
  const safeRadius = Math.max(ZONE_END_RADIUS, zoneRadius || ZONE_START_RADIUS);
  const zoneAreaBasedTarget = Math.floor(Math.PI * safeRadius * safeRadius * ORB_ZONE_DENSITY);
  const playerBasedTarget = Math.max(0, alivePlayersCount || 0) * ORBS_PER_ALIVE_PLAYER;

  return Math.max(
    MIN_ORBS,
    Math.min(MAX_ORBS, zoneAreaBasedTarget + playerBasedTarget)
  );
}

function getDynamicEnergyTarget(alivePlayersCount, zoneRadius) {
  const safeRadius = Math.max(ZONE_END_RADIUS, zoneRadius || ZONE_START_RADIUS);
  const zoneAreaBasedTarget = Math.floor(Math.PI * safeRadius * safeRadius * ENERGY_ZONE_DENSITY);
  const playerBasedTarget = Math.max(0, alivePlayersCount || 0) * ENERGY_PER_ALIVE_PLAYER;

  return Math.max(
    MIN_ENERGY_CELLS,
    Math.min(MAX_ENERGY_CELLS, zoneAreaBasedTarget + playerBasedTarget)
  );
}

function isEnergyInsideZone(cell, zoneRadius, margin = 80) {
  return isPointSafeFromZone(cell.x, cell.y, zoneRadius, margin);
}

function isCoreInsideZone(core, zoneRadius, margin = 420) {
  return isPointSafeFromZone(core.x, core.y, zoneRadius, margin);
}

function createSafeCoreReplacement(zoneRadius = ZONE_START_RADIUS) {
  return createRandomCore(zoneRadius);
}

function getActiveCoreCount(unit, now = Date.now()) {
  if (!unit) return 0;

  return [
    unit.nanoCoreActive,
    unit.rotorCoreActive,
    (unit.piercingShots || 0) > 0,
    (unit.shieldBreakerShots || 0) > 0,
    (unit.overclockUntil || 0) > now,
    (unit.berserkUntil || 0) > now,
    (unit.vampireUntil || 0) > now,
    unit.swarmCoreActive,
    (unit.empPulseUntil || 0) > now,
  ].filter(Boolean).length;
}

function hasCoreAlready(unit, type, now = Date.now()) {
  if (!unit) return false;

  if (type === "nano") return Boolean(unit.nanoCoreActive);
  if (type === "rotor") return Boolean(unit.rotorCoreActive);
  if (type === "piercing") return (unit.piercingShots || 0) > 0;
  if (type === "shield-breaker") return (unit.shieldBreakerShots || 0) > 0;
  if (type === "overclock") return (unit.overclockUntil || 0) > now;
  if (type === "berserk") return (unit.berserkUntil || 0) > now;
  if (type === "vampire") return (unit.vampireUntil || 0) > now;
  if (type === "swarm") return Boolean(unit.swarmCoreActive);
  if (type === "emp") return (unit.empPulseUntil || 0) > now;

  return false;
}

function canUnitUseCore(unit, core) {
  if (!unit || !core || !unit.alive) return false;

  const now = Date.now();

  if (!hasCoreAlready(unit, core.type, now) && getActiveCoreCount(unit, now) >= MAX_ACTIVE_CORES) {
    return false;
  }

  if (core.type === "nano") {
    return !unit.nanoCoreActive &&
      ((unit.maxHp || START_HP) < MAX_HP || (unit.hp || 0) < (unit.maxHp || START_HP));
  }

  if (core.type === "rotor") {
    return !unit.rotorCoreActive && (unit.attackSpeedLevel || 1) < ROTOR_MAX_LEVEL;
  }

  if (core.type === "piercing") {
    return (unit.piercingShots || 0) <= 0;
  }

  if (core.type === "overclock") {
    return !unit.overclockUntil || unit.overclockUntil <= now;
  }

  if (core.type === "berserk") {
    return !unit.berserkUntil || unit.berserkUntil <= now;
  }

  if (core.type === "shield-breaker") {
    return (unit.shieldBreakerShots || 0) <= 0;
  }

  if (core.type === "swarm") {
    return !unit.swarmCoreActive && (unit.drones || 0) < MAX_DRONES;
  }

  if (core.type === "vampire") {
    return !unit.vampireUntil || unit.vampireUntil <= now;
  }

  if (core.type === "emp") {
    return !unit.empPulseUntil || unit.empPulseUntil <= now;
  }

  return false;
}

function applyCoreStatsToUnit(unit, core) {
  if (!unit || !core || !unit.alive) {
    return { unit, collected: false };
  }

  const now = Date.now();
  const nextUnit = { ...unit };

  if (core.type === "nano") {
    if ((nextUnit.maxHp || START_HP) >= MAX_HP && nextUnit.hp >= (nextUnit.maxHp || START_HP)) {
      return { unit: nextUnit, collected: false };
    }

    const nextMaxHp = Math.min(MAX_HP, (nextUnit.maxHp || START_HP) + 10);
    nextUnit.maxHp = nextMaxHp;
    nextUnit.hp = Math.min(nextMaxHp, (nextUnit.hp || START_HP) + 10);
    nextUnit.nanoCoreActive = true;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "rotor") {
    if ((nextUnit.attackSpeedLevel || 1) >= ROTOR_MAX_LEVEL) {
      return { unit: nextUnit, collected: false };
    }

    nextUnit.attackSpeedLevel = ROTOR_MAX_LEVEL;
    nextUnit.projectileSpeedBonus = Math.max(nextUnit.projectileSpeedBonus || 0, 0.9);
    nextUnit.rotorCoreActive = true;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "piercing") {
    if ((nextUnit.piercingShots || 0) > 0) {
      return { unit: nextUnit, collected: false };
    }

    nextUnit.piercingShots = 3;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "overclock") {
    nextUnit.overclockUntil = now + OVERCLOCK_DURATION;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "berserk") {
    nextUnit.berserkUntil = now + BERSERK_DURATION;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "shield-breaker") {
    nextUnit.shieldBreakerShots = Math.max(
      SHIELD_BREAKER_SHOTS,
      nextUnit.shieldBreakerShots || 0
    );
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "swarm") {
    const nextDrones = Math.min(MAX_DRONES, (nextUnit.drones || 0) + SWARM_CORE_DRONES);
    nextUnit.drones = nextDrones;
    nextUnit.progress = 0;
    nextUnit.nextDroneAt = getNextDroneAt(nextDrones);
    nextUnit.swarmCoreActive = true;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "vampire") {
    nextUnit.vampireUntil = now + VAMPIRE_DURATION;
    return { unit: nextUnit, collected: true };
  }

  if (core.type === "emp") {
    nextUnit.empPulseUntil = now + 900;
    return { unit: nextUnit, collected: true };
  }

  return { unit: nextUnit, collected: false };
}

function applyCoreToBotStats(bot, core) {
  const result = applyCoreStatsToUnit(bot, core);

  return {
    bot: result.unit,
    collected: result.collected,
  };
}

function findClosestCoreForBot(bot, cores, currentZoneRadius) {
  let bestCore = null;
  let bestScore = Infinity;

  cores.forEach((core) => {
    if (!core || !isCoreInsideZone(core, currentZoneRadius, 420)) return;
    if (!canUnitUseCore(bot, core)) return;

    const dx = core.x - bot.x;
    const dy = core.y - bot.y;

    if (Math.abs(dx) > BOT_VIEW_RANGE || Math.abs(dy) > BOT_VIEW_RANGE) return;

    const distance = Math.hypot(dx, dy);
    let score = distance;

    if (core.type === "nano" && bot.hp <= 70) score -= 360;
    if (core.type === "rotor" && bot.drones >= 2) score -= 220;
    if (core.type === "piercing" && bot.drones >= 3) score -= 180;
    if (core.type === "overclock" && bot.drones >= 1) score -= 340;
    if (core.type === "berserk" && bot.drones >= 1) score -= 300;
    if (core.type === "shield-breaker" && bot.drones >= 1) score -= 260;
    if (core.type === "swarm" && bot.drones < MAX_DRONES) score -= 420;
    if (core.type === "vampire" && bot.hp <= 80) score -= 280;
    if (core.type === "emp") score -= 240;

    if (score < bestScore) {
      bestScore = score;
      bestCore = core;
    }
  });

  return bestCore;
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLengthSq = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLengthSq));
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;

  return Math.hypot(px - closestX, py - closestY);
}

function findBotCollectedOrb(botBefore, botAfter, orbs, currentZoneRadius) {
  let bestOrb = null;
  let bestDistance = Infinity;

  orbs.forEach((orb) => {
    if (!isOrbInsideZone(orb, currentZoneRadius, 120)) return;

    const endDistance = Math.hypot(orb.x - botAfter.x, orb.y - botAfter.y);
    const pathDistance = distancePointToSegment(
      orb.x,
      orb.y,
      botBefore.x,
      botBefore.y,
      botAfter.x,
      botAfter.y
    );

    const distance = Math.min(endDistance, pathDistance);

    if (distance < 125 && distance < bestDistance) {
      bestDistance = distance;
      bestOrb = orb;
    }
  });

  return bestOrb;
}

function isOrbInsideZone(orb, zoneRadius, margin = 80) {
  return isPointSafeFromZone(orb.x, orb.y, zoneRadius, margin);
}

function createOrb(playerX = null, playerY = null, zoneRadius = ZONE_START_RADIUS) {
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const safeRadius = Math.max(250, (zoneRadius || ZONE_START_RADIUS) - 120);

  const spawnNearPlayer =
    playerX !== null &&
    playerY !== null &&
    Math.random() < 0.72 &&
    isPointSafeFromZone(playerX, playerY, zoneRadius, 320);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    let x;
    let y;

    if (spawnNearPlayer && attempt < 35) {
      const distance = 420 + Math.random() * 1050;
      const angle = Math.random() * Math.PI * 2;

      x = playerX + Math.cos(angle) * distance;
      y = playerY + Math.sin(angle) * distance;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * safeRadius;

      x = centerX + Math.cos(angle) * distance;
      y = centerY + Math.sin(angle) * distance;
    }

    x = Math.max(VIEW_PADDING, Math.min(WORLD_WIDTH - VIEW_PADDING, x));
    y = Math.max(VIEW_PADDING, Math.min(WORLD_HEIGHT - VIEW_PADDING, y));

    if (isPointSafeFromZone(x, y, zoneRadius, 120)) {
      return {
        id: crypto.randomUUID(),
        x,
        y,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }
  }

  const fallbackAngle = Math.random() * Math.PI * 2;
  const fallbackDistance = Math.sqrt(Math.random()) * Math.max(200, safeRadius * 0.75);

  return {
    id: crypto.randomUUID(),
    x: centerX + Math.cos(fallbackAngle) * fallbackDistance,
    y: centerY + Math.sin(fallbackAngle) * fallbackDistance,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function createOrbs(count = MAX_ORBS, zoneRadius = ZONE_START_RADIUS) {
  return Array.from({ length: count }, () => createOrb(null, null, zoneRadius));
}

function createRandomCore(zoneRadius = ZONE_START_RADIUS, forcedCoreType = null) {
  const coreType = forcedCoreType || CORE_TYPES[Math.floor(Math.random() * CORE_TYPES.length)];
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const safeRadius = Math.max(350, (zoneRadius || ZONE_START_RADIUS) - 420);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * safeRadius;
    const x = Math.max(
      VIEW_PADDING,
      Math.min(WORLD_WIDTH - VIEW_PADDING, centerX + Math.cos(angle) * distance)
    );
    const y = Math.max(
      VIEW_PADDING,
      Math.min(WORLD_HEIGHT - VIEW_PADDING, centerY + Math.sin(angle) * distance)
    );

    if (isPointSafeFromZone(x, y, zoneRadius, 380)) {
      return {
        id: crypto.randomUUID(),
        ...coreType,
        x,
        y,
      };
    }
  }

  const fallbackAngle = Math.random() * Math.PI * 2;
  const fallbackDistance = Math.sqrt(Math.random()) * safeRadius * 0.7;

  return {
    id: crypto.randomUUID(),
    ...coreType,
    x: centerX + Math.cos(fallbackAngle) * fallbackDistance,
    y: centerY + Math.sin(fallbackAngle) * fallbackDistance,
  };
}

function createCoreWave(count = CORE_WAVE_SIZE, zoneRadius = ZONE_START_RADIUS) {
  const shuffledTypes = [...CORE_TYPES].sort(() => Math.random() - 0.5);
  const selectedTypes = shuffledTypes.slice(0, Math.min(count, CORE_TYPES.length));

  return selectedTypes.map((coreType) => createRandomCore(zoneRadius, coreType));
}

// ---------------------------------------------------------------------------
// IMPORTANT: bot mult mai agresiv si curajos decat in Play vs AI standard,
// conform cerintei explicite ("super inteligenti si agresivi"). Range-urile
// de aiAggression/aiCourage sunt deplasate spre valori mai mari, iar
// desiredDroneStock e mai mic (nu mai sta la farm cat de mult, intra in
// lupta mult mai rapid).
// ---------------------------------------------------------------------------
function createBot(index, spawnPoint = null) {
  return {
    id: crypto.randomUUID(),
    isBot: true,
    username: BOT_NAMES[index % BOT_NAMES.length] + "-" + (index + 1),

    kills: 0,
    killStreak: 0,
    rapidFireUntil: 0,
    attackCooldownMultiplier: 1,
    placement: null,

    hp: START_HP,
    maxHp: START_HP,
    energy: START_ENERGY,

    attackSpeedLevel: 1,
    projectileSpeedBonus: 0,
    piercingShots: 0,
    shieldBreakerShots: 0,
    overclockUntil: 0,
    berserkUntil: 0,
    vampireUntil: 0,
    empPulseUntil: 0,
    nanoCoreActive: false,
    rotorCoreActive: false,
    swarmCoreActive: false,

    mass: 1250,
    drones: 0,

    lastFireAt: 0,
    targetEnemyId: null,
    state: "farm",
    escapeZoneUntil: 0,
    aiPlanUntil: 0,
    dangerMemory: [],
    vx: 0,
    vy: 0,
    knockbackX: 0,
    knockbackY: 0,
    desiredDroneStock: 3 + Math.floor(Math.random() * 2),

    totalCollected: 0,
    progress: 0,
    nextDroneAt: getNextDroneAt(0),

    aiAggression: 0.92 + Math.random() * 0.5,
    aiCourage: 1.05 + Math.random() * 0.45,
    aiSkill: 0.92 + Math.random() * 0.35,
    preferredRange: 520 + Math.random() * 170,

    skin: BOT_SKINS[index % BOT_SKINS.length],

    ...(spawnPoint || getRandomSpawnPoint()),

    attacking: false,
    shieldActive: false,
    shieldHit: null,

    mouseX: 0,
    mouseY: 0,

    moveX: 0,
    moveY: 0,
    moveAngle: -Math.PI / 2,
    isMoving: false,

    alive: true,
    targetOrbId: null,
  };
}

function createBots(existingSpawnPoints = []) {
  const usedSpawns = [...existingSpawnPoints];

  return Array.from({ length: BOT_COUNT }, (_, index) => {
    const spawnPoint = getRandomSpawnPoint(usedSpawns, BOT_MIN_SPAWN_DISTANCE);
    usedSpawns.push(spawnPoint);
    return createBot(index, spawnPoint);
  });
}

function findClosestOrbForBot(bot, orbs, currentZoneRadius, now) {
  let bestOrb = null;
  let bestScore = Infinity;
  const dangerMemory = cleanDangerMemory(bot.dangerMemory, now);

  for (let i = 0; i < orbs.length; i += 4) {
    const orb = orbs[i];
    const dx = orb.x - bot.x;
    const dy = orb.y - bot.y;

    if (Math.abs(dx) > BOT_VIEW_RANGE || Math.abs(dy) > BOT_VIEW_RANGE) {
      continue;
    }

    if (!isPointSafeFromZone(orb.x, orb.y, currentZoneRadius, BOT_ZONE_EDGE_BUFFER)) {
      continue;
    }

    const distance = Math.hypot(dx, dy);
    let score = distance;

    dangerMemory.forEach((danger) => {
      const dangerDistance = Math.hypot(orb.x - danger.x, orb.y - danger.y);
      if (dangerDistance < 1200) score += 1600 - dangerDistance;
    });

    if (score < bestScore) {
      bestScore = score;
      bestOrb = orb;
    }
  }

  return bestOrb;
}

function findClosestEnergyCellForBot(bot, energyCells, currentZoneRadius, now) {
  let bestCell = null;
  let bestScore = Infinity;
  const dangerMemory = cleanDangerMemory(bot.dangerMemory, now);
  const botEnergy = bot.energy ?? START_ENERGY;

  for (let i = 0; i < energyCells.length; i += 1) {
    const cell = energyCells[i];
    if (!isEnergyInsideZone(cell, currentZoneRadius, 120)) continue;

    const dx = cell.x - bot.x;
    const dy = cell.y - bot.y;

    if (Math.abs(dx) > BOT_VIEW_RANGE || Math.abs(dy) > BOT_VIEW_RANGE) {
      continue;
    }

    const distance = Math.hypot(dx, dy);
    let score = distance;

    if (botEnergy <= 25) score -= 720;
    else if (botEnergy <= 45) score -= 480;
    else if (botEnergy <= 65) score -= 260;

    dangerMemory.forEach((danger) => {
      const dangerDistance = Math.hypot(cell.x - danger.x, cell.y - danger.y);
      if (dangerDistance < 1200) score += 1600 - dangerDistance;
    });

    if (score < bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }

  return bestCell;
}

function findBotCollectedEnergyCell(botBefore, botAfter, energyCells, currentZoneRadius) {
  let bestCell = null;
  let bestDistance = Infinity;

  energyCells.forEach((cell) => {
    if (!isEnergyInsideZone(cell, currentZoneRadius, 120)) return;

    const endDistance = Math.hypot(cell.x - botAfter.x, cell.y - botAfter.y);
    const pathDistance = distancePointToSegment(
      cell.x,
      cell.y,
      botBefore.x,
      botBefore.y,
      botAfter.x,
      botAfter.y
    );

    const distance = Math.min(endDistance, pathDistance);

    if (distance < ENERGY_CELL_COLLECT_DISTANCE + 35 && distance < bestDistance) {
      bestDistance = distance;
      bestCell = cell;
    }
  });

  return bestCell;
}

function getBotPower(unit) {
  return (
    (unit.hp || 0) +
    (unit.drones || 0) * 35 +
    (unit.totalCollected || 0) * 2 +
    (unit.kills || 0) * 18
  );
}

function shouldBotFarm(bot) {
  return bot.drones < BOT_FARM_UNTIL_DRONES && bot.hp > BOT_LOW_HP;
}

// IMPORTANT: gasirea inamicului si decizia de atac sunt relaxate fata de
// Play vs AI standard - botii ataca mult mai des, nu doar cu avantaj clar.
// IMPORTANT: scanare intr-o singura trecere, fara array intermediar
// "enemies" (varianta veche aloca un obiect nou per entitate - cu 70 boti
// si ~23 boti activi/ciclu AI pe device slab, asta inseamna ~1600 alocari
// de obiect per ciclu doar pentru aceasta functie). Evaluam direct player-ul
// si fiecare bot, fara sa construim o lista intermediara.
function evaluateBotEnemyCandidate(bot, candidateX, candidateY, candidateHp, candidateMaxHp, candidateDrones, candidateMass, candidateTotalCollected, candidateKills, candidateType, candidateId, currentBest) {
  const distance = Math.hypot(candidateX - bot.x, candidateY - bot.y);
  if (distance > BOT_VIEW_RANGE) return currentBest;
  if (bot.drones <= 0) return currentBest;

  const botPower = getBotPower(bot) * (bot.aiCourage || 1);
  const enemyPower =
    (candidateHp || 0) +
    (candidateDrones || 0) * 35 +
    (candidateTotalCollected || 0) * 2 +
    (candidateKills || 0) * 18;

  const enemyWeak = candidateHp <= 55 || candidateDrones <= 1;
  const hasDroneAdvantage = bot.drones >= candidateDrones + 1;
  const canWin =
    bot.drones >= 1 &&
    (hasDroneAdvantage || enemyWeak || botPower >= enemyPower * 0.95);

  if (bot.drones < BOT_FARM_UNTIL_DRONES && !enemyWeak && !hasDroneAdvantage && distance > 420) {
    return currentBest;
  }

  let score = distance;

  if (candidateType === "player") score -= 90;
  if (enemyWeak) score -= 300;
  if (hasDroneAdvantage) score -= 360;
  if (canWin) score -= 220;
  if (candidateHp < bot.hp) score -= 100;

  if (!canWin) score += 320;
  if (bot.hp <= BOT_LOW_HP && enemyPower > botPower * 1.15) score += 560;
  if (distance < 260 && enemyPower > botPower * 1.15) score += 300;

  if (currentBest && score >= currentBest.score) return currentBest;

  return {
    id: candidateId,
    x: candidateX,
    y: candidateY,
    hp: candidateHp,
    maxHp: candidateMaxHp,
    drones: candidateDrones,
    mass: candidateMass,
    totalCollected: candidateTotalCollected || 0,
    kills: candidateKills || 0,
    type: candidateType,
    distance,
    botPower,
    enemyPower,
    enemyWeak,
    hasDroneAdvantage,
    canWin,
    score,
  };
}

function findBotEnemy(bot, player, bots) {
  let best = null;

  if (player?.alive) {
    best = evaluateBotEnemyCandidate(
      bot,
      player.x,
      player.y,
      player.hp,
      player.maxHp,
      player.drones,
      player.mass,
      player.totalCollected,
      player.kills,
      "player",
      "player",
      best
    );
  }

  for (let i = 0; i < bots.length; i += 1) {
    const otherBot = bots[i];
    if (!otherBot.alive || otherBot.id === bot.id) continue;

    best = evaluateBotEnemyCandidate(
      bot,
      otherBot.x,
      otherBot.y,
      otherBot.hp,
      otherBot.maxHp,
      otherBot.drones,
      otherBot.mass,
      otherBot.totalCollected,
      otherBot.kills,
      "bot",
      otherBot.id,
      best
    );
  }

  return best;
}

// ---------------------------------------------------------------------------
// IMPORTANT: detectarea device-ului slab e separata de cea din
// PixiArenaRenderer.jsx (acolo se decide CALITATEA randarii; aici decidem
// CAT DE DES recalculeaza fiecare bot logica AI). Pe un telefon/laptop slab,
// costul principal per frame nu e desenarea (Pixi e deja optimizat), ci
// faptul ca pana la 69 de boti recalculeaza simultan avoidance + cautare
// inamic/orb/energy/core in ACELASI tick. Solutia: pe device slab impartim
// botii in mai multe "valuri" (batch-uri) rotative - un bot din 3 isi
// recalculeaza decizia la un tick, urmatorul bot la tickul urmator etc.
// Intre recalculari, botul continua sa se miste lin pe ultima directie
// stabilita (applyBotMovement e apelat tot la fiecare tick din game loop,
// doar DECIZIA de cine ataca / spre ce orb se merge e ce se face mai rar).
// Asta reduce costul CPU per frame fara sa elimine niciun bot din cei 69 si
// fara sa schimbe comportamentul vizibil al AI-ului (doar reactioneaza cu
// cateva zecimi de secunda mai tarziu pe device-uri foarte slabe).
// ---------------------------------------------------------------------------
function getBattleRoyalePerfProfile() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { isLowEndDevice: false, aiBatches: 1 };
  }

  const ua = navigator.userAgent || "";
  const isPhoneUa = /Android.*Mobile|iPhone|iPod|IEMobile|Opera Mini/i.test(ua);
  const isHuaweiLike = /Huawei|HONOR|HUAWEI|VOG-|ANA-|ELS-|LYA-|MAR-|PRA-|CLT-|ANE-|FIG-/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const isMobile = Boolean(isPhoneUa && hasTouch && shortSide <= 980);

  const cores = Number(navigator.hardwareConcurrency || 4);

  // navigator.deviceMemory nu exista in Safari/Firefox - in acel caz raman
  // null, ca sa NU presupunem fals ca device-ul e slab doar pentru ca acel
  // browser nu raporteaza memoria. Doar pe Chrome/Edge (unde API-ul exista)
  // verificam efectiv valoarea.
  const reportedMemory = typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : null;
  const memory = reportedMemory ?? 4;

  // Laptop/desktop slab: putine nuclee SAU memorie raportata <= 8GB.
  // Daca browserul nu raporteaza deviceMemory (Safari/Firefox), nu folosim
  // memoria ca semnal - ne bazam doar pe nuclee, ca sa nu marcam gresit
  // utilizatori cu RAM bun dar pe un browser care nu expune API-ul.
  const isWeakDesktop = !isMobile && (
    cores <= 4 || (reportedMemory !== null && reportedMemory <= 8)
  );

  const isLowEndMobile = Boolean(
    isMobile && (isHuaweiLike || cores <= 4 || memory <= 4)
  );

  const isLowEndDevice = isLowEndMobile || isWeakDesktop;

  // aiBatches = in cate valuri rotative impartim cei 69 de boti.
  // 1 = toti recalculeaza in fiecare tick (device normal/puternic).
  // 3 = doar ~1/3 din boti recalculeaza per tick (device slab) - reduce
  //     costul CPU al buclei AI la aproximativ o treime, fara sa schimbe
  //     numarul de boti activi/vizibili.
  const aiBatches = isLowEndDevice ? 3 : 1;

  return { isLowEndDevice, aiBatches };
}

function BattleRoyale({ user, onExitToMenu, graphicsQuality = "normal" }) {
  const keys = useRef({});
  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const mobileMoveRef = useRef({ x: 0, y: 0, active: false });
  const joystickPointerRef = useRef(null);
  const mobileAttackPointerRef = useRef(null);
  const mobileAimRef = useRef({ active: false, x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const mobileAimDirRef = useRef({ x: 1, y: 0 });
  const [mobileJoystick, setMobileJoystick] = useState({ x: 0, y: 0, active: false });
  const [mobileAttackAiming, setMobileAttackAiming] = useState(false);

  const playerRef = useRef(null);
  const botsRef = useRef([]);
  const orbsRef = useRef([]);
  const energyCellsRef = useRef([]);
  const projectilesRef = useRef([]);
  const explosionsRef = useRef([]);
  const damageTextsRef = useRef([]);
  const coresRef = useRef([]);

  const lastFireRef = useRef(0);
  const lastCooldownTextRef = useRef(0);
  const lastPlayerHitRef = useRef(0);
  const botCollisionCooldownRef = useRef({});
  const lastBotLogicUpdateRef = useRef(0);

  // ---------------------------------------------------------------------
  // IMPORTANT: pixiLiveRef e sursa unica de adevar pentru randare, citita
  // direct de PixiArenaRenderer prin ticker-ul lui Pixi (60fps), complet
  // INDEPENDENT de ciclul de render React. Acelasi pattern validat deja in
  // NormalPvpArena.jsx/GameArena.jsx. Game loop-ul scrie aici la fiecare
  // frame, dar asta NU declanseaza niciun re-render React - e doar o
  // mutatie de obiect citita de un alt sistem de randare (Pixi/WebGL).
  // React setState (setBots/setOrbs/setEnergyCells/setCores/setProjectiles)
  // se elimina din game loop si se inlocuiesc cu actualizari de pixiLiveRef.
  // HUD-ul (hp/energy/kills/leaderboard) ramane React, dar throttled la
  // hudSyncIntervalMs, nu la fiecare frame.
  // ---------------------------------------------------------------------
  const pixiLiveRef = useRef(null);
  const lastHudSyncRef = useRef(0);
  const HUD_SYNC_INTERVAL_MS = 66;

  // CORE_TYPES e constanta statica la nivel de modul - construim maparea
  // type->color o singura data, in loc sa o reconstruim la fiecare frame
  // din game loop (60x/secunda) cu .reduce().
  const coreColorMapForPixiRef = useRef(
    CORE_TYPES.reduce((acc, core) => {
      acc[core.type] = core.color;
      return acc;
    }, {})
  );
  const lastFrameTimeRef = useRef(performance.now());
  const shieldTimeoutRef = useRef(null);
  const matchSavedRef = useRef(false);
  const matchStartedAtRef = useRef(Date.now());

  const zoneStartTimeRef = useRef(Date.now());
  const lastZoneDamageRef = useRef(0);
  const lastBotEnergyDrainRef = useRef(Date.now());
  const safeZoneRadiusRef = useRef(ZONE_START_RADIUS);

  // Profilul de performanta al device-ului (detectat o singura data la mount)
  // si indexul curent al valului de boti care recalculeaza AI in tickul
  // curent - vezi getBattleRoyalePerfProfile() pentru explicatia completa.
  const perfProfileRef = useRef(getBattleRoyalePerfProfile());
  const aiBatchIndexRef = useRef(0);
  const collisionFrameSkipRef = useRef(0);

  const [gameOver, setGameOver] = useState(false);
  const [deathExplosion, setDeathExplosion] = useState(null);
  const [mouseView, setMouseView] = useState({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  }));

  const [safeZoneRadius, setSafeZoneRadius] = useState(ZONE_START_RADIUS);
  const [winner, setWinner] = useState(null);
  const [matchSummary, setMatchSummary] = useState(null);
  const [spectatorTargetId, setSpectatorTargetId] = useState(null);

  const displayName =
    user?.username || user?.firstName || user?.email?.split("@")?.[0] || "You";

  const [orbs, setOrbs] = useState(() => {
    const initialOrbTarget = getDynamicOrbTarget(BOT_COUNT + 1, ZONE_START_RADIUS);
    const initial = createOrbs(initialOrbTarget, ZONE_START_RADIUS);
    orbsRef.current = initial;
    return initial;
  });

  const [energyCells, setEnergyCells] = useState(() => {
    const initialEnergyTarget = getDynamicEnergyTarget(BOT_COUNT + 1, ZONE_START_RADIUS);
    const initial = createEnergyCells(initialEnergyTarget, ZONE_START_RADIUS);
    energyCellsRef.current = initial;
    return initial;
  });

  const [bots, setBots] = useState(() => {
    const initialBots = createBots();
    botsRef.current = initialBots;
    return initialBots;
  });

  const [projectiles, setProjectiles] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [damageTexts, setDamageTexts] = useState([]);
  const [cores, setCores] = useState([]);
  const [coreNotice, setCoreNotice] = useState(null);
  const [effectTick, setEffectTick] = useState(Date.now());
  const [fps, setFps] = useState(0);

  const [player, setPlayer] = useState(() => {
    const initialPlayer = {
      username: displayName,

      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      placement: null,

      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      attackSpeedLevel: 1,
      projectileSpeedBonus: 0,
      piercingShots: 0,
      shieldBreakerShots: 0,
      overclockUntil: 0,
      berserkUntil: 0,
      vampireUntil: 0,
      empPulseUntil: 0,
      nanoCoreActive: false,
      rotorCoreActive: false,
      swarmCoreActive: false,
      mass: 1250,
      drones: 0,
      totalCollected: 0,
      progress: 0,
      nextDroneAt: getNextDroneAt(0),
      skin: getSelectedUserSkin(user),
      ...getRandomSpawnPoint(botsRef.current, PLAYER_BOT_SPAWN_DISTANCE),
      attacking: false,
      shieldActive: false,
      shieldHit: null,
      mouseX: window.innerWidth / 2,
      mouseY: window.innerHeight / 2,
      moveX: 0,
      moveY: 0,
      knockbackX: 0,
      knockbackY: 0,
      moveAngle: -Math.PI / 2,
      isMoving: false,
      alive: true,
    };

    playerRef.current = initialPlayer;
    return initialPlayer;
  });

  const leaderboardPlayers = useMemo(() => {
    const list = [
      {
        id: "player",
        username: player.username,
        kills: player.kills || 0,
        alive: player.alive,
        hp: player.hp,
        drones: player.drones || 0,
        totalCollected: player.totalCollected || 0,
        score: (player.kills || 0) * 1000 + (player.totalCollected || 0),
        isPlayer: true,
      },
      ...bots.map((bot) => ({
        id: bot.id,
        username: bot.username,
        kills: bot.kills || 0,
        alive: bot.alive,
        hp: bot.hp,
        drones: bot.drones || 0,
        totalCollected: bot.totalCollected || 0,
        score: (bot.kills || 0) * 1000 + (bot.totalCollected || 0),
        isPlayer: false,
      })),
    ];

    return list
      .sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        if (b.score !== a.score) return b.score - a.score;
        if (b.drones !== a.drones) return b.drones - a.drones;
        if (Number(b.alive) !== Number(a.alive)) {
          return Number(b.alive) - Number(a.alive);
        }
        return b.hp - a.hp;
      })
      .slice(0, 8);
  }, [
    player.kills,
    player.alive,
    player.hp,
    player.drones,
    player.totalCollected,
    bots,
  ]);

  const alivePlayersCount =
    (player.alive ? 1 : 0) + bots.filter((bot) => bot.alive).length;

  const getRandomAliveBotId = () => {
    const aliveBots = botsRef.current.filter((bot) => bot.alive);
    if (aliveBots.length === 0) return null;
    return aliveBots[Math.floor(Math.random() * aliveBots.length)].id;
  };

  const createExplosion = (x, y, type = "cyan") => {
    const explosion = {
      id: crypto.randomUUID(),
      x,
      y,
      type,
    };

    explosionsRef.current = [...explosionsRef.current, explosion];
    setExplosions([...explosionsRef.current]);

    setTimeout(() => {
      explosionsRef.current = explosionsRef.current.filter(
        (item) => item.id !== explosion.id
      );
      setExplosions([...explosionsRef.current]);
    }, 550);
  };

  const createDamageText = (x, y, text, type = "damage") => {
    const item = {
      id: crypto.randomUUID(),
      x,
      y,
      text,
      type,
    };

    damageTextsRef.current = [...damageTextsRef.current, item];
    setDamageTexts([...damageTextsRef.current]);

    setTimeout(() => {
      damageTextsRef.current = damageTextsRef.current.filter(
        (dmg) => dmg.id !== item.id
      );
      setDamageTexts([...damageTextsRef.current]);
    }, 900);
  };

  const addKillToPlayer = () => {
    const p = playerRef.current;
    if (!p) return;

    const nextPlayer = applyKillRewardToUnit(p);

    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);

    createDamageText(
      nextPlayer.x,
      nextPlayer.y - 125,
      nextPlayer.killStreak >= 3 ? "KILL STREAK + RAPID FIRE" : "+1 DRONE",
      "heal"
    );
  };

  const addKillToBot = (botId) => {
    const updatedBots = botsRef.current.map((bot) => {
      if (bot.id !== botId) return bot;

      return applyKillRewardToUnit(bot);
    });

    botsRef.current = updatedBots;
    setBots(updatedBots);
  };

  const buildMatchSummary = (matchWinner) => {
    const p = playerRef.current;

    const allPlayers = [
      {
        id: "player",
        username: p?.username || "You",
        kills: p?.kills || 0,
        alive: p?.alive || false,
        hp: p?.hp || 0,
      },
      ...botsRef.current.map((bot) => ({
        id: bot.id,
        username: bot.username,
        kills: bot.kills || 0,
        alive: bot.alive,
        hp: bot.hp,
      })),
    ];

    const sorted = allPlayers.sort((a, b) => {
      if (Number(b.alive) !== Number(a.alive)) {
        return Number(b.alive) - Number(a.alive);
      }

      if (b.kills !== a.kills) return b.kills - a.kills;

      return b.hp - a.hp;
    });

    const myIndex = sorted.findIndex((item) => item.id === "player");

    return {
      winner: matchWinner,
      kills: p?.kills || 0,
      placement: myIndex + 1,
      totalPlayers: sorted.length,
    };
  };

  // ---------------------------------------------------------------------
  // Salvarea rezultatului in baza de date, prin endpoint-ul NestJS existent
  // (POST /matches/battle-royale, vezi MatchResultController/MatchResultService).
  // matchSavedRef previne salvarea de mai multe ori.
  // ---------------------------------------------------------------------
  const saveMatchResultToServer = async (summary) => {
    if (matchSavedRef.current) return;
    matchSavedRef.current = true;

    const p = playerRef.current;
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - matchStartedAtRef.current) / 1000)
    );

    try {
      await fetch(`${API_URL}/matches/battle-royale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id ?? null,
          username: displayName,
          kills: summary?.kills ?? p?.kills ?? 0,
          totalCollected: p?.totalCollected ?? 0,
          placement: summary?.placement ?? 1,
          totalPlayers: summary?.totalPlayers ?? BOT_COUNT + 1,
          durationSeconds,
          skin: normalizeArenaSkin(p?.skin || getSelectedUserSkin(user)),
        }),
      });
    } catch {
      // Nu blocam ecranul de final daca reteaua/serverul nu raspunde.
    }
  };

  const triggerPlayerDeath = (p, killerBotId = null) => {
    if (!p) return;

    if (killerBotId) {
      addKillToBot(killerBotId);
    }

    const deadPlayer = {
      ...p,
      alive: false,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      shieldBreakerShots: 0,
      overclockUntil: 0,
      berserkUntil: 0,
      vampireUntil: 0,
      empPulseUntil: 0,
      nanoCoreActive: false,
      rotorCoreActive: false,
      swarmCoreActive: false,
      attacking: false,
      shieldActive: false,
      shieldHit: null,
    };

    playerRef.current = deadPlayer;
    setPlayer(deadPlayer);

    setDeathExplosion({
      id: crypto.randomUUID(),
      x: p.x,
      y: p.y,
    });

    const nextSpectatorId = getRandomAliveBotId();
    setSpectatorTargetId(nextSpectatorId);

    const summary = buildMatchSummary(winner || "Still playing");
    setMatchSummary(summary);

    saveMatchResultToServer(summary);

    setCoreNotice({
      id: crypto.randomUUID(),
      type: "piercing",
      title: "Spectator mode",
      message: nextSpectatorId
        ? "Ai fost eliminat. Urmaresti un jucator random."
        : "Ai fost eliminat. Nu exista momentan tinta de spectate.",
    });

    setTimeout(() => {
      setCoreNotice(null);
    }, 3500);
  };

  const finishMatch = (matchWinner) => {
    if (gameOver || winner) return;

    const summary = buildMatchSummary(matchWinner);

    setWinner(matchWinner);
    setMatchSummary(summary);
    setGameOver(true);

    if (playerRef.current?.alive) {
      saveMatchResultToServer(summary);
    }

    setTimeout(() => {
      if (onExitToMenu) onExitToMenu();
    }, 6000);
  };

  const applyZoneDamage = (currentZoneRadius) => {
    const now = Date.now();

    if (now - lastZoneDamageRef.current < ZONE_DAMAGE_INTERVAL) return;

    lastZoneDamageRef.current = now;

    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;

    const p = playerRef.current;

    if (p && p.alive) {
      const distance = Math.hypot(p.x - centerX, p.y - centerY);

      if (distance > currentZoneRadius) {
        const nextHp = Math.max(0, p.hp - ZONE_DAMAGE);

        const nextPlayer = {
          ...p,
          hp: nextHp,
          alive: nextHp > 0,
        };

        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);

        createDamageText(p.x, p.y - 120, `-${ZONE_DAMAGE} ZONE`, "damage");

        if (nextHp <= 0) {
          triggerPlayerDeath(nextPlayer);
        }
      }
    }

    let changed = false;

    const updatedBots = botsRef.current.map((bot) => {
      if (!bot.alive) return bot;

      const distance = Math.hypot(bot.x - centerX, bot.y - centerY);

      if (distance <= currentZoneRadius) return bot;

      changed = true;

      const nextHp = Math.max(0, bot.hp - ZONE_DAMAGE);

      return {
        ...bot,
        hp: nextHp,
        alive: nextHp > 0,
      };
    });

    if (changed) {
      botsRef.current = updatedBots;
      setBots(updatedBots);
    }
  };

  const checkBattleRoyaleWinner = () => {
    if (gameOver || winner) return;

    const p = playerRef.current;
    const aliveBots = botsRef.current.filter((bot) => bot.alive);

    if (p?.alive && aliveBots.length === 0) {
      finishMatch(p.username || "You");
      return;
    }

    if ((!p || !p.alive) && aliveBots.length === 1) {
      finishMatch(aliveBots[0].username);
      return;
    }

    if ((!p || !p.alive) && aliveBots.length === 0) {
      finishMatch("No winner");
    }
  };

  useEffect(() => {
    zoneStartTimeRef.current = Date.now();
    matchStartedAtRef.current = Date.now();
    matchSavedRef.current = false;
    lastZoneDamageRef.current = 0;
    lastBotEnergyDrainRef.current = Date.now();
    safeZoneRadiusRef.current = ZONE_START_RADIUS;

    setSafeZoneRadius(ZONE_START_RADIUS);
    setWinner(null);
    setMatchSummary(null);
    setGameOver(false);
    setSpectatorTargetId(null);
    setDeathExplosion(null);

    const initialBots = createBots();
    botsRef.current = initialBots;
    setBots(initialBots);

    const playerSpawn = getRandomSpawnPoint(
      initialBots,
      PLAYER_BOT_SPAWN_DISTANCE
    );

    const currentPlayer = playerRef.current;
    const resetPlayer = {
      ...currentPlayer,
      ...playerSpawn,
      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      drones: 0,
      progress: 0,
      nextDroneAt: getNextDroneAt(0),
      totalCollected: 0,
      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      shieldBreakerShots: 0,
      overclockUntil: 0,
      berserkUntil: 0,
      vampireUntil: 0,
      empPulseUntil: 0,
      nanoCoreActive: false,
      rotorCoreActive: false,
      swarmCoreActive: false,
      alive: true,
      attacking: false,
      shieldActive: false,
      shieldHit: null,
      moveX: 0,
      moveY: 0,
      knockbackX: 0,
      knockbackY: 0,
      moveAngle: -Math.PI / 2,
      isMoving: false,
    };

    playerRef.current = resetPlayer;
    setPlayer(resetPlayer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p || !p.alive || gameOver) return;

      const isMoving =
        keys.current["w"] ||
        keys.current["a"] ||
        keys.current["s"] ||
        keys.current["d"];

      if (!isMoving) return;

      const nextEnergy = Math.max(
        0,
        (p.energy ?? START_ENERGY) - ENERGY_DRAIN_AMOUNT
      );

      const nextPlayer = {
        ...p,
        energy: nextEnergy,
      };

      playerRef.current = nextPlayer;
      setPlayer(nextPlayer);

      if (nextEnergy <= 0) {
        const deadPlayer = {
          ...nextPlayer,
          alive: false,
        };

        playerRef.current = deadPlayer;
        setPlayer(deadPlayer);

        createDamageText(p.x, p.y - 120, "ENERGY EMPTY", "damage");
        triggerPlayerDeath(deadPlayer);
      }
    }, ENERGY_DRAIN_INTERVAL);

    return () => clearInterval(interval);
  }, [gameOver]);

  useEffect(() => {
    const name =
      user?.username || user?.firstName || user?.email?.split("@")?.[0] || "You";

    const selectedSkin = getSelectedUserSkin(user);

    playerRef.current = {
      ...playerRef.current,
      username: name,
      skin: selectedSkin,
    };

    setPlayer((prev) => ({
      ...prev,
      username: name,
      skin: selectedSkin,
    }));
  }, [user]);

  useEffect(() => {
    const updateViewport = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  const spawnCoreWaveNow = (noticeTitle = "Power cores spawned") => {
    const wave = createCoreWave(CORE_WAVE_SIZE, safeZoneRadiusRef.current);

    coresRef.current = wave;
    setCores([...wave]);

    setCoreNotice({
      id: crypto.randomUUID(),
      type: "overclock",
      title: noticeTitle,
      message: `${wave.length} unique cores are active. One of each type.`,
    });

    setTimeout(() => {
      setCoreNotice(null);
    }, 3200);
  };

  const startCoreDropCountdown = () => {
    let secondsLeft = 5;

    setCoreNotice({
      id: crypto.randomUUID(),
      type: "overclock",
      title: "Core drop incoming",
      message: `${secondsLeft}`,
      countdown: secondsLeft,
    });

    const interval = setInterval(() => {
      secondsLeft -= 1;

      if (secondsLeft <= 0) {
        clearInterval(interval);
        spawnCoreWaveNow();
        return;
      }

      setCoreNotice({
        id: crypto.randomUUID(),
        type: "overclock",
        title: "Core drop incoming",
        message: `${secondsLeft}`,
        countdown: secondsLeft,
      });
    }, 1000);

    return interval;
  };

  useEffect(() => {
    let spawnTimeout;
    let countdownInterval;

    spawnTimeout = setTimeout(() => {
      countdownInterval = startCoreDropCountdown();
    }, 1000);

    return () => {
      clearTimeout(spawnTimeout);
      clearInterval(countdownInterval);
    };
  }, []);

  const spectatorTarget =
    !player.alive
      ? bots.find((bot) => bot.alive && bot.id === spectatorTargetId) ||
        bots.find((bot) => bot.alive) ||
        player
      : player;

  const viewTarget = spectatorTarget || player;

  const isRealMobileDevice =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    (
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Windows Phone/i.test(
        navigator.userAgent || ""
      ) ||
      (
        navigator.maxTouchPoints > 1 &&
        window.matchMedia &&
        window.matchMedia("(pointer: coarse)").matches
      )
    );

  const isMobileLike = isRealMobileDevice;

  const isMobileLandscape =
    isMobileLike && viewportSize.width > viewportSize.height;

  const isMobilePortrait =
    isMobileLike && viewportSize.height >= viewportSize.width;

  const showMobileControls = player.alive && !gameOver && isMobileLike;

  const mobileWorldScale = 1;

  const mobileViewDistance = isMobileLandscape ? 560 : VIEW_DISTANCE;
  const mobileBotRenderDistance = isMobileLandscape ? 620 : BOT_RENDER_DISTANCE;
  const mobileBotSimpleDistance = isMobileLandscape ? 860 : BOT_SIMPLE_RENDER_DISTANCE;
  const mobileProjectileDistance = isMobileLandscape ? 920 : PROJECTILE_RENDER_DISTANCE;
  const mobileFullBotLimit = isMobileLandscape ? 4 : MAX_FULL_RENDER_BOTS;
  const mobileFullProjectileLimit = isMobileLandscape ? 7 : MAX_FULL_PROJECTILES;
  const mobileSimpleProjectileLimit = isMobileLandscape ? 28 : MAX_SIMPLE_PROJECTILES;

  useEffect(() => {
    if (player.alive) return;

    const currentTargetStillAlive = bots.some(
      (bot) => bot.alive && bot.id === spectatorTargetId
    );

    if (!currentTargetStillAlive) {
      const nextTarget = bots.find((bot) => bot.alive);
      setSpectatorTargetId(nextTarget?.id || null);
    }
  }, [player.alive, spectatorTargetId, bots]);

  const visibleOrbs = useMemo(() => {
    return orbs
      .filter((orb) => {
        return (
          Math.abs(orb.x - viewTarget.x) < mobileViewDistance &&
          Math.abs(orb.y - viewTarget.y) < mobileViewDistance
        );
      })
      .slice(0, isMobileLandscape ? 72 : 180);
  }, [orbs, viewTarget.x, viewTarget.y, isMobileLandscape, mobileViewDistance]);

  const visibleEnergyCells = useMemo(() => {
    return energyCells
      .filter((cell) => {
        return (
          Math.abs(cell.x - viewTarget.x) < mobileViewDistance &&
          Math.abs(cell.y - viewTarget.y) < mobileViewDistance
        );
      })
      .slice(0, isMobileLandscape ? 36 : 110);
  }, [energyCells, viewTarget.x, viewTarget.y, isMobileLandscape, mobileViewDistance]);

  const visibleCores = useMemo(() => {
    return cores.filter((core) => {
      return (
        Math.abs(core.x - viewTarget.x) < mobileViewDistance &&
        Math.abs(core.y - viewTarget.y) < mobileViewDistance
      );
    });
  }, [cores, viewTarget.x, viewTarget.y, mobileViewDistance]);

  const visibleProjectiles = useMemo(() => {
    return projectiles
      .filter((projectile) => {
        return (
          Math.abs(projectile.x - viewTarget.x) < mobileProjectileDistance &&
          Math.abs(projectile.y - viewTarget.y) < mobileProjectileDistance
        );
      })
      .sort((a, b) => {
        const da = Math.hypot(a.x - viewTarget.x, a.y - viewTarget.y);
        const db = Math.hypot(b.x - viewTarget.x, b.y - viewTarget.y);
        return da - db;
      });
  }, [projectiles, viewTarget.x, viewTarget.y, mobileProjectileDistance]);

  const fullProjectiles = useMemo(() => {
    return visibleProjectiles.slice(0, mobileFullProjectileLimit);
  }, [visibleProjectiles, mobileFullProjectileLimit]);

  const simpleProjectiles = useMemo(() => {
    return visibleProjectiles.slice(
      mobileFullProjectileLimit,
      mobileFullProjectileLimit + mobileSimpleProjectileLimit
    );
  }, [visibleProjectiles, mobileFullProjectileLimit, mobileSimpleProjectileLimit]);

  const visibleBots = useMemo(() => {
    return bots
      .filter((bot) => {
        return (
          bot.alive &&
          Math.abs(bot.x - viewTarget.x) < mobileBotRenderDistance &&
          Math.abs(bot.y - viewTarget.y) < mobileBotRenderDistance
        );
      })
      .sort((a, b) => {
        const da = Math.hypot(a.x - viewTarget.x, a.y - viewTarget.y);
        const db = Math.hypot(b.x - viewTarget.x, b.y - viewTarget.y);
        return da - db;
      });
  }, [bots, viewTarget.x, viewTarget.y, mobileBotRenderDistance]);

  const fullRenderBots = useMemo(() => {
    return visibleBots.slice(0, mobileFullBotLimit);
  }, [visibleBots, mobileFullBotLimit]);

  const simpleRenderBots = useMemo(() => {
    const fullIds = new Set(fullRenderBots.map((bot) => bot.id));

    return bots.filter((bot) => {
      if (!bot.alive || fullIds.has(bot.id)) return false;

      const distance = Math.hypot(bot.x - viewTarget.x, bot.y - viewTarget.y);

      return distance < mobileBotSimpleDistance;
    });
  }, [bots, fullRenderBots, viewTarget.x, viewTarget.y, mobileBotSimpleDistance]);

  const canFire = player.drones > 0 && player.alive && !gameOver;

  const aimCenterX = viewportSize.width / 2;
  const aimCenterY = viewportSize.height / 2;

  const aimAngleDeg =
    (Math.atan2(mouseView.y - aimCenterY, mouseView.x - aimCenterX) * 180) /
    Math.PI;

  const applyPlayerEmpBlast = (sourceX, sourceY) => {
    let affected = 0;

    const updatedBots = botsRef.current.map((bot) => {
      if (!bot.alive) return bot;

      const distance = Math.hypot(bot.x - sourceX, bot.y - sourceY);
      if (distance > EMP_RADIUS || (bot.drones || 0) <= 0) return bot;

      affected += 1;
      const nextDrones = Math.max(0, (bot.drones || 0) - EMP_DRONE_DAMAGE);

      createDamageText(bot.x, bot.y - 90, "EMP -1 DRONE", "block");

      return {
        ...bot,
        drones: nextDrones,
        progress: 0,
        nextDroneAt: getNextDroneAt(nextDrones),
        empPulseUntil: Date.now() + 900,
      };
    });

    if (affected > 0) {
      botsRef.current = updatedBots;
      setBots(updatedBots);
    }

    createDamageText(sourceX, sourceY - 135, `EMP HIT ${affected}`, "heal");
  };

  const healVampireOwner = (ownerType, ownerId, damageAmount) => {
    if (!damageAmount || damageAmount <= 0) return;

    const healAmount = Math.max(1, Math.round(damageAmount * VAMPIRE_HEAL_RATIO));
    const now = Date.now();

    if (ownerType === "player") {
      const p = playerRef.current;
      if (!p?.alive || !p.vampireUntil || p.vampireUntil <= now) return;

      const nextPlayer = {
        ...p,
        hp: Math.min(p.maxHp || START_HP, (p.hp || 0) + healAmount),
      };

      playerRef.current = nextPlayer;
      setPlayer(nextPlayer);
      createDamageText(p.x, p.y - 112, `+${healAmount} VAMP`, "heal");
      return;
    }

    if (ownerType === "bot" && ownerId) {
      let healed = false;

      const updatedBots = botsRef.current.map((bot) => {
        if (bot.id !== ownerId || !bot.alive || !bot.vampireUntil || bot.vampireUntil <= now) {
          return bot;
        }

        healed = true;

        return {
          ...bot,
          hp: Math.min(bot.maxHp || START_HP, (bot.hp || 0) + healAmount),
        };
      });

      if (healed) {
        botsRef.current = updatedBots;
        setBots(updatedBots);
      }
    }
  };

  const applyCore = (core) => {
    const p = playerRef.current;
    if (!p || !p.alive) return;

    const result = applyCoreStatsToUnit(p, core);

    if (!result.collected) {
      createDamageText(p.x, p.y - 120, "CORE ACTIVE", "block");
      return;
    }

    const nextPlayer = result.unit;

    if (core.type === "emp") {
      applyPlayerEmpBlast(p.x, p.y);
    }

    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);

    createDamageText(p.x, p.y - 120, getCoreFloatingText(core.type), "heal");

    setCoreNotice({
      id: crypto.randomUUID(),
      type: core.type,
      title: `${core.name} collected`,
      message: getCoreNoticeMessage(core.type),
    });

    setTimeout(() => setCoreNotice(null), 2800);
  };

  const scheduleNextCoreWave = () => {
    setCoreNotice({
      id: crypto.randomUUID(),
      type: "rotor",
      title: "All cores collected",
      message: "Next core drop in 60 seconds.",
    });

    setTimeout(() => {
      startCoreDropCountdown();
    }, CORE_RESPAWN_DELAY);
  };

  const damagePlayer = (killerBotId = null, incomingDamage = HIT_DAMAGE, piercesShield = false, vampireOwnerType = null, vampireOwnerId = null) => {
    const p = playerRef.current;
    if (!p || !p.alive || gameOver) return;

    if (p.shieldActive && !piercesShield) {
      if (shieldTimeoutRef.current) {
        clearTimeout(shieldTimeoutRef.current);
        shieldTimeoutRef.current = null;
      }

      const impact = {
        ...p,
        shieldActive: false,
        shieldHit: Date.now(),
      };

      playerRef.current = impact;
      setPlayer(impact);

      createExplosion(p.x, p.y, "shield");
      createDamageText(p.x, p.y - 95, "SHIELD BROKEN", "block");
      return;
    }

    let nextDrones = p.drones;
    let nextHp = p.hp;
    let nextProgress = p.progress;
    let nextDroneAt = p.nextDroneAt;

    if (nextDrones > 0) {
      nextDrones = Math.max(0, nextDrones - 1);
      nextProgress = 0;
      nextDroneAt = getNextDroneAt(nextDrones);
      nextHp = Math.max(0, nextHp - DRONE_HIT_DAMAGE);

      createExplosion(p.x, p.y, "cyan");
      createDamageText(p.x, p.y - 95, "-1 DRONE", "damage");
      createDamageText(p.x, p.y - 65, `-${DRONE_HIT_DAMAGE} HP`, "damage");
    } else {
      nextHp = Math.max(0, nextHp - incomingDamage);
      createExplosion(p.x, p.y, "red");
      createDamageText(p.x, p.y - 80, `-${incomingDamage}`, "damage");
    }

    const isDead = nextHp <= 0;

    const nextPlayer = {
      ...p,
      hp: nextHp,
      drones: nextDrones,
      progress: nextProgress,
      nextDroneAt,
      alive: !isDead,
    };

    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);

    if (vampireOwnerType && nextHp < p.hp) {
      healVampireOwner(vampireOwnerType, vampireOwnerId, p.hp - nextHp);
    }

    if (isDead) triggerPlayerDeath(nextPlayer, killerBotId);
  };

  const damageBot = (botId, x, y, killerType = "player", killerBotId = null, incomingDamage = HIT_DAMAGE, piercesShield = false, vampireOwnerType = null, vampireOwnerId = null) => {
    let wasHit = false;
    let botDied = false;

    const updatedBots = botsRef.current.map((bot) => {
      if (!bot.alive || bot.id !== botId) return bot;

      wasHit = true;

      let nextDrones = bot.drones;
      let nextHp = bot.hp;

      if (nextDrones > 0) {
        nextDrones = Math.max(0, nextDrones - 1);
        nextHp = Math.max(0, nextHp - DRONE_HIT_DAMAGE);
        createDamageText(x, y - 35, "-1 DRONE", "block");
        createDamageText(x, y - 60, `-${DRONE_HIT_DAMAGE} HP`, "damage");
      } else {
        nextHp = Math.max(0, nextHp - incomingDamage);
        createDamageText(x, y - 45, `-${incomingDamage}`, "damage");
      }

      if (nextHp <= 0 && bot.alive) {
        botDied = true;
      }

      createExplosion(x, y, "red");

      return {
        ...bot,
        drones: nextDrones,
        progress: nextDrones < bot.drones ? 0 : bot.progress,
        nextDroneAt: nextDrones < bot.drones ? getNextDroneAt(nextDrones) : bot.nextDroneAt,
        hp: nextHp,
        alive: nextHp > 0,
        killStreak: nextHp > 0 ? bot.killStreak || 0 : 0,
        rapidFireUntil: nextHp > 0 ? bot.rapidFireUntil || 0 : 0,
        attackCooldownMultiplier: nextHp > 0 ? bot.attackCooldownMultiplier || 1 : 1,
      };
    });

    if (wasHit) {
      botsRef.current = updatedBots;
    }

    if (wasHit && vampireOwnerType) {
      healVampireOwner(vampireOwnerType, vampireOwnerId, incomingDamage);
    }

    if (botDied) {
      if (killerType === "player") {
        addKillToPlayer();
      }

      if (killerType === "bot" && killerBotId) {
        addKillToBot(killerBotId);
      }
    }

    return wasHit;
  };

  const activateShield = () => {
    const p = playerRef.current;
    if (!p || !p.alive || p.shieldActive || gameOver) return;

    let nextProgress = p.progress;
    let nextDrones = p.drones;
    let nextDroneAt = p.nextDroneAt;

    if (nextProgress >= SHIELD_COST) {
      nextProgress -= SHIELD_COST;
    } else if (nextDrones > 0) {
      nextDrones = Math.max(0, nextDrones - 1);
      nextProgress = 0;
      nextDroneAt = getNextDroneAt(nextDrones);
    } else {
      return;
    }

    const nextPlayer = {
      ...p,
      progress: nextProgress,
      drones: nextDrones,
      nextDroneAt,
      shieldActive: true,
      shieldHit: null,
    };

    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);

    if (shieldTimeoutRef.current) clearTimeout(shieldTimeoutRef.current);

    shieldTimeoutRef.current = setTimeout(() => {
      const current = playerRef.current;
      if (!current) return;

      const noShield = {
        ...current,
        shieldActive: false,
        shieldHit: null,
      };

      playerRef.current = noShield;
      setPlayer(noShield);
    }, SHIELD_DURATION);
  };

  const checkProjectileHit = (projectile) => {
    const ownerType = projectile.ownerType || "player";

    if (ownerType === "bot") {
      const p = playerRef.current;

      if (p?.alive) {
        const playerDistance = Math.hypot(projectile.x - p.x, projectile.y - p.y);

        if (playerDistance < 95) {
          damagePlayer(projectile.ownerId, projectile.damage || HIT_DAMAGE, projectile.piercesShield, projectile.ownerType, projectile.ownerId);

          return {
            hit: true,
            keep: projectile.pierceLeft > 1,
            projectile: {
              ...projectile,
              pierceLeft: projectile.pierceLeft - 1,
            },
          };
        }
      }

      for (const bot of botsRef.current) {
        if (!bot.alive || bot.id === projectile.ownerId) continue;

        const distance = Math.hypot(projectile.x - bot.x, projectile.y - bot.y);

        if (distance < 95) {
          damageBot(
            bot.id,
            projectile.x,
            projectile.y,
            "bot",
            projectile.ownerId,
            projectile.damage || HIT_DAMAGE,
            projectile.piercesShield,
            projectile.ownerType,
            projectile.ownerId
          );

          return {
            hit: true,
            keep: projectile.pierceLeft > 1,
            projectile: {
              ...projectile,
              pierceLeft: projectile.pierceLeft - 1,
            },
          };
        }
      }

      return { hit: false, keep: true };
    }

    for (const bot of botsRef.current) {
      if (!bot.alive) continue;

      const distance = Math.hypot(projectile.x - bot.x, projectile.y - bot.y);

      if (distance < 95) {
        damageBot(bot.id, projectile.x, projectile.y, "player", null, projectile.damage || HIT_DAMAGE, projectile.piercesShield, projectile.ownerType, projectile.ownerId);

        return {
          hit: true,
          keep: projectile.pierceLeft > 1,
          projectile: {
            ...projectile,
            pierceLeft: projectile.pierceLeft - 1,
          },
        };
      }
    }

    return { hit: false, keep: true };
  };

  const checkBotsTouchPlayer = () => {
    const p = playerRef.current;
    if (!p || !p.alive || gameOver) return;

    const now = Date.now();

    for (const bot of botsRef.current) {
      if (!bot.alive) continue;

      const dx = p.x - bot.x;
      const dy = p.y - bot.y;
      const distance = Math.hypot(dx, dy) || 1;

      if (distance >= BODY_COLLISION_DISTANCE) continue;

      const key = ["player", bot.id].sort().join("-");
      if (now - (botCollisionCooldownRef.current[key] || 0) < BODY_COLLISION_COOLDOWN) {
        continue;
      }

      botCollisionCooldownRef.current[key] = now;
      lastPlayerHitRef.current = now;

      const pushX = dx / distance;
      const pushY = dy / distance;

      const outcome = getBodyCollisionOutcome(p, bot);

      let nextPlayer = applyBodyCollisionDamage(
        p,
        outcome.aHpDamage,
        outcome.aDroneLoss
      );

      nextPlayer = applySmoothKnockback(
        nextPlayer,
        pushX,
        pushY,
        outcome.push
      );

      let botDied = false;

      const updatedBots = botsRef.current.map((item) => {
        if (item.id !== bot.id) return item;

        const damagedBot = applyBodyCollisionDamage(
          item,
          outcome.bHpDamage,
          outcome.bDroneLoss
        );

        botDied = item.alive && !damagedBot.alive;

        return applySmoothKnockback(
          {
            ...damagedBot,
            vx: -pushX,
            vy: -pushY,
            aiPlanUntil: now + 420,
          },
          -pushX,
          -pushY,
          outcome.push
        );
      });

      botsRef.current = updatedBots;

      createExplosion((p.x + bot.x) / 2, (p.y + bot.y) / 2, "cyan");

      if (outcome.aDroneLoss > 0) {
        createDamageText(p.x, p.y - 92, "-1 DRONE", "damage");
      }

      if (outcome.aHpDamage > 0) {
        createDamageText(p.x, p.y - 64, `-${outcome.aHpDamage} HP`, "damage");
      }

      if (outcome.bDroneLoss > 0) {
        createDamageText(bot.x, bot.y - 92, "-1 DRONE", "damage");
      }

      if (outcome.bHpDamage > 0) {
        createDamageText(bot.x, bot.y - 64, `-${outcome.bHpDamage} HP`, "damage");
      }

      playerRef.current = nextPlayer;

      if (botDied) {
        addKillToPlayer();
      }

      if (!nextPlayer.alive) {
        triggerPlayerDeath(nextPlayer, bot.id);
      }

      break;
    }
  };

  // ---------------------------------------------------------------------
  // BROAD-PHASE SPATIAL GRID pentru coliziuni bot-cu-bot, identic ca principiu
  // cu cel folosit in game.gateway.ts (server) pentru pana la 99 jucatori.
  // Inainte: testam TOATE perechile (O(n^2) = ~2400 perechi la 69 boti, de
  // 30-60 ori/secunda). Cand multi boti se aglomereaza langa jucator (exact
  // situatia raportata ca lag), asta inseamna mii de verificari de distanta
  // pe frame, desi doar boții fizic apropiati pot coliziona oricum.
  // Acum: impartim harta in celule de COLLISION_GRID_CELL_SIZE px. Testam
  // coliziuni doar intre boti din aceeasi celula sau celule direct vecine
  // (max 9 celule). Rezultatul (cine se ciocneste cu cine) e identic cu
  // varianta O(n^2), pentru ca BODY_COLLISION_DISTANCE (145) e mult mai mic
  // decat COLLISION_GRID_CELL_SIZE (600) - doi boti suficient de apropiati
  // pentru coliziune sunt mereu in aceeasi celula sau intr-o celula vecina.
  // ---------------------------------------------------------------------
  const COLLISION_GRID_CELL_SIZE = 600;

  const buildBotCollisionGrid = (aliveBots) => {
    const grid = new Map();

    for (const bot of aliveBots) {
      const cellX = Math.floor(bot.x / COLLISION_GRID_CELL_SIZE);
      const cellY = Math.floor(bot.y / COLLISION_GRID_CELL_SIZE);
      const key = `${cellX}:${cellY}`;

      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(bot);
    }

    return grid;
  };

  const getNearbyGridBots = (grid, bot) => {
    const cellX = Math.floor(bot.x / COLLISION_GRID_CELL_SIZE);
    const cellY = Math.floor(bot.y / COLLISION_GRID_CELL_SIZE);
    const nearby = [];

    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const bucket = grid.get(`${cellX + ox}:${cellY + oy}`);
        if (bucket) nearby.push(...bucket);
      }
    }

    return nearby;
  };

  const checkBotsTouchBots = () => {
    if (gameOver) return;

    const now = Date.now();
    let changed = false;
    const killsToAdd = [];

    const updatedBots = botsRef.current.map((bot) => ({ ...bot }));
    const botIndexById = new Map();
    updatedBots.forEach((bot, index) => botIndexById.set(bot.id, index));

    const aliveBotsForGrid = updatedBots.filter((bot) => bot.alive);

    // Pentru camere mici (<= 12 boti vii), O(n^2) e deja ieftin si nu merita
    // overhead-ul construirii grid-ului - identic cu pragul din
    // game.gateway.ts pentru acelasi motiv.
    if (aliveBotsForGrid.length <= 12) {
      for (let i = 0; i < updatedBots.length; i += 1) {
        const botA = updatedBots[i];
        if (!botA.alive) continue;

        for (let j = i + 1; j < updatedBots.length; j += 1) {
          const botB = updatedBots[j];
          if (!botB.alive) continue;

          processBotPairCollision(botA, botB, i, j, updatedBots, now, killsToAdd, () => {
            changed = true;
          });
        }
      }
    } else {
      const grid = buildBotCollisionGrid(aliveBotsForGrid);
      const checkedPairs = new Set();

      for (const botA of aliveBotsForGrid) {
        const nearby = getNearbyGridBots(grid, botA);

        for (const botB of nearby) {
          if (botA.id === botB.id) continue;

          const pairKey = botA.id < botB.id ? `${botA.id}:${botB.id}` : `${botB.id}:${botA.id}`;
          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);

          const i = botIndexById.get(botA.id);
          const j = botIndexById.get(botB.id);

          processBotPairCollision(updatedBots[i], updatedBots[j], i, j, updatedBots, now, killsToAdd, () => {
            changed = true;
          });
        }
      }
    }

    if (changed) {
      botsRef.current = updatedBots;

      killsToAdd.forEach((botId) => {
        addKillToBot(botId);
      });
    }
  };

  // Logica de rezolvare a unei singure coliziuni intre 2 boti - extrasa intr-o
  // functie separata ca sa fie identica fie ca vine din varianta brute-force
  // (camere mici) fie din varianta cu grid (camere mari). Muteaza updatedBots
  // in-place la indecsii i/j si adauga in killsToAdd daca e cazul.
  const processBotPairCollision = (botA, botB, i, j, updatedBots, now, killsToAdd, onChanged) => {
    const dx = botA.x - botB.x;
    const dy = botA.y - botB.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance >= BODY_COLLISION_DISTANCE) return;

    const key = [botA.id, botB.id].sort().join("-");
    if (now - (botCollisionCooldownRef.current[key] || 0) < BODY_COLLISION_COOLDOWN) {
      return;
    }

    botCollisionCooldownRef.current[key] = now;

    const pushX = dx / distance;
    const pushY = dy / distance;

    const outcome = getBodyCollisionOutcome(botA, botB);

    const botAWasAlive = botA.alive;
    const botBWasAlive = botB.alive;

    const damagedA = applyBodyCollisionDamage(
      botA,
      outcome.aHpDamage,
      outcome.aDroneLoss
    );

    const damagedB = applyBodyCollisionDamage(
      botB,
      outcome.bHpDamage,
      outcome.bDroneLoss
    );

    const pushedA = applySmoothKnockback(
      {
        ...damagedA,
        vx: pushX,
        vy: pushY,
        aiPlanUntil: now + 420,
      },
      pushX,
      pushY,
      outcome.push
    );

    const pushedB = applySmoothKnockback(
      {
        ...damagedB,
        vx: -pushX,
        vy: -pushY,
        aiPlanUntil: now + 420,
      },
      -pushX,
      -pushY,
      outcome.push
    );

    updatedBots[i] = pushedA;
    updatedBots[j] = pushedB;

    createExplosion((botA.x + botB.x) / 2, (botA.y + botB.y) / 2, "red");

    if (outcome.aDroneLoss > 0) {
      createDamageText(botA.x, botA.y - 90, "-1 DRONE", "block");
    }

    if (outcome.aHpDamage > 0) {
      createDamageText(botA.x, botA.y - 62, `-${outcome.aHpDamage} HP`, "damage");
    }

    if (outcome.bDroneLoss > 0) {
      createDamageText(botB.x, botB.y - 90, "-1 DRONE", "block");
    }

    if (outcome.bHpDamage > 0) {
      createDamageText(botB.x, botB.y - 62, `-${outcome.bHpDamage} HP`, "damage");
    }

    if (botAWasAlive && !pushedA.alive && pushedB.alive) {
      killsToAdd.push(pushedB.id);
    }

    if (botBWasAlive && !pushedB.alive && pushedA.alive) {
      killsToAdd.push(pushedA.id);
    }

    onChanged();
  };

  const updateMobileAimFromPoint = (clientX, clientY, options = {}) => {
    const p = playerRef.current;
    if (!p || !p.alive) return;

    const centerX = viewportSize.width / 2;
    const centerY = viewportSize.height / 2;

    let screenDx = clientX - centerX;
    let screenDy = clientY - centerY;
    let distance = Math.hypot(screenDx, screenDy);

    if (distance < 18) {
      const mobileMove = mobileMoveRef.current;
      const fallbackX =
        mobileMove.active && Math.abs(mobileMove.x) > 0.05
          ? mobileMove.x
          : Math.cos(p.moveAngle || 0);
      const fallbackY =
        mobileMove.active && Math.abs(mobileMove.y) > 0.05
          ? mobileMove.y
          : Math.sin(p.moveAngle || 0);

      screenDx = fallbackX * 420;
      screenDy = fallbackY * 420;
      distance = Math.hypot(screenDx, screenDy) || 1;
    }

    const angle = Math.atan2(screenDy, screenDx);
    const aimDistance = Math.max(180, Math.min(distance, 520));

    const nextMouse = {
      x: centerX + Math.cos(angle) * aimDistance,
      y: centerY + Math.sin(angle) * aimDistance,
    };

    mouse.current = nextMouse;
    mobileAimRef.current = {
      active: true,
      x: nextMouse.x,
      y: nextMouse.y,
    };

    setMouseView(nextMouse);

    playerRef.current = {
      ...p,
      attacking: options.visualAttack === true ? true : p.attacking,
      mouseX: p.x + Math.cos(angle) * 520,
      mouseY: p.y + Math.sin(angle) * 520,
    };
  };

  const updateMobileAimForAction = () => {
    const p = playerRef.current;
    if (!p || !p.alive) return;

    const mobileMove = mobileMoveRef.current;
    const fallbackX =
      mobileMove.active && Math.abs(mobileMove.x) > 0.05
        ? mobileMove.x
        : Math.cos(p.moveAngle || 0);
    const fallbackY =
      mobileMove.active && Math.abs(mobileMove.y) > 0.05
        ? mobileMove.y
        : Math.sin(p.moveAngle || 0);

    updateMobileAimFromPoint(
      viewportSize.width / 2 + fallbackX * 420,
      viewportSize.height / 2 + fallbackY * 420
    );
  };

  const updateMobileAimFromAttackButton = (e) => {
    const p = playerRef.current;
    if (!p || !p.alive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawX = e.clientX - cx;
    const rawY = e.clientY - cy;
    const distance = Math.hypot(rawX, rawY);

    let dirX;
    let dirY;

    if (distance > 8) {
      dirX = rawX / distance;
      dirY = rawY / distance;
      mobileAimDirRef.current = { x: dirX, y: dirY };
    } else {
      const mobileMove = mobileMoveRef.current;
      if (mobileMove.active && Math.hypot(mobileMove.x, mobileMove.y) > 0.05) {
        const len = Math.hypot(mobileMove.x, mobileMove.y) || 1;
        dirX = mobileMove.x / len;
        dirY = mobileMove.y / len;
      } else {
        dirX = mobileAimDirRef.current.x || Math.cos(p.moveAngle || 0) || 1;
        dirY = mobileAimDirRef.current.y || Math.sin(p.moveAngle || 0) || 0;
      }
    }

    const aimDistance = Math.max(
      220,
      Math.min(420, Math.min(viewportSize.width, viewportSize.height) * 0.42)
    );

    updateMobileAimFromPoint(
      viewportSize.width / 2 + dirX * aimDistance,
      viewportSize.height / 2 + dirY * aimDistance
    );
  };

  const handleMobileAttackStart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const p = playerRef.current;
    if (!p || !p.alive || gameOver || p.drones <= 0) return;

    const pointer = e.pointerId ?? 1;
    mobileAttackPointerRef.current = pointer;

    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(pointer);
    }

    setMobileAttackAiming(true);
    updateMobileAimFromAttackButton(e);

    playerRef.current = {
      ...playerRef.current,
      attacking: false,
    };
  };

  const handleMobileAttackMove = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (mobileAttackPointerRef.current !== null && e.pointerId !== mobileAttackPointerRef.current) {
      return;
    }

    const p = playerRef.current;
    if (!p || !p.alive || gameOver || p.drones <= 0) return;

    updateMobileAimFromAttackButton(e);
  };

  const handleMobileAttackEnd = (e, shouldFire = true) => {
    e.preventDefault();
    e.stopPropagation();

    if (mobileAttackPointerRef.current !== null && e.pointerId !== mobileAttackPointerRef.current) {
      return;
    }

    const p = playerRef.current;

    if (shouldFire && p?.alive && p.drones > 0 && !gameOver) {
      updateMobileAimFromAttackButton(e);
      fireDrone();
    }

    mobileAttackPointerRef.current = null;
    mobileAimRef.current = {
      ...mobileAimRef.current,
      active: false,
    };

    setMobileAttackAiming(false);

    const current = playerRef.current;
    if (current) {
      playerRef.current = {
        ...current,
        attacking: false,
      };
      setPlayer(playerRef.current);
    }
  };

  const handleMobileAttackCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();

    mobileAttackPointerRef.current = null;
    mobileAimRef.current = {
      ...mobileAimRef.current,
      active: false,
    };

    setMobileAttackAiming(false);

    const current = playerRef.current;
    if (current) {
      playerRef.current = {
        ...current,
        attacking: false,
      };
      setPlayer(playerRef.current);
    }
  };

  const handleMobileShield = (e) => {
    e.preventDefault();
    e.stopPropagation();
    activateShield();
  };

  const fireDrone = () => {
    const p = playerRef.current;
    const now = Date.now();

    if (!p || !p.alive || p.drones <= 0 || gameOver) return;

    const effectiveCooldown = getEffectiveFireCooldown(p, FIRE_COOLDOWN);

    if (now - lastFireRef.current < effectiveCooldown) {
      if (now - lastCooldownTextRef.current > 500) {
        const remaining = Math.ceil(
          (effectiveCooldown - (now - lastFireRef.current)) / 1000
        );

        createDamageText(p.x, p.y - 115, `COOLDOWN ${remaining}s`, "block");
        lastCooldownTextRef.current = now;
      }

      return;
    }

    lastFireRef.current = now;

    const worldMouseX = p.x + (mouse.current.x - window.innerWidth / 2);
    const worldMouseY = p.y + (mouse.current.y - window.innerHeight / 2);

    const angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    const speed = getEffectiveProjectileSpeed(p);
    const hasPiercing = p.piercingShots > 0;
    const hasShieldBreaker = (p.shieldBreakerShots || 0) > 0;
    const projectileDamage = getProjectileDamage(p);

    const projectile = {
      id: crypto.randomUUID(),
      ownerId: "player",
      ownerType: "player",
      skin: normalizeArenaSkin(p.skin || getSelectedUserSkin(user)),
      x: p.x,
      y: p.y,
      startX: p.x,
      startY: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      pierceLeft: hasPiercing ? 2 : 1,
      damage: projectileDamage,
      piercesShield: hasShieldBreaker,
    };

    projectilesRef.current = [...projectilesRef.current, projectile];

    const nextPlayer = {
      ...p,
      drones: nextDrones,
      progress: 0,
      nextDroneAt: getNextDroneAt(nextDrones),
      piercingShots: hasPiercing ? p.piercingShots - 1 : p.piercingShots,
      shieldBreakerShots: hasShieldBreaker ? Math.max(0, (p.shieldBreakerShots || 0) - 1) : p.shieldBreakerShots,
    };

    playerRef.current = nextPlayer;
    setPlayer(nextPlayer);
  };

  const fireBotDrone = (bot, target) => {
    const now = Date.now();

    if (!bot.alive || bot.drones <= 0) return bot;
    if (now - bot.lastFireAt < getEffectiveFireCooldown(bot, BOT_FIRE_COOLDOWN)) return bot;

    const angle = Math.atan2(target.y - bot.y, target.x - bot.x);
    const speed = getEffectiveProjectileSpeed(bot);
    const hasShieldBreaker = (bot.shieldBreakerShots || 0) > 0;
    const projectileDamage = getProjectileDamage(bot);

    const projectile = {
      id: crypto.randomUUID(),
      ownerId: bot.id,
      ownerType: "bot",
      skin: normalizeArenaSkin(bot.skin || "red"),
      x: bot.x,
      y: bot.y,
      startX: bot.x,
      startY: bot.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      pierceLeft: bot.piercingShots > 0 ? 2 : 1,
      damage: projectileDamage,
      piercesShield: hasShieldBreaker,
    };

    projectilesRef.current = [...projectilesRef.current, projectile];

    return {
      ...bot,
      drones: Math.max(0, bot.drones - 1),
      progress: 0,
      nextDroneAt: getNextDroneAt(Math.max(0, bot.drones - 1)),
      lastFireAt: now,
      piercingShots:
        bot.piercingShots > 0 ? bot.piercingShots - 1 : bot.piercingShots,
      shieldBreakerShots:
        hasShieldBreaker ? Math.max(0, (bot.shieldBreakerShots || 0) - 1) : bot.shieldBreakerShots,
      attacking: true,
      mouseX: target.x,
      mouseY: target.y,
    };
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setEffectTick(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let frames = 0;
    let lastTime = performance.now();
    let animation;

    const measure = () => {
      frames++;

      const now = performance.now();

      if (now - lastTime >= 1000) {
        setFps(frames);
        frames = 0;
        lastTime = now;
      }

      animation = requestAnimationFrame(measure);
    };

    measure();

    return () => cancelAnimationFrame(animation);
  }, []);

  useEffect(() => {
    const down = (e) => {
      keys.current[e.key.toLowerCase()] = true;
    };

    const up = (e) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    const moveMouse = (e) => {
      const nextMouse = { x: e.clientX, y: e.clientY };
      mouse.current = nextMouse;
      setMouseView(nextMouse);
    };

    const mouseDown = (e) => {
      if (e.button === 0) fireDrone();
      if (e.button === 2) activateShield();

      playerRef.current = {
        ...playerRef.current,
        attacking: true,
      };
    };

    const mouseUp = () => {
      playerRef.current = {
        ...playerRef.current,
        attacking: false,
      };
    };

    const preventContext = (e) => e.preventDefault();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", moveMouse);
    window.addEventListener("mousedown", mouseDown);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("contextmenu", preventContext);

    let animation;

    const loop = (now = performance.now()) => {
      const delta = Math.min(1.75, Math.max(0.35, (now - lastFrameTimeRef.current) / 16.67));
      lastFrameTimeRef.current = now;

      const p = playerRef.current;

      if (!p || gameOver) {
        animation = requestAnimationFrame(loop);
        return;
      }

      const isPlayerAlive = p.alive;

      const elapsedZoneTime = Date.now() - zoneStartTimeRef.current;
      const zoneProgress = Math.min(1, elapsedZoneTime / ZONE_SHRINK_DURATION);

      const currentZoneRadius =
        ZONE_START_RADIUS -
        (ZONE_START_RADIUS - ZONE_END_RADIUS) * zoneProgress;

      if (Math.abs(currentZoneRadius - safeZoneRadiusRef.current) > 8) {
        safeZoneRadiusRef.current = currentZoneRadius;
        setSafeZoneRadius(currentZoneRadius);
      }

      if (Date.now() - lastBotEnergyDrainRef.current >= 1000) {
        lastBotEnergyDrainRef.current = Date.now();

        let botEnergyChanged = false;

        const drainedBots = botsRef.current.map((bot) => {
          if (!bot.alive) return bot;

          const isBotMoving =
            bot.isMoving ||
            Math.abs(bot.vx || 0) > 0.02 ||
            Math.abs(bot.vy || 0) > 0.02;

          if (!isBotMoving) return bot;

          const nextEnergy = Math.max(
            0,
            (bot.energy ?? START_ENERGY) - ENERGY_DRAIN_AMOUNT
          );

          if (nextEnergy === (bot.energy ?? START_ENERGY)) return bot;

          botEnergyChanged = true;

          return {
            ...bot,
            energy: nextEnergy,
            alive: nextEnergy > 0,
            attacking: nextEnergy > 0 ? bot.attacking : false,
            shieldActive: nextEnergy > 0 ? bot.shieldActive : false,
            killStreak: nextEnergy > 0 ? bot.killStreak || 0 : 0,
            rapidFireUntil: nextEnergy > 0 ? bot.rapidFireUntil || 0 : 0,
            attackCooldownMultiplier: nextEnergy > 0 ? bot.attackCooldownMultiplier || 1 : 1,
          };
        });

        if (botEnergyChanged) {
          botsRef.current = drainedBots;
        }
      }

      applyZoneDamage(currentZoneRadius);

      let dx = 0;
      let dy = 0;
      const speed = PLAYER_SPEED;

      if (isPlayerAlive) {
        if (keys.current["w"]) dy -= 1;
        if (keys.current["s"]) dy += 1;
        if (keys.current["a"]) dx -= 1;
        if (keys.current["d"]) dx += 1;

        const mobileMove = mobileMoveRef.current;
        if (mobileMove.active) {
          dx += mobileMove.x;
          dy += mobileMove.y;
        }
      }

      const length = Math.hypot(dx, dy) || 1;

      const nextX = Math.max(
        VIEW_PADDING,
        Math.min(WORLD_WIDTH - VIEW_PADDING, p.x + (dx / length) * speed * delta)
      );

      const nextY = Math.max(
        VIEW_PADDING,
        Math.min(WORLD_HEIGHT - VIEW_PADDING, p.y + (dy / length) * speed * delta)
      );

      let collectedNow = 0;

      const aliveCountForOrbs =
        (playerRef.current?.alive ? 1 : 0) +
        botsRef.current.filter((bot) => bot.alive).length;

      const targetOrbCount = getDynamicOrbTarget(
        aliveCountForOrbs,
        currentZoneRadius
      );

      const beforeOrbCount = orbsRef.current.length;
      let removedUnsafeOrbs = false;

      const remainingOrbs = orbsRef.current.filter((orb) => {
        if (!isOrbInsideZone(orb, currentZoneRadius, 120)) {
          removedUnsafeOrbs = true;
          return false;
        }

        if (!isPlayerAlive) {
          return true;
        }

        if (Math.abs(orb.x - nextX) > 120 || Math.abs(orb.y - nextY) > 120) {
          return true;
        }

        const distance = Math.hypot(orb.x - nextX, orb.y - nextY);

        if (distance < 85) {
          collectedNow += 1;
          return false;
        }

        return true;
      });

      while (remainingOrbs.length < targetOrbCount) {
        remainingOrbs.push(createOrb(nextX, nextY, currentZoneRadius));
      }

      if (remainingOrbs.length > targetOrbCount) {
        remainingOrbs.length = targetOrbCount;
      }

      if (
        collectedNow > 0 ||
        removedUnsafeOrbs ||
        beforeOrbCount !== remainingOrbs.length ||
        orbsRef.current.length !== remainingOrbs.length
      ) {
        orbsRef.current = remainingOrbs;
      }

      const nowBotLogic = performance.now();

      const botLogicInterval = isMobileLandscape ? 28 : 20;

      if (nowBotLogic - lastBotLogicUpdateRef.current > botLogicInterval) {
        const botDelta = Math.min(
          isMobileLandscape ? 1.9 : 8,
          (nowBotLogic - lastBotLogicUpdateRef.current) / 16.67
        );

        lastBotLogicUpdateRef.current = nowBotLogic;

        const perfProfile = perfProfileRef.current;
        const aiBatches = perfProfile.aiBatches;
        const currentBatch = aiBatchIndexRef.current % aiBatches;
        aiBatchIndexRef.current += 1;

        let botsCollectedOrbs = false;

        const updatedBots = botsRef.current.map((bot, botIndex) => {
          if (!bot.alive) return bot;

          // IMPORTANT: pe device slab (aiBatches > 1), doar botii al carui
          // index modulo aiBatches se potriveste cu valul curent recalculeaza
          // decizia AI completa in acest tick. Restul boților continua sa se
          // miste lin pe ultima directie/viteza stabilita (vx/vy), folosind
          // applyBotMovement cu acelasi "move" ca inainte - nu ingheata, nu
          // sar vizual, doar nu re-evalueaza inca o data cine ataca / spre ce
          // orb se merge in acest tick exact. Pe device normal (aiBatches=1)
          // toti botii recalculeaza in fiecare tick, exact ca inainte.
          if (aiBatches > 1 && botIndex % aiBatches !== currentBatch) {
            return applyBotMovement(
              bot,
              { x: bot.vx || 0, y: bot.vy || 0 },
              botDelta,
              currentZoneRadius,
              1,
              {
                attacking: bot.attacking,
                state: bot.state,
                targetOrbId: bot.targetOrbId,
                targetEnemyId: bot.targetEnemyId,
                mouseX: bot.mouseX,
                mouseY: bot.mouseY,
              }
            );
          }

          const nowAi = performance.now();
          const zoneInfo = getZoneInfo(bot.x, bot.y, currentZoneRadius);
          const avoidance = getBotAvoidance(
            bot,
            botsRef.current,
            perfProfile.isLowEndDevice ? 190 : 300
          );
          const dangerRepulsion = getDangerMemoryRepulsion(bot, nowAi);
          let dangerMemory = dangerRepulsion.memory;

          const isZoneLocked = bot.escapeZoneUntil && nowAi < bot.escapeZoneUntil;

          if (zoneInfo.isInZone || zoneInfo.dangerDistance < 90) {
            dangerMemory = addZoneDangerMemory(bot, nowAi, currentZoneRadius);
          }

          const mustEscapeZone = zoneInfo.isInZone || isZoneLocked;

          if (mustEscapeZone) {
            const move = normalizeMove(
              zoneInfo.moveToCenterX * 7.5 +
                dangerRepulsion.dangerX * 3.5 +
                avoidance.avoidX * 0.08,
              zoneInfo.moveToCenterY * 7.5 +
                dangerRepulsion.dangerY * 3.5 +
                avoidance.avoidY * 0.08
            );

            const rawBot = applyBotMovement(
              { ...bot, dangerMemory },
              move,
              botDelta,
              currentZoneRadius,
              2.45,
              {
                attacking: false,
                targetOrbId: null,
                targetEnemyId: null,
                state: "escape-zone-smart",
              }
            );

            const nextZoneInfo = getZoneInfo(rawBot.x, rawBot.y, currentZoneRadius);

            return {
              ...rawBot,
              escapeZoneUntil:
                !nextZoneInfo.isInZone && nextZoneInfo.dangerDistance > 720
                  ? 0
                  : nowAi + 1600,
              dangerMemory,
            };
          }

          if (zoneInfo.dangerDistance < BOT_ZONE_EDGE_BUFFER) {
            const move = normalizeMove(
              zoneInfo.moveToCenterX * 3.6 +
                dangerRepulsion.dangerX * 2.4 +
                avoidance.avoidX * 0.25,
              zoneInfo.moveToCenterY * 3.6 +
                dangerRepulsion.dangerY * 2.4 +
                avoidance.avoidY * 0.25
            );

            return applyBotMovement(
              { ...bot, dangerMemory },
              move,
              botDelta,
              currentZoneRadius,
              1.55,
              {
                attacking: false,
                targetOrbId: null,
                targetEnemyId: null,
                state: "avoid-learned-zone",
                escapeZoneUntil: nowAi + 650,
                dangerMemory,
              }
            );
          }

          const enemyTarget = findBotEnemy(
            bot,
            playerRef.current,
            botsRef.current
          );

          const desiredStock = bot.desiredDroneStock || BOT_FARM_UNTIL_DRONES;
          const botPower = getBotPower(bot) * (bot.aiCourage || 1);
          const enemyPower = enemyTarget ? getBotPower(enemyTarget) : 0;
          const hasDroneAdvantage =
            enemyTarget && bot.drones >= enemyTarget.drones + 1;
          const enemyWeak =
            enemyTarget && (enemyTarget.hp <= 55 || enemyTarget.drones <= 1);
          const beingThreatened =
            enemyTarget &&
            enemyTarget.distance < 520 &&
            enemyPower > botPower * 0.85;

          const shouldKeepFarming =
            bot.drones < desiredStock &&
            !beingThreatened &&
            !(enemyWeak && bot.drones >= 1);

          const shouldFlee =
            enemyTarget &&
            (bot.hp <= BOT_LOW_HP || enemyPower > botPower * 1.35) &&
            !hasDroneAdvantage;

          const shouldAttack =
            enemyTarget &&
            !shouldKeepFarming &&
            !shouldFlee &&
            bot.drones >= 1 &&
            enemyTarget.distance < BOT_ATTACK_RANGE &&
            (hasDroneAdvantage ||
              enemyWeak ||
              bot.drones >= enemyTarget.drones ||
              botPower >= enemyPower * 0.95);

          if (enemyTarget && (shouldAttack || shouldFlee || beingThreatened)) {
            const angle = Math.atan2(
              enemyTarget.y - bot.y,
              enemyTarget.x - bot.x
            );

            const preferredRange = bot.preferredRange || BOT_SAFE_DISTANCE;
            let desiredMoveX = 0;
            let desiredMoveY = 0;

            if (shouldFlee || beingThreatened) {
              desiredMoveX = Math.cos(angle + Math.PI);
              desiredMoveY = Math.sin(angle + Math.PI);
            } else if (enemyTarget.distance > preferredRange + 120) {
              desiredMoveX = Math.cos(angle);
              desiredMoveY = Math.sin(angle);
            } else if (enemyTarget.distance < preferredRange - 150) {
              desiredMoveX = Math.cos(angle + Math.PI);
              desiredMoveY = Math.sin(angle + Math.PI);
            } else {
              const strafeDir = bot.id.charCodeAt(bot.id.length - 1) % 2 === 0 ? 1 : -1;
              desiredMoveX = Math.cos(angle + (Math.PI / 2) * strafeDir);
              desiredMoveY = Math.sin(angle + (Math.PI / 2) * strafeDir);
            }

            const centerPressure = getCenterPressureMove(bot, currentZoneRadius, 1.7);
            const move = normalizeMove(
              desiredMoveX +
                avoidance.avoidX * 0.65 +
                dangerRepulsion.dangerX * 1.8 +
                centerPressure.x,
              desiredMoveY +
                avoidance.avoidY * 0.65 +
                dangerRepulsion.dangerY * 1.8 +
                centerPressure.y
            );

            let combatBot = applyBotMovement(
              { ...bot, dangerMemory },
              move,
              botDelta,
              currentZoneRadius,
              shouldAttack ? 1.1 : 1.28,
              {
                attacking: shouldAttack,
                state: shouldFlee || beingThreatened ? "defend-flee" : "attack-strafe",
                targetEnemyId: enemyTarget.id,
                mouseX: enemyTarget.x,
                mouseY: enemyTarget.y,
                dangerMemory,
              }
            );

            if (shouldAttack) {
              combatBot = fireBotDrone(combatBot, enemyTarget);
            }

            return combatBot;
          }

          const botEnergy = bot.energy ?? START_ENERGY;
          const targetEnergyCell =
            botEnergy <= 65
              ? findClosestEnergyCellForBot(
                  bot,
                  energyCellsRef.current,
                  currentZoneRadius,
                  nowAi
                )
              : null;

          if (targetEnergyCell) {
            const dxEnergy = targetEnergyCell.x - bot.x;
            const dyEnergy = targetEnergyCell.y - bot.y;
            const energyDistance = Math.hypot(dxEnergy, dyEnergy) || 1;
            const centerPressure = getCenterPressureMove(bot, currentZoneRadius, 1.2);

            const move = normalizeMove(
              dxEnergy / energyDistance +
                avoidance.avoidX * 0.55 +
                dangerRepulsion.dangerX * 1.85 +
                centerPressure.x,
              dyEnergy / energyDistance +
                avoidance.avoidY * 0.55 +
                dangerRepulsion.dangerY * 1.85 +
                centerPressure.y
            );

            return applyBotMovement(
              { ...bot, dangerMemory },
              move,
              botDelta,
              currentZoneRadius,
              botEnergy <= 25 ? 1.18 : 1.08,
              {
                state: "energy",
                targetEnergyCellId: targetEnergyCell.id,
                targetOrbId: null,
                targetEnemyId: null,
                mouseX: targetEnergyCell.x,
                mouseY: targetEnergyCell.y,
                dangerMemory,
              }
            );
          }

          const targetCore = findClosestCoreForBot(
            bot,
            coresRef.current,
            currentZoneRadius
          );

          if (targetCore) {
            const dxCore = targetCore.x - bot.x;
            const dyCore = targetCore.y - bot.y;
            const coreDistance = Math.hypot(dxCore, dyCore) || 1;
            const centerPressure = getCenterPressureMove(bot, currentZoneRadius, 1.25);

            const move = normalizeMove(
              dxCore / coreDistance +
                avoidance.avoidX * 0.55 +
                dangerRepulsion.dangerX * 1.65 +
                centerPressure.x,
              dyCore / coreDistance +
                avoidance.avoidY * 0.55 +
                dangerRepulsion.dangerY * 1.65 +
                centerPressure.y
            );

            return applyBotMovement(
              { ...bot, dangerMemory },
              move,
              botDelta,
              currentZoneRadius,
              1.08,
              {
                attacking: false,
                targetOrbId: null,
                targetEnemyId: null,
                state: "collect-core",
                mouseX: targetCore.x,
                mouseY: targetCore.y,
                dangerMemory,
              }
            );
          }

          let targetOrb = null;

          if (bot.targetOrbId) {
            targetOrb = orbsRef.current.find((orb) => orb.id === bot.targetOrbId);

            if (
              targetOrb &&
              !isPointSafeFromZone(targetOrb.x, targetOrb.y, currentZoneRadius, BOT_ZONE_EDGE_BUFFER)
            ) {
              targetOrb = null;
            }
          }

          if (!targetOrb) {
            targetOrb = findClosestOrbForBot(bot, orbsRef.current, currentZoneRadius, nowAi);
          }

          if (!targetOrb) {
            const centerPressure = getCenterPressureMove(bot, currentZoneRadius, 2.2);
            const wanderAngle =
              bot.aiPlanUntil && nowAi < bot.aiPlanUntil
                ? bot.aiWanderAngle || 0
                : Math.random() * Math.PI * 2;

            const move = normalizeMove(
              Math.cos(wanderAngle) * 0.45 +
                centerPressure.x +
                avoidance.avoidX * 0.75 +
                dangerRepulsion.dangerX * 1.8,
              Math.sin(wanderAngle) * 0.45 +
                centerPressure.y +
                avoidance.avoidY * 0.75 +
                dangerRepulsion.dangerY * 1.8
            );

            return applyBotMovement(
              { ...bot, dangerMemory },
              move,
              botDelta,
              currentZoneRadius,
              0.95,
              {
                attacking: false,
                state: "search-safe-orbs",
                targetOrbId: null,
                aiWanderAngle: wanderAngle,
                aiPlanUntil: nowAi + 900,
                dangerMemory,
              }
            );
          }

          const dxBot = targetOrb.x - bot.x;
          const dyBot = targetOrb.y - bot.y;
          const distance = Math.hypot(dxBot, dyBot) || 1;
          const centerPressure = getCenterPressureMove(bot, currentZoneRadius, 1.2);

          const move = normalizeMove(
            dxBot / distance +
              avoidance.avoidX * 0.65 +
              dangerRepulsion.dangerX * 1.7 +
              centerPressure.x,
            dyBot / distance +
              avoidance.avoidY * 0.65 +
              dangerRepulsion.dangerY * 1.7 +
              centerPressure.y
          );

          const movedBot = applyBotMovement(
            { ...bot, dangerMemory },
            move,
            botDelta,
            currentZoneRadius,
            bot.drones < desiredStock ? 1.12 : 0.98,
            {
              attacking: false,
              targetOrbId: targetOrb.id,
              state: bot.drones < desiredStock ? "stockpile-drones" : "farm-extra",
              dangerMemory,
            }
          );

          let collected = 0;
          const collectedOrb = findBotCollectedOrb(
            bot,
            movedBot,
            orbsRef.current,
            currentZoneRadius
          );

          if (collectedOrb) {
            collected = 1;
            botsCollectedOrbs = true;

            orbsRef.current = orbsRef.current.filter(
              (orb) => orb.id !== collectedOrb.id
            );

            const aliveCountForBotOrbs =
              (playerRef.current?.alive ? 1 : 0) +
              botsRef.current.filter((aliveBot) => aliveBot.alive).length;
            const targetOrbCountForBots = getDynamicOrbTarget(
              aliveCountForBotOrbs,
              currentZoneRadius
            );

            orbsRef.current = orbsRef.current.filter((orb) =>
              isOrbInsideZone(orb, currentZoneRadius, 120)
            );

            while (orbsRef.current.length < targetOrbCountForBots) {
              orbsRef.current.push(
                createOrb(movedBot.x, movedBot.y, currentZoneRadius)
              );
            }

            if (orbsRef.current.length > targetOrbCountForBots) {
              orbsRef.current.length = targetOrbCountForBots;
            }
          }

          let progress = movedBot.progress + collected;
          let drones = movedBot.drones;
          let nextDroneAt = movedBot.nextDroneAt;

          while (progress >= nextDroneAt && drones < MAX_DRONES) {
            drones += 1;
            progress = 0;
            nextDroneAt = getNextDroneAt(drones);
          }

          if (drones >= MAX_DRONES) {
            progress = 0;
            nextDroneAt = getNextDroneAt(MAX_DRONES - 1);
          }

          return {
            ...movedBot,
            targetOrbId: collected ? null : targetOrb.id,
            progress,
            nextDroneAt,
            drones,
            totalCollected: movedBot.totalCollected + collected,
            mass: 1250 + (movedBot.totalCollected + collected) * 10,
            mouseX: movedBot.x + movedBot.moveX * 200,
            mouseY: movedBot.y + movedBot.moveY * 200,
          };
        });

        let botsCollectedExtraOrbs = false;
        let orbsAfterBotSweep = [...orbsRef.current];

        const botsAfterOrbSweep = updatedBots.map((bot) => {
          if (!bot.alive || orbsAfterBotSweep.length === 0) return bot;

          const orbToCollect = orbsAfterBotSweep.find((orb) => {
            if (!isOrbInsideZone(orb, currentZoneRadius, 120)) return false;
            return Math.hypot(orb.x - bot.x, orb.y - bot.y) < 125;
          });

          if (!orbToCollect) return bot;

          botsCollectedExtraOrbs = true;
          orbsAfterBotSweep = orbsAfterBotSweep.filter(
            (orb) => orb.id !== orbToCollect.id
          );

          let progress = (bot.progress || 0) + 1;
          let drones = bot.drones || 0;
          let nextDroneAt = bot.nextDroneAt || getNextDroneAt(drones);

          while (progress >= nextDroneAt && drones < MAX_DRONES) {
            drones += 1;
            progress = 0;
            nextDroneAt = getNextDroneAt(drones);
          }

          if (drones >= MAX_DRONES) {
            progress = 0;
            nextDroneAt = getNextDroneAt(MAX_DRONES - 1);
          }

          const totalCollected = (bot.totalCollected || 0) + 1;

          return {
            ...bot,
            progress,
            drones,
            nextDroneAt,
            totalCollected,
            mass: 1250 + totalCollected * 10,
            targetOrbId: null,
          };
        });

        if (botsCollectedExtraOrbs) {
          const aliveCountForBotOrbs =
            (playerRef.current?.alive ? 1 : 0) +
            botsAfterOrbSweep.filter((aliveBot) => aliveBot.alive).length;
          const targetOrbCountForBotSweep = getDynamicOrbTarget(
            aliveCountForBotOrbs,
            currentZoneRadius
          );

          orbsAfterBotSweep = orbsAfterBotSweep.filter((orb) =>
            isOrbInsideZone(orb, currentZoneRadius, 120)
          );

          while (orbsAfterBotSweep.length < targetOrbCountForBotSweep) {
            const spawnBot = botsAfterOrbSweep.find((bot) => bot.alive) || playerRef.current;
            orbsAfterBotSweep.push(
              createOrb(spawnBot?.x, spawnBot?.y, currentZoneRadius)
            );
          }

          if (orbsAfterBotSweep.length > targetOrbCountForBotSweep) {
            orbsAfterBotSweep.length = targetOrbCountForBotSweep;
          }

          orbsRef.current = orbsAfterBotSweep;
        }

        let botsCollectedEnergy = false;
        let energyAfterBotCollection = [...energyCellsRef.current];

        const botsAfterEnergySweep = botsAfterOrbSweep.map((bot, index) => {
          if (!bot.alive || energyAfterBotCollection.length === 0) return bot;

          const botBeforeMove = botsRef.current[index] || bot;
          const collectedCell = findBotCollectedEnergyCell(
            botBeforeMove,
            bot,
            energyAfterBotCollection,
            currentZoneRadius
          );

          if (!collectedCell) return bot;

          botsCollectedEnergy = true;
          energyAfterBotCollection = energyAfterBotCollection.filter(
            (cell) => cell.id !== collectedCell.id
          );

          createDamageText(bot.x, bot.y - 92, "ENERGY 100", "heal");

          return {
            ...bot,
            energy: START_ENERGY,
            targetEnergyCellId: null,
          };
        });

        if (botsCollectedEnergy) {
          const aliveCountForBotEnergy =
            (playerRef.current?.alive ? 1 : 0) +
            botsAfterEnergySweep.filter((aliveBot) => aliveBot.alive).length;

          const targetEnergyCountForBotSweep = getDynamicEnergyTarget(
            aliveCountForBotEnergy,
            currentZoneRadius
          );

          energyAfterBotCollection = energyAfterBotCollection.filter((cell) =>
            isEnergyInsideZone(cell, currentZoneRadius, 120)
          );

          while (energyAfterBotCollection.length < targetEnergyCountForBotSweep) {
            const spawnBot = botsAfterEnergySweep.find((bot) => bot.alive) || playerRef.current;
            energyAfterBotCollection.push(
              createEnergyCell(spawnBot?.x, spawnBot?.y, currentZoneRadius)
            );
          }

          if (energyAfterBotCollection.length > targetEnergyCountForBotSweep) {
            energyAfterBotCollection.length = targetEnergyCountForBotSweep;
          }

          energyCellsRef.current = energyAfterBotCollection;
        }

        let botsCollectedCores = false;
        let coresAfterBotCollection = [...coresRef.current];

        const botsAfterCoreCollection = botsAfterEnergySweep.map((bot) => {
          if (!bot.alive || coresAfterBotCollection.length === 0) return bot;

          const coreToCollect = coresAfterBotCollection.find((core) => {
            if (!isCoreInsideZone(core, currentZoneRadius, 420)) return false;
            if (!canUnitUseCore(bot, core)) return false;

            return Math.hypot(core.x - bot.x, core.y - bot.y) < CORE_COLLECT_DISTANCE + 55;
          });

          if (!coreToCollect) return bot;

          const result = applyCoreToBotStats(bot, coreToCollect);

          if (!result.collected) return bot;

          botsCollectedCores = true;
          coresAfterBotCollection = coresAfterBotCollection.filter(
            (core) => core.id !== coreToCollect.id
          );

          createExplosion(coreToCollect.x, coreToCollect.y, "shield");
          createDamageText(
            bot.x,
            bot.y - 110,
            getCoreFloatingText(coreToCollect.type),
            "heal"
          );

          return result.bot;
        });

        if (botsCollectedCores) {
          coresRef.current = coresAfterBotCollection;

          if (coresAfterBotCollection.length === 0) {
            scheduleNextCoreWave();
          }
        }

        botsRef.current = botsAfterCoreCollection;

        if (botsCollectedOrbs || botsCollectedExtraOrbs) {
          // orbsRef.current deja actualizat mai sus (orbsAfterBotSweep) -
          // nu mai e nevoie de alt setOrbs aici, pixiLiveRef citeste din
          // orbsRef.current la finalul frame-ului curent.
        }
      }

      let collectedEnergy = false;
      let removedUnsafeEnergy = false;
      const beforeEnergyCount = energyCellsRef.current.length;

      const targetEnergyCount = getDynamicEnergyTarget(
        aliveCountForOrbs,
        currentZoneRadius
      );

      const remainingEnergyCells = energyCellsRef.current.filter((cell) => {
        if (!isEnergyInsideZone(cell, currentZoneRadius, 120)) {
          removedUnsafeEnergy = true;
          return false;
        }

        if (!isPlayerAlive) {
          return true;
        }

        if (Math.abs(cell.x - nextX) > 130 || Math.abs(cell.y - nextY) > 130) {
          return true;
        }

        const distance = Math.hypot(cell.x - nextX, cell.y - nextY);

        if (distance < ENERGY_CELL_COLLECT_DISTANCE) {
          collectedEnergy = true;
          return false;
        }

        return true;
      });

      while (remainingEnergyCells.length < targetEnergyCount) {
        remainingEnergyCells.push(createEnergyCell(nextX, nextY, currentZoneRadius));
      }

      if (remainingEnergyCells.length > targetEnergyCount) {
        remainingEnergyCells.length = targetEnergyCount;
      }

      if (
        collectedEnergy ||
        removedUnsafeEnergy ||
        beforeEnergyCount !== remainingEnergyCells.length ||
        energyCellsRef.current.length !== remainingEnergyCells.length
      ) {
        energyCellsRef.current = remainingEnergyCells;

        if (collectedEnergy) {
          createDamageText(nextX, nextY - 100, "ENERGY FULL", "heal");
        }
      }

      let coresChangedByZone = false;
      let coresCollectedByPlayer = false;

      const safeCores = coresRef.current.map((core) => {
        if (isCoreInsideZone(core, currentZoneRadius, 420)) {
          return core;
        }

        coresChangedByZone = true;

        return createSafeCoreReplacement(currentZoneRadius);
      });

      const remainingCores = safeCores.filter((core) => {
        if (!isPlayerAlive) return true;

        const distance = Math.hypot(core.x - nextX, core.y - nextY);

        if (distance < CORE_COLLECT_DISTANCE) {
          applyCore(core);
          createExplosion(core.x, core.y, "shield");
          coresCollectedByPlayer = true;
          return false;
        }

        return true;
      });

      if (
        coresChangedByZone ||
        coresCollectedByPlayer ||
        remainingCores.length !== coresRef.current.length
      ) {
        coresRef.current = remainingCores;

        if (coresCollectedByPlayer && remainingCores.length === 0) {
          scheduleNextCoreWave();
        }
      }

      let totalCollected = p.totalCollected + collectedNow;
      let progress = p.progress + collectedNow;

      let drones = p.drones;
      let nextDroneAt = p.nextDroneAt;

      while (progress >= nextDroneAt && drones < MAX_DRONES) {
        drones += 1;
        progress = 0;
        nextDroneAt = getNextDroneAt(drones);
      }

      if (drones >= MAX_DRONES) {
        progress = 0;
        nextDroneAt = getNextDroneAt(MAX_DRONES - 1);
      }

      const nextPlayer = {
        ...playerRef.current,
        x: nextX,
        y: nextY,
        mouseX: mouse.current.x,
        mouseY: mouse.current.y,
        moveX: dx,
        moveY: dy,
        moveAngle:
          dx !== 0 || dy !== 0
            ? Math.atan2(dy, dx)
            : p.moveAngle || -Math.PI / 2,
        isMoving: dx !== 0 || dy !== 0,
        totalCollected,
        progress,
        nextDroneAt,
        drones: Math.min(drones, MAX_DRONES),
        energy: collectedEnergy ? START_ENERGY : playerRef.current.energy,
        mass: 1250 + totalCollected * 10,
      };

      playerRef.current = nextPlayer;

      const updatedProjectiles = [];

      for (const projectile of projectilesRef.current) {
        const movedProjectile = {
          ...projectile,
          x: projectile.x + projectile.vx * delta,
          y: projectile.y + projectile.vy * delta,
        };

        const traveled = Math.hypot(
          movedProjectile.x - movedProjectile.startX,
          movedProjectile.y - movedProjectile.startY
        );

        const hitResult = checkProjectileHit(movedProjectile);

        if (hitResult.keep && traveled < PROJECTILE_MAX_DISTANCE) {
          updatedProjectiles.push(hitResult.projectile || movedProjectile);
        }
      }

      projectilesRef.current = updatedProjectiles;

      checkBotsTouchPlayer();

      // Pe device slab, coliziunile bot-cu-bot (O(n^2) = ~2300 perechi la 69
      // boti) ruleaza o data la 2 frame-uri rAF in loc de la fiecare frame
      // (60Hz -> ~30Hz pentru aceasta verificare specifica). Cooldown-ul per
      // pereche (BODY_COLLISION_COOLDOWN, 650ms) deja previne procesarea
      // repetata a aceleiasi coliziuni, asa ca verificarea mai rara nu pierde
      // coliziuni reale - doar reduce costul CPU per frame pe device slab.
      collisionFrameSkipRef.current += 1;

      if (
        !perfProfileRef.current.isLowEndDevice ||
        collisionFrameSkipRef.current % 2 === 0
      ) {
        checkBotsTouchBots();
      }

      checkBattleRoyaleWinner();

      // ---------------------------------------------------------------
      // IMPORTANT: construim pixiLiveRef.current AICI, la fiecare frame rAF
      // (60fps), citind direct din refs (playerRef/botsRef/orbsRef/etc),
      // NU din React state (player/bots/orbs). Asta e identic ca logica
      // din useMemo-urile visibleOrbs/fullRenderBots/etc de mai sus in
      // fisier, dar fara sa treaca prin React deloc - PixiArenaRenderer
      // citeste asta direct prin liveDataRef, complet decuplat de ciclul
      // de render React. Camera (viewTarget) se calculeaza tot din refs,
      // ca sa nu inghete intre sincronizarile HUD throttled.
      // ---------------------------------------------------------------
      const liveAliveBots = botsRef.current.filter((bot) => bot.alive);

      const liveSpectatorTarget = !p.alive
        ? liveAliveBots.find((bot) => bot.id === spectatorTargetId) ||
          liveAliveBots[0] ||
          p
        : p;

      const liveViewTarget = liveSpectatorTarget || p;
      const liveStatusUnit = p.alive ? p : liveViewTarget;

      const liveCameraX = viewportSize.width / 2 - liveViewTarget.x * mobileWorldScale;
      const liveCameraY = viewportSize.height / 2 - liveViewTarget.y * mobileWorldScale;

      const liveVisibleOrbs = orbsRef.current
        .filter((orb) => {
          return (
            Math.abs(orb.x - liveViewTarget.x) < mobileViewDistance &&
            Math.abs(orb.y - liveViewTarget.y) < mobileViewDistance
          );
        })
        .slice(0, isMobileLandscape ? 72 : 180);

      const liveVisibleEnergyCells = energyCellsRef.current
        .filter((cell) => {
          return (
            Math.abs(cell.x - liveViewTarget.x) < mobileViewDistance &&
            Math.abs(cell.y - liveViewTarget.y) < mobileViewDistance
          );
        })
        .slice(0, isMobileLandscape ? 36 : 110);

      const liveVisibleCores = coresRef.current.filter((core) => {
        return (
          Math.abs(core.x - liveViewTarget.x) < mobileViewDistance &&
          Math.abs(core.y - liveViewTarget.y) < mobileViewDistance
        );
      });

      const liveVisibleProjectiles = projectilesRef.current
        .filter((projectile) => {
          return (
            Math.abs(projectile.x - liveViewTarget.x) < mobileProjectileDistance &&
            Math.abs(projectile.y - liveViewTarget.y) < mobileProjectileDistance
          );
        })
        .sort((a, b) => {
          const da = Math.hypot(a.x - liveViewTarget.x, a.y - liveViewTarget.y);
          const db = Math.hypot(b.x - liveViewTarget.x, b.y - liveViewTarget.y);
          return da - db;
        });

      const liveFullProjectiles = liveVisibleProjectiles.slice(0, mobileFullProjectileLimit);
      const liveSimpleProjectiles = liveVisibleProjectiles.slice(
        mobileFullProjectileLimit,
        mobileFullProjectileLimit + mobileSimpleProjectileLimit
      );

      const liveVisibleBots = botsRef.current
        .filter((bot) => {
          return (
            bot.alive &&
            Math.abs(bot.x - liveViewTarget.x) < mobileBotRenderDistance &&
            Math.abs(bot.y - liveViewTarget.y) < mobileBotRenderDistance
          );
        })
        .sort((a, b) => {
          const da = Math.hypot(a.x - liveViewTarget.x, a.y - liveViewTarget.y);
          const db = Math.hypot(b.x - liveViewTarget.x, b.y - liveViewTarget.y);
          return da - db;
        });

      const liveFullRenderBots = liveVisibleBots.slice(0, mobileFullBotLimit);
      const liveFullRenderBotIds = new Set(liveFullRenderBots.map((bot) => bot.id));

      const liveSimpleRenderBots = botsRef.current.filter((bot) => {
        if (!bot.alive || liveFullRenderBotIds.has(bot.id)) return false;
        const distance = Math.hypot(bot.x - liveViewTarget.x, bot.y - liveViewTarget.y);
        return distance < mobileBotSimpleDistance;
      });

      pixiLiveRef.current = {
        player: liveStatusUnit?.alive !== false ? liveStatusUnit : null,
        bots: liveFullRenderBots,
        simpleBots: liveSimpleRenderBots,
        orbs: liveVisibleOrbs,
        energyCells: liveVisibleEnergyCells,
        cores: liveVisibleCores,
        projectiles: liveFullProjectiles,
        simpleProjectiles: liveSimpleProjectiles,
        cameraX: liveCameraX,
        cameraY: liveCameraY,
        scale: mobileWorldScale,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height,
        coreColorMap: coreColorMapForPixiRef.current,
        otherPlayerSize: 104,
        otherPlayerQuality: 2,
      };

      // ---------------------------------------------------------------
      // HUD throttling: React setState (player/bots/orbs/etc, folosite
      // pentru HP bar, energy bar, leaderboard, ORB COUNT) se actualizeaza
      // doar la HUD_SYNC_INTERVAL_MS (66ms = ~15fps pentru UI), NU la
      // fiecare frame rAF (60fps). Identic cu pattern-ul din
      // NormalPvpArena.jsx. Pixi (drona, boti, orbs vizuale) ramane la
      // 60fps prin pixiLiveRef de mai sus, complet independent de asta.
      // ---------------------------------------------------------------
      if (now - lastHudSyncRef.current >= HUD_SYNC_INTERVAL_MS) {
        lastHudSyncRef.current = now;

        setPlayer(p);
        setBots(botsRef.current);
        setOrbs(orbsRef.current);
        setEnergyCells(energyCellsRef.current);
        setCores(coresRef.current);
        setProjectiles(projectilesRef.current);
      }

      animation = requestAnimationFrame(loop);
    };

    lastFrameTimeRef.current = performance.now();
    loop(lastFrameTimeRef.current);

    return () => {
      cancelAnimationFrame(animation);

      if (shieldTimeoutRef.current) {
        clearTimeout(shieldTimeoutRef.current);
      }

      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", moveMouse);
      window.removeEventListener("mousedown", mouseDown);
      window.removeEventListener("mouseup", mouseUp);
      window.removeEventListener("contextmenu", preventContext);
    };
  }, [gameOver, isMobileLandscape]);

  const applyMobileJoystickFromPointer = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = e.clientX - centerX;
    const rawY = e.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const angle = distance > 0 ? Math.atan2(rawY, rawX) : 0;

    const maxRadius = rect.width * 0.42;
    const limited = Math.min(distance, maxRadius);
    const knobX = distance > 0 ? Math.cos(angle) * limited : 0;
    const knobY = distance > 0 ? Math.sin(angle) * limited : 0;

    const deadZonePx = Math.max(5, maxRadius * 0.045);
    const fullSpeedAt = Math.max(deadZonePx + 1, maxRadius * 0.16);
    let power = 0;

    if (distance > deadZonePx) {
      const normalized = Math.min(1, (distance - deadZonePx) / (fullSpeedAt - deadZonePx));
      power = distance >= fullSpeedAt ? 1 : Math.pow(normalized, 0.35);
    }

    const moveX = distance > deadZonePx ? Math.cos(angle) * power : 0;
    const moveY = distance > deadZonePx ? Math.sin(angle) * power : 0;

    mobileMoveRef.current = {
      x: moveX,
      y: moveY,
      active: power > 0.02,
    };

    setMobileJoystick({ x: knobX, y: knobY, active: power > 0.02 });
  };

  const handleJoystickStart = (e) => {
    if (!playerRef.current?.alive || gameOver) return;

    e.preventDefault();
    e.stopPropagation();

    const pointer = e.pointerId ?? 1;
    joystickPointerRef.current = pointer;

    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(pointer);
    }

    applyMobileJoystickFromPointer(e);
  };

  const handleJoystickMove = (e) => {
    if (joystickPointerRef.current !== null && e.pointerId !== joystickPointerRef.current) return;
    if (!mobileMoveRef.current.active && joystickPointerRef.current === null) return;

    applyMobileJoystickFromPointer(e);
  };

  const handleJoystickEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (joystickPointerRef.current !== null && e.pointerId !== joystickPointerRef.current) return;

    if (e.currentTarget.releasePointerCapture && joystickPointerRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(joystickPointerRef.current);
      } catch {}
    }

    joystickPointerRef.current = null;
    mobileMoveRef.current = { x: 0, y: 0, active: false };
    setMobileJoystick({ x: 0, y: 0, active: false });
  };

  const statusUnit = player.alive ? player : viewTarget;
  const activeEffectBadges = getActiveEffectBadges(statusUnit, effectTick);
  const miniMapOrbsForRender = useMemo(() => {
    if (!isMobileLike) return orbs;

    const maxMiniMapOrbs = isMobileLandscape ? 130 : 240;
    const step = Math.max(1, Math.ceil(orbs.length / maxMiniMapOrbs));

    return orbs.filter((_, index) => index % step === 0).slice(0, maxMiniMapOrbs);
  }, [orbs, isMobileLike, isMobileLandscape]);
  const cameraX = viewportSize.width / 2 - viewTarget.x * mobileWorldScale;
  const cameraY = viewportSize.height / 2 - viewTarget.y * mobileWorldScale;

  // Countdown text pentru cat timp mai are zona pana se strange complet -
  // util pentru HUD ("Zone closes in: MM:SS"), cerinta explicita de 10 minute.
  const zoneRemainingMs = Math.max(
    0,
    ZONE_SHRINK_DURATION - (Date.now() - zoneStartTimeRef.current)
  );
  const zoneRemainingMinutes = Math.floor(zoneRemainingMs / 60000);
  const zoneRemainingSeconds = Math.floor((zoneRemainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <div
      className={`game-arena battle-royale-arena ${isMobileLike ? "is-mobile" : ""} ${
        isMobileLandscape ? "is-mobile-landscape" : ""
      } ${isMobilePortrait ? "is-mobile-portrait" : ""}`}
    >
      <div className="arena-vignette" />

      <div
        className="fps-counter"
        style={{
          color: fps >= 58 ? "#67ffb1" : fps >= 40 ? "#ffd447" : "#ff5b5b",
        }}
      >
        FPS: {fps}
      </div>

      <div className="alive-counter">
        PLAYERS ALIVE: {alivePlayersCount}
      </div>

      <div className="battle-royale-zone-timer">
        ZONE CLOSES IN: {zoneRemainingMinutes}:{zoneRemainingSeconds}
      </div>

      {coreNotice && (
        <div
          className={`core-notice core-notice-${coreNotice.type} core-notice-top ${
            coreNotice.countdown ? "core-notice-countdown" : ""
          }`}
          style={{
            position: "fixed",
            top: "92px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            textAlign: "center",
            animation: "coreNoticePop 0.45s ease-out",
          }}
        >
          <strong>{coreNotice.title}</strong>
          {coreNotice.countdown ? (
            <>
              <b>{coreNotice.countdown}</b>
              <span>Unique power cores entering the arena.</span>
            </>
          ) : (
            <span>{coreNotice.message}</span>
          )}
        </div>
      )}

      {!player.alive && !gameOver && (
        <div
          className="spectator-panel"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "32px",
            transform: "translateX(-50%)",
            zIndex: 10000,
            minWidth: "360px",
            padding: "16px 22px",
            borderRadius: "18px",
            background: "rgba(2, 8, 18, 0.88)",
            border: "1px solid rgba(0, 234, 255, 0.55)",
            boxShadow: "0 0 26px rgba(0, 234, 255, 0.25)",
            color: "#dffcff",
            textAlign: "center",
            backdropFilter: "blur(10px)",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#00eaff",
              fontSize: "18px",
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            SPECTATOR MODE
          </strong>

          <span style={{ display: "block", marginBottom: "8px" }}>
            Urmaresti: {viewTarget?.username || "jucator random"}
          </span>

          {matchSummary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                margin: "10px 0 14px",
                fontSize: "14px",
              }}
            >
              <span>Locul tau: #{matchSummary.placement} / {matchSummary.totalPlayers}</span>
              <span>Kills: {matchSummary.kills}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onExitToMenu}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "1px solid rgba(0, 234, 255, 0.7)",
              background: "rgba(0, 234, 255, 0.12)",
              color: "#ffffff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            BACK TO MENU
          </button>
        </div>
      )}

      {gameOver && (
        <div className="game-over-screen">
          <h1>{winner === player.username ? "AI CASTIGAT" : "AI PIERDUT"}</h1>

          {matchSummary ? (
            <div className="match-summary">
              <p>
                Locul tau: #{matchSummary.placement} /{" "}
                {matchSummary.totalPlayers}
              </p>
              <p>Kills: {matchSummary.kills}</p>
              <p>Castigator: {matchSummary.winner}</p>
            </div>
          ) : (
            <p>Drona ta a fost distrusa.</p>
          )}

          <span>Revenire la meniu...</span>
        </div>
      )}

      <div className="hp-panel">
        <span>{player.alive ? "DRONE HP" : "SPECTATED HP"}</span>
        <strong>
          {statusUnit.hp} / {statusUnit.maxHp || START_HP}
        </strong>
        <div className="hp-bar">
          <i
            style={{
              width: `${(statusUnit.hp / (statusUnit.maxHp || START_HP)) * 100}%`,
            }}
          />
        </div>

        <div className="energy-row">
          <span>{player.alive ? "DRONE ENERGY" : statusUnit.username}</span>
          <strong>{player.alive ? player.energy ?? START_ENERGY : `${statusUnit.drones || 0} drones`}</strong>
          <div className="energy-bar">
            <i
              style={{
                width: player.alive
                  ? `${player.energy ?? START_ENERGY}%`
                  : `${Math.min(100, ((statusUnit.drones || 0) / MAX_DRONES) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="collect-counter">
        <span>
          {player.alive ? "ORB COUNT" : `SPECTATING: ${statusUnit?.username || "BOT"}`}
        </span>
        <strong>
          {statusUnit?.drones >= MAX_DRONES
            ? "MAX"
            : `${statusUnit?.progress || 0} / ${statusUnit?.nextDroneAt || getNextDroneAt(statusUnit?.drones || 0)}`}
        </strong>
        <small>Total collected: {statusUnit?.totalCollected || 0}</small>
        <small>Kills: {statusUnit?.kills || 0}</small>

        <div className="active-effects-panel">
          <span className="active-effects-title">ACTIVE CORES</span>

          {activeEffectBadges.length > 0 ? (
            activeEffectBadges.map((effect) => (
              <div
                key={effect.key}
                className={`active-effect active-effect-${effect.className}`}
              >
                <b>{effect.label}</b>
                <em>{effect.seconds !== null ? `${effect.seconds}s` : "READY"}</em>
              </div>
            ))
          ) : (
            <div className="active-effect active-effect-empty">
              <b>NO ACTIVE CORE</b>
              <em>--</em>
            </div>
          )}
        </div>
      </div>

      <div className="real-leaderboard">
        <h3>LEADERBOARD</h3>

        {leaderboardPlayers.map((item, index) => (
          <div
            key={item.id}
            className={`real-leaderboard-row ${item.isPlayer ? "is-me" : ""} ${
              !item.alive ? "is-dead" : ""
            }`}
          >
            <span>
              {index + 1}. {item.username}
            </span>

            <strong>{item.kills} kills</strong>
          </div>
        ))}
      </div>

      {(canFire && (!isMobileLandscape || mobileAttackAiming)) && (
        <svg className="aim-svg">
          <line
            className="aim-svg-line"
            x1={viewportSize.width / 2}
            y1={viewportSize.height / 2}
            x2={mouseView.x}
            y2={mouseView.y}
          />

          <circle
            className="aim-svg-circle"
            cx={mouseView.x}
            cy={mouseView.y}
            r="22"
          />

          <g
            className="aim-svg-arrow"
            transform={`translate(${mouseView.x}, ${mouseView.y}) rotate(${aimAngleDeg})`}
          >
            <path d="M 16 0 L -10 -10 L -4 0 L -10 10 Z" />
          </g>
        </svg>
      )}

      <div
        className="world"
        style={{
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          transform: `translate3d(${cameraX}px, ${cameraY}px, 0) scale(${mobileWorldScale})`,
        }}
      >
        <div
          className="toxic-overlay"
          style={{
            "--zone-x": `${WORLD_WIDTH / 2}px`,
            "--zone-y": `${WORLD_HEIGHT / 2}px`,
            "--zone-radius": `${safeZoneRadius}px`,
          }}
        />

        {explosions.map((explosion) => (
          <div
            key={explosion.id}
            className={`drone-explosion explosion-${explosion.type}`}
            style={{
              left: explosion.x,
              top: explosion.y,
            }}
          >
            <span />
            <i />
            <b />
          </div>
        ))}

        {damageTexts.map((item) => (
          <div
            key={item.id}
            className={`damage-text damage-${item.type}`}
            style={{
              left: item.x,
              top: item.y,
            }}
          >
            {item.text}
          </div>
        ))}

        {deathExplosion && (
          <div
            className="death-explosion"
            style={{
              left: deathExplosion.x,
              top: deathExplosion.y,
            }}
          >
            <span />
            <i />
            <b />
            <em />
            <strong />
          </div>
        )}
      </div>

      <PixiArenaRenderer
        player={statusUnit?.alive !== false ? statusUnit : null}
        bots={fullRenderBots}
        simpleBots={simpleRenderBots}
        orbs={visibleOrbs}
        energyCells={visibleEnergyCells}
        cores={visibleCores}
        projectiles={fullProjectiles}
        simpleProjectiles={simpleProjectiles}
        cameraX={cameraX}
        cameraY={cameraY}
        scale={mobileWorldScale}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        coreTypes={CORE_TYPES}
        otherPlayerSize={104}
        otherPlayerQuality={2}
        liveDataRef={pixiLiveRef}
        forceLowQuality={graphicsQuality === "low"}
      />

      {showMobileControls && (
        <div className="mobile-controls">
          <div
            className="mobile-joystick"
            onPointerDown={handleJoystickStart}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickEnd}
            onPointerCancel={handleJoystickEnd}
          >
            <div
              className="mobile-joystick-knob"
              style={{
                transform: `translate(${mobileJoystick.x}px, ${mobileJoystick.y}px)`,
                transition: mobileJoystick.active ? "none" : "transform 0.12s ease-out",
              }}
            />
          </div>

          <div className="mobile-action-row">
            <button
              type="button"
              className={`mobile-action-btn mobile-attack-btn ${mobileAttackAiming ? "is-aiming" : ""}`}
              onPointerDown={handleMobileAttackStart}
              onPointerMove={handleMobileAttackMove}
              onPointerUp={handleMobileAttackEnd}
              onPointerCancel={handleMobileAttackCancel}
            >
              ATTACK
            </button>

            <button
              type="button"
              className="mobile-action-btn mobile-shield-btn"
              onPointerDown={handleMobileShield}
            >
              SHIELD
            </button>
          </div>
        </div>
      )}

      <div className="mobile-minimap-frame">
        {!isMobileLandscape && (
          <MiniMap
            player={viewTarget}
            worldWidth={WORLD_WIDTH}
            worldHeight={WORLD_HEIGHT}
            orbs={miniMapOrbsForRender}
            cores={cores}
            safeZoneRadius={safeZoneRadius}
          />
        )}
      </div>

      <button className="battle-royale-exit-btn" onClick={onExitToMenu}>
        EXIT TO MENU
      </button>
    </div>
  );
}

export default BattleRoyale;
