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
const ADVENTURE_DEEP_SPACE_THEME = "adventure-deep-space";
// Battle Royale keeps the legacy name; Normal / Zone use the explicit alias.
// Adventure uses its own procedural background, but it shares the same safe
// cached terrain lifecycle so it never flashes while panning the huge world.
const SPACE_BATTLE_THEMES = new Set([
  PIXEL_TERRAIN_THEME,
  "premium-space-battle",
  ADVENTURE_DEEP_SPACE_THEME,
]);
const WORLD_TERRAIN_TEXTURE_CACHE = new Map();
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

function createDroneContext(colors) {
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

  return ctx;
}

function createMiniDroneContext(colors) {
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


// Adventure mode uses only these opt-in arrays. Existing PvE/PvP modes leave
// them empty, so their renderer path and visuals stay untouched.
const ADVENTURE_STAR_COLORS = {
  cyan: 0x72edff,
  gold: 0xffdf76,
  violet: 0xc9a4ff,
  mint: 0x8cffc4,
};

const ADVENTURE_ASTEROID_CONTEXT_CACHE = new Map();

function createAdventureStarContext(color) {
  const ctx = new PIXI.GraphicsContext();
  const points = [];
  const outer = 21;
  const inner = 8.5;

  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? outer : inner;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  ctx.circle(0, 0, 28).fill({ color, alpha: 0.07 });
  ctx.circle(0, 0, 23).stroke({ color, width: 1.5, alpha: 0.18 });
  ctx.poly(points).fill({ color, alpha: 0.96 });
  ctx.poly(points).stroke({ color: 0xffffff, width: 1.25, alpha: 0.72 });
  ctx.circle(-5, -7, 4.3).fill({ color: 0xffffff, alpha: 0.78 });
  ctx.circle(0, 0, 12.5).stroke({ color: 0xffffff, width: 0.9, alpha: 0.34 });
  return ctx;
}

function createAdventureAsteroidContext(tone = 0) {
  const normalizedTone = Math.max(0, Math.min(3, Math.floor(Number(tone || 0))));
  const cacheKey = String(normalizedTone);

  if (ADVENTURE_ASTEROID_CONTEXT_CACHE.has(cacheKey)) {
    return ADVENTURE_ASTEROID_CONTEXT_CACHE.get(cacheKey);
  }

  // Layered mineral palettes: deep shadow, basalt body, sunlit ridges,
  // cold dust and a small amount of luminous ore exposed by each strike.
  const palettes = [
    [0x202a33, 0x425867, 0x7f99a5, 0xc7e0e6, 0x77e7ff],
    [0x2b2830, 0x574e60, 0x947f9c, 0xe3d0eb, 0xd592ff],
    [0x30271e, 0x635044, 0xa98c69, 0xe2c59b, 0xffca78],
    [0x18312f, 0x365d59, 0x77aaa0, 0xc9eee4, 0x72ffd1],
  ];
  const [deep, body, ridge, dust, ore] = palettes[normalizedTone];
  const ctx = new PIXI.GraphicsContext();

  const outer = [
    -78, -16,
    -63, -55,
    -27, -78,
    16, -70,
    60, -45,
    81, -7,
    67, 36,
    31, 75,
    -18, 79,
    -62, 47,
    -83, 14,
  ];
  const bodyShape = [
    -72, -13,
    -58, -50,
    -25, -70,
    14, -63,
    53, -39,
    72, -6,
    58, 31,
    26, 66,
    -17, 70,
    -55, 42,
    -75, 12,
  ];

  // Soft halo + an offset shadow make the rock feel thick rather than flat.
  ctx.circle(4, 7, 92).fill({ color: 0x00060b, alpha: 0.18 });
  ctx.poly(outer).fill({ color: deep, alpha: 0.98 });
  ctx.poly(outer).stroke({ color: 0x050b10, width: 7.5, alpha: 0.76 });
  ctx.poly(bodyShape).fill({ color: body, alpha: 1 });

  // Faceted faces: these act as procedural texture and create a hard-rock
  // silhouette even without external image assets.
  ctx.poly([-58, -50, -25, -70, -7, -21, -39, -8]).fill({ color: ridge, alpha: 0.30 });
  ctx.poly([-7, -21, 14, -63, 53, -39, 26, -5]).fill({ color: ridge, alpha: 0.18 });
  ctx.poly([26, -5, 72, -6, 58, 31, 13, 28]).fill({ color: deep, alpha: 0.28 });
  ctx.poly([-39, -8, -7, -21, 13, 28, -21, 45, -56, 18]).fill({ color: 0x6a7880, alpha: 0.13 });
  ctx.poly([-21, 45, 13, 28, 58, 31, 26, 66, -17, 70]).fill({ color: deep, alpha: 0.34 });
  ctx.poly([-75, 12, -56, 18, -21, 45, -55, 42]).fill({ color: 0x101d25, alpha: 0.38 });

  // Weathered ridges and mineral seams.
  ctx.poly([-60, -39, -39, -48, -14, -39, 8, -50]).stroke({ color: dust, width: 2.2, alpha: 0.25 });
  ctx.poly([7, -52, 21, -32, 47, -24, 58, -5]).stroke({ color: ridge, width: 1.8, alpha: 0.24 });
  ctx.poly([-67, 13, -42, 7, -17, 16, 11, 7, 41, 12]).stroke({ color: dust, width: 1.4, alpha: 0.15 });
  ctx.poly([-33, 56, -7, 43, 24, 52, 47, 33]).stroke({ color: ridge, width: 2.1, alpha: 0.20 });

  // Craters: dark bowls, thin lit rims and a tiny dust highlight.
  const craters = [
    [-30, -25, 16, 0.78],
    [29, -1, 20, 0.72],
    [-6, 34, 12, 0.64],
    [44, 34, 8, 0.58],
  ];
  for (const [x, y, radius, alpha] of craters) {
    ctx.circle(x, y, radius).fill({ color: deep, alpha });
    ctx.circle(x - 2.5, y - 3.5, radius * 0.72).fill({ color: 0x091116, alpha: 0.34 });
    ctx.circle(x - 1.5, y - 2, radius * 0.86).stroke({ color: dust, width: 1.45, alpha: 0.22 });
    ctx.circle(x - radius * 0.34, y - radius * 0.38, Math.max(1.6, radius * 0.14)).fill({ color: dust, alpha: 0.25 });
  }

  // Granular speckles, intentionally static/cached so they do not cost the frame.
  const grains = [
    [-49, -13, 3.2], [-42, 30, 2.4], [-17, -55, 2.8], [3, -42, 2.1],
    [17, 51, 2.7], [52, -24, 2.4], [62, 11, 1.8], [-4, 58, 1.9],
    [-58, 6, 1.7], [10, 12, 1.45], [38, -47, 1.65], [-24, 60, 1.8],
  ];
  for (const [x, y, radius] of grains) {
    ctx.circle(x, y, radius).fill({ color: dust, alpha: 0.16 });
  }

  // Asteroids keep their natural rock texture after hits. The impact burst and
  // detached debris happen around the boulder, without drawing glowing fissures on it.

  // Crisp upper-left light catches the outline like a real rotating boulder.
  ctx.poly([-58, -50, -25, -70, 14, -63, 53, -39]).stroke({ color: dust, width: 3.2, alpha: 0.48 });
  ctx.poly([72, -6, 58, 31, 26, 66]).stroke({ color: deep, width: 3.8, alpha: 0.62 });

  ADVENTURE_ASTEROID_CONTEXT_CACHE.set(cacheKey, ctx);
  return ctx;
}

function createAdventureAsteroidImpactContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 26).fill({ color: 0xffffff, alpha: 0.86 });
  ctx.circle(0, 0, 42).stroke({ color: 0xffd28d, width: 2.6, alpha: 0.86 });
  ctx.circle(0, 0, 64).stroke({ color: 0xff9c5d, width: 1.5, alpha: 0.54 });
  ctx.poly([0, -74, 8, -17, 74, 0, 8, 17, 0, 74, -8, 17, -74, 0, -8, -17]).fill({ color: 0xffc073, alpha: 0.24 });
  return ctx;
}

const ADVENTURE_DEBRIS_CONTEXT_CACHE = new Map();

function createAdventureDebrisContext(tone = 0, variant = 0, sparkle = false) {
  const key = `${tone}:${variant}:${sparkle ? 1 : 0}`;
  if (ADVENTURE_DEBRIS_CONTEXT_CACHE.has(key)) return ADVENTURE_DEBRIS_CONTEXT_CACHE.get(key);

  const palettes = [
    [0x202a33, 0x526b79, 0xc7e0e6, 0x77e7ff],
    [0x2b2830, 0x695d72, 0xe3d0eb, 0xd592ff],
    [0x30271e, 0x725b48, 0xe2c59b, 0xffca78],
    [0x18312f, 0x48766f, 0xc9eee4, 0x72ffd1],
  ];
  const [deep, body, light, ore] = palettes[Math.max(0, Math.min(3, Number(tone || 0)))];
  const ctx = new PIXI.GraphicsContext();
  const variants = [
    [-1, -0.7, 1, -0.48, 0.76, 0.9, -0.63, 0.65],
    [-0.9, -0.82, 0.96, -0.2, 0.57, 0.92, -0.74, 0.52],
    [-0.72, -0.96, 0.86, -0.58, 0.98, 0.5, 0.2, 0.98, -0.82, 0.42],
    [-0.98, -0.18, -0.3, -0.88, 0.9, -0.42, 0.72, 0.76, -0.45, 0.92],
  ];
  const points = variants[Math.max(0, Math.min(3, Number(variant || 0)))];
  ctx.poly(points).fill({ color: deep, alpha: 0.92 });
  ctx.poly(points.map((point, index) => point * (index % 2 === 0 ? 0.8 : 0.8))).fill({ color: body, alpha: 0.86 });
  ctx.poly(points).stroke({ color: light, width: 0.12, alpha: 0.50 });
  if (sparkle) {
    ctx.circle(-0.12, -0.18, 0.22).fill({ color: ore, alpha: 0.92 });
    ctx.circle(-0.12, -0.18, 0.46).stroke({ color: ore, width: 0.08, alpha: 0.46 });
  }
  ADVENTURE_DEBRIS_CONTEXT_CACHE.set(key, ctx);
  return ctx;
}

// Adventure structures are opt-in and never run in PvE/PvP. The wall now reads
// as a true deep-space military bulkhead: armored graphite plating, heavy side
// pylons, recessed vents, warm white status strips and subtle animated beacons.
const ADVENTURE_WALL_CONTEXT_CACHE = new Map();
const ADVENTURE_WALL_BASE_LENGTH = 480;
// The build footprint is deliberately slimmer than the original station block.
// Collision uses the same thinner profile in Adventure.jsx.
const ADVENTURE_WALL_VISUAL_DEPTH_SCALE = 0.66;

function createAdventureWallShellContext(mode = "placed", snapped = false) {
  const preview = mode === "preview";
  const key = `shell:${preview ? "preview" : "placed"}:${snapped ? 1 : 0}`;
  if (ADVENTURE_WALL_CONTEXT_CACHE.has(key)) return ADVENTURE_WALL_CONTEXT_CACHE.get(key);

  const outer = preview ? (snapped ? 0x223a36 : 0x202d35) : 0x131a21;
  const body = preview ? (snapped ? 0x425a54 : 0x42505a) : 0x36424c;
  const plate = preview ? (snapped ? 0x5b746b : 0x586873) : 0x586773;
  const dark = 0x0b1117;
  const edge = preview ? (snapped ? 0xd4fff0 : 0xd8e8ef) : 0xa4b5bf;
  const highlight = preview ? (snapped ? 0xf1fff8 : 0xf3f8fb) : 0xd9e2e8;
  const alpha = preview ? (snapped ? 0.80 : 0.62) : 1;
  const ctx = new PIXI.GraphicsContext();
  const half = ADVENTURE_WALL_BASE_LENGTH * 0.5;

  // Wide starbase foundation — read as a building wall, not a thin rail.
  const foundation = [
    -half - 14, -56,
    -half + 18, -96,
    half - 18, -96,
    half + 14, -56,
    half + 14, 56,
    half - 18, 96,
    -half + 18, 96,
    -half - 14, 56,
  ];
  ctx.poly(foundation).fill({ color: 0x000000, alpha: preview ? 0.14 : 0.30 });
  ctx.poly(foundation).stroke({ color: edge, width: 4.4, alpha: preview ? 0.48 : 0.78 });

  const shell = [
    -half + 4, -46,
    -half + 30, -80,
    half - 30, -80,
    half - 4, -46,
    half - 4, 46,
    half - 30, 80,
    -half + 30, 80,
    -half + 4, 46,
  ];
  ctx.poly(shell).fill({ color: outer, alpha });
  ctx.poly(shell).stroke({ color: 0x212b33, width: 2.6, alpha: preview ? 0.44 : 0.82 });

  // Three broad armored station bays. Their size gives a proper defensive-base silhouette.
  const bays = [-150, 0, 150];
  bays.forEach((centerX, bayIndex) => {
    const bayWidth = bayIndex === 1 ? 126 : 116;
    const x = centerX - bayWidth * 0.5;
    const bay = [
      x + 16, -58,
      x + bayWidth - 16, -58,
      x + bayWidth, -42,
      x + bayWidth, 42,
      x + bayWidth - 16, 58,
      x + 16, 58,
      x, 42,
      x, -42,
    ];
    ctx.poly(bay).fill({ color: body, alpha });
    ctx.poly(bay).stroke({ color: edge, width: 2.1, alpha: preview ? 0.28 : 0.46 });

    // Layered roof/armor shape, facing up from the top-down camera.
    ctx.poly([
      x + 18, -50,
      x + bayWidth - 18, -50,
      x + bayWidth - 30, -24,
      x + 30, -24,
    ]).fill({ color: plate, alpha: preview ? 0.38 : 0.92 });
    ctx.poly([
      x + 24, 24,
      x + bayWidth - 24, 24,
      x + bayWidth - 36, 47,
      x + 36, 47,
    ]).fill({ color: 0x222d36, alpha: preview ? 0.38 : 0.94 });

    // Central recessed hangar / blast-door block.
    ctx.roundRect(x + 22, -17, bayWidth - 44, 34, 8).fill({ color: dark, alpha: preview ? 0.56 : 1 });
    ctx.roundRect(x + 26, -13, bayWidth - 52, 26, 6).stroke({ color: highlight, width: 1.25, alpha: preview ? 0.16 : 0.20 });
    ctx.poly([
      x + 34, -9,
      x + bayWidth - 34, -9,
      x + bayWidth - 44, 0,
      x + bayWidth - 34, 9,
      x + 34, 9,
      x + 44, 0,
    ]).fill({ color: 0x19232b, alpha: preview ? 0.46 : 0.90 });

    // Mechanical roof vents / panels.
    [-1, 1].forEach((side) => {
      const ventY = side < 0 ? -38 : 36;
      for (let i = 0; i < 3; i += 1) {
        const ventX = x + 25 + i * ((bayWidth - 50) / 2);
        ctx.roundRect(ventX, ventY, 16, 5.5, 2.5).fill({ color: 0x10171d, alpha: preview ? 0.50 : 0.86 });
      }
    });

    // Outer braces make the modules look bolted into a larger station.
    ctx.poly([x + 6, -32, x + 27, -14, x + 18, 8, x + 5, -2]).fill({ color: plate, alpha: preview ? 0.26 : 0.68 });
    ctx.poly([x + bayWidth - 6, 32, x + bayWidth - 27, 14, x + bayWidth - 18, -8, x + bayWidth - 5, 2]).fill({ color: plate, alpha: preview ? 0.26 : 0.68 });
  });

  // Thick perimeter buttresses at both connection ends. These are visually strong but not wheel-like.
  [-half, half].forEach((x, index) => {
    const inward = index === 0 ? 1 : -1;
    ctx.poly([
      x - 12, -70,
      x + inward * 30, -52,
      x + inward * 40, -18,
      x + inward * 40, 18,
      x + inward * 30, 52,
      x - 12, 70,
      x - inward * 26, 42,
      x - inward * 26, -42,
    ]).fill({ color: 0x232f38, alpha: preview ? 0.52 : 1 });
    ctx.poly([
      x - 12, -70,
      x + inward * 30, -52,
      x + inward * 40, -18,
      x + inward * 40, 18,
      x + inward * 30, 52,
      x - 12, 70,
      x - inward * 26, 42,
      x - inward * 26, -42,
    ]).stroke({ color: edge, width: 2.6, alpha: preview ? 0.42 : 0.70 });
    ctx.roundRect(x - 13, -25, 26, 50, 7).fill({ color: 0x11191f, alpha: preview ? 0.62 : 1 });
    ctx.roundRect(x - 10, -21, 20, 42, 5).stroke({ color: highlight, width: 1.1, alpha: preview ? 0.18 : 0.24 });
  });

  // Long defensive top/bottom rails with subtle angular cut-outs.
  ctx.poly([-half + 42, -75, half - 42, -75, half - 66, -61, -half + 66, -61]).fill({ color: 0x4a5863, alpha: preview ? 0.28 : 0.74 });
  ctx.poly([-half + 66, 61, half - 66, 61, half - 42, 75, -half + 42, 75]).fill({ color: 0x202a32, alpha: preview ? 0.30 : 0.90 });
  ctx.poly([-half + 60, -68, half - 60, -68]).stroke({ color: highlight, width: 1.1, alpha: preview ? 0.12 : 0.18 });

  ADVENTURE_WALL_CONTEXT_CACHE.set(key, ctx);
  return ctx;
}

