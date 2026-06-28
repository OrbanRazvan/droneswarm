import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import MiniMap from "../MiniMap/MiniMap";
import PixiArenaRenderer from "../PixiArenaRenderer/PixiArenaRenderer";
import "../GameArena/GameArena.css";
import "./ZonePvpArena.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const WORLD_WIDTH_FALLBACK = 14000;
const WORLD_HEIGHT_FALLBACK = 14000;
const ZONE_RADIUS_FALLBACK = 7050;

// GameArena movement: 2.8 px / 60fps frame ~= 168 px/sec.
// Daca backend-ul tau ruleaza la 30 ticks/sec, PLAYER_SPEED pe server trebuie sa fie 5.6.
// VITEZA DRONEI PRINCIPALE IN PVP.
// Identic cu Normal PvP, ca senzatia de miscare sa fie aceeasi.
const GAME_FRAME_SPEED = 2.6;
const CLIENT_SPEED = GAME_FRAME_SPEED * 60;

// Zone PvP now uses the same combat progression pacing as Normal PvP.
const ZONE_BASE_MOVE_SPEED_MULTIPLIER = 1.08;
const ZONE_BASE_ATTACK_DRONE_SPEED_MULTIPLIER = 1.12;

// Delta-time smoothing. Valorile sunt "pe secunda", nu pe frame.
// Asta inseamna ca jocul se simte la fel la 45 FPS, 60 FPS sau 144 FPS.
const SELF_CORRECTION_MOVING = 0.22;
const SELF_CORRECTION_IDLE = 0;
const SELF_SNAP_DISTANCE = 0.25;
const SELF_HARD_SNAP_DISTANCE = 420;
const SELF_MAX_CORRECTION_SPEED = 1400; // px/sec - viteza maxima cu care predictia se "trage" spre server
const SELF_IDLE_FREEZE_DISTANCE = 360;

// Remote transforms arrive in a tiny binary lane at 30 Hz and are rendered at the
// display refresh rate. A 38 ms interpolation window protects against packet jitter
// without the old 80-150 ms visual delay from full JSON snapshots.
// Direct WebSocket transforms are kept only a few milliseconds behind.  The
// velocity field carries the visible movement between packets, so an old phone
// sees continuous motion rather than a 30 Hz step or a large visual delay.
const REMOTE_SMOOTHING = 42;
const REMOTE_PREDICTION = 1.0;
const REMOTE_HARD_SNAP_DISTANCE = 900;
const REMOTE_MAX_EXTRAPOLATE_MS = 180;
const REMOTE_PRESENTATION_LEAD_MS = 22;
const REMOTE_FOLLOW_RESPONSE = 56;
const REMOTE_STALE_TIMEOUT_MS = 850;
const ZONE_BINARY_PROTOCOL_VERSION = 1;
const ZONE_BINARY_PLAYER_BYTES = 32;
const ZONE_BINARY_PROJECTILE_BYTES = 28;

// Projectile transforms use their own authoritative motion record. A projectile is
// advanced every display frame and corrected toward the newest server position;
// it is never repeatedly pulled back to a stale 25-40 Hz packet.
const PROJECTILE_SMOOTHING = 72;
const PROJECTILE_REMOTE_HARD_RESYNC_DISTANCE = 180;
const PROJECTILE_REMOTE_MAX_AHEAD_MS = 260;
const PROJECTILE_MOVEMENT_STALE_MS = 900;
const PROJECTILE_FRAME_SCALE = 60;
const PROJECTILE_VISUAL_TTL = 10000;
const LOCAL_PROJECTILE_MIN_VISUAL_MS = 85;
const SERVER_PROJECTILE_FADE_TTL = 10000;
const LOCAL_PROJECTILE_MAX_DISTANCE = 4200;
const PROJECTILE_HIT_VISUAL_RADIUS = 118;
const LOCAL_PROJECTILE_SPEED = 4.4;
const FIRE_COOLDOWN = 3000;
const BATTLE_PREPARE_DURATION = 10000; // 10-second peace phase before combat.
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
const INPUT_SEND_INTERVAL_MS = 33;
const INPUT_HEARTBEAT_MS = 220;
const SNAPSHOT_INTERPOLATION_DELAY_MS = 16;
const SNAPSHOT_BUFFER_TTL_MS = 420;

// Keep PvP desktop framing exactly locked to BattleRoyaleMode.
// BattleRoyaleMode uses 0.72 on desktop; do not change only one mode or the
// perceived camera height will differ between PvE and PvP.
const BATTLE_ROYALE_DESKTOP_CAMERA_SCALE = 0.72;
const PVP_DESKTOP_CAMERA_SCALE = BATTLE_ROYALE_DESKTOP_CAMERA_SCALE;

// Mobile remains intentionally farther out so controls do not hide the fight.
const PVP_MOBILE_CAMERA_SCALE = 0.82;
const MAX_PENDING_INPUTS = 90;

const MAX_VISIBLE_REMOTE_PLAYERS = 60;

// Mobile browsers can finish their initial Engine.IO connection before the
// first gameplay event is processed. Zone admission is idempotent on the
// backend, so retry the join request in a short bounded cadence until the
// server confirms this exact socket is inside a room.
const ZONE_JOIN_RETRY_DELAYS_MS = [350, 700, 1200, 1800, 2600, 3600];

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
};

function normalizeSkin(skin) {
  const clean = String(skin || "cyan").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (!clean || clean === "basic" || clean === "basic-drone") return "cyan";
  return clean;
}

function getSelectedSkin(user) {
  if (user?.isGuest) return "cyan";
  return normalizeSkin(user?.selectedSkin || user?.selectedDroneSkin || user?.selectedDrone || user?.skin || "cyan");
}

function getDisplayName(user) {
  return user?.username || user?.firstName || user?.email?.split("@")?.[0] || "Player";
}

function isRealMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const isPhoneUa = /Android.*Mobile|iPhone|iPod|IEMobile|Opera Mini/i.test(ua);
  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const isPortrait = window.innerHeight >= window.innerWidth;

  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const longSide = Math.max(window.innerWidth, window.innerHeight);

  return Boolean(
    isPhoneUa &&
    hasTouch &&
    isPortrait &&
    shortSide <= 980 &&
    longSide <= 2600
  );
}

