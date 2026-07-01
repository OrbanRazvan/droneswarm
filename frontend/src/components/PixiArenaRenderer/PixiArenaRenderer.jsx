import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import "./PixiArenaRenderer.css";

/*
  WebGL renderer for all arena modes.

  Important architectural rules:
  - React never owns per-frame game entities. It only gives the renderer the
    latest snapshot / live ref.
  - Every repeated vector shape is a shared PIXI.GraphicsContext. The renderer
    moves pooled Graphics/Container instances instead of clear() + rebuilding
    hundreds of vector paths every frame.
  - HUD, menus and touch controls remain DOM. World, players, items,
    projectiles and zone are WebGL only.
*/

const ORB_COLORS = {
  cyan: 0x00eaff,
  green: 0x7cff2e,
  orange: 0xff9d00,
  purple: 0xa855ff,
  red: 0xff4040,
  pink: 0xff4fc3,
};

const SKIN_THEMES = {
  cyan: [0x00eaff, 0x78f7ff, 0x003140, 0xffffff],
  red: [0xff4040, 0xff9a9a, 0x380000, 0xffffff],
  purple: [0x9b5cff, 0xd5b6ff, 0x180034, 0xffffff],
  orange: [0xff9f1c, 0xffd166, 0x4b2100, 0xfff7e6],
  green: [0x19ff8a, 0x8cffc4, 0x00391f, 0xffffff],
  pink: [0xff4fd8, 0xffb8ef, 0x4d003c, 0xffffff],
  "ice-blue": [0x7de7ff, 0xe7fbff, 0x07314a, 0xffffff],
  "solar-gold": [0xffd447, 0xfff0a8, 0x513a00, 0xffffff],
  "shadow-black": [0x2e3440, 0x6b7280, 0x05070c, 0xbdeeff],
  "toxic-lime": [0xb6ff00, 0xe8ff8a, 0x284000, 0xffffff],
  "royal-violet": [0x6d28d9, 0xc4b5fd, 0x14002e, 0xf8f5ff],
  "crimson-white": [0xdc143c, 0xffffff, 0x43000d, 0xfff5f7],
  "neon-teal": [0x00ffcc, 0xa7ffee, 0x003c33, 0xffffff],
  "ember-red": [0xff5a1f, 0xffb86b, 0x451100, 0xfff0e6],
  "arctic-silver": [0xc7d2fe, 0xf8fafc, 0x1e293b, 0xffffff],
  "void-purple": [0x4c1d95, 0xa78bfa, 0x070012, 0xe9d5ff],
  "plasma-pink": [0xff00aa, 0xff7adf, 0x3f0030, 0xffffff],
  "jade-black": [0x00a86b, 0x86efac, 0x001e14, 0xeafff5],
  "azure-white": [0x38bdf8, 0xffffff, 0x082f49, 0xffffff],
  "inferno-orange": [0xff6b00, 0xffcf33, 0x4a1300, 0xfff4df],
  "midnight-blue": [0x1e3a8a, 0x60a5fa, 0x020617, 0xdbeafe],
  "acid-green": [0x39ff14, 0xc6ff8a, 0x0f2b00, 0xffffff],
  "ruby-black": [0xe11d48, 0xfb7185, 0x09090b, 0xffe4e6],
  "ghost-white": [0xe5e7eb, 0xffffff, 0x334155, 0xffffff],
  "cyber-yellow": [0xfaff00, 0xfff7ad, 0x3a3800, 0xffffff],
  "deep-ocean": [0x006994, 0x67e8f9, 0x001b2e, 0xe0ffff],
  "magenta-cyan": [0xff00ff, 0x00ffff, 0x250033, 0xffffff],
  "bronze-steel": [0xb87333, 0xd1d5db, 0x2b1605, 0xfff7ed],
  "electric-indigo": [0x4f46e5, 0x93c5fd, 0x0b102f, 0xeef2ff],
  "dark-emerald": [0x047857, 0x34d399, 0x001f16, 0xd1fae5],
  "emerald-rift-a": [0x00ff99, 0xa7ffd7, 0x00291a, 0xffffff],
  "emerald-rift-b": [0x00d47a, 0x7cffc4, 0x001f14, 0xffffff],
  "emerald-rift-c": [0x45ffb0, 0xd8ffef, 0x003322, 0xffffff],
  "heist-attacker-cyan": [0x00dffc, 0x8ff7ff, 0x052538, 0xf4fdff],
  "heist-defender-cyan": [0x0b9fe8, 0x9aeaff, 0x06223b, 0xf5fdff],
  "heist-tank-cyan": [0x182b3d, 0x00d9ff, 0x050c16, 0xc9f8ff],
  "heist-attacker-orange": [0xff5e43, 0xffd1b8, 0x3d110c, 0xfff7ef],
  "heist-defender-orange": [0x0d82c7, 0xff8c73, 0x061927, 0xf5fcff],
  "heist-tank-orange": [0x2a2428, 0xff935a, 0x08090d, 0xffe4c9],
};

const MAX_MINI_DRONES = 5;
const DEFAULT_WORLD_WIDTH = 15000;
const DEFAULT_WORLD_HEIGHT = 15000;
const STATIC_SYNC_INTERVAL_MS = 120;
const ENTITY_STALE_MS = 500;
const MAX_RENDERED_PLAYERS = 60;
const MAX_RENDERED_PROJECTILES = 96;
const COMBAT_EVENT_MAX_RENDERED = 32;

// Battle Royale-only pixel terrain. It is generated once as a low-resolution
// canvas texture and scaled across the complete world with nearest-neighbour
// sampling. It is visual-only: no collision, spawn, loot or game-rule code
// reads this layer.
const PIXEL_TERRAIN_THEME = "battle-royale-pixel-terrain";
// Battle Royale keeps the legacy name; Normal / Zone use the explicit alias.
// Both resolve to the same cached premium space-battle visual.
const SPACE_BATTLE_THEMES = new Set([
  PIXEL_TERRAIN_THEME,
  "premium-space-battle",
]);
const WORLD_TERRAIN_TEXTURE_CACHE = new Map();
// A single small, cached texture gives every game mode a space backdrop. It is
// intentionally independent from the Battle Royale terrain, so even a weak
// laptop keeps stars while the heavier decorative terrain is disabled.
const UNIVERSAL_STARFIELD_TEXTURE_CACHE = new Map();
const PIXEL_TERRAIN_TEXTURE_SIZE = 1536;
const PIXEL_TERRAIN_CELL_SIZE = 3;

// All motion below is transform-only: no Graphics geometry is rebuilt while
// the game runs. That keeps turns and shields smooth even in 50–60 player rooms.
const MAIN_ROTOR_POINTS = [
  [-59, -45],
  [59, -45],
  [-59, 45],
  [59, 45],
];
const MINI_ROTOR_POINTS = [
  [-17, -13],
  [17, -13],
  [-17, 13],
  [17, 13],
];
const TURN_RESPONSE = 10.5;
const BANK_RESPONSE = 13;
const SHIELD_RESPONSE = 14;

function normalizeSkin(skin) {
  const value = String(skin || "cyan")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  return SKIN_THEMES[value] ? value : "cyan";
}

function colorFrom(value, fallback = 0xffffff) {
  if (typeof value === "number") return value;
  const source = String(value || "").replace("#", "").slice(0, 6);
  const parsed = Number.parseInt(source, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shortestAngleDelta(from, to) {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI * 3) % fullTurn) - Math.PI;
}

function lerpAngle(from, to, amount) {
  return from + shortestAngleDelta(from, to) * clamp(amount, 0, 1);
}

function damp(current, target, response, deltaSeconds) {
  const amount = 1 - Math.exp(-Math.max(0, response) * Math.max(0, deltaSeconds));
  return current + (target - current) * amount;
}

function dampAngle(from, to, response, deltaSeconds) {
  const amount = 1 - Math.exp(-Math.max(0, response) * Math.max(0, deltaSeconds));
  return lerpAngle(from, to, amount);
}

function getUnitFacingTarget(unit, fallback = 0) {
  const moveX = Number(unit?.moveX || 0);
  const moveY = Number(unit?.moveY || 0);
  const moving = Boolean(unit?.isMoving) || Math.hypot(moveX, moveY) > 0.015;
  const declaredAngle = Number(unit?.moveAngle);

  if (moving && Number.isFinite(declaredAngle)) {
    // The illustrated drone has its nose at the top of the local coordinate system.
    return declaredAngle + Math.PI * 0.5;
  }

  if (moving) {
    return Math.atan2(moveY, moveX) + Math.PI * 0.5;
  }

  return fallback;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
}

function getRendererDeviceProfile(forceLowQuality = false) {
  const mobile = isMobileDevice();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const deviceMemory = typeof navigator !== "undefined" && typeof navigator.deviceMemory === "number"
    ? Number(navigator.deviceMemory)
    : null;
  const cores = typeof navigator !== "undefined" ? Number(navigator.hardwareConcurrency || 4) : 4;
  const weakMobile = mobile && (cores <= 4 || (deviceMemory !== null && deviceMemory <= 4));
  const weakDesktop = !mobile && (
    cores <= 4 || (deviceMemory !== null && deviceMemory <= 8)
  );

  // Weak desktop hardware starts in the same visual profile as a good desktop.
  // It is not permanently downgraded based only on CPU/RAM heuristics; the
  // adaptive loop below lowers detail only if real frame time proves it is needed.
  // `forceLowQuality` remains an explicit player choice.
  const lowSpecDesktop = Boolean(!mobile && forceLowQuality);
  const visualFirstWeakDesktop = Boolean(!mobile && weakDesktop && !forceLowQuality);
  const forcedMobileQuality = Boolean(mobile && forceLowQuality);

  return {
    mobile,
    dpr,
    deviceMemory,
    cores,
    weakMobile,
    weakDesktop,
    lowSpecDesktop,
    visualFirstWeakDesktop,
    forcedMobileQuality,
  };
}

function getRendererConfig(forceLowQuality) {
  const device = getRendererDeviceProfile(forceLowQuality);

  // Telefoanele păstrează profilul premium complet, exact ca înainte.
  const premiumMobile = Boolean(device.mobile);
  const lowSpec = Boolean(device.lowSpecDesktop);
  const visualFirstDesktop = Boolean(device.visualFirstWeakDesktop);

  // Profil exclusiv pentru laptop/PC slab:
  // 0.68 producea o imagine vizibil pixelată. 0.92 este suficient de clar
  // pentru muchii, texturi și drone, dar rămâne mult mai ieftin decât 1.35.
  // Păstrăm fără MSAA și fără terrain greu, iar sub presiune reducem întâi
  // obiectele decorative, nu rezoluția canvasului.
  const weakDesktopClarity = Boolean(lowSpec || visualFirstDesktop);
  const weakDesktopResolution = Math.min(
    0.92,
    Math.max(0.82, Math.min(1, Number(device.dpr || 1))),
  );

  const resolution = weakDesktopClarity
    ? weakDesktopResolution
    : Math.min(1.35, device.dpr);

  return {
    ...device,

    premiumMobile,
    weakMobile: false,
    forcedMobileQuality: false,

    // Folosit doar de hot-path-ul rendererului pentru laptopuri/PC-uri slabe.
    weakDesktopClarity,

    resolution,

    // Rezoluția mai mare oferă deja contururi mai curate. MSAA rămâne oprit
    // strict pe desktop slab deoarece este costisitor pe iGPU-uri vechi.
    antialias: premiumMobile || !weakDesktopClarity,

    // Bugetele actuale de obiecte rămân prudente. Imaginea devine mai clară
    // din rezoluție, nu prin dublarea numărului de obiecte randate.
    maxStaticItems: lowSpec
      ? 38
      : visualFirstDesktop
        ? 58
        : 120,

    maxPlayers: lowSpec
      ? 4
      : visualFirstDesktop
        ? 5
        : MAX_RENDERED_PLAYERS,

    maxSimplePlayers: 60,

    maxProjectiles: lowSpec
      ? 6
      : visualFirstDesktop
        ? 9
        : MAX_RENDERED_PROJECTILES,

    maxSimpleProjectiles: lowSpec
      ? 30
      : visualFirstDesktop
        ? 32
        : 48,

    staticSyncInterval: lowSpec
      ? 620
      : visualFirstDesktop
        ? 560
        : STATIC_SYNC_INTERVAL_MS,

    animateStaticEvery: lowSpec
      ? 10
      : visualFirstDesktop
        ? 7
        : 1,

    // Fundalul terrain mare rămâne oprit doar pe desktop slab. Asta păstrează
    // fill-rate pentru drone și proiectile, în timp ce canvasul rămâne clar.
    disableExpensiveTerrain: weakDesktopClarity,
  };
}

function createRotorModule(ctx, x, y, radius, colors, mini = false) {
  const [primary, secondary, dark, highlight] = colors;
  const guardWidth = mini ? 1.25 : 2.8;
  const bladeWidth = mini ? 2.1 : 4.5;
  const hubRadius = mini ? 2.5 : 5.8;
  const bladeLength = mini ? radius * 0.58 : radius * 0.64;

  // Carbon guard + neon edge. The large radius makes the drone immediately
  // readable as a real quadcopter instead of four floating circles.
  ctx.circle(x, y, radius).fill({ color: dark, alpha: 0.95 });
  ctx.circle(x, y, radius - (mini ? 1.3 : 2.8)).fill({ color: 0x020713, alpha: 0.9 });
  ctx.circle(x, y, radius).stroke({ color: secondary, width: guardWidth, alpha: 0.84 });
  ctx.circle(x, y, radius - (mini ? 2.4 : 5.2)).stroke({ color: primary, width: mini ? 0.9 : 1.55, alpha: 0.58 });

  // Two broad, crossed blades: visually like propellers, but still a static
  // shared context, so this has zero per-frame geometry cost.
  ctx.moveTo(x - bladeLength, y - bladeLength * 0.34)
    .lineTo(x + bladeLength, y + bladeLength * 0.34)
    .stroke({ color: secondary, width: bladeWidth, alpha: 0.42 });
  ctx.moveTo(x - bladeLength * 0.34, y + bladeLength)
    .lineTo(x + bladeLength * 0.34, y - bladeLength)
    .stroke({ color: primary, width: bladeWidth, alpha: 0.31 });

  ctx.circle(x, y, hubRadius + (mini ? 1.2 : 2.2)).fill({ color: dark, alpha: 1 });
  ctx.circle(x, y, hubRadius).fill({ color: primary, alpha: 0.98 });
  ctx.circle(x - hubRadius * 0.32, y - hubRadius * 0.38, Math.max(1.1, hubRadius * 0.34))
    .fill({ color: highlight, alpha: 0.92 });
}

function getHeistRoleVariantFromSkin(skin) {
  const value = String(skin || "").trim().toLowerCase();
  if (value.startsWith("heist-attacker-")) return "attacker";
  if (value.startsWith("heist-defender-")) return "defender";
  if (value.startsWith("heist-tank-")) return "tank";
  return null;
}


function getHeistRotorLayout(variant) {
  if (variant === "attacker") {
    // Three compact vector-thrusters: two wing pods and one central tail pod.
    return [[-54, 20], [54, 20], [0, 54], null];
  }

  if (variant === "defender") {
    // Four compact lift pods around a rounded guardian hull. They are close to
    // the fuselage so the craft stays elegant rather than wide or balloon-like.
    return [[-39, -4], [39, -4], [-33, 37], [33, 37]];
  }

  if (variant === "tank") {
    // Heavy dropship layout, deliberately broad but not round.
    return [[-61, -14], [61, -14], [-58, 34], [58, 34]];
  }

  return MAIN_ROTOR_POINTS.map(([x, y]) => [x, y]);
}

function createHeistRotorPod(ctx, x, y, size, colors, accentMode = "standard") {
  const [primary, secondary, dark, highlight] = colors;
  const width = size;
  const height = size * 0.78;
  const podDark = accentMode === "tank" ? 0x102638 : dark;

  // Mechanical pod: faceted shell instead of a large circular outline.
  ctx.poly([
    x, y - height,
    x + width * 0.72, y - height * 0.44,
    x + width * 0.84, y + height * 0.28,
    x + width * 0.36, y + height * 0.76,
    x - width * 0.36, y + height * 0.76,
    x - width * 0.84, y + height * 0.28,
    x - width * 0.72, y - height * 0.44,
  ]).fill({ color: podDark, alpha: 0.98 });

  ctx.poly([
    x, y - height * 0.78,
    x + width * 0.55, y - height * 0.34,
    x + width * 0.62, y + height * 0.20,
    x + width * 0.27, y + height * 0.52,
    x - width * 0.27, y + height * 0.52,
    x - width * 0.62, y + height * 0.20,
    x - width * 0.55, y - height * 0.34,
  ]).fill({ color: primary, alpha: accentMode === "tank" ? 0.48 : 0.66 });

  ctx.roundRect(x - width * 0.29, y - height * 0.22, width * 0.58, height * 0.56, height * 0.17)
    .fill({ color: 0x020914, alpha: 0.92 });
  ctx.circle(x, y + height * 0.03, height * 0.22).fill({ color: secondary, alpha: 0.72 });
  ctx.circle(x, y + height * 0.03, height * 0.105).fill({ color: highlight, alpha: 0.96 });
  ctx.roundRect(x - width * 0.19, y - height * 0.52, width * 0.38, height * 0.10, height * 0.04)
    .fill({ color: highlight, alpha: 0.72 });
}

function createHeistAttackerContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Fast interceptor: clean swept body, pointed nose and a three-engine tail.
  ctx.poly([
    0, -88,
    15, -65,
    31, -44,
    79, -12,
    84, 1,
    49, 14,
    27, 10,
    18, 42,
    0, 66,
    -18, 42,
    -27, 10,
    -49, 14,
    -84, 1,
    -79, -12,
    -31, -44,
    -15, -65,
  ]).fill({ color: dark, alpha: 1 });

  ctx.poly([
    0, -82,
    10, -61,
    25, -41,
    70, -10,
    73, -2,
    43, 7,
    22, 2,
    12, 35,
    0, 56,
    -12, 35,
    -22, 2,
    -43, 7,
    -73, -2,
    -70, -10,
    -25, -41,
    -10, -61,
  ]).fill({ color: primary, alpha: 1 });

  // Thin swept wings, layered as solid armor panels rather than wire outlines.
  ctx.poly([-27, -30, -96, 0, -74, 16, -22, -5]).fill({ color: dark, alpha: 0.98 });
  ctx.poly([27, -30, 96, 0, 74, 16, 22, -5]).fill({ color: dark, alpha: 0.98 });
  ctx.poly([-29, -26, -86, 0, -68, 8, -20, -8]).fill({ color: primary, alpha: 0.88 });
  ctx.poly([29, -26, 86, 0, 68, 8, 20, -8]).fill({ color: primary, alpha: 0.88 });
  ctx.poly([-67, 1, -35, -10, -28, -5, -58, 8]).fill({ color: secondary, alpha: 0.52 });
  ctx.poly([67, 1, 35, -10, 28, -5, 58, 8]).fill({ color: secondary, alpha: 0.52 });

  // Long dark canopy with a bright central targeting slit.
  ctx.poly([0, -67, 9, -45, 8, -15, 0, -5, -8, -15, -9, -45]).fill({ color: 0x06111d, alpha: 1 });
  ctx.poly([0, -61, 4.4, -44, 3.5, -22, 0, -15, -3.5, -22, -4.4, -44]).fill({ color: secondary, alpha: 0.82 });
  ctx.poly([0, -56, 2.1, -42, 0, -29, -2.1, -42]).fill({ color: highlight, alpha: 0.98 });

  // Integrated weapon rails and nacelle status lights.
  [-1, 1].forEach((side) => {
    ctx.roundRect(side * 27 - 2.6, -14, 5.2, 29, 1.6).fill({ color: 0x06111d, alpha: 0.9 });
    ctx.roundRect(side * 27 - 0.9, -11, 1.8, 21, 0.8).fill({ color: highlight, alpha: 0.9 });
    ctx.circle(side * 47, 4, 2.8).fill({ color: secondary, alpha: 0.94 });
  });
  ctx.roundRect(-9, 30, 18, 12, 3).fill({ color: 0x06111d, alpha: 0.94 });
  ctx.roundRect(-5, 33, 10, 5.4, 2).fill({ color: highlight, alpha: 0.94 });

  createHeistRotorPod(ctx, -54, 20, 19, colors, "attacker");
  createHeistRotorPod(ctx, 54, 20, 19, colors, "attacker");
  createHeistRotorPod(ctx, 0, 54, 17, colors, "attacker");

  return ctx;
}