function createAdventureWallLightContext(mode = "placed", snapped = false) {
  const preview = mode === "preview";
  const key = `light:${preview ? "preview" : "placed"}:${snapped ? 1 : 0}`;
  if (ADVENTURE_WALL_CONTEXT_CACHE.has(key)) return ADVENTURE_WALL_CONTEXT_CACHE.get(key);

  const amber = preview ? (snapped ? 0xd9fff0 : 0xe4edf6) : 0xffca81;
  const white = preview ? 0xf5fbff : 0xfff8e9;
  const red = preview ? (snapped ? 0xbaffdf : 0xdce8ee) : 0xff826a;
  const ctx = new PIXI.GraphicsContext();
  const half = ADVENTURE_WALL_BASE_LENGTH * 0.5;

  // Thin warm command lights embedded in the three blast-door bays.
  [-150, 0, 150].forEach((centerX, bayIndex) => {
    const width = bayIndex === 1 ? 126 : 116;
    [-22, 0, 22].forEach((offset, lightIndex) => {
      const color = lightIndex === 1 ? white : amber;
      ctx.roundRect(centerX + offset - 4.2, -2.8, 8.4, 5.6, 2.8).fill({ color, alpha: preview ? 0.34 : 0.42 });
    });
  });

  // Navigation beacons only — no cyan strips.
  [-205, -120, -40, 40, 120, 205].forEach((x, index) => {
    const color = index % 2 === 0 ? amber : red;
    ctx.circle(x, -72, 3.6).fill({ color, alpha: preview ? 0.30 : 0.46 });
    ctx.circle(x, -72, 8.6).stroke({ color, width: 0.9, alpha: preview ? 0.16 : 0.16 });
  });

  // Docking lights at the ends, used as subtle visual snap endpoints.
  [-half, half].forEach((x) => {
    ctx.roundRect(x - 3.2, -14, 6.4, 28, 3.2).fill({ color: white, alpha: preview ? 0.34 : 0.40 });
    ctx.circle(x, 0, 10).stroke({ color: amber, width: 1.15, alpha: preview ? 0.20 : 0.20 });
  });

  ADVENTURE_WALL_CONTEXT_CACHE.set(key, ctx);
  return ctx;
}

function createAdventureWallSweepContext(mode = "placed", snapped = false) {
  const preview = mode === "preview";
  const key = `sweep:${preview ? "preview" : "placed"}:${snapped ? 1 : 0}`;
  if (ADVENTURE_WALL_CONTEXT_CACHE.has(key)) return ADVENTURE_WALL_CONTEXT_CACHE.get(key);

  const warm = preview ? (snapped ? 0xe8fff7 : 0xeaf3ff) : 0xffe3a6;
  const ctx = new PIXI.GraphicsContext();
  // Narrow scan glint travelling through the center gate. It is intentionally
  // subtle, so the wall feels powered without turning into a neon prop.
  ctx.poly([-28, -35, 4, -35, 30, 0, 4, 35, -28, 35, -8, 0]).fill({ color: warm, alpha: preview ? 0.09 : 0.075 });
  ctx.roundRect(-3, -42, 6, 84, 3).fill({ color: warm, alpha: preview ? 0.30 : 0.24 });
  ADVENTURE_WALL_CONTEXT_CACHE.set(key, ctx);
  return ctx;
}

function createAdventureWallShieldContext() {
  const ctx = new PIXI.GraphicsContext();
  const hex = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    hex.push(Math.cos(angle) * 34, Math.sin(angle) * 34);
  }

  ctx.circle(0, 0, 18).fill({ color: 0x5df2ff, alpha: 0.15 });
  ctx.circle(0, 0, 26).stroke({ color: 0x9af8ff, width: 2.6, alpha: 0.92 });
  ctx.poly(hex).stroke({ color: 0x59dfff, width: 2.2, alpha: 0.86 });
  ctx.circle(0, 0, 42).stroke({ color: 0xa57cff, width: 1.4, alpha: 0.52 });
  ctx.moveTo(-54, 0).lineTo(54, 0).stroke({ color: 0xe9ffff, width: 1.25, alpha: 0.62 });
  ctx.moveTo(0, -54).lineTo(0, 54).stroke({ color: 0x72eaff, width: 1.1, alpha: 0.46 });
  return ctx;
}

function createAdventureWallDamageContext(level = 0) {
  const safeLevel = Math.max(0, Math.min(4, Math.floor(Number(level || 0))));
  const ctx = new PIXI.GraphicsContext();
  if (safeLevel <= 0) return ctx;

  // This layer deliberately covers and removes large armor sections. It is not
  // a cosmetic scratch pass: each step makes the station segment read as less
  // structurally intact while the collision footprint remains stable.
  const voidBlack = 0x05080b;
  const innerMetal = 0x111920;
  const char = 0x1c252d;
  const brokenEdge = 0x84919a;
  const exposed = 0x4d5962;
  const ember = 0xffa45f;

  // Stage 1 (81–60 HP): obvious cratered armor and a partially torn bay.
  ctx.poly([
    -178, -47,
    -134, -58,
    -98, -38,
    -112, -8,
    -148, -2,
    -184, -18,
  ]).fill({ color: char, alpha: 0.94 });
  ctx.poly([
    -172, -43,
    -137, -51,
    -108, -35,
    -119, -13,
    -149, -8,
    -174, -20,
  ]).fill({ color: voidBlack, alpha: 0.82 });
  ctx.poly([-176, -44, -145, -25, -119, -29, -99, -10]).stroke({ color: brokenEdge, width: 2.4, alpha: 0.52 });
  ctx.poly([-116, 15, -76, 6, -58, 22, -96, 38, -130, 30]).fill({ color: innerMetal, alpha: 0.72 });
  ctx.poly([-118, 15, -92, 0, -61, 20, -92, 38]).stroke({ color: 0x070a0d, width: 4.0, alpha: 0.62 });
  ctx.circle(-142, -27, 4.5).fill({ color: ember, alpha: 0.40 });

  if (safeLevel >= 2) {
    // Stage 2 (59–36 HP): left command bay is visibly blown open.
    ctx.poly([
      -214, -34,
      -182, -66,
      -116, -52,
      -86, -22,
      -100, 28,
      -150, 48,
      -204, 24,
    ]).fill({ color: voidBlack, alpha: 0.96 });
    ctx.poly([
      -202, -30,
      -178, -56,
      -126, -45,
      -103, -19,
      -115, 20,
      -153, 37,
      -192, 18,
    ]).fill({ color: innerMetal, alpha: 0.94 });
    ctx.poly([
      -204, -31,
      -177, -57,
      -125, -45,
      -101, -17,
      -116, 21,
      -153, 38,
      -191, 18,
    ]).stroke({ color: brokenEdge, width: 3.0, alpha: 0.62 });
    // Jagged edge / missing roof plates.
    ctx.poly([-165, -67, -137, -46, -150, -23, -180, -38]).fill({ color: exposed, alpha: 0.66 });
    ctx.poly([-104, 30, -130, 48, -159, 38, -143, 12]).fill({ color: exposed, alpha: 0.58 });
    ctx.poly([-184, -10, -151, 4, -166, 22, -192, 10]).fill({ color: 0x080d11, alpha: 0.86 });
    ctx.circle(-145, -27, 6.2).fill({ color: ember, alpha: 0.46 });
    ctx.circle(-126, 17, 3.8).fill({ color: ember, alpha: 0.32 });
  }

  if (safeLevel >= 3) {
    // Stage 3 (35–16 HP): central gate collapses. A huge dark breach is much
    // more readable than cracks, especially while the wall is viewed zoomed out.
    ctx.poly([
      -78, -42,
      -36, -58,
      34, -51,
      82, -22,
      72, 24,
      32, 50,
      -42, 44,
      -90, 17,
    ]).fill({ color: voidBlack, alpha: 0.97 });
    ctx.poly([
      -70, -34,
      -33, -48,
      27, -42,
      67, -18,
      60, 19,
      25, 40,
      -35, 35,
      -76, 12,
    ]).fill({ color: 0x0f171e, alpha: 0.92 });
    ctx.poly([
      -75, -35,
      -35, -49,
      28, -42,
      67, -18,
      60, 20,
      25, 40,
      -35, 35,
      -77, 12,
    ]).stroke({ color: brokenEdge, width: 3.2, alpha: 0.68 });
    // Hanging broken armor, leaving strong non-uniform silhouette inside.
    ctx.poly([-57, -44, -20, -28, -31, -2, -69, -15]).fill({ color: exposed, alpha: 0.72 });
    ctx.poly([18, 41, 54, 19, 42, -7, 5, 8]).fill({ color: exposed, alpha: 0.66 });
    ctx.poly([-10, -3, 23, -3, 42, 15, 3, 22]).fill({ color: 0x06090c, alpha: 0.92 });
    ctx.circle(-31, -20, 5.0).fill({ color: ember, alpha: 0.40 });
    ctx.circle(35, 16, 4.4).fill({ color: ember, alpha: 0.35 });
  }

  if (safeLevel >= 4) {
    // Stage 4 (15–1 HP): right bay and both rails are breaking apart. The wall
    // should look one volley away from collapse, not merely worn.
    ctx.poly([
      88, -50,
      148, -61,
      207, -33,
      218, 11,
      186, 49,
      126, 43,
      82, 10,
    ]).fill({ color: voidBlack, alpha: 0.98 });
    ctx.poly([
      96, -42,
      147, -51,
      196, -28,
      205, 8,
      179, 39,
      132, 33,
      91, 7,
    ]).fill({ color: innerMetal, alpha: 0.92 });
    ctx.poly([
      89, -50,
      148, -62,
      208, -33,
      219, 11,
      185, 50,
      126, 43,
      81, 10,
    ]).stroke({ color: brokenEdge, width: 3.6, alpha: 0.72 });
    // Rails are ruptured so the entire segment visibly loses its clean shape.
    ctx.poly([72, -78, 128, -78, 154, -61, 104, -57]).fill({ color: voidBlack, alpha: 0.94 });
    ctx.poly([-210, 63, -146, 64, -116, 47, -175, 42]).fill({ color: voidBlack, alpha: 0.94 });
    ctx.poly([114, 43, 145, 20, 169, 33, 146, 58]).fill({ color: exposed, alpha: 0.70 });
    ctx.poly([160, -48, 190, -30, 177, -6, 145, -20]).fill({ color: exposed, alpha: 0.68 });
    ctx.poly([76, -10, 124, 8, 146, 29, 96, 20]).fill({ color: 0x05080b, alpha: 0.90 });
    ctx.circle(155, -22, 6.8).fill({ color: ember, alpha: 0.42 });
    ctx.circle(177, 19, 4.0).fill({ color: ember, alpha: 0.30 });
  }

  return ctx;
}
function createAdventureWallSmokeParticleContext(radius = 18) {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, radius).fill({ color: 0x0d1014, alpha: 0.44 });
  ctx.circle(radius * 0.35, -radius * 0.12, radius * 0.74).fill({ color: 0x151a20, alpha: 0.28 });
  ctx.circle(-radius * 0.28, radius * 0.2, radius * 0.58).fill({ color: 0x000000, alpha: 0.18 });
  return ctx;
}

function createAdventureWallFireParticleContext(size = 16, variant = 0) {
  const ctx = new PIXI.GraphicsContext();
  const lean = [-0.34, -0.16, 0.14, 0.32][Math.max(0, Math.min(3, Number(variant || 0)))];
  const tipX = size * lean;

  // Soft ember glow at the breach. It remains stable and only breathes through
  // transform/alpha, so the fire reads as a sustained burn rather than blinking.
  ctx.ellipse(0, size * 0.30, size * 0.95, size * 0.62).fill({ color: 0x7d190b, alpha: 0.18 });
  ctx.ellipse(0, size * 0.24, size * 0.68, size * 0.46).fill({ color: 0xff5b1f, alpha: 0.22 });

  // Outer dark-red flame envelope.
  ctx.poly([
    tipX, -size * 1.24,
    size * 0.50, -size * 0.32,
    size * 0.42, size * 0.36,
    size * 0.12, size * 0.94,
    -size * 0.22, size * 0.82,
    -size * 0.50, size * 0.16,
    -size * 0.36, -size * 0.38,
  ]).fill({ color: 0x9a250d, alpha: 0.78 });

  // Main orange tongue.
  ctx.poly([
    tipX * 0.72, -size * 0.98,
    size * 0.30, -size * 0.22,
    size * 0.23, size * 0.31,
    0, size * 0.70,
    -size * 0.21, size * 0.22,
    -size * 0.26, -size * 0.26,
  ]).fill({ color: 0xff6b24, alpha: 0.94 });

  // Bright inner core, deliberately lower than the outer tip.
  ctx.poly([
    tipX * 0.30, -size * 0.52,
    size * 0.14, -size * 0.05,
    size * 0.10, size * 0.29,
    0, size * 0.50,
    -size * 0.10, size * 0.20,
    -size * 0.13, -size * 0.08,
  ]).fill({ color: 0xffd26a, alpha: 0.92 });
  ctx.circle(0, size * 0.27, size * 0.13).fill({ color: 0xfff1be, alpha: 0.90 });

  return ctx;
}

function createAdventureGeneratorBaseContext() {
  const ctx = new PIXI.GraphicsContext();
  const outerDark = 0x070b10;
  const armor = 0x121b25;
  const plate = 0x1d2b36;
  const edge = 0x657786;
  const coldEdge = 0x9bb1bf;

  // Heavy, dark octagonal station foundation.
  ctx.circle(0, 0, 318).fill({ color: 0x000000, alpha: 0.28 });
  ctx.poly([
    -148, -266,
    148, -266,
    266, -148,
    266, 148,
    148, 266,
    -148, 266,
    -266, 148,
    -266, -148,
  ]).fill({ color: outerDark, alpha: 1 });
  ctx.poly([
    -148, -266,
    148, -266,
    266, -148,
    266, 148,
    148, 266,
    -148, 266,
    -266, 148,
    -266, -148,
  ]).stroke({ color: coldEdge, width: 5.6, alpha: 0.74 });

  // Eight armored sectors that make the generator feel like a real base module.
  for (let index = 0; index < 8; index += 1) {
    const a = (Math.PI * 2 * index) / 8 - Math.PI / 8;
    const b = a + Math.PI / 4;
    const m = (a + b) * 0.5;
    const innerA = 98;
    const innerB = 118;
    const outerA = 238;
    const outerB = 248;
    ctx.poly([
      Math.cos(a) * innerA, Math.sin(a) * innerA,
      Math.cos(a) * outerA, Math.sin(a) * outerA,
      Math.cos(m) * outerB, Math.sin(m) * outerB,
      Math.cos(b) * outerA, Math.sin(b) * outerA,
      Math.cos(b) * innerB, Math.sin(b) * innerB,
      Math.cos(m) * 108, Math.sin(m) * 108,
    ]).fill({ color: index % 2 ? armor : plate, alpha: 0.98 });
    ctx.poly([
      Math.cos(a) * innerA, Math.sin(a) * innerA,
      Math.cos(a) * outerA, Math.sin(a) * outerA,
      Math.cos(m) * outerB, Math.sin(m) * outerB,
      Math.cos(b) * outerA, Math.sin(b) * outerA,
      Math.cos(b) * innerB, Math.sin(b) * innerB,
      Math.cos(m) * 108, Math.sin(m) * 108,
    ]).stroke({ color: edge, width: 2.2, alpha: 0.56 });
  }

  // Central reactor housing and reinforced service rails.
  ctx.circle(0, 0, 126).fill({ color: 0x050a0f, alpha: 1 });
  ctx.circle(0, 0, 126).stroke({ color: 0x718796, width: 4.2, alpha: 0.74 });
  ctx.circle(0, 0, 98).fill({ color: 0x0c1821, alpha: 1 });
  ctx.circle(0, 0, 98).stroke({ color: 0x2e4c5c, width: 3, alpha: 0.9 });

  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5;
    const x = Math.cos(angle) * 190;
    const y = Math.sin(angle) * 190;
    ctx.roundRect(-34, -16, 68, 32, 12).fill({ color: 0x17232d, alpha: 1 });
    ctx.roundRect(-34, -16, 68, 32, 12).stroke({ color: 0x7890a0, width: 2.4, alpha: 0.58 });
    ctx.roundRect(-18, -7, 36, 14, 6).fill({ color: 0x05090e, alpha: 0.96 });
    ctx.roundRect(-14, -3, 28, 6, 3).fill({ color: 0x28c8e9, alpha: 0.44 });
    // Local coordinates are rotated by the outer loop by applying a temporary transform through a container later,
    // so only radial bolt placements are drawn here with explicit coordinates.
    ctx.circle(x, y, 18).fill({ color: 0x0b1118, alpha: 1 });
    ctx.circle(x, y, 12).stroke({ color: 0x5b7383, width: 2.2, alpha: 0.65 });
  }

  // Angular top plates, bolt rows and service grilles.
  for (const axis of [-1, 1]) {
    ctx.roundRect(axis * 142 - 28, -72, 56, 144, 9).fill({ color: 0x0b1219, alpha: 0.92 });
    ctx.roundRect(axis * 142 - 24, -64, 48, 128, 7).stroke({ color: 0x4f6270, width: 2, alpha: 0.54 });
    for (const y of [-43, -21, 0, 21, 43]) {
      ctx.roundRect(axis * 142 - 14, y - 4, 28, 8, 4).fill({ color: 0x233743, alpha: 0.82 });
    }
  }
  return ctx;
}

function createAdventureGeneratorCoreContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 92).fill({ color: 0x061c2b, alpha: 1 });
  ctx.circle(0, 0, 92).stroke({ color: 0x77efff, width: 5.2, alpha: 0.9 });
  ctx.circle(0, 0, 66).fill({ color: 0x008fc1, alpha: 0.46 });
  ctx.circle(0, 0, 44).fill({ color: 0x32e7ff, alpha: 0.56 });
  ctx.circle(0, 0, 25).fill({ color: 0xc7ffff, alpha: 0.96 });
  ctx.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.98 });

  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI * 2 * index) / 6;
    const x = Math.cos(angle) * 109;
    const y = Math.sin(angle) * 109;
    const tx = Math.cos(angle) * 45;
    const ty = Math.sin(angle) * 45;
    ctx.poly([tx, ty, x - Math.sin(angle) * 12, y + Math.cos(angle) * 12, x + Math.sin(angle) * 12, y - Math.cos(angle) * 12])
      .fill({ color: index % 2 ? 0x46f2ff : 0x9dffe4, alpha: 0.64 });
  }
  return ctx;
}

function createAdventureGeneratorRingContext(radius = 138, alpha = 0.36, segments = 16) {
  const ctx = new PIXI.GraphicsContext();
  const gap = 0.16;
  for (let index = 0; index < segments; index += 1) {
    const start = (Math.PI * 2 * index) / segments + gap;
    const end = (Math.PI * 2 * (index + 1)) / segments - gap;
    const steps = 10;
    let lastX = Math.cos(start) * radius;
    let lastY = Math.sin(start) * radius;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const angle = start + (end - start) * t;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      ctx.moveTo(lastX, lastY).lineTo(x, y).stroke({ color: 0x73eaff, width: 6.2, alpha });
      lastX = x;
      lastY = y;
    }
  }
  return ctx;
}

function createAdventureGeneratorLightContext() {
  const ctx = new PIXI.GraphicsContext();
  for (let index = 0; index < 24; index += 1) {
    const angle = (Math.PI * 2 * index) / 24;
    const radius = index % 2 ? 238 : 194;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const color = index % 4 === 0 ? 0xffb25e : 0x73f2ff;
    ctx.circle(x, y, index % 4 === 0 ? 5.3 : 4.1).fill({ color, alpha: 0.93 });
    ctx.circle(x, y, 1.9).fill({ color: 0xffffff, alpha: 0.96 });
  }
  for (const x of [-92, -46, 0, 46, 92]) {
    ctx.roundRect(x - 8, -7, 16, 14, 6).fill({ color: 0x79f4ff, alpha: 0.68 });
  }
  return ctx;
}

function createAdventureGeneratorDamageContext(level = 0) {
  const ctx = new PIXI.GraphicsContext();
  if (level <= 0) return ctx;
  const alpha = Math.min(1, 0.26 + level * 0.16);
  const crack = 0xaebcc5;
  ctx.poly([-44, -196, -18, -116, -38, -48, -10, 4, -28, 92]).stroke({ color: crack, width: 5, alpha });
  ctx.poly([36, -162, 14, -88, 42, -18, 18, 72, 44, 152]).stroke({ color: crack, width: 5, alpha });
  if (level >= 2) {
    ctx.poly([-202, -34, -130, -6, -76, -28, -16, -2]).stroke({ color: crack, width: 4.5, alpha: alpha * 0.94 });
    ctx.poly([-150, 118, -82, 142, -26, 124]).stroke({ color: crack, width: 4.5, alpha: alpha * 0.86 });
  }
  if (level >= 3) {
    ctx.poly([120, -112, 186, -68, 210, -10]).stroke({ color: crack, width: 5.2, alpha });
    ctx.poly([118, 42, 186, 78, 204, 138]).stroke({ color: crack, width: 5.2, alpha });
  }
  return ctx;
}

function createAdventureGeneratorEngineContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.poly([-30, -56, 30, -56, 48, -24, 48, 42, 26, 68, -26, 68, -48, 42, -48, -24])
    .fill({ color: 0x101820, alpha: 1 });
  ctx.poly([-30, -56, 30, -56, 48, -24, 48, 42, 26, 68, -26, 68, -48, 42, -48, -24])
    .stroke({ color: 0x8297a6, width: 3.2, alpha: 0.74 });
  ctx.roundRect(-28, -38, 56, 54, 10).fill({ color: 0x1e303d, alpha: 0.96 });
  ctx.roundRect(-20, -28, 40, 26, 8).fill({ color: 0x070e14, alpha: 1 });
  ctx.circle(0, -15, 17).fill({ color: 0x02070b, alpha: 1 });
  ctx.circle(0, -15, 12).stroke({ color: 0x5fdcf0, width: 2.4, alpha: 0.76 });
  ctx.roundRect(-26, 20, 52, 23, 7).fill({ color: 0x0a1219, alpha: 0.98 });
  ctx.roundRect(-18, 27, 36, 7, 3).fill({ color: 0xffb864, alpha: 0.74 });
  return ctx;
}

function createAdventureGeneratorEngineRotorContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 21).fill({ color: 0x07121a, alpha: 1 });
  ctx.circle(0, 0, 21).stroke({ color: 0x8cecff, width: 2.1, alpha: 0.62 });
  for (let index = 0; index < 5; index += 1) {
    const angle = (Math.PI * 2 * index) / 5;
    const x = Math.cos(angle) * 13;
    const y = Math.sin(angle) * 13;
    ctx.poly([0, 0, x + Math.cos(angle + 1.22) * 7, y + Math.sin(angle + 1.22) * 7, x + Math.cos(angle - 0.28) * 5, y + Math.sin(angle - 0.28) * 5])
      .fill({ color: 0x5e8799, alpha: 0.78 });
  }
  ctx.circle(0, 0, 5).fill({ color: 0xc1ffff, alpha: 0.94 });
  return ctx;
}

function createAdventureGeneratorEngineExhaustContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.poly([-20, 45, 20, 45, 34, 126, 0, 174, -34, 126]).fill({ color: 0x23dfff, alpha: 0.33 });
  ctx.poly([-12, 49, 12, 49, 20, 112, 0, 144, -20, 112]).fill({ color: 0xbfffff, alpha: 0.82 });
  return ctx;
}

function createAdventureGeneratorEngineVisual(angle, distance) {
  const root = new PIXI.Container();
  root.eventMode = "none";
  root.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance);
  root.rotation = angle - Math.PI * 0.5;
  const exhaust = new PIXI.Graphics(createAdventureGeneratorEngineExhaustContext());
  exhaust.blendMode = "screen";
  const shell = new PIXI.Graphics(createAdventureGeneratorEngineContext());
  const rotor = new PIXI.Graphics(createAdventureGeneratorEngineRotorContext());
  rotor.position.set(0, -15);
  const light = new PIXI.Graphics();
  light.circle(0, 26, 16).fill({ color: 0xffcf7e, alpha: 0.26 });
  light.blendMode = "screen";
  root.addChild(exhaust, shell, rotor, light);
  return { root, exhaust, rotor, light, phase: Math.random() * Math.PI * 2 };
}

function createAdventureGeneratorSmokeVisual() {
  const smokeContainer = new PIXI.Container();
  smokeContainer.eventMode = "none";
  const smoke = [];
  const anchors = [
    { x: -116, y: -210 },
    { x: -42, y: -244 },
    { x: 42, y: -244 },
    { x: 116, y: -210 },
    { x: -198, y: -92 },
    { x: 198, y: -92 },
  ];
  for (let index = 0; index < 20; index += 1) {
    const radius = 20 + (index % 5) * 6;
    const node = new PIXI.Graphics(createAdventureWallSmokeParticleContext(radius));
    node.visible = false;
    smokeContainer.addChild(node);
    smoke.push({
      node,
      anchor: anchors[index % anchors.length],
      phase: Math.random() * Math.PI * 2,
      lift: 108 + (index % 6) * 28,
      sway: 12 + (index % 4) * 8,
      delay: index * 0.11,
    });
  }
  return { smokeContainer, smoke };
}

function createAdventureGeneratorVisual() {
  const root = new PIXI.Container();
  root.eventMode = "none";
  const halo = new PIXI.Graphics();
  halo.circle(0, 0, 316).fill({ color: 0x1ddcff, alpha: 0.055 });
  halo.blendMode = "screen";
  const ringOuter = new PIXI.Graphics(createAdventureGeneratorRingContext(286, 0.23, 20));
  const ringInner = new PIXI.Graphics(createAdventureGeneratorRingContext(174, 0.32, 12));
  ringOuter.blendMode = "screen";
  ringInner.blendMode = "screen";
  const base = new PIXI.Graphics(createAdventureGeneratorBaseContext());
  const core = new PIXI.Graphics(createAdventureGeneratorCoreContext());
  core.blendMode = "screen";
  const lights = new PIXI.Graphics(createAdventureGeneratorLightContext());
  lights.blendMode = "screen";
  const damage = new PIXI.Graphics(createAdventureGeneratorDamageContext(0));
  const smokePack = createAdventureGeneratorSmokeVisual();
  const engines = [];
  const engineLayer = new PIXI.Container();
  engineLayer.eventMode = "none";
  for (let index = 0; index < 4; index += 1) {
    const engine = createAdventureGeneratorEngineVisual(index * Math.PI * 0.5, 255);
    engineLayer.addChild(engine.root);
    engines.push(engine);
  }
  root.addChild(halo, ringOuter, base, ringInner, engineLayer, damage, smokePack.smokeContainer, core, lights);
  return {
    root,
    halo,
    ringOuter,
    ringInner,
    base,
    core,
    lights,
    damage,
    engineLayer,
    engines,
    smokeContainer: smokePack.smokeContainer,
    smokeParticles: smokePack.smoke,
    phase: Math.random() * Math.PI * 2,
    damageLevel: 0,
    integrity: 1,
  };
}

function syncAdventureGenerator(visual, item, parent) {
  if (!item) {
    if (visual?.root) visual.root.visible = false;
    return visual;
  }
  let next = visual;
  if (!next) {
    next = createAdventureGeneratorVisual();
    parent.addChild(next.root);
  }
  const maxHp = Math.max(1, Number(item.maxHp || 1000));
  const hp = Math.max(0, Number(item.hp ?? maxHp));
  const integrity = clamp(hp / maxHp, 0, 1);
  const damageLevel = integrity <= 0.12 ? 4 : integrity <= 0.32 ? 3 : integrity <= 0.58 ? 2 : integrity <= 0.82 ? 1 : 0;
  if (next.damageLevel !== damageLevel) {
    next.damageLevel = damageLevel;
    next.damage.context = createAdventureGeneratorDamageContext(damageLevel);
  }
  next.integrity = integrity;
  next.root.position.set(Number(item.x || 0), Number(item.y || 0));
  next.root.visible = true;
  next.root.alpha = 1;
  return next;
}

function createAdventureDefenseTowerBaseContext(preview = false) {
  const ctx = new PIXI.GraphicsContext();
  const hull = preview ? 0x1d6078 : 0x101b23;
  const armor = preview ? 0x315f74 : 0x263844;
  const panel = preview ? 0x173f52 : 0x17262f;
  const edge = preview ? 0xc7ffff : 0xb7c9d5;
  const cyan = preview ? 0x9effff : 0x65e9f7;
  const amber = preview ? 0xffe1a7 : 0xffbd70;

  ctx.circle(0, 0, 178).fill({ color: 0x000000, alpha: preview ? 0.12 : 0.30 });

  // Heavy top-down starbase deck.
  ctx.poly([
    -112, -102, -52, -132, 52, -132, 112, -102,
    138, -42, 138, 42, 112, 102, 52, 132,
    -52, 132, -112, 102, -138, 42, -138, -42,
  ]).fill({ color: hull, alpha: preview ? 0.78 : 1 });
  ctx.poly([
    -112, -102, -52, -132, 52, -132, 112, -102,
    138, -42, 138, 42, 112, 102, 52, 132,
    -52, 132, -112, 102, -138, 42, -138, -42,
  ]).stroke({ color: edge, width: 3.6, alpha: preview ? 0.78 : 0.82 });

  ctx.poly([
    -84, -78, -36, -104, 36, -104, 84, -78,
    104, -32, 104, 32, 84, 78, 36, 104,
    -36, 104, -84, 78, -104, 32, -104, -32,
  ]).fill({ color: armor, alpha: 0.98 });
  ctx.poly([
    -84, -78, -36, -104, 36, -104, 84, -78,
    104, -32, 104, 32, 84, 78, 36, 104,
    -36, 104, -84, 78, -104, 32, -104, -32,
  ]).stroke({ color: 0x6f8691, width: 2.0, alpha: 0.46 });

  // Four service pods make the base read as a genuine turret installation.
  const drawServicePod = (x, y, vertical = false) => {
    const width = vertical ? 42 : 70;
    const height = vertical ? 70 : 42;
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 12).fill({ color: 0x14232d, alpha: 1 });
    ctx.roundRect(x - width / 2 + 6, y - height / 2 + 6, width - 12, height - 12, 9).fill({ color: panel, alpha: 0.94 });
    if (vertical) {
      for (const offset of [-15, 0, 15]) {
        ctx.roundRect(x - 11, y + offset - 4, 22, 8, 3).fill({ color: 0x0a1319, alpha: 0.96 });
      }
    } else {
      for (const offset of [-15, 0, 15]) {
        ctx.roundRect(x + offset - 4, y - 11, 8, 22, 3).fill({ color: 0x0a1319, alpha: 0.96 });
      }
    }
  };
  drawServicePod(0, -103, true);
  drawServicePod(0, 103, true);
  drawServicePod(-105, 0, false);
  drawServicePod(105, 0, false);

  // Central armored swivel deck.
  ctx.circle(0, 0, 68).fill({ color: 0x0a1218, alpha: 1 });
  ctx.circle(0, 0, 68).stroke({ color: 0x86eefa, width: 3.2, alpha: preview ? 0.76 : 0.56 });
  ctx.circle(0, 0, 52).fill({ color: 0x182933, alpha: 1 });
  ctx.circle(0, 0, 38).fill({ color: 0x071016, alpha: 1 });
  ctx.circle(0, 0, 26).stroke({ color: cyan, width: 3.1, alpha: 0.72 });

  // Small defensive lamps around the outer hull.
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const radius = 122;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    ctx.circle(x, y, 4.1).fill({ color: index % 2 ? cyan : amber, alpha: 0.84 });
  }

  return ctx;
}