function isConstrainedDesktopDevice() {
  if (typeof navigator === "undefined") return false;
  if (isRealMobileDevice()) return false;

  const cores = Number(navigator.hardwareConcurrency || 4);
  const memory = typeof navigator.deviceMemory === "number"
    ? Number(navigator.deviceMemory)
    : null;

  // This only selects nearby-object budgets. The Pixi renderer now starts
  // older office laptops in the premium visual profile and adapts from real
  // frame time instead of permanently removing the background.
  return cores <= 4 || (memory !== null && memory <= 6);
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

function dampPoint(currentX, currentY, targetX, targetY, lambda, dt, snapDistance = 0, hardSnapDistance = Infinity) {
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
function dampPointCapped(currentX, currentY, targetX, targetY, lambda, dt, snapDistance, hardSnapDistance, maxSpeed) {
  const distance = Math.hypot(targetX - currentX, targetY - currentY);

  if (distance <= snapDistance) {
    return { x: targetX, y: targetY };
  }

  if (distance >= hardSnapDistance) {
    return { x: targetX, y: targetY };
  }

  const damped = dampPoint(currentX, currentY, targetX, targetY, lambda, dt, 0, Infinity);
  const dampedStepDistance = Math.hypot(damped.x - currentX, damped.y - currentY);
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

function keepInsideSafeZone(x, y, radius, worldWidth, worldHeight, margin = 70, allowOutsideZone = false) {
  // Pentru Zone PvP vrem ca playerul sa poata intra in zona periculoasa.
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

// Viewport loot packets are authoritative snapshots, not append-only events.
// Replacing this map prevents old visible items from surviving their removal
// TTL and then disappearing in a batch while the player is moving.
function replaceStableItems(previousMap, incoming = [], now) {
  previousMap.clear();

  for (const item of incoming || []) {
    if (!item?.id) continue;
    previousMap.set(item.id, {
      ...item,
      __seenAt: now,
    });
  }

  return previousMap;
}


// Combat events have their own reliable socket channel. Keep a small local
// cache because high-frequency world snapshots are intentionally volatile.
// The Map deduplicates the direct event and the later state-snapshot copy.
function mergePrivateCombatEvents(previousMap, incoming = [], viewerId, now = Date.now()) {
  const activeViewerId = viewerId ? String(viewerId) : "";

  const hasEquivalentRecentEvent = (candidate) => {
    const candidateText = String(candidate?.text || "");
    const candidateKind = String(candidate?.kind || "");
    const candidateAt = Number(candidate?.createdAt || now);

    for (const existing of previousMap.values()) {
      if (String(existing?.viewerId || activeViewerId) !== activeViewerId) continue;
      if (String(existing?.text || "") !== candidateText) continue;
      if (String(existing?.kind || "") !== candidateKind) continue;

      const existingAt = Number(existing?.createdAt || now);
      // A reliable combat event and its client-side fallback can arrive in
      // either order. Treat them as one visual event when they describe the
      // same action within this short network window.
      if (Math.abs(candidateAt - existingAt) <= 900) return true;
    }

    return false;
  };

  for (const event of incoming || []) {
    if (!event?.id || !activeViewerId) continue;
    const eventViewerId = String(event.viewerId || activeViewerId);
    if (eventViewerId !== activeViewerId) continue;

    const createdAt = Number(event.createdAt || now);
    const ttl = Math.max(300, Number(event.ttl || 2000));
    if (now - createdAt >= ttl) continue;

    const normalized = {
      ...event,
      viewerId: activeViewerId,
      createdAt,
      ttl,
    };

    // Snapshot copies keep the same id and are naturally deduplicated by the
    // map. Fallback events use another id, so dedupe their semantic duplicate
    // before adding it.
    if (!previousMap.has(normalized.id) && hasEquivalentRecentEvent(normalized)) {
      continue;
    }

    previousMap.set(normalized.id, normalized);
  }

  for (const [id, event] of previousMap.entries()) {
    const createdAt = Number(event?.createdAt || now);
    const ttl = Math.max(300, Number(event?.ttl || 2000));
    if (now - createdAt >= ttl + 260) previousMap.delete(id);
  }

  return previousMap;
}

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

  // Energy-cell feedback is emitted by the backend through the reliable
  // `*:combat` socket event. Do not synthesize it again from the following
  // state snapshot, otherwise a single pickup is rendered twice.
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
  const [primary, secondary, dark, highlight, glow] = DRONE_SKIN_THEMES[normalizeSkin(skin)] || DRONE_SKIN_THEMES.cyan;
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
    badges.push({ key, label, seconds: Math.ceil((until - now) / 1000), className });
  };
  const addReady = (key, label, className) => badges.push({ key, label, seconds: null, className });

  if (unit.nanoCoreActive) addReady("nano", "NANO CORE", "nano");
  if (unit.rotorCoreActive) addReady("rotor", "ROTOR CORE", "rotor");
  if (unit.swarmCoreActive) addReady("swarm", "SWARM CORE", "swarm");
  if ((unit.piercingShots || 0) > 0) addReady("piercing", `PIERCING x${unit.piercingShots}`, "piercing");
  if ((unit.shieldBreakerShots || 0) > 0) addReady("shield-breaker", `SHIELD BREAKER x${unit.shieldBreakerShots}`, "shield-breaker");

  addTimed("overclock", "OVERCLOCK", unit.overclockUntil, "overclock");
  addTimed("berserk", "BERSERK", unit.berserkUntil, "berserk");
  addTimed("vampire", "VAMPIRE", unit.vampireUntil, "vampire");
  addTimed("emp", "EMP", unit.empPulseUntil, "emp");
  addTimed("rapid", "RAPID FIRE", unit.rapidFireUntil, "rapid");

  return badges.slice(0, 2);
}

function getViewportBounds(cameraX, cameraY, viewport, padding = 650, scale = 1) {
  const safeScale = Math.max(0.2, Number(scale || 1));

  return {
    left: (-cameraX - padding) / safeScale,
    right: (viewport.width - cameraX + padding) / safeScale,
    top: (-cameraY - padding) / safeScale,
    bottom: (viewport.height - cameraY + padding) / safeScale,
  };
}

function isVisible(item, bounds, radius = 0) {
  return item && item.x + radius >= bounds.left && item.x - radius <= bounds.right && item.y + radius >= bounds.top && item.y - radius <= bounds.bottom;
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

  projectile.x = Number(projectile.x || 0) + Number(projectile.vx || 0) * dt * PROJECTILE_FRAME_SCALE;
  projectile.y = Number(projectile.y || 0) + Number(projectile.vy || 0) * dt * PROJECTILE_FRAME_SCALE;
  return projectile;
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

  // Same kill-streak attack cadence as Normal PvP.
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
    ZONE_BASE_ATTACK_DRONE_SPEED_MULTIPLIER *
    Math.max(1, Number(unit?.attackDroneSpeedMultiplier || 1))
  );
}

function projectileHitsAnyTarget(projectile, targets = []) {
  if (!projectile) return false;

  for (const target of targets) {
    if (!target || target.alive === false || target.id === projectile.ownerId) continue;

    const dx = (target.x || 0) - (projectile.x || 0);
    const dy = (target.y || 0) - (projectile.y || 0);

    if (dx * dx + dy * dy <= PROJECTILE_HIT_VISUAL_RADIUS * PROJECTILE_HIT_VISUAL_RADIUS) {
      return true;
    }
  }

  return false;
}

function createLocalProjectile(unit, mouseWorldX, mouseWorldY, now, fallbackSkin = "cyan") {
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
    // Never use the renderer default cyan while the self metadata is still
    // arriving. The selected/owner skin is known locally at fire time.
    skin: normalizeSkin(unit.skin || fallbackSkin || "cyan"),
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

function predictUnitFromInput(unit, input, dt, worldWidth, worldHeight, zoneRadius) {
  if (!unit || unit.alive === false) return unit;

  const move = getMoveVectorFromInput(input);
  const safeDt = Math.min(0.05, Math.max(0, dt || 0));
  let nextX = unit.x || 0;
  let nextY = unit.y || 0;

  if (move.moving && (unit.energy ?? 1) > 0) {
    const moveSpeed =
      CLIENT_SPEED *
      ZONE_BASE_MOVE_SPEED_MULTIPLIER *
      Math.max(1, Number(unit.moveSpeedMultiplier || 1));
    nextX += move.nx * moveSpeed * safeDt;
    nextY += move.ny * moveSpeed * safeDt;
  }

  // Replays the server-approved physical hit immediately at 60Hz, so the
  // local drone visibly jumps away just like Battle Royale instead of waiting
  // for a state snapshot from Render.
  const frameScale = safeDt * 60;
  const pushX = Number(unit.knockbackX || 0);
  const pushY = Number(unit.knockbackY || 0);
  const pushPower = Math.hypot(pushX, pushY);
  const hasCollisionPush = pushPower >= NETWORK_COLLISION_PUSH_MIN;
  if (hasCollisionPush) {
    nextX += pushX * frameScale;
    nextY += pushY * frameScale;
  }

  const safe = keepInsideSafeZone(
    nextX,
    nextY,
    zoneRadius || ZONE_RADIUS_FALLBACK,
    worldWidth || WORLD_WIDTH_FALLBACK,
    worldHeight || WORLD_HEIGHT_FALLBACK,
    70,
    true
  );

  return {
    ...unit,
    x: safe.x,
    y: safe.y,
    moveX: move.moving ? move.nx : 0,
    moveY: move.moving ? move.ny : 0,
    isMoving: move.moving,
    moveAngle: move.moving ? Math.atan2(move.dy, move.dx) : unit.moveAngle ?? 0,
    attacking: Boolean(input.attacking),
    shieldActive: Boolean(unit.shieldActive || input.shield),
    knockbackX: hasCollisionPush
      ? pushX * Math.pow(NETWORK_COLLISION_PUSH_DECAY, frameScale)
      : 0,
    knockbackY: hasCollisionPush
      ? pushY * Math.pow(NETWORK_COLLISION_PUSH_DECAY, frameScale)
      : 0,
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

// Mirrors the server's decaying contact impulse. This is not client-side collision
// detection; Zone receives it only after the backend validates a real drone hit.
const NETWORK_COLLISION_PUSH_DECAY = 0.95;
const NETWORK_COLLISION_PUSH_MIN = 0.035;

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
    knockbackX: Math.abs(Number(server.knockbackX || 0)) > Math.abs(Number(local.knockbackX || 0))
      ? Number(server.knockbackX || 0)
      : Number(local.knockbackX || 0),
    knockbackY: Math.abs(Number(server.knockbackY || 0)) > Math.abs(Number(local.knockbackY || 0))
      ? Number(server.knockbackY || 0)
      : Number(local.knockbackY || 0),
    collisionVersion: Math.max(Number(local.collisionVersion || 0), Number(server.collisionVersion || 0)),
    serverX: server.x,
    serverY: server.y,
  };
}

function getRemoteVelocity(snapshot) {
  const fallbackSpeed =
    CLIENT_SPEED *
    ZONE_BASE_MOVE_SPEED_MULTIPLIER *
    Math.max(1, Number(snapshot?.moveSpeedMultiplier || 1));

  return {
    x: Number.isFinite(Number(snapshot?.velocityX))
      ? Number(snapshot.velocityX)
      : Number(snapshot?.moveX || 0) * fallbackSpeed,
    y: Number.isFinite(Number(snapshot?.velocityY))
      ? Number(snapshot.velocityY)
      : Number(snapshot?.moveY || 0) * fallbackSpeed,
  };
}

function extrapolateRemoteSnapshot(snapshot, aheadMs = 0) {
  if (!snapshot) return snapshot;

  // Keep prediction very short. Long prediction was causing the remote drone
  // to move ahead and then visibly jump backwards when a phone changed input.
  const safeAheadMs = clamp(Number(aheadMs || 0), 0, REMOTE_MAX_EXTRAPOLATE_MS);
  if (!snapshot.isMoving || safeAheadMs <= 0) return snapshot;

  const velocity = getRemoteVelocity(snapshot);
  const seconds = (safeAheadMs / 1000) * REMOTE_PREDICTION;

  return {
    ...snapshot,
    x: Number(snapshot.x || 0) + velocity.x * seconds,
    y: Number(snapshot.y || 0) + velocity.y * seconds,
  };
}

function cubicHermite(p0, v0, p1, v1, t, durationSeconds) {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * p0 + h10 * durationSeconds * v0 + h01 * p1 + h11 * durationSeconds * v1;
}

function getSnapshotTimelineTime(snapshot, fallbackTime) {
  const serverAt = Number(snapshot?.__serverAt || 0);
  return serverAt > 0 ? serverAt : Number(snapshot?.__receivedAt || fallbackTime);
}

function appendRemoteSnapshot(buffer = [], snapshot, receivedAt, serverNow = 0) {
  if (!snapshot?.id) return buffer;

  const previous = buffer[buffer.length - 1] || null;
  // The packet-level tick timestamp is shared by every player in the packet.
  // Prefer it over a per-unit serialization timestamp to keep the buffer on
  // one timeline even when state and movement packets arrive in a different order.
  const incomingServerAt = Number(serverNow || snapshot?.__serverAt || snapshot?.serverTime || 0);
  const previousServerAt = Number(previous?.__serverAt || 0);

  // Never let a delayed full-state packet pull a newer transform backwards.
  if (incomingServerAt > 0 && previousServerAt > 0 && incomingServerAt < previousServerAt) {
    return buffer;
  }

  const merged = {
    ...(previous || {}),
    ...snapshot,
    __receivedAt: receivedAt,
    __serverAt: incomingServerAt || previousServerAt || 0,
  };

  // A full state and a lightweight transform can represent the same tick.
  // Merge them, rather than creating a zero-duration interpolation segment.
  if (incomingServerAt > 0 && previousServerAt > 0 && incomingServerAt === previousServerAt) {
    return [...buffer.slice(0, -1), {
      ...merged,
      __receivedAt: previous.__receivedAt,
      __serverAt: previousServerAt,
    }];
  }

  return [...buffer, merged]
    .filter((entry) => receivedAt - Number(entry?.__receivedAt || receivedAt) <= SNAPSHOT_BUFFER_TTL_MS)
    .slice(-8);
}

function interpolateSnapshotBuffer(buffer = [], renderTimelineTime) {
  if (!buffer.length) return null;

  const newest = buffer[buffer.length - 1];
  const newestTime = getSnapshotTimelineTime(newest, renderTimelineTime);
  if (buffer.length === 1) {
    return extrapolateRemoteSnapshot(newest, renderTimelineTime - newestTime);
  }

  if (renderTimelineTime >= newestTime) {
    return extrapolateRemoteSnapshot(newest, renderTimelineTime - newestTime);
  }

  let older = buffer[0];
  let newer = newest;
  for (let i = 0; i < buffer.length - 1; i += 1) {
    const a = buffer[i];
    const b = buffer[i + 1];
    const aTime = getSnapshotTimelineTime(a, renderTimelineTime);
    const bTime = getSnapshotTimelineTime(b, renderTimelineTime);
    if (aTime <= renderTimelineTime && bTime >= renderTimelineTime) {
      older = a;
      newer = b;
      break;
    }
  }

  const aTime = getSnapshotTimelineTime(older, renderTimelineTime);
  const bTime = getSnapshotTimelineTime(newer, aTime);
  const span = Math.max(1, bTime - aTime);
  const t = clamp((renderTimelineTime - aTime) / span, 0, 1);
  const durationSeconds = span / 1000;
  const oldVelocity = getRemoteVelocity(older);
  const newVelocity = getRemoteVelocity(newer);

  // Velocity-aware Hermite interpolation maintains a continuous trajectory
  // between authoritative transforms. It is much smoother than plain linear
  // interpolation when the sender runs at a lower frame rate.
  return {
    ...newer,
    x: cubicHermite(Number(older.x ?? newer.x ?? 0), oldVelocity.x, Number(newer.x ?? older.x ?? 0), newVelocity.x, t, durationSeconds),
    y: cubicHermite(Number(older.y ?? newer.y ?? 0), oldVelocity.y, Number(newer.y ?? older.y ?? 0), newVelocity.y, t, durationSeconds),
    hp: newer.hp,
    energy: newer.energy,
    drones: newer.drones,
    alive: newer.alive,
  };
}


// Compact Zone PvP transform lane ------------------------------------------------
// Each remote entity is represented by one mutable motion record. This avoids
// allocating 60 snapshot arrays 30 times/sec on an older laptop. The renderer
// predicts from the last authoritative velocity every rAF, so 50 FPS still
// looks continuous instead of showing a 30 Hz step.
function decodeZonePlayerRow(row, meta = {}) {
  if (!Array.isArray(row)) return { ...(meta || {}), ...(row || {}) };
  const flags = Number(row[6] || 0);
  const netId = Number(row[0] || 0);
  return {
    ...(meta || {}),
    id: meta?.id || zoneNetKey(netId),
    netId,
    x: Number(row[1] || 0),
    y: Number(row[2] || 0),
    velocityX: Number(row[3] || 0),
    velocityY: Number(row[4] || 0),
    moveAngle: Number(row[5] || 0),
    isMoving: Boolean(flags & 1),
    attacking: Boolean(flags & 2),
    shieldActive: Boolean(flags & 4),
    alive: Boolean(flags & 8),
    isBot: Boolean(flags & 16) || Boolean(meta?.isBot),
    drones: Number(row[7] ?? meta?.drones ?? 0),
    skin: normalizeSkin(meta?.skin || 'cyan'),
  };
}

function decodeZoneProjectileRow(row, meta = {}) {
  if (!Array.isArray(row)) return { ...(meta || {}), ...(row || {}) };
  const flags = Number(row[7] || 0);
  const netId = Number(row[0] || 0);
  const ownerNetId = Number(row[1] || 0);
  return {
    ...(meta || {}),
    id: meta?.id || zoneNetKey(netId),
    netId,
    ownerId: meta?.ownerId || zoneNetKey(ownerNetId),
    ownerNetId,
    x: Number(row[2] || 0),
    y: Number(row[3] || 0),
    vx: Number(row[4] || 0),
    vy: Number(row[5] || 0),
    angle: Number(row[6] || 0),
    pierceLeft: flags & 1 ? 2 : Number(meta?.pierceLeft || 1),
    shieldBreaker: Boolean(flags & 2),
    piercesShield: Boolean(flags & 4),
    createdAt: Number(row[8] || meta?.createdAt || Date.now()),
    // q[9] is the authoritative owner skin sent with the first hot transform.
    // Metadata remains a fallback for old backend instances during a deploy.
    skin: normalizeSkin(row[9] || meta?.skin || 'cyan'),
  };
}

function upsertRemoteMotion(map, incoming, receivedAt, serverAt = 0, metadataOnly = false) {
  if (!incoming?.id) return null;
  const id = String(incoming.id);
  const previous = map.get(id);
  const incomingServerAt = Number(serverAt || incoming?.__serverAt || 0);

  if (metadataOnly && previous) {
    const merged = { ...previous, ...incoming, id, skin: normalizeSkin(incoming.skin || previous.skin || 'cyan') };
    map.set(id, merged);
    return merged;
  }

  if (
    previous &&
    incomingServerAt > 0 &&
    Number(previous.serverAt || 0) > incomingServerAt
  ) {
    const merged = { ...previous, ...incoming, id, skin: normalizeSkin(incoming.skin || previous.skin || 'cyan') };
    map.set(id, merged);
    return merged;
  }

  const sourceX = Number(incoming.x ?? previous?.sourceX ?? previous?.x ?? 0);
  const sourceY = Number(incoming.y ?? previous?.sourceY ?? previous?.y ?? 0);
  const next = {
    ...(previous || {}),
    ...incoming,
    id,
    skin: normalizeSkin(incoming.skin || previous?.skin || 'cyan'),
    sourceX,
    sourceY,
    velocityX: Number(incoming.velocityX ?? previous?.velocityX ?? 0),
    velocityY: Number(incoming.velocityY ?? previous?.velocityY ?? 0),
    serverAt: incomingServerAt || Number(previous?.serverAt || 0),
    receivedAt,
    lastSeenAt: receivedAt,
    renderX: previous?.ready ? Number(previous.renderX) : sourceX,
    renderY: previous?.ready ? Number(previous.renderY) : sourceY,
    ready: Boolean(previous?.ready),
  };
  map.set(id, next);
  return next;
}

function resolveRemoteMotion(motion, now, dt) {
  if (!motion) return null;
  const ageMs = clamp(now - Number(motion.receivedAt || now) + REMOTE_PRESENTATION_LEAD_MS, 0, REMOTE_MAX_EXTRAPOLATE_MS);
  const moving = Boolean(motion.isMoving);
  const targetX = Number(motion.sourceX || 0) + (moving ? Number(motion.velocityX || 0) * (ageMs / 1000) : 0);
  const targetY = Number(motion.sourceY || 0) + (moving ? Number(motion.velocityY || 0) * (ageMs / 1000) : 0);

  if (!motion.ready) {
    motion.renderX = targetX;
    motion.renderY = targetY;
    motion.ready = true;
  } else {
    const distance = Math.hypot(targetX - Number(motion.renderX || 0), targetY - Number(motion.renderY || 0));
    if (distance >= REMOTE_HARD_SNAP_DISTANCE) {
      motion.renderX = targetX;
      motion.renderY = targetY;
    } else {
      const follow = 1 - Math.exp(-REMOTE_FOLLOW_RESPONSE * Math.max(0.001, dt));
      motion.renderX += (targetX - motion.renderX) * follow;
      motion.renderY += (targetY - motion.renderY) * follow;
    }
  }

  // Keep the same object identity in the render map. This avoids allocating
  // 50-60 new drone objects every animation frame on an older laptop.
  motion.x = Number(motion.renderX || 0);
  motion.y = Number(motion.renderY || 0);
  return motion;
}

function upsertZoneProjectileMotion(map, incoming, receivedAt, serverAt = 0) {
  if (!incoming?.id) return null;

  const id = String(incoming.id);
  const previous = map.get(id);
  const incomingServerAt = Number(serverAt || incoming?.__serverAt || 0);

  // A delayed definition packet must never replace a newer hot transform.
  if (previous && incomingServerAt > 0 && Number(previous.serverAt || 0) > incomingServerAt) {
    previous.skin = normalizeSkin(incoming.skin || previous.skin || "cyan");
    previous.ownerId = incoming.ownerId || previous.ownerId;
    previous.pierceLeft = incoming.pierceLeft ?? previous.pierceLeft;
    previous.shieldBreaker = Boolean(incoming.shieldBreaker ?? previous.shieldBreaker);
    previous.piercesShield = Boolean(incoming.piercesShield ?? previous.piercesShield);
    return previous;
  }

  const sourceX = Number(incoming.x ?? previous?.sourceX ?? previous?.x ?? 0);
  const sourceY = Number(incoming.y ?? previous?.sourceY ?? previous?.y ?? 0);
  const next = previous || {};

  Object.assign(next, incoming, {
    id,
    skin: normalizeSkin(incoming.skin || previous?.skin || "cyan"),
    sourceX,
    sourceY,
    vx: Number(incoming.vx ?? previous?.vx ?? 0),
    vy: Number(incoming.vy ?? previous?.vy ?? 0),
    serverAt: incomingServerAt || Number(previous?.serverAt || 0),
    receivedAt,
    lastSeenAt: receivedAt,
    renderX: previous?.ready ? Number(previous.renderX) : sourceX,
    renderY: previous?.ready ? Number(previous.renderY) : sourceY,
    ready: Boolean(previous?.ready),
    localOnly: false,
  });

  map.set(id, next);
  return next;
}

function resolveZoneProjectileMotion(motion, now, dt) {
  if (!motion) return null;

  const ageMs = clamp(
    now - Number(motion.receivedAt || now) + 12,
    0,
    PROJECTILE_REMOTE_MAX_AHEAD_MS,
  );
  const targetX = Number(motion.sourceX || 0) + Number(motion.vx || 0) * (ageMs / 1000) * PROJECTILE_FRAME_SCALE;
  const targetY = Number(motion.sourceY || 0) + Number(motion.vy || 0) * (ageMs / 1000) * PROJECTILE_FRAME_SCALE;

  if (!motion.ready) {
    motion.renderX = targetX;
    motion.renderY = targetY;
    motion.ready = true;
  } else {
    const dx = targetX - Number(motion.renderX || 0);
    const dy = targetY - Number(motion.renderY || 0);
    const distance = Math.hypot(dx, dy);
    if (distance >= PROJECTILE_REMOTE_HARD_RESYNC_DISTANCE) {
      motion.renderX = targetX;
      motion.renderY = targetY;
    } else {
      const follow = 1 - Math.exp(-PROJECTILE_SMOOTHING * Math.max(0.001, dt));
      motion.renderX += dx * follow;
      motion.renderY += dy * follow;
    }
  }

  motion.x = Number(motion.renderX || 0);
  motion.y = Number(motion.renderY || 0);
  return motion;
}

function getBattlePrepareRemainingMs(data = {}) {
  if (!data || data.status !== "playing") return 0;

  const explicitRemaining = Number(data.battlePrepareRemainingMs);
  if (Number.isFinite(explicitRemaining) && explicitRemaining > 0) {
    return explicitRemaining;
  }

  const prepareUntil = Number(data.battlePrepareUntil);
  if (Number.isFinite(prepareUntil) && prepareUntil > 0) {
    return Math.max(0, prepareUntil - Date.now());
  }

  const matchStartedAt = Number(data.matchStartedAt);
  if (Number.isFinite(matchStartedAt) && matchStartedAt > 0) {
    return Math.max(0, BATTLE_PREPARE_DURATION - (Date.now() - matchStartedAt));
  }

  return 0;
}

function isBattlePrepareLocked(data = {}) {
  return getBattlePrepareRemainingMs(data) > 0;
}

function getBattleBeginFlashActive(data = {}) {
  if (!data?.battleBeginFlashUntil) return false;
  return Date.now() < Number(data.battleBeginFlashUntil);
}

// Zone PvP state packets are frequent and can be volatile. A stale countdown
// packet arriving after PLAYING must never put a live match back behind the
// matchmaking overlay. The backend supplies phaseVersion; the rank guard is a
// second safety net for any packet missing that field.
const ZONE_STATUS_RANK = Object.freeze({
  connecting: -1,
  waiting: 0,
  countdown: 1,
  playing: 2,
  finished: 3,
});

function getZoneStatusRank(status) {
  return ZONE_STATUS_RANK[String(status || "connecting")] ?? -1;
}

function shouldAcceptZonePhase(current, incoming = {}) {
  const incomingRoomId = incoming?.roomId ? String(incoming.roomId) : "";
  const currentRoomId = current?.roomId ? String(current.roomId) : "";
  const incomingVersion = Number(incoming?.phaseVersion || 0);
  const currentVersion = Number(current?.phaseVersion ?? -1);
  const incomingRank = getZoneStatusRank(incoming?.status);
  const currentRank = getZoneStatusRank(current?.status);

  // Once a round has started, a retry/reconnect packet from a fresh lobby
  // must never replace the live round on screen. Only an explicit Exit creates
  // a fresh component and therefore a fresh phase ref.
  if (
    currentRank >= ZONE_STATUS_RANK.playing &&
    incomingRoomId &&
    currentRoomId &&
    incomingRoomId !== currentRoomId
  ) {
    return false;
  }

  // Before the match starts a different room is a valid new lobby.
  if (incomingRoomId && currentRoomId && incomingRoomId !== currentRoomId) {
    return true;
  }

  if (incomingVersion < currentVersion) return false;
  if (incomingVersion === currentVersion && incomingRank < currentRank) return false;

  // Extra protection for packets produced by an older server without a
  // phaseVersion. Once PLAYING/FINISHED is seen, never accept lobby states.
  if (currentRank >= ZONE_STATUS_RANK.playing && incomingRank < ZONE_STATUS_RANK.playing) {
    return false;
  }

  return true;
}

const ZONE_PVP_RESUME_STORAGE_KEY = "drone-swarm:zone-pvp-resume-v1";

function createZonePvpResumeToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function getZonePvpResumeToken() {
  if (typeof window === "undefined") return createZonePvpResumeToken();

  try {
    const existing = String(window.sessionStorage.getItem(ZONE_PVP_RESUME_STORAGE_KEY) || "").trim();
    if (/^[A-Za-z0-9_-]{20,160}$/.test(existing)) return existing;

    const next = createZonePvpResumeToken();
    window.sessionStorage.setItem(ZONE_PVP_RESUME_STORAGE_KEY, next);
    return next;
  } catch {
    return createZonePvpResumeToken();
  }
}

function clearZonePvpResumeToken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ZONE_PVP_RESUME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private-browser modes. The server-side
    // explicit leave still removes the resumable seat in that case.
  }
}

