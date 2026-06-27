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
// Battle Royale keeps the legacy name; Normal / Zone use the explicit alias.
// Both resolve to the same cached premium space-battle visual.
const SPACE_BATTLE_THEMES = new Set([
  PIXEL_TERRAIN_THEME,
  "premium-space-battle",
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
  const lowSpec = device.weakMobile || device.lowSpecDesktop;
  const lightMobile = device.forcedMobileQuality && !device.weakMobile;
  const visualFirstDesktop = device.visualFirstWeakDesktop;

  // Older PCs now start visually close to a good desktop: same terrain,
  // nearby premium drones and readable loot. The adaptive tier reacts to
  // actual sustained frame pressure instead of pre-emptively showing dots.
  const resolution = device.lowSpecDesktop
    ? 0.72
    : device.weakMobile
      ? 0.70
      : visualFirstDesktop
        ? Math.min(0.78, device.dpr)
        : lightMobile
          ? 0.84
          : Math.min(1.35, device.dpr);

  return {
    ...device,
    resolution,
    antialias: !lowSpec && !lightMobile,
    // Weak laptops keep the same recognizable drones, engines and spinning
    // propellers. The savings come from lower internal resolution, smaller
    // nearby premium pool and fewer static pickups, not from turning enemies
    // into points or freezing their animations.
    maxStaticItems: device.lowSpecDesktop ? 50 : device.weakMobile ? 46 : visualFirstDesktop ? 68 : lightMobile ? 54 : 120,
    maxPlayers: device.lowSpecDesktop ? 4 : device.weakMobile ? 3 : visualFirstDesktop ? 7 : lightMobile ? 5 : MAX_RENDERED_PLAYERS,
    maxSimplePlayers: 60,
    maxProjectiles: device.lowSpecDesktop ? 5 : device.weakMobile ? 4 : visualFirstDesktop ? 8 : lightMobile ? 6 : MAX_RENDERED_PROJECTILES,
    maxSimpleProjectiles: device.lowSpecDesktop ? 28 : device.weakMobile ? 24 : visualFirstDesktop ? 30 : lightMobile ? 26 : 48,
    staticSyncInterval: device.lowSpecDesktop ? 500 : device.weakMobile ? 560 : visualFirstDesktop ? 340 : lightMobile ? 400 : STATIC_SYNC_INTERVAL_MS,
    animateStaticEvery: device.lowSpecDesktop ? 8 : device.weakMobile ? 9 : visualFirstDesktop ? 4 : lightMobile ? 5 : 1,
    // Weak desktops keep the same premium space terrain. Only mobile/manual
    // low quality begins without it. Under real sustained load the adaptive
    // tier hides the terrain last-resort and restores it automatically.
    disableExpensiveTerrain: Boolean(device.weakMobile || device.lowSpecDesktop || lightMobile),
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
    hoverSeed: Math.random() * Math.PI * 2,
    lastFrameAt: 0,
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
  const active = new Set();
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


function updateUnitVisual(visual, unit, resources, now, isPlayer, compact = false, effectTier = 0) {
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

function updateSimpleVisual(visual, unit, resources, now, cosmeticIntervalMs = 0) {
  const skin = normalizeSkin(unit.skin);
  const skinChanged = visual.skin !== skin;
  if (skinChanged) {
    visual.skin = skin;
    visual.body.context = resources.simpleContexts[skin] || resources.simpleContexts.cyan;
    visual.engine.context = resources.engineVectorContexts[skin] || resources.engineVectorContexts.cyan;
    for (let index = 0; index < visual.minis.length; index += 1) {
      visual.minis[index].context = resources.miniContexts[skin] || resources.miniContexts.cyan;
    }
    for (let index = 0; index < visual.rotors.length; index += 1) {
      visual.rotors[index].context = resources.rotorSpinContexts[skin] || resources.rotorSpinContexts.cyan;
    }
  }

  const deltaSeconds = clamp((now - (visual.lastFrameAt || now)) / 1000, 1 / 240, 0.05);
  visual.lastFrameAt = now;
  const moveX = Number(unit.moveX || unit.velocityX || 0);
  const moveY = Number(unit.moveY || unit.velocityY || 0);
  const moving = Boolean(unit.isMoving) || Math.hypot(moveX, moveY) > 0.012;

  let targetFacing = visual.facing || 0;
  if (moving) {
    const declaredAngle = Number(unit.moveAngle);
    targetFacing = Number.isFinite(declaredAngle)
      ? declaredAngle + Math.PI * 0.5
      : Math.atan2(moveY, moveX) + Math.PI * 0.5;
  }

  if (!visual.facingReady) {
    visual.facing = targetFacing;
    visual.facingReady = true;
  } else if (moving) {
    visual.facing = dampAngle(visual.facing, targetFacing, 15, deltaSeconds);
  }

  // Root movement and facing stay at display rate. Only the decorative child
  // transforms below may be sampled at 30 Hz on protected low-end profiles.
  // The visible model, engines, propellers and escorts are never removed.
  visual.root.visible = true;
  visual.root.position.set(Number(unit.x || 0), Number(unit.y || 0));
  visual.root.rotation = visual.facing;
  visual.root.scale.set(0.96);
  visual.root.alpha = unit.alive === false ? 0.32 : 0.98;

  const shouldUpdateCosmetics =
    skinChanged ||
    cosmeticIntervalMs <= 0 ||
    now - Number(visual.lastCosmeticAt || 0) >= cosmeticIntervalMs;

  if (shouldUpdateCosmetics) {
    visual.lastCosmeticAt = now;
    const phase = now * 0.0052 + visual.hoverSeed;
    const throttle = moving ? 1 : 0;
    visual.body.position.set(0, Math.sin(phase) * 0.72);
    visual.engine.visible = true;
    visual.engine.scale.set(
      0.36 + throttle * 0.08,
      0.34 + throttle * 0.15 + Math.sin(phase * 1.7) * 0.025,
    );
    visual.engine.alpha = moving ? 0.72 : 0.38;

    for (let index = 0; index < visual.rotors.length; index += 1) {
      const rotor = visual.rotors[index];
      const direction = index % 2 === 0 ? 1 : -1;
      rotor.rotation = direction * now * 0.026 + index * Math.PI * 0.5;
      rotor.alpha = moving ? 0.62 : 0.42;
    }

    // Remote escort drones remain visible on every low-end profile. Their
    // orbit is merely sampled less frequently; the parent drone itself still
    // follows the server/client interpolation every rendered frame.
    const escortCount = Math.min(MAX_MINI_DRONES, Math.max(0, Number(unit.drones || 0)));
    const escortRadius = 56;
    const escortSpin = now * (moving ? 0.00185 : 0.00125) + visual.hoverSeed;
    for (let index = 0; index < visual.minis.length; index += 1) {
      const mini = visual.minis[index];
      const visible = index < escortCount;
      mini.visible = visible;
      if (!visible) continue;

      const angle = (index / Math.max(1, escortCount)) * Math.PI * 2 + escortSpin;
      mini.position.set(
        Math.cos(angle) * escortRadius,
        Math.sin(angle) * escortRadius + Math.sin(now * 0.004 + index * 1.7) * 1.45,
      );
      mini.rotation = Math.sin(now * 0.003 + index) * 0.05;
      const pulse = 0.50 + Math.sin(now * 0.0045 + index) * 0.018;
      mini.scale.set(pulse);
      mini.alpha = 0.93;
    }
  }

  visual.lastSeenAt = now;
}

function updateSimpleProjectileVisual(visual, projectile, resources, now, cosmeticIntervalMs = 0) {
  const skin = normalizeSkin(projectile.skin);
  const skinChanged = visual.skin !== skin;
  if (skinChanged) {
    visual.skin = skin;
    visual.body.context = resources.miniContexts[skin] || resources.miniContexts.cyan;
    for (let index = 0; index < visual.rotors.length; index += 1) {
      visual.rotors[index].context = resources.rotorSpinContexts[skin] || resources.rotorSpinContexts.cyan;
    }
  }

  const heading = Number(
    projectile.angle ??
      Math.atan2(Number(projectile.vy || 0), Number(projectile.vx || 1)),
  );

  // Position/heading remain at display rate; only rotor decoration is sampled
  // less often on weak hardware so fast attack drones never stutter.
  visual.root.visible = true;
  visual.root.position.set(Number(projectile.x || 0), Number(projectile.y || 0));
  visual.root.rotation = heading + Math.PI * 0.5;
  visual.root.scale.set(1.02);
  visual.root.alpha = 0.96;

  const shouldUpdateCosmetics =
    skinChanged ||
    cosmeticIntervalMs <= 0 ||
    now - Number(visual.lastCosmeticAt || 0) >= cosmeticIntervalMs;

  if (shouldUpdateCosmetics) {
    visual.lastCosmeticAt = now;
    const phase = now * 0.017 + visual.flightSeed;
    visual.body.position.set(0, Math.sin(phase) * 0.42);
    for (let index = 0; index < visual.rotors.length; index += 1) {
      const rotor = visual.rotors[index];
      const direction = index % 2 === 0 ? 1 : -1;
      rotor.rotation = direction * now * 0.036 + index * Math.PI * 0.5;
      rotor.alpha = 0.68;
    }
  }
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

  visual.body.position.set(0, compact ? 0 : hover);
  visual.rotorSpins.forEach((rotor, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.visible = true;
    rotor.rotation = direction * now * (compact ? 0.026 : 0.032) + index * Math.PI * 0.5;
    rotor.alpha = compact ? 0.60 : 0.78;
  });
  visual.lastSeenAt = now;
}

function syncUnitPool({
  pool,
  source,
  resources,
  parent,
  bounds,
  max,
  now,
  isPlayer = false,
  compact = false,
  effectTier = 0,
  preCulled = false,
  collectIds = true,
}) {
  // Zone already selects only viewport-visible entries. Reusing that array
  // avoids a second scan and a new `visible` array on every Pixi frame.
  const visible = preCulled ? (source || []) : [];
  let count = 0;
  let ids = collectIds ? new Set() : null;

  if (!preCulled) {
    for (const unit of source || []) {
      if (!unit || unit.alive === false || !isVisibleInBounds(unit, bounds, 320)) continue;
      visible.push(unit);
      if (ids) ids.add(String(unit.id || ""));
      if (visible.length >= max) break;
    }
  } else if (ids) {
    const capped = Math.min(max, visible.length);
    for (let index = 0; index < capped; index += 1) {
      ids.add(String(visible[index]?.id || ""));
    }
  }

  count = Math.min(max, visible.length);
  addToPool(pool, () => createUnitVisual(resources), parent, count);
  for (let index = 0; index < pool.length; index += 1) {
    const unit = index < count ? visible[index] : null;
    const visual = pool[index];
    if (!unit) {
      visual.root.visible = false;
      continue;
    }
    updateUnitVisual(visual, unit, resources, now, isPlayer, compact, effectTier);
  }
  return ids;
}

function syncSimplePool({
  pool,
  source,
  resources,
  parent,
  bounds,
  max,
  now,
  excludeIds = null,
  preCulled = false,
  cosmeticIntervalMs = 0,
}) {
  const visible = preCulled ? (source || []) : [];
  let count = 0;

  if (!preCulled) {
    const seen = new Set();
    for (const unit of source || []) {
      const id = String(unit?.id || "");
      if (!unit || !id || seen.has(id) || (excludeIds && excludeIds.has(id)) || unit.alive === false || !isVisibleInBounds(unit, bounds, 120)) continue;
      seen.add(id);
      visible.push(unit);
      if (visible.length >= max) break;
    }
  }

  count = Math.min(max, visible.length);
  addToPool(pool, () => createSimpleVisual(resources), parent, count);
  for (let index = 0; index < pool.length; index += 1) {
    const unit = index < count ? visible[index] : null;
    const visual = pool[index];
    if (!unit) {
      visual.root.visible = false;
      continue;
    }
    updateSimpleVisual(visual, unit, resources, now, cosmeticIntervalMs);
  }
}

function syncProjectilePool({
  pool,
  source,
  resources,
  parent,
  bounds,
  max,
  now,
  compact = false,
  simple = false,
  excludeIds = null,
  preCulled = false,
  collectIds = true,
  cosmeticIntervalMs = 0,
}) {
  const visible = preCulled ? (source || []) : [];
  const ids = collectIds ? new Set() : null;

  if (!preCulled) {
    for (const projectile of source || []) {
      const id = String(projectile?.id || "");
      if (!projectile || !id || (excludeIds && excludeIds.has(id)) || !isVisibleInBounds(projectile, bounds, 120)) continue;
      visible.push(projectile);
      if (ids) ids.add(id);
      if (visible.length >= max) break;
    }
  } else if (ids) {
    const capped = Math.min(max, visible.length);
    for (let index = 0; index < capped; index += 1) {
      ids.add(String(visible[index]?.id || ""));
    }
  }

  const count = Math.min(max, visible.length);
  addToPool(pool, () => simple ? createSimpleProjectileVisual(resources) : createProjectileVisual(resources), parent, count);
  for (let index = 0; index < pool.length; index += 1) {
    const projectile = index < count ? visible[index] : null;
    const visual = pool[index];
    if (!projectile) {
      visual.root.visible = false;
      continue;
    }
    if (simple) {
      updateSimpleProjectileVisual(visual, projectile, resources, now, cosmeticIntervalMs);
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
  worldTheme = "default",
  // Zone PvP sends viewport-filtered, pre-split arrays through liveDataRef.
  // Keeping this optional preserves the existing behavior for every other mode.
  preCulled = false,
  lockVisualQuality = false,
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
    worldTheme,
    staticItemBudget,
    preCulled,
    lockVisualQuality,
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
        powerPreference: "high-performance",
        preference: "webgl",
      };

      if (typeof app.init === "function") {
        await app.init(initOptions);
      } else {
        app = new PIXI.Application(initOptions);
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
      app.stage.sortableChildren = true;

      const resources = createResources(coreTypes);
      const background = new PIXI.Graphics();
      background.eventMode = "none";
      background.zIndex = 0;

      const world = new PIXI.Container();
      world.eventMode = "none";
      world.interactiveChildren = false;
      world.sortableChildren = true;
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
      const projectilesLayer = new PIXI.Container();
      projectilesLayer.eventMode = "none";
      projectilesLayer.zIndex = 3;
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
      const terrainState = { key: null, failedKey: null };

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

      const setTerrainVisible = (visible) => {
        if (terrainVisibility === visible) return;
        terrainVisibility = visible;
        terrainLayer.visible = visible;
      };

      const getStableAdaptiveTier = () => {
        // Wide hysteresis keeps the renderer stable around 60 FPS. Tier-up
        // reacts after sustained pressure; tier-down waits much longer so the
        // canvas does not resize/rebuild repeatedly while a fight is busy.
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
        if (!app?.renderer || !(config.lowSpecDesktop || config.weakMobile || config.forcedMobileQuality || config.visualFirstWeakDesktop)) return;

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

        // ZonePvpArena sends pre-split viewport arrays and asks us to preserve
        // its current visual quality. The renderer still keeps its normal
        // adaptive path for Battle Royale / Normal PvP.
        const sourcePreCulled = Boolean(data.preCulled);
        const lockVisualQuality = Boolean(data.lockVisualQuality);
        const effectiveAdaptiveTier = lockVisualQuality ? 0 : adaptiveTier;

        const now = performance.now();
        const tickMs = Math.min(80, Math.max(1, Number(app.ticker.deltaMS || 16.7)));
        frameTimeEma = frameTimeEma * 0.92 + tickMs * 0.08;

        const desiredTier = getStableAdaptiveTier();
        if (desiredTier === adaptiveTier) {
          adaptiveCandidateTier = adaptiveTier;
          adaptiveCandidateSince = now;
        } else if (adaptiveCandidateTier !== desiredTier) {
          adaptiveCandidateTier = desiredTier;
          adaptiveCandidateSince = now;
        } else {
          const isTierUp = desiredTier > adaptiveTier;
          const holdMs = isTierUp ? 1800 : 5200;
          if (now - adaptiveCandidateSince >= holdMs) {
            adaptiveTier = desiredTier;
            adaptiveCandidateTier = desiredTier;
            adaptiveCandidateSince = now;
            // Static pools converge only when the stable tier changes, never
            // every few frames. This keeps weak-laptop fights smooth.
            lastStaticSync = 0;
            if (!lockVisualQuality) {
              applyAdaptiveResolution();
            }
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
          const staticBudgetCeiling = config.mobile ? 190 : 300;
          const baseItemBudget = hasRequestedStaticBudget
            ? clamp(Math.round(requestedStaticBudget), 0, staticBudgetCeiling)
            : config.maxStaticItems;
          const adaptiveItemCap =
            effectiveAdaptiveTier === 2
              ? Math.min(baseItemBudget, config.visualFirstWeakDesktop ? 48 : config.lowSpecDesktop ? 30 : 48)
              : effectiveAdaptiveTier === 1
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
        }

        const playerSource = data.player && data.player.alive !== false ? [data.player] : [];
        // Position/heading are still written at display rate. On a protected
        // device only the decorative rotor/escort transforms are sampled at
        // 30 Hz; nothing is hidden or downgraded visually.
        const cosmeticIntervalMs =
          sourcePreCulled && (config.visualFirstWeakDesktop || config.lowSpecDesktop || config.weakMobile)
            ? 33
            : 0;
        const remoteEffectTier = effectiveAdaptiveTier;
        syncUnitPool({
          pool: playerPool,
          source: playerSource,
          resources,
          parent: entitiesLayer,
          bounds,
          max: 1,
          now,
          isPlayer: true,
        });
        const fullUnitCap = sourcePreCulled
          ? Math.max(Number(data.players?.length || 0), Number(data.bots?.length || 0))
          : effectiveAdaptiveTier === 2
            ? Math.min(config.maxPlayers, config.visualFirstWeakDesktop ? 5 : config.lowSpecDesktop || config.weakMobile ? 2 : 3)
            : effectiveAdaptiveTier === 1
              ? Math.min(config.maxPlayers, config.visualFirstWeakDesktop ? 7 : config.lowSpecDesktop || config.weakMobile ? 3 : 5)
              : config.maxPlayers;
        const fullRemoteIds = syncUnitPool({
          pool: remotePool,
          source: data.players,
          resources,
          parent: entitiesLayer,
          bounds,
          max: fullUnitCap,
          now,
          compact: effectiveAdaptiveTier > 0,
          effectTier: remoteEffectTier,
          preCulled: sourcePreCulled,
          collectIds: !sourcePreCulled,
        });
        const fullBotIds = syncUnitPool({
          pool: botPool,
          source: data.bots,
          resources,
          parent: entitiesLayer,
          bounds,
          max: fullUnitCap,
          now,
          compact: effectiveAdaptiveTier > 0,
          effectTier: remoteEffectTier,
          preCulled: sourcePreCulled,
          collectIds: !sourcePreCulled,
        });
        const fullEntityIds = sourcePreCulled
          ? null
          : new Set([...(fullRemoteIds || []), ...(fullBotIds || [])]);
        syncSimplePool({
          pool: simpleBotPool,
          // Zone already excludes premium entries. Other arena modes retain
          // the original merge/filter path.
          source: sourcePreCulled
            ? data.simpleBots
            : [...(data.players || []), ...(data.bots || []), ...(data.simpleBots || [])],
          resources,
          parent: entitiesLayer,
          bounds,
          max: sourcePreCulled
            ? Number(data.simpleBots?.length || 0)
            : config.maxSimplePlayers,
          now,
          excludeIds: fullEntityIds,
          preCulled: sourcePreCulled,
          cosmeticIntervalMs,
        });
        const fullProjectileCap = sourcePreCulled
          ? Number(data.projectiles?.length || 0)
          : effectiveAdaptiveTier === 2
            ? Math.min(config.maxProjectiles, config.visualFirstWeakDesktop ? 5 : config.lowSpecDesktop || config.weakMobile ? 2 : 3)
            : effectiveAdaptiveTier === 1
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
          compact: effectiveAdaptiveTier > 0,
          preCulled: sourcePreCulled,
          collectIds: !sourcePreCulled,
        });
        syncProjectilePool({
          pool: simpleProjectilePool,
          source: sourcePreCulled
            ? data.simpleProjectiles
            : [...(data.projectiles || []), ...(data.simpleProjectiles || [])],
          resources,
          parent: projectilesLayer,
          bounds,
          max: sourcePreCulled
            ? Number(data.simpleProjectiles?.length || 0)
            : config.maxSimpleProjectiles,
          now,
          compact: true,
          simple: true,
          excludeIds: sourcePreCulled ? null : fullProjectileIds,
          preCulled: sourcePreCulled,
          collectIds: false,
          cosmeticIntervalMs,
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
          ? (
              resolvedCombatViewerKey
                ? combatSource.filter(
                    (event) =>
                      String(event?.viewerId || resolvedCombatViewerKey) ===
                      resolvedCombatViewerKey,
                  )
                : []
            )
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