function createAdventureDefenseTowerTurretContext(preview = false) {
  const ctx = new PIXI.GraphicsContext();
  const housing = preview ? 0x3b788c : 0x29414d;
  const housingDark = preview ? 0x254f61 : 0x172832;
  const edge = preview ? 0xd8ffff : 0xc4d8e0;
  const cyan = preview ? 0xa4ffff : 0x6ceeff;

  // Rotating turret body seen from directly above.
  ctx.circle(0, 0, 48).fill({ color: 0x0b141a, alpha: 1 });
  ctx.circle(0, 0, 48).stroke({ color: edge, width: 3.0, alpha: 0.72 });
  ctx.circle(0, 0, 29).fill({ color: housing, alpha: 0.98 });
  ctx.circle(0, 0, 16).fill({ color: 0x071016, alpha: 1 });
  ctx.circle(0, 0, 8).fill({ color: cyan, alpha: 0.95 });

  // Two enormous laser barrels, with a gap between them.
  for (const y of [-17, 17]) {
    ctx.roundRect(22, y - 9, 120, 18, 7).fill({ color: housingDark, alpha: 1 });
    ctx.roundRect(43, y - 5, 116, 10, 4).fill({ color: housing, alpha: 0.98 });
    ctx.roundRect(130, y - 10, 42, 20, 6).fill({ color: 0x081116, alpha: 1 });
    ctx.roundRect(144, y - 4, 29, 8, 3).fill({ color: cyan, alpha: preview ? 0.86 : 0.72 });
  }

  // Side armor shoulders and cable collars.
  ctx.poly([-38, -38, -3, -47, 21, -28, 21, 28, -3, 47, -38, 38, -58, 18, -58, -18])
    .fill({ color: housing, alpha: preview ? 0.84 : 1 });
  ctx.poly([-38, -38, -3, -47, 21, -28, 21, 28, -3, 47, -38, 38, -58, 18, -58, -18])
    .stroke({ color: edge, width: 2.5, alpha: 0.68 });
  for (const y of [-24, 0, 24]) {
    ctx.roundRect(-48, y - 5, 28, 10, 4).fill({ color: 0x0a151b, alpha: 0.92 });
  }

  return ctx;
}

function createAdventureDefenseTowerRingContext() {
  const ctx = new PIXI.GraphicsContext();
  for (let index = 0; index < 14; index += 1) {
    const start = (Math.PI * 2 * index) / 14 + 0.075;
    const end = (Math.PI * 2 * (index + 1)) / 14 - 0.12;
    const radius = 132;
    ctx.moveTo(Math.cos(start) * radius, Math.sin(start) * radius)
      .lineTo(Math.cos(end) * radius, Math.sin(end) * radius)
      .stroke({ color: index % 2 ? 0x54e8ff : 0xb9fff4, width: 3.3, alpha: 0.36 });
  }
  return ctx;
}

function createAdventureDefenseTowerLaserContext() {
  const ctx = new PIXI.GraphicsContext();
  // Brief twin laser flash that becomes bright exactly while the turret fires.
  for (const y of [-17, 17]) {
    ctx.roundRect(166, y - 3.3, 118, 6.6, 3.2).fill({ color: 0x37dbff, alpha: 0.52 });
    ctx.roundRect(168, y - 1.35, 118, 2.7, 1.3).fill({ color: 0xf2ffff, alpha: 0.96 });
    ctx.circle(170, y, 10).fill({ color: 0x83f4ff, alpha: 0.48 });
  }
  return ctx;
}

function createAdventureDefenseTowerVisual(preview = false) {
  const root = new PIXI.Container();
  root.eventMode = "none";

  const halo = new PIXI.Graphics();
  halo.circle(0, 0, 188).fill({ color: 0x1edfff, alpha: preview ? 0.10 : 0.055 });
  halo.blendMode = "screen";

  const base = new PIXI.Graphics(createAdventureDefenseTowerBaseContext(preview));
  const ring = new PIXI.Graphics(createAdventureDefenseTowerRingContext());
  ring.blendMode = "screen";

  const turret = new PIXI.Container();
  const turretBody = new PIXI.Graphics(createAdventureDefenseTowerTurretContext(preview));
  const laser = new PIXI.Graphics(createAdventureDefenseTowerLaserContext());
  laser.alpha = preview ? 0.24 : 0.045;
  laser.blendMode = "screen";
  const muzzle = new PIXI.Graphics();
  muzzle.circle(173, -17, 18).fill({ color: 0x5aeaff, alpha: 0.08 });
  muzzle.circle(173, 17, 18).fill({ color: 0x5aeaff, alpha: 0.08 });
  muzzle.blendMode = "screen";
  turret.addChild(turretBody, laser, muzzle);

  const lights = new PIXI.Graphics();
  for (const x of [-74, -46, -16, 16, 46, 74]) {
    lights.circle(x, -92, 3.3).fill({ color: 0xa8ffff, alpha: 0.82 });
    lights.circle(x, 92, 2.9).fill({ color: 0xffc879, alpha: 0.62 });
  }
  lights.blendMode = "screen";

  root.addChild(halo, base, ring, turret, lights);
  return {
    root,
    halo,
    base,
    ring,
    turret,
    turretBody,
    muzzle,
    laser,
    lights,
    preview,
    phase: Math.random() * Math.PI * 2,
    targetRotation: 0,
    recoilUntil: 0,
    lastSeenAt: 0,
  };
}

function createAdventureKraniumTowerBaseContext(preview = false) {
  const ctx = new PIXI.GraphicsContext();
  const outer = preview ? 0x512f74 : 0x150d22;
  const armor = preview ? 0x3b234f : 0x271633;
  const panel = preview ? 0x573672 : 0x43245e;
  const edge = preview ? 0xffdfff : 0xd5b4eb;
  const cyan = preview ? 0x9cfff0 : 0x77eee3;
  const magenta = preview ? 0xffa0f5 : 0xff86ed;

  ctx.circle(0, 0, 198).fill({ color: 0x000000, alpha: preview ? 0.12 : 0.30 });

  // A dark, multi-bay crystal refinery rather than a flat crystal icon.
  ctx.poly([
    -118, -108, -54, -142, 54, -142, 118, -108,
    146, -46, 146, 46, 118, 108, 54, 142,
    -54, 142, -118, 108, -146, 46, -146, -46,
  ]).fill({ color: outer, alpha: preview ? 0.80 : 1 });
  ctx.poly([
    -118, -108, -54, -142, 54, -142, 118, -108,
    146, -46, 146, 46, 118, 108, 54, 142,
    -54, 142, -118, 108, -146, 46, -146, -46,
  ]).stroke({ color: edge, width: 3.7, alpha: preview ? 0.78 : 0.78 });

  ctx.poly([
    -90, -82, -40, -110, 40, -110, 90, -82,
    112, -32, 112, 32, 90, 82, 40, 110,
    -40, 110, -90, 82, -112, 32, -112, -32,
  ]).fill({ color: armor, alpha: 1 });
  ctx.poly([
    -90, -82, -40, -110, 40, -110, 90, -82,
    112, -32, 112, 32, 90, 82, 40, 110,
    -40, 110, -90, 82, -112, 32, -112, -32,
  ]).stroke({ color: 0x845fa4, width: 2.0, alpha: 0.48 });

  // Cardinal extraction modules: compressor, condenser, and pipe bays.
  const drawBay = (x, y, vertical) => {
    const w = vertical ? 44 : 74;
    const h = vertical ? 74 : 44;
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 12).fill({ color: 0x1a1224, alpha: 1 });
    ctx.roundRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 9).fill({ color: panel, alpha: 0.92 });
    if (vertical) {
      for (const offset of [-18, 0, 18]) {
        ctx.roundRect(x - 12, y + offset - 4, 24, 8, 3).fill({ color: 0x090b12, alpha: 0.96 });
      }
    } else {
      for (const offset of [-18, 0, 18]) {
        ctx.roundRect(x + offset - 4, y - 12, 8, 24, 3).fill({ color: 0x090b12, alpha: 0.96 });
      }
    }
    ctx.circle(x, y, 5).fill({ color: vertical ? cyan : magenta, alpha: 0.92 });
  };
  drawBay(0, -113, true);
  drawBay(0, 113, true);
  drawBay(-115, 0, false);
  drawBay(115, 0, false);

  // Central containment bed and four industrial clamping arms.
  ctx.circle(0, 0, 73).fill({ color: 0x0b0913, alpha: 1 });
  ctx.circle(0, 0, 73).stroke({ color: 0xb987e5, width: 3.2, alpha: 0.60 });
  ctx.circle(0, 0, 52).fill({ color: 0x1b1026, alpha: 1 });
  ctx.circle(0, 0, 34).fill({ color: 0x080a10, alpha: 1 });

  for (const [x, y, width, height] of [
    [0, -66, 28, 52], [0, 66, 28, 52], [-66, 0, 52, 28], [66, 0, 52, 28],
  ]) {
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 8).fill({ color: 0x2e1a42, alpha: 1 });
    ctx.roundRect(x - width / 2 + 5, y - height / 2 + 5, width - 10, height - 10, 6).fill({ color: 0x6d4d95, alpha: 0.74 });
  }

  // Crystal canisters make the purpose readable at a glance.
  for (const [x, y, color] of [
    [-98, -68, cyan], [98, -68, magenta], [-98, 68, magenta], [98, 68, cyan],
  ]) {
    ctx.roundRect(x - 10, y - 17, 20, 34, 7).fill({ color: 0x1a1025, alpha: 1 });
    ctx.roundRect(x - 5, y - 11, 10, 22, 4).fill({ color, alpha: 0.70 });
  }

  return ctx;
}

function createAdventureKraniumTowerCoilContext() {
  const ctx = new PIXI.GraphicsContext();
  for (let index = 0; index < 16; index += 1) {
    const start = (Math.PI * 2 * index) / 16 + 0.07;
    const end = (Math.PI * 2 * (index + 1)) / 16 - 0.12;
    const radius = 140;
    ctx.moveTo(Math.cos(start) * radius, Math.sin(start) * radius)
      .lineTo(Math.cos(end) * radius, Math.sin(end) * radius)
      .stroke({ color: index % 2 ? 0xff8ef2 : 0x84fff0, width: 3.8, alpha: 0.40 });
  }
  return ctx;
}

function createAdventureKraniumTowerOrbitContext(radiusX, radiusY, color, alpha, width) {
  const ctx = new PIXI.GraphicsContext();
  const steps = 96;
  let previousX = null;
  let previousY = null;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    if (previousX !== null) {
      ctx.moveTo(previousX, previousY).lineTo(x, y).stroke({ color, width, alpha });
    }
    previousX = x;
    previousY = y;
  }
  return ctx;
}

function createAdventureKraniumTowerPipeContext() {
  const ctx = new PIXI.GraphicsContext();
  const pipe = 0x604585;
  const inner = 0x85f8ef;
  const paths = [
    [[0, -102], [0, -78], [-18, -56], [-18, -32]],
    [[0, 102], [0, 78], [18, 56], [18, 32]],
    [[-102, 0], [-78, 0], [-56, 18], [-32, 18]],
    [[102, 0], [78, 0], [56, -18], [32, -18]],
  ];
  for (const path of paths) {
    for (let index = 0; index < path.length - 1; index += 1) {
      const [x1, y1] = path[index];
      const [x2, y2] = path[index + 1];
      ctx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: pipe, width: 8, alpha: 0.95 });
      ctx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: inner, width: 2.2, alpha: 0.60 });
    }
  }
  return ctx;
}

function createAdventureKraniumCrystalShardContext(color, accent) {
  const ctx = new PIXI.GraphicsContext();
  ctx.poly([0, -48, 18, -16, 12, 24, 0, 48, -12, 24, -18, -16]).fill({ color, alpha: 0.94 });
  ctx.poly([0, -48, 18, -16, 12, 24, 0, 48, -12, 24, -18, -16]).stroke({ color: 0xfff4ff, width: 2.1, alpha: 0.88 });
  ctx.poly([0, -43, 7, -14, 0, 33, -7, -14]).fill({ color: accent, alpha: 0.34 });
  return ctx;
}

function createAdventureKraniumTowerVisual(preview = false) {
  const root = new PIXI.Container();
  root.eventMode = "none";

  const halo = new PIXI.Graphics();
  halo.circle(0, 0, 208).fill({ color: 0xd451ff, alpha: preview ? 0.12 : 0.075 });
  halo.blendMode = "screen";

  const base = new PIXI.Graphics(createAdventureKraniumTowerBaseContext(preview));
  const pipes = new PIXI.Graphics(createAdventureKraniumTowerPipeContext());
  const coil = new PIXI.Graphics(createAdventureKraniumTowerCoilContext());
  coil.blendMode = "screen";

  const orbitA = new PIXI.Graphics(createAdventureKraniumTowerOrbitContext(108, 29, 0x8affee, 0.68, 3.6));
  orbitA.blendMode = "screen";
  const orbitB = new PIXI.Graphics(createAdventureKraniumTowerOrbitContext(132, 48, 0xdc73ff, 0.52, 2.7));
  orbitB.rotation = -0.52;
  orbitB.blendMode = "screen";

  const crystal = new PIXI.Container();
  crystal.eventMode = "none";
  const chamber = new PIXI.Graphics();
  chamber.circle(0, 0, 40).fill({ color: 0x5f2a96, alpha: 0.22 });
  chamber.circle(0, 0, 40).stroke({ color: 0xe5a4ff, width: 2.4, alpha: 0.62 });
  chamber.blendMode = "screen";
  crystal.addChild(chamber);

  const shards = [
    { x: 0, y: -16, r: 0, c: 0xd786ff, a: 0xffffff },
    { x: 17, y: 9, r: 2.20, c: 0x8dfff0, a: 0xe8ffff },
    { x: -17, y: 9, r: -2.20, c: 0xb86cff, a: 0xffffff },
  ];
  for (const shardData of shards) {
    const shard = new PIXI.Graphics(createAdventureKraniumCrystalShardContext(shardData.c, shardData.a));
    shard.position.set(shardData.x, shardData.y);
    shard.rotation = shardData.r;
    shard.blendMode = "screen";
    crystal.addChild(shard);
  }

  const lights = new PIXI.Graphics();
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18;
    const x = Math.cos(angle) * 143;
    const y = Math.sin(angle) * 143;
    lights.circle(x, y, 3.5).fill({ color: index % 2 ? 0x8bfff0 : 0xff8cf1, alpha: 0.86 });
  }
  lights.blendMode = "screen";

  root.addChild(halo, base, pipes, coil, orbitA, orbitB, crystal, lights);
  return {
    root,
    halo,
    base,
    pipes,
    coil,
    orbitA,
    orbitB,
    crystal,
    lights,
    preview,
    phase: Math.random() * Math.PI * 2,
    lastSeenAt: 0,
  };
}

function syncAdventureDefenseTowers(map, items, parent, bounds, now, maxItems = 160) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;
  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 180)) continue;
    const key = String(item.id || `${Math.round(item.x)}:${Math.round(item.y)}`);
    active.add(key);
    let visual = map.get(key);
    if (!visual) {
      visual = createAdventureDefenseTowerVisual(false);
      parent.addChild(visual.root);
      map.set(key, visual);
    }
    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.targetRotation = Number(item.rotation || 0);
    visual.recoilUntil = Number(item.recoilUntil || 0);
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }
  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 12) {
      visual.root.destroy({ children: true });
      map.delete(key);
    }
  }
}

function syncAdventureKraniumTowers(map, items, parent, bounds, now, maxItems = 120) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;
  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 190)) continue;
    const key = String(item.id || `${Math.round(item.x)}:${Math.round(item.y)}`);
    active.add(key);
    let visual = map.get(key);
    if (!visual) {
      visual = createAdventureKraniumTowerVisual(false);
      parent.addChild(visual.root);
      map.set(key, visual);
    }
    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }
  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 12) {
      visual.root.destroy({ children: true });
      map.delete(key);
    }
  }
}