function createHeistDefenderContext(colors) {
  const ctx = new PIXI.GraphicsContext();

  // Defender = shield frigate / guardian drone. More visibly "protective":
  // central blue hull, curved guard vanes and a luminous forward aegis emitter.
  const shadow = 0x031420;
  const darkSteel = 0x0a3048;
  const hull = 0x1187c8;
  const armor = 0x26b7ff;
  const shieldBlue = 0x37d8ff;
  const shieldEdge = 0x99f4ff;
  const hot = 0xf3fdff;
  const coreBlue = 0x0c5b84;

  // Main guardian hull: compact teardrop with an armored defensive spine.
  ctx.poly([
    0, -88,
    18, -70,
    28, -32,
    24, 18,
    12, 52,
    0, 76,
    -12, 52,
    -24, 18,
    -28, -32,
    -18, -70,
  ]).fill({ color: shadow, alpha: 1 });

  ctx.poly([
    0, -80,
    13, -64,
    21, -30,
    18, 15,
    9, 45,
    0, 66,
    -9, 45,
    -18, 15,
    -21, -30,
    -13, -64,
  ]).fill({ color: hull, alpha: 1 });

  // Forward bridge / nose projector.
  ctx.poly([0, -96, 11, -72, 8, -41, 0, -24, -8, -41, -11, -72]).fill({ color: shadow, alpha: 1 });
  ctx.poly([0, -88, 5, -69, 4, -48, 0, -36, -4, -48, -5, -69]).fill({ color: shieldBlue, alpha: 0.96 });
  ctx.poly([0, -82, 2.1, -65, 0, -53, -2.1, -65]).fill({ color: hot, alpha: 0.98 });

  // Guard vanes: unmistakable defender silhouette, like deployable shield wings.
  [-1, 1].forEach((side) => {
    ctx.poly([
      side * 18, -40,
      side * 62, -52,
      side * 78, -26,
      side * 67, 8,
      side * 24, -2,
    ]).fill({ color: darkSteel, alpha: 0.98 });

    ctx.poly([
      side * 22, -36,
      side * 55, -44,
      side * 66, -24,
      side * 59, 1,
      side * 27, -6,
    ]).fill({ color: armor, alpha: 0.92 });

    ctx.poly([
      side * 32, -31,
      side * 50, -35,
      side * 56, -22,
      side * 48, -5,
      side * 33, -9,
    ]).fill({ color: shieldEdge, alpha: 0.78 });

    ctx.roundRect(side * 29 - 2.1, -10, 4.2, 23, 1.8).fill({ color: shieldBlue, alpha: 0.68 });
    ctx.circle(side * 27, 3, 2.4).fill({ color: hot, alpha: 0.96 });
  });

  // Central body details / shield core.
  ctx.roundRect(-17, -4, 34, 39, 13).fill({ color: darkSteel, alpha: 0.94 });
  ctx.roundRect(-11, 3, 22, 25, 10).fill({ color: coreBlue, alpha: 0.94 });
  ctx.ellipse(0, 15, 8.2, 10.2).fill({ color: shieldBlue, alpha: 0.92 });
  ctx.circle(0, 15, 3.4).fill({ color: hot, alpha: 0.98 });
  ctx.poly([0, 46, 12, 62, 0, 86, -12, 62]).fill({ color: shadow, alpha: 1 });
  ctx.poly([0, 53, 5.5, 66, 0, 79, -5.5, 66]).fill({ color: shieldBlue, alpha: 0.88 });

  // Decorative shield lens plates.
  ctx.poly([-11, -18, -4, -11, -4, 1, -11, 7, -17, 0, -17, -12]).fill({ color: shieldEdge, alpha: 0.72 });
  ctx.poly([11, -18, 4, -11, 4, 1, 11, 7, 17, 0, 17, -12]).fill({ color: shieldEdge, alpha: 0.72 });

  createHeistRotorPod(ctx, -38, -1, 12.8, [hull, shieldBlue, shadow, hot], "defender");
  createHeistRotorPod(ctx, 38, -1, 12.8, [hull, shieldBlue, shadow, hot], "defender");
  createHeistRotorPod(ctx, -30, 38, 12.2, [hull, shieldBlue, shadow, hot], "defender");
  createHeistRotorPod(ctx, 30, 38, 12.2, [hull, shieldBlue, shadow, hot], "defender");

  return ctx;
}
function createHeistTankContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();
  const isOrangeTeam = primary > 0xf00000;
  // Tank stays dark/gunmetal, but never blacked-out: readable charcoal-blue armor.
  const hull = isOrangeTeam ? 0x573139 : 0x173b55;
  const plate = isOrangeTeam ? 0x9a5848 : 0x2b6f99;
  const shadow = isOrangeTeam ? 0x241319 : 0x071827;
  const steel = isOrangeTeam ? 0x6d3e3c : 0x25516d;
  const reactor = isOrangeTeam ? 0xffa46d : 0x55d9ff;

  // TANK — compact sci-fi gunship. Wide armored bow, rear twin-thruster spine.
  ctx.poly([
    0, -78,
    30, -65,
    72, -38,
    98, -4,
    94, 30,
    63, 49,
    26, 63,
    0, 71,
    -26, 63,
    -63, 49,
    -94, 30,
    -98, -4,
    -72, -38,
    -30, -65,
  ]).fill({ color: shadow, alpha: 1 });

  ctx.poly([
    0, -70,
    24, -58,
    62, -34,
    85, -5,
    80, 23,
    54, 39,
    20, 53,
    0, 59,
    -20, 53,
    -54, 39,
    -80, 23,
    -85, -5,
    -62, -34,
    -24, -58,
  ]).fill({ color: hull, alpha: 1 });

  // Heavy top armor: layered filled plates only, no wireframe contours.
  ctx.poly([-54, -32, -18, -54, -9, -7, -47, 15]).fill({ color: plate, alpha: 0.88 });
  ctx.poly([54, -32, 18, -54, 9, -7, 47, 15]).fill({ color: plate, alpha: 0.88 });
  ctx.poly([-39, 13, 0, 42, 39, 13, 24, 8, 0, 23, -24, 8]).fill({ color: steel, alpha: 0.96 });
  ctx.poly([-25, 18, 0, 35, 25, 18, 11, 18, 0, 27, -11, 18]).fill({ color: primary, alpha: 0.48 });

  // Angular bridge / armored sensor wedge.
  ctx.poly([0, -73, 15, -53, 10, -27, 0, -17, -10, -27, -15, -53]).fill({ color: 0x071522, alpha: 1 });
  ctx.poly([0, -66, 6.5, -50, 4.4, -35, 0, -28, -4.4, -35, -6.5, -50]).fill({ color: reactor, alpha: 0.74 });
  ctx.poly([0, -61, 2.4, -49, 0, -40, -2.4, -49]).fill({ color: 0xeaffff, alpha: 0.96 });

  // Distinct armored "hammer" wings / heavy weapon nacelles.
  [-1, 1].forEach((side) => {
    ctx.poly([
      side * 55, -25,
      side * 102, -11,
      side * 102, 18,
      side * 67, 34,
      side * 45, 16,
      side * 42, -8,
    ]).fill({ color: shadow, alpha: 1 });
    ctx.poly([
      side * 60, -19,
      side * 90, -9,
      side * 90, 12,
      side * 66, 24,
      side * 53, 12,
      side * 51, -5,
    ]).fill({ color: plate, alpha: 0.90 });
    ctx.poly([
      side * 75, -13,
      side * 92, -6,
      side * 91, 1,
      side * 73, -3,
    ]).fill({ color: reactor, alpha: 0.62 });
    ctx.roundRect(side * 67 - 4.2, 4, 8.4, 14, 2.2).fill({ color: 0x06131f, alpha: 0.94 });
    ctx.roundRect(side * 67 - 1.0, 7, 2.0, 8, 1).fill({ color: reactor, alpha: 0.94 });
    ctx.circle(side * 67, 21, 3.4).fill({ color: 0xeaffff, alpha: 0.94 });
  });

  // Rear reactor pack plus two visible exhaust nodes.
  ctx.poly([-29, 32, -13, 58, 0, 68, 13, 58, 29, 32, 10, 37, 0, 52, -10, 37]).fill({ color: 0x06131f, alpha: 0.98 });
  ctx.poly([-18, 39, 0, 59, 18, 39, 7, 40, 0, 52, -7, 40]).fill({ color: primary, alpha: 0.64 });
  ctx.circle(0, 50, 5.1).fill({ color: reactor, alpha: 0.96 });
  ctx.circle(0, 50, 2.2).fill({ color: 0xffffff, alpha: 0.92 });

  createHeistRotorPod(ctx, -67, -3, 16.8, colors, "tank");
  createHeistRotorPod(ctx, 67, -3, 16.8, colors, "tank");
  createHeistRotorPod(ctx, -52, 38, 16.1, colors, "tank");
  createHeistRotorPod(ctx, 52, 38, 16.1, colors, "tank");

  return ctx;
}

function createHeistMiniContext(colors, variant, scale = 1) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();
  const s = scale;

  if (variant === "attacker") {
    ctx.poly([0,-34*s,7*s,-23*s,27*s,-10*s,36*s,0,20*s,6*s,8*s,4*s,0,24*s,-8*s,4*s,-20*s,6*s,-36*s,0,-27*s,-10*s,-7*s,-23*s]).fill({ color: dark, alpha: 1 });
    ctx.poly([0,-29*s,4*s,-20*s,22*s,-8*s,29*s,0,16*s,4*s,5*s,1*s,0,18*s,-5*s,1*s,-16*s,4*s,-29*s,0,-22*s,-8*s,-4*s,-20*s]).fill({ color: primary, alpha: 1 });
    ctx.poly([0,-25*s,2*s,-16*s,0,-8*s,-2*s,-16*s]).fill({ color: highlight, alpha: .95 });
    [-1,1].forEach((side) => ctx.circle(side*23*s,4*s,2*s).fill({ color: secondary, alpha: .9 }));
    ctx.circle(0,18*s,2.2*s).fill({ color: highlight, alpha: .9 });
  } else if (variant === "defender") {
    const shieldBlue = 0x32d8ff;
    const shieldHot = 0xf0fdff;
    const hullBlue = 0x1187c8;
    ctx.poly([0,-33*s,7*s,-24*s,11*s,-9*s,9*s,7*s,4*s,19*s,0,28*s,-4*s,19*s,-9*s,7*s,-11*s,-9*s,-7*s,-24*s]).fill({ color: 0x041725, alpha: 1 });
    ctx.poly([0,-29*s,5*s,-22*s,8*s,-8*s,6*s,6*s,3*s,15*s,0,23*s,-3*s,15*s,-6*s,6*s,-8*s,-8*s,-5*s,-22*s]).fill({ color: hullBlue, alpha: 0.98 });
    [-1,1].forEach((side) => {
      ctx.poly([side*8*s,-13*s,side*23*s,-18*s,side*27*s,-9*s,side*24*s,4*s,side*11*s,0]).fill({ color: shieldBlue, alpha: 0.82 });
      ctx.circle(side*15*s,2*s,1.9*s).fill({ color: shieldHot, alpha: 0.96 });
    });
    ctx.arc(0, -31*s, 16*s, Math.PI * 1.16, Math.PI * 1.84)
      .stroke({ color: shieldBlue, width: 1.9*s, alpha: 0.78 });
    ctx.circle(0, 8*s, 2.4*s).fill({ color: shieldHot, alpha: 0.98 });
  } else if (variant === "tank") {
    const isOrangeTeam = primary > 0xf00000;
    const miniHull = isOrangeTeam ? 0x573139 : 0x173b55;
    ctx.poly([0,-34*s,14*s,-26*s,37*s,-11*s,41*s,8*s,25*s,21*s,0,29*s,-25*s,21*s,-41*s,8*s,-37*s,-11*s,-14*s,-26*s]).fill({ color: 0x071827, alpha: 1 });
    ctx.poly([0,-30*s,11*s,-23*s,31*s,-9*s,34*s,5*s,20*s,15*s,0,23*s,-20*s,15*s,-34*s,5*s,-31*s,-9*s,-11*s,-23*s]).fill({ color: miniHull, alpha: 1 });
    [-1,1].forEach((side) => { ctx.poly([side*22*s,-12*s,side*44*s,-5*s,side*42*s,14*s,side*24*s,17*s]).fill({ color: primary, alpha:.62 }); ctx.circle(side*30*s,12*s,2*s).fill({ color: highlight, alpha:.9 }); });
    ctx.circle(0,19*s,2.8*s).fill({ color: secondary, alpha:.92 });
  }

  return ctx;
}

function createRoleTechContext(colors, variant) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  if (variant === "attacker") {
    [-1, 1].forEach((side) => {
      ctx.roundRect(side * 45 - 2, -4, 4, 11, 1.2).fill({ color: highlight, alpha: 0.92 });
      ctx.circle(side * 28, -2, 1.8).fill({ color: secondary, alpha: 0.86 });
    });
    ctx.circle(0, -38, 2.2).fill({ color: highlight, alpha: 0.96 });
    ctx.circle(0, 34, 2.6).fill({ color: secondary, alpha: 0.90 });
  } else if (variant === "defender") {
    // Shield frigate emitters along the guard vanes.
    const shieldBlue = 0x35d8ff;
    const hot = 0xf0fdff;
    [-1, 1].forEach((side) => {
      ctx.circle(side * 27, 2, 4.0).fill({ color: shieldBlue, alpha: 0.16 });
      ctx.circle(side * 27, 2, 1.85).fill({ color: hot, alpha: 0.98 });
      ctx.roundRect(side * 45 - 1.6, -28, 3.2, 15, 1.2).fill({ color: shieldBlue, alpha: 0.72 });
      ctx.roundRect(side * 38 - 1.3, -14, 2.6, 10, 1).fill({ color: shieldBlue, alpha: 0.54 });
    });
    ctx.ellipse(0, -60, 5.8, 8.8).fill({ color: shieldBlue, alpha: 0.82 });
    ctx.circle(0, 15, 3.0).fill({ color: hot, alpha: 0.98 });
  } else if (variant === "tank") {
    [-1, 1].forEach((side) => {
      ctx.roundRect(side * 67 - 2.4, 4, 4.8, 15, 1.2).fill({ color: secondary, alpha: 0.82 });
      ctx.circle(side * 67, 21, 2.3).fill({ color: highlight, alpha: 0.92 });
      ctx.roundRect(side * 53 - 1.4, 24, 2.8, 11, 1).fill({ color: secondary, alpha: 0.54 });
    });
    ctx.circle(0, 50, 3.7).fill({ color: highlight, alpha: 0.98 });
  }

  return ctx;
}
function createRolePulseContext(colors, variant) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  if (variant === "attacker") {
    [-1, 1].forEach((side) => {
      ctx.circle(side * 45, 4, 5.4).fill({ color: secondary, alpha: 0.12 });
      ctx.circle(side * 45, 4, 2.1).fill({ color: highlight, alpha: 0.86 });
    });
    ctx.circle(0, 35, 6.4).fill({ color: highlight, alpha: 0.13 });
  } else if (variant === "defender") {
    // Elegant forward Aegis: three layered arcs and two side shield anchors.
    const shieldBlue = 0x22d2ff;
    const shieldEdge = 0x9ef5ff;
    const shieldHot = 0xf1feff;

    ctx.ellipse(0, -94, 42, 16).fill({ color: shieldBlue, alpha: 0.05 });
    ctx.arc(0, -86, 47, Math.PI * 1.15, Math.PI * 1.85)
      .stroke({ color: shieldBlue, width: 4.0, alpha: 0.34 });
    ctx.arc(0, -86, 38, Math.PI * 1.16, Math.PI * 1.84)
      .stroke({ color: shieldEdge, width: 1.7, alpha: 0.92 });
    ctx.arc(0, -86, 30, Math.PI * 1.18, Math.PI * 1.82)
      .stroke({ color: shieldBlue, width: 1.05, alpha: 0.52 });

    [-1, 1].forEach((side) => {
      const x = side * 39;
      const y = -98;
      ctx.circle(x, y, 4.2).fill({ color: shieldBlue, alpha: 0.16 });
      ctx.circle(x, y, 1.95).fill({ color: shieldHot, alpha: 0.96 });
      ctx.roundRect(x - 1.15, y + 4, 2.3, 7.8, 1.05).fill({ color: shieldEdge, alpha: 0.70 });
    });

    ctx.poly([0, -111, 4, -104, 0, -98, -4, -104]).fill({ color: shieldHot, alpha: 0.96 });
  } else if (variant === "tank") {
    [-1, 1].forEach((side) => {
      ctx.circle(side * 67, 21, 6.6).fill({ color: secondary, alpha: 0.13 });
      ctx.circle(side * 67, 21, 2.4).fill({ color: highlight, alpha: 0.90 });
    });
    ctx.circle(0, 50, 9).fill({ color: secondary, alpha: 0.15 });
    ctx.circle(0, 50, 3.5).fill({ color: highlight, alpha: 0.94 });
  }

  return ctx;
}
function createTeamBeaconContext(team) {
  const isOrange = String(team || "cyan") === "orange";
  const color = isOrange ? 0xff405b : 0x20cfff;
  const light = isOrange ? 0xffe0e5 : 0xe9fbff;
  const dark = isOrange ? 0x31050d : 0x041b2a;
  const ctx = new PIXI.GraphicsContext();

  // Prominent tactical IFF: a compact floating chevron plus an illuminated
  // team bar. It remains readable above every role without covering the ship.
  ctx.roundRect(-18, -3.4, 36, 10.2, 4).fill({ color: dark, alpha: 0.95 });
  ctx.roundRect(-15.2, -1.3, 30.4, 5.5, 2.5).fill({ color, alpha: 0.96 });
  ctx.roundRect(-9.5, 0, 19, 1.9, 0.9).fill({ color: light, alpha: 0.92 });

  ctx.poly([0, -18, 11, -5.2, 5.2, -5.2, 0, -0.3, -5.2, -5.2, -11, -5.2])
    .fill({ color: dark, alpha: 0.96 });
  ctx.poly([0, -15.4, 7.1, -6.3, 3.1, -6.3, 0, -3.0, -3.1, -6.3, -7.1, -6.3])
    .fill({ color, alpha: 0.98 });
  ctx.poly([0, -12.8, 2.7, -7.2, 0, -4.6, -2.7, -7.2])
    .fill({ color: light, alpha: 1 });

  [-1, 1].forEach((side) => {
    ctx.circle(side * 11.4, 1.4, 2.05).fill({ color, alpha: 0.32 });
    ctx.circle(side * 11.4, 1.4, 0.95).fill({ color: light, alpha: 0.98 });
  });
  return ctx;
}

function getCoreHeistTeamMarker(unit) {
  const explicit = String(unit?.team || "").trim().toLowerCase();
  if (explicit === "cyan" || explicit === "orange") return explicit;
  const skin = String(unit?.skin || "").trim().toLowerCase();
  if (skin.startsWith("heist-")) return skin.endsWith("-orange") ? "orange" : "cyan";
  return null;
}

function getCoreHeistRoleLabel(unit) {
  const role = String(unit?.heistRole || "").trim().toLowerCase();
  if (role === "tank") return "TANK";
  if (role === "defender") return "DEFENDER";
  if (role === "attacker") return "ATTACKER";

  const skin = String(unit?.skin || "").trim().toLowerCase();
  if (skin.includes("heist-tank-")) return "TANK";
  if (skin.includes("heist-defender-")) return "DEFENDER";
  if (skin.includes("heist-attacker-")) return "ATTACKER";
  return "";
}

function createTacticalRoleOverlay(compact = false) {
  const root = new PIXI.Container();
  root.eventMode = "none";
  root.visible = false;

  const textStyle = new PIXI.TextStyle({
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: compact ? 9 : 12,
    fontWeight: "800",
    letterSpacing: compact ? 0.45 : 0.65,
    fill: 0xffffff,
    stroke: { color: 0x020912, width: compact ? 2.4 : 3.2, join: "round" },
  });
  const roleText = new PIXI.Text({ text: "", style: textStyle });
  roleText.anchor.set(0.5, 0.5);
  roleText.eventMode = "none";

  const labelWidth = compact ? 66 : 86;
  const labelHeight = compact ? 13 : 16;
  const labelBack = new PIXI.Graphics();
  labelBack.roundRect(-labelWidth / 2, -labelHeight / 2, labelWidth, labelHeight, labelHeight / 2)
    .fill({ color: 0x020a12, alpha: 0.92 });
  labelBack.eventMode = "none";

  const hpWidth = compact ? 34 : 46;
  const hpY = labelHeight / 2 + (compact ? 3 : 4);
  const hpBack = new PIXI.Graphics();
  hpBack.roundRect(-hpWidth / 2 - 1.5, hpY - 1.5, hpWidth + 3, compact ? 6 : 7, compact ? 3 : 3.5)
    .fill({ color: 0x020811, alpha: 0.96 });
  hpBack.eventMode = "none";

  const hpFill = new PIXI.Graphics();
  hpFill.position.set(-hpWidth / 2, hpY);
  hpFill.roundRect(0, 0, hpWidth, compact ? 3 : 4, compact ? 1.5 : 2)
    .fill({ color: 0x62ff9c, alpha: 0.98 });
  hpFill.eventMode = "none";

  root.addChild(labelBack, roleText, hpBack, hpFill);
  return { root, roleText, hpFill, label: "", team: null };
}

function updateTacticalRoleOverlay(overlay, unit, teamMarker) {
  if (!overlay) return;
  const roleLabel = getCoreHeistRoleLabel(unit);
  const visible = Boolean(teamMarker && roleLabel);
  overlay.root.visible = visible;
  if (!visible) return;

  if (overlay.label !== roleLabel) {
    overlay.label = roleLabel;
    overlay.roleText.text = roleLabel;
  }

  if (overlay.team !== teamMarker) {
    overlay.team = teamMarker;
    overlay.roleText.style.fill = teamMarker === "orange" ? 0xffd3da : 0xd8f7ff;
  }

  const maxHp = Math.max(1, Number(unit?.maxHp || 100));
  const hpRatio = clamp(Number(unit?.hp || 0) / maxHp, 0, 1);
  overlay.hpFill.scale.x = Math.max(0.015, hpRatio);
  overlay.hpFill.alpha = unit?.alive === false ? 0.35 : 0.98;
}

