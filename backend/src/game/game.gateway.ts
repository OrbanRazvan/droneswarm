import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

const WORLD_WIDTH = 15000;
const WORLD_HEIGHT = 15000;
const ROOM_MAX_PLAYERS = 60;
const ROOM_MIN_PLAYERS = 2;

const NORMAL_ROOM_MAX_PLAYERS = 60;
const NORMAL_ROOM_MIN_PLAYERS = 1;
const NORMAL_WORLD_WIDTH = 14000;
const NORMAL_WORLD_HEIGHT = 14000;
const NORMAL_ROOM_ZONE_RADIUS = 100000;
const NORMAL_VISIBLE_PLAYERS_LIMIT = 60;

// 14k x 14k Normal PvP loot pacing. Orb density scales with active players;
// energy is intentionally much rarer and every consumed item respawns at a
// new random point in the arena.
// Normal PvP orb economy is intentionally world-distributed, not player-local.
// One orb can exist in each deterministic grid cell, so desktop and mobile
// see the same server-authoritative map without "orb piles" around players.
const NORMAL_ORB_BASE_TARGET = 420;
const NORMAL_ORB_PER_ALIVE_PLAYER = 22;
const NORMAL_ORB_MAX_TARGET = 650;
const NORMAL_ORB_DISTRIBUTION_VERSION = 3;
const NORMAL_ORB_GRID_MARGIN = 260;
// A collected Normal PvP orb must never respawn on top of the same player.
// The delay plus collector-distance gate preserves the even grid distribution
// without allowing one stationary drone to collect the same logical slot every tick.
const NORMAL_ORB_RESPAWN_DELAY_MIN_MS = 2600;
const NORMAL_ORB_RESPAWN_DELAY_MAX_MS = 4200;
const NORMAL_ORB_RESPAWN_RETRY_MS = 900;
const NORMAL_ORB_RESPAWN_SAFE_DISTANCE = 460;
const NORMAL_ENERGY_BASE_TARGET = 80;
const NORMAL_ENERGY_PER_ALIVE_PLAYER = 5;
const NORMAL_ENERGY_MAX_TARGET = 180;

// A Normal PvP player should always have a few real, server-authoritative
// energy cells in the playable camera area. These are not client-only props:
// they are normal world items and are collected/validated on the backend.
const NORMAL_LOCAL_ENERGY_TARGET = 3;
const NORMAL_LOCAL_ENERGY_ADD_LIMIT = 3;
const NORMAL_LOCAL_ENERGY_RADIUS = 1900;
const NORMAL_LOCAL_ENERGY_MIN_DISTANCE = 360;
const NORMAL_LOCAL_ENERGY_MAX_DISTANCE = 1650;

// Normal PvP has a denser nearby-loot stream than the other modes. These only
// affect what is replicated around the player; the real world remains server-authoritative.
const NORMAL_VISIBLE_ORB_LIMIT = 160;
const NORMAL_VISIBLE_ENERGY_LIMIT = 60;

// Normal PvP movement / projectile pacing.
const NORMAL_BASE_MOVE_SPEED_MULTIPLIER = 1.08;
const NORMAL_BASE_ATTACK_DRONE_SPEED_MULTIPLIER = 1.12;
const NORMAL_KILL_MOVE_SPEED_STEP = 0.15;
const NORMAL_KILL_ATTACK_DRONE_SPEED_STEP = 0.05;
const NORMAL_MAX_MOVE_SPEED_MULTIPLIER = 1.75;
const NORMAL_MAX_ATTACK_DRONE_SPEED_MULTIPLIER = 1.25;

const BR_ONLINE_ROOM_MAX_PLAYERS = 60;
const BR_ONLINE_ROOM_MIN_PLAYERS = 2;
const BR_ONLINE_START_COUNTDOWN_MS = 5000;
const BR_ONLINE_ZONE_SHRINK_DURATION = 600000;
const BR_ONLINE_ZONE_DAMAGE = 10;
const BR_ONLINE_ZONE_DAMAGE_INTERVAL = 1000;
const BR_ONLINE_VISIBLE_PLAYERS_LIMIT = 60;

// ---------------------------------------------------------------------------
// ZONE PVP - mod nou, clona exacta a Normal PvP (normal-pvp:*) la care se
// adauga DOAR o zona verde care se strange timp de 10 minute, 10 HP/secunda
// in afara ei, si o conditie de victorie (ultimul jucator viu castiga).
// Refolosim aceeasi harta (WORLD_WIDTH/HEIGHT) si aceeasi raza de start/final
// ca BR Online (ZONE_START_RADIUS/ZONE_END_RADIUS definite mai jos), pentru
// ca zona sa acopere intreaga harta de 10000x10000 la fel ca celelalte moduri
// care au deja zona.
// ---------------------------------------------------------------------------
const ZONE_PVP_ROOM_MAX_PLAYERS = 60;
// Zone PvP waits for real human players only. Bots are never used to unlock a lobby.
const ZONE_PVP_ROOM_MIN_PLAYERS = 3;
// Once three real players are present, leave a brief window for more humans to join.
const ZONE_PVP_START_COUNTDOWN_MS = 5000;
const ZONE_PVP_BATTLE_PREPARE_DURATION = 30000;
const ZONE_PVP_ZONE_SHRINK_DURATION = 420000;
const ZONE_PVP_ZONE_DAMAGE = 10;
const ZONE_PVP_ZONE_DAMAGE_INTERVAL = 1000;
const ZONE_PVP_VISIBLE_PLAYERS_LIMIT = 60;

// A Zone PvP round always starts with this many participants. Any missing seats
// after the five-second human-only admission window are filled server-side.
const ZONE_PVP_BOT_TARGET_TOTAL = ZONE_PVP_ROOM_MAX_PLAYERS;
const ZONE_PVP_BOT_SPEED_MULTIPLIER = 1.08;
const ZONE_PVP_BOT_FIRE_COOLDOWN_MS = 650;
const ZONE_PVP_BOT_OPENING_ORB_FARM_MS = 10000;
const ZONE_PVP_BOT_VIEW_RANGE = 4600;
const ZONE_PVP_BOT_GLOBAL_HUNT_RANGE = 11200;
const ZONE_PVP_BOT_ATTACK_RANGE = 1710;
const ZONE_PVP_BOT_SAFE_DISTANCE = 760;
const ZONE_PVP_BOT_ZONE_EDGE_BUFFER = 720;
const ZONE_PVP_BOT_THREAT_RADIUS = 2200;
// Bots keep their current held input on every 60 Hz simulation tick, but
// expensive target/loot scans are spread farther apart. This saves CPU in a
// 60-seat bot round without making trajectories feel stepped.
const ZONE_PVP_BOT_AI_REPLAN_MIN_MS = 180;
const ZONE_PVP_BOT_AI_REPLAN_MAX_MS = 320;
const ZONE_PVP_BOT_SPAWN_MIN_DISTANCE = 1000;
const ZONE_PVP_BOT_NAMES = ["DarkNova", "SkyHunter", "CyberCore", "NanoByte", "RedPulse"];
const ZONE_PVP_BOT_SKINS = [
  "cyan", "red", "purple", "orange", "green", "pink", "ice-blue", "solar-gold",
  "shadow-black", "toxic-lime", "royal-violet", "crimson-white", "neon-teal",
  "ember-red", "arctic-silver", "void-purple", "plasma-pink", "jade-black",
  "azure-white", "inferno-orange", "midnight-blue", "acid-green", "ruby-black",
  "ghost-white", "cyber-yellow", "deep-ocean", "magenta-cyan", "bronze-steel",
  "electric-indigo", "dark-emerald", "emerald-rift-a", "emerald-rift-b", "emerald-rift-c",
];

const COLLISION_GRID_CELL_SIZE = 600;

// Network / replication tuning. Simulation remains 60 Hz, but clients receive
// compact snapshots at a rate that scales down in crowded rooms.
const NORMAL_STATE_INTERVAL_MS = 33; // 30 Hz in small PvP rooms
const NORMAL_STATE_INTERVAL_SOLO_MS = 33; // 30 Hz authoritative snapshots; local prediction remains 60 Hz
const NORMAL_STATE_INTERVAL_CROWDED_MS = 33; // 30 Hz at 12+ players
const NORMAL_STATE_INTERVAL_HEAVY_MS = 50; // 20 Hz at 28+ players
const BATTLE_ROYALE_STATE_INTERVAL_MS = 33;
const BATTLE_ROYALE_STATE_INTERVAL_CROWDED_MS = 50;
const ZONE_STATE_INTERVAL_MS = 25; // 40 Hz in small PvP rooms
const ZONE_STATE_INTERVAL_CROWDED_MS = 33; // 30 Hz at 12+ players
const ZONE_STATE_INTERVAL_HEAVY_MS = 50; // 20 Hz at 28+ players

// Zone PvP keeps full snapshots compact, then sends a tiny transform-only
// stream for nearby opponents. This decouples smooth remote motion from the
// slower sender's render/input cadence and from heavier loot/HUD payloads.
// Transform packets are disposable: newer coordinates replace older ones
// instead of forming a backlog on slow devices.
// Zone PvP uses a dedicated transform stream. It runs every simulation tick
// in bot-filled matches (normally only a few real browser clients) so remote
// drones and attack drones never wait behind the heavier HUD/loot snapshot.
const ZONE_MOVEMENT_STREAM_INTERVAL_MS = 16; // 60 Hz (one stream per server tick)
const ZONE_MOVEMENT_STREAM_CROWDED_INTERVAL_MS = 25; // 40 Hz only for genuinely human-crowded rooms
const ZONE_MOVEMENT_STREAM_MAX_PLAYERS = ZONE_PVP_ROOM_MAX_PLAYERS;
const ZONE_MOVEMENT_STREAM_PROJECTILE_LIMIT = 32;
const ZONE_MOVEMENT_STREAM_RANGE_PADDING = 560;
const STATIC_STATE_INTERVAL_MS = 500; // minimap + leaderboard
const VIEWPORT_ITEM_STATE_INTERVAL_MS = 125; // static nearby loot, per player
const PVP_CROWDED_STATE_THRESHOLD = 12;
const PVP_HEAVY_STATE_THRESHOLD = 28;
const ITEM_SPATIAL_CELL_SIZE = 1000;
const ITEM_ZONE_PRUNE_INTERVAL_MS = 500;
// Loot is static most of the time. Rebuilding three spatial maps every 16 ms
// creates needless CPU/GC pressure on Render and makes solo Normal PvP feel slow.
const STATIC_ITEM_SPATIAL_INDEX_INTERVAL_MS = 90;
const NORMAL_HIGH_POPULATION_THRESHOLD = 16;
const NORMAL_CROWDED_ORB_TARGET = 24;
const NORMAL_CROWDED_ORB_ADD_LIMIT = 12;
const NORMAL_CROWDED_ORB_EXTRA_CAP = 30;

// Spectator lifecycle: a dead player remains in the room and follows the
// player who eliminated them. This is intentionally independent from input
// freshness so spectators are never removed just because they no longer send
// movement input after dying.
const SPECTATOR_KILL_CREDIT_WINDOW_MS = 6000;

// Empty rooms stay alive briefly so a player who reconnects can reuse the same
// in-memory world. The timer starts when the last socket leaves, never when the
// room was originally created.
const EMPTY_ROOM_GRACE_MS = 30000;

