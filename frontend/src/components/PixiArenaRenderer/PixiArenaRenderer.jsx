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

function getRendererConfig(forceLowQuality) {
  const mobile = isMobileDevice();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const deviceMemory = typeof navigator !== "undefined" ? Number(navigator.deviceMemory || 0) : 0;
  const cores = typeof navigator !== "undefined" ? Number(navigator.hardwareConcurrency || 4) : 4;
  const weakMobile = mobile && (cores <= 4 || (deviceMemory > 0 && deviceMemory <= 4));

  // Dynamic resolution only reduces the number of pixels the GPU shades; the
  // simulation/ticker stays native rAF to avoid the old 30 FPS stair-step bug.
  // Multiplayer prioritizes stable frame time over extra mobile pixels.
  // At 60 players, a 1x back buffer is far more reliable on Android GPUs.
  const resolution = forceLowQuality || mobile
    ? 1
    : Math.min(1.5, dpr);

  return {
    mobile,
    weakMobile,
    resolution,
    antialias: !(forceLowQuality || mobile || weakMobile),
    maxStaticItems: forceLowQuality || mobile || weakMobile ? 105 : 180,
    maxPlayers: forceLowQuality || weakMobile ? 42 : MAX_RENDERED_PLAYERS,
    maxProjectiles: forceLowQuality || mobile || weakMobile ? 44 : MAX_RENDERED_PROJECTILES,
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

function createSimpleContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.92 });
  ctx.circle(-2.5, -3, 2.5).fill({ color: 0xffffff, alpha: 0.42 });
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
    body,
    vehicle,
    rotorSpins,
    shieldShell,
    shieldRing,
    shieldGlyphs,
    shieldPulse,
    orbit,
    minis,
    skin: "cyan",
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
  const root = new PIXI.Graphics(resources.simpleContext);
  return { root, skin: "", lastSeenAt: 0 };
}