function createDroneContext(colors, variant = null) {
  if (variant === "attacker") return createHeistAttackerContext(colors);
  if (variant === "defender") return createHeistDefenderContext(colors);
  if (variant === "tank") return createHeistTankContext(colors);

  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // The body faces up by default. updateUnitVisual rotates this single shared
  // visual toward movement, so the drone feels like an actual vehicle.
  const rotors = [
    [-59, -45],
    [59, -45],
    [-59, 45],
    [59, 45],
  ];

  // Strong arm shadows first, then metallic colored arm cores.
  rotors.forEach(([x, y]) => {
    const fromX = x < 0 ? -21 : 21;
    const fromY = y < 0 ? -17 : 17;

    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({
      color: dark,
      width: 12,
      alpha: 1,
    });
    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({
      color: primary,
      width: 6.4,
      alpha: 0.78,
    });
    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({
      color: secondary,
      width: 1.35,
      alpha: 0.64,
    });
  });

  // Larger realistic rotor modules. They are entirely inside the cached
  // GraphicsContext and get reused for every drone with the same skin.
  rotors.forEach(([x, y]) => createRotorModule(ctx, x, y, 24, colors, false));

  // Dark aerodynamic chassis outline.
  ctx.poly([
    0, -52,
    23, -39,
    34, -8,
    30, 24,
    17, 47,
    0, 56,
    -17, 47,
    -30, 24,
    -34, -8,
    -23, -39,
  ]).fill({ color: dark, alpha: 1 });

  // Colored armored shell, with a taper at the nose and a broad rear battery.
  ctx.poly([
    0, -47,
    17, -34,
    25, -7,
    22, 21,
    12, 40,
    0, 47,
    -12, 40,
    -22, 21,
    -25, -7,
    -17, -34,
  ]).fill({ color: primary, alpha: 1 });

  // Central carbon seam makes it feel like a mechanical shell, not an orb.
  ctx.poly([
    0, -41,
    7, -26,
    9, 12,
    4, 34,
    0, 39,
    -4, 34,
    -9, 12,
    -7, -26,
  ]).fill({ color: dark, alpha: 0.55 });

  // Raised front canopy / sensor block.
  ctx.poly([
    0, -42,
    12, -29,
    11, -10,
    0, -2,
    -11, -10,
    -12, -29,
  ]).fill({ color: secondary, alpha: 0.56 });
  ctx.poly([
    0, -38,
    6, -29,
    5, -17,
    0, -13,
    -5, -17,
    -6, -29,
  ]).fill({ color: highlight, alpha: 0.72 });

  // Side vents and rear engine / status LED.
  ctx.roundRect(-24, 8, 8, 18, 3).fill({ color: dark, alpha: 0.88 });
  ctx.roundRect(16, 8, 8, 18, 3).fill({ color: dark, alpha: 0.88 });
  ctx.roundRect(-22, 10, 4, 12, 2).fill({ color: secondary, alpha: 0.45 });
  ctx.roundRect(18, 10, 4, 12, 2).fill({ color: secondary, alpha: 0.45 });

  ctx.roundRect(-8, 29, 16, 13, 5).fill({ color: dark, alpha: 0.98 });
  ctx.roundRect(-5, 32, 10, 7, 3).fill({ color: highlight, alpha: 0.9 });

  // Clean outer rim + a very small specular line. No blur/filter is used.
  ctx.poly([
    0, -47,
    17, -34,
    25, -7,
    22, 21,
    12, 40,
    0, 47,
    -12, 40,
    -22, 21,
    -25, -7,
    -17, -34,
  ]).stroke({ color: highlight, width: 1.7, alpha: 0.38 });

  if (variant === "attacker") {
    // Aggressive assault silhouette: blade-fin nose, side blade wings and bright weapon rails.
    ctx.poly([0, -69, 12, -50, 0, -34, -12, -50]).fill({ color: secondary, alpha: 0.94 });
    ctx.poly([-39, -7, -13, 3, -38, 22]).fill({ color: secondary, alpha: 0.38 });
    ctx.poly([39, -7, 13, 3, 38, 22]).fill({ color: secondary, alpha: 0.38 });
    ctx.roundRect(-22, -30, 7, 42, 3).fill({ color: dark, alpha: 0.92 });
    ctx.roundRect(15, -30, 7, 42, 3).fill({ color: dark, alpha: 0.92 });
    ctx.roundRect(-20, -27, 3, 36, 2).fill({ color: highlight, alpha: 0.82 });
    ctx.roundRect(17, -27, 3, 36, 2).fill({ color: highlight, alpha: 0.82 });
    ctx.circle(-10, 24, 3.1).fill({ color: secondary, alpha: 0.86 });
    ctx.circle(10, 24, 3.1).fill({ color: secondary, alpha: 0.86 });
    ctx.poly([0, -58, 6, -46, 0, -41, -6, -46]).fill({ color: highlight, alpha: 0.96 });
  } else if (variant === "defender") {
    // Front shield wall: a visible half-shield mounted in front of the drone.
    ctx.arc(0, -24, 33, Math.PI * 1.08, Math.PI * 1.92).stroke({ color: secondary, width: 6, alpha: 0.42 });
    ctx.arc(0, -24, 28, Math.PI * 1.08, Math.PI * 1.92).stroke({ color: highlight, width: 2.2, alpha: 0.86 });
    ctx.roundRect(-30, -58, 60, 16, 8).fill({ color: dark, alpha: 0.9 });
    ctx.roundRect(-24, -54, 48, 8, 4).fill({ color: secondary, alpha: 0.46 });
    ctx.poly([-38, -10, -18, -4, -26, 22, -43, 13]).fill({ color: dark, alpha: 0.94 });
    ctx.poly([38, -10, 18, -4, 26, 22, 43, 13]).fill({ color: dark, alpha: 0.94 });
    ctx.poly([-34, -8, -21, -3, -27, 17, -38, 11]).fill({ color: secondary, alpha: 0.44 });
    ctx.poly([34, -8, 21, -3, 27, 17, 38, 11]).fill({ color: secondary, alpha: 0.44 });
    ctx.circle(0, 3, 35).stroke({ color: secondary, width: 1.4, alpha: 0.22 });
    ctx.circle(0, -18, 4.2).fill({ color: highlight, alpha: 0.92 });
  } else if (variant === "tank") {
    // Heavy armored hull: broad shoulder plates, top armor band and glowing core blocks.
    ctx.roundRect(-34, -14, 16, 34, 6).fill({ color: dark, alpha: 0.98 });
    ctx.roundRect(18, -14, 16, 34, 6).fill({ color: dark, alpha: 0.98 });
    ctx.roundRect(-31, -10, 10, 24, 4).fill({ color: primary, alpha: 0.86 });
    ctx.roundRect(21, -10, 10, 24, 4).fill({ color: primary, alpha: 0.86 });
    ctx.roundRect(-22, -56, 44, 15, 5).fill({ color: dark, alpha: 0.95 });
    ctx.roundRect(-17, -52, 34, 6, 3).fill({ color: secondary, alpha: 0.58 });
    ctx.roundRect(-18, 18, 36, 20, 6).fill({ color: dark, alpha: 0.98 });
    ctx.roundRect(-14, 22, 28, 12, 4).fill({ color: primary, alpha: 0.74 });
    ctx.circle(-10, 28, 2.8).fill({ color: highlight, alpha: 0.94 });
    ctx.circle(10, 28, 2.8).fill({ color: highlight, alpha: 0.94 });
    ctx.circle(0, -31, 5.4).fill({ color: secondary, alpha: 0.82 });
    ctx.circle(0, -31, 2.4).fill({ color: highlight, alpha: 0.96 });
  }

  return ctx;
}

function createMiniDroneContext(colors, variant = null) {
  if (variant) return createHeistMiniContext(colors, variant, 0.72);

  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // A true scaled-down sibling of the main drone: same 4 arms, 4 large
  // propeller modules, carbon shell and front sensor, rather than dots.
  const rotors = [
    [-17, -13],
    [17, -13],
    [-17, 13],
    [17, 13],
  ];

  rotors.forEach(([x, y]) => {
    const fromX = x < 0 ? -6 : 6;
    const fromY = y < 0 ? -5 : 5;
    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({ color: dark, width: 4.8, alpha: 1 });
    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({ color: primary, width: 2.25, alpha: 0.78 });
  });

  rotors.forEach(([x, y]) => createRotorModule(ctx, x, y, 8.4, colors, true));

  ctx.poly([
    0, -17,
    8, -12,
    11, -2,
    9, 8,
    4, 15,
    0, 18,
    -4, 15,
    -9, 8,
    -11, -2,
    -8, -12,
  ]).fill({ color: dark, alpha: 1 });

  ctx.poly([
    0, -15,
    6, -10,
    8, -2,
    6, 7,
    3, 12,
    0, 14,
    -3, 12,
    -6, 7,
    -8, -2,
    -6, -10,
  ]).fill({ color: primary, alpha: 1 });

  ctx.poly([0, -13, 3.6, -8, 3, -3, 0, -1, -3, -3, -3.6, -8])
    .fill({ color: secondary, alpha: 0.58 });
  ctx.circle(0, 9, 2.6).fill({ color: highlight, alpha: 0.9 });
  ctx.poly([0, -15, 6, -10, 8, -2, 6, 7, 3, 12, 0, 14, -3, 12, -6, 7, -8, -2, -6, -10])
    .stroke({ color: highlight, width: 0.8, alpha: 0.36 });

  if (variant === "attacker") {
    ctx.poly([0, -26, 5.6, -17, 0, -11, -5.6, -17]).fill({ color: secondary, alpha: 0.9 });
    ctx.roundRect(-8.4, -11.5, 3, 14, 1.5).fill({ color: highlight, alpha: 0.8 });
    ctx.roundRect(5.4, -11.5, 3, 14, 1.5).fill({ color: highlight, alpha: 0.8 });
  } else if (variant === "defender") {
    ctx.arc(0, -8, 12, Math.PI * 1.05, Math.PI * 1.95).stroke({ color: secondary, width: 2.6, alpha: 0.48 });
    ctx.arc(0, -8, 10, Math.PI * 1.05, Math.PI * 1.95).stroke({ color: highlight, width: 1.05, alpha: 0.82 });
    ctx.roundRect(-8, -20, 16, 4.8, 2).fill({ color: secondary, alpha: 0.38 });
    ctx.roundRect(-11, -3, 4.5, 10, 2).fill({ color: secondary, alpha: 0.38 });
    ctx.roundRect(6.5, -3, 4.5, 10, 2).fill({ color: secondary, alpha: 0.38 });
  } else if (variant === "tank") {
    ctx.roundRect(-10.2, 7.2, 5.5, 6.6, 1.8).fill({ color: dark, alpha: 0.95 });
    ctx.roundRect(4.7, 7.2, 5.5, 6.6, 1.8).fill({ color: dark, alpha: 0.95 });
    ctx.roundRect(-9.1, 8.2, 3.6, 3.8, 1.2).fill({ color: primary, alpha: 0.84 });
    ctx.roundRect(5.5, 8.2, 3.6, 3.8, 1.2).fill({ color: primary, alpha: 0.84 });
    ctx.roundRect(-7.8, -19.5, 15.6, 4.8, 2).fill({ color: secondary, alpha: 0.4 });
  }

  return ctx;
}

function createRotorSpinContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Two long blades are rotated as independent transforms around each rotor.
  // The guard/hub stay inside the body context, so the propeller reads as spinning
  // without rebuilding any geometry every frame.
  ctx.roundRect(-2.9, -19, 5.8, 15.5, 2.6).fill({ color: secondary, alpha: 0.72 });
  ctx.roundRect(-2.9, 3.5, 5.8, 15.5, 2.6).fill({ color: primary, alpha: 0.56 });
  ctx.roundRect(-1.25, -17.2, 2.5, 11.8, 1.2).fill({ color: highlight, alpha: 0.33 });
  ctx.circle(0, 0, 5.8).fill({ color: dark, alpha: 0.5 });
  ctx.circle(0, 0, 3.1).fill({ color: primary, alpha: 0.32 });

  return ctx;
}

// Glow / exhaust effects are built from shared vector contexts, not blur filters
// or per-frame geometry. This preserves WebGL performance even when several
// drones are visible at once on mobile and older laptops.
function createDroneAuraContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  ctx.circle(0, 0, 88).fill({ color: primary, alpha: 0.022 });
  ctx.circle(0, 0, 72).fill({ color: secondary, alpha: 0.032 });
  ctx.circle(0, 0, 61).stroke({ color: highlight, width: 1.8, alpha: 0.13 });
  ctx.circle(0, 0, 48).stroke({ color: primary, width: 2.1, alpha: 0.18 });
  ctx.circle(0, 0, 38).stroke({ color: dark, width: 1, alpha: 0.24 });

  return ctx;
}

function createEngineGlowContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Rear plasma light for the large craft. It sits under the chassis and
  // breathes through transform/alpha only during the render tick.
  ctx.ellipse(0, 6, 22, 34).fill({ color: primary, alpha: 0.12 });
  ctx.ellipse(0, 8, 13, 23).fill({ color: secondary, alpha: 0.20 });
  ctx.ellipse(0, 10, 6.5, 13).fill({ color: highlight, alpha: 0.46 });
  ctx.circle(0, 0, 7.2).fill({ color: dark, alpha: 0.62 });
  ctx.circle(0, 1.5, 4.6).fill({ color: primary, alpha: 0.92 });

  return ctx;
}

function createEngineVectorContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Sharp plasma vector, deliberately not smoke: a small sci-fi exhaust made
  // from crisp geometry that stays readable while moving and while spectating.
  ctx.poly([-12, 0, 12, 0, 8, 19, 3.8, 35, 0, 42, -3.8, 35, -8, 19])
    .fill({ color: primary, alpha: 0.18 });
  ctx.poly([-7.2, 1, 7.2, 1, 4.5, 20, 0, 31, -4.5, 20])
    .fill({ color: secondary, alpha: 0.44 });
  ctx.poly([-2.8, 4, 2.8, 4, 1.7, 21, 0, 29, -1.7, 21])
    .fill({ color: highlight, alpha: 0.90 });
  ctx.moveTo(-8, 5).lineTo(0, 40).lineTo(8, 5)
    .stroke({ color: dark, width: 1.6, alpha: 0.44 });
  return ctx;
}

function createMiniBeaconContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Escort drones now use a colorful rotating beacon rather than smoke.
  ctx.circle(0, 0, 18).fill({ color: primary, alpha: 0.035 });
  ctx.circle(0, 0, 13.5).stroke({ color: secondary, width: 1.4, alpha: 0.48 });
  ctx.circle(0, 0, 9.8).stroke({ color: primary, width: 1.1, alpha: 0.36 });
  ctx.circle(0, 0, 4.1).fill({ color: highlight, alpha: 0.38 });
  for (let index = 0; index < 4; index += 1) {
    const angle = -Math.PI * 0.5 + index * (Math.PI * 0.5);
    const x = Math.cos(angle) * 15.6;
    const y = Math.sin(angle) * 15.6;
    ctx.roundRect(x - 1.8, y - 1.8, 3.6, 3.6, 1.2).fill({ color: dark, alpha: 0.72 });
    ctx.circle(x, y, 1.55).fill({ color: primary, alpha: 0.96 });
  }
  return ctx;
}

function createProjectileAuraContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Bright lock-on halo for launched attack drones. It makes a projectile
  // instantly recognizable without a blur filter or a long opaque trail.
  ctx.circle(0, 0, 27).fill({ color: primary, alpha: 0.034 });
  ctx.circle(0, 0, 21).stroke({ color: secondary, width: 1.7, alpha: 0.52 });
  ctx.circle(0, 0, 15.5).stroke({ color: primary, width: 1.25, alpha: 0.42 });
  ctx.circle(0, 0, 6.2).fill({ color: highlight, alpha: 0.18 });
  ctx.moveTo(-25, 0).lineTo(-15, 0).stroke({ color: primary, width: 1.5, alpha: 0.70 });
  ctx.moveTo(15, 0).lineTo(25, 0).stroke({ color: secondary, width: 1.5, alpha: 0.70 });
  return ctx;
}

function createProjectileJetContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  ctx.poly([-7, 10, 7, 10, 5, 31, 0, 42, -5, 31])
    .fill({ color: primary, alpha: 0.30 });
  ctx.poly([-4.1, 11, 4.1, 11, 2.6, 28, 0, 35, -2.6, 28])
    .fill({ color: secondary, alpha: 0.58 });
  ctx.poly([-1.5, 12, 1.5, 12, 0.9, 27, 0, 31, -0.9, 27])
    .fill({ color: highlight, alpha: 0.94 });
  ctx.moveTo(-5.5, 13).lineTo(0, 38).lineTo(5.5, 13)
    .stroke({ color: dark, width: 1.15, alpha: 0.42 });
  return ctx;
}

function createOrbContext(color) {
  const ctx = new PIXI.GraphicsContext();
  // Premium pickup marker: high contrast, color identity and a clean sci-fi
  // halo so it remains visible above the aerial map without using blur filters.
  ctx.circle(0, 0, 22).fill({ color: 0x020b12, alpha: 0.18 });
  ctx.circle(0, 0, 19.5).stroke({ color, width: 2.2, alpha: 0.14 });
  ctx.circle(0, 0, 16.5).stroke({ color: 0xffffff, width: 1.1, alpha: 0.16 });

  // Small cardinal accents make the pickup recognizable at distance.
  ctx.roundRect(-1.3, -22, 2.6, 6.2, 1.2).fill({ color, alpha: 0.54 });
  ctx.roundRect(-1.3, 15.8, 2.6, 6.2, 1.2).fill({ color, alpha: 0.54 });
  ctx.roundRect(-22, -1.3, 6.2, 2.6, 1.2).fill({ color, alpha: 0.54 });
  ctx.roundRect(15.8, -1.3, 6.2, 2.6, 1.2).fill({ color, alpha: 0.54 });

  ctx.circle(0, 0, 14.2).fill({ color: 0x04141e, alpha: 0.94 });
  ctx.circle(0, 0, 12.1).stroke({ color, width: 2.6, alpha: 0.64 });
  ctx.circle(0, 0, 9.6).fill({ color, alpha: 1 });
  ctx.circle(0, 0, 6.1).fill({ color: 0xffffff, alpha: 0.14 });
  ctx.circle(-3.4, -4.2, 3.4).fill({ color: 0xffffff, alpha: 0.82 });
  ctx.circle(0, 0, 9.7).stroke({ color: 0xffffff, width: 1.4, alpha: 0.48 });

  // A fine target reticle keeps the glow controlled and professional.
  ctx.moveTo(-15.2, 0).lineTo(-10.8, 0).stroke({ color: 0xffffff, width: 1.25, alpha: 0.35 });
  ctx.moveTo(10.8, 0).lineTo(15.2, 0).stroke({ color: 0xffffff, width: 1.25, alpha: 0.35 });
  ctx.moveTo(0, -15.2).lineTo(0, -10.8).stroke({ color: 0xffffff, width: 1.25, alpha: 0.35 });
  ctx.moveTo(0, 10.8).lineTo(0, 15.2).stroke({ color: 0xffffff, width: 1.25, alpha: 0.35 });
  return ctx;
}

function createEnergyContext() {
  const ctx = new PIXI.GraphicsContext();
  // Premium energy beacon: dark outer silhouette + cyan/green power core.
  ctx.circle(0, 0, 23).fill({ color: 0x020d12, alpha: 0.20 });
  ctx.circle(0, 0, 20.5).stroke({ color: 0x67ffcb, width: 2.1, alpha: 0.20 });
  ctx.circle(0, 0, 17.4).stroke({ color: 0xe5fff7, width: 1.0, alpha: 0.14 });

  // Hex-like scanner brackets around the canister.
  ctx.poly([-12, -12, 0, -19, 12, -12, 12, 12, 0, 19, -12, 12]).stroke({ color: 0x7dffd4, width: 1.6, alpha: 0.48 });
  ctx.roundRect(-11.5, -17.5, 23, 35, 7).fill({ color: 0x062a31, alpha: 0.98 });
  ctx.roundRect(-10.3, -16, 20.6, 32, 6).stroke({ color: 0xd5fff0, width: 1.35, alpha: 0.48 });
  ctx.roundRect(-7.6, -11.4, 15.2, 22.8, 4.4).fill({ color: 0x58ffb0, alpha: 1 });
  ctx.roundRect(-5.6, -9.2, 11.2, 18.4, 3.0).fill({ color: 0xd1fff0, alpha: 0.20 });

  ctx.poly([2.4, -10.5, -6.2, 0.7, -0.6, 0.7, -4.2, 10.3, 7.2, -3.2, 1.2, -3.2]).fill({ color: 0xf8fffd, alpha: 1 });
  ctx.poly([1.6, -7.4, -2.9, -0.7, -0.3, -0.7, -2.2, 5.1, 3.8, -2.1, 0.9, -2.1]).fill({ color: 0x5bffd0, alpha: 0.64 });

  // Status LEDs below the power cell.
  ctx.circle(-5.4, 13.1, 1.4).fill({ color: 0x5fffb6, alpha: 0.88 });
  ctx.circle(0, 13.1, 1.4).fill({ color: 0xeafff7, alpha: 0.90 });
  ctx.circle(5.4, 13.1, 1.4).fill({ color: 0x5fffb6, alpha: 0.88 });
  return ctx;
}

function createCoreContext(color) {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 28).stroke({ color, width: 3, alpha: 0.62 });
  ctx.circle(0, 0, 17).fill({ color, alpha: 0.9 });
  ctx.circle(-6, -7, 5).fill({ color: 0xffffff, alpha: 0.76 });
  ctx.moveTo(-20, -20).lineTo(20, 20).stroke({ color, width: 3, alpha: 0.5 });
  ctx.moveTo(20, -20).lineTo(-20, 20).stroke({ color, width: 3, alpha: 0.5 });
  return ctx;
}

function createShieldShellContext(colors) {
  const [primary, secondary] = colors;
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 1).fill({ color: primary, alpha: 0.075 });
  ctx.circle(0, 0, 0.92).stroke({ color: secondary, width: 0.03, alpha: 0.38 });
  ctx.circle(0, 0, 0.68).stroke({ color: primary, width: 0.014, alpha: 0.18 });
  return ctx;
}

function createShieldRingContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();
  const outer = 0.99;
  const inner = 0.8;
  const outerPoints = [];
  const innerPoints = [];

  for (let index = 0; index < 8; index += 1) {
    const angle = -Math.PI * 0.5 + (index / 8) * Math.PI * 2;
    outerPoints.push(Math.cos(angle) * outer, Math.sin(angle) * outer);
    innerPoints.push(Math.cos(angle + Math.PI / 8) * inner, Math.sin(angle + Math.PI / 8) * inner);
  }

  ctx.circle(0, 0, 1).stroke({ color: secondary, width: 0.024, alpha: 0.86 });
  ctx.circle(0, 0, 0.87).stroke({ color: primary, width: 0.015, alpha: 0.62 });
  ctx.poly(outerPoints).stroke({ color: highlight, width: 0.014, alpha: 0.62 });
  ctx.poly(innerPoints).stroke({ color: dark, width: 0.04, alpha: 0.62 });

  for (let index = 0; index < 8; index += 1) {
    const angle = -Math.PI * 0.5 + (index / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 0.99;
    const y = Math.sin(angle) * 0.99;
    ctx.circle(x, y, 0.052).fill({ color: primary, alpha: 0.92 });
    ctx.circle(x - 0.014, y - 0.014, 0.02).fill({ color: highlight, alpha: 0.9 });
  }

  return ctx;
}

function createShieldGlyphContext(colors) {
  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // Small rotating "energy tiles" make the shield look alive while remaining
  // just one shared WebGL geometry per skin.
  for (let index = 0; index < 6; index += 1) {
    const angle = -Math.PI * 0.5 + (index / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 0.61;
    const y = Math.sin(angle) * 0.61;
    ctx.roundRect(x - 0.05, y - 0.05, 0.1, 0.1, 0.028).fill({ color: dark, alpha: 0.72 });
    ctx.roundRect(x - 0.035, y - 0.035, 0.07, 0.07, 0.02).fill({ color: secondary, alpha: 0.86 });
    ctx.circle(x, y, 0.018).fill({ color: highlight, alpha: 0.96 });
  }

  ctx.circle(0, 0, 0.54).stroke({ color: primary, width: 0.012, alpha: 0.34 });
  return ctx;
}

function createShieldPulseContext(colors) {
  const [, secondary, , highlight] = colors;
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 1).stroke({ color: secondary, width: 0.018, alpha: 0.8 });
  ctx.circle(0, 0, 0.9).stroke({ color: highlight, width: 0.008, alpha: 0.48 });
  return ctx;
}

function createOrbitContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 1).stroke({ color: 0xd5fbff, width: 0.02, alpha: 0.34 });
  return ctx;
}

function createZoneContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 1).fill({ color: 0x10ff8f, alpha: 0.015 });
  ctx.circle(0, 0, 1).stroke({ color: 0x45ffb0, width: 0.025, alpha: 0.8 });
  return ctx;
}

function createLiteDroneContext(colors, variant = null) {
  if (variant) return createHeistMiniContext(colors, variant, 1.18);

  const [primary, secondary, dark, highlight] = colors;
  const ctx = new PIXI.GraphicsContext();

  // A lightweight but recognizable quadcopter. This is one cached context per
  // skin, so 40-50 distant drones cost transforms only, not per-frame drawing.
  const rotors = [
    [-23, -18],
    [23, -18],
    [-23, 18],
    [23, 18],
  ];

  rotors.forEach(([x, y]) => {
    const fromX = x < 0 ? -7 : 7;
    const fromY = y < 0 ? -5 : 5;
    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({ color: dark, width: 5.4, alpha: 0.96 });
    ctx.moveTo(fromX, fromY).lineTo(x, y).stroke({ color: primary, width: 2.25, alpha: 0.82 });
    ctx.circle(x, y, 6.2).fill({ color: dark, alpha: 0.98 });
    ctx.circle(x, y, 4.5).stroke({ color: secondary, width: 1.05, alpha: 0.84 });
    ctx.circle(x, y, 2.25).fill({ color: primary, alpha: 0.9 });
  });

  ctx.poly([
    0, -20,
    10, -13,
    13, -2,
    10, 12,
    0, 19,
    -10, 12,
    -13, -2,
    -10, -13,
  ]).fill({ color: dark, alpha: 1 });

  ctx.poly([
    0, -17,
    7.5, -10,
    9.2, -1.5,
    7, 9,
    0, 15.2,
    -7, 9,
    -9.2, -1.5,
    -7.5, -10,
  ]).fill({ color: primary, alpha: 1 });

  ctx.poly([0, -15, 4.4, -9, 4.1, -1.5, 0, 1.5, -4.1, -1.5, -4.4, -9])
    .fill({ color: secondary, alpha: 0.72 });
  ctx.circle(0, -7.5, 2.2).fill({ color: highlight, alpha: 0.9 });
  ctx.roundRect(-4.5, 8.5, 9, 4.8, 1.8).fill({ color: dark, alpha: 0.92 });
  ctx.roundRect(-2.6, 9.7, 5.2, 2.2, 1).fill({ color: highlight, alpha: 0.74 });

  if (variant === "attacker") {
    ctx.poly([0, -29, 6.4, -20, 0, -14.5, -6.4, -20]).fill({ color: secondary, alpha: 0.86 });
    ctx.roundRect(-9.5, -12.6, 3.3, 15, 1.4).fill({ color: highlight, alpha: 0.74 });
    ctx.roundRect(6.2, -12.6, 3.3, 15, 1.4).fill({ color: highlight, alpha: 0.74 });
  } else if (variant === "defender") {
    ctx.poly([0, -26, 4.8, -17, 2.8, -8, 0, -4, -2.8, -8, -4.8, -17]).fill({ color: 0x2fd6ff, alpha: 0.9 });
    ctx.poly([-12, -7, -24, 0, -18, 6, -8, 1]).fill({ color: primary, alpha: 0.76 });
    ctx.poly([12, -7, 24, 0, 18, 6, 8, 1]).fill({ color: primary, alpha: 0.76 });
    ctx.circle(0, 10, 2.4).fill({ color: highlight, alpha: 0.94 });
  } else if (variant === "tank") {
    ctx.roundRect(-12.2, 8.2, 6.6, 6.6, 2).fill({ color: dark, alpha: 0.94 });
    ctx.roundRect(5.6, 8.2, 6.6, 6.6, 2).fill({ color: dark, alpha: 0.94 });
    ctx.roundRect(-11, 9.3, 4.6, 3.6, 1.3).fill({ color: primary, alpha: 0.84 });
    ctx.roundRect(6.5, 9.3, 4.6, 3.6, 1.3).fill({ color: primary, alpha: 0.84 });
    ctx.roundRect(-8.5, -22, 17, 5, 2).fill({ color: secondary, alpha: 0.36 });
  }

  return ctx;
}

function addToPool(pool, factory, parent, minSize) {
  while (pool.length < minSize) {
    const item = factory();
    item.root.eventMode = "none";
    item.root.visible = false;
    parent.addChild(item.root);
    pool.push(item);
  }
}

function createUnitVisual(resources) {
  const root = new PIXI.Container();
  root.eventMode = "none";
  root.sortableChildren = false;

  // Color aura is a cached vector context behind the drone. It gives every
  // skin a readable neon presence without expensive blur filters.
  const aura = new PIXI.Graphics(resources.droneAuraContexts.cyan);
  aura.eventMode = "none";
  aura.visible = true;
  root.addChild(aura);

  const orbit = new PIXI.Graphics(resources.orbitContext);
  orbit.visible = false;
  root.addChild(orbit);

  // Shield is layered: a subtle dome behind the craft, then rings/glyphs in front.
  const shieldShell = new PIXI.Graphics(resources.shieldShellContexts.cyan);
  const shieldRing = new PIXI.Graphics(resources.shieldRingContexts.cyan);
  const shieldGlyphs = new PIXI.Graphics(resources.shieldGlyphContexts.cyan);
  const shieldPulse = new PIXI.Graphics(resources.shieldPulseContexts.cyan);
  [shieldShell, shieldRing, shieldGlyphs, shieldPulse].forEach((part) => {
    part.visible = false;
    part.eventMode = "none";
  });
  root.addChild(shieldShell);

  const vehicle = new PIXI.Container();
  vehicle.eventMode = "none";

  // A crisp color-matched plasma vector replaces the old smoke trail.
  const engineVector = new PIXI.Graphics(resources.engineVectorContexts.cyan);
  engineVector.eventMode = "none";
  vehicle.addChild(engineVector);

  const engineGlow = new PIXI.Graphics(resources.engineGlowContexts.cyan);
  engineGlow.eventMode = "none";
  vehicle.addChild(engineGlow);

  const body = new PIXI.Graphics(resources.droneContexts.cyan);
  vehicle.addChild(body);

  // Role trim uses cached contexts and transform-only animation. This layer is
  // purely cosmetic: it never changes hitboxes, controls, movement or combat.
  const roleTech = new PIXI.Graphics(resources.roleTechContexts.cyan);
  const rolePulse = new PIXI.Graphics(resources.rolePulseContexts.cyan);
  roleTech.eventMode = "none";
  rolePulse.eventMode = "none";
  roleTech.visible = false;
  rolePulse.visible = false;
  vehicle.addChild(roleTech, rolePulse);

  // One tiny transform per rotor. Contexts are shared, so these spinning blades
  // cost only transform updates and make the drone feel far more alive.
  const rotorSpins = MAIN_ROTOR_POINTS.map(([x, y]) => {
    const rotor = new PIXI.Graphics(resources.rotorSpinContexts.cyan);
    rotor.position.set(x, y);
    rotor.eventMode = "none";
    rotor.alpha = 0.58;
    vehicle.addChild(rotor);
    return rotor;
  });

  root.addChild(vehicle);

  const miniLayer = new PIXI.Container();
  miniLayer.eventMode = "none";
  const miniBeacons = Array.from({ length: MAX_MINI_DRONES }, () => {
    const beacon = new PIXI.Graphics(resources.miniBeaconContexts.cyan);
    beacon.visible = false;
    beacon.eventMode = "none";
    miniLayer.addChild(beacon);
    return beacon;
  });
  const minis = Array.from({ length: MAX_MINI_DRONES }, () => {
    const mini = new PIXI.Graphics(resources.miniContexts.cyan);
    mini.visible = false;
    mini.eventMode = "none";
    miniLayer.addChild(mini);
    return mini;
  });
  root.addChild(miniLayer, shieldRing, shieldGlyphs, shieldPulse);

  const teamBeacon = new PIXI.Graphics(resources.teamBeaconContexts.cyan);
  teamBeacon.eventMode = "none";
  teamBeacon.visible = false;
  root.addChild(teamBeacon);

  const tacticalRoleOverlay = createTacticalRoleOverlay(false);
  tacticalRoleOverlay.root.position.set(0, -184);
  root.addChild(tacticalRoleOverlay.root);

  return {
    root,
    aura,
    body,
    vehicle,
    engineVector,
    engineGlow,
    roleTech,
    rolePulse,
    miniBeacons,
    rotorSpins,
    shieldShell,
    shieldRing,
    shieldGlyphs,
    shieldPulse,
    orbit,
    minis,
    teamBeacon,
    tacticalRoleOverlay,
    team: null,
    skin: "cyan",
    rotorLayout: MAIN_ROTOR_POINTS.map(([x, y]) => [x, y]),
    unitId: "",
    facing: 0,
    facingReady: false,
    bank: 0,
    shieldMix: 0,
    lastFrameAt: 0,
    hoverSeed: Math.random() * Math.PI * 2,
    lastDecorAt: 0,
    lastSeenAt: 0,
  };
}

function createSimpleVisual(resources) {
  // Lightweight remote drone used after the nearby premium pool fills.
  // It deliberately keeps a small plasma engine and four spinning propellers,
  // so distant bots/players stay alive visually on old laptops without paying
  // for aura, shields, escort drones or large glow geometry.
  const root = new PIXI.Container();
  root.eventMode = "none";
  root.sortableChildren = false;

  const engine = new PIXI.Graphics(resources.engineVectorContexts.cyan);
  engine.eventMode = "none";
  engine.position.set(0, 11);
  engine.scale.set(0.42);
  root.addChild(engine);

  const body = new PIXI.Graphics(resources.simpleContexts.cyan);
  body.eventMode = "none";
  root.addChild(body);

  // Far/low-end entities keep their real escort count. These are cached mini
  // drone geometries with transform-only orbit motion (no aura/beacon/filter),
  // so bots and remote players do not lose their orbiting drones on old GPUs.
  const escortLayer = new PIXI.Container();
  escortLayer.eventMode = "none";
  const minis = Array.from({ length: MAX_MINI_DRONES }, () => {
    const mini = new PIXI.Graphics(resources.miniContexts.cyan);
    mini.eventMode = "none";
    mini.visible = false;
    escortLayer.addChild(mini);
    return mini;
  });
  root.addChild(escortLayer);

  const teamBeacon = new PIXI.Graphics(resources.teamBeaconContexts.cyan);
  teamBeacon.eventMode = "none";
  teamBeacon.visible = false;
  root.addChild(teamBeacon);

  const tacticalRoleOverlay = createTacticalRoleOverlay(true);
  tacticalRoleOverlay.root.position.set(0, -104);
  root.addChild(tacticalRoleOverlay.root);

  const rotors = [
    [-23, -18],
    [23, -18],
    [-23, 18],
    [23, 18],
  ].map(([x, y]) => {
    const rotor = new PIXI.Graphics(resources.rotorSpinContexts.cyan);
    rotor.eventMode = "none";
    rotor.position.set(x, y);
    rotor.scale.set(0.36);
    rotor.alpha = 0.48;
    root.addChild(rotor);
    return rotor;
  });

  return {
    root,
    body,
    engine,
    minis,
    rotors,
    teamBeacon,
    tacticalRoleOverlay,
    team: null,
    skin: "",
    facing: 0,
    facingReady: false,
    unitId: "",
    hoverSeed: Math.random() * Math.PI * 2,
    lastFrameAt: 0,
    lastDecorAt: 0,
    lastSeenAt: 0,
  };
}

function createSimpleProjectileVisual(resources) {
  // Far attack drones must still be drones, never a triangle/arrow. This
  // compact sibling has the same four-propeller silhouette as the full one.
  const root = new PIXI.Container();
  root.eventMode = "none";
  root.sortableChildren = false;

  const body = new PIXI.Graphics(resources.miniContexts.cyan);
  body.eventMode = "none";
  root.addChild(body);

  const rotors = MINI_ROTOR_POINTS.map(([x, y]) => {
    const rotor = new PIXI.Graphics(resources.rotorSpinContexts.cyan);
    rotor.eventMode = "none";
    rotor.position.set(x, y);
    rotor.scale.set(0.38);
    rotor.alpha = 0.64;
    root.addChild(rotor);
    return rotor;
  });

  return {
    root,
    body,
    rotors,
    skin: "",
    flightSeed: Math.random() * Math.PI * 2,
    lastSeenAt: 0,
  };
}

function createProjectileVisual(resources) {
  // Launched attack drone: a miniature drone with a bright skin-specific
  // lock-on halo, plasma vector and spinning rotors. All parts use shared
  // graphics contexts and only transform per frame.
  const root = new PIXI.Container();
  root.eventMode = "none";

  const aura = new PIXI.Graphics(resources.projectileAuraContexts.cyan);
  aura.eventMode = "none";
  root.addChild(aura);

  const jet = new PIXI.Graphics(resources.projectileJetContexts.cyan);
  jet.eventMode = "none";
  root.addChild(jet);

  const body = new PIXI.Graphics(resources.miniContexts.cyan);
  body.eventMode = "none";
  root.addChild(body);

  const rotorSpins = MINI_ROTOR_POINTS.map(([x, y]) => {
    const rotor = new PIXI.Graphics(resources.rotorSpinContexts.cyan);
    rotor.position.set(x, y);
    rotor.scale.set(0.44);
    rotor.eventMode = "none";
    root.addChild(rotor);
    return rotor;
  });

  return {
    root,
    aura,
    jet,
    body,
    rotorSpins,
    skin: "cyan",
    flightSeed: Math.random() * Math.PI * 2,
    lastSeenAt: 0,
  };
}

function createCombatTextStyles() {
  const make = (fill) =>
    new PIXI.TextStyle({
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 0.4,
      fill,
      stroke: { color: 0x06101d, width: 4, join: "round" },
    });

  return {
    default: make(0xffffff),
    damage: make(0xff4b5e),
    "drone-loss": make(0xffb449),
    heal: make(0x63ff9b),
    "drone-reward": make(0x68ecff),
    "move-reward": make(0x9bff7a),
    "attack-reward": make(0xf3d0ff),
    shield: make(0x7de7ff),
  };
}

function createCombatTextVisual(resources) {
  const root = new PIXI.Text({
    text: "",
    style: resources.combatTextStyles.default,
  });
  root.anchor.set(0.5, 0.5);
  root.eventMode = "none";
  root.visible = false;

  return {
    root,
    id: "",
    kind: "",
    createdAt: 0,
    ttl: 2000,
    lastSeenAt: 0,
  };
}

function updateCombatTextVisual(visual, event, resources, now) {
  const createdAt = Number(event?.createdAt || Date.now());
  const ttl = Math.max(300, Number(event?.ttl || 2000));
  const age = clamp((Date.now() - createdAt) / ttl, 0, 1);

  if (age >= 1) {
    visual.root.visible = false;
    return false;
  }

  const kind = String(event?.kind || "default");
  if (visual.id !== event.id || visual.kind !== kind) {
    visual.id = event.id;
    visual.kind = kind;
    visual.root.text = String(event?.text || "");
    visual.root.style =
      resources.combatTextStyles[kind] || resources.combatTextStyles.default;
  }

  const side = Number(event?.side || 1) >= 0 ? 1 : -1;
  const lane = clamp(Number(event?.lane || 0), 0, 3);
  const easeOut = 1 - Math.pow(1 - age, 2);
  const lateral = side * (26 + easeOut * 74);
  const rise = 64 + easeOut * 88 + lane * 12;

  visual.root.visible = true;
  visual.root.position.set(
    Number(event?.x || 0) + lateral,
    Number(event?.y || 0) - rise,
  );
  visual.root.alpha = Math.pow(1 - age, 1.6);
  const intro = Math.min(1, age * 9);
  const scale = (0.86 + intro * 0.24) * (1 - age * 0.12);
  visual.root.scale.set(scale);
  visual.createdAt = createdAt;
  visual.ttl = ttl;
  visual.lastSeenAt = now;
  return true;
}

function syncCombatTextLayer({
  map,
  source,
  resources,
  parent,
  bounds,
  now,
  forceVisible = false,
}) {
  const active = new Set();
  const events = [];

  for (const event of source || []) {
    if (!event?.id) continue;
    // Private combat text is always for the local drone. Do not drop it just
    // because the server coordinate and the client camera are one frame apart.
    if (!forceVisible && !isVisibleInBounds(event, bounds, 260)) continue;
    const ttl = Math.max(300, Number(event.ttl || 2000));
    if (Date.now() - Number(event.createdAt || 0) >= ttl) continue;
    events.push(event);
  }

  events
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    .slice(-COMBAT_EVENT_MAX_RENDERED)
    .forEach((event) => {
      active.add(event.id);
      let visual = map.get(event.id);
      if (!visual) {
        visual = createCombatTextVisual(resources);
        parent.addChild(visual.root);
        map.set(event.id, visual);
      }
      updateCombatTextVisual(visual, event, resources, now);
    });

  for (const [id, visual] of map) {
    if (!active.has(id)) {
      visual.root.visible = false;
    }
    const age = Date.now() - Number(visual.createdAt || 0);
    if (visual.createdAt && age > Number(visual.ttl || 2000) + 320) {
      visual.root.destroy();
      map.delete(id);
    }
  }
}

function createStaticVisual(context, kind = "item", phase = 0) {
  const root = new PIXI.Graphics(context);
  return {
    root,
    context,
    kind,
    phase,
    lastSeenAt: 0,
  };
}

function staticPhaseFromKey(key) {
  let value = 2166136261;
  const source = String(key || "pickup");
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return ((value >>> 0) / 4294967295) * Math.PI * 2;
}

function animateStaticPickups(map, now) {
  for (const visual of map.values()) {
    if (!visual?.root?.visible) continue;

    const phase = Number(visual.phase || 0);
    if (visual.kind === "orb") {
      const pulse = 1 + Math.sin(now * 0.0062 + phase) * 0.085;
      visual.root.scale.set(pulse);
      visual.root.alpha = 0.89 + Math.sin(now * 0.0062 + phase) * 0.11;
      visual.root.rotation = Math.sin(now * 0.0015 + phase) * 0.025;
    } else if (visual.kind === "energy") {
      const pulse = 1 + Math.sin(now * 0.0052 + phase) * 0.065;
      visual.root.scale.set(pulse);
      visual.root.alpha = 0.91 + Math.sin(now * 0.0052 + phase) * 0.09;
      visual.root.rotation = Math.sin(now * 0.0019 + phase) * 0.032;
    } else {
      visual.root.scale.set(1);
      visual.root.alpha = 1;
      visual.root.rotation = 0;
    }
  }
}

function setWorldTransform(layer, cameraX, cameraY, scale) {
  layer.position.set(Number(cameraX || 0), Number(cameraY || 0));
  layer.scale.set(Math.max(0.1, Number(scale || 1)));
}

function getBounds(cameraX, cameraY, scale, width, height, margin = 320) {
  const safeScale = Math.max(0.1, Number(scale || 1));
  return {
    left: (-cameraX - margin) / safeScale,
    right: (width - cameraX + margin) / safeScale,
    top: (-cameraY - margin) / safeScale,
    bottom: (height - cameraY + margin) / safeScale,
  };
}

function isVisibleInBounds(item, bounds, radius = 150) {
  if (!item) return false;
  const x = Number(item.x || 0);
  const y = Number(item.y || 0);
  return x + radius >= bounds.left && x - radius <= bounds.right && y + radius >= bounds.top && y - radius <= bounds.bottom;
}