const ROOM_START_COUNTDOWN_MS = 5000;
const MAP_MIN_SIZE = Math.min(WORLD_WIDTH, WORLD_HEIGHT);
const ZONE_START_RADIUS = MAP_MIN_SIZE * 0.47;
const ZONE_END_RADIUS = 1;
const ZONE_SHRINK_DURATION = 300000;
const PLAYER_SPEED = 2.6;
const PLAYER_RADIUS = 80;
const VIEW_DISTANCE = 2400;
const MAX_ORBS = 140;
const MIN_ORBS = 70;
const VISIBLE_ORB_LIMIT = 160;
const ORB_COLLECT_DISTANCE = 180;
const COLORS = ["cyan", "green", "orange", "purple", "red", "pink"];
const START_HP = 100;
const MAX_HP = 150;
const KILL_HP_REWARD = 10;
const KILL_ATTACK_SPEED_MULTIPLIER = 0.85;
const MIN_KILL_ATTACK_SPEED_MULTIPLIER = 0.45;
const START_ENERGY = 100;
const ENERGY_DRAIN_INTERVAL = 1000;
const ENERGY_DRAIN_AMOUNT = 1;
const ZONE_DAMAGE = 10;
const ZONE_DAMAGE_INTERVAL = 1000;
const MAX_ENERGY_CELLS = 50;
const MIN_ENERGY_CELLS = 18;
const VISIBLE_ENERGY_LIMIT = 45;
const ENERGY_CELL_COLLECT_DISTANCE = 160;
const DRONE_REQUIREMENTS = [5, 15, 25, 35, 50];
const MAX_DRONES = 5;
const FIRE_COOLDOWN = 3000;
const PROJECTILE_SPEED = 4.4;
const PROJECTILE_MAX_DISTANCE = 4200;
const PROJECTILE_MAX_LIFETIME = 10000;
const PROJECTILE_DAMAGE = 15;
const VISIBLE_PROJECTILE_LIMIT = 120;
const CORE_WAVE_SIZE = 9;
const CORE_RESPAWN_DELAY = 60000;
const CORE_WARNING_DELAY = 5000;
const CORE_COLLECT_DISTANCE = 175;
const MAX_ACTIVE_CORES = 2;
const ROTOR_MAX_LEVEL = 2;
const OVERCLOCK_DURATION = 25000;
const BERSERK_DURATION = 10000;
const VAMPIRE_DURATION = 15000;
const BERSERK_PROJECTILE_DAMAGE = 75;
const VAMPIRE_HEAL_RATIO = 0.25;
const SWARM_CORE_DRONES = 2;
const SHIELD_BREAKER_SHOTS = 1;
const BODY_COLLISION_DISTANCE = 145;
const BODY_COLLISION_COOLDOWN = 650;
const BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE = 5;
const BODY_COLLISION_BOTH_NO_DRONES_DAMAGE = 15;
const BODY_COLLISION_WITH_DRONES_DAMAGE = 5;
const BODY_COLLISION_WITHOUT_DRONES_DAMAGE = 15;
// Collision physics is server-authoritative. The impulse is integrated as a
// tiny decaying velocity, so it feels like a real drone bump instead of a
// teleport. Pair detection still uses the existing grid in crowded rooms.
const BODY_COLLISION_LIGHT_PUSH = 6;
const BODY_COLLISION_MEDIUM_PUSH = 9;
const BODY_COLLISION_STRONG_PUSH = 12;
const BODY_COLLISION_PUSH_DECAY = 0.95;
const BODY_COLLISION_PUSH_MIN = 0.04;
// Small authoritative separation prevents two networked drones from staying overlapped
// until the next tick. The decaying impulse then creates the Battle Royale-style bounce.
const BODY_COLLISION_SEPARATION = 18;
const CORE_TYPES = [
  "nano",
  "rotor",
  "piercing",
  "overclock",
  "berserk",
  "shield-breaker",
  "swarm",
  "vampire",
  "emp",
];
function normalizeSkin(skin) {
  const clean = String(skin || "cyan")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
  if (!clean || clean === "basic" || clean === "basic-drone") return "cyan";
  return clean;
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: false,
  },
  // Start with Engine.IO polling as a compatibility handshake, then upgrade
  // to WebSocket automatically. This is important on mobile browsers and some
  // mobile networks where an immediate WSS upgrade can be delayed or blocked
  // during the first page transition. Gameplay still runs on WebSocket after
  // the upgrade; polling is only the robust fallback.
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  perMessageDeflate: false,
  httpCompression: false,
  // Mobile browsers can briefly pause timers while a page changes orientation
  // or returns from the background. Keep the transport alive long enough for
  // the client-side idempotent join handshake to recover cleanly.
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class GameGateway {
  @WebSocketServer()
  server!: Server;

  private rooms = new Map<string, any>();
  private socketRoom = new Map<string, string>();
  private normalRooms = new Map<string, any>();
  private normalSocketRoom = new Map<string, string>();
  private battleRoyaleOnlineRooms = new Map<string, any>();
  private battleRoyaleOnlineSocketRoom = new Map<string, string>();
  private zonePvpRooms = new Map<string, any>();
  private zonePvpSocketRoom = new Map<string, string>();
  private loop: NodeJS.Timeout | null = null;
  private lastLoopAt = Date.now();

  constructor() {}

  /**
   * Keeps matchmaking dense: new players join the busiest compatible room
   * instead of spreading across many partially-filled simulations.
   * Ties prefer the older room so a reconnectable empty room is reused first.
   */
  private selectMostPopulatedJoinableRoom(
    rooms: Map<string, any>,
    canJoin: (room: any) => boolean,
  ) {
    let selected: any = null;

    for (const room of rooms.values()) {
      if (!canJoin(room)) continue;

      if (
        !selected ||
        room.players.size > selected.players.size ||
        (room.players.size === selected.players.size &&
          Number(room.createdAt || 0) < Number(selected.createdAt || 0))
      ) {
        selected = room;
      }
    }

    return selected;
  }

  private markRoomOccupied(room: any) {
    if (room) room.emptySince = null;
  }

  private markRoomEmptyIfNeeded(room: any, now = Date.now()) {
    if (room && room.players.size === 0 && !room.emptySince) {
      room.emptySince = now;
    }
  }

  private shouldDeleteEmptyRoom(room: any, now: number) {
    if (!room || room.players.size !== 0) return false;

    // Fallback keeps an in-flight deployment safe for a room created before
    // this field existed.
    const emptySince = Number(room.emptySince || room.createdAt || now);
    if (!room.emptySince) room.emptySince = emptySince;

    return now - emptySince >= EMPTY_ROOM_GRACE_MS;
  }

  // Normal PvP and Zone PvP share the same combat progression rules:
  // shield-break, escort-drone loss, kill speed rewards and Pixi combat text.
  private usesProgressionPvpCombat(room: any) {
    return Boolean(room?.normalMode || room?.zonePvpMode);
  }


  // -------------------------------------------------------------------------
  // Zone PvP server bots
  // -------------------------------------------------------------------------
  // Bots live in the exact same authoritative player map as human players.
  // Therefore they use the same projectile, shield, collision, loot, core,
  // zone-damage and victory code. The only extra work is choosing held input.
  private getZoneHumanPlayers(room: any) {
    return [...(room?.players?.values?.() || [])].filter((player: any) => !player?.isBot);
  }

  private getZoneHumanPlayerCount(room: any) {
    return this.getZoneHumanPlayers(room).length;
  }

  private getZoneBotCount(room: any) {
    let count = 0;
    for (const player of room?.players?.values?.() || []) {
      if (player?.isBot) count += 1;
    }
    return count;
  }

  private normalizeZoneBotVector(x: number, y: number) {
    const length = Math.hypot(Number(x || 0), Number(y || 0));
    if (length < 0.0001) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  }

  private getZoneBotPower(unit: any) {
    return (
      Number(unit?.hp || 0) +
      Number(unit?.drones || 0) * 35 +
      Number(unit?.totalCollected || 0) * 2 +
      Number(unit?.kills || 0) * 18
    );
  }

  private getZoneBotSpawn(room: any, zoneRadius: number) {
    const existing = [...(room?.players?.values?.() || [])].filter((unit: any) => unit?.alive !== false);
    const safeRadius = Math.max(900, Number(zoneRadius || ZONE_START_RADIUS) - 1200);

    for (let attempt = 0; attempt < 180; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * safeRadius;
      const x = WORLD_WIDTH / 2 + Math.cos(angle) * distance;
      const y = WORLD_HEIGHT / 2 + Math.sin(angle) * distance;
      if (!this.isInsideSafeZone(x, y, zoneRadius, 760)) continue;

      let clear = true;
      for (const other of existing) {
        const dx = Number(other.x || 0) - x;
        const dy = Number(other.y || 0) - y;
        if (dx * dx + dy * dy < ZONE_PVP_BOT_SPAWN_MIN_DISTANCE * ZONE_PVP_BOT_SPAWN_MIN_DISTANCE) {
          clear = false;
          break;
        }
      }
      if (clear) {
        return {
          x: this.clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
          y: this.clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
      }
    }

    return this.getSafeSpawn(room, zoneRadius);
  }

  private createZonePvpBot(room: any, index: number, zoneRadius: number) {
    const now = Date.now();
    const archetypes = ["hunter", "sentinel", "opportunist", "raider"];
    const aiArchetype = archetypes[index % archetypes.length];
    const spawn = this.getZoneBotSpawn(room, zoneRadius);
    const id = `zone-bot-${room.id}-${index + 1}-${crypto.randomUUID().slice(0, 8)}`;

    return {
      id,
      isBot: true,
      isGuest: false,
      userId: null,
      username: `${ZONE_PVP_BOT_NAMES[index % ZONE_PVP_BOT_NAMES.length]}-${index + 1}`,
      skin: ZONE_PVP_BOT_SKINS[index % ZONE_PVP_BOT_SKINS.length],
      ...spawn,
      prevX: spawn.x,
      prevY: spawn.y,
      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      drones: 0,
      progress: 0,
      nextDroneAt: DRONE_REQUIREMENTS[0],
      totalCollected: 0,
      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      killAttackSpeedMultiplier: 1,
      moveSpeedMultiplier: 1,
      attackDroneSpeedMultiplier: 1,
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
      alive: true,
      input: {},
      lastSeenAt: now,
      lastInputReceivedAt: now,
      lastEnergyDrainAt: now,
      lastZoneDamageAt: now,
      lastFireAt: 0,
      lastShieldAt: 0,
      shieldActive: false,
      shieldUntil: 0,
      knockbackX: 0,
      knockbackY: 0,
      velocityX: 0,
      velocityY: 0,
      moveX: 0,
      moveY: 0,
      moveAngle: -Math.PI / 2,
      isMoving: false,
      gridKey: null,
      lastProcessedInputSeq: 0,
      lastReceivedInputSeq: 0,
      pendingInputSeq: 0,
      lastDamageEventAt: 0,
      killedById: null,
      spectatorTargetId: null,
      lastDamageById: null,
      lastDamageAt: 0,
      eliminatedAt: 0,
      eliminationReason: null,
      collectionSeq: 0,
      // BattleRoyaleMode-inspired tactical personality.
      aiArchetype,
      aiAggression:
        aiArchetype === "hunter"
          ? 1.38 + Math.random() * 0.24
          : aiArchetype === "raider"
            ? 1.20 + Math.random() * 0.22
            : 1.05 + Math.random() * 0.20,
      aiCourage:
        aiArchetype === "sentinel"
          ? 1.00 + Math.random() * 0.18
          : 1.14 + Math.random() * 0.26,
      aiSkill: 1.28 + Math.random() * 0.42,
      desiredDroneStock: 1 + Math.floor(Math.random() * 2),
      preferredRange:
        aiArchetype === "hunter"
          ? 520 + Math.random() * 120
          : aiArchetype === "sentinel"
            ? 700 + Math.random() * 150
            : 600 + Math.random() * 150,
      aiPlanUntil: 0,
      aiMoveX: 0,
      aiMoveY: 0,
      aiAimX: spawn.x + 240,
      aiAimY: spawn.y,
      aiAttacking: false,
      aiUseShield: false,
      aiTargetEnemyId: null,
      aiTargetOrbId: null,
      aiTargetEnergyCellId: null,
      aiState: "opening-orb-farm",
      aiWanderAngle: Math.random() * Math.PI * 2,
      aiStrafeDir: index % 2 === 0 ? 1 : -1,
    };
  }

  private fillZonePvpBots(room: any, now: number, zoneRadius: number) {
    if (!room?.zonePvpMode) return 0;
    const target = Math.max(0, Math.min(ZONE_PVP_BOT_TARGET_TOTAL, ZONE_PVP_ROOM_MAX_PLAYERS));
    let created = 0;

    while (room.players.size < target) {
      const bot = this.createZonePvpBot(room, this.getZoneBotCount(room), zoneRadius);
      room.players.set(bot.id, bot);
      created += 1;
    }

    room.botFilled = true;
    room.botFillAt = now;
    room.itemSpatialDirty = true;
    room.lastStaticStateAt = 0;
    return created;
  }

  private getZoneBotZoneInfo(bot: any, zoneRadius: number) {
    const dx = WORLD_WIDTH / 2 - Number(bot?.x || 0);
    const dy = WORLD_HEIGHT / 2 - Number(bot?.y || 0);
    const distance = Math.hypot(dx, dy) || 1;
    return {
      distance,
      dangerDistance: Number(zoneRadius || 0) - distance,
      outside: distance > Number(zoneRadius || 0),
      towardCenterX: dx / distance,
      towardCenterY: dy / distance,
    };
  }

  private getZoneBotAvoidance(bot: any, units: any[], radius = 420) {
    let x = 0;
    let y = 0;
    for (const other of units) {
      if (!other?.alive || other.id === bot.id) continue;
      const dx = Number(bot.x || 0) - Number(other.x || 0);
      const dy = Number(bot.y || 0) - Number(other.y || 0);
      const distance = Math.hypot(dx, dy) || 1;
      if (distance >= radius) continue;
      const force = (radius - distance) / radius;
      x += (dx / distance) * force;
      y += (dy / distance) * force;
    }
    return { x, y };
  }

  private findZoneBotEnemy(bot: any, units: any[], phase: string) {
    if (!bot?.alive || Number(bot.drones || 0) <= 0) return null;

    const ownPower = this.getZoneBotPower(bot);
    const localRange = phase === "endgame" ? 7000 : 5200;
    let nearbyEnemyCount = 0;
    let strongerEnemyCount = 0;
    let weakEnemyCount = 0;
    let best: any = null;
    let bestScore = Infinity;

    for (const enemy of units) {
      if (!enemy?.alive || enemy.id === bot.id) continue;
      const dx = Number(enemy.x || 0) - Number(bot.x || 0);
      const dy = Number(enemy.y || 0) - Number(bot.y || 0);
      const distance = Math.hypot(dx, dy);
      if (distance > ZONE_PVP_BOT_GLOBAL_HUNT_RANGE) continue;

      const enemyPower = this.getZoneBotPower(enemy);
      if (distance <= ZONE_PVP_BOT_THREAT_RADIUS) {
        nearbyEnemyCount += 1;
        if (enemyPower > ownPower * 1.10) strongerEnemyCount += 1;
        if (enemyPower < ownPower * 0.84 || Number(enemy.hp || 0) <= 52 || Number(enemy.drones || 0) <= 1) {
          weakEnemyCount += 1;
        }
      }

      const enemyWeak = Number(enemy.hp || 0) <= 58 || Number(enemy.drones || 0) <= 1 || Number(enemy.energy || 0) <= 18;
      const droneAdvantage = Number(bot.drones || 0) >= Number(enemy.drones || 0) + 1;
      const canWin =
        droneAdvantage ||
        enemyWeak ||
        ownPower * Number(bot.aiCourage || 1) >= enemyPower * (phase === "endgame" ? 0.70 : 0.82);

      let score = distance;
      if (distance > localRange) score += 260 + (distance - localRange) * 0.08;
      if (bot.aiTargetEnemyId === enemy.id) score -= 190;
      if (enemyWeak) score -= 420;
      if (droneAdvantage) score -= 300;
      if (canWin) score -= 220;
      if (Number(enemy.hp || 0) < Number(bot.hp || 0)) score -= 95;
      if (enemyPower > ownPower * 1.65 && !enemyWeak) score += 150;
      if (enemy.isBot === false && bot.aiArchetype === "hunter") score -= 820;
      if (enemy.isBot === false && bot.aiArchetype === "raider") score -= 360;
      if (bot.aiArchetype === "opportunist" && enemyWeak) score -= 260;

      if (score < bestScore) {
        bestScore = score;
        best = {
          id: enemy.id,
          x: Number(enemy.x || 0),
          y: Number(enemy.y || 0),
          hp: Number(enemy.hp || 0),
          drones: Number(enemy.drones || 0),
          energy: Number(enemy.energy || 0),
          isBot: Boolean(enemy.isBot),
          distance,
          enemyPower,
          botPower: ownPower,
          enemyWeak,
          droneAdvantage,
          canWin,
        };
      }
    }

    return best
      ? { ...best, nearbyEnemyCount, strongerEnemyCount, weakEnemyCount }
      : null;
  }

  private findZoneBotItem(bot: any, items: any[], zoneRadius: number, kind: "orb" | "energy" | "core") {
    let best: any = null;
    let bestScore = Infinity;
    const stride = kind === "orb" && items.length > 260 ? 2 : 1;

    for (let index = 0; index < items.length; index += stride) {
      const item = items[index];
      if (!item?.id || !this.isInsideSafeZone(item.x, item.y, zoneRadius, kind === "core" ? 420 : 120)) continue;
      const dx = Number(item.x || 0) - Number(bot.x || 0);
      const dy = Number(item.y || 0) - Number(bot.y || 0);
      if (Math.abs(dx) > ZONE_PVP_BOT_VIEW_RANGE || Math.abs(dy) > ZONE_PVP_BOT_VIEW_RANGE) continue;
      const distance = Math.hypot(dx, dy);
      let score = distance;
      if (kind === "energy") {
        const energy = Number(bot.energy || START_ENERGY);
        if (energy <= 25) score -= 720;
        else if (energy <= 45) score -= 480;
        else if (energy <= 65) score -= 260;
      }
      if (kind === "core" && !this.canUseCore(bot, item)) continue;
      if (score < bestScore) {
        bestScore = score;
        best = { ...item, distance };
      }
    }
    return best;
  }

  private updateZonePvpBots(room: any, now: number, zoneRadius: number, _deltaFrames = 1) {
    if (!room?.zonePvpMode || room.status !== "playing") return;
    const units = this.getAlivePlayers(room);
    const bots = units.filter((unit) => unit?.isBot);
    if (!bots.length) return;

    const battleLocked = this.isBattlePrepareLocked(room, now);
    const matchElapsedMs = Math.max(0, now - Number(room.matchStartedAt || now));
    const aliveCount = units.length;
    const phase =
      aliveCount <= 20 || zoneRadius <= 3600
        ? "endgame"
        : matchElapsedMs < ZONE_PVP_BOT_OPENING_ORB_FARM_MS
          ? "opening-farm"
          : aliveCount <= 48 || zoneRadius <= 6500
            ? "midgame"
            : "skirmish";
    const openingFarm = phase === "opening-farm";

    for (const bot of bots) {
      const mustPlan =
        !Number(bot.aiPlanUntil || 0) ||
        now >= Number(bot.aiPlanUntil || 0) ||
        !Number.isFinite(Number(bot.aiMoveX)) ||
        !Number.isFinite(Number(bot.aiMoveY));

      if (mustPlan) {
        const zone = this.getZoneBotZoneInfo(bot, zoneRadius);
        const avoidance = this.getZoneBotAvoidance(
          bot,
          units,
          openingFarm ? 620 : phase === "endgame" ? 330 : 430,
        );
        let desiredX = Number(bot.aiMoveX || 0);
        let desiredY = Number(bot.aiMoveY || 0);
        let aimX = Number(bot.aiAimX || bot.x + 240);
        let aimY = Number(bot.aiAimY || bot.y);
        let attacking = false;
        let useShield = false;
        let state = bot.aiState || "search-safe-orbs";
        let targetEnemyId: string | null = null;
        let targetOrbId: string | null = null;
        let targetEnergyCellId: string | null = null;

        if (zone.outside || zone.dangerDistance < ZONE_PVP_BOT_ZONE_EDGE_BUFFER) {
          const weight = zone.outside ? 7.5 : 3.6;
          const normalized = this.normalizeZoneBotVector(
            zone.towardCenterX * weight + avoidance.x * 0.3,
            zone.towardCenterY * weight + avoidance.y * 0.3,
          );
          desiredX = normalized.x;
          desiredY = normalized.y;
          aimX = WORLD_WIDTH / 2;
          aimY = WORLD_HEIGHT / 2;
          state = zone.outside ? "escape-zone-smart" : "avoid-zone-edge";
        } else {
          const enemy = openingFarm ? null : this.findZoneBotEnemy(bot, units, phase);
          const botPower = this.getZoneBotPower(bot) * Number(bot.aiCourage || 1);
          const enemyPower = Number(enemy?.enemyPower || 0);
          const enemyWeak = Boolean(enemy?.enemyWeak);
          const droneAdvantage = Boolean(enemy?.droneAdvantage);
          const nearbyEnemyCount = Number(enemy?.nearbyEnemyCount || 0);
          const strongerEnemyCount = Number(enemy?.strongerEnemyCount || 0);
          const beingThreatened = Boolean(
            enemy &&
              enemy.distance < 520 &&
              ((enemyPower > botPower * 1.32 && enemy.drones >= Number(bot.drones || 0) + 1) || nearbyEnemyCount >= 4),
          );
          const needsEmergencyFarm = Number(bot.drones || 0) <= 0;
          const lowHpThreshold = phase === "endgame" ? 20 : 25;
          const shouldFlee = Boolean(
            enemy &&
              !openingFarm &&
              (Number(bot.hp || 0) <= lowHpThreshold ||
                Number(bot.energy || 0) <= 2 ||
                (strongerEnemyCount >= 4 && !droneAdvantage) ||
                (enemyPower > botPower * 1.75 && !droneAdvantage && nearbyEnemyCount >= 3)),
          );
          const aggression = phase === "endgame" ? 1.58 : phase === "midgame" ? 1.42 : 1.30;
          const pursuitRange = Math.min(
            PROJECTILE_MAX_DISTANCE * 0.96,
            ZONE_PVP_BOT_ATTACK_RANGE * aggression + Number(bot.aiAggression || 1) * 170,
          );
          const canFight = Boolean(enemy && !battleLocked && !openingFarm && !needsEmergencyFarm && !shouldFlee && Number(bot.drones || 0) >= 1);
          const shouldAttack = Boolean(canFight && enemy && enemy.distance < pursuitRange);
          const shouldHunt = Boolean(canFight && enemy && enemy.distance < ZONE_PVP_BOT_GLOBAL_HUNT_RANGE);

          if (enemy && (shouldAttack || shouldHunt || shouldFlee || beingThreatened)) {
            const angle = Math.atan2(enemy.y - bot.y, enemy.x - bot.x);
            const preferredRange = Number(bot.preferredRange || ZONE_PVP_BOT_SAFE_DISTANCE);
            if (shouldFlee || beingThreatened) {
              desiredX = Math.cos(angle + Math.PI);
              desiredY = Math.sin(angle + Math.PI);
              state = "defend-flee";
            } else if (enemy.distance > preferredRange + 130) {
              desiredX = Math.cos(angle);
              desiredY = Math.sin(angle);
              state = shouldAttack ? "attack-approach" : "hunt-target";
            } else if (enemy.distance < preferredRange - 155) {
              desiredX = Math.cos(angle + Math.PI);
              desiredY = Math.sin(angle + Math.PI);
              state = "attack-space";
            } else {
              const strafe = Number(bot.aiStrafeDir || 1);
              desiredX = Math.cos(angle + (Math.PI / 2) * strafe) * 0.92 + Math.cos(angle) * 0.18;
              desiredY = Math.sin(angle + (Math.PI / 2) * strafe) * 0.92 + Math.sin(angle) * 0.18;
              state = "attack-strafe";
            }
            const normalized = this.normalizeZoneBotVector(desiredX + avoidance.x * 0.65, desiredY + avoidance.y * 0.65);
            desiredX = normalized.x;
            desiredY = normalized.y;
            aimX = enemy.x;
            aimY = enemy.y;
            targetEnemyId = enemy.id;
            attacking = shouldAttack;
            useShield = Boolean(
              !battleLocked &&
                !bot.shieldActive &&
                Number(bot.drones || 0) > 1 &&
                Number(bot.energy || 0) >= 20 &&
                ((enemy.distance < 540 && enemyPower > botPower * 1.12) || nearbyEnemyCount >= 3 || Number(bot.hp || 0) <= 34),
            );
          } else {
            const energyTarget =
              !openingFarm && Number(bot.energy || 0) <= 65
                ? this.findZoneBotItem(bot, room.energyCells || [], zoneRadius, "energy")
                : null;
            const coreTarget =
              !openingFarm && !energyTarget
                ? this.findZoneBotItem(bot, room.cores || [], zoneRadius, "core")
                : null;
            const orbTarget = !energyTarget && !coreTarget
              ? this.findZoneBotItem(bot, room.orbs || [], zoneRadius, "orb")
              : null;
            const target = energyTarget || coreTarget || orbTarget;

            if (target) {
              const normalized = this.normalizeZoneBotVector(
                Number(target.x || 0) - Number(bot.x || 0) + avoidance.x * 0.6,
                Number(target.y || 0) - Number(bot.y || 0) + avoidance.y * 0.6,
              );
              desiredX = normalized.x;
              desiredY = normalized.y;
              aimX = Number(target.x || bot.x);
              aimY = Number(target.y || bot.y);
              targetEnergyCellId = energyTarget?.id || null;
              targetOrbId = orbTarget?.id || null;
              state = energyTarget
                ? "energy"
                : coreTarget
                  ? "collect-core"
                  : openingFarm
                    ? "opening-orb-farm"
                    : Number(bot.drones || 0) < Number(bot.desiredDroneStock || 1)
                      ? "stockpile-drones"
                      : "farm-extra";
            } else {
              const angle = Number(bot.aiWanderAngle || 0) + (Math.random() - 0.5) * 0.7;
              const normalized = this.normalizeZoneBotVector(
                Math.cos(angle) * 0.65 + avoidance.x,
                Math.sin(angle) * 0.65 + avoidance.y,
              );
              desiredX = normalized.x;
              desiredY = normalized.y;
              aimX = bot.x + desiredX * 240;
              aimY = bot.y + desiredY * 240;
              bot.aiWanderAngle = angle;
              state = "search-safe-orbs";
            }
          }
        }

        // Smooth the planned direction. The backend remains authoritative, but
        // the bot never snaps direction every time its tactical target changes.
        const smoothed = this.normalizeZoneBotVector(
          Number(bot.aiMoveX || 0) * 0.52 + desiredX * 0.48,
          Number(bot.aiMoveY || 0) * 0.52 + desiredY * 0.48,
        );
        bot.aiMoveX = smoothed.x;
        bot.aiMoveY = smoothed.y;
        bot.aiAimX = aimX;
        bot.aiAimY = aimY;
        bot.aiAttacking = attacking;
        bot.aiUseShield = useShield;
        bot.aiTargetEnemyId = targetEnemyId;
        bot.aiTargetOrbId = targetOrbId;
        bot.aiTargetEnergyCellId = targetEnergyCellId;
        bot.aiState = state;
        bot.aiPlanUntil = now + ZONE_PVP_BOT_AI_REPLAN_MIN_MS + Math.floor(Math.random() * (ZONE_PVP_BOT_AI_REPLAN_MAX_MS - ZONE_PVP_BOT_AI_REPLAN_MIN_MS));
      }

      const useShieldNow = Boolean(bot.aiUseShield);
      bot.aiUseShield = false;
      bot.input = {
        seq: Number(bot.lastReceivedInputSeq || 0) + 1,
        mobileMove: true,
        moveX: Number(bot.aiMoveX || 0),
        moveY: Number(bot.aiMoveY || 0),
        attacking: !battleLocked && Boolean(bot.aiAttacking),
        shield: !battleLocked && useShieldNow,
        mouseX: Number(bot.aiAimX || bot.x + 1),
        mouseY: Number(bot.aiAimY || bot.y),
      };
      bot.lastReceivedInputSeq = Number(bot.input.seq || 0);
      bot.lastInputReceivedAt = now;
      bot.lastSeenAt = now;
    }
  }

  private getNormalOrbTarget(room: any) {
    if (!room?.normalMode) return MAX_ORBS;
    const aliveCount = this.getAlivePlayers(room).length;
    return this.clamp(
      NORMAL_ORB_BASE_TARGET + aliveCount * NORMAL_ORB_PER_ALIVE_PLAYER,
      NORMAL_ORB_BASE_TARGET,
      NORMAL_ORB_MAX_TARGET,
    );
  }

  private getNormalEnergyTarget(room: any) {
    if (!room?.normalMode) return MAX_ENERGY_CELLS;
    const aliveCount = this.getAlivePlayers(room).length;
    return this.clamp(
      NORMAL_ENERGY_BASE_TARGET + aliveCount * NORMAL_ENERGY_PER_ALIVE_PLAYER,
      NORMAL_ENERGY_BASE_TARGET,
      NORMAL_ENERGY_MAX_TARGET,
    );
  }

  private getNormalRandomPoint(margin = 120) {
    return {
      x: this.clamp(
        margin + Math.random() * Math.max(1, NORMAL_WORLD_WIDTH - margin * 2),
        PLAYER_RADIUS,
        NORMAL_WORLD_WIDTH - PLAYER_RADIUS,
      ),
      y: this.clamp(
        margin + Math.random() * Math.max(1, NORMAL_WORLD_HEIGHT - margin * 2),
        PLAYER_RADIUS,
        NORMAL_WORLD_HEIGHT - PLAYER_RADIUS,
      ),
    };
  }
  private isPointFarFromPlayers(
    room: any,
    x: number,
    y: number,
    minDistance = 780,
  ) {
    const minDistanceSq = minDistance * minDistance;
    for (const player of room?.players?.values?.() || []) {
      if (!player?.alive) continue;
      const dx = Number(player.x || 0) - x;
      const dy = Number(player.y || 0) - y;
      if (dx * dx + dy * dy < minDistanceSq) return false;
    }
    return true;
  }

  // Normal PvP loot must be a real world population, not a player-local
  // stream. Every new orb gets a fresh random position across the 14k map,
  // while avoiding living players and nearby existing orbs.
  private createNormalDistributedOrb(room: any) {
    const minOrbDistanceSq = 230 * 230;

    for (let attempt = 0; attempt < 96; attempt += 1) {
      const point = this.getNormalRandomPoint(260);
      if (!this.isPointFarFromPlayers(room, point.x, point.y, 760)) continue;

      let tooCloseToOrb = false;
      for (const existing of room?.orbs || []) {
        const dx = Number(existing?.x || 0) - point.x;
        const dy = Number(existing?.y || 0) - point.y;
        if (dx * dx + dy * dy < minOrbDistanceSq) {
          tooCloseToOrb = true;
          break;
        }
      }

      if (!tooCloseToOrb) {
        return {
          id: crypto.randomUUID(),
          x: point.x,
          y: point.y,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
      }
    }

    // The fallback is still map-random. It is used only when a very crowded
    // room leaves no ideal candidate after the bounded search above.
    const point = this.getNormalRandomPoint(180);
    return {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }


  private getNormalOrbGrid(room: any, target = this.getNormalOrbTarget(room)) {
    const safeTarget = Math.max(1, Math.min(NORMAL_ORB_MAX_TARGET, Math.round(target)));
    const columns = Math.max(1, Math.ceil(Math.sqrt(safeTarget)));
    const rows = Math.max(1, Math.ceil(safeTarget / columns));

    return { target: safeTarget, columns, rows };
  }

  private normalOrbJitter(slot: number, salt: number) {
    // Deterministic pseudo-random value in [0, 1). Stable across packets,
    // but each grid cell gets a different natural-looking offset.
    const raw = Math.sin((slot + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return raw - Math.floor(raw);
  }

  private createNormalOrbAtGridSlot(room: any, _slot: number, _generation = 0) {
    return this.createNormalDistributedOrb(room);
  }

  private rebuildNormalOrbDistribution(room: any, target = this.getNormalOrbTarget(room)) {
    const safeTarget = Math.max(1, Math.min(NORMAL_ORB_MAX_TARGET, Math.round(target)));
    room.normalOrbGrid = { target: safeTarget, columns: 0, rows: 0 };
    room.normalOrbDistributionVersion = NORMAL_ORB_DISTRIBUTION_VERSION;
    room.normalOrbRespawnAt = new Map<number, number>();
    room.normalOrbRespawnCollectorId = new Map<number, string>();
    room.normalOrbRespawnGeneration = new Map<number, number>();
    room.orbs = [];

    for (let index = 0; index < safeTarget; index += 1) {
      room.orbs.push(this.createNormalDistributedOrb(room));
    }

    room.itemSpatialDirty = true;
  }

  private ensureNormalOrbRespawnMaps(room: any) {
    if (!(room?.normalOrbRespawnAt instanceof Map)) {
      room.normalOrbRespawnAt = new Map<number, number>();
    }
    if (!(room?.normalOrbRespawnCollectorId instanceof Map)) {
      room.normalOrbRespawnCollectorId = new Map<number, string>();
    }
    if (!(room?.normalOrbRespawnGeneration instanceof Map)) {
      room.normalOrbRespawnGeneration = new Map<number, number>();
    }
  }

  private scheduleNormalOrbRespawn(room: any, orb: any, collector: any, now = Date.now()) {
    if (!room?.normalMode || !Number.isInteger(orb?.normalOrbSlot)) return;

    this.ensureNormalOrbRespawnMaps(room);
    const slot = Number(orb.normalOrbSlot);
    const delayRange = NORMAL_ORB_RESPAWN_DELAY_MAX_MS - NORMAL_ORB_RESPAWN_DELAY_MIN_MS;
    const deterministicDelay = Math.floor(
      this.normalOrbJitter(slot + Number(orb.normalOrbGeneration || 0), now % 97) *
        Math.max(1, delayRange),
    );

    room.normalOrbRespawnAt.set(
      slot,
      now + NORMAL_ORB_RESPAWN_DELAY_MIN_MS + deterministicDelay,
    );
    room.normalOrbRespawnCollectorId.set(slot, String(collector?.id || ""));
  }

  private ensureNormalOrbDistribution(room: any, _now = Date.now()) {
    if (!room?.normalMode) return;

    const target = this.getNormalOrbTarget(room);
    const requiresReset =
      room.normalOrbDistributionVersion !== NORMAL_ORB_DISTRIBUTION_VERSION ||
      !Array.isArray(room.orbs) ||
      room.orbs.length > target;

    if (requiresReset) {
      this.rebuildNormalOrbDistribution(room, target);
      return;
    }

    // Every missing orb is replaced by one fresh random spawn somewhere else
    // on the map. No delayed grid slot, no local respawn and no client-only
    // item is used here.
    while (room.orbs.length < target) {
      room.orbs.push(this.createNormalDistributedOrb(room));
      room.itemSpatialDirty = true;
    }
  }

  private createNormalOrb(room?: any) {
    if (room?.normalMode) {
      return this.createNormalDistributedOrb(room);
    }

    const point = this.getNormalRandomPoint(120);
    return {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }

  private createNormalEnergyCell() {
    const point = this.getNormalRandomPoint(160);
    return { id: crypto.randomUUID(), x: point.x, y: point.y };
  }

  private createNormalEnergyCellNear(nearX: number, nearY: number) {
    // Normal PvP uses a 14k map (not the default 15k map), therefore this
    // deliberately does not call createEnergyCell/randomSafePoint. It keeps
    // every generated cell inside the real Normal PvP world.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance =
        NORMAL_LOCAL_ENERGY_MIN_DISTANCE +
        Math.random() *
          (NORMAL_LOCAL_ENERGY_MAX_DISTANCE - NORMAL_LOCAL_ENERGY_MIN_DISTANCE);
      const x = nearX + Math.cos(angle) * distance;
      const y = nearY + Math.sin(angle) * distance;

      if (
        x >= PLAYER_RADIUS &&
        x <= NORMAL_WORLD_WIDTH - PLAYER_RADIUS &&
        y >= PLAYER_RADIUS &&
        y <= NORMAL_WORLD_HEIGHT - PLAYER_RADIUS
      ) {
        return { id: crypto.randomUUID(), x, y };
      }
    }

    return this.createNormalEnergyCell();
  }

  private ensureNormalEnergyCellsNearPlayer(room: any, player: any) {
    if (!room?.normalMode || !player?.alive) return 0;

    const nearbyEnergy = room.energyCells.filter((cell) =>
      this.isNear(player, cell, NORMAL_LOCAL_ENERGY_RADIUS),
    ).length;
    const missing = Math.max(0, NORMAL_LOCAL_ENERGY_TARGET - nearbyEnergy);
    const toAdd = Math.min(missing, NORMAL_LOCAL_ENERGY_ADD_LIMIT);

    for (let index = 0; index < toAdd; index += 1) {
      room.energyCells.push(this.createNormalEnergyCellNear(player.x, player.y));
    }

    if (toAdd > 0) room.itemSpatialDirty = true;
    return toAdd;
  }

  private createNormalCore() {
    const point = this.getNormalRandomPoint(420);
    return {
      id: crypto.randomUUID(),
      type: CORE_TYPES[Math.floor(Math.random() * CORE_TYPES.length)],
      x: point.x,
      y: point.y,
    };
  }

  // Compact, short-lived world-space events. These are rendered in Pixi, not
  // React, so rapid hits do not cause UI re-render spikes.
  private pushCombatEvent(
    room: any,
    unit: any,
    text: string,
    kind: string,
    now = Date.now(),
  ) {
    if (!this.usesProgressionPvpCombat(room) || !unit || !text) return;
    if (!Array.isArray(room.combatEvents)) room.combatEvents = [];

    const sequence = Number(room.combatEventSequence || 0) + 1;
    room.combatEventSequence = sequence;
    const event = {
      id: `combat-${sequence}-${crypto.randomUUID()}`,
      x: Math.round(Number(unit.x || 0)),
      y: Math.round(Number(unit.y || 0)),
      text: String(text).slice(0, 42),
      kind,
      // Combat text belongs only to the affected/rewarded player. State
      // serialization below sends it exclusively to this socket, so unrelated
      // nearby fights do not clutter anyone else's screen.
      viewerId: String(unit.id),
      side: sequence % 2 === 0 ? 1 : -1,
      lane: sequence % 3,
      createdAt: now,
      ttl: 2000,
    };

    room.combatEvents.push(event);

    // IMPORTANT: PvP snapshots are intentionally high-frequency/volatile.
    // Sending combat text only inside snapshots means a dropped snapshot can
    // permanently lose the animation. Battle Royale creates these events
    // locally, so it never has that problem. Normal/Zone need this reliable,
    // one-socket event as the multiplayer equivalent.
    const privateEventName = room?.normalMode
      ? "normal-pvp:combat"
      : room?.zonePvpMode
        ? "zone-pvp:combat"
        : null;
    if (privateEventName) {
      // Every Socket.IO socket automatically owns a room with its own socket id.
      // Using server.to(socketId) is more robust than looking into the adapter's
      // internal socket map, and guarantees the private animation reaches only
      // the player who was hit or rewarded.
      this.server?.to(String(unit.id)).emit(privateEventName, event);
    }

    if (room.combatEvents.length > 96) {
      room.combatEvents.splice(0, room.combatEvents.length - 96);
    }
  }

  private cleanupCombatEvents(room: any, now = Date.now()) {
    if (!this.usesProgressionPvpCombat(room) || !Array.isArray(room.combatEvents)) return;
    room.combatEvents = room.combatEvents.filter(
      (event) =>
        now - Number(event?.createdAt || 0) <
        Number(event?.ttl || 2000),
    );
  }
  afterInit() {
    this.startLoop();
  }
  handleDisconnect(client: Socket) {
    this.removePlayer(client.id);
    this.removeNormalPlayer(client.id);
    this.removeBattleRoyaleOnlinePlayer(client.id);
    this.removeZonePvpPlayer(client.id);
  }
  @SubscribeMessage("pvp:join")
  handlePvpJoin(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    this.removePlayer(client.id);
    const room = this.findOrCreateRoom();
    const zoneRadius = this.getSafeZoneRadius(room);
    const spawn = this.getSafeSpawn(room, zoneRadius);
    const player = {
      id: client.id,
      userId: data?.isGuest ? null : data?.userId,
      isGuest: Boolean(data?.isGuest),
      username: String(
        data?.username || (data?.isGuest ? "Guest" : "Player"),
      ).slice(0, 18),
      skin: normalizeSkin(data?.isGuest ? "cyan" : data?.skin),
      x: spawn.x,
      y: spawn.y,
      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      drones: 0,
      progress: 0,
      nextDroneAt: DRONE_REQUIREMENTS[0],
      totalCollected: 0,
      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      alive: true,
      input: {},
      lastSeenAt: Date.now(),
      lastEnergyDrainAt: Date.now(),
      lastZoneDamageAt: Date.now(),
      lastFireAt: 0,
      lastShieldAt: 0,
      shieldActive: false,
      shieldUntil: 0,
      knockbackX: 0,
      knockbackY: 0,
    };
    room.players.set(client.id, player);
    this.markRoomOccupied(room);
    this.socketRoom.set(client.id, room.id);
    client.join(room.id);
    if (room.players.size >= ROOM_MIN_PLAYERS && room.status === "waiting") {
      room.status = "countdown";
      room.countdownStartedAt = Date.now();
    }
    client.emit("pvp:joined", {
      status: room.status,
      playerId: client.id,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      safeZoneRadius: zoneRadius,
      playerCount: this.getAlivePlayers(room).length,
      minPlayers: ROOM_MIN_PLAYERS,
      you: this.serializePlayer(player),
      players: [],
      orbs: [],
      minimapOrbs: [],
      minimapEnergyCells: [],
      energyCells: [],
      cores: [],
      projectiles: [],
      leaderboard: [],
    });
  }
  @SubscribeMessage("pvp:leave")
  handlePvpLeave(@ConnectedSocket() client: Socket) {
    this.removePlayer(client.id);
  }
  @SubscribeMessage("pvp:input")
  handlePvpInput(@ConnectedSocket() client: Socket, @MessageBody() input: any) {
    const room = this.getRoomBySocket(client.id);
    const player = room?.players.get(client.id);
    if (!player || !player.alive) return;
    player.input = {
      w: Boolean(input?.w),
      a: Boolean(input?.a),
      s: Boolean(input?.s),
      d: Boolean(input?.d),
      attacking: Boolean(input?.attacking),
      shield: Boolean(input?.shield),
      mouseX: Number(input?.mouseX || player.x),
      mouseY: Number(input?.mouseY || player.y),
    };
    player.lastSeenAt = Date.now();
  }
  private emitNormalPvpJoined(client: Socket, room: any, player: any) {
    const orbLimit = NORMAL_VISIBLE_ORB_LIMIT;
    const energyLimit = NORMAL_VISIBLE_ENERGY_LIMIT;
    const viewRadius = VIEW_DISTANCE;

    // Make the first reliable join packet contain visible energy immediately.
    // Without this, a sparse random 14k world could leave a new player with no
    // cell in view until a later item replication tick.
    if (this.ensureNormalEnergyCellsNearPlayer(room, player) > 0) {
      this.refreshRoomSpatialIndexes(room);
    }

    // "joined" is reliable, unlike the high-frequency volatile state snapshots.
    // This guarantees that a guest receives its own drone and initial nearby
    // world immediately, even when the first realtime snapshot is dropped.
    const nearbyOrbs = room.orbSpatialIndex
      ? this.filterNearIndexed(player, room.orbSpatialIndex, viewRadius, orbLimit)
      : this.filterNear(player, room.orbs, viewRadius, orbLimit);
    const nearbyEnergyCells = room.energySpatialIndex
      ? this.filterNearIndexed(player, room.energySpatialIndex, viewRadius, energyLimit)
      : this.filterNear(player, room.energyCells, viewRadius, energyLimit);
    const nearbyCores = room.coreSpatialIndex
      ? this.filterNearIndexed(player, room.coreSpatialIndex, viewRadius + 600, 18)
      : this.filterNear(player, room.cores, viewRadius + 600, 18);

    client.emit("normal-pvp:joined", {
      status: "playing",
      serverTime: Date.now(),
      playerId: client.id,
      worldWidth: NORMAL_WORLD_WIDTH,
      worldHeight: NORMAL_WORLD_HEIGHT,
      safeZoneRadius: NORMAL_ROOM_ZONE_RADIUS,
      playerCount: this.getAlivePlayers(room).length,
      minPlayers: NORMAL_ROOM_MIN_PLAYERS,
      maxPlayers: NORMAL_ROOM_MAX_PLAYERS,
      you: this.serializePlayer(player),
      players: [],
      orbs: nearbyOrbs,
      minimapOrbs: room.orbs.slice(0, 180),
      minimapEnergyCells: room.energyCells.slice(0, 90),
      energyCells: nearbyEnergyCells,
      cores: nearbyCores,
      minimapCores: room.cores.slice(0, 12),
      projectiles: [],
      combatEvents: [],
      leaderboard: [],
      coreDropCountdown: Math.ceil(CORE_WARNING_DELAY / 1000),
    });
  }

  @SubscribeMessage("normal-pvp:join")
  handleNormalPvpJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // A fast reconnect or a duplicate join retry must not create a second
    // character for the same socket. Re-send the reliable initial snapshot
    // instead. This is especially important for guest users on first load.
    this.removePlayer(client.id);
    this.removeBattleRoyaleOnlinePlayer(client.id);
    this.removeZonePvpPlayer(client.id);

    const existingRoom = this.getNormalRoomBySocket(client.id);
    const existingPlayer = existingRoom?.players.get(client.id);
    if (existingRoom && existingPlayer) {
      existingPlayer.userId = data?.isGuest ? null : data?.userId;
      existingPlayer.isGuest = Boolean(data?.isGuest);
      existingPlayer.username = String(
        data?.username || (data?.isGuest ? "Guest" : "Player"),
      ).slice(0, 18);
      existingPlayer.skin = normalizeSkin(data?.isGuest ? "cyan" : data?.skin);
      existingPlayer.lastSeenAt = Date.now();
      existingPlayer.lastInputReceivedAt = Date.now();

      this.markRoomOccupied(existingRoom);
      client.join(existingRoom.id);
      this.emitNormalPvpJoined(client, existingRoom, existingPlayer);
      return;
    }

    this.removeNormalPlayer(client.id);

    const room = this.findOrCreateNormalRoom();
    const spawn = this.getNormalSpawn(room);

    const player = {
      id: client.id,
      userId: data?.isGuest ? null : data?.userId,
      isGuest: Boolean(data?.isGuest),
      username: String(
        data?.username || (data?.isGuest ? "Guest" : "Player"),
      ).slice(0, 18),
      skin: normalizeSkin(data?.isGuest ? "cyan" : data?.skin),
      x: spawn.x,
      y: spawn.y,
      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      drones: 0,
      progress: 0,
      nextDroneAt: DRONE_REQUIREMENTS[0],
      totalCollected: 0,
      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      moveSpeedMultiplier: 1,
      attackDroneSpeedMultiplier: 1,
      alive: true,
      input: {},
      lastSeenAt: Date.now(),
      lastEnergyDrainAt: Date.now(),
      lastZoneDamageAt: Date.now(),
      lastFireAt: 0,
      lastShieldAt: 0,
      shieldActive: false,
      shieldUntil: 0,
      knockbackX: 0,
      knockbackY: 0,
      gridKey: null,
      lastProcessedInputSeq: 0,
      lastReceivedInputSeq: 0,
      pendingInputSeq: 0,
      lastInputReceivedAt: Date.now(),
      lastDamageEventAt: 0,
      killedById: null,
      spectatorTargetId: null,
      lastDamageById: null,
      lastDamageAt: 0,
      eliminatedAt: 0,
      eliminationReason: null,
    };

    room.players.set(client.id, player);
    this.markRoomOccupied(room);
    this.normalSocketRoom.set(client.id, room.id);
    client.join(room.id);

    this.emitNormalPvpJoined(client, room, player);
  }

  @SubscribeMessage("normal-pvp:leave")
  handleNormalPvpLeave(@ConnectedSocket() client: Socket) {
    this.removeNormalPlayer(client.id);
  }

  @SubscribeMessage("normal-pvp:input")
  handleNormalPvpInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: any,
  ) {
    const room = this.getNormalRoomBySocket(client.id);
    const player = room?.players.get(client.id);
    if (!player || !player.alive) return;

    // Drop duplicate / delayed packets. The server keeps applying the most
    // recent input every simulation tick, so old packets add load but no value.
    const seq = Number(input?.seq || 0);
    const safeSeq = Number.isFinite(seq) ? seq : 0;
    if (safeSeq > 0 && safeSeq <= (player.lastReceivedInputSeq || 0)) return;

    const now = Date.now();
    const mouseX = this.sanitizeCoordinate(
      input?.mouseX,
      player.x,
      PLAYER_RADIUS,
      NORMAL_WORLD_WIDTH - PLAYER_RADIUS,
    );
    const mouseY = this.sanitizeCoordinate(
      input?.mouseY,
      player.y,
      PLAYER_RADIUS,
      NORMAL_WORLD_HEIGHT - PLAYER_RADIUS,
    );

    player.input = {
      seq: safeSeq,
      dt: Math.max(1, Math.min(50, Number(input?.dt || 16))),
      clientSentAt: Number(input?.clientSentAt || 0),
      serverReceivedAt: now,
      w: Boolean(input?.w),
      a: Boolean(input?.a),
      s: Boolean(input?.s),
      d: Boolean(input?.d),
      moveX: this.clamp(Number(input?.moveX || 0), -1, 1),
      moveY: this.clamp(Number(input?.moveY || 0), -1, 1),
      mobileMove: Boolean(input?.mobileMove),
      attacking: Boolean(input?.attacking),
      shield: Boolean(input?.shield),
      mouseX,
      mouseY,
    };
    player.lastReceivedInputSeq = safeSeq;
    player.pendingInputSeq = safeSeq;
    player.lastInputReceivedAt = now;
    player.lastSeenAt = now;
  }

  @SubscribeMessage("battle-royale-online:join")
  handleBattleRoyaleOnlineJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    this.removePlayer(client.id);
    this.removeNormalPlayer(client.id);
    this.removeBattleRoyaleOnlinePlayer(client.id);

    const room = this.findOrCreateBattleRoyaleOnlineRoom();
    const zoneRadius = this.getBattleRoyaleOnlineZoneRadius(room);
    const spawn = this.getSafeSpawn(room, zoneRadius);

    const player = {
      id: client.id,
      userId: data?.isGuest ? null : data?.userId,
      isGuest: Boolean(data?.isGuest),
      username: String(
        data?.username || (data?.isGuest ? "Guest" : "Player"),
      ).slice(0, 18),
      skin: normalizeSkin(data?.isGuest ? "cyan" : data?.skin),
      x: spawn.x,
      y: spawn.y,
      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      drones: 0,
      progress: 0,
      nextDroneAt: DRONE_REQUIREMENTS[0],
      totalCollected: 0,
      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      alive: true,
      input: {},
      lastSeenAt: Date.now(),
      lastEnergyDrainAt: Date.now(),
      lastZoneDamageAt: Date.now(),
      lastFireAt: 0,
      lastShieldAt: 0,
      shieldActive: false,
      shieldUntil: 0,
      knockbackX: 0,
      knockbackY: 0,
      gridKey: null,
      lastProcessedInputSeq: 0,
      lastReceivedInputSeq: 0,
      pendingInputSeq: 0,
      lastInputReceivedAt: Date.now(),
      lastDamageEventAt: 0,
      killedById: null,
      spectatorTargetId: null,
      lastDamageById: null,
      lastDamageAt: 0,
      eliminatedAt: 0,
      eliminationReason: null,
    };

    room.players.set(client.id, player);
    this.markRoomOccupied(room);
    this.battleRoyaleOnlineSocketRoom.set(client.id, room.id);
    client.join(room.id);

    if (
      room.players.size >= BR_ONLINE_ROOM_MIN_PLAYERS &&
      room.status === "waiting"
    ) {
      room.status = "countdown";
      room.countdownStartedAt = Date.now();
    }

    client.emit("battle-royale-online:joined", {
      status: room.status,
      playerId: client.id,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      safeZoneRadius: zoneRadius,
      playerCount: this.getAlivePlayers(room).length,
      minPlayers: BR_ONLINE_ROOM_MIN_PLAYERS,
      maxPlayers: BR_ONLINE_ROOM_MAX_PLAYERS,
      you: this.serializePlayer(player),
      players: [],
      orbs: [],
      minimapOrbs: [],
      minimapEnergyCells: [],
      energyCells: [],
      cores: [],
      projectiles: [],
      leaderboard: [],
    });
  }

  @SubscribeMessage("battle-royale-online:leave")
  handleBattleRoyaleOnlineLeave(@ConnectedSocket() client: Socket) {
    this.removeBattleRoyaleOnlinePlayer(client.id);
  }

  @SubscribeMessage("battle-royale-online:input")
  handleBattleRoyaleOnlineInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: any,
  ) {
    const room = this.getBattleRoyaleOnlineRoomBySocket(client.id);
    const player = room?.players.get(client.id);
    if (!player || !player.alive) return;

    player.input = {
      w: Boolean(input?.w),
      a: Boolean(input?.a),
      s: Boolean(input?.s),
      d: Boolean(input?.d),
      attacking: Boolean(input?.attacking),
      shield: Boolean(input?.shield),
      mouseX: Number(input?.mouseX || player.x),
      mouseY: Number(input?.mouseY || player.y),
    };
    player.lastSeenAt = Date.now();
  }

  @SubscribeMessage("zone-pvp:join")
  handleZonePvpJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // A duplicate join event on the same socket must be idempotent. Removing
    // that player from a live room would otherwise create a fresh lobby and
    // make the client see MATCH STARTS IN again.
    const existingZoneRoom = this.getZonePvpRoomBySocket(client.id);
    const existingZonePlayer = existingZoneRoom?.players.get(client.id);
    if (existingZoneRoom && existingZonePlayer) {
      existingZonePlayer.userId = data?.isGuest ? null : data?.userId;
      existingZonePlayer.isGuest = Boolean(data?.isGuest);
      existingZonePlayer.username = String(
        data?.username || (data?.isGuest ? "Guest" : "Player"),
      ).slice(0, 18);
      existingZonePlayer.skin = normalizeSkin(data?.isGuest ? "cyan" : data?.skin);
      existingZonePlayer.lastSeenAt = Date.now();
      existingZonePlayer.lastInputReceivedAt = Date.now();
      this.markRoomOccupied(existingZoneRoom);
      client.join(existingZoneRoom.id);
      // A client may retry its join after a mobile network transition. Confirm
      // the idempotent admission explicitly so it can stop retrying even before
      // the next full room snapshot is painted.
      client.emit("zone-pvp:join-confirmed", {
        roomId: existingZoneRoom.id,
        playerId: client.id,
        serverNow: Date.now(),
        reusedRoom: true,
      });
      this.broadcastZonePvpRoomState(existingZoneRoom, Date.now(), true);
      return;
    }

    this.removePlayer(client.id);
    this.removeNormalPlayer(client.id);
    this.removeBattleRoyaleOnlinePlayer(client.id);
    this.removeZonePvpPlayer(client.id);

    const room = this.findOrCreateZonePvpRoom();
    const zoneRadius = this.getZonePvpZoneRadius(room);
    const spawn = this.getSafeSpawn(room, zoneRadius);

    // The first human is remembered for diagnostics only. It never determines
    // who can keep the round alive: a dead creator is a normal spectator.
    if (!room.initialHumanPlayerId) {
      room.initialHumanPlayerId = client.id;
    }

    const player = {
      id: client.id,
      userId: data?.isGuest ? null : data?.userId,
      isGuest: Boolean(data?.isGuest),
      username: String(
        data?.username || (data?.isGuest ? "Guest" : "Player"),
      ).slice(0, 18),
      skin: normalizeSkin(data?.isGuest ? "cyan" : data?.skin),
      x: spawn.x,
      y: spawn.y,
      hp: START_HP,
      maxHp: START_HP,
      energy: START_ENERGY,
      drones: 0,
      progress: 0,
      nextDroneAt: DRONE_REQUIREMENTS[0],
      totalCollected: 0,
      kills: 0,
      killStreak: 0,
      rapidFireUntil: 0,
      attackCooldownMultiplier: 1,
      // Zone PvP now shares Normal PvP progression rewards.
      moveSpeedMultiplier: 1,
      attackDroneSpeedMultiplier: 1,
      alive: true,
      input: {},
      lastSeenAt: Date.now(),
      lastEnergyDrainAt: Date.now(),
      lastZoneDamageAt: Date.now(),
      lastFireAt: 0,
      lastShieldAt: 0,
      shieldActive: false,
      shieldUntil: 0,
      knockbackX: 0,
      knockbackY: 0,
      gridKey: null,
      lastProcessedInputSeq: 0,
      lastReceivedInputSeq: 0,
      pendingInputSeq: 0,
      lastInputReceivedAt: Date.now(),
      lastDamageEventAt: 0,
      killedById: null,
      spectatorTargetId: null,
      lastDamageById: null,
      lastDamageAt: 0,
      eliminatedAt: 0,
      eliminationReason: null,
    };

    room.players.set(client.id, player);
    this.markRoomOccupied(room);
    this.zonePvpSocketRoom.set(client.id, room.id);
    client.join(room.id);

    if (
      this.getZoneHumanPlayerCount(room) >= ZONE_PVP_ROOM_MIN_PLAYERS &&
      room.status === "waiting"
    ) {
      room.status = "countdown";
      room.countdownStartedAt = Date.now();
      room.locked = false;
      room.roundId = `zone-round-${crypto.randomUUID()}`;
      room.phaseVersion = Number(room.phaseVersion || 0) + 1;
    }

    const zonePvpCountdown =
      room.status === "countdown" && room.countdownStartedAt
        ? Math.max(
            1,
            Math.ceil(
              (ZONE_PVP_START_COUNTDOWN_MS -
                (Date.now() - room.countdownStartedAt)) /
                1000,
            ),
          )
        : null;

    client.emit("zone-pvp:joined", {
      roomId: room.id,
      roundId: room.roundId || null,
      phaseVersion: Number(room.phaseVersion || 0),
      status: room.status,
      countdown: zonePvpCountdown,
      playerId: client.id,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      safeZoneRadius: zoneRadius,
      zoneShrinkDuration: ZONE_PVP_ZONE_SHRINK_DURATION,
      matchStartedAt: room.matchStartedAt,
      battlePrepareUntil: room.battlePrepareUntil || null,
      battlePrepareRemainingMs: room.battlePrepareUntil
        ? Math.max(0, room.battlePrepareUntil - Date.now())
        : 0,
      battleBeginFlashUntil: room.battleBeginFlashUntil || null,
      playerCount: this.getAlivePlayers(room).length,
      realPlayerCount: this.getZoneHumanPlayerCount(room),
      botCount: this.getZoneBotCount(room),
      minPlayers: ZONE_PVP_ROOM_MIN_PLAYERS,
      maxPlayers: ZONE_PVP_ROOM_MAX_PLAYERS,
      you: this.serializePlayer(player),
      players: [],
      orbs: [],
      minimapOrbs: [],
      minimapEnergyCells: [],
      energyCells: [],
      cores: [],
      projectiles: [],
      leaderboard: [],
      coreDropCountdown: Math.ceil(CORE_WARNING_DELAY / 1000),
    });

    // Separate lightweight admission confirmation. The normal joined payload
    // remains the source of truth for world data; this event only makes the
    // client retry loop deterministic on slower mobile handshakes.
    client.emit("zone-pvp:join-confirmed", {
      roomId: room.id,
      playerId: client.id,
      serverNow: Date.now(),
      reusedRoom: false,
    });

    // A new player must update the already-waiting player immediately. The
    // normal simulation broadcast is volatile, which can be skipped while a
    // tab is backgrounded or while the second socket connects.
    this.broadcastZonePvpRoomState(room, Date.now(), true);
  }

  @SubscribeMessage("zone-pvp:leave")
  handleZonePvpLeave(@ConnectedSocket() client: Socket) {
    this.removeZonePvpPlayer(client.id);
  }

  @SubscribeMessage("zone-pvp:input")
  handleZonePvpInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: any,
  ) {
    const room = this.getZonePvpRoomBySocket(client.id);
    const player = room?.players.get(client.id);
    if (!room || !player || !player.alive) return;

    // The client starts sending heartbeat input immediately after joining.
    // In waiting/countdown we do not apply movement, but we MUST retain this
    // heartbeat so two players are never dropped before the match begins.
    const heartbeatNow = Date.now();
    player.lastSeenAt = heartbeatNow;
    player.lastInputReceivedAt = heartbeatNow;
    if (room.status !== "playing") return;

    const seq = Number(input?.seq || 0);
    const safeSeq = Number.isFinite(seq) ? seq : 0;
    if (safeSeq > 0 && safeSeq <= (player.lastReceivedInputSeq || 0)) return;

    const now = Date.now();
    player.input = {
      seq: safeSeq,
      dt: Math.max(1, Math.min(50, Number(input?.dt || 16))),
      clientSentAt: Number(input?.clientSentAt || 0),
      serverReceivedAt: now,
      w: Boolean(input?.w),
      a: Boolean(input?.a),
      s: Boolean(input?.s),
      d: Boolean(input?.d),
      moveX: this.clamp(Number(input?.moveX || 0), -1, 1),
      moveY: this.clamp(Number(input?.moveY || 0), -1, 1),
      mobileMove: Boolean(input?.mobileMove),
      attacking: Boolean(input?.attacking),
      shield: Boolean(input?.shield),
      mouseX: this.sanitizeCoordinate(
        input?.mouseX,
        player.x,
        PLAYER_RADIUS,
        WORLD_WIDTH - PLAYER_RADIUS,
      ),
      mouseY: this.sanitizeCoordinate(
        input?.mouseY,
        player.y,
        PLAYER_RADIUS,
        WORLD_HEIGHT - PLAYER_RADIUS,
      ),
    };
    player.lastReceivedInputSeq = safeSeq;
    player.pendingInputSeq = safeSeq;
    player.lastInputReceivedAt = now;
    player.lastSeenAt = now;
  }

  startLoop() {
    if (this.loop) return;
    this.loop = setInterval(() => {
      const now = Date.now();
      const deltaFrames = Math.min(
        3,
        Math.max(0.35, (now - this.lastLoopAt) / (1000 / 60)),
      );
      this.lastLoopAt = now;

      for (const room of this.rooms.values()) {
        this.updateRoomStatus(room, now);
        if (room.status === "playing") {
          const zoneRadius = this.getSafeZoneRadius(room);
          this.updatePlayers(room, now, zoneRadius, deltaFrames);
          this.applyZoneDamage(room, now, zoneRadius);
          this.handleBodyCollisions(room, now, zoneRadius);
          this.collectOrbs(room, zoneRadius);
          this.collectEnergy(room, zoneRadius);
          this.collectCores(room, zoneRadius);
          this.updateProjectiles(room, deltaFrames, now);
          this.maintainWorldItems(room, zoneRadius, now);
          this.updateWinCondition(room, now);
        }
        if (!room.lastBroadcastAt || now - room.lastBroadcastAt >= 25) {
          room.lastBroadcastAt = now;
          this.broadcastRoomState(room, now);
        }
        this.cleanupRoom(room, now);
      }

      for (const room of this.normalRooms.values()) {
        const zoneRadius = NORMAL_ROOM_ZONE_RADIUS;
        this.updatePlayers(room, now, zoneRadius, deltaFrames);
        this.handleBodyCollisions(room, now, zoneRadius);
        this.collectOrbs(room, zoneRadius);
        this.collectEnergy(room, zoneRadius);
        this.collectCores(room, zoneRadius);
        this.updateProjectiles(room, deltaFrames, now);
        this.maintainWorldItems(room, zoneRadius, now);
        this.cleanupCombatEvents(room, now);

        const broadcastInterval =
          room.players.size <= 1
            ? NORMAL_STATE_INTERVAL_SOLO_MS
            : room.players.size >= PVP_HEAVY_STATE_THRESHOLD
              ? NORMAL_STATE_INTERVAL_HEAVY_MS
              : room.players.size >= PVP_CROWDED_STATE_THRESHOLD
                ? NORMAL_STATE_INTERVAL_CROWDED_MS
                : NORMAL_STATE_INTERVAL_MS;

        if (
          !room.lastBroadcastAt ||
          now - room.lastBroadcastAt >= broadcastInterval
        ) {
          room.lastBroadcastAt = now;
          this.broadcastNormalRoomState(room, now);
        }

        this.cleanupNormalRoom(room, now);
      }

      for (const room of this.battleRoyaleOnlineRooms.values()) {
        this.updateBattleRoyaleOnlineRoomStatus(room, now);

        if (room.status === "playing") {
          const zoneRadius = this.getBattleRoyaleOnlineZoneRadius(room);
          this.updatePlayers(room, now, zoneRadius, deltaFrames);
          this.applyBattleRoyaleOnlineZoneDamage(room, now, zoneRadius);
          this.handleBodyCollisions(room, now, zoneRadius);
          this.collectOrbs(room, zoneRadius);
          this.collectEnergy(room, zoneRadius);
          this.collectCores(room, zoneRadius);
          this.updateProjectiles(room, deltaFrames, now);
          this.maintainWorldItems(room, zoneRadius, now);
          this.updateBattleRoyaleOnlineWinCondition(room, now);
        }

        const broadcastInterval =
          room.players.size >= 24
            ? BATTLE_ROYALE_STATE_INTERVAL_CROWDED_MS
            : BATTLE_ROYALE_STATE_INTERVAL_MS;

        if (
          !room.lastBroadcastAt ||
          now - room.lastBroadcastAt >= broadcastInterval
        ) {
          room.lastBroadcastAt = now;
          this.broadcastBattleRoyaleOnlineRoomState(room, now);
        }

        this.cleanupBattleRoyaleOnlineRoom(room, now);
      }

      for (const room of this.zonePvpRooms.values()) {
        this.updateZonePvpRoomStatus(room, now);

        if (room.status === "playing") {
          const zoneRadius = this.getZonePvpZoneRadius(room);
          this.updateZonePvpBots(room, now, zoneRadius, deltaFrames);
          this.updatePlayers(room, now, zoneRadius, deltaFrames);
          this.applyZonePvpZoneDamage(room, now, zoneRadius);
          this.handleBodyCollisions(room, now, zoneRadius);
          this.collectOrbs(room, zoneRadius);
          this.collectEnergy(room, zoneRadius);
          this.collectCores(room, zoneRadius);
          this.updateProjectiles(room, deltaFrames, now);
          this.maintainWorldItems(room, zoneRadius, now);
          this.cleanupCombatEvents(room, now);
          this.updateZonePvpWinCondition(room, now);
        }

        const broadcastInterval =
          this.getZoneBotCount(room) > 0
            ? ZONE_STATE_INTERVAL_CROWDED_MS
            : room.players.size >= PVP_HEAVY_STATE_THRESHOLD
              ? ZONE_STATE_INTERVAL_HEAVY_MS
              : room.players.size >= PVP_CROWDED_STATE_THRESHOLD
                ? ZONE_STATE_INTERVAL_CROWDED_MS
                : ZONE_STATE_INTERVAL_MS;

        if (
          !room.lastBroadcastAt ||
          now - room.lastBroadcastAt >= broadcastInterval
        ) {
          room.lastBroadcastAt = now;
          this.broadcastZonePvpRoomState(room, now);
        }

        // The transform stream is intentionally enabled only in small matches.
        // In 1v1 / small lobbies it gives a good receiver 50 Hz remote motion;
        // larger rooms keep the existing adaptive snapshot budget.
        if (
          room.status === "playing" &&
          room.players.size <= ZONE_MOVEMENT_STREAM_MAX_PLAYERS
        ) {
          // 60 seats can mean only three real browser clients plus bots.
          // Keep those viewers at 50 Hz; reduce only genuinely human-crowded
          // rooms to 30 Hz.
          const movementInterval =
            this.getZoneHumanPlayerCount(room) >= PVP_HEAVY_STATE_THRESHOLD
              ? ZONE_MOVEMENT_STREAM_CROWDED_INTERVAL_MS
              : ZONE_MOVEMENT_STREAM_INTERVAL_MS;

          if (
            !room.lastMovementBroadcastAt ||
            now - room.lastMovementBroadcastAt >= movementInterval
          ) {
            room.lastMovementBroadcastAt = now;
            this.broadcastZonePvpMovement(room, now);
          }
        }

        this.cleanupZonePvpRoom(room, now);
      }
    }, 1000 / 60);
  }
  updateRoomStatus(room, now) {
    if (room.status === "countdown" && room.countdownStartedAt) {
      if (room.players.size < ROOM_MIN_PLAYERS) {
        room.status = "waiting";
        room.countdownStartedAt = null;
        return;
      }
      if (now - room.countdownStartedAt >= ROOM_START_COUNTDOWN_MS) {
        room.status = "playing";
        room.countdownStartedAt = null;
        room.matchStartedAt = now;
        room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + 5000;
      }
    }
  }

  updateBattleRoyaleOnlineRoomStatus(room, now) {
    if (room.status === "countdown" && room.countdownStartedAt) {
      if (room.players.size < BR_ONLINE_ROOM_MIN_PLAYERS) {
        room.status = "waiting";
        room.countdownStartedAt = null;
        return;
      }
      if (now - room.countdownStartedAt >= BR_ONLINE_START_COUNTDOWN_MS) {
        room.status = "playing";
        room.countdownStartedAt = null;
        room.matchStartedAt = now;
        room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + 5000;
      }
    }
  }
  updateZonePvpRoomStatus(room, now) {
    // Zone PvP is one-way: waiting -> five-second human countdown -> playing -> finished.
    // Bots never make a room eligible; exactly three real clients are required first.
    if (room.status !== "countdown") return;

    const realPlayerCount = this.getZoneHumanPlayerCount(room);
    if (realPlayerCount < ZONE_PVP_ROOM_MIN_PLAYERS) {
      room.status = "waiting";
      room.locked = false;
      room.countdownStartedAt = null;
      room.roundId = null;
      room.phaseVersion = Number(room.phaseVersion || 0) + 1;
      this.broadcastZonePvpRoomState(room, now, true);
      return;
    }

    if (now - room.countdownStartedAt >= ZONE_PVP_START_COUNTDOWN_MS) {
      // A full human room produces zero bots. Otherwise exactly the missing
      // participant seats are filled before PLAYING is broadcast.
      this.fillZonePvpBots(room, now, this.getZonePvpZoneRadius(room));
      room.status = "playing";
      room.locked = true;
      room.countdownStartedAt = null;
      room.matchStartedAt = now;
      room.battlePrepareUntil = now + ZONE_PVP_BATTLE_PREPARE_DURATION;
      room.battleBeginFlashUntil = room.battlePrepareUntil + 1800;
      room.matchHadMultiplePlayers = this.getAlivePlayers(room).length >= 2;
      room.phaseVersion = Number(room.phaseVersion || 0) + 1;
      room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY;
      room.lastStaticStateAt = 0;

      // Reliable boundary packet: clients see all server-created bots before
      // any local input or first projectile is processed.
      this.broadcastZonePvpRoomState(room, now, true);
    }
  }

  isBattlePrepareLocked(room, now = Date.now()) {
    return Boolean(
      room?.zonePvpMode &&
      room?.battlePrepareUntil &&
      now < room.battlePrepareUntil,
    );
  }

  updatePlayers(room, now, zoneRadius, deltaFrames = 1) {
    const battleLocked = this.isBattlePrepareLocked(room, now);
    for (const player of room.players.values()) {
      if (!player.alive) continue;
      let dx = 0;
      let dy = 0;
      const input = player.input || {};
      // Nu continuam sa deplasam drona la infinit daca telefonul a intrat in
      // background sau ultimul pachet de input s-a pierdut. Clientul activ
      // trimite heartbeat mult mai des decat acest timeout.
      const inputFresh = !player.lastInputReceivedAt || now - player.lastInputReceivedAt <= 750;
      if (!inputFresh) {
        player.input = {};
      }
      const activeInput = inputFresh ? input : {};
      if (activeInput.w) dy -= 1;
      if (activeInput.s) dy += 1;
      if (activeInput.a) dx -= 1;
      if (activeInput.d) dx += 1;
      if (activeInput.mobileMove) {
        dx += Number(activeInput.moveX || 0);
        dy += Number(activeInput.moveY || 0);
      }
      const isMovingInput = dx !== 0 || dy !== 0;
      if (
        isMovingInput &&
        now - player.lastEnergyDrainAt >= ENERGY_DRAIN_INTERVAL
      ) {
        player.energy = Math.max(0, player.energy - ENERGY_DRAIN_AMOUNT);
        player.lastEnergyDrainAt = now;
        if (player.energy <= 0) {
          player.hp = 0;
          player.alive = false;
          player.input = {};
          player.killedById = null;
          player.spectatorTargetId = null;
          continue;
        }
      }
      player.shieldActive = Boolean(
        player.shieldUntil && player.shieldUntil > now,
      );
      if (
        !battleLocked &&
        activeInput.shield &&
        (player.drones || 0) > 0 &&
        player.energy >= 20 &&
        !player.shieldActive &&
        now - player.lastShieldAt > 600
      ) {
        player.drones = Math.max(0, player.drones - 1);
        player.progress = 0;
        player.nextDroneAt = this.getNextDroneAt(player.drones);
        player.energy = Math.max(0, player.energy - 20);
        player.shieldActive = true;
        player.shieldUntil = now + 3000;
        player.lastShieldAt = now;
      }
      player.prevX = player.x;
      player.prevY = player.y;

      const length = Math.hypot(dx, dy) || 1;
      // Normal PvP and Zone PvP intentionally use identical base movement
      // pacing and stack the same +15% movement reward after each kill.
      const progressionMoveMultiplier = this.usesProgressionPvpCombat(room)
        ? NORMAL_BASE_MOVE_SPEED_MULTIPLIER *
          Math.max(1, Number(player.moveSpeedMultiplier || 1))
        : 1;
      const botSpeedMultiplier =
        room?.zonePvpMode && player?.isBot ? ZONE_PVP_BOT_SPEED_MULTIPLIER : 1;
      const speed = PLAYER_SPEED * progressionMoveMultiplier * botSpeedMultiplier;
      const rawX = player.x + (dx / length) * speed * deltaFrames;
      const rawY = player.y + (dy / length) * speed * deltaFrames;
      const safe = this.keepInsideSafeZone(
        rawX,
        rawY,
        zoneRadius,
        PLAYER_RADIUS + 18,
        Boolean(room.zonePvpMode),
      );
      const movementWorldWidth = room?.normalMode
        ? NORMAL_WORLD_WIDTH
        : WORLD_WIDTH;
      const movementWorldHeight = room?.normalMode
        ? NORMAL_WORLD_HEIGHT
        : WORLD_HEIGHT;
      player.x = this.clamp(
        safe.x,
        PLAYER_RADIUS,
        movementWorldWidth - PLAYER_RADIUS,
      );
      player.y = this.clamp(
        safe.y,
        PLAYER_RADIUS,
        movementWorldHeight - PLAYER_RADIUS,
      );
      this.applyKnockbackStep(player, zoneRadius, room);
      if (dx || dy) {
        player.moveX = dx / length;
        player.moveY = dy / length;
        player.moveAngle = Math.atan2(dy, dx);
        player.isMoving = true;
        // Exact server-authoritative velocity (world pixels / second). Remote
        // clients use it only for a very short visual extrapolation between
        // snapshots, so a low-FPS sender still looks fluid on faster devices.
        player.velocityX = player.moveX * speed * 60;
        player.velocityY = player.moveY * speed * 60;
      } else {
        player.moveX = 0;
        player.moveY = 0;
        player.isMoving = false;
        player.velocityX = 0;
        player.velocityY = 0;
      }
      if (!battleLocked && activeInput.attacking) {
        this.tryFireProjectile(room, player, now);
      }
      if (Number(input.seq || 0) > 0) {
        player.lastProcessedInputSeq = Math.max(
          player.lastProcessedInputSeq || 0,
          Number(input.seq || 0),
        );
      }
    }
  }
  getNextDroneAt(currentDrones = 0) {
    const index = Math.max(
      0,
      Math.min(currentDrones, DRONE_REQUIREMENTS.length - 1),
    );
    return DRONE_REQUIREMENTS[index];
  }
  resetDroneProgress(player) {
    player.progress = 0;
    player.nextDroneAt = this.getNextDroneAt(player.drones || 0);
  }
  applyKillReward(killer, room = null, now = Date.now()) {
    if (!killer) return;

    const previousDrones = Number(killer.drones || 0);
    const previousHp = Number(killer.hp || START_HP);
    const previousMoveSpeed = Number(killer.moveSpeedMultiplier || 1);
    const previousAttackDroneSpeed = Number(
      killer.attackDroneSpeedMultiplier || 1,
    );

    killer.kills = (killer.kills || 0) + 1;
    killer.killStreak = (killer.killStreak || 0) + 1;
    killer.drones = Math.min(MAX_DRONES, previousDrones + 1);
    killer.progress = 0;
    killer.nextDroneAt = this.getNextDroneAt(killer.drones || 0);

    const nextMaxHp = Math.min(
      MAX_HP,
      (killer.maxHp || START_HP) + KILL_HP_REWARD,
    );
    killer.maxHp = nextMaxHp;
    killer.hp = Math.min(nextMaxHp, previousHp + KILL_HP_REWARD);
    killer.killAttackSpeedMultiplier = Math.max(
      MIN_KILL_ATTACK_SPEED_MULTIPLIER,
      (killer.killAttackSpeedMultiplier || 1) * KILL_ATTACK_SPEED_MULTIPLIER,
    );

    if (this.usesProgressionPvpCombat(room)) {
      killer.moveSpeedMultiplier = Math.min(
        NORMAL_MAX_MOVE_SPEED_MULTIPLIER,
        previousMoveSpeed + NORMAL_KILL_MOVE_SPEED_STEP,
      );
      killer.attackDroneSpeedMultiplier = Math.min(
        NORMAL_MAX_ATTACK_DRONE_SPEED_MULTIPLIER,
        previousAttackDroneSpeed + NORMAL_KILL_ATTACK_DRONE_SPEED_STEP,
      );

      const gainedHp = Math.max(0, Number(killer.hp || 0) - previousHp);
      if (gainedHp > 0) {
        this.pushCombatEvent(room, killer, `+${gainedHp} HP`, "heal", now);
      }
      if (killer.drones > previousDrones) {
        this.pushCombatEvent(room, killer, "+1 DRONE", "drone-reward", now);
      }
      if (killer.moveSpeedMultiplier > previousMoveSpeed) {
        this.pushCombatEvent(room, killer, "+15% MOVE SPEED", "move-reward", now);
      }
      if (killer.attackDroneSpeedMultiplier > previousAttackDroneSpeed) {
        this.pushCombatEvent(
          room,
          killer,
          "+5% ATTACK DRONE SPEED",
          "attack-reward",
          now,
        );
      }
    }

    if (killer.killStreak >= 3) {
      killer.rapidFireUntil = now + 10000;
      killer.attackCooldownMultiplier = killer.killStreak >= 5 ? 0.5 : 0.65;
    }
  }
  getRecentKiller(room, victim, now = Date.now()) {
    if (!room || !victim?.lastDamageById) return null;
    if (now - Number(victim.lastDamageAt || 0) > SPECTATOR_KILL_CREDIT_WINDOW_MS) {
      return null;
    }

    const candidate = room.players.get(victim.lastDamageById);
    return candidate && candidate.id !== victim.id && candidate.alive !== false
      ? candidate
      : null;
  }

  getStableSpectatorTarget(room, victim, preferred = null) {
    if (!room || !victim) return null;

    const alive = [...room.players.values()]
      .filter((player) => player.id !== victim.id && player.alive !== false)
      .sort((a, b) => {
        const aDistance = Math.hypot((a.x || 0) - (victim.x || 0), (a.y || 0) - (victim.y || 0));
        const bDistance = Math.hypot((b.x || 0) - (victim.x || 0), (b.y || 0) - (victim.y || 0));
        return aDistance - bDistance || String(a.id).localeCompare(String(b.id));
      });

    const isValid = (candidate) =>
      candidate && candidate.id !== victim.id && candidate.alive !== false;

    if (isValid(preferred)) return preferred;

    const killer = victim.killedById ? room.players.get(victim.killedById) : null;
    if (isValid(killer)) return killer;

    const lockedTarget = victim.spectatorTargetId
      ? room.players.get(victim.spectatorTargetId)
      : null;
    if (isValid(lockedTarget)) return lockedTarget;

    return alive[0] || null;
  }

  eliminatePlayer(room, victim, killer = null, now = Date.now(), reason = "unknown", forceEmit = false) {
    if (!room || !victim) return null;

    const wasAlive = victim.alive !== false || forceEmit;
    const recentKiller = this.getRecentKiller(room, victim, now);
    const validKiller =
      killer && killer.id !== victim.id && killer.alive !== false
        ? killer
        : recentKiller;

    victim.alive = false;
    victim.hp = 0;
    victim.input = {};
    victim.isMoving = false;
    victim.moveX = 0;
    victim.moveY = 0;
    victim.knockbackX = 0;
    victim.knockbackY = 0;
    victim.killStreak = 0;
    victim.rapidFireUntil = 0;
    victim.attackCooldownMultiplier = 1;
    victim.shieldActive = false;
    victim.shieldUntil = 0;
    victim.killedById = validKiller?.id || null;
    victim.eliminatedAt = now;
    victim.eliminationReason = reason;

    const spectatorTarget = this.getStableSpectatorTarget(room, victim, validKiller);
    victim.spectatorTargetId = spectatorTarget?.id || null;

    // Dead players do not emit input any more. Keep their session alive for
    // spectating instead of treating the lack of input as a disconnect.
    victim.lastSeenAt = now;

    if (wasAlive) {
      const socket = this.server.sockets.sockets.get(victim.id);
      if (socket) {
        const prefix = this.getRoomEventPrefix(room);
        socket.emit(`${prefix}:eliminated`, {
          serverTime: now,
          reason,
          you: this.serializePlayer(victim),
          spectatorTargetId: spectatorTarget?.id || null,
          spectatingPlayer: spectatorTarget
            ? this.serializePlayer(spectatorTarget)
            : null,
        });
      }
    }

    return spectatorTarget;
  }

  getCollisionKey(a, b) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }
  getBodyCollisionOutcome(a, b) {
    const aHasDrones = (a.drones || 0) > 0;
    const bHasDrones = (b.drones || 0) > 0;
    if (aHasDrones && bHasDrones) {
      return {
        aHpDamage: BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE,
        bHpDamage: BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE,
        aDroneLoss: 1,
        bDroneLoss: 1,
        push: BODY_COLLISION_MEDIUM_PUSH,
      };
    }
    if (!aHasDrones && !bHasDrones) {
      return {
        aHpDamage: BODY_COLLISION_BOTH_NO_DRONES_DAMAGE,
        bHpDamage: BODY_COLLISION_BOTH_NO_DRONES_DAMAGE,
        aDroneLoss: 0,
        bDroneLoss: 0,
        push: BODY_COLLISION_STRONG_PUSH,
      };
    }
    if (aHasDrones && !bHasDrones) {
      return {
        aHpDamage: BODY_COLLISION_WITH_DRONES_DAMAGE,
        bHpDamage: BODY_COLLISION_WITHOUT_DRONES_DAMAGE,
        aDroneLoss: 1,
        bDroneLoss: 0,
        push: BODY_COLLISION_STRONG_PUSH,
      };
    }
    return {
      aHpDamage: BODY_COLLISION_WITHOUT_DRONES_DAMAGE,
      bHpDamage: BODY_COLLISION_WITH_DRONES_DAMAGE,
      aDroneLoss: 0,
      bDroneLoss: 1,
      push: BODY_COLLISION_STRONG_PUSH,
    };
  }
  applyBodyCollisionDamage(player, hpDamage, droneLoss = 0) {
    const nextDrones = Math.max(0, (player.drones || 0) - droneLoss);
    const nextHp = Math.max(0, (player.hp || 0) - hpDamage);
    player.hp = nextHp;
    player.alive = nextHp > 0;
    player.drones = nextDrones;
    if (droneLoss > 0) {
      this.resetDroneProgress(player);
    }
    if (!player.alive) {
      player.killStreak = 0;
      player.rapidFireUntil = 0;
      player.attackCooldownMultiplier = 1;
      player.input = {};
      player.shieldActive = false;
      player.shieldUntil = 0;
    }
  }
  addSmoothKnockback(player, dirX, dirY, strength) {
    player.knockbackX = (player.knockbackX || 0) + dirX * strength;
    player.knockbackY = (player.knockbackY || 0) + dirY * strength;
    player.moveX = dirX;
    player.moveY = dirY;
    player.moveAngle = Math.atan2(dirY, dirX);
    player.isMoving = true;
  }

  // Normal PvP uses a small reliable one-player event in addition to normal
  // state snapshots. The recipient starts the same decaying impulse locally on
  // the next animation frame, instead of waiting for a 30 Hz snapshot. This is
  // why contact remains responsive even when one player is on a slow laptop.
  private emitNormalPvpCollisionImpulse(player: any, payload: any) {
    if (!player?.id || !payload) return;
    this.server?.to(String(player.id)).emit("normal-pvp:collision", payload);
  }

  // Zone uses the exact same reliable impulse model as Normal PvP. This packet
  // is tiny and sent only on an actual validated collision, so it is safe even
  // for slow laptops and mobile clients.
  private emitZonePvpCollisionImpulse(player: any, payload: any) {
    if (!player?.id || !payload) return;
    this.server?.to(String(player.id)).emit("zone-pvp:collision", payload);
  }

  private applyCollisionSeparation(
    player: any,
    dirX: number,
    dirY: number,
    distance: number,
    zoneRadius: number,
    room: any,
  ) {
    const safe = this.keepInsideSafeZone(
      Number(player.x || 0) + dirX * distance,
      Number(player.y || 0) + dirY * distance,
      zoneRadius,
      PLAYER_RADIUS + 18,
      Boolean(room?.zonePvpMode),
    );
    const width = room?.normalMode ? NORMAL_WORLD_WIDTH : WORLD_WIDTH;
    const height = room?.normalMode ? NORMAL_WORLD_HEIGHT : WORLD_HEIGHT;
    player.x = this.clamp(safe.x, PLAYER_RADIUS, width - PLAYER_RADIUS);
    player.y = this.clamp(safe.y, PLAYER_RADIUS, height - PLAYER_RADIUS);
  }

  applyKnockbackStep(player, zoneRadius, room = null) {
    const kx = player.knockbackX || 0;
    const ky = player.knockbackY || 0;
    const power = Math.hypot(kx, ky);
    if (power < BODY_COLLISION_PUSH_MIN) {
      player.knockbackX = 0;
      player.knockbackY = 0;
      return;
    }
    const safe = this.keepInsideSafeZone(
      player.x + kx,
      player.y + ky,
      zoneRadius,
      PLAYER_RADIUS + 18,
      Boolean(room?.zonePvpMode),
    );
    const knockbackWorldWidth = room?.normalMode
      ? NORMAL_WORLD_WIDTH
      : WORLD_WIDTH;
    const knockbackWorldHeight = room?.normalMode
      ? NORMAL_WORLD_HEIGHT
      : WORLD_HEIGHT;
    player.x = this.clamp(
      safe.x,
      PLAYER_RADIUS,
      knockbackWorldWidth - PLAYER_RADIUS,
    );
    player.y = this.clamp(
      safe.y,
      PLAYER_RADIUS,
      knockbackWorldHeight - PLAYER_RADIUS,
    );
    player.knockbackX = kx * BODY_COLLISION_PUSH_DECAY;
    player.knockbackY = ky * BODY_COLLISION_PUSH_DECAY;
  }

  buildCollisionGrid(alivePlayers) {
    const grid = new Map<string, any[]>();
    for (const player of alivePlayers) {
      const cellX = Math.floor(player.x / COLLISION_GRID_CELL_SIZE);
      const cellY = Math.floor(player.y / COLLISION_GRID_CELL_SIZE);
      const key = `${cellX}:${cellY}`;
      player.gridKey = key;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(player);
    }
    return grid;
  }

  getNearbyCellPlayers(grid, player) {
    const cellX = Math.floor(player.x / COLLISION_GRID_CELL_SIZE);
    const cellY = Math.floor(player.y / COLLISION_GRID_CELL_SIZE);
    const nearby: any[] = [];
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const bucket = grid.get(`${cellX + ox}:${cellY + oy}`);
        if (bucket) nearby.push(...bucket);
      }
    }
    return nearby;
  }

  handleBodyCollisions(room, now, zoneRadius) {
    const alive = this.getAlivePlayers(room);

    if (alive.length <= 12) {
      this.handleBodyCollisionsBruteForce(alive, room, now, zoneRadius);
      return;
    }

    const grid = this.buildCollisionGrid(alive);
    const checkedPairs = new Set<string>();

    for (const a of alive) {
      const nearby = this.getNearbyCellPlayers(grid, a);
      for (const b of nearby) {
        if (a.id === b.id) continue;
        const pairKey = this.getCollisionKey(a.id, b.id);
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        this.resolvePlayerPairCollision(a, b, room, now, zoneRadius);
      }
    }
  }

  handleBodyCollisionsBruteForce(alive, room, now, zoneRadius) {
    for (let i = 0; i < alive.length; i += 1) {
      for (let j = i + 1; j < alive.length; j += 1) {
        this.resolvePlayerPairCollision(
          alive[i],
          alive[j],
          room,
          now,
          zoneRadius,
        );
      }
    }
  }

  resolvePlayerPairCollision(a, b, room, now, zoneRadius) {
    const key = this.getCollisionKey(a.id, b.id);
    const lastAt = room.collisionCooldowns.get(key) || 0;
    const rawDx = Number(b.x || 0) - Number(a.x || 0);
    const rawDy = Number(b.y || 0) - Number(a.y || 0);
    const rawDistance = Math.hypot(rawDx, rawDy);
    if (rawDistance > BODY_COLLISION_DISTANCE) return;

    if (this.isBattlePrepareLocked(room, now)) return;
    if (now - lastAt < BODY_COLLISION_COOLDOWN) return;

    // Two network players can occasionally reach the exact same coordinate
    // between snapshots. Give that degenerate pair a deterministic direction
    // instead of creating a zero-length impulse that looks like no collision.
    let dirX = 0;
    let dirY = 0;
    if (rawDistance > 0.001) {
      dirX = rawDx / rawDistance;
      dirY = rawDy / rawDistance;
    } else {
      const seed = String(key).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const angle = (seed % 360) * (Math.PI / 180);
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    }

    room.collisionCooldowns.set(key, now);
    const outcome = this.getBodyCollisionOutcome(a, b);
    const aWasAlive = a.alive;
    const bWasAlive = b.alive;
    this.applyBodyCollisionDamage(a, outcome.aHpDamage, outcome.aDroneLoss);
    this.applyBodyCollisionDamage(b, outcome.bHpDamage, outcome.bDroneLoss);

    // Battle Royale-style contact physics is deliberately enabled for both PvP
    // modes. The server remains the sole authority; clients only replay the
    // one reliable impulse immediately for visual responsiveness.
    const appliesPhysicalPush = Boolean(room?.normalMode || room?.zonePvpMode || !room?.battleRoyaleOnlineMode);
    if (appliesPhysicalPush) {
      const overlap = Math.max(0, BODY_COLLISION_DISTANCE - rawDistance);
      const separation = Math.max(
        BODY_COLLISION_SEPARATION,
        Math.min(BODY_COLLISION_SEPARATION * 2, overlap * 0.5 + 6),
      );

      this.applyCollisionSeparation(a, -dirX, -dirY, separation, zoneRadius, room);
      this.applyCollisionSeparation(b, dirX, dirY, separation, zoneRadius, room);
      this.addSmoothKnockback(a, -dirX, -dirY, outcome.push);
      this.addSmoothKnockback(b, dirX, dirY, outcome.push);

      if (room?.normalMode || room?.zonePvpMode) {
        const collisionVersion = Number(room.collisionSequence || 0) + 1;
        room.collisionSequence = collisionVersion;
        a.collisionVersion = collisionVersion;
        b.collisionVersion = collisionVersion;
        a.lastCollisionAt = now;
        b.lastCollisionAt = now;

        const eventName = room.normalMode ? "normal-pvp:collision" : "zone-pvp:collision";
        const emit = room.normalMode
          ? this.emitNormalPvpCollisionImpulse.bind(this)
          : this.emitZonePvpCollisionImpulse.bind(this);
        const baseEvent = {
          id: `${eventName}-${collisionVersion}-${key}`,
          serverTime: now,
          collisionVersion,
        };

        emit(a, {
          ...baseEvent,
          playerId: a.id,
          x: a.x,
          y: a.y,
          impulseX: -dirX * outcome.push,
          impulseY: -dirY * outcome.push,
        });
        emit(b, {
          ...baseEvent,
          playerId: b.id,
          x: b.x,
          y: b.y,
          impulseX: dirX * outcome.push,
          impulseY: dirY * outcome.push,
        });
      }
    }

    if (aWasAlive && !a.alive) {
      this.eliminatePlayer(room, a, b.alive !== false ? b : null, now, "collision", aWasAlive);
    }
    if (bWasAlive && !b.alive) {
      this.eliminatePlayer(room, b, a.alive !== false ? a : null, now, "collision", bWasAlive);
    }

    if (aWasAlive && !a.alive && b.alive) this.applyKillReward(b, room, now);
    if (bWasAlive && !b.alive && a.alive) this.applyKillReward(a, room, now);
  }

  tryFireProjectile(room, player, now) {
    if (this.isBattlePrepareLocked(room, now)) return;
    if ((player.drones || 0) <= 0) return;
    const cooldown = this.getFireCooldown(player, now);
    if (now - player.lastFireAt < cooldown) return;
    const targetX = player.input.mouseX || player.x + 1;
    const targetY = player.input.mouseY || player.y;
    const angle = Math.atan2(targetY - player.y, targetX - player.x);
    const rapidBonus =
      player.rapidFireUntil && player.rapidFireUntil > now ? 0.75 : 0;
    const overclockBonus =
      player.overclockUntil && player.overclockUntil > now ? 1.25 : 0;
    // Keep attack-drone velocity identical between Normal and Zone PvP,
    // including the +5% kill reward stack.
    const progressionAttackDroneMultiplier = this.usesProgressionPvpCombat(room)
      ? NORMAL_BASE_ATTACK_DRONE_SPEED_MULTIPLIER *
        Math.max(1, Number(player.attackDroneSpeedMultiplier || 1))
      : 1;
    const speed =
      (PROJECTILE_SPEED +
        (player.projectileSpeedBonus || 0) +
        rapidBonus +
        overclockBonus) *
      progressionAttackDroneMultiplier;
    player.lastFireAt = now;
    player.drones = Math.max(0, player.drones - 1);
    this.resetDroneProgress(player);
    room.projectiles.push({
      id: crypto.randomUUID(),
      ownerId: player.id,
      x: player.x + Math.cos(angle) * 120,
      y: player.y + Math.sin(angle) * 120,
      startX: player.x,
      startY: player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      skin: player.skin,
      damage:
        player.berserkUntil && player.berserkUntil > now
          ? BERSERK_PROJECTILE_DAMAGE
          : PROJECTILE_DAMAGE,
      pierceLeft: (player.piercingShots || 0) > 0 ? 3 : 1,
      shieldBreaker: (player.shieldBreakerShots || 0) > 0,
      piercesShield: (player.shieldBreakerShots || 0) > 0,
      createdAt: now,
    });
    if ((player.piercingShots || 0) > 0) {
      player.piercingShots = Math.max(0, (player.piercingShots || 0) - 1);
    }
    if ((player.shieldBreakerShots || 0) > 0) {
      player.shieldBreakerShots = Math.max(
        0,
        (player.shieldBreakerShots || 0) - 1,
      );
    }
  }
  getFireCooldown(player, now) {
    let cooldown = FIRE_COOLDOWN;
    if (player.rapidFireUntil && player.rapidFireUntil > now) {
      cooldown *= player.attackCooldownMultiplier || 0.65;
    }
    if (player.overclockUntil && player.overclockUntil > now) {
      cooldown *= 0.5;
    }
    cooldown *= Math.max(
      MIN_KILL_ATTACK_SPEED_MULTIPLIER,
      player.killAttackSpeedMultiplier || 1,
    );
    if (player?.isBot) {
      cooldown = Math.min(cooldown, ZONE_PVP_BOT_FIRE_COOLDOWN_MS);
    }
    return Math.max(420, Math.floor(cooldown));
  }
  updateProjectiles(room, deltaFrames = 1, now = Date.now()) {
    const nextProjectiles = [];
    for (const projectile of room.projectiles) {
      projectile.x += projectile.vx * deltaFrames;
      projectile.y += projectile.vy * deltaFrames;
      const traveled = Math.hypot(
        projectile.x - projectile.startX,
        projectile.y - projectile.startY,
      );
      const age = now - (projectile.createdAt || now);
      if (traveled > PROJECTILE_MAX_DISTANCE || age > PROJECTILE_MAX_LIFETIME)
        continue;
      let keepProjectile = true;
      for (const target of room.players.values()) {
        if (!target.alive || target.id === projectile.ownerId) continue;
        const dx = target.x - projectile.x;
        const dy = target.y - projectile.y;
        if (dx * dx + dy * dy > 105 * 105) continue;
        const owner = room.players.get(projectile.ownerId);

        // In both Normal PvP and Zone PvP, the shield absorbs exactly one
        // attack drone completely: no HP damage and no escort-drone loss.
        // It then drops immediately, even against a shield-breaker projectile.
        const progressionShieldIntercept = Boolean(
          this.usesProgressionPvpCombat(room) && target.shieldActive,
        );
        const damageBlocked =
          progressionShieldIntercept ||
          (target.shieldActive && !projectile.shieldBreaker);

        if (progressionShieldIntercept) {
          target.shieldActive = false;
          target.shieldUntil = 0;
          this.pushCombatEvent(room, target, "SHIELD BLOCKED", "shield", now);
          projectile.pierceLeft = 0;
        } else if (!damageBlocked) {
          const hpBefore = Number(target.hp || 0);
          target.hp = Math.max(0, hpBefore - projectile.damage);

          let removedDrone = false;
          if (
            this.usesProgressionPvpCombat(room) &&
            (target.drones || 0) > 0
          ) {
            target.drones = Math.max(0, Number(target.drones || 0) - 1);
            target.nextDroneAt = this.getNextDroneAt(target.drones || 0);
            removedDrone = true;
          }

          if (owner && owner.id !== target.id) {
            target.lastDamageById = owner.id;
            target.lastDamageAt = now;
          }
          if (owner && owner.vampireUntil && owner.vampireUntil > now) {
            owner.hp = Math.min(
              owner.maxHp,
              owner.hp + Math.floor(projectile.damage * VAMPIRE_HEAL_RATIO),
            );
          }

          if (this.usesProgressionPvpCombat(room)) {
            this.pushCombatEvent(
              room,
              target,
              `-${Math.max(0, hpBefore - target.hp)} HP`,
              "damage",
              now,
            );
            if (removedDrone) {
              this.pushCombatEvent(room, target, "-1 DRONE", "drone-loss", now);
            }
          }

          if (target.hp <= 0) {
            this.eliminatePlayer(room, target, owner, now, "projectile");
            if (owner) {
              this.applyKillReward(owner, room, now);
            }
          }
        }
        projectile.pierceLeft -= 1;
        if (projectile.pierceLeft <= 0) keepProjectile = false;
        break;
      }
      if (keepProjectile) nextProjectiles.push(projectile);
    }
    room.projectiles = nextProjectiles.slice(-160);
  }
  applyZoneDamage(room, now, zoneRadius) {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    for (const player of room.players.values()) {
      if (!player.alive) continue;
      const distance = Math.hypot(player.x - centerX, player.y - centerY);
      if (distance <= zoneRadius) continue;
      if (now - (player.lastZoneDamageAt || 0) < ZONE_DAMAGE_INTERVAL) continue;
      player.lastZoneDamageAt = now;
      player.hp = Math.max(0, player.hp - ZONE_DAMAGE);
      if (player.hp <= 0) {
        this.eliminatePlayer(room, player, this.getRecentKiller(room, player, now), now, "zone");
      }
    }
  }

  applyBattleRoyaleOnlineZoneDamage(room, now, zoneRadius) {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    for (const player of room.players.values()) {
      if (!player.alive) continue;
      const distance = Math.hypot(player.x - centerX, player.y - centerY);
      if (distance <= zoneRadius) continue;
      if (now - (player.lastZoneDamageAt || 0) < BR_ONLINE_ZONE_DAMAGE_INTERVAL)
        continue;
      player.lastZoneDamageAt = now;
      player.hp = Math.max(0, player.hp - BR_ONLINE_ZONE_DAMAGE);
      if (player.hp <= 0) {
        this.eliminatePlayer(room, player, this.getRecentKiller(room, player, now), now, "zone");
      }
    }
  }

  applyZonePvpZoneDamage(room, now, zoneRadius) {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    for (const player of room.players.values()) {
      if (!player.alive) continue;
      const distance = Math.hypot(player.x - centerX, player.y - centerY);
      if (distance <= zoneRadius) continue;
      if (now - (player.lastZoneDamageAt || 0) < ZONE_PVP_ZONE_DAMAGE_INTERVAL)
        continue;
      player.lastZoneDamageAt = now;
      player.hp = Math.max(0, player.hp - ZONE_PVP_ZONE_DAMAGE);
      if (player.hp <= 0) {
        this.eliminatePlayer(room, player, this.getRecentKiller(room, player, now), now, "zone");
      }
    }
  }
  distancePointToSegment(px, py, ax, ay, bx, by) {
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

  getRoomEventPrefix(room) {
    if (room?.normalMode) return "normal-pvp";
    if (room?.zonePvpMode) return "zone-pvp";
    if (room?.battleRoyaleOnlineMode) return "battle-royale-online";
    return "pvp";
  }

  emitCollectSync(room, player, payload) {
    if (!player?.id) return;

    const socket = this.server.sockets.sockets.get(player.id);
    if (!socket) return;

    player.collectionSeq = (player.collectionSeq || 0) + 1;
    player.lastCollectEventAt = Date.now();

    const prefix = this.getRoomEventPrefix(room);

    socket.emit(`${prefix}:collect`, {
      ...payload,
      collectionSeq: player.collectionSeq,
      serverTime: Date.now(),
      you: this.serializePlayer(player),
    });
  }

  // A viewport snapshot is deliberately throttled. Without this tiny reliable
  // delta, an observer can keep seeing loot for up to one item-sync interval
  // after another drone collected it. The event carries ids only, so it is safe
  // to broadcast to the room and is far cheaper than forcing a full snapshot.
  emitWorldItemDelta(room, payload, now = Date.now()) {
    if (!room?.id) return;
    const prefix = this.getRoomEventPrefix(room);
    const removedOrbIds = Array.isArray(payload?.removedOrbIds) ? payload.removedOrbIds : [];
    const removedEnergyIds = Array.isArray(payload?.removedEnergyIds) ? payload.removedEnergyIds : [];
    const removedCoreIds = Array.isArray(payload?.removedCoreIds) ? payload.removedCoreIds : [];
    if (!removedOrbIds.length && !removedEnergyIds.length && !removedCoreIds.length) return;

    this.server.to(room.id).compress(false).emit(`${prefix}:world-delta`, {
      serverTime: now,
      removedOrbIds,
      removedEnergyIds,
      removedCoreIds,
    });
  }

  collectOrbs(room, zoneRadius) {
    const collectedIds = new Set<string>();
    // Static spatial maps are intentionally refreshed less often than the
    // 60 Hz simulation. Validate candidates against the live authoritative
    // array so a removed orb can never be collected again from an old bucket.
    const activeOrbIds = new Set((room.orbs || []).map((orb) => orb?.id).filter(Boolean));

    for (const player of room.players.values()) {
      if (!player.alive) continue;

      let collected = 0;
      const collectedOrbIds: string[] = [];
      const candidates = room.orbSpatialIndex
        ? this.querySpatialIndex(
            room.orbSpatialIndex,
            player.x,
            player.y,
            ORB_COLLECT_DISTANCE + 180,
          )
        : room.orbs;

      for (const orb of candidates) {
        if (
          !orb?.id ||
          !activeOrbIds.has(orb.id) ||
          collectedIds.has(orb.id)
        ) {
          continue;
        }

        const endDx = orb.x - player.x;
        const endDy = orb.y - player.y;
        const pathDistance = this.distancePointToSegment(
          orb.x,
          orb.y,
          player.prevX ?? player.x,
          player.prevY ?? player.y,
          player.x,
          player.y,
        );

        if (
          endDx * endDx + endDy * endDy >
            ORB_COLLECT_DISTANCE * ORB_COLLECT_DISTANCE &&
          pathDistance > ORB_COLLECT_DISTANCE
        ) {
          continue;
        }

        collectedIds.add(orb.id);
        activeOrbIds.delete(orb.id);
        collected += 1;
        collectedOrbIds.push(orb.id);
      }

      if (collected > 0) {
        player.totalCollected += collected;
        player.progress += collected;

        while (
          player.drones < MAX_DRONES &&
          player.progress >= player.nextDroneAt
        ) {
          player.progress -= player.nextDroneAt;
          player.drones += 1;
          player.nextDroneAt = this.getNextDroneAt(player.drones);
        }

        this.emitCollectSync(room, player, {
          type: "orb",
          collectedCount: collected,
          collectedOrbIds,
        });
      }
    }

    if (collectedIds.size > 0) {
      room.orbs = room.orbs.filter((orb) => !collectedIds.has(orb.id));
      room.itemSpatialDirty = true;

      // Instantly restore population with fresh map-random positions. The
      // replacement is intentionally far from every living player so it cannot
      // be picked up in the same movement segment or create a visible pile.
      if (room.normalMode) {
        this.ensureNormalOrbDistribution(room, Date.now());
      }

      // Keep the next collect pass and the next network snapshot in sync with
      // the authoritative arrays; stale index references caused the old
      // repeated/missing-count bug.
      this.refreshRoomSpatialIndexes(room, Date.now(), true);

      this.emitWorldItemDelta(room, {
        removedOrbIds: [...collectedIds],
      });
    }
  }
  collectEnergy(room, zoneRadius) {
    const collectedIds = new Set<string>();
    const activeEnergyIds = new Set(
      (room.energyCells || []).map((cell) => cell?.id).filter(Boolean),
    );

    for (const player of room.players.values()) {
      if (!player.alive) continue;

      let collected = 0;
      const collectedEnergyIds: string[] = [];
      const candidates = room.energySpatialIndex
        ? this.querySpatialIndex(
            room.energySpatialIndex,
            player.x,
            player.y,
            ENERGY_CELL_COLLECT_DISTANCE + 180,
          )
        : room.energyCells;

      for (const cell of candidates) {
        if (
          !cell?.id ||
          !activeEnergyIds.has(cell.id) ||
          collectedIds.has(cell.id)
        ) {
          continue;
        }

        const endDx = cell.x - player.x;
        const endDy = cell.y - player.y;
        const pathDistance = this.distancePointToSegment(
          cell.x,
          cell.y,
          player.prevX ?? player.x,
          player.prevY ?? player.y,
          player.x,
          player.y,
        );

        if (
          endDx * endDx + endDy * endDy >
            ENERGY_CELL_COLLECT_DISTANCE * ENERGY_CELL_COLLECT_DISTANCE &&
          pathDistance > ENERGY_CELL_COLLECT_DISTANCE
        ) {
          continue;
        }

        collectedIds.add(cell.id);
        activeEnergyIds.delete(cell.id);
        collected += 1;
        collectedEnergyIds.push(cell.id);

        const energyBefore = Number(player.energy || 0);
        player.energy = Math.min(100, energyBefore + 25);
        const energyGained = Math.max(0, Number(player.energy || 0) - energyBefore);

        if (energyGained > 0 && this.usesProgressionPvpCombat(room)) {
          this.pushCombatEvent(
            room,
            player,
            `ENERGY +${energyGained}`,
            "heal",
            Date.now(),
          );
        }
      }

      if (collected > 0) {
        this.emitCollectSync(room, player, {
          type: "energy",
          collectedCount: collected,
          collectedEnergyIds,
        });
      }
    }

    if (collectedIds.size > 0) {
      room.energyCells = room.energyCells.filter(
        (cell) => !collectedIds.has(cell.id),
      );
      room.itemSpatialDirty = true;

      if (room.normalMode) {
        const missing = Math.max(
          0,
          this.getNormalEnergyTarget(room) - room.energyCells.length,
        );
        for (let index = 0; index < missing; index += 1) {
          room.energyCells.push(this.createNormalEnergyCell());
        }
      }

      this.refreshRoomSpatialIndexes(room, Date.now(), true);
      this.emitWorldItemDelta(room, {
        removedEnergyIds: [...collectedIds],
      });
    }
  }

  collectCores(room, zoneRadius) {
    const collectedIds = new Set<string>();
    const activeCoreIds = new Set((room.cores || []).map((core) => core?.id).filter(Boolean));

    for (const player of room.players.values()) {
      if (!player.alive) continue;

      const collectedCoreIds: string[] = [];
      const candidates = room.coreSpatialIndex
        ? this.querySpatialIndex(
            room.coreSpatialIndex,
            player.x,
            player.y,
            CORE_COLLECT_DISTANCE + 180,
          )
        : room.cores;

      for (const core of candidates) {
        if (!core?.id || !activeCoreIds.has(core.id) || collectedIds.has(core.id)) continue;

        const endDx = core.x - player.x;
        const endDy = core.y - player.y;
        const pathDistance = this.distancePointToSegment(
          core.x,
          core.y,
          player.prevX ?? player.x,
          player.prevY ?? player.y,
          player.x,
          player.y,
        );

        if (
          endDx * endDx + endDy * endDy >
            CORE_COLLECT_DISTANCE * CORE_COLLECT_DISTANCE &&
          pathDistance > CORE_COLLECT_DISTANCE
        ) {
          continue;
        }
        if (!this.canUseCore(player, core)) continue;

        this.applyCore(player, core, room);
        collectedIds.add(core.id);
        activeCoreIds.delete(core.id);
        collectedCoreIds.push(core.id);
      }

      if (collectedCoreIds.length > 0) {
        this.emitCollectSync(room, player, {
          type: "core",
          collectedCount: collectedCoreIds.length,
          collectedCoreIds,
        });
      }
    }

    if (collectedIds.size > 0) {
      room.cores = room.cores.filter((core) => !collectedIds.has(core.id));
      room.itemSpatialDirty = true;
      this.refreshRoomSpatialIndexes(room, Date.now(), true);
      this.emitWorldItemDelta(room, {
        removedCoreIds: [...collectedIds],
      });
    }
  }

  canUseCore(player, core) {
    if (
      this.getActiveCoreCount(player) >= MAX_ACTIVE_CORES &&
      !this.hasCoreAlready(player, core.type)
    ) {
      return false;
    }
    if (core.type === "nano") {
      return (
        !player.nanoCoreActive &&
        (player.maxHp < MAX_HP || player.hp < player.maxHp)
      );
    }
    if (core.type === "rotor") {
      return (
        !player.rotorCoreActive &&
        (player.attackSpeedLevel || 1) < ROTOR_MAX_LEVEL
      );
    }
    if (core.type === "piercing") return (player.piercingShots || 0) <= 0;
    if (core.type === "shield-breaker") {
      return (player.shieldBreakerShots || 0) <= 0;
    }
    if (core.type === "swarm") {
      return !player.swarmCoreActive && player.drones < MAX_DRONES;
    }
    return true;
  }
  getActiveCoreCount(player) {
    const now = Date.now();
    return [
      player.nanoCoreActive,
      player.rotorCoreActive,
      player.swarmCoreActive,
      (player.piercingShots || 0) > 0,
      (player.shieldBreakerShots || 0) > 0,
      (player.overclockUntil || 0) > now,
      (player.berserkUntil || 0) > now,
      (player.vampireUntil || 0) > now,
      (player.empPulseUntil || 0) > now,
    ].filter(Boolean).length;
  }
  hasCoreAlready(player, type) {
    const now = Date.now();
    if (type === "nano") return Boolean(player.nanoCoreActive);
    if (type === "rotor") return Boolean(player.rotorCoreActive);
    if (type === "swarm") return Boolean(player.swarmCoreActive);
    if (type === "piercing") return (player.piercingShots || 0) > 0;
    if (type === "shield-breaker") return (player.shieldBreakerShots || 0) > 0;
    if (type === "overclock") return (player.overclockUntil || 0) > now;
    if (type === "berserk") return (player.berserkUntil || 0) > now;
    if (type === "vampire") return (player.vampireUntil || 0) > now;
    if (type === "emp") return (player.empPulseUntil || 0) > now;
    return false;
  }
  applyCore(player, core, authoritativeRoom = null) {
    const now = Date.now();
    if (core.type === "nano") {
      player.maxHp = Math.min(MAX_HP, player.maxHp + 10);
      player.hp = Math.min(player.maxHp, player.hp + 10);
      player.nanoCoreActive = true;
    }
    if (core.type === "rotor") {
      player.attackSpeedLevel = ROTOR_MAX_LEVEL;
      player.projectileSpeedBonus = Math.max(
        player.projectileSpeedBonus || 0,
        0.9,
      );
      player.rotorCoreActive = true;
    }
    if (core.type === "piercing") player.piercingShots = 3;
    if (core.type === "overclock") {
      player.overclockUntil = now + OVERCLOCK_DURATION;
    }
    if (core.type === "berserk") {
      player.berserkUntil = now + BERSERK_DURATION;
    }
    if (core.type === "shield-breaker") {
      player.shieldBreakerShots = SHIELD_BREAKER_SHOTS;
    }
    if (core.type === "swarm") {
      player.drones = Math.min(MAX_DRONES, player.drones + SWARM_CORE_DRONES);
      player.progress = 0;
      player.nextDroneAt = this.getNextDroneAt(player.drones);
      player.swarmCoreActive = true;
    }
    if (core.type === "vampire") {
      player.vampireUntil = now + VAMPIRE_DURATION;
    }
    if (core.type === "emp") {
      player.empPulseUntil = now + 900;
      const playerRoom =
        authoritativeRoom ||
        this.getRoomBySocket(player.id) ||
        this.getNormalRoomBySocket(player.id) ||
        this.getBattleRoyaleOnlineRoomBySocket(player.id) ||
        this.getZonePvpRoomBySocket(player.id);
      for (const other of playerRoom?.players.values() || []) {
        if (other.id === player.id || !other.alive) continue;
        const dx = other.x - player.x;
        const dy = other.y - player.y;
        if (dx * dx + dy * dy <= 560 * 560) {
          other.drones = Math.max(0, other.drones - 1);
        }
      }
    }
  }
  maintainWorldItems(room, zoneRadius, now) {
    const itemsBefore = {
      orbs: room.orbs.length,
      energy: room.energyCells.length,
      cores: room.cores.length,
    };

    // Normal PvP has a static, oversized play area. Rechecking every item
    // every 16 ms is pure overhead. Shrinking-zone modes prune at a bounded rate.
    if (
      !room.normalMode &&
      now - (room.lastItemZonePruneAt || 0) >= ITEM_ZONE_PRUNE_INTERVAL_MS
    ) {
      room.lastItemZonePruneAt = now;
      room.orbs = room.orbs.filter((orb) =>
        this.isInsideSafeZone(orb.x, orb.y, zoneRadius, 120),
      );
      room.energyCells = room.energyCells.filter((cell) =>
        this.isInsideSafeZone(cell.x, cell.y, zoneRadius, 120),
      );
      room.cores = room.cores.filter((core) =>
        this.isInsideSafeZone(core.x, core.y, zoneRadius, 420),
      );
    }

    const zoneBotMatch = Boolean(room?.zonePvpMode && this.getZoneBotCount(room) > 0);
    const zoneAliveCount = this.getAlivePlayers(room).length;
    const orbTarget = zoneBotMatch
      ? this.clamp(160 + zoneAliveCount * 5, 220, 460)
      : this.getNormalOrbTarget(room);
    const energyTarget = zoneBotMatch
      ? this.clamp(26 + zoneAliveCount * 2, 42, 150)
      : this.getNormalEnergyTarget(room);

    if (room.normalMode) {
      this.ensureNormalOrbDistribution(room, now);
    }

    while (!room.normalMode && room.orbs.length < orbTarget) {
      room.orbs.push(this.createOrb(zoneRadius));
    }

    while (room.energyCells.length < energyTarget) {
      room.energyCells.push(
        room.normalMode
          ? this.createNormalEnergyCell()
          : this.createEnergyCell(zoneRadius),
      );
    }

    if (room.normalMode) {
      if (room.orbs.length > orbTarget) {
        room.orbs = room.orbs.slice(-orbTarget);
      }
      if (room.energyCells.length > energyTarget) {
        room.energyCells = room.energyCells.slice(-energyTarget);
      }
    }

    if (room.normalMode || room.battleRoyaleOnlineMode || room.zonePvpMode) {
      if (room.cores.length > 0) {
        room.nextCoreWaveAt = null;
      } else {
        if (!room.nextCoreWaveAt) {
          room.nextCoreWaveAt = now + CORE_WARNING_DELAY;
        }

        if (now >= room.nextCoreWaveAt) {
          room.cores = Array.from({ length: CORE_WAVE_SIZE }, () =>
            room.normalMode
              ? this.createNormalCore()
              : this.createCore(zoneRadius),
          );
          room.lastCoreWaveAt = now;
          room.nextCoreWaveAt = null;
        }
      }
    } else if (now - room.lastCoreWaveAt >= CORE_RESPAWN_DELAY) {
      room.lastCoreWaveAt = now;
      while (room.cores.length < CORE_WAVE_SIZE) {
        room.cores.push(this.createCore(zoneRadius));
      }
    }

    if (now - (room.lastLocalItemAt || 0) > 1800) {
      room.lastLocalItemAt = now;
      this.ensureLocalItemsAroundPlayers(room, zoneRadius);
    }

    if (
      itemsBefore.orbs !== room.orbs.length ||
      itemsBefore.energy !== room.energyCells.length ||
      itemsBefore.cores !== room.cores.length
    ) {
      room.itemSpatialDirty = true;
    }

    // Static loot is indexed only after a change / short bounded interval.
    // This avoids rebuilding hundreds of cells 60 times per second in solo Normal PvP.
    this.refreshRoomSpatialIndexes(room, now);
  }
  updateWinCondition(room, now) {
    if (room.status !== "playing") return;
    const alive = this.getAlivePlayers(room);
    if (room.players.size >= ROOM_MIN_PLAYERS && alive.length <= 1) {
      const winner = alive[0] || null;
      room.status = "finished";
      room.winnerId = winner?.id || null;
      room.winnerName = winner?.username || null;
      room.finishedAt = now;
      room.projectiles = [];
      for (const player of room.players.values()) {
        player.input = {};
        player.shieldActive = false;
        player.shieldUntil = 0;
      }
    }
  }

  updateBattleRoyaleOnlineWinCondition(room, now) {
    if (room.status !== "playing") return;
    const alive = this.getAlivePlayers(room);
    if (room.players.size >= BR_ONLINE_ROOM_MIN_PLAYERS && alive.length <= 1) {
      const winner = alive[0] || null;
      room.status = "finished";
      room.winnerId = winner?.id || null;
      room.winnerName = winner?.username || null;
      room.finishedAt = now;
      room.projectiles = [];
      for (const player of room.players.values()) {
        player.input = {};
        player.shieldActive = false;
        player.shieldUntil = 0;
      }
    }
  }

  finishZonePvpMatch(room, winner, now = Date.now()) {
    if (!room || room.status === "finished") return;

    room.status = "finished";
    room.locked = true;
    room.countdownStartedAt = null;
    room.battlePrepareUntil = null;
    room.battleBeginFlashUntil = null;
    room.winnerId = winner?.id || null;
    room.winnerName = winner?.username || null;
    room.finishedAt = now;
    room.phaseVersion = Number(room.phaseVersion || 0) + 1;
    room.projectiles = [];

    for (const player of room.players.values()) {
      player.input = {};
      player.shieldActive = false;
      player.shieldUntil = 0;
    }

    this.broadcastZonePvpRoomState(room, now, true);
  }

  updateZonePvpWinCondition(room, now) {
    if (room.status !== "playing" || !room.matchHadMultiplePlayers) return;

    const alive = this.getAlivePlayers(room);

    // Last alive wins. A disconnect goes through removeZonePvpPlayer,
    // which calls this function instead of restarting matchmaking.
    if (alive.length <= 1) {
      this.finishZonePvpMatch(room, alive[0] || null, now);
    }
  }
  broadcastRoomState(room, now) {
    const players = [...room.players.values()];
    const alivePlayers = players.filter((p) => p.alive);
    const zoneRadius = this.getSafeZoneRadius(room);
    const leaderboard = [...players]
      .sort((a, b) => b.kills - a.kills || b.totalCollected - a.totalCollected)
      .slice(0, 10)
      .map((player) => ({
        id: player.id,
        userId: player.userId || null,
        isGuest: Boolean(player.isGuest),
        username: player.username,
        totalCollected: player.totalCollected,
        kills: player.kills,
        drones: player.drones,
        skin: player.skin,
      }));
    const countdown =
      room.status === "countdown" && room.countdownStartedAt
        ? Math.max(
            1,
            Math.ceil(
              (ROOM_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) /
                1000,
            ),
          )
        : null;
    const secondsUntilCoreDrop = Math.ceil(
      Math.max(0, CORE_RESPAWN_DELAY - (now - room.lastCoreWaveAt)) / 1000,
    );
    const coreDropCountdown =
      room.status === "playing" &&
      secondsUntilCoreDrop > 0 &&
      secondsUntilCoreDrop <= 5
        ? secondsUntilCoreDrop
        : null;
    const minimapOrbs = [...room.orbs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((_, index) => index % 3 === 0)
      .slice(0, 120);
    const minimapCores = [...room.cores]
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 12);
    for (const player of players) {
      const socket = this.server.sockets.sockets.get(player.id);
      if (!socket) continue;
      const visiblePlayers = players
        .filter((other) => other.id !== player.id)
        .filter((other) => this.isNear(player, other, VIEW_DISTANCE))
        .map((other) => this.serializePlayer(other));
      const visibleOrbs = room.orbSpatialIndex
        ? this.filterNearIndexed(
            player,
            room.orbSpatialIndex,
            VIEW_DISTANCE,
            VISIBLE_ORB_LIMIT,
          )
        : this.filterNear(player, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT);
      const visibleEnergyCells = room.energySpatialIndex
        ? this.filterNearIndexed(
            player,
            room.energySpatialIndex,
            VIEW_DISTANCE,
            VISIBLE_ENERGY_LIMIT,
          )
        : this.filterNear(
            player,
            room.energyCells,
            VIEW_DISTANCE,
            VISIBLE_ENERGY_LIMIT,
          );
      const visibleCores = room.coreSpatialIndex
        ? this.filterNearIndexed(
            player,
            room.coreSpatialIndex,
            VIEW_DISTANCE + 600,
            18,
          )
        : this.filterNear(player, room.cores, VIEW_DISTANCE + 600, 18);
      const visibleProjectiles = room.projectileSpatialIndex
        ? this.filterNearIndexed(
            player,
            room.projectileSpatialIndex,
            VIEW_DISTANCE + 400,
            VISIBLE_PROJECTILE_LIMIT,
          )
        : this.filterNear(
            player,
            room.projectiles,
            VIEW_DISTANCE + 400,
            VISIBLE_PROJECTILE_LIMIT,
          );
      socket.volatile.emit("pvp:state", {
        status: room.status,
        countdown,
        coreDropCountdown,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        playerCount: alivePlayers.length,
        minPlayers: ROOM_MIN_PLAYERS,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        safeZoneRadius: zoneRadius,
        you: this.serializePlayer(player),
        players: visiblePlayers,
        orbs: visibleOrbs,
        minimapOrbs,
        minimapCores,
        energyCells: visibleEnergyCells,
        cores: visibleCores,
        projectiles: visibleProjectiles,
        leaderboard,
      });
    }
  }
  serializePlayer(player) {
    return {
      id: player.id,
      userId: player.userId || null,
      isGuest: Boolean(player.isGuest),
      isBot: Boolean(player.isBot),
      username: player.username,
      x: Math.round(player.x),
      y: Math.round(player.y),
      hp: player.hp,
      maxHp: player.maxHp,
      energy: player.energy,
      drones: player.drones,
      progress: player.progress,
      nextDroneAt: player.nextDroneAt,
      totalCollected: player.totalCollected,
      kills: player.kills,
      killStreak: player.killStreak || 0,
      rapidFireUntil: player.rapidFireUntil || 0,
      attackCooldownMultiplier: player.attackCooldownMultiplier || 1,
      killAttackSpeedMultiplier: player.killAttackSpeedMultiplier || 1,
      moveSpeedMultiplier: player.moveSpeedMultiplier || 1,
      attackDroneSpeedMultiplier: player.attackDroneSpeedMultiplier || 1,
      skin: player.skin,
      alive: player.alive,
      killedById: player.killedById || null,
      spectatorTargetId: player.spectatorTargetId || null,
      eliminatedAt: player.eliminatedAt || 0,
      eliminationReason: player.eliminationReason || null,
      attacking: Boolean(player.input?.attacking),
      shieldActive: Boolean(player.shieldActive),
      mouseX: player.input?.mouseX || player.x,
      mouseY: player.input?.mouseY || player.y,
      moveX: player.moveX || 0,
      moveY: player.moveY || 0,
      // Keep remote movement smooth on receivers even when the sender's render
      // loop is slow. These are server-side world pixels per second.
      velocityX: Number(player.velocityX || 0),
      velocityY: Number(player.velocityY || 0),
      moveAngle: player.moveAngle || 0,
      isMoving: Boolean(player.isMoving),
      knockbackX: player.knockbackX || 0,
      knockbackY: player.knockbackY || 0,
      collisionVersion: Number(player.collisionVersion || 0),
      lastCollisionAt: Number(player.lastCollisionAt || 0),
      nanoCoreActive: player.nanoCoreActive,
      rotorCoreActive: player.rotorCoreActive,
      swarmCoreActive: player.swarmCoreActive,
      piercingShots: player.piercingShots || 0,
      shieldBreakerShots: player.shieldBreakerShots || 0,
      overclockUntil: player.overclockUntil || 0,
      berserkUntil: player.berserkUntil || 0,
      vampireUntil: player.vampireUntil || 0,
      empPulseUntil: player.empPulseUntil || 0,
      lastProcessedInputSeq: player.lastProcessedInputSeq || 0,
      collectionSeq: player.collectionSeq || 0,
      lastCollectEventAt: player.lastCollectEventAt || 0,
      serverTime: Date.now(),
      lastInputReceivedAt: player.lastInputReceivedAt || 0,
    };
  }
  findOrCreateNormalRoom() {
    const joinableRoom = this.selectMostPopulatedJoinableRoom(
      this.normalRooms,
      (room) =>
        room.status === "playing" &&
        room.players.size < NORMAL_ROOM_MAX_PLAYERS,
    );

    if (joinableRoom) return joinableRoom;

    const room = {
      id: `normal-${crypto.randomUUID()}`,
      status: "playing",
      players: new Map(),
      orbs: [],
      normalOrbGrid: null,
      normalOrbDistributionVersion: 0,
      normalOrbRespawnAt: new Map<number, number>(),
      normalOrbRespawnCollectorId: new Map<number, string>(),
      normalOrbRespawnGeneration: new Map<number, number>(),
      energyCells: Array.from({ length: NORMAL_ENERGY_BASE_TARGET }, () =>
        this.createNormalEnergyCell(),
      ),
      cores: [],
      pendingCores: [],
      projectiles: [],
      combatEvents: [],
      combatEventSequence: 0,
      collisionSequence: 0,
      countdownStartedAt: null,
      createdAt: Date.now(),
      emptySince: Date.now(),
      matchStartedAt: Date.now(),
      lastCoreWaveAt: Date.now(),
      nextCoreWaveAt: Date.now() + CORE_WARNING_DELAY,
      lastLocalItemAt: 0,
      lastBroadcastAt: 0,
      lastStaticStateAt: 0,
      winnerId: null,
      winnerName: null,
      finishedAt: null,
      collisionCooldowns: new Map(),
      normalMode: true,
    };

    this.rebuildNormalOrbDistribution(room, NORMAL_ORB_BASE_TARGET);
    this.normalRooms.set(room.id, room);
    return room;
  }

  getNormalRoomBySocket(socketId) {
    const roomId = this.normalSocketRoom.get(socketId);
    if (!roomId) return null;
    return this.normalRooms.get(roomId) || null;
  }

  removeNormalPlayer(socketId) {
    const roomId = this.normalSocketRoom.get(socketId);
    if (!roomId) return;

    const room = this.normalRooms.get(roomId);
    if (room) {
      room.players.delete(socketId);
      this.server.sockets.sockets.get(socketId)?.leave(roomId);
      this.markRoomEmptyIfNeeded(room);
    }

    this.normalSocketRoom.delete(socketId);
  }

  cleanupNormalRoom(room, now) {
    for (const player of room.players.values()) {
      const socketOnline = this.server.sockets.sockets.has(player.id);
      // A spectator has no movement input after being eliminated. Keep an
      // online dead player in the room so their camera can continue following
      // the killer until they leave voluntarily.
      if (!socketOnline || (player.alive !== false && now - player.lastSeenAt > 30000)) {
        this.removeNormalPlayer(player.id);
      }
    }

    if (this.shouldDeleteEmptyRoom(room, now)) {
      this.normalRooms.delete(room.id);
    }
  }

  getNormalSpawn(room) {
    const existing = [...room.players.values()];

    if (existing.length === 0) {
      return {
        x: NORMAL_WORLD_WIDTH / 2 - 520,
        y: NORMAL_WORLD_HEIGHT / 2,
      };
    }

    const spawnAreaRadius = 5600;
    const minSpawnDistance = 700;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * spawnAreaRadius;
      const x = NORMAL_WORLD_WIDTH / 2 + Math.cos(angle) * distance;
      const y = NORMAL_WORLD_HEIGHT / 2 + Math.sin(angle) * distance;

      let farEnough = true;
      for (const other of existing) {
        const dx = other.x - x;
        const dy = other.y - y;
        if (dx * dx + dy * dy < minSpawnDistance * minSpawnDistance) {
          farEnough = false;
          break;
        }
      }

      if (farEnough) {
        return {
          x: this.clamp(x, PLAYER_RADIUS, NORMAL_WORLD_WIDTH - PLAYER_RADIUS),
          y: this.clamp(y, PLAYER_RADIUS, NORMAL_WORLD_HEIGHT - PLAYER_RADIUS),
        };
      }
    }

    return {
      x: this.clamp(
        NORMAL_WORLD_WIDTH / 2 + (Math.random() - 0.5) * spawnAreaRadius,
        PLAYER_RADIUS,
        NORMAL_WORLD_WIDTH - PLAYER_RADIUS,
      ),
      y: this.clamp(
        NORMAL_WORLD_HEIGHT / 2 + (Math.random() - 0.5) * spawnAreaRadius,
        PLAYER_RADIUS,
        NORMAL_WORLD_HEIGHT - PLAYER_RADIUS,
      ),
    };
  }

  broadcastNormalRoomState(room, now) {
    const players = [...room.players.values()];
    const alivePlayers = players.filter((player) => player.alive);
    const aliveOthers = alivePlayers;
    const serializedById = new Map(
      players.map((player) => [player.id, this.serializePlayer(player)]),
    );
    const snapshotsByPlayer = new Map(
      players.map((player) => [player.id, serializedById.get(player.id)]),
    );

    // These do not affect real-time movement. Send them twice per second
    // instead of rebuilding/sending the same large arrays on every snapshot.
    const includeStaticState =
      !room.lastStaticStateAt ||
      now - room.lastStaticStateAt >= STATIC_STATE_INTERVAL_MS;
    let leaderboard: any[] | undefined;
    let minimapOrbs: any[] | undefined;
    let minimapEnergyCells: any[] | undefined;
    let minimapCores: any[] | undefined;

    if (includeStaticState) {
      room.lastStaticStateAt = now;
      leaderboard = players
        .slice()
        .sort(
          (a, b) =>
            (b.kills || 0) - (a.kills || 0) ||
            (b.totalCollected || 0) - (a.totalCollected || 0),
        )
        .slice(0, 8)
        .map((player) => ({
          id: player.id,
          username: player.username,
          kills: player.kills || 0,
          drones: player.drones || 0,
          progress: player.progress || 0,
          nextDroneAt: player.nextDroneAt || DRONE_REQUIREMENTS[0],
          totalCollected: player.totalCollected || 0,
          alive: player.alive,
        }));

      minimapOrbs = [...room.orbs]
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter((_, index) => index % 3 === 0)
        .slice(0, 120);
      minimapEnergyCells = [];
      minimapCores = [...room.cores]
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 12);
    }

    const playerIndex = this.buildSpatialIndex(players);
    for (const player of players) {
      const socket = this.server.sockets.sockets.get(player.id);
      if (!socket) continue;

      const aliveOtherPlayers = aliveOthers.filter(
        (other) => other.id !== player.id,
      );
      // Spectator target is locked at elimination. It only changes when the
      // killer disconnects/dies, never randomly between snapshots.
      const spectatorTarget =
        player.alive === false
          ? this.getStableSpectatorTarget(room, player)
          : null;

      if (player.alive === false) {
        player.spectatorTargetId = spectatorTarget?.id || null;
      } else {
        player.spectatorTargetId = null;
        player.killedById = null;
      }

      const viewAnchor = spectatorTarget || player;
      const includeViewportItems =
        !player.lastViewportItemStateAt ||
        now - player.lastViewportItemStateAt >= VIEWPORT_ITEM_STATE_INTERVAL_MS;
      if (includeViewportItems) player.lastViewportItemStateAt = now;
      const playerCandidates = this.querySpatialIndex(
        playerIndex,
        viewAnchor.x,
        viewAnchor.y,
        player.alive === false ? VIEW_DISTANCE + 1200 : VIEW_DISTANCE,
      );

      const visiblePlayers = this.filterNear(
        viewAnchor,
        playerCandidates.filter(
          (other) =>
            other.id !== player.id &&
            (player.alive !== false || other.alive !== false),
        ),
        player.alive === false ? VIEW_DISTANCE + 1200 : VIEW_DISTANCE,
        NORMAL_VISIBLE_PLAYERS_LIMIT,
      ).map((other) => snapshotsByPlayer.get(other.id));

      const payload: any = {
        status: "playing",
        serverTime: now,
        countdown: null,
        coreDropCountdown:
          room.cores.length === 0 && room.nextCoreWaveAt
            ? (() => {
                const seconds = Math.ceil(
                  Math.max(0, room.nextCoreWaveAt - now) / 1000,
                );
                return seconds > 0 &&
                  seconds <= Math.ceil(CORE_WARNING_DELAY / 1000)
                  ? seconds
                  : null;
              })()
            : null,
        winnerId: null,
        winnerName: null,
        playerCount: alivePlayers.length,
        minPlayers: NORMAL_ROOM_MIN_PLAYERS,
        maxPlayers: NORMAL_ROOM_MAX_PLAYERS,
        worldWidth: NORMAL_WORLD_WIDTH,
        worldHeight: NORMAL_WORLD_HEIGHT,
        safeZoneRadius: NORMAL_ROOM_ZONE_RADIUS,
        you: snapshotsByPlayer.get(player.id),
        players: visiblePlayers,
        spectatorTargetId: spectatorTarget?.id || null,
        spectatingPlayer: spectatorTarget
          ? snapshotsByPlayer.get(spectatorTarget.id)
          : null,
        projectiles: room.projectileSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.projectileSpatialIndex,
              VIEW_DISTANCE + 400,
              VISIBLE_PROJECTILE_LIMIT,
            )
          : this.filterNear(
              viewAnchor,
              room.projectiles,
              VIEW_DISTANCE + 400,
              VISIBLE_PROJECTILE_LIMIT,
            ),
        combatEvents: (room.combatEvents || [])
          .filter((event) => {
            const age = now - Number(event?.createdAt || 0);
            if (age < 0 || age >= Number(event?.ttl || 2000)) return false;
            // Strict privacy: this socket receives only combat text whose
            // viewerId is its own player id. Untagged legacy events are never
            // replicated into Normal PvP / Zone PvP client state.
            if (event?.viewerId !== player.id) return false;
            return this.isNear(viewAnchor, event, VIEW_DISTANCE + 800);
          })
          .slice(-32),
      };

      if (includeViewportItems) {
        const orbLimit = room.normalMode
          ? NORMAL_VISIBLE_ORB_LIMIT
          : VISIBLE_ORB_LIMIT;
        const energyLimit = room.normalMode
          ? NORMAL_VISIBLE_ENERGY_LIMIT
          : VISIBLE_ENERGY_LIMIT;

        payload.orbs = room.orbSpatialIndex
          ? this.filterNearIndexed(viewAnchor, room.orbSpatialIndex, VIEW_DISTANCE, orbLimit)
          : this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, orbLimit);
        payload.energyCells = room.energySpatialIndex
          ? this.filterNearIndexed(viewAnchor, room.energySpatialIndex, VIEW_DISTANCE, energyLimit)
          : this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, energyLimit);
        payload.cores = room.coreSpatialIndex
          ? this.filterNearIndexed(viewAnchor, room.coreSpatialIndex, VIEW_DISTANCE + 600, 18)
          : this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 18);
      }

      if (includeStaticState) {
        payload.minimapOrbs = minimapOrbs;
        payload.minimapEnergyCells = minimapEnergyCells;
        payload.minimapCores = minimapCores;
        payload.leaderboard = leaderboard;
      }

      socket.volatile.emit("normal-pvp:state", payload);
    }
  }

  findOrCreateBattleRoyaleOnlineRoom() {
    const joinableRoom = this.selectMostPopulatedJoinableRoom(
      this.battleRoyaleOnlineRooms,
      (room) =>
        (room.status === "waiting" || room.status === "countdown") &&
        room.players.size < BR_ONLINE_ROOM_MAX_PLAYERS,
    );

    if (joinableRoom) return joinableRoom;

    const room = {
      id: `br-online-${crypto.randomUUID()}`,
      status: "waiting",
      players: new Map(),
      orbs: Array.from({ length: MAX_ORBS }, () =>
        this.createOrb(ZONE_START_RADIUS),
      ),
      energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () =>
        this.createEnergyCell(ZONE_START_RADIUS),
      ),
      cores: [],
      pendingCores: [],
      projectiles: [],
      countdownStartedAt: null,
      createdAt: Date.now(),
      emptySince: Date.now(),
      matchStartedAt: null,
      lastCoreWaveAt: Date.now() - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY,
      nextCoreWaveAt: null,
      lastLocalItemAt: 0,
      lastBroadcastAt: 0,
      winnerId: null,
      winnerName: null,
      finishedAt: null,
      collisionCooldowns: new Map(),
      battleRoyaleOnlineMode: true,
    };

    this.battleRoyaleOnlineRooms.set(room.id, room);
    return room;
  }

  getBattleRoyaleOnlineRoomBySocket(socketId) {
    const roomId = this.battleRoyaleOnlineSocketRoom.get(socketId);
    if (!roomId) return null;
    return this.battleRoyaleOnlineRooms.get(roomId) || null;
  }

  removeBattleRoyaleOnlinePlayer(socketId) {
    const roomId = this.battleRoyaleOnlineSocketRoom.get(socketId);
    if (!roomId) return;

    const room = this.battleRoyaleOnlineRooms.get(roomId);
    if (room) {
      room.players.delete(socketId);
      this.server.sockets.sockets.get(socketId)?.leave(roomId);
      this.markRoomEmptyIfNeeded(room);

      if (
        room.players.size < BR_ONLINE_ROOM_MIN_PLAYERS &&
        room.status === "countdown"
      ) {
        room.status = "waiting";
        room.countdownStartedAt = null;
      }
    }

    this.battleRoyaleOnlineSocketRoom.delete(socketId);
  }

  cleanupBattleRoyaleOnlineRoom(room, now) {
    for (const player of room.players.values()) {
      const socketOnline = this.server.sockets.sockets.has(player.id);
      if (!socketOnline || now - player.lastSeenAt > 30000) {
        this.removeBattleRoyaleOnlinePlayer(player.id);
      }
    }

    if (this.shouldDeleteEmptyRoom(room, now)) {
      this.battleRoyaleOnlineRooms.delete(room.id);
      return;
    }

    if (
      room.status === "finished" &&
      room.finishedAt &&
      now - room.finishedAt > 90000
    ) {
      this.battleRoyaleOnlineRooms.delete(room.id);
    }
  }

  getBattleRoyaleOnlineZoneRadius(room) {
    if (!room.matchStartedAt) return ZONE_START_RADIUS;
    const elapsed = Math.max(0, Date.now() - room.matchStartedAt);
    const progress = Math.min(1, elapsed / BR_ONLINE_ZONE_SHRINK_DURATION);
    return ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * progress;
  }

  broadcastBattleRoyaleOnlineRoomState(room, now) {
    const players = [...room.players.values()];
    const alivePlayers = players.filter((player) => player.alive);
    const zoneRadius = this.getBattleRoyaleOnlineZoneRadius(room);

    const leaderboard = players
      .slice()
      .sort(
        (a, b) =>
          (b.kills || 0) - (a.kills || 0) ||
          (b.totalCollected || 0) - (a.totalCollected || 0),
      )
      .slice(0, 8)
      .map((player) => ({
        id: player.id,
        username: player.username,
        kills: player.kills || 0,
        drones: player.drones || 0,
        progress: player.progress || 0,
        nextDroneAt: player.nextDroneAt || DRONE_REQUIREMENTS[0],
        totalCollected: player.totalCollected || 0,
        alive: player.alive,
      }));

    const countdown =
      room.status === "countdown" && room.countdownStartedAt
        ? Math.max(
            1,
            Math.ceil(
              (BR_ONLINE_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) /
                1000,
            ),
          )
        : null;

    const battlePrepareRemainingMs = room.battlePrepareUntil
      ? Math.max(0, room.battlePrepareUntil - now)
      : 0;

    const secondsUntilCoreDrop =
      room.cores.length === 0 && room.nextCoreWaveAt
        ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
        : null;

    const coreDropCountdown =
      secondsUntilCoreDrop &&
      secondsUntilCoreDrop > 0 &&
      secondsUntilCoreDrop <= Math.ceil(CORE_WARNING_DELAY / 1000)
        ? secondsUntilCoreDrop
        : null;

    const minimapOrbs = [...room.orbs]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((_, index) => index % 3 === 0)
      .slice(0, 120);

    const minimapEnergyCells = [...room.energyCells]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((_, index) => index % 2 === 0)
      .slice(0, 60);

    const minimapCores = [...room.cores]
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 12);

    for (const player of players) {
      const socket = this.server.sockets.sockets.get(player.id);
      if (!socket) continue;

      const aliveOthers = players.filter(
        (other) => other.id !== player.id && other.alive !== false,
      );

      // Keep the killer as the locked camera target. Fallback selection is
      // deterministic and only happens when that killer is no longer alive.
      const spectatorTarget =
        player.alive === false
          ? this.getStableSpectatorTarget(room, player)
          : null;

      if (player.alive === false) {
        player.spectatorTargetId = spectatorTarget?.id || null;
      } else {
        player.spectatorTargetId = null;
        player.killedById = null;
      }

      const viewAnchor = spectatorTarget || player;

      const visiblePlayers =
        player.alive === false
          ? this.filterNear(
              viewAnchor,
              aliveOthers,
              VIEW_DISTANCE + 1200,
              BR_ONLINE_VISIBLE_PLAYERS_LIMIT,
            ).map((other) => this.serializePlayer(other))
          : this.filterNear(
              player,
              players.filter((other) => other.id !== player.id),
              VIEW_DISTANCE,
              BR_ONLINE_VISIBLE_PLAYERS_LIMIT,
            ).map((other) => this.serializePlayer(other));

      socket.volatile.emit("battle-royale-online:state", {
        status: room.status,
        countdown,
        coreDropCountdown,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        playerCount: alivePlayers.length,
        minPlayers: BR_ONLINE_ROOM_MIN_PLAYERS,
        maxPlayers: BR_ONLINE_ROOM_MAX_PLAYERS,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        safeZoneRadius: zoneRadius,
        zoneShrinkDuration: BR_ONLINE_ZONE_SHRINK_DURATION,
        matchStartedAt: room.matchStartedAt,
        battlePrepareUntil: room.battlePrepareUntil || null,
        battlePrepareRemainingMs,
        battleBeginFlashUntil: room.battleBeginFlashUntil || null,
        you: this.serializePlayer(player),
        players: visiblePlayers,
        spectatorTargetId: spectatorTarget?.id || null,
        spectatingPlayer: spectatorTarget
          ? this.serializePlayer(spectatorTarget)
          : null,

        orbs: room.orbSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.orbSpatialIndex,
              VIEW_DISTANCE,
              VISIBLE_ORB_LIMIT,
            )
          : this.filterNear(
              viewAnchor,
              room.orbs,
              VIEW_DISTANCE,
              VISIBLE_ORB_LIMIT,
            ),
        energyCells: room.energySpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.energySpatialIndex,
              VIEW_DISTANCE,
              VISIBLE_ENERGY_LIMIT,
            )
          : this.filterNear(
              viewAnchor,
              room.energyCells,
              VIEW_DISTANCE,
              VISIBLE_ENERGY_LIMIT,
            ),
        cores: room.coreSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.coreSpatialIndex,
              VIEW_DISTANCE + 600,
              18,
            )
          : this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 18),
        projectiles: room.projectileSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.projectileSpatialIndex,
              VIEW_DISTANCE + 400,
              VISIBLE_PROJECTILE_LIMIT,
            )
          : this.filterNear(
              viewAnchor,
              room.projectiles,
              VIEW_DISTANCE + 400,
              VISIBLE_PROJECTILE_LIMIT,
            ),

        minimapOrbs,
        minimapEnergyCells,
        minimapCores,

        leaderboard,
      });
    }
  }

  findOrCreateZonePvpRoom() {
    const joinableRoom = this.selectMostPopulatedJoinableRoom(
      this.zonePvpRooms,
      (room) =>
        (room.status === "waiting" || room.status === "countdown") &&
        !room.locked &&
        this.getZoneHumanPlayerCount(room) < ZONE_PVP_ROOM_MAX_PLAYERS,
    );

    if (joinableRoom) return joinableRoom;

    const room = {
      id: `zone-pvp-${crypto.randomUUID()}`,
      status: "waiting",
      locked: false,
      // Informational only. The first player never owns the room lifecycle:
      // after death he becomes a spectator and the round continues.
      initialHumanPlayerId: null,
      // Monotonic version lets the client discard stale volatile countdown packets.
      phaseVersion: 0,
      roundId: null,
      players: new Map(),
      orbs: Array.from({ length: MAX_ORBS }, () =>
        this.createOrb(ZONE_START_RADIUS),
      ),
      energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () =>
        this.createEnergyCell(ZONE_START_RADIUS),
      ),
      cores: [],
      pendingCores: [],
      projectiles: [],
      // Shared with Normal PvP: compact world-space Pixi combat messages.
      combatEvents: [],
      combatEventSequence: 0,
      countdownStartedAt: null,
      createdAt: Date.now(),
      emptySince: Date.now(),
      matchStartedAt: null,
      battlePrepareUntil: null,
      battleBeginFlashUntil: null,
      matchHadMultiplePlayers: false,
      lastCoreWaveAt: 0,
      nextCoreWaveAt: null,
      lastLocalItemAt: 0,
      lastBroadcastAt: 0,
      winnerId: null,
      winnerName: null,
      finishedAt: null,
      collisionCooldowns: new Map(),
      // Bots are created only when the five-second human admission window ends.
      botFilled: false,
      botFillAt: null,
      zoneBotAiVersion: 1,
      zonePvpMode: true,
    };

    this.zonePvpRooms.set(room.id, room);
    return room;
  }

  getZonePvpRoomBySocket(socketId) {
    const roomId = this.zonePvpSocketRoom.get(socketId);
    if (!roomId) return null;
    return this.zonePvpRooms.get(roomId) || null;
  }

  removeZonePvpPlayer(socketId) {
    const roomId = this.zonePvpSocketRoom.get(socketId);
    if (!roomId) return;

    const room = this.zonePvpRooms.get(roomId);
    if (room) {
      room.players.delete(socketId);
      this.server.sockets.sockets.get(socketId)?.leave(roomId);
      this.markRoomEmptyIfNeeded(room);

      // Only a lobby can be returned to waiting. During PLAYING the remaining
      // alive player wins; the room never starts another countdown.
      if (room.status === "countdown" && this.getZoneHumanPlayerCount(room) < ZONE_PVP_ROOM_MIN_PLAYERS) {
        room.status = "waiting";
        room.locked = false;
        room.countdownStartedAt = null;
        room.roundId = null;
        room.phaseVersion = Number(room.phaseVersion || 0) + 1;
        this.broadcastZonePvpRoomState(room, Date.now(), true);
      } else if (room.status === "playing") {
        this.updateZonePvpWinCondition(room, Date.now());
      }
    }

    this.zonePvpSocketRoom.delete(socketId);
  }

  cleanupZonePvpRoom(room, now) {
    for (const player of [...room.players.values()]) {
      if (player?.isBot) continue;
      const socketOnline = this.server.sockets.sockets.has(player.id);
      // A connected human is retained regardless of death, spectator state,
      // backgrounded mobile tab, or lack of recent input. The room is removed
      // only after the last real socket actually leaves/disconnects.
      if (!socketOnline) {
        this.removeZonePvpPlayer(player.id);
      }
    }

    // A bot-only room must never continue simulating after the last real
    // browser leaves. This releases the server loop and allows a fresh lobby.
    if (this.getZoneHumanPlayerCount(room) === 0) {
      this.zonePvpRooms.delete(room.id);
      return;
    }

    if (this.shouldDeleteEmptyRoom(room, now)) {
      this.zonePvpRooms.delete(room.id);
      return;
    }

    if (
      room.status === "finished" &&
      room.finishedAt &&
      now - room.finishedAt > 90000
    ) {
      this.zonePvpRooms.delete(room.id);
    }
  }

  getZonePvpZoneRadius(room) {
    if (!room.matchStartedAt) return ZONE_START_RADIUS;
    const elapsed = Math.max(0, Date.now() - room.matchStartedAt);
    const progress = Math.min(1, elapsed / ZONE_PVP_ZONE_SHRINK_DURATION);
    return ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * progress;
  }

  private serializeZonePvpMovement(player: any) {
    // One decimal is well below a pixel at the game camera scale while making
    // the 60 Hz JSON stream materially smaller on lower-end phones.
    const roundMotion = (value: any) => Math.round(Number(value || 0) * 10) / 10;

    return {
      id: player.id,
      isBot: Boolean(player.isBot),
      x: roundMotion(player.x),
      y: roundMotion(player.y),
      moveX: roundMotion(player.moveX),
      moveY: roundMotion(player.moveY),
      velocityX: roundMotion(player.velocityX),
      velocityY: roundMotion(player.velocityY),
      moveAngle: roundMotion(player.moveAngle),
      isMoving: Boolean(player.isMoving),
      attacking: Boolean(player.input?.attacking),
      shieldActive: Boolean(player.shieldActive),
      alive: player.alive !== false,
    };
  }

  private serializeZonePvpProjectileMovement(projectile: any) {
    const roundMotion = (value: any) => Math.round(Number(value || 0) * 10) / 10;

    return {
      id: projectile.id,
      ownerId: projectile.ownerId,
      x: roundMotion(projectile.x),
      y: roundMotion(projectile.y),
      vx: roundMotion(projectile.vx),
      vy: roundMotion(projectile.vy),
      angle: Number(projectile.angle || 0),
      skin: projectile.skin || "cyan",
      pierceLeft: Number(projectile.pierceLeft || 1),
      shieldBreaker: Boolean(projectile.shieldBreaker),
      piercesShield: Boolean(projectile.piercesShield),
      createdAt: Number(projectile.createdAt || 0),
    };
  }

  private broadcastZonePvpMovement(room: any, now: number) {
    if (!room?.zonePvpMode || room.status !== "playing") return;

    const players = [...room.players.values()];
    const humanViewers = players.filter((player) => !player?.isBot);
    if (!humanViewers.length) return;

    // All viewers receive the same tick sequence. This makes the client-side
    // timestamp buffer deterministic even when one device receives packets late.
    const movementSequence = Number(room.zoneMovementSequence || 0) + 1;
    room.zoneMovementSequence = movementSequence;

    for (const viewer of humanViewers) {
      const socket = this.server.sockets.sockets.get(viewer.id);
      if (!socket) continue;

      const spectatorTarget =
        viewer.alive === false
          ? this.getStableSpectatorTarget(room, viewer)
          : null;
      const viewAnchor = spectatorTarget || viewer;
      const range = viewer.alive === false ? VIEW_DISTANCE + 1500 : VIEW_DISTANCE + 260;
      const projectileRange = range + ZONE_MOVEMENT_STREAM_RANGE_PADDING;

      const movementPlayers = players
        .filter(
          (other) =>
            other.id !== viewer.id &&
            (viewer.alive !== false || other.alive !== false) &&
            this.isNear(viewAnchor, other, range),
        )
        .sort((a, b) => {
          const ax = Number(a.x || 0) - Number(viewAnchor.x || 0);
          const ay = Number(a.y || 0) - Number(viewAnchor.y || 0);
          const bx = Number(b.x || 0) - Number(viewAnchor.x || 0);
          const by = Number(b.y || 0) - Number(viewAnchor.y || 0);
          return ax * ax + ay * ay - (bx * bx + by * by);
        })
        .slice(0, ZONE_PVP_VISIBLE_PLAYERS_LIMIT)
        .map((other) => this.serializeZonePvpMovement(other));

      // Attack drones need the same high-rate transform path as the large
      // drones. Full snapshots are intentionally slower because they contain
      // HUD/loot data; putting projectile transforms here prevents a 30 Hz
      // "slow motion" look on receivers.
      const movementProjectiles = this.filterNear(
        viewAnchor,
        room.projectiles || [],
        projectileRange,
        ZONE_MOVEMENT_STREAM_PROJECTILE_LIMIT,
      ).map((projectile) => this.serializeZonePvpProjectileMovement(projectile));

      // Real-time transforms must never queue behind old transforms. A dropped
      // frame is harmless because the next packet/full snapshot replaces it;
      // a queued old frame is what causes visible surges on weak hardware.
      socket.volatile.compress(false).emit("zone-pvp:movement", {
        serverNow: now,
        sequence: movementSequence,
        roomId: room.id,
        roundId: room.roundId || null,
        phaseVersion: Number(room.phaseVersion || 0),
        status: room.status,
        players: movementPlayers,
        projectiles: movementProjectiles,
      });
    }
  }

  broadcastZonePvpRoomState(room, now, reliable = false) {
    const players = [...room.players.values()];
    const alivePlayers = players.filter((player) => player.alive);
    const zoneRadius = this.getZonePvpZoneRadius(room);
    const zonePvpCountdown =
      room.status === "countdown" && room.countdownStartedAt
        ? Math.max(
            1,
            Math.ceil(
              (ZONE_PVP_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) /
                1000,
            ),
          )
        : null;
    const battlePrepareRemainingMs = room.battlePrepareUntil
      ? Math.max(0, room.battlePrepareUntil - now)
      : 0;

    const includeStaticState =
      !room.lastStaticStateAt ||
      now - room.lastStaticStateAt >= STATIC_STATE_INTERVAL_MS;

    if (includeStaticState) {
      room.lastStaticStateAt = now;
    }

    let leaderboard: any[] = [];
    let minimapOrbs: any[] = [];
    let minimapEnergyCells: any[] = [];
    let minimapCores: any[] = [];

    if (includeStaticState) {
      leaderboard = players
        .slice()
        .sort(
          (a, b) =>
            (b.kills || 0) - (a.kills || 0) ||
            (b.totalCollected || 0) - (a.totalCollected || 0),
        )
        .slice(0, 8)
        .map((player) => ({
          id: player.id,
          isBot: Boolean(player.isBot),
          username: player.username,
          kills: player.kills || 0,
          drones: player.drones || 0,
          progress: player.progress || 0,
          nextDroneAt: player.nextDroneAt || DRONE_REQUIREMENTS[0],
          totalCollected: player.totalCollected || 0,
          alive: player.alive,
        }));
    }

    const secondsUntilCoreDrop =
      room.cores.length === 0 && room.nextCoreWaveAt
        ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
        : null;

    const coreDropCountdown =
      secondsUntilCoreDrop &&
      secondsUntilCoreDrop > 0 &&
      secondsUntilCoreDrop <= Math.ceil(CORE_WARNING_DELAY / 1000)
        ? secondsUntilCoreDrop
        : null;

    if (includeStaticState) {
      minimapOrbs = [...room.orbs]
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter((_, index) => index % 3 === 0)
        .slice(0, 120);

      minimapEnergyCells = [...room.energyCells]
        .sort((a, b) => a.id.localeCompare(b.id))
        .filter((_, index) => index % 2 === 0)
        .slice(0, 60);

      minimapCores = [...room.cores]
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 12);
    }

    const playerIndex = this.buildSpatialIndex(players);

    for (const player of players) {
      const socket = this.server.sockets.sockets.get(player.id);
      if (!socket) continue;

      const aliveOthers = players.filter(
        (other) => other.id !== player.id && other.alive !== false,
      );

      // Keep the killer as the locked camera target. A deterministic fallback
      // is used only after that killer has died or disconnected.
      const spectatorTarget =
        player.alive === false
          ? this.getStableSpectatorTarget(room, player)
          : null;

      if (player.alive === false) {
        player.spectatorTargetId = spectatorTarget?.id || null;
      } else {
        player.spectatorTargetId = null;
        player.killedById = null;
      }

      const viewAnchor = spectatorTarget || player;
      const includeViewportItems =
        !player.lastViewportItemStateAt ||
        now - player.lastViewportItemStateAt >= VIEWPORT_ITEM_STATE_INTERVAL_MS;
      if (includeViewportItems) player.lastViewportItemStateAt = now;

      const playerCandidates = this.querySpatialIndex(
        playerIndex,
        viewAnchor.x,
        viewAnchor.y,
        player.alive === false ? VIEW_DISTANCE + 1200 : VIEW_DISTANCE,
      );

      const visiblePlayers = this.filterNear(
        viewAnchor,
        playerCandidates.filter((other) =>
          other.id !== player.id && (player.alive !== false || other.alive !== false),
        ),
        player.alive === false ? VIEW_DISTANCE + 1200 : VIEW_DISTANCE,
        ZONE_PVP_VISIBLE_PLAYERS_LIMIT,
      ).map((other) => this.serializePlayer(other));

      const payload: any = {
        serverNow: now,
        roomId: room.id,
        roundId: room.roundId || null,
        phaseVersion: Number(room.phaseVersion || 0),
        status: room.status,
        countdown: zonePvpCountdown,
        coreDropCountdown,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        playerCount: alivePlayers.length,
        realPlayerCount: this.getZoneHumanPlayerCount(room),
        botCount: this.getZoneBotCount(room),
        minPlayers: ZONE_PVP_ROOM_MIN_PLAYERS,
        maxPlayers: ZONE_PVP_ROOM_MAX_PLAYERS,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        safeZoneRadius: zoneRadius,
        zoneShrinkDuration: ZONE_PVP_ZONE_SHRINK_DURATION,
        matchStartedAt: room.matchStartedAt,
        battlePrepareUntil: room.battlePrepareUntil || null,
        battlePrepareRemainingMs,
        battleBeginFlashUntil: room.battleBeginFlashUntil || null,
        you: this.serializePlayer(player),
        players: visiblePlayers,
        spectatorTargetId: spectatorTarget?.id || null,
        spectatingPlayer: spectatorTarget
          ? this.serializePlayer(spectatorTarget)
          : null,

        projectiles: room.projectileSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.projectileSpatialIndex,
              VIEW_DISTANCE + 400,
              45,
            )
          : this.filterNear(
              viewAnchor,
              room.projectiles,
              VIEW_DISTANCE + 400,
              45,
            ),
        // Short-lived, nearby text only. Sent outside the React render path;
        // Pixi animates it for the same look as Normal PvP.
        combatEvents: (room.combatEvents || [])
          .filter((event) => {
            const age = now - Number(event?.createdAt || 0);
            if (age < 0 || age >= Number(event?.ttl || 2000)) return false;
            // Strict privacy: this socket receives only combat text whose
            // viewerId is its own player id. Untagged legacy events are never
            // replicated into Normal PvP / Zone PvP client state.
            if (event?.viewerId !== player.id) return false;
            return this.isNear(viewAnchor, event, VIEW_DISTANCE + 800);
          })
          .slice(-32),

      };

      if (includeViewportItems) {
        payload.orbs = room.orbSpatialIndex
          ? this.filterNearIndexed(viewAnchor, room.orbSpatialIndex, VIEW_DISTANCE, 140)
          : this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, 140);
        payload.energyCells = room.energySpatialIndex
          ? this.filterNearIndexed(viewAnchor, room.energySpatialIndex, VIEW_DISTANCE, 30)
          : this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, 30);
        payload.cores = room.coreSpatialIndex
          ? this.filterNearIndexed(viewAnchor, room.coreSpatialIndex, VIEW_DISTANCE + 600, 8)
          : this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 8);
      }

      if (includeStaticState) {
        payload.minimapOrbs = minimapOrbs;
        payload.minimapEnergyCells = minimapEnergyCells;
        payload.minimapCores = minimapCores;
        payload.leaderboard = leaderboard;
      }

      if (reliable) {
        socket.emit("zone-pvp:state", payload);
      } else {
        socket.volatile.emit("zone-pvp:state", payload);
      }
    }
  }

  findOrCreateRoom() {
    const joinableRoom = this.selectMostPopulatedJoinableRoom(
      this.rooms,
      (room) =>
        room.status !== "playing" &&
        room.status !== "finished" &&
        room.players.size < ROOM_MAX_PLAYERS,
    );

    if (joinableRoom) return joinableRoom;

    const room = {
      id: crypto.randomUUID(),
      status: "waiting",
      players: new Map(),
      orbs: Array.from({ length: MAX_ORBS }, () =>
        this.createOrb(ZONE_START_RADIUS),
      ),
      energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () =>
        this.createEnergyCell(ZONE_START_RADIUS),
      ),
      cores: Array.from({ length: CORE_WAVE_SIZE }, () =>
        this.createCore(ZONE_START_RADIUS),
      ),
      projectiles: [],
      countdownStartedAt: null,
      createdAt: Date.now(),
      emptySince: Date.now(),
      matchStartedAt: null,
      lastCoreWaveAt: Date.now() - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY,
      lastLocalItemAt: 0,
      lastBroadcastAt: 0,
      winnerId: null,
      winnerName: null,
      finishedAt: null,
      collisionCooldowns: new Map(),
    };
    this.rooms.set(room.id, room);
    return room;
  }
  getRoomBySocket(socketId) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }
  removePlayer(socketId) {
    const roomId = this.socketRoom.get(socketId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (room) {
      room.players.delete(socketId);
      this.server.sockets.sockets.get(socketId)?.leave(roomId);
      this.markRoomEmptyIfNeeded(room);
      if (room.players.size < ROOM_MIN_PLAYERS && room.status === "countdown") {
        room.status = "waiting";
        room.countdownStartedAt = null;
      }
    }
    this.socketRoom.delete(socketId);
  }
  cleanupRoom(room, now) {
    for (const player of room.players.values()) {
      if (now - player.lastSeenAt > 30000) {
        this.removePlayer(player.id);
      }
    }
    if (this.shouldDeleteEmptyRoom(room, now)) {
      this.rooms.delete(room.id);
      return;
    }
    if (
      room.status === "finished" &&
      room.finishedAt &&
      now - room.finishedAt > 90000
    ) {
      this.rooms.delete(room.id);
    }
  }
  getSafeZoneRadius(room) {
    if (!room.matchStartedAt) return ZONE_START_RADIUS;
    const elapsed = Math.max(0, Date.now() - room.matchStartedAt);
    const progress = Math.min(1, elapsed / ZONE_SHRINK_DURATION);
    return ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * progress;
  }
  getSafeSpawn(room, zoneRadius) {
    const existing = [...room.players.values()];
    if (existing.length === 0) {
      return {
        x: WORLD_WIDTH / 2 - 260,
        y: WORLD_HEIGHT / 2,
      };
    }
    if (existing.length === 1) {
      return {
        x: this.clamp(
          existing[0].x + 520,
          PLAYER_RADIUS,
          WORLD_WIDTH - PLAYER_RADIUS,
        ),
        y: this.clamp(
          existing[0].y + 60,
          PLAYER_RADIUS,
          WORLD_HEIGHT - PLAYER_RADIUS,
        ),
      };
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance =
        Math.sqrt(Math.random()) * Math.max(500, zoneRadius - 1200);
      const x = WORLD_WIDTH / 2 + Math.cos(angle) * distance;
      const y = WORLD_HEIGHT / 2 + Math.sin(angle) * distance;
      let safe = true;
      for (const player of room.players.values()) {
        const dx = player.x - x;
        const dy = player.y - y;
        if (dx * dx + dy * dy < 900 * 900) {
          safe = false;
          break;
        }
      }
      if (safe && this.isInsideSafeZone(x, y, zoneRadius, 800)) {
        return { x, y };
      }
    }
    return {
      x: WORLD_WIDTH / 2 + Math.random() * 500 - 250,
      y: WORLD_HEIGHT / 2 + Math.random() * 500 - 250,
    };
  }
  createOrb(zoneRadius: number, nearX?: number, nearY?: number) {
    const point =
      nearX !== undefined && nearY !== undefined
        ? this.randomSafePointNear(nearX, nearY, zoneRadius, 120, 420, 1500)
        : this.randomSafePoint(zoneRadius, 120);
    return {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }
  createEnergyCell(zoneRadius: number, nearX?: number, nearY?: number) {
    const point =
      nearX !== undefined && nearY !== undefined
        ? this.randomSafePointNear(nearX, nearY, zoneRadius, 120, 280, 1200)
        : this.randomSafePoint(zoneRadius, 120);
    return {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
    };
  }
  createCore(zoneRadius) {
    const point = this.randomSafePoint(zoneRadius, 420);
    return {
      id: crypto.randomUUID(),
      type: CORE_TYPES[Math.floor(Math.random() * CORE_TYPES.length)],
      x: point.x,
      y: point.y,
    };
  }
  ensureLocalItemsAroundPlayers(room, zoneRadius) {
    // Bot-filled Zone matches use a bounded global loot population. Spawning
    // local loot around 57 bots would create thousands of objects and hurts
    // the exact low-end devices this mode needs to support.
    if (room?.zonePvpMode && this.getZoneBotCount(room) > 0) return;
    const alive = this.getAlivePlayers(room);

    // Normal PvP now keeps a small, controlled number of real energy cells
    // in each player's nearby area. Orbs remain random/dense as before.
    // This prevents the "no energy cells anywhere" state on a 14k map while
    // keeping energy much rarer than orbs.
    if (room?.normalMode) {
      for (const player of alive) {
        this.ensureNormalEnergyCellsNearPlayer(room, player);
      }
      return;
    }

    for (const player of alive) {
      const nearbyOrbs = room.orbs.filter((orb) =>
        this.isNear(player, orb, 1800),
      ).length;
      const nearbyEnergy = room.energyCells.filter((cell) =>
        this.isNear(player, cell, 1800),
      ).length;
      const crowdedNormalRoom = Boolean(
        room.normalMode && alive.length >= NORMAL_HIGH_POPULATION_THRESHOLD,
      );
      const orbTargetNearPlayer = room.zonePvpMode
        ? 18
        : crowdedNormalRoom
          ? NORMAL_CROWDED_ORB_TARGET
          : 90;
      const orbAddLimit = room.zonePvpMode
        ? 4
        : crowdedNormalRoom
          ? NORMAL_CROWDED_ORB_ADD_LIMIT
          : 45;
      const orbExtraCap = room.zonePvpMode
        ? 18
        : crowdedNormalRoom
          ? NORMAL_CROWDED_ORB_EXTRA_CAP
          : 90;
      const energyTargetNearPlayer = room.zonePvpMode ? 2 : 4;
      const energyAddLimit = room.zonePvpMode ? 1 : 3;
      const energyExtraCap = room.zonePvpMode ? 2 : 6;

      if (
        nearbyOrbs < orbTargetNearPlayer &&
        room.orbs.length < MAX_ORBS + alive.length * orbExtraCap
      ) {
        const toAdd = Math.min(orbTargetNearPlayer - nearbyOrbs, orbAddLimit);
        for (let i = 0; i < toAdd; i += 1) {
          room.orbs.push(this.createOrb(zoneRadius, player.x, player.y));
        }
      }
      if (
        nearbyEnergy < energyTargetNearPlayer &&
        room.energyCells.length <
          MAX_ENERGY_CELLS + alive.length * energyExtraCap
      ) {
        const toAdd = Math.min(
          energyTargetNearPlayer - nearbyEnergy,
          energyAddLimit,
        );
        for (let i = 0; i < toAdd; i += 1) {
          room.energyCells.push(
            this.createEnergyCell(zoneRadius, player.x, player.y),
          );
        }
      }
    }
    const crowdedNormalRoom = Boolean(
      room.normalMode && alive.length >= NORMAL_HIGH_POPULATION_THRESHOLD,
    );
    const orbExtraCap = room.zonePvpMode
      ? 18
      : crowdedNormalRoom
        ? NORMAL_CROWDED_ORB_EXTRA_CAP
        : 90;
    const energyExtraCap = room.zonePvpMode ? 2 : 6;

    if (room.orbs.length > MAX_ORBS + alive.length * orbExtraCap) {
      room.orbs = room.orbs.slice(-(MAX_ORBS + alive.length * orbExtraCap));
    }
    if (
      room.energyCells.length >
      MAX_ENERGY_CELLS + alive.length * energyExtraCap
    ) {
      room.energyCells = room.energyCells.slice(
        -(MAX_ENERGY_CELLS + alive.length * energyExtraCap),
      );
    }
  }
  randomSafePointNear(
    nearX,
    nearY,
    zoneRadius,
    margin = 120,
    minDistance = 300,
    maxDistance = 1400,
  ) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance =
        minDistance + Math.random() * Math.max(1, maxDistance - minDistance);
      const x = nearX + Math.cos(angle) * distance;
      const y = nearY + Math.sin(angle) * distance;

      const insideWorld =
        x >= PLAYER_RADIUS &&
        x <= WORLD_WIDTH - PLAYER_RADIUS &&
        y >= PLAYER_RADIUS &&
        y <= WORLD_HEIGHT - PLAYER_RADIUS;

      const validPoint =
        zoneRadius >= Math.min(WORLD_WIDTH, WORLD_HEIGHT)
          ? insideWorld
          : this.isInsideSafeZone(x, y, zoneRadius, margin);

      if (validPoint) {
        return {
          x: this.clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
          y: this.clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
      }
    }

    return this.randomSafePoint(zoneRadius, margin);
  }
  randomSafePoint(zoneRadius, margin = 120) {
    if (zoneRadius >= Math.min(WORLD_WIDTH, WORLD_HEIGHT)) {
      return {
        x: this.clamp(
          margin + Math.random() * Math.max(1, WORLD_WIDTH - margin * 2),
          PLAYER_RADIUS,
          WORLD_WIDTH - PLAYER_RADIUS,
        ),
        y: this.clamp(
          margin + Math.random() * Math.max(1, WORLD_HEIGHT - margin * 2),
          PLAYER_RADIUS,
          WORLD_HEIGHT - PLAYER_RADIUS,
        ),
      };
    }

    const safeRadius = Math.max(300, zoneRadius - margin);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * safeRadius;
      const x = WORLD_WIDTH / 2 + Math.cos(angle) * distance;
      const y = WORLD_HEIGHT / 2 + Math.sin(angle) * distance;
      if (this.isInsideSafeZone(x, y, zoneRadius, margin)) {
        return {
          x: this.clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
          y: this.clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
      }
    }
    return {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
    };
  }
  keepInsideSafeZone(x, y, radius, margin = 80, allowOutsideZone = false) {
    // Zone PvP: playerul are voie sa iasa din cerc.
    // Limitam doar la marginile hartii; damage-ul de zona se aplica separat.
    if (allowOutsideZone) {
      return {
        x: this.clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
        y: this.clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
      };
    }

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

  isInsideSafeZone(x, y, radius, margin = 80) {
    const dx = x - WORLD_WIDTH / 2;
    const dy = y - WORLD_HEIGHT / 2;
    return Math.hypot(dx, dy) <= Math.max(120, radius - margin);
  }
  isNear(a, b, distance) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy <= distance * distance;
  }

  getSpatialCellKey(x, y, cellSize = ITEM_SPATIAL_CELL_SIZE) {
    return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
  }

  buildSpatialIndex(items: any[] = [], cellSize = ITEM_SPATIAL_CELL_SIZE) {
    const index = new Map<string, any[]>();
    for (const item of items) {
      if (!item) continue;
      const key = this.getSpatialCellKey(item.x || 0, item.y || 0, cellSize);
      let bucket = index.get(key);
      if (!bucket) {
        bucket = [];
        index.set(key, bucket);
      }
      bucket.push(item);
    }
    return index;
  }

  querySpatialIndex(index, x, y, radius, cellSize = ITEM_SPATIAL_CELL_SIZE) {
    if (!index) return [];
    const minCellX = Math.floor((x - radius) / cellSize);
    const maxCellX = Math.floor((x + radius) / cellSize);
    const minCellY = Math.floor((y - radius) / cellSize);
    const maxCellY = Math.floor((y + radius) / cellSize);
    const result: any[] = [];

    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        const bucket = index.get(`${cellX}:${cellY}`);
        if (bucket) result.push(...bucket);
      }
    }
    return result;
  }

  refreshRoomSpatialIndexes(room, now = Date.now(), forceStatic = false) {
    const staticIndexExpired =
      !room.orbSpatialIndex ||
      !room.energySpatialIndex ||
      !room.coreSpatialIndex ||
      !room.lastStaticSpatialIndexAt ||
      now - room.lastStaticSpatialIndexAt >= STATIC_ITEM_SPATIAL_INDEX_INTERVAL_MS;

    if (forceStatic || room.itemSpatialDirty || staticIndexExpired) {
      room.orbSpatialIndex = this.buildSpatialIndex(room.orbs);
      room.energySpatialIndex = this.buildSpatialIndex(room.energyCells);
      room.coreSpatialIndex = this.buildSpatialIndex(room.cores);
      room.lastStaticSpatialIndexAt = now;
      room.itemSpatialDirty = false;
    }

    // Projectiles move every frame, so only this small index stays per-tick.
    room.projectileSpatialIndex = this.buildSpatialIndex(room.projectiles);
  }

  filterNearIndexed(player, index, distance, limit) {
    return this.filterNear(
      player,
      this.querySpatialIndex(index, player.x || 0, player.y || 0, distance),
      distance,
      limit,
    );
  }

  filterNear(player, items, distance, limit) {
    const distanceSq = distance * distance;
    const nearby: any[] = [];

    // Keep only the closest `limit` entries while scanning. It avoids sorting
    // hundreds/thousands of nearby items for every connected recipient.
    for (const item of items || []) {
      const dx = (item.x || 0) - (player.x || 0);
      const dy = (item.y || 0) - (player.y || 0);
      const distSq = dx * dx + dy * dy;
      if (distSq > distanceSq) continue;

      const entry = { item, distSq };
      let insertAt = nearby.length;
      while (insertAt > 0 && nearby[insertAt - 1].distSq > distSq) {
        insertAt -= 1;
      }

      if (insertAt >= limit && nearby.length >= limit) continue;
      nearby.splice(insertAt, 0, entry);
      if (nearby.length > limit) nearby.pop();
    }

    return nearby.map((entry) => entry.item);
  }
  getAlivePlayers(room) {
    return [...room.players.values()].filter((player) => player.alive);
  }

  sanitizeCoordinate(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return this.clamp(numeric, min, max);
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
