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
  ctx.circle(0, 0, 11).fill({ color, alpha: 0.98 });
  ctx.circle(-3.5, -4, 3.3).fill({ color: 0xffffff, alpha: 0.55 });
  ctx.circle(0, 0, 11).stroke({ color: 0xffffff, width: 1.5, alpha: 0.18 });
  return ctx;
}

function createEnergyContext() {
  const ctx = new PIXI.GraphicsContext();
  ctx.roundRect(-10, -15, 20, 30, 5).fill({ color: 0x062f20, alpha: 1 });
  ctx.roundRect(-7, -10, 14, 20, 3).fill({ color: 0x5effa7, alpha: 0.96 });
  ctx.poly([2, -9, -5, 1, 0, 1, -3, 9, 6, -3, 1, -3]).fill({ color: 0xf4fff8, alpha: 0.96 });
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

function createStaticVisual(context) {
  const root = new PIXI.Graphics(context);
  return { root, context, lastSeenAt: 0 };
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
      visual = createStaticVisual(context);
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
  };
}

function drawBackground(graphics, width, height) {
  graphics.clear();
  graphics.rect(0, 0, width, height).fill({ color: 0x040b18, alpha: 1 });

  const step = 96;
  const startX = -step;
  const startY = -step;
  for (let x = startX; x <= width + step; x += step) {
    graphics.moveTo(x, 0).lineTo(x, height).stroke({ color: 0x113056, width: 1, alpha: 0.18 });
  }
  for (let y = startY; y <= height + step; y += step) {
    graphics.moveTo(0, y).lineTo(width, y).stroke({ color: 0x113056, width: 1, alpha: 0.18 });
  }

  graphics.circle(width * 0.5, height * 0.42, Math.max(width, height) * 0.5).fill({ color: 0x00314f, alpha: 0.07 });
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
  cameraX = 0,
  cameraY = 0,
  scale = 1,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720,
  coreTypes = [],
  liveDataRef = null,
  forceLowQuality = false,
  worldWidth = DEFAULT_WORLD_WIDTH,
  worldHeight = DEFAULT_WORLD_HEIGHT,
  safeZoneRadius = null,
  showZone = false,
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
    cameraX,
    cameraY,
    scale,
    viewportWidth,
    viewportHeight,
    worldWidth,
    worldHeight,
    safeZoneRadius,
    showZone,
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

      world.addChild(zone, itemsLayer, projectilesLayer, entitiesLayer);
      app.stage.addChild(background, world);

      const staticMap = new Map();
      const playerPool = [];
      const remotePool = [];
      const botPool = [];
      const simpleBotPool = [];
      const projectilePool = [];
      const simpleProjectilePool = [];

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

        setWorldTransform(world, camera.x, camera.y, camera.scale);
        const bounds = getBounds(camera.x, camera.y, camera.scale, width, height, 360);

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
          const itemBudget = config.maxStaticItems;
          const orbBudget = Math.floor(itemBudget * 0.72);
          const energyBudget = Math.floor(itemBudget * 0.2);
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