function FlyingAttackDrone({ projectile }) {
  const skin = normalizeSkin(projectile.skin || "cyan");
  const angle = projectile.angle || Math.atan2(projectile.vy || 0, projectile.vx || 1);

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
      <div className="fad-rotor fad-tl"><span /></div>
      <div className="fad-rotor fad-tr"><span /></div>
      <div className="fad-rotor fad-bl"><span /></div>
      <div className="fad-rotor fad-br"><span /></div>
      <div className="fad-shell" />
      <div className="fad-light" />
    </div>
  );
}


function zoneNetKey(netId) {
  return `zone-net:${Number(netId || 0)}`;
}

function toZoneBinaryArrayBuffer(payload) {
  if (!payload) return null;
  if (payload instanceof ArrayBuffer) return payload;
  if (ArrayBuffer.isView(payload)) {
    return payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
  }
  if (payload?.buffer instanceof ArrayBuffer) {
    const byteOffset = Number(payload.byteOffset || 0);
    const byteLength = Number(payload.byteLength || payload.buffer.byteLength);
    return payload.buffer.slice(byteOffset, byteOffset + byteLength);
  }
  return null;
}

function ZonePvpArena({ user, onExitToMenu, graphicsQuality = "normal" }) {
  // The Dashboard can recreate `user` while its own HUD refreshes. Networking
  // must not treat that render as a new arena or emit a leave event.
  const userRef = useRef(user);
  userRef.current = user;
  const resumeTokenRef = useRef(getZonePvpResumeToken());
  const intentionalExitRef = useRef(false);
  const explicitLeaveSentRef = useRef(false);
  const explicitExitFinishedRef = useRef(false);
  const explicitExitTimerRef = useRef(null);
  const socketRef = useRef(null);
  // Join state is deliberately separate from socket.connected. A mobile
  // transport may be connected while its first join packet was delayed.
  const zoneJoinAcceptedRef = useRef(false);
  const zoneJoinAttemptRef = useRef(0);
  const zoneJoinRetryTimerRef = useRef(null);
  // The resume identity is updated only by an authoritative room state. It is
  // sent on reconnect so the backend never creates a second "ghost" lobby.
  const zoneResumeIdentityRef = useRef({ roomId: null, playerId: null });
  const lastZonePacketAtRef = useRef(performance.now());
  const lastZoneResyncAtRef = useRef(0);
  const zoneResyncTimerRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastFrameRef = useRef(performance.now());
  const fpsRef = useRef({ frames: 0, lastAt: performance.now(), value: 60 });
  const lastRenderSyncRef = useRef(0);
  const mobilePerformanceRef = useRef(isRealMobileDevice());
  // Weak desktop hardware uses the same protected render path as older phones:
  // fewer expensive shells, all other drones as cheap live markers.
  const constrainedDesktopRef = useRef(isConstrainedDesktopDevice());
  const pixiLiveRef = useRef(null);
  const coreColorMapRef = useRef(
    CORE_TYPES.reduce((acc, core) => {
      acc[core.type] = core.color;
      return acc;
    }, {})
  );
  const worldElementRef = useRef(null);
  const zoneElementRef = useRef(null);
  const zoneSmokeElementRef = useRef(null);
  const sendInputRef = useRef(() => {});
  const inputSeqRef = useRef(0);
  const lastInputSentAtRef = useRef(performance.now());
  const lastLocalMovementAtRef = useRef(performance.now());
  const lastInputSignatureRef = useRef("");
  const hadActiveControlRef = useRef(false);
  const pendingInputsRef = useRef([]);
  // Socket events can arrive in a burst after a weak phone is busy. Keep only
  // the newest transform packet and consume it on the next animation frame.
  const latestMovementPacketRef = useRef(null);
  const movementFlushRafRef = useRef(0);
  const remoteSnapshotBufferRef = useRef(new Map());
  const remoteMotionRef = useRef(new Map());
  // Projectiles have the same high-rate latest-wins transform stream as drones.
  // Keeping these transforms outside React is essential on older phones.
  const projectileMovementRef = useRef(new Map());
  // Low-frequency definitions carry names/skins/owner ids once. The compact
  // JSON tuple lane carries only numeric positions, velocities and flags.
  const zoneEntityMetaRef = useRef(new Map());
  const zoneProjectileMetaRef = useRef(new Map());
  // Interpolate with the authoritative server clock rather than browser packet
  // arrival time, which varies far more with mobile/old-laptop senders.
  const serverClockOffsetRef = useRef(null);
  const lastMovementSequenceRef = useRef(0);
  const lastCollisionVersionRef = useRef(0);
  const lastConfirmedHpRef = useRef(null);
  const lastCollectionSeqRef = useRef(0);
  const localBattlePrepareUntilRef = useRef(0);
  const localBattleBeginFlashUntilRef = useRef(0);
  const battlePrepareWasVisibleRef = useRef(false);
  const battleBeginTimerRef = useRef(null);
  const lastArenaStatusRef = useRef("connecting");
  const zonePhaseRef = useRef({
    roomId: null,
    roundId: null,
    phaseVersion: -1,
    status: "connecting",
    lockedRoomId: null,
  });
  const combatEventMapRef = useRef(new Map());
  // Last authoritative self snapshot. This is visual-only fallback state for
  // the same instant WebGL combat feedback used by Battle Royale.
  const selfCombatSnapshotRef = useRef(null);

  const mobileMoveRef = useRef({ x: 0, y: 0, active: false });
  const joystickPointerRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const mobileJoystickActiveRef = useRef(false);
  const attackPointerRef = useRef(null);
  const shieldPointerRef = useRef(null);
  const mobileAimDirRef = useRef({ x: 1, y: 0 });
  const mobileAimLineRef = useRef(null);
  const mobileAimCircleRef = useRef(null);
  const mobileAimArrowRef = useRef(null);

  const worldRef = useRef({
    roomId: null,
    roundId: null,
    phaseVersion: -1,
    status: "connecting",
    playerCount: 0,
    minPlayers: 3,
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
    // Server sends these short-lived events; Pixi animates them in world space.
    combatEvents: [],
    leaderboard: [],
  });

  const predictedYouRef = useRef(null);
  const spectatorTargetRef = useRef(null);
  const remotePlayersRef = useRef(new Map());
  const remoteActiveIdsRef = useRef(new Set());
  const renderSelectionRef = useRef({
    nextAt: 0,
    remote: [],
    detailed: [],
    simple: [],
    players: [],
    bots: [],
    orbs: [],
    energy: [],
    cores: [],
    projectiles: [],
    simpleProjectiles: [],
    combatEvents: [],
  });
  const pixiFrameRef = useRef({});
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

  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isMobileControls, setIsMobileControls] = useState(() => isRealMobileDevice());
  const [renderData, setRenderData] = useState(() => ({ ...worldRef.current, fps: 60 }));
  const [hudData, setHudData] = useState(() => ({ ...worldRef.current, fps: 60 }));
  const [connectionError, setConnectionError] = useState("");
  const [mobileJoystick, setMobileJoystick] = useState({ active: false, knobX: 0, knobY: 0 });
  const [mobileAttackActive, setMobileAttackActive] = useState(false);
  const [mobileShieldActive, setMobileShieldActive] = useState(false);
  const [battleBeginFlashUntil, setBattleBeginFlashUntil] = useState(0);

  useEffect(() => {
    // Zone PvP uses direct WebSocket. Polling can queue HTTP packets behind
    // loot/HUD traffic and is the main cause of slow-motion remote drones.
    const socket = io(API_URL, {
      autoConnect: false,
      // Start on WebSocket for latency, but keep long-polling as a real
      // fallback. A proxy/Wi-Fi WebSocket reset must not eject a live player.
      transports: ["websocket", "polling"],
      upgrade: true,
      tryAllTransports: true,
      rememberUpgrade: true,
      withCredentials: false,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 650,
      reconnectionDelayMax: 3500,
      randomizationFactor: 0.18,
    });

    socketRef.current = socket;
    let disposed = false;

    const clearExplicitExitTimer = () => {
      if (explicitExitTimerRef.current) {
        window.clearTimeout(explicitExitTimerRef.current);
        explicitExitTimerRef.current = null;
      }
    };

    const clearZoneJoinRetry = () => {
      if (zoneJoinRetryTimerRef.current) {
        window.clearTimeout(zoneJoinRetryTimerRef.current);
        zoneJoinRetryTimerRef.current = null;
      }
    };

    const markZoneJoinAccepted = (confirmation = {}) => {
      const confirmedPlayerId = confirmation?.playerId || confirmation?.you?.id;
      if (confirmedPlayerId && socket.id && String(confirmedPlayerId) !== String(socket.id)) return;
      zoneJoinAcceptedRef.current = true;
      zoneJoinAttemptRef.current = 0;
      clearZoneJoinRetry();
    };

    const getZoneJoinPayload = () => {
      const currentUser = userRef.current;
      const identity = zoneResumeIdentityRef.current || {};
      const resumeRoomId = identity.roomId ? String(identity.roomId) : null;
      const resumePlayerId = identity.playerId ? String(identity.playerId) : null;
      return {
        userId: currentUser?.isGuest ? null : currentUser?.id,
        isGuest: Boolean(currentUser?.isGuest),
        username: getDisplayName(currentUser),
        skin: getSelectedSkin(currentUser),
        resumeToken: resumeTokenRef.current,
        resumeRoomId,
        resumePlayerId,
        // Once a round has been seen, reconnect may restore only that exact
        // seat. The server must never silently create another room.
        resumeOnly: Boolean(resumeRoomId && resumePlayerId),
      };
    };

    const requestZoneJoin = () => {
      if (disposed || zoneJoinAcceptedRef.current || !socket.connected) return;

      socket.emit("zone-pvp:join", getZoneJoinPayload());
      const attempt = zoneJoinAttemptRef.current;
      zoneJoinAttemptRef.current = attempt + 1;
      clearZoneJoinRetry();

      const retryDelay = ZONE_JOIN_RETRY_DELAYS_MS[
        Math.min(attempt, ZONE_JOIN_RETRY_DELAYS_MS.length - 1)
      ];
      zoneJoinRetryTimerRef.current = window.setTimeout(() => {
        requestZoneJoin();
      }, retryDelay);
    };

    const requestZoneResync = () => {
      if (disposed || !socket.connected) return;
      const identity = zoneResumeIdentityRef.current || {};
      const payload = {
        ...getZoneJoinPayload(),
        roomId: identity.roomId || null,
        playerId: identity.playerId || null,
        resumeOnly: Boolean(identity.roomId && identity.playerId),
      };
      socket.emit("zone-pvp:resync", payload);
    };

    const updateServerClockOffset = (serverNow) => {
      const serverTime = Number(serverNow || 0);
      if (!serverTime) return;

      const observedOffset = Date.now() - serverTime;
      const current = Number(serverClockOffsetRef.current);
      if (!Number.isFinite(current)) {
        serverClockOffsetRef.current = observedOffset;
        return;
      }

      // Follow the actual clock offset in both directions. One-way correction
      // left a strong viewer permanently behind after a late packet from a
      // mobile or low-end laptop.
      const boundedDelta = clamp(observedOffset - current, -5, 5);
      serverClockOffsetRef.current = current + boundedDelta * 0.16;
    };

    const applyState = (state) => {
      if (!state || !shouldAcceptZonePhase(zonePhaseRef.current, state)) {
        return;
      }

      // zone-pvp:joined and the following authoritative state both prove that
      // this socket is in a room. Stop the idempotent mobile join retry loop.
      markZoneJoinAccepted(state);

      const incomingRoomId = state?.roomId ? String(state.roomId) : "";
      const currentRoomId = zonePhaseRef.current?.roomId ? String(zonePhaseRef.current.roomId) : "";
      if (incomingRoomId && currentRoomId && incomingRoomId !== currentRoomId) {
        // Socket reconnected into a genuinely different room. Clear only
        // visual caches; the new authoritative state below repopulates them.
        combatEventMapRef.current.clear();
        selfCombatSnapshotRef.current = null;
        stableOrbMapRef.current.clear();
        stableEnergyMapRef.current.clear();
        stableMinimapOrbMapRef.current.clear();
        stableMinimapEnergyMapRef.current.clear();
        stableCoreMapRef.current.clear();
        remoteSnapshotBufferRef.current.clear();
        remoteMotionRef.current.clear();
        projectileMovementRef.current.clear();
        zoneEntityMetaRef.current.clear();
        zoneProjectileMetaRef.current.clear();
        serverClockOffsetRef.current = null;
        lastMovementSequenceRef.current = 0;
        lastCollisionVersionRef.current = 0;
        predictedYouRef.current = null;
      }

      zonePhaseRef.current = {
        roomId: incomingRoomId || zonePhaseRef.current.roomId || null,
        roundId: state?.roundId ? String(state.roundId) : zonePhaseRef.current.roundId || null,
        phaseVersion: Math.max(
          Number(zonePhaseRef.current.phaseVersion ?? -1),
          Number(state?.phaseVersion || 0),
        ),
        status: state?.status || zonePhaseRef.current.status || "connecting",
        lockedRoomId:
          state?.status === "playing" || state?.status === "finished"
            ? (incomingRoomId || zonePhaseRef.current.lockedRoomId || null)
            : zonePhaseRef.current.lockedRoomId || null,
      };

      const now = performance.now();
      const nowWall = Date.now();
      lastZonePacketAtRef.current = now;
      if (incomingRoomId && state?.you?.id) {
        zoneResumeIdentityRef.current = {
          roomId: incomingRoomId,
          playerId: String(state.you.id),
        };
      }
      updateServerClockOffset(state?.serverNow || state?.serverTime);

      // Definitions are small and rare. They make the binary transform lane
      // independent from repeated UUID/skin/owner JSON objects.
      for (const unit of Array.isArray(state?.players) ? state.players : []) {
        const netId = Number(unit?.netId || 0);
        if (netId > 0 && unit?.id) {
          const previousKey = zoneNetKey(netId);
          const currentKey = String(unit.id);
          zoneEntityMetaRef.current.set(netId, { ...unit });
          // A newly visible unit can receive a transform one packet before its
          // metadata. Merge that temporary numeric key instead of leaving a
          // second stale visual on screen.
          if (previousKey !== currentKey) {
            const buffered = remoteSnapshotBufferRef.current.get(previousKey);
            if (buffered) {
              remoteSnapshotBufferRef.current.delete(previousKey);
              remoteSnapshotBufferRef.current.set(currentKey, buffered.map((sample) => ({ ...sample, ...unit, id: currentKey })));
            }
            const pendingMotion = remoteMotionRef.current.get(previousKey);
            if (pendingMotion) {
              remoteMotionRef.current.delete(previousKey);
              remoteMotionRef.current.set(currentKey, { ...pendingMotion, ...unit, id: currentKey, skin: normalizeSkin(unit.skin || pendingMotion.skin || "cyan") });
            }
          }
        }
      }
      if (state?.spectatingPlayer?.netId && state?.spectatingPlayer?.id) {
        zoneEntityMetaRef.current.set(Number(state.spectatingPlayer.netId), { ...state.spectatingPlayer });
      }
      for (const projectile of Array.isArray(state?.projectiles) ? state.projectiles : []) {
        const netId = Number(projectile?.netId || 0);
        if (netId > 0 && projectile?.id) {
          const previousKey = zoneNetKey(netId);
          const currentKey = String(projectile.id);
          zoneProjectileMetaRef.current.set(netId, { ...projectile });
          if (previousKey !== currentKey) {
            // A transform can arrive one frame before the low-frequency
            // projectile definition. Migrate the mutable motion record instead
            // of cloning it, so one server projectile keeps one visual object.
            const temporary = projectileMovementRef.current.get(previousKey);
            if (temporary) {
              projectileMovementRef.current.delete(previousKey);
              temporary.id = currentKey;
              Object.assign(temporary, projectile);
              projectileMovementRef.current.set(currentKey, temporary);
            }

            const rendered = projectilesRef.current.get(previousKey);
            if (rendered) {
              projectilesRef.current.delete(previousKey);
              rendered.id = currentKey;
              Object.assign(rendered, projectile, { localOnly: false, __seenAt: now });
              if (!projectilesRef.current.has(currentKey)) projectilesRef.current.set(currentKey, rendered);
            }
          }
          upsertZoneProjectileMotion(
            projectileMovementRef.current,
            { ...projectile, id: currentKey },
            now,
            Number(state?.serverNow || state?.serverTime || 0),
          );
        }
      }

      const combatViewerId = state?.you?.id || worldRef.current.you?.id || socket.id;
      combatEventMapRef.current = mergePrivateCombatEvents(
        combatEventMapRef.current,
        Array.isArray(state?.combatEvents) ? state.combatEvents : [],
        combatViewerId,
        nowWall,
      );

      const fallbackCombatEvents = buildSelfCombatFallbackEvents(
        selfCombatSnapshotRef.current,
        state?.you,
        combatViewerId,
        nowWall,
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
          nowWall,
        );
      }

      // Sincronizare locala pentru PREPARE PHASE / BATTLE BEGIN.
      // Serverul ramane autoritar, dar tinem si un fallback local ca HUD-ul sa nu dispara
      // daca un packet ajunge fara battlePrepareRemainingMs/battlePrepareUntil.
      if (state?.status === "playing") {
        const serverPrepareRemaining = getBattlePrepareRemainingMs(state);
        const serverPrepareUntil = state.battlePrepareUntil ? Number(state.battlePrepareUntil) : 0;

        if (serverPrepareRemaining > 0 || serverPrepareUntil > nowWall) {
          localBattlePrepareUntilRef.current = serverPrepareUntil > nowWall
            ? serverPrepareUntil
            : nowWall + serverPrepareRemaining;

          localBattleBeginFlashUntilRef.current = state.battleBeginFlashUntil
            ? Number(state.battleBeginFlashUntil)
            : localBattlePrepareUntilRef.current + 1800;
        } else if (state.matchStartedAt) {
          const localPrepareUntil = Number(state.matchStartedAt) + BATTLE_PREPARE_DURATION;
          if (localPrepareUntil > nowWall) {
            localBattlePrepareUntilRef.current = Math.max(localBattlePrepareUntilRef.current || 0, localPrepareUntil);
            localBattleBeginFlashUntilRef.current = Math.max(localBattleBeginFlashUntilRef.current || 0, localPrepareUntil + 1800);
          }
        } else if (lastArenaStatusRef.current !== "playing" && !localBattlePrepareUntilRef.current) {
          localBattlePrepareUntilRef.current = nowWall + BATTLE_PREPARE_DURATION;
          localBattleBeginFlashUntilRef.current = localBattlePrepareUntilRef.current + 1800;
        }
      } else if (state?.status === "waiting" || state?.status === "countdown") {
        localBattlePrepareUntilRef.current = 0;
        localBattleBeginFlashUntilRef.current = 0;
      }

      if (state?.status) {
        lastArenaStatusRef.current = state.status;
      }

      cleanupHiddenCollected(hiddenOrbIdsRef.current, now);
      cleanupHiddenCollected(hiddenEnergyIdsRef.current, now);
      cleanupHiddenCollected(hiddenCoreIdsRef.current, now);

      if (state.orbs !== undefined) {
        stableOrbMapRef.current = replaceStableItems(stableOrbMapRef.current, state.orbs || [], now);
      }
      if (state.energyCells !== undefined) {
        stableEnergyMapRef.current = replaceStableItems(stableEnergyMapRef.current, state.energyCells || [], now);
      }

      if (state.minimapOrbs !== undefined) {
        stableMinimapOrbMapRef.current = replaceStableItems(
          stableMinimapOrbMapRef.current,
          state.minimapOrbs || [],
          now,
        );
      }

      if (state.minimapEnergyCells !== undefined) {
        stableMinimapEnergyMapRef.current = replaceStableItems(
          stableMinimapEnergyMapRef.current,
          state.minimapEnergyCells || [],
          now,
        );
      }

      if (state.minimapCores !== undefined) {
        stableCoreMapRef.current = replaceStableItems(
          stableCoreMapRef.current,
          state.minimapCores || [],
          now,
        );
      }

      worldRef.current = {
        ...worldRef.current,
        ...state,
        safeZoneRadius: state.safeZoneRadius || ZONE_RADIUS_FALLBACK,
        you: state.you || worldRef.current.you,
        players: Array.isArray(state.players) ? state.players.map((p) => ({ ...p, __seenAt: now })) : worldRef.current.players,
        spectatingPlayer: state.spectatingPlayer
          ? { ...state.spectatingPlayer, __seenAt: now }
          : state.spectatingPlayer === null
            ? null
            : worldRef.current.spectatingPlayer,

        orbs: state.orbs !== undefined
          ? [...stableOrbMapRef.current.values()].filter((orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id))
          : worldRef.current.orbs,

        minimapOrbs: (state.minimapOrbs !== undefined || state.orbs !== undefined)
          ? [...stableMinimapOrbMapRef.current.values()]
          : worldRef.current.minimapOrbs,

        minimapEnergyCells: (state.minimapEnergyCells !== undefined || state.energyCells !== undefined)
          ? [...stableMinimapEnergyMapRef.current.values()]
          : worldRef.current.minimapEnergyCells,

        energyCells: state.energyCells !== undefined
          ? [...stableEnergyMapRef.current.values()].filter((cell) => !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id))
          : worldRef.current.energyCells,

        cores: state.cores !== undefined
          ? state.cores.filter((core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id))
          : worldRef.current.cores,

        minimapCores: (state.minimapCores !== undefined || state.cores !== undefined)
          ? [...stableCoreMapRef.current.values()]
          : worldRef.current.minimapCores,

        projectiles: Array.isArray(state.projectiles) ? state.projectiles : worldRef.current.projectiles,
        // Reliable direct combat events + snapshot copies are merged above.
        // This remains private to the local socket and is deduplicated by id.
        combatEvents: [...combatEventMapRef.current.values()],
        leaderboard: Array.isArray(state.leaderboard) ? state.leaderboard : worldRef.current.leaderboard,
      };

      if (state.you) {
        const lastProcessedInputSeq = Number(
          state.you.lastProcessedInputSeq ?? state.lastProcessedInputSeq ?? 0
        );

        // Inputul PvP este "held state" pe server, nu o lista de comenzi
        // discrete. Replay-ul cozii pe fiecare snapshot dubla timpul de miscare
        // si apoi tragea jucatorul inapoi. Pastram doar predictia rAF si facem
        // corectie cu dead-zone fata de pozitia serverului extrapolata usor.
        pendingInputsRef.current.length = 0;

        const incomingCollectionSeq = Number(state.you.collectionSeq || 0);
        const localCollectionSeq = Number(lastCollectionSeqRef.current || 0);
        const keepFreshCollectStats = localCollectionSeq > incomingCollectionSeq;
        const collectStatsSource = keepFreshCollectStats
          ? predictedYouRef.current || state.you
          : state.you;
        if (!keepFreshCollectStats && incomingCollectionSeq > 0) {
          lastCollectionSeqRef.current = Math.max(lastCollectionSeqRef.current || 0, incomingCollectionSeq);
        }

        const local = predictedYouRef.current;
        const reconciledYou = reconcileHeldInputUnit(local, state.you, now, lastLocalMovementAtRef.current);
        const previousHp = lastConfirmedHpRef.current;
        lastConfirmedHpRef.current = state.you.hp;

        predictedYouRef.current = {
          ...reconciledYou,
          // HP/energy/drones sunt autoritare si se actualizeaza imediat.
          hp: state.you.hp,
          maxHp: state.you.maxHp,
          energy: collectStatsSource.energy,
          drones: collectStatsSource.drones,
          progress: collectStatsSource.progress,
          nextDroneAt: collectStatsSource.nextDroneAt,
          totalCollected: collectStatsSource.totalCollected,
          collectionSeq: Math.max(incomingCollectionSeq, localCollectionSeq),
          alive: state.you.alive,
          lastProcessedInputSeq,
          damageFlashUntil:
            previousHp !== null && state.you.hp < previousHp
              ? now + 220
              : local?.damageFlashUntil || 0,
        };

        worldRef.current.you = predictedYouRef.current;
      }

      const motionMapFromState = remoteMotionRef.current;
      if (Array.isArray(state.players)) {
        const snapshotServerNow = Number(state?.serverNow || 0);
        state.players.forEach((player) => {
          if (!player?.id) return;
          upsertRemoteMotion(motionMapFromState, player, now, snapshotServerNow, true);
        });
      }

      const snapshotsById = remoteSnapshotBufferRef.current;
      // Legacy snapshot buffer is retained only for a safe rolling upgrade.
      // The live renderer reads remoteMotionRef instead, so old devices do not
      // allocate/scan a list of buffered snapshots every animation frame.
      // `players` is omitted from most low-frequency HUD packets. Treat an
      // omitted field as "no metadata update", never as "every bot vanished".
      // Removing buffers here was causing visible bots to blink/restart on
      // slower phones whenever a lightweight HUD packet arrived.
      if (Array.isArray(state.players)) {
        const activeRemoteIds = new Set();
        const snapshotServerNow = Number(state?.serverNow || 0);

        state.players.forEach((player) => {
          if (!player?.id) return;
          activeRemoteIds.add(player.id);
          const oldBuffer = snapshotsById.get(player.id) || [];
          snapshotsById.set(
            player.id,
            appendRemoteSnapshot(oldBuffer, player, now, snapshotServerNow),
          );
        });

        for (const [id, entries] of snapshotsById.entries()) {
          const newest = entries?.[entries.length - 1];
          const lastSeen = Number(newest?.__receivedAt || now);
          if (!activeRemoteIds.has(id) && now - lastSeen > SNAPSHOT_BUFFER_TTL_MS * 2) {
            snapshotsById.delete(id);
          }
        }
      }

      if (state.you?.alive === false) {
        predictedYouRef.current = { ...(predictedYouRef.current || {}), ...state.you };

        const aliveSpectators = Array.isArray(worldRef.current.players)
          ? worldRef.current.players.filter((player) => player?.alive !== false)
          : [];

        const directSpectator = state.spectatingPlayer?.alive !== false ? state.spectatingPlayer : null;

        const preferredTarget = state.spectatorTargetId
          ? aliveSpectators.find((player) => player.id === state.spectatorTargetId)
          : null;

        const currentTargetStillAlive = spectatorTargetRef.current
          ? aliveSpectators.find((player) => player.id === spectatorTargetRef.current.id)
          : null;

        spectatorTargetRef.current = directSpectator || preferredTarget || currentTargetStillAlive || aliveSpectators[0] || null;
      } else {
        spectatorTargetRef.current = null;
      }

      if (!predictedYouRef.current && state.you) {
        predictedYouRef.current = { ...state.you };
      }
    };

    const handleConnect = () => {
      setConnectionError("");
      // Keep the last rendered room alive while the transport reconnects. Do
      // not clear world maps here: clearing them was the source of the empty
      // camera / vanished-bot screen after a short WebSocket reset.
      zoneJoinAcceptedRef.current = false;
      zoneJoinAttemptRef.current = 0;
      clearZoneJoinRetry();
      lastZonePacketAtRef.current = performance.now();
      requestZoneResync();
      window.setTimeout(() => {
        if (!disposed && socket.connected && !zoneJoinAcceptedRef.current) requestZoneJoin();
      }, 450);
    };

    const handleConnectError = () => {
      if (!disposed) setConnectionError("Serverul PvP se reconecteaza automat...");
    };

    const handleDisconnect = (reason) => {
      zoneJoinAcceptedRef.current = false;
      zoneJoinAttemptRef.current = 0;
      clearZoneJoinRetry();
      if (!disposed && reason !== "io client disconnect") {
        setConnectionError("Conexiunea Zone PvP s-a intrerupt. Reiau aceeași sesiune...");
      }
    };

    const handleResumeMissing = () => {
      // Never silently join a fresh room when a live seat cannot be restored.
      // Keeping the last frame is safer than showing a camera from another room.
      zoneJoinAcceptedRef.current = false;
      setConnectionError("Sesiunea veche nu poate fi restaurată încă. Se încearcă din nou...");
    };

    const handleJoinConfirmed = (confirmation = {}) => {
      markZoneJoinAccepted(confirmation);
    };

    const recoverVisibleZoneSession = () => {
      if (disposed || document.visibilityState === "hidden") return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      if (!zoneJoinAcceptedRef.current) {
        zoneJoinAttemptRef.current = 0;
        requestZoneJoin();
      }
    };

    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    // Reliable item-removal deltas keep both players' loot view in lockstep.
    // A stale volatile snapshot is rejected by the hidden-id tombstone.
    const applyWorldItemDelta = (event = {}) => {
      const now = performance.now();
      for (const id of event.removedOrbIds || []) {
        hiddenOrbIdsRef.current.set(id, now);
        stableOrbMapRef.current.delete(id);
        stableMinimapOrbMapRef.current.delete(id);
      }
      for (const id of event.removedEnergyIds || []) {
        hiddenEnergyIdsRef.current.set(id, now);
        stableEnergyMapRef.current.delete(id);
        stableMinimapEnergyMapRef.current.delete(id);
      }
      for (const id of event.removedCoreIds || []) {
        hiddenCoreIdsRef.current.set(id, now);
        stableCoreMapRef.current.delete(id);
      }

      worldRef.current = {
        ...worldRef.current,
        orbs: [...stableOrbMapRef.current.values()].filter((orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id)),
        minimapOrbs: [...stableMinimapOrbMapRef.current.values()],
        energyCells: [...stableEnergyMapRef.current.values()].filter((cell) => !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id)),
        minimapEnergyCells: [...stableMinimapEnergyMapRef.current.values()],
        cores: (worldRef.current.cores || []).filter((core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id)),
      };
    };

    // Own collection is authoritative and reliable. It updates the HUD at the
    // same moment the server removes the item, while preserving local movement.
    const applyCollectSync = (event = {}) => {
      const now = performance.now();
      const collectionSeq = Number(event.collectionSeq || event.you?.collectionSeq || 0);
      if (collectionSeq > 0) {
        lastCollectionSeqRef.current = Math.max(lastCollectionSeqRef.current || 0, collectionSeq);
      }
      applyWorldItemDelta({
        removedOrbIds: event.collectedOrbIds || [],
        removedEnergyIds: event.collectedEnergyIds || [],
        removedCoreIds: event.collectedCoreIds || [],
      });

      if (!event.you) return;
      const previous = predictedYouRef.current || worldRef.current.you || event.you;
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
        lastProcessedInputSeq: event.you.lastProcessedInputSeq ?? previous.lastProcessedInputSeq,
        serverX: event.you.x,
        serverY: event.you.y,
      };
      worldRef.current = { ...worldRef.current, you: predictedYouRef.current };
      setHudData({ ...worldRef.current, you: predictedYouRef.current, fps: fpsRef.current.value });
    };

    // Reliable elimination event: lock the spectator camera onto the killer
    // immediately instead of waiting for the next volatile world snapshot.
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

    // Compact latest-wins transform stream. The server sends tuple rows under
    // p/q; object rows remain accepted during a rolling deploy so no player
    // loses visuals while an old backend instance is still draining.
    const consumeMovementFrame = (packet = {}) => {
      const currentRoomId = String(zonePhaseRef.current?.roomId || "");
      const packetRoomId = String(packet?.r || packet?.roomId || "");
      if (currentRoomId && packetRoomId && currentRoomId !== packetRoomId) return;

      const now = performance.now();
      lastZonePacketAtRef.current = now;
      const serverNow = Number(packet?.t || packet?.serverNow || 0);
      const movementSequence = Number(packet?.s || packet?.sequence || 0);
      if (movementSequence > 0 && movementSequence <= Number(lastMovementSequenceRef.current || 0)) return;
      if (movementSequence > 0) lastMovementSequenceRef.current = movementSequence;
      updateServerClockOffset(serverNow);

      const motions = remoteMotionRef.current;
      const activeRemoteIds = remoteActiveIdsRef.current;
      activeRemoteIds.clear();

      for (const [id, motion] of motions.entries()) {
        if (id === me?.id) continue;
        if (now - Number(motion?.lastSeenAt || now) > REMOTE_STALE_TIMEOUT_MS) {
          motions.delete(id);
          continue;
        }
        const resolved = resolveRemoteMotion(motion, now, dt);
        if (!resolved) continue;
        activeRemoteIds.add(id);
        resolved.skin = normalizeSkin(resolved.skin || "cyan");
        resolved.attacking = Boolean(resolved.attacking);
        resolved.shieldActive = Boolean(resolved.shieldActive);
        remoteMap.set(id, resolved);
      }

      for (const id of remoteMap.keys()) {
        if (!activeRemoteIds.has(id)) remoteMap.delete(id);
      }

      const projectileMap = projectilesRef.current;
      const movementProjectiles = projectileMovementRef.current;

      // Local attack drone stays instant. Enemy attack drones follow a mutable
      // authoritative motion record, so there is no 25-40 Hz stair-step or
      // stale-packet pullback.
      for (const [id, projectile] of projectileMap.entries()) {
        if (projectile.localOnly) advanceProjectile(projectile, dt);
      }

      for (const [id, motion] of movementProjectiles.entries()) {
        if (now - Number(motion?.lastSeenAt || now) > PROJECTILE_MOVEMENT_STALE_MS) {
          movementProjectiles.delete(id);
          continue;
        }
        const resolved = resolveZoneProjectileMotion(motion, now, dt);
        if (!resolved) continue;
        const belongsToLocalPlayer =
          Boolean(me?.id) &&
          (
            String(resolved.ownerId || "") === String(me.id) ||
            Number(resolved.ownerNetId || 0) === Number(me.netId || -1) ||
            String(resolved.ownerId || "") === zoneNetKey(me.netId)
          );
        if (belongsToLocalPlayer) {
          // Own projectile is predicted once locally. Remove only the server
          // alias, never the local visual.
          if (!String(id).startsWith("local-")) projectileMap.delete(id);
          continue;
        }
        projectileMap.set(id, resolved);
      }

      for (const [id, projectile] of projectileMap.entries()) {
        const age = now - Number(projectile.createdAt || projectile.__seenAt || now);
        if (projectile.localOnly) {
          if (age > PROJECTILE_VISUAL_TTL || getProjectileTravelDistance(projectile) > LOCAL_PROJECTILE_MAX_DISTANCE) {
            projectileMap.delete(id);
          }
          continue;
        }
        if (age > PROJECTILE_VISUAL_TTL || now - Number(projectile.lastSeenAt || projectile.__seenAt || now) > PROJECTILE_MOVEMENT_STALE_MS) {
          projectileMap.delete(id);
        }
      }

      const spectatedFromRemote = currentSpectatorTarget?.id
        ? remoteMap.get(currentSpectatorTarget.id) || currentSpectatorTarget
        : null;

      const liveCameraSubject = isSpectating ? (spectatedFromRemote || currentSpectatorTarget || me) : me;
      const liveYou = isSpectating
        ? (liveCameraSubject && liveCameraSubject.id !== me?.id ? liveCameraSubject : null)
        : me?.alive !== false ? me : null;

      if (liveYou) liveYou.skin = normalizeSkin(liveYou.skin || getSelectedSkin(user));

      const liveIsMobileLike = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches;
      const liveCameraScale = liveIsMobileLike ? PVP_MOBILE_CAMERA_SCALE : PVP_DESKTOP_CAMERA_SCALE;
      const liveCameraX = liveCameraSubject ? viewport.width / 2 - liveCameraSubject.x * liveCameraScale : 0;
      const liveCameraY = liveCameraSubject ? viewport.height / 2 - liveCameraSubject.y * liveCameraScale : 0;
      const liveBounds = getViewportBounds(liveCameraX, liveCameraY, viewport, 980, liveCameraScale);
      const renderLimits = mobilePerformanceRef.current
        ? { detailed: 6, total: 60, orbs: 42, energy: 14, cores: 4, projectiles: 5, simpleProjectiles: 30 }
        : constrainedDesktopRef.current
          ? { detailed: 7, total: 60, orbs: 72, energy: 26, cores: 6, projectiles: 10, simpleProjectiles: 34 }
          : { detailed: 34, total: MAX_VISIBLE_REMOTE_PLAYERS, orbs: 140, energy: 50, cores: 9, projectiles: 36, simpleProjectiles: 45 };

      // Entity membership is refreshed at 12.5 Hz, while the referenced objects
      // above continue to receive display-rate x/y updates. This removes sort /
      // allocation spikes without reducing what is visible.
      const selection = renderSelectionRef.current;
      if (now >= selection.nextAt) {
        selection.nextAt = now + 80;
        selection.remote.length = 0;
        selection.detailed.length = 0;
        selection.simple.length = 0;
        selection.players.length = 0;
        selection.bots.length = 0;
        selection.orbs.length = 0;
        selection.energy.length = 0;
        selection.cores.length = 0;
        selection.projectiles.length = 0;
        selection.simpleProjectiles.length = 0;
        selection.combatEvents.length = 0;

        // Keep the nearest detailed subset without Array#sort / object clones.
        for (const player of remoteMap.values()) {
          if (!player || player.id === liveYou?.id || player.alive === false || !isVisible(player, liveBounds, 460)) continue;
          const dx = Number(player.x || 0) - Number(liveCameraSubject?.x || 0);
          const dy = Number(player.y || 0) - Number(liveCameraSubject?.y || 0);
          const distanceSq = dx * dx + dy * dy;
          let insertAt = selection.detailed.length;
          while (insertAt > 0 && Number(selection.detailed[insertAt - 1].__renderDistanceSq || 0) > distanceSq) insertAt -= 1;
          player.__renderDistanceSq = distanceSq;
          if (insertAt < renderLimits.detailed) {
            selection.detailed.splice(insertAt, 0, player);
            if (selection.detailed.length > renderLimits.detailed) selection.detailed.pop();
          }
          selection.remote.push(player);
          if (selection.remote.length >= renderLimits.total) break;
        }
        for (const player of selection.remote) {
          if (selection.detailed.includes(player)) continue;
          selection.simple.push(player);
        }
        for (const player of selection.detailed) {
          if (player.isBot) selection.bots.push(player);
          else selection.players.push(player);
        }

        for (const orb of stableOrbMapRef.current.values()) {
          if (!isHiddenCollected(hiddenOrbIdsRef.current, orb.id) && isVisible(orb, liveBounds, 45)) {
            selection.orbs.push(orb);
            if (selection.orbs.length >= renderLimits.orbs) break;
          }
        }
        for (const cell of stableEnergyMapRef.current.values()) {
          if (!isHiddenCollected(hiddenEnergyIdsRef.current, cell.id) && isVisible(cell, liveBounds, 70)) {
            selection.energy.push(cell);
            if (selection.energy.length >= renderLimits.energy) break;
          }
        }
        for (const core of data.cores || []) {
          if (!isHiddenCollected(hiddenCoreIdsRef.current, core.id) && isVisible(core, liveBounds, 130)) {
            selection.cores.push(core);
            if (selection.cores.length >= renderLimits.cores) break;
          }
        }
        for (const projectile of projectileMap.values()) {
          if (!isVisible(projectile, liveBounds, 220)) continue;
          if (selection.projectiles.length < renderLimits.projectiles) selection.projectiles.push(projectile);
          else if (selection.simpleProjectiles.length < renderLimits.simpleProjectiles) selection.simpleProjectiles.push(projectile);
          else break;
        }
        const viewerId = data.you?.id || worldRef.current.you?.id || "";
        for (const event of data.combatEvents || []) {
          if (viewerId && String(event?.viewerId || "") === String(viewerId)) selection.combatEvents.push(event);
        }
      }

      const live = pixiFrameRef.current;
      live.player = liveYou;
      live.players = selection.players;
      live.bots = selection.bots;
      live.simpleBots = selection.simple;
      live.orbs = selection.orbs;
      live.energyCells = selection.energy;
      live.cores = selection.cores;
      live.projectiles = selection.projectiles;
      live.simpleProjectiles = selection.simpleProjectiles;
      live.combatEvents = selection.combatEvents;
      live.combatViewerId = data.you?.id || worldRef.current.you?.id || null;
      live.combatEventsPrivate = true;
      live.cameraX = liveCameraX;
      live.cameraY = liveCameraY;
      live.scale = liveCameraScale;
      live.viewportWidth = viewport.width;
      live.viewportHeight = viewport.height;
      live.worldWidth = worldWidth;
      live.worldHeight = worldHeight;
      live.worldTheme = "premium-space-battle";
      live.staticItemBudget = mobilePerformanceRef.current ? 52 : 110;
      live.safeZoneRadius = zoneRadius;
      live.showZone = true;
      live.coreColorMap = coreColorMapRef.current;
      live.otherPlayerSize = 112;
      live.otherPlayerQuality = 0;
      // Preserve the exact presentation; Pixi should optimize work, not remove
      // background/drone detail merely because this is a Zone match.
      live.preserveVisualQuality = true;
      live.zonePreCulled = true;
      pixiLiveRef.current = live;

      if (now - lastRenderSyncRef.current >= ((mobilePerformanceRef.current || constrainedDesktopRef.current) ? 260 : 125)) {
        lastRenderSyncRef.current = now;
        setRenderData({
          ...data,
          you: me,
          spectatingPlayer: currentSpectatorTarget || data.spectatingPlayer || null,
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
    const movementKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

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
          keysRef.current.arrowright
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
      mouseRef.current = { x: event.clientX, y: event.clientY };
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
      const normalized = Math.min(1, (distance - deadZonePx) / (fullSpeedAt - deadZonePx));
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

    // Compositor-only on drag: no React render on each touch move.
    setJoystickKnobTransform(vector.knobX, vector.knobY);
    if (mobileJoystickActiveRef.current !== active) {
      mobileJoystickActiveRef.current = active;
      setMobileJoystick({ active, knobX: vector.knobX, knobY: vector.knobY });
    }

    sendInputRef.current();
  };

  const stopJoystick = (event) => {
    event.preventDefault();
    if (joystickPointerRef.current !== null && event.currentTarget.releasePointerCapture) {
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
    mouseRef.current = { x: event.clientX, y: event.clientY };
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

    const aimDistance = Math.max(220, Math.min(360, Math.min(window.innerWidth, window.innerHeight) * 0.42));
    mouseRef.current = {
      x: window.innerWidth / 2 + dirX * aimDistance,
      y: window.innerHeight / 2 + dirY * aimDistance,
    };
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

    if (attackPointerRef.current !== null && event.currentTarget.releasePointerCapture) {
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
    if (shieldPointerRef.current !== null && event.currentTarget.releasePointerCapture) {
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
  const liveSpectatorCandidates = (renderData.players || []).filter((player) => player?.alive !== false);

  const serverSpectatingPlayer = renderData.spectatingPlayer?.alive !== false ? renderData.spectatingPlayer : null;

  const spectatorTarget = isDead
    ? (
        serverSpectatingPlayer ||
        (renderData.spectatorTargetId
          ? liveSpectatorCandidates.find((player) => player.id === renderData.spectatorTargetId)
          : null) ||
        (spectatorTargetRef.current?.alive !== false
          ? liveSpectatorCandidates.find((player) => player.id === spectatorTargetRef.current.id) || spectatorTargetRef.current
          : null) ||
        liveSpectatorCandidates[0] ||
        null
      )
    : null;

  if (spectatorTarget) {
    spectatorTargetRef.current = spectatorTarget;
  }

  const cameraSubject = isDead ? (spectatorTarget || you) : you;

  // CAMERA / ZOOM - exactly the BattleRoyaleMode desktop framing.
  // Desktop: 0.72; mobile keeps its dedicated 0.82 combat framing.
  const cameraScale = isMobileControls ? PVP_MOBILE_CAMERA_SCALE : PVP_DESKTOP_CAMERA_SCALE;

  const cameraX = cameraSubject ? viewport.width / 2 - cameraSubject.x * cameraScale : 0;
  const cameraY = cameraSubject ? viewport.height / 2 - cameraSubject.y * cameraScale : 0;
  const bounds = getViewportBounds(cameraX, cameraY, viewport, 720, cameraScale);
  const reactiveRenderLimits = isMobileControls
    ? { detailed: 6, total: 50, orbs: 48, energy: 16, cores: 4, projectiles: 5, simpleProjectiles: 26 }
    : constrainedDesktopRef.current
      ? { detailed: 10, total: 60, orbs: 96, energy: 34, cores: 7, projectiles: 14, simpleProjectiles: 42 }
      : { detailed: 34, total: MAX_VISIBLE_REMOTE_PLAYERS, orbs: 140, energy: 50, cores: 9, projectiles: 36, simpleProjectiles: 45 };

  const visibleOrbs = collectVisible(renderData.orbs || [], (orb) => isVisible(orb, bounds, 40), reactiveRenderLimits.orbs);
  const visibleEnergyCells = collectVisible(renderData.energyCells || [], (cell) => isVisible(cell, bounds, 60), reactiveRenderLimits.energy);
  const visibleCores = collectVisible(renderData.cores || [], (core) => isVisible(core, bounds, 120), reactiveRenderLimits.cores);
  const visiblePlayers = [...(renderData.players || [])]
    .filter((player) => isVisible(player, bounds, 420))
    .sort((a, b) => {
      const ax = Number(a.x || 0) - Number(cameraSubject?.x || 0);
      const ay = Number(a.y || 0) - Number(cameraSubject?.y || 0);
      const bx = Number(b.x || 0) - Number(cameraSubject?.x || 0);
      const by = Number(b.y || 0) - Number(cameraSubject?.y || 0);
      return ax * ax + ay * ay - (bx * bx + by * by);
    })
    .slice(0, reactiveRenderLimits.total);
  const visibleProjectiles = [...(renderData.projectiles || [])]
    .filter((projectile) => isVisible(projectile, bounds, 180))
    .slice(0, reactiveRenderLimits.projectiles);
  const visibleSimpleProjectiles = [...(renderData.projectiles || [])]
    .filter((projectile) => isVisible(projectile, bounds, 180))
    .slice(reactiveRenderLimits.projectiles, reactiveRenderLimits.projectiles + reactiveRenderLimits.simpleProjectiles);

  const rendererPlayer = isDead && spectatorTarget
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

  const rendererRemoteUnits = visiblePlayers
    .filter((player) => player?.id !== rendererPlayer?.id)
    .map((player) => ({
      ...player,
      skin: normalizeSkin(player.skin),
      isBot: Boolean(player.isBot),
    }));
  const rendererDetailedUnits = rendererRemoteUnits.slice(0, reactiveRenderLimits.detailed);
  const rendererSimpleUnits = rendererRemoteUnits.slice(reactiveRenderLimits.detailed);
  const rendererPlayers = rendererDetailedUnits.filter((player) => !player.isBot);
  const rendererBots = rendererDetailedUnits.filter((player) => player.isBot);

  const activeBadges = useMemo(() => getActiveEffectBadges(hudYou), [hudYou]);
  const leaderboard = hudData.leaderboard || renderData.leaderboard || [];
  const renderStatus = renderData.status || "connecting";
  const hudStatus = hudData.status || "connecting";
  const status = getZoneStatusRank(renderStatus) >= getZoneStatusRank(hudStatus)
    ? renderStatus
    : hudStatus;
  const isWaiting = status === "waiting" || status === "connecting";
  const isCountdown = status === "countdown";
  const isMatchmaking = isWaiting || isCountdown;
  const isFinished = status === "finished";
  const playersAlive = Math.max(
    Number(hudData.playerCount || 0),
    Number(renderData.playerCount || 0),
    status === "playing" ? 1 : 0,
  );
  const minPlayers = hudData.minPlayers || renderData.minPlayers || 3;
  const maxPlayers = hudData.maxPlayers || renderData.maxPlayers || 60;
  const countdown = hudData.countdown || renderData.countdown || 5;
  const winnerName = hudData.winnerName || renderData.winnerName;
  const coreDropCountdown = hudData.coreDropCountdown || renderData.coreDropCountdown;
  const battlePrepareSource = hudData.status ? hudData : renderData;
  const serverBattlePrepareRemainingMs = getBattlePrepareRemainingMs(battlePrepareSource);
  const localBattlePrepareRemainingMs = Math.max(0, (localBattlePrepareUntilRef.current || 0) - Date.now());
  const battlePrepareRemainingMs = Math.max(serverBattlePrepareRemainingMs, localBattlePrepareRemainingMs);
  const isBattlePrepare = status === "playing" && !isFinished && battlePrepareRemainingMs > 0;
  const battlePrepareSeconds = Math.max(0, Math.ceil(battlePrepareRemainingMs / 1000));
  const showBattleBeginFlash = !isMatchmaking && !isFinished && !isBattlePrepare && (
    getBattleBeginFlashActive(battlePrepareSource) ||
    ((localBattleBeginFlashUntilRef.current || 0) > Date.now()) ||
    battleBeginFlashUntil > Date.now()
  );

  // Fix vizual: cand PREPARE PHASE trece la 0, afisam sigur BATTLE BEGIN
  // in centru, chiar daca pachetul de server ajunge fara battleBeginFlashUntil.
  useEffect(() => {
    if (isBattlePrepare) {
      battlePrepareWasVisibleRef.current = true;
      return;
    }

    if (battlePrepareWasVisibleRef.current && !isMatchmaking && !isFinished) {
      battlePrepareWasVisibleRef.current = false;
      const until = Date.now() + 1600;
      localBattleBeginFlashUntilRef.current = Math.max(localBattleBeginFlashUntilRef.current || 0, until);
      setBattleBeginFlashUntil(until);
    }
  }, [isBattlePrepare, isMatchmaking, isFinished]);

  // Backup sigur pentru mobile/low-FPS: programeaza flash-ul exact cand se termina prepare phase.
  // Asa BATTLE BEGIN apare mereu in centru, chiar daca nu mai vine imediat un snapshot de server.
  useEffect(() => {
    if (battleBeginTimerRef.current) {
      window.clearTimeout(battleBeginTimerRef.current);
      battleBeginTimerRef.current = null;
    }

    if (!isBattlePrepare || isMatchmaking || isFinished) return undefined;

    battleBeginTimerRef.current = window.setTimeout(() => {
      battlePrepareWasVisibleRef.current = false;
      localBattlePrepareUntilRef.current = 0;
      const until = Date.now() + 1600;
      localBattleBeginFlashUntilRef.current = until;
      setBattleBeginFlashUntil(until);
    }, Math.max(60, Math.min(BATTLE_PREPARE_DURATION + 250, battlePrepareRemainingMs + 40)));

    return () => {
      if (battleBeginTimerRef.current) {
        window.clearTimeout(battleBeginTimerRef.current);
        battleBeginTimerRef.current = null;
      }
    };
  }, [isBattlePrepare, battlePrepareSeconds, isMatchmaking, isFinished, battlePrepareRemainingMs]);

  // Leaving the arena is explicit. A finished Zone PvP round remains visible
  // until the player chooses EXIT TO MENU; it never remounts the Dashboard
  // automatically and therefore cannot create a fresh lobby by itself.
  const handleZoneExitToMenu = () => {
    if (intentionalExitRef.current || explicitExitFinishedRef.current) return;

    // Leaving is permanent for this browser tab: discard the resumable token
    // before returning to the Dashboard, so this player cannot restore the
    // abandoned Zone PvP seat by opening the mode again.
    intentionalExitRef.current = true;
    zoneJoinAcceptedRef.current = true;
    clearZonePvpResumeToken();
    zoneResumeIdentityRef.current = { roomId: null, playerId: null };
    resumeTokenRef.current = createZonePvpResumeToken();

    const socket = socketRef.current;
    const finishExit = () => {
      if (explicitExitFinishedRef.current) return;
      explicitExitFinishedRef.current = true;

      if (explicitExitTimerRef.current) {
        window.clearTimeout(explicitExitTimerRef.current);
        explicitExitTimerRef.current = null;
      }

      if (socket) {
        socket.off("zone-pvp:left", finishExit);
        // The backend has already removed the player when it sends
        // `zone-pvp:left`. Disconnect now so a reconnect cannot restore the
        // old room while Dashboard is rendering.
        socket.disconnect();
      }

      onExitToMenu?.();
    };

    if (!socket?.connected) {
      finishExit();
      return;
    }

    socket.once("zone-pvp:left", finishExit);
    if (!explicitLeaveSentRef.current) {
      explicitLeaveSentRef.current = true;
      socket.emit("zone-pvp:leave");
    }

    // Do not strand the UI if a proxy drops the acknowledgement. The server
    // still receives the leave packet on a healthy socket; this short fallback
    // only guarantees the menu remains responsive.
    explicitExitTimerRef.current = window.setTimeout(finishExit, 700);
  };

  const matchStartedAt = hudData.matchStartedAt || renderData.matchStartedAt;
  const zoneShrinkDuration = hudData.zoneShrinkDuration || renderData.zoneShrinkDuration || 600000;

  const zoneRemainingMs = matchStartedAt ? Math.max(0, zoneShrinkDuration - (Date.now() - matchStartedAt)) : zoneShrinkDuration;
  const zoneRemainingMinutes = Math.floor(zoneRemainingMs / 60000);
  const zoneRemainingSeconds = Math.floor((zoneRemainingMs % 60000) / 1000).toString().padStart(2, "0");

  const hp = hudYou?.hp ?? 100;
  const maxHp = hudYou?.maxHp ?? 100;
  const energy = hudYou?.energy ?? 100;
  const progress = hudYou?.progress ?? 0;
  const nextDroneAt = hudYou?.nextDroneAt ?? 5;

  return (
    <div className={`game-arena pvp-dom-arena normal-pvp-dom-arena zone-pvp-dom-arena ${isMobileControls ? "is-mobile-device is-mobile-portrait" : ""} ${mobileAttackActive ? "is-mobile-attacking" : ""} ${isBattlePrepare ? "is-battle-prepare" : ""}`}>
      {isMatchmaking && !connectionError && (
        <div className="zone-pvp-matchmaking-screen">
          <div className="zone-pvp-matchmaking-card">
            <div className="zone-pvp-loader" />
            <h1>{isCountdown ? "MATCH STARTS IN" : "WAITING FOR PLAYERS"}</h1>
            <strong>{isCountdown ? countdown : `${Math.min(playersAlive, minPlayers)} / ${minPlayers}`}</strong>
            <p>{isCountdown ? "Jucatorii au fost gasiti. Pregateste-te!" : "Se cauta inca un jucator pentru Zone PvP..."}</p>
          </div>
        </div>
      )}

      <PixiArenaRenderer
        player={rendererPlayer}
        players={rendererPlayers}
        bots={rendererBots}
        simpleBots={rendererSimpleUnits}
        orbs={visibleOrbs}
        energyCells={visibleEnergyCells}
        cores={visibleCores}
        projectiles={visibleProjectiles}
        simpleProjectiles={visibleSimpleProjectiles}
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
        liveDataRef={pixiLiveRef}
        // Weak laptops start with the premium desktop visuals. Pixi measures
        // real frame time and lowers only far details if sustained pressure occurs.
        forceLowQuality={graphicsQuality === "low" || isMobileControls}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        worldTheme="premium-space-battle"
        staticItemBudget={isRealMobileDevice() ? 52 : 110}
        safeZoneRadius={safeZoneRadius}
        showZone={true}
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

      {/* Attack drone is the only combat visual. The old cyan aim circle/arrow
          looked like a second launched drone, so it stays disabled in PvP. */}
      {false && you && !isDead && (!isMobileControls || mobileAttackActive) && (
        <svg className={`aim-svg ${isMobileControls ? "mobile-aim-svg" : ""}`} aria-hidden="true">
          <line className="aim-svg-line" ref={mobileAimLineRef} x1={viewport.width / 2} y1={viewport.height / 2} x2={mouseRef.current.x} y2={mouseRef.current.y} />
          <circle className="aim-svg-circle" ref={mobileAimCircleRef} cx={mouseRef.current.x} cy={mouseRef.current.y} r="34" />
          <g
            className="aim-svg-arrow"
            ref={mobileAimArrowRef}
            transform={`translate(${mouseRef.current.x}, ${mouseRef.current.y}) rotate(${(Math.atan2(mouseRef.current.y - viewport.height / 2, mouseRef.current.x - viewport.width / 2) * 180) / Math.PI})`}
          >
            <path d="M -15 -11 L 18 0 L -15 11 L -7 0 Z" />
          </g>
        </svg>
      )}

      <div className={`fps-counter ${renderData.fps < 50 ? "fps-low" : ""}`}>FPS: {renderData.fps || 60}</div>

      <div className="hp-panel">
        <span>DRONE HP</span>
        <strong>{hp} / {maxHp}</strong>
        <div className="hp-bar"><i style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }} /></div>

        <div className="energy-row">
          <span>DRONE ENERGY</span>
          <strong>{energy}</strong>
          <div className="energy-bar"><i style={{ width: `${Math.max(0, Math.min(100, energy))}%` }} /></div>
        </div>
      </div>

      <div className="collect-counter">
        <span>ORB COUNT</span>
        <strong>{progress} / {nextDroneAt}</strong>
        <small>Total collected: {hudYou?.totalCollected ?? 0}</small>
        <small>Kills: {hudYou?.kills ?? 0}</small>
        <div className="active-cores-panel">
          <b>ACTIVE CORES</b>
          {activeBadges.length === 0 ? (
            <em>NO ACTIVE CORES</em>
          ) : (
            activeBadges.map((badge) => (
              <em key={badge.key} className={`core-badge core-badge-${badge.className}`}>
                {badge.label}{badge.seconds !== null ? ` ${badge.seconds}s` : ""}
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

      {!isFinished && !isMatchmaking && (
        <div className="zone-pvp-zone-timer battle-royale-zone-timer">
          ZONE CLOSES IN: {zoneRemainingMinutes}:{zoneRemainingSeconds}
        </div>
      )}

      <div className="real-leaderboard">
        <h3>LEADERBOARD</h3>
        {(leaderboard || []).slice(0, 8).map((item, index) => (
          <div key={item.id || index} className={`real-leaderboard-row ${item.id === hudYou?.id ? "is-me" : ""} ${item.alive === false ? "is-dead" : ""}`}>
            <span>{index + 1}. {item.username || "Player"}</span>
            <strong>{item.kills ?? 0}K / {item.totalCollected ?? item.score ?? 0}</strong>
          </div>
        ))}
      </div>

      {cameraSubject && (
        <MiniMap
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


      {isBattlePrepare && (
        <div className="battle-royale-peace-countdown zone-pvp-peace-countdown">
          <strong>PREPARE PHASE</strong>
          <b>{battlePrepareSeconds}s</b>
          <span>Attack, shield and collision damage are locked.</span>
        </div>
      )}

      {showBattleBeginFlash && !isBattlePrepare && (
        <div className="battle-royale-begin-flash zone-pvp-begin-flash">BATTLE BEGIN</div>
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

            <button type="button" onClick={handleZoneExitToMenu}>
              EXIT TO MENU
            </button>
          </div>
        </div>
      )}

      {isFinished && (
        <div className="game-over-screen pvp-finished-screen">
          <h1>{winnerName ? `${winnerName} WINS` : "MATCH FINISHED"}</h1>
          <p>{hudYou?.id === (hudData.winnerId || renderData.winnerId) ? "Ai castigat meciul." : "Meciul s-a terminat."}</p>
          <p className="zone-pvp-finished-auto-exit">Meciul rămâne disponibil până alegi EXIT TO MENU.</p>
          <button onClick={handleZoneExitToMenu}>EXIT TO MENU</button>
        </div>
      )}

      {isMobileControls && !isDead && !isMatchmaking && (
      <div className="pvp-mobile-controls" aria-label="Mobile PvP controls">
        <div
          className={`pvp-mobile-joystick ${mobileJoystick.active ? "is-active" : ""}`}
          onPointerDown={onJoystickPointerDown}
          onPointerMove={onJoystickPointerMove}
          onPointerUp={stopJoystick}
          onPointerCancel={stopJoystick}
        >
          <div className="pvp-mobile-joystick-ring" />
          <div
            ref={joystickKnobRef}
            className="pvp-mobile-joystick-knob"
            style={{
              transform: `translate(calc(-50% + ${mobileJoystick.knobX}px), calc(-50% + ${mobileJoystick.knobY}px))`,
            }}
          />
        </div>

        <div className="pvp-mobile-buttons">
          <button
            type="button"
            className={`pvp-mobile-action pvp-mobile-shield ${mobileShieldActive ? "is-active" : ""} ${isBattlePrepare ? "is-locked" : ""}`}
            onPointerDown={onShieldPointerDown}
            onPointerUp={stopMobileShield}
            onPointerCancel={stopMobileShield}
          >
            SHIELD
          </button>

          <button
            type="button"
            className={`pvp-mobile-action pvp-mobile-attack ${mobileAttackActive ? "is-active" : ""} ${isBattlePrepare ? "is-locked" : ""}`}
            onPointerDown={onAttackPointerDown}
            onPointerMove={onAttackPointerMove}
            onPointerUp={stopMobileAttack}
            onPointerCancel={stopMobileAttack}
          >
            ATTACK
          </button>
        </div>
      </div>
      )}

      <button className="pvp-exit-btn" onClick={handleZoneExitToMenu}>EXIT TO MENU</button>
    </div>
  );
}

export default ZonePvpArena;
