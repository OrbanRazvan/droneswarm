"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
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
const NORMAL_ORB_BASE_TARGET = 420;
const NORMAL_ORB_PER_ALIVE_PLAYER = 22;
const NORMAL_ORB_MAX_TARGET = 650;
const NORMAL_ORB_DISTRIBUTION_VERSION = 3;
const NORMAL_ORB_GRID_MARGIN = 260;
const NORMAL_ORB_RESPAWN_DELAY_MIN_MS = 2600;
const NORMAL_ORB_RESPAWN_DELAY_MAX_MS = 4200;
const NORMAL_ORB_RESPAWN_RETRY_MS = 900;
const NORMAL_ORB_RESPAWN_SAFE_DISTANCE = 460;
const NORMAL_ENERGY_BASE_TARGET = 80;
const NORMAL_ENERGY_PER_ALIVE_PLAYER = 5;
const NORMAL_ENERGY_MAX_TARGET = 180;
const NORMAL_LOCAL_ENERGY_TARGET = 3;
const NORMAL_LOCAL_ENERGY_ADD_LIMIT = 3;
const NORMAL_LOCAL_ENERGY_RADIUS = 1900;
const NORMAL_LOCAL_ENERGY_MIN_DISTANCE = 360;
const NORMAL_LOCAL_ENERGY_MAX_DISTANCE = 1650;
const NORMAL_VISIBLE_ORB_LIMIT = 160;
const NORMAL_VISIBLE_ENERGY_LIMIT = 60;
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
const ZONE_PVP_ROOM_MAX_PLAYERS = 60;
const ZONE_PVP_ROOM_MIN_PLAYERS = 2;
const ZONE_PVP_START_COUNTDOWN_MS = 5000;
const ZONE_PVP_BATTLE_PREPARE_DURATION = 10000;
const ZONE_PVP_ZONE_SHRINK_DURATION = 420000;
const ZONE_PVP_ZONE_DAMAGE = 10;
const ZONE_PVP_ZONE_DAMAGE_INTERVAL = 1000;
const ZONE_PVP_VISIBLE_PLAYERS_LIMIT = 60;
const ZONE_PVP_BOT_TARGET_TOTAL = ZONE_PVP_ROOM_MAX_PLAYERS;
const ZONE_PVP_BOT_NAMES = ["DarkNova", "SkyHunter", "CyberCore", "NanoByte", "RedPulse"];
const ZONE_PVP_BOT_SKINS = [
    "cyan", "red", "purple", "orange", "green", "pink", "ice-blue", "solar-gold",
    "shadow-black", "toxic-lime", "royal-violet", "crimson-white", "neon-teal",
    "ember-red", "arctic-silver", "void-purple", "plasma-pink", "jade-black",
    "azure-white", "inferno-orange", "midnight-blue", "acid-green", "ruby-black",
    "ghost-white", "cyber-yellow", "deep-ocean", "magenta-cyan", "bronze-steel",
    "electric-indigo", "dark-emerald", "emerald-rift-a", "emerald-rift-b", "emerald-rift-c",
];
const ZONE_PVP_BOT_OPENING_ORB_FARM_MS = 10000;
const ZONE_PVP_BOT_REPLAN_MIN_MS = 180;
const ZONE_PVP_BOT_REPLAN_MAX_MS = 320;
const ZONE_PVP_BOT_ATTACK_RANGE = 1710;
const ZONE_PVP_BOT_GLOBAL_HUNT_RANGE = 11200;
const ZONE_PVP_BOT_SAFE_DISTANCE = 760;
const ZONE_PVP_BOT_THREAT_RADIUS = 2200;
const ZONE_PVP_BOT_ZONE_EDGE_BUFFER = 720;
const ZONE_PVP_BOT_SPAWN_MIN_DISTANCE = 1000;
const COLLISION_GRID_CELL_SIZE = 600;
const NORMAL_STATE_INTERVAL_MS = 33;
const NORMAL_STATE_INTERVAL_SOLO_MS = 33;
const NORMAL_STATE_INTERVAL_CROWDED_MS = 33;
const NORMAL_STATE_INTERVAL_HEAVY_MS = 50;
const BATTLE_ROYALE_STATE_INTERVAL_MS = 33;
const BATTLE_ROYALE_STATE_INTERVAL_CROWDED_MS = 50;
const ZONE_STATE_INTERVAL_MS = 500;
const ZONE_STATE_INTERVAL_CROWDED_MS = 620;
const ZONE_STATE_INTERVAL_HEAVY_MS = 760;
const ZONE_ENTITY_DEFINITION_INTERVAL_MS = 900;
const ZONE_PROJECTILE_DEFINITION_INTERVAL_MS = 800;
const ZONE_TRANSFORM_INTERVAL_MS = 25;
const ZONE_TRANSFORM_PLAYER_LIMIT = 60;
const ZONE_TRANSFORM_PROJECTILE_LIMIT = 36;
const ZONE_TRANSFORM_RANGE_PADDING = 820;
const ZONE_WORLD_DELTA_INTERVAL_MS = 250;
const ZONE_LOOT_TICK_INTERVAL_MS = 50;
const ZONE_COLLISION_TICK_INTERVAL_MS = 34;
const ZONE_ITEM_MAINTENANCE_INTERVAL_MS = 260;
const ZONE_TRANSFORM_PROTOCOL_VERSION = 1;
const ZONE_TRANSFORM_PLAYER_BYTES = 32;
const ZONE_TRANSFORM_PROJECTILE_BYTES = 28;
const STATIC_STATE_INTERVAL_MS = 1400;
const VIEWPORT_ITEM_STATE_INTERVAL_MS = 550;
const PVP_CROWDED_STATE_THRESHOLD = 12;
const PVP_HEAVY_STATE_THRESHOLD = 28;
const ITEM_SPATIAL_CELL_SIZE = 1000;
const ITEM_ZONE_PRUNE_INTERVAL_MS = 500;
const STATIC_ITEM_SPATIAL_INDEX_INTERVAL_MS = 90;
const NORMAL_HIGH_POPULATION_THRESHOLD = 16;
const NORMAL_CROWDED_ORB_TARGET = 24;
const NORMAL_CROWDED_ORB_ADD_LIMIT = 12;
const NORMAL_CROWDED_ORB_EXTRA_CAP = 30;
const SPECTATOR_KILL_CREDIT_WINDOW_MS = 6000;
const EMPTY_ROOM_GRACE_MS = 30000;
const ZONE_PVP_RECONNECT_GRACE_MS = 180000;
const ZONE_PVP_RESUME_TOKEN_MIN_LENGTH = 20;
const ZONE_PVP_RESUME_TOKEN_MAX_LENGTH = 160;
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
const BODY_COLLISION_LIGHT_PUSH = 6;
const BODY_COLLISION_MEDIUM_PUSH = 9;
const BODY_COLLISION_STRONG_PUSH = 12;
const BODY_COLLISION_PUSH_DECAY = 0.95;
const BODY_COLLISION_PUSH_MIN = 0.04;
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
    if (!clean || clean === "basic" || clean === "basic-drone")
        return "cyan";
    return clean;
}
let GameGateway = class GameGateway {
    constructor() {
        this.rooms = new Map();
        this.socketRoom = new Map();
        this.normalRooms = new Map();
        this.normalSocketRoom = new Map();
        this.battleRoyaleOnlineRooms = new Map();
        this.battleRoyaleOnlineSocketRoom = new Map();
        this.zonePvpRooms = new Map();
        this.zonePvpSocketRoom = new Map();
        this.zonePvpResumeSeats = new Map();
        this.zonePvpSocketResumeToken = new Map();
        this.loop = null;
        this.lastLoopAt = Date.now();
    }
    selectMostPopulatedJoinableRoom(rooms, canJoin) {
        let selected = null;
        for (const room of rooms.values()) {
            if (!canJoin(room))
                continue;
            if (!selected ||
                room.players.size > selected.players.size ||
                (room.players.size === selected.players.size &&
                    Number(room.createdAt || 0) < Number(selected.createdAt || 0))) {
                selected = room;
            }
        }
        return selected;
    }
    markRoomOccupied(room) {
        if (room)
            room.emptySince = null;
    }
    markRoomEmptyIfNeeded(room, now = Date.now()) {
        if (room && room.players.size === 0 && !room.emptySince) {
            room.emptySince = now;
        }
    }
    shouldDeleteEmptyRoom(room, now) {
        if (!room || room.players.size !== 0)
            return false;
        const emptySince = Number(room.emptySince || room.createdAt || now);
        if (!room.emptySince)
            room.emptySince = emptySince;
        return now - emptySince >= EMPTY_ROOM_GRACE_MS;
    }
    usesProgressionPvpCombat(room) {
        return Boolean(room?.normalMode || room?.zonePvpMode);
    }
    getZoneHumanPlayers(room) {
        return [...(room?.players?.values?.() || [])].filter((player) => !player?.isBot);
    }
    getZoneHumanPlayerCount(room) {
        return this.getZoneHumanPlayers(room).length;
    }
    getZoneBotCount(room) {
        let count = 0;
        for (const player of room?.players?.values?.() || []) {
            if (player?.isBot)
                count += 1;
        }
        return count;
    }
    ensureZonePvpNetId(room, sourceId) {
        if (!room)
            return 0;
        if (!room.zoneNetIds)
            room.zoneNetIds = new Map();
        if (!room.nextZoneNetId)
            room.nextZoneNetId = 1;
        const key = String(sourceId || "");
        if (!key)
            return 0;
        const existing = room.zoneNetIds.get(key);
        if (existing)
            return existing;
        const next = Number(room.nextZoneNetId++);
        room.zoneNetIds.set(key, next);
        return next;
    }
    serializeZonePvpStatePlayer(room, player) {
        return {
            ...this.serializePlayer(player),
            netId: this.ensureZonePvpNetId(room, player?.id),
            isBot: Boolean(player?.isBot),
        };
    }
    serializeZonePvpStateProjectile(room, projectile) {
        return {
            id: projectile.id,
            netId: this.ensureZonePvpNetId(room, projectile?.id),
            ownerId: projectile.ownerId,
            skin: projectile.skin || "cyan",
            x: Number(projectile.x || 0),
            y: Number(projectile.y || 0),
            vx: Number(projectile.vx || 0),
            vy: Number(projectile.vy || 0),
            angle: Number(projectile.angle || 0),
            damage: Number(projectile.damage || PROJECTILE_DAMAGE),
            pierceLeft: Number(projectile.pierceLeft || 1),
            shieldBreaker: Boolean(projectile.shieldBreaker),
            piercesShield: Boolean(projectile.piercesShield),
            createdAt: Number(projectile.createdAt || 0),
        };
    }
    normalizeZonePvpResumeToken(value) {
        const token = String(value || "").trim();
        if (token.length < ZONE_PVP_RESUME_TOKEN_MIN_LENGTH ||
            token.length > ZONE_PVP_RESUME_TOKEN_MAX_LENGTH ||
            !/^[A-Za-z0-9_-]+$/.test(token)) {
            return null;
        }
        return token;
    }
    rememberZonePvpResumeSeat(room, player, token) {
        if (!room || !player || !token || player?.isBot)
            return;
        player.resumeToken = token;
        this.zonePvpResumeSeats.set(token, {
            roomId: String(room.id),
            playerId: String(player.id),
        });
        this.zonePvpSocketResumeToken.set(String(player.id), token);
    }
    findZonePvpResumeSeat(token) {
        if (!token)
            return null;
        const seat = this.zonePvpResumeSeats.get(token);
        if (!seat)
            return null;
        const room = this.zonePvpRooms.get(seat.roomId);
        const player = room?.players?.get(seat.playerId);
        if (!room || !player || player?.isBot || String(player.resumeToken || "") !== token) {
            this.zonePvpResumeSeats.delete(token);
            return null;
        }
        return { room, player };
    }
    detachZonePvpSocket(socketId, now = Date.now()) {
        const roomId = this.zonePvpSocketRoom.get(socketId);
        if (!roomId)
            return;
        const room = this.zonePvpRooms.get(roomId);
        const player = room?.players?.get(socketId);
        if (player && !player.isBot) {
            player.input = {};
            player.disconnectedAt = now;
            player.lastInputReceivedAt = now - 1000;
        }
        this.zonePvpSocketRoom.delete(socketId);
        this.zonePvpSocketResumeToken.delete(socketId);
    }
    remapZonePvpPlayerReferences(room, previousId, nextId) {
        if (!room || !previousId || !nextId || previousId === nextId)
            return;
        for (const projectile of room.projectiles || []) {
            if (String(projectile?.ownerId || "") === previousId)
                projectile.ownerId = nextId;
        }
        for (const unit of room.players?.values?.() || []) {
            if (String(unit?.killedById || "") === previousId)
                unit.killedById = nextId;
            if (String(unit?.lastDamageById || "") === previousId)
                unit.lastDamageById = nextId;
            if (String(unit?.spectatorTargetId || "") === previousId)
                unit.spectatorTargetId = nextId;
        }
        for (const event of room.combatEvents || []) {
            if (String(event?.viewerId || "") === previousId)
                event.viewerId = nextId;
            if (String(event?.ownerId || "") === previousId)
                event.ownerId = nextId;
        }
        if (room.zoneNetIds instanceof Map) {
            const netId = room.zoneNetIds.get(previousId);
            if (netId) {
                room.zoneNetIds.delete(previousId);
                room.zoneNetIds.set(nextId, netId);
            }
        }
        room.collisionCooldowns?.clear?.();
    }
    rebindZonePvpResumeSeat(room, player, client, token) {
        const previousSocketId = String(player.id);
        const nextSocketId = String(client.id);
        if (previousSocketId !== nextSocketId) {
            room.players.delete(previousSocketId);
            this.zonePvpSocketRoom.delete(previousSocketId);
            this.zonePvpSocketResumeToken.delete(previousSocketId);
            this.remapZonePvpPlayerReferences(room, previousSocketId, nextSocketId);
            player.id = nextSocketId;
            room.players.set(nextSocketId, player);
            const previousSocket = this.server.sockets.sockets.get(previousSocketId);
            if (previousSocket?.connected) {
                previousSocket.leave(room.id);
                previousSocket.disconnect(true);
            }
        }
        const now = Date.now();
        player.disconnectedAt = 0;
        player.lastSeenAt = now;
        player.lastInputReceivedAt = now;
        player.input = {};
        this.zonePvpSocketRoom.set(nextSocketId, room.id);
        this.rememberZonePvpResumeSeat(room, player, token);
        client.join(room.id);
        this.markRoomOccupied(room);
    }
    getZoneBotPower(unit) {
        return (Number(unit?.hp || 0) +
            Number(unit?.drones || 0) * 35 +
            Number(unit?.totalCollected || 0) * 2 +
            Number(unit?.kills || 0) * 18);
    }
    normalizeZoneBotMove(x, y) {
        const length = Math.hypot(Number(x || 0), Number(y || 0));
        if (length < 0.0001)
            return { x: 0, y: 0 };
        return { x: x / length, y: y / length };
    }
    getZoneBotSpawn(room, zoneRadius) {
        const alive = [...(room?.players?.values?.() || [])].filter((unit) => unit?.alive !== false);
        const maxRadius = Math.max(900, Number(zoneRadius || ZONE_START_RADIUS) - 1200);
        for (let attempt = 0; attempt < 220; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * maxRadius;
            const x = WORLD_WIDTH / 2 + Math.cos(angle) * distance;
            const y = WORLD_HEIGHT / 2 + Math.sin(angle) * distance;
            if (!this.isInsideSafeZone(x, y, zoneRadius, 760))
                continue;
            let clear = true;
            for (const other of alive) {
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
    createZonePvpBot(room, index, zoneRadius) {
        const now = Date.now();
        const spawn = this.getZoneBotSpawn(room, zoneRadius);
        const archetypes = ["hunter", "sentinel", "opportunist", "raider"];
        const aiArchetype = archetypes[index % archetypes.length];
        return {
            id: `zone-bot-${room.id}-${index + 1}-${crypto.randomUUID().slice(0, 8)}`,
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
            aiArchetype,
            aiAggression: aiArchetype === "hunter" ? 1.45 : aiArchetype === "raider" ? 1.28 : 1.12,
            aiCourage: aiArchetype === "sentinel" ? 1.02 : 1.2,
            aiSkill: 1.2 + Math.random() * 0.35,
            desiredDroneStock: 1 + Math.floor(Math.random() * 2),
            preferredRange: aiArchetype === "hunter" ? 560 : aiArchetype === "sentinel" ? 780 : 650,
            aiPlanUntil: now + (index % 12) * 18 + Math.floor(Math.random() * 24),
            aiTargetEnemyId: null,
            aiTargetOrbId: null,
            aiTargetEnergyCellId: null,
            aiWanderAngle: Math.random() * Math.PI * 2,
            aiStrafeDir: index % 2 ? 1 : -1,
            aiState: "opening-orb-farm",
        };
    }
    fillZonePvpBots(room, zoneRadius) {
        const target = Math.max(0, Math.min(ZONE_PVP_BOT_TARGET_TOTAL, ZONE_PVP_ROOM_MAX_PLAYERS));
        let nextIndex = this.getZoneBotCount(room);
        while (room.players.size < target) {
            const bot = this.createZonePvpBot(room, nextIndex, zoneRadius);
            room.players.set(bot.id, bot);
            nextIndex += 1;
        }
    }
    findZoneBotNearest(bot, units, maxDistance, predicate = () => true) {
        let best = null;
        let bestDistance = maxDistance;
        for (const unit of units) {
            if (!unit || !predicate(unit))
                continue;
            const distance = Math.hypot(Number(unit.x || 0) - bot.x, Number(unit.y || 0) - bot.y);
            if (distance < bestDistance) {
                best = unit;
                bestDistance = distance;
            }
        }
        return best ? { unit: best, distance: bestDistance } : null;
    }
    updateZonePvpBots(room, now, zoneRadius) {
        if (!room?.zonePvpMode || room.status !== "playing")
            return;
        const everyone = [...room.players.values()];
        const alive = everyone.filter((unit) => unit?.alive !== false);
        const openingFarm = now - Number(room.matchStartedAt || now) < ZONE_PVP_BOT_OPENING_ORB_FARM_MS;
        for (const bot of alive) {
            if (!bot.isBot)
                continue;
            if (now < Number(bot.aiPlanUntil || 0))
                continue;
            const nextPlanMs = ZONE_PVP_BOT_REPLAN_MIN_MS +
                Math.floor(Math.random() * (ZONE_PVP_BOT_REPLAN_MAX_MS - ZONE_PVP_BOT_REPLAN_MIN_MS));
            bot.aiPlanUntil = now + nextPlanMs;
            bot.lastInputReceivedAt = now;
            bot.lastSeenAt = now;
            const centerX = WORLD_WIDTH * 0.5;
            const centerY = WORLD_HEIGHT * 0.5;
            const centerDx = centerX - bot.x;
            const centerDy = centerY - bot.y;
            const centerDistance = Math.hypot(centerDx, centerDy) || 1;
            const zoneEdgeDistance = zoneRadius - centerDistance;
            if (zoneEdgeDistance < ZONE_PVP_BOT_ZONE_EDGE_BUFFER) {
                const move = this.normalizeZoneBotMove(centerDx, centerDy);
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: false,
                    shield: false,
                    mouseX: centerX,
                    mouseY: centerY,
                };
                bot.aiState = "escape-zone";
                continue;
            }
            let targetEnemy = null;
            let targetEnemyDistance = Infinity;
            let targetEnemyScore = Infinity;
            const ownPower = this.getZoneBotPower(bot);
            if (!openingFarm && (bot.drones || 0) > 0) {
                for (const other of alive) {
                    if (other.id === bot.id)
                        continue;
                    const dx = other.x - bot.x;
                    const dy = other.y - bot.y;
                    const distance = Math.hypot(dx, dy);
                    if (distance > ZONE_PVP_BOT_GLOBAL_HUNT_RANGE)
                        continue;
                    const enemyPower = this.getZoneBotPower(other);
                    const weak = Number(other.hp || 0) <= 58 || Number(other.drones || 0) <= 1 || Number(other.energy || 0) <= 18;
                    const advantage = Number(bot.drones || 0) >= Number(other.drones || 0) + 1;
                    const canEngage = weak || advantage || ownPower * Number(bot.aiCourage || 1) >= enemyPower * 0.82;
                    if (!canEngage && distance > ZONE_PVP_BOT_THREAT_RADIUS)
                        continue;
                    const score = distance -
                        (weak ? 720 : 0) -
                        (advantage ? 380 : 0) +
                        Math.max(0, enemyPower - ownPower) * 1.5;
                    if (score < targetEnemyScore) {
                        targetEnemy = other;
                        targetEnemyDistance = distance;
                        targetEnemyScore = score;
                    }
                }
            }
            const lowHp = Number(bot.hp || 0) <= 28;
            const isThreatened = Boolean(targetEnemy &&
                targetEnemyDistance < 680 &&
                this.getZoneBotPower(targetEnemy) > ownPower * 1.35);
            if (targetEnemy && (!lowHp || targetEnemyDistance > 560)) {
                const angle = Math.atan2(targetEnemy.y - bot.y, targetEnemy.x - bot.x);
                const preferredRange = Number(bot.preferredRange || ZONE_PVP_BOT_SAFE_DISTANCE);
                let moveX = 0;
                let moveY = 0;
                if (lowHp || isThreatened) {
                    moveX = Math.cos(angle + Math.PI);
                    moveY = Math.sin(angle + Math.PI);
                }
                else if (targetEnemyDistance > preferredRange + 160) {
                    moveX = Math.cos(angle);
                    moveY = Math.sin(angle);
                }
                else if (targetEnemyDistance < preferredRange - 150) {
                    moveX = Math.cos(angle + Math.PI);
                    moveY = Math.sin(angle + Math.PI);
                }
                else {
                    const strafe = Number(bot.aiStrafeDir || 1);
                    moveX = Math.cos(angle + Math.PI * 0.5 * strafe) * 0.92 + Math.cos(angle) * 0.18;
                    moveY = Math.sin(angle + Math.PI * 0.5 * strafe) * 0.92 + Math.sin(angle) * 0.18;
                    if (Math.random() < 0.18)
                        bot.aiStrafeDir = -strafe;
                }
                const move = this.normalizeZoneBotMove(moveX + (centerDx / centerDistance) * 0.18, moveY + (centerDy / centerDistance) * 0.18);
                const attackRange = Math.min(PROJECTILE_MAX_DISTANCE * 0.95, ZONE_PVP_BOT_ATTACK_RANGE * Number(bot.aiAggression || 1));
                const shouldAttack = !lowHp &&
                    (bot.drones || 0) > 0 &&
                    targetEnemyDistance <= attackRange;
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: shouldAttack,
                    shield: Boolean(isThreatened &&
                        (bot.drones || 0) > 0 &&
                        (bot.energy || 0) >= 20 &&
                        targetEnemyDistance < 520),
                    mouseX: targetEnemy.x,
                    mouseY: targetEnemy.y,
                };
                bot.aiTargetEnemyId = targetEnemy.id;
                bot.aiState = shouldAttack ? "attack-strafe" : lowHp ? "retreat" : "hunt";
                continue;
            }
            const targetEnergy = Number(bot.energy || 0) <= 55
                ? this.findZoneBotNearest(bot, room.energyCells || [], 2600)
                : null;
            const targetCore = !openingFarm
                ? this.findZoneBotNearest(bot, room.cores || [], 3200)
                : null;
            let target = targetEnergy?.unit || targetCore?.unit || null;
            let state = targetEnergy ? "energy" : targetCore ? "core" : "orb";
            if (!target) {
                const stride = openingFarm ? 2 : 4;
                let bestOrb = null;
                let bestScore = Infinity;
                const orbs = room.orbs || [];
                for (let i = 0; i < orbs.length; i += stride) {
                    const orb = orbs[i];
                    if (!orb || !this.isInsideSafeZone(orb.x, orb.y, zoneRadius, ZONE_PVP_BOT_ZONE_EDGE_BUFFER))
                        continue;
                    const distance = Math.hypot(orb.x - bot.x, orb.y - bot.y);
                    if (distance > 4600)
                        continue;
                    const score = distance + (bot.aiTargetOrbId === orb.id ? -180 : 0);
                    if (score < bestScore) {
                        bestOrb = orb;
                        bestScore = score;
                    }
                }
                target = bestOrb;
            }
            if (target) {
                const move = this.normalizeZoneBotMove(target.x - bot.x, target.y - bot.y);
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: false,
                    shield: false,
                    mouseX: target.x,
                    mouseY: target.y,
                };
                bot.aiTargetOrbId = state === "orb" ? target.id : null;
                bot.aiTargetEnergyCellId = state === "energy" ? target.id : null;
                bot.aiState = openingFarm ? "opening-orb-farm" : state;
            }
            else {
                const wander = Number(bot.aiWanderAngle || 0) + (Math.random() - 0.5) * 0.6;
                bot.aiWanderAngle = wander;
                const move = this.normalizeZoneBotMove(Math.cos(wander) + (centerDx / centerDistance) * 0.36, Math.sin(wander) + (centerDy / centerDistance) * 0.36);
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: false,
                    shield: false,
                    mouseX: bot.x + move.x * 300,
                    mouseY: bot.y + move.y * 300,
                };
                bot.aiState = "wander";
            }
            bot.lastInputReceivedAt = now;
            bot.lastSeenAt = now;
        }
    }
    emitZonePvpJoined(client, room, player, reusedRoom = false) {
        const now = Date.now();
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const countdown = room.status === "countdown" && room.countdownStartedAt
            ? Math.max(1, Math.ceil((ZONE_PVP_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) / 1000))
            : null;
        client.emit("zone-pvp:joined", {
            serverNow: now,
            roomId: room.id,
            roundId: room.roundId || null,
            phaseVersion: Number(room.phaseVersion || 0),
            status: room.status,
            countdown,
            playerId: client.id,
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
            safeZoneRadius: zoneRadius,
            zoneShrinkDuration: ZONE_PVP_ZONE_SHRINK_DURATION,
            matchStartedAt: room.matchStartedAt,
            battlePrepareUntil: room.battlePrepareUntil || null,
            battlePrepareRemainingMs: room.battlePrepareUntil ? Math.max(0, room.battlePrepareUntil - now) : 0,
            battleBeginFlashUntil: room.battleBeginFlashUntil || null,
            playerCount: this.getAlivePlayers(room).length,
            realPlayerCount: this.getZoneHumanPlayerCount(room),
            botCount: this.getZoneBotCount(room),
            minPlayers: ZONE_PVP_ROOM_MIN_PLAYERS,
            maxPlayers: ZONE_PVP_ROOM_MAX_PLAYERS,
            you: this.serializeZonePvpStatePlayer(room, player),
            players: this.filterNear(player, [...room.players.values()].filter((other) => other.id !== player.id), VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING, ZONE_TRANSFORM_PLAYER_LIMIT).map((other) => this.serializeZonePvpStatePlayer(room, other)),
            orbs: [],
            minimapOrbs: [],
            minimapEnergyCells: [],
            energyCells: [],
            cores: [],
            projectiles: this.filterNear(player, room.projectiles || [], VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING, ZONE_TRANSFORM_PROJECTILE_LIMIT).map((projectile) => this.serializeZonePvpStateProjectile(room, projectile)),
            leaderboard: [],
            coreDropCountdown: Math.ceil(CORE_WARNING_DELAY / 1000),
        });
        client.emit("zone-pvp:join-confirmed", {
            roomId: room.id,
            roundId: room.roundId || null,
            playerId: client.id,
            serverNow: now,
            reusedRoom,
        });
    }
    getNormalOrbTarget(room) {
        if (!room?.normalMode)
            return MAX_ORBS;
        const aliveCount = this.getAlivePlayers(room).length;
        return this.clamp(NORMAL_ORB_BASE_TARGET + aliveCount * NORMAL_ORB_PER_ALIVE_PLAYER, NORMAL_ORB_BASE_TARGET, NORMAL_ORB_MAX_TARGET);
    }
    getNormalEnergyTarget(room) {
        if (!room?.normalMode)
            return MAX_ENERGY_CELLS;
        const aliveCount = this.getAlivePlayers(room).length;
        return this.clamp(NORMAL_ENERGY_BASE_TARGET + aliveCount * NORMAL_ENERGY_PER_ALIVE_PLAYER, NORMAL_ENERGY_BASE_TARGET, NORMAL_ENERGY_MAX_TARGET);
    }
    getNormalRandomPoint(margin = 120) {
        return {
            x: this.clamp(margin + Math.random() * Math.max(1, NORMAL_WORLD_WIDTH - margin * 2), PLAYER_RADIUS, NORMAL_WORLD_WIDTH - PLAYER_RADIUS),
            y: this.clamp(margin + Math.random() * Math.max(1, NORMAL_WORLD_HEIGHT - margin * 2), PLAYER_RADIUS, NORMAL_WORLD_HEIGHT - PLAYER_RADIUS),
        };
    }
    isPointFarFromPlayers(room, x, y, minDistance = 780) {
        const minDistanceSq = minDistance * minDistance;
        for (const player of room?.players?.values?.() || []) {
            if (!player?.alive)
                continue;
            const dx = Number(player.x || 0) - x;
            const dy = Number(player.y || 0) - y;
            if (dx * dx + dy * dy < minDistanceSq)
                return false;
        }
        return true;
    }
    createNormalDistributedOrb(room) {
        const minOrbDistanceSq = 230 * 230;
        for (let attempt = 0; attempt < 96; attempt += 1) {
            const point = this.getNormalRandomPoint(260);
            if (!this.isPointFarFromPlayers(room, point.x, point.y, 760))
                continue;
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
        const point = this.getNormalRandomPoint(180);
        return {
            id: crypto.randomUUID(),
            x: point.x,
            y: point.y,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
    }
    getNormalOrbGrid(room, target = this.getNormalOrbTarget(room)) {
        const safeTarget = Math.max(1, Math.min(NORMAL_ORB_MAX_TARGET, Math.round(target)));
        const columns = Math.max(1, Math.ceil(Math.sqrt(safeTarget)));
        const rows = Math.max(1, Math.ceil(safeTarget / columns));
        return { target: safeTarget, columns, rows };
    }
    normalOrbJitter(slot, salt) {
        const raw = Math.sin((slot + 1) * 12.9898 + salt * 78.233) * 43758.5453;
        return raw - Math.floor(raw);
    }
    createNormalOrbAtGridSlot(room, _slot, _generation = 0) {
        return this.createNormalDistributedOrb(room);
    }
    rebuildNormalOrbDistribution(room, target = this.getNormalOrbTarget(room)) {
        const safeTarget = Math.max(1, Math.min(NORMAL_ORB_MAX_TARGET, Math.round(target)));
        room.normalOrbGrid = { target: safeTarget, columns: 0, rows: 0 };
        room.normalOrbDistributionVersion = NORMAL_ORB_DISTRIBUTION_VERSION;
        room.normalOrbRespawnAt = new Map();
        room.normalOrbRespawnCollectorId = new Map();
        room.normalOrbRespawnGeneration = new Map();
        room.orbs = [];
        for (let index = 0; index < safeTarget; index += 1) {
            room.orbs.push(this.createNormalDistributedOrb(room));
        }
        room.itemSpatialDirty = true;
    }
    ensureNormalOrbRespawnMaps(room) {
        if (!(room?.normalOrbRespawnAt instanceof Map)) {
            room.normalOrbRespawnAt = new Map();
        }
        if (!(room?.normalOrbRespawnCollectorId instanceof Map)) {
            room.normalOrbRespawnCollectorId = new Map();
        }
        if (!(room?.normalOrbRespawnGeneration instanceof Map)) {
            room.normalOrbRespawnGeneration = new Map();
        }
    }
    scheduleNormalOrbRespawn(room, orb, collector, now = Date.now()) {
        if (!room?.normalMode || !Number.isInteger(orb?.normalOrbSlot))
            return;
        this.ensureNormalOrbRespawnMaps(room);
        const slot = Number(orb.normalOrbSlot);
        const delayRange = NORMAL_ORB_RESPAWN_DELAY_MAX_MS - NORMAL_ORB_RESPAWN_DELAY_MIN_MS;
        const deterministicDelay = Math.floor(this.normalOrbJitter(slot + Number(orb.normalOrbGeneration || 0), now % 97) *
            Math.max(1, delayRange));
        room.normalOrbRespawnAt.set(slot, now + NORMAL_ORB_RESPAWN_DELAY_MIN_MS + deterministicDelay);
        room.normalOrbRespawnCollectorId.set(slot, String(collector?.id || ""));
    }
    ensureNormalOrbDistribution(room, _now = Date.now()) {
        if (!room?.normalMode)
            return;
        const target = this.getNormalOrbTarget(room);
        const requiresReset = room.normalOrbDistributionVersion !== NORMAL_ORB_DISTRIBUTION_VERSION ||
            !Array.isArray(room.orbs) ||
            room.orbs.length > target;
        if (requiresReset) {
            this.rebuildNormalOrbDistribution(room, target);
            return;
        }
        while (room.orbs.length < target) {
            room.orbs.push(this.createNormalDistributedOrb(room));
            room.itemSpatialDirty = true;
        }
    }
    createNormalOrb(room) {
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
    createNormalEnergyCell() {
        const point = this.getNormalRandomPoint(160);
        return { id: crypto.randomUUID(), x: point.x, y: point.y };
    }
    createNormalEnergyCellNear(nearX, nearY) {
        for (let attempt = 0; attempt < 100; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = NORMAL_LOCAL_ENERGY_MIN_DISTANCE +
                Math.random() *
                    (NORMAL_LOCAL_ENERGY_MAX_DISTANCE - NORMAL_LOCAL_ENERGY_MIN_DISTANCE);
            const x = nearX + Math.cos(angle) * distance;
            const y = nearY + Math.sin(angle) * distance;
            if (x >= PLAYER_RADIUS &&
                x <= NORMAL_WORLD_WIDTH - PLAYER_RADIUS &&
                y >= PLAYER_RADIUS &&
                y <= NORMAL_WORLD_HEIGHT - PLAYER_RADIUS) {
                return { id: crypto.randomUUID(), x, y };
            }
        }
        return this.createNormalEnergyCell();
    }
    ensureNormalEnergyCellsNearPlayer(room, player) {
        if (!room?.normalMode || !player?.alive)
            return 0;
        const nearbyEnergy = room.energyCells.filter((cell) => this.isNear(player, cell, NORMAL_LOCAL_ENERGY_RADIUS)).length;
        const missing = Math.max(0, NORMAL_LOCAL_ENERGY_TARGET - nearbyEnergy);
        const toAdd = Math.min(missing, NORMAL_LOCAL_ENERGY_ADD_LIMIT);
        for (let index = 0; index < toAdd; index += 1) {
            room.energyCells.push(this.createNormalEnergyCellNear(player.x, player.y));
        }
        if (toAdd > 0)
            room.itemSpatialDirty = true;
        return toAdd;
    }
    createNormalCore() {
        const point = this.getNormalRandomPoint(420);
        return {
            id: crypto.randomUUID(),
            type: CORE_TYPES[Math.floor(Math.random() * CORE_TYPES.length)],
            x: point.x,
            y: point.y,
        };
    }
    pushCombatEvent(room, unit, text, kind, now = Date.now()) {
        if (!this.usesProgressionPvpCombat(room) || !unit || !text)
            return;
        if (!Array.isArray(room.combatEvents))
            room.combatEvents = [];
        const sequence = Number(room.combatEventSequence || 0) + 1;
        room.combatEventSequence = sequence;
        const event = {
            id: `combat-${sequence}-${crypto.randomUUID()}`,
            x: Math.round(Number(unit.x || 0)),
            y: Math.round(Number(unit.y || 0)),
            text: String(text).slice(0, 42),
            kind,
            viewerId: String(unit.id),
            side: sequence % 2 === 0 ? 1 : -1,
            lane: sequence % 3,
            createdAt: now,
            ttl: 2000,
        };
        room.combatEvents.push(event);
        const privateEventName = room?.normalMode
            ? "normal-pvp:combat"
            : room?.zonePvpMode
                ? "zone-pvp:combat"
                : null;
        if (privateEventName) {
            this.server?.to(String(unit.id)).emit(privateEventName, event);
        }
        if (room.combatEvents.length > 96) {
            room.combatEvents.splice(0, room.combatEvents.length - 96);
        }
    }
    cleanupCombatEvents(room, now = Date.now()) {
        if (!this.usesProgressionPvpCombat(room) || !Array.isArray(room.combatEvents))
            return;
        room.combatEvents = room.combatEvents.filter((event) => now - Number(event?.createdAt || 0) <
            Number(event?.ttl || 2000));
    }
    afterInit() {
        this.startLoop();
    }
    handleDisconnect(client) {
        this.removePlayer(client.id);
        this.removeNormalPlayer(client.id);
        this.removeBattleRoyaleOnlinePlayer(client.id);
        this.detachZonePvpSocket(client.id);
    }
    handlePvpJoin(client, data) {
        this.removePlayer(client.id);
        const room = this.findOrCreateRoom();
        const zoneRadius = this.getSafeZoneRadius(room);
        const spawn = this.getSafeSpawn(room, zoneRadius);
        const player = {
            id: client.id,
            userId: data?.isGuest ? null : data?.userId,
            isGuest: Boolean(data?.isGuest),
            username: String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18),
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
    handlePvpLeave(client) {
        this.removePlayer(client.id);
    }
    handlePvpInput(client, input) {
        const room = this.getRoomBySocket(client.id);
        const player = room?.players.get(client.id);
        if (!player || !player.alive)
            return;
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
    emitNormalPvpJoined(client, room, player) {
        const orbLimit = NORMAL_VISIBLE_ORB_LIMIT;
        const energyLimit = NORMAL_VISIBLE_ENERGY_LIMIT;
        const viewRadius = VIEW_DISTANCE;
        if (this.ensureNormalEnergyCellsNearPlayer(room, player) > 0) {
            this.refreshRoomSpatialIndexes(room);
        }
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
    handleNormalPvpJoin(client, data) {
        this.removePlayer(client.id);
        this.removeBattleRoyaleOnlinePlayer(client.id);
        this.removeZonePvpPlayer(client.id);
        const existingRoom = this.getNormalRoomBySocket(client.id);
        const existingPlayer = existingRoom?.players.get(client.id);
        if (existingRoom && existingPlayer) {
            existingPlayer.userId = data?.isGuest ? null : data?.userId;
            existingPlayer.isGuest = Boolean(data?.isGuest);
            existingPlayer.username = String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18);
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
            username: String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18),
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
    handleNormalPvpLeave(client) {
        this.removeNormalPlayer(client.id);
    }
    handleNormalPvpInput(client, input) {
        const room = this.getNormalRoomBySocket(client.id);
        const player = room?.players.get(client.id);
        if (!player || !player.alive)
            return;
        const seq = Number(input?.seq || 0);
        const safeSeq = Number.isFinite(seq) ? seq : 0;
        if (safeSeq > 0 && safeSeq <= (player.lastReceivedInputSeq || 0))
            return;
        const now = Date.now();
        const mouseX = this.sanitizeCoordinate(input?.mouseX, player.x, PLAYER_RADIUS, NORMAL_WORLD_WIDTH - PLAYER_RADIUS);
        const mouseY = this.sanitizeCoordinate(input?.mouseY, player.y, PLAYER_RADIUS, NORMAL_WORLD_HEIGHT - PLAYER_RADIUS);
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
    handleBattleRoyaleOnlineJoin(client, data) {
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
            username: String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18),
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
        if (room.players.size >= BR_ONLINE_ROOM_MIN_PLAYERS &&
            room.status === "waiting") {
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
    handleBattleRoyaleOnlineLeave(client) {
        this.removeBattleRoyaleOnlinePlayer(client.id);
    }
    handleBattleRoyaleOnlineInput(client, input) {
        const room = this.getBattleRoyaleOnlineRoomBySocket(client.id);
        const player = room?.players.get(client.id);
        if (!player || !player.alive)
            return;
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
    handleZonePvpJoin(client, data) {
        const now = Date.now();
        const resumeToken = this.normalizeZonePvpResumeToken(data?.resumeToken);
        const resumeSeat = this.findZonePvpResumeSeat(resumeToken);
        if (resumeSeat && resumeToken) {
            const { room, player } = resumeSeat;
            if (room.status !== "finished") {
                this.rebindZonePvpResumeSeat(room, player, client, resumeToken);
                player.userId = data?.isGuest ? null : data?.userId;
                player.isGuest = Boolean(data?.isGuest);
                player.username = String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18);
                player.skin = normalizeSkin(data?.isGuest ? "cyan" : data?.skin);
                this.emitZonePvpJoined(client, room, player, true);
                this.broadcastZonePvpRoomState(room, now, true);
                return;
            }
        }
        const requestedResumeRoomId = String(data?.resumeRoomId || data?.roomId || "").trim();
        const requestedResumePlayerId = String(data?.resumePlayerId || data?.playerId || "").trim();
        const strictResume = Boolean(data?.resumeOnly && requestedResumeRoomId && requestedResumePlayerId);
        if (strictResume) {
            client.emit("zone-pvp:resume-missing", {
                roomId: requestedResumeRoomId,
                playerId: requestedResumePlayerId,
                serverNow: now,
            });
            return;
        }
        const existingZoneRoom = this.getZonePvpRoomBySocket(client.id);
        const existingZonePlayer = existingZoneRoom?.players.get(client.id);
        if (existingZoneRoom && existingZonePlayer) {
            existingZonePlayer.userId = data?.isGuest ? null : data?.userId;
            existingZonePlayer.isGuest = Boolean(data?.isGuest);
            existingZonePlayer.username = String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18);
            existingZonePlayer.skin = normalizeSkin(data?.isGuest ? "cyan" : data?.skin);
            existingZonePlayer.disconnectedAt = 0;
            existingZonePlayer.lastSeenAt = now;
            existingZonePlayer.lastInputReceivedAt = now;
            if (resumeToken)
                this.rememberZonePvpResumeSeat(existingZoneRoom, existingZonePlayer, resumeToken);
            this.markRoomOccupied(existingZoneRoom);
            client.join(existingZoneRoom.id);
            this.emitZonePvpJoined(client, existingZoneRoom, existingZonePlayer, true);
            this.broadcastZonePvpRoomState(existingZoneRoom, now, true);
            return;
        }
        this.removePlayer(client.id);
        this.removeNormalPlayer(client.id);
        this.removeBattleRoyaleOnlinePlayer(client.id);
        this.removeZonePvpPlayer(client.id);
        const room = this.findOrCreateZonePvpRoom();
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const spawn = this.getSafeSpawn(room, zoneRadius);
        const player = {
            id: client.id,
            isBot: false,
            userId: data?.isGuest ? null : data?.userId,
            isGuest: Boolean(data?.isGuest),
            username: String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18),
            skin: normalizeSkin(data?.isGuest ? "cyan" : data?.skin),
            x: spawn.x,
            y: spawn.y,
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
            disconnectedAt: 0,
        };
        room.players.set(client.id, player);
        this.markRoomOccupied(room);
        this.zonePvpSocketRoom.set(client.id, room.id);
        if (resumeToken)
            this.rememberZonePvpResumeSeat(room, player, resumeToken);
        client.join(room.id);
        if (this.getZoneHumanPlayerCount(room) >= ZONE_PVP_ROOM_MIN_PLAYERS &&
            room.status === "waiting") {
            room.status = "countdown";
            room.countdownStartedAt = now;
            room.locked = false;
            room.roundId = `zone-round-${crypto.randomUUID()}`;
            room.phaseVersion = Number(room.phaseVersion || 0) + 1;
        }
        this.emitZonePvpJoined(client, room, player, false);
        this.broadcastZonePvpRoomState(room, now, true);
    }
    handleZonePvpResync(client, data) {
        this.handleZonePvpJoin(client, {
            ...(data || {}),
            resumeOnly: Boolean(data?.resumeOnly),
            resumeRoomId: data?.resumeRoomId || data?.roomId || null,
            resumePlayerId: data?.resumePlayerId || data?.playerId || null,
        });
        return { ok: true, serverNow: Date.now() };
    }
    handleZonePvpLeave(client) {
        const roomId = this.zonePvpSocketRoom.get(client.id) || null;
        this.removeZonePvpPlayer(client.id);
        client.emit("zone-pvp:left", {
            roomId,
            playerId: client.id,
            serverNow: Date.now(),
        });
    }
    handleZonePvpInput(client, input) {
        const room = this.getZonePvpRoomBySocket(client.id);
        const player = room?.players.get(client.id);
        if (!room || !player || !player.alive)
            return;
        const heartbeatNow = Date.now();
        player.lastSeenAt = heartbeatNow;
        player.lastInputReceivedAt = heartbeatNow;
        if (room.status !== "playing")
            return;
        const seq = Number(input?.seq || 0);
        const safeSeq = Number.isFinite(seq) ? seq : 0;
        if (safeSeq > 0 && safeSeq <= (player.lastReceivedInputSeq || 0))
            return;
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
            mouseX: this.sanitizeCoordinate(input?.mouseX, player.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
            mouseY: this.sanitizeCoordinate(input?.mouseY, player.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
        player.lastReceivedInputSeq = safeSeq;
        player.pendingInputSeq = safeSeq;
        player.lastInputReceivedAt = now;
        player.lastSeenAt = now;
    }
    handleZonePvpInputStop(client, payload) {
        const room = this.getZonePvpRoomBySocket(client.id);
        const player = room?.players.get(client.id);
        if (!room || !player || player.isBot)
            return;
        const now = Date.now();
        player.input = {};
        player.lastSeenAt = now;
        player.lastInputReceivedAt = now;
        const seq = Number(payload?.seq || 0);
        if (Number.isFinite(seq) && seq > 0) {
            player.lastReceivedInputSeq = Math.max(Number(player.lastReceivedInputSeq || 0), seq);
            player.lastProcessedInputSeq = Math.max(Number(player.lastProcessedInputSeq || 0), seq);
        }
    }
    startLoop() {
        if (this.loop)
            return;
        this.loop = setInterval(() => {
            const now = Date.now();
            const deltaFrames = Math.min(3, Math.max(0.35, (now - this.lastLoopAt) / (1000 / 60)));
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
                const broadcastInterval = room.players.size <= 1
                    ? NORMAL_STATE_INTERVAL_SOLO_MS
                    : room.players.size >= PVP_HEAVY_STATE_THRESHOLD
                        ? NORMAL_STATE_INTERVAL_HEAVY_MS
                        : room.players.size >= PVP_CROWDED_STATE_THRESHOLD
                            ? NORMAL_STATE_INTERVAL_CROWDED_MS
                            : NORMAL_STATE_INTERVAL_MS;
                if (!room.lastBroadcastAt ||
                    now - room.lastBroadcastAt >= broadcastInterval) {
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
                const broadcastInterval = room.players.size >= 24
                    ? BATTLE_ROYALE_STATE_INTERVAL_CROWDED_MS
                    : BATTLE_ROYALE_STATE_INTERVAL_MS;
                if (!room.lastBroadcastAt ||
                    now - room.lastBroadcastAt >= broadcastInterval) {
                    room.lastBroadcastAt = now;
                    this.broadcastBattleRoyaleOnlineRoomState(room, now);
                }
                this.cleanupBattleRoyaleOnlineRoom(room, now);
            }
            for (const room of this.zonePvpRooms.values()) {
                this.updateZonePvpRoomStatus(room, now);
                if (room.status === "playing") {
                    const zoneRadius = this.getZonePvpZoneRadius(room);
                    this.updateZonePvpBots(room, now, zoneRadius);
                    this.updatePlayers(room, now, zoneRadius, deltaFrames);
                    this.applyZonePvpZoneDamage(room, now, zoneRadius);
                    this.updateProjectiles(room, deltaFrames, now);
                    if (!room.lastZoneCollisionAt || now - room.lastZoneCollisionAt >= ZONE_COLLISION_TICK_INTERVAL_MS) {
                        room.lastZoneCollisionAt = now;
                        this.handleBodyCollisions(room, now, zoneRadius);
                    }
                    if (!room.lastZoneLootAt || now - room.lastZoneLootAt >= ZONE_LOOT_TICK_INTERVAL_MS) {
                        room.lastZoneLootAt = now;
                        this.collectOrbs(room, zoneRadius);
                        this.collectEnergy(room, zoneRadius);
                        this.collectCores(room, zoneRadius);
                    }
                    if (!room.lastZoneItemMaintenanceAt || now - room.lastZoneItemMaintenanceAt >= ZONE_ITEM_MAINTENANCE_INTERVAL_MS) {
                        room.lastZoneItemMaintenanceAt = now;
                        this.maintainWorldItems(room, zoneRadius, now);
                        this.cleanupCombatEvents(room, now);
                    }
                    this.updateZonePvpWinCondition(room, now);
                }
                const broadcastInterval = room.players.size >= PVP_HEAVY_STATE_THRESHOLD
                    ? ZONE_STATE_INTERVAL_HEAVY_MS
                    : room.players.size >= PVP_CROWDED_STATE_THRESHOLD
                        ? ZONE_STATE_INTERVAL_CROWDED_MS
                        : ZONE_STATE_INTERVAL_MS;
                if (!room.lastBroadcastAt ||
                    now - room.lastBroadcastAt >= broadcastInterval) {
                    room.lastBroadcastAt = now;
                    this.broadcastZonePvpRoomState(room, now);
                }
                if (room.status === "playing") {
                    if (!room.lastTransformBroadcastAt ||
                        now - room.lastTransformBroadcastAt >= ZONE_TRANSFORM_INTERVAL_MS) {
                        room.lastTransformBroadcastAt = now;
                        this.broadcastZonePvpTransforms(room, now);
                    }
                }
                this.flushZonePvpWorldDelta(room, now);
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
        if (room.roundStarted || room.status === "playing" || room.status === "finished")
            return;
        if (room.status !== "countdown")
            return;
        if (this.getZoneHumanPlayerCount(room) < ZONE_PVP_ROOM_MIN_PLAYERS) {
            room.status = "waiting";
            room.locked = false;
            room.countdownStartedAt = null;
            room.roundId = null;
            room.phaseVersion = Number(room.phaseVersion || 0) + 1;
            this.broadcastZonePvpRoomState(room, now, true);
            return;
        }
        if (now - room.countdownStartedAt >= ZONE_PVP_START_COUNTDOWN_MS) {
            const zoneRadius = this.getZonePvpZoneRadius(room);
            this.fillZonePvpBots(room, zoneRadius);
            room.status = "playing";
            room.roundStarted = true;
            room.locked = true;
            room.countdownStartedAt = null;
            room.matchStartedAt = now;
            room.battlePrepareUntil = now + ZONE_PVP_BATTLE_PREPARE_DURATION;
            room.battleBeginFlashUntil = room.battlePrepareUntil + 1800;
            room.matchHadMultiplePlayers = true;
            room.phaseVersion = Number(room.phaseVersion || 0) + 1;
            room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY;
            this.broadcastZonePvpRoomState(room, now, true);
        }
    }
    isBattlePrepareLocked(room, now = Date.now()) {
        return Boolean(room?.zonePvpMode &&
            room?.battlePrepareUntil &&
            now < room.battlePrepareUntil);
    }
    updatePlayers(room, now, zoneRadius, deltaFrames = 1) {
        const battleLocked = this.isBattlePrepareLocked(room, now);
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            let dx = 0;
            let dy = 0;
            const input = player.input || {};
            const inputFresh = player.isBot || !player.lastInputReceivedAt || now - player.lastInputReceivedAt <= 280;
            if (!inputFresh) {
                player.input = {};
            }
            const activeInput = inputFresh ? input : {};
            if (activeInput.w)
                dy -= 1;
            if (activeInput.s)
                dy += 1;
            if (activeInput.a)
                dx -= 1;
            if (activeInput.d)
                dx += 1;
            if (activeInput.mobileMove) {
                dx += Number(activeInput.moveX || 0);
                dy += Number(activeInput.moveY || 0);
            }
            const isMovingInput = dx !== 0 || dy !== 0;
            if (isMovingInput &&
                now - player.lastEnergyDrainAt >= ENERGY_DRAIN_INTERVAL) {
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
            player.shieldActive = Boolean(player.shieldUntil && player.shieldUntil > now);
            if (!battleLocked &&
                activeInput.shield &&
                (player.drones || 0) > 0 &&
                player.energy >= 20 &&
                !player.shieldActive &&
                now - player.lastShieldAt > 600) {
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
            const progressionMoveMultiplier = this.usesProgressionPvpCombat(room)
                ? NORMAL_BASE_MOVE_SPEED_MULTIPLIER *
                    Math.max(1, Number(player.moveSpeedMultiplier || 1))
                : 1;
            const speed = PLAYER_SPEED * progressionMoveMultiplier;
            const rawX = player.x + (dx / length) * speed * deltaFrames;
            const rawY = player.y + (dy / length) * speed * deltaFrames;
            const safe = this.keepInsideSafeZone(rawX, rawY, zoneRadius, PLAYER_RADIUS + 18, Boolean(room.zonePvpMode));
            const movementWorldWidth = room?.normalMode
                ? NORMAL_WORLD_WIDTH
                : WORLD_WIDTH;
            const movementWorldHeight = room?.normalMode
                ? NORMAL_WORLD_HEIGHT
                : WORLD_HEIGHT;
            player.x = this.clamp(safe.x, PLAYER_RADIUS, movementWorldWidth - PLAYER_RADIUS);
            player.y = this.clamp(safe.y, PLAYER_RADIUS, movementWorldHeight - PLAYER_RADIUS);
            this.applyKnockbackStep(player, zoneRadius, room);
            if (dx || dy) {
                player.moveX = dx / length;
                player.moveY = dy / length;
                player.moveAngle = Math.atan2(dy, dx);
                player.isMoving = true;
                player.velocityX = player.moveX * speed * 60;
                player.velocityY = player.moveY * speed * 60;
            }
            else {
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
                player.lastProcessedInputSeq = Math.max(player.lastProcessedInputSeq || 0, Number(input.seq || 0));
            }
        }
    }
    getNextDroneAt(currentDrones = 0) {
        const index = Math.max(0, Math.min(currentDrones, DRONE_REQUIREMENTS.length - 1));
        return DRONE_REQUIREMENTS[index];
    }
    resetDroneProgress(player) {
        player.progress = 0;
        player.nextDroneAt = this.getNextDroneAt(player.drones || 0);
    }
    applyKillReward(killer, room = null, now = Date.now()) {
        if (!killer)
            return;
        const previousDrones = Number(killer.drones || 0);
        const previousHp = Number(killer.hp || START_HP);
        const previousMoveSpeed = Number(killer.moveSpeedMultiplier || 1);
        const previousAttackDroneSpeed = Number(killer.attackDroneSpeedMultiplier || 1);
        killer.kills = (killer.kills || 0) + 1;
        killer.killStreak = (killer.killStreak || 0) + 1;
        killer.drones = Math.min(MAX_DRONES, previousDrones + 1);
        killer.progress = 0;
        killer.nextDroneAt = this.getNextDroneAt(killer.drones || 0);
        const nextMaxHp = Math.min(MAX_HP, (killer.maxHp || START_HP) + KILL_HP_REWARD);
        killer.maxHp = nextMaxHp;
        killer.hp = Math.min(nextMaxHp, previousHp + KILL_HP_REWARD);
        killer.killAttackSpeedMultiplier = Math.max(MIN_KILL_ATTACK_SPEED_MULTIPLIER, (killer.killAttackSpeedMultiplier || 1) * KILL_ATTACK_SPEED_MULTIPLIER);
        if (this.usesProgressionPvpCombat(room)) {
            killer.moveSpeedMultiplier = Math.min(NORMAL_MAX_MOVE_SPEED_MULTIPLIER, previousMoveSpeed + NORMAL_KILL_MOVE_SPEED_STEP);
            killer.attackDroneSpeedMultiplier = Math.min(NORMAL_MAX_ATTACK_DRONE_SPEED_MULTIPLIER, previousAttackDroneSpeed + NORMAL_KILL_ATTACK_DRONE_SPEED_STEP);
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
                this.pushCombatEvent(room, killer, "+5% ATTACK DRONE SPEED", "attack-reward", now);
            }
        }
        if (killer.killStreak >= 3) {
            killer.rapidFireUntil = now + 10000;
            killer.attackCooldownMultiplier = killer.killStreak >= 5 ? 0.5 : 0.65;
        }
    }
    getRecentKiller(room, victim, now = Date.now()) {
        if (!room || !victim?.lastDamageById)
            return null;
        if (now - Number(victim.lastDamageAt || 0) > SPECTATOR_KILL_CREDIT_WINDOW_MS) {
            return null;
        }
        const candidate = room.players.get(victim.lastDamageById);
        return candidate && candidate.id !== victim.id && candidate.alive !== false
            ? candidate
            : null;
    }
    getStableSpectatorTarget(room, victim, preferred = null) {
        if (!room || !victim)
            return null;
        const alive = [...room.players.values()]
            .filter((player) => player.id !== victim.id && player.alive !== false)
            .sort((a, b) => {
            const aDistance = Math.hypot((a.x || 0) - (victim.x || 0), (a.y || 0) - (victim.y || 0));
            const bDistance = Math.hypot((b.x || 0) - (victim.x || 0), (b.y || 0) - (victim.y || 0));
            return aDistance - bDistance || String(a.id).localeCompare(String(b.id));
        });
        const isValid = (candidate) => candidate && candidate.id !== victim.id && candidate.alive !== false;
        if (isValid(preferred))
            return preferred;
        const killer = victim.killedById ? room.players.get(victim.killedById) : null;
        if (isValid(killer))
            return killer;
        const lockedTarget = victim.spectatorTargetId
            ? room.players.get(victim.spectatorTargetId)
            : null;
        if (isValid(lockedTarget))
            return lockedTarget;
        return alive[0] || null;
    }
    eliminatePlayer(room, victim, killer = null, now = Date.now(), reason = "unknown", forceEmit = false) {
        if (!room || !victim)
            return null;
        const wasAlive = victim.alive !== false || forceEmit;
        const recentKiller = this.getRecentKiller(room, victim, now);
        const validKiller = killer && killer.id !== victim.id && killer.alive !== false
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
    emitNormalPvpCollisionImpulse(player, payload) {
        if (!player?.id || !payload)
            return;
        this.server?.to(String(player.id)).emit("normal-pvp:collision", payload);
    }
    emitZonePvpCollisionImpulse(player, payload) {
        if (!player?.id || !payload)
            return;
        this.server?.to(String(player.id)).emit("zone-pvp:collision", payload);
    }
    applyCollisionSeparation(player, dirX, dirY, distance, zoneRadius, room) {
        const safe = this.keepInsideSafeZone(Number(player.x || 0) + dirX * distance, Number(player.y || 0) + dirY * distance, zoneRadius, PLAYER_RADIUS + 18, Boolean(room?.zonePvpMode));
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
        const safe = this.keepInsideSafeZone(player.x + kx, player.y + ky, zoneRadius, PLAYER_RADIUS + 18, Boolean(room?.zonePvpMode));
        const knockbackWorldWidth = room?.normalMode
            ? NORMAL_WORLD_WIDTH
            : WORLD_WIDTH;
        const knockbackWorldHeight = room?.normalMode
            ? NORMAL_WORLD_HEIGHT
            : WORLD_HEIGHT;
        player.x = this.clamp(safe.x, PLAYER_RADIUS, knockbackWorldWidth - PLAYER_RADIUS);
        player.y = this.clamp(safe.y, PLAYER_RADIUS, knockbackWorldHeight - PLAYER_RADIUS);
        player.knockbackX = kx * BODY_COLLISION_PUSH_DECAY;
        player.knockbackY = ky * BODY_COLLISION_PUSH_DECAY;
    }
    buildCollisionGrid(alivePlayers) {
        const grid = new Map();
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
        const nearby = [];
        for (let ox = -1; ox <= 1; ox += 1) {
            for (let oy = -1; oy <= 1; oy += 1) {
                const bucket = grid.get(`${cellX + ox}:${cellY + oy}`);
                if (bucket)
                    nearby.push(...bucket);
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
        const checkedPairs = new Set();
        for (const a of alive) {
            const nearby = this.getNearbyCellPlayers(grid, a);
            for (const b of nearby) {
                if (a.id === b.id)
                    continue;
                const pairKey = this.getCollisionKey(a.id, b.id);
                if (checkedPairs.has(pairKey))
                    continue;
                checkedPairs.add(pairKey);
                this.resolvePlayerPairCollision(a, b, room, now, zoneRadius);
            }
        }
    }
    handleBodyCollisionsBruteForce(alive, room, now, zoneRadius) {
        for (let i = 0; i < alive.length; i += 1) {
            for (let j = i + 1; j < alive.length; j += 1) {
                this.resolvePlayerPairCollision(alive[i], alive[j], room, now, zoneRadius);
            }
        }
    }
    resolvePlayerPairCollision(a, b, room, now, zoneRadius) {
        const key = this.getCollisionKey(a.id, b.id);
        const lastAt = room.collisionCooldowns.get(key) || 0;
        const rawDx = Number(b.x || 0) - Number(a.x || 0);
        const rawDy = Number(b.y || 0) - Number(a.y || 0);
        const rawDistance = Math.hypot(rawDx, rawDy);
        if (rawDistance > BODY_COLLISION_DISTANCE)
            return;
        if (this.isBattlePrepareLocked(room, now))
            return;
        if (now - lastAt < BODY_COLLISION_COOLDOWN)
            return;
        let dirX = 0;
        let dirY = 0;
        if (rawDistance > 0.001) {
            dirX = rawDx / rawDistance;
            dirY = rawDy / rawDistance;
        }
        else {
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
        const appliesPhysicalPush = Boolean(room?.normalMode || room?.zonePvpMode || !room?.battleRoyaleOnlineMode);
        if (appliesPhysicalPush) {
            const overlap = Math.max(0, BODY_COLLISION_DISTANCE - rawDistance);
            const separation = Math.max(BODY_COLLISION_SEPARATION, Math.min(BODY_COLLISION_SEPARATION * 2, overlap * 0.5 + 6));
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
        if (aWasAlive && !a.alive && b.alive)
            this.applyKillReward(b, room, now);
        if (bWasAlive && !b.alive && a.alive)
            this.applyKillReward(a, room, now);
    }
    hasActiveAttackDrone(room, playerId) {
        const ownerId = String(playerId || "");
        if (!ownerId || !Array.isArray(room?.projectiles))
            return false;
        return room.projectiles.some((projectile) => projectile && String(projectile.ownerId || "") === ownerId);
    }
    tryFireProjectile(room, player, now) {
        if (this.isBattlePrepareLocked(room, now))
            return;
        if ((player.drones || 0) <= 0)
            return;
        if (this.hasActiveAttackDrone(room, player.id))
            return;
        const cooldown = this.getFireCooldown(player, now);
        if (now - player.lastFireAt < cooldown)
            return;
        const targetX = player.input.mouseX || player.x + 1;
        const targetY = player.input.mouseY || player.y;
        const angle = Math.atan2(targetY - player.y, targetX - player.x);
        const rapidBonus = player.rapidFireUntil && player.rapidFireUntil > now ? 0.75 : 0;
        const overclockBonus = player.overclockUntil && player.overclockUntil > now ? 1.25 : 0;
        const progressionAttackDroneMultiplier = this.usesProgressionPvpCombat(room)
            ? NORMAL_BASE_ATTACK_DRONE_SPEED_MULTIPLIER *
                Math.max(1, Number(player.attackDroneSpeedMultiplier || 1))
            : 1;
        const speed = (PROJECTILE_SPEED +
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
            skin: normalizeSkin(player.skin || "cyan"),
            damage: player.berserkUntil && player.berserkUntil > now
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
            player.shieldBreakerShots = Math.max(0, (player.shieldBreakerShots || 0) - 1);
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
        cooldown *= Math.max(MIN_KILL_ATTACK_SPEED_MULTIPLIER, player.killAttackSpeedMultiplier || 1);
        return Math.max(420, Math.floor(cooldown));
    }
    updateProjectiles(room, deltaFrames = 1, now = Date.now()) {
        const nextProjectiles = [];
        for (const projectile of room.projectiles) {
            projectile.x += projectile.vx * deltaFrames;
            projectile.y += projectile.vy * deltaFrames;
            const traveled = Math.hypot(projectile.x - projectile.startX, projectile.y - projectile.startY);
            const age = now - (projectile.createdAt || now);
            if (traveled > PROJECTILE_MAX_DISTANCE || age > PROJECTILE_MAX_LIFETIME)
                continue;
            let keepProjectile = true;
            for (const target of room.players.values()) {
                if (!target.alive || target.id === projectile.ownerId)
                    continue;
                const dx = target.x - projectile.x;
                const dy = target.y - projectile.y;
                if (dx * dx + dy * dy > 105 * 105)
                    continue;
                const owner = room.players.get(projectile.ownerId);
                const progressionShieldIntercept = Boolean(this.usesProgressionPvpCombat(room) && target.shieldActive);
                const damageBlocked = progressionShieldIntercept ||
                    (target.shieldActive && !projectile.shieldBreaker);
                if (progressionShieldIntercept) {
                    target.shieldActive = false;
                    target.shieldUntil = 0;
                    this.pushCombatEvent(room, target, "SHIELD BLOCKED", "shield", now);
                    projectile.pierceLeft = 0;
                }
                else if (!damageBlocked) {
                    const hpBefore = Number(target.hp || 0);
                    target.hp = Math.max(0, hpBefore - projectile.damage);
                    let removedDrone = false;
                    if (this.usesProgressionPvpCombat(room) &&
                        (target.drones || 0) > 0) {
                        target.drones = Math.max(0, Number(target.drones || 0) - 1);
                        target.nextDroneAt = this.getNextDroneAt(target.drones || 0);
                        removedDrone = true;
                    }
                    if (owner && owner.id !== target.id) {
                        target.lastDamageById = owner.id;
                        target.lastDamageAt = now;
                    }
                    if (owner && owner.vampireUntil && owner.vampireUntil > now) {
                        owner.hp = Math.min(owner.maxHp, owner.hp + Math.floor(projectile.damage * VAMPIRE_HEAL_RATIO));
                    }
                    if (this.usesProgressionPvpCombat(room)) {
                        this.pushCombatEvent(room, target, `-${Math.max(0, hpBefore - target.hp)} HP`, "damage", now);
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
                if (projectile.pierceLeft <= 0)
                    keepProjectile = false;
                break;
            }
            if (keepProjectile)
                nextProjectiles.push(projectile);
        }
        room.projectiles = nextProjectiles.slice(-160);
    }
    applyZoneDamage(room, now, zoneRadius) {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            const distance = Math.hypot(player.x - centerX, player.y - centerY);
            if (distance <= zoneRadius)
                continue;
            if (now - (player.lastZoneDamageAt || 0) < ZONE_DAMAGE_INTERVAL)
                continue;
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
            if (!player.alive)
                continue;
            const distance = Math.hypot(player.x - centerX, player.y - centerY);
            if (distance <= zoneRadius)
                continue;
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
            if (!player.alive)
                continue;
            const distance = Math.hypot(player.x - centerX, player.y - centerY);
            if (distance <= zoneRadius)
                continue;
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
        if (room?.normalMode)
            return "normal-pvp";
        if (room?.zonePvpMode)
            return "zone-pvp";
        if (room?.battleRoyaleOnlineMode)
            return "battle-royale-online";
        return "pvp";
    }
    emitCollectSync(room, player, payload) {
        if (!player?.id)
            return;
        const socket = this.server.sockets.sockets.get(player.id);
        if (!socket)
            return;
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
    emitWorldItemDelta(room, payload, now = Date.now()) {
        if (!room?.id)
            return;
        if (room.zonePvpMode) {
            this.queueZonePvpWorldDelta(room, payload, now);
            return;
        }
        const prefix = this.getRoomEventPrefix(room);
        const removedOrbIds = Array.isArray(payload?.removedOrbIds) ? payload.removedOrbIds : [];
        const removedEnergyIds = Array.isArray(payload?.removedEnergyIds) ? payload.removedEnergyIds : [];
        const removedCoreIds = Array.isArray(payload?.removedCoreIds) ? payload.removedCoreIds : [];
        if (!removedOrbIds.length && !removedEnergyIds.length && !removedCoreIds.length)
            return;
        this.server.to(room.id).compress(false).emit(`${prefix}:world-delta`, {
            serverTime: now,
            removedOrbIds,
            removedEnergyIds,
            removedCoreIds,
        });
    }
    queueZonePvpWorldDelta(room, payload, now = Date.now()) {
        if (!room)
            return;
        const pending = room.pendingZoneWorldDelta || {
            removedOrbIds: new Set(),
            removedEnergyIds: new Set(),
            removedCoreIds: new Set(),
            queuedAt: now,
        };
        for (const id of payload?.removedOrbIds || [])
            pending.removedOrbIds.add(String(id));
        for (const id of payload?.removedEnergyIds || [])
            pending.removedEnergyIds.add(String(id));
        for (const id of payload?.removedCoreIds || [])
            pending.removedCoreIds.add(String(id));
        room.pendingZoneWorldDelta = pending;
    }
    flushZonePvpWorldDelta(room, now = Date.now()) {
        if (!room?.zonePvpMode)
            return;
        const pending = room.pendingZoneWorldDelta;
        if (!pending)
            return;
        if (now - Number(room.lastZoneWorldDeltaAt || 0) < ZONE_WORLD_DELTA_INTERVAL_MS)
            return;
        const removedOrbIds = [...pending.removedOrbIds];
        const removedEnergyIds = [...pending.removedEnergyIds];
        const removedCoreIds = [...pending.removedCoreIds];
        if (!removedOrbIds.length && !removedEnergyIds.length && !removedCoreIds.length) {
            room.pendingZoneWorldDelta = null;
            return;
        }
        room.lastZoneWorldDeltaAt = now;
        room.pendingZoneWorldDelta = null;
        this.server.to(room.id).volatile.compress(false).emit("zone-pvp:world-delta", {
            serverTime: now,
            removedOrbIds,
            removedEnergyIds,
            removedCoreIds,
        });
    }
    collectOrbs(room, zoneRadius) {
        const collectedIds = new Set();
        const activeOrbIds = new Set((room.orbs || []).map((orb) => orb?.id).filter(Boolean));
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            let collected = 0;
            const collectedOrbIds = [];
            const candidates = room.orbSpatialIndex
                ? this.querySpatialIndex(room.orbSpatialIndex, player.x, player.y, ORB_COLLECT_DISTANCE + 180)
                : room.orbs;
            for (const orb of candidates) {
                if (!orb?.id ||
                    !activeOrbIds.has(orb.id) ||
                    collectedIds.has(orb.id)) {
                    continue;
                }
                const endDx = orb.x - player.x;
                const endDy = orb.y - player.y;
                const pathDistance = this.distancePointToSegment(orb.x, orb.y, player.prevX ?? player.x, player.prevY ?? player.y, player.x, player.y);
                if (endDx * endDx + endDy * endDy >
                    ORB_COLLECT_DISTANCE * ORB_COLLECT_DISTANCE &&
                    pathDistance > ORB_COLLECT_DISTANCE) {
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
                while (player.drones < MAX_DRONES &&
                    player.progress >= player.nextDroneAt) {
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
            if (room.normalMode) {
                this.ensureNormalOrbDistribution(room, Date.now());
            }
            this.refreshRoomSpatialIndexes(room, Date.now(), true);
            this.emitWorldItemDelta(room, {
                removedOrbIds: [...collectedIds],
            });
        }
    }
    collectEnergy(room, zoneRadius) {
        const collectedIds = new Set();
        const activeEnergyIds = new Set((room.energyCells || []).map((cell) => cell?.id).filter(Boolean));
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            let collected = 0;
            const collectedEnergyIds = [];
            const candidates = room.energySpatialIndex
                ? this.querySpatialIndex(room.energySpatialIndex, player.x, player.y, ENERGY_CELL_COLLECT_DISTANCE + 180)
                : room.energyCells;
            for (const cell of candidates) {
                if (!cell?.id ||
                    !activeEnergyIds.has(cell.id) ||
                    collectedIds.has(cell.id)) {
                    continue;
                }
                const endDx = cell.x - player.x;
                const endDy = cell.y - player.y;
                const pathDistance = this.distancePointToSegment(cell.x, cell.y, player.prevX ?? player.x, player.prevY ?? player.y, player.x, player.y);
                if (endDx * endDx + endDy * endDy >
                    ENERGY_CELL_COLLECT_DISTANCE * ENERGY_CELL_COLLECT_DISTANCE &&
                    pathDistance > ENERGY_CELL_COLLECT_DISTANCE) {
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
                    this.pushCombatEvent(room, player, `ENERGY +${energyGained}`, "heal", Date.now());
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
            room.energyCells = room.energyCells.filter((cell) => !collectedIds.has(cell.id));
            room.itemSpatialDirty = true;
            if (room.normalMode) {
                const missing = Math.max(0, this.getNormalEnergyTarget(room) - room.energyCells.length);
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
        const collectedIds = new Set();
        const activeCoreIds = new Set((room.cores || []).map((core) => core?.id).filter(Boolean));
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            const collectedCoreIds = [];
            const candidates = room.coreSpatialIndex
                ? this.querySpatialIndex(room.coreSpatialIndex, player.x, player.y, CORE_COLLECT_DISTANCE + 180)
                : room.cores;
            for (const core of candidates) {
                if (!core?.id || !activeCoreIds.has(core.id) || collectedIds.has(core.id))
                    continue;
                const endDx = core.x - player.x;
                const endDy = core.y - player.y;
                const pathDistance = this.distancePointToSegment(core.x, core.y, player.prevX ?? player.x, player.prevY ?? player.y, player.x, player.y);
                if (endDx * endDx + endDy * endDy >
                    CORE_COLLECT_DISTANCE * CORE_COLLECT_DISTANCE &&
                    pathDistance > CORE_COLLECT_DISTANCE) {
                    continue;
                }
                if (!this.canUseCore(player, core))
                    continue;
                this.applyCore(player, core);
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
        if (this.getActiveCoreCount(player) >= MAX_ACTIVE_CORES &&
            !this.hasCoreAlready(player, core.type)) {
            return false;
        }
        if (core.type === "nano") {
            return (!player.nanoCoreActive &&
                (player.maxHp < MAX_HP || player.hp < player.maxHp));
        }
        if (core.type === "rotor") {
            return (!player.rotorCoreActive &&
                (player.attackSpeedLevel || 1) < ROTOR_MAX_LEVEL);
        }
        if (core.type === "piercing")
            return (player.piercingShots || 0) <= 0;
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
        if (type === "nano")
            return Boolean(player.nanoCoreActive);
        if (type === "rotor")
            return Boolean(player.rotorCoreActive);
        if (type === "swarm")
            return Boolean(player.swarmCoreActive);
        if (type === "piercing")
            return (player.piercingShots || 0) > 0;
        if (type === "shield-breaker")
            return (player.shieldBreakerShots || 0) > 0;
        if (type === "overclock")
            return (player.overclockUntil || 0) > now;
        if (type === "berserk")
            return (player.berserkUntil || 0) > now;
        if (type === "vampire")
            return (player.vampireUntil || 0) > now;
        if (type === "emp")
            return (player.empPulseUntil || 0) > now;
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
            player.projectileSpeedBonus = Math.max(player.projectileSpeedBonus || 0, 0.9);
            player.rotorCoreActive = true;
        }
        if (core.type === "piercing")
            player.piercingShots = 3;
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
            const playerRoom = this.getRoomBySocket(player.id) ||
                this.getNormalRoomBySocket(player.id) ||
                this.getBattleRoyaleOnlineRoomBySocket(player.id) ||
                this.getZonePvpRoomBySocket(player.id);
            for (const other of playerRoom?.players.values() || []) {
                if (other.id === player.id || !other.alive)
                    continue;
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
        if (!room.normalMode &&
            now - (room.lastItemZonePruneAt || 0) >= ITEM_ZONE_PRUNE_INTERVAL_MS) {
            room.lastItemZonePruneAt = now;
            room.orbs = room.orbs.filter((orb) => this.isInsideSafeZone(orb.x, orb.y, zoneRadius, 120));
            room.energyCells = room.energyCells.filter((cell) => this.isInsideSafeZone(cell.x, cell.y, zoneRadius, 120));
            room.cores = room.cores.filter((core) => this.isInsideSafeZone(core.x, core.y, zoneRadius, 420));
        }
        const orbTarget = this.getNormalOrbTarget(room);
        const energyTarget = this.getNormalEnergyTarget(room);
        if (room.normalMode) {
            this.ensureNormalOrbDistribution(room, now);
        }
        while (!room.normalMode && room.orbs.length < orbTarget) {
            room.orbs.push(this.createOrb(zoneRadius));
        }
        while (room.energyCells.length < energyTarget) {
            room.energyCells.push(room.normalMode
                ? this.createNormalEnergyCell()
                : this.createEnergyCell(zoneRadius));
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
            }
            else {
                if (!room.nextCoreWaveAt) {
                    room.nextCoreWaveAt = now + CORE_WARNING_DELAY;
                }
                if (now >= room.nextCoreWaveAt) {
                    room.cores = Array.from({ length: CORE_WAVE_SIZE }, () => room.normalMode
                        ? this.createNormalCore()
                        : this.createCore(zoneRadius));
                    room.lastCoreWaveAt = now;
                    room.nextCoreWaveAt = null;
                }
            }
        }
        else if (now - room.lastCoreWaveAt >= CORE_RESPAWN_DELAY) {
            room.lastCoreWaveAt = now;
            while (room.cores.length < CORE_WAVE_SIZE) {
                room.cores.push(this.createCore(zoneRadius));
            }
        }
        if (now - (room.lastLocalItemAt || 0) > 1800) {
            room.lastLocalItemAt = now;
            this.ensureLocalItemsAroundPlayers(room, zoneRadius);
        }
        if (itemsBefore.orbs !== room.orbs.length ||
            itemsBefore.energy !== room.energyCells.length ||
            itemsBefore.cores !== room.cores.length) {
            room.itemSpatialDirty = true;
        }
        this.refreshRoomSpatialIndexes(room, now);
    }
    updateWinCondition(room, now) {
        if (room.status !== "playing")
            return;
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
        if (room.status !== "playing")
            return;
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
        if (!room || room.status === "finished")
            return;
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
        if (room.status !== "playing" || !room.matchHadMultiplePlayers)
            return;
        const alive = this.getAlivePlayers(room);
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
        const countdown = room.status === "countdown" && room.countdownStartedAt
            ? Math.max(1, Math.ceil((ROOM_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) /
                1000))
            : null;
        const secondsUntilCoreDrop = Math.ceil(Math.max(0, CORE_RESPAWN_DELAY - (now - room.lastCoreWaveAt)) / 1000);
        const coreDropCountdown = room.status === "playing" &&
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
            if (!socket)
                continue;
            const visiblePlayers = players
                .filter((other) => other.id !== player.id)
                .filter((other) => this.isNear(player, other, VIEW_DISTANCE))
                .map((other) => this.serializePlayer(other));
            const visibleOrbs = room.orbSpatialIndex
                ? this.filterNearIndexed(player, room.orbSpatialIndex, VIEW_DISTANCE, VISIBLE_ORB_LIMIT)
                : this.filterNear(player, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT);
            const visibleEnergyCells = room.energySpatialIndex
                ? this.filterNearIndexed(player, room.energySpatialIndex, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT)
                : this.filterNear(player, room.energyCells, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT);
            const visibleCores = room.coreSpatialIndex
                ? this.filterNearIndexed(player, room.coreSpatialIndex, VIEW_DISTANCE + 600, 18)
                : this.filterNear(player, room.cores, VIEW_DISTANCE + 600, 18);
            const visibleProjectiles = room.projectileSpatialIndex
                ? this.filterNearIndexed(player, room.projectileSpatialIndex, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT)
                : this.filterNear(player, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT);
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
        const joinableRoom = this.selectMostPopulatedJoinableRoom(this.normalRooms, (room) => room.status === "playing" &&
            room.players.size < NORMAL_ROOM_MAX_PLAYERS);
        if (joinableRoom)
            return joinableRoom;
        const room = {
            id: `normal-${crypto.randomUUID()}`,
            status: "playing",
            players: new Map(),
            orbs: [],
            normalOrbGrid: null,
            normalOrbDistributionVersion: 0,
            normalOrbRespawnAt: new Map(),
            normalOrbRespawnCollectorId: new Map(),
            normalOrbRespawnGeneration: new Map(),
            energyCells: Array.from({ length: NORMAL_ENERGY_BASE_TARGET }, () => this.createNormalEnergyCell()),
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
        if (!roomId)
            return null;
        return this.normalRooms.get(roomId) || null;
    }
    removeNormalPlayer(socketId) {
        const roomId = this.normalSocketRoom.get(socketId);
        if (!roomId)
            return;
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
            x: this.clamp(NORMAL_WORLD_WIDTH / 2 + (Math.random() - 0.5) * spawnAreaRadius, PLAYER_RADIUS, NORMAL_WORLD_WIDTH - PLAYER_RADIUS),
            y: this.clamp(NORMAL_WORLD_HEIGHT / 2 + (Math.random() - 0.5) * spawnAreaRadius, PLAYER_RADIUS, NORMAL_WORLD_HEIGHT - PLAYER_RADIUS),
        };
    }
    broadcastNormalRoomState(room, now) {
        const players = [...room.players.values()];
        const alivePlayers = players.filter((player) => player.alive);
        const aliveOthers = alivePlayers;
        const serializedById = new Map(players.map((player) => [player.id, this.serializePlayer(player)]));
        const snapshotsByPlayer = new Map(players.map((player) => [player.id, serializedById.get(player.id)]));
        const includeStaticState = !room.lastStaticStateAt ||
            now - room.lastStaticStateAt >= STATIC_STATE_INTERVAL_MS;
        let leaderboard;
        let minimapOrbs;
        let minimapEnergyCells;
        let minimapCores;
        if (includeStaticState) {
            room.lastStaticStateAt = now;
            leaderboard = players
                .slice()
                .sort((a, b) => (b.kills || 0) - (a.kills || 0) ||
                (b.totalCollected || 0) - (a.totalCollected || 0))
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
            if (!socket)
                continue;
            const aliveOtherPlayers = aliveOthers.filter((other) => other.id !== player.id);
            const spectatorTarget = player.alive === false
                ? this.getStableSpectatorTarget(room, player)
                : null;
            if (player.alive === false) {
                player.spectatorTargetId = spectatorTarget?.id || null;
            }
            else {
                player.spectatorTargetId = null;
                player.killedById = null;
            }
            const viewAnchor = spectatorTarget || player;
            const includeViewportItems = !player.lastViewportItemStateAt ||
                now - player.lastViewportItemStateAt >= VIEWPORT_ITEM_STATE_INTERVAL_MS;
            if (includeViewportItems)
                player.lastViewportItemStateAt = now;
            const playerCandidates = this.querySpatialIndex(playerIndex, viewAnchor.x, viewAnchor.y, player.alive === false ? VIEW_DISTANCE + 1200 : VIEW_DISTANCE);
            const visiblePlayers = this.filterNear(viewAnchor, playerCandidates.filter((other) => other.id !== player.id &&
                (player.alive !== false || other.alive !== false)), player.alive === false ? VIEW_DISTANCE + 1200 : VIEW_DISTANCE, NORMAL_VISIBLE_PLAYERS_LIMIT).map((other) => snapshotsByPlayer.get(other.id));
            const payload = {
                status: "playing",
                serverTime: now,
                countdown: null,
                coreDropCountdown: room.cores.length === 0 && room.nextCoreWaveAt
                    ? (() => {
                        const seconds = Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000);
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
                    ? this.filterNearIndexed(viewAnchor, room.projectileSpatialIndex, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT)
                    : this.filterNear(viewAnchor, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT),
                combatEvents: (room.combatEvents || [])
                    .filter((event) => {
                    const age = now - Number(event?.createdAt || 0);
                    if (age < 0 || age >= Number(event?.ttl || 2000))
                        return false;
                    if (event?.viewerId !== player.id)
                        return false;
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
        const joinableRoom = this.selectMostPopulatedJoinableRoom(this.battleRoyaleOnlineRooms, (room) => (room.status === "waiting" || room.status === "countdown") &&
            room.players.size < BR_ONLINE_ROOM_MAX_PLAYERS);
        if (joinableRoom)
            return joinableRoom;
        const room = {
            id: `br-online-${crypto.randomUUID()}`,
            status: "waiting",
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(ZONE_START_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(ZONE_START_RADIUS)),
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
            lastTransformBroadcastAt: 0,
            zoneTransformSequence: 0,
            zoneNetIds: new Map(),
            nextZoneNetId: 1,
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
        if (!roomId)
            return null;
        return this.battleRoyaleOnlineRooms.get(roomId) || null;
    }
    removeBattleRoyaleOnlinePlayer(socketId) {
        const roomId = this.battleRoyaleOnlineSocketRoom.get(socketId);
        if (!roomId)
            return;
        const room = this.battleRoyaleOnlineRooms.get(roomId);
        if (room) {
            room.players.delete(socketId);
            this.server.sockets.sockets.get(socketId)?.leave(roomId);
            this.markRoomEmptyIfNeeded(room);
            if (room.players.size < BR_ONLINE_ROOM_MIN_PLAYERS &&
                room.status === "countdown") {
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
        if (room.status === "finished" &&
            room.finishedAt &&
            now - room.finishedAt > 90000) {
            this.battleRoyaleOnlineRooms.delete(room.id);
        }
    }
    getBattleRoyaleOnlineZoneRadius(room) {
        if (!room.matchStartedAt)
            return ZONE_START_RADIUS;
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
            .sort((a, b) => (b.kills || 0) - (a.kills || 0) ||
            (b.totalCollected || 0) - (a.totalCollected || 0))
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
        const countdown = room.status === "countdown" && room.countdownStartedAt
            ? Math.max(1, Math.ceil((BR_ONLINE_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) /
                1000))
            : null;
        const battlePrepareRemainingMs = room.battlePrepareUntil
            ? Math.max(0, room.battlePrepareUntil - now)
            : 0;
        const secondsUntilCoreDrop = room.cores.length === 0 && room.nextCoreWaveAt
            ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
            : null;
        const coreDropCountdown = secondsUntilCoreDrop &&
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
            if (!socket)
                continue;
            const aliveOthers = players.filter((other) => other.id !== player.id && other.alive !== false);
            const spectatorTarget = player.alive === false
                ? this.getStableSpectatorTarget(room, player)
                : null;
            if (player.alive === false) {
                player.spectatorTargetId = spectatorTarget?.id || null;
            }
            else {
                player.spectatorTargetId = null;
                player.killedById = null;
            }
            const viewAnchor = spectatorTarget || player;
            const visiblePlayers = player.alive === false
                ? this.filterNear(viewAnchor, aliveOthers, VIEW_DISTANCE + 1200, BR_ONLINE_VISIBLE_PLAYERS_LIMIT).map((other) => this.serializePlayer(other))
                : this.filterNear(player, players.filter((other) => other.id !== player.id), VIEW_DISTANCE, BR_ONLINE_VISIBLE_PLAYERS_LIMIT).map((other) => this.serializePlayer(other));
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
                    ? this.filterNearIndexed(viewAnchor, room.orbSpatialIndex, VIEW_DISTANCE, VISIBLE_ORB_LIMIT)
                    : this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT),
                energyCells: room.energySpatialIndex
                    ? this.filterNearIndexed(viewAnchor, room.energySpatialIndex, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT)
                    : this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT),
                cores: room.coreSpatialIndex
                    ? this.filterNearIndexed(viewAnchor, room.coreSpatialIndex, VIEW_DISTANCE + 600, 18)
                    : this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 18),
                projectiles: room.projectileSpatialIndex
                    ? this.filterNearIndexed(viewAnchor, room.projectileSpatialIndex, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT)
                    : this.filterNear(viewAnchor, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT),
                minimapOrbs,
                minimapEnergyCells,
                minimapCores,
                leaderboard,
            });
        }
    }
    findOrCreateZonePvpRoom() {
        const joinableRoom = this.selectMostPopulatedJoinableRoom(this.zonePvpRooms, (room) => (room.status === "waiting" || room.status === "countdown") &&
            !room.locked &&
            room.players.size < ZONE_PVP_ROOM_MAX_PLAYERS);
        if (joinableRoom)
            return joinableRoom;
        const room = {
            id: `zone-pvp-${crypto.randomUUID()}`,
            status: "waiting",
            locked: false,
            phaseVersion: 0,
            roundId: null,
            roundStarted: false,
            lastZoneCollisionAt: 0,
            lastZoneLootAt: 0,
            lastZoneItemMaintenanceAt: 0,
            lastZoneWorldDeltaAt: 0,
            pendingZoneWorldDelta: null,
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(ZONE_START_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(ZONE_START_RADIUS)),
            cores: [],
            pendingCores: [],
            projectiles: [],
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
            abandonedByAllHumansAt: null,
            collisionCooldowns: new Map(),
            zonePvpMode: true,
        };
        this.zonePvpRooms.set(room.id, room);
        return room;
    }
    getZonePvpRoomBySocket(socketId) {
        const roomId = this.zonePvpSocketRoom.get(socketId);
        if (!roomId)
            return null;
        return this.zonePvpRooms.get(roomId) || null;
    }
    removeZonePvpPlayer(socketId) {
        const roomId = this.zonePvpSocketRoom.get(socketId);
        if (!roomId)
            return;
        const room = this.zonePvpRooms.get(roomId);
        if (room) {
            const player = room.players.get(socketId);
            const resumeToken = String(player?.resumeToken || this.zonePvpSocketResumeToken.get(socketId) || "");
            if (resumeToken)
                this.zonePvpResumeSeats.delete(resumeToken);
            room.players.delete(socketId);
            this.server.sockets.sockets.get(socketId)?.leave(roomId);
            this.zonePvpSocketRoom.delete(socketId);
            this.zonePvpSocketResumeToken.delete(socketId);
            this.markRoomEmptyIfNeeded(room);
            const humanCount = this.getZoneHumanPlayerCount(room);
            if (room.status === "countdown" && humanCount < ZONE_PVP_ROOM_MIN_PLAYERS) {
                room.status = "waiting";
                room.locked = false;
                room.countdownStartedAt = null;
                room.roundId = null;
                room.phaseVersion = Number(room.phaseVersion || 0) + 1;
                this.broadcastZonePvpRoomState(room, Date.now(), true);
            }
            else if (room.status === "playing") {
                if (humanCount === 0) {
                    room.status = "finished";
                    room.locked = true;
                    room.countdownStartedAt = null;
                    room.battlePrepareUntil = null;
                    room.winnerId = null;
                    room.winnerName = null;
                    room.finishedAt = Date.now();
                    room.abandonedByAllHumansAt = room.finishedAt;
                    room.projectiles = [];
                    room.phaseVersion = Number(room.phaseVersion || 0) + 1;
                }
                else {
                    this.updateZonePvpWinCondition(room, Date.now());
                }
            }
        }
        this.zonePvpSocketRoom.delete(socketId);
        this.zonePvpSocketResumeToken.delete(socketId);
    }
    cleanupZonePvpRoom(room, now) {
        for (const player of [...room.players.values()]) {
            if (player?.isBot)
                continue;
            const socketOnline = this.server.sockets.sockets.has(player.id);
            const disconnectedAt = Number(player.disconnectedAt || 0);
            const disconnectedTooLong = disconnectedAt > 0 &&
                now - disconnectedAt >= ZONE_PVP_RECONNECT_GRACE_MS;
            const shouldExpireSilentActivePlayer = room.status === "playing" &&
                player.alive !== false &&
                socketOnline &&
                now - Number(player.lastSeenAt || now) > 45000;
            if (disconnectedTooLong || shouldExpireSilentActivePlayer) {
                if (!this.zonePvpSocketRoom.has(player.id)) {
                    this.zonePvpSocketRoom.set(player.id, room.id);
                }
                this.removeZonePvpPlayer(player.id);
            }
        }
        if (this.shouldDeleteEmptyRoom(room, now)) {
            this.zonePvpRooms.delete(room.id);
            return;
        }
        if (room.status === "finished" &&
            room.finishedAt &&
            now - room.finishedAt > 90000) {
            this.zonePvpRooms.delete(room.id);
        }
    }
    getZonePvpZoneRadius(room) {
        if (!room.matchStartedAt)
            return ZONE_START_RADIUS;
        const elapsed = Math.max(0, Date.now() - room.matchStartedAt);
        const progress = Math.min(1, elapsed / ZONE_PVP_ZONE_SHRINK_DURATION);
        return ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * progress;
    }
    broadcastZonePvpTransforms(room, now) {
        if (!room?.zonePvpMode || room.status !== "playing")
            return;
        const units = [...room.players.values()];
        const sequence = Number(room.zoneTransformSequence || 0) + 1;
        room.zoneTransformSequence = sequence;
        for (const viewer of units) {
            if (viewer?.isBot)
                continue;
            const socket = this.server.sockets.sockets.get(viewer.id);
            if (!socket?.connected)
                continue;
            const spectatorTarget = viewer.alive === false
                ? this.getStableSpectatorTarget(room, viewer)
                : null;
            const viewAnchor = spectatorTarget || viewer;
            const range = viewer.alive === false
                ? VIEW_DISTANCE + 1700
                : VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING;
            const playerRows = this.filterNear(viewAnchor, units.filter((other) => other.id !== viewer.id &&
                (viewer.alive !== false || other.alive !== false)), range, ZONE_TRANSFORM_PLAYER_LIMIT).map((unit) => {
                const flags = (unit.isMoving ? 1 : 0) |
                    (unit.input?.attacking ? 2 : 0) |
                    (unit.shieldActive ? 4 : 0) |
                    (unit.alive !== false ? 8 : 0) |
                    (unit.isBot ? 16 : 0);
                return [
                    this.ensureZonePvpNetId(room, unit.id),
                    Math.round(Number(unit.x || 0) * 10) / 10,
                    Math.round(Number(unit.y || 0) * 10) / 10,
                    Math.round(Number(unit.velocityX || 0) * 10) / 10,
                    Math.round(Number(unit.velocityY || 0) * 10) / 10,
                    Math.round(Number(unit.moveAngle || 0) * 10000) / 10000,
                    flags,
                    Math.max(0, Math.min(MAX_DRONES, Number(unit.drones || 0))),
                ];
            });
            const projectileRows = this.filterNear(viewAnchor, room.projectiles || [], range + 460, ZONE_TRANSFORM_PROJECTILE_LIMIT).map((projectile) => {
                const flags = (Number(projectile.pierceLeft || 1) > 1 ? 1 : 0) |
                    (projectile.shieldBreaker ? 2 : 0) |
                    (projectile.piercesShield ? 4 : 0);
                return [
                    this.ensureZonePvpNetId(room, projectile.id),
                    this.ensureZonePvpNetId(room, projectile.ownerId),
                    Math.round(Number(projectile.x || 0) * 10) / 10,
                    Math.round(Number(projectile.y || 0) * 10) / 10,
                    Math.round(Number(projectile.vx || 0) * 10) / 10,
                    Math.round(Number(projectile.vy || 0) * 10) / 10,
                    Math.round(Number(projectile.angle || 0) * 10000) / 10000,
                    flags,
                    Number(projectile.createdAt || now),
                    normalizeSkin(projectile.skin || "cyan"),
                ];
            });
            socket.volatile.compress(false).emit("zone-pvp:movement", {
                r: room.id,
                rd: room.roundId || null,
                pv: Number(room.phaseVersion || 0),
                s: sequence,
                t: now,
                p: playerRows,
                q: projectileRows,
            });
        }
    }
    broadcastZonePvpRoomState(room, now, reliable = false) {
        const players = [...room.players.values()];
        const alivePlayers = players.filter((player) => player.alive);
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const zonePvpCountdown = room.status === "countdown" && room.countdownStartedAt
            ? Math.max(1, Math.ceil((ZONE_PVP_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) /
                1000))
            : null;
        const battlePrepareRemainingMs = room.battlePrepareUntil
            ? Math.max(0, room.battlePrepareUntil - now)
            : 0;
        const includeStaticState = !room.lastStaticStateAt ||
            now - room.lastStaticStateAt >= STATIC_STATE_INTERVAL_MS;
        if (includeStaticState) {
            room.lastStaticStateAt = now;
        }
        let leaderboard = [];
        let minimapOrbs = [];
        let minimapEnergyCells = [];
        let minimapCores = [];
        if (includeStaticState) {
            leaderboard = players
                .slice()
                .sort((a, b) => (b.kills || 0) - (a.kills || 0) ||
                (b.totalCollected || 0) - (a.totalCollected || 0))
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
        const secondsUntilCoreDrop = room.cores.length === 0 && room.nextCoreWaveAt
            ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
            : null;
        const coreDropCountdown = secondsUntilCoreDrop &&
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
            if (!socket)
                continue;
            const aliveOthers = players.filter((other) => other.id !== player.id && other.alive !== false);
            const spectatorTarget = player.alive === false
                ? this.getStableSpectatorTarget(room, player)
                : null;
            if (player.alive === false) {
                player.spectatorTargetId = spectatorTarget?.id || null;
            }
            else {
                player.spectatorTargetId = null;
                player.killedById = null;
            }
            const viewAnchor = spectatorTarget || player;
            const includeViewportItems = !player.lastViewportItemStateAt ||
                now - player.lastViewportItemStateAt >= VIEWPORT_ITEM_STATE_INTERVAL_MS;
            if (includeViewportItems)
                player.lastViewportItemStateAt = now;
            const includeEntityDefinitions = reliable ||
                !player.lastZoneEntityDefinitionAt ||
                now - player.lastZoneEntityDefinitionAt >= ZONE_ENTITY_DEFINITION_INTERVAL_MS;
            if (includeEntityDefinitions)
                player.lastZoneEntityDefinitionAt = now;
            const includeProjectileDefinitions = reliable ||
                !player.lastZoneProjectileDefinitionAt ||
                now - player.lastZoneProjectileDefinitionAt >= ZONE_PROJECTILE_DEFINITION_INTERVAL_MS;
            if (includeProjectileDefinitions)
                player.lastZoneProjectileDefinitionAt = now;
            const playerCandidates = this.querySpatialIndex(playerIndex, viewAnchor.x, viewAnchor.y, player.alive === false ? VIEW_DISTANCE + 1500 : VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING);
            const visiblePlayers = includeEntityDefinitions
                ? this.filterNear(viewAnchor, playerCandidates.filter((other) => other.id !== player.id && (player.alive !== false || other.alive !== false)), player.alive === false ? VIEW_DISTANCE + 1500 : VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING, ZONE_TRANSFORM_PLAYER_LIMIT).map((other) => this.serializeZonePvpStatePlayer(room, other))
                : undefined;
            const payload = {
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
                you: this.serializeZonePvpStatePlayer(room, player),
                players: visiblePlayers,
                spectatorTargetId: spectatorTarget?.id || null,
                spectatingPlayer: spectatorTarget
                    ? this.serializeZonePvpStatePlayer(room, spectatorTarget)
                    : null,
                projectiles: includeProjectileDefinitions
                    ? (room.projectileSpatialIndex
                        ? this.filterNearIndexed(viewAnchor, room.projectileSpatialIndex, VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING, ZONE_TRANSFORM_PROJECTILE_LIMIT)
                        : this.filterNear(viewAnchor, room.projectiles, VIEW_DISTANCE + ZONE_TRANSFORM_RANGE_PADDING, ZONE_TRANSFORM_PROJECTILE_LIMIT)).map((projectile) => this.serializeZonePvpStateProjectile(room, projectile))
                    : undefined,
                combatEvents: (room.combatEvents || [])
                    .filter((event) => {
                    const age = now - Number(event?.createdAt || 0);
                    if (age < 0 || age >= Number(event?.ttl || 2000))
                        return false;
                    if (event?.viewerId !== player.id)
                        return false;
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
            }
            else {
                socket.volatile.emit("zone-pvp:state", payload);
            }
        }
    }
    findOrCreateRoom() {
        const joinableRoom = this.selectMostPopulatedJoinableRoom(this.rooms, (room) => room.status !== "playing" &&
            room.status !== "finished" &&
            room.players.size < ROOM_MAX_PLAYERS);
        if (joinableRoom)
            return joinableRoom;
        const room = {
            id: crypto.randomUUID(),
            status: "waiting",
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(ZONE_START_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(ZONE_START_RADIUS)),
            cores: Array.from({ length: CORE_WAVE_SIZE }, () => this.createCore(ZONE_START_RADIUS)),
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
        if (!roomId)
            return null;
        return this.rooms.get(roomId) || null;
    }
    removePlayer(socketId) {
        const roomId = this.socketRoom.get(socketId);
        if (!roomId)
            return;
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
        if (room.status === "finished" &&
            room.finishedAt &&
            now - room.finishedAt > 90000) {
            this.rooms.delete(room.id);
        }
    }
    getSafeZoneRadius(room) {
        if (!room.matchStartedAt)
            return ZONE_START_RADIUS;
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
                x: this.clamp(existing[0].x + 520, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
                y: this.clamp(existing[0].y + 60, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
            };
        }
        for (let attempt = 0; attempt < 100; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * Math.max(500, zoneRadius - 1200);
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
    createOrb(zoneRadius, nearX, nearY) {
        const point = nearX !== undefined && nearY !== undefined
            ? this.randomSafePointNear(nearX, nearY, zoneRadius, 120, 420, 1500)
            : this.randomSafePoint(zoneRadius, 120);
        return {
            id: crypto.randomUUID(),
            x: point.x,
            y: point.y,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
    }
    createEnergyCell(zoneRadius, nearX, nearY) {
        const point = nearX !== undefined && nearY !== undefined
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
        if (room?.normalMode) {
            for (const player of alive) {
                this.ensureNormalEnergyCellsNearPlayer(room, player);
            }
            return;
        }
        for (const player of alive) {
            const nearbyOrbs = room.orbs.filter((orb) => this.isNear(player, orb, 1800)).length;
            const nearbyEnergy = room.energyCells.filter((cell) => this.isNear(player, cell, 1800)).length;
            const crowdedNormalRoom = Boolean(room.normalMode && alive.length >= NORMAL_HIGH_POPULATION_THRESHOLD);
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
            if (nearbyOrbs < orbTargetNearPlayer &&
                room.orbs.length < MAX_ORBS + alive.length * orbExtraCap) {
                const toAdd = Math.min(orbTargetNearPlayer - nearbyOrbs, orbAddLimit);
                for (let i = 0; i < toAdd; i += 1) {
                    room.orbs.push(this.createOrb(zoneRadius, player.x, player.y));
                }
            }
            if (nearbyEnergy < energyTargetNearPlayer &&
                room.energyCells.length <
                    MAX_ENERGY_CELLS + alive.length * energyExtraCap) {
                const toAdd = Math.min(energyTargetNearPlayer - nearbyEnergy, energyAddLimit);
                for (let i = 0; i < toAdd; i += 1) {
                    room.energyCells.push(this.createEnergyCell(zoneRadius, player.x, player.y));
                }
            }
        }
        const crowdedNormalRoom = Boolean(room.normalMode && alive.length >= NORMAL_HIGH_POPULATION_THRESHOLD);
        const orbExtraCap = room.zonePvpMode
            ? 18
            : crowdedNormalRoom
                ? NORMAL_CROWDED_ORB_EXTRA_CAP
                : 90;
        const energyExtraCap = room.zonePvpMode ? 2 : 6;
        if (room.orbs.length > MAX_ORBS + alive.length * orbExtraCap) {
            room.orbs = room.orbs.slice(-(MAX_ORBS + alive.length * orbExtraCap));
        }
        if (room.energyCells.length >
            MAX_ENERGY_CELLS + alive.length * energyExtraCap) {
            room.energyCells = room.energyCells.slice(-(MAX_ENERGY_CELLS + alive.length * energyExtraCap));
        }
    }
    randomSafePointNear(nearX, nearY, zoneRadius, margin = 120, minDistance = 300, maxDistance = 1400) {
        for (let attempt = 0; attempt < 90; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * Math.max(1, maxDistance - minDistance);
            const x = nearX + Math.cos(angle) * distance;
            const y = nearY + Math.sin(angle) * distance;
            const insideWorld = x >= PLAYER_RADIUS &&
                x <= WORLD_WIDTH - PLAYER_RADIUS &&
                y >= PLAYER_RADIUS &&
                y <= WORLD_HEIGHT - PLAYER_RADIUS;
            const validPoint = zoneRadius >= Math.min(WORLD_WIDTH, WORLD_HEIGHT)
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
                x: this.clamp(margin + Math.random() * Math.max(1, WORLD_WIDTH - margin * 2), PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
                y: this.clamp(margin + Math.random() * Math.max(1, WORLD_HEIGHT - margin * 2), PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
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
        if (distance <= maxDistance)
            return { x, y };
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
    buildSpatialIndex(items = [], cellSize = ITEM_SPATIAL_CELL_SIZE) {
        const index = new Map();
        for (const item of items) {
            if (!item)
                continue;
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
        if (!index)
            return [];
        const minCellX = Math.floor((x - radius) / cellSize);
        const maxCellX = Math.floor((x + radius) / cellSize);
        const minCellY = Math.floor((y - radius) / cellSize);
        const maxCellY = Math.floor((y + radius) / cellSize);
        const result = [];
        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
                const bucket = index.get(`${cellX}:${cellY}`);
                if (bucket)
                    result.push(...bucket);
            }
        }
        return result;
    }
    refreshRoomSpatialIndexes(room, now = Date.now(), forceStatic = false) {
        const staticIndexExpired = !room.orbSpatialIndex ||
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
        room.projectileSpatialIndex = this.buildSpatialIndex(room.projectiles);
    }
    filterNearIndexed(player, index, distance, limit) {
        return this.filterNear(player, this.querySpatialIndex(index, player.x || 0, player.y || 0, distance), distance, limit);
    }
    filterNear(player, items, distance, limit) {
        const distanceSq = distance * distance;
        const nearby = [];
        for (const item of items || []) {
            const dx = (item.x || 0) - (player.x || 0);
            const dy = (item.y || 0) - (player.y || 0);
            const distSq = dx * dx + dy * dy;
            if (distSq > distanceSq)
                continue;
            const entry = { item, distSq };
            let insertAt = nearby.length;
            while (insertAt > 0 && nearby[insertAt - 1].distSq > distSq) {
                insertAt -= 1;
            }
            if (insertAt >= limit && nearby.length >= limit)
                continue;
            nearby.splice(insertAt, 0, entry);
            if (nearby.length > limit)
                nearby.pop();
        }
        return nearby.map((entry) => entry.item);
    }
    getAlivePlayers(room) {
        return [...room.players.values()].filter((player) => player.alive);
    }
    sanitizeCoordinate(value, fallback, min, max) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric))
            return fallback;
        return this.clamp(numeric, min, max);
    }
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)("pvp:join"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePvpJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("pvp:leave"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePvpLeave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("pvp:input"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePvpInput", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("normal-pvp:join"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleNormalPvpJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("normal-pvp:leave"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleNormalPvpLeave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("normal-pvp:input"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleNormalPvpInput", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("battle-royale-online:join"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleBattleRoyaleOnlineJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("battle-royale-online:leave"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleBattleRoyaleOnlineLeave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("battle-royale-online:input"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleBattleRoyaleOnlineInput", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:join"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:resync"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpResync", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:leave"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpLeave", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:input"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpInput", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:input-stop"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpInputStop", null);
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: true,
            credentials: false,
        },
        transports: ["websocket", "polling"],
        allowUpgrades: true,
        perMessageDeflate: false,
        httpCompression: false,
        pingInterval: 25000,
        pingTimeout: 60000,
        connectionStateRecovery: {
            maxDisconnectionDuration: 180000,
            skipMiddlewares: true,
        },
    }),
    __metadata("design:paramtypes", [])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map