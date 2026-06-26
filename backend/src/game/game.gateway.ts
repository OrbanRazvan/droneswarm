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
const NORMAL_ROOM_ZONE_RADIUS = 100000;
const NORMAL_VISIBLE_PLAYERS_LIMIT = 60;

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
const ZONE_PVP_ROOM_MIN_PLAYERS = 2;
const ZONE_PVP_START_COUNTDOWN_MS = 12000;
const ZONE_PVP_BATTLE_PREPARE_DURATION = 30000;
const ZONE_PVP_ZONE_SHRINK_DURATION = 420000;
const ZONE_PVP_ZONE_DAMAGE = 10;
const ZONE_PVP_ZONE_DAMAGE_INTERVAL = 1000;
const ZONE_PVP_VISIBLE_PLAYERS_LIMIT = 60;

const COLLISION_GRID_CELL_SIZE = 600;

// Network / replication tuning. Simulation remains 60 Hz, but clients receive
// compact snapshots at a rate that scales down in crowded rooms.
const NORMAL_STATE_INTERVAL_MS = 33; // 30 Hz
const NORMAL_STATE_INTERVAL_CROWDED_MS = 50; // 20 Hz at 24+ players
const BATTLE_ROYALE_STATE_INTERVAL_MS = 33;
const BATTLE_ROYALE_STATE_INTERVAL_CROWDED_MS = 50;
const ZONE_STATE_INTERVAL_MS = 33; // 30 Hz
const ZONE_STATE_INTERVAL_CROWDED_MS = 50; // 20 Hz at 24+ players
const STATIC_STATE_INTERVAL_MS = 500; // minimap + leaderboard
const ITEM_SPATIAL_CELL_SIZE = 1000;
const ITEM_ZONE_PRUNE_INTERVAL_MS = 500;
const NORMAL_HIGH_POPULATION_THRESHOLD = 16;
const NORMAL_CROWDED_ORB_TARGET = 24;
const NORMAL_CROWDED_ORB_ADD_LIMIT = 12;
const NORMAL_CROWDED_ORB_EXTRA_CAP = 30;

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
const BODY_COLLISION_COOLDOWN = 220;
const BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE = 5;
const BODY_COLLISION_BOTH_NO_DRONES_DAMAGE = 15;
const BODY_COLLISION_WITH_DRONES_DAMAGE = 5;
const BODY_COLLISION_WITHOUT_DRONES_DAMAGE = 15;
const BODY_COLLISION_LIGHT_PUSH = 6;
const BODY_COLLISION_MEDIUM_PUSH = 9;
const BODY_COLLISION_STRONG_PUSH = 12;
const BODY_COLLISION_PUSH_DECAY = 0.82;
const BODY_COLLISION_PUSH_MIN = 0.04;
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
  @SubscribeMessage("normal-pvp:join")
  handleNormalPvpJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    this.removePlayer(client.id);
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
    };

    room.players.set(client.id, player);
    this.normalSocketRoom.set(client.id, room.id);
    client.join(room.id);

    client.emit("normal-pvp:joined", {
      status: "playing",
      playerId: client.id,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      safeZoneRadius: NORMAL_ROOM_ZONE_RADIUS,
      playerCount: this.getAlivePlayers(room).length,
      minPlayers: NORMAL_ROOM_MIN_PLAYERS,
      maxPlayers: NORMAL_ROOM_MAX_PLAYERS,
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
      WORLD_WIDTH - PLAYER_RADIUS,
    );
    const mouseY = this.sanitizeCoordinate(
      input?.mouseY,
      player.y,
      PLAYER_RADIUS,
      WORLD_HEIGHT - PLAYER_RADIUS,
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
    };

    room.players.set(client.id, player);
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
    this.removePlayer(client.id);
    this.removeNormalPlayer(client.id);
    this.removeBattleRoyaleOnlinePlayer(client.id);
    this.removeZonePvpPlayer(client.id);

    const room = this.findOrCreateZonePvpRoom();
    const zoneRadius = this.getZonePvpZoneRadius(room);
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
    };

    room.players.set(client.id, player);
    this.zonePvpSocketRoom.set(client.id, room.id);
    client.join(room.id);

    if (
      room.players.size >= ZONE_PVP_ROOM_MIN_PLAYERS &&
      room.status === "waiting"
    ) {
      room.status = "countdown";
      room.countdownStartedAt = Date.now();
      room.locked = false;
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
    if (!room || room.status !== "playing" || !player || !player.alive) return;

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
        2,
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

        const broadcastInterval =
          room.players.size >= 24
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
          this.updatePlayers(room, now, zoneRadius, deltaFrames);
          this.applyZonePvpZoneDamage(room, now, zoneRadius);
          this.handleBodyCollisions(room, now, zoneRadius);
          this.collectOrbs(room, zoneRadius);
          this.collectEnergy(room, zoneRadius);
          this.collectCores(room, zoneRadius);
          this.updateProjectiles(room, deltaFrames, now);
          this.maintainWorldItems(room, zoneRadius, now);
          this.updateZonePvpWinCondition(room, now);
        }

        const broadcastInterval =
          room.players.size >= 24
            ? ZONE_STATE_INTERVAL_CROWDED_MS
            : ZONE_STATE_INTERVAL_MS;

        if (
          !room.lastBroadcastAt ||
          now - room.lastBroadcastAt >= broadcastInterval
        ) {
          room.lastBroadcastAt = now;
          this.broadcastZonePvpRoomState(room, now);
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
    if (room.status !== "countdown") return;

    if (room.players.size < ZONE_PVP_ROOM_MIN_PLAYERS) {
      room.status = "waiting";
      room.locked = false;
      room.countdownStartedAt = null;
      return;
    }

    if (now - room.countdownStartedAt >= ZONE_PVP_START_COUNTDOWN_MS) {
      room.status = "playing";
      room.locked = true;
      room.countdownStartedAt = null;
      room.matchStartedAt = now;
      room.battlePrepareUntil = now + ZONE_PVP_BATTLE_PREPARE_DURATION;
      room.battleBeginFlashUntil = room.battlePrepareUntil + 1800;
      room.matchHadMultiplePlayers = true;
      room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY;
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
      const speed = PLAYER_SPEED;
      const rawX = player.x + (dx / length) * speed * deltaFrames;
      const rawY = player.y + (dy / length) * speed * deltaFrames;
      const safe = this.keepInsideSafeZone(
        rawX,
        rawY,
        zoneRadius,
        PLAYER_RADIUS + 18,
        Boolean(room.zonePvpMode),
      );
      player.x = this.clamp(safe.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
      player.y = this.clamp(
        safe.y,
        PLAYER_RADIUS,
        WORLD_HEIGHT - PLAYER_RADIUS,
      );
      this.applyKnockbackStep(player, zoneRadius, room);
      if (dx || dy) {
        player.moveX = dx / length;
        player.moveY = dy / length;
        player.moveAngle = Math.atan2(dy, dx);
        player.isMoving = true;
      } else {
        player.moveX = 0;
        player.moveY = 0;
        player.isMoving = false;
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
  applyKillReward(killer) {
    killer.kills = (killer.kills || 0) + 1;
    killer.killStreak = (killer.killStreak || 0) + 1;
    killer.drones = Math.min(MAX_DRONES, (killer.drones || 0) + 1);
    killer.progress = 0;
    killer.nextDroneAt = this.getNextDroneAt(killer.drones || 0);

    const nextMaxHp = Math.min(
      MAX_HP,
      (killer.maxHp || START_HP) + KILL_HP_REWARD,
    );
    killer.maxHp = nextMaxHp;
    killer.hp = Math.min(nextMaxHp, (killer.hp || START_HP) + KILL_HP_REWARD);
    killer.killAttackSpeedMultiplier = Math.max(
      MIN_KILL_ATTACK_SPEED_MULTIPLIER,
      (killer.killAttackSpeedMultiplier || 1) * KILL_ATTACK_SPEED_MULTIPLIER,
    );

    if (killer.killStreak >= 3) {
      killer.rapidFireUntil = Date.now() + 10000;
      killer.attackCooldownMultiplier = killer.killStreak >= 5 ? 0.5 : 0.65;
    }
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
    player.x = this.clamp(safe.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
    player.y = this.clamp(safe.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
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
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > BODY_COLLISION_DISTANCE) return;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const overlap = BODY_COLLISION_DISTANCE - dist;
    const separation = Math.min(
      7,
      Math.max(BODY_COLLISION_LIGHT_PUSH, overlap * 0.08),
    );
    this.addSmoothKnockback(a, -dirX, -dirY, separation);
    this.addSmoothKnockback(b, dirX, dirY, separation);
    this.applyKnockbackStep(a, zoneRadius, room);
    this.applyKnockbackStep(b, zoneRadius, room);
    if (this.isBattlePrepareLocked(room, now)) return;
    if (now - lastAt < BODY_COLLISION_COOLDOWN) return;
    room.collisionCooldowns.set(key, now);
    const outcome = this.getBodyCollisionOutcome(a, b);
    const aWasAlive = a.alive;
    const bWasAlive = b.alive;
    this.applyBodyCollisionDamage(a, outcome.aHpDamage, outcome.aDroneLoss);
    this.applyBodyCollisionDamage(b, outcome.bHpDamage, outcome.bDroneLoss);
    this.addSmoothKnockback(a, -dirX, -dirY, outcome.push);
    this.addSmoothKnockback(b, dirX, dirY, outcome.push);
    if (aWasAlive && !a.alive && b.alive) this.applyKillReward(b);
    if (bWasAlive && !b.alive && a.alive) this.applyKillReward(a);
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
    const speed =
      PROJECTILE_SPEED +
      (player.projectileSpeedBonus || 0) +
      rapidBonus +
      overclockBonus;
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
        const damageBlocked = target.shieldActive && !projectile.shieldBreaker;
        if (!damageBlocked) {
          target.hp = Math.max(0, target.hp - projectile.damage);
          if (owner && owner.vampireUntil && owner.vampireUntil > now) {
            owner.hp = Math.min(
              owner.maxHp,
              owner.hp + Math.floor(projectile.damage * VAMPIRE_HEAL_RATIO),
            );
          }
          if (target.hp <= 0) {
            target.alive = false;
            target.input = {};
            target.killStreak = 0;
            target.rapidFireUntil = 0;
            target.attackCooldownMultiplier = 1;
            target.shieldActive = false;
            target.shieldUntil = 0;
            target.killedById = owner?.id || null;
            target.spectatorTargetId =
              owner?.alive !== false ? owner?.id || null : null;
            if (owner) {
              this.applyKillReward(owner);
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
        player.alive = false;
        player.input = {};
        player.killStreak = 0;
        player.rapidFireUntil = 0;
        player.attackCooldownMultiplier = 1;
        player.shieldActive = false;
        player.shieldUntil = 0;
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
        player.alive = false;
        player.input = {};
        player.killStreak = 0;
        player.rapidFireUntil = 0;
        player.attackCooldownMultiplier = 1;
        player.shieldActive = false;
        player.shieldUntil = 0;
        player.killedById = null;
        player.spectatorTargetId = null;
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
        player.alive = false;
        player.input = {};
        player.killStreak = 0;
        player.rapidFireUntil = 0;
        player.attackCooldownMultiplier = 1;
        player.shieldActive = false;
        player.shieldUntil = 0;
        player.killedById = null;
        player.spectatorTargetId = null;
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

  collectOrbs(room, zoneRadius) {
    const collectedIds = new Set<string>();

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
        if (!orb?.id || collectedIds.has(orb.id)) continue;

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
    }
  }
  collectEnergy(room, zoneRadius) {
    const collectedIds = new Set<string>();

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
        if (!cell?.id || collectedIds.has(cell.id)) continue;

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
        collected += 1;
        collectedEnergyIds.push(cell.id);
        player.energy = Math.min(100, player.energy + 25);
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
    }
  }

  collectCores(room, zoneRadius) {
    const collectedIds = new Set<string>();

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
        if (!core?.id || collectedIds.has(core.id)) continue;

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

        this.applyCore(player, core);
        collectedIds.add(core.id);
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
  applyCore(player, core) {
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

    while (room.orbs.length < MAX_ORBS) {
      room.orbs.push(this.createOrb(zoneRadius));
    }

    while (room.energyCells.length < MAX_ENERGY_CELLS) {
      room.energyCells.push(this.createEnergyCell(zoneRadius));
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
            this.createCore(zoneRadius),
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

    // Rebuilt once per simulation frame and reused by collection + all
    // recipient-specific snapshots. This removes repeated full scans.
    this.refreshRoomSpatialIndexes(room);
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

  updateZonePvpWinCondition(room, now) {
    if (room.status !== "playing") return;

    const alive = this.getAlivePlayers(room);

    // Camera declara castigator doar dupa ce meciul a pornit valid cu minim 2 jucatori.
    // Daca unul moare, devine spectator sau se deconecteaza, ultimul ramas viu castiga.
    //if (room.matchHadMultiplePlayers && alive.length <= 1) {
    //   const winner = alive[0] || null;
    //   room.status = 'finished';
    //   room.locked = true;
    //   room.winnerId = winner?.id || null;
    //   room.winnerName = winner?.username || null;
    //   room.finishedAt = now;
    //  room.projectiles = [];
    //  for (const player of room.players.values()) {
    //      player.input = {};
    //      player.shieldActive = false;
    //      player.shieldUntil = 0;
    //  }
    // }
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
      skin: player.skin,
      alive: player.alive,
      attacking: Boolean(player.input?.attacking),
      shieldActive: Boolean(player.shieldActive),
      mouseX: player.input?.mouseX || player.x,
      mouseY: player.input?.mouseY || player.y,
      moveX: player.moveX || 0,
      moveY: player.moveY || 0,
      moveAngle: player.moveAngle || 0,
      isMoving: Boolean(player.isMoving),
      knockbackX: player.knockbackX || 0,
      knockbackY: player.knockbackY || 0,
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
    for (const room of this.normalRooms.values()) {
      if (room.status !== "playing") {
        continue;
      }

      if (room.players.size < NORMAL_ROOM_MAX_PLAYERS) {
        return room;
      }
    }

    const room = {
      id: `normal-${crypto.randomUUID()}`,
      status: "playing",
      players: new Map(),
      orbs: Array.from({ length: MAX_ORBS }, () =>
        this.createOrb(NORMAL_ROOM_ZONE_RADIUS),
      ),
      energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () =>
        this.createEnergyCell(NORMAL_ROOM_ZONE_RADIUS),
      ),
      cores: [],
      pendingCores: [],
      projectiles: [],
      countdownStartedAt: null,
      createdAt: Date.now(),
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
    }

    this.normalSocketRoom.delete(socketId);
  }

  cleanupNormalRoom(room, now) {
    for (const player of room.players.values()) {
      const socketOnline = this.server.sockets.sockets.has(player.id);
      if (!socketOnline || now - player.lastSeenAt > 30000) {
        this.removeNormalPlayer(player.id);
      }
    }

    if (room.players.size === 0 && now - room.createdAt > 15000) {
      this.normalRooms.delete(room.id);
    }
  }

  getNormalSpawn(room) {
    const existing = [...room.players.values()];

    if (existing.length === 0) {
      return {
        x: WORLD_WIDTH / 2 - 520,
        y: WORLD_HEIGHT / 2,
      };
    }

    const spawnAreaRadius = 6000;
    const minSpawnDistance = 700;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * spawnAreaRadius;
      const x = WORLD_WIDTH / 2 + Math.cos(angle) * distance;
      const y = WORLD_HEIGHT / 2 + Math.sin(angle) * distance;

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
          x: this.clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
          y: this.clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
      }
    }

    return {
      x: this.clamp(
        WORLD_WIDTH / 2 + (Math.random() - 0.5) * spawnAreaRadius,
        PLAYER_RADIUS,
        WORLD_WIDTH - PLAYER_RADIUS,
      ),
      y: this.clamp(
        WORLD_HEIGHT / 2 + (Math.random() - 0.5) * spawnAreaRadius,
        PLAYER_RADIUS,
        WORLD_HEIGHT - PLAYER_RADIUS,
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
      let spectatorTarget = null;

      if (player.alive === false) {
        spectatorTarget = player.killedById
          ? aliveOtherPlayers.find((other) => other.id === player.killedById) ||
            null
          : null;

        if (!spectatorTarget && player.spectatorTargetId) {
          spectatorTarget =
            aliveOtherPlayers.find(
              (other) => other.id === player.spectatorTargetId,
            ) || null;
        }

        if (!spectatorTarget && aliveOtherPlayers.length > 0) {
          spectatorTarget =
            aliveOtherPlayers[
              Math.floor(Math.random() * aliveOtherPlayers.length)
            ];
        }

        player.spectatorTargetId = spectatorTarget?.id || null;
      } else {
        player.spectatorTargetId = null;
        player.killedById = null;
      }

      const viewAnchor = spectatorTarget || player;
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
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        safeZoneRadius: NORMAL_ROOM_ZONE_RADIUS,
        you: snapshotsByPlayer.get(player.id),
        players: visiblePlayers,
        spectatorTargetId: spectatorTarget?.id || null,
        spectatingPlayer: spectatorTarget
          ? snapshotsByPlayer.get(spectatorTarget.id)
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
      };

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
    for (const room of this.battleRoyaleOnlineRooms.values()) {
      if (
        (room.status === "waiting" || room.status === "countdown") &&
        room.players.size < BR_ONLINE_ROOM_MAX_PLAYERS
      ) {
        return room;
      }
    }

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

    if (room.players.size === 0 && now - room.createdAt > 15000) {
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

      let spectatorTarget = null;
      if (player.alive === false) {
        spectatorTarget = player.killedById
          ? aliveOthers.find((other) => other.id === player.killedById) || null
          : null;

        if (!spectatorTarget && player.spectatorTargetId) {
          spectatorTarget =
            aliveOthers.find(
              (other) => other.id === player.spectatorTargetId,
            ) || null;
        }

        if (!spectatorTarget && aliveOthers.length > 0) {
          spectatorTarget =
            aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
        }

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
    for (const room of this.zonePvpRooms.values()) {
      if (
        (room.status === "waiting" || room.status === "countdown") &&
        !room.locked &&
        room.players.size < ZONE_PVP_ROOM_MAX_PLAYERS
      ) {
        return room;
      }
    }

    const room = {
      id: `zone-pvp-${crypto.randomUUID()}`,
      status: "waiting",
      locked: false,
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
    }

    this.zonePvpSocketRoom.delete(socketId);
  }

  cleanupZonePvpRoom(room, now) {
    for (const player of room.players.values()) {
      const socketOnline = this.server.sockets.sockets.has(player.id);
      if (!socketOnline || now - player.lastSeenAt > 30000) {
        this.removeZonePvpPlayer(player.id);
      }
    }

    if (room.players.size === 0 && now - room.createdAt > 15000) {
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

  broadcastZonePvpRoomState(room, now) {
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

      let spectatorTarget = null;
      if (player.alive === false) {
        spectatorTarget = player.killedById
          ? aliveOthers.find((other) => other.id === player.killedById) || null
          : null;

        if (!spectatorTarget && player.spectatorTargetId) {
          spectatorTarget =
            aliveOthers.find(
              (other) => other.id === player.spectatorTargetId,
            ) || null;
        }

        if (!spectatorTarget && aliveOthers.length > 0) {
          spectatorTarget =
            aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
        }

        player.spectatorTargetId = spectatorTarget?.id || null;
      } else {
        player.spectatorTargetId = null;
        player.killedById = null;
      }

      const viewAnchor = spectatorTarget || player;

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
        status: room.status,
        countdown: zonePvpCountdown,
        coreDropCountdown,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        playerCount: alivePlayers.length,
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

        orbs: room.orbSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.orbSpatialIndex,
              VIEW_DISTANCE,
              140,
            )
          : this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, 140),
        energyCells: room.energySpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.energySpatialIndex,
              VIEW_DISTANCE,
              30,
            )
          : this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, 30),
        cores: room.coreSpatialIndex
          ? this.filterNearIndexed(
              viewAnchor,
              room.coreSpatialIndex,
              VIEW_DISTANCE + 600,
              8,
            )
          : this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 8),
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

      };

      if (includeStaticState) {
        payload.minimapOrbs = minimapOrbs;
        payload.minimapEnergyCells = minimapEnergyCells;
        payload.minimapCores = minimapCores;
        payload.leaderboard = leaderboard;
      }

      socket.volatile.emit("zone-pvp:state", payload);
    }
  }

  findOrCreateRoom() {
    for (const room of this.rooms.values()) {
      if (
        room.status !== "playing" &&
        room.status !== "finished" &&
        room.players.size < ROOM_MAX_PLAYERS
      ) {
        return room;
      }
    }
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
    if (room.players.size === 0 && now - room.createdAt > 15000) {
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
    const alive = this.getAlivePlayers(room);
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

  refreshRoomSpatialIndexes(room) {
    room.orbSpatialIndex = this.buildSpatialIndex(room.orbs);
    room.energySpatialIndex = this.buildSpatialIndex(room.energyCells);
    room.coreSpatialIndex = this.buildSpatialIndex(room.cores);
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
