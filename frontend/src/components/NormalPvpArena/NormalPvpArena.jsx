import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import MiniMap from "../MiniMap/MiniMap";
import PixiArenaRenderer from "../PixiArenaRenderer/PixiArenaRenderer";
import "../GameArena/GameArena.css";
import "./NormalPvpArena.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const WORLD_WIDTH_FALLBACK = 20000;
const WORLD_HEIGHT_FALLBACK = 20000;
const ZONE_RADIUS_FALLBACK = 9400;

// GameArena movement: 2.8 px / 60fps frame ~= 168 px/sec.
// Daca backend-ul tau ruleaza la 30 ticks/sec, PLAYER_SPEED pe server trebuie sa fie 5.6.
// VITEZA DRONEI PRINCIPALE IN PVP.
// Schimba valoarea asta daca vrei mai incet/mai rapid.
// Tine aceeasi valoare ca PLAYER_SPEED din GameArena.jsx.
const GAME_FRAME_SPEED = 2.5;
const CLIENT_SPEED = GAME_FRAME_SPEED * 60;

// Delta-time smoothing. Valorile sunt "pe secunda", nu pe frame.
// Asta inseamna ca jocul se simte la fel la 45 FPS, 60 FPS sau 144 FPS.
// IMPORTANT: SELF_HARD_SNAP_DISTANCE era 360px. Cu input trimis doar la 30Hz
// (vezi inputTimer mai jos), diferenta dintre predictia locala si pozitia
// raportata de server putea creste rapid peste acest prag din jitter normal
// de retea/tab in fundal/GC, declansand un TELEPORT vizibil instant catre
// pozitia serverului - exact senzatia de "m-a dat in spate brusc".
// Acum: prag de snap mai mare (560px), ca jitter-ul normal sa nu-l atinga,
// SI o viteza maxima de corectie (SELF_MAX_CORRECTION_SPEED) care garanteaza
// ca, sub acel prag, corectia se simte mereu ca o alinieere lina, niciodata
// ca un salt brusc, indiferent cat de mare e diferenta momentana.
const SELF_CORRECTION_MOVING = 0.18;
const SELF_CORRECTION_IDLE = 0;
const SELF_SNAP_DISTANCE = 0.25;
const SELF_HARD_SNAP_DISTANCE = 560;
const SELF_MAX_CORRECTION_SPEED = 900; // px/sec - viteza maxima cu care predictia se "trage" spre server
const SELF_IDLE_FREEZE_DISTANCE = 180;

const REMOTE_SMOOTHING = 16.5;
const REMOTE_PREDICTION = 1.0;
const REMOTE_HARD_SNAP_DISTANCE = 520;
const REMOTE_MAX_EXTRAPOLATE_MS = 140;

const PROJECTILE_SMOOTHING = 18;
const PROJECTILE_FRAME_SCALE = 60;
const PROJECTILE_VISUAL_TTL = 10000;
const LOCAL_PROJECTILE_MIN_VISUAL_MS = 85;
const SERVER_PROJECTILE_FADE_TTL = 10000;
const LOCAL_PROJECTILE_MAX_DISTANCE = 4200;
const PROJECTILE_HIT_VISUAL_RADIUS = 118;
const LOCAL_PROJECTILE_SPEED = 3.55;
const FIRE_COOLDOWN = 3000;
const ORB_STABLE_TTL = 220;
const MINIMAP_STABLE_TTL = 5200;

// Colectare vizuala locala: clientul ascunde instant orbul/energia/core-ul
// cand intra in el, fara sa astepte urmatorul pachet de la server.
// Serverul ramane autoritar pentru scor/progress, dar senzatia este instant.
const LOCAL_ORB_COLLECT_DISTANCE = 150;
const LOCAL_ENERGY_COLLECT_DISTANCE = 135;
const LOCAL_CORE_COLLECT_DISTANCE = 155;
const LOCAL_COLLECT_HIDE_TTL = 2200;

// ---------------------------------------------------------------------------
// Normal PvP a fost 1v1 (max 2 jucatori/camera). Acum suporta pana la 99
// jucatori in ACEEASI sesiune (vezi NORMAL_ROOM_MAX_PLAYERS din gateway).
// Aceste capete de vizibilitate sunt a doua plasa de siguranta pe client,
// pe langa filtrarea deja facuta de server (acolo se trimit doar cei mai
// apropiati ~60 jucatori per pachet). Le ridicam de la 80 la 99 ca niciun
// jucator vizibil sa nu "lipseasca" cand camera e plina.
const MAX_VISIBLE_REMOTE_PLAYERS = 99;

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