function createProjectileVisual(resources) {
  // Attack drones deliberately reuse the *same* shared mini-drone geometry
  // as the drones orbiting a carrier. This keeps the visual language identical
  // in every mode while still being a single pooled WebGL object per projectile.
  const root = new PIXI.Container();
  root.eventMode = "none";

  const body = new PIXI.Graphics(resources.miniContexts.cyan);
  body.eventMode = "none";
  root.addChild(body);

  return {
    root,
    body,
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

function syncCombatTextLayer({ map, source, resources, parent, bounds, now }) {
  const active = new Set();
  const events = [];

  for (const event of source || []) {
    if (!event?.id || !isVisibleInBounds(event, bounds, 260)) continue;
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

function updateUnitVisual(visual, unit, resources, now, isPlayer, compact = false) {
  const skin = normalizeSkin(unit.skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.body.context = resources.droneContexts[skin] || resources.droneContexts.cyan;
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
  visual.root.scale.set(compact ? 0.76 : isPlayer ? 1.04 : 1);

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

  const rotorSpeed = hasMovement ? 0.037 : 0.016;
  visual.rotorSpins.forEach((rotor, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    rotor.rotation = direction * now * rotorSpeed + index * Math.PI * 0.5;
    rotor.alpha = hasMovement ? 0.7 : 0.48;
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
    const shieldSize = (isPlayer ? 137 : 130) * shieldBreath;
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

  const count = Math.min(MAX_MINI_DRONES, Math.max(0, Number(unit.drones || 0)));
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
    if (!visible) return;

    const angle = (index / Math.max(1, count)) * Math.PI * 2 + spin;
    const miniHover = Math.sin(now * 0.004 + index * 1.9) * 2.5;
    mini.position.set(
      Math.cos(angle) * orbitRadius + aimX,
      Math.sin(angle) * orbitRadius + aimY + miniHover,
    );
    mini.rotation = visual.facing + Math.sin(now * 0.003 + index) * 0.045;
    const miniScale = 1 + Math.sin(now * 0.0045 + index * 1.3) * 0.035;
    mini.scale.set(miniScale);
  });

  visual.lastSeenAt = now;
}

function updateSimpleVisual(visual, unit, resources, now) {
  const skin = normalizeSkin(unit.skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.root.context = resources.simpleContexts[skin] || resources.simpleContexts.cyan;
  }
  visual.root.visible = true;
  visual.root.position.set(Number(unit.x || 0), Number(unit.y || 0));
  visual.root.alpha = 0.84;
  visual.lastSeenAt = now;
}

function updateProjectileVisual(visual, projectile, resources, now) {
  const skin = normalizeSkin(projectile.skin);
  if (visual.skin !== skin) {
    visual.skin = skin;
    visual.body.context = resources.miniContexts[skin] || resources.miniContexts.cyan;
  }

  const heading = Number(
    projectile.angle ??
      Math.atan2(Number(projectile.vy || 0), Number(projectile.vx || 1)),
  );

  // Mini drone artwork faces up in local space; add 90° so its nose points
  // precisely along its real flight vector (angle 0 = moving right).
  const flightScale = projectile.pierceLeft > 1 ? 1.24 : 1.12;
  const hover = Math.sin(now * 0.018 + visual.flightSeed) * 0.7;

  visual.root.visible = true;
  visual.root.position.set(Number(projectile.x || 0), Number(projectile.y || 0));
  visual.root.rotation = heading + Math.PI * 0.5;
  visual.root.scale.set(flightScale);
  visual.root.alpha = projectile.localOnly ? 0.9 : 1;
  visual.body.position.set(0, hover);
  visual.lastSeenAt = now;
}

function syncUnitPool({ pool, source, resources, parent, bounds, max, now, isPlayer = false, compact = false }) {
  const visible = [];
  for (const unit of source || []) {
    if (!unit || unit.alive === false || !isVisibleInBounds(unit, bounds, 320)) continue;
    visible.push(unit);
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
    updateUnitVisual(visual, unit, resources, now, isPlayer, compact);
  }
}

function syncSimplePool({ pool, source, resources, parent, bounds, max, now }) {
  const visible = [];
  for (const unit of source || []) {
    if (!unit || unit.alive === false || !isVisibleInBounds(unit, bounds, 120)) continue;
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
    updateSimpleVisual(visual, unit, resources, now);
  }
}

function syncProjectilePool({ pool, source, resources, parent, bounds, max, now }) {
  const visible = [];
  for (const projectile of source || []) {
    if (!projectile || !isVisibleInBounds(projectile, bounds, 120)) continue;
    visible.push(projectile);
    if (visible.length >= max) break;
  }

  addToPool(pool, () => createProjectileVisual(resources), parent, visible.length);
  for (let index = 0; index < pool.length; index += 1) {
    const projectile = visible[index];
    const visual = pool[index];
    if (!projectile) {
      visual.root.visible = false;
      continue;
    }
    updateProjectileVisual(visual, projectile, resources, now);
  }
}

function createResources(coreTypes = []) {
  const droneContexts = {};
  const miniContexts = {};
  const simpleContexts = {};
  const rotorSpinContexts = {};
  const shieldShellContexts = {};
  const shieldRingContexts = {};
  const shieldGlyphContexts = {};
  const shieldPulseContexts = {};

  Object.entries(SKIN_THEMES).forEach(([skin, colors]) => {
    droneContexts[skin] = createDroneContext(colors);
    miniContexts[skin] = createMiniDroneContext(colors);
    rotorSpinContexts[skin] = createRotorSpinContext(colors);
    shieldShellContexts[skin] = createShieldShellContext(colors);
    shieldRingContexts[skin] = createShieldRingContext(colors);
    shieldGlyphContexts[skin] = createShieldGlyphContext(colors);
    shieldPulseContexts[skin] = createShieldPulseContext(colors);

    const simple = new PIXI.GraphicsContext();
    simple.circle(0, 0, 10).fill({ color: colors[0], alpha: 0.9 });
    simpleContexts[skin] = simple;
  });

  const coreContexts = {};
  coreTypes.forEach((core) => {
    coreContexts[core.type] = createCoreContext(colorFrom(core.color, 0x00eaff));
  });

  return {
    droneContexts,
    miniContexts,
    simpleContexts,
    rotorSpinContexts,
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
  // This is visible only outside the actual world. The Battle Royale terrain
  // itself lives inside the transformed world container, so it follows the
  // camera across the full 14k x 14k map.
  graphics.rect(0, 0, width, height).fill({ color: 0x02070d, alpha: 1 });
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
  // High-end aerial / satellite-like world art for Battle Royale only.
  // Decorative only: no gameplay, pathing, bots, loot or zone logic changes.
  const size = isMobileDevice() ? 2560 : 4096;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;

  let randomState = 0x9d3b7c21;
  const random = () => {
    randomState = (randomState * 1664525 + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const px = (value) => value * size;

  // Deep ocean base with subtle large-scale tonal variation.
  const ocean = ctx.createLinearGradient(0, 0, size, size);
  ocean.addColorStop(0, "#08283c");
  ocean.addColorStop(0.28, "#0b4b68");
  ocean.addColorStop(0.62, "#0f6a84");
  ocean.addColorStop(1, "#0b354d");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, size, size);

  // Satellite-like water depth / current bands.
  for (let index = 0; index < 220; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const rx = px(0.025 + random() * 0.11);
    const ry = rx * (0.45 + random() * 0.65);
    const wash = ctx.createRadialGradient(x, y, 0, x, y, rx);
    wash.addColorStop(0, random() > 0.48 ? "rgba(117, 211, 225, 0.08)" : "rgba(6, 22, 39, 0.08)");
    wash.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((random() - 0.5) * Math.PI);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const createIslandPath = (cx, cy, rx, ry, seed, points = 180) => {
    const list = [];
    for (let index = 0; index < points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const broad = pixelNoise(Math.cos(angle) * 110 + seed, Math.sin(angle) * 110 - seed, 19, seed);
      const fine = pixelNoise(Math.cos(angle) * 280 + seed * 2, Math.sin(angle) * 280 - seed * 2, 37, seed + 17);
      const detail = pixelNoise(Math.cos(angle) * 540 + seed * 3, Math.sin(angle) * 540 - seed * 3, 63, seed + 49);
      const radius = 0.88 + (broad - 0.5) * 0.24 + (fine - 0.5) * 0.09 + (detail - 0.5) * 0.035;
      list.push({ x: cx + Math.cos(angle) * rx * radius, y: cy + Math.sin(angle) * ry * radius });
    }
    const path = new Path2D();
    const first = list[0];
    const last = list[list.length - 1];
    path.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);
    list.forEach((point, index) => {
      const next = list[(index + 1) % list.length];
      path.quadraticCurveTo(point.x, point.y, (point.x + next.x) * 0.5, (point.y + next.y) * 0.5);
    });
    path.closePath();
    return path;
  };

  const drawRoad = (points, width = 12, bright = false) => {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(44, 56, 48, 0.38)";
    ctx.lineWidth = width + 5;
    ctx.stroke();
    const road = ctx.createLinearGradient(points[0][0], points[0][1], points[points.length - 1][0], points[points.length - 1][1]);
    road.addColorStop(0, bright ? "rgba(199, 193, 164, 0.86)" : "rgba(173, 166, 142, 0.84)");
    road.addColorStop(1, bright ? "rgba(149, 145, 124, 0.84)" : "rgba(139, 133, 112, 0.82)");
    ctx.strokeStyle = road;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 246, 214, 0.18)";
    ctx.lineWidth = Math.max(1.2, width * 0.12);
    ctx.stroke();
    ctx.restore();
  };

  const drawRiver = (points, width = 30) => {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(8, 42, 56, 0.34)";
    ctx.lineWidth = width + 18;
    ctx.stroke();
    const river = ctx.createLinearGradient(0, 0, size, size);
    river.addColorStop(0, "#218eb1");
    river.addColorStop(0.45, "#47c2d3");
    river.addColorStop(1, "#1d7697");
    ctx.strokeStyle = river;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = "rgba(210, 253, 255, 0.26)";
    ctx.lineWidth = Math.max(1, width * 0.12);
    ctx.stroke();
    ctx.restore();
  };

  const drawField = (x, y, width, height, angle, colorA, colorB) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const field = ctx.createLinearGradient(-width * 0.5, -height * 0.5, width * 0.5, height * 0.5);
    field.addColorStop(0, colorA);
    field.addColorStop(1, colorB);
    ctx.fillStyle = field;
    ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
    ctx.strokeStyle = "rgba(57, 78, 46, 0.20)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-width * 0.5, -height * 0.5, width, height);
    ctx.strokeStyle = "rgba(255, 251, 226, 0.08)";
    ctx.lineWidth = 1;
    for (let stripe = -width * 0.42; stripe < width * 0.42; stripe += 14) {
      ctx.beginPath();
      ctx.moveTo(stripe, -height * 0.45);
      ctx.lineTo(stripe, height * 0.45);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawForestCluster = (cx, cy, radiusX, radiusY, count = 90) => {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random());
      const x = cx + Math.cos(angle) * radiusX * distance;
      const y = cy + Math.sin(angle) * radiusY * distance;
      const radius = 4 + random() * 12;
      const tree = ctx.createRadialGradient(x - radius * 0.18, y - radius * 0.25, 0, x, y, radius);
      tree.addColorStop(0, random() > 0.55 ? "rgba(104, 156, 90, 0.78)" : "rgba(121, 177, 102, 0.76)");
      tree.addColorStop(0.6, random() > 0.5 ? "rgba(35, 88, 57, 0.86)" : "rgba(41, 100, 63, 0.86)");
      tree.addColorStop(1, "rgba(18, 49, 39, 0.10)");
      ctx.fillStyle = tree;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * (0.8 + random() * 0.4), radius * (0.78 + random() * 0.36), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawVillage = (cx, cy, spread = 36, count = 10) => {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 4 + random() * spread;
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const w = 5 + random() * 8;
      const h = 4 + random() * 6;
      ctx.fillStyle = random() > 0.56 ? "rgba(152, 111, 81, 0.82)" : "rgba(177, 138, 98, 0.82)";
      ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
      ctx.fillStyle = "rgba(118, 68, 54, 0.55)";
      ctx.fillRect(x - w * 0.5, y - h * 0.65, w, h * 0.25);
      if (random() > 0.45) {
        ctx.fillStyle = "rgba(96, 140, 76, 0.55)";
        ctx.fillRect(x + w * 0.45, y - 1, 3, 3);
      }
    }
  };

  const drawCity = (cx, cy, scale = 1) => {
    const radius = 130 * scale;
    const cityShade = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
    cityShade.addColorStop(0, "rgba(195, 209, 205, 0.94)");
    cityShade.addColorStop(0.5, "rgba(110, 130, 129, 0.88)");
    cityShade.addColorStop(1, "rgba(42, 57, 60, 0)");
    ctx.fillStyle = cityShade;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 1.15, radius * 0.92, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dense city fabric.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.16);
    for (let row = -15; row <= 15; row += 1) {
      for (let col = -18; col <= 18; col += 1) {
        if ((row + col) % 7 === 0) continue;
        const blockW = 3 + random() * 5;
        const blockH = 3 + random() * 5;
        const bx = col * 6 + (row % 2) * 1.5;
        const by = row * 5.2;
        ctx.fillStyle = random() > 0.55 ? "rgba(203, 214, 208, 0.86)" : random() > 0.5 ? "rgba(150, 168, 169, 0.88)" : "rgba(101, 122, 123, 0.9)";
        ctx.fillRect(bx - blockW * 0.5, by - blockH * 0.5, blockW, blockH);
      }
    }
    ctx.strokeStyle = "rgba(84, 95, 94, 0.72)";
    ctx.lineWidth = 1.8;
    for (let lane = -11; lane <= 11; lane += 2) {
      ctx.beginPath();
      ctx.moveTo(-110, lane * 6);
      ctx.lineTo(110, lane * 6);
      ctx.stroke();
    }
    for (let lane = -9; lane <= 9; lane += 3) {
      ctx.beginPath();
      ctx.moveTo(lane * 10, -84);
      ctx.lineTo(lane * 10, 84);
      ctx.stroke();
    }
    ctx.restore();
  };

  const islands = [
    { path: createIslandPath(px(0.49), px(0.52), px(0.40), px(0.45), 811), cx: px(0.49), cy: px(0.52), rx: px(0.40), ry: px(0.45) },
    { path: createIslandPath(px(0.18), px(0.22), px(0.16), px(0.14), 917, 120), cx: px(0.18), cy: px(0.22), rx: px(0.16), ry: px(0.14) },
    { path: createIslandPath(px(0.82), px(0.70), px(0.15), px(0.20), 1031, 124), cx: px(0.82), cy: px(0.70), rx: px(0.15), ry: px(0.20) },
    { path: createIslandPath(px(0.46), px(0.87), px(0.17), px(0.11), 1201, 110), cx: px(0.46), cy: px(0.87), rx: px(0.17), ry: px(0.11) },
  ];

  islands.forEach((island, index) => {
    // Shelf / beach shadow.
    ctx.save();
    ctx.shadowColor = "rgba(4, 19, 28, 0.34)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#215f67";
    ctx.fill(island.path);
    ctx.restore();

    // Shallow water rim.
    ctx.save();
    ctx.strokeStyle = "rgba(154, 238, 231, 0.42)";
    ctx.lineWidth = 28;
    ctx.stroke(island.path);
    ctx.strokeStyle = "rgba(237, 216, 156, 0.90)";
    ctx.lineWidth = 16;
    ctx.stroke(island.path);

    const land = ctx.createRadialGradient(
      island.cx - island.rx * 0.24,
      island.cy - island.ry * 0.28,
      island.rx * 0.04,
      island.cx,
      island.cy,
      Math.max(island.rx, island.ry) * 1.08,
    );
    land.addColorStop(0, index === 0 ? "#d5d98a" : "#cad783");
    land.addColorStop(0.28, index === 0 ? "#8dc06f" : "#86ba6d");
    land.addColorStop(0.70, index === 0 ? "#659354" : "#628f56");
    land.addColorStop(1, "#3f6d49");
    ctx.fillStyle = land;
    ctx.fill(island.path);
    ctx.clip(island.path);

    // Gentle terrain shading / elevation.
    for (let patch = 0; patch < 220; patch += 1) {
      const x = island.cx + (random() - 0.5) * island.rx * 1.9;
      const y = island.cy + (random() - 0.5) * island.ry * 1.9;
      const r = 20 + random() * 125;
      const tint = ctx.createRadialGradient(x, y, 0, x, y, r);
      tint.addColorStop(0, random() > 0.54 ? "rgba(231, 233, 173, 0.08)" : "rgba(39, 77, 52, 0.08)");
      tint.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.55 + random() * 0.35), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Agricultural patterns.
    for (let field = 0; field < (index === 0 ? 74 : 26); field += 1) {
      drawField(
        island.cx + (random() - 0.5) * island.rx * 1.42,
        island.cy + (random() - 0.5) * island.ry * 1.38,
        28 + random() * 76,
        18 + random() * 54,
        (random() - 0.5) * 0.9,
        random() > 0.5 ? "rgba(178, 176, 86, 0.34)" : "rgba(114, 157, 81, 0.32)",
        random() > 0.5 ? "rgba(131, 136, 70, 0.24)" : "rgba(92, 126, 67, 0.24)",
      );
    }

    // Forests.
    const forests = index === 0 ? 20 : 8;
    for (let forest = 0; forest < forests; forest += 1) {
      drawForestCluster(
        island.cx + (random() - 0.5) * island.rx * 1.25,
        island.cy + (random() - 0.5) * island.ry * 1.2,
        36 + random() * 110,
        28 + random() * 78,
        42 + Math.floor(random() * 68),
      );
    }

    ctx.restore();
  });

  // Rivers / channels.
  drawRiver([[px(0.19), px(0.10)], [px(0.23), px(0.22)], [px(0.20), px(0.33)], [px(0.25), px(0.45)], [px(0.22), px(0.60)], [px(0.29), px(0.78)]], 32);
  drawRiver([[px(0.03), px(0.54)], [px(0.16), px(0.50)], [px(0.29), px(0.52)], [px(0.42), px(0.47)], [px(0.57), px(0.50)], [px(0.76), px(0.47)], [px(0.99), px(0.52)]], 24);
  drawRiver([[px(0.53), px(0.05)], [px(0.50), px(0.17)], [px(0.55), px(0.28)], [px(0.52), px(0.41)], [px(0.58), px(0.55)], [px(0.56), px(0.70)]], 22);

  // Cities and towns.
  const capital = [px(0.64), px(0.28)];
  drawCity(capital[0], capital[1], 1.2);
  drawCity(px(0.37), px(0.70), 0.64);
  drawCity(px(0.79), px(0.66), 0.56);
  drawVillage(px(0.26), px(0.30), 28, 12);
  drawVillage(px(0.53), px(0.64), 32, 14);
  drawVillage(px(0.17), px(0.63), 22, 9);
  drawVillage(px(0.67), px(0.79), 26, 10);
  drawVillage(px(0.47), px(0.86), 18, 8);

  // Road network.
  drawRoad([capital, [px(0.54), px(0.35)], [px(0.43), px(0.46)], [px(0.31), px(0.53)]], 8, true);
  drawRoad([capital, [px(0.72), px(0.39)], [px(0.79), px(0.52)], [px(0.82), px(0.66)]], 7, true);
  drawRoad([capital, [px(0.58), px(0.48)], [px(0.48), px(0.58)], [px(0.37), px(0.70)]], 8, true);
  drawRoad([[px(0.37), px(0.70)], [px(0.43), px(0.78)], [px(0.47), px(0.87)]], 6);
  drawRoad([[px(0.28), px(0.31)], [px(0.37), px(0.28)], [px(0.48), px(0.25)], capital], 6);
  drawRoad([[px(0.26), px(0.30)], [px(0.31), px(0.34)], [px(0.36), px(0.42)]], 4);
  drawRoad([[px(0.53), px(0.64)], [px(0.48), px(0.60)], [px(0.44), px(0.58)]], 4);
  drawRoad([[px(0.17), px(0.63)], [px(0.22), px(0.58)], [px(0.28), px(0.55)]], 4);
  drawRoad([[px(0.67), px(0.79)], [px(0.70), px(0.73)], [px(0.74), px(0.69)]], 4);

  // Fine cloud haze and shadowing to push the image away from a cartoon look.
  for (let index = 0; index < 42; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = px(0.03 + random() * 0.065);
    const cloudShadow = ctx.createRadialGradient(x, y, 0, x, y, r);
    cloudShadow.addColorStop(0, "rgba(14, 24, 34, 0.06)");
    cloudShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cloudShadow;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.22, y + r * 0.18, r * 1.1, r * 0.58, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();

    const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
    cloud.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    cloud.addColorStop(0.55, "rgba(255, 255, 255, 0.06)");
    cloud.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.52, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(px(0.5), px(0.5), px(0.16), px(0.5), px(0.5), px(0.80));
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.76, "rgba(3, 22, 30, 0.05)");
  vignette.addColorStop(1, "rgba(2, 12, 18, 0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  const texture = PIXI.Texture.from(canvas);
  if (texture?.source) texture.source.scaleMode = "linear";
  if (texture?.baseTexture) texture.baseTexture.scaleMode = PIXI.SCALE_MODES?.LINEAR ?? "linear";

  const sprite = new PIXI.Sprite(texture);
  sprite.position.set(0, 0);
  sprite.width = Math.max(1, Number(worldWidth || DEFAULT_WORLD_WIDTH));
  sprite.height = Math.max(1, Number(worldHeight || DEFAULT_WORLD_HEIGHT));
  sprite.alpha = 0.98;
  sprite.eventMode = "none";
  return sprite;
}

function syncWorldTerrain(layer, state, theme, worldWidth, worldHeight) {
  const normalizedTheme = String(theme || "default");
  const width = Math.max(1, Math.round(Number(worldWidth || DEFAULT_WORLD_WIDTH)));
  const height = Math.max(1, Math.round(Number(worldHeight || DEFAULT_WORLD_HEIGHT)));
  const key = `${normalizedTheme}:${width}:${height}`;
  if (state.key === key) return;

  state.key = key;
  const previous = layer.removeChildren();
  previous.forEach((child) => {
    try {
      child.destroy?.({ children: true, texture: true, textureSource: true });
    } catch {
      child.destroy?.();
    }
  });

  if (normalizedTheme !== PIXEL_TERRAIN_THEME) return;
  layer.addChild(createPixelTerrainTexture(width, height));
}

function safeDestroy(app) {
  try {
    app?.destroy?.(true, { children: true, texture: true, textureSource: true });
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
    combatEvents,
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

      hostRef.current.appendChild(app.canvas || app.view);
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
      terrainLayer.zIndex = -1;

      const zone = new PIXI.Graphics(resources.zoneContext);
      zone.eventMode = "none";
      zone.visible = false;
      zone.zIndex = 0;

      const itemsLayer = new PIXI.Container();
      itemsLayer.eventMode = "none";
      itemsLayer.zIndex = 1;
      const projectilesLayer = new PIXI.Container();
      projectilesLayer.eventMode = "none";
      projectilesLayer.zIndex = 2;
      const entitiesLayer = new PIXI.Container();
      entitiesLayer.eventMode = "none";
      entitiesLayer.zIndex = 3;
      const combatLayer = new PIXI.Container();
      combatLayer.eventMode = "none";
      combatLayer.zIndex = 4;

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
      const terrainState = { key: null };

      let lastStaticSync = 0;
      let lastZoneRadius = null;
      let lastZoneVisible = false;

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
        const width = Number(data.viewportWidth || hostRef.current?.clientWidth || app.renderer.width || window.innerWidth);
        const height = Number(data.viewportHeight || hostRef.current?.clientHeight || app.renderer.height || window.innerHeight);
        const camera = {
          x: Number(data.cameraX || 0),
          y: Number(data.cameraY || 0),
          scale: Math.max(0.1, Number(data.scale || 1)),
        };

        // No game logic is executed here. This only makes a static sprite for
        // Battle Royale and rebuilds it only when the theme or map size changes.
        syncWorldTerrain(
          terrainLayer,
          terrainState,
          data.worldTheme,
          data.worldWidth,
          data.worldHeight,
        );
        setWorldTransform(world, camera.x, camera.y, camera.scale);
        const bounds = getBounds(camera.x, camera.y, camera.scale, width, height, 360);

        // Transform-only pulse animation for loot. This does not touch gameplay
        // state and costs only a few scale/alpha updates for visible pickups.
        animateStaticPickups(staticMap, now);

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

        const staticSyncInterval = config.mobile ? 150 : STATIC_SYNC_INTERVAL_MS;
        if (now - lastStaticSync >= staticSyncInterval) {
          lastStaticSync = now;
          // Normal PvP can request a denser loot budget without changing
          // other game modes. Clamp it to a safe device-specific ceiling.
          const requestedStaticBudget = Number(data.staticItemBudget || 0);
          const staticBudgetCeiling = config.mobile ? 190 : 300;
          const itemBudget = requestedStaticBudget > 0
            ? clamp(Math.round(requestedStaticBudget), 40, staticBudgetCeiling)
            : config.maxStaticItems;
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
        syncUnitPool({
          pool: remotePool,
          source: data.players,
          resources,
          parent: entitiesLayer,
          bounds,
          max: config.maxPlayers,
          now,
          compact: config.weakMobile,
        });
        syncUnitPool({
          pool: botPool,
          source: data.bots,
          resources,
          parent: entitiesLayer,
          bounds,
          max: config.maxPlayers,
          now,
          compact: config.weakMobile,
        });
        syncSimplePool({
          pool: simpleBotPool,
          source: data.simpleBots,
          resources,
          parent: entitiesLayer,
          bounds,
          max: config.weakMobile ? 24 : 60,
          now,
        });
        syncProjectilePool({
          pool: projectilePool,
          source: data.projectiles,
          resources,
          parent: projectilesLayer,
          bounds,
          max: config.maxProjectiles,
          now,
        });
        syncProjectilePool({
          pool: simpleProjectilePool,
          source: data.simpleProjectiles,
          resources,
          parent: projectilesLayer,
          bounds,
          max: Math.floor(config.maxProjectiles * 0.55),
          now,
        });
        syncCombatTextLayer({
          map: combatTextMap,
          source: data.combatEvents,
          resources,
          parent: combatLayer,
          bounds,
          now,
        });
      });
    };

    setup();

    return () => {
      destroyed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      safeDestroy(app);
      if (hostRef.current) hostRef.current.textContent = "";
    };
  }, [coreTypes, forceLowQuality, liveDataRef]);

  return <div ref={hostRef} className="pixi-arena-layer" aria-hidden="true" />;
}

export default PixiArenaRenderer;
