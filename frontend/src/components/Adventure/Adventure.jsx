import { useEffect, useMemo, useRef, useState } from "react";
import PixiArenaRenderer from "../PixiArenaRenderer/PixiArenaRenderer";
import "./Adventure.css";

// Adventure is intentionally local-only: no Socket.IO, room or GameGateway.
// The map side is exactly 10x Battle Royale's 19,000 side length.
const WORLD_WIDTH = 190000;
const WORLD_HEIGHT = 190000;
const START_X = WORLD_WIDTH / 2;
const START_Y = WORLD_HEIGHT / 2;

// Smaller scale = camera farther away. Adventure needs a broader tactical view
// so the initial base, gates and surrounding sector stay readable.
const CAMERA_SCALE_DESKTOP = 0.52;
const CAMERA_SCALE_MOBILE = 0.64;
const PLAYER_SPEED = 2.8 * 60;
const PLAYER_RADIUS = 78;

const STAR_COUNT = 1450;
const ASTEROID_COUNT = 420;
// Solo test build: no bots are spawned or simulated. Keep the remaining
// combat code dormant so bots can be re-enabled later without touching the
// mining/progression system.
const BOT_COUNT = 0;

const STAR_COLLECT_DISTANCE = 135;
const PROJECTILE_SPEED = 760;
const PROJECTILE_MAX_DISTANCE = 2900;
const PROJECTILE_RADIUS = 16;
const FIRE_COOLDOWN_MS = 175;
const ASTEROID_HITS_TO_MINE = 5;
const ASTEROID_DEBRIS_TTL_MS = 920;
const ASTEROID_DEBRIS_MAX = 110;

// Adventure building is local and persistent. Each military wall segment costs
// five Space Stones and snaps endpoint-to-endpoint to existing segments.
const MILITARY_WALL_COST = 5;
const MILITARY_WALL_LENGTH = 480;
const MILITARY_WALL_DEPTH = 116;
const MILITARY_WALL_SNAP_DISTANCE = 190;
const MILITARY_WALL_ROTATION_STEP = Math.PI / 12;
// 32 starter perimeter walls + the existing 100 player-built wall capacity.
const MAX_MILITARY_WALLS = 132;
// Temporary construction stock for layout testing. It is saved locally and
// does not consume Space Stone until all 100 free test segments are used.
const TEST_WALL_STOCK = 100;
const STARBASE_GATE_COST = 5;
const STARBASE_GATE_LENGTH = 420;
const STARBASE_GATE_DEPTH = 136;
const STARBASE_GATE_SNAP_DISTANCE = 220;
const STARBASE_GATE_ROTATION_STEP = Math.PI / 12;
// 2 starter perimeter gates + the existing 100 player-built gate capacity.
const MAX_STARBASE_GATES = 102;
const TEST_GATE_STOCK = 100;
const STARBASE_GATE_OPEN_DISTANCE = 340;
const STARBASE_GATE_OPEN_THRESHOLD = 0.68;
const DEMOLITION_SELECT_MARGIN = 72;
const MILITARY_WALL_COLLISION_PADDING = 7;
const WALL_SHIELD_HIT_TTL_MS = 460;
const WALL_SHIELD_HIT_COOLDOWN_MS = 110;
const MAX_WALL_SHIELD_HITS = 28;
const MILITARY_WALL_MAX_HP = 100;
const STARTER_BASE_WALL_HP = 60;
const STARTER_BASE_WALLS_PER_ARC = 16;

const BOT_SPEED = 116;
const BOT_ATTACK_RANGE = 1500;
const BOT_FIRE_COOLDOWN_MS = 1800;
const BOT_PROJECTILE_DAMAGE = 7;
const PLAYER_PROJECTILE_DAMAGE = 20;
const BOT_MAX_HP = 60;
const PLAYER_MAX_HP = 100;
const PLAYER_MAX_ENERGY = 100;
const GENERATOR_MAX_HP = 1000;
// The drone spawns beside the reactor, not inside it. It is close enough to
// charge immediately, but far enough from the larger visual footprint to fly freely.
const PLAYER_SPAWN_OFFSET_X = 440;
const PLAYER_SPAWN_OFFSET_Y = 0;
const GENERATOR_RECHARGE_DISTANCE = 520;
const GENERATOR_RECHARGE_INTERVAL_MS = 5000;
const MOVEMENT_ENERGY_DRAIN_INTERVAL_MS = 10000;

// Shop structures stay local to Adventure. Their visuals are rendered only by
// the Adventure branch inside PixiArenaRenderer.
const DEFENSE_TOWER_RADIUS = 122;
const DEFENSE_TOWER_RANGE = 1650;
const DEFENSE_TOWER_FIRE_COOLDOWN_MS = 2000;
const DEFENSE_TOWER_PROJECTILE_SPEED = 920;
const DEFENSE_TOWER_DAMAGE = 1;
const KRANIUM_TOWER_RADIUS = 132;
// Physical collision footprints. These are intentionally a little larger than
// the decorative silhouettes, so the player cannot visually clip into a base
// structure while flying at full speed.
const GENERATOR_COLLISION_RADIUS = 292;
const TOWER_COLLISION_PADDING = 18;
const MAX_DEFENSE_TOWERS = 9999;
const MAX_KRANIUM_TOWERS = 9999;
const KRANIUM_GENERATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTER_BASE_RADIUS = (
  STARBASE_GATE_LENGTH * 2 +
  STARTER_BASE_WALLS_PER_ARC * MILITARY_WALL_LENGTH * 2
) / (Math.PI * 2);
const TOWER_BASE_EDGE_PADDING = 250;
const TOWER_GENERATOR_CLEARANCE = 330;
// Generator Map is intentionally a close tactical view of the base, rather
// than a 190,000-unit world map where the perimeter would be only a few pixels.
const GENERATOR_MAP_HALF_SPAN = STARTER_BASE_RADIUS + 880;

// v4 starts every Expedition with a protected perimeter around its generator.
const SAVE_VERSION = 4;
const PREVIOUS_SAVE_VERSION = 3;
const SAVE_INTERVAL_MS = 800;
const HUD_INTERVAL_MS = 100;

const STAR_COLORS = ["cyan", "gold", "violet", "mint"];