function syncAdventureTowerPreview(visual, item, parent) {
  if (!item) {
    if (visual?.root) visual.root.visible = false;
    return visual;
  }
  const type = item.type === "kranium" ? "kranium" : "defense";
  const valid = item.valid !== false;
  const key = `${type}:${valid ? "valid" : "invalid"}`;
  let next = visual;
  if (!next || next.key !== key) {
    if (next?.root) next.root.destroy({ children: true });
    next = type === "kranium" ? createAdventureKraniumTowerVisual(true) : createAdventureDefenseTowerVisual(true);
    next.key = key;
    const border = new PIXI.Graphics();
    const r = Number(item.radius || (type === "kranium" ? 132 : 122));
    border.circle(0, 0, r + 16).stroke({ color: valid ? 0x65ffd4 : 0xff716b, width: 3.2, alpha: 0.94 });
    border.circle(0, 0, r + 7).stroke({ color: valid ? 0xc4fff0 : 0xffc0b3, width: 1.3, alpha: 0.66 });
    border.blendMode = "screen";
    next.root.addChild(border);
    next.placementBorder = border;
    parent.addChild(next.root);
  }
  next.root.position.set(Number(item.x || 0), Number(item.y || 0));
  next.root.alpha = valid ? 0.78 : 0.5;
  next.root.visible = true;
  return next;
}

function createAdventureWallHazardVisual() {
  const smokeContainer = new PIXI.Container();
  smokeContainer.eventMode = "none";
  const fireContainer = new PIXI.Container();
  fireContainer.eventMode = "none";
  fireContainer.blendMode = "normal";

  const smoke = [];
  const smokeAnchors = [
    { x: -162, y: -34 },
    { x: -136, y: -18 },
    { x: -108, y: -30 },
    { x: -34, y: -30 },
    { x: -6, y: -14 },
    { x: 28, y: -16 },
    { x: 108, y: -28 },
    { x: 138, y: -18 },
    { x: 164, y: -32 },
  ];
  for (let index = 0; index < 22; index += 1) {
    const radius = 14 + (index % 5) * 5;
    const node = new PIXI.Graphics(createAdventureWallSmokeParticleContext(radius));
    node.visible = false;
    smokeContainer.addChild(node);
    smoke.push({
      node,
      anchor: smokeAnchors[index % smokeAnchors.length],
      phase: Math.random() * Math.PI * 2,
      lift: 72 + (index % 6) * 22,
      sway: 12 + (index % 4) * 6,
      delay: index * 0.11,
    });
  }

  const fire = [];
  const fireAnchors = [
    { x: -146, y: -18 },
    { x: -122, y: -12 },
    { x: -20, y: -10 },
    { x: 8, y: -8 },
    { x: 126, y: -12 },
    { x: 150, y: -18 },
  ];
  for (let index = 0; index < 10; index += 1) {
    const size = 19 + (index % 3) * 6;
    const node = new PIXI.Graphics(createAdventureWallFireParticleContext(size, index % 4));
    node.visible = false;
    fireContainer.addChild(node);
    fire.push({
      node,
      anchor: fireAnchors[index % fireAnchors.length],
      phase: Math.random() * Math.PI * 2,
      sway: 3.5 + (index % 3) * 2,
      lift: 5 + (index % 3) * 3,
      baseScale: 0.88 + (index % 3) * 0.12,
    });
  }

  return { smokeContainer, fireContainer, smoke, fire };
}

function createAdventureWallVisual(mode = "placed", snapped = false) {
  const root = new PIXI.Container();
  root.eventMode = "none";
  const shell = new PIXI.Graphics(createAdventureWallShellContext(mode, snapped));
  const damage = new PIXI.Graphics(createAdventureWallDamageContext(0));
  const lights = new PIXI.Graphics(createAdventureWallLightContext(mode, snapped));
  const sweep = new PIXI.Graphics(createAdventureWallSweepContext(mode, snapped));
  const hazards = createAdventureWallHazardVisual();
  damage.alpha = 0;
  lights.blendMode = "screen";
  sweep.blendMode = "screen";
  root.addChild(shell);
  root.addChild(damage);
  root.addChild(hazards.smokeContainer);
  root.addChild(hazards.fireContainer);
  root.addChild(lights);
  root.addChild(sweep);
  return {
    root,
    shell,
    damage,
    lights,
    sweep,
    smokeContainer: hazards.smokeContainer,
    fireContainer: hazards.fireContainer,
    smokeParticles: hazards.smoke,
    fireParticles: hazards.fire,
    contextKey: `${mode}:${snapped ? 1 : 0}`,
    damageLevel: 0,
    integrity: 1,
    phase: Math.random() * Math.PI * 2,
    mode,
    snapped,
    lastSeenAt: 0,
  };
}

function updateAdventureWallVisualContext(visual, mode = "placed", snapped = false) {
  const nextKey = `${mode}:${snapped ? 1 : 0}`;
  if (!visual || visual.contextKey === nextKey) return;
  visual.contextKey = nextKey;
  visual.mode = mode;
  visual.snapped = snapped;
  visual.shell.context = createAdventureWallShellContext(mode, snapped);
  visual.lights.context = createAdventureWallLightContext(mode, snapped);
  visual.sweep.context = createAdventureWallSweepContext(mode, snapped);
}

const ADVENTURE_GATE_BASE_LENGTH = 420;
const ADVENTURE_GATE_VISUAL_DEPTH_SCALE = 1.0;

// This is intentionally a distinct Starbase gateway, not another long wall
// segment. The pylon-to-pylon silhouette is compact, heavy and easy to read
// from a top-down camera while still matching the existing wall endpoints.
function createAdventureGateShellContext(mode = "placed", snapped = false) {
  const preview = mode === "preview";
  const ctx = new PIXI.GraphicsContext();
  const outer = preview ? (snapped ? 0x153e3d : 0x193448) : 0x111820;
  const armor = preview ? (snapped ? 0x2f7770 : 0x315d73) : 0x3f4b58;
  const armorLight = preview ? (snapped ? 0x82f6de : 0x9bd5eb) : 0x8595a3;
  const edge = preview ? (snapped ? 0xdbfff3 : 0xdbedf8) : 0xb5c4ce;
  const inset = preview ? 0x0a2028 : 0x090f15;
  const dark = 0x05090e;
  const warm = preview ? 0x9ffde3 : 0xffba76;

  // Broad shadow so the gate reads as a building, not as a transparent tube.
  ctx.poly([
    -213, -66,
    -188, -92,
    188, -92,
    213, -66,
    213, 66,
    188, 92,
    -188, 92,
    -213, 66,
  ]).fill({ color: 0x000000, alpha: preview ? 0.16 : 0.34 });

  // Full armored spine that joins perfectly with wall endpoints.
  ctx.poly([
    -208, -52,
    -178, -78,
    178, -78,
    208, -52,
    208, 52,
    178, 78,
    -178, 78,
    -208, 52,
  ]).fill({ color: outer, alpha: preview ? 0.68 : 1 });
  ctx.poly([
    -208, -52,
    -178, -78,
    178, -78,
    208, -52,
    208, 52,
    178, 78,
    -178, 78,
    -208, 52,
  ]).stroke({ color: edge, width: 3.8, alpha: preview ? 0.74 : 0.82 });

  // Reinforced top/bottom defensive rails.
  ctx.poly([-174, -70, 174, -70, 193, -51, 150, -48, -150, -48, -193, -51])
    .fill({ color: armor, alpha: preview ? 0.52 : 0.88 });
  ctx.poly([-150, 48, 150, 48, 193, 51, 174, 70, -174, 70, -193, 51])
    .fill({ color: 0x242e38, alpha: preview ? 0.52 : 0.94 });
  ctx.poly([-164, -64, 164, -64]).stroke({ color: armorLight, width: 1.3, alpha: preview ? 0.28 : 0.22 });
  ctx.poly([-164, 62, 164, 62]).stroke({ color: 0x0a0f14, width: 2.2, alpha: 0.62 });

  // Large central blast-door frame / aperture.
  ctx.poly([
    -92, -61,
    92, -61,
    116, -38,
    116, 38,
    92, 61,
    -92, 61,
    -116, 38,
    -116, -38,
  ]).fill({ color: dark, alpha: preview ? 0.64 : 1 });
  ctx.poly([
    -92, -61,
    92, -61,
    116, -38,
    116, 38,
    92, 61,
    -92, 61,
    -116, 38,
    -116, -38,
  ]).stroke({ color: edge, width: 3.4, alpha: preview ? 0.76 : 0.74 });
  ctx.poly([-82, -48, 82, -48, 100, -30, 100, 30, 82, 48, -82, 48, -100, 30, -100, -30])
    .fill({ color: inset, alpha: preview ? 0.62 : 0.98 });
  ctx.poly([-82, -48, 82, -48, 100, -30, 100, 30, 82, 48, -82, 48, -100, 30, -100, -30])
    .stroke({ color: armorLight, width: 1.5, alpha: preview ? 0.30 : 0.24 });

  // Side towers: hexagonal bastions with recessed turret wells.
  const drawBastion = (x) => {
    ctx.poly([
      x - 29, -60,
      x + 25, -60,
      x + 48, -35,
      x + 48, 35,
      x + 25, 60,
      x - 29, 60,
      x - 50, 35,
      x - 50, -35,
    ]).fill({ color: 0x1d2731, alpha: preview ? 0.72 : 1 });
    ctx.poly([
      x - 29, -60,
      x + 25, -60,
      x + 48, -35,
      x + 48, 35,
      x + 25, 60,
      x - 29, 60,
      x - 50, 35,
      x - 50, -35,
    ]).stroke({ color: edge, width: 2.6, alpha: preview ? 0.60 : 0.72 });
    ctx.poly([
      x - 24, -43,
      x + 19, -43,
      x + 34, -25,
      x + 34, 25,
      x + 19, 43,
      x - 24, 43,
      x - 35, 25,
      x - 35, -25,
    ]).fill({ color: armor, alpha: preview ? 0.64 : 0.94 });
    ctx.circle(x - 2, 0, 18).fill({ color: 0x0b1015, alpha: 1 });
    ctx.circle(x - 2, 0, 11).stroke({ color: armorLight, width: 2.1, alpha: preview ? 0.52 : 0.50 });
    ctx.circle(x - 2, 0, 5).fill({ color: warm, alpha: preview ? 0.86 : 0.64 });
    ctx.roundRect(x - 18, -30, 32, 9, 4).fill({ color: 0x0d141a, alpha: 0.88 });
    ctx.roundRect(x - 18, 21, 32, 9, 4).fill({ color: 0x0d141a, alpha: 0.88 });
  };
  drawBastion(-160);
  drawBastion(160);

  // Mechanical ribs around the door frame — subtle, but gives it station detail.
  for (const x of [-126, -112, -72, -58, 58, 72, 112, 126]) {
    ctx.roundRect(x - 4, -54, 8, 108, 3).fill({ color: 0x0b1117, alpha: preview ? 0.36 : 0.62 });
  }

  return ctx;
}

function createAdventureGateDoorContext(side = "left", mode = "placed") {
  const preview = mode === "preview";
  const ctx = new PIXI.GraphicsContext();
  const outer = preview ? 0x245a6a : 0x37434f;
  const plate = preview ? 0x183e4c : 0x232e38;
  const edge = preview ? 0xb6efff : 0x9eafbb;
  const accent = preview ? 0x92f8ff : 0x8bdce2;
  const sign = side === "left" ? 1 : -1;

  // Each half is a heavy segmented blast door. At rest, both meet in the centre;
  // on approach they slide sideways into the outer housings.
  ctx.poly([
    -54, -43,
    42, -43,
    56, -28,
    56, 28,
    42, 43,
    -54, 43,
    -66, 28,
    -66, -28,
  ]).fill({ color: outer, alpha: preview ? 0.72 : 1 });
  ctx.poly([
    -54, -43,
    42, -43,
    56, -28,
    56, 28,
    42, 43,
    -54, 43,
    -66, 28,
    -66, -28,
  ]).stroke({ color: edge, width: 2.1, alpha: preview ? 0.70 : 0.64 });
  ctx.roundRect(-52, -32, 94, 64, 10).fill({ color: plate, alpha: preview ? 0.74 : 0.98 });

  for (const y of [-18, 0, 18]) {
    ctx.roundRect(-42, y - 5, 70, 10, 4).fill({ color: 0x11191f, alpha: 0.9 });
    ctx.roundRect(-38, y - 2.5, 61, 5, 2.5).fill({ color: accent, alpha: preview ? 0.34 : 0.18 });
  }

  // Pointed centre seam which makes two halves clearly readable.
  ctx.poly([sign * 53, -22, sign * 69, 0, sign * 53, 22, sign * 40, 0])
    .fill({ color: accent, alpha: preview ? 0.86 : 0.54 });
  return ctx;
}

function createAdventureGateLightContext(mode = "placed", snapped = false) {
  const preview = mode === "preview";
  const ctx = new PIXI.GraphicsContext();
  const cyan = preview ? (snapped ? 0x91ffe4 : 0xa2eaff) : 0x55dce6;
  const amber = preview ? 0xe8fff8 : 0xffb26b;

  // Running lights on the rails and bastions.
  for (const x of [-188, -172, -144, -128, -94, -70, 70, 94, 128, 144, 172, 188]) {
    ctx.circle(x, -54, 3.2).fill({ color: cyan, alpha: preview ? 0.78 : 0.72 });
    ctx.circle(x, 54, 2.8).fill({ color: cyan, alpha: preview ? 0.54 : 0.46 });
  }
  for (const x of [-162, 162]) {
    ctx.circle(x - 2, 0, 4.8).fill({ color: amber, alpha: preview ? 0.84 : 0.76 });
    ctx.circle(x - 2, 0, 11).stroke({ color: cyan, width: 1.1, alpha: preview ? 0.36 : 0.24 });
  }
  ctx.roundRect(-82, -4, 164, 8, 4).fill({ color: cyan, alpha: preview ? 0.26 : 0.20 });
  return ctx;
}

function createAdventureGateBeamContext(mode = "placed") {
  const preview = mode === "preview";
  const ctx = new PIXI.GraphicsContext();
  const field = preview ? 0x83f7ff : 0x41dbe5;
  ctx.poly([-82, -45, 82, -45, 96, -29, 96, 29, 82, 45, -82, 45, -96, 29, -96, -29])
    .fill({ color: field, alpha: preview ? 0.18 : 0.12 });
  ctx.poly([-73, -35, 73, -35, 86, -23, 86, 23, 73, 35, -73, 35, -86, 23, -86, -23])
    .stroke({ color: 0xd6ffff, width: 1.3, alpha: preview ? 0.34 : 0.20 });
  for (const y of [-22, -7, 8, 23]) {
    ctx.poly([-70, y, 70, y]).stroke({ color: field, width: 1.1, alpha: preview ? 0.16 : 0.11 });
  }
  return ctx;
}

function createAdventureGateVisual(mode = "placed", snapped = false) {
  const root = new PIXI.Container();
  root.eventMode = "none";
  const shell = new PIXI.Graphics(createAdventureGateShellContext(mode, snapped));
  const beam = new PIXI.Graphics(createAdventureGateBeamContext(mode));
  const leftDoor = new PIXI.Graphics(createAdventureGateDoorContext("left", mode));
  const rightDoor = new PIXI.Graphics(createAdventureGateDoorContext("right", mode));
  const lights = new PIXI.Graphics(createAdventureGateLightContext(mode, snapped));

  beam.blendMode = "screen";
  lights.blendMode = "screen";
  root.addChild(shell, beam, leftDoor, rightDoor, lights);

  return {
    root,
    shell,
    beam,
    leftDoor,
    rightDoor,
    lights,
    mode,
    snapped,
    phase: staticPhaseFromKey(`adventure-gate:${Math.random().toString(36).slice(2, 8)}`),
    currentOpen: 0,
    targetOpen: 0,
    lastSeenAt: 0,
  };
}

function updateAdventureGateVisualContext(visual, mode, snapped) {
  if (!visual || (visual.mode === mode && visual.snapped === snapped)) return;
  visual.mode = mode;
  visual.snapped = snapped;
  visual.shell.context = createAdventureGateShellContext(mode, snapped);
  visual.beam.context = createAdventureGateBeamContext(mode);
  visual.leftDoor.context = createAdventureGateDoorContext("left", mode);
  visual.rightDoor.context = createAdventureGateDoorContext("right", mode);
  visual.lights.context = createAdventureGateLightContext(mode, snapped);
}

