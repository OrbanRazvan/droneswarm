import { memo, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import MiniMap from "../MiniMap/MiniMap";
import PixiArenaRenderer from "../PixiArenaRenderer/PixiArenaRenderer";
import "../GameArena/GameArena.css";
import "./NormalPvpArena.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// MiniMap primeste date numai cand s-au schimbat. Astfel miscarea joystick-ului
// nu mai re-randeaza harta mica de zeci de ori pe secunda pe telefoane.
const MemoizedMiniMap = memo(MiniMap);

const WORLD_WIDTH_FALLBACK = 14000;
const WORLD_HEIGHT_FALLBACK = 14000;
const ZONE_RADIUS_FALLBACK = 100000;

// GameArena movement: 2.8 px / 60fps frame ~= 168 px/sec.
// Daca backend-ul tau ruleaza la 30 ticks/sec, PLAYER_SPEED pe server trebuie sa fie 5.6.
// VITEZA DRONEI PRINCIPALE IN PVP.
// Identic cu Normal PvP, ca senzatia de miscare sa fie aceeasi.
const GAME_FRAME_SPEED = 2.6;
const CLIENT_SPEED = GAME_FRAME_SPEED * 60;

// Keep local prediction exactly aligned with Normal PvP server pacing.
const NORMAL_BASE_MOVE_SPEED_MULTIPLIER = 1.08;
const NORMAL_BASE_ATTACK_DRONE_SPEED_MULTIPLIER = 1.12;

// Delta-time smoothing. Valorile sunt "pe secunda", nu pe frame.
// Asta inseamna ca jocul se simte la fel la 45 FPS, 60 FPS sau 144 FPS.
// Pozitia locala NU se reseteaza la fiecare snapshot. Serverul ramane
// autoritar, dar corectiile mici sunt aplicate gradual pentru a elimina
// "rubber-band" / mersul in trepte cand jucatorul este singur.
const SELF_CORRECTION_MOVING = 0.11;
const SELF_CORRECTION_IDLE = 0.42;
const SELF_SNAP_DISTANCE = 0.5;
const SELF_HARD_SNAP_DISTANCE = 1100;
const SELF_MAX_CORRECTION_SPEED = 900; // px/sec, limita unei corectii locale
const SELF_IDLE_FREEZE_DISTANCE = 1.5;

// React tine numai HUD/minimap. Randarea jocului ramane in rAF + Pixi.
const REACT_RENDER_SYNC_INTERVAL_MS = 100;
const HUD_SYNC_INTERVAL_MS = 125;

// Pe telefon, React ramane strict pentru HUD/minimap. Pixi citeste liveDataRef
// la fiecare frame, deci nu avem nevoie de re-render React la 10Hz in timp ce
// jucatorul tine joystick-ul apasat. Mai putine spike-uri pe thread-ul principal.
const MOBILE_REACT_RENDER_SYNC_INTERVAL_MS = 260;
const MOBILE_HUD_SYNC_INTERVAL_MS = 250;
const MOBILE_RENDER_LIMITS = Object.freeze({
  players: 12,
  // Normal PvP now has a denser server world. These limits remain modest
  // enough for older phones, while showing substantially more nearby loot.
  orbs: 140,
  energy: 55,
  cores: 7,
  projectiles: 20,
});

const REMOTE_SMOOTHING = 24;
const REMOTE_PREDICTION = 1.0;
const REMOTE_HARD_SNAP_DISTANCE = 360;
const REMOTE_MAX_EXTRAPOLATE_MS = 80;

const PROJECTILE_SMOOTHING = 18;
const PROJECTILE_FRAME_SCALE = 60;
const PROJECTILE_VISUAL_TTL = 10000;
const LOCAL_PROJECTILE_MIN_VISUAL_MS = 85;
const SERVER_PROJECTILE_FADE_TTL = 10000;
const LOCAL_PROJECTILE_MAX_DISTANCE = 4200;
const PROJECTILE_HIT_VISUAL_RADIUS = 118;
const LOCAL_PROJECTILE_SPEED = 4.4;
const FIRE_COOLDOWN = 3000;
const ORB_STABLE_TTL = 2400;
const MINIMAP_STABLE_TTL = 8000;

// Colectare vizuala locala: clientul ascunde instant orbul/energia/core-ul
// cand intra in el, fara sa astepte urmatorul pachet de la server.
// Serverul ramane autoritar pentru scor/progress, dar senzatia este instant.
const LOCAL_ORB_COLLECT_DISTANCE = 150;
const LOCAL_ENERGY_COLLECT_DISTANCE = 135;
const LOCAL_CORE_COLLECT_DISTANCE = 155;
const LOCAL_COLLECT_HIDE_TTL = 1800;

// Multiplayer modern sync
// Client-side prediction + server reconciliation + remote snapshot buffer.
// 30 Hz input is enough because the server simulates continuously using the
// latest input. It cuts mobile/network pressure roughly in half vs 60 Hz.
const INPUT_SEND_INTERVAL_MS = 20;
const INPUT_HEARTBEAT_MS = 240;
const SNAPSHOT_INTERPOLATION_DELAY_MS = 70;
const SNAPSHOT_BUFFER_TTL_MS = 520;

// Keep PvP desktop framing exactly locked to BattleRoyaleMode.
// BattleRoyaleMode uses 0.72 on desktop; do not change only one mode or the
// perceived camera height will differ between PvE and PvP.
const BATTLE_ROYALE_DESKTOP_CAMERA_SCALE = 0.72;
const PVP_DESKTOP_CAMERA_SCALE = BATTLE_ROYALE_DESKTOP_CAMERA_SCALE;

// Mobile remains intentionally farther out so controls do not hide the fight.
const PVP_MOBILE_CAMERA_SCALE = 0.82;

const MAX_VISIBLE_REMOTE_PLAYERS = 60;

const CORE_TYPES = [
  {
    type: "nano",
    name: "Nano Core",
    shortName: "Nano",
    color: "#00eaff",
    effect: "+10 MAX HP",
  },
  {
    type: "rotor",
    name: "Rotor Core",
    shortName: "Rotor",
    color: "#ffae3d",
    effect: "+Attack drone speed",
  },
  {
    type: "piercing",
    name: "Piercing Core",
    shortName: "Piercing",
    color: "#b45cff",
    effect: "Next 3 shots pierce",
  },
  {
    type: "overclock",
    name: "Overclock Core",
    shortName: "Overclock",
    color: "#ff4040",
    effect: "25s rapid fire",
  },
  {
    type: "berserk",
    name: "Berserk Core",
    shortName: "Berserk",
    color: "#ff7a18",
    effect: "10s 75 damage shots",
  },
  {
    type: "shield-breaker",
    name: "Shield Breaker Core",
    shortName: "Shield Breaker",
    color: "#d946ef",
    effect: "Next shot ignores shield",
  },
  {
    type: "swarm",
    name: "Swarm Core",
    shortName: "Swarm",
    color: "#00ffd5",
    effect: "+2 drones instantly",
  },
  {
    type: "vampire",
    name: "Vampire Core",
    shortName: "Vampire",
    color: "#00c46a",
    effect: "15s lifesteal",
  },
  {
    type: "emp",
    name: "EMP Core",
    shortName: "EMP",
    color: "#faff00",
    effect: "EMP burst around you",
  },
];

const DRONE_SKIN_THEMES = {
  cyan: ["#00eaff", "#78f7ff", "#003140", "#ffffff", "rgba(0, 234, 255, 0.78)"],
  red: ["#ff4040", "#ff9a9a", "#380000", "#ffffff", "rgba(255, 64, 64, 0.72)"],
  purple: [
    "#9b5cff",
    "#d5b6ff",
    "#180034",
    "#ffffff",
    "rgba(155, 92, 255, 0.74)",
  ],
  orange: [
    "#ff9f1c",
    "#ffd166",
    "#4b2100",
    "#fff7e6",
    "rgba(255, 159, 28, 0.72)",
  ],
  green: [
    "#19ff8a",
    "#8cffc4",
    "#00391f",
    "#ffffff",
    "rgba(25, 255, 138, 0.72)",
  ],
  pink: [
    "#ff4fd8",
    "#ffb8ef",
    "#4d003c",
    "#ffffff",
    "rgba(255, 79, 216, 0.72)",
  ],
  "ice-blue": [
    "#7de7ff",
    "#e7fbff",
    "#07314a",
    "#ffffff",
    "rgba(125, 231, 255, 0.78)",
  ],
  "solar-gold": [
    "#ffd447",
    "#fff0a8",
    "#513a00",
    "#ffffff",
    "rgba(255, 212, 71, 0.75)",
  ],
  "shadow-black": [
    "#2e3440",
    "#6b7280",
    "#05070c",
    "#bdeeff",
    "rgba(75, 85, 99, 0.82)",
  ],
  "toxic-lime": [
    "#b6ff00",
    "#e8ff8a",
    "#284000",
    "#ffffff",
    "rgba(182, 255, 0, 0.76)",
  ],
  "royal-violet": [
    "#6d28d9",
    "#c4b5fd",
    "#14002e",
    "#f8f5ff",
    "rgba(109, 40, 217, 0.78)",
  ],
  "crimson-white": [
    "#dc143c",
    "#ffffff",
    "#43000d",
    "#fff5f7",
    "rgba(220, 20, 60, 0.75)",
  ],
  "neon-teal": [
    "#00ffcc",
    "#a7ffee",
    "#003c33",
    "#ffffff",
    "rgba(0, 255, 204, 0.76)",
  ],
  "ember-red": [
    "#ff5a1f",
    "#ffb86b",
    "#451100",
    "#fff0e6",
    "rgba(255, 90, 31, 0.78)",
  ],
  "arctic-silver": [
    "#c7d2fe",
    "#f8fafc",
    "#1e293b",
    "#ffffff",
    "rgba(199, 210, 254, 0.78)",
  ],
  "void-purple": [
    "#4c1d95",
    "#a78bfa",
    "#070012",
    "#e9d5ff",
    "rgba(76, 29, 149, 0.84)",
  ],
  "plasma-pink": [
    "#ff00aa",
    "#ff7adf",
    "#3f0030",
    "#ffffff",
    "rgba(255, 0, 170, 0.8)",
  ],
  "jade-black": [
    "#00a86b",
    "#86efac",
    "#001e14",
    "#eafff5",
    "rgba(0, 168, 107, 0.78)",
  ],
  "azure-white": [
    "#38bdf8",
    "#ffffff",
    "#082f49",
    "#ffffff",
    "rgba(56, 189, 248, 0.78)",
  ],
  "inferno-orange": [
    "#ff6b00",
    "#ffcf33",
    "#4a1300",
    "#fff4df",
    "rgba(255, 107, 0, 0.82)",
  ],
  "midnight-blue": [
    "#1e3a8a",
    "#60a5fa",
    "#020617",
    "#dbeafe",
    "rgba(30, 58, 138, 0.84)",
  ],
  "acid-green": [
    "#39ff14",
    "#c6ff8a",
    "#0f2b00",
    "#ffffff",
    "rgba(57, 255, 20, 0.8)",
  ],
  "ruby-black": [
    "#e11d48",
    "#fb7185",
    "#09090b",
    "#ffe4e6",
    "rgba(225, 29, 72, 0.82)",
  ],
  "ghost-white": [
    "#e5e7eb",
    "#ffffff",
    "#334155",
    "#ffffff",
    "rgba(229, 231, 235, 0.76)",
  ],
  "cyber-yellow": [
    "#faff00",
    "#fff7ad",
    "#3a3800",
    "#ffffff",
    "rgba(250, 255, 0, 0.76)",
  ],
  "deep-ocean": [
    "#006994",
    "#67e8f9",
    "#001b2e",
    "#e0ffff",
    "rgba(0, 105, 148, 0.82)",
  ],
  "magenta-cyan": [
    "#ff00ff",
    "#00ffff",
    "#250033",
    "#ffffff",
    "rgba(255, 0, 255, 0.78)",
  ],
  "bronze-steel": [
    "#b87333",
    "#d1d5db",
    "#2b1605",
    "#fff7ed",
    "rgba(184, 115, 51, 0.72)",
  ],
  "electric-indigo": [
    "#4f46e5",
    "#93c5fd",
    "#0b102f",
    "#eef2ff",
    "rgba(79, 70, 229, 0.82)",
  ],
  "dark-emerald": [
    "#047857",
    "#34d399",
    "#001f16",
    "#d1fae5",
    "rgba(4, 120, 87, 0.82)",
  ],
};

function normalizeSkin(skin) {
  const clean = String(skin || "cyan")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  if (!clean || clean === "basic" || clean === "basic-drone") return "cyan";
  return clean;
}

function getSelectedSkin(user) {
  if (user?.isGuest) return "cyan";
  return normalizeSkin(
    user?.selectedSkin ||
      user?.selectedDroneSkin ||
      user?.selectedDrone ||
      user?.skin ||
      "cyan",
  );
}

function getDisplayName(user) {
  return (
    user?.username ||
    user?.firstName ||
    user?.email?.split("@")?.[0] ||
    "Player"
  );
}

function isRealMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;

  const ua = navigator.userAgent || "";
  const isPhoneUa = /Android.*Mobile|iPhone|iPod|IEMobile|Opera Mini/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const isPortrait = window.innerHeight >= window.innerWidth;

  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const longSide = Math.max(window.innerWidth, window.innerHeight);

  return Boolean(
    isPhoneUa && hasTouch && isPortrait && shortSide <= 980 && longSide <= 2600,
  );
}