function upsertStaticLayer({ map, items, prefix, contexts, parent, now, maxItems, bounds, getContext }) {
  // Reuse the active-id set across syncs. On weak desktop hardware this avoids
  // three short-lived Set allocations every static refresh.
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 70)) continue;
    const key = `${prefix}:${item.id || `${Math.round(item.x)}:${Math.round(item.y)}`}`;
    active.add(key);
    const context = getContext(item, contexts);
    let visual = map.get(key);

    if (!visual) {
      visual = createStaticVisual(context, prefix, staticPhaseFromKey(key));
      visual.root.eventMode = "none";
      parent.addChild(visual.root);
      map.set(key, visual);
    }

    if (visual.context !== context) {
      visual.context = context;
      visual.root.context = context;
    }

    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!key.startsWith(`${prefix}:`)) continue;
    if (!active.has(key) && now - visual.lastSeenAt > 0) {
      visual.root.visible = false;
    }
    if (now - visual.lastSeenAt > ENTITY_STALE_MS * 8) {
      visual.root.destroy();
      map.delete(key);
    }
  }
}

function updateLaggedTrail(trail, targetX, targetY, response, scale, alpha, deltaSeconds, visible, reset = false) {
  const root = trail?.root;
  if (!root) return;

  if (!visible || alpha <= 0.001) {
    root.visible = false;
    trail.ready = false;
    return;
  }

  if (reset || !trail.ready) {
    root.position.set(targetX, targetY);
    trail.ready = true;
  } else {
    root.position.set(
      damp(root.position.x, targetX, response, deltaSeconds),
      damp(root.position.y, targetY, response, deltaSeconds),
    );
  }

  root.visible = true;
  root.alpha = alpha;
  root.scale.set(scale);
}


function updateUnitVisual(visual, unit, resources, now, isPlayer, compact = false, effectTier = 0, animateDecor = true) {
  const skin = normalizeSkin(unit.skin);
  const roleVariant = getHeistRoleVariantFromSkin(skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.body.context = resources.droneContexts[skin] || resources.droneContexts.cyan;
    visual.aura.context = resources.droneAuraContexts[skin] || resources.droneAuraContexts.cyan;
    visual.engineVector.context = resources.engineVectorContexts[skin] || resources.engineVectorContexts.cyan;
    visual.engineGlow.context = resources.engineGlowContexts[skin] || resources.engineGlowContexts.cyan;
    visual.roleTech.context = resources.roleTechContexts[skin] || resources.roleTechContexts.cyan;
    visual.rolePulse.context = resources.rolePulseContexts[skin] || resources.rolePulseContexts.cyan;
    visual.miniBeacons.forEach((beacon) => {
      beacon.context = resources.miniBeaconContexts[skin] || resources.miniBeaconContexts.cyan;
    });
    visual.rotorSpins.forEach((rotor) => {
      rotor.context = resources.rotorSpinContexts[skin] || resources.rotorSpinContexts.cyan;
    });
    visual.minis.forEach((mini) => {
      mini.context = resources.miniContexts[skin] || resources.miniContexts.cyan;
    });
    visual.shieldShell.context = resources.shieldShellContexts[skin] || resources.shieldShellContexts.cyan;
    visual.shieldRing.context = resources.shieldRingContexts[skin] || resources.shieldRingContexts.cyan;
    visual.shieldGlyphs.context = resources.shieldGlyphContexts[skin] || resources.shieldGlyphContexts.cyan;
    visual.shieldPulse.context = resources.shieldPulseContexts[skin] || resources.shieldPulseContexts.cyan;

    visual.rotorLayout = getHeistRotorLayout(roleVariant);
    visual.rotorSpins.forEach((rotor, index) => {
      const point = visual.rotorLayout[index];
      rotor.visible = Boolean(point);
      if (point) rotor.position.set(point[0], point[1]);
    });
  }

  const teamMarker = getCoreHeistTeamMarker(unit);
  if (visual.team !== teamMarker) {
    visual.team = teamMarker;
    visual.teamBeacon.context = resources.teamBeaconContexts[teamMarker || "cyan"] || resources.teamBeaconContexts.cyan;
  }
  visual.teamBeacon.visible = Boolean(teamMarker);
  if (teamMarker) {
    visual.teamBeacon.position.set(0, -145);
    const teamPulse = 1.05 + Math.sin(now * 0.008 + visual.hoverSeed) * 0.06;
    visual.teamBeacon.scale.set(teamPulse);
    visual.teamBeacon.alpha = 0.92 + Math.sin(now * 0.011 + visual.hoverSeed) * 0.08;
  }
  updateTacticalRoleOverlay(visual.tacticalRoleOverlay, unit, teamMarker);

  const deltaSeconds = clamp((now - (visual.lastFrameAt || now)) / 1000, 1 / 240, 0.05);
  visual.lastFrameAt = now;

  visual.root.visible = true;
  visual.root.position.set(Number(unit.x || 0), Number(unit.y || 0));
  visual.root.alpha = unit.alive === false ? 0.34 : 1;

  // Every full drone uses the exact same world-space body scale. Previously,
  // weak-mobile rendering marked remote players/bots as compact (0.76), while
  // the local drone stayed at 1.04. On iPhone that made every other drone look
  // visibly smaller even though their gameplay hitboxes were identical.
  // Compact now only remains a pool/rendering quality hint; it never changes
  // the physical-looking size of a full drone.
  const unifiedDroneScale = 1.04;
  visual.root.scale.set(unifiedDroneScale);

  // Pool entries can be reassigned to a different nearby player/bot.
  // Effects are transform-only and anchored to the craft, so no visual trail
  // is carried from the previous owner.
  const unitId = String(unit.id || "");
  const unitChanged = visual.unitId !== unitId;
  if (unitChanged) {
    visual.unitId = unitId;
  }

  const movementX = Number(unit.moveX || 0);
  const movementY = Number(unit.moveY || 0);
  const hasMovement = Boolean(unit.isMoving) || Math.hypot(movementX, movementY) > 0.015;
  const targetFacing = getUnitFacingTarget(unit, visual.facing);

  if (!visual.facingReady) {
    visual.facing = targetFacing;
    visual.facingReady = true;
  } else if (hasMovement) {
    const turnDelta = shortestAngleDelta(visual.facing, targetFacing);
    visual.facing = dampAngle(visual.facing, targetFacing, TURN_RESPONSE, deltaSeconds);

    // Gentle banking gives direction changes weight/inertia rather than a
    // mechanical instant pivot. It is intentionally tiny for readability.
    const angularVelocity = turnDelta / Math.max(deltaSeconds, 0.001);
    const targetBank = clamp(-angularVelocity * 0.024, -0.22, 0.22);
    visual.bank = damp(visual.bank, targetBank, BANK_RESPONSE, deltaSeconds);
  } else {
    visual.bank = damp(visual.bank, 0, BANK_RESPONSE * 0.7, deltaSeconds);
  }

  const hoverTime = now * 0.0019 + visual.hoverSeed;
  const throttle = hasMovement ? 1 : 0;
  const hoverLift = Math.sin(hoverTime) * (1.45 + throttle * 0.4);
  const subtleStretch = 1 + Math.sin(hoverTime * 1.45) * 0.012 + throttle * 0.016;
  const bankAmount = Math.abs(visual.bank);

  visual.vehicle.rotation = visual.facing;
  visual.vehicle.position.set(visual.bank * 6.5, hoverLift);
  visual.vehicle.skew.set(visual.bank * 0.16, -visual.bank * 0.06);
  visual.vehicle.scale.set(
    subtleStretch * (1 + bankAmount * 0.035),
    subtleStretch * (1 - bankAmount * 0.022),
  );

  // The drone body, position, turn and bank stay at the display refresh rate.
  // On a weak desktop only the decorative children below update at a lower
  // cadence. This preserves full visual identity while removing hundreds of
  // tiny property writes from the hot render path.
  const shouldAnimateDecor = Boolean(isPlayer || animateDecor || unitChanged);
  if (!shouldAnimateDecor) {
    visual.lastSeenAt = now;
    return;
  }
  visual.lastDecorAt = now;

  // Premium color glow and crisp engine plasma. There are no lagged smoke
  // puffs: all effects are attached directly to each drone so spectator view
  // remains as sharp as live play.
  const safeEffectTier = clamp(Number(effectTier || 0), 0, 2);
  // Compact remote shells must not keep aura, engine and rotor animation alive
  // on a weak GPU. Their body still follows every render frame exactly.
  const reducedRemoteVisual = !isPlayer && (compact || safeEffectTier >= 1);
  const glowStrength =
    (isPlayer ? 0.72 : 0.50) *
    (safeEffectTier === 2 && !isPlayer ? 0.62 : 1);
  const glowPulse = 1 + Math.sin(now * 0.0055 + visual.hoverSeed) * 0.06;

  visual.aura.visible = !reducedRemoteVisual;
  if (!reducedRemoteVisual) {
    visual.aura.rotation = now * 0.00018 + visual.hoverSeed * 0.09;
    visual.aura.scale.set(glowPulse * (1 + throttle * 0.075));
    visual.aura.alpha = glowStrength * (0.66 + Math.sin(now * 0.006 + visual.hoverSeed) * 0.16);
  }

  // Even the compact profile keeps physical flight cues. Aura, large shield
  // extras and escort drones are optional; engines and propellers are not.
  // That keeps every visible player/bot alive and readable on old laptops.
  const compactMotionScale = reducedRemoteVisual ? 0.68 : 1;
  const roleEngineProfile = roleVariant === "attacker"
    ? { y: 58, width: 0.86, length: 1.20, pulse: 1.14 }
    : roleVariant === "defender"
      ? { y: 59, width: 0.72, length: 0.98, pulse: 0.94 }
      : roleVariant === "tank"
        ? { y: 58, width: 1.18, length: 1.02, pulse: 1.08 }
        : { y: 47, width: 1, length: 1, pulse: 1 };

  visual.body.alpha = roleVariant
    ? 0.96 + Math.sin(now * 0.0058 + visual.hoverSeed) * 0.035
    : 1;
  visual.engineGlow.visible = true;
  visual.engineVector.visible = true;
  visual.engineGlow.position.set(0, roleEngineProfile.y);
  visual.engineGlow.scale.set(
    (0.94 + throttle * 0.22 + Math.sin(now * 0.010 + visual.hoverSeed) * 0.04) * compactMotionScale * roleEngineProfile.width,
    (0.94 + throttle * 0.22 + Math.sin(now * 0.010 + visual.hoverSeed) * 0.04) * compactMotionScale * roleEngineProfile.length,
  );
  visual.engineGlow.alpha =
    (hasMovement ? 0.84 : 0.52) * roleEngineProfile.pulse *
    (reducedRemoteVisual ? 0.58 : 1) *
    (safeEffectTier === 2 && !isPlayer ? 0.72 : 1);

  visual.engineVector.position.set(0, roleEngineProfile.y + 2);
  visual.engineVector.scale.set(
    (0.78 + throttle * 0.38) * compactMotionScale * roleEngineProfile.width,
    (0.72 + throttle * 0.54 + Math.sin(now * 0.014 + visual.hoverSeed) * 0.08) * compactMotionScale * roleEngineProfile.length,
  );
  visual.engineVector.alpha =
    (hasMovement ? 0.82 : 0.38) *
    (reducedRemoteVisual ? 0.62 : 1) *
    (safeEffectTier === 2 && !isPlayer ? 0.68 : 1);

  const hasRoleTech = Boolean(roleVariant);
  visual.roleTech.visible = hasRoleTech;
  visual.rolePulse.visible = hasRoleTech && !reducedRemoteVisual;

  if (hasRoleTech) {
    const roleBlink = 0.5 + 0.5 * Math.sin(now * (roleVariant === "attacker" ? 0.015 : roleVariant === "defender" ? 0.0105 : 0.0085) + visual.hoverSeed);
    const roleBreath = 1 + Math.sin(now * 0.0062 + visual.hoverSeed) * 0.028;
    visual.roleTech.position.set(0, 0);
    visual.roleTech.rotation = 0;
    visual.roleTech.scale.set(roleBreath);
    visual.roleTech.alpha = (0.44 + roleBlink * 0.52) * (reducedRemoteVisual ? 0.7 : 1);

    visual.rolePulse.position.set(0, 0);
    if (roleVariant === "defender") {
      // Forward Aegis is permanent cosmetic role identity. The animation uses
      // only transforms/alpha and remains inside the vehicle, so it rotates
      // naturally with the defender without changing any gameplay hitbox.
      visual.rolePulse.rotation = Math.sin(now * 0.00125 + visual.hoverSeed) * 0.012;
      visual.rolePulse.scale.set(0.92 + roleBlink * 0.032);
      visual.rolePulse.alpha = 0.58 + roleBlink * 0.24;
    } else if (roleVariant === "tank") {
      visual.rolePulse.rotation = now * 0.00072;
      visual.rolePulse.scale.set(0.96 + roleBlink * 0.045);
      visual.rolePulse.alpha = 0.20 + roleBlink * 0.42;
    } else {
      visual.rolePulse.rotation = 0;
      visual.rolePulse.scale.set(0.98 + roleBlink * 0.03);
      visual.rolePulse.alpha = 0.22 + roleBlink * 0.40;
    }
  }

  const rotorSpeed = reducedRemoteVisual ? 0.013 : 0.016;
  const rotorAlpha = reducedRemoteVisual ? 0.38 : 0.48;
  const rotorLayout = visual.rotorLayout || getHeistRotorLayout(roleVariant);
  visual.rotorSpins.forEach((rotor, index) => {
    const activeRotor = Boolean(rotorLayout[index]);
    rotor.visible = activeRotor;
    if (!activeRotor) return;
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.rotation = direction * now * rotorSpeed + index * Math.PI * 0.5;
    rotor.alpha = rotorAlpha * (roleVariant === "defender" ? 0.9 : 1);
  });

  const shieldActive = Boolean(unit.shieldActive || unit.isShieldActive || Number(unit.shieldUntil || 0) > Date.now());
  visual.shieldMix = damp(visual.shieldMix || 0, shieldActive ? 1 : 0, SHIELD_RESPONSE, deltaSeconds);
  const shieldVisible = visual.shieldMix > 0.015;
  [visual.shieldShell, visual.shieldRing, visual.shieldGlyphs, visual.shieldPulse].forEach((part) => {
    part.visible = shieldVisible;
  });

  if (shieldVisible) {
    const shieldPulsePhase = (now % 920) / 920;
    const shieldBreath = 1 + Math.sin(now * 0.0105) * 0.028;
    // Shield diameter follows the same full-drone scale for everyone.
    const shieldSize = 137 * shieldBreath;
    const shieldAlpha = visual.shieldMix;

    visual.shieldShell.scale.set(shieldSize * (0.95 + shieldAlpha * 0.05));
    visual.shieldShell.alpha = 0.68 * shieldAlpha;

    visual.shieldRing.scale.set(shieldSize * (1.01 + Math.sin(now * 0.007) * 0.015));
    visual.shieldRing.rotation = now * 0.00065;
    visual.shieldRing.alpha = (0.64 + Math.sin(now * 0.012) * 0.1) * shieldAlpha;

    visual.shieldGlyphs.scale.set(shieldSize * 0.98);
    visual.shieldGlyphs.rotation = -now * 0.00092;
    visual.shieldGlyphs.alpha = 0.78 * shieldAlpha;

    visual.shieldPulse.scale.set(shieldSize * (1 + shieldPulsePhase * 0.21));
    visual.shieldPulse.alpha = (1 - shieldPulsePhase) * 0.34 * shieldAlpha;
  }

  const requestedEscortCount = Math.min(MAX_MINI_DRONES, Math.max(0, Number(unit.drones || 0)));
  // Quality tiers may reduce glow/shields, but remote escort drones are core
  // gameplay information. Keep them visible; emergency tier uses at most two.
  const count = reducedRemoteVisual
    ? Math.min(requestedEscortCount, safeEffectTier >= 2 ? 2 : 3)
    : requestedEscortCount;
  visual.orbit.visible = count > 0;
  const attacking = Boolean(unit.attacking);
  const orbitRadius = attacking && isPlayer ? 175 : 145;
  visual.orbit.scale.set(orbitRadius);
  visual.orbit.alpha = isPlayer ? 0.64 : 0.36;

  const baseAngle = attacking && isPlayer
    ? Math.atan2(Number(unit.mouseY || unit.y) - Number(unit.y || 0), Number(unit.mouseX || unit.x) - Number(unit.x || 0))
    : 0;
  const spin = isPlayer ? now * (attacking ? 0.003 : 0.00135) : now * 0.0006;
  const aimX = attacking && isPlayer ? Math.cos(baseAngle) * 55 : 0;
  const aimY = attacking && isPlayer ? Math.sin(baseAngle) * 55 : 0;

  visual.minis.forEach((mini, index) => {
    const visible = index < count;
    mini.visible = visible;
    const miniBeacon = visual.miniBeacons[index];

    if (!visible) {
      miniBeacon.visible = false;
      return;
    }

    const angle = (index / Math.max(1, count)) * Math.PI * 2 + spin;
    const miniHover = Math.sin(now * 0.004 + index * 1.9) * 2.5;
    const miniX = Math.cos(angle) * orbitRadius + aimX;
    const miniY = Math.sin(angle) * orbitRadius + aimY + miniHover;
    mini.position.set(miniX, miniY);
    mini.rotation = visual.facing + Math.sin(now * 0.003 + index) * 0.045;
    const miniScale = 0.32 + Math.sin(now * 0.0045 + index * 1.3) * 0.014;
    mini.scale.set(miniScale);

    // Color-specific energy beacon: clearer and more playful than smoke,
    // while still using one cached geometry per escort drone.
    const beaconPulse = 1 + Math.sin(now * 0.012 + index * 1.7 + visual.hoverSeed) * 0.16;
    miniBeacon.visible = true;
    miniBeacon.position.set(miniX, miniY);
    miniBeacon.rotation = -now * 0.0026 + index * 1.37;
    miniBeacon.scale.set((0.86 + throttle * 0.12) * beaconPulse);
    miniBeacon.alpha =
      (isPlayer ? 0.78 : 0.56) *
      (safeEffectTier === 2 && !isPlayer ? 0.70 : 1);
  });

  visual.lastSeenAt = now;
}

function updateSimpleVisual(visual, unit, resources, now, animateDecor = true) {
  const skin = normalizeSkin(unit.skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.body.context = resources.simpleContexts[skin] || resources.simpleContexts.cyan;
    visual.engine.context = resources.engineVectorContexts[skin] || resources.engineVectorContexts.cyan;
    visual.minis.forEach((mini) => {
      mini.context = resources.miniContexts[skin] || resources.miniContexts.cyan;
    });
    visual.rotors.forEach((rotor) => {
      rotor.context = resources.rotorSpinContexts[skin] || resources.rotorSpinContexts.cyan;
    });
  }

  const unitId = String(unit.id || "");
  const unitChanged = visual.unitId !== unitId;
  if (unitChanged) visual.unitId = unitId;

  const teamMarker = getCoreHeistTeamMarker(unit);
  if (visual.team !== teamMarker) {
    visual.team = teamMarker;
    visual.teamBeacon.context = resources.teamBeaconContexts[teamMarker || "cyan"] || resources.teamBeaconContexts.cyan;
  }
  visual.teamBeacon.visible = Boolean(teamMarker);
  if (teamMarker) {
    visual.teamBeacon.position.set(0, -80);
    const teamPulse = 0.82 + Math.sin(now * 0.008 + visual.hoverSeed) * 0.05;
    visual.teamBeacon.scale.set(teamPulse);
    visual.teamBeacon.alpha = 0.84 + Math.sin(now * 0.01 + visual.hoverSeed) * 0.08;
  }
  updateTacticalRoleOverlay(visual.tacticalRoleOverlay, unit, teamMarker);

  const deltaSeconds = clamp((now - (visual.lastFrameAt || now)) / 1000, 1 / 240, 0.05);
  visual.lastFrameAt = now;
  const moveX = Number(unit.moveX || unit.velocityX || 0);
  const moveY = Number(unit.moveY || unit.velocityY || 0);
  const moving = Boolean(unit.isMoving) || Math.hypot(moveX, moveY) > 0.012;
  const targetFacing = getUnitFacingTarget(
    { ...unit, moveX, moveY, isMoving: moving },
    visual.facing || 0,
  );

  if (!visual.facingReady) {
    visual.facing = targetFacing;
    visual.facingReady = true;
  } else if (moving) {
    visual.facing = dampAngle(visual.facing, targetFacing, 15, deltaSeconds);
  }

  const phase = now * 0.0052 + visual.hoverSeed;
  const throttle = moving ? 1 : 0;
  visual.root.visible = true;
  visual.root.position.set(Number(unit.x || 0), Number(unit.y || 0));
  visual.root.rotation = visual.facing;
  visual.root.scale.set(0.96);
  visual.root.alpha = unit.alive === false ? 0.32 : 0.98;

  // Keep root transform/facing at 60 Hz. Rotor, engine and escort transforms
  // may be stepped on weak desktop hardware, without hiding a single model.
  if (!animateDecor && !unitChanged) {
    visual.lastSeenAt = now;
    return;
  }
  visual.lastDecorAt = now;

  // Cheap transform-only propulsion: one engine scale/alpha plus four rotor
  // rotations. This costs far less than the premium aura/shield/escort layer.
  visual.body.position.set(0, Math.sin(phase) * 0.72);
  visual.engine.visible = true;
  visual.engine.scale.set(
    0.36 + throttle * 0.08,
    0.34 + throttle * 0.15 + Math.sin(phase * 1.7) * 0.025,
  );
  visual.engine.alpha = moving ? 0.72 : 0.38;

  visual.rotors.forEach((rotor, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.rotation = direction * now * 0.026 + index * Math.PI * 0.5;
    rotor.alpha = moving ? 0.62 : 0.42;
  });

  // Escort drones are intentionally simpler than the near premium pool:
  // no glow and no extra rotor objects, but the same skin, body and orbit
  // count remain visible for every remote player/bot.
  const escortCount = Math.min(MAX_MINI_DRONES, Math.max(0, Number(unit.drones || 0)));
  const escortRadius = 56;
  const escortSpin = now * (moving ? 0.00185 : 0.00125) + visual.hoverSeed;
  visual.minis.forEach((mini, index) => {
    const visible = index < escortCount;
    mini.visible = visible;
    if (!visible) return;

    const angle = (index / Math.max(1, escortCount)) * Math.PI * 2 + escortSpin;
    mini.position.set(
      Math.cos(angle) * escortRadius,
      Math.sin(angle) * escortRadius + Math.sin(now * 0.004 + index * 1.7) * 1.45,
    );
    mini.rotation = Math.sin(now * 0.003 + index) * 0.05;
    const pulse = 0.18 + Math.sin(now * 0.0045 + index) * 0.008;
    mini.scale.set(pulse);
    mini.alpha = 0.93;
  });

  visual.lastSeenAt = now;
}