function syncAdventureGates(map, items, parent, bounds, now, maxItems = 120) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, Number(item.length || ADVENTURE_GATE_BASE_LENGTH) * 0.72)) continue;
    const key = String(item.id || `${Math.round(item.x)}:${Math.round(item.y)}`);
    active.add(key);
    let visual = map.get(key);

    if (!visual) {
      visual = createAdventureGateVisual("placed", false);
      parent.addChild(visual.root);
      map.set(key, visual);
    } else {
      updateAdventureGateVisualContext(visual, "placed", false);
    }

    const scale = Math.max(0.32, Number(item.length || ADVENTURE_GATE_BASE_LENGTH) / ADVENTURE_GATE_BASE_LENGTH);
    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.root.rotation = Number(item.rotation || 0);
    visual.root.scale.set(scale, scale * ADVENTURE_GATE_VISUAL_DEPTH_SCALE);
    visual.root.alpha = 1;
    visual.root.visible = true;
    visual.targetOpen = clamp(Number(item.openAmount || 0), 0, 1);
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 12) {
      visual.root.destroy({ children: true });
      map.delete(key);
    }
  }
}

function syncAdventureGatePreview(visual, item, parent) {
  if (!item) {
    if (visual?.root) visual.root.visible = false;
    return visual;
  }

  const snapped = Boolean(item.snapped);
  let next = visual;
  if (!next) {
    next = createAdventureGateVisual("preview", snapped);
    parent.addChild(next.root);
  } else {
    updateAdventureGateVisualContext(next, "preview", snapped);
  }

  const scale = Math.max(0.32, Number(item.length || ADVENTURE_GATE_BASE_LENGTH) / ADVENTURE_GATE_BASE_LENGTH);
  next.root.position.set(Number(item.x || 0), Number(item.y || 0));
  next.root.rotation = Number(item.rotation || 0);
  next.root.scale.set(scale, scale * ADVENTURE_GATE_VISUAL_DEPTH_SCALE);
  next.root.alpha = snapped ? 0.96 : 0.7;
  next.root.visible = true;
  next.targetOpen = 0;
  return next;
}

function syncAdventureWalls(map, items, parent, bounds, now, maxItems = 160) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, Number(item.length || ADVENTURE_WALL_BASE_LENGTH) * 0.65)) continue;
    const key = String(item.id || `${Math.round(item.x)}:${Math.round(item.y)}`);
    active.add(key);
    let visual = map.get(key);

    if (!visual) {
      visual = createAdventureWallVisual("placed", false);
      parent.addChild(visual.root);
      map.set(key, visual);
    } else {
      updateAdventureWallVisualContext(visual, "placed", false);
    }

    const scale = Math.max(0.22, Number(item.length || ADVENTURE_WALL_BASE_LENGTH) / ADVENTURE_WALL_BASE_LENGTH);
    const maxHp = Math.max(1, Number(item.maxHp || 100));
    const hp = Math.max(0, Number(item.hp ?? maxHp));
    const integrity = clamp(hp / maxHp, 0, 1);
    const damageLevel = integrity <= 0.15 ? 4 : integrity <= 0.35 ? 3 : integrity <= 0.6 ? 2 : integrity <= 0.82 ? 1 : 0;
    if (visual.damageLevel !== damageLevel) {
      visual.damageLevel = damageLevel;
      visual.damage.context = createAdventureWallDamageContext(damageLevel);
    }
    visual.integrity = integrity;
    // Large missing-panel geometry must stay fully visible; only the first
    // wear stage is intentionally softer.
    visual.damage.alpha = damageLevel <= 0 ? 0 : damageLevel === 1 ? 0.78 : 1;
    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.root.rotation = Number(item.rotation || 0);
    visual.root.scale.set(scale, scale * ADVENTURE_WALL_VISUAL_DEPTH_SCALE);
    visual.root.alpha = 1;
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 12) {
      visual.root.destroy({ children: true });
      map.delete(key);
    }
  }
}

function syncAdventureWallPreview(visual, item, parent) {
  if (!item) {
    if (visual?.root) visual.root.visible = false;
    return visual;
  }

  const snapped = Boolean(item.snapped);
  let next = visual;
  if (!next) {
    next = createAdventureWallVisual("preview", snapped);
    parent.addChild(next.root);
  } else {
    updateAdventureWallVisualContext(next, "preview", snapped);
  }

  const scale = Math.max(0.22, Number(item.length || ADVENTURE_WALL_BASE_LENGTH) / ADVENTURE_WALL_BASE_LENGTH);
  next.root.position.set(Number(item.x || 0), Number(item.y || 0));
  next.root.rotation = Number(item.rotation || 0);
  next.root.scale.set(scale, scale * ADVENTURE_WALL_VISUAL_DEPTH_SCALE);
  next.root.alpha = snapped ? 0.92 : 0.62;
  next.root.visible = true;
  return next;
}

function createAdventureDemolitionContext(removable = false) {
  const ctx = new PIXI.GraphicsContext();
  const border = removable ? 0x5fffc4 : 0xff705f;
  const glow = removable ? 0x8cffda : 0xffae8f;
  const fill = removable ? 0x23b580 : 0x8f201d;

  ctx.roundRect(-246, -82, 492, 164, 19).fill({ color: fill, alpha: 0.10 });
  ctx.roundRect(-246, -82, 492, 164, 19).stroke({ color: border, width: 3.2, alpha: 0.95 });
  ctx.roundRect(-230, -66, 460, 132, 14).stroke({ color: glow, width: 1.25, alpha: 0.56 });

  for (const x of [-220, 220]) {
    ctx.moveTo(x, -52).lineTo(x, 52).stroke({ color: border, width: 4.5, alpha: 0.9 });
    ctx.moveTo(x - 14, -66).lineTo(x + 14, -66).stroke({ color: glow, width: 2.2, alpha: 0.9 });
    ctx.moveTo(x - 14, 66).lineTo(x + 14, 66).stroke({ color: glow, width: 2.2, alpha: 0.9 });
  }

  if (removable) {
    ctx.poly([-22, -22, 22, -22, 22, 22, -22, 22]).stroke({ color: glow, width: 2.2, alpha: 0.86 });
    ctx.moveTo(-10, 0).lineTo(-2, 9).lineTo(13, -11).stroke({ color: glow, width: 4.0, alpha: 0.94 });
  } else {
    ctx.circle(0, 0, 28).stroke({ color: glow, width: 2.6, alpha: 0.92 });
    ctx.moveTo(-14, -14).lineTo(14, 14).stroke({ color: glow, width: 3.8, alpha: 0.92 });
    ctx.moveTo(14, -14).lineTo(-14, 14).stroke({ color: glow, width: 3.8, alpha: 0.92 });
  }

  return ctx;
}

function syncAdventureDemolitionTarget(visual, target, parent) {
  if (!target) {
    if (visual?.root) visual.root.visible = false;
    return visual;
  }

  const removable = Boolean(target.removable);
  const contextKey = `${target.type || 'wall'}:${removable ? 1 : 0}`;
  let next = visual;
  if (!next) {
    const root = new PIXI.Graphics(createAdventureDemolitionContext(removable));
    root.eventMode = 'none';
    root.blendMode = 'screen';
    next = {
      root,
      contextKey,
      removable,
      phase: staticPhaseFromKey(`adventure-demolish:${String(target.id || '')}`),
    };
    parent.addChild(root);
  } else if (next.contextKey !== contextKey) {
    next.contextKey = contextKey;
    next.removable = removable;
    next.root.context = createAdventureDemolitionContext(removable);
  }

  const baseLength = target.type === 'gate'
    ? 420
    : target.type === 'defense'
      ? 232
      : target.type === 'kranium'
        ? 288
        : 480;
  const baseDepth = target.type === 'gate'
    ? 136
    : target.type === 'defense'
      ? 232
      : target.type === 'kranium'
        ? 288
        : 116;
  const scaleX = Math.max(0.34, Number(target.length || baseLength) / 480);
  const scaleY = Math.max(0.38, Number(target.depth || baseDepth) / 116);
  next.root.position.set(Number(target.x || 0), Number(target.y || 0));
  next.root.rotation = Number(target.rotation || 0);
  next.root.scale.set(scaleX, scaleY);
  next.root.alpha = 0.92;
  next.root.visible = true;
  return next;
}

function syncAdventureWallShieldHits(map, items, parent, bounds, now, maxItems = 28) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 120)) continue;
    const createdAt = Number(item.createdAt || now);
    const ttl = Math.max(1, Number(item.ttl || 620));
    const age = Math.max(0, now - createdAt);
    if (age >= ttl) continue;

    const key = String(item.id || `${Math.round(item.x || 0)}:${Math.round(item.y || 0)}:${createdAt}`);
    active.add(key);
    let visual = map.get(key);

    if (!visual) {
      const root = new PIXI.Graphics(createAdventureWallShieldContext());
      root.eventMode = "none";
      root.blendMode = "screen";
      visual = { root, lastSeenAt: now };
      parent.addChild(root);
      map.set(key, visual);
    }

    const progress = clamp(age / ttl, 0, 1);
    const normalX = Number(item.normalX || 0);
    const normalY = Number(item.normalY || 0);
    const source = item.source === "projectile" ? "projectile" : "collision";
    const travel = source === "projectile" ? 7 + progress * 15 : 4 + progress * 9;
    const contactX = Number(item.x || 0) + normalX * travel;
    const contactY = Number(item.y || 0) + normalY * travel;

    visual.root.position.set(contactX, contactY);
    visual.root.rotation = Math.atan2(normalY, normalX) + Math.PI * 0.5;
    visual.root.scale.set((source === "projectile" ? 0.68 : 0.42) + progress * (source === "projectile" ? 1.58 : 1.22));
    visual.root.alpha = (1 - progress) * (source === "projectile" ? 1.12 : 0.95);
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 4) {
      visual.root.destroy();
      map.delete(key);
    }
  }
}

function createAdventureBoltContext(team = "player") {
  const bot = team === "bot";
  const tower = team === "tower";
  const ctx = new PIXI.GraphicsContext();

  if (tower) {
    // The defense tower fires a bright, narrow twin-laser-style pulse.
    ctx.roundRect(-56, -5.4, 94, 10.8, 5.4).fill({ color: 0x20ccff, alpha: 0.34 });
    ctx.roundRect(-48, -2.2, 96, 4.4, 2.2).fill({ color: 0xe9ffff, alpha: 0.98 });
    ctx.circle(42, 0, 8).fill({ color: 0x7bf4ff, alpha: 0.75 });
    ctx.roundRect(-76, -1.3, 36, 2.6, 1.3).fill({ color: 0x83f6ff, alpha: 0.48 });
    return ctx;
  }

  const core = bot ? 0xff8c5c : 0x78efff;
  const edge = bot ? 0xffe1b3 : 0xeaffff;
  const aura = bot ? 0xff4d5f : 0x00cfff;
  ctx.poly([-42, 0, -17, -12, 28, 0, -17, 12]).fill({ color: aura, alpha: 0.12 });
  ctx.poly([-30, 0, -11, -7.5, 24, 0, -11, 7.5]).fill({ color: core, alpha: 0.98 });
  ctx.poly([-30, 0, -11, -7.5, 24, 0, -11, 7.5]).stroke({ color: edge, width: 1.6, alpha: 0.9 });
  ctx.circle(-15, 0, 5.5).fill({ color: edge, alpha: 0.88 });
  ctx.poly([-58, 0, -27, -4, -27, 4]).fill({ color: core, alpha: 0.38 });
  return ctx;
}

function createAdventureStarVisual(item) {
  const color = ADVENTURE_STAR_COLORS[item?.color] || ADVENTURE_STAR_COLORS.cyan;
  const root = new PIXI.Graphics(createAdventureStarContext(color));
  root.eventMode = "none";

  return {
    root,
    contextKey: String(item?.color || "cyan"),
    phase: staticPhaseFromKey(`adventure-star:${item?.id || ""}`),
    x: 0,
    y: 0,
    lastSeenAt: 0,
  };
}

function syncAdventureStars(map, items, parent, bounds, now, maxItems = 160) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 80)) continue;
    const key = String(item.id || `${Math.round(item.x)}:${Math.round(item.y)}`);
    active.add(key);

    let visual = map.get(key);
    const nextContextKey = String(item.color || "cyan");
    if (!visual) {
      visual = createAdventureStarVisual(item);
      parent.addChild(visual.root);
      map.set(key, visual);
    } else if (visual.contextKey !== nextContextKey) {
      visual.contextKey = nextContextKey;
      visual.root.context = createAdventureStarContext(
        ADVENTURE_STAR_COLORS[nextContextKey] || ADVENTURE_STAR_COLORS.cyan,
      );
    }

    visual.x = Number(item.x || 0);
    visual.y = Number(item.y || 0);
    visual.root.position.set(visual.x, visual.y);
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 8) {
      visual.root.destroy();
      map.delete(key);
    }
  }
}

function createAdventureAsteroidVisual(item) {
  const root = new PIXI.Container();
  root.eventMode = "none";

  const rock = new PIXI.Graphics(
    createAdventureAsteroidContext(Number(item?.tone || 0)),
  );
  rock.eventMode = "none";

  const impact = new PIXI.Graphics(createAdventureAsteroidImpactContext());
  impact.eventMode = "none";
  impact.visible = false;
  impact.blendMode = "add";

  root.addChild(rock, impact);
  return {
    root,
    rock,
    impact,
    contextKey: "",
    x: 0,
    y: 0,
    radius: 100,
    rotation: 0,
    rotationSpeed: 0,
    bobPhase: 0,
    lastImpactAt: 0,
    impactAngle: 0,
    lastSeenAt: 0,
  };
}

function syncAdventureAsteroids(map, items, parent, bounds, now, maxItems = 90) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, Number(item.radius || 100) + 120)) continue;
    const key = String(item.id || `${Math.round(item.x)}:${Math.round(item.y)}`);
    active.add(key);

    const tone = Math.max(0, Math.min(3, Math.floor(Number(item.tone || 0))));
    const contextKey = String(tone);
    let visual = map.get(key);

    if (!visual) {
      visual = createAdventureAsteroidVisual(item);
      parent.addChild(visual.root);
      map.set(key, visual);
    }

    if (visual.contextKey !== contextKey) {
      visual.contextKey = contextKey;
      visual.rock.context = createAdventureAsteroidContext(tone);
    }

    visual.x = Number(item.x || 0);
    visual.y = Number(item.y || 0);
    visual.radius = Math.max(30, Number(item.radius || 100));
    visual.rotation = Number(item.rotation || 0);
    visual.rotationSpeed = Number(item.rotationSpeed || 0);
    visual.bobPhase = Number(item.bobPhase || 0);
    visual.lastImpactAt = Number(item.lastHitAt || 0);
    visual.impactAngle = Number(item.impactAngle || 0);
    visual.root.position.set(visual.x, visual.y);
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 8) {
      visual.root.destroy({ children: true });
      map.delete(key);
    }
  }
}

function syncAdventureProjectiles(map, items, parent, bounds, now, maxItems = 80) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 110)) continue;
    const key = String(item.id || "");
    if (!key) continue;
    active.add(key);

    const team = item.team === "bot" ? "bot" : item.team === "tower" ? "tower" : "player";
    let visual = map.get(key);
    if (!visual) {
      const root = new PIXI.Graphics(createAdventureBoltContext(team));
      root.eventMode = "none";
      root.blendMode = team === "tower" ? "screen" : "normal";
      visual = {
        root,
        team,
        phase: staticPhaseFromKey(`adventure-bolt:${key}`),
        lastSeenAt: 0,
      };
      parent.addChild(root);
      map.set(key, visual);
    } else if (visual.team !== team) {
      visual.team = team;
      visual.root.context = createAdventureBoltContext(team);
    }

    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.root.rotation = Number(item.angle || Math.atan2(Number(item.vy || 0), Number(item.vx || 1)));
    visual.root.visible = true;
    visual.root.alpha = 0.94;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 4) {
      visual.root.destroy();
      map.delete(key);
    }
  }
}