// Important: this reference must stay stable. PixiArenaRenderer owns a WebGL
// app in a useEffect keyed by coreTypes; an inline [] would recreate the
// canvas whenever the HUD refreshes and causes the full image to blink.
const ADVENTURE_CORE_TYPES = Object.freeze([]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getKraniumProductionStatus(towers, now = Date.now()) {
  const activeTowers = Array.isArray(towers) ? towers.filter(Boolean) : [];
  if (activeTowers.length === 0) {
    return { active: false, count: 0, remainingMs: 0 };
  }

  let shortestRemainingMs = KRANIUM_GENERATION_INTERVAL_MS;
  for (const tower of activeTowers) {
    const lastAt = Math.max(0, Number(tower?.lastKraniumAt || now));
    const elapsed = Math.max(0, now - lastAt);
    const progressInCycle = elapsed % KRANIUM_GENERATION_INTERVAL_MS;
    const remainingMs = progressInCycle === 0 && elapsed > 0
      ? KRANIUM_GENERATION_INTERVAL_MS
      : Math.max(0, KRANIUM_GENERATION_INTERVAL_MS - progressInCycle);
    shortestRemainingMs = Math.min(shortestRemainingMs, remainingMs);
  }

  return { active: true, count: activeTowers.length, remainingMs: shortestRemainingMs };
}

function formatKraniumCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function distanceSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getDisplayName(user) {
  return user?.username || user?.firstName || user?.email?.split("@")?.[0] || "Pilot";
}

function getSelectedSkin(user) {
  if (user?.isGuest) return "cyan";
  const value = String(
    user?.selectedSkin ||
      user?.selectedDroneSkin ||
      user?.selectedDrone ||
      user?.skin ||
      "cyan",
  )
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  return !value || value === "basic" || value === "basic-drone" ? "cyan" : value;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
}

function getAdventureAccountKey(user) {
  // Adventure has no backend by design. Guests therefore use one stable
  // browser-local save slot instead of the short-lived matchmaking guest key.
  return user?.isGuest
    ? "guest-browser"
    : user?.id || user?.userId || user?.email || user?.username || "pilot";
}

function getAdventureSaveKeyForVersion(user, version) {
  return `drone-swarm-adventure-v${version}:${String(getAdventureAccountKey(user))}`;
}

function getAdventureSaveKey(user) {
  return getAdventureSaveKeyForVersion(user, SAVE_VERSION);
}

function makeStar(x, y) {
  return {
    id: randomId("star"),
    x,
    y,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  };
}

function makeAsteroid(x, y) {
  return {
    id: randomId("asteroid"),
    x,
    y,
    radius: Math.round(randomBetween(84, 142)),
    hits: 0,
    rotation: randomBetween(0, Math.PI * 2),
    rotationSpeed: randomBetween(-0.00022, 0.00022),
    bobPhase: randomBetween(0, Math.PI * 2),
    tone: Math.floor(Math.random() * 4),
    visualVariant: Math.floor(randomBetween(0, 4)),
    lastHitAt: 0,
    impactAngle: 0,
  };
}

function makeBot(index, x, y) {
  const skins = [
    "red",
    "purple",
    "orange",
    "green",
    "pink",
    "ice-blue",
    "solar-gold",
    "void-purple",
  ];

  return {
    id: `adventure-bot-${index}`,
    username: `Rogue-${index + 1}`,
    x,
    y,
    hp: BOT_MAX_HP,
    maxHp: BOT_MAX_HP,
    alive: true,
    drones: 0,
    skin: skins[index % skins.length],
    moveX: 0,
    moveY: 0,
    moveAngle: 0,
    isMoving: false,
    targetX: x,
    targetY: y,
    lastRetargetAt: 0,
    lastShotAt: 0,
    respawnAt: 0,
  };
}

function createAdventureGenerator() {
  return {
    id: "adventure-generator",
    x: START_X,
    y: START_Y,
    hp: GENERATOR_MAX_HP,
    maxHp: GENERATOR_MAX_HP,
  };
}

function createInitialAdventureInventory() {
  return {
    starAmmo: 0,
    totalStars: 0,
    spaceStone: 0,
    kranium: 0,
    asteroidsMined: 0,
    testWallStock: TEST_WALL_STOCK,
    testGateStock: TEST_GATE_STOCK,
  };
}

function getTowerRadius(type) {
  return type === "kranium" ? KRANIUM_TOWER_RADIUS : DEFENSE_TOWER_RADIUS;
}

function createDefenseTower(x, y) {
  return {
    id: randomId("defense-tower"),
    type: "defense",
    x: clamp(Number(x || START_X), 260, WORLD_WIDTH - 260),
    y: clamp(Number(y || START_Y), 260, WORLD_HEIGHT - 260),
    radius: DEFENSE_TOWER_RADIUS,
    rotation: 0,
    hp: 100,
    maxHp: 100,
    targetId: null,
    lastShotAt: 0,
    recoilUntil: 0,
  };
}

function createKraniumTower(x, y) {
  return {
    id: randomId("kranium-tower"),
    type: "kranium",
    x: clamp(Number(x || START_X), 260, WORLD_WIDTH - 260),
    y: clamp(Number(y || START_Y), 260, WORLD_HEIGHT - 260),
    radius: KRANIUM_TOWER_RADIUS,
    rotation: 0,
    hp: 100,
    maxHp: 100,
    lastKraniumAt: Date.now(),
    createdAt: Date.now(),
  };
}

function createAdventurePlayer(username, skin, overrides = {}) {
  const spawnX = START_X + PLAYER_SPAWN_OFFSET_X;
  const spawnY = START_Y + PLAYER_SPAWN_OFFSET_Y;
  return {
    id: "adventure-player",
    username,
    x: clamp(finiteOr(overrides.x, spawnX), PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
    y: clamp(finiteOr(overrides.y, spawnY), PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
    hp: clamp(finiteOr(overrides.hp, PLAYER_MAX_HP), 1, PLAYER_MAX_HP),
    maxHp: PLAYER_MAX_HP,
    energy: clamp(finiteOr(overrides.energy, PLAYER_MAX_ENERGY), 0, PLAYER_MAX_ENERGY),
    maxEnergy: PLAYER_MAX_ENERGY,
    alive: true,
    drones: 0,
    skin,
    moveX: 0,
    moveY: 0,
    moveAngle: finiteOr(overrides.moveAngle, 0),
    isMoving: false,
  };
}

function makeWorld() {
  const stars = [];
  const asteroids = [];
  const bots = [];

  // A rich first sector around the starting point, followed by a vast map of
  // distant clusters. The world is huge without feeling empty at spawn.
  for (let index = 0; index < STAR_COUNT; index += 1) {
    const nearStart = index < 210;
    const centerX = nearStart ? START_X : randomBetween(6000, WORLD_WIDTH - 6000);
    const centerY = nearStart ? START_Y : randomBetween(6000, WORLD_HEIGHT - 6000);
    const radius = nearStart ? randomBetween(400, 7200) : randomBetween(0, 7600);
    const angle = randomBetween(0, Math.PI * 2);
    stars.push(
      makeStar(
        clamp(centerX + Math.cos(angle) * radius, 320, WORLD_WIDTH - 320),
        clamp(centerY + Math.sin(angle) * radius, 320, WORLD_HEIGHT - 320),
      ),
    );
  }

  for (let index = 0; index < ASTEROID_COUNT; index += 1) {
    const nearStart = index < 40;
    const centerX = nearStart ? START_X : randomBetween(6500, WORLD_WIDTH - 6500);
    const centerY = nearStart ? START_Y : randomBetween(6500, WORLD_HEIGHT - 6500);
    const radius = nearStart ? randomBetween(1100, 8200) : randomBetween(0, 9000);
    const angle = randomBetween(0, Math.PI * 2);
    asteroids.push(
      makeAsteroid(
        clamp(centerX + Math.cos(angle) * radius, 560, WORLD_WIDTH - 560),
        clamp(centerY + Math.sin(angle) * radius, 560, WORLD_HEIGHT - 560),
      ),
    );
  }

  for (let index = 0; index < BOT_COUNT; index += 1) {
    const nearStart = index < 5;
    const angle = randomBetween(0, Math.PI * 2);
    const radius = nearStart ? randomBetween(1800, 7000) : randomBetween(9000, 60000);
    bots.push(
      makeBot(
        index,
        clamp(START_X + Math.cos(angle) * radius, 500, WORLD_WIDTH - 500),
        clamp(START_Y + Math.sin(angle) * radius, 500, WORLD_HEIGHT - 500),
      ),
    );
  }

  return { stars, asteroids, bots };
}

function normalizeSavedArray(value) {
  return Array.isArray(value) ? value : null;
}

function loadProgress(saveKey, skin, username) {
  try {
    const parsed = JSON.parse(localStorage.getItem(saveKey) || "null");
    if (
      !parsed ||
      parsed.version !== SAVE_VERSION ||
      !normalizeSavedArray(parsed.stars) ||
      !normalizeSavedArray(parsed.asteroids)
    ) {
      return null;
    }

    const player = parsed.player || {};
    return {
      stars: parsed.stars,
      asteroids: parsed.asteroids,
      player: createAdventurePlayer(username, skin, {
        x: player.x,
        y: player.y,
        hp: player.hp,
        energy: player.energy,
        moveAngle: player.moveAngle,
      }),
      inventory: {
        starAmmo: Math.max(0, Math.floor(Number(parsed?.inventory?.starAmmo || 0))),
        totalStars: Math.max(0, Math.floor(Number(parsed?.inventory?.totalStars || 0))),
        spaceStone: Math.max(0, Math.floor(Number(parsed?.inventory?.spaceStone || 0))),
        kranium: Math.max(0, Math.floor(Number(parsed?.inventory?.kranium || 0))),
        asteroidsMined: Math.max(0, Math.floor(Number(parsed?.inventory?.asteroidsMined || 0))),
        testWallStock: Number.isFinite(Number(parsed?.inventory?.testWallStock))
          ? clamp(Math.floor(Number(parsed.inventory.testWallStock)), 0, TEST_WALL_STOCK)
          : TEST_WALL_STOCK,
        testGateStock: Number.isFinite(Number(parsed?.inventory?.testGateStock))
          ? clamp(Math.floor(Number(parsed.inventory.testGateStock)), 0, TEST_GATE_STOCK)
          : TEST_GATE_STOCK,
      },
      generator: {
        ...createAdventureGenerator(),
        ...parsed?.generator,
        x: clamp(finiteOr(parsed?.generator?.x, START_X), PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
        y: clamp(finiteOr(parsed?.generator?.y, START_Y), PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        hp: clamp(finiteOr(parsed?.generator?.hp, GENERATOR_MAX_HP), 0, GENERATOR_MAX_HP),
        maxHp: GENERATOR_MAX_HP,
      },
      walls: sanitizeSavedWalls(parsed?.walls),
      gates: sanitizeSavedGates(parsed?.gates),
      defenseTowers: sanitizeSavedDefenseTowers(parsed?.defenseTowers),
      kraniumTowers: sanitizeSavedKraniumTowers(parsed?.kraniumTowers),
    };
  } catch {
    return null;
  }
}

function createAdventureProjectile({ x, y, dx, dy, team, skin, ownerId, speed = PROJECTILE_SPEED, damage = null }) {
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;

  return {
    id: randomId(team === "player" ? "nova" : "raider"),
    x,
    y,
    previousX: x,
    previousY: y,
    vx: unitX * Number(speed || PROJECTILE_SPEED),
    vy: unitY * Number(speed || PROJECTILE_SPEED),
    angle: Math.atan2(unitY, unitX),
    traveled: 0,
    team,
    ownerId,
    skin,
    adventureBolt: true,
    damage: damage == null ? null : Math.max(0, Number(damage || 0)),
  };
}

function distanceToSegmentSq(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLengthSq = abx * abx + aby * aby;

  if (abLengthSq <= 0.0001) return distanceSq(px, py, ax, ay);

  const projection = clamp(((px - ax) * abx + (py - ay) * aby) / abLengthSq, 0, 1);
  const cx = ax + abx * projection;
  const cy = ay + aby * projection;
  return distanceSq(px, py, cx, cy);
}

function findNearestAimDirection(player, mouse, camera, scale) {
  const worldX = (mouse.x - camera.x) / scale;
  const worldY = (mouse.y - camera.y) / scale;
  const dx = worldX - player.x;
  const dy = worldY - player.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function getWorldPointerPosition(mouse, camera) {
  const scale = Math.max(0.1, Number(camera?.scale || 1));
  return {
    x: (Number(mouse?.x || 0) - Number(camera?.x || 0)) / scale,
    y: (Number(mouse?.y || 0) - Number(camera?.y || 0)) / scale,
  };
}

function createMilitaryWall(x, y, rotation = 0) {
  return {
    id: randomId("military-wall"),
    x: clamp(Number(x || START_X), 260, WORLD_WIDTH - 260),
    y: clamp(Number(y || START_Y), 260, WORLD_HEIGHT - 260),
    rotation: Number(rotation || 0),
    length: MILITARY_WALL_LENGTH,
    depth: MILITARY_WALL_DEPTH,
    hp: MILITARY_WALL_MAX_HP,
    maxHp: MILITARY_WALL_MAX_HP,
  };
}

function createMilitaryGate(x, y, rotation = 0) {
  return {
    id: randomId("starbase-gate"),
    x: clamp(Number(x || START_X), 260, WORLD_WIDTH - 260),
    y: clamp(Number(y || START_Y), 260, WORLD_HEIGHT - 260),
    rotation: Number(rotation || 0),
    length: STARBASE_GATE_LENGTH,
    depth: STARBASE_GATE_DEPTH,
    hp: MILITARY_WALL_MAX_HP,
    maxHp: MILITARY_WALL_MAX_HP,
    openAmount: 0,
    targetOpen: 0,
  };
}

// Each fresh local Adventure run receives this same large perimeter around
// the generator: two opposite gates and 32 vulnerable starter wall segments.
// It is generated from segment lengths rather than random points, so the ring
// closes cleanly and both gates sit exactly opposite each other.
function createStarterStarbasePerimeter(generator = createAdventureGenerator()) {
  const pieces = [
    { type: "gate", length: STARBASE_GATE_LENGTH },
    ...Array.from({ length: STARTER_BASE_WALLS_PER_ARC }, () => ({ type: "wall", length: MILITARY_WALL_LENGTH })),
    { type: "gate", length: STARBASE_GATE_LENGTH },
    ...Array.from({ length: STARTER_BASE_WALLS_PER_ARC }, () => ({ type: "wall", length: MILITARY_WALL_LENGTH })),
  ];

  const perimeterLength = pieces.reduce((total, piece) => total + piece.length, 0);
  const radius = perimeterLength / (Math.PI * 2);
  let arcCursor = -STARBASE_GATE_LENGTH * 0.5;
  const walls = [];
  const gates = [];

  for (const piece of pieces) {
    const centerArc = arcCursor + piece.length * 0.5;
    const angle = centerArc / radius;
    const x = generator.x + Math.cos(angle) * radius;
    const y = generator.y + Math.sin(angle) * radius;
    const rotation = angle + Math.PI * 0.5;

    if (piece.type === "gate") {
      const gate = createMilitaryGate(x, y, rotation);
      gate.isStarterBase = true;
      gates.push(gate);
    } else {
      const wall = createMilitaryWall(x, y, rotation);
      // Starter walls are intentionally weak from the first second. Player-built
      // wall segments remain 100/100 HP, exactly as before.
      wall.hp = STARTER_BASE_WALL_HP;
      wall.maxHp = STARTER_BASE_WALL_HP;
      wall.isStarterBase = true;
      walls.push(wall);
    }

    arcCursor += piece.length;
  }

  return { walls, gates };
}

function getMilitaryGateEndpoints(gate) {
  const length = Math.max(120, Number(gate?.length || STARBASE_GATE_LENGTH));
  const half = length * 0.5;
  const rotation = Number(gate?.rotation || 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const x = Number(gate?.x || 0);
  const y = Number(gate?.y || 0);

  return [
    { x: x - cos * half, y: y - sin * half },
    { x: x + cos * half, y: y + sin * half },
  ];
}

function getSnapAnchors(walls = [], gates = []) {
  const anchors = [];
  for (const wall of walls || []) {
    for (const point of getMilitaryWallEndpoints(wall)) anchors.push(point);
  }
  for (const gate of gates || []) {
    for (const point of getMilitaryGateEndpoints(gate)) anchors.push(point);
  }
  return anchors;
}

function getMilitaryWallEndpoints(wall) {
  const length = Math.max(80, Number(wall?.length || MILITARY_WALL_LENGTH));
  const half = length * 0.5;
  const rotation = Number(wall?.rotation || 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const x = Number(wall?.x || 0);
  const y = Number(wall?.y || 0);

  return [
    { x: x - cos * half, y: y - sin * half },
    { x: x + cos * half, y: y + sin * half },
  ];
}

function snapMilitaryWall(candidate, walls = [], gates = []) {
  // Walls use the exact same endpoint pool as gates. This is what lets one
  // wall lock to the left gate pylon and another wall lock to the right pylon,
  // creating a continuous Starbase perimeter without any special placement mode.
  const candidateEnds = getMilitaryWallEndpoints(candidate);
  const anchors = getSnapAnchors(walls, gates);
  let best = null;

  for (const existingEnd of anchors) {
    for (const candidateEnd of candidateEnds) {
      const distance = Math.hypot(existingEnd.x - candidateEnd.x, existingEnd.y - candidateEnd.y);
      if (distance > MILITARY_WALL_SNAP_DISTANCE) continue;
      if (!best || distance < best.distance) {
        best = { existingEnd, candidateEnd, distance };
      }
    }
  }

  if (!best) return { ...candidate, snapped: false };

  return {
    ...candidate,
    x: candidate.x + (best.existingEnd.x - best.candidateEnd.x),
    y: candidate.y + (best.existingEnd.y - best.candidateEnd.y),
    snapped: true,
  };
}

function snapMilitaryGate(candidate, walls = [], gates = []) {
  const anchors = getSnapAnchors(walls, gates);
  const candidateEnds = getMilitaryGateEndpoints(candidate);
  let bestPair = null;

  for (let index = 0; index < anchors.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < anchors.length; nextIndex += 1) {
      const a = anchors[index];
      const b = anchors[nextIndex];
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      if (Math.abs(span - STARBASE_GATE_LENGTH) > 180) continue;
      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;
      const midpointDistance = Math.hypot(midX - candidate.x, midY - candidate.y);
      const endDistanceA = Math.min(
        Math.hypot(a.x - candidateEnds[0].x, a.y - candidateEnds[0].y),
        Math.hypot(a.x - candidateEnds[1].x, a.y - candidateEnds[1].y),
      );
      const endDistanceB = Math.min(
        Math.hypot(b.x - candidateEnds[0].x, b.y - candidateEnds[0].y),
        Math.hypot(b.x - candidateEnds[1].x, b.y - candidateEnds[1].y),
      );
      if (endDistanceA > STARBASE_GATE_SNAP_DISTANCE || endDistanceB > STARBASE_GATE_SNAP_DISTANCE) continue;
      if (!bestPair || midpointDistance < bestPair.midpointDistance) {
        bestPair = { a, b, midpointDistance };
      }
    }
  }

  if (bestPair) {
    return {
      ...candidate,
      x: (bestPair.a.x + bestPair.b.x) * 0.5,
      y: (bestPair.a.y + bestPair.b.y) * 0.5,
      rotation: Math.atan2(bestPair.b.y - bestPair.a.y, bestPair.b.x - bestPair.a.x),
      snapped: true,
    };
  }

  let bestSingle = null;
  for (const anchor of anchors) {
    for (const candidateEnd of candidateEnds) {
      const distance = Math.hypot(anchor.x - candidateEnd.x, anchor.y - candidateEnd.y);
      if (distance > STARBASE_GATE_SNAP_DISTANCE) continue;
      if (!bestSingle || distance < bestSingle.distance) {
        bestSingle = { anchor, candidateEnd, distance };
      }
    }
  }

  if (!bestSingle) return { ...candidate, snapped: false };
  return {
    ...candidate,
    x: candidate.x + (bestSingle.anchor.x - bestSingle.candidateEnd.x),
    y: candidate.y + (bestSingle.anchor.y - bestSingle.candidateEnd.y),
    snapped: true,
  };
}

function sanitizeSavedWalls(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((wall) => Number.isFinite(Number(wall?.x)) && Number.isFinite(Number(wall?.y)))
    .slice(0, MAX_MILITARY_WALLS)
    .map((wall) => ({
      id: String(wall?.id || randomId("military-wall")),
      x: clamp(Number(wall.x), 260, WORLD_WIDTH - 260),
      y: clamp(Number(wall.y), 260, WORLD_HEIGHT - 260),
      rotation: Number.isFinite(Number(wall?.rotation)) ? Number(wall.rotation) : 0,
      length: MILITARY_WALL_LENGTH,
      depth: MILITARY_WALL_DEPTH,
      hp: clamp(Math.floor(Number(wall?.hp ?? MILITARY_WALL_MAX_HP)), 0, MILITARY_WALL_MAX_HP),
      maxHp: MILITARY_WALL_MAX_HP,
    }));
}

function sanitizeSavedGates(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((gate) => Number.isFinite(Number(gate?.x)) && Number.isFinite(Number(gate?.y)))
    .slice(0, MAX_STARBASE_GATES)
    .map((gate) => ({
      id: String(gate?.id || randomId("starbase-gate")),
      x: clamp(Number(gate.x), 260, WORLD_WIDTH - 260),
      y: clamp(Number(gate.y), 260, WORLD_HEIGHT - 260),
      rotation: Number.isFinite(Number(gate?.rotation)) ? Number(gate.rotation) : 0,
      length: STARBASE_GATE_LENGTH,
      depth: STARBASE_GATE_DEPTH,
      hp: clamp(Math.floor(Number(gate?.hp ?? MILITARY_WALL_MAX_HP)), 0, MILITARY_WALL_MAX_HP),
      maxHp: MILITARY_WALL_MAX_HP,
      openAmount: clamp(Number(gate?.openAmount || 0), 0, 1),
      targetOpen: 0,
    }));
}

function sanitizeSavedDefenseTowers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tower) => Number.isFinite(Number(tower?.x)) && Number.isFinite(Number(tower?.y)))
        .map((tower) => ({
      id: String(tower?.id || randomId("defense-tower")),
      type: "defense",
      x: clamp(Number(tower.x), 260, WORLD_WIDTH - 260),
      y: clamp(Number(tower.y), 260, WORLD_HEIGHT - 260),
      radius: DEFENSE_TOWER_RADIUS,
      rotation: finiteOr(tower?.rotation, 0),
      targetId: tower?.targetId ? String(tower.targetId) : null,
      lastShotAt: 0,
      recoilUntil: 0,
    }));
}

function sanitizeSavedKraniumTowers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tower) => Number.isFinite(Number(tower?.x)) && Number.isFinite(Number(tower?.y)))
        .map((tower) => ({
      id: String(tower?.id || randomId("kranium-tower")),
      type: "kranium",
      x: clamp(Number(tower.x), 260, WORLD_WIDTH - 260),
      y: clamp(Number(tower.y), 260, WORLD_HEIGHT - 260),
      radius: KRANIUM_TOWER_RADIUS,
      rotation: finiteOr(tower?.rotation, 0),
      hp: clamp(Math.floor(finiteOr(tower?.hp, 100)), 0, 100),
      maxHp: 100,
      lastKraniumAt: Math.max(0, finiteOr(tower?.lastKraniumAt, Date.now())),
      createdAt: Math.max(0, finiteOr(tower?.createdAt, Date.now())),
    }));
}

function getTowerPlacementCandidate(type, x, y, generator, walls = [], gates = [], defenseTowers = [], kraniumTowers = []) {
  const radius = getTowerRadius(type);
  const candidate = {
    id: `preview-${type}`,
    type,
    x: clamp(Number(x || START_X), radius, WORLD_WIDTH - radius),
    y: clamp(Number(y || START_Y), radius, WORLD_HEIGHT - radius),
    radius,
    rotation: 0,
    valid: true,
    blockedReason: "",
  };
  const baseCenterX = Number(generator?.x || START_X);
  const baseCenterY = Number(generator?.y || START_Y);
  const distanceFromBase = Math.hypot(candidate.x - baseCenterX, candidate.y - baseCenterY);

  if (distanceFromBase > STARTER_BASE_RADIUS - radius - TOWER_BASE_EDGE_PADDING) {
    candidate.valid = false;
    candidate.blockedReason = "PLACE INSIDE STARBASE";
    return candidate;
  }

  if (distanceFromBase < TOWER_GENERATOR_CLEARANCE + radius) {
    candidate.valid = false;
    candidate.blockedReason = "KEEP CLEAR OF GENERATOR";
    return candidate;
  }

  const overlapsStructure = (structure, fallbackLength, fallbackDepth) => {
    const endpoints = fallbackLength === STARBASE_GATE_LENGTH
      ? getMilitaryGateEndpoints(structure)
      : getMilitaryWallEndpoints(structure);
    const clearance = radius + Math.max(20, Number(structure?.depth || fallbackDepth) * 0.5) + 28;
    return distanceToSegmentSq(candidate.x, candidate.y, endpoints[0].x, endpoints[0].y, endpoints[1].x, endpoints[1].y) < clearance * clearance;
  };

  if ((walls || []).some((wall) => overlapsStructure(wall, MILITARY_WALL_LENGTH, MILITARY_WALL_DEPTH))) {
    candidate.valid = false;
    candidate.blockedReason = "WALL BLOCKING";
    return candidate;
  }

  if ((gates || []).some((gate) => overlapsStructure(gate, STARBASE_GATE_LENGTH, STARBASE_GATE_DEPTH))) {
    candidate.valid = false;
    candidate.blockedReason = "GATE BLOCKING";
    return candidate;
  }

  const allTowers = [...(defenseTowers || []), ...(kraniumTowers || [])];
  if (allTowers.some((tower) => {
    const otherRadius = Number(tower?.radius || getTowerRadius(tower?.type));
    const minDistance = radius + otherRadius + 34;
    return distanceSq(candidate.x, candidate.y, Number(tower?.x || 0), Number(tower?.y || 0)) < minDistance * minDistance;
  })) {
    candidate.valid = false;
    candidate.blockedReason = "STRUCTURE BLOCKING";
  }

  return candidate;
}

function getStructureSelectionDistance(pointerX, pointerY, structure, fallbackLength, fallbackDepth) {
  const centerX = Number(structure?.x || 0);
  const centerY = Number(structure?.y || 0);
  const rotation = Number(structure?.rotation || 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = pointerX - centerX;
  const dy = pointerY - centerY;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const halfLength = Math.max(40, Number(structure?.length || fallbackLength) * 0.5);
  const halfDepth = Math.max(20, Number(structure?.depth || fallbackDepth) * 0.5);
  const outsideX = Math.max(0, Math.abs(localX) - halfLength);
  const outsideY = Math.max(0, Math.abs(localY) - halfDepth);
  return Math.hypot(outsideX, outsideY);
}

function findDemolitionTarget(pointerX, pointerY, walls = [], gates = [], defenseTowers = [], kraniumTowers = []) {
  let best = null;

  const consider = (type, structure, fallbackLength, fallbackDepth) => {
    const distance = getStructureSelectionDistance(
      pointerX,
      pointerY,
      structure,
      fallbackLength,
      fallbackDepth,
    );
    if (distance > DEMOLITION_SELECT_MARGIN) return;
    if (best && distance >= best.distance) return;

    const fallbackMaxHp = type === "gate"
      ? STARBASE_GATE_MAX_HP
      : type === "wall"
        ? MILITARY_WALL_MAX_HP
        : 100;
    const maxHp = Math.max(1, Number(structure?.maxHp || fallbackMaxHp));
    const hp = clamp(Math.floor(Number(structure?.hp ?? maxHp)), 0, maxHp);

    best = {
      id: String(structure?.id || ""),
      type,
      x: Number(structure?.x || 0),
      y: Number(structure?.y || 0),
      rotation: Number(structure?.rotation || 0),
      length: Number(structure?.length || fallbackLength),
      depth: Number(structure?.depth || fallbackDepth),
      hp,
      maxHp,
      // Generator is intentionally never passed here. Everything else is removable.
      removable: true,
      distance,
    };
  };

  for (const wall of walls || []) {
    consider("wall", wall, MILITARY_WALL_LENGTH, MILITARY_WALL_DEPTH);
  }
  for (const gate of gates || []) {
    consider("gate", gate, STARBASE_GATE_LENGTH, STARBASE_GATE_DEPTH);
  }
  for (const tower of defenseTowers || []) {
    const radius = Number(tower?.radius || DEFENSE_TOWER_RADIUS);
    consider("defense", tower, radius * 2, radius * 2);
  }
  for (const tower of kraniumTowers || []) {
    const radius = Number(tower?.radius || KRANIUM_TOWER_RADIUS);
    consider("kranium", tower, radius * 2, radius * 2);
  }

  return best;
}

// Circle-vs-oriented-rectangle collision for local Starbase walls. The wall
// remains a normal placement object; this only blocks the player drone from
// crossing its armored footprint and returns the exact contact point for the
// visual shield pulse.
function getMilitaryWallCollision(playerX, playerY, playerRadius, wall) {
  const wallX = Number(wall?.x || 0);
  const wallY = Number(wall?.y || 0);
  const rotation = Number(wall?.rotation || 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfLength = Math.max(40, Number(wall?.length || MILITARY_WALL_LENGTH) * 0.5);
  const halfDepth = Math.max(20, Number(wall?.depth || MILITARY_WALL_DEPTH) * 0.5);
  const dx = playerX - wallX;
  const dy = playerY - wallY;
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const closestX = clamp(localX, -halfLength, halfLength);
  const closestY = clamp(localY, -halfDepth, halfDepth);
  const deltaX = localX - closestX;
  const deltaY = localY - closestY;
  const distance = Math.hypot(deltaX, deltaY);
  const collisionRadius = playerRadius + MILITARY_WALL_COLLISION_PADDING;

  if (distance >= collisionRadius) return null;

  let normalLocalX = 0;
  let normalLocalY = 0;
  let contactLocalX = closestX;
  let contactLocalY = closestY;
  let penetration = 0;

  if (distance > 0.0001) {
    normalLocalX = deltaX / distance;
    normalLocalY = deltaY / distance;
    penetration = collisionRadius - distance;
  } else {
    // The drone center is inside the OBB. Push it through the closest face,
    // never diagonally through a corner, so walls feel solid and predictable.
    const toVerticalFace = halfLength - Math.abs(localX);
    const toHorizontalFace = halfDepth - Math.abs(localY);

    if (toVerticalFace <= toHorizontalFace) {
      normalLocalX = localX >= 0 ? 1 : -1;
      normalLocalY = 0;
      contactLocalX = normalLocalX * halfLength;
      contactLocalY = clamp(localY, -halfDepth, halfDepth);
      penetration = collisionRadius + Math.max(0, toVerticalFace);
    } else {
      normalLocalX = 0;
      normalLocalY = localY >= 0 ? 1 : -1;
      contactLocalX = clamp(localX, -halfLength, halfLength);
      contactLocalY = normalLocalY * halfDepth;
      penetration = collisionRadius + Math.max(0, toHorizontalFace);
    }
  }

  const normalX = normalLocalX * cos - normalLocalY * sin;
  const normalY = normalLocalX * sin + normalLocalY * cos;
  const contactX = wallX + contactLocalX * cos - contactLocalY * sin;
  const contactY = wallY + contactLocalX * sin + contactLocalY * cos;

  return {
    wallId: String(wall?.id || "wall"),
    x: contactX,
    y: contactY,
    normalX,
    normalY,
    rotation,
    penetration,
  };
}

function getMilitaryGateCollision(playerX, playerY, playerRadius, gate) {
  if (Number(gate?.openAmount || 0) >= STARBASE_GATE_OPEN_THRESHOLD) return null;
  return getMilitaryWallCollision(playerX, playerY, playerRadius, {
    ...gate,
    length: Number(gate?.length || STARBASE_GATE_LENGTH),
    depth: Number(gate?.depth || STARBASE_GATE_DEPTH),
  });
}

function getCircularStructureCollision(playerX, playerY, playerRadius, structure, fallbackRadius, kind) {
  if (!structure) return null;

  const centerX = Number(structure.x || 0);
  const centerY = Number(structure.y || 0);
  const structureRadius = Math.max(24, Number(structure.radius || fallbackRadius));
  const collisionRadius = playerRadius + structureRadius + TOWER_COLLISION_PADDING;
  const dx = playerX - centerX;
  const dy = playerY - centerY;
  const distance = Math.hypot(dx, dy);

  if (distance >= collisionRadius) return null;

  // The fallback keeps the solver stable even if a saved player position is
  // exactly at a structure centre from an older Adventure build.
  const normalX = distance > 0.0001 ? dx / distance : 1;
  const normalY = distance > 0.0001 ? dy / distance : 0;
  return {
    kind,
    structureId: String(structure.id || kind),
    x: centerX + normalX * structureRadius,
    y: centerY + normalY * structureRadius,
    normalX,
    normalY,
    rotation: 0,
    penetration: collisionRadius - distance,
  };
}

function resolveMilitaryWallCollisions(
  playerX,
  playerY,
  playerRadius,
  walls = [],
  gates = [],
  generator = null,
  defenseTowers = [],
  kraniumTowers = [],
) {
  let x = playerX;
  let y = playerY;
  let firstHit = null;

  // Several compact passes cover wall junctions plus circular structures.
  // This is still local, allocation-light and runs only for the Adventure drone.
  for (let pass = 0; pass < 4; pass += 1) {
    let collidedThisPass = false;

    for (const wall of walls || []) {
      const hit = getMilitaryWallCollision(x, y, playerRadius, wall);
      if (!hit) continue;
      x += hit.normalX * (hit.penetration + 0.02);
      y += hit.normalY * (hit.penetration + 0.02);
      if (!firstHit) firstHit = { ...hit, kind: "wall" };
      collidedThisPass = true;
    }

    for (const gate of gates || []) {
      const hit = getMilitaryGateCollision(x, y, playerRadius, gate);
      if (!hit) continue;
      x += hit.normalX * (hit.penetration + 0.02);
      y += hit.normalY * (hit.penetration + 0.02);
      if (!firstHit) firstHit = { ...hit, kind: "gate" };
      collidedThisPass = true;
    }

    const generatorHit = getCircularStructureCollision(
      x,
      y,
      playerRadius,
      generator,
      GENERATOR_COLLISION_RADIUS,
      "generator",
    );
    if (generatorHit) {
      x += generatorHit.normalX * (generatorHit.penetration + 0.02);
      y += generatorHit.normalY * (generatorHit.penetration + 0.02);
      if (!firstHit) firstHit = generatorHit;
      collidedThisPass = true;
    }

    for (const tower of defenseTowers || []) {
      const hit = getCircularStructureCollision(x, y, playerRadius, tower, DEFENSE_TOWER_RADIUS, "defense");
      if (!hit) continue;
      x += hit.normalX * (hit.penetration + 0.02);
      y += hit.normalY * (hit.penetration + 0.02);
      if (!firstHit) firstHit = hit;
      collidedThisPass = true;
    }

    for (const tower of kraniumTowers || []) {
      const hit = getCircularStructureCollision(x, y, playerRadius, tower, KRANIUM_TOWER_RADIUS, "kranium");
      if (!hit) continue;
      x += hit.normalX * (hit.penetration + 0.02);
      y += hit.normalY * (hit.penetration + 0.02);
      if (!firstHit) firstHit = hit;
      collidedThisPass = true;
    }

    if (!collidedThisPass) break;
  }

  return {
    x: clamp(x, playerRadius, WORLD_WIDTH - playerRadius),
    y: clamp(y, playerRadius, WORLD_HEIGHT - playerRadius),
    hit: firstHit,
  };
}

function getProjectileWallHit(projectile, wall) {
  const wallX = Number(wall?.x || 0);
  const wallY = Number(wall?.y || 0);
  const rotation = Number(wall?.rotation || 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfLength = Math.max(40, Number(wall?.length || MILITARY_WALL_LENGTH) * 0.5) + PROJECTILE_RADIUS;
  const halfDepth = Math.max(20, Number(wall?.depth || MILITARY_WALL_DEPTH) * 0.5) + PROJECTILE_RADIUS;

  const transformLocal = (x, y) => {
    const dx = x - wallX;
    const dy = y - wallY;
    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  };

  const start = transformLocal(projectile.previousX, projectile.previousY);
  const end = transformLocal(projectile.x, projectile.y);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  let tMin = 0;
  let tMax = 1;
  let hitAxis = null;
  let hitSign = 0;

  const testAxis = (startValue, deltaValue, minBound, maxBound, axisName) => {
    if (Math.abs(deltaValue) < 1e-6) {
      return startValue >= minBound && startValue <= maxBound;
    }

    const inv = 1 / deltaValue;
    let t1 = (minBound - startValue) * inv;
    let t2 = (maxBound - startValue) * inv;
    let normalSign = -1;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    if (deltaValue < 0) normalSign = 1;

    if (t1 > tMin) {
      tMin = t1;
      hitAxis = axisName;
      hitSign = normalSign;
    }
    tMax = Math.min(tMax, t2);
    return tMin <= tMax;
  };

  if (!testAxis(start.x, deltaX, -halfLength, halfLength, "x")) return null;
  if (!testAxis(start.y, deltaY, -halfDepth, halfDepth, "y")) return null;
  if (tMax < 0 || tMin > 1) return null;

  const hitT = clamp(tMin, 0, 1);
  const localHitX = start.x + deltaX * hitT;
  const localHitY = start.y + deltaY * hitT;

  let normalLocalX = 0;
  let normalLocalY = 0;
  if (hitAxis === "x") normalLocalX = hitSign;
  else if (hitAxis === "y") normalLocalY = hitSign;
  else if (Math.abs(localHitX) > Math.abs(localHitY)) normalLocalX = localHitX >= 0 ? 1 : -1;
  else normalLocalY = localHitY >= 0 ? 1 : -1;

  return {
    wallId: String(wall?.id || "wall"),
    x: wallX + localHitX * cos - localHitY * sin,
    y: wallY + localHitX * sin + localHitY * cos,
    normalX: normalLocalX * cos - normalLocalY * sin,
    normalY: normalLocalX * sin + normalLocalY * cos,
    rotation,
  };
}

function Adventure({ user, onExitToMenu, graphicsQuality = "normal" }) {
  const arenaRef = useRef(null);
  const playerRef = useRef(null);
  const starsRef = useRef([]);
  const asteroidsRef = useRef([]);
  const wallsRef = useRef([]);
  const gatesRef = useRef([]);
  const defenseTowersRef = useRef([]);
  const kraniumTowersRef = useRef([]);
  const towerPlacementRef = useRef(null);
  const towerPreviewRef = useRef(null);
  const wallShieldHitsRef = useRef([]);
  const wallShieldCooldownRef = useRef(new Map());
  const botsRef = useRef([]);
  const projectilesRef = useRef([]);
  const buildModeRef = useRef(false);
  const buildTypeRef = useRef("wall");
  const demolitionModeRef = useRef(false);
  const demolitionTargetRef = useRef(null);
  const wallRotationRef = useRef(0);
  const wallPreviewRef = useRef(null);
  const gatePreviewRef = useRef(null);
  // Short-lived mineral shards are visual-only. They are not persisted and
  // do not change collision, loot or any gameplay rule.
  const asteroidDebrisRef = useRef([]);
  const combatEventsRef = useRef([]);
  const inventoryRef = useRef({
    starAmmo: 0,
    totalStars: 0,
    spaceStone: 0,
    kranium: 0,
    asteroidsMined: 0,
    testWallStock: TEST_WALL_STOCK,
    testGateStock: TEST_GATE_STOCK,
    playerX: START_X + PLAYER_SPAWN_OFFSET_X,
    playerY: START_Y + PLAYER_SPAWN_OFFSET_Y,
    viewportWorldWidth: Math.round(
      (typeof window !== "undefined" ? window.innerWidth : 1280) /
        (isMobileDevice() ? CAMERA_SCALE_MOBILE : CAMERA_SCALE_DESKTOP),
    ),
    viewportWorldHeight: Math.round(
      (typeof window !== "undefined" ? window.innerHeight : 720) /
        (isMobileDevice() ? CAMERA_SCALE_MOBILE : CAMERA_SCALE_DESKTOP),
    ),
  });
  const keysRef = useRef({});
  const mouseRef = useRef({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 640,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
  });
  const cameraRef = useRef({ x: 0, y: 0, scale: CAMERA_SCALE_DESKTOP });
  const pixiLiveRef = useRef(null);
  const generatorRef = useRef(createAdventureGenerator());
  const frameRef = useRef(0);
  const lastFrameRef = useRef(0);
  const lastFireAtRef = useRef(0);
  const lastSaveAtRef = useRef(0);
  const lastHudAtRef = useRef(0);
  const movementEnergyAccumRef = useRef(0);
  const generatorRechargeAccumRef = useRef(0);
  const mobileMoveRef = useRef({ x: 0, y: 0, active: false });
  const joystickPointerRef = useRef(null);
  const joystickKnobRef = useRef(null);
  const mobileAimDirectionRef = useRef({ x: 1, y: 0 });

  const isMobile = useMemo(() => isMobileDevice(), []);
  const username = useMemo(() => getDisplayName(user), [user]);
  const skin = useMemo(() => getSelectedSkin(user), [user]);
  const saveKey = useMemo(() => getAdventureSaveKey(user), [user]);
  const previousSaveKey = useMemo(
    () => getAdventureSaveKeyForVersion(user, PREVIOUS_SAVE_VERSION),
    [user],
  );

  const [hud, setHud] = useState({
    starAmmo: 0,
    totalStars: 0,
    spaceStone: 0,
    kranium: 0,
    defenseTowerCount: 0,
    kraniumTowerCount: 0,
    kraniumProductionOnline: false,
    kraniumNextMs: 0,
    asteroidsMined: 0,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    energy: PLAYER_MAX_ENERGY,
    maxEnergy: PLAYER_MAX_ENERGY,
    generatorHp: GENERATOR_MAX_HP,
    generatorMaxHp: GENERATOR_MAX_HP,
    generatorNearby: true,
    playerX: START_X,
    playerY: START_Y,
    viewportWorldWidth: 1800,
    viewportWorldHeight: 1200,
  });
  const [buildMode, setBuildMode] = useState(false);
  const [buildType, setBuildType] = useState("wall");
  const [demolitionMode, setDemolitionModeState] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [utilityPanelOpen, setUtilityPanelOpen] = useState(false);
  const [towerPlacement, setTowerPlacement] = useState(null);
  const [mobileJoystick, setMobileJoystick] = useState({ x: 0, y: 0, active: false });

  const writeSave = () => {
    const player = playerRef.current;
    if (!player) return;

    try {
      localStorage.setItem(
        saveKey,
        JSON.stringify({
          version: SAVE_VERSION,
          player: {
            x: player.x,
            y: player.y,
            hp: player.hp,
            energy: player.energy,
            moveAngle: player.moveAngle,
          },
          generator: {
            ...generatorRef.current,
            hp: Math.max(0, Number(generatorRef.current?.hp ?? GENERATOR_MAX_HP)),
          },
          inventory: inventoryRef.current,
          stars: starsRef.current,
          // Impact timestamps are display-only and must not survive a reload;
          // saving them would make an old hit pulse appear after returning.
          asteroids: asteroidsRef.current.map(({ lastHitAt, impactAngle, ...asteroid }) => asteroid),
          walls: wallsRef.current.map(({ id, x, y, rotation, length, depth, hp, maxHp }) => ({
            id,
            x,
            y,
            rotation,
            length,
            depth,
            hp,
            maxHp,
          })),
          gates: gatesRef.current.map(({ id, x, y, rotation, length, depth, hp, maxHp, openAmount }) => ({
            id,
            x,
            y,
            rotation,
            length,
            depth,
            hp,
            maxHp,
            openAmount,
          })),
          defenseTowers: defenseTowersRef.current.map(({ id, x, y, radius, rotation }) => ({
            id,
            x,
            y,
            radius,
            rotation,
            lastShotAt: 0,
          })),
          kraniumTowers: kraniumTowersRef.current.map(({ id, x, y, radius, rotation, lastKraniumAt, createdAt }) => ({
            id,
            x,
            y,
            radius,
            rotation,
            lastKraniumAt,
            createdAt,
          })),
        }),
      );
    } catch {
      // Storage can be unavailable in private mode. Gameplay remains local.
    }
  };

  const syncHud = () => {
    const player = playerRef.current;
    if (!player) return;

    const viewportWidth = Number(globalThis?.window?.innerWidth || 1280);
    const viewportHeight = Number(globalThis?.window?.innerHeight || 720);
    const worldScale = Math.max(
      0.0001,
      Number(cameraRef.current?.scale || (isMobile ? CAMERA_SCALE_MOBILE : CAMERA_SCALE_DESKTOP)),
    );

    const generator = generatorRef.current || createAdventureGenerator();
    const nearGenerator = distanceSq(player.x, player.y, generator.x, generator.y) <= GENERATOR_RECHARGE_DISTANCE * GENERATOR_RECHARGE_DISTANCE;
    const kraniumStatus = getKraniumProductionStatus(kraniumTowersRef.current, Date.now());

    setHud({
      ...inventoryRef.current,
      hp: Math.max(0, Math.round(player.hp)),
      maxHp: PLAYER_MAX_HP,
      energy: Math.max(0, Math.round(player.energy ?? PLAYER_MAX_ENERGY)),
      maxEnergy: PLAYER_MAX_ENERGY,
      generatorHp: Math.max(0, Math.round(generator.hp ?? GENERATOR_MAX_HP)),
      generatorMaxHp: GENERATOR_MAX_HP,
      generatorNearby: nearGenerator,
      defenseTowerCount: defenseTowersRef.current.length,
      kraniumTowerCount: kraniumTowersRef.current.length,
      kraniumProductionOnline: kraniumStatus.active,
      kraniumNextMs: kraniumStatus.remainingMs,
      playerX: Math.round(player.x),
      playerY: Math.round(player.y),
      viewportWorldWidth: Math.round(viewportWidth / worldScale),
      viewportWorldHeight: Math.round(viewportHeight / worldScale),
    });
  };

  const addCombatEvent = (text, x, y, kind = "default") => {
    combatEventsRef.current.push({
      id: randomId("adventure-event"),
      text,
      x,
      y,
      kind,
      createdAt: Date.now(),
      ttl: 900,
      viewerId: "adventure-player",
    });
  };

  const spawnReplacementStar = (aroundX = START_X, aroundY = START_Y) => {
    const angle = randomBetween(0, Math.PI * 2);
    const radius = randomBetween(2600, 12000);
    starsRef.current.push(
      makeStar(
        clamp(aroundX + Math.cos(angle) * radius, 320, WORLD_WIDTH - 320),
        clamp(aroundY + Math.sin(angle) * radius, 320, WORLD_HEIGHT - 320),
      ),
    );
  };

  const launchBolt = (directionOverride = null) => {
    const player = playerRef.current;
    if (!player || buildModeRef.current || towerPlacementRef.current) return;

    const now = performance.now();
    if (now - lastFireAtRef.current < FIRE_COOLDOWN_MS) return;

    if (inventoryRef.current.starAmmo <= 0) {
      return;
    }

    const direction = directionOverride || findNearestAimDirection(
      player,
      mouseRef.current,
      cameraRef.current,
      cameraRef.current.scale,
    );

    inventoryRef.current.starAmmo -= 1;
    lastFireAtRef.current = now;

    projectilesRef.current.push(
      createAdventureProjectile({
        x: player.x + direction.x * 92,
        y: player.y + direction.y * 92,
        dx: direction.x,
        dy: direction.y,
        team: "player",
        skin: player.skin,
        ownerId: player.id,
      }),
    );
  };

  const canAffordBuildType = (type) => {
    if (type === "gate") {
      return Number(inventoryRef.current.testGateStock || 0) > 0 || inventoryRef.current.spaceStone >= STARBASE_GATE_COST;
    }
    return Number(inventoryRef.current.testWallStock || 0) > 0 || inventoryRef.current.spaceStone >= MILITARY_WALL_COST;
  };

  const setDemolitionMode = (enabled) => {
    const next = Boolean(enabled);
    demolitionModeRef.current = next;
    if (next) {
      cancelTowerPlacement();
      buildModeRef.current = false;
      wallPreviewRef.current = null;
      gatePreviewRef.current = null;
      setBuildMode(false);
    }
    if (!next) demolitionTargetRef.current = null;
    setDemolitionModeState(next);
  };

  const setBuildingMode = (enabled, nextType = buildTypeRef.current) => {
    const normalizedType = nextType === "gate" ? "gate" : "wall";
    const next = Boolean(enabled) && canAffordBuildType(normalizedType);
    buildModeRef.current = next;
    buildTypeRef.current = normalizedType;
    if (next) {
      cancelTowerPlacement();
      demolitionModeRef.current = false;
      demolitionTargetRef.current = null;
      setDemolitionModeState(false);
    }
    if (!next) {
      wallPreviewRef.current = null;
      gatePreviewRef.current = null;
    }
    setBuildType(normalizedType);
    setBuildMode(next);
  };

  const activateBuildType = (type) => {
    const normalizedType = type === "gate" ? "gate" : "wall";
    if (buildModeRef.current && buildTypeRef.current === normalizedType) {
      setBuildingMode(false, normalizedType);
      return;
    }
    setBuildingMode(true, normalizedType);
  };

  const toggleBuildingMode = () => {
    setBuildingMode(!buildModeRef.current, buildTypeRef.current);
  };

  const toggleDemolitionMode = () => {
    setDemolitionMode(!demolitionModeRef.current);
  };

  const cancelTowerPlacement = () => {
    towerPlacementRef.current = null;
    towerPreviewRef.current = null;
    setTowerPlacement(null);
  };

  const activateTowerPlacement = (type) => {
    const normalizedType = type === "kranium" ? "kranium" : "defense";
    buildModeRef.current = false;
    demolitionModeRef.current = false;
    wallPreviewRef.current = null;
    gatePreviewRef.current = null;
    demolitionTargetRef.current = null;
    towerPlacementRef.current = normalizedType;
    setBuildMode(false);
    setDemolitionModeState(false);
    setShopOpen(false);
    setTowerPlacement(normalizedType);
  };

  const placeSelectedTower = () => {
    const type = towerPlacementRef.current;
    const preview = towerPreviewRef.current;
    if (!type || !preview?.valid) return;

    if (type === "kranium") {
      kraniumTowersRef.current.push(createKraniumTower(preview.x, preview.y));
      addCombatEvent("KRANIUM TOWER ONLINE", preview.x, preview.y - 165, "drone-reward");
    } else {
      defenseTowersRef.current.push(createDefenseTower(preview.x, preview.y));
      addCombatEvent("DEFENSE TOWER ONLINE", preview.x, preview.y - 155, "drone-reward");
    }

    cancelTowerPlacement();
    syncHud();
    writeSave();
  };

  const removeSelectedStructure = () => {
    const target = demolitionTargetRef.current;
    if (!target?.id) return;

    // The generator does not exist in the selectable lists, so it can never be removed.
    let collection = wallsRef.current;
    let removedLabel = "WALL REMOVED";

    if (target.type === "gate") {
      collection = gatesRef.current;
      removedLabel = "GATE REMOVED";
    } else if (target.type === "defense") {
      collection = defenseTowersRef.current;
      removedLabel = "DEFENSE REMOVED";
    } else if (target.type === "kranium") {
      collection = kraniumTowersRef.current;
      removedLabel = "KRANIUM REMOVED";
    }

    const index = collection.findIndex((item) => String(item?.id || "") === target.id);
    if (index < 0) {
      demolitionTargetRef.current = null;
      return;
    }

    collection.splice(index, 1);
    demolitionTargetRef.current = null;
    addCombatEvent(removedLabel, target.x, target.y - 96, "drone-reward");
    syncHud();
    writeSave();
  };

  const rotateBuildingWall = () => {
    if (!buildModeRef.current) return;
    wallRotationRef.current += buildTypeRef.current === "gate" ? STARBASE_GATE_ROTATION_STEP : MILITARY_WALL_ROTATION_STEP;
  };

  const placeMilitaryWall = () => {
    const preview = wallPreviewRef.current;
    const player = playerRef.current;
    const hasTestWall = Number(inventoryRef.current.testWallStock || 0) > 0;
    const hasStoneForWall = inventoryRef.current.spaceStone >= MILITARY_WALL_COST;
    if (!preview || !player || (!hasTestWall && !hasStoneForWall)) {
      setBuildingMode(false, "wall");
      return;
    }

    if (wallsRef.current.length >= MAX_MILITARY_WALLS) return;

    const wall = createMilitaryWall(preview.x, preview.y, preview.rotation);
    wallsRef.current.push(wall);

    if (hasTestWall) inventoryRef.current.testWallStock -= 1;
    else inventoryRef.current.spaceStone -= MILITARY_WALL_COST;

    wallPreviewRef.current = null;
    syncHud();
    writeSave();

    if (!canAffordBuildType("wall") || wallsRef.current.length >= MAX_MILITARY_WALLS) {
      setBuildingMode(false, "wall");
    }
  };

  const placeStarbaseGate = () => {
    const preview = gatePreviewRef.current;
    const player = playerRef.current;
    const hasTestGate = Number(inventoryRef.current.testGateStock || 0) > 0;
    const hasStoneForGate = inventoryRef.current.spaceStone >= STARBASE_GATE_COST;
    if (!preview || !player || (!hasTestGate && !hasStoneForGate)) {
      setBuildingMode(false, "gate");
      return;
    }

    if (gatesRef.current.length >= MAX_STARBASE_GATES) return;

    const gate = createMilitaryGate(preview.x, preview.y, preview.rotation);
    gate.hp = MILITARY_WALL_MAX_HP;
    gate.maxHp = MILITARY_WALL_MAX_HP;
    gate.openAmount = 0;
    gate.targetOpen = 0;
    gatesRef.current.push(gate);

    if (hasTestGate) inventoryRef.current.testGateStock -= 1;
    else inventoryRef.current.spaceStone -= STARBASE_GATE_COST;

    gatePreviewRef.current = null;
    syncHud();
    writeSave();

    if (!canAffordBuildType("gate") || gatesRef.current.length >= MAX_STARBASE_GATES) {
      setBuildingMode(false, "gate");
    }
  };

  const placeSelectedStructure = () => {
    if (buildTypeRef.current === "gate") placeStarbaseGate();
    else placeMilitaryWall();
  };

  useEffect(() => {
    // Start this perimeter update from a clean Adventure run. This removes only
    // the previous Adventure save slot; other modes and browser storage are untouched.
    try {
      localStorage.removeItem(previousSaveKey);
    } catch {
      // The versioned save slot still starts empty when storage is unavailable.
    }

    const saved = loadProgress(saveKey, skin, username);
    const generated = saved ? null : makeWorld();

    playerRef.current = saved?.player || createAdventurePlayer(username, skin);
    generatorRef.current = saved?.generator || createAdventureGenerator();
    const starterBase = saved ? null : createStarterStarbasePerimeter(generatorRef.current);

    starsRef.current = saved?.stars || generated.stars;
    asteroidsRef.current = saved?.asteroids || generated.asteroids;
    wallsRef.current = saved?.walls || starterBase.walls;
    gatesRef.current = saved?.gates || starterBase.gates;
    defenseTowersRef.current = saved?.defenseTowers || [];
    kraniumTowersRef.current = saved?.kraniumTowers || [];
    // Adventure is temporarily a solo exploration/mining mode. Also avoid
    // reading generated.bots when a saved world is restored (generated is null
    // in that path).
    botsRef.current = [];
    inventoryRef.current = saved?.inventory || createInitialAdventureInventory();
    movementEnergyAccumRef.current = 0;
    generatorRechargeAccumRef.current = 0;

    syncHud();

    const updateCamera = (player) => {
      const scale = isMobile ? CAMERA_SCALE_MOBILE : CAMERA_SCALE_DESKTOP;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const desiredX = width * 0.5 - player.x * scale;
      const desiredY = height * 0.5 - player.y * scale;

      cameraRef.current = {
        x: desiredX,
        y: desiredY,
        scale,
      };
    };

    const emitWallShieldHit = (hit, now, options = {}) => {
      if (!hit) return;

      const source = options.source === "projectile" ? "projectile" : "collision";
      const key = `${String(hit.wallId || "wall")}:${source}`;
      const cooldown = source === "projectile" ? 48 : WALL_SHIELD_HIT_COOLDOWN_MS;
      const lastAt = Number(wallShieldCooldownRef.current.get(key) || 0);
      if (now - lastAt < cooldown) return;

      wallShieldCooldownRef.current.set(key, now);
      wallShieldHitsRef.current.push({
        id: randomId("wall-shield"),
        x: hit.x,
        y: hit.y,
        normalX: hit.normalX,
        normalY: hit.normalY,
        rotation: hit.rotation,
        createdAt: now,
        ttl: source === "projectile" ? WALL_SHIELD_HIT_TTL_MS + 80 : WALL_SHIELD_HIT_TTL_MS,
        source,
      });

      if (wallShieldHitsRef.current.length > MAX_WALL_SHIELD_HITS) {
        wallShieldHitsRef.current.splice(0, wallShieldHitsRef.current.length - MAX_WALL_SHIELD_HITS);
      }
    };

    const damagePlayer = (amount, sourceX, sourceY) => {
      const player = playerRef.current;
      if (!player) return;

      player.hp = Math.max(0, player.hp - amount);
      addCombatEvent(`-${amount}`, sourceX, sourceY, "damage");

      if (player.hp <= 0) {
        player.x = START_X + PLAYER_SPAWN_OFFSET_X;
        player.y = START_Y + PLAYER_SPAWN_OFFSET_Y;
        player.hp = PLAYER_MAX_HP;
        player.energy = PLAYER_MAX_ENERGY;
        projectilesRef.current = [];
      }
    };

    const restartAdventureFromScratch = (reason = "GENERATOR LOST") => {
      const fresh = makeWorld();
      playerRef.current = createAdventurePlayer(username, skin);
      generatorRef.current = createAdventureGenerator();
      const starterBase = createStarterStarbasePerimeter(generatorRef.current);
      starsRef.current = fresh.stars;
      asteroidsRef.current = fresh.asteroids;
      wallsRef.current = starterBase.walls;
      gatesRef.current = starterBase.gates;
      defenseTowersRef.current = [];
      kraniumTowersRef.current = [];
      towerPreviewRef.current = null;
      towerPlacementRef.current = null;
      setTowerPlacement(null);
      botsRef.current = [];
      projectilesRef.current = [];
      asteroidDebrisRef.current = [];
      combatEventsRef.current = [];
      wallShieldHitsRef.current = [];
      wallPreviewRef.current = null;
      gatePreviewRef.current = null;
      demolitionTargetRef.current = null;
      inventoryRef.current = createInitialAdventureInventory();
      movementEnergyAccumRef.current = 0;
      generatorRechargeAccumRef.current = 0;
      buildModeRef.current = false;
      demolitionModeRef.current = false;
      setBuildMode(false);
      setDemolitionModeState(false);
      try {
        localStorage.removeItem(saveKey);
      } catch {
        // ignore storage failures
      }
      addCombatEvent(reason, START_X, START_Y - 240, "damage");
      syncHud();
      writeSave();
    };

    const damageGenerator = (amount, sourceX, sourceY) => {
      const generator = generatorRef.current;
      if (!generator) return;
      generator.hp = Math.max(0, Number(generator.hp || GENERATOR_MAX_HP) - amount);
      addCombatEvent(`GENERATOR -${amount}`, sourceX, sourceY, "damage");
      if (generator.hp <= 0) {
        restartAdventureFromScratch("GENERATOR DESTROYED · RUN RESET");
      }
    };

    const updateBots = (deltaSeconds, now) => {
      const player = playerRef.current;
      if (!player) return;

      for (const bot of botsRef.current) {
        if (!bot.alive) {
          if (now >= bot.respawnAt) {
            const angle = randomBetween(0, Math.PI * 2);
            const radius = randomBetween(2400, 8200);
            bot.x = clamp(player.x + Math.cos(angle) * radius, 420, WORLD_WIDTH - 420);
            bot.y = clamp(player.y + Math.sin(angle) * radius, 420, WORLD_HEIGHT - 420);
            bot.hp = BOT_MAX_HP;
            bot.alive = true;
            bot.lastRetargetAt = now;
          }
          continue;
        }

        const dx = player.x - bot.x;
        const dy = player.y - bot.y;
        const playerDistance = Math.hypot(dx, dy) || 1;

        if (now - bot.lastRetargetAt > 1400 || distanceSq(bot.x, bot.y, bot.targetX, bot.targetY) < 100 * 100) {
          bot.lastRetargetAt = now;
          const angle = randomBetween(0, Math.PI * 2);
          const radius = playerDistance < 2100 ? randomBetween(760, 1200) : randomBetween(550, 2500);
          const centerX = playerDistance < 5000 ? player.x : bot.x;
          const centerY = playerDistance < 5000 ? player.y : bot.y;
          bot.targetX = clamp(centerX + Math.cos(angle) * radius, 240, WORLD_WIDTH - 240);
          bot.targetY = clamp(centerY + Math.sin(angle) * radius, 240, WORLD_HEIGHT - 240);
        }

        const targetDx = bot.targetX - bot.x;
        const targetDy = bot.targetY - bot.y;
        const targetLength = Math.hypot(targetDx, targetDy) || 1;
        const moveX = targetDx / targetLength;
        const moveY = targetDy / targetLength;

        bot.x = clamp(bot.x + moveX * BOT_SPEED * deltaSeconds, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
        bot.y = clamp(bot.y + moveY * BOT_SPEED * deltaSeconds, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
        bot.moveX = moveX;
        bot.moveY = moveY;
        bot.moveAngle = Math.atan2(moveY, moveX);
        bot.isMoving = true;

        if (playerDistance <= BOT_ATTACK_RANGE && now - bot.lastShotAt >= BOT_FIRE_COOLDOWN_MS) {
          bot.lastShotAt = now;
          projectilesRef.current.push(
            createAdventureProjectile({
              x: bot.x + (dx / playerDistance) * 72,
              y: bot.y + (dy / playerDistance) * 72,
              dx,
              dy,
              team: "bot",
              skin: bot.skin,
              ownerId: bot.id,
            }),
          );
        }
      }
    };

    const spawnAsteroidDebris = (asteroid, impactX, impactY, projectile, mined = false) => {
      const outwardX = impactX - asteroid.x;
      const outwardY = impactY - asteroid.y;
      const outwardLength = Math.hypot(outwardX, outwardY) || 1;
      const normalX = outwardX / outwardLength;
      const normalY = outwardY / outwardLength;
      const travelAngle = Math.atan2(Number(projectile?.vy || 0), Number(projectile?.vx || 1));
      const shardCount = mined ? 28 : 11;
      const now = performance.now();

      for (let index = 0; index < shardCount; index += 1) {
        const spread = randomBetween(-1.25, 1.25);
        const direction = Math.atan2(normalY, normalX) + spread;
        const speed = (mined ? randomBetween(150, 460) : randomBetween(95, 290)) *
          (index < 3 ? 1.35 : 1);
        const radial = randomBetween(0, Math.max(10, Number(asteroid.radius || 100) * 0.22));
        const ttl = mined
          ? randomBetween(ASTEROID_DEBRIS_TTL_MS * 0.78, ASTEROID_DEBRIS_TTL_MS * 1.32)
          : randomBetween(ASTEROID_DEBRIS_TTL_MS * 0.55, ASTEROID_DEBRIS_TTL_MS * 0.95);

        asteroidDebrisRef.current.push({
          id: randomId("rock-shard"),
          x: impactX + Math.cos(direction) * radial,
          y: impactY + Math.sin(direction) * radial,
          vx: Math.cos(direction) * speed + normalX * 90,
          vy: Math.sin(direction) * speed + normalY * 90,
          rotation: travelAngle + randomBetween(-1.4, 1.4),
          rotationSpeed: randomBetween(-8.5, 8.5),
          size: mined ? randomBetween(7, 20) : randomBetween(4, 12),
          tone: Number(asteroid.tone || 0),
          variant: Math.floor(randomBetween(0, 4)),
          createdAt: now,
          ttl,
          sparkle: index < (mined ? 9 : 3),
        });
      }

      if (asteroidDebrisRef.current.length > ASTEROID_DEBRIS_MAX) {
        asteroidDebrisRef.current.splice(0, asteroidDebrisRef.current.length - ASTEROID_DEBRIS_MAX);
      }
    };

    const updateAsteroidDebris = (deltaSeconds, now) => {
      const active = [];

      for (const shard of asteroidDebrisRef.current) {
        const age = now - Number(shard.createdAt || now);
        if (age >= Number(shard.ttl || ASTEROID_DEBRIS_TTL_MS)) continue;

        shard.x += Number(shard.vx || 0) * deltaSeconds;
        shard.y += Number(shard.vy || 0) * deltaSeconds;
        shard.vx *= Math.pow(0.13, deltaSeconds);
        shard.vy *= Math.pow(0.13, deltaSeconds);
        shard.rotation += Number(shard.rotationSpeed || 0) * deltaSeconds;
        active.push(shard);
      }

      asteroidDebrisRef.current = active;
    };

    const updateGates = (deltaSeconds) => {
      const player = playerRef.current;
      for (const gate of gatesRef.current) {
        const distance = player ? Math.hypot(player.x - gate.x, player.y - gate.y) : Infinity;
        gate.targetOpen = distance <= STARBASE_GATE_OPEN_DISTANCE ? 1 : 0;
        const speed = gate.targetOpen > Number(gate.openAmount || 0) ? 3.5 : 2.6;
        gate.openAmount = clamp(Number(gate.openAmount || 0) + (gate.targetOpen - Number(gate.openAmount || 0)) * Math.min(1, deltaSeconds * speed), 0, 1);
      }
    };

    const updateKraniumTowers = (epochNow) => {
      let generated = 0;
      for (const tower of kraniumTowersRef.current) {
        const lastAt = Math.max(0, Number(tower.lastKraniumAt || epochNow));
        const elapsed = Math.max(0, epochNow - lastAt);
        const completedCycles = Math.floor(elapsed / KRANIUM_GENERATION_INTERVAL_MS);
        if (completedCycles <= 0) continue;
        tower.lastKraniumAt = lastAt + completedCycles * KRANIUM_GENERATION_INTERVAL_MS;
        inventoryRef.current.kranium = Math.max(0, Number(inventoryRef.current.kranium || 0) + completedCycles);
        generated += completedCycles;
      }
      if (generated > 0) {
        const firstTower = kraniumTowersRef.current[0];
        addCombatEvent(`+${generated} KRANIUM`, firstTower?.x || START_X, (firstTower?.y || START_Y) - 170, "drone-reward");
      }
    };

    const updateDefenseTowers = (now) => {
      for (const tower of defenseTowersRef.current) {
        let target = null;
        let bestDistanceSq = DEFENSE_TOWER_RANGE * DEFENSE_TOWER_RANGE;
        for (const bot of botsRef.current) {
          if (!bot?.alive) continue;
          const candidateDistanceSq = distanceSq(tower.x, tower.y, bot.x, bot.y);
          if (candidateDistanceSq >= bestDistanceSq) continue;
          bestDistanceSq = candidateDistanceSq;
          target = bot;
        }

        if (!target) {
          tower.targetId = null;
          continue;
        }

        const dx = target.x - tower.x;
        const dy = target.y - tower.y;
        const distance = Math.hypot(dx, dy) || 1;
        const unitX = dx / distance;
        const unitY = dy / distance;
        tower.targetId = target.id;
        tower.rotation = Math.atan2(unitY, unitX);

        if (now - Number(tower.lastShotAt || 0) < DEFENSE_TOWER_FIRE_COOLDOWN_MS) continue;
        tower.lastShotAt = now;
        tower.recoilUntil = now + 180;
        projectilesRef.current.push(
          createAdventureProjectile({
            x: tower.x + unitX * 106,
            y: tower.y + unitY * 106,
            dx: unitX,
            dy: unitY,
            team: "tower",
            skin: "defense-tower",
            ownerId: tower.id,
            speed: DEFENSE_TOWER_PROJECTILE_SPEED,
            damage: DEFENSE_TOWER_DAMAGE,
          }),
        );
      }
    };

    const updateProjectiles = (deltaSeconds) => {
      const player = playerRef.current;
      if (!player) return;

      const nextProjectiles = [];

      for (const projectile of projectilesRef.current) {
        projectile.previousX = projectile.x;
        projectile.previousY = projectile.y;
        projectile.x += projectile.vx * deltaSeconds;
        projectile.y += projectile.vy * deltaSeconds;
        projectile.traveled += Math.hypot(
          projectile.x - projectile.previousX,
          projectile.y - projectile.previousY,
        );

        let consumed = projectile.traveled >= PROJECTILE_MAX_DISTANCE;

        if (!consumed && projectile.team !== "tower") {
          for (let index = 0; index < wallsRef.current.length; index += 1) {
            const wall = wallsRef.current[index];
            const wallHit = getProjectileWallHit(projectile, wall);
            if (!wallHit) continue;

            emitWallShieldHit(wallHit, performance.now(), { source: "projectile" });
            if (projectile.team !== "tower") {
              const wallMaxHp = Math.max(1, Number(wall.maxHp || MILITARY_WALL_MAX_HP));
              const nextHp = Math.max(0, Math.floor(Number(wall.hp ?? wallMaxHp)) - 1);
              wall.hp = nextHp;
              wall.maxHp = wallMaxHp;
              addCombatEvent(`WALL ${nextHp}/${wallMaxHp}`, wallHit.x, wallHit.y - 64, nextHp <= 0 ? "damage" : "default");

              if (nextHp <= 0) {
                wallsRef.current.splice(index, 1);
                addCombatEvent("WALL DESTROYED", wallHit.x, wallHit.y - 104, "damage");
              }
            }

            consumed = true;
            break;
          }
        }

        if (projectile.team === "player" && !consumed) {
          for (let index = 0; index < asteroidsRef.current.length; index += 1) {
            const asteroid = asteroidsRef.current[index];
            const hitRadius = Number(asteroid.radius || 100) + PROJECTILE_RADIUS;

            if (
              distanceToSegmentSq(
                asteroid.x,
                asteroid.y,
                projectile.previousX,
                projectile.previousY,
                projectile.x,
                projectile.y,
              ) <= hitRadius * hitRadius
            ) {
              asteroid.hits = Math.min(ASTEROID_HITS_TO_MINE, Number(asteroid.hits || 0) + 1);
              asteroid.lastHitAt = performance.now();
              asteroid.impactAngle = Math.atan2(Number(projectile.vy || 0), Number(projectile.vx || 1));
              spawnAsteroidDebris(
                asteroid,
                projectile.x,
                projectile.y,
                projectile,
                asteroid.hits >= ASTEROID_HITS_TO_MINE,
              );
              addCombatEvent(
                asteroid.hits >= ASTEROID_HITS_TO_MINE ? "+1 SPACE STONE" : `${asteroid.hits}/${ASTEROID_HITS_TO_MINE}`,
                asteroid.x,
                asteroid.y - Number(asteroid.radius || 100),
                asteroid.hits >= ASTEROID_HITS_TO_MINE ? "drone-reward" : "default",
              );

              if (asteroid.hits >= ASTEROID_HITS_TO_MINE) {
                inventoryRef.current.spaceStone += 1;
                inventoryRef.current.asteroidsMined += 1;
                asteroidsRef.current.splice(index, 1);
                const angle = randomBetween(0, Math.PI * 2);
                const radius = randomBetween(8000, 42000);
                asteroidsRef.current.push(
                  makeAsteroid(
                    clamp(player.x + Math.cos(angle) * radius, 600, WORLD_WIDTH - 600),
                    clamp(player.y + Math.sin(angle) * radius, 600, WORLD_HEIGHT - 600),
                  ),
                );
              }

              consumed = true;
              break;
            }
          }
        }

        if ((projectile.team === "player" || projectile.team === "tower") && !consumed) {
          for (const bot of botsRef.current) {
            if (!bot.alive || bot.id === projectile.ownerId) continue;

            const hitRadius = 82 + PROJECTILE_RADIUS;
            if (
              distanceToSegmentSq(
                bot.x,
                bot.y,
                projectile.previousX,
                projectile.previousY,
                projectile.x,
                projectile.y,
              ) <= hitRadius * hitRadius
            ) {
              const damage = projectile.team === "tower"
                ? Math.max(1, Number(projectile.damage || DEFENSE_TOWER_DAMAGE))
                : PLAYER_PROJECTILE_DAMAGE;
              bot.hp = Math.max(0, bot.hp - damage);
              addCombatEvent(`-${damage}`, bot.x, bot.y - 90, "damage");
              if (bot.hp <= 0) {
                bot.alive = false;
                bot.respawnAt = performance.now() + 8000;
                inventoryRef.current.starAmmo += 2;
                addCombatEvent("+2 STAR CHARGE", bot.x, bot.y - 120, "drone-reward");
              }
              consumed = true;
              break;
            }
          }
        }

        if (projectile.team === "bot" && !consumed) {
          const hitRadius = PLAYER_RADIUS + PROJECTILE_RADIUS;
          if (
            distanceToSegmentSq(
              player.x,
              player.y,
              projectile.previousX,
              projectile.previousY,
              projectile.x,
              projectile.y,
            ) <= hitRadius * hitRadius
          ) {
            damagePlayer(BOT_PROJECTILE_DAMAGE, player.x, player.y - 100);
            consumed = true;
          }
        }

        if (!consumed) nextProjectiles.push(projectile);
      }

      projectilesRef.current = nextProjectiles;
    };

    const collectStars = () => {
      const player = playerRef.current;
      if (!player) return;

      const squaredRange = STAR_COLLECT_DISTANCE * STAR_COLLECT_DISTANCE;
      let collected = 0;
      const remaining = [];
      const replacements = [];

      for (const star of starsRef.current) {
        if (distanceSq(player.x, player.y, star.x, star.y) <= squaredRange) {
          collected += 1;
          const angle = randomBetween(0, Math.PI * 2);
          const radius = randomBetween(2600, 12000);
          replacements.push(
            makeStar(
              clamp(player.x + Math.cos(angle) * radius, 320, WORLD_WIDTH - 320),
              clamp(player.y + Math.sin(angle) * radius, 320, WORLD_HEIGHT - 320),
            ),
          );
        } else {
          remaining.push(star);
        }
      }

      if (collected > 0) {
        starsRef.current = remaining.concat(replacements);
        inventoryRef.current.starAmmo += collected;
        inventoryRef.current.totalStars += collected;
        addCombatEvent(`+${collected} STAR`, player.x, player.y - 112, "drone-reward");
      }
    };

    const tick = (now) => {
      const previous = lastFrameRef.current || now;
      const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
      lastFrameRef.current = now;

      const player = playerRef.current;
      if (!player) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const keyboardX = (keysRef.current.KeyD || keysRef.current.ArrowRight ? 1 : 0) -
        (keysRef.current.KeyA || keysRef.current.ArrowLeft ? 1 : 0);
      const keyboardY = (keysRef.current.KeyS || keysRef.current.ArrowDown ? 1 : 0) -
        (keysRef.current.KeyW || keysRef.current.ArrowUp ? 1 : 0);

      const mobileMove = mobileMoveRef.current;
      const rawX = mobileMove.active ? mobileMove.x : keyboardX;
      const rawY = mobileMove.active ? mobileMove.y : keyboardY;
      const length = Math.hypot(rawX, rawY);

      if (length > 0.001 && Number(player.energy || 0) > 0) {
        const moveX = rawX / Math.max(1, length);
        const moveY = rawY / Math.max(1, length);
        const proposedX = clamp(
          player.x + moveX * PLAYER_SPEED * deltaSeconds,
          PLAYER_RADIUS,
          WORLD_WIDTH - PLAYER_RADIUS,
        );
        const proposedY = clamp(
          player.y + moveY * PLAYER_SPEED * deltaSeconds,
          PLAYER_RADIUS,
          WORLD_HEIGHT - PLAYER_RADIUS,
        );
        const resolved = resolveMilitaryWallCollisions(
          proposedX,
          proposedY,
          PLAYER_RADIUS,
          wallsRef.current,
          gatesRef.current,
          generatorRef.current,
          defenseTowersRef.current,
          kraniumTowersRef.current,
        );

        player.x = resolved.x;
        player.y = resolved.y;
        player.moveX = moveX;
        player.moveY = moveY;
        player.moveAngle = Math.atan2(moveY, moveX);
        player.isMoving = true;
        mobileAimDirectionRef.current = { x: moveX, y: moveY };
        if (resolved.hit?.kind === "wall" || resolved.hit?.kind === "gate") {
          emitWallShieldHit(resolved.hit, now);
        }

        movementEnergyAccumRef.current += deltaSeconds * 1000;
        if (movementEnergyAccumRef.current >= MOVEMENT_ENERGY_DRAIN_INTERVAL_MS) {
          const spent = Math.floor(movementEnergyAccumRef.current / MOVEMENT_ENERGY_DRAIN_INTERVAL_MS);
          if (spent > 0) {
            player.energy = Math.max(0, Number(player.energy || 0) - spent);
            movementEnergyAccumRef.current -= spent * MOVEMENT_ENERGY_DRAIN_INTERVAL_MS;
          }
        }
        generatorRechargeAccumRef.current = 0;
      } else {
        player.moveX = 0;
        player.moveY = 0;
        player.isMoving = false;
        movementEnergyAccumRef.current = 0;
      }

      const generator = generatorRef.current;
      if (generator && !player.isMoving) {
        const nearGenerator = distanceSq(player.x, player.y, generator.x, generator.y) <= GENERATOR_RECHARGE_DISTANCE * GENERATOR_RECHARGE_DISTANCE;
        if (nearGenerator && Number(player.energy || 0) < PLAYER_MAX_ENERGY) {
          generatorRechargeAccumRef.current += deltaSeconds * 1000;
          if (generatorRechargeAccumRef.current >= GENERATOR_RECHARGE_INTERVAL_MS) {
            const recovered = Math.floor(generatorRechargeAccumRef.current / GENERATOR_RECHARGE_INTERVAL_MS);
            if (recovered > 0) {
              const nextEnergy = Math.min(PLAYER_MAX_ENERGY, Number(player.energy || 0) + recovered);
              const gained = nextEnergy - Number(player.energy || 0);
              player.energy = nextEnergy;
              generatorRechargeAccumRef.current -= recovered * GENERATOR_RECHARGE_INTERVAL_MS;
              if (gained > 0) {
                addCombatEvent(`+${gained} ENERGY`, generator.x, generator.y - 170, "drone-reward");
              }
            }
          }
        } else {
          generatorRechargeAccumRef.current = 0;
        }
      } else {
        generatorRechargeAccumRef.current = 0;
      }

      updateGates(deltaSeconds);
      updateCamera(player);

      const pointer = getWorldPointerPosition(mouseRef.current, cameraRef.current);
      if (towerPlacementRef.current) {
        towerPreviewRef.current = getTowerPlacementCandidate(
          towerPlacementRef.current,
          pointer.x,
          pointer.y,
          generatorRef.current,
          wallsRef.current,
          gatesRef.current,
          defenseTowersRef.current,
          kraniumTowersRef.current,
        );
        demolitionTargetRef.current = null;
        wallPreviewRef.current = null;
        gatePreviewRef.current = null;
      } else if (demolitionModeRef.current) {
        demolitionTargetRef.current = findDemolitionTarget(
          pointer.x,
          pointer.y,
          wallsRef.current,
          gatesRef.current,
          defenseTowersRef.current,
          kraniumTowersRef.current,
        );
        wallPreviewRef.current = null;
        gatePreviewRef.current = null;
      } else if (buildModeRef.current) {
        if (buildTypeRef.current === "gate") {
          const candidate = createMilitaryGate(pointer.x, pointer.y, wallRotationRef.current);
          gatePreviewRef.current = snapMilitaryGate(candidate, wallsRef.current, gatesRef.current);
          wallPreviewRef.current = null;
        } else {
          const candidate = createMilitaryWall(pointer.x, pointer.y, wallRotationRef.current);
          wallPreviewRef.current = snapMilitaryWall(candidate, wallsRef.current, gatesRef.current);
          gatePreviewRef.current = null;
        }
      } else {
        demolitionTargetRef.current = null;
        wallPreviewRef.current = null;
        gatePreviewRef.current = null;
        towerPreviewRef.current = null;
      }

      collectStars();
      updateBots(deltaSeconds, now);
      updateDefenseTowers(now);
      updateKraniumTowers(Date.now());
      updateProjectiles(deltaSeconds);
      updateAsteroidDebris(deltaSeconds, now);

      combatEventsRef.current = combatEventsRef.current.filter(
        (event) => Date.now() - Number(event.createdAt || 0) < Number(event.ttl || 900) + 250,
      );
      wallShieldHitsRef.current = wallShieldHitsRef.current.filter(
        (hit) => now - Number(hit.createdAt || now) < Number(hit.ttl || WALL_SHIELD_HIT_TTL_MS) + 60,
      );

      // The Pixi renderer reads this same object every display frame. React
      // updates only the HUD, so movement/rotor/bank animation remains fluid
      // and never restarts while the player is flying.
      pixiLiveRef.current = {
        player,
        players: [],
        bots: [],
        simpleBots: [],
        orbs: [],
        energyCells: [],
        cores: [],
        projectiles: [],
        simpleProjectiles: [],
        adventureStars: starsRef.current,
        adventureAsteroids: asteroidsRef.current,
        adventureGenerator: generatorRef.current,
        adventureDefenseTowers: defenseTowersRef.current,
        adventureKraniumTowers: kraniumTowersRef.current,
        adventureTowerPreview: towerPreviewRef.current,
        adventureWalls: wallsRef.current,
        adventureGates: gatesRef.current,
        adventureWallPreview: wallPreviewRef.current,
        adventureGatePreview: gatePreviewRef.current,
        adventureDemolitionTarget: demolitionTargetRef.current,
        adventureWallShieldHits: wallShieldHitsRef.current,
        adventureProjectiles: projectilesRef.current,
        adventureDebris: asteroidDebrisRef.current,
        combatEvents: combatEventsRef.current,
        combatViewerId: "adventure-player",
        cameraX: cameraRef.current.x,
        cameraY: cameraRef.current.y,
        scale: cameraRef.current.scale,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        worldTheme: "adventure-deep-space",
        staticItemBudget: 170,
      };

      if (now - lastHudAtRef.current >= HUD_INTERVAL_MS) {
        lastHudAtRef.current = now;
        syncHud();
      }

      if (now - lastSaveAtRef.current >= SAVE_INTERVAL_MS) {
        lastSaveAtRef.current = now;
        writeSave();
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    const onKeyDown = (event) => {
      keysRef.current[event.code] = true;

      if (event.code === "KeyI") {
        event.preventDefault();
        setUtilityPanelOpen((open) => !open);
        return;
      }

      if (event.code === "KeyB") {
        event.preventDefault();
        toggleBuildingMode();
        return;
      }

      if (event.code === "KeyR" && buildModeRef.current) {
        event.preventDefault();
        rotateBuildingWall();
        return;
      }

      if (event.code === "KeyX") {
        event.preventDefault();
        toggleDemolitionMode();
        return;
      }

      if (event.code === "Escape" && (buildModeRef.current || demolitionModeRef.current || towerPlacementRef.current || shopOpen)) {
        event.preventDefault();
        setBuildingMode(false);
        setDemolitionMode(false);
        cancelTowerPlacement();
        setShopOpen(false);
        setUtilityPanelOpen(false);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        launchBolt();
      }
    };

    const onKeyUp = (event) => {
      keysRef.current[event.code] = false;
    };

    const onPointerMove = (event) => {
      mouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const shouldBlockBrowserTextActions = (event) => {
      const arena = arenaRef.current;
      if (!arena || !arena.contains(event.target)) return false;

      // Keep real controls usable. Everything else belongs to the game canvas
      // and must never become selectable browser text or a Smart Actions target.
      return !event.target?.closest?.(
        "button, input, textarea, select, a, .adventure-mobile-controls, .adventure-exit, .adventure-shop-backdrop, .adventure-shop-modal",
      );
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.("button, .adventure-mobile-controls, .adventure-exit, .adventure-shop-backdrop, .adventure-shop-modal")) return;

      if (towerPlacementRef.current) {
        placeSelectedTower();
        return;
      }

      if (demolitionModeRef.current) {
        removeSelectedStructure();
        return;
      }

      if (buildModeRef.current) {
        placeSelectedStructure();
        return;
      }

      launchBolt();
    };

    // Edge/Windows can show its floating Text Actions palette after repeated
    // clicks if any DOM text gets selected. Block selection, drag and native
    // context actions only inside Adventure's non-control area.
    const onMouseDown = (event) => {
      if (event.button === 0 && shouldBlockBrowserTextActions(event)) {
        event.preventDefault();
      }
    };

    const onSelectStart = (event) => {
      if (shouldBlockBrowserTextActions(event)) event.preventDefault();
    };

    const onDragStart = (event) => {
      if (shouldBlockBrowserTextActions(event)) event.preventDefault();
    };

    const onContextMenu = (event) => {
      if (shouldBlockBrowserTextActions(event)) event.preventDefault();
    };

    const onDoubleClick = (event) => {
      if (shouldBlockBrowserTextActions(event)) event.preventDefault();
    };

    const onResize = () => {
      if (playerRef.current) updateCamera(playerRef.current);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("selectstart", onSelectStart, true);
    window.addEventListener("dragstart", onDragStart, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("dblclick", onDoubleClick, true);
    window.addEventListener("resize", onResize, { passive: true });

    updateCamera(playerRef.current);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      writeSave();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("selectstart", onSelectStart, true);
      window.removeEventListener("dragstart", onDragStart, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("dblclick", onDoubleClick, true);
      window.removeEventListener("resize", onResize);
    };
  }, [saveKey, previousSaveKey, skin, username, isMobile]);

  const handleJoystickStart = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    joystickPointerRef.current = event.pointerId;
    setMobileJoystick((current) => ({ ...current, active: true }));
  };

  const handleJoystickMove = (event) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const max = Math.max(18, rect.width * 0.31);
    const length = Math.hypot(dx, dy) || 1;
    const factor = Math.min(1, max / length);
    const x = dx * factor;
    const y = dy * factor;
    const normalizedLength = Math.hypot(x, y);

    mobileMoveRef.current = {
      x: normalizedLength > 0.1 ? x / max : 0,
      y: normalizedLength > 0.1 ? y / max : 0,
      active: true,
    };
    setMobileJoystick({ x, y, active: true });
  };

  const handleJoystickEnd = (event) => {
    if (joystickPointerRef.current !== event.pointerId) return;
    joystickPointerRef.current = null;
    mobileMoveRef.current = { x: 0, y: 0, active: false };
    setMobileJoystick({ x: 0, y: 0, active: false });
  };

  const handleMobileFire = (event) => {
    event.preventDefault();
    launchBolt(mobileAimDirectionRef.current);
  };

  const kraniumCountdown = hud.kraniumProductionOnline
    ? formatKraniumCountdown(hud.kraniumNextMs)
    : "OFFLINE";

  const minimapGenerator = generatorRef.current || createAdventureGenerator();
  const minimapGeneratorLeftPct = 50;
  const minimapGeneratorTopPct = 50;
  const generatorMapSpan = GENERATOR_MAP_HALF_SPAN * 2;
  const minimapBaseRingDiameterPct = clamp((STARTER_BASE_RADIUS / GENERATOR_MAP_HALF_SPAN) * 100, 12, 94);
  const minimapWalls = Array.isArray(wallsRef.current) ? wallsRef.current.slice(0, MAX_MILITARY_WALLS) : [];
  const minimapGates = Array.isArray(gatesRef.current) ? gatesRef.current.slice(0, MAX_STARBASE_GATES) : [];
  const toGeneratorMapPercent = (value, center) => clamp(
    50 + ((Number(value || center) - center) / generatorMapSpan) * 100,
    -10,
    110,
  );
  const toGeneratorMapLengthPercent = (value) => Math.max(0.6, (Number(value || 0) / generatorMapSpan) * 100);
  const generatorIntegrityPct = Math.max(
    0,
    Math.min(
      100,
      (Number(hud.generatorHp || GENERATOR_MAX_HP) /
        Math.max(1, Number(hud.generatorMaxHp || GENERATOR_MAX_HP))) * 100,
    ),
  );
  const droneEnergyPct = Math.max(
    0,
    Math.min(
      100,
      (Number(hud.energy || PLAYER_MAX_ENERGY) /
        Math.max(1, Number(hud.maxEnergy || PLAYER_MAX_ENERGY))) * 100,
    ),
  );
  const droneHpPct = Math.max(
    0,
    Math.min(
      100,
      (Number(hud.hp || PLAYER_MAX_HP) / Math.max(1, Number(hud.maxHp || PLAYER_MAX_HP))) * 100,
    ),
  );

  return (
    <div
      ref={arenaRef}
      className="adventure-arena"
      onContextMenu={(event) => event.preventDefault()}
      onSelectStart={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onDoubleClick={(event) => event.preventDefault()}
    >
      <PixiArenaRenderer
        player={playerRef.current}
        players={[]}
        bots={[]}
        projectiles={[]}
        adventureStars={[]}
        adventureAsteroids={[]}
        adventureGenerator={null}
        adventureDefenseTowers={[]}
        adventureKraniumTowers={[]}
        adventureTowerPreview={null}
        adventureWalls={[]}
        adventureGates={[]}
        adventureWallPreview={null}
        adventureGatePreview={null}
        adventureDemolitionTarget={null}
        adventureWallShieldHits={[]}
        adventureProjectiles={[]}
        adventureDebris={[]}
        combatEvents={[]}
        coreTypes={ADVENTURE_CORE_TYPES}
        liveDataRef={pixiLiveRef}
        forceLowQuality={graphicsQuality === "low"}
        worldWidth={WORLD_WIDTH}
        worldHeight={WORLD_HEIGHT}
        worldTheme="adventure-deep-space"
      />

      <section className="adventure-star-counter">
        <span>STAR CHARGE</span>
        <strong>{hud.starAmmo}</strong>
        <small>1 star = 1 Nova Bolt</small>
      </section>

      <section className="adventure-generator-panel">
        <span>STARBASE GENERATOR</span>
        <strong>{hud.generatorHp} / {hud.generatorMaxHp}</strong>
        <div className="adventure-status-bar">
          <i style={{ width: `${generatorIntegrityPct}%` }} />
        </div>
        <small>RECHARGE +1 / 5s NEAR BASE</small>
      </section>

      <section className="adventure-drone-panel">
        <span>DRONE STATUS</span>
        <div className="adventure-drone-panel-row">
          <label>HP</label>
          <strong>{hud.hp} / {hud.maxHp}</strong>
        </div>
        <div className="adventure-status-bar is-hp">
          <i style={{ width: `${droneHpPct}%` }} />
        </div>
        <div className="adventure-drone-panel-row adventure-drone-panel-energy-row">
          <label>ENERGY</label>
          <strong>{hud.energy} / {hud.maxEnergy}</strong>
        </div>
        <div className="adventure-status-bar is-energy">
          <i style={{ width: `${droneEnergyPct}%` }} />
        </div>
        <small>{hud.generatorNearby ? "RECHARGE ONLINE" : "MOVE · -1 ENERGY / 10s"}</small>
      </section>

      <section className={`adventure-inventory ${utilityPanelOpen ? "is-open" : "is-collapsed"}`}>
        <div className="adventure-utility-dock">
          <button
            type="button"
            className={`adventure-utility-button adventure-build-launcher ${utilityPanelOpen ? "is-active" : ""}`}
            onClick={() => setUtilityPanelOpen((open) => !open)}
            aria-expanded={utilityPanelOpen}
          >
            <b aria-hidden="true">⌁</b>
            <span>
              <strong>BUILD</strong>
              <small>{hud.spaceStone || 0} STONE</small>
            </span>
            <kbd>I</kbd>
          </button>

          <button
            type="button"
            className="adventure-shop-button"
            onClick={() => {
              cancelTowerPlacement();
              setUtilityPanelOpen(false);
              setShopOpen(true);
            }}
          >
            <span className="adventure-shop-button-title">
              <b>✦</b>
              <strong>SHOP</strong>
              <em>BASE SYSTEMS</em>
            </span>
          </button>

          <div className={`adventure-shop-kranium-status ${hud.kraniumProductionOnline ? "is-online" : "is-offline"}`}>
            <i>KRANIUM</i>
            <b>{hud.kranium || 0}</b>
            <small>{hud.kraniumProductionOnline ? kraniumCountdown : "OFFLINE"}</small>
          </div>
        </div>

        <div className="adventure-inventory-expanded">
          <header className="adventure-build-console-header">
            <div>
              <span>BASE CONSOLE</span>
              <strong>BUILD &amp; MATERIALS</strong>
            </div>
            <button type="button" onClick={() => setUtilityPanelOpen(false)} aria-label="Close build console">×</button>
          </header>

          <article className="adventure-space-stone-card">
            <span className="inventory-icon inventory-stone" aria-hidden="true">◆</span>
            <div>
              <span>SPACE STONE</span>
              <strong>{hud.spaceStone || 0}</strong>
            </div>
            <em>MINED ORE</em>
          </article>

          <div className="adventure-build-actions">
            <button
              type="button"
              className={`adventure-build-button ${buildMode && buildType === "wall" ? "is-active" : ""}`}
              onClick={() => {
                activateBuildType("wall");
                setUtilityPanelOpen(false);
              }}
              disabled={
                !buildMode &&
                Number(hud.testWallStock || 0) <= 0 &&
                hud.spaceStone < MILITARY_WALL_COST
              }
            >
              {buildMode && buildType === "wall"
                ? "CANCEL WALL"
                : Number(hud.testWallStock || 0) > 0
                  ? `WALL · ${hud.testWallStock} FREE`
                  : `WALL · ${MILITARY_WALL_COST} STONE`}
              <kbd>B</kbd>
            </button>
            <button
              type="button"
              className={`adventure-build-button ${buildMode && buildType === "gate" ? "is-active" : ""}`}
              onClick={() => {
                activateBuildType("gate");
                setUtilityPanelOpen(false);
              }}
              disabled={
                !buildMode &&
                Number(hud.testGateStock || 0) <= 0 &&
                hud.spaceStone < STARBASE_GATE_COST
              }
            >
              {buildMode && buildType === "gate"
                ? "CANCEL GATE"
                : Number(hud.testGateStock || 0) > 0
                  ? `GATE · ${hud.testGateStock} FREE`
                  : `GATE · ${STARBASE_GATE_COST} STONE`}
              <kbd>R</kbd>
            </button>
            <button
              type="button"
              className={`adventure-build-button is-danger ${demolitionMode ? "is-active" : ""}`}
              onClick={() => {
                toggleDemolitionMode();
                setUtilityPanelOpen(false);
              }}
            >
              {demolitionMode ? "REMOVE ACTIVE" : "REMOVE"}
              <kbd>X</kbd>
            </button>
          </div>

          <div className="adventure-build-shortcuts">
            <span><kbd>B</kbd> wall</span>
            <span><kbd>R</kbd> rotate</span>
            <span><kbd>X</kbd> remove</span>
            <span><kbd>ESC</kbd> cancel</span>
          </div>
        </div>

        {(buildMode || demolitionMode || towerPlacement) && (
          <div className="adventure-build-help">
            {towerPlacement
              ? "CLICK A FREE POSITION INSIDE THE BASE"
              : demolitionMode
                ? "CLICK ANY STRUCTURE TO REMOVE · GENERATOR IS PERMANENT"
                : buildType === "gate"
                  ? "CLICK TO PLACE · R TO ROTATE"
                  : "CLICK TO PLACE · WALLS SNAP"}
          </div>
        )}
      </section>

      <div className="adventure-objective">
        <strong>MISSION</strong>
        <span>Protect the Starbase Generator — if it falls, the whole expedition resets from zero</span>
      </div>

      <section className="adventure-minimap">
        <div className="adventure-minimap-title">GENERATOR MAP</div>
        <div className="adventure-minimap-surface">
          <div className="adventure-minimap-grid" aria-hidden="true" />
          <div
            className="adventure-minimap-base-ring"
            aria-hidden="true"
            style={{
              width: `${minimapBaseRingDiameterPct}%`,
              height: `${minimapBaseRingDiameterPct}%`,
            }}
          />
          {minimapWalls.map((wall) => {
            const xPct = toGeneratorMapPercent(wall.x, minimapGenerator.x);
            const yPct = toGeneratorMapPercent(wall.y, minimapGenerator.y);
            return (
              <span
                key={`base-wall-${wall.id}`}
                className="adventure-minimap-wall"
                style={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: `${toGeneratorMapLengthPercent(wall.length || MILITARY_WALL_LENGTH)}%`,
                  transform: `translate(-50%, -50%) rotate(${Number(wall.rotation || 0)}rad)`,
                }}
              />
            );
          })}
          {minimapGates.map((gate) => {
            const xPct = toGeneratorMapPercent(gate.x, minimapGenerator.x);
            const yPct = toGeneratorMapPercent(gate.y, minimapGenerator.y);
            return (
              <span
                key={`base-gate-${gate.id}`}
                className="adventure-minimap-gate"
                style={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: `${toGeneratorMapLengthPercent(gate.length || STARBASE_GATE_LENGTH)}%`,
                  transform: `translate(-50%, -50%) rotate(${Number(gate.rotation || 0)}rad)`,
                }}
              />
            );
          })}
          <div
            className="adventure-minimap-generator"
            style={{
              left: `${minimapGeneratorLeftPct}%`,
              top: `${minimapGeneratorTopPct}%`,
            }}
          />
        </div>
      </section>

      {shopOpen && (
        <div
          className="adventure-shop-backdrop"
          onPointerDown={() => setShopOpen(false)}
          role="presentation"
        >
          <section
            className="adventure-shop-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Adventure shop"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="adventure-shop-close"
              aria-label="Close shop"
              onClick={() => setShopOpen(false)}
            >
              ×
            </button>
            <header className="adventure-shop-header">
              <span>STARBASE MARKET</span>
              <h2>DEFENSE & RARE MATERIAL SYSTEMS</h2>
              <small>Deploy technology only in a clear position inside your protected perimeter.</small>
            </header>

            <div className="adventure-shop-cards">
              <article className="adventure-shop-card is-defense">
                <div className="adventure-shop-art" aria-hidden="true">
                  <svg viewBox="0 0 240 150" focusable="false">
                    <defs>
                      <linearGradient id="shopDefenseHullV2" x1="30" y1="12" x2="208" y2="138" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#d7eaf0" />
                        <stop offset="0.28" stopColor="#557487" />
                        <stop offset="0.68" stopColor="#21333f" />
                        <stop offset="1" stopColor="#091117" />
                      </linearGradient>
                      <linearGradient id="shopDefenseGunV2" x1="112" y1="42" x2="224" y2="95" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#638da0" />
                        <stop offset="1" stopColor="#182832" />
                      </linearGradient>
                      <radialGradient id="shopDefenseCoreV2" cx="50%" cy="42%" r="62%">
                        <stop offset="0" stopColor="#ffffff" />
                        <stop offset="0.34" stopColor="#76f2ff" />
                        <stop offset="1" stopColor="#0a526f" />
                      </radialGradient>
                    </defs>
                    <ellipse cx="120" cy="130" rx="88" ry="13" fill="#15ddff" opacity=".13" />
                    <path d="M64 109 46 88l11-31 29-24h68l29 24 11 31-18 21-46 19H110Z" fill="url(#shopDefenseHullV2)" stroke="#d5f8ff" strokeOpacity=".8" strokeWidth="3" />
                    <path d="M84 98 71 80l12-24 24-13h26l24 13 12 24-13 18-27 11h-19Z" fill="#192a34" stroke="#849eac" strokeOpacity=".72" strokeWidth="2" />
                    <circle cx="120" cy="76" r="25" fill="#081117" stroke="#9cefff" strokeOpacity=".74" strokeWidth="2.5" />
                    <circle cx="120" cy="76" r="15" fill="url(#shopDefenseCoreV2)" />
                    <rect x="112" y="23" width="16" height="21" rx="5" fill="#23404e" /><rect x="112" y="108" width="16" height="21" rx="5" fill="#23404e" />
                    <rect x="51" y="68" width="23" height="16" rx="5" fill="#23404e" /><rect x="166" y="68" width="23" height="16" rx="5" fill="#23404e" />
                    <path d="M128 58 193 39l16 13-67 30Z" fill="url(#shopDefenseGunV2)" stroke="#d1faff" strokeOpacity=".8" strokeWidth="3" />
                    <path d="M130 91 195 72l16 13-67 30Z" fill="url(#shopDefenseGunV2)" stroke="#d1faff" strokeOpacity=".8" strokeWidth="3" />
                    <path d="M201 42 228 33l5 8-26 12M203 75l27-9 5 8-26 12" stroke="#7cf5ff" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="69" cy="54" r="3.5" fill="#ffc878" /><circle cx="170" cy="54" r="3.5" fill="#ffc878" />
                    <circle cx="85" cy="112" r="3.2" fill="#aaffff" /><circle cx="155" cy="112" r="3.2" fill="#aaffff" />
                  </svg>
                </div>
                <div className="adventure-shop-card-copy">
                  <span className="adventure-shop-tag">AUTO DEFENSE</span>
                  <h3>DEFENSE TOWER</h3>
                  <p>A twin-barrel starbase laser emplacement. Scans hostiles within <b>1,650 range</b> and fires a focused beam every <b>2 seconds</b>, dealing <b>1 HP</b>.</p>
                  <div className="adventure-shop-stats"><span>RANGE 1,650</span><span>DMG 1 HP</span><span>2 SEC</span></div>
                  <button
                    type="button"
                    onClick={() => activateTowerPlacement("defense")}
                  >
                    USE DEFENSE TOWER
                  </button>
                </div>
              </article>

              <article className="adventure-shop-card is-kranium">
                <div className="adventure-shop-art" aria-hidden="true">
                  <svg viewBox="0 0 240 150" focusable="false">
                    <defs>
                      <linearGradient id="shopKraniumHullV2" x1="27" y1="12" x2="212" y2="139" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#ded4ff" />
                        <stop offset="0.24" stopColor="#6d4a95" />
                        <stop offset="0.65" stopColor="#291538" />
                        <stop offset="1" stopColor="#0e0816" />
                      </linearGradient>
                      <linearGradient id="shopKraniumDeckV2" x1="54" y1="28" x2="186" y2="121" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#704d95" />
                        <stop offset="1" stopColor="#251535" />
                      </linearGradient>
                      <linearGradient id="shopKraniumShardV2" x1="120" y1="42" x2="120" y2="108" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stopColor="#fffaff" />
                        <stop offset=".26" stopColor="#f1c4ff" />
                        <stop offset=".62" stopColor="#b968ff" />
                        <stop offset="1" stopColor="#6336d2" />
                      </linearGradient>
                      <radialGradient id="shopKraniumGlowV2" cx="50%" cy="50%" r="55%">
                        <stop offset="0" stopColor="#ffffff" stopOpacity=".80" />
                        <stop offset=".45" stopColor="#ca88ff" stopOpacity=".50" />
                        <stop offset="1" stopColor="#b331ff" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <ellipse cx="120" cy="130" rx="88" ry="13" fill="#d350ff" opacity=".17" />
                    <path d="M62 109 43 85l15-32 29-24h66l29 24 15 32-19 24-39 17H101Z" fill="url(#shopKraniumHullV2)" stroke="#f3dcff" strokeOpacity=".82" strokeWidth="3" />
                    <path d="M79 99 67 80l13-25 25-15h30l25 15 13 25-12 19-25 12h-32Z" fill="url(#shopKraniumDeckV2)" stroke="#8d71b8" strokeOpacity=".72" strokeWidth="2" />
                    <rect x="109" y="19" width="22" height="24" rx="7" fill="#694c8f" /><rect x="109" y="108" width="22" height="24" rx="7" fill="#694c8f" />
                    <rect x="47" y="65" width="25" height="21" rx="7" fill="#694c8f" /><rect x="168" y="65" width="25" height="21" rx="7" fill="#694c8f" />
                    <path d="M120 40 136 67l-7 30-9 15-9-15-7-30Z" fill="url(#shopKraniumShardV2)" stroke="#fff3ff" strokeOpacity=".92" strokeWidth="2.6" />
                    <path d="M98 79 112 61l15 15-10 28-15-7Z" fill="#91fff0" opacity=".78" stroke="#efffff" strokeOpacity=".7" strokeWidth="2" />
                    <path d="M142 79 128 61l-15 15 10 28 15-7Z" fill="#dc83ff" opacity=".78" stroke="#fff1ff" strokeOpacity=".7" strokeWidth="2" />
                    <ellipse cx="120" cy="77" rx="54" ry="15" fill="none" stroke="#8afff0" strokeOpacity=".74" strokeWidth="4" />
                    <ellipse cx="120" cy="77" rx="68" ry="25" fill="none" stroke="#d66dff" strokeOpacity=".54" strokeWidth="2.6" transform="rotate(-28 120 77)" />
                    <circle cx="120" cy="77" r="37" fill="url(#shopKraniumGlowV2)" />
                    <path d="M120 43v-15M120 111v15M90 77H74M150 77h16" stroke="#7956a4" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="84" cy="52" r="3.6" fill="#82fff0" /><circle cx="156" cy="52" r="3.6" fill="#ff90f4" />
                    <circle cx="84" cy="102" r="3.6" fill="#ff90f4" /><circle cx="156" cy="102" r="3.6" fill="#82fff0" />
                  </svg>
                </div>
                <div className="adventure-shop-card-copy">
                  <span className="adventure-shop-tag is-rare">RARE MATERIAL</span>
                  <h3>KRANIUM TOWER</h3>
                  <p>A sealed orbital crystal refinery with injector arms and containment coils. Once placed, it generates <b>1 Kranium</b> every <b>24 hours</b>, even while you are away.</p>
                  <div className="adventure-shop-stats"><span>1 / 24H</span><span>RARE</span><span>OWNED {hud.kranium || 0}</span></div>
                  <button
                    type="button"
                    onClick={() => activateTowerPlacement("kranium")}
                  >
                    USE KRANIUM TOWER
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      )}

      <button type="button" className="adventure-exit" onClick={onExitToMenu}>
        EXIT TO MENU
      </button>

      {isMobile && (
        <div className="adventure-mobile-controls">
          <div
            className="adventure-mobile-joystick"
            onPointerDown={handleJoystickStart}
            onPointerMove={handleJoystickMove}
            onPointerUp={handleJoystickEnd}
            onPointerCancel={handleJoystickEnd}
          >
            <div
              ref={joystickKnobRef}
              className="adventure-mobile-joystick-knob"
              style={{
                transform: `translate(${mobileJoystick.x}px, ${mobileJoystick.y}px)`,
                transition: mobileJoystick.active ? "none" : "transform 0.12s ease-out",
              }}
            />
          </div>

          <button type="button" className="adventure-mobile-fire" onPointerDown={handleMobileFire}>
            FIRE
          </button>
        </div>
      )}
    </div>
  );
}

export default Adventure;