function getCoreMeta(type) {
  return CORE_TYPES.find((core) => core.type === type) || CORE_TYPES[0];
}

function getNextDroneAt(currentDrones = 0) {
  const requirements = [5, 15, 25, 35];
  const index = Math.max(0, Math.min(currentDrones, requirements.length - 1));
  return requirements[index];
}

function applyOptimisticOrbCollection(unit, count) {
  if (!unit || count <= 0) return unit;

  let progress = Number(unit.progress || 0) + count;
  let drones = Number(unit.drones || 0);
  let nextDroneAt = Number(unit.nextDroneAt || getNextDroneAt(drones));

  while (drones < 4 && progress >= nextDroneAt) {
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

  // Pasul cerut de damp e mai mare decat viteza maxima permisa -> il taiem la maxStepDistance,
  // pe aceeasi directie. Rezultatul e o miscare constanta, predictibila, fara salt vizibil.
  const ratio = maxStepDistance / dampedStepDistance;
  return {
    x: currentX + (damped.x - currentX) * ratio,
    y: currentY + (damped.y - currentY) * ratio,
  };
}

function keepInsideSafeZone(x, y, radius, worldWidth, worldHeight, margin = 70) {
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

// IMPORTANT: inainte se facea `new Map(previousMap)` la FIECARE pachet primit de la server
// (~30-40 ori/secunda), copiind intreaga colectie stabila (poate fi sute de orbs/energy/cores).
// Aceste copii repetate de Map sunt o sursa majora de presiune pe garbage collector si
// contribuie direct la spike-urile de FPS care scad si revin periodic. Acum mutam Map-ul
// existent in loc (acelasi obiect, fara copiere) - rezultatul (continutul final al hartii)
// este identic, doar alocarea este eliminata.
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

function getViewportBounds(cameraX, cameraY, viewport, padding = 650) {
  return {
    left: -cameraX - padding,
    right: -cameraX + viewport.width + padding,
    top: -cameraY - padding,
    bottom: -cameraY + viewport.height + padding,
  };
}

function isVisible(item, bounds, radius = 0) {
  return item && item.x + radius >= bounds.left && item.x - radius <= bounds.right && item.y + radius >= bounds.top && item.y - radius <= bounds.bottom;
}

// Colectare intr-o singura trecere, in loc de .filter().filter().slice().map() inlantuite.
// Fiecare .filter()/.slice() din lant aloca un array intermediar nou; la 60-144 frame-uri/secunda,
// cu liste de sute de elemente (orbs/energy/cores/players), aceste alocari repetate creeaza
// presiune mare pe garbage collector si cauzeaza micro-ingheturi (spike-uri de FPS care scad
// si revin). O singura trecere cu push() direct in rezultat aloca un singur array.
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

  return Math.max(420, Math.floor(cooldown));
}

function getLocalProjectileSpeed(unit) {
  const rapidBonus = unit?.rapidFireUntil && unit.rapidFireUntil > Date.now() ? 0.75 : 0;
  const overclockBonus = unit?.overclockUntil && unit.overclockUntil > Date.now() ? 1.25 : 0;
  return LOCAL_PROJECTILE_SPEED + (unit?.projectileSpeedBonus || 0) + rapidBonus + overclockBonus;
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

function NormalPvpArena({ user, onExitToMenu, graphicsQuality = "normal" }) {
  const socketRef = useRef(null);
  const keysRef = useRef({});
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastFrameRef = useRef(performance.now());
  const fpsRef = useRef({ frames: 0, lastAt: performance.now(), value: 60 });
  const lastRenderSyncRef = useRef(0);
  const pixiLiveRef = useRef(null);
  // CORE_TYPES e static - harta de culori nu se schimba niciodata in timpul jocului.
  // Inainte se reconstruia cu .reduce() la FIECARE frame din rAF (60-144 ori/secunda),
  // o alocare complet inutila care adauga presiune pe garbage collector. O calculam o
  // singura data si o refolosim.
  const coreColorMapRef = useRef(
    CORE_TYPES.reduce((acc, core) => {
      acc[core.type] = core.color;
      return acc;
    }, {})
  );
  const worldElementRef = useRef(null);
  const sendInputRef = useRef(() => {});

  const mobileMoveRef = useRef({ x: 0, y: 0, active: false });
  const joystickPointerRef = useRef(null);
  const attackPointerRef = useRef(null);
  const shieldPointerRef = useRef(null);
  const mobileAimDirRef = useRef({ x: 1, y: 0 });

  const worldRef = useRef({
    status: "connecting",
    playerCount: 0,
    minPlayers: 1,
    maxPlayers: 2,
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

  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isMobileControls, setIsMobileControls] = useState(() => isRealMobileDevice());
  const [renderData, setRenderData] = useState(() => ({ ...worldRef.current, fps: 60 }));
  const [hudData, setHudData] = useState(() => ({ ...worldRef.current, fps: 60 }));
  const [connectionError, setConnectionError] = useState("");
  const [mobileJoystick, setMobileJoystick] = useState({ active: false, knobX: 0, knobY: 0 });
  const [mobileAttackActive, setMobileAttackActive] = useState(false);
  const [mobileShieldActive, setMobileShieldActive] = useState(false);

  useEffect(() => {
    const socket = io(API_URL, {
      transports: ["websocket"],
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
    });

    socketRef.current = socket;

    const applyState = (state) => {
      const now = performance.now();

      cleanupHiddenCollected(hiddenOrbIdsRef.current, now);
      cleanupHiddenCollected(hiddenEnergyIdsRef.current, now);
      cleanupHiddenCollected(hiddenCoreIdsRef.current, now);

      stableOrbMapRef.current = mergeStableItems(stableOrbMapRef.current, state.orbs || [], now, ORB_STABLE_TTL);
      stableEnergyMapRef.current = mergeStableItems(stableEnergyMapRef.current, state.energyCells || [], now, ORB_STABLE_TTL);

      stableMinimapOrbMapRef.current = mergeStableItems(
        stableMinimapOrbMapRef.current,
        state.minimapOrbs?.length ? state.minimapOrbs : state.orbs || [],
        now,
        MINIMAP_STABLE_TTL
      );

      stableMinimapEnergyMapRef.current = mergeStableItems(
        stableMinimapEnergyMapRef.current,
        state.minimapEnergyCells?.length ? state.minimapEnergyCells : state.energyCells || [],
        now,
        MINIMAP_STABLE_TTL
      );

      stableCoreMapRef.current = mergeStableItems(
        stableCoreMapRef.current,
        state.minimapCores?.length ? state.minimapCores : state.cores || [],
        now,
        MINIMAP_STABLE_TTL
      );

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

  projectiles: Array.isArray(state.projectiles)
    ? state.projectiles
    : worldRef.current.projectiles,

  leaderboard: Array.isArray(state.leaderboard)
    ? state.leaderboard
    : worldRef.current.leaderboard,
};

      if (state.you?.alive === false) {
        predictedYouRef.current = { ...(predictedYouRef.current || {}), ...state.you };

        const aliveSpectators = Array.isArray(worldRef.current.players)
          ? worldRef.current.players.filter((player) => player?.alive !== false)
          : [];

        const directSpectator = state.spectatingPlayer?.alive !== false
          ? state.spectatingPlayer
          : null;

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

    socket.on("connect", () => {
      setConnectionError("");
      socket.emit("normal-pvp:join", {
        userId: user?.id,
        username: getDisplayName(user),
        skin: getSelectedSkin(user),
      });
    });

    socket.on("connect_error", () => {
      setConnectionError("Nu ma pot conecta la serverul PvP. Verifica Render/WebSocket.");
    });

    socket.on("normal-pvp:joined", applyState);
    socket.on("normal-pvp:state", applyState);
    socket.on("normal-pvp:error", (message) => setConnectionError(typeof message === "string" ? message : "Eroare Normal PvP."));

    const sendInputNow = () => {
      if (!socket.connected) return;

      const you = predictedYouRef.current || worldRef.current.you;
      const mouse = mouseRef.current;
      const mouseWorldX = you ? you.x + (mouse.x - window.innerWidth / 2) : 0;
      const mouseWorldY = you ? you.y + (mouse.y - window.innerHeight / 2) : 0;

      const mobileMove = mobileMoveRef.current || { x: 0, y: 0, active: false };

      socket.emit("normal-pvp:input", {
        w: Boolean(keysRef.current.w || keysRef.current.arrowup || (mobileMove.active && mobileMove.y < -0.22)),
        a: Boolean(keysRef.current.a || keysRef.current.arrowleft || (mobileMove.active && mobileMove.x < -0.22)),
        s: Boolean(keysRef.current.s || keysRef.current.arrowdown || (mobileMove.active && mobileMove.y > 0.22)),
        d: Boolean(keysRef.current.d || keysRef.current.arrowright || (mobileMove.active && mobileMove.x > 0.22)),
        moveX: mobileMove.active ? mobileMove.x : 0,
        moveY: mobileMove.active ? mobileMove.y : 0,
        mobileMove: Boolean(mobileMove.active),
        attacking: Boolean(keysRef.current.mouseDown),
        shield: Boolean(keysRef.current.rightMouseDown),
        mouseX: mouseWorldX,
        mouseY: mouseWorldY,
      });
    };

    sendInputRef.current = sendInputNow;

    // IMPORTANT: inputul trimis catre server era la 33ms (30Hz). Asta facea ca
    // serverul sa "vada" miscarea in trepte de 33ms, nu continuu, ceea ce crestea
    // diferenta dintre predictia locala si pozitia raportata de server si declansa
    // teleport-uri vizibile (snap) la reconciliere, chiar si singur pe server.
    // Acum trimitem la 20ms (~50Hz), mult mai aproape de tick-ul serverului (60Hz),
    // asa ca pozitia raportata de server avanseaza aproape continuu.
    const inputTimer = window.setInterval(sendInputNow, 20);

    const hudTimer = window.setInterval(() => {
      const data = worldRef.current;
      setHudData({ ...data, you: predictedYouRef.current || data.you, fps: fpsRef.current.value });
    }, 33);

    return () => {
      window.clearInterval(inputTimer);
      window.clearInterval(hudTimer);
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
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      fpsRef.current.frames += 1;
      if (now - fpsRef.current.lastAt >= 500) {
        fpsRef.current.value = Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastAt));
        fpsRef.current.frames = 0;
        fpsRef.current.lastAt = now;
      }

      const worldWidth = data.worldWidth || WORLD_WIDTH_FALLBACK;
      const worldHeight = data.worldHeight || WORLD_HEIGHT_FALLBACK;
      const zoneRadius = data.safeZoneRadius || ZONE_RADIUS_FALLBACK;

      if (data.you) {
        const serverYou = data.you;
        const current = predictedYouRef.current || { ...serverYou };

        let dx = 0;
        let dy = 0;
        if (keysRef.current.w || keysRef.current.arrowup) dy -= 1;
        if (keysRef.current.s || keysRef.current.arrowdown) dy += 1;
        if (keysRef.current.a || keysRef.current.arrowleft) dx -= 1;
        if (keysRef.current.d || keysRef.current.arrowright) dx += 1;

        const mobileMove = mobileMoveRef.current || { x: 0, y: 0, active: false };
        if (mobileMove.active) {
          dx += mobileMove.x;
          dy += mobileMove.y;
        }

        const length = Math.hypot(dx, dy) || 1;
        const isMoving = dx !== 0 || dy !== 0;
        let nextX = current.x;
        let nextY = current.y;

        if (data.status === "playing" && current.alive !== false && isMoving && (current.energy ?? 1) > 0) {
          nextX += (dx / length) * CLIENT_SPEED * dt;
          nextY += (dy / length) * CLIENT_SPEED * dt;
        }

        const safe = keepInsideSafeZone(nextX, nextY, zoneRadius, worldWidth, worldHeight, 70);

        let corrected;

        if (isMoving) {
          corrected = dampPointCapped(
            safe.x,
            safe.y,
            serverYou.x,
            serverYou.y,
            SELF_CORRECTION_MOVING,
            dt,
            SELF_SNAP_DISTANCE,
            SELF_HARD_SNAP_DISTANCE,
            SELF_MAX_CORRECTION_SPEED
          );
        } else {
          const currentX = current.x ?? safe.x;
          const currentY = current.y ?? safe.y;
          const serverDistance = Math.hypot(serverYou.x - currentX, serverYou.y - currentY);

          corrected = serverDistance > SELF_IDLE_FREEZE_DISTANCE
            ? { x: serverYou.x, y: serverYou.y }
            : { x: currentX, y: currentY };
        }

        predictedYouRef.current = {
          ...serverYou,
          x: corrected.x,
          y: corrected.y,
          moveX: isMoving ? dx / length : 0,
          moveY: isMoving ? dy / length : 0,
          isMoving,
          moveAngle: isMoving ? Math.atan2(dy, dx) : current.moveAngle ?? serverYou.moveAngle,
          attacking: Boolean(keysRef.current.mouseDown || serverYou.attacking),
          shieldActive: Boolean(serverYou.shieldActive),
          mouseX: corrected.x + (mouseRef.current.x - window.innerWidth / 2),
          mouseY: corrected.y + (mouseRef.current.y - window.innerHeight / 2),
        };

        const predicted = predictedYouRef.current;

        if (data.status === "playing" && predicted?.alive !== false) {
          const collectedOrbs = locallyCollectItems(stableOrbMapRef, hiddenOrbIdsRef, predicted, LOCAL_ORB_COLLECT_DISTANCE, now);
          const collectedEnergy = locallyCollectItems(stableEnergyMapRef, hiddenEnergyIdsRef, predicted, LOCAL_ENERGY_COLLECT_DISTANCE, now);
          locallyCollectItems(stableCoreMapRef, hiddenCoreIdsRef, predicted, LOCAL_CORE_COLLECT_DISTANCE, now);

          if (collectedOrbs > 0 || collectedEnergy > 0) {
            predictedYouRef.current = applyOptimisticEnergyCollection(
              applyOptimisticOrbCollection(predictedYouRef.current, collectedOrbs),
              collectedEnergy
            );
          }

          worldRef.current = {
            ...worldRef.current,
            you: predictedYouRef.current || worldRef.current.you,
            orbs: [...stableOrbMapRef.current.values()].filter((orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id)),
            energyCells: [...stableEnergyMapRef.current.values()].filter((cell) => !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id)),
            cores: (worldRef.current.cores || []).filter((core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id)),
          };

          if (collectedOrbs > 0 || collectedEnergy > 0) {
            setHudData({
              ...worldRef.current,
              you: predictedYouRef.current || worldRef.current.you,
              fps: fpsRef.current.value,
            });
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
          const mouseWorldX = predicted.x + (mouseRef.current.x - window.innerWidth / 2);
          const mouseWorldY = predicted.y + (mouseRef.current.y - window.innerHeight / 2);
          const localProjectile = createLocalProjectile(predicted, mouseWorldX, mouseWorldY, now);

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
        data.spectatingPlayer?.alive !== false
          ? data.spectatingPlayer
          : null;

      const currentSpectatorTarget =
        isSpectating
          ? (
              serverSpectatorTarget ||
              (data.spectatorTargetId
                ? (data.players || []).find((p) => p?.id === data.spectatorTargetId && p?.alive !== false)
                : null) ||
              (spectatorTargetRef.current?.alive !== false
                ? spectatorTargetRef.current
                : null) ||
              (data.players || []).find((p) => p?.alive !== false) ||
              null
            )
          : null;

      if (currentSpectatorTarget) {
        spectatorTargetRef.current = currentSpectatorTarget;
      }

      const incomingPlayers = new Map((data.players || []).filter((p) => p?.id && p.id !== me?.id).map((p) => [p.id, p]));

      for (const [id, target] of incomingPlayers.entries()) {
        const current = remoteMap.get(id) || target;
        const moveX = target.moveX ?? current.moveX ?? 0;
        const moveY = target.moveY ?? current.moveY ?? 0;
        const remoteIsMoving = Boolean(target.isMoving ?? current.isMoving);
        const packetAgeSeconds = Math.min(
          REMOTE_MAX_EXTRAPOLATE_MS / 1000,
          Math.max(0, (now - (target.__seenAt || now)) / 1000)
        );
        const targetX = remoteIsMoving
          ? target.x + moveX * CLIENT_SPEED * packetAgeSeconds * REMOTE_PREDICTION
          : target.x;
        const targetY = remoteIsMoving
          ? target.y + moveY * CLIENT_SPEED * packetAgeSeconds * REMOTE_PREDICTION
          : target.y;
        const predictedRemoteX = current.x ?? targetX;
        const predictedRemoteY = current.y ?? targetY;

        const remoteCorrected = dampPoint(
          predictedRemoteX,
          predictedRemoteY,
          targetX,
          targetY,
          remoteIsMoving ? REMOTE_SMOOTHING : 12,
          dt,
          0.8,
          REMOTE_HARD_SNAP_DISTANCE
        );

        remoteMap.set(id, {
          ...target,
          x: remoteCorrected.x,
          y: remoteCorrected.y,
          moveX,
          moveY,
          moveAngle: target.moveAngle ?? current.moveAngle ?? 0,
          isMoving: remoteIsMoving,
          attacking: Boolean(target.attacking),
          shieldActive: Boolean(target.shieldActive),
          mouseX: target.mouseX ?? current.mouseX ?? target.x,
          mouseY: target.mouseY ?? current.mouseY ?? target.y,
        });
      }

      for (const id of remoteMap.keys()) {
        if (!incomingPlayers.has(id)) remoteMap.delete(id);
      }

      const projectileMap = projectilesRef.current;
      const incomingProjectiles = new Map((data.projectiles || []).filter((p) => p?.id).map((p) => [p.id, p]));

      for (const [id, current] of projectileMap.entries()) {
        projectileMap.set(id, advanceProjectile(current, dt));
      }

      const localProjectilesToRemove = new Set();

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

      localProjectilesToRemove.forEach((id) => projectileMap.delete(id));

      const projectileTargets = [me, ...remoteMap.values()].filter(Boolean);

      for (const [id, projectile] of projectileMap.entries()) {
        const isIncoming = incomingProjectiles.has(id);
        const age = now - (projectile.createdAt || projectile.__seenAt || now);
        const missingAge = now - (projectile.__seenAt || now);
        const traveled = getProjectileTravelDistance(projectile);

        const visuallyHitTarget = projectileHitsAnyTarget(projectile, projectileTargets);

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

      const spectatedFromRemote =
        currentSpectatorTarget?.id
          ? remoteMap.get(currentSpectatorTarget.id) || currentSpectatorTarget
          : null;

      const liveCameraSubject = isSpectating
        ? (spectatedFromRemote || currentSpectatorTarget || me)
        : me;

      const liveYou = isSpectating
        ? (
            liveCameraSubject && liveCameraSubject.id !== me?.id
              ? { ...liveCameraSubject, skin: normalizeSkin(liveCameraSubject.skin || getSelectedSkin(user)) }
              : null
          )
        : me?.alive !== false
          ? { ...me, skin: normalizeSkin(me?.skin || getSelectedSkin(user)) }
          : null;

      const liveCameraX = liveCameraSubject ? viewport.width / 2 - liveCameraSubject.x : 0;
      const liveCameraY = liveCameraSubject ? viewport.height / 2 - liveCameraSubject.y : 0;

      if (worldElementRef.current) {
        worldElementRef.current.style.transform = `translate3d(${liveCameraX}px, ${liveCameraY}px, 0)`;
      }

      const liveBounds = getViewportBounds(liveCameraX, liveCameraY, viewport, 820);
      const livePlayers = collectVisible(
        remoteMap.values(),
        (player) => player?.id !== liveYou?.id && isVisible(player, liveBounds, 380),
        MAX_VISIBLE_REMOTE_PLAYERS,
        (player) => ({ ...player, skin: normalizeSkin(player.skin), isBot: false })
      );
      const liveOrbs = collectVisible(
        stableOrbMapRef.current.values(),
        (orb) => !isHiddenCollected(hiddenOrbIdsRef.current, orb.id) && isVisible(orb, liveBounds, 45),
        560
      );
      const liveEnergyCells = collectVisible(
        stableEnergyMapRef.current.values(),
        (cell) => !isHiddenCollected(hiddenEnergyIdsRef.current, cell.id) && isVisible(cell, liveBounds, 70),
        130
      );
      const liveCores = collectVisible(
        data.cores || [],
        (core) => !isHiddenCollected(hiddenCoreIdsRef.current, core.id) && isVisible(core, liveBounds, 130),
        18
      );
      const liveProjectiles = collectVisible(
        projectileMap.values(),
        (projectile) => isVisible(projectile, liveBounds, 180),
        120
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
        cameraX: liveCameraX,
        cameraY: liveCameraY,
        scale: 1,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        coreColorMap: coreColorMapRef.current,
        otherPlayerSize: 112,
        otherPlayerQuality: 2,
      };

      // IMPORTANT: inainte se construiau [...remoteMap.values()] si [...projectileMap.values()]
      // DIN NOU aici, desi liste foarte similare (livePlayers/liveProjectiles) fusesera deja
      // construite mai sus pentru pixiLiveRef. La 60-144 frame-uri/secunda, aceste alocari
      // duble de array-uri (plus toate filter/map/slice intermediare) creeaza presiune mare pe
      // garbage collector, iar cand GC-ul ruleaza o colectare majora browserul "ingheata" un
      // frame - exact spike-urile de FPS care scad la 30 si revin. Acum refolosim direct
      // remoteMap/projectileMap (Map-urile live, deja actualizate mai sus) fara sa construim
      // liste suplimentare; setRenderData ruleaza oricum doar la ~15Hz (66ms), nu la fiecare frame.
      if (now - lastRenderSyncRef.current >= 66) {
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
      sendInputRef.current();
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

      sendInputRef.current();
    };

    const onMouseMove = (event) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseDown = (event) => {
      if (event.button === 0) keysRef.current.mouseDown = true;
      if (event.button === 2) keysRef.current.rightMouseDown = true;
      sendInputRef.current();
    };

    const onMouseUp = (event) => {
      if (event.button === 0) keysRef.current.mouseDown = false;
      if (event.button === 2) keysRef.current.rightMouseDown = false;
      sendInputRef.current();
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
      sendInputRef.current();
    };
    const onContextMenu = (event) => event.preventDefault();
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const nextMobile = isRealMobileDevice();
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

    setMobileJoystick({
      active,
      knobX: vector.knobX,
      knobY: vector.knobY,
    });

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
    setMobileJoystick({ active: false, knobX: 0, knobY: 0 });

    if (predictedYouRef.current) {
      predictedYouRef.current = {
        ...predictedYouRef.current,
        moveX: 0,
        moveY: 0,
        isMoving: false,
      };
    }

    sendInputRef.current();
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
    sendInputRef.current();
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
    sendInputRef.current();

    window.setTimeout(() => {
      keysRef.current.mouseDown = false;
      sendInputRef.current();
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
    sendInputRef.current();
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
    sendInputRef.current();
  };

  const you = renderData.you;
  const hudYou = hudData.you || you;
  const worldWidth = renderData.worldWidth || WORLD_WIDTH_FALLBACK;
  const worldHeight = renderData.worldHeight || WORLD_HEIGHT_FALLBACK;
  const safeZoneRadius = renderData.safeZoneRadius || ZONE_RADIUS_FALLBACK;

  const isDead = Boolean(you && you.alive === false);
  const liveSpectatorCandidates = (renderData.players || []).filter((player) => player?.alive !== false);

  const serverSpectatingPlayer =
    renderData.spectatingPlayer?.alive !== false
      ? renderData.spectatingPlayer
      : null;

  const spectatorTarget =
    isDead
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

  const cameraX = cameraSubject ? viewport.width / 2 - cameraSubject.x : 0;
  const cameraY = cameraSubject ? viewport.height / 2 - cameraSubject.y : 0;
  const bounds = getViewportBounds(cameraX, cameraY, viewport, 750);

  const visibleOrbs = collectVisible(renderData.orbs || [], (orb) => isVisible(orb, bounds, 40), 520);
  const visibleEnergyCells = collectVisible(renderData.energyCells || [], (cell) => isVisible(cell, bounds, 60), 120);
  const visibleCores = collectVisible(renderData.cores || [], (core) => isVisible(core, bounds, 120), 18);
  const visiblePlayers = collectVisible(renderData.players || [], (player) => isVisible(player, bounds, 360), MAX_VISIBLE_REMOTE_PLAYERS);
  const visibleProjectiles = collectVisible(renderData.projectiles || [], (projectile) => isVisible(projectile, bounds, 160), 100);

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
  const isWaiting = status !== "playing" && status !== "finished";
  const isFinished = status === "finished";
  const playersAlive = hudData.playerCount || renderData.playerCount || 1;
  const minPlayers = hudData.minPlayers || renderData.minPlayers || 1;
  const maxPlayers = hudData.maxPlayers || renderData.maxPlayers || 2;
  const countdown = hudData.countdown || renderData.countdown;
  const winnerName = hudData.winnerName || renderData.winnerName;
  const coreDropCountdown = hudData.coreDropCountdown || renderData.coreDropCountdown;

  const hp = hudYou?.hp ?? 100;
  const maxHp = hudYou?.maxHp ?? 100;
  const energy = hudYou?.energy ?? 100;
  const progress = hudYou?.progress ?? 0;
  const nextDroneAt = hudYou?.nextDroneAt ?? 5;

  return (
    <div className={`game-arena pvp-dom-arena normal-pvp-dom-arena ${isMobileControls ? "is-mobile-device is-mobile-portrait" : ""} ${mobileAttackActive ? "is-mobile-attacking" : ""}`}>
      <div
        ref={worldElementRef}
        className="world"
        style={{
          width: worldWidth,
          height: worldHeight,
          transform: `translate3d(${cameraX}px, ${cameraY}px, 0)`,
        }}
      >
        <div
          className="battle-zone"
          style={{
            left: worldWidth / 2,
            top: worldHeight / 2,
            width: safeZoneRadius * 2,
            height: safeZoneRadius * 2,
          }}
        />

        {/* Entitatile PvP NU mai sunt randate ca sute de div-uri DOM.
            PixiArenaRenderer le deseneaza pe canvas si elimina lag-ul mare. */}
      </div>

      <PixiArenaRenderer
        player={rendererPlayer}
        players={rendererPlayers}
        orbs={visibleOrbs}
        energyCells={visibleEnergyCells}
        cores={visibleCores}
        projectiles={visibleProjectiles}
        cameraX={cameraX}
        cameraY={cameraY}
        scale={1}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        coreTypes={CORE_TYPES}
        otherPlayerSize={112}
        otherPlayerQuality={2}
        liveDataRef={pixiLiveRef}
        forceLowQuality={graphicsQuality === "low"}
      />

      {you && !isDead && (
        <svg className="aim-svg" aria-hidden="true">
          <line className="aim-svg-line" x1={viewport.width / 2} y1={viewport.height / 2} x2={mouseRef.current.x} y2={mouseRef.current.y} />
          <circle className="aim-svg-circle" cx={mouseRef.current.x} cy={mouseRef.current.y} r="34" />
          <g
            className="aim-svg-arrow"
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
        <strong>PLAYERS ONLINE: {playersAlive}</strong>
        <span>
          {status === "finished"
            ? `Winner: ${winnerName || "Player"}`
            : `Max ${maxPlayers} players / no zone`}
        </span>
      </div>

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
          safeZoneRadius={null}
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
            <h1>YOU LOST</h1>
            <p>
              {spectatorTarget
                ? `Following ${spectatorTarget.username || "player"} live`
                : "Waiting for an alive player to spectate"}
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
          <p>{hudYou?.id === (hudData.winnerId || renderData.winnerId) ? "Ai castigat meciul." : "Meciul s-a terminat."}</p>
          <button onClick={onExitToMenu}>EXIT TO MENU</button>
        </div>
      )}

      {isMobileControls && !isDead && (
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
            className="pvp-mobile-joystick-knob"
            style={{
              transform: `translate(calc(-50% + ${mobileJoystick.knobX}px), calc(-50% + ${mobileJoystick.knobY}px))`,
            }}
          />
        </div>

        <div className="pvp-mobile-buttons">
          <button
            type="button"
            className={`pvp-mobile-action pvp-mobile-shield ${mobileShieldActive ? "is-active" : ""}`}
            onPointerDown={onShieldPointerDown}
            onPointerUp={stopMobileShield}
            onPointerCancel={stopMobileShield}
          >
            SHIELD
          </button>

          <button
            type="button"
            className={`pvp-mobile-action pvp-mobile-attack ${mobileAttackActive ? "is-active" : ""}`}
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

      <button className="pvp-exit-btn" onClick={onExitToMenu}>EXIT TO MENU</button>
    </div>
  );
}

export default NormalPvpArena;