function syncAdventureDebris(map, items, parent, bounds, now, maxItems = 120) {
  const active = map.__activeScratch || (map.__activeScratch = new Set());
  active.clear();
  let rendered = 0;

  for (const item of items || []) {
    if (!item || rendered >= maxItems || !isVisibleInBounds(item, bounds, 70)) continue;
    const key = String(item.id || "");
    if (!key) continue;
    active.add(key);

    const tone = Math.max(0, Math.min(3, Math.floor(Number(item.tone || 0))));
    const variant = Math.max(0, Math.min(3, Math.floor(Number(item.variant || 0))));
    const sparkle = Boolean(item.sparkle);
    const contextKey = `${tone}:${variant}:${sparkle ? 1 : 0}`;
    let visual = map.get(key);

    if (!visual) {
      const root = new PIXI.Graphics(createAdventureDebrisContext(tone, variant, sparkle));
      root.eventMode = "none";
      root.blendMode = sparkle ? "add" : "normal";
      visual = { root, contextKey, lastSeenAt: now };
      parent.addChild(root);
      map.set(key, visual);
    } else if (visual.contextKey !== contextKey) {
      visual.contextKey = contextKey;
      visual.root.context = createAdventureDebrisContext(tone, variant, sparkle);
    }

    const age = Math.max(0, now - Number(item.createdAt || now));
    const ttl = Math.max(1, Number(item.ttl || 900));
    const progress = clamp(age / ttl, 0, 1);
    const fade = 1 - progress;
    const size = Math.max(2, Number(item.size || 6));

    visual.root.position.set(Number(item.x || 0), Number(item.y || 0));
    visual.root.rotation = Number(item.rotation || 0);
    visual.root.scale.set(size);
    visual.root.alpha = fade * (sparkle ? 1 : 0.92);
    visual.root.visible = true;
    visual.lastSeenAt = now;
    rendered += 1;
  }

  for (const [key, visual] of map) {
    if (!active.has(key)) visual.root.visible = false;
    if (now - Number(visual.lastSeenAt || 0) > ENTITY_STALE_MS * 4) {
      visual.root.destroy();
      map.delete(key);
    }
  }
}