function updateSimpleProjectileVisual(visual, projectile, resources, now) {
  const skin = normalizeSkin(projectile.skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.body.context = resources.miniContexts[skin] || resources.miniContexts.cyan;
    visual.rotors.forEach((rotor) => {
      rotor.context = resources.rotorSpinContexts[skin] || resources.rotorSpinContexts.cyan;
    });
  }

  const heading = Number(
    projectile.angle ??
      Math.atan2(Number(projectile.vy || 0), Number(projectile.vx || 1)),
  );
  const phase = now * 0.017 + visual.flightSeed;

  visual.root.visible = true;
  visual.root.position.set(Number(projectile.x || 0), Number(projectile.y || 0));
  visual.root.rotation = heading + Math.PI * 0.5;
  // The launched attack drone reuses the same silhouette as its owner,
  // but must read as a compact combat unit rather than a second main craft.
  visual.root.scale.set(0.28);
  visual.root.alpha = 0.96;
  visual.body.position.set(0, Math.sin(phase) * 0.42);
  visual.rotors.forEach((rotor, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.rotation = direction * now * 0.036 + index * Math.PI * 0.5;
    rotor.alpha = 0.68;
  });
  visual.lastSeenAt = now;
}

function updateProjectileVisual(visual, projectile, resources, now, compact = false) {
  const skin = normalizeSkin(projectile.skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.aura.context = resources.projectileAuraContexts[skin] || resources.projectileAuraContexts.cyan;
    visual.jet.context = resources.projectileJetContexts[skin] || resources.projectileJetContexts.cyan;
    visual.body.context = resources.miniContexts[skin] || resources.miniContexts.cyan;
    visual.rotorSpins.forEach((rotor) => {
      rotor.context = resources.rotorSpinContexts[skin] || resources.rotorSpinContexts.cyan;
    });
  }

  const heading = Number(
    projectile.angle ??
      Math.atan2(Number(projectile.vy || 0), Number(projectile.vx || 1)),
  );

  // Mini drone artwork faces up in local space; add 90° so its nose points
  // precisely along its real flight vector (angle 0 = moving right).
  // Projectiles share the owner's role silhouette, rendered at a true
  // attack-drone size. Piercing shots gain only a subtle size boost.
  const flightScale = projectile.pierceLeft > 1 ? 0.38 : 0.32;
  const phase = now * 0.016 + visual.flightSeed;
  const hover = Math.sin(phase * 1.12) * 0.72;
  const pulse = 1 + Math.sin(phase * 1.45) * 0.08;

  visual.root.visible = true;
  visual.root.position.set(Number(projectile.x || 0), Number(projectile.y || 0));
  visual.root.rotation = heading + Math.PI * 0.5;
  visual.root.scale.set(flightScale);
  visual.root.alpha = projectile.localOnly ? 0.92 : 1;

  // The attack is one object: a small attack drone. The old lock-on halo and
  // plasma jet looked like a second projectile/arrow, especially on low DPI
  // screens, so they are intentionally never rendered.
  visual.aura.visible = false;
  visual.jet.visible = false;

  // Attack drones are a priority object even on weak hardware. Keep their
  // flight bob and rotor cadence live; only larger world/remote decorations
  // are downgraded by the adaptive profile.
  visual.body.position.set(0, hover);
  visual.rotorSpins.forEach((rotor, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.visible = true;
    rotor.rotation = direction * now * (compact ? 0.026 : 0.032) + index * Math.PI * 0.5;
    rotor.alpha = compact ? 0.60 : 0.78;
  });
  visual.lastSeenAt = now;
}

function syncUnitPool({ pool, source, resources, parent, bounds, max, now, isPlayer = false, compact = false, effectTier = 0, animateDecor = true, preCulled = false }) {
  const visible = pool.__visibleScratch || (pool.__visibleScratch = []);
  const ids = pool.__idsScratch || (pool.__idsScratch = new Set());
  visible.length = 0;
  ids.clear();
  for (const unit of source || []) {
    // The local drone must never be visibility-culled. On mobile the camera
    // and the newest player snapshot may arrive one render tick apart; culling
    // here could otherwise hide the player's own drone for an entire frame or
    // until the next packet. Remote drones keep the normal camera culling.
    if (
      !unit ||
      unit.alive === false ||
      (!isPlayer && !preCulled && !isVisibleInBounds(unit, bounds, 320))
    ) continue;
    visible.push(unit);
    ids.add(String(unit.id || ""));
    if (visible.length >= max) break;
  }

  addToPool(pool, () => createUnitVisual(resources), parent, visible.length);
  for (let index = 0; index < pool.length; index += 1) {
    const unit = visible[index];
    const visual = pool[index];
    if (!unit) {
      visual.root.visible = false;
      continue;
    }
    updateUnitVisual(visual, unit, resources, now, isPlayer, compact, effectTier, animateDecor);
  }
  return ids;
}

function syncSimplePool({ pool, source, resources, parent, bounds, max, now, excludeIds = null, animateDecor = true, preCulled = false }) {
  const visible = pool.__visibleScratch || (pool.__visibleScratch = []);
  const seen = pool.__seenScratch || (pool.__seenScratch = new Set());
  visible.length = 0;
  seen.clear();
  for (const unit of source || []) {
    const id = String(unit?.id || "");
    if (!unit || !id || seen.has(id) || (excludeIds && excludeIds.has(id)) || unit.alive === false || (!preCulled && !isVisibleInBounds(unit, bounds, 120))) continue;
    seen.add(id);
    visible.push(unit);
    if (visible.length >= max) break;
  }

  addToPool(pool, () => createSimpleVisual(resources), parent, visible.length);
  for (let index = 0; index < pool.length; index += 1) {
    const unit = visible[index];
    const visual = pool[index];
    if (!unit) {
      visual.root.visible = false;
      continue;
    }
    updateSimpleVisual(visual, unit, resources, now, animateDecor);
  }
}

function syncProjectilePool({ pool, source, resources, parent, bounds, max, now, compact = false, simple = false, excludeIds = null, preCulled = false }) {
  const visible = pool.__visibleScratch || (pool.__visibleScratch = []);
  const ids = pool.__idsScratch || (pool.__idsScratch = new Set());
  visible.length = 0;
  ids.clear();
  for (const projectile of source || []) {
    const id = String(projectile?.id || "");
    if (!projectile || !id || (excludeIds && excludeIds.has(id)) || (!preCulled && !isVisibleInBounds(projectile, bounds, 120))) continue;
    visible.push(projectile);
    ids.add(id);
    if (visible.length >= max) break;
  }

  addToPool(pool, () => simple ? createSimpleProjectileVisual(resources) : createProjectileVisual(resources), parent, visible.length);
  for (let index = 0; index < pool.length; index += 1) {
    const projectile = visible[index];
    const visual = pool[index];
    if (!projectile) {
      visual.root.visible = false;
      continue;
    }
    if (simple) {
      updateSimpleProjectileVisual(visual, projectile, resources, now);
    } else {
      updateProjectileVisual(visual, projectile, resources, now, compact);
    }
  }
  return ids;
}

function createResources(coreTypes = []) {
  const droneContexts = {};
  const miniContexts = {};
  const simpleContexts = {};
  const simpleProjectileContexts = {};
  const rotorSpinContexts = {};
  const droneAuraContexts = {};
  const engineGlowContexts = {};
  const engineVectorContexts = {};
  const roleTechContexts = {};
  const rolePulseContexts = {};
  const miniBeaconContexts = {};
  const projectileAuraContexts = {};
  const projectileJetContexts = {};
  const shieldShellContexts = {};
  const shieldRingContexts = {};
  const shieldGlyphContexts = {};
  const shieldPulseContexts = {};
  const teamBeaconContexts = {
    cyan: createTeamBeaconContext("cyan"),
    orange: createTeamBeaconContext("orange"),
  };

  Object.entries(SKIN_THEMES).forEach(([skin, colors]) => {
    const roleVariant = getHeistRoleVariantFromSkin(skin);
    droneContexts[skin] = createDroneContext(colors, roleVariant);
    // Use the same main drone silhouette for escort/orbit drones so they match
    // the primary craft visually instead of using a simplified mini-only design.
    miniContexts[skin] = createDroneContext(colors, roleVariant);
    rotorSpinContexts[skin] = createRotorSpinContext(colors);
    droneAuraContexts[skin] = createDroneAuraContext(colors);
    engineGlowContexts[skin] = createEngineGlowContext(colors);
    engineVectorContexts[skin] = createEngineVectorContext(colors);
    roleTechContexts[skin] = createRoleTechContext(colors, roleVariant);
    rolePulseContexts[skin] = createRolePulseContext(colors, roleVariant);
    miniBeaconContexts[skin] = createMiniBeaconContext(colors);
    projectileAuraContexts[skin] = createProjectileAuraContext(colors);
    projectileJetContexts[skin] = createProjectileJetContext(colors);
    shieldShellContexts[skin] = createShieldShellContext(colors);
    shieldRingContexts[skin] = createShieldRingContext(colors);
    shieldGlyphContexts[skin] = createShieldGlyphContext(colors);
    shieldPulseContexts[skin] = createShieldPulseContext(colors);

    simpleContexts[skin] = createLiteDroneContext(colors, roleVariant);

    const simpleProjectile = new PIXI.GraphicsContext();
    simpleProjectile.poly([9, 0, -6, -5, -6, 5]).fill({ color: colors[0], alpha: 0.96 });
    simpleProjectileContexts[skin] = simpleProjectile;
  });

  const coreContexts = {};
  coreTypes.forEach((core) => {
    coreContexts[core.type] = createCoreContext(colorFrom(core.color, 0x00eaff));
  });

  return {
    droneContexts,
    miniContexts,
    simpleContexts,
    simpleProjectileContexts,
    rotorSpinContexts,
    droneAuraContexts,
    engineGlowContexts,
    engineVectorContexts,
    roleTechContexts,
    rolePulseContexts,
    miniBeaconContexts,
    projectileAuraContexts,
    projectileJetContexts,
    shieldShellContexts,
    shieldRingContexts,
    shieldGlyphContexts,
    shieldPulseContexts,
    teamBeaconContexts,
    orbContexts: Object.fromEntries(Object.entries(ORB_COLORS).map(([name, color]) => [name, createOrbContext(color)])),
    energyContext: createEnergyContext(),
    coreContexts,
    defaultCoreContext: createCoreContext(0x00eaff),
    orbitContext: createOrbitContext(),
    zoneContext: createZoneContext(),
    combatTextStyles: createCombatTextStyles(),
  };
}

function drawBackground(graphics, width, height) {
  graphics.clear();
  // This is visible only outside the actual world. Use a darker, cozy tone so
  // the temporary frame before the terrain attaches feels intentional instead
  // of flashing from a mismatched background.
  graphics.rect(0, 0, width, height).fill({ color: 0x040b12, alpha: 1 });
  graphics.rect(0, 0, width, height).stroke({ color: 0x0b1925, width: 2, alpha: 0.18 });
}

function pixelHash(x, y, seed = 1337) {
  let value = (x * 374761393 + y * 668265263 + seed * 69069) >>> 0;
  value = (value ^ (value >>> 13)) * 1274126177;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function pixelSmooth(value) {
  return value * value * (3 - 2 * value);
}

function pixelNoise(x, y, scale, seed = 1337) {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = pixelSmooth(sx - x0);
  const ty = pixelSmooth(sy - y0);
  const a = pixelHash(x0, y0, seed);
  const b = pixelHash(x0 + 1, y0, seed);
  const c = pixelHash(x0, y0 + 1, seed);
  const d = pixelHash(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function pixelFractal(x, y, seed = 1337) {
  return (
    pixelNoise(x, y, 44, seed) * 0.54 +
    pixelNoise(x, y, 19, seed + 47) * 0.28 +
    pixelNoise(x, y, 7, seed + 91) * 0.18
  );
}

function pixelLandScore(nx, ny) {
  // Large, deterministic continental mass with bays, islands and a clear
  // coastline. `nx` / `ny` are in [0, 1], so the same terrain works at any
  // world size without touching gameplay coordinates.
  const centerX = (nx - 0.52) / 0.78;
  const centerY = (ny - 0.50) / 0.94;
  const centralContinent = 0.94 - Math.hypot(centerX, centerY);
  const northIsland = 0.54 - Math.hypot((nx - 0.22) / 0.25, (ny - 0.24) / 0.2);
  const eastIsland = 0.42 - Math.hypot((nx - 0.83) / 0.18, (ny - 0.68) / 0.22);
  const southIsland = 0.35 - Math.hypot((nx - 0.46) / 0.18, (ny - 0.84) / 0.15);
  const coastline = pixelFractal(nx * 160, ny * 160, 808) * 0.34;
  return Math.max(centralContinent, northIsland, eastIsland, southIsland) + coastline;
}

function fillPixelRect(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

function drawPixelRoad(ctx, points, width, color) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(Math.round(point[0]), Math.round(point[1]));
    else ctx.lineTo(Math.round(point[0]), Math.round(point[1]));
  });
  ctx.stroke();
  ctx.restore();
}

function findPixelLandSpot(mask, cells, random, margin = 10) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const x = margin + Math.floor(random() * Math.max(1, cells - margin * 2));
    const y = margin + Math.floor(random() * Math.max(1, cells - margin * 2));
    if (mask[y * cells + x]) return { x, y };
  }
  return { x: Math.floor(cells * 0.5), y: Math.floor(cells * 0.5) };
}

function createPixelTerrainTexture(worldWidth, worldHeight) {
  // Premium deep-space backdrop for Battle Royale only.
  // Decorative only: gameplay, bots, collisions, loot and movement are untouched.
  const device = getRendererDeviceProfile(false);
  const mobile = device.mobile;
  // The terrain is one decorative sprite. 1536px is visually sufficient at
  // the Battle Royale camera height and avoids a large GPU texture on GTX
  // 1050-era laptops.
  const size = mobile ? 2048 : device.weakDesktop ? 1024 : 3072;
  const cacheKey = `battle-royale-space-premium:${mobile ? "mobile" : device.weakDesktop ? "desktop-low" : "desktop"}:${size}`;
  let texture = WORLD_TERRAIN_TEXTURE_CACHE.get(cacheKey);

  // A previous Pixi application may have been unmounted after changing modes.
  // Never reuse a texture whose GPU/source was already destroyed.
  if (texture?.destroyed || texture?.source?.destroyed || texture?.baseTexture?.destroyed) {
    WORLD_TERRAIN_TEXTURE_CACHE.delete(cacheKey);
    texture = null;
  }

  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;

    let randomState = 0x6bc84f21;
    const random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    const px = (value) => value * size;

    const fillPolygon = (points, fill, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const strokePath = (points, width, stroke, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    const addNebula = (x, y, rx, ry, rotation, colors) => {
      for (let layer = 0; layer < colors.length; layer += 1) {
        const [inner, outer, alphaMul] = colors[layer];
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        grad.addColorStop(0, inner);
        grad.addColorStop(0.62, outer);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation + layer * 0.18);
        ctx.scale(rx * (1 - layer * 0.12), ry * (1 - layer * 0.14));
        ctx.globalAlpha = alphaMul;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const addPlanet = ({ x, y, r, colors, glow, atmosphere, offsetX = -0.22, offsetY = -0.18 }) => {
      const planet = ctx.createRadialGradient(x + r * offsetX, y + r * offsetY, r * 0.06, x, y, r);
      colors.forEach(([stop, color]) => planet.addColorStop(stop, color));
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      const glowGrad = ctx.createRadialGradient(x - r * 0.55, y - r * 0.36, 0, x - r * 0.25, y - r * 0.18, r * 1.16);
      glowGrad.addColorStop(0, glow);
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(x - r * 0.18, y - r * 0.12, r * 1.14, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = atmosphere;
      ctx.lineWidth = Math.max(6, r * 0.045);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.98, Math.PI * 1.08, Math.PI * 1.82);
      ctx.stroke();
      ctx.restore();
    };

    const addArc = (cx, cy, radius, start, end, width, color, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, end);
      ctx.stroke();
      ctx.restore();
    };

    const addShipSilhouette = (points, body, edge) => {
      fillPolygon(points, body, 1);
      strokePath([...points, points[0]], 4, edge, 0.18);
    };

    // Deep base.
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, "#010205");
    base.addColorStop(0.28, "#04080f");
    base.addColorStop(0.64, "#07101a");
    base.addColorStop(1, "#02050a");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Broad atmospheric color fields for depth.
    const topWash = ctx.createLinearGradient(0, 0, size, 0);
    topWash.addColorStop(0, "rgba(18, 34, 58, 0.12)");
    topWash.addColorStop(0.5, "rgba(7, 14, 22, 0.02)");
    topWash.addColorStop(1, "rgba(35, 16, 54, 0.08)");
    ctx.fillStyle = topWash;
    ctx.fillRect(0, 0, size, size);

    // Major nebula masses, clearly visible, no dots / no stars.
    addNebula(px(0.18), px(0.22), px(0.32), px(0.16), -0.45, [
      ["rgba(48, 96, 164, 0.26)", "rgba(17, 39, 69, 0.12)", 1],
      ["rgba(104, 171, 224, 0.10)", "rgba(27, 60, 103, 0.06)", 0.9],
      ["rgba(20, 62, 95, 0.14)", "rgba(5, 14, 21, 0.04)", 0.8],
    ]);
    addNebula(px(0.77), px(0.30), px(0.30), px(0.15), 0.32, [
      ["rgba(121, 75, 196, 0.22)", "rgba(48, 22, 82, 0.10)", 1],
      ["rgba(198, 118, 255, 0.08)", "rgba(72, 31, 113, 0.05)", 0.9],
      ["rgba(40, 23, 62, 0.12)", "rgba(9, 5, 14, 0.04)", 0.75],
    ]);
    addNebula(px(0.58), px(0.82), px(0.42), px(0.18), -0.14, [
      ["rgba(33, 137, 164, 0.16)", "rgba(11, 52, 63, 0.08)", 1],
      ["rgba(77, 202, 208, 0.08)", "rgba(22, 78, 85, 0.04)", 0.88],
      ["rgba(25, 36, 70, 0.10)", "rgba(7, 12, 24, 0.03)", 0.72],
    ]);

    // Visible planet and secondary moon for a proper space feel.
    addPlanet({
      x: px(0.92),
      y: px(0.14),
      r: px(mobile ? 0.20 : 0.23),
      colors: [
        [0, "rgba(71, 112, 151, 0.96)"],
        [0.25, "rgba(32, 57, 83, 0.98)"],
        [0.72, "rgba(10, 17, 27, 1)"],
        [1, "rgba(4, 7, 12, 1)"],
      ],
      glow: "rgba(93, 156, 214, 0.18)",
      atmosphere: "rgba(131, 197, 237, 0.22)",
    });

    addPlanet({
      x: px(0.12),
      y: px(0.84),
      r: px(mobile ? 0.12 : 0.14),
      colors: [
        [0, "rgba(120, 80, 170, 0.86)"],
        [0.32, "rgba(55, 33, 82, 0.90)"],
        [0.8, "rgba(10, 8, 17, 0.98)"],
        [1, "rgba(4, 3, 8, 1)"],
      ],
      glow: "rgba(165, 108, 218, 0.14)",
      atmosphere: "rgba(202, 141, 255, 0.16)",
      offsetX: -0.16,
      offsetY: -0.20,
    });

    // Orbital / station rings.
    addArc(px(0.31), px(0.71), px(0.54), -0.45, 1.22, 16, "rgba(79, 110, 148, 0.14)");
    addArc(px(0.35), px(0.75), px(0.47), -0.30, 1.18, 9, "rgba(41, 62, 94, 0.18)");
    addArc(px(0.83), px(0.18), px(0.22), 0.72, 2.24, 8, "rgba(129, 185, 220, 0.12)");

    // Wide energy lanes / warp wakes.
    const laneA = ctx.createLinearGradient(px(0.04), px(0.17), px(0.92), px(0.58));
    laneA.addColorStop(0, "rgba(0,0,0,0)");
    laneA.addColorStop(0.5, "rgba(67, 123, 186, 0.12)");
    laneA.addColorStop(1, "rgba(0,0,0,0)");
    strokePath([[px(0.04), px(0.17)], [px(0.27), px(0.28)], [px(0.52), px(0.39)], [px(0.74), px(0.47)], [px(0.92), px(0.58)]], 30, laneA);

    const laneB = ctx.createLinearGradient(px(0.10), px(0.80), px(0.96), px(0.32));
    laneB.addColorStop(0, "rgba(0,0,0,0)");
    laneB.addColorStop(0.48, "rgba(138, 94, 209, 0.10)");
    laneB.addColorStop(1, "rgba(0,0,0,0)");
    strokePath([[px(0.10), px(0.80)], [px(0.31), px(0.69)], [px(0.55), px(0.55)], [px(0.79), px(0.43)], [px(0.96), px(0.32)]], 24, laneB);

    // Massive capital-ship silhouettes at the edges so the battlefield feels embedded in a fleet.
    addShipSilhouette([
      [px(0.00), px(0.98)],
      [px(0.17), px(0.84)],
      [px(0.33), px(0.81)],
      [px(0.28), px(0.90)],
      [px(0.10), px(1.00)],
      [px(0.00), px(1.00)],
    ], "rgba(7, 12, 20, 0.54)", "rgba(122, 154, 201, 1)");

    addShipSilhouette([
      [px(0.70), px(0.00)],
      [px(1.00), px(0.00)],
      [px(1.00), px(0.24)],
      [px(0.89), px(0.27)],
      [px(0.80), px(0.21)],
      [px(0.72), px(0.08)],
    ], "rgba(8, 13, 22, 0.46)", "rgba(116, 136, 182, 1)");

    // Subtle hull lines on the edge ships.
    strokePath([[px(0.05), px(0.95)], [px(0.18), px(0.87)], [px(0.28), px(0.85)]], 4, "rgba(95, 130, 170, 0.16)");
    strokePath([[px(0.82), px(0.03)], [px(0.91), px(0.08)], [px(0.98), px(0.17)]], 3, "rgba(114, 140, 178, 0.14)");

    // Large station / gate silhouette in the mid-ground.
    ctx.save();
    ctx.translate(px(0.58), px(0.22));
    ctx.rotate(-0.24);
    const gate = ctx.createLinearGradient(-px(0.08), 0, px(0.08), 0);
    gate.addColorStop(0, "rgba(21, 31, 48, 0.42)");
    gate.addColorStop(0.5, "rgba(10, 16, 26, 0.56)");
    gate.addColorStop(1, "rgba(21, 31, 48, 0.42)");
    ctx.fillStyle = gate;
    ctx.beginPath();
    ctx.ellipse(0, 0, px(0.10), px(0.035), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(96, 138, 184, 0.16)";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "rgba(56, 90, 126, 0.16)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, px(0.074), 0.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.restore();

    // Broad volumetric haze layers for polish and depth.
    for (let index = 0; index < (mobile ? 14 : 22); index += 1) {
      const x = random() * size;
      const y = random() * size;
      const rx = px(0.07 + random() * 0.15);
      const ry = rx * (0.16 + random() * 0.26);
      const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      if (index % 3 === 0) haze.addColorStop(0, "rgba(55, 111, 162, 0.05)");
      else if (index % 3 === 1) haze.addColorStop(0, "rgba(101, 73, 173, 0.045)");
      else haze.addColorStop(0, "rgba(44, 156, 164, 0.04)");
      haze.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((random() - 0.5) * Math.PI);
      ctx.scale(rx, ry);
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Depth veil and final vignette.
    const veil = ctx.createLinearGradient(0, 0, 0, size);
    veil.addColorStop(0, "rgba(82, 107, 132, 0.035)");
    veil.addColorStop(0.45, "rgba(24, 33, 49, 0.03)");
    veil.addColorStop(1, "rgba(3, 6, 10, 0.10)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, size, size);

    const vignette = ctx.createRadialGradient(px(0.5), px(0.5), px(0.12), px(0.5), px(0.5), px(0.90));
    vignette.addColorStop(0, "rgba(255,255,255,0.01)");
    vignette.addColorStop(0.52, "rgba(8, 14, 22, 0.05)");
    vignette.addColorStop(1, "rgba(1, 2, 5, 0.64)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    texture = PIXI.Texture.from(canvas);
    if (texture?.source) texture.source.scaleMode = "linear";
    if (texture?.baseTexture) texture.baseTexture.scaleMode = PIXI.SCALE_MODES?.LINEAR ?? "linear";
    WORLD_TERRAIN_TEXTURE_CACHE.set(cacheKey, texture);
  }

  const sprite = new PIXI.Sprite(texture);
  sprite.position.set(0, 0);
  sprite.width = Math.max(1, Number(worldWidth || DEFAULT_WORLD_WIDTH));
  sprite.height = Math.max(1, Number(worldHeight || DEFAULT_WORLD_HEIGHT));
  sprite.alpha = 0.985;
  sprite.eventMode = "none";
  return sprite;
}

function createUniversalStarfieldTexture(forceLowQuality = false) {
  const device = getRendererDeviceProfile(forceLowQuality);
  const size = device.lowSpecDesktop ? 640 : device.mobile ? 900 : 1024;
  const profile = device.lowSpecDesktop
    ? "desktop-low"
    : device.mobile
      ? "mobile"
      : "desktop";
  const cacheKey = `universal-starfield:v1:${profile}:${size}`;
  let texture = UNIVERSAL_STARFIELD_TEXTURE_CACHE.get(cacheKey);

  if (texture?.destroyed || texture?.source?.destroyed || texture?.baseTexture?.destroyed) {
    UNIVERSAL_STARFIELD_TEXTURE_CACHE.delete(cacheKey);
    texture = null;
  }

  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;

    // Deterministic field: it is generated once, cached and never rebuilt or
    // animated in the ticker. That keeps it safe for phones and weak GPUs.
    let randomState = 0x9e3779b9;
    const random = () => {
      randomState = (randomState * 1664525 + 1013904223) >>> 0;
      return randomState / 4294967296;
    };

    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, "#020712");
    base.addColorStop(0.52, "#050d19");
    base.addColorStop(1, "#02050c");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Very faint color haze gives depth without a particle effect or blur.
    const haze = ctx.createRadialGradient(size * 0.22, size * 0.18, 0, size * 0.22, size * 0.18, size * 0.82);
    haze.addColorStop(0, "rgba(31, 93, 154, 0.21)");
    haze.addColorStop(0.45, "rgba(16, 38, 72, 0.09)");
    haze.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, size, size);

    const colors = [
      "rgba(255,255,255,",
      "rgba(180,224,255,",
      "rgba(151,197,255,",
      "rgba(222,205,255,",
    ];
    const starCount = device.lowSpecDesktop ? 185 : device.mobile ? 310 : 390;

    for (let index = 0; index < starCount; index += 1) {
      const x = Math.floor(random() * size) + 0.5;
      const y = Math.floor(random() * size) + 0.5;
      const bright = index % 17 === 0;
      const radius = bright ? 1.8 + random() * 1.15 : 0.5 + random() * 1.15;
      const alpha = bright ? 0.68 + random() * 0.24 : 0.25 + random() * 0.55;
      ctx.fillStyle = `${colors[Math.floor(random() * colors.length)]}${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Sparse four-point glints are baked into the texture, so they add no
      // filters, particles or per-frame draw calls.
      if (bright) {
        ctx.strokeStyle = `rgba(219,241,255,${0.22 + random() * 0.18})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - radius * 2.4, y);
        ctx.lineTo(x + radius * 2.4, y);
        ctx.moveTo(x, y - radius * 2.4);
        ctx.lineTo(x, y + radius * 2.4);
        ctx.stroke();
      }
    }

    texture = PIXI.Texture.from(canvas);
    if (texture?.source) texture.source.scaleMode = "linear";
    if (texture?.baseTexture) texture.baseTexture.scaleMode = PIXI.SCALE_MODES?.LINEAR ?? "linear";
    UNIVERSAL_STARFIELD_TEXTURE_CACHE.set(cacheKey, texture);
  }

  return texture;
}