function getCoreMeta(type) {
  return CORE_TYPES.find((core) => core.type === type) || CORE_TYPES[0];
}

function getNextDroneAt(currentDrones = 0) {
  const requirements = [5, 15, 25, 35, 50];
  const index = Math.max(0, Math.min(currentDrones, requirements.length - 1));
  return requirements[index];
}

function applyOptimisticOrbCollection(unit, count) {
  if (!unit || count <= 0) return unit;

  let progress = Number(unit.progress || 0) + count;
  let drones = Number(unit.drones || 0);
  let nextDroneAt = Number(unit.nextDroneAt || getNextDroneAt(drones));

  while (drones < 5 && progress >= nextDroneAt) {
    progress -= nextDroneAt;
    drones += 1;
    nextDroneAt = getNextDroneAt(drones);
  }

  return {
    ...unit,
    progress,
    drones,
    nextDroneAt,
    totalCollected: Number(unit.totalCollected || 0) + count,
  };
}

function applyOptimisticEnergyCollection(unit, count) {
  if (!unit || count <= 0) return unit;
  return {
    ...unit,
    energy: Math.min(100, Number(unit.energy || 0) + count * 25),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function damp(current, target, lambda, dt) {
  const t = 1 - Math.exp(-lambda * Math.max(0, dt || 0));
  return lerp(current, target, t);
}

function dampPoint(
  currentX,
  currentY,
  targetX,
  targetY,
  lambda,
  dt,
  snapDistance = 0,
  hardSnapDistance = Infinity,
) {
  const distance = Math.hypot(targetX - currentX, targetY - currentY);

  if (distance <= snapDistance || distance >= hardSnapDistance) {
    return { x: targetX, y: targetY };
  }

  return {
    x: damp(currentX, targetX, lambda, dt),
    y: damp(currentY, targetY, lambda, dt),
  };
}

// Reconciliere fara teleport: combina un damp exponential (lin, simte bine la distante mici)
// cu o viteza maxima de corectie (px/sec). Asta garanteaza ca, indiferent cat de mare e
// diferenta momentana fata de server (sub hardSnapDistance), drona ta nu "salta" niciodata
// vizibil - se aliniaza mereu treptat, la o viteza perceptibila dar nu brusca.
function dampPointCapped(
  currentX,
  currentY,
  targetX,
  targetY,
  lambda,
  dt,
  snapDistance,
  hardSnapDistance,
  maxSpeed,
) {
  const distance = Math.hypot(targetX - currentX, targetY - currentY);

  if (distance <= snapDistance) {
    return { x: targetX, y: targetY };
  }

  if (distance >= hardSnapDistance) {
    return { x: targetX, y: targetY };
  }

  const damped = dampPoint(
    currentX,
    currentY,
    targetX,
    targetY,
    lambda,
    dt,
    0,
    Infinity,
  );
  const dampedStepDistance = Math.hypot(
    damped.x - currentX,
    damped.y - currentY,
  );
  const maxStepDistance = maxSpeed * Math.max(0, dt || 0);

  if (dampedStepDistance <= maxStepDistance || dampedStepDistance === 0) {
    return damped;
  }

  const ratio = maxStepDistance / dampedStepDistance;
  return {
    x: currentX + (damped.x - currentX) * ratio,
    y: currentY + (damped.y - currentY) * ratio,
  };
}

function keepInsideSafeZone(
  x,
  y,
  radius,
  worldWidth,
  worldHeight,
  margin = 70,
  allowOutsideZone = false,
) {
  // Pentru Normal PvP vrem ca playerul sa poata intra in zona periculoasa.
  // Clientul limiteaza doar marginile hartii; serverul aplica damage-ul autoritar.
  if (allowOutsideZone) {
    return {
      x: clamp(x, 160, worldWidth - 160),
      y: clamp(y, 160, worldHeight - 160),
    };
  }

  const cx = worldWidth / 2;
  const cy = worldHeight / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const maxDist = Math.max(120, (radius || ZONE_RADIUS_FALLBACK) - margin);

  if (dist <= maxDist) {
    return {
      x: clamp(x, 160, worldWidth - 160),
      y: clamp(y, 160, worldHeight - 160),
    };
  }

  return {
    x: clamp(cx + (dx / dist) * maxDist, 160, worldWidth - 160),
    y: clamp(cy + (dy / dist) * maxDist, 160, worldHeight - 160),
  };
}

function mergeStableItems(previousMap, incoming = [], now, ttlMs) {
  incoming.forEach((item) => {
    if (!item?.id) return;
    const old = previousMap.get(item.id);
    previousMap.set(item.id, {
      ...old,
      ...item,
      __seenAt: now,
    });
  });

  for (const [id, item] of previousMap.entries()) {
    if (now - (item.__seenAt || 0) > ttlMs) {
      previousMap.delete(id);
    }
  }

  return previousMap;
}

// Combat events have their own reliable socket channel. Keep a tiny local
// cache because realtime world snapshots are deliberately volatile in PvP.
// The Map also deduplicates the direct event and the later state-snapshot copy.
function mergePrivateCombatEvents(previousMap, incoming = [], viewerId, now = Date.now()) {
  const activeViewerId = viewerId ? String(viewerId) : "";

  for (const event of incoming || []) {
    if (!event?.id || !activeViewerId) continue;
    const eventViewerId = String(event.viewerId || activeViewerId);
    if (eventViewerId !== activeViewerId) continue;

    const createdAt = Number(event.createdAt || now);
    const ttl = Math.max(300, Number(event.ttl || 2000));
    if (now - createdAt >= ttl) continue;
    previousMap.set(event.id, {
      ...event,
      viewerId: activeViewerId,
      createdAt,
      ttl,
    });
  }

  for (const [id, event] of previousMap.entries()) {
    const createdAt = Number(event?.createdAt || now);
    const ttl = Math.max(300, Number(event?.ttl || 2000));
    if (now - createdAt >= ttl + 260) previousMap.delete(id);
  }

  return previousMap;
}

// Battle Royale is local, so it can create feedback directly from the changed
// player object. Multiplayer normally uses reliable backend events, but this
// fallback guarantees the exact same WebGL feedback even if one network event
// arrives late or a volatile snapshot is skipped.
function buildSelfCombatFallbackEvents(previous, current, viewerId, now, existingEvents) {
  const activeViewerId = viewerId ? String(viewerId) : "";
  if (!previous || !current || !activeViewerId) return [];

  const hasRecent = (text) => {
    for (const event of existingEvents?.values?.() || []) {
      if (
        String(event?.text || "") === text &&
        now - Number(event?.createdAt || 0) < 650
      ) {
        return true;
      }
    }
    return false;
  };

  const events = [];
  const add = (text, kind, offsetY = 0) => {
    if (!text || hasRecent(text)) return;
    events.push({
      id: `local-combat-${now}-${events.length}-${Math.random().toString(36).slice(2, 8)}`,
      viewerId: activeViewerId,
      x: Number(current.x || previous.x || 0),
      y: Number(current.y || previous.y || 0) + offsetY,
      text,
      kind,
      side: events.length % 2 === 0 ? 1 : -1,
      lane: events.length % 3,
      createdAt: now,
      ttl: 2000,
    });
  };

  const hpDelta = Math.round(Number(current.hp || 0) - Number(previous.hp || 0));
  const droneDelta = Math.round(Number(current.drones || 0) - Number(previous.drones || 0));
  const energyDelta = Math.round(Number(current.energy || 0) - Number(previous.energy || 0));
  const killsIncreased = Number(current.kills || 0) > Number(previous.kills || 0);
  const moveDelta = Number(current.moveSpeedMultiplier || 1) - Number(previous.moveSpeedMultiplier || 1);
  const attackSpeedDelta = Number(current.attackDroneSpeedMultiplier || 1) - Number(previous.attackDroneSpeedMultiplier || 1);

  if (hpDelta < 0) add(`-${Math.abs(hpDelta)} HP`, "damage", -4);
  if (droneDelta < 0) add(`-${Math.abs(droneDelta)} DRONE`, "drone-loss", -28);

  const shieldWasBlocked =
    Boolean(previous.shieldActive) &&
    !current.shieldActive &&
    Number(previous.shieldUntil || 0) > now &&
    hpDelta === 0 &&
    droneDelta === 0;
  if (shieldWasBlocked) add("SHIELD BLOCKED", "shield", -18);

  if (energyDelta > 0) add(`ENERGY +${energyDelta}`, "heal", -8);
  if (killsIncreased && hpDelta > 0) add(`+${hpDelta} HP`, "heal", -4);
  if (killsIncreased && droneDelta > 0) add(`+${droneDelta} DRONE`, "drone-reward", -28);
  if (killsIncreased && moveDelta >= 0.1) add("+15% MOVE SPEED", "move-reward", -52);
  if (killsIncreased && attackSpeedDelta >= 0.04) add("+5% ATTACK DRONE SPEED", "attack-reward", -76);

  return events;
}

function cleanupHiddenCollected(hiddenMap, now) {
  for (const [id, seenAt] of hiddenMap.entries()) {
    if (now - seenAt > LOCAL_COLLECT_HIDE_TTL) {
      hiddenMap.delete(id);
    }
  }
}

function isHiddenCollected(hiddenMap, id) {
  return Boolean(id && hiddenMap.has(id));
}

function locallyCollectItems(mapRef, hiddenRef, player, distance, now) {
  if (!player || player.alive === false) return 0;

  let collected = 0;
  const distanceSq = distance * distance;

  for (const [id, item] of mapRef.current.entries()) {
    if (!item || hiddenRef.current.has(id)) continue;

    const dx = (item.x || 0) - (player.x || 0);
    const dy = (item.y || 0) - (player.y || 0);

    if (dx * dx + dy * dy <= distanceSq) {
      hiddenRef.current.set(id, now);
      mapRef.current.delete(id);
      collected += 1;
    }
  }

  return collected;
}

function getProjectileSkinStyle(skin = "cyan") {
  const [primary, secondary, dark, highlight, glow] =
    DRONE_SKIN_THEMES[normalizeSkin(skin)] || DRONE_SKIN_THEMES.cyan;
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

function getActiveEffectBadges(unit, now = Date.now()) {
  if (!unit) return [];
  const badges = [];
  const addTimed = (key, label, until, className) => {
    if (!until || until <= now) return;
    badges.push({
      key,
      label,
      seconds: Math.ceil((until - now) / 1000),
      className,
    });
  };
  const addReady = (key, label, className) =>
    badges.push({ key, label, seconds: null, className });

  if (unit.nanoCoreActive) addReady("nano", "NANO CORE", "nano");
  if (unit.rotorCoreActive) addReady("rotor", "ROTOR CORE", "rotor");
  if (unit.swarmCoreActive) addReady("swarm", "SWARM CORE", "swarm");
  if ((unit.piercingShots || 0) > 0)
    addReady("piercing", `PIERCING x${unit.piercingShots}`, "piercing");
  if ((unit.shieldBreakerShots || 0) > 0)
    addReady(
      "shield-breaker",
      `SHIELD BREAKER x${unit.shieldBreakerShots}`,
      "shield-breaker",
    );

  addTimed("overclock", "OVERCLOCK", unit.overclockUntil, "overclock");
  addTimed("berserk", "BERSERK", unit.berserkUntil, "berserk");
  addTimed("vampire", "VAMPIRE", unit.vampireUntil, "vampire");
  addTimed("emp", "EMP", unit.empPulseUntil, "emp");
  addTimed("rapid", "RAPID FIRE", unit.rapidFireUntil, "rapid");

  return badges.slice(0, 2);
}

function getViewportBounds(
  cameraX,
  cameraY,
  viewport,
  padding = 650,
  scale = 1,
) {
  const safeScale = Math.max(0.2, Number(scale || 1));

  return {
    left: (-cameraX - padding) / safeScale,
    right: (viewport.width - cameraX + padding) / safeScale,
    top: (-cameraY - padding) / safeScale,
    bottom: (viewport.height - cameraY + padding) / safeScale,
  };
}

function isVisible(item, bounds, radius = 0) {
  return (
    item &&
    item.x + radius >= bounds.left &&
    item.x - radius <= bounds.right &&
    item.y + radius >= bounds.top &&
    item.y - radius <= bounds.bottom
  );
}

function collectVisible(source, predicate, limit, mapFn) {
  const result = [];
  for (const item of source) {
    if (!predicate(item)) continue;
    result.push(mapFn ? mapFn(item) : item);
    if (result.length >= limit) break;
  }
  return result;
}

function advanceProjectile(projectile, dt) {
  if (!projectile) return projectile;

  return {
    ...projectile,
    x: projectile.x + (projectile.vx || 0) * dt * PROJECTILE_FRAME_SCALE,
    y: projectile.y + (projectile.vy || 0) * dt * PROJECTILE_FRAME_SCALE,
  };
}

function getProjectileTravelDistance(projectile) {
  if (!projectile) return 0;
  const startX = projectile.startX ?? projectile.x;
  const startY = projectile.startY ?? projectile.y;
  return Math.hypot((projectile.x || 0) - startX, (projectile.y || 0) - startY);
}

function getLocalFireCooldown(unit, now = performance.now()) {
  let cooldown = FIRE_COOLDOWN;

  if (unit?.rapidFireUntil && unit.rapidFireUntil > Date.now()) {
    cooldown *= unit.attackCooldownMultiplier || 0.65;
  }

  if (unit?.overclockUntil && unit.overclockUntil > Date.now()) {
    cooldown *= 0.5;
  }

  if (unit?.rotorCoreActive) {
    cooldown *= 0.72;
  }

  cooldown *= Math.max(0.45, Number(unit?.killAttackSpeedMultiplier || 1));

  return Math.max(420, Math.floor(cooldown));
}

function getLocalProjectileSpeed(unit) {
  const rapidBonus =
    unit?.rapidFireUntil && unit.rapidFireUntil > Date.now() ? 0.75 : 0;
  const overclockBonus =
    unit?.overclockUntil && unit.overclockUntil > Date.now() ? 1.25 : 0;
  return (
    (LOCAL_PROJECTILE_SPEED +
      (unit?.projectileSpeedBonus || 0) +
      rapidBonus +
      overclockBonus) *
    NORMAL_BASE_ATTACK_DRONE_SPEED_MULTIPLIER *
    Math.max(1, Number(unit?.attackDroneSpeedMultiplier || 1))
  );
}

function projectileHitsAnyTarget(projectile, targets = []) {
  if (!projectile) return false;

  for (const target of targets) {
    if (!target || target.alive === false || target.id === projectile.ownerId)
      continue;

    const dx = (target.x || 0) - (projectile.x || 0);
    const dy = (target.y || 0) - (projectile.y || 0);

    if (
      dx * dx + dy * dy <=
      PROJECTILE_HIT_VISUAL_RADIUS * PROJECTILE_HIT_VISUAL_RADIUS
    ) {
      return true;
    }
  }

  return false;
}

function createLocalProjectile(unit, mouseWorldX, mouseWorldY, now) {
  if (!unit || unit.alive === false || (unit.drones || 0) <= 0) return null;

  const angle = Math.atan2(mouseWorldY - unit.y, mouseWorldX - unit.x);
  const speed = getLocalProjectileSpeed(unit);
  return {
    id: `local-${unit.id || "me"}-${Math.round(now)}-${Math.random().toString(16).slice(2)}`,
    ownerId: unit.id,
    localOnly: true,
    createdAt: now,
    __seenAt: now,
    x: unit.x + Math.cos(angle) * 120,
    y: unit.y + Math.sin(angle) * 120,
    startX: unit.x,
    startY: unit.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    skin: normalizeSkin(unit.skin || "cyan"),
    pierceLeft: Math.max(1, unit.piercingShots || 1),
    shieldBreaker: (unit.shieldBreakerShots || 0) > 0,
    piercesShield: (unit.shieldBreakerShots || 0) > 0,
  };
}

function getMoveVectorFromInput(input = {}) {
  let dx = 0;
  let dy = 0;

  if (input.w) dy -= 1;
  if (input.s) dy += 1;
  if (input.a) dx -= 1;
  if (input.d) dx += 1;

  if (input.mobileMove) {
    dx += Number(input.moveX || 0);
    dy += Number(input.moveY || 0);
  }

  const length = Math.hypot(dx, dy) || 1;
  return {
    dx,
    dy,
    nx: dx / length,
    ny: dy / length,
    moving: dx !== 0 || dy !== 0,
  };
}

function predictUnitFromInput(
  unit,
  input,
  dt,
  worldWidth,
  worldHeight,
  zoneRadius,
) {
  if (!unit || unit.alive === false) return unit;

  const move = getMoveVectorFromInput(input);
  const safeDt = Math.min(0.05, Math.max(0, dt || 0));
  let nextX = unit.x || 0;
  let nextY = unit.y || 0;

  if (move.moving && (unit.energy ?? 1) > 0) {
    const moveSpeed =
      CLIENT_SPEED *
      NORMAL_BASE_MOVE_SPEED_MULTIPLIER *
      Math.max(1, Number(unit.moveSpeedMultiplier || 1));
    nextX += move.nx * moveSpeed * safeDt;
    nextY += move.ny * moveSpeed * safeDt;
  }

  const safe = keepInsideSafeZone(
    nextX,
    nextY,
    zoneRadius || ZONE_RADIUS_FALLBACK,
    worldWidth || WORLD_WIDTH_FALLBACK,
    worldHeight || WORLD_HEIGHT_FALLBACK,
    70,
    true,
  );

  return {
    ...unit,
    x: safe.x,
    y: safe.y,
    moveX: move.moving ? move.nx : 0,
    moveY: move.moving ? move.ny : 0,
    isMoving: move.moving,
    moveAngle: move.moving
      ? Math.atan2(move.dy, move.dx)
      : (unit.moveAngle ?? 0),
    attacking: Boolean(input.attacking),
    shieldActive: Boolean(unit.shieldActive || input.shield),
    mouseX: input.mouseX ?? unit.mouseX ?? safe.x,
    mouseY: input.mouseY ?? unit.mouseY ?? safe.y,
  };
}


// -----------------------------------------------------------------------------
// Local-player prediction policy
// -----------------------------------------------------------------------------
// The local drone is rendered from the client's 60 Hz prediction. A server
// snapshot is necessarily older (server tick + websocket transport + snapshot
// cadence). Pulling the drone toward every received snapshot is what produces
// the classic forward -> short backward "rubber-band" motion.
//
// While a movement key / joystick is held, preserve the local x/y completely.
// The server remains authoritative for combat, energy, death and the state
// seen by the other players. Only after movement has stopped AND the server has
// also reported a stopped drone do we gently settle any small visual drift.
const LOCAL_RELEASE_GRACE_MS = 250;
const LOCAL_IDLE_SETTLE_ALPHA = 0.16;
const LOCAL_IDLE_SETTLE_DEADZONE = 1.25;
const LOCAL_HARD_RESYNC_DISTANCE = 1600;

function reconcileHeldInputUnit(local, server, now = performance.now(), lastLocalMoveAt = 0) {
  if (!server) return local;
  if (!local || local.alive === false || server.alive === false) {
    return { ...(local || {}), ...server };
  }

  const locallyPredicted = Boolean(local.isMoving) || now - Number(lastLocalMoveAt || 0) < LOCAL_RELEASE_GRACE_MS;
  const serverStillMoving = Boolean(server.isMoving);
  const dx = Number(server.x || 0) - Number(local.x || 0);
  const dy = Number(server.y || 0) - Number(local.y || 0);
  const distance = Math.hypot(dx, dy);

  let x = Number(local.x || 0);
  let y = Number(local.y || 0);

  if (distance >= LOCAL_HARD_RESYNC_DISTANCE && !locallyPredicted) {
    // Only resync hard once the local command has stopped. While input is held,
    // preserve prediction; server-only body pushes are disabled for network PvP.
    x = Number(server.x || 0);
    y = Number(server.y || 0);
  } else if (!locallyPredicted && !serverStillMoving && distance > LOCAL_IDLE_SETTLE_DEADZONE) {
    // Never snap on key/joystick release. Blend the final resting position over
    // a few frames, after the server has confirmed that it also stopped.
    x += dx * LOCAL_IDLE_SETTLE_ALPHA;
    y += dy * LOCAL_IDLE_SETTLE_ALPHA;
  }

  return {
    ...local,
    ...server,
    x,
    y,
    moveX: locallyPredicted ? local.moveX : server.moveX,
    moveY: locallyPredicted ? local.moveY : server.moveY,
    moveAngle: locallyPredicted ? local.moveAngle : server.moveAngle,
    isMoving: locallyPredicted ? Boolean(local.isMoving) : Boolean(server.isMoving),
    serverX: server.x,
    serverY: server.y,
  };
}

function interpolateSnapshotBuffer(buffer = [], renderTime) {
  if (!buffer.length) return null;
  if (buffer.length === 1) return buffer[0];

  let older = buffer[0];
  let newer = buffer[buffer.length - 1];

  for (let i = 0; i < buffer.length - 1; i += 1) {
    const a = buffer[i];
    const b = buffer[i + 1];
    if (
      (a.__receivedAt || 0) <= renderTime &&
      (b.__receivedAt || 0) >= renderTime
    ) {
      older = a;
      newer = b;
      break;
    }
  }

  const aTime = older.__receivedAt || renderTime;
  const bTime = newer.__receivedAt || aTime;
  const span = Math.max(1, bTime - aTime);
  const t = clamp((renderTime - aTime) / span, 0, 1);

  return {
    ...newer,
    x: lerp(older.x ?? newer.x, newer.x ?? older.x, t),
    y: lerp(older.y ?? newer.y, newer.y ?? older.y, t),
    hp: newer.hp,
    energy: newer.energy,
    drones: newer.drones,
    alive: newer.alive,
  };
}

function FlyingAttackDrone({ projectile }) {
  const skin = normalizeSkin(projectile.skin || "cyan");
  const angle =
    projectile.angle || Math.atan2(projectile.vy || 0, projectile.vx || 1);

  return (
    <div
      className={`flying-attack-drone attack-skin-${skin} ${projectile.pierceLeft > 1 ? "is-piercing" : ""} ${projectile.shieldBreaker || projectile.piercesShield ? "is-shield-breaker" : ""}`}
      style={{
        ...getProjectileSkinStyle(skin),
        left: projectile.x,
        top: projectile.y,
        transform: `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`,
      }}
    >
      <div className="fad-trail" />
      <div className="fad-arm fad-arm-x" />
      <div className="fad-arm fad-arm-y" />
      <div className="fad-rotor fad-tl">
        <span />
      </div>
      <div className="fad-rotor fad-tr">
        <span />
      </div>
      <div className="fad-rotor fad-bl">
        <span />
      </div>
      <div className="fad-rotor fad-br">
        <span />
      </div>
      <div className="fad-shell" />
      <div className="fad-light" />
    </div>
  );
}

function NormalPvpArena({ user, onExitToMenu, graphicsQuality = "normal" }) {
  const socketRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const lastFrameRef = useRef(performance.now());
  const fpsRef = useRef({ frames: 0, lastAt: performance.now(), value: 60 });
  const lastRenderSyncRef = useRef(0);
  const pixiLiveRef = useRef(null);
  const coreColorMapRef = useRef(
    CORE_TYPES.reduce((acc, core) => {
      acc[core.type] = core.color;
      return acc;
    }, {}),
  );
  const worldElementRef = useRef(null);
  const sendInputRef = useRef(() => {});
  const inputSeqRef = useRef(0);
  const lastInputSentAtRef = useRef(performance.now());
  const lastLocalMovementAtRef = useRef(performance.now());
  const lastInputSignatureRef = useRef("");
  const remoteSnapshotBufferRef = useRef(new Map());
  const lastConfirmedHpRef = useRef(null);
  const lastCollectionSeqRef = useRef(0);
  const combatEventMapRef = useRef(new Map());
  // Last authoritative self snapshot. Used only as a client-side visual
  // fallback, never for gameplay or damage decisions.
  const selfCombatSnapshotRef = useRef(null);

  const mobileMoveRef = useRef({ x: 0, y: 0, active: false });
  const joystickPointerRef = useRef(null);
  const attackPointerRef = useRef(null);
  const shieldPointerRef = useRef(null);
  const mobileAimDirRef = useRef({ x: 1, y: 0 });
  const mobileAimLineRef = useRef(null);
  const mobileAimCircleRef = useRef(null);
  const mobileAimArrowRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const mobileJoystickActiveRef = useRef(false);
  const mobilePerformanceRef = useRef(isRealMobileDevice());

  const worldRef = useRef({
    status: "connecting",
    playerCount: 0,
    minPlayers: 1,
    maxPlayers: 60,
    countdown: null,
    coreDropCountdown: null,
    winnerId: null,
    winnerName: null,
    worldWidth: WORLD_WIDTH_FALLBACK,
    worldHeight: WORLD_HEIGHT_FALLBACK,
    safeZoneRadius: ZONE_RADIUS_FALLBACK,
    you: null,
    players: [],
    spectatingPlayer: null,
    orbs: [],
    minimapOrbs: [],
    minimapEnergyCells: [],
    energyCells: [],
    cores: [],
    minimapCores: [],
    projectiles: [],
    combatEvents: [],
    leaderboard: [],
  });

  const predictedYouRef = useRef(null);
  const spectatorTargetRef = useRef(null);
  const remotePlayersRef = useRef(new Map());
  const projectilesRef = useRef(new Map());
  const lastLocalProjectileAtRef = useRef(0);
  const stableOrbMapRef = useRef(new Map());
  const stableEnergyMapRef = useRef(new Map());
  const stableMinimapOrbMapRef = useRef(new Map());
  const stableMinimapEnergyMapRef = useRef(new Map());
  const stableCoreMapRef = useRef(new Map());
  const hiddenOrbIdsRef = useRef(new Map());
  const hiddenEnergyIdsRef = useRef(new Map());
  const hiddenCoreIdsRef = useRef(new Map());

  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [isMobileControls, setIsMobileControls] = useState(() =>
    isRealMobileDevice(),
  );
  const [renderData, setRenderData] = useState(() => ({
    ...worldRef.current,
    fps: 60,
  }));
  const [hudData, setHudData] = useState(() => ({
    ...worldRef.current,
    fps: 60,
  }));
  const [connectionError, setConnectionError] = useState("");
  const [mobileJoystick, setMobileJoystick] = useState({
    active: false,
    knobX: 0,
    knobY: 0,
  });
  const [mobileAttackActive, setMobileAttackActive] = useState(false);
  const [mobileShieldActive, setMobileShieldActive] = useState(false);

  useEffect(() => {
    // Do not auto-connect before all event listeners are attached. On a fast
    // connection, an auto-connect can receive "normal-pvp:joined" before the
    // listener exists, leaving a guest on an empty arena until refresh.
    const socket = io(API_URL, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
    });

    socketRef.current = socket;

    const applyState = (state) => {
      const now = performance.now();
      const wallNow = Date.now();
      const combatViewerId = state?.you?.id || worldRef.current.you?.id || socket.id;
      combatEventMapRef.current = mergePrivateCombatEvents(
        combatEventMapRef.current,
        Array.isArray(state?.combatEvents) ? state.combatEvents : [],
        combatViewerId,
        wallNow,
      );

      const fallbackCombatEvents = buildSelfCombatFallbackEvents(
        selfCombatSnapshotRef.current,
        state?.you,
        combatViewerId,
        wallNow,
        combatEventMapRef.current,
      );
      if (state?.you) {
        selfCombatSnapshotRef.current = { ...state.you };
      }
      if (fallbackCombatEvents.length > 0) {
        combatEventMapRef.current = mergePrivateCombatEvents(
          combatEventMapRef.current,
          fallbackCombatEvents,
          combatViewerId,
          wallNow,
        );
      }

      cleanupHiddenCollected(hiddenOrbIdsRef.current, now);
      cleanupHiddenCollected(hiddenEnergyIdsRef.current, now);
      cleanupHiddenCollected(hiddenCoreIdsRef.current, now);

      stableOrbMapRef.current = mergeStableItems(
        stableOrbMapRef.current,
        state.orbs || [],
        now,
        ORB_STABLE_TTL,
      );
      stableEnergyMapRef.current = mergeStableItems(
        stableEnergyMapRef.current,
        state.energyCells || [],
        now,
        ORB_STABLE_TTL,
      );

      // Minimap data now arrives at a lower cadence. Do not merge every local
      // viewport item into the minimap cache between those updates.
      if (state.minimapOrbs !== undefined) {
        stableMinimapOrbMapRef.current = mergeStableItems(
          stableMinimapOrbMapRef.current,
          state.minimapOrbs || [],
          now,
          MINIMAP_STABLE_TTL,
        );
      }

      if (state.minimapEnergyCells !== undefined) {
        stableMinimapEnergyMapRef.current = mergeStableItems(
          stableMinimapEnergyMapRef.current,
          state.minimapEnergyCells || [],
          now,
          MINIMAP_STABLE_TTL,
        );
      }

      if (state.minimapCores !== undefined) {
        stableCoreMapRef.current = mergeStableItems(
          stableCoreMapRef.current,
          state.minimapCores || [],
          now,
          MINIMAP_STABLE_TTL,
        );
      }

      worldRef.current = {
        ...worldRef.current,
        ...state,
        safeZoneRadius: state.safeZoneRadius || ZONE_RADIUS_FALLBACK,
        you: state.you || worldRef.current.you,
        players: Array.isArray(state.players)
          ? state.players.map((p) => ({ ...p, __seenAt: now }))
          : worldRef.current.players,
        spectatingPlayer: state.spectatingPlayer
          ? { ...state.spectatingPlayer, __seenAt: now }
          : state.spectatingPlayer === null
            ? null
            : worldRef.current.spectatingPlayer,

        orbs:
          state.orbs !== undefined
            ? [...stableOrbMapRef.current.values()].filter(
                (orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id),
              )
            : worldRef.current.orbs,

        minimapOrbs:
          state.minimapOrbs !== undefined
            ? [...stableMinimapOrbMapRef.current.values()]
            : worldRef.current.minimapOrbs,

        minimapEnergyCells:
          state.minimapEnergyCells !== undefined
            ? [...stableMinimapEnergyMapRef.current.values()]
            : worldRef.current.minimapEnergyCells,

        energyCells:
          state.energyCells !== undefined
            ? [...stableEnergyMapRef.current.values()].filter(
                (cell) =>
                  !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id),
              )
            : worldRef.current.energyCells,

        cores:
          state.cores !== undefined
            ? state.cores.filter(
                (core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id),
              )
            : worldRef.current.cores,

        minimapCores:
          state.minimapCores !== undefined
            ? [...stableCoreMapRef.current.values()]
            : worldRef.current.minimapCores,

        projectiles: Array.isArray(state.projectiles)
          ? state.projectiles
          : worldRef.current.projectiles,
        // Direct reliable combat events + volatile snapshot copies are merged
        // above and deduplicated here. Only this player can ever keep them.
        combatEvents: [...combatEventMapRef.current.values()],
        leaderboard: Array.isArray(state.leaderboard)
          ? state.leaderboard
          : worldRef.current.leaderboard,
      };

      if (state.you) {
        const lastProcessedInputSeq = Number(
          state.you.lastProcessedInputSeq ?? state.lastProcessedInputSeq ?? 0,
        );

        const previousHp = lastConfirmedHpRef.current;
        lastConfirmedHpRef.current = state.you.hp;

        const incomingCollectionSeq = Number(state.you.collectionSeq || 0);
        const localCollectionSeq = Number(lastCollectionSeqRef.current || 0);
        const keepLocalCollectStats = localCollectionSeq > incomingCollectionSeq;
        const collectStatsSource = keepLocalCollectStats
          ? predictedYouRef.current || state.you
          : state.you;

        if (!keepLocalCollectStats && incomingCollectionSeq > 0) {
          lastCollectionSeqRef.current = Math.max(
            lastCollectionSeqRef.current || 0,
            incomingCollectionSeq,
          );
        }

        const local = predictedYouRef.current;
        const server = state.you;
        const reconciled = reconcileHeldInputUnit(local, server, now, lastLocalMovementAtRef.current);

        predictedYouRef.current = {
          ...reconciled,
          // Serverul ramane autoritar pentru combat, resurse si status.
          hp: server.hp,
          maxHp: server.maxHp,
          alive: server.alive,
          energy: collectStatsSource.energy,
          drones: collectStatsSource.drones,
          progress: collectStatsSource.progress,
          nextDroneAt: collectStatsSource.nextDroneAt,
          totalCollected: collectStatsSource.totalCollected,
          collectionSeq: Math.max(incomingCollectionSeq, localCollectionSeq),
          lastProcessedInputSeq,
          damageFlashUntil:
            previousHp !== null && server.hp < previousHp
              ? now + 220
              : local?.damageFlashUntil || 0,
        };

        worldRef.current.you = predictedYouRef.current;
      }

      const snapshotsById = remoteSnapshotBufferRef.current;
      const incomingForSnapshots = Array.isArray(state.players)
        ? state.players
        : [];
      const activeRemoteIds = new Set();
      incomingForSnapshots.forEach((player) => {
        if (!player?.id) return;
        activeRemoteIds.add(player.id);
        const buffer = snapshotsById.get(player.id) || [];
        buffer.push({ ...player, __receivedAt: now });

        while (
          buffer.length > 0 &&
          now - (buffer[0].__receivedAt || now) > SNAPSHOT_BUFFER_TTL_MS
        ) {
          buffer.shift();
        }
        if (buffer.length > 12) {
          buffer.splice(0, buffer.length - 12);
        }
        snapshotsById.set(player.id, buffer);
      });

      for (const id of snapshotsById.keys()) {
        if (!activeRemoteIds.has(id)) snapshotsById.delete(id);
      }

      if (state.you?.alive === false) {
        predictedYouRef.current = {
          ...(predictedYouRef.current || {}),
          ...state.you,
        };

        const aliveSpectators = Array.isArray(worldRef.current.players)
          ? worldRef.current.players.filter((player) => player?.alive !== false)
          : [];

        const directSpectator =
          state.spectatingPlayer?.alive !== false
            ? state.spectatingPlayer
            : null;

        const preferredTarget = state.spectatorTargetId
          ? aliveSpectators.find(
              (player) => player.id === state.spectatorTargetId,
            )
          : null;

        const currentTargetStillAlive = spectatorTargetRef.current
          ? aliveSpectators.find(
              (player) => player.id === spectatorTargetRef.current.id,
            )
          : null;

        spectatorTargetRef.current =
          directSpectator ||
          preferredTarget ||
          currentTargetStillAlive ||
          aliveSpectators[0] ||
          null;
      } else {
        spectatorTargetRef.current = null;
      }

      if (!predictedYouRef.current && state.you) {
        predictedYouRef.current = { ...state.you };
      }
    };

    let disposed = false;
    let joinAttempts = 0;
    let joinRetryTimer = null;

    const clearJoinRetry = () => {
      if (joinRetryTimer !== null) {
        window.clearTimeout(joinRetryTimer);
        joinRetryTimer = null;
      }
    };

    const hasJoinedCurrentSocket = () =>
      Boolean(
        socket.connected &&
          socket.id &&
          worldRef.current.you?.id === socket.id,
      );

    const requestNormalPvpJoin = () => {
      if (disposed || !socket.connected) return;

      clearJoinRetry();
      combatEventMapRef.current.clear();
      selfCombatSnapshotRef.current = null;
      socket.emit("normal-pvp:join", {
        userId: user?.isGuest ? null : user?.id,
        isGuest: Boolean(user?.isGuest),
        username: getDisplayName(user),
        skin: getSelectedSkin(user),
      });

      joinAttempts += 1;

      // The server makes duplicate joins idempotent. Retry a few times only
      // when the reliable joined state was not received, never by asking the
      // player to refresh the page.
      joinRetryTimer = window.setTimeout(() => {
        if (
          !disposed &&
          socket.connected &&
          !hasJoinedCurrentSocket() &&
          joinAttempts < 4
        ) {
          requestNormalPvpJoin();
        }
      }, 850);
    };

    const handleConnect = () => {
      setConnectionError("");
      joinAttempts = 0;
      requestNormalPvpJoin();
    };

    socket.on("connect_error", () => {
      setConnectionError(
        "Nu ma pot conecta la serverul PvP. Verifica Render/WebSocket.",
      );
    });

    const applyCollectSync = (event = {}) => {
      const now = performance.now();
      const collectionSeq = Number(
        event.collectionSeq || event.you?.collectionSeq || 0,
      );

      if (collectionSeq > 0) {
        lastCollectionSeqRef.current = Math.max(
          lastCollectionSeqRef.current || 0,
          collectionSeq,
        );
      }

      for (const id of event.collectedOrbIds || []) {
        hiddenOrbIdsRef.current.set(id, now);
        stableOrbMapRef.current.delete(id);
        stableMinimapOrbMapRef.current.delete(id);
      }

      for (const id of event.collectedEnergyIds || []) {
        hiddenEnergyIdsRef.current.set(id, now);
        stableEnergyMapRef.current.delete(id);
        stableMinimapEnergyMapRef.current.delete(id);
      }

      for (const id of event.collectedCoreIds || []) {
        hiddenCoreIdsRef.current.set(id, now);
        stableCoreMapRef.current.delete(id);
      }

      if (event.you) {
        const previous =
          predictedYouRef.current || worldRef.current.you || event.you;

        // Evenimentul de collect este trimis non-volatile de backend imediat dupa colectare.
        // Nu mutam pozitia locala inapoi; luam doar stats autoritare.
        predictedYouRef.current = {
          ...previous,
          hp: event.you.hp,
          maxHp: event.you.maxHp,
          energy: event.you.energy,
          drones: event.you.drones,
          progress: event.you.progress,
          nextDroneAt: event.you.nextDroneAt,
          totalCollected: event.you.totalCollected,
          kills: event.you.kills,
          alive: event.you.alive,
          collectionSeq: event.you.collectionSeq || collectionSeq,
          lastProcessedInputSeq:
            event.you.lastProcessedInputSeq ?? previous.lastProcessedInputSeq,
          serverX: event.you.x,
          serverY: event.you.y,
        };

        worldRef.current = {
          ...worldRef.current,
          you: predictedYouRef.current,
          orbs: [...stableOrbMapRef.current.values()].filter(
            (orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id),
          ),
          minimapOrbs: [...stableMinimapOrbMapRef.current.values()],
          energyCells: [...stableEnergyMapRef.current.values()].filter(
            (cell) => !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id),
          ),
          minimapEnergyCells: [...stableMinimapEnergyMapRef.current.values()],
          cores: (worldRef.current.cores || []).filter(
            (core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id),
          ),
        };

        setHudData({
          ...worldRef.current,
          you: predictedYouRef.current,
          fps: fpsRef.current.value,
        });
      }
    };

    // Sent reliably by the server at the exact death tick. This prevents a
    // one-snapshot delay before the camera begins following the killer.
    const applyEliminated = (event) => {
      if (!event?.you) return;

      const now = performance.now();
      const eliminatedYou = {
        ...(predictedYouRef.current || worldRef.current.you || {}),
        ...event.you,
        alive: false,
      };
      const target =
        event.spectatingPlayer?.alive !== false
          ? { ...event.spectatingPlayer, __seenAt: now }
          : null;

      predictedYouRef.current = eliminatedYou;
      spectatorTargetRef.current = target;
      keysRef.current = {};
      mobileMoveRef.current = { x: 0, y: 0, active: false };
      mobileJoystickActiveRef.current = false;
      setMobileAttackActive(false);
      setMobileShieldActive(false);

      worldRef.current = {
        ...worldRef.current,
        you: eliminatedYou,
        spectatorTargetId: event.spectatorTargetId || target?.id || null,
        spectatingPlayer: target,
      };

      setHudData({
        ...worldRef.current,
        you: eliminatedYou,
        fps: fpsRef.current.value,
      });
    };

    const applyPrivateCombatEvent = (event) => {
      const viewerId = String(worldRef.current.you?.id || socket.id || "");
      if (!event?.id || !viewerId) return;
      const normalizedEvent = {
        ...event,
        viewerId: String(event.viewerId || viewerId),
      };
      if (normalizedEvent.viewerId !== viewerId) return;

      combatEventMapRef.current = mergePrivateCombatEvents(
        combatEventMapRef.current,
        [normalizedEvent],
        viewerId,
        Date.now(),
      );
      const combatEvents = [...combatEventMapRef.current.values()];
      worldRef.current = {
        ...worldRef.current,
        combatEvents,
      };

      // Do not wait for React state or the next volatile world snapshot.
      // Pixi reads this live object on its next WebGL frame, matching the
      // immediate local feedback used by BattleRoyaleMode.
      if (pixiLiveRef.current) {
        pixiLiveRef.current = {
          ...pixiLiveRef.current,
          combatEvents,
          combatViewerId: viewerId,
          combatEventsPrivate: true,
        };
      }
    };

    socket.on("normal-pvp:joined", (state) => {
      applyState(state);
      if (state?.you?.id === socket.id) {
        joinAttempts = 0;
        clearJoinRetry();
      }
    });
    socket.on("normal-pvp:state", applyState);
    socket.on("normal-pvp:combat", applyPrivateCombatEvent);
    socket.on("normal-pvp:eliminated", applyEliminated);
    socket.on("normal-pvp:collect", applyCollectSync);
    socket.on("normal-pvp:error", (message) =>
      setConnectionError(
        typeof message === "string" ? message : "Eroare Normal PvP.",
      ),
    );
    socket.on("connect", handleConnect);

    // All listeners are ready before the transport starts.
    socket.connect();

    const sendInputNow = (force = false) => {
      if (!socket.connected) return;

      const now = performance.now();
      const minInterval =
        typeof document !== "undefined" && document.hidden
          ? INPUT_HEARTBEAT_MS
          : INPUT_SEND_INTERVAL_MS;
      const elapsed = now - lastInputSentAtRef.current;

      if (!force && elapsed < minInterval) return;

      const you = predictedYouRef.current || worldRef.current.you;
      // A dead player is a spectator. Do not keep sending stale movement
      // packets while their camera follows the killer.
      if (you?.alive === false) return;
      const mouse = mouseRef.current;
      const mouseWorldX = you ? you.x + (mouse.x - window.innerWidth / 2) : 0;
      const mouseWorldY = you ? you.y + (mouse.y - window.innerHeight / 2) : 0;
      const mobileMove = mobileMoveRef.current || { x: 0, y: 0, active: false };

      const input = {
        seq: inputSeqRef.current + 1,
        dt: Math.min(50, Math.max(1, elapsed)),
        clientSentAt: now,
        w: Boolean(
          keysRef.current.w ||
          keysRef.current.arrowup ||
          (mobileMove.active && mobileMove.y < -0.22),
        ),
        a: Boolean(
          keysRef.current.a ||
          keysRef.current.arrowleft ||
          (mobileMove.active && mobileMove.x < -0.22),
        ),
        s: Boolean(
          keysRef.current.s ||
          keysRef.current.arrowdown ||
          (mobileMove.active && mobileMove.y > 0.22),
        ),
        d: Boolean(
          keysRef.current.d ||
          keysRef.current.arrowright ||
          (mobileMove.active && mobileMove.x > 0.22),
        ),
        moveX: mobileMove.active ? mobileMove.x : 0,
        moveY: mobileMove.active ? mobileMove.y : 0,
        mobileMove: Boolean(mobileMove.active),
        attacking: Boolean(keysRef.current.mouseDown),
        shield: Boolean(keysRef.current.rightMouseDown),
        mouseX: mouseWorldX,
        mouseY: mouseWorldY,
      };

      const inputSignature = [
        input.w,
        input.a,
        input.s,
        input.d,
        input.mobileMove,
        Math.round(input.moveX * 100),
        Math.round(input.moveY * 100),
        input.attacking,
        input.shield,
        Math.round(input.mouseX / 8),
        Math.round(input.mouseY / 8),
      ].join("|");

      const hasActiveControl = Boolean(
        input.w || input.a || input.s || input.d || input.mobileMove || input.attacking || input.shield
      );

      // While a key/joystick is held, refresh the input at the gameplay cadence.
      // Only truly idle input is reduced to a heartbeat. This avoids delayed
      // starts/stops when a mobile radio or an overloaded browser drops a packet.
      if (
        !force &&
        !hasActiveControl &&
        inputSignature === lastInputSignatureRef.current &&
        elapsed < INPUT_HEARTBEAT_MS
      ) {
        return;
      }

      inputSeqRef.current = input.seq;
      lastInputSentAtRef.current = now;
      lastInputSignatureRef.current = inputSignature;

      // Input packets are replaceable. Dropping an outdated one under pressure
      // is preferable to queueing it behind newer movement commands.
      socket.emit("normal-pvp:input", input);
    };

    sendInputRef.current = sendInputNow;

    const inputTimer = window.setInterval(sendInputNow, INPUT_SEND_INTERVAL_MS);

    const hudTimer = window.setInterval(() => {
      const data = worldRef.current;
      setHudData({
        ...data,
        you: predictedYouRef.current || data.you,
        fps: fpsRef.current.value,
      });
    }, mobilePerformanceRef.current ? MOBILE_HUD_SYNC_INTERVAL_MS : HUD_SYNC_INTERVAL_MS);

    return () => {
      disposed = true;
      clearJoinRetry();
      window.clearInterval(inputTimer);
      window.clearInterval(hudTimer);
      socket.off("connect", handleConnect);
      socket.off("normal-pvp:combat", applyPrivateCombatEvent);
      socket.emit("normal-pvp:leave");
      socket.disconnect();
      socketRef.current = null;
      sendInputRef.current = () => {};
    };
  }, [user]);

  useEffect(() => {
    let rafId = 0;

    const tick = (now) => {
      const data = worldRef.current;
      const isMobilePerformance = mobilePerformanceRef.current;
      const renderLimits = isMobilePerformance ? MOBILE_RENDER_LIMITS : null;
      const dt = Math.min(
        0.05,
        Math.max(0.001, (now - lastFrameRef.current) / 1000),
      );
      lastFrameRef.current = now;

      fpsRef.current.frames += 1;
      if (now - fpsRef.current.lastAt >= 500) {
        fpsRef.current.value = Math.round(
          (fpsRef.current.frames * 1000) / (now - fpsRef.current.lastAt),
        );
        fpsRef.current.frames = 0;
        fpsRef.current.lastAt = now;
      }

      const worldWidth = data.worldWidth || WORLD_WIDTH_FALLBACK;
      const worldHeight = data.worldHeight || WORLD_HEIGHT_FALLBACK;
      const zoneRadius = data.safeZoneRadius || ZONE_RADIUS_FALLBACK;

      if (data.you) {
        const current = predictedYouRef.current || { ...data.you };
        const mobileMove = mobileMoveRef.current || {
          x: 0,
          y: 0,
          active: false,
        };
        const input = {
          w: Boolean(
            keysRef.current.w ||
            keysRef.current.arrowup ||
            (mobileMove.active && mobileMove.y < -0.22),
          ),
          a: Boolean(
            keysRef.current.a ||
            keysRef.current.arrowleft ||
            (mobileMove.active && mobileMove.x < -0.22),
          ),
          s: Boolean(
            keysRef.current.s ||
            keysRef.current.arrowdown ||
            (mobileMove.active && mobileMove.y > 0.22),
          ),
          d: Boolean(
            keysRef.current.d ||
            keysRef.current.arrowright ||
            (mobileMove.active && mobileMove.x > 0.22),
          ),
          moveX: mobileMove.active ? mobileMove.x : 0,
          moveY: mobileMove.active ? mobileMove.y : 0,
          mobileMove: Boolean(mobileMove.active),
          attacking: Boolean(keysRef.current.mouseDown),
          shield: Boolean(keysRef.current.rightMouseDown),
          mouseX: current.x + (mouseRef.current.x - window.innerWidth / 2),
          mouseY: current.y + (mouseRef.current.y - window.innerHeight / 2),
        };

        if (getMoveVectorFromInput(input).moving) {
          lastLocalMovementAtRef.current = now;
        }

        predictedYouRef.current = predictUnitFromInput(
          current,
          input,
          dt,
          worldWidth,
          worldHeight,
          zoneRadius,
        );

        const predicted = predictedYouRef.current;

        if (data.status === "playing" && predicted?.alive !== false) {
          const collectedOrbs = locallyCollectItems(
            stableOrbMapRef,
            hiddenOrbIdsRef,
            predicted,
            LOCAL_ORB_COLLECT_DISTANCE,
            now,
          );
          const collectedEnergy = locallyCollectItems(
            stableEnergyMapRef,
            hiddenEnergyIdsRef,
            predicted,
            LOCAL_ENERGY_COLLECT_DISTANCE,
            now,
          );
          const collectedCores = locallyCollectItems(
            stableCoreMapRef,
            hiddenCoreIdsRef,
            predicted,
            LOCAL_CORE_COLLECT_DISTANCE,
            now,
          );

          // Keep the hot render loop allocation-free when nothing was collected.
          // Item arrays are rebuilt only on a real visual collection event.
          worldRef.current.you =
            predictedYouRef.current || worldRef.current.you;
          if (collectedOrbs > 0 || collectedEnergy > 0 || collectedCores > 0) {
            worldRef.current = {
              ...worldRef.current,
              you: predictedYouRef.current || worldRef.current.you,
              orbs: [...stableOrbMapRef.current.values()].filter(
                (orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id),
              ),
              energyCells: [...stableEnergyMapRef.current.values()].filter(
                (cell) =>
                  !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id),
              ),
              cores: (worldRef.current.cores || []).filter(
                (core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id),
              ),
            };
          }
        }

        const wantsToAttack = Boolean(keysRef.current.mouseDown);
        const localCooldown = getLocalFireCooldown(predicted, now);

        if (
          data.status === "playing" &&
          wantsToAttack &&
          predicted?.alive !== false &&
          (predicted?.drones || 0) > 0 &&
          now - lastLocalProjectileAtRef.current >= localCooldown
        ) {
          const mouseWorldX =
            predicted.x + (mouseRef.current.x - window.innerWidth / 2);
          const mouseWorldY =
            predicted.y + (mouseRef.current.y - window.innerHeight / 2);
          const localProjectile = createLocalProjectile(
            predicted,
            mouseWorldX,
            mouseWorldY,
            now,
          );

          if (localProjectile) {
            projectilesRef.current.set(localProjectile.id, localProjectile);
            lastLocalProjectileAtRef.current = now;
          }
        }
      }

      const me = predictedYouRef.current || data.you;
      const remoteMap = remotePlayersRef.current;

      const isSpectating = Boolean(me && me.alive === false);
      const serverSpectatorTarget =
        data.spectatingPlayer?.alive !== false ? data.spectatingPlayer : null;

      const currentSpectatorTarget = isSpectating
        ? serverSpectatorTarget ||
          (data.spectatorTargetId
            ? (data.players || []).find(
                (p) => p?.id === data.spectatorTargetId && p?.alive !== false,
              )
            : null) ||
          (spectatorTargetRef.current?.alive !== false
            ? spectatorTargetRef.current
            : null) ||
          (data.players || []).find((p) => p?.alive !== false) ||
          null
        : null;

      if (currentSpectatorTarget) {
        spectatorTargetRef.current = currentSpectatorTarget;
      }

      const renderTime = now - SNAPSHOT_INTERPOLATION_DELAY_MS;
      const snapshotBuffers = remoteSnapshotBufferRef.current;
      const activeRemoteIds = new Set();

      for (const [id, buffer] of snapshotBuffers.entries()) {
        if (id === me?.id) continue;
        const interpolated = interpolateSnapshotBuffer(buffer, renderTime);
        if (!interpolated) continue;
        activeRemoteIds.add(id);
        remoteMap.set(id, {
          ...interpolated,
          x: interpolated.x,
          y: interpolated.y,
          attacking: Boolean(interpolated.attacking),
          shieldActive: Boolean(interpolated.shieldActive),
        });
      }

      for (const id of remoteMap.keys()) {
        if (!activeRemoteIds.has(id)) remoteMap.delete(id);
      }

      const projectileMap = projectilesRef.current;
      const incomingProjectiles = new Map(
        (data.projectiles || []).filter((p) => p?.id).map((p) => [p.id, p]),
      );

      for (const [id, current] of projectileMap.entries()) {
        projectileMap.set(id, advanceProjectile(current, dt));
      }

      for (const [id, target] of incomingProjectiles.entries()) {
        const current = projectileMap.get(id) || target;

        if (target.ownerId && target.ownerId === me?.id) {
          continue;
        }

        projectileMap.set(id, {
          ...target,
          localOnly: false,
          __seenAt: now,
          x: damp(current.x ?? target.x, target.x, PROJECTILE_SMOOTHING, dt),
          y: damp(current.y ?? target.y, target.y, PROJECTILE_SMOOTHING, dt),
        });
      }

      const projectileTargets = [me, ...remoteMap.values()].filter(Boolean);

      for (const [id, projectile] of projectileMap.entries()) {
        const isIncoming = incomingProjectiles.has(id);
        const age = now - (projectile.createdAt || projectile.__seenAt || now);
        const missingAge = now - (projectile.__seenAt || now);
        const traveled = getProjectileTravelDistance(projectile);

        const visuallyHitTarget = projectileHitsAnyTarget(
          projectile,
          projectileTargets,
        );

        if (projectile.localOnly) {
          if (
            age > PROJECTILE_VISUAL_TTL ||
            traveled > LOCAL_PROJECTILE_MAX_DISTANCE ||
            (visuallyHitTarget && age > LOCAL_PROJECTILE_MIN_VISUAL_MS)
          ) {
            projectileMap.delete(id);
          }

          continue;
        }

        if (
          visuallyHitTarget ||
          age > PROJECTILE_VISUAL_TTL ||
          traveled > LOCAL_PROJECTILE_MAX_DISTANCE ||
          (!isIncoming && missingAge > SERVER_PROJECTILE_FADE_TTL)
        ) {
          projectileMap.delete(id);
        }
      }

      const spectatedFromRemote = currentSpectatorTarget?.id
        ? remoteMap.get(currentSpectatorTarget.id) || currentSpectatorTarget
        : null;

      const liveCameraSubject = isSpectating
        ? spectatedFromRemote || currentSpectatorTarget || me
        : me;

      const liveYou = isSpectating
        ? liveCameraSubject && liveCameraSubject.id !== me?.id
          ? {
              ...liveCameraSubject,
              skin: normalizeSkin(
                liveCameraSubject.skin || getSelectedSkin(user),
              ),
            }
          : null
        : me?.alive !== false
          ? { ...me, skin: normalizeSkin(me?.skin || getSelectedSkin(user)) }
          : null;

      const liveIsMobileLike =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(hover: none)").matches;
      const liveCameraScale = liveIsMobileLike ? PVP_MOBILE_CAMERA_SCALE : PVP_DESKTOP_CAMERA_SCALE;
      const liveCameraX = liveCameraSubject
        ? viewport.width / 2 - liveCameraSubject.x * liveCameraScale
        : 0;
      const liveCameraY = liveCameraSubject
        ? viewport.height / 2 - liveCameraSubject.y * liveCameraScale
        : 0;

      const liveBounds = getViewportBounds(
        liveCameraX,
        liveCameraY,
        viewport,
        980,
        liveCameraScale,
      );
      const livePlayers = collectVisible(
        remoteMap.values(),
        (player) =>
          player?.id !== liveYou?.id && isVisible(player, liveBounds, 380),
        renderLimits?.players || MAX_VISIBLE_REMOTE_PLAYERS,
        (player) => ({
          ...player,
          skin: normalizeSkin(player.skin),
          isBot: false,
        }),
      );
      const liveOrbs = collectVisible(
        stableOrbMapRef.current.values(),
        (orb) =>
          !isHiddenCollected(hiddenOrbIdsRef.current, orb.id) &&
          isVisible(orb, liveBounds, 45),
        renderLimits?.orbs || 240,
      );
      const liveEnergyCells = collectVisible(
        stableEnergyMapRef.current.values(),
        (cell) =>
          !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id) &&
          isVisible(cell, liveBounds, 70),
        renderLimits?.energy || 80,
      );
      const liveCores = collectVisible(
        data.cores || [],
        (core) =>
          !isHiddenCollected(hiddenCoreIdsRef.current, core.id) &&
          isVisible(core, liveBounds, 130),
        renderLimits?.cores || 9,
      );
      const liveProjectiles = collectVisible(
        projectileMap.values(),
        (projectile) => isVisible(projectile, liveBounds, 180),
        renderLimits?.projectiles || 45,
      );

      pixiLiveRef.current = {
        player: liveYou,
        players: livePlayers,
        bots: [],
        simpleBots: [],
        orbs: liveOrbs,
        energyCells: liveEnergyCells,
        cores: liveCores,
        projectiles: liveProjectiles,
        simpleProjectiles: [],
        // Keep combat text private even on the render hot path.
        combatEvents: (data.combatEvents || []).filter(
          (event) =>
            Boolean(data.you?.id || worldRef.current.you?.id) &&
            String(event?.viewerId || "") === String(data.you?.id || worldRef.current.you?.id || ""),
        ),
        combatViewerId: data.you?.id || worldRef.current.you?.id || null,
        combatEventsPrivate: true,
        cameraX: liveCameraX,
        cameraY: liveCameraY,
        scale: liveCameraScale,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        worldWidth,
        worldHeight,
        // Exact same cached premium space theme already used in BattleRoyaleMode.
        worldTheme: "premium-space-battle",
        safeZoneRadius: null,
        showZone: false,
        coreColorMap: coreColorMapRef.current,
        otherPlayerSize: 112,
        otherPlayerQuality: 0,
        staticItemBudget: isMobilePerformance ? 180 : 280,
      };

      if (
        now - lastRenderSyncRef.current >=
        (isMobilePerformance
          ? MOBILE_REACT_RENDER_SYNC_INTERVAL_MS
          : REACT_RENDER_SYNC_INTERVAL_MS)
      ) {
        lastRenderSyncRef.current = now;
        setRenderData({
          ...data,
          you: me,
          spectatingPlayer:
            currentSpectatorTarget || data.spectatingPlayer || null,
          players: Array.from(remoteMap.values()),
          projectiles: Array.from(projectileMap.values()),
          fps: fpsRef.current.value,
        });
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const movementKeys = new Set([
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ]);

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      event.preventDefault();
      keysRef.current[key] = true;
      sendInputRef.current(true);
    };

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (!movementKeys.has(key)) return;
      event.preventDefault();
      keysRef.current[key] = false;

      const mobileMove = mobileMoveRef.current || { active: false };
      const stillMoving = Boolean(
        mobileMove.active ||
        keysRef.current.w ||
        keysRef.current.a ||
        keysRef.current.s ||
        keysRef.current.d ||
        keysRef.current.arrowup ||
        keysRef.current.arrowdown ||
        keysRef.current.arrowleft ||
        keysRef.current.arrowright,
      );

      if (!stillMoving && predictedYouRef.current) {
        predictedYouRef.current = {
          ...predictedYouRef.current,
          moveX: 0,
          moveY: 0,
          isMoving: false,
        };
      }

      sendInputRef.current(true);
    };

    const onMouseMove = (event) => {
      mouseRef.current.x = event.clientX;
      mouseRef.current.y = event.clientY;
    };

    const onMouseDown = (event) => {
      if (event.button === 0) keysRef.current.mouseDown = true;
      if (event.button === 2) keysRef.current.rightMouseDown = true;
      sendInputRef.current(true);
    };

    const onMouseUp = (event) => {
      if (event.button === 0) keysRef.current.mouseDown = false;
      if (event.button === 2) keysRef.current.rightMouseDown = false;
      sendInputRef.current(true);
    };

    const onBlur = () => {
      keysRef.current = {};
      mobileMoveRef.current = { x: 0, y: 0, active: false };
      joystickPointerRef.current = null;
      attackPointerRef.current = null;
      shieldPointerRef.current = null;
      mobileJoystickActiveRef.current = false;
      setJoystickKnobTransform(0, 0);
      setMobileJoystick({ active: false, knobX: 0, knobY: 0 });
      setMobileAttackActive(false);
      setMobileShieldActive(false);
      if (predictedYouRef.current) {
        predictedYouRef.current = {
          ...predictedYouRef.current,
          moveX: 0,
          moveY: 0,
          isMoving: false,
          attacking: false,
        };
      }
      sendInputRef.current(true);
    };
    const onContextMenu = (event) => event.preventDefault();
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const nextMobile = isRealMobileDevice();
      mobilePerformanceRef.current = nextMobile;
      setIsMobileControls(nextMobile);

      if (!nextMobile) {
        mobileMoveRef.current = { x: 0, y: 0, active: false };
        joystickPointerRef.current = null;
        attackPointerRef.current = null;
        shieldPointerRef.current = null;
        keysRef.current.mouseDown = false;
        keysRef.current.rightMouseDown = false;
        mobileJoystickActiveRef.current = false;
        setJoystickKnobTransform(0, 0);
        setMobileJoystick({ active: false, knobX: 0, knobY: 0 });
        setMobileAttackActive(false);
        setMobileShieldActive(false);
        sendInputRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const getPointerLocalVector = (event, maxRadius = 96) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawX = event.clientX - cx;
    const rawY = event.clientY - cy;
    const distance = Math.hypot(rawX, rawY);
    const angle = distance > 0 ? Math.atan2(rawY, rawX) : 0;
    const clampedDistance = Math.min(maxRadius, distance);
    const knobX = distance > 0 ? Math.cos(angle) * clampedDistance : 0;
    const knobY = distance > 0 ? Math.sin(angle) * clampedDistance : 0;

    const deadZonePx = Math.max(5, maxRadius * 0.045);
    const fullSpeedAt = Math.max(deadZonePx + 1, maxRadius * 0.16);
    let power = 0;

    if (distance > deadZonePx) {
      const normalized = Math.min(
        1,
        (distance - deadZonePx) / (fullSpeedAt - deadZonePx),
      );
      power = distance >= fullSpeedAt ? 1 : Math.pow(normalized, 0.35);
    }

    return {
      knobX,
      knobY,
      x: distance > deadZonePx ? Math.cos(angle) * power : 0,
      y: distance > deadZonePx ? Math.sin(angle) * power : 0,
      power,
    };
  };

  const setJoystickKnobTransform = (knobX = 0, knobY = 0) => {
    const knob = joystickKnobRef.current;
    if (!knob) return;

    knob.style.transform = `translate3d(calc(-50% + ${Math.round(knobX)}px), calc(-50% + ${Math.round(knobY)}px), 0)`;
  };

  const updateJoystickFromPointer = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const vector = getPointerLocalVector(event, 96);
    const active = vector.power > 0.02;

    mobileMoveRef.current = {
      x: vector.x,
      y: vector.y,
      active,
    };

    // Fara setState la fiecare pointermove. Pe Android, 30 setState/sec aici
    // re-randau si HUD-ul/minimap-ul; acum mutam doar knob-ul prin compositor.
    setJoystickKnobTransform(vector.knobX, vector.knobY);
    if (mobileJoystickActiveRef.current !== active) {
      mobileJoystickActiveRef.current = active;
      setMobileJoystick({
        active,
        knobX: vector.knobX,
        knobY: vector.knobY,
      });
    }

    sendInputRef.current();
  };

  const stopJoystick = (event) => {
    event.preventDefault();
    if (
      joystickPointerRef.current !== null &&
      event.currentTarget.releasePointerCapture
    ) {
      try {
        event.currentTarget.releasePointerCapture(joystickPointerRef.current);
      } catch {}
    }
    joystickPointerRef.current = null;
    mobileMoveRef.current = { x: 0, y: 0, active: false };
    mobileJoystickActiveRef.current = false;
    setJoystickKnobTransform(0, 0);
    setMobileJoystick({ active: false, knobX: 0, knobY: 0 });

    if (predictedYouRef.current) {
      predictedYouRef.current = {
        ...predictedYouRef.current,
        moveX: 0,
        moveY: 0,
        isMoving: false,
      };
    }

    sendInputRef.current(true);
  };

  const onJoystickPointerDown = (event) => {
    event.preventDefault();
    joystickPointerRef.current = event.pointerId;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    updateJoystickFromPointer(event);
  };

  const onJoystickPointerMove = (event) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    updateJoystickFromPointer(event);
  };

  const syncMobileAimOverlay = () => {
    const line = mobileAimLineRef.current;
    const circle = mobileAimCircleRef.current;
    const arrow = mobileAimArrowRef.current;
    if (!line || !circle || !arrow || typeof window === "undefined") return;

    const x = Number(mouseRef.current?.x || window.innerWidth / 2);
    const y = Number(mouseRef.current?.y || window.innerHeight / 2);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;

    line.setAttribute("x1", String(cx));
    line.setAttribute("y1", String(cy));
    line.setAttribute("x2", String(x));
    line.setAttribute("y2", String(y));
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    arrow.setAttribute("transform", `translate(${x}, ${y}) rotate(${angle})`);
  };

  const updateMobileAimFromPointer = (event) => {
    mouseRef.current.x = event.clientX;
    mouseRef.current.y = event.clientY;
  };

  const updateMobileAimFromAttackButton = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawX = event.clientX - cx;
    const rawY = event.clientY - cy;
    const distance = Math.hypot(rawX, rawY);

    let dirX;
    let dirY;

    if (distance > 8) {
      dirX = rawX / distance;
      dirY = rawY / distance;
      mobileAimDirRef.current = { x: dirX, y: dirY };
    } else {
      dirX = mobileAimDirRef.current.x || 1;
      dirY = mobileAimDirRef.current.y || 0;
    }

    const aimDistance = Math.max(
      220,
      Math.min(360, Math.min(window.innerWidth, window.innerHeight) * 0.42),
    );
    mouseRef.current.x = window.innerWidth / 2 + dirX * aimDistance;
    mouseRef.current.y = window.innerHeight / 2 + dirY * aimDistance;
    window.requestAnimationFrame(syncMobileAimOverlay);
  };

  const onAttackPointerDown = (event) => {
    event.preventDefault();
    attackPointerRef.current = event.pointerId;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    keysRef.current.mouseDown = false;
    updateMobileAimFromAttackButton(event);
    setMobileAttackActive(true);
    window.requestAnimationFrame(syncMobileAimOverlay);
    sendInputRef.current(true);
  };

  const onAttackPointerMove = (event) => {
    if (attackPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    keysRef.current.mouseDown = false;
    updateMobileAimFromAttackButton(event);
    sendInputRef.current();
  };

  const stopMobileAttack = (event) => {
    event.preventDefault();
    updateMobileAimFromAttackButton(event);

    if (
      attackPointerRef.current !== null &&
      event.currentTarget.releasePointerCapture
    ) {
      try {
        event.currentTarget.releasePointerCapture(attackPointerRef.current);
      } catch {}
    }

    attackPointerRef.current = null;
    setMobileAttackActive(false);

    keysRef.current.mouseDown = true;
    sendInputRef.current(true);

    window.setTimeout(() => {
      keysRef.current.mouseDown = false;
      sendInputRef.current(true);
    }, 90);
  };

  const onShieldPointerDown = (event) => {
    event.preventDefault();
    shieldPointerRef.current = event.pointerId;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    keysRef.current.rightMouseDown = true;
    setMobileShieldActive(true);
    sendInputRef.current(true);
  };

  const stopMobileShield = (event) => {
    event.preventDefault();
    if (
      shieldPointerRef.current !== null &&
      event.currentTarget.releasePointerCapture
    ) {
      try {
        event.currentTarget.releasePointerCapture(shieldPointerRef.current);
      } catch {}
    }
    shieldPointerRef.current = null;
    keysRef.current.rightMouseDown = false;
    setMobileShieldActive(false);
    sendInputRef.current(true);
  };

  const you = renderData.you;
  const hudYou = hudData.you || you;
  const worldWidth = renderData.worldWidth || WORLD_WIDTH_FALLBACK;
  const worldHeight = renderData.worldHeight || WORLD_HEIGHT_FALLBACK;
  const safeZoneRadius = renderData.safeZoneRadius || ZONE_RADIUS_FALLBACK;

  const isDead = Boolean(you && you.alive === false);
  const liveSpectatorCandidates = (renderData.players || []).filter(
    (player) => player?.alive !== false,
  );

  const serverSpectatingPlayer =
    renderData.spectatingPlayer?.alive !== false
      ? renderData.spectatingPlayer
      : null;

  const spectatorTarget = isDead
    ? serverSpectatingPlayer ||
      (renderData.spectatorTargetId
        ? liveSpectatorCandidates.find(
            (player) => player.id === renderData.spectatorTargetId,
          )
        : null) ||
      (spectatorTargetRef.current?.alive !== false
        ? liveSpectatorCandidates.find(
            (player) => player.id === spectatorTargetRef.current.id,
          ) || spectatorTargetRef.current
        : null) ||
      liveSpectatorCandidates[0] ||
      null
    : null;

  if (spectatorTarget) {
    spectatorTargetRef.current = spectatorTarget;
  }

  const cameraSubject = isDead ? spectatorTarget || you : you;

  // CAMERA / ZOOM - exactly the BattleRoyaleMode desktop framing.
  // Desktop: 0.72; mobile keeps its dedicated 0.82 combat framing.
  const cameraScale = isMobileControls
    ? PVP_MOBILE_CAMERA_SCALE
    : PVP_DESKTOP_CAMERA_SCALE;

  const cameraX = cameraSubject
    ? viewport.width / 2 - cameraSubject.x * cameraScale
    : 0;
  const cameraY = cameraSubject
    ? viewport.height / 2 - cameraSubject.y * cameraScale
    : 0;
  const bounds = getViewportBounds(
    cameraX,
    cameraY,
    viewport,
    720,
    cameraScale,
  );

  const reactiveRenderLimits = isMobileControls ? MOBILE_RENDER_LIMITS : null;
  const visibleOrbs = collectVisible(
    renderData.orbs || [],
    (orb) => isVisible(orb, bounds, 40),
    reactiveRenderLimits?.orbs || 240,
  );
  const visibleEnergyCells = collectVisible(
    renderData.energyCells || [],
    (cell) => isVisible(cell, bounds, 60),
    reactiveRenderLimits?.energy || 80,
  );
  const visibleCores = collectVisible(
    renderData.cores || [],
    (core) => isVisible(core, bounds, 120),
    reactiveRenderLimits?.cores || 9,
  );
  const visiblePlayers = collectVisible(
    renderData.players || [],
    (player) => isVisible(player, bounds, 360),
    reactiveRenderLimits?.players || MAX_VISIBLE_REMOTE_PLAYERS,
  );
  const visibleProjectiles = collectVisible(
    renderData.projectiles || [],
    (projectile) => isVisible(projectile, bounds, 160),
    reactiveRenderLimits?.projectiles || 45,
  );

  const rendererPlayer =
    isDead && spectatorTarget
      ? {
          ...spectatorTarget,
          skin: normalizeSkin(spectatorTarget.skin || getSelectedSkin(user)),
          isSpectatorTarget: true,
        }
      : you?.alive !== false
        ? {
            ...you,
            skin: normalizeSkin(you?.skin || getSelectedSkin(user)),
          }
        : null;

  const rendererPlayers = visiblePlayers
    .filter((player) => player?.id !== rendererPlayer?.id)
    .map((player) => ({
      ...player,
      skin: normalizeSkin(player.skin),
      isBot: false,
    }));

  const activeBadges = useMemo(() => getActiveEffectBadges(hudYou), [hudYou]);
  const leaderboard = hudData.leaderboard || renderData.leaderboard || [];
  const status = hudData.status || renderData.status || "connecting";
  const isWaiting = status === "waiting" || status === "connecting";
  const isCountdown = status === "countdown";
  const isMatchmaking = isWaiting || isCountdown;
  const isFinished = status === "finished";
  const playersAlive = hudData.playerCount || renderData.playerCount || 1;
  const minPlayers = hudData.minPlayers || renderData.minPlayers || 2;
  const maxPlayers = hudData.maxPlayers || renderData.maxPlayers || 2;
  const countdown = hudData.countdown || renderData.countdown || 5;
  const winnerName = hudData.winnerName || renderData.winnerName;
  const coreDropCountdown =
    hudData.coreDropCountdown || renderData.coreDropCountdown;

  // IMPORTANT: cand meciul se termina (status === "finished"), nu mai
  // asteptam un click manual pe "EXIT TO MENU" - scoatem automat jucatorul
  // din sesiune, dupa un mic delay ca sa poata citi cine a castigat.
  useEffect(() => {
    if (!isFinished) return;

    const timeout = window.setTimeout(() => {
      if (onExitToMenu) onExitToMenu();
    }, 6000);

    return () => window.clearTimeout(timeout);
  }, [isFinished, onExitToMenu]);

  const matchStartedAt = hudData.matchStartedAt || renderData.matchStartedAt;
  const zoneShrinkDuration =
    hudData.zoneShrinkDuration || renderData.zoneShrinkDuration || 600000;

  const zoneRemainingMs = matchStartedAt
    ? Math.max(0, zoneShrinkDuration - (Date.now() - matchStartedAt))
    : zoneShrinkDuration;
  const zoneRemainingMinutes = Math.floor(zoneRemainingMs / 60000);
  const zoneRemainingSeconds = Math.floor((zoneRemainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  const hp = hudYou?.hp ?? 100;
  const maxHp = hudYou?.maxHp ?? 100;
  const energy = hudYou?.energy ?? 100;
  const progress = hudYou?.progress ?? 0;
  const nextDroneAt = hudYou?.nextDroneAt ?? 5;

  return (
    <div
      className={`game-arena pvp-dom-arena normal-pvp-dom-arena ${isMobileControls ? "is-mobile is-mobile-device is-mobile-portrait" : ""} ${mobileAttackActive ? "is-mobile-attacking" : ""}`}
    >
      {isMatchmaking && !connectionError && (
        <div className="normal-pvp-matchmaking-screen">
          <div className="normal-pvp-matchmaking-card">
            <div className="normal-pvp-loader" />
            <h1>{isCountdown ? "MATCH STARTS IN" : "WAITING FOR PLAYERS"}</h1>
            <strong>
              {isCountdown
                ? countdown
                : `${Math.min(playersAlive, minPlayers)} / ${minPlayers}`}
            </strong>
            <p>
              {isCountdown
                ? "Jucatorii au fost gasiti. Pregateste-te!"
                : "Se pregateste sesiunea Normal PvP..."}
            </p>
          </div>
        </div>
      )}

      <PixiArenaRenderer
        player={rendererPlayer}
        players={rendererPlayers}
        orbs={visibleOrbs}
        energyCells={visibleEnergyCells}
        cores={visibleCores}
        projectiles={visibleProjectiles}
        combatEvents={(renderData.combatEvents || []).filter(
          (event) =>
            Boolean(renderData.you?.id || worldRef.current.you?.id) &&
            String(event?.viewerId || "") === String(renderData.you?.id || worldRef.current.you?.id || ""),
        )}
        combatViewerId={renderData.you?.id || worldRef.current.you?.id || null}
        combatEventsPrivate
        cameraX={cameraX}
        cameraY={cameraY}
        scale={cameraScale}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        coreTypes={CORE_TYPES}
        otherPlayerSize={112}
        otherPlayerQuality={0}
        staticItemBudget={isMobileControls ? 180 : 280}
        liveDataRef={pixiLiveRef}
        forceLowQuality={graphicsQuality === "low" || isMobileControls}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        worldTheme="premium-space-battle"
        showZone={false}
      />

      {isMobileControls && (
        <style>{`
          .normal-pvp-dom-arena .aim-svg.mobile-aim-svg,
          .zone-pvp-dom-arena .aim-svg.mobile-aim-svg {
            display: block !important;
            pointer-events: none !important;
            touch-action: none !important;
            z-index: 64 !important;
          }
        `}</style>
      )}

      {you && !isDead && (!isMobileControls || mobileAttackActive) && (
        <svg className={`aim-svg ${isMobileControls ? "mobile-aim-svg" : ""}`} aria-hidden="true">
          <line
            className="aim-svg-line"
            ref={mobileAimLineRef}
            x1={viewport.width / 2}
            y1={viewport.height / 2}
            x2={mouseRef.current.x}
            y2={mouseRef.current.y}
          />
          <circle
            className="aim-svg-circle"
            ref={mobileAimCircleRef}
            cx={mouseRef.current.x}
            cy={mouseRef.current.y}
            r="34"
          />
          <g
            className="aim-svg-arrow"
            ref={mobileAimArrowRef}
            transform={`translate(${mouseRef.current.x}, ${mouseRef.current.y}) rotate(${(Math.atan2(mouseRef.current.y - viewport.height / 2, mouseRef.current.x - viewport.width / 2) * 180) / Math.PI})`}
          >
            <path d="M -15 -11 L 18 0 L -15 11 L -7 0 Z" />
          </g>
        </svg>
      )}

      <div className={`fps-counter ${renderData.fps < 50 ? "fps-low" : ""}`}>
        FPS: {renderData.fps || 60}
      </div>

      <div className="hp-panel">
        <span>DRONE HP</span>
        <strong>
          {hp} / {maxHp}
        </strong>
        <div className="hp-bar">
          <i
            style={{
              width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`,
            }}
          />
        </div>

        <div className="energy-row">
          <span>DRONE ENERGY</span>
          <strong>{energy}</strong>
          <div className="energy-bar">
            <i style={{ width: `${Math.max(0, Math.min(100, energy))}%` }} />
          </div>
        </div>
      </div>

      <div className="collect-counter">
        <span>ORB COUNT</span>
        <strong>
          {progress} / {nextDroneAt}
        </strong>
        <small>Total collected: {hudYou?.totalCollected ?? 0}</small>
        <small>Kills: {hudYou?.kills ?? 0}</small>
        <div className="active-cores-panel">
          <b>ACTIVE CORES</b>
          {activeBadges.length === 0 ? (
            <em>NO ACTIVE CORES</em>
          ) : (
            activeBadges.map((badge) => (
              <em
                key={badge.key}
                className={`core-badge core-badge-${badge.className}`}
              >
                {badge.label}
                {badge.seconds !== null ? ` ${badge.seconds}s` : ""}
              </em>
            ))
          )}
        </div>
      </div>

      <div className="alive-counter pvp-alive-counter normal-pvp-top-hud">
        <strong>PLAYERS ALIVE: {playersAlive}</strong>
        <span>
          {isFinished
            ? `Winner: ${winnerName || "Player"}`
            : `Max ${maxPlayers} players`}
        </span>
      </div>

      <div className="real-leaderboard">
        <h3>LEADERBOARD</h3>
        {(leaderboard || []).slice(0, 8).map((item, index) => (
          <div
            key={item.id || index}
            className={`real-leaderboard-row ${item.id === hudYou?.id ? "is-me" : ""} ${item.alive === false ? "is-dead" : ""}`}
          >
            <span>
              {index + 1}. {item.username || "Player"}
            </span>
            <strong>
              {item.kills ?? 0}K / {item.totalCollected ?? item.score ?? 0}
            </strong>
          </div>
        ))}
      </div>

      {cameraSubject && (
        <MemoizedMiniMap
          player={cameraSubject}
          worldWidth={worldWidth}
          worldHeight={worldHeight}
          orbs={renderData.minimapOrbs || []}
          cores={renderData.minimapCores || renderData.cores || []}
          safeZoneRadius={safeZoneRadius}
          players={renderData.players || []}
        />
      )}

      {coreDropCountdown && (
        <div className="core-notice core-notice-overclock normal-pvp-core-drop-notice">
          <strong>Core incoming</strong>
          <b>{coreDropCountdown}</b>
          <span>Power cores entering the arena.</span>
        </div>
      )}

      {connectionError && (
        <div className="pvp-waiting-panel">
          <h1>Connection error</h1>
          <p className="pvp-error">{connectionError}</p>
        </div>
      )}

      {isDead && !isFinished && (
        <div className="normal-pvp-death-panel">
          <div className="normal-pvp-death-card">
            <h1>AI FOST ELIMINAT</h1>
            <p>
              {spectatorTarget
                ? `Urmaresti: ${spectatorTarget.username || "player"}`
                : "Se asteapta un jucator viu de urmarit"}
            </p>

            <div className="normal-pvp-death-stats">
              <span>KILLS</span>
              <strong>{hudYou?.kills ?? 0}</strong>
            </div>

            <button type="button" onClick={onExitToMenu}>
              EXIT TO MENU
            </button>
          </div>
        </div>
      )}

      {isFinished && (
        <div className="game-over-screen pvp-finished-screen">
          <h1>{winnerName ? `${winnerName} WINS` : "MATCH FINISHED"}</h1>
          <p>
            {hudYou?.id === (hudData.winnerId || renderData.winnerId)
              ? "Ai castigat meciul."
              : "Meciul s-a terminat."}
          </p>
          <p className="normal-pvp-finished-auto-exit">
            Revenire automata la meniu in cateva secunde...
          </p>
          <button onClick={onExitToMenu}>EXIT TO MENU</button>
        </div>
      )}

      {isMobileControls && !isDead && !isMatchmaking && (
        <div
          className="pvp-mobile-controls mobile-controls"
          aria-label="Mobile PvP controls"
        >
          <div
            className={`pvp-mobile-joystick mobile-joystick ${mobileJoystick.active ? "is-active" : ""}`}
            onPointerDown={onJoystickPointerDown}
            onPointerMove={onJoystickPointerMove}
            onPointerUp={stopJoystick}
            onPointerCancel={stopJoystick}
            style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
          >
            <div className="pvp-mobile-joystick-ring" />
            <div
              ref={joystickKnobRef}
              className="pvp-mobile-joystick-knob mobile-joystick-knob"
              style={{
                transform: `translate3d(calc(-50% + ${mobileJoystick.knobX}px), calc(-50% + ${mobileJoystick.knobY}px), 0)`,
                willChange: "transform",
              }}
            />
          </div>

          <div className="pvp-mobile-buttons mobile-action-row">
            <button
              type="button"
              className={`pvp-mobile-action pvp-mobile-shield mobile-action-btn mobile-shield-btn ${mobileShieldActive ? "is-active" : ""}`}
              onPointerDown={onShieldPointerDown}
              onPointerUp={stopMobileShield}
              onPointerCancel={stopMobileShield}
              style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
            >
              SHIELD
            </button>

            <button
              type="button"
              className={`pvp-mobile-action pvp-mobile-attack mobile-action-btn mobile-attack-btn ${mobileAttackActive ? "is-active is-aiming" : ""}`}
              onPointerDown={onAttackPointerDown}
              onPointerMove={onAttackPointerMove}
              onPointerUp={stopMobileAttack}
              onPointerCancel={stopMobileAttack}
              style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
            >
              ATTACK
            </button>
          </div>
        </div>
      )}

      <button className="pvp-exit-btn" onClick={onExitToMenu}>
        EXIT TO MENU
      </button>
    </div>
  );
}

export default NormalPvpArena;