function animateAdventureVisuals(starMap, asteroidMap, projectileMap, wallMap, gateMap, generatorVisual, defenseTowerMap, kraniumTowerMap, towerPreviewVisual, wallPreviewVisual, gatePreviewVisual, demolitionTargetVisual, now) {
  for (const visual of starMap.values()) {
    if (!visual?.root?.visible) continue;
    const wave = Math.sin(now * 0.006 + visual.phase);
    const pulse = 0.94 + wave * 0.12;
    visual.root.position.set(visual.x, visual.y + Math.sin(now * 0.0024 + visual.phase) * 4);
    visual.root.rotation = now * 0.0012 + visual.phase;
    visual.root.scale.set(pulse);
    visual.root.alpha = 0.82 + wave * 0.18;
  }

  for (const visual of asteroidMap.values()) {
    if (!visual?.root?.visible) continue;
    const impactAge = now - Number(visual.lastImpactAt || 0);
    const impactProgress = clamp(impactAge / 360, 0, 1);
    const impactStrength = impactAge >= 0 && impactAge < 360
      ? Math.sin(impactProgress * Math.PI) * 0.115
      : 0;
    const baseScale = visual.radius / 84;

    visual.root.position.set(
      visual.x,
      visual.y + Math.sin(now * 0.0011 + visual.bobPhase) * 8,
    );
    visual.root.rotation = visual.rotation + now * visual.rotationSpeed;
    visual.root.scale.set(baseScale * (1 + impactStrength));

    if (impactStrength > 0.002) {
      visual.impact.visible = true;
      visual.impact.rotation = visual.impactAngle;
      visual.impact.alpha = (1 - impactProgress) * 0.95;
      visual.impact.scale.set(0.42 + impactProgress * 1.45);
    } else {
      visual.impact.visible = false;
    }
  }

  for (const visual of projectileMap.values()) {
    if (!visual?.root?.visible) continue;
    const pulse = 1 + Math.sin(now * 0.018 + visual.phase) * 0.08;
    visual.root.scale.set(pulse);
  }

  if (generatorVisual?.root?.visible) {
    const integrity = clamp(Number(generatorVisual.integrity ?? 1), 0, 1);
    const damageIntensity = 1 - integrity;
    const wave = Math.sin(now * 0.00235 + generatorVisual.phase);
    const surge = Math.max(0, Math.sin(now * 0.0052 + generatorVisual.phase * 1.7));
    generatorVisual.halo.alpha = 0.075 + surge * 0.075 + integrity * 0.045;
    generatorVisual.ringOuter.rotation = now * 0.00021;
    generatorVisual.ringInner.rotation = -now * 0.00046;
    generatorVisual.ringOuter.alpha = 0.11 + integrity * 0.17 + surge * 0.14;
    generatorVisual.ringInner.alpha = 0.16 + integrity * 0.21 + Math.max(0, -wave) * 0.12;
    generatorVisual.engineLayer.rotation = Math.sin(now * 0.00042 + generatorVisual.phase) * 0.055;
    generatorVisual.core.scale.set(0.96 + Math.sin(now * 0.0056 + generatorVisual.phase) * 0.09 + surge * 0.045);
    generatorVisual.core.alpha = 0.56 + integrity * 0.32 + surge * 0.16;
    generatorVisual.lights.alpha = 0.46 + integrity * 0.34 + Math.sin(now * 0.012 + generatorVisual.phase * 1.7) * 0.16;

    if (generatorVisual.engines?.length) {
      for (const engine of generatorVisual.engines) {
        const enginePulse = 0.78 + Math.max(0, Math.sin(now * 0.010 + engine.phase)) * 0.42;
        engine.rotor.rotation = now * 0.011 + engine.phase;
        engine.exhaust.scale.set(0.84 + enginePulse * 0.28, 0.8 + enginePulse * 0.52);
        engine.exhaust.alpha = (0.18 + integrity * 0.46) * enginePulse;
        engine.light.alpha = 0.18 + enginePulse * 0.42;
        engine.root.position.x = Math.cos(engine.root.rotation + Math.PI * 0.5) * 255;
        engine.root.position.y = Math.sin(engine.root.rotation + Math.PI * 0.5) * 255;
      }
    }

    const smokeStrength = 0.24 + damageIntensity * 1.08;
    if (generatorVisual.smokeParticles?.length) {
      for (const particle of generatorVisual.smokeParticles) {
        const node = particle.node;
        const t = now * 0.00145 + particle.phase + particle.delay;
        const oscillation = (t % 1 + 1) % 1;
        node.visible = true;
        node.position.set(
          particle.anchor.x + Math.sin(t * 2.25) * particle.sway,
          particle.anchor.y - oscillation * particle.lift,
        );
        node.scale.set((0.46 + oscillation * 1.14) * (0.68 + smokeStrength * 0.55));
        node.alpha = (1 - oscillation) * (0.12 + smokeStrength * 0.3);
      }
    }
  }

  for (const visual of defenseTowerMap.values()) {
    if (!visual?.root?.visible) continue;
    const pulse = 0.72 + Math.sin(now * 0.0065 + visual.phase) * 0.2;
    visual.ring.rotation = now * 0.00064 + visual.phase;
    visual.ring.alpha = 0.20 + pulse * 0.34;
    visual.halo.alpha = 0.040 + pulse * 0.065;
    visual.lights.alpha = 0.50 + pulse * 0.36;
    visual.turret.rotation = dampAngle(visual.turret.rotation, visual.targetRotation || 0, 12, 1 / 60);
    const recoilAge = Number(visual.recoilUntil || 0) - now;
    const firing = recoilAge > 0;
    const recoil = firing ? (recoilAge / 180) * 16 : 0;
    visual.turret.position.x = -recoil;
    visual.muzzle.alpha = firing ? 0.92 + Math.sin(now * 0.075) * 0.08 : 0.09 + pulse * 0.09;
    visual.muzzle.scale.set(firing ? 1.42 : 0.86 + pulse * 0.14);
    if (visual.laser) {
      visual.laser.alpha = firing ? 0.78 + Math.sin(now * 0.09) * 0.16 : 0.035 + pulse * 0.04;
      visual.laser.scale.x = firing ? 1.12 : 0.76 + pulse * 0.08;
    }
  }

  for (const visual of kraniumTowerMap.values()) {
    if (!visual?.root?.visible) continue;
    const wave = Math.sin(now * 0.0042 + visual.phase);
    const pulse = 0.5 + Math.max(0, wave) * 0.5;
    visual.halo.alpha = 0.07 + pulse * 0.13;
    if (visual.coil) {
      visual.coil.rotation = -now * 0.00029 + visual.phase * 0.4;
      visual.coil.alpha = 0.18 + pulse * 0.20;
      visual.coil.scale.set(0.99 + wave * 0.018);
    }
    visual.orbitA.rotation = now * 0.00095 + visual.phase;
    visual.orbitB.rotation = -now * 0.00072 - visual.phase * 0.6;
    visual.orbitA.alpha = 0.38 + pulse * 0.30;
    visual.orbitB.alpha = 0.32 + (1 - pulse) * 0.22;
    const crystalScale = 0.94 + pulse * 0.08;
    visual.crystal.scale.set(crystalScale, crystalScale);
    visual.crystal.rotation = Math.sin(now * 0.0019 + visual.phase) * 0.035;
    visual.crystal.alpha = 0.76 + pulse * 0.22;
    visual.lights.alpha = 0.58 + Math.sin(now * 0.012 + visual.phase) * 0.20;
  }

  if (towerPreviewVisual?.root?.visible) {
    const pulse = 0.68 + Math.sin(now * 0.008 + towerPreviewVisual.phase) * 0.2;
    towerPreviewVisual.root.scale.set(0.98 + pulse * 0.035);
    if (towerPreviewVisual.ring) towerPreviewVisual.ring.rotation = now * 0.0008;
    if (towerPreviewVisual.orbitA) towerPreviewVisual.orbitA.rotation = now * 0.001;
    if (towerPreviewVisual.orbitB) towerPreviewVisual.orbitB.rotation = -now * 0.0008;
  }

  for (const visual of wallMap.values()) {
    if (!visual?.root?.visible || !visual?.lights) continue;
    const integrity = clamp(Number(visual.integrity ?? 1), 0, 1);
    const failing = integrity < 0.36;
    const dropout = failing && Math.sin(now * 0.013 + visual.phase * 7) > 0.52 ? 0.15 : 1;
    const signal = ((0.16 + integrity * 0.66) + Math.sin(now * 0.0032 + visual.phase) * (0.06 + integrity * 0.16)) * dropout;
    const scan = (now * 0.00016 + visual.phase / (Math.PI * 2)) % 1;
    const damageIntensity = 1 - integrity;
    const smokeStrength = clamp((damageIntensity - 0.12) / 0.88, 0, 1);
    const fireStrength = clamp((damageIntensity - 0.38) / 0.62, 0, 1);
    visual.lights.alpha = signal;
    if (visual.sweep) {
      visual.sweep.position.x = -205 + scan * 410;
      visual.sweep.alpha = ((0.02 + integrity * 0.18) + Math.sin(scan * Math.PI) * (0.06 + integrity * 0.32)) * dropout;
    }

    if (visual.smokeParticles?.length) {
      for (const particle of visual.smokeParticles) {
        const node = particle.node;
        if (smokeStrength <= 0.02) {
          node.visible = false;
          continue;
        }
        const life = (now * 0.00012 + particle.delay + visual.phase * 0.03) % 1;
        const rise = life * particle.lift * (0.85 + smokeStrength * 1.35);
        const sway = Math.sin(now * 0.0013 + particle.phase + life * 5.0) * particle.sway * (0.75 + smokeStrength * 1.05);
        node.visible = true;
        node.position.set(particle.anchor.x + sway, particle.anchor.y - rise);
        const scale = 0.72 + smokeStrength * 0.55 + life * (0.85 + smokeStrength * 1.15);
        node.scale.set(scale, scale * (1.08 + smokeStrength * 0.12));
        node.alpha = (0.18 + smokeStrength * 0.56) * (1 - life * 0.55) * (0.78 + Math.sin(now * 0.001 + particle.phase) * 0.12);
      }
    }

    if (visual.fireParticles?.length) {
      for (const particle of visual.fireParticles) {
        const node = particle.node;
        if (fireStrength <= 0.02) {
          node.visible = false;
          continue;
        }

        // Persistent, low-frequency motion. No life-reset or rapid alpha pulse,
        // which removes the artificial blinking from the previous fire effect.
        const breath = Math.sin(now * 0.0041 + particle.phase);
        const curl = Math.sin(now * 0.0063 + particle.phase * 1.7);
        const sway = curl * particle.sway * (0.45 + fireStrength * 0.42);
        const lift = particle.lift + breath * (2.2 + fireStrength * 3.8);
        const scale = particle.baseScale * (0.86 + fireStrength * 0.82 + breath * 0.075);

        node.visible = true;
        node.position.set(particle.anchor.x + sway, particle.anchor.y - lift);
        node.rotation = curl * 0.14;
        node.scale.set(scale * (0.84 + curl * 0.04), scale * (1.08 + fireStrength * 0.34 + breath * 0.08));
        node.alpha = (0.34 + fireStrength * 0.58) * (0.94 + breath * 0.055);
      }
    }
  }

  for (const visual of gateMap.values()) {
    if (!visual?.root?.visible || !visual?.lights) continue;
    // Doors are deliberately eased, so the gate feels massive and hydraulic
    // rather than instantly changing state when the drone enters its sensor range.
    visual.currentOpen += (visual.targetOpen - visual.currentOpen) * 0.105;
    const open = clamp(visual.currentOpen, 0, 1);
    const lightPulse = 0.78 + Math.sin(now * 0.0027 + visual.phase) * 0.14;
    const alertPulse = open > 0.05 ? 1.08 : 0.90;
    visual.lights.alpha = lightPulse * alertPulse;

    visual.beam.alpha = (1 - open) * (0.18 + Math.sin(now * 0.0022 + visual.phase) * 0.045);
    visual.beam.scale.set(1, 0.96 + Math.sin(now * 0.0019 + visual.phase) * 0.035);

    const travel = 48 + open * 70;
    const hydraulic = Math.sin(now * 0.0021 + visual.phase) * (1.1 + open * 1.8);
    visual.leftDoor.position.set(-travel + hydraulic, 0);
    visual.rightDoor.position.set(travel - hydraulic, 0);
    visual.leftDoor.alpha = 0.98;
    visual.rightDoor.alpha = 0.98;
  }

  if (demolitionTargetVisual?.root?.visible) {
    const pulse = 0.76 + Math.sin(now * 0.008 + demolitionTargetVisual.phase) * 0.20;
    demolitionTargetVisual.root.alpha = pulse;
  }

  if (wallPreviewVisual?.root?.visible && wallPreviewVisual?.lights) {
    const scan = (now * 0.00022 + wallPreviewVisual.phase / (Math.PI * 2)) % 1;
    wallPreviewVisual.lights.alpha = 0.72 + Math.sin(now * 0.004 + wallPreviewVisual.phase) * 0.22;
    if (wallPreviewVisual.sweep) {
      wallPreviewVisual.sweep.position.x = -205 + scan * 410;
      wallPreviewVisual.sweep.alpha = 0.28 + Math.sin(scan * Math.PI) * 0.58;
    }
  }

  if (gatePreviewVisual?.root?.visible && gatePreviewVisual?.lights) {
    gatePreviewVisual.currentOpen += (gatePreviewVisual.targetOpen - gatePreviewVisual.currentOpen) * 0.16;
    const pulse = 0.76 + Math.sin(now * 0.004 + gatePreviewVisual.phase) * 0.18;
    gatePreviewVisual.lights.alpha = pulse;
    gatePreviewVisual.beam.alpha = 0.26 + Math.sin(now * 0.003 + gatePreviewVisual.phase) * 0.05;
    gatePreviewVisual.leftDoor.position.set(-48, 0);
    gatePreviewVisual.rightDoor.position.set(48, 0);
  }
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

function createLiteDroneContext(colors) {
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

  return {
    root,
    aura,
    body,
    vehicle,
    engineVector,
    engineGlow,
    miniBeacons,
    rotorSpins,
    shieldShell,
    shieldRing,
    shieldGlyphs,
    shieldPulse,
    orbit,
    minis,
    skin: "cyan",
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
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.body.context = resources.droneContexts[skin] || resources.droneContexts.cyan;
    visual.aura.context = resources.droneAuraContexts[skin] || resources.droneAuraContexts.cyan;
    visual.engineVector.context = resources.engineVectorContexts[skin] || resources.engineVectorContexts.cyan;
    visual.engineGlow.context = resources.engineGlowContexts[skin] || resources.engineGlowContexts.cyan;
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
  }

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
  visual.engineGlow.visible = true;
  visual.engineVector.visible = true;
  visual.engineGlow.position.set(0, 47);
  visual.engineGlow.scale.set(
    (0.94 + throttle * 0.22 + Math.sin(now * 0.010 + visual.hoverSeed) * 0.04) * compactMotionScale,
  );
  visual.engineGlow.alpha =
    (hasMovement ? 0.84 : 0.52) *
    (reducedRemoteVisual ? 0.58 : 1) *
    (safeEffectTier === 2 && !isPlayer ? 0.72 : 1);

  visual.engineVector.position.set(0, 49);
  visual.engineVector.scale.set(
    (0.78 + throttle * 0.38) * compactMotionScale,
    (0.72 + throttle * 0.54 + Math.sin(now * 0.014 + visual.hoverSeed) * 0.08) * compactMotionScale,
  );
  visual.engineVector.alpha =
    (hasMovement ? 0.82 : 0.38) *
    (reducedRemoteVisual ? 0.62 : 1) *
    (safeEffectTier === 2 && !isPlayer ? 0.68 : 1);

  const rotorSpeed = reducedRemoteVisual ? 0.013 : 0.016;
  const rotorAlpha = reducedRemoteVisual ? 0.38 : 0.48;
  visual.rotorSpins.forEach((rotor, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.visible = true;
    rotor.rotation = direction * now * rotorSpeed + index * Math.PI * 0.5;
    rotor.alpha = rotorAlpha;
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
    const miniScale = 1 + Math.sin(now * 0.0045 + index * 1.3) * 0.035;
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
    const pulse = 0.50 + Math.sin(now * 0.0045 + index) * 0.018;
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
  visual.root.scale.set(1.02);
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
  const flightScale = projectile.pierceLeft > 1 ? 1.24 : 1.12;
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
  const miniBeaconContexts = {};
  const projectileAuraContexts = {};
  const projectileJetContexts = {};
  const shieldShellContexts = {};
  const shieldRingContexts = {};
  const shieldGlyphContexts = {};
  const shieldPulseContexts = {};

  Object.entries(SKIN_THEMES).forEach(([skin, colors]) => {
    droneContexts[skin] = createDroneContext(colors);
    miniContexts[skin] = createMiniDroneContext(colors);
    rotorSpinContexts[skin] = createRotorSpinContext(colors);
    droneAuraContexts[skin] = createDroneAuraContext(colors);
    engineGlowContexts[skin] = createEngineGlowContext(colors);
    engineVectorContexts[skin] = createEngineVectorContext(colors);
    miniBeaconContexts[skin] = createMiniBeaconContext(colors);
    projectileAuraContexts[skin] = createProjectileAuraContext(colors);
    projectileJetContexts[skin] = createProjectileJetContext(colors);
    shieldShellContexts[skin] = createShieldShellContext(colors);
    shieldRingContexts[skin] = createShieldRingContext(colors);
    shieldGlyphContexts[skin] = createShieldGlyphContext(colors);
    shieldPulseContexts[skin] = createShieldPulseContext(colors);

    simpleContexts[skin] = createLiteDroneContext(colors);

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
    miniBeaconContexts,
    projectileAuraContexts,
    projectileJetContexts,
    shieldShellContexts,
    shieldRingContexts,
    shieldGlyphContexts,
    shieldPulseContexts,
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


function getAdventureSpaceTexture(cacheKey, size, draw) {
  let texture = WORLD_TERRAIN_TEXTURE_CACHE.get(cacheKey);
  if (texture?.destroyed || texture?.source?.destroyed || texture?.baseTexture?.destroyed) {
    WORLD_TERRAIN_TEXTURE_CACHE.delete(cacheKey);
    texture = null;
  }

  if (texture) return texture;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  draw(ctx, size);
  texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "linear";
  if (texture?.baseTexture) texture.baseTexture.scaleMode = PIXI.SCALE_MODES?.LINEAR ?? "linear";
  WORLD_TERRAIN_TEXTURE_CACHE.set(cacheKey, texture);
  return texture;
}

function createAdventureNebulaTexture() {
  const device = getRendererDeviceProfile(false);
  const size = device.weakDesktop ? 768 : device.mobile ? 1024 : 1536;
  const cacheKey = `adventure-nebula:${device.weakDesktop ? "low" : device.mobile ? "mobile" : "desktop"}:${size}`;

  return getAdventureSpaceTexture(cacheKey, size, (ctx, canvasSize) => {
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const base = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
    base.addColorStop(0, "rgba(4, 9, 18, 0.96)");
    base.addColorStop(0.43, "rgba(8, 17, 31, 0.92)");
    base.addColorStop(1, "rgba(5, 8, 18, 0.96)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const nebula = (x, y, rx, ry, rotation, colors) => {
      ctx.save();
      ctx.translate(x * canvasSize, y * canvasSize);
      ctx.rotate(rotation);
      ctx.scale(rx * canvasSize, ry * canvasSize);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      colors.forEach(([stop, color]) => gradient.addColorStop(stop, color));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Every part of the map receives soft, low-cost deep-space color rather
    // than the old almost-black empty floor. The edges intentionally fade so
    // the repeating texture has no visible seam.
    nebula(0.16, 0.22, 0.62, 0.21, -0.38, [
      [0, "rgba(56, 129, 197, 0.24)"],
      [0.42, "rgba(24, 67, 116, 0.14)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
    nebula(0.82, 0.28, 0.58, 0.20, 0.41, [
      [0, "rgba(142, 76, 212, 0.20)"],
      [0.46, "rgba(64, 31, 118, 0.10)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
    nebula(0.48, 0.80, 0.72, 0.22, -0.10, [
      [0, "rgba(25, 182, 188, 0.18)"],
      [0.50, "rgba(12, 78, 93, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
    nebula(0.12, 0.72, 0.40, 0.14, 0.72, [
      [0, "rgba(64, 94, 188, 0.13)"],
      [0.50, "rgba(24, 32, 86, 0.06)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const vignette = ctx.createRadialGradient(
      canvasSize * 0.5,
      canvasSize * 0.5,
      canvasSize * 0.08,
      canvasSize * 0.5,
      canvasSize * 0.5,
      canvasSize * 0.78,
    );
    vignette.addColorStop(0, "rgba(255, 255, 255, 0.02)");
    vignette.addColorStop(1, "rgba(1, 3, 8, 0.26)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
  });
}

function createAdventureStarfieldTexture(layer = "far") {
  const size = 1024;
  const cacheKey = `adventure-stars:${layer}:${size}`;
  return getAdventureSpaceTexture(cacheKey, size, (ctx, canvasSize) => {
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    let state = layer === "near" ? 0x734b9a1d : 0x4fa85e73;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const count = layer === "near" ? 16 : 42;

    for (let index = 0; index < count; index += 1) {
      const x = random() * canvasSize;
      const y = random() * canvasSize;
      const major = layer === "near" && index % 4 === 0;
      const radius = major ? 2.2 + random() * 1.5 : 0.48 + random() * 0.9;
      const tint = index % 8;
      const color = tint === 0
        ? [170, 219, 255]
        : tint === 1
          ? [210, 184, 255]
          : tint === 2
            ? [255, 231, 171]
            : [218, 240, 255];

      if (major) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 5.4);
        glow.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.46)`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 5.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${major ? 0.90 : 0.55 + random() * 0.33})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (major) {
        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.36)`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - radius * 4.4, y);
        ctx.lineTo(x + radius * 4.4, y);
        ctx.moveTo(x, y - radius * 4.4);
        ctx.lineTo(x, y + radius * 4.4);
        ctx.stroke();
      }
    }
  });
}

function createAdventureTilingSprite(texture, width, height) {
  let sprite;
  try {
    sprite = new PIXI.TilingSprite({ texture, width, height });
  } catch {
    // Compatibility with an older Pixi constructor shape if a project lockfile
    // still resolves an older v8 build.
    sprite = new PIXI.TilingSprite(texture, width, height);
  }
  sprite.eventMode = "none";
  sprite.interactiveChildren = false;
  return sprite;
}

function createAdventureDeepSpaceBackdrop(worldWidth, worldHeight) {
  const width = Math.max(1, Number(worldWidth || DEFAULT_WORLD_WIDTH));
  const height = Math.max(1, Number(worldHeight || DEFAULT_WORLD_HEIGHT));
  const root = new PIXI.Container();
  root.eventMode = "none";
  root.interactiveChildren = false;

  const nebula = createAdventureTilingSprite(createAdventureNebulaTexture(), width, height);
  nebula.alpha = 0.98;
  nebula.tileScale.set(4.6, 4.6);
  nebula.tilePosition.set(178, -264);

  const farStars = createAdventureTilingSprite(createAdventureStarfieldTexture("far"), width, height);
  farStars.alpha = 0.76;
  farStars.tileScale.set(1.0, 1.0);
  farStars.tilePosition.set(71, 193);

  const nearStars = createAdventureTilingSprite(createAdventureStarfieldTexture("near"), width, height);
  nearStars.alpha = 0.64;
  nearStars.tileScale.set(1.72, 1.72);
  nearStars.tilePosition.set(-319, 127);

  // A controlled navy veil prevents the repeated nebula texture from looking
  // too bright beneath structures while still keeping the entire world alive.
  const depthVeil = new PIXI.Graphics();
  depthVeil.eventMode = "none";
  depthVeil.rect(0, 0, width, height).fill({ color: 0x020713, alpha: 0.16 });

  root.addChild(nebula, farStars, nearStars, depthVeil);
  return root;
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
    if (normalizedTheme === ADVENTURE_DEEP_SPACE_THEME) {
      layer.addChild(createAdventureDeepSpaceBackdrop(width, height));
    } else {
      layer.addChild(createPixelTerrainTexture(width, height));
    }
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
  // Adventure is a local mode with its own opt-in celestial visuals.
  adventureStars = [],
  adventureAsteroids = [],
  adventureGenerator = null,
  adventureDefenseTowers = [],
  adventureKraniumTowers = [],
  adventureTowerPreview = null,
  adventureWalls = [],
  adventureGates = [],
  adventureWallPreview = null,
  adventureGatePreview = null,
  adventureDemolitionTarget = null,
  adventureWallShieldHits = [],
  adventureProjectiles = [],
  adventureDebris = [],
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
    adventureStars,
    adventureAsteroids,
    adventureGenerator,
    adventureDefenseTowers,
    adventureKraniumTowers,
    adventureTowerPreview,
    adventureWalls,
    adventureGates,
    adventureWallPreview,
    adventureGatePreview,
    adventureDemolitionTarget,
    adventureWallShieldHits,
    adventureProjectiles,
    adventureDebris,
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
      // terrain -> zone -> items -> projectiles -> entities -> combat is
      // inserted in this exact order below; zIndex sorting is unnecessary.
      world.sortableChildren = false;
      world.zIndex = 1;

      const terrainLayer = new PIXI.Container();
      terrainLayer.eventMode = "none";
      terrainLayer.interactiveChildren = false;
      // The terrain must sit above the plain fallback background and below every
      // gameplay layer. A non-negative zIndex also avoids browser/Pixi edge
      // cases where negative children could be skipped after a context restore.
      terrainLayer.zIndex = 0;

      const zone = new PIXI.Graphics(resources.zoneContext);
      zone.eventMode = "none";
      zone.visible = false;
      zone.zIndex = 1;

      const itemsLayer = new PIXI.Container();
      itemsLayer.eventMode = "none";
      itemsLayer.zIndex = 2;
      const structuresLayer = new PIXI.Container();
      structuresLayer.eventMode = "none";
      structuresLayer.zIndex = 3;
      const projectilesLayer = new PIXI.Container();
      projectilesLayer.eventMode = "none";
      projectilesLayer.zIndex = 4;
      const entitiesLayer = new PIXI.Container();
      entitiesLayer.eventMode = "none";
      entitiesLayer.zIndex = 4;
      const combatLayer = new PIXI.Container();
      combatLayer.eventMode = "none";
      combatLayer.zIndex = 5;

      world.addChild(
        terrainLayer,
        zone,
        itemsLayer,
        structuresLayer,
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
      const adventureStarMap = new Map();
      const adventureAsteroidMap = new Map();
      const adventureWallMap = new Map();
      const adventureGateMap = new Map();
      const adventureWallShieldMap = new Map();
      const adventureDefenseTowerMap = new Map();
      const adventureKraniumTowerMap = new Map();
      let adventureGeneratorVisual = null;
      let adventureTowerPreviewVisual = null;
      let adventureWallPreviewVisual = null;
      let adventureGatePreviewVisual = null;
      let adventureDemolitionTargetVisual = null;
      const adventureProjectileMap = new Map();
      const adventureDebrisMap = new Map();
      const combatTextMap = new Map();
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
        terrainState.key = null;
        terrainState.failedKey = null;
        lastStaticSync = 0;
      };
      onContextRestored = () => {
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
        const data = liveDataRef?.current || latestRef.current;
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

        // Terrain is a single cached sprite. Keep it stable for the whole
        // match instead of toggling it under frame pressure; hiding/re-showing
        // the world texture was the source of the visible background flash.
        // Low-quality/mobile profiles can still start without terrain by
        // explicit configuration, but a visible terrain never blinks.
        const shouldRenderTerrain =
          data.worldTheme === ADVENTURE_DEEP_SPACE_THEME ||
          !config.disableExpensiveTerrain;
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
          const itemBudget = adaptiveItemCap;
          const orbBudget = Math.floor(itemBudget * 0.70);
          const energyBudget = Math.floor(itemBudget * 0.24);
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

          // These are no-ops for every existing mode. Adventure supplies its
          // own arrays so stars/asteroids never alter orb/core visuals elsewhere.
          syncAdventureStars(
            adventureStarMap,
            data.adventureStars || [],
            itemsLayer,
            bounds,
            now,
            Math.min(190, Math.max(60, orbBudget)),
          );
          syncAdventureAsteroids(
            adventureAsteroidMap,
            data.adventureAsteroids || [],
            itemsLayer,
            bounds,
            now,
            Math.min(92, Math.max(32, Math.floor(itemBudget * 0.5))),
          );
        }

        adventureGeneratorVisual = syncAdventureGenerator(
          adventureGeneratorVisual,
          data.adventureGenerator || null,
          structuresLayer,
        );
        syncAdventureDefenseTowers(
          adventureDefenseTowerMap,
          data.adventureDefenseTowers || [],
          structuresLayer,
          bounds,
          now,
          config.lowSpecDesktop || config.weakMobile ? 8 : 16,
        );
        syncAdventureKraniumTowers(
          adventureKraniumTowerMap,
          data.adventureKraniumTowers || [],
          structuresLayer,
          bounds,
          now,
          3,
        );
        adventureTowerPreviewVisual = syncAdventureTowerPreview(
          adventureTowerPreviewVisual,
          data.adventureTowerPreview || null,
          structuresLayer,
        );

        // Walls are few but placement needs instant feedback, so their transforms
        // are synchronized every frame. The pooled cached geometry avoids any draw rebuild.
        syncAdventureWalls(
          adventureWallMap,
          data.adventureWalls || [],
          structuresLayer,
          bounds,
          now,
          160,
        );
        syncAdventureGates(
          adventureGateMap,
          data.adventureGates || [],
          structuresLayer,
          bounds,
          now,
          120,
        );
        adventureWallPreviewVisual = syncAdventureWallPreview(
          adventureWallPreviewVisual,
          data.adventureWallPreview || null,
          structuresLayer,
        );
        adventureGatePreviewVisual = syncAdventureGatePreview(
          adventureGatePreviewVisual,
          data.adventureGatePreview || null,
          structuresLayer,
        );
        adventureDemolitionTargetVisual = syncAdventureDemolitionTarget(
          adventureDemolitionTargetVisual,
          data.adventureDemolitionTarget || null,
          structuresLayer,
        );
        syncAdventureWallShieldHits(
          adventureWallShieldMap,
          data.adventureWallShieldHits || [],
          structuresLayer,
          bounds,
          now,
          config.lowSpecDesktop || config.weakMobile ? 14 : 28,
        );

        syncAdventureDebris(
          adventureDebrisMap,
          data.adventureDebris || [],
          projectilesLayer,
          bounds,
          now,
          config.lowSpecDesktop || config.weakMobile ? 46 : 112,
        );
        animateAdventureVisuals(
          adventureStarMap,
          adventureAsteroidMap,
          adventureProjectileMap,
          adventureWallMap,
          adventureGateMap,
          adventureGeneratorVisual,
          adventureDefenseTowerMap,
          adventureKraniumTowerMap,
          adventureTowerPreviewVisual,
          adventureWallPreviewVisual,
          adventureGatePreviewVisual,
          adventureDemolitionTargetVisual,
          now,
        );
        syncAdventureProjectiles(
          adventureProjectileMap,
          data.adventureProjectiles || [],
          projectilesLayer,
          bounds,
          now,
          config.lowSpecDesktop || config.weakMobile ? 34 : 80,
        );

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