function createUniversalStarfieldSprite(worldWidth, worldHeight, forceLowQuality = false) {
  const texture = createUniversalStarfieldTexture(forceLowQuality);
  const width = Math.max(1, Number(worldWidth || DEFAULT_WORLD_WIDTH));
  const height = Math.max(1, Number(worldHeight || DEFAULT_WORLD_HEIGHT));
  let sprite = null;

  // Prefer a repeating world-space texture. It keeps the star density high in
  // a 14k–20k arena instead of stretching a 1024px canvas over the entire map.
  // The Sprite fallback keeps compatibility with any old Pixi build where
  // TilingSprite is unavailable or rejects the v8 constructor.
  if (typeof PIXI.TilingSprite === "function") {
    try {
      sprite = new PIXI.TilingSprite({ texture, width, height });
    } catch {
      try {
        sprite = new PIXI.TilingSprite(texture, width, height);
      } catch {
        sprite = null;
      }
    }
  }

  if (!sprite) {
    sprite = new PIXI.Sprite(texture);
    sprite.width = width;
    sprite.height = height;
  }

  sprite.position.set(0, 0);
  // This is intentionally strong enough to remain visible above the existing
  // Battle Royale ground texture, but still sits below zones, loot and drones.
  sprite.alpha = 0.84;
  sprite.blendMode = "screen";
  sprite.eventMode = "none";
  return sprite;
}

function syncUniversalStarfield(layer, state, worldWidth, worldHeight, forceLowQuality = false) {
  const width = Math.max(1, Math.round(Number(worldWidth || DEFAULT_WORLD_WIDTH)));
  const height = Math.max(1, Math.round(Number(worldHeight || DEFAULT_WORLD_HEIGHT)));
  const key = `${width}:${height}:${forceLowQuality ? "low" : "auto"}`;
  if (state.key === key) return;

  const previous = layer.removeChildren();
  previous.forEach(destroyTerrainChild);
  state.key = key;

  try {
    layer.addChild(createUniversalStarfieldSprite(width, height, forceLowQuality));
  } catch (error) {
    state.failedKey = key;
    if (typeof console !== "undefined") {
      console.warn("Universal starfield fallback", error);
    }
  }
}

function destroyTerrainChild(child) {
  try {
    // Terrain textures are globally cached across arena mode changes. Destroy
    // only the display object, never the shared texture/source.
    child?.destroy?.({ children: true, texture: false, textureSource: false });
  } catch {
    try {
      child?.destroy?.({ children: true });
    } catch {
      // no-op
    }
  }
}

function syncWorldTerrain(layer, state, theme, worldWidth, worldHeight) {
  const normalizedTheme = String(theme || "default");
  const width = Math.max(1, Math.round(Number(worldWidth || DEFAULT_WORLD_WIDTH)));
  const height = Math.max(1, Math.round(Number(worldHeight || DEFAULT_WORLD_HEIGHT)));
  const key = `${normalizedTheme}:${width}:${height}`;
  if (state.key === key) return;

  const previous = layer.removeChildren();
  previous.forEach(destroyTerrainChild);
  state.key = key;

  if (!SPACE_BATTLE_THEMES.has(normalizedTheme)) return;

  try {
    layer.addChild(createPixelTerrainTexture(width, height));
  } catch (error) {
    // A terrain texture must never be allowed to stop the whole Pixi ticker.
    // In the unlikely case a device refuses the canvas texture, players, loot
    // and projectiles still render over the dark base instead of a blank arena.
    state.failedKey = key;
    if (typeof console !== "undefined") {
      console.warn("Battle Royale terrain texture fallback", error);
    }
  }
}

function safeDestroy(app) {
  try {
    // Keep globally cached background textures alive when switching between
    // Battle Royale, Normal PvP and Zone PvP.
    app?.destroy?.(true, { children: true, texture: false, textureSource: false });
  } catch {
    try {
      app?.destroy?.(true);
    } catch {
      // no-op: unmount must never fail because a browser driver already lost WebGL context
    }
  }
}


function drawCoreHeistObjectives(graphics, objectives, units = []) {
  if (!graphics) return;
  graphics.clear();

  if (!objectives || !Array.isArray(objectives.bases)) {
    graphics.visible = false;
    return;
  }

  graphics.visible = true;
  graphics.eventMode = "none";

  const colorForTeam = (team) => String(team || "cyan") === "orange" ? 0xff4d4d : 0x3d9bff;
  const lightForTeam = (team) => String(team || "cyan") === "orange" ? 0xffc1c1 : 0xcbe9ff;
  const findCarrier = (id) => units.find((unit) => String(unit?.id || "") === String(id || "")) || null;

  // Each base is one static Graphics batch: protected pad, outer perimeter
  // segments and the flag stand. No DOM nodes or per-frame allocations are used.
  for (const base of objectives.bases || []) {
    const team = String(base?.team || "cyan");
    const color = colorForTeam(team);
    const light = lightForTeam(team);
    const x = Number(base?.x || 0);
    const y = Number(base?.y || 0);
    const captureRadius = Math.max(160, Number(base?.radius || 520));
    const perimeterRadius = Math.max(captureRadius + 120, Number(base?.perimeterRadius || 860));

    graphics.circle(x, y, perimeterRadius).fill({ color, alpha: 0.014 });
    graphics.circle(x, y, perimeterRadius).stroke({ color, width: 6, alpha: 0.34 });
    graphics.circle(x, y, captureRadius).fill({ color, alpha: 0.052 });
    graphics.circle(x, y, captureRadius).stroke({ color, width: 10, alpha: 0.52 });
    graphics.circle(x, y, captureRadius - 48).stroke({ color: light, width: 2.2, alpha: 0.33 });
    graphics.circle(x, y, 78).fill({ color: 0x06101d, alpha: 0.92 });
    graphics.circle(x, y, 78).stroke({ color, width: 5, alpha: 0.72 });
    graphics.circle(x, y, 36).fill({ color, alpha: 0.22 });
    graphics.circle(x, y, 18).fill({ color: light, alpha: 0.86 });

    // Eight modular wall blocks make the base perimeter visually obvious even
    // at a wide camera scale, while remaining one lightweight vector batch.
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const bx = x + Math.cos(angle) * perimeterRadius;
      const by = y + Math.sin(angle) * perimeterRadius;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);
      const normalX = Math.cos(angle);
      const normalY = Math.sin(angle);
      const halfLength = 94;
      const halfDepth = 26;
      const points = [
        bx + tangentX * halfLength + normalX * halfDepth,
        by + tangentY * halfLength + normalY * halfDepth,
        bx - tangentX * halfLength + normalX * halfDepth,
        by - tangentY * halfLength + normalY * halfDepth,
        bx - tangentX * halfLength - normalX * halfDepth,
        by - tangentY * halfLength - normalY * halfDepth,
        bx + tangentX * halfLength - normalX * halfDepth,
        by + tangentY * halfLength - normalY * halfDepth,
      ];
      graphics.poly(points).fill({ color: 0x071622, alpha: 0.96 });
      graphics.poly(points).stroke({ color, width: 3.4, alpha: 0.64 });
      graphics.moveTo(bx - tangentX * (halfLength - 14), by - tangentY * (halfLength - 14))
        .lineTo(bx + tangentX * (halfLength - 14), by + tangentY * (halfLength - 14))
        .stroke({ color: light, width: 1.3, alpha: 0.42 });
    }
  }

  for (const flag of objectives.flags || []) {
    const team = String(flag?.team || "cyan");
    const color = colorForTeam(team);
    const light = lightForTeam(team);
    const carrier = String(flag?.status || "") === "carried" ? findCarrier(flag?.carrierId) : null;
    const baseX = Number(carrier?.x ?? flag?.x ?? flag?.homeX ?? 0);
    const baseY = Number(carrier?.y ?? flag?.y ?? flag?.homeY ?? 0);
    const facing = Number(carrier?.moveAngle || 0);
    const carriedOffsetX = carrier ? -Math.cos(facing || 0) * 74 : 0;
    const carriedOffsetY = carrier ? -Math.sin(facing || 0) * 74 : 0;
    const x = baseX + carriedOffsetX;
    const y = baseY + carriedOffsetY;
    const carried = Boolean(carrier);
    const flagHeight = carried ? 70 : 112;
    const flagWidth = carried ? 52 : 78;
    const poleWidth = carried ? 4 : 6;

    if (!carried) {
      graphics.circle(x, y, 62).fill({ color, alpha: String(flag?.status) === "dropped" ? 0.095 : 0.05 });
      graphics.circle(x, y, 58).stroke({ color, width: 3, alpha: 0.42 });
    }
    graphics.moveTo(x, y + flagHeight * 0.5).lineTo(x, y - flagHeight * 0.5).stroke({ color: 0xe8f4ff, width: poleWidth, alpha: 0.86 });
    graphics.circle(x, y - flagHeight * 0.5, carried ? 6 : 8).fill({ color: light, alpha: 0.98 });
    graphics.poly([
      x + 2, y - flagHeight * 0.5 + 7,
      x + flagWidth, y - flagHeight * 0.5 + flagHeight * 0.24,
      x + 2, y - flagHeight * 0.5 + flagHeight * 0.49,
    ]).fill({ color, alpha: 0.94 });
    graphics.poly([
      x + 2, y - flagHeight * 0.5 + 7,
      x + flagWidth, y - flagHeight * 0.5 + flagHeight * 0.24,
      x + 2, y - flagHeight * 0.5 + flagHeight * 0.49,
    ]).stroke({ color: light, width: 1.7, alpha: 0.84 });
  }
}

function PixiArenaRenderer({
  player,
  players = [],
  bots = [],
  simpleBots = [],
  orbs = [],
  energyCells = [],
  cores = [],
  projectiles = [],
  simpleProjectiles = [],
  combatEvents = [],
  // Set by Normal PvP / Zone PvP so combat text is private to this player.
  combatViewerId = null,
  combatEventsPrivate = false,
  cameraX = 0,
  cameraY = 0,
  scale = 1,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720,
  coreTypes = [],
  liveDataRef = null,
  forceLowQuality = false,
  staticItemBudget = null,
  worldWidth = DEFAULT_WORLD_WIDTH,
  worldHeight = DEFAULT_WORLD_HEIGHT,
  safeZoneRadius = null,
  showZone = false,
  // Capture the Flag sends two static bases and two moving flags. This is
  // drawn as one tiny Graphics object and is independent from every mode.
  heistObjectives = null,
  worldTheme = "default",
}) {
  const hostRef = useRef(null);
  const latestRef = useRef(null);

  latestRef.current = {
    player,
    players,
    bots,
    simpleBots,
    orbs,
    energyCells,
    cores,
    projectiles,
    simpleProjectiles,
    combatEvents,
    combatViewerId,
    combatEventsPrivate,
    cameraX,
    cameraY,
    scale,
    viewportWidth,
    viewportHeight,
    worldWidth,
    worldHeight,
    safeZoneRadius,
    showZone,
    heistObjectives,
    worldTheme,
    staticItemBudget,
  };

  useEffect(() => {
    let destroyed = false;
    let app = null;
    let onResize = null;
    let canvas = null;
    let onContextLost = null;
    let onContextRestored = null;

    const setup = async () => {
      if (!hostRef.current) return;

      const config = getRendererConfig(forceLowQuality);
      app = new PIXI.Application();
      const initOptions = {
        width: Math.max(1, hostRef.current.clientWidth || window.innerWidth),
        height: Math.max(1, hostRef.current.clientHeight || window.innerHeight),
        backgroundAlpha: 0,
        antialias: config.antialias,
        resolution: config.resolution,
        autoDensity: true,
        // Menține poziționarea sub-pixel pentru mișcare netedă și muchii mai
        // curate la profilul weak-desktop clarity, fără costul MSAA.
        roundPixels: false,
        powerPreference: "high-performance",
        preference: "webgl",
      };

      if (typeof app.init === "function") {
        await app.init(initOptions);
      } else {
        app = new PIXI.Application(initOptions);
      }

      // Running a weak laptop at 120/144 Hz wastes CPU/GPU time on frames the
      // game does not need. A stable 60 FPS is better than oscillating between
      // 45 and 100, and gameplay/projectile simulation remains display-smooth.
      if (app?.ticker) {
        app.ticker.maxFPS = 60;
        app.ticker.minFPS = 30;
      }

      if (destroyed || !hostRef.current) {
        safeDestroy(app);
        return;
      }

      // Remove a stale canvas left behind by an interrupted browser WebGL
      // restore before attaching the new one.
      hostRef.current.textContent = "";
      canvas = app.canvas || app.view;
      hostRef.current.appendChild(canvas);
      app.stage.eventMode = "none";
      app.stage.interactiveChildren = false;
      // Layers are added once in their final draw order, so per-frame child
      // sorting only wastes CPU on older desktop browsers.
      app.stage.sortableChildren = false;

      const resources = createResources(coreTypes);
      const background = new PIXI.Graphics();
      background.eventMode = "none";
      background.zIndex = 0;

      const world = new PIXI.Container();
      world.eventMode = "none";
      world.interactiveChildren = false;
      // starfield -> terrain -> zone -> items -> projectiles -> entities -> combat
      // are inserted in this exact order below; zIndex sorting is unnecessary.
      world.sortableChildren = false;
      world.zIndex = 1;

      // This lightweight tiled starfield is shown in every mode. It stays
      // separate from the optional detailed terrain so older laptops never lose
      // their space background when the adaptive renderer hides heavy terrain.
      const starfieldLayer = new PIXI.Container();
      starfieldLayer.eventMode = "none";
      starfieldLayer.interactiveChildren = false;
      starfieldLayer.alpha = 1;
      starfieldLayer.zIndex = 1;

      const terrainLayer = new PIXI.Container();
      terrainLayer.eventMode = "none";
      terrainLayer.interactiveChildren = false;
      // The optional Battle Royale terrain sits above the stars and below every
      // gameplay layer. A non-negative zIndex avoids browser/Pixi edge cases
      // after a WebGL context restore.
      terrainLayer.zIndex = 1;

      const zone = new PIXI.Graphics(resources.zoneContext);
      zone.eventMode = "none";
      zone.visible = false;
      zone.zIndex = 2;

      // Objective graphics are only populated by Capture the Flag. One Graphics
      // instance draws its three static platforms and the current core, so no
      // extra React/DOM work occurs while the drone movement loop is running.
      const heistLayer = new PIXI.Graphics();
      heistLayer.eventMode = "none";
      heistLayer.visible = false;
      heistLayer.zIndex = 2;

      const itemsLayer = new PIXI.Container();
      itemsLayer.eventMode = "none";
      itemsLayer.zIndex = 3;
      const projectilesLayer = new PIXI.Container();
      projectilesLayer.eventMode = "none";
      projectilesLayer.zIndex = 4;
      const entitiesLayer = new PIXI.Container();
      entitiesLayer.eventMode = "none";
      entitiesLayer.zIndex = 5;
      const combatLayer = new PIXI.Container();
      combatLayer.eventMode = "none";
      combatLayer.zIndex = 6;

      // Terrain stays underneath. The stars are deliberately added after it:
      // Battle Royale terrain is opaque, so placing stars first hid them fully.
      // Stars remain beneath the zone, pickups, projectiles, drones and text.
      world.addChild(
        terrainLayer,
        starfieldLayer,
        zone,
        heistLayer,
        itemsLayer,
        projectilesLayer,
        entitiesLayer,
        combatLayer,
      );
      app.stage.addChild(background, world);

      const staticMap = new Map();
      const playerPool = [];
      const remotePool = [];
      const botPool = [];
      const simpleBotPool = [];
      const projectilePool = [];
      const simpleProjectilePool = [];
      const combatTextMap = new Map();
      const starfieldState = { key: null, failedKey: null };
      const terrainState = { key: null, failedKey: null };

      // Keep the latest valid local transform briefly. This only protects the
      // local player during a mobile React/socket hand-off; it never invents
      // gameplay state and is cleared immediately when the player is dead.
      let lastRenderableLocalPlayer = null;
      let lastRenderableLocalPlayerAt = 0;

      // Mobile browsers can occasionally lose a WebGL context when changing
      // mode. Prevent the default discard and force terrain/static layers to
      // rebuild from their already-live data after restoration.
      onContextLost = (event) => {
        event?.preventDefault?.();
        starfieldState.key = null;
        starfieldState.failedKey = null;
        terrainState.key = null;
        terrainState.failedKey = null;
        lastStaticSync = 0;
      };
      onContextRestored = () => {
        starfieldState.key = null;
        starfieldState.failedKey = null;
        terrainState.key = null;
        terrainState.failedKey = null;
        lastStaticSync = 0;
      };
      canvas?.addEventListener?.("webglcontextlost", onContextLost, false);
      canvas?.addEventListener?.("webglcontextrestored", onContextRestored, false);

      let lastStaticSync = 0;
      let staticAnimationFrame = 0;
      let lastZoneRadius = null;
      let lastZoneVisible = false;

      // Adaptive visual budgets: weak devices keep the same simulation but
      // progressively trim only far/static visuals when the actual render loop
      // drops below the target frame time. It recovers automatically when the
      // frame budget is healthy again.
      let frameTimeEma = 16.7;
      // Do not let a single long frame flip the visual profile back and forth.
      // That was the visible "background blink" on old laptops: tier 2 hid the
      // terrain, then a short recovery restored it a few hundred milliseconds later.
      let adaptiveTier = 0; // 0 = full, 1 = reduced effects, 2 = strong static trim
      let adaptiveCandidateTier = 0;
      let adaptiveCandidateSince = performance.now();
      let appliedResolutionTier = 0;
      let dynamicResolution = config.resolution;
      let terrainVisibility = null;
      let visualFrameIndex = 0;
      // Reused only inside this mounted Pixi instance. Zone PvP sends already
      // culled arrays, so these avoid building spread-array copies every frame.
      const combinedEntityScratch = [];
      const combinedProjectileScratch = [];

      const setTerrainVisible = (visible) => {
        if (terrainVisibility === visible) return;
        terrainVisibility = visible;
        terrainLayer.visible = visible;
      };

      const getStableAdaptiveTier = () => {
        // Laptopurile slabe păstrează rezoluția clară fixă. Când se apropie
        // de bugetul de 60 FPS, trec mai devreme pe reducerea obiectelor
        // decorative / efectelor, nu pe reducerea rezoluției.
        if (config.weakDesktopClarity) {
          if (adaptiveTier === 0) {
            return frameTimeEma > 18.1 ? 1 : 0;
          }
          if (adaptiveTier === 1) {
            if (frameTimeEma > 20.8) return 2;
            if (frameTimeEma < 16.35) return 0;
            return 1;
          }
          return frameTimeEma < 17.15 ? 1 : 2;
        }

        // Comportament neschimbat pentru telefon și desktop bun.
        if (adaptiveTier === 0) {
          return frameTimeEma > 21.5 ? 1 : 0;
        }
        if (adaptiveTier === 1) {
          if (frameTimeEma > 27.5) return 2;
          if (frameTimeEma < 16.15) return 0;
          return 1;
        }
        return frameTimeEma < 18.2 ? 1 : 2;
      };

      const applyAdaptiveResolution = () => {
        // Laptop/PC slab pornește deja în profilul clar echilibrat. Nu mai
        // micșorăm canvasul în timpul unui meci: aceea era cauza principală
        // pentru imaginea pixelată și pentru mici stutter-uri la resize.
        if (config.weakDesktopClarity) return;
        if (!app?.renderer || !(config.weakMobile || config.forcedMobileQuality)) return;

        // Resolution only steps DOWN during this mounted match. Raising it
        // again causes a renderer resize/stall and was another source of
        // apparent background blinking on integrated GPUs.
        const requestedTier = Math.max(appliedResolutionTier, adaptiveTier);
        if (requestedTier === appliedResolutionTier) return;
        appliedResolutionTier = requestedTier;

        const ratio = config.visualFirstWeakDesktop
          ? (requestedTier === 2 ? 0.72 : requestedTier === 1 ? 0.86 : 1)
          : (requestedTier === 2 ? 0.68 : requestedTier === 1 ? 0.84 : 1);
        const nextResolution = Math.max(0.34, Number((config.resolution * ratio).toFixed(2)));
        if (Math.abs(nextResolution - dynamicResolution) < 0.01) return;

        dynamicResolution = nextResolution;
        app.renderer.resolution = dynamicResolution;
        const width = Math.max(1, hostRef.current?.clientWidth || window.innerWidth);
        const height = Math.max(1, hostRef.current?.clientHeight || window.innerHeight);
        app.renderer.resize(width, height);
      };

      const resize = () => {
        const width = Math.max(1, hostRef.current?.clientWidth || window.innerWidth);
        const height = Math.max(1, hostRef.current?.clientHeight || window.innerHeight);
        app.renderer.resize(width, height);
        drawBackground(background, width, height);
      };

      onResize = resize;
      window.addEventListener("resize", onResize, { passive: true });
      resize();

      app.ticker.add(() => {
        // Arena modes that use a live ref update positions every animation
        // frame. React-only props (such as Core Heist bases/flags) must still
        // be merged in; replacing the whole snapshot with the live ref made
        // objective graphics silently disappear.
        const data = liveDataRef?.current
          ? { ...latestRef.current, ...liveDataRef.current }
          : latestRef.current;
        if (!data) return;

        const now = performance.now();
        const tickMs = Math.min(80, Math.max(1, Number(app.ticker.deltaMS || 16.7)));
        frameTimeEma = frameTimeEma * 0.92 + tickMs * 0.08;

        // Mobile rămâne pe premium permanent: fără downgrade de efecte,
        // drone, proiectile, terrain sau animații în timpul rundei.
        // Desktopul păstrează exact algoritmul adaptiv existent.
        const desiredTier = config.premiumMobile ? 0 : getStableAdaptiveTier();
        if (desiredTier === adaptiveTier) {
          adaptiveCandidateTier = adaptiveTier;
          adaptiveCandidateSince = now;
        } else if (adaptiveCandidateTier !== desiredTier) {
          adaptiveCandidateTier = desiredTier;
          adaptiveCandidateSince = now;
        } else {
          const isTierUp = desiredTier > adaptiveTier;
          const holdMs = isTierUp
            ? (config.weakDesktopClarity ? 700 : 1800)
            : (config.weakDesktopClarity ? 3600 : 5200);
          if (now - adaptiveCandidateSince >= holdMs) {
            adaptiveTier = desiredTier;
            adaptiveCandidateTier = desiredTier;
            adaptiveCandidateSince = now;
            // Static pools converge only when the stable tier changes, never
            // every few frames. This keeps weak-laptop fights smooth.
            lastStaticSync = 0;
            applyAdaptiveResolution();
          }
        }

        const width = Number(data.viewportWidth || hostRef.current?.clientWidth || app.renderer.width || window.innerWidth);
        const height = Number(data.viewportHeight || hostRef.current?.clientHeight || app.renderer.height || window.innerHeight);
        const camera = {
          x: Number(data.cameraX || 0),
          y: Number(data.cameraY || 0),
          scale: Math.max(0.1, Number(data.scale || 1)),
        };

        // Every mode gets this one cached, non-animated starfield. It is a
        // single tiled sprite and remains enabled on phones and weak laptops.
        try {
          syncUniversalStarfield(
            starfieldLayer,
            starfieldState,
            data.worldWidth,
            data.worldHeight,
            forceLowQuality,
          );
        } catch (error) {
          if (typeof console !== "undefined") {
            console.warn("Pixi starfield sync skipped", error);
          }
        }

        // Detailed Battle Royale terrain remains optional. The universal
        // starfield above is separate, so disabling this expensive layer never
        // makes the world go visually empty on a weaker GPU.
        const shouldRenderTerrain = !config.disableExpensiveTerrain;
        setTerrainVisible(shouldRenderTerrain);
        if (shouldRenderTerrain) {
          try {
            syncWorldTerrain(
              terrainLayer,
              terrainState,
              data.worldTheme,
              data.worldWidth,
              data.worldHeight,
            );
          } catch (error) {
            if (typeof console !== "undefined") {
              console.warn("Pixi terrain sync skipped", error);
            }
          }
        }
        setWorldTransform(world, camera.x, camera.y, camera.scale);
        const bounds = getBounds(camera.x, camera.y, camera.scale, width, height, 360);

        // Transform-only pickup pulses. On a weak desktop they run every other
        // rendered frame, which keeps the look but removes dozens of needless
        // property writes per second.
        staticAnimationFrame += 1;
        if (staticAnimationFrame % config.animateStaticEvery === 0) {
          animateStaticPickups(staticMap, now);
        }

        // Root motion stays at the monitor refresh rate. Only decorative
        // children (rotor spins, engine pulse, escort orbit) are stepped on
        // weak desktop hardware. This drastically reduces transform writes
        // without removing any player/bot/drone from the scene.
        visualFrameIndex += 1;
        const remoteDecorEvery = config.visualFirstWeakDesktop
          ? (adaptiveTier >= 2 ? 5 : adaptiveTier === 1 ? 4 : 3)
          : config.lowSpecDesktop || config.weakMobile
            ? (adaptiveTier >= 2 ? 6 : 4)
            : 1;
        const animateRemoteDecor = visualFrameIndex % remoteDecorEvery === 0;

        const zoneRadius = Number(data.safeZoneRadius || 0);
        const shouldShowZone = Boolean(data.showZone && zoneRadius > 0 && zoneRadius < Math.max(Number(data.worldWidth || 0), Number(data.worldHeight || 0)));
        if (shouldShowZone !== lastZoneVisible || Math.abs(zoneRadius - (lastZoneRadius || 0)) > 4) {
          lastZoneVisible = shouldShowZone;
          lastZoneRadius = zoneRadius;
          zone.visible = shouldShowZone;
          if (shouldShowZone) {
            zone.position.set(Number(data.worldWidth || DEFAULT_WORLD_WIDTH) * 0.5, Number(data.worldHeight || DEFAULT_WORLD_HEIGHT) * 0.5);
            zone.scale.set(zoneRadius);
          }
        }

        // Three extraction/vault rings plus one core are trivial compared with
        // a drone mesh. Updating this tiny Graphics object at display cadence
        // keeps a carried core glued to its drone without creating entities.
        drawCoreHeistObjectives(
          heistLayer,
          data.heistObjectives,
          [data.player, ...(data.players || []), ...(data.bots || []), ...(data.simpleBots || [])].filter(Boolean),
        );

        const staticSyncInterval = config.staticSyncInterval;
        if (now - lastStaticSync >= staticSyncInterval) {
          lastStaticSync = now;
          // Normal PvP can request a denser loot budget without changing
          // other game modes. Clamp it to a safe device-specific ceiling.
          const rawStaticItemBudget = data.staticItemBudget;
          const hasRequestedStaticBudget = rawStaticItemBudget !== null && rawStaticItemBudget !== undefined && Number.isFinite(Number(rawStaticItemBudget));
          const requestedStaticBudget = hasRequestedStaticBudget ? Number(rawStaticItemBudget) : null;
          // Zone can request a high desktop budget. Clamp that request on weak
          // integrated GPUs before the static layer is built; models/background
          // stay identical while off-screen/decorative pickups stop consuming
          // the frame budget.
          const staticBudgetCeiling = config.visualFirstWeakDesktop
            ? 58
            : config.lowSpecDesktop
              ? 42
              : 300;
          const baseItemBudget = hasRequestedStaticBudget
            ? clamp(Math.round(requestedStaticBudget), 0, staticBudgetCeiling)
            : config.maxStaticItems;
          const adaptiveItemCap =
            adaptiveTier === 2
              ? Math.min(baseItemBudget, config.visualFirstWeakDesktop ? 48 : config.lowSpecDesktop ? 30 : 48)
              : adaptiveTier === 1
                ? Math.min(baseItemBudget, config.visualFirstWeakDesktop ? 70 : config.lowSpecDesktop ? 38 : 78)
                : baseItemBudget;
          const isCoreHeist = Boolean(data.heistObjectives?.bases?.length);
          // Reserve visible slots for energy cells as well as orbs in Core
          // Heist. This affects the actual Pixi world layer, never the map.
          const coreHeistMinimumBudget = config.weakMobile || config.lowSpecDesktop ? 84 : 210;
          const itemBudget = isCoreHeist
            ? Math.min(staticBudgetCeiling, Math.max(adaptiveItemCap, coreHeistMinimumBudget))
            : adaptiveItemCap;
          const orbBudget = Math.floor(itemBudget * (isCoreHeist ? 0.66 : 0.70));
          const energyBudget = Math.floor(itemBudget * (isCoreHeist ? 0.29 : 0.24));
          const coreBudget = Math.max(2, itemBudget - orbBudget - energyBudget);

          upsertStaticLayer({
            map: staticMap,
            items: data.orbs,
            prefix: "orb",
            contexts: resources.orbContexts,
            parent: itemsLayer,
            now,
            maxItems: orbBudget,
            bounds,
            getContext: (item, contexts) => contexts[item.color] || contexts.cyan,
          });
          upsertStaticLayer({
            map: staticMap,
            items: data.energyCells,
            prefix: "energy",
            contexts: resources,
            parent: itemsLayer,
            now,
            maxItems: energyBudget,
            bounds,
            getContext: () => resources.energyContext,
          });
          upsertStaticLayer({
            map: staticMap,
            items: data.cores,
            prefix: "core",
            contexts: resources.coreContexts,
            parent: itemsLayer,
            now,
            maxItems: coreBudget,
            bounds,
            getContext: (item, contexts) => contexts[item.type] || resources.defaultCoreContext,
          });
        }

        // The live ref can be replaced one frame before the local player field
        // is copied on mobile. Keep the last valid local transform for a short
        // grace window so the own drone never disappears during that hand-off.
        const incomingLocalPlayer = data.player || latestRef.current?.player || null;
        const hasValidIncomingLocalPlayer = Boolean(
          incomingLocalPlayer &&
          incomingLocalPlayer.alive !== false &&
          Number.isFinite(Number(incomingLocalPlayer.x)) &&
          Number.isFinite(Number(incomingLocalPlayer.y)),
        );

        if (hasValidIncomingLocalPlayer) {
          lastRenderableLocalPlayer = incomingLocalPlayer;
          lastRenderableLocalPlayerAt = now;
        } else if (incomingLocalPlayer?.alive === false) {
          lastRenderableLocalPlayer = null;
          lastRenderableLocalPlayerAt = 0;
        }

        const localPlayerFallbackStillFresh = Boolean(
          lastRenderableLocalPlayer &&
          now - lastRenderableLocalPlayerAt <= 2500,
        );
        const playerSource = hasValidIncomingLocalPlayer
          ? [incomingLocalPlayer]
          : localPlayerFallbackStillFresh
            ? [lastRenderableLocalPlayer]
            : [];

        // Player keeps the complete visual treatment. Remote/bot effects scale
        // down only when the actual device profile or adaptive frame budget
        // needs it; gameplay simulation remains untouched.
        // Keep nearby remote drones visually close to desktop quality at tier 0.
        // Effects are removed only after actual frame-time pressure is detected.
        const remoteEffectTier = adaptiveTier;
        syncUnitPool({
          pool: playerPool,
          source: playerSource,
          resources,
          parent: entitiesLayer,
          bounds,
          max: 1,
          now,
          isPlayer: true,
          animateDecor: true,
          preCulled: Boolean(data.zonePreCulled),
        });
        const fullUnitCap = adaptiveTier === 2
          ? Math.min(config.maxPlayers, config.visualFirstWeakDesktop ? 3 : config.lowSpecDesktop || config.weakMobile ? 2 : 3)
          : adaptiveTier === 1
            ? Math.min(config.maxPlayers, config.visualFirstWeakDesktop ? 4 : config.lowSpecDesktop || config.weakMobile ? 3 : 5)
            : config.maxPlayers;
        const fullRemoteIds = syncUnitPool({
          pool: remotePool,
          source: data.players,
          resources,
          parent: entitiesLayer,
          bounds,
          max: fullUnitCap,
          now,
          compact: adaptiveTier > 0,
          effectTier: remoteEffectTier,
          animateDecor: animateRemoteDecor,
          preCulled: Boolean(data.zonePreCulled),
        });
        const fullBotIds = syncUnitPool({
          pool: botPool,
          source: data.bots,
          resources,
          parent: entitiesLayer,
          bounds,
          max: fullUnitCap,
          now,
          compact: adaptiveTier > 0,
          effectTier: remoteEffectTier,
          animateDecor: animateRemoteDecor,
          preCulled: Boolean(data.zonePreCulled),
        });
        const fullEntityIds = data.zonePreCulled ? null : new Set([...fullRemoteIds, ...fullBotIds]);
        let simpleEntitySource;
        if (data.zonePreCulled) {
          simpleEntitySource = data.simpleBots || [];
        } else {
          combinedEntityScratch.length = 0;
          for (const unit of data.players || []) combinedEntityScratch.push(unit);
          for (const unit of data.bots || []) combinedEntityScratch.push(unit);
          for (const unit of data.simpleBots || []) combinedEntityScratch.push(unit);
          simpleEntitySource = combinedEntityScratch;
        }
        syncSimplePool({
          pool: simpleBotPool,
          // Zone's client already partitions detailed and simple entities.
          source: simpleEntitySource,
          resources,
          parent: entitiesLayer,
          bounds,
          max: config.maxSimplePlayers,
          now,
          excludeIds: fullEntityIds,
          animateDecor: animateRemoteDecor,
          preCulled: Boolean(data.zonePreCulled),
        });
        const fullProjectileCap = adaptiveTier === 2
          ? Math.min(config.maxProjectiles, config.visualFirstWeakDesktop ? 5 : config.lowSpecDesktop || config.weakMobile ? 2 : 3)
          : adaptiveTier === 1
            ? Math.min(config.maxProjectiles, config.visualFirstWeakDesktop ? 8 : config.lowSpecDesktop || config.weakMobile ? 3 : 5)
            : config.maxProjectiles;
        const fullProjectileIds = syncProjectilePool({
          pool: projectilePool,
          source: data.projectiles,
          resources,
          parent: projectilesLayer,
          bounds,
          max: fullProjectileCap,
          now,
          compact: adaptiveTier > 0,
          preCulled: Boolean(data.zonePreCulled),
        });
        if (data.zonePreCulled) {
          combinedProjectileScratch.length = 0;
          for (const projectile of data.simpleProjectiles || []) combinedProjectileScratch.push(projectile);
        } else {
          combinedProjectileScratch.length = 0;
          for (const projectile of data.projectiles || []) combinedProjectileScratch.push(projectile);
          for (const projectile of data.simpleProjectiles || []) combinedProjectileScratch.push(projectile);
        }
        syncProjectilePool({
          pool: simpleProjectilePool,
          source: combinedProjectileScratch,
          resources,
          parent: projectilesLayer,
          bounds,
          max: config.maxSimpleProjectiles,
          now,
          compact: true,
          simple: true,
          excludeIds: fullProjectileIds,
          preCulled: Boolean(data.zonePreCulled),
        });
        // Normal PvP and Zone PvP request strict private combat text. In this
        // mode an event must explicitly belong to the local player. Other
        // renderer modes keep their own existing combat-event behavior.
        const resolvedCombatViewerId =
          data?.combatViewerId || data?.player?.id || data?.you?.id || null;
        const resolvedCombatViewerKey = resolvedCombatViewerId
          ? String(resolvedCombatViewerId)
          : "";
        const combatSource = data.combatEvents || [];
        const visibleCombatEvents = data?.combatEventsPrivate
          ? combatSource
          : combatSource.filter(
              (event) =>
                !event?.viewerId ||
                !resolvedCombatViewerKey ||
                String(event.viewerId) === resolvedCombatViewerKey,
            );
        syncCombatTextLayer({
          map: combatTextMap,
          source: visibleCombatEvents,
          resources,
          parent: combatLayer,
          bounds,
          now,
          forceVisible: Boolean(data?.combatEventsPrivate),
        });
      });
    };

    setup();

    return () => {
      destroyed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      if (canvas && onContextLost) canvas.removeEventListener?.("webglcontextlost", onContextLost, false);
      if (canvas && onContextRestored) canvas.removeEventListener?.("webglcontextrestored", onContextRestored, false);
      safeDestroy(app);
      if (hostRef.current) hostRef.current.textContent = "";
    };
  }, [coreTypes, forceLowQuality, liveDataRef]);

  return <div ref={hostRef} className="pixi-arena-layer" aria-hidden="true" />;
}

export default PixiArenaRenderer;