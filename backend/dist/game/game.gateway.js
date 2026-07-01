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
const client_1 = require("@prisma/client");
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
const ZONE_PVP_ROOM_MIN_PLAYERS = 3;
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
const ZONE_PVP_BOT_OPENING_ORB_FARM_MS = ZONE_PVP_BATTLE_PREPARE_DURATION;
const CORE_HEIST_MODE = "core-heist";
const CORE_HEIST_ROOM_MAX_PLAYERS = 8;
const CORE_HEIST_ROOM_MIN_PLAYERS = 1;
const CORE_HEIST_START_COUNTDOWN_MS = 5000;
const CORE_HEIST_ROLE_REVEAL_DURATION = 5000;
const CORE_HEIST_BATTLE_PREPARE_DURATION = 20000;
const CORE_HEIST_MATCH_DURATION_MS = 10 * 60 * 1000;
const CORE_HEIST_TARGET_SCORE = 3;
const CORE_HEIST_RESPAWN_MS = 3500;
const CORE_HEIST_FLAG_PICKUP_DISTANCE = 215;
const CORE_HEIST_BASE_CAPTURE_RADIUS = 520;
const CORE_HEIST_FLAG_RETURN_MS = 12000;
const CORE_HEIST_CARRIER_SPEED_MULTIPLIER = 0.80;
const CORE_HEIST_BOT_TARGET_TOTAL = CORE_HEIST_ROOM_MAX_PLAYERS;
const CORE_HEIST_BASE_X_OFFSET = 2200;
const CORE_HEIST_BASE_Y_OFFSET = 0;
const CORE_HEIST_BASE_RADIUS = 520;
const CORE_HEIST_BASE_PERIMETER_RADIUS = 860;
const CORE_HEIST_MAX_DEATHS = 2;
const CORE_HEIST_OPENING_ORBS_PER_BASE = 100;
const CORE_HEIST_MIDFIELD_ORB_COUNT = 400;
const CORE_HEIST_OPENING_ENERGY_PER_BASE = 35;
const CORE_HEIST_MIDFIELD_ENERGY_COUNT = 180;
const CORE_HEIST_BASE_CLOSE_ORBS_PER_BASE = 46;
const CORE_HEIST_BASE_CLOSE_ENERGY_PER_BASE = 20;
const CORE_HEIST_ORB_TARGET = 960;
const CORE_HEIST_ENERGY_TARGET = 360;
const CORE_HEIST_ORB_COLLECT_DISTANCE = 235;
const CORE_HEIST_ENERGY_COLLECT_DISTANCE = 210;
const CORE_HEIST_BOT_HOME_THREAT_RADIUS = 2700;
const CORE_HEIST_BOT_HOME_FARM_RADIUS = 2300;
const CORE_HEIST_BOT_PREPARE_ENERGY_TARGET = 88;
const CORE_HEIST_BOT_LOW_ENERGY = 62;
const CORE_HEIST_BOT_TANK_MIN_DRONES = 4;
const CORE_HEIST_BOT_ATTACKER_MIN_DRONES = 2;
const CORE_HEIST_BOT_DEFENDER_MIN_DRONES = 5;
const CORE_HEIST_BOT_DEFENDER_ENERGY_TARGET = 86;
const CORE_HEIST_BOT_DEFENDER_PATROL_RADIUS = 720;
const CORE_HEIST_BOT_DEFENDER_PATROL_ARRIVAL_RADIUS = 155;
const CORE_HEIST_EVENT_LOG_LIMIT = 12;
const CORE_HEIST_EVENT_TTL_MS = 6500;
const CORE_HEIST_STATE_INTERVAL_MS = 140;
const CORE_HEIST_BOT_REPLAN_MIN_MS = 360;
const CORE_HEIST_BOT_REPLAN_MAX_MS = 480;
const CORE_HEIST_BOT_RESOURCE_LOCK_MS = 4500;
const CORE_HEIST_BOT_STEER_BLEND = 0.105;
const CORE_HEIST_BOT_EMERGENCY_STEER_BLEND = 0.24;
const CORE_HEIST_BOT_ARRIVAL_RADIUS = 112;
const CORE_HEIST_TANK_HP = 150;
const CORE_HEIST_DEFENDER_HP_REGEN_PER_SECOND = 9;
const CORE_HEIST_DEFENDER_ENERGY_REGEN_PER_SECOND = 16;
const CORE_HEIST_DEFENDER_GUARD_RADIUS_BONUS = 160;
const ZONE_PVP_BOT_REPLAN_MIN_MS = 110;
const ZONE_PVP_BOT_REPLAN_MAX_MS = 210;
const ZONE_PVP_BOT_ATTACK_RANGE = 2180;
const ZONE_PVP_BOT_GLOBAL_HUNT_RANGE = 11800;
const ZONE_PVP_BOT_SAFE_DISTANCE = 690;
const ZONE_PVP_BOT_THREAT_RADIUS = 2350;
const ZONE_PVP_BOT_ZONE_EDGE_BUFFER = 720;
const ZONE_PVP_BOT_SPAWN_MIN_DISTANCE = 1000;
const ZONE_PVP_BOT_FARM_AVOID_RADIUS = 700;
const ZONE_PVP_BOT_TACTICAL_AVOID_RADIUS = 500;
const ZONE_PVP_BOT_ENDGAME_AVOID_RADIUS = 340;
const ZONE_PVP_BOT_PROJECTILE_WARNING_RANGE = 620;
const ZONE_PVP_BOT_ORB_CLAIM_PENALTY = 1050;
const ZONE_PVP_BOT_FARM_VIEW_RANGE = 5600;
const ZONE_PVP_BOT_LOW_HP = 30;
const ZONE_PVP_BOT_LOW_ENERGY = 28;
const ZONE_PVP_BOT_FAST_FIRE_COOLDOWN = 780;
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
const ZONE_TRANSFORM_INTERVAL_MS = 20;
const ZONE_TRANSFORM_PLAYER_LIMIT = 60;
const ZONE_TRANSFORM_PROJECTILE_LIMIT = 36;
const ZONE_TRANSFORM_RANGE_PADDING = 820;
const ZONE_WORLD_DELTA_INTERVAL_MS = 250;
const ZONE_LOOT_TICK_INTERVAL_MS = 34;
const ZONE_COLLISION_TICK_INTERVAL_MS = 34;
const ZONE_ITEM_MAINTENANCE_INTERVAL_MS = 260;
const ZONE_TRANSFORM_PROTOCOL_VERSION = 1;
const ZONE_TRANSFORM_PLAYER_BYTES = 32;
const ZONE_TRANSFORM_PROJECTILE_BYTES = 28;
const STATIC_STATE_INTERVAL_MS = 1400;
const VIEWPORT_ITEM_STATE_INTERVAL_MS = 320;
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
const NORMAL_PVP_RECONNECT_GRACE_MS = 600000;
const ZONE_PVP_RECONNECT_GRACE_MS = 600000;
const ZONE_PVP_FINISH_DISPLAY_MS = 2800;
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
const GAME_STATS_MODE_NORMAL_PVP = "normal-pvp";
const GAME_STATS_MODE_BATTLE_ROYALE_PVE = "battle-royale-pve";
const GAME_STATS_MODE_BATTLE_ROYALE_PVP = "battle-royale-pvp";
const GAME_STATS_LEADERBOARD_LIMIT = 10;
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
        this.normalPvpResumeSeats = new Map();
        this.normalPvpSocketResumeToken = new Map();
        this.battleRoyaleOnlineRooms = new Map();
        this.battleRoyaleOnlineSocketRoom = new Map();
        this.zonePvpRooms = new Map();
        this.zonePvpSocketRoom = new Map();
        this.zonePvpResumeSeats = new Map();
        this.zonePvpSocketResumeToken = new Map();
        this.prisma = new client_1.PrismaClient();
        this.loop = null;
        this.lastLoopAt = Date.now();
    }
    normalizeGameStatsMode(value) {
        const mode = String(value || "").trim().toLowerCase();
        if (mode === GAME_STATS_MODE_NORMAL_PVP ||
            mode === GAME_STATS_MODE_BATTLE_ROYALE_PVE ||
            mode === GAME_STATS_MODE_BATTLE_ROYALE_PVP) {
            return mode;
        }
        return null;
    }
    normalizeGameStatsUserId(value) {
        const userId = Number(value);
        return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
    }
    normalizeGameStatsGuestKey(value) {
        const guestKey = String(value || "").trim();
        if (guestKey.length < 16 ||
            guestKey.length > 160 ||
            !/^[A-Za-z0-9_-]+$/.test(guestKey)) {
            return null;
        }
        return guestKey;
    }
    getGameStatsDisplayName(user, fallback = "Player") {
        const fromUsername = String(user?.username || "").trim();
        if (fromUsername)
            return fromUsername.slice(0, 18);
        const fromFirstName = String(user?.firstName || "").trim();
        if (fromFirstName)
            return fromFirstName.slice(0, 18);
        const emailName = String(user?.email || "").split("@")[0].trim();
        return (emailName || fallback).slice(0, 18);
    }
    emptyGameModeStat(gameMode) {
        return {
            gameMode,
            bestKills: 0,
            wins: 0,
        };
    }
    getGameStatsLeaderboardOrder(gameMode) {
        if (gameMode === GAME_STATS_MODE_BATTLE_ROYALE_PVP) {
            return [
                { wins: "desc" },
                { bestKills: "desc" },
                { updatedAt: "asc" },
            ];
        }
        return [
            { bestKills: "desc" },
            { updatedAt: "asc" },
        ];
    }
    async pruneGuestStatsOutsideTop(gameMode) {
        const db = this.prisma;
        try {
            const leaders = await db.gameModeStat.findMany({
                where: { gameMode },
                orderBy: this.getGameStatsLeaderboardOrder(gameMode),
                take: GAME_STATS_LEADERBOARD_LIMIT,
                select: { id: true },
            });
            const keptIds = (leaders || [])
                .map((row) => Number(row?.id || 0))
                .filter((id) => id > 0);
            await db.gameModeStat.deleteMany({
                where: keptIds.length
                    ? {
                        gameMode,
                        isGuest: true,
                        id: { notIn: keptIds },
                    }
                    : {
                        gameMode,
                        isGuest: true,
                    },
            });
        }
        catch (error) {
            console.warn("[game-stats] guest leaderboard prune skipped", error);
        }
    }
    notifyGameStatsLeaderboardsChanged() {
        this.server?.emit("game-stats:leaderboards-updated", {
            serverNow: Date.now(),
        });
    }
    async persistGameModeStat(input) {
        const gameMode = this.normalizeGameStatsMode(input?.gameMode);
        const isGuest = Boolean(input?.isGuest);
        const userId = isGuest ? null : this.normalizeGameStatsUserId(input?.userId);
        const guestKey = isGuest
            ? this.normalizeGameStatsGuestKey(input?.guestKey)
            : null;
        if (!gameMode ||
            (!isGuest && !userId) ||
            (isGuest && (!guestKey || gameMode === GAME_STATS_MODE_BATTLE_ROYALE_PVE))) {
            return null;
        }
        const kills = Math.max(0, Math.floor(Number(input?.kills || 0)));
        const won = Boolean(input?.won);
        const db = this.prisma;
        try {
            if (isGuest) {
                const username = this.getGameStatsDisplayName({ username: input?.username }, "Guest");
                const existing = await db.gameModeStat.findFirst({
                    where: {
                        guestKey,
                        gameMode,
                        isGuest: true,
                    },
                });
                const stat = existing
                    ? await db.gameModeStat.update({
                        where: { id: existing.id },
                        data: {
                            username,
                            bestKills: Math.max(Number(existing.bestKills || 0), kills),
                            wins: won ? { increment: 1 } : undefined,
                        },
                    })
                    : await db.gameModeStat.create({
                        data: {
                            userId: null,
                            guestKey,
                            isGuest: true,
                            username,
                            gameMode,
                            bestKills: kills,
                            wins: won ? 1 : 0,
                        },
                    });
                await this.pruneGuestStatsOutsideTop(gameMode);
                this.notifyGameStatsLeaderboardsChanged();
                return stat;
            }
            const user = await db.gameUser.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    email: true,
                },
            });
            if (!user)
                return null;
            const username = this.getGameStatsDisplayName(user);
            const existing = await db.gameModeStat.findUnique({
                where: {
                    userId_gameMode: {
                        userId,
                        gameMode,
                    },
                },
            });
            if (!existing) {
                const stat = await db.gameModeStat.create({
                    data: {
                        userId,
                        guestKey: null,
                        isGuest: false,
                        username,
                        gameMode,
                        bestKills: kills,
                        wins: won ? 1 : 0,
                    },
                });
                this.notifyGameStatsLeaderboardsChanged();
                return stat;
            }
            const stat = await db.gameModeStat.update({
                where: { id: existing.id },
                data: {
                    username,
                    guestKey: null,
                    isGuest: false,
                    bestKills: Math.max(Number(existing.bestKills || 0), kills),
                    wins: won ? { increment: 1 } : undefined,
                },
            });
            this.notifyGameStatsLeaderboardsChanged();
            return stat;
        }
        catch (error) {
            console.warn("[game-stats] persistence skipped", error);
            return null;
        }
    }
    async getGameStatsPayload(rawUserId) {
        const userId = this.normalizeGameStatsUserId(rawUserId);
        const empty = {
            normalPvp: this.emptyGameModeStat(GAME_STATS_MODE_NORMAL_PVP),
            battleRoyalePve: this.emptyGameModeStat(GAME_STATS_MODE_BATTLE_ROYALE_PVE),
            battleRoyalePvp: this.emptyGameModeStat(GAME_STATS_MODE_BATTLE_ROYALE_PVP),
        };
        const db = this.prisma;
        try {
            const [personalRows, normalPvp, battleRoyalePvp] = await Promise.all([
                userId
                    ? db.gameModeStat.findMany({
                        where: {
                            userId,
                            isGuest: false,
                        },
                        select: {
                            gameMode: true,
                            bestKills: true,
                            wins: true,
                        },
                    })
                    : Promise.resolve([]),
                db.gameModeStat.findMany({
                    where: { gameMode: GAME_STATS_MODE_NORMAL_PVP },
                    orderBy: this.getGameStatsLeaderboardOrder(GAME_STATS_MODE_NORMAL_PVP),
                    take: GAME_STATS_LEADERBOARD_LIMIT,
                    select: {
                        userId: true,
                        guestKey: true,
                        isGuest: true,
                        username: true,
                        bestKills: true,
                        wins: true,
                    },
                }),
                db.gameModeStat.findMany({
                    where: { gameMode: GAME_STATS_MODE_BATTLE_ROYALE_PVP },
                    orderBy: this.getGameStatsLeaderboardOrder(GAME_STATS_MODE_BATTLE_ROYALE_PVP),
                    take: GAME_STATS_LEADERBOARD_LIMIT,
                    select: {
                        userId: true,
                        guestKey: true,
                        isGuest: true,
                        username: true,
                        bestKills: true,
                        wins: true,
                    },
                }),
            ]);
            for (const row of personalRows || []) {
                const stat = {
                    gameMode: row.gameMode,
                    bestKills: Number(row.bestKills || 0),
                    wins: Number(row.wins || 0),
                };
                if (row.gameMode === GAME_STATS_MODE_NORMAL_PVP)
                    empty.normalPvp = stat;
                if (row.gameMode === GAME_STATS_MODE_BATTLE_ROYALE_PVE)
                    empty.battleRoyalePve = stat;
                if (row.gameMode === GAME_STATS_MODE_BATTLE_ROYALE_PVP)
                    empty.battleRoyalePvp = stat;
            }
            return {
                personal: empty,
                leaderboards: {
                    normalPvp: normalPvp || [],
                    battleRoyalePvp: battleRoyalePvp || [],
                },
            };
        }
        catch (error) {
            console.warn("[game-stats] read skipped", error);
            return {
                personal: empty,
                leaderboards: {
                    normalPvp: [],
                    battleRoyalePvp: [],
                },
            };
        }
    }
    async emitGameStatsPayload(client, userId, event = "game-stats:payload") {
        const payload = await this.getGameStatsPayload(userId);
        client.emit(event, payload);
        return payload;
    }
    recordLivePvpLeaderboardScore(player, room) {
        if (!player ||
            player?.isBot ||
            (!room?.normalMode && !room?.zonePvpMode)) {
            return;
        }
        void this.persistGameModeStat({
            userId: player.userId,
            guestKey: player.guestStatsKey,
            username: player.username,
            isGuest: player.isGuest,
            gameMode: room.normalMode
                ? GAME_STATS_MODE_NORMAL_PVP
                : GAME_STATS_MODE_BATTLE_ROYALE_PVP,
            kills: player.kills,
            won: false,
        });
    }
    recordNormalPvpBest(player) {
        if (!player || player?.isBot || player?.normalStatsRecorded)
            return;
        player.normalStatsRecorded = true;
        void this.persistGameModeStat({
            userId: player.userId,
            guestKey: player.guestStatsKey,
            username: player.username,
            isGuest: player.isGuest,
            gameMode: GAME_STATS_MODE_NORMAL_PVP,
            kills: player.kills,
            won: false,
        });
    }
    recordZonePvpParticipant(player, winnerId = null) {
        if (!player || player?.isBot || player?.zoneStatsRecorded)
            return;
        player.zoneStatsRecorded = true;
        void this.persistGameModeStat({
            userId: player.userId,
            guestKey: player.guestStatsKey,
            username: player.username,
            isGuest: player.isGuest,
            gameMode: GAME_STATS_MODE_BATTLE_ROYALE_PVP,
            kills: player.kills,
            won: winnerId !== null && String(player.id) === String(winnerId),
        });
    }
    recordZonePvpMatch(room, winner) {
        if (!room || room?.zoneStatsRecorded)
            return;
        room.zoneStatsRecorded = true;
        for (const player of room.players?.values?.() || []) {
            this.recordZonePvpParticipant(player, winner?.id || null);
        }
    }
    async handleGameStatsGet(client, data) {
        await this.emitGameStatsPayload(client, data?.userId, "game-stats:payload");
    }
    async handleGameStatsRecordPve(client, data) {
        const stat = await this.persistGameModeStat({
            userId: data?.userId,
            guestKey: data?.guestKey,
            username: data?.username,
            isGuest: Boolean(data?.isGuest),
            gameMode: GAME_STATS_MODE_BATTLE_ROYALE_PVE,
            kills: data?.kills,
            won: data?.won,
        });
        if (stat) {
            await this.emitGameStatsPayload(client, data?.userId, "game-stats:updated");
        }
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
    getZoneConnectedHumanPlayerCount(room) {
        let count = 0;
        for (const player of room?.players?.values?.() || []) {
            if (player?.isBot || Number(player?.disconnectedAt || 0) > 0)
                continue;
            if (this.server?.sockets?.sockets?.has(String(player.id)))
                count += 1;
        }
        return count;
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
            team: room?.coreHeistMode ? String(player?.team || "cyan") : null,
            carryingHeistFlag: Boolean(room?.coreHeistMode && player?.heistFlagId),
            heistFlagId: room?.coreHeistMode ? String(player?.heistFlagId || "") || null : null,
            heistDeaths: room?.coreHeistMode ? Number(player?.heistDeaths || 0) : 0,
            heistPermanentElimination: Boolean(room?.coreHeistMode && player?.heistPermanentElimination),
            heistRole: room?.coreHeistMode ? String(player?.heistRole || "attacker") : null,
            respawnAt: room?.coreHeistMode ? Number(player?.respawnAt || 0) : 0,
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
    normalizeZonePvpParticipantId(value) {
        return this.normalizeZonePvpResumeToken(value);
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
    enforceZonePvpDeparture(roomId, participantId, userId, resumeToken) {
        const room = this.zonePvpRooms.get(String(roomId || ""));
        if (!room || room.closedAt)
            return;
        if (participantId) {
            if (!(room.departedParticipantIds instanceof Set)) {
                room.departedParticipantIds = new Set();
            }
            room.departedParticipantIds.add(String(participantId));
        }
        if (userId) {
            if (!(room.departedUserIds instanceof Set)) {
                room.departedUserIds = new Set();
            }
            room.departedUserIds.add(String(userId));
        }
        let departedPlayer = null;
        if (resumeToken) {
            const seat = this.findZonePvpResumeSeat(resumeToken);
            if (seat?.room?.id === room.id)
                departedPlayer = seat.player;
        }
        if (!departedPlayer && participantId) {
            departedPlayer = [...room.players.values()].find((candidate) => !candidate?.isBot &&
                String(candidate?.participantId || "") === String(participantId));
        }
        if (departedPlayer && !departedPlayer.isBot) {
            const departedSocketId = String(departedPlayer.id);
            if (!this.zonePvpSocketRoom.has(departedSocketId)) {
                this.zonePvpSocketRoom.set(departedSocketId, room.id);
            }
            this.removeZonePvpPlayer(departedSocketId, {
                explicit: true,
                participantId,
            });
        }
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
    getZonePvpBattlePhase(room, now, zoneRadius, aliveCount) {
        if (this.isBattlePrepareLocked(room, now))
            return "prepare";
        if (aliveCount <= 12 || zoneRadius <= 1350)
            return "endgame";
        if (aliveCount <= 28 || zoneRadius <= 3600)
            return "midgame";
        return "skirmish";
    }
    getZoneBotAvoidance(bot, alive, radius) {
        let x = 0;
        let y = 0;
        for (const other of alive) {
            if (!other || other.id === bot.id)
                continue;
            const dx = Number(bot.x || 0) - Number(other.x || 0);
            const dy = Number(bot.y || 0) - Number(other.y || 0);
            const distance = Math.hypot(dx, dy) || 1;
            if (distance >= radius)
                continue;
            const ratio = (radius - distance) / radius;
            const strength = ratio * ratio;
            x += (dx / distance) * strength;
            y += (dy / distance) * strength;
        }
        return { x, y };
    }
    getZoneBotIncomingProjectileThreat(room, bot) {
        let nearestDistance = Infinity;
        let severity = 0;
        for (const projectile of room?.projectiles || []) {
            if (!projectile || String(projectile.ownerId || "") === String(bot.id))
                continue;
            const dx = Number(bot.x || 0) - Number(projectile.x || 0);
            const dy = Number(bot.y || 0) - Number(projectile.y || 0);
            const distance = Math.hypot(dx, dy) || 1;
            if (distance > ZONE_PVP_BOT_PROJECTILE_WARNING_RANGE)
                continue;
            const velocityLength = Math.hypot(Number(projectile.vx || 0), Number(projectile.vy || 0)) || 1;
            const approaching = (Number(projectile.vx || 0) * dx + Number(projectile.vy || 0) * dy) /
                (velocityLength * distance);
            if (approaching <= 0.22)
                continue;
            nearestDistance = Math.min(nearestDistance, distance);
            severity = Math.max(severity, (1 - distance / ZONE_PVP_BOT_PROJECTILE_WARNING_RANGE) * approaching);
        }
        return {
            incoming: Number.isFinite(nearestDistance),
            distance: nearestDistance,
            severity,
        };
    }
    getZoneBotAimPoint(bot, target, room) {
        const dx = Number(target?.x || 0) - Number(bot?.x || 0);
        const dy = Number(target?.y || 0) - Number(bot?.y || 0);
        const distance = Math.hypot(dx, dy);
        const projectileSpeedPerSecond = (PROJECTILE_SPEED +
            Number(bot?.projectileSpeedBonus || 0) +
            (bot?.rapidFireUntil && bot.rapidFireUntil > Date.now() ? 0.75 : 0) +
            (bot?.overclockUntil && bot.overclockUntil > Date.now() ? 1.25 : 0)) *
            (this.usesProgressionPvpCombat(room)
                ? NORMAL_BASE_ATTACK_DRONE_SPEED_MULTIPLIER *
                    Math.max(1, Number(bot?.attackDroneSpeedMultiplier || 1))
                : 1) *
            60;
        const leadSeconds = Math.max(0, Math.min(1.15, distance / Math.max(1, projectileSpeedPerSecond)));
        const x = Number(target?.x || 0) + Number(target?.velocityX || 0) * leadSeconds;
        const y = Number(target?.y || 0) + Number(target?.velocityY || 0) * leadSeconds;
        return {
            x: this.clamp(x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
            y: this.clamp(y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
    }
    findZoneBotBestOrb(bot, room, zoneRadius, orbClaims, openingFarm) {
        const orbs = room?.orbs || [];
        const stride = openingFarm ? 1 : 2;
        let best = null;
        let bestScore = Infinity;
        const preferredAngle = Number(bot.aiFarmAngle || 0);
        for (let index = 0; index < orbs.length; index += stride) {
            const orb = orbs[index];
            if (!orb || !this.isInsideSafeZone(orb.x, orb.y, zoneRadius, ZONE_PVP_BOT_ZONE_EDGE_BUFFER))
                continue;
            const dx = Number(orb.x || 0) - Number(bot.x || 0);
            const dy = Number(orb.y || 0) - Number(bot.y || 0);
            const distance = Math.hypot(dx, dy);
            if (distance > ZONE_PVP_BOT_FARM_VIEW_RANGE)
                continue;
            const routeAngle = Math.atan2(dy, dx);
            const angleDelta = Math.abs(Math.atan2(Math.sin(routeAngle - preferredAngle), Math.cos(routeAngle - preferredAngle)));
            const claims = Number(orbClaims.get(String(orb.id)) || 0);
            let score = distance + angleDelta * 85;
            if (String(bot.aiTargetOrbId || "") === String(orb.id))
                score -= 280;
            if (claims > 0 && String(bot.aiTargetOrbId || "") !== String(orb.id)) {
                score += claims * ZONE_PVP_BOT_ORB_CLAIM_PENALTY;
            }
            if (score < bestScore) {
                bestScore = score;
                best = orb;
            }
        }
        return best;
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
            aiAggression: aiArchetype === "hunter"
                ? 1.42 + Math.random() * 0.22
                : aiArchetype === "raider"
                    ? 1.27 + Math.random() * 0.20
                    : 1.10 + Math.random() * 0.18,
            aiCourage: aiArchetype === "sentinel"
                ? 1.00 + Math.random() * 0.14
                : 1.16 + Math.random() * 0.22,
            aiSkill: 1.28 + Math.random() * 0.42,
            desiredDroneStock: index % 5 === 0 ? 2 : 1,
            preferredRange: aiArchetype === "hunter"
                ? 500 + Math.random() * 100
                : aiArchetype === "sentinel"
                    ? 720 + Math.random() * 140
                    : 600 + Math.random() * 120,
            aiHumanHuntBias: aiArchetype === "hunter"
                ? 1.0 + Math.random() * 0.40
                : aiArchetype === "raider"
                    ? 0.62 + Math.random() * 0.30
                    : 0.25 + Math.random() * 0.20,
            aiFarmAngle: (Math.PI * 2 * index) / Math.max(1, ZONE_PVP_BOT_TARGET_TOTAL - 1),
            botFireCooldown: ZONE_PVP_BOT_FAST_FIRE_COOLDOWN + (index % 5) * 35,
            aiPlanUntil: now + (index % 18) * 14 + Math.floor(Math.random() * 30),
            aiTargetEnemyId: null,
            aiTargetOrbId: null,
            aiTargetEnergyCellId: null,
            aiTargetCoreId: null,
            aiWanderAngle: Math.random() * Math.PI * 2,
            aiStrafeDir: index % 2 ? 1 : -1,
            aiState: "prepare-orb-farm",
        };
    }
    fillZonePvpBots(room, zoneRadius) {
        const target = room?.coreHeistMode
            ? CORE_HEIST_ROOM_MAX_PLAYERS
            : Math.max(0, Math.min(ZONE_PVP_BOT_TARGET_TOTAL, ZONE_PVP_ROOM_MAX_PLAYERS));
        let nextIndex = this.getZoneBotCount(room);
        while (room.players.size < target) {
            const bot = this.createZonePvpBot(room, nextIndex, zoneRadius);
            if (room?.coreHeistMode) {
                bot.team = this.assignCoreHeistTeam(room);
                bot.heistFlagId = null;
                bot.heistDeaths = 0;
                bot.heistPermanentElimination = false;
                bot.heistSpawnIndex = this.getCoreHeistTeamPlayers(room, bot.team).length;
                const spawn = this.getCoreHeistSpawn(room, bot.team, bot.heistSpawnIndex);
                bot.x = spawn.x;
                bot.y = spawn.y;
                bot.prevX = spawn.x;
                bot.prevY = spawn.y;
                bot.heistPlanUntil = 0;
            }
            room.players.set(bot.id, bot);
            nextIndex += 1;
        }
        if (room?.coreHeistMode) {
            this.assignCoreHeistTeamRoles(room);
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
        const alive = [...room.players.values()].filter((unit) => unit?.alive !== false);
        const phase = this.getZonePvpBattlePhase(room, now, zoneRadius, alive.length);
        const openingFarm = phase === "prepare";
        const centerX = WORLD_WIDTH * 0.5;
        const centerY = WORLD_HEIGHT * 0.5;
        const botCount = alive.reduce((count, unit) => count + (unit?.isBot ? 1 : 0), 0);
        const maxBotPlansThisTick = Math.max(7, Math.ceil(botCount / 6));
        let botPlansThisTick = 0;
        const orbClaims = new Map();
        for (const unit of alive) {
            if (!unit?.isBot || !unit?.aiTargetOrbId)
                continue;
            const key = String(unit.aiTargetOrbId);
            orbClaims.set(key, Number(orbClaims.get(key) || 0) + 1);
        }
        for (const bot of alive) {
            if (!bot?.isBot)
                continue;
            if (now < Number(bot.aiPlanUntil || 0))
                continue;
            if (botPlansThisTick >= maxBotPlansThisTick) {
                bot.aiPlanUntil = now + 12 + Math.floor(Math.random() * 14);
                continue;
            }
            botPlansThisTick += 1;
            const nextPlanMs = ZONE_PVP_BOT_REPLAN_MIN_MS +
                Math.floor(Math.random() * (ZONE_PVP_BOT_REPLAN_MAX_MS - ZONE_PVP_BOT_REPLAN_MIN_MS));
            bot.aiPlanUntil = now + nextPlanMs;
            bot.lastInputReceivedAt = now;
            bot.lastSeenAt = now;
            const centerDx = centerX - Number(bot.x || 0);
            const centerDy = centerY - Number(bot.y || 0);
            const centerDistance = Math.hypot(centerDx, centerDy) || 1;
            const zoneEdgeDistance = Number(zoneRadius || 0) - centerDistance;
            const zoneBuffer = Math.max(phase === "endgame" ? 185 : 330, Math.min(ZONE_PVP_BOT_ZONE_EDGE_BUFFER, Number(zoneRadius || ZONE_START_RADIUS) * (phase === "endgame" ? 0.20 : 0.12)));
            const avoidRadius = openingFarm
                ? ZONE_PVP_BOT_FARM_AVOID_RADIUS
                : phase === "endgame"
                    ? ZONE_PVP_BOT_ENDGAME_AVOID_RADIUS
                    : ZONE_PVP_BOT_TACTICAL_AVOID_RADIUS;
            const avoidance = this.getZoneBotAvoidance(bot, alive, avoidRadius);
            const projectileThreat = this.getZoneBotIncomingProjectileThreat(room, bot);
            if (zoneEdgeDistance < zoneBuffer) {
                const urgency = zoneEdgeDistance <= 0 ? 5.8 : 2.8 + (zoneBuffer - zoneEdgeDistance) / Math.max(1, zoneBuffer) * 2.4;
                const move = this.normalizeZoneBotMove((centerDx / centerDistance) * urgency + avoidance.x * 0.34, (centerDy / centerDistance) * urgency + avoidance.y * 0.34);
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: false,
                    shield: Boolean(projectileThreat.incoming &&
                        projectileThreat.distance < 360 &&
                        Number(bot.energy || 0) >= 20 &&
                        Number(bot.drones || 0) > 1),
                    mouseX: centerX,
                    mouseY: centerY,
                };
                bot.aiTargetEnemyId = null;
                bot.aiTargetOrbId = null;
                bot.aiTargetEnergyCellId = null;
                bot.aiTargetCoreId = null;
                bot.aiState = zoneEdgeDistance <= 0 ? "escape-zone-critical" : "escape-zone-smart";
                continue;
            }
            if (openingFarm) {
                const targetOrb = this.findZoneBotBestOrb(bot, room, zoneRadius, orbClaims, true);
                if (targetOrb) {
                    const previousOrbId = String(bot.aiTargetOrbId || "");
                    const nextOrbId = String(targetOrb.id || "");
                    if (previousOrbId && previousOrbId !== nextOrbId) {
                        const previousClaims = Number(orbClaims.get(previousOrbId) || 0);
                        if (previousClaims <= 1)
                            orbClaims.delete(previousOrbId);
                        else
                            orbClaims.set(previousOrbId, previousClaims - 1);
                    }
                    if (nextOrbId && previousOrbId !== nextOrbId) {
                        orbClaims.set(nextOrbId, Number(orbClaims.get(nextOrbId) || 0) + 1);
                    }
                    const route = this.normalizeZoneBotMove(Number(targetOrb.x || 0) - Number(bot.x || 0) + avoidance.x * 220, Number(targetOrb.y || 0) - Number(bot.y || 0) + avoidance.y * 220);
                    bot.input = {
                        mobileMove: true,
                        moveX: route.x,
                        moveY: route.y,
                        attacking: false,
                        shield: false,
                        mouseX: Number(targetOrb.x || bot.x),
                        mouseY: Number(targetOrb.y || bot.y),
                    };
                    bot.aiTargetEnemyId = null;
                    bot.aiTargetOrbId = targetOrb.id;
                    bot.aiTargetEnergyCellId = null;
                    bot.aiTargetCoreId = null;
                    bot.aiState = "prepare-orb-farm";
                }
                else {
                    const angle = Number(bot.aiFarmAngle || 0) + (Math.random() - 0.5) * 0.35;
                    bot.aiFarmAngle = angle;
                    const move = this.normalizeZoneBotMove(Math.cos(angle) + (centerDx / centerDistance) * 0.25 + avoidance.x, Math.sin(angle) + (centerDy / centerDistance) * 0.25 + avoidance.y);
                    bot.input = {
                        mobileMove: true,
                        moveX: move.x,
                        moveY: move.y,
                        attacking: false,
                        shield: false,
                        mouseX: Number(bot.x || 0) + move.x * 300,
                        mouseY: Number(bot.y || 0) + move.y * 300,
                    };
                    bot.aiTargetOrbId = null;
                    bot.aiState = "prepare-search-orbs";
                }
                continue;
            }
            const ownPower = this.getZoneBotPower(bot);
            let targetEnemy = null;
            let targetEnemyDistance = Infinity;
            let targetEnemyPower = 0;
            let targetEnemyScore = Infinity;
            let nearbyEnemyCount = 0;
            let strongerEnemyCount = 0;
            let weakestNearbyCount = 0;
            let nearestThreat = null;
            let nearestThreatDistance = Infinity;
            for (const other of alive) {
                if (!other || other.id === bot.id)
                    continue;
                const dx = Number(other.x || 0) - Number(bot.x || 0);
                const dy = Number(other.y || 0) - Number(bot.y || 0);
                const distance = Math.hypot(dx, dy);
                if (distance > ZONE_PVP_BOT_GLOBAL_HUNT_RANGE)
                    continue;
                const enemyPower = this.getZoneBotPower(other);
                const enemyWeak = Number(other.hp || 0) <= 58 ||
                    Number(other.drones || 0) <= 1 ||
                    Number(other.energy || 0) <= 18;
                const hasDroneAdvantage = Number(bot.drones || 0) >= Number(other.drones || 0) + 1;
                if (distance <= ZONE_PVP_BOT_THREAT_RADIUS) {
                    nearbyEnemyCount += 1;
                    if (enemyPower > ownPower * 1.12)
                        strongerEnemyCount += 1;
                    if (enemyWeak)
                        weakestNearbyCount += 1;
                    if (enemyPower > ownPower * 1.08 && distance < nearestThreatDistance) {
                        nearestThreat = other;
                        nearestThreatDistance = distance;
                    }
                }
                if (Number(bot.drones || 0) <= 0)
                    continue;
                const phaseFightFactor = phase === "endgame" ? 0.66 : phase === "midgame" ? 0.75 : 0.82;
                const canEngage = enemyWeak ||
                    hasDroneAdvantage ||
                    ownPower * Number(bot.aiCourage || 1) >= enemyPower * phaseFightFactor;
                if (!canEngage && distance > ZONE_PVP_BOT_THREAT_RADIUS && phase !== "endgame")
                    continue;
                let score = distance;
                if (String(bot.aiTargetEnemyId || "") === String(other.id))
                    score -= 330;
                if (enemyWeak)
                    score -= 720;
                if (hasDroneAdvantage)
                    score -= 480;
                if (Number(other.hp || 0) < Number(bot.hp || 0))
                    score -= 145;
                if (!other.isBot)
                    score -= 260 * Number(bot.aiHumanHuntBias || 0.45);
                if (phase === "endgame")
                    score -= 300;
                if (enemyPower > ownPower * 1.65 && !enemyWeak)
                    score += 420;
                if (score < targetEnemyScore) {
                    targetEnemy = other;
                    targetEnemyDistance = distance;
                    targetEnemyPower = enemyPower;
                    targetEnemyScore = score;
                }
            }
            const lowHp = Number(bot.hp || 0) <= ZONE_PVP_BOT_LOW_HP;
            const lowEnergy = Number(bot.energy || 0) <= ZONE_PVP_BOT_LOW_ENERGY;
            const targetWeak = Boolean(targetEnemy &&
                (Number(targetEnemy.hp || 0) <= 58 ||
                    Number(targetEnemy.drones || 0) <= 1 ||
                    Number(targetEnemy.energy || 0) <= 18));
            const droneAdvantage = Boolean(targetEnemy &&
                Number(bot.drones || 0) >= Number(targetEnemy.drones || 0) + 1);
            const tacticalRetreat = Boolean(targetEnemy &&
                (lowHp ||
                    (lowEnergy && targetEnemyDistance < 900) ||
                    (strongerEnemyCount >= (phase === "endgame" ? 3 : 2) && !droneAdvantage) ||
                    (targetEnemyPower > ownPower * 1.55 && !targetWeak && targetEnemyDistance < 1180)));
            const panicThreat = Boolean(nearestThreat &&
                (nearestThreatDistance < 480 || projectileThreat.severity > 0.34));
            const needsEmergencyFarm = Number(bot.drones || 0) <= 0;
            if (targetEnemy &&
                !needsEmergencyFarm &&
                (targetEnemyDistance <= ZONE_PVP_BOT_GLOBAL_HUNT_RANGE || tacticalRetreat || panicThreat)) {
                const angle = Math.atan2(Number(targetEnemy.y || 0) - Number(bot.y || 0), Number(targetEnemy.x || 0) - Number(bot.x || 0));
                const preferredRange = Math.max(410, Number(bot.preferredRange || ZONE_PVP_BOT_SAFE_DISTANCE) -
                    (phase === "endgame" ? 150 : phase === "midgame" ? 75 : 0));
                let moveX = 0;
                let moveY = 0;
                if (tacticalRetreat || panicThreat) {
                    const retreatStrafe = Number(bot.aiStrafeDir || 1);
                    moveX = Math.cos(angle + Math.PI) * 1.15 + Math.cos(angle + Math.PI * 0.5 * retreatStrafe) * 0.40;
                    moveY = Math.sin(angle + Math.PI) * 1.15 + Math.sin(angle + Math.PI * 0.5 * retreatStrafe) * 0.40;
                }
                else if (targetEnemyDistance > preferredRange + 120) {
                    moveX = Math.cos(angle) * 1.15;
                    moveY = Math.sin(angle) * 1.15;
                }
                else if (targetEnemyDistance < preferredRange - 145) {
                    moveX = Math.cos(angle + Math.PI) * 0.85;
                    moveY = Math.sin(angle + Math.PI) * 0.85;
                }
                else {
                    if (!bot.aiNextStrafeAt || now >= bot.aiNextStrafeAt) {
                        bot.aiStrafeDir = Math.random() < 0.52 ? 1 : -1;
                        bot.aiNextStrafeAt = now + 400 + Math.floor(Math.random() * 650);
                    }
                    const strafe = Number(bot.aiStrafeDir || 1);
                    moveX = Math.cos(angle + Math.PI * 0.5 * strafe) * 1.08 + Math.cos(angle) * 0.28;
                    moveY = Math.sin(angle + Math.PI * 0.5 * strafe) * 1.08 + Math.sin(angle) * 0.28;
                }
                const inwardPressure = zoneEdgeDistance < zoneBuffer * 2.2
                    ? Math.max(0, (zoneBuffer * 2.2 - zoneEdgeDistance) / Math.max(1, zoneBuffer * 2.2))
                    : 0;
                const move = this.normalizeZoneBotMove(moveX +
                    avoidance.x * (phase === "endgame" ? 0.28 : 0.54) +
                    (centerDx / centerDistance) * inwardPressure * 1.6, moveY +
                    avoidance.y * (phase === "endgame" ? 0.28 : 0.54) +
                    (centerDy / centerDistance) * inwardPressure * 1.6);
                const attackRange = Math.min(PROJECTILE_MAX_DISTANCE * 0.96, ZONE_PVP_BOT_ATTACK_RANGE *
                    (phase === "endgame" ? 1.16 : phase === "midgame" ? 1.08 : 1) *
                    Math.max(1, Number(bot.aiAggression || 1) * 0.92));
                const shouldShield = Boolean(!tacticalRetreat &&
                    Number(bot.energy || 0) >= 20 &&
                    Number(bot.drones || 0) > 1 &&
                    ((projectileThreat.incoming && projectileThreat.distance < 420) ||
                        (targetEnemyDistance < 390 && targetEnemyPower > ownPower * 1.24) ||
                        (nearbyEnemyCount >= 3 && Number(bot.hp || 0) < 50)));
                const shouldAttack = Boolean(!tacticalRetreat &&
                    !shouldShield &&
                    Number(bot.drones || 0) > 0 &&
                    targetEnemyDistance <= attackRange);
                const aim = this.getZoneBotAimPoint(bot, targetEnemy, room);
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: shouldAttack,
                    shield: shouldShield,
                    mouseX: aim.x,
                    mouseY: aim.y,
                };
                bot.aiTargetEnemyId = targetEnemy.id;
                bot.aiTargetOrbId = null;
                bot.aiTargetEnergyCellId = null;
                bot.aiTargetCoreId = null;
                bot.aiState = tacticalRetreat || panicThreat
                    ? "defend-flee"
                    : shouldAttack
                        ? "attack-strafe"
                        : "hunt-target";
                continue;
            }
            const targetEnergy = Number(bot.energy || 0) <= (lowHp ? 66 : 42)
                ? this.findZoneBotNearest(bot, room.energyCells || [], 4200, (cell) => this.isInsideSafeZone(cell.x, cell.y, zoneRadius, Math.max(150, zoneBuffer * 0.55)))
                : null;
            const targetCore = !targetEnergy
                ? this.findZoneBotNearest(bot, room.cores || [], 4600, (core) => this.isInsideSafeZone(core.x, core.y, zoneRadius, Math.max(150, zoneBuffer * 0.55)) &&
                    this.canUseCore(bot, core))
                : null;
            let target = targetEnergy?.unit || targetCore?.unit || null;
            let state = targetEnergy ? "energy" : targetCore ? "collect-core" : "farm-orbs";
            if (!target) {
                target = this.findZoneBotBestOrb(bot, room, zoneRadius, orbClaims, false);
            }
            if (target) {
                const targetId = String(target.id || "");
                if (state === "farm-orbs") {
                    const previousOrbId = String(bot.aiTargetOrbId || "");
                    if (previousOrbId && previousOrbId !== targetId) {
                        const previousClaims = Number(orbClaims.get(previousOrbId) || 0);
                        if (previousClaims <= 1)
                            orbClaims.delete(previousOrbId);
                        else
                            orbClaims.set(previousOrbId, previousClaims - 1);
                    }
                    if (targetId && previousOrbId !== targetId) {
                        orbClaims.set(targetId, Number(orbClaims.get(targetId) || 0) + 1);
                    }
                }
                const inwardPressure = zoneEdgeDistance < zoneBuffer * 2
                    ? Math.max(0, (zoneBuffer * 2 - zoneEdgeDistance) / Math.max(1, zoneBuffer * 2))
                    : 0;
                const route = this.normalizeZoneBotMove(Number(target.x || 0) - Number(bot.x || 0) +
                    avoidance.x * 190 +
                    (centerDx / centerDistance) * inwardPressure * 220, Number(target.y || 0) - Number(bot.y || 0) +
                    avoidance.y * 190 +
                    (centerDy / centerDistance) * inwardPressure * 220);
                bot.input = {
                    mobileMove: true,
                    moveX: route.x,
                    moveY: route.y,
                    attacking: false,
                    shield: Boolean(projectileThreat.incoming &&
                        projectileThreat.distance < 330 &&
                        Number(bot.energy || 0) >= 20 &&
                        Number(bot.drones || 0) > 1),
                    mouseX: Number(target.x || bot.x),
                    mouseY: Number(target.y || bot.y),
                };
                bot.aiTargetEnemyId = null;
                bot.aiTargetOrbId = state === "farm-orbs" ? target.id : null;
                bot.aiTargetEnergyCellId = state === "energy" ? target.id : null;
                bot.aiTargetCoreId = state === "collect-core" ? target.id : null;
                bot.aiState = needsEmergencyFarm && state === "farm-orbs" ? "emergency-orb-farm" : state;
            }
            else {
                const angle = Number(bot.aiWanderAngle || 0) + (Math.random() - 0.5) * 0.8;
                bot.aiWanderAngle = angle;
                const move = this.normalizeZoneBotMove(Math.cos(angle) * 0.65 + avoidance.x * 0.85 + (centerDx / centerDistance) * 0.55, Math.sin(angle) * 0.65 + avoidance.y * 0.85 + (centerDy / centerDistance) * 0.55);
                bot.input = {
                    mobileMove: true,
                    moveX: move.x,
                    moveY: move.y,
                    attacking: false,
                    shield: false,
                    mouseX: Number(bot.x || 0) + move.x * 300,
                    mouseY: Number(bot.y || 0) + move.y * 300,
                };
                bot.aiTargetEnemyId = null;
                bot.aiTargetOrbId = null;
                bot.aiTargetEnergyCellId = null;
                bot.aiTargetCoreId = null;
                bot.aiState = "search-safe-orbs";
            }
            bot.lastInputReceivedAt = now;
            bot.lastSeenAt = now;
        }
    }
    emitZonePvpJoined(client, room, player, reusedRoom = false) {
        const now = Date.now();
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const countdownDuration = room?.coreHeistMode
            ? CORE_HEIST_START_COUNTDOWN_MS
            : ZONE_PVP_START_COUNTDOWN_MS;
        const countdown = room.status === "countdown" && room.countdownStartedAt
            ? Math.max(1, Math.ceil((countdownDuration - (now - room.countdownStartedAt)) / 1000))
            : null;
        client.emit("zone-pvp:joined", {
            serverNow: now,
            roomId: room.id,
            roundId: room.roundId || null,
            phaseVersion: Number(room.phaseVersion || 0),
            status: room.status,
            countdown,
            countdownEndsAt: room.status === "countdown" && room.countdownStartedAt
                ? Number(room.countdownStartedAt) + countdownDuration
                : null,
            playerId: client.id,
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
            safeZoneRadius: zoneRadius,
            zoneShrinkDuration: room?.coreHeistMode ? 0 : ZONE_PVP_ZONE_SHRINK_DURATION,
            matchStartedAt: room.matchStartedAt,
            battlePrepareUntil: room.battlePrepareUntil || null,
            battlePrepareRemainingMs: room.battlePrepareUntil ? Math.max(0, room.battlePrepareUntil - now) : 0,
            heistRoleRevealUntil: room?.coreHeistMode ? (room.heistRoleRevealUntil || null) : null,
            heistRoleRevealRemainingMs: room?.coreHeistMode && room.heistRoleRevealUntil ? Math.max(0, room.heistRoleRevealUntil - now) : 0,
            battleBeginFlashUntil: room.battleBeginFlashUntil || null,
            playerCount: this.getAlivePlayers(room).length,
            realPlayerCount: this.getZoneHumanPlayerCount(room),
            matchmakingPlayerCount: room.status === "waiting" || room.status === "countdown"
                ? this.getZoneConnectedHumanPlayerCount(room)
                : this.getZoneHumanPlayerCount(room),
            botCount: this.getZoneBotCount(room),
            minPlayers: room?.coreHeistMode ? CORE_HEIST_ROOM_MIN_PLAYERS : ZONE_PVP_ROOM_MIN_PLAYERS,
            maxPlayers: room?.coreHeistMode ? CORE_HEIST_ROOM_MAX_PLAYERS : ZONE_PVP_ROOM_MAX_PLAYERS,
            mode: room?.coreHeistMode ? CORE_HEIST_MODE : "zone-pvp",
            heist: this.serializeCoreHeist(room, player, now),
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
        if (this.normalSocketRoom.has(client.id)) {
            this.detachNormalPvpSocket(client.id);
        }
        this.removeBattleRoyaleOnlinePlayer(client.id);
        if (this.zonePvpSocketRoom.has(client.id)) {
            this.removeZonePvpPlayer(client.id, { explicit: true });
        }
        else {
            this.zonePvpSocketResumeToken.delete(client.id);
        }
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
            guestStatsKey: data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null,
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
        const resumeToken = this.normalizeNormalPvpResumeToken(data?.resumeToken);
        const resumed = this.findNormalPvpResumeSeat(resumeToken);
        if (resumed) {
            const { room, player } = resumed;
            this.rebindNormalPvpResumeSeat(room, player, client, resumeToken);
            player.userId = data?.isGuest ? null : data?.userId;
            player.isGuest = Boolean(data?.isGuest);
            player.guestStatsKey = data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null;
            player.username = String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18);
            player.skin = normalizeSkin(data?.isGuest ? "cyan" : data?.skin);
            this.emitNormalPvpJoined(client, room, player);
            return;
        }
        const existingRoom = this.getNormalRoomBySocket(client.id);
        const existingPlayer = existingRoom?.players.get(client.id);
        if (existingRoom && existingPlayer) {
            existingPlayer.userId = data?.isGuest ? null : data?.userId;
            existingPlayer.isGuest = Boolean(data?.isGuest);
            existingPlayer.guestStatsKey = data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null;
            existingPlayer.username = String(data?.username || (data?.isGuest ? "Guest" : "Player")).slice(0, 18);
            existingPlayer.skin = normalizeSkin(data?.isGuest ? "cyan" : data?.skin);
            existingPlayer.lastSeenAt = Date.now();
            existingPlayer.lastInputReceivedAt = Date.now();
            existingPlayer.disconnectedAt = 0;
            this.rememberNormalPvpResumeSeat(existingRoom, existingPlayer, resumeToken);
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
            guestStatsKey: data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null,
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
            resumeToken,
            disconnectedAt: 0,
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
        this.rememberNormalPvpResumeSeat(room, player, resumeToken);
        client.join(room.id);
        this.emitNormalPvpJoined(client, room, player);
    }
    handleNormalPvpLeave(client) {
        this.removeNormalPlayer(client.id, { explicit: true });
    }
    handleNormalPvpSessionCheck(client) {
        const now = Date.now();
        const room = this.getNormalRoomBySocket(client.id);
        const player = room?.players?.get(client.id);
        const active = Boolean(room && player);
        if (player) {
            player.lastSeenAt = now;
            player.lastInputReceivedAt = now;
        }
        client.emit("normal-pvp:session-check:result", {
            ok: true,
            active,
            roomId: room?.id || null,
            playerId: active ? client.id : null,
            status: room?.status || "missing",
            serverNow: now,
        });
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
            guestStatsKey: data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null,
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
        const participantId = this.normalizeZonePvpParticipantId(data?.participantId);
        const applicantUserId = data?.isGuest ? null : String(data?.userId || "").trim() || null;
        const departedRoomId = String(data?.departedRoomId || "").trim();
        const departedResumeToken = this.normalizeZonePvpResumeToken(data?.departedResumeToken);
        const requestedCoreHeist = String(data?.mode || "").trim().toLowerCase() === CORE_HEIST_MODE;
        if (departedRoomId) {
            this.enforceZonePvpDeparture(departedRoomId, participantId, applicantUserId, departedResumeToken);
        }
        const resumeSeat = this.findZonePvpResumeSeat(resumeToken);
        if (resumeSeat && resumeToken) {
            const { room, player } = resumeSeat;
            if (String(player.id) === String(client.id)) {
                player.lastSeenAt = now;
                player.lastInputReceivedAt = now;
                player.disconnectedAt = 0;
                this.markRoomOccupied(room);
                client.join(room.id);
                this.emitZonePvpJoined(client, room, player, true);
                this.broadcastZonePvpRoomState(room, now, true);
                return;
            }
            if (!this.zonePvpSocketRoom.has(String(player.id))) {
                this.zonePvpSocketRoom.set(String(player.id), room.id);
            }
            this.removeZonePvpPlayer(String(player.id), {
                explicit: true,
                participantId: player.participantId || participantId,
            });
            client.emit("zone-pvp:round-closed", {
                roomId: room.id,
                roundId: room.roundId || null,
                reason: "left-room",
                serverNow: now,
            });
            return;
        }
        const requestedResumeRoomId = String(data?.resumeRoomId || data?.roomId || "").trim();
        const requestedResumePlayerId = String(data?.resumePlayerId || data?.playerId || "").trim();
        const strictResume = Boolean(data?.resumeOnly && requestedResumeRoomId && requestedResumePlayerId);
        if (strictResume) {
            client.emit("zone-pvp:round-closed", {
                roomId: requestedResumeRoomId,
                playerId: requestedResumePlayerId,
                reason: "left-room",
                serverNow: now,
            });
            return;
        }
        const existingZoneRoom = this.getZonePvpRoomBySocket(client.id);
        const existingZonePlayer = existingZoneRoom?.players.get(client.id);
        if (existingZoneRoom && existingZonePlayer) {
            existingZonePlayer.userId = data?.isGuest ? null : data?.userId;
            existingZonePlayer.isGuest = Boolean(data?.isGuest);
            existingZonePlayer.guestStatsKey = data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null;
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
        const room = this.findOrCreateZonePvpRoom(participantId, applicantUserId, requestedCoreHeist);
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const assignedTeam = room?.coreHeistMode ? this.assignCoreHeistTeam(room) : null;
        const spawn = room?.coreHeistMode
            ? this.getCoreHeistSpawn(room, assignedTeam || "cyan", room.players.size)
            : this.getSafeSpawn(room, zoneRadius);
        const player = {
            id: client.id,
            isBot: false,
            participantId,
            userId: data?.isGuest ? null : data?.userId,
            isGuest: Boolean(data?.isGuest),
            guestStatsKey: data?.isGuest
                ? this.normalizeGameStatsGuestKey(data?.guestStatsKey)
                : null,
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
            team: assignedTeam,
            heistFlagId: null,
            heistDeaths: 0,
            heistPermanentElimination: false,
            respawnAt: 0,
            heistRespawnCount: 0,
            heistRole: room?.coreHeistMode ? "attacker" : null,
            heistPlanUntil: 0,
        };
        room.players.set(client.id, player);
        this.markRoomOccupied(room);
        this.zonePvpSocketRoom.set(client.id, room.id);
        if (resumeToken)
            this.rememberZonePvpResumeSeat(room, player, resumeToken);
        client.join(room.id);
        if (this.getZoneConnectedHumanPlayerCount(room) >= (room?.coreHeistMode ? CORE_HEIST_ROOM_MIN_PLAYERS : ZONE_PVP_ROOM_MIN_PLAYERS) &&
            room.status === "waiting") {
            room.status = "countdown";
            room.countdownStartedAt = now;
            room.locked = false;
            room.roundId = `${room?.coreHeistMode ? "heist-round" : "zone-round"}-${crypto.randomUUID()}`;
            room.phaseVersion = Number(room.phaseVersion || 0) + 1;
        }
        this.emitZonePvpJoined(client, room, player, false);
        this.broadcastZonePvpRoomState(room, now, true);
    }
    handleZonePvpSessionCheck(client, data) {
        const now = Date.now();
        const room = this.getZonePvpRoomBySocket(client.id);
        const player = room?.players?.get(client.id);
        if (room && player) {
            player.lastSeenAt = now;
            player.lastInputReceivedAt = now;
            player.disconnectedAt = 0;
            client.emit("zone-pvp:session-check:result", {
                ok: true,
                active: true,
                resumable: false,
                roomId: room.id,
                playerId: client.id,
                status: room.status,
                serverNow: now,
            });
            return;
        }
        client.emit("zone-pvp:session-check:result", {
            ok: true,
            active: false,
            resumable: false,
            terminal: true,
            roomId: null,
            playerId: null,
            status: "left",
            winnerId: null,
            winnerName: null,
            serverNow: now,
        });
    }
    handleZonePvpResync(client) {
        const room = this.getZonePvpRoomBySocket(client.id);
        const player = room?.players?.get(client.id);
        const now = Date.now();
        if (!room || !player || room.closedAt || room.status === "finished") {
            client.emit("zone-pvp:round-closed", {
                roomId: room?.id || null,
                roundId: room?.roundId || null,
                reason: "left-room",
                serverNow: now,
            });
            return { ok: false, serverNow: now };
        }
        player.lastSeenAt = now;
        player.lastInputReceivedAt = now;
        this.emitZonePvpJoined(client, room, player, true);
        this.broadcastZonePvpRoomState(room, now, true);
        return { ok: true, serverNow: now };
    }
    handleZonePvpLeave(client, data) {
        const roomId = this.zonePvpSocketRoom.get(client.id) || null;
        this.removeZonePvpPlayer(client.id, {
            explicit: true,
            participantId: this.normalizeZonePvpParticipantId(data?.participantId),
        });
        const serverNow = Date.now();
        client.emit("zone-pvp:left", {
            roomId,
            playerId: client.id,
            serverNow,
        });
        return { ok: true, roomId, playerId: client.id, serverNow };
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
        const roleRevealLocked = this.isCoreHeistRoleRevealLocked(room, now);
        player.input = {
            seq: safeSeq,
            dt: Math.max(1, Math.min(50, Number(input?.dt || 16))),
            clientSentAt: Number(input?.clientSentAt || 0),
            serverReceivedAt: now,
            w: !roleRevealLocked && Boolean(input?.w),
            a: !roleRevealLocked && Boolean(input?.a),
            s: !roleRevealLocked && Boolean(input?.s),
            d: !roleRevealLocked && Boolean(input?.d),
            moveX: roleRevealLocked ? 0 : this.clamp(Number(input?.moveX || 0), -1, 1),
            moveY: roleRevealLocked ? 0 : this.clamp(Number(input?.moveY || 0), -1, 1),
            mobileMove: !roleRevealLocked && Boolean(input?.mobileMove),
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
                try {
                    this.updateZonePvpRoomStatus(room, now);
                    if (room.status === "playing") {
                        const zoneRadius = this.getZonePvpZoneRadius(room);
                        if (room?.coreHeistMode) {
                            this.reviveCoreHeistPlayers(room, now);
                            this.updateCoreHeistBots(room, now);
                            this.updatePlayers(room, now, zoneRadius, deltaFrames);
                            this.applyCoreHeistRolePassives(room, now, deltaFrames);
                            this.updateProjectiles(room, deltaFrames, now);
                            if (!room.lastZoneCollisionAt || now - room.lastZoneCollisionAt >= ZONE_COLLISION_TICK_INTERVAL_MS) {
                                room.lastZoneCollisionAt = now;
                                this.handleBodyCollisions(room, now, zoneRadius);
                            }
                            if (!room.lastZoneLootAt || now - room.lastZoneLootAt >= ZONE_LOOT_TICK_INTERVAL_MS) {
                                room.lastZoneLootAt = now;
                                this.collectOrbs(room, zoneRadius);
                                this.collectEnergy(room, zoneRadius);
                            }
                            if (!room.lastZoneItemMaintenanceAt || now - room.lastZoneItemMaintenanceAt >= ZONE_ITEM_MAINTENANCE_INTERVAL_MS) {
                                room.lastZoneItemMaintenanceAt = now;
                                this.maintainWorldItems(room, zoneRadius, now);
                                this.cleanupCombatEvents(room, now);
                            }
                            this.updateCoreHeistObjective(room, now);
                        }
                        else {
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
                    }
                    const broadcastInterval = room?.coreHeistMode
                        ? CORE_HEIST_STATE_INTERVAL_MS
                        : room.players.size >= PVP_HEAVY_STATE_THRESHOLD
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
                catch (error) {
                    room.zoneLoopErrorCount = Number(room.zoneLoopErrorCount || 0) + 1;
                    room.lastZoneLoopErrorAt = now;
                    if (!room.lastZoneLoopErrorLogAt || now - room.lastZoneLoopErrorLogAt >= 5000) {
                        room.lastZoneLoopErrorLogAt = now;
                        console.error(`[Zone PvP] recovered room tick error for ${room.id}`, error);
                    }
                }
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
    getCoreHeistTeamLabel(team) {
        return String(team || "cyan") === "orange" ? "RED" : "BLUE";
    }
    getCoreHeistTeamPlayers(room, team, aliveOnly = false) {
        return [...(room?.players?.values?.() || [])].filter((player) => String(player?.team || "cyan") === team &&
            (!aliveOnly || player?.alive !== false));
    }
    assignCoreHeistTeam(room) {
        const cyan = this.getCoreHeistTeamPlayers(room, "cyan").length;
        const orange = this.getCoreHeistTeamPlayers(room, "orange").length;
        return cyan <= orange ? "cyan" : "orange";
    }
    getCoreHeistBase(room, team) {
        return (room?.heist?.bases || []).find((base) => String(base?.team) === String(team)) || null;
    }
    getCoreHeistFlag(room, teamOrId) {
        const source = String(teamOrId || "");
        return (room?.heist?.flags || []).find((flag) => String(flag?.team) === source || String(flag?.id) === source) || null;
    }
    getCoreHeistSpawn(room, team, salt = 0) {
        const normalizedTeam = String(team || "cyan") === "orange" ? "orange" : "cyan";
        const base = this.getCoreHeistBase(room, normalizedTeam);
        const centerX = Number(base?.x || (normalizedTeam === "orange"
            ? WORLD_WIDTH - CORE_HEIST_BASE_X_OFFSET
            : CORE_HEIST_BASE_X_OFFSET));
        const centerY = Number(base?.y || WORLD_HEIGHT * 0.5);
        const pads = [
            { x: -250, y: -245 },
            { x: -85, y: 250 },
            { x: 190, y: -145 },
            { x: 300, y: 175 },
            { x: -315, y: 70 },
            { x: 80, y: -315 },
        ];
        const pad = pads[Math.abs(Math.floor(Number(salt || 0))) % pads.length];
        const side = normalizedTeam === "orange" ? -1 : 1;
        return {
            x: this.clamp(centerX + pad.x * side, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS),
            y: this.clamp(centerY + pad.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS),
        };
    }
    normalizeCoreHeistRole(role) {
        const value = String(role || "attacker").trim().toLowerCase();
        return value === "defender" || value === "tank" ? value : "attacker";
    }
    getCoreHeistRolePlan(count) {
        if (count <= 0)
            return [];
        const plan = ["attacker", "attacker"];
        if (count >= 3)
            plan.push("defender");
        if (count >= 4)
            plan.push("tank");
        while (plan.length < count)
            plan.push("attacker");
        return plan.slice(0, count);
    }
    getCoreHeistRoleSkin(team, role) {
        const normalizedTeam = String(team || "cyan") === "orange" ? "orange" : "cyan";
        const normalizedRole = this.normalizeCoreHeistRole(role);
        return `heist-${normalizedRole}-${normalizedTeam}`;
    }
    applyCoreHeistRoleLoadout(player, room, role) {
        if (!room?.coreHeistMode || !player)
            return;
        const normalizedRole = this.normalizeCoreHeistRole(role);
        player.heistRole = normalizedRole;
        player.skin = this.getCoreHeistRoleSkin(String(player?.team || "cyan"), normalizedRole);
        player.moveSpeedMultiplier = 1;
        const nextMaxHp = normalizedRole === "tank" ? CORE_HEIST_TANK_HP : START_HP;
        player.maxHp = nextMaxHp;
        player.hp = nextMaxHp;
    }
    assignCoreHeistTeamRoles(room) {
        if (!room?.coreHeistMode)
            return;
        for (const team of ["cyan", "orange"]) {
            const teamPlayers = this.getCoreHeistTeamPlayers(room, team)
                .sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));
            if (!teamPlayers.length)
                continue;
            const shuffled = [...teamPlayers];
            for (let index = shuffled.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(Math.random() * (index + 1));
                const temp = shuffled[index];
                shuffled[index] = shuffled[swapIndex];
                shuffled[swapIndex] = temp;
            }
            const rolePlan = this.getCoreHeistRolePlan(shuffled.length);
            shuffled.forEach((player, index) => {
                this.applyCoreHeistRoleLoadout(player, room, rolePlan[index] || "attacker");
            });
        }
    }
    createCoreHeistState(now = Date.now()) {
        const bases = [
            {
                id: "cyan-base",
                team: "cyan",
                label: "BLUE BASE",
                x: CORE_HEIST_BASE_X_OFFSET,
                y: WORLD_HEIGHT * 0.5 + CORE_HEIST_BASE_Y_OFFSET,
                radius: CORE_HEIST_BASE_RADIUS,
                perimeterRadius: CORE_HEIST_BASE_PERIMETER_RADIUS,
            },
            {
                id: "orange-base",
                team: "orange",
                label: "RED BASE",
                x: WORLD_WIDTH - CORE_HEIST_BASE_X_OFFSET,
                y: WORLD_HEIGHT * 0.5 + CORE_HEIST_BASE_Y_OFFSET,
                radius: CORE_HEIST_BASE_RADIUS,
                perimeterRadius: CORE_HEIST_BASE_PERIMETER_RADIUS,
            },
        ];
        const flags = bases.map((base) => ({
            id: `${base.team}-flag`,
            team: base.team,
            homeX: base.x,
            homeY: base.y,
            x: base.x,
            y: base.y,
            status: "home",
            carrierId: null,
            lastCarrierId: null,
            lastCarrierName: null,
            lastCarrierTeam: null,
            droppedAt: 0,
            returnAt: 0,
        }));
        return {
            mode: "capture-the-flag",
            targetScore: CORE_HEIST_TARGET_SCORE,
            score: { cyan: 0, orange: 0 },
            matchEndsAt: 0,
            bases,
            flags,
            lastScoreAt: now,
            eventSequence: 0,
            latestEvent: null,
            events: [],
        };
    }
    seedCoreHeistOpeningResources(room) {
        const bases = room?.heist?.bases || [];
        const seededOrbs = [];
        const seededEnergy = [];
        const randomBasePoint = (base, minRadius, maxRadius, margin) => {
            const angle = Math.random() * Math.PI * 2;
            const radius = minRadius + Math.sqrt(Math.random()) * Math.max(1, maxRadius - minRadius);
            return {
                x: this.clamp(Number(base?.x || WORLD_WIDTH * 0.5) + Math.cos(angle) * radius, margin, WORLD_WIDTH - margin),
                y: this.clamp(Number(base?.y || WORLD_HEIGHT * 0.5) + Math.sin(angle) * radius, margin, WORLD_HEIGHT - margin),
            };
        };
        for (const base of bases) {
            for (let index = 0; index < CORE_HEIST_OPENING_ORBS_PER_BASE; index += 1) {
                const point = randomBasePoint(base, 240, 2100, 220);
                seededOrbs.push({
                    id: crypto.randomUUID(),
                    x: point.x,
                    y: point.y,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                });
            }
            for (let index = 0; index < CORE_HEIST_OPENING_ENERGY_PER_BASE; index += 1) {
                const point = randomBasePoint(base, 360, 2350, 240);
                seededEnergy.push({
                    id: crypto.randomUUID(),
                    x: point.x,
                    y: point.y,
                });
            }
        }
        for (const base of bases) {
            for (let index = 0; index < CORE_HEIST_BASE_CLOSE_ORBS_PER_BASE; index += 1) {
                const point = randomBasePoint(base, 105, 820, 180);
                seededOrbs.push({
                    id: crypto.randomUUID(),
                    x: point.x,
                    y: point.y,
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                });
            }
            for (let index = 0; index < CORE_HEIST_BASE_CLOSE_ENERGY_PER_BASE; index += 1) {
                const point = randomBasePoint(base, 130, 920, 190);
                seededEnergy.push({
                    id: crypto.randomUUID(),
                    x: point.x,
                    y: point.y,
                });
            }
        }
        for (let index = 0; index < CORE_HEIST_MIDFIELD_ORB_COUNT; index += 1) {
            const point = this.randomSafePoint(Math.max(WORLD_WIDTH, WORLD_HEIGHT), 220);
            seededOrbs.push({
                id: crypto.randomUUID(),
                x: point.x,
                y: point.y,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
            });
        }
        for (let index = 0; index < CORE_HEIST_MIDFIELD_ENERGY_COUNT; index += 1) {
            const point = this.randomSafePoint(Math.max(WORLD_WIDTH, WORLD_HEIGHT), 240);
            seededEnergy.push({
                id: crypto.randomUUID(),
                x: point.x,
                y: point.y,
            });
        }
        room.orbs = seededOrbs;
        room.energyCells = seededEnergy;
        room.itemSpatialDirty = true;
    }
    ensureCoreHeistResources(room, zoneRadius) {
        if (!room?.coreHeistMode)
            return;
        const alive = this.getAlivePlayers(room);
        let changed = false;
        room.orbs = Array.isArray(room.orbs) ? room.orbs : [];
        room.energyCells = Array.isArray(room.energyCells) ? room.energyCells : [];
        while (room.orbs.length < CORE_HEIST_ORB_TARGET) {
            room.orbs.push(this.createOrb(Math.max(WORLD_WIDTH, WORLD_HEIGHT)));
            changed = true;
        }
        while (room.energyCells.length < CORE_HEIST_ENERGY_TARGET) {
            room.energyCells.push(this.createEnergyCell(Math.max(WORLD_WIDTH, WORLD_HEIGHT)));
            changed = true;
        }
        for (const player of alive) {
            const nearbyOrbs = room.orbs.filter((orb) => this.isNear(player, orb, 2100)).length;
            const nearbyEnergy = room.energyCells.filter((cell) => this.isNear(player, cell, 2200)).length;
            if (nearbyOrbs < 36 && room.orbs.length < CORE_HEIST_ORB_TARGET + 150) {
                const add = Math.min(16, 68 - nearbyOrbs);
                for (let index = 0; index < add; index += 1) {
                    room.orbs.push(this.createOrb(Math.max(WORLD_WIDTH, WORLD_HEIGHT), Number(player.x || 0), Number(player.y || 0)));
                    changed = true;
                }
            }
            if (nearbyEnergy < 24 && room.energyCells.length < CORE_HEIST_ENERGY_TARGET + 90) {
                const add = Math.min(7, 24 - nearbyEnergy);
                for (let index = 0; index < add; index += 1) {
                    room.energyCells.push(this.createEnergyCell(Math.max(WORLD_WIDTH, WORLD_HEIGHT), Number(player.x || 0), Number(player.y || 0)));
                    changed = true;
                }
            }
        }
        if (room.orbs.length > CORE_HEIST_ORB_TARGET + 85) {
            room.orbs = room.orbs.slice(-(CORE_HEIST_ORB_TARGET + 85));
            changed = true;
        }
        if (room.energyCells.length > CORE_HEIST_ENERGY_TARGET + 90) {
            room.energyCells = room.energyCells.slice(-(CORE_HEIST_ENERGY_TARGET + 90));
            changed = true;
        }
        if (changed)
            room.itemSpatialDirty = true;
    }
    initializeCoreHeistRoom(room, now = Date.now()) {
        room.heist = this.createCoreHeistState(now);
        room.heist.matchEndsAt = now + CORE_HEIST_MATCH_DURATION_MS;
        this.seedCoreHeistOpeningResources(room);
        this.ensureCoreHeistResources(room, this.getZonePvpZoneRadius(room));
        room.cores = [];
        room.pendingCores = [];
        room.nextCoreWaveAt = null;
        room.lastCoreWaveAt = now;
        room.itemSpatialDirty = true;
        this.refreshRoomSpatialIndexes(room, now, true);
        room.matchStartedAt = now;
    }
    serializeCoreHeist(room, viewer = null, now = Date.now()) {
        const heist = room?.heist;
        if (!heist)
            return null;
        const activeEvents = Array.isArray(heist.events)
            ? heist.events
                .filter((event) => now < Number(event?.expiresAt || 0))
                .slice(-CORE_HEIST_EVENT_LOG_LIMIT)
            : [];
        const latestEvent = activeEvents.length
            ? activeEvents[activeEvents.length - 1]
            : null;
        return {
            mode: "capture-the-flag",
            targetScore: Number(heist.targetScore || CORE_HEIST_TARGET_SCORE),
            score: {
                cyan: Number(heist.score?.cyan || 0),
                orange: Number(heist.score?.orange || 0),
            },
            matchEndsAt: Number(heist.matchEndsAt || 0),
            remainingMs: Math.max(0, Number(heist.matchEndsAt || 0) - now),
            team: viewer?.team || null,
            latestEvent,
            events: activeEvents,
            bases: (heist.bases || []).map((base) => ({
                id: base.id,
                team: base.team,
                label: base.label,
                x: Number(base.x || 0),
                y: Number(base.y || 0),
                radius: Number(base.radius || CORE_HEIST_BASE_RADIUS),
                perimeterRadius: Number(base.perimeterRadius || CORE_HEIST_BASE_PERIMETER_RADIUS),
            })),
            flags: (heist.flags || []).map((flag) => {
                const carrier = flag.carrierId ? room?.players?.get(flag.carrierId) : null;
                return {
                    id: flag.id,
                    team: flag.team,
                    homeX: Number(flag.homeX || 0),
                    homeY: Number(flag.homeY || 0),
                    x: Number(carrier?.x ?? flag.x ?? 0),
                    y: Number(carrier?.y ?? flag.y ?? 0),
                    status: flag.status,
                    carrierId: flag.carrierId || null,
                    carrierName: carrier
                        ? this.getCoreHeistPlayerName(carrier)
                        : flag.lastCarrierName || null,
                    carrierTeam: carrier?.team || flag.lastCarrierTeam || null,
                    lastCarrierId: flag.lastCarrierId || null,
                    lastCarrierName: flag.lastCarrierName || null,
                    lastCarrierTeam: flag.lastCarrierTeam || null,
                    returnAt: Number(flag.returnAt || 0),
                };
            }),
        };
    }
    getCoreHeistPlayerName(player, fallback = "A PLAYER") {
        const username = String(player?.username ||
            player?.firstName ||
            player?.email?.split?.("@")?.[0] ||
            fallback).trim();
        return (username || fallback).slice(0, 22);
    }
    pushCoreHeistEvent(room, input, now = Date.now()) {
        const heist = room?.heist;
        if (!room?.coreHeistMode || !heist)
            return null;
        const actor = input?.actor || null;
        const flag = input?.flag || null;
        const type = ["taken", "dropped", "returned", "captured"].includes(String(input?.type || ""))
            ? String(input.type)
            : "returned";
        const actorTeam = String(actor?.team || input?.actorTeam || "") === "orange" ? "orange" : "cyan";
        const flagTeam = String(flag?.team || input?.flagTeam || "") === "orange" ? "orange" : "cyan";
        const scoreTeam = String(input?.scoreTeam || actorTeam) === "orange" ? "orange" : "cyan";
        const sequence = Number(heist.eventSequence || 0) + 1;
        heist.eventSequence = sequence;
        const event = {
            id: `heist-${sequence}-${crypto.randomUUID()}`,
            type,
            team: type === "captured" ? scoreTeam : actor ? actorTeam : flagTeam,
            actorId: actor?.id || null,
            actorName: String(input?.actorName || this.getCoreHeistPlayerName(actor, "SYSTEM")),
            actorTeam: actor ? actorTeam : null,
            flagId: flag?.id || input?.flagId || null,
            flagTeam,
            scoreTeam: type === "captured" ? scoreTeam : null,
            score: {
                cyan: Number(heist.score?.cyan || 0),
                orange: Number(heist.score?.orange || 0),
            },
            targetScore: Number(heist.targetScore || CORE_HEIST_TARGET_SCORE),
            createdAt: now,
            expiresAt: now + CORE_HEIST_EVENT_TTL_MS,
        };
        const previous = Array.isArray(heist.events) ? heist.events : [];
        heist.events = [...previous, event]
            .filter((item) => now < Number(item?.expiresAt || 0))
            .slice(-CORE_HEIST_EVENT_LOG_LIMIT);
        heist.latestEvent = event;
        this.server?.to(String(room.id)).emit("zone-pvp:heist-event", event);
        return event;
    }
    resetCoreHeistFlag(flag) {
        if (!flag)
            return;
        flag.x = Number(flag.homeX || 0);
        flag.y = Number(flag.homeY || 0);
        flag.status = "home";
        flag.carrierId = null;
        flag.droppedAt = 0;
        flag.returnAt = 0;
    }
    dropCoreHeistFlag(room, player, now = Date.now()) {
        const flag = this.getCoreHeistFlag(room, String(player?.heistFlagId || ""));
        if (!flag || String(flag.carrierId || "") !== String(player?.id || ""))
            return;
        flag.status = "dropped";
        flag.carrierId = null;
        flag.lastCarrierId = player?.id || null;
        flag.lastCarrierName = this.getCoreHeistPlayerName(player);
        flag.lastCarrierTeam = player?.team || null;
        flag.x = Number(player?.x || flag.x || flag.homeX || 0);
        flag.y = Number(player?.y || flag.y || flag.homeY || 0);
        flag.droppedAt = now;
        flag.returnAt = now + CORE_HEIST_FLAG_RETURN_MS;
        player.heistFlagId = null;
        this.pushCombatEvent(room, player, "FLAG DROPPED", "damage", now);
        this.pushCoreHeistEvent(room, {
            type: "dropped",
            actor: player,
            flag,
        }, now);
    }
    respawnCoreHeistPlayer(room, player, now = Date.now()) {
        const spawn = this.getCoreHeistSpawn(room, String(player?.team || "cyan"), Number(player?.heistRespawnCount || 0));
        player.heistRespawnCount = Number(player?.heistRespawnCount || 0) + 1;
        player.x = spawn.x;
        player.y = spawn.y;
        player.prevX = spawn.x;
        player.prevY = spawn.y;
        this.applyCoreHeistRoleLoadout(player, room, String(player?.heistRole || "attacker"));
        player.hp = Number(player?.maxHp || START_HP);
        player.energy = START_ENERGY;
        player.drones = 0;
        player.progress = 0;
        player.nextDroneAt = this.getNextDroneAt(0);
        player.alive = true;
        player.respawnAt = 0;
        player.heistFlagId = null;
        player.input = {};
        player.isMoving = false;
        player.moveX = 0;
        player.moveY = 0;
        player.velocityX = 0;
        player.velocityY = 0;
        player.knockbackX = 0;
        player.knockbackY = 0;
        player.shieldActive = false;
        player.shieldUntil = 0;
        player.lastSeenAt = now;
        player.lastInputReceivedAt = now;
        this.pushCombatEvent(room, player, "REDEPLOYED", "heal", now);
    }
    reviveCoreHeistPlayers(room, now = Date.now()) {
        for (const player of room?.players?.values?.() || []) {
            if (player?.alive !== false || player?.heistPermanentElimination)
                continue;
            if (!player?.respawnAt || now < Number(player.respawnAt))
                continue;
            this.respawnCoreHeistPlayer(room, player, now);
        }
    }
    getCoreHeistEnemyTeam(team) {
        return String(team || "cyan") === "orange" ? "cyan" : "orange";
    }
    applyCoreHeistRolePassives(room, now, deltaFrames = 1) {
        const heist = room?.heist;
        if (!heist || room.status !== "playing")
            return;
        const deltaSeconds = Math.max(0, Number(deltaFrames || 1)) / 60;
        if (!deltaSeconds)
            return;
        for (const player of room?.players?.values?.() || []) {
            if (!player || player.alive === false || player.heistPermanentElimination)
                continue;
            const role = this.normalizeCoreHeistRole(player?.heistRole || "attacker");
            if (role !== "defender")
                continue;
            const ownBase = this.getCoreHeistBase(room, String(player?.team || "cyan"));
            if (!ownBase)
                continue;
            const dx = Number(player?.x || 0) - Number(ownBase?.x || 0);
            const dy = Number(player?.y || 0) - Number(ownBase?.y || 0);
            const guardRadius = Number(ownBase?.perimeterRadius || CORE_HEIST_BASE_PERIMETER_RADIUS) + CORE_HEIST_DEFENDER_GUARD_RADIUS_BONUS;
            if (dx * dx + dy * dy > guardRadius * guardRadius)
                continue;
            player.hp = Math.min(Number(player?.maxHp || START_HP), Number(player?.hp || 0) + CORE_HEIST_DEFENDER_HP_REGEN_PER_SECOND * deltaSeconds);
            player.energy = Math.min(START_ENERGY, Number(player?.energy || 0) + CORE_HEIST_DEFENDER_ENERGY_REGEN_PER_SECOND * deltaSeconds);
        }
    }
    updateCoreHeistBots(room, now) {
        const heist = room?.heist;
        if (!heist || room.status !== "playing")
            return;
        const combatReady = !this.isBattlePrepareLocked(room, now);
        const units = [...room.players.values()].filter((unit) => unit && unit.alive !== false && !unit.heistPermanentElimination);
        const distanceSq = (a, b) => {
            const dx = Number(a?.x || 0) - Number(b?.x || 0);
            const dy = Number(a?.y || 0) - Number(b?.y || 0);
            return dx * dx + dy * dy;
        };
        const findNearest = (source, candidates, maxDistance = Number.POSITIVE_INFINITY) => {
            let chosen = null;
            let bestDistanceSq = maxDistance * maxDistance;
            for (const candidate of candidates) {
                if (!candidate || candidate.id === source.id || candidate.alive === false)
                    continue;
                const candidateDistanceSq = distanceSq(source, candidate);
                if (candidateDistanceSq < bestDistanceSq) {
                    bestDistanceSq = candidateDistanceSq;
                    chosen = candidate;
                }
            }
            return chosen;
        };
        const canUseResource = (bot, item, options = {}) => {
            if (!item?.id)
                return false;
            const maxDistance = Number(options.maxDistance || Number.POSITIVE_INFINITY);
            if (distanceSq(bot, item) > maxDistance * maxDistance)
                return false;
            if (options.anchor) {
                const anchorRadius = Number(options.anchorRadius || Number.POSITIVE_INFINITY);
                if (distanceSq(options.anchor, item) > anchorRadius * anchorRadius)
                    return false;
            }
            return true;
        };
        const chooseResource = (bot, collection, claims, options = {}) => {
            const lockKey = String(options.lockKey || "");
            const locks = bot.heistResourceLocks || (bot.heistResourceLocks = {});
            const lock = lockKey ? locks[lockKey] : null;
            if (lock && now < Number(lock.until || 0)) {
                const retained = (collection || []).find((item) => String(item?.id || "") === String(lock.id || ""));
                if (retained && canUseResource(bot, retained, options)) {
                    claims.add(String(retained.id));
                    return retained;
                }
            }
            let chosen = null;
            let bestScore = Number.POSITIVE_INFINITY;
            for (const item of collection || []) {
                if (!item?.id || claims.has(String(item.id)) || !canUseResource(bot, item, options))
                    continue;
                const fromBotSq = distanceSq(bot, item);
                const fromAnchorSq = options.anchor ? distanceSq(options.anchor, item) : 0;
                let score = fromBotSq + fromAnchorSq * 0.12;
                if (options.laneTarget)
                    score += distanceSq(item, options.laneTarget) * 0.035;
                if (score < bestScore) {
                    bestScore = score;
                    chosen = item;
                }
            }
            if (chosen?.id) {
                claims.add(String(chosen.id));
                if (lockKey) {
                    locks[lockKey] = {
                        id: String(chosen.id),
                        until: now + CORE_HEIST_BOT_RESOURCE_LOCK_MS,
                    };
                }
            }
            return chosen;
        };
        const formationBehind = (leader, destination, side = 0, distance = 390) => {
            const facing = Math.atan2(Number(destination?.y || leader?.y || 0) - Number(leader?.y || 0), Number(destination?.x || leader?.x || 0) - Number(leader?.x || 0));
            const forwardX = Math.cos(facing);
            const forwardY = Math.sin(facing);
            const sideX = -forwardY;
            const sideY = forwardX;
            return {
                x: Number(leader?.x || 0) - forwardX * distance + sideX * side,
                y: Number(leader?.y || 0) - forwardY * distance + sideY * side,
            };
        };
        const bots = units.filter((unit) => unit.isBot);
        const claimedOrbIds = new Set();
        const claimedEnergyIds = new Set();
        for (const bot of bots) {
            if (now < Number(bot.heistPlanUntil || 0))
                continue;
            bot.heistPlanUntil = now + CORE_HEIST_BOT_REPLAN_MIN_MS +
                Math.floor(Math.random() * (CORE_HEIST_BOT_REPLAN_MAX_MS - CORE_HEIST_BOT_REPLAN_MIN_MS));
            const team = String(bot.team || "cyan") === "orange" ? "orange" : "cyan";
            const enemyTeam = this.getCoreHeistEnemyTeam(team);
            const ownBase = this.getCoreHeistBase(room, team);
            const enemyBase = this.getCoreHeistBase(room, enemyTeam);
            const ownFlag = this.getCoreHeistFlag(room, team);
            const enemyFlag = this.getCoreHeistFlag(room, enemyTeam);
            const role = this.normalizeCoreHeistRole(bot.heistRole || "attacker");
            const teamUnits = units.filter((unit) => String(unit.team || "cyan") === team);
            const enemies = units.filter((unit) => String(unit.team || "cyan") === enemyTeam);
            const tank = teamUnits.find((unit) => this.normalizeCoreHeistRole(unit.heistRole || "attacker") === "tank") || null;
            const attackers = teamUnits.filter((unit) => this.normalizeCoreHeistRole(unit.heistRole || "attacker") === "attacker");
            const attackerIndex = Math.max(0, attackers.findIndex((unit) => unit.id === bot.id));
            const nearbyEnemy = findNearest(bot, enemies, 1900);
            const enemyCarrier = enemies.find((unit) => String(unit.heistFlagId || "") === String(ownFlag?.id || "")) || null;
            const allyCarrier = teamUnits.find((unit) => Boolean(unit.heistFlagId)) || null;
            const baseDistance = Math.hypot(Number(enemyBase?.x || 0) - Number(ownBase?.x || 0), Number(enemyBase?.y || 0) - Number(ownBase?.y || 0));
            const homeThreatRadius = Math.max(CORE_HEIST_BOT_HOME_THREAT_RADIUS, Math.min(3300, baseDistance * 0.25));
            const baseThreats = enemies.filter((enemy) => distanceSq(enemy, ownBase) <= homeThreatRadius * homeThreatRadius);
            const baseThreat = findNearest(bot, baseThreats, homeThreatRadius + 600);
            const energyLow = Number(bot.energy || 0) <= CORE_HEIST_BOT_LOW_ENERGY;
            const drones = Number(bot.drones || 0);
            const needsAttackerOrbs = drones < CORE_HEIST_BOT_ATTACKER_MIN_DRONES;
            const assaultTarget = enemyFlag || enemyBase;
            const tankIntent = tank?.heistLeaderTarget && now - Number(tank.heistLeaderTarget.updatedAt || 0) < 1800
                ? tank.heistLeaderTarget
                : assaultTarget;
            let targetX = Number(bot.x || 0);
            let targetY = Number(bot.y || 0);
            let attackTarget = null;
            let nextState = "hold";
            let emergencyMove = false;
            if (bot.heistFlagId) {
                targetX = Number(ownBase?.x || bot.x);
                targetY = Number(ownBase?.y || bot.y);
                attackTarget = nearbyEnemy;
                nextState = "return-flag";
                emergencyMove = true;
            }
            else if (ownFlag?.status === "dropped") {
                targetX = Number(ownFlag.x || ownBase?.x || bot.x);
                targetY = Number(ownFlag.y || ownBase?.y || bot.y);
                attackTarget = nearbyEnemy || baseThreat;
                nextState = "recover-own-flag";
                emergencyMove = true;
            }
            else if (enemyCarrier) {
                targetX = Number(enemyCarrier.x || ownBase?.x || bot.x);
                targetY = Number(enemyCarrier.y || ownBase?.y || bot.y);
                attackTarget = enemyCarrier;
                nextState = role === "defender" ? "defend-carrier" : "intercept-carrier";
                emergencyMove = true;
            }
            else if (!combatReady) {
                const prepareEnergy = Number(bot.energy || 0) <= CORE_HEIST_BOT_PREPARE_ENERGY_TARGET
                    ? chooseResource(bot, room.energyCells || [], claimedEnergyIds, {
                        maxDistance: 3900,
                        anchor: ownBase,
                        anchorRadius: 3800,
                        lockKey: "prepare-energy",
                    })
                    : null;
                const prepareOrb = !prepareEnergy
                    ? chooseResource(bot, room.orbs || [], claimedOrbIds, {
                        maxDistance: 3400,
                        anchor: ownBase,
                        anchorRadius: 3300,
                        lockKey: "prepare-orbs",
                    })
                    : null;
                if (prepareEnergy || prepareOrb) {
                    const resource = prepareEnergy || prepareOrb;
                    targetX = Number(resource.x || bot.x);
                    targetY = Number(resource.y || bot.y);
                    nextState = prepareEnergy ? "prepare-energy" : "prepare-orbs";
                }
                else {
                    const formation = role === "defender"
                        ? { x: -460, y: 0 }
                        : role === "tank"
                            ? { x: 180, y: 0 }
                            : { x: 430, y: attackerIndex === 0 ? -220 : 220 };
                    targetX = Number(ownBase?.x || bot.x) + formation.x;
                    targetY = Number(ownBase?.y || bot.y) + formation.y;
                    nextState = "prepare-formation";
                }
            }
            else if (role === "defender") {
                if (baseThreat) {
                    const dx = Number(baseThreat.x || 0) - Number(ownBase?.x || 0);
                    const dy = Number(baseThreat.y || 0) - Number(ownBase?.y || 0);
                    const distance = Math.hypot(dx, dy) || 1;
                    const interceptDistance = Math.min(homeThreatRadius - 170, Math.max(500, distance - 300));
                    targetX = Number(ownBase?.x || bot.x) + (dx / distance) * interceptDistance;
                    targetY = Number(ownBase?.y || bot.y) + (dy / distance) * interceptDistance;
                    attackTarget = baseThreat;
                    nextState = "intercept-base-threat";
                    emergencyMove = true;
                }
                else {
                    const defenderNeedsEnergy = Number(bot.energy || 0) < CORE_HEIST_BOT_DEFENDER_ENERGY_TARGET;
                    const defenderNeedsOrbs = drones < CORE_HEIST_BOT_DEFENDER_MIN_DRONES;
                    const defenderFarmRadius = Math.min(CORE_HEIST_BOT_HOME_FARM_RADIUS, Math.max(1500, homeThreatRadius - 360));
                    const energyTarget = defenderNeedsEnergy
                        ? chooseResource(bot, room.energyCells || [], claimedEnergyIds, {
                            maxDistance: defenderFarmRadius + 420,
                            anchor: ownBase,
                            anchorRadius: defenderFarmRadius,
                            lockKey: "defender-energy",
                        })
                        : null;
                    const orbTarget = !energyTarget && defenderNeedsOrbs
                        ? chooseResource(bot, room.orbs || [], claimedOrbIds, {
                            maxDistance: defenderFarmRadius + 420,
                            anchor: ownBase,
                            anchorRadius: defenderFarmRadius,
                            lockKey: "defender-orbs",
                        })
                        : null;
                    if (energyTarget || orbTarget) {
                        const resource = energyTarget || orbTarget;
                        targetX = Number(resource.x || bot.x);
                        targetY = Number(resource.y || bot.y);
                        nextState = energyTarget ? "defender-energy-route" : "defender-orb-route";
                    }
                    else {
                        const inward = Number(enemyBase?.x || WORLD_WIDTH * 0.5) >= Number(ownBase?.x || WORLD_WIDTH * 0.5) ? 1 : -1;
                        const patrolRadius = CORE_HEIST_BOT_DEFENDER_PATROL_RADIUS;
                        const patrolPoints = [
                            { x: inward * patrolRadius * 0.60, y: -patrolRadius * 0.66 },
                            { x: inward * patrolRadius * 0.96, y: -patrolRadius * 0.31 },
                            { x: inward * patrolRadius * 1.08, y: 0 },
                            { x: inward * patrolRadius * 0.96, y: patrolRadius * 0.31 },
                            { x: inward * patrolRadius * 0.60, y: patrolRadius * 0.66 },
                            { x: inward * patrolRadius * 0.32, y: 0 },
                        ];
                        let patrolIndex = Number.isFinite(Number(bot.heistPatrolIndex))
                            ? Math.max(0, Math.floor(Number(bot.heistPatrolIndex)) % patrolPoints.length)
                            : Math.abs(String(bot.id || "").length) % patrolPoints.length;
                        let patrolPoint = patrolPoints[patrolIndex];
                        const patrolX = Number(ownBase?.x || bot.x) + patrolPoint.x;
                        const patrolY = Number(ownBase?.y || bot.y) + patrolPoint.y;
                        if (Math.hypot(Number(bot.x || 0) - patrolX, Number(bot.y || 0) - patrolY) <= CORE_HEIST_BOT_DEFENDER_PATROL_ARRIVAL_RADIUS) {
                            patrolIndex = (patrolIndex + 1) % patrolPoints.length;
                            bot.heistPatrolIndex = patrolIndex;
                            patrolPoint = patrolPoints[patrolIndex];
                        }
                        targetX = Number(ownBase?.x || bot.x) + patrolPoint.x;
                        targetY = Number(ownBase?.y || bot.y) + patrolPoint.y;
                        nextState = "defender-patrol";
                    }
                }
            }
            else if (role === "tank") {
                if (allyCarrier && allyCarrier.id !== bot.id) {
                    const escort = formationBehind(allyCarrier, ownBase, 0, 250);
                    targetX = escort.x;
                    targetY = escort.y;
                    attackTarget = findNearest(allyCarrier, enemies, 1750) || nearbyEnemy;
                    nextState = "escort-carrier";
                    emergencyMove = true;
                }
                else {
                    const tankNeedsEnergy = Number(bot.energy || 0) < 82;
                    const tankNeedsOrbs = drones < CORE_HEIST_BOT_TANK_MIN_DRONES;
                    const tankEnergy = tankNeedsEnergy
                        ? chooseResource(bot, room.energyCells || [], claimedEnergyIds, {
                            maxDistance: 3300,
                            laneTarget: assaultTarget,
                            lockKey: "tank-energy",
                        })
                        : null;
                    const tankOrbs = !tankEnergy && tankNeedsOrbs
                        ? chooseResource(bot, room.orbs || [], claimedOrbIds, {
                            maxDistance: 3400,
                            laneTarget: assaultTarget,
                            lockKey: "tank-orbs",
                        })
                        : null;
                    if (tankEnergy || tankOrbs) {
                        const resource = tankEnergy || tankOrbs;
                        targetX = Number(resource.x || bot.x);
                        targetY = Number(resource.y || bot.y);
                        attackTarget = nearbyEnemy && distanceSq(nearbyEnemy, bot) < 1250 * 1250 ? nearbyEnemy : null;
                        nextState = tankEnergy ? "leader-energy" : "leader-orbs";
                    }
                    else {
                        targetX = Number(assaultTarget?.x || bot.x);
                        targetY = Number(assaultTarget?.y || bot.y);
                        attackTarget = nearbyEnemy && distanceSq(nearbyEnemy, bot) < 1350 * 1350 ? nearbyEnemy : null;
                        nextState = "lead-flag-push";
                    }
                }
            }
            else {
                const side = attackerIndex % 2 === 0 ? -235 : 235;
                const carrier = allyCarrier || null;
                const leader = carrier || tank;
                const leaderDestination = carrier?.heistFlagId
                    ? ownBase
                    : (tankIntent || assaultTarget);
                const formation = leader
                    ? formationBehind(leader, leaderDestination, side, carrier?.heistFlagId ? 285 : 380)
                    : { x: Number(assaultTarget?.x || bot.x), y: Number(assaultTarget?.y || bot.y) };
                const formationThreat = leader ? findNearest(leader, enemies, 2250) : nearbyEnemy;
                const closeToFormation = !leader || distanceSq(bot, formation) <= 1100 * 1100;
                const safeToFarm = !formationThreat && !baseThreat && !carrier && closeToFormation;
                const attackerEnergy = safeToFarm && energyLow
                    ? chooseResource(bot, room.energyCells || [], claimedEnergyIds, {
                        maxDistance: 920,
                        anchor: formation,
                        anchorRadius: 980,
                        laneTarget: formation,
                        lockKey: "escort-energy",
                    })
                    : null;
                const attackerOrbs = safeToFarm && !attackerEnergy && needsAttackerOrbs
                    ? chooseResource(bot, room.orbs || [], claimedOrbIds, {
                        maxDistance: 980,
                        anchor: formation,
                        anchorRadius: 1040,
                        laneTarget: formation,
                        lockKey: "escort-orbs",
                    })
                    : null;
                if (attackerEnergy || attackerOrbs) {
                    const resource = attackerEnergy || attackerOrbs;
                    targetX = Number(resource.x || bot.x);
                    targetY = Number(resource.y || bot.y);
                    attackTarget = nearbyEnemy;
                    nextState = attackerEnergy ? "escort-energy" : "escort-orbs";
                }
                else {
                    targetX = Number(formation.x || bot.x);
                    targetY = Number(formation.y || bot.y);
                    attackTarget = formationThreat || nearbyEnemy;
                    nextState = carrier?.heistFlagId ? "protect-carrier" : "follow-tank";
                }
            }
            if (role === "tank") {
                bot.heistLeaderTarget = {
                    x: targetX,
                    y: targetY,
                    state: nextState,
                    updatedAt: now,
                };
            }
            const rawTargetX = targetX - Number(bot.x || 0);
            const rawTargetY = targetY - Number(bot.y || 0);
            const targetDistance = Math.hypot(rawTargetX, rawTargetY);
            let desiredX = targetDistance > 0.001 ? rawTargetX / targetDistance : 0;
            let desiredY = targetDistance > 0.001 ? rawTargetY / targetDistance : 0;
            let repelX = 0;
            let repelY = 0;
            for (const unit of units) {
                if (!unit || unit.id === bot.id)
                    continue;
                const ax = Number(bot.x || 0) - Number(unit.x || 0);
                const ay = Number(bot.y || 0) - Number(unit.y || 0);
                const distance = Math.hypot(ax, ay) || 1;
                if (distance < 250) {
                    const force = ((250 - distance) / 250) ** 2;
                    repelX += (ax / distance) * force;
                    repelY += (ay / distance) * force;
                }
            }
            if (bot.heistFlagId) {
                const lateral = bot.id.length % 2 ? 0.13 : -0.13;
                const originalX = desiredX;
                desiredX += -desiredY * lateral;
                desiredY += originalX * lateral;
            }
            const arrivalRadius = nextState.includes("energy") || nextState.includes("orbs") || nextState.includes("-route")
                ? CORE_HEIST_BOT_ARRIVAL_RADIUS
                : nextState.includes("patrol")
                    ? CORE_HEIST_BOT_DEFENDER_PATROL_ARRIVAL_RADIUS
                    : nextState.includes("formation") || nextState.includes("vanguard") || nextState.includes("wait-for")
                        ? 135
                        : 0;
            const shouldHoldAtTarget = !attackTarget && targetDistance <= arrivalRadius;
            const wanted = shouldHoldAtTarget
                ? { x: 0, y: 0 }
                : this.normalizeZoneBotMove(desiredX + repelX * 0.34, desiredY + repelY * 0.34);
            let movement = wanted;
            if (!shouldHoldAtTarget && (Math.abs(wanted.x) > 0.001 || Math.abs(wanted.y) > 0.001)) {
                const previousX = Number(bot.heistSteerX || 0);
                const previousY = Number(bot.heistSteerY || 0);
                const previousLength = Math.hypot(previousX, previousY);
                const blend = previousLength < 0.08
                    ? 1
                    : emergencyMove
                        ? CORE_HEIST_BOT_EMERGENCY_STEER_BLEND
                        : CORE_HEIST_BOT_STEER_BLEND;
                movement = this.normalizeZoneBotMove(previousX * (1 - blend) + wanted.x * blend, previousY * (1 - blend) + wanted.y * blend);
            }
            bot.heistSteerX = movement.x;
            bot.heistSteerY = movement.y;
            const attackDx = Number(attackTarget?.x || targetX) - Number(bot.x || 0);
            const attackDy = Number(attackTarget?.y || targetY) - Number(bot.y || 0);
            const attackDistance = Math.hypot(attackDx, attackDy);
            const attackRange = role === "attacker" ? 1760 : role === "tank" ? 1320 : 1560;
            const fireCadence = role === "attacker" ? 470 : role === "tank" ? 760 : 580;
            const canFireRoleWeapon = role === "tank" || Number(bot.drones || 0) > 0;
            const canAttack = Boolean(combatReady &&
                attackTarget &&
                attackDistance <= attackRange &&
                canFireRoleWeapon &&
                now - Number(bot.lastFireAt || 0) >= fireCadence);
            const protectingCarrier = Boolean(allyCarrier && distanceSq(bot, allyCarrier) < 1200 * 1200);
            bot.input = {
                mobileMove: true,
                moveX: movement.x,
                moveY: movement.y,
                attacking: canAttack,
                shield: Boolean(combatReady &&
                    Number(bot.energy || 0) >= 20 &&
                    (Boolean(bot.heistFlagId) ||
                        protectingCarrier ||
                        (role === "defender" && attackTarget && attackDistance < 940) ||
                        (role === "tank" && attackTarget && attackDistance < 760))),
                mouseX: Number(attackTarget?.x || targetX),
                mouseY: Number(attackTarget?.y || targetY),
            };
            bot.aiTargetX = targetX;
            bot.aiTargetY = targetY;
            bot.aiState = `ctf-${role}-${nextState}`;
            bot.lastSeenAt = now;
            bot.lastInputReceivedAt = now;
        }
    }
    updateCoreHeistObjective(room, now) {
        const heist = room?.heist;
        if (!heist || room.status !== "playing")
            return;
        if (now >= Number(heist.matchEndsAt || 0)) {
            const cyan = Number(heist.score?.cyan || 0);
            const orange = Number(heist.score?.orange || 0);
            const winnerTeam = cyan === orange ? "cyan" : cyan > orange ? "cyan" : "orange";
            const winner = [...room.players.values()].find((player) => String(player?.team || "cyan") === winnerTeam) || null;
            this.finishCoreHeistMatch(room, winner, winnerTeam, now, "time");
            return;
        }
        const flags = heist.flags || [];
        const alivePlayers = [...room.players.values()].filter((player) => player?.alive !== false);
        for (const flag of flags) {
            if (flag.status === "dropped" && Number(flag.returnAt || 0) > 0 && now >= Number(flag.returnAt)) {
                this.resetCoreHeistFlag(flag);
                this.pushCombatEvent(room, { id: `flag-${flag.id}`, x: flag.x, y: flag.y }, `${this.getCoreHeistTeamLabel(flag.team)} FLAG RETURNED`, "heal", now);
                this.pushCoreHeistEvent(room, {
                    type: "returned",
                    actorName: "SYSTEM",
                    flag,
                }, now);
            }
        }
        for (const player of alivePlayers) {
            const team = String(player.team || "cyan");
            const enemyTeam = this.getCoreHeistEnemyTeam(team);
            const ownBase = this.getCoreHeistBase(room, team);
            const ownFlag = this.getCoreHeistFlag(room, team);
            const enemyFlag = this.getCoreHeistFlag(room, enemyTeam);
            if (player.heistFlagId) {
                const carried = this.getCoreHeistFlag(room, String(player.heistFlagId));
                if (carried && ownBase) {
                    carried.x = Number(player.x);
                    carried.y = Number(player.y);
                    const dx = Number(player.x) - Number(ownBase.x);
                    const dy = Number(player.y) - Number(ownBase.y);
                    if (dx * dx + dy * dy <= CORE_HEIST_BASE_CAPTURE_RADIUS * CORE_HEIST_BASE_CAPTURE_RADIUS) {
                        heist.score[team] = Number(heist.score?.[team] || 0) + 1;
                        heist.lastScoreAt = now;
                        carried.lastCarrierId = player.id;
                        carried.lastCarrierName = this.getCoreHeistPlayerName(player);
                        carried.lastCarrierTeam = team;
                        player.heistFlagId = null;
                        this.pushCombatEvent(room, player, "FLAG CAPTURED", "drone-reward", now);
                        this.pushCoreHeistEvent(room, {
                            type: "captured",
                            actor: player,
                            flag: carried,
                            scoreTeam: team,
                        }, now);
                        this.resetCoreHeistFlag(carried);
                        if (Number(heist.score?.[team] || 0) >= CORE_HEIST_TARGET_SCORE) {
                            this.finishCoreHeistMatch(room, player, team, now, "flag-capture");
                            return;
                        }
                    }
                }
                continue;
            }
            if (ownFlag?.status === "dropped") {
                const dx = Number(player.x) - Number(ownFlag.x);
                const dy = Number(player.y) - Number(ownFlag.y);
                if (dx * dx + dy * dy <= CORE_HEIST_FLAG_PICKUP_DISTANCE * CORE_HEIST_FLAG_PICKUP_DISTANCE) {
                    this.resetCoreHeistFlag(ownFlag);
                    this.pushCombatEvent(room, player, "FLAG RETURNED", "heal", now);
                    this.pushCoreHeistEvent(room, {
                        type: "returned",
                        actor: player,
                        flag: ownFlag,
                    }, now);
                    continue;
                }
            }
            if (enemyFlag && (enemyFlag.status === "home" || enemyFlag.status === "dropped")) {
                const dx = Number(player.x) - Number(enemyFlag.x);
                const dy = Number(player.y) - Number(enemyFlag.y);
                if (dx * dx + dy * dy <= CORE_HEIST_FLAG_PICKUP_DISTANCE * CORE_HEIST_FLAG_PICKUP_DISTANCE) {
                    enemyFlag.status = "carried";
                    enemyFlag.carrierId = player.id;
                    enemyFlag.lastCarrierId = player.id;
                    enemyFlag.lastCarrierName = this.getCoreHeistPlayerName(player);
                    enemyFlag.lastCarrierTeam = team;
                    enemyFlag.returnAt = 0;
                    enemyFlag.droppedAt = 0;
                    player.heistFlagId = enemyFlag.id;
                    this.pushCombatEvent(room, player, "ENEMY FLAG TAKEN", "drone-reward", now);
                    this.pushCoreHeistEvent(room, {
                        type: "taken",
                        actor: player,
                        flag: enemyFlag,
                    }, now);
                }
            }
        }
    }
    finishCoreHeistMatch(room, winner, winnerTeam, now = Date.now(), reason = "score") {
        if (!room || room.status === "finished")
            return;
        room.status = "finished";
        room.locked = true;
        room.countdownStartedAt = null;
        room.battlePrepareUntil = null;
        room.heistRoleRevealUntil = null;
        room.heistRoleRevealUntil = null;
        room.heistRoleRevealUntil = null;
        room.battleBeginFlashUntil = null;
        room.winnerId = winner?.id || null;
        room.winnerName = `${this.getCoreHeistTeamLabel(winnerTeam)} TEAM`;
        room.finishReason = `capture-the-flag-${reason}`;
        room.finishedAt = now;
        room.closingAt = now + ZONE_PVP_FINISH_DISPLAY_MS;
        room.phaseVersion = Number(room.phaseVersion || 0) + 1;
        room.projectiles = [];
        for (const player of room.players.values()) {
            player.input = {};
            player.shieldActive = false;
            player.shieldUntil = 0;
        }
        this.broadcastZonePvpRoomState(room, now, true);
    }
    updateZonePvpRoomStatus(room, now) {
        if (room.roundStarted || room.status === "playing" || room.status === "finished")
            return;
        if (room.status !== "countdown")
            return;
        const minPlayers = room?.coreHeistMode ? CORE_HEIST_ROOM_MIN_PLAYERS : ZONE_PVP_ROOM_MIN_PLAYERS;
        const countdownMs = room?.coreHeistMode ? CORE_HEIST_START_COUNTDOWN_MS : ZONE_PVP_START_COUNTDOWN_MS;
        if (this.getZoneConnectedHumanPlayerCount(room) < minPlayers) {
            room.status = "waiting";
            room.locked = false;
            room.countdownStartedAt = null;
            room.roundId = null;
            room.phaseVersion = Number(room.phaseVersion || 0) + 1;
            this.broadcastZonePvpRoomState(room, now, true);
            return;
        }
        if (now - room.countdownStartedAt >= countdownMs) {
            const zoneRadius = this.getZonePvpZoneRadius(room);
            this.fillZonePvpBots(room, zoneRadius);
            room.status = "playing";
            room.roundStarted = true;
            room.locked = true;
            room.countdownStartedAt = null;
            room.matchStartedAt = now;
            room.heistRoleRevealUntil = room?.coreHeistMode ? now + CORE_HEIST_ROLE_REVEAL_DURATION : null;
            room.battlePrepareUntil = now + (room?.coreHeistMode
                ? CORE_HEIST_ROLE_REVEAL_DURATION + CORE_HEIST_BATTLE_PREPARE_DURATION
                : ZONE_PVP_BATTLE_PREPARE_DURATION);
            room.battleBeginFlashUntil = room.battlePrepareUntil + 1800;
            room.matchHadMultiplePlayers = true;
            room.phaseVersion = Number(room.phaseVersion || 0) + 1;
            room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY;
            if (room?.coreHeistMode) {
                this.initializeCoreHeistRoom(room, now);
                const nextSpawnSlot = { cyan: 0, orange: 0 };
                for (const player of room.players.values()) {
                    const team = String(player.team || this.assignCoreHeistTeam(room)) === "orange"
                        ? "orange"
                        : "cyan";
                    player.team = team;
                    const slot = nextSpawnSlot[team] || 0;
                    nextSpawnSlot[team] = slot + 1;
                    player.heistSpawnIndex = slot;
                    const spawn = this.getCoreHeistSpawn(room, team, slot);
                    player.x = spawn.x;
                    player.y = spawn.y;
                    player.prevX = spawn.x;
                    player.prevY = spawn.y;
                    player.velocityX = 0;
                    player.velocityY = 0;
                    player.input = {};
                }
                this.assignCoreHeistTeamRoles(room);
                room.lastBroadcastAt = 0;
                room.lastTransformBroadcastAt = 0;
            }
            this.broadcastZonePvpRoomState(room, now, true);
        }
    }
    isBattlePrepareLocked(room, now = Date.now()) {
        return Boolean(room?.zonePvpMode &&
            room?.battlePrepareUntil &&
            now < room.battlePrepareUntil);
    }
    isCoreHeistRoleRevealLocked(room, now = Date.now()) {
        return Boolean(room?.coreHeistMode &&
            room?.heistRoleRevealUntil &&
            now < room.heistRoleRevealUntil);
    }
    updatePlayers(room, now, zoneRadius, deltaFrames = 1) {
        const battleLocked = this.isBattlePrepareLocked(room, now);
        const roleRevealLocked = this.isCoreHeistRoleRevealLocked(room, now);
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
            if (roleRevealLocked && room?.coreHeistMode) {
                dx = 0;
                dy = 0;
                player.velocityX = 0;
                player.velocityY = 0;
            }
            const isMovingInput = dx !== 0 || dy !== 0;
            if (isMovingInput &&
                now - player.lastEnergyDrainAt >= ENERGY_DRAIN_INTERVAL) {
                player.energy = Math.max(0, player.energy - ENERGY_DRAIN_AMOUNT);
                player.lastEnergyDrainAt = now;
                if (player.energy <= 0) {
                    player.energy = 0;
                    if (!room?.zonePvpMode) {
                        this.eliminatePlayer(room, player, null, now, "energy-empty");
                        continue;
                    }
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
            const coreCarryMultiplier = room?.coreHeistMode && player?.heistFlagId
                ? CORE_HEIST_CARRIER_SPEED_MULTIPLIER
                : 1;
            const speed = PLAYER_SPEED * progressionMoveMultiplier * coreCarryMultiplier;
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
        this.recordLivePvpLeaderboardScore(killer, room);
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
    getStableSpectatorTarget(room, victim, _preferred = null) {
        if (!room || !victim)
            return null;
        const isValid = (candidate) => candidate && candidate.id !== victim.id && candidate.alive !== false;
        const lockedTarget = victim.spectatorTargetId
            ? room.players.get(victim.spectatorTargetId)
            : null;
        if (isValid(lockedTarget))
            return lockedTarget;
        const allCandidates = [...room.players.values()].filter(isValid);
        const candidates = room?.coreHeistMode
            ? allCandidates.filter((candidate) => String(candidate?.team || "cyan") === String(victim?.team || "cyan"))
            : allCandidates;
        const pool = candidates.length ? candidates : allCandidates;
        if (!pool.length)
            return null;
        return pool[Math.floor(Math.random() * pool.length)] || null;
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
        if (room?.coreHeistMode) {
            this.dropCoreHeistFlag(room, victim, now);
            victim.heistDeaths = Number(victim.heistDeaths || 0) + 1;
            victim.lastSeenAt = now;
            const permanent = Number(victim.heistDeaths || 0) >= CORE_HEIST_MAX_DEATHS;
            victim.heistPermanentElimination = permanent;
            victim.respawnAt = permanent ? 0 : now + CORE_HEIST_RESPAWN_MS;
            const spectatorTarget = permanent
                ? this.getStableSpectatorTarget(room, victim, validKiller)
                : null;
            victim.spectatorTargetId = spectatorTarget?.id || null;
            if (wasAlive) {
                const socket = this.server.sockets.sockets.get(victim.id);
                socket?.emit("zone-pvp:eliminated", {
                    serverTime: now,
                    reason,
                    permanent,
                    deaths: Number(victim.heistDeaths || 0),
                    respawnAt: victim.respawnAt,
                    you: this.serializeZonePvpStatePlayer(room, victim),
                    spectatorTargetId: spectatorTarget?.id || null,
                    spectatingPlayer: spectatorTarget
                        ? this.serializeZonePvpStatePlayer(room, spectatorTarget)
                        : null,
                });
            }
            return spectatorTarget;
        }
        const spectatorTarget = this.getStableSpectatorTarget(room, victim, validKiller);
        victim.spectatorTargetId = spectatorTarget?.id || null;
        victim.lastSeenAt = now;
        if (wasAlive && room?.normalMode) {
            this.recordNormalPvpBest(victim);
        }
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
        if (room?.coreHeistMode &&
            String(a?.team || "cyan") === String(b?.team || "cyan")) {
            const overlap = Math.max(0, BODY_COLLISION_DISTANCE - rawDistance);
            const separation = Math.max(4, Math.min(12, overlap * 0.22 + 2));
            this.applyCollisionSeparation(a, -dirX, -dirY, separation, zoneRadius, room);
            this.applyCollisionSeparation(b, dirX, dirY, separation, zoneRadius, room);
            return;
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
        const isCoreHeistTank = Boolean(room?.coreHeistMode &&
            this.normalizeCoreHeistRole(player?.heistRole || "attacker") === "tank");
        const hasEscortDrone = Number(player?.drones || 0) > 0;
        if (!hasEscortDrone && !isCoreHeistTank)
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
        if (!isCoreHeistTank) {
            player.drones = Math.max(0, player.drones - 1);
            this.resetDroneProgress(player);
        }
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
            isTankCannon: isCoreHeistTank,
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
        let cooldown = player?.isBot
            ? Math.max(420, Number(player?.botFireCooldown || ZONE_PVP_BOT_FAST_FIRE_COOLDOWN))
            : FIRE_COOLDOWN;
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
                const owner = room.players.get(projectile.ownerId);
                if (room?.coreHeistMode &&
                    owner &&
                    String(owner.team || "cyan") === String(target.team || "cyan")) {
                    continue;
                }
                const dx = target.x - projectile.x;
                const dy = target.y - projectile.y;
                if (dx * dx + dy * dy > 105 * 105)
                    continue;
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
            you: room?.zonePvpMode
                ? this.serializeZonePvpStatePlayer(room, player)
                : this.serializePlayer(player),
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
            const pickupDistance = room?.coreHeistMode
                ? CORE_HEIST_ORB_COLLECT_DISTANCE
                : ORB_COLLECT_DISTANCE;
            const candidates = room?.coreHeistMode
                ? room.orbs
                : room.orbSpatialIndex
                    ? this.querySpatialIndex(room.orbSpatialIndex, player.x, player.y, pickupDistance + 180)
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
                    pickupDistance * pickupDistance &&
                    pathDistance > pickupDistance) {
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
            if (room?.coreHeistMode) {
                this.ensureCoreHeistResources(room, zoneRadius);
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
            const pickupDistance = room?.coreHeistMode
                ? CORE_HEIST_ENERGY_COLLECT_DISTANCE
                : ENERGY_CELL_COLLECT_DISTANCE;
            const candidates = room?.coreHeistMode
                ? room.energyCells
                : room.energySpatialIndex
                    ? this.querySpatialIndex(room.energySpatialIndex, player.x, player.y, pickupDistance + 180)
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
                    pickupDistance * pickupDistance &&
                    pathDistance > pickupDistance) {
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
            if (room?.coreHeistMode) {
                this.ensureCoreHeistResources(room, zoneRadius);
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
        if (room.normalMode || room.battleRoyaleOnlineMode || (room.zonePvpMode && !room.coreHeistMode)) {
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
        const localItemRefreshMs = room?.coreHeistMode ? 650 : 1800;
        if (now - (room.lastLocalItemAt || 0) > localItemRefreshMs) {
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
    finishZonePvpMatch(room, winner, now = Date.now(), reason = "winner") {
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
        room.finishReason = reason;
        room.closingAt = now + ZONE_PVP_FINISH_DISPLAY_MS;
        room.phaseVersion = Number(room.phaseVersion || 0) + 1;
        room.projectiles = [];
        for (const player of room.players.values()) {
            player.input = {};
            player.shieldActive = false;
            player.shieldUntil = 0;
        }
        this.recordZonePvpMatch(room, winner);
        this.broadcastZonePvpRoomState(room, now, true);
    }
    closeZonePvpRoom(room, now = Date.now(), reason = "finished") {
        if (!room || room.closedAt)
            return;
        room.closedAt = now;
        room.status = "finished";
        room.locked = true;
        room.finishReason = room.finishReason || reason;
        room.projectiles = [];
        for (const player of [...room.players.values()]) {
            if (!player?.isBot) {
                const socket = this.server.sockets.sockets.get(String(player.id));
                socket?.emit("zone-pvp:round-closed", {
                    roomId: room.id,
                    roundId: room.roundId || null,
                    winnerId: room.winnerId || null,
                    winnerName: room.winnerName || null,
                    reason: room.finishReason || reason,
                    serverNow: now,
                });
                socket?.leave(room.id);
                const token = String(player.resumeToken || this.zonePvpSocketResumeToken.get(String(player.id)) || "");
                if (token)
                    this.zonePvpResumeSeats.delete(token);
                this.zonePvpSocketRoom.delete(String(player.id));
                this.zonePvpSocketResumeToken.delete(String(player.id));
            }
        }
        room.players.clear();
        room.orbs = [];
        room.energyCells = [];
        room.cores = [];
        room.combatEvents = [];
        room.collisionCooldowns?.clear?.();
        this.zonePvpRooms.delete(room.id);
    }
    updateZonePvpWinCondition(room, now) {
        if (room.status !== "playing" || !room.matchHadMultiplePlayers)
            return;
        const alive = this.getAlivePlayers(room);
        if (alive.length === 1) {
            this.finishZonePvpMatch(room, alive[0], now, "winner");
            return;
        }
        if (alive.length === 0) {
            room.lastNoAliveAt = room.lastNoAliveAt || now;
        }
        else {
            room.lastNoAliveAt = null;
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
    normalizeNormalPvpResumeToken(value) {
        const token = String(value || "").trim();
        if (token.length < 20 || token.length > 160 || !/^[A-Za-z0-9_-]+$/.test(token)) {
            return null;
        }
        return token;
    }
    rememberNormalPvpResumeSeat(room, player, token) {
        if (!room || !player || !token)
            return;
        player.resumeToken = token;
        this.normalPvpResumeSeats.set(token, {
            roomId: String(room.id),
            playerId: String(player.id),
        });
        this.normalPvpSocketResumeToken.set(String(player.id), token);
    }
    findNormalPvpResumeSeat(token) {
        if (!token)
            return null;
        const seat = this.normalPvpResumeSeats.get(token);
        if (!seat)
            return null;
        const room = this.normalRooms.get(seat.roomId);
        const player = room?.players?.get(seat.playerId);
        if (!room || !player || String(player.resumeToken || "") !== token) {
            this.normalPvpResumeSeats.delete(token);
            return null;
        }
        return { room, player };
    }
    remapNormalPvpPlayerReferences(room, previousId, nextId) {
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
        room.collisionCooldowns?.clear?.();
    }
    detachNormalPvpSocket(socketId, now = Date.now()) {
        const roomId = this.normalSocketRoom.get(socketId);
        if (!roomId)
            return;
        const room = this.normalRooms.get(roomId);
        const player = room?.players?.get(socketId);
        if (player) {
            player.input = {};
            player.disconnectedAt = now;
            player.lastInputReceivedAt = now - 1000;
        }
        this.normalSocketRoom.delete(socketId);
        this.normalPvpSocketResumeToken.delete(socketId);
    }
    rebindNormalPvpResumeSeat(room, player, client, token) {
        const previousSocketId = String(player.id);
        const nextSocketId = String(client.id);
        if (previousSocketId !== nextSocketId) {
            room.players.delete(previousSocketId);
            this.normalSocketRoom.delete(previousSocketId);
            this.normalPvpSocketResumeToken.delete(previousSocketId);
            this.remapNormalPvpPlayerReferences(room, previousSocketId, nextSocketId);
            player.id = nextSocketId;
            room.players.set(nextSocketId, player);
            const previousSocket = this.server.sockets.sockets.get(previousSocketId);
            if (previousSocket?.connected)
                previousSocket.leave(room.id);
        }
        const now = Date.now();
        player.disconnectedAt = 0;
        player.lastSeenAt = now;
        player.lastInputReceivedAt = now;
        player.input = {};
        this.normalSocketRoom.set(nextSocketId, room.id);
        this.rememberNormalPvpResumeSeat(room, player, token);
        client.join(room.id);
        this.markRoomOccupied(room);
    }
    getNormalRoomBySocket(socketId) {
        const roomId = this.normalSocketRoom.get(socketId);
        if (!roomId)
            return null;
        return this.normalRooms.get(roomId) || null;
    }
    removeNormalPlayer(socketId, options = {}) {
        let roomId = this.normalSocketRoom.get(socketId) || null;
        let room = roomId ? this.normalRooms.get(roomId) : null;
        if (!room) {
            for (const candidate of this.normalRooms.values()) {
                if (candidate?.players?.has(socketId)) {
                    room = candidate;
                    roomId = candidate.id;
                    break;
                }
            }
        }
        if (!room || !roomId)
            return;
        const player = room.players.get(socketId);
        const resumeToken = this.normalPvpSocketResumeToken.get(socketId) ||
            String(player?.resumeToken || "") ||
            null;
        this.recordNormalPvpBest(player);
        room.players.delete(socketId);
        this.server.sockets.sockets.get(socketId)?.leave(roomId);
        this.markRoomEmptyIfNeeded(room);
        if (resumeToken) {
            const seat = this.normalPvpResumeSeats.get(resumeToken);
            if (!seat || String(seat.playerId) === String(socketId)) {
                this.normalPvpResumeSeats.delete(resumeToken);
            }
        }
        this.normalSocketRoom.delete(socketId);
        this.normalPvpSocketResumeToken.delete(socketId);
    }
    cleanupNormalRoom(room, now) {
        for (const player of room.players.values()) {
            const disconnectedAt = Number(player?.disconnectedAt || 0);
            if (disconnectedAt > 0) {
                if (now - disconnectedAt >= NORMAL_PVP_RECONNECT_GRACE_MS) {
                    this.removeNormalPlayer(player.id);
                }
                continue;
            }
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
    findOrCreateZonePvpRoom(participantId = null, userId = null, coreHeistMode = false) {
        const maxPlayers = coreHeistMode ? CORE_HEIST_ROOM_MAX_PLAYERS : ZONE_PVP_ROOM_MAX_PLAYERS;
        const joinableRoom = this.selectMostPopulatedJoinableRoom(this.zonePvpRooms, (room) => Boolean(room?.coreHeistMode) === Boolean(coreHeistMode) &&
            (room.status === "waiting" || room.status === "countdown") &&
            !room.locked &&
            room.players.size < maxPlayers &&
            !(participantId &&
                room.departedParticipantIds instanceof Set &&
                room.departedParticipantIds.has(participantId)) &&
            !(userId &&
                room.departedUserIds instanceof Set &&
                room.departedUserIds.has(userId)));
        if (joinableRoom)
            return joinableRoom;
        const room = {
            id: `${coreHeistMode ? "core-heist" : "zone-pvp"}-${crypto.randomUUID()}`,
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
            zoneLoopErrorCount: 0,
            lastZoneLoopErrorAt: 0,
            lastZoneLoopErrorLogAt: 0,
            lastNoAliveAt: null,
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
            heistRoleRevealUntil: null,
            battleBeginFlashUntil: null,
            matchHadMultiplePlayers: false,
            lastCoreWaveAt: 0,
            nextCoreWaveAt: null,
            lastLocalItemAt: 0,
            lastBroadcastAt: 0,
            winnerId: null,
            winnerName: null,
            finishedAt: null,
            closingAt: null,
            closedAt: null,
            finishReason: null,
            departedParticipantIds: new Set(),
            departedUserIds: new Set(),
            abandonedByAllHumansAt: null,
            collisionCooldowns: new Map(),
            zonePvpMode: true,
            coreHeistMode: Boolean(coreHeistMode),
            heist: coreHeistMode ? this.createCoreHeistState(Date.now()) : null,
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
    removeZonePvpPlayer(socketId, options = {}) {
        const roomId = this.zonePvpSocketRoom.get(socketId);
        if (!roomId)
            return;
        const room = this.zonePvpRooms.get(roomId);
        const now = Date.now();
        if (room) {
            const player = room.players.get(socketId);
            const resumeToken = String(player?.resumeToken || this.zonePvpSocketResumeToken.get(socketId) || "");
            if (options.explicit) {
                const participantId = player?.participantId ||
                    options.participantId ||
                    null;
                if (participantId) {
                    if (!(room.departedParticipantIds instanceof Set)) {
                        room.departedParticipantIds = new Set();
                    }
                    room.departedParticipantIds.add(String(participantId));
                }
                const userId = String(player?.userId || "").trim();
                if (userId) {
                    if (!(room.departedUserIds instanceof Set)) {
                        room.departedUserIds = new Set();
                    }
                    room.departedUserIds.add(userId);
                }
            }
            if (resumeToken)
                this.zonePvpResumeSeats.delete(resumeToken);
            if (room.status === "playing" && !room?.coreHeistMode) {
                this.recordZonePvpParticipant(player, null);
            }
            if (room?.coreHeistMode && player) {
                this.dropCoreHeistFlag(room, player, now);
            }
            room.players.delete(socketId);
            room.projectiles = (room.projectiles || []).filter((projectile) => String(projectile?.ownerId || "") !== String(socketId));
            room.projectileSpatialIndex = null;
            for (const key of room.collisionCooldowns?.keys?.() || []) {
                if (String(key).includes(String(socketId))) {
                    room.collisionCooldowns.delete(key);
                }
            }
            for (const viewer of room.players.values()) {
                if (viewer?.alive !== false)
                    continue;
                if (String(viewer?.spectatorTargetId || "") !== String(socketId))
                    continue;
                viewer.spectatorTargetId = null;
                const replacementTarget = this.getStableSpectatorTarget(room, viewer);
                viewer.spectatorTargetId = replacementTarget?.id || null;
            }
            this.server.sockets.sockets.get(socketId)?.leave(roomId);
            this.zonePvpSocketRoom.delete(socketId);
            this.zonePvpSocketResumeToken.delete(socketId);
            this.markRoomEmptyIfNeeded(room, now);
            this.server.to(roomId).emit("zone-pvp:entity-removed", {
                roomId,
                playerId: socketId,
                projectileOwnerId: socketId,
                serverNow: now,
            });
            const humanCount = this.getZoneHumanPlayerCount(room);
            const connectedHumanCount = this.getZoneConnectedHumanPlayerCount(room);
            if (humanCount === 0) {
                room.abandonedByAllHumansAt = now;
                this.finishZonePvpMatch(room, null, now, "all-real-players-left");
                this.closeZonePvpRoom(room, now, "all-real-players-left");
                return;
            }
            if (room.status === "countdown" &&
                connectedHumanCount < (room?.coreHeistMode ? CORE_HEIST_ROOM_MIN_PLAYERS : ZONE_PVP_ROOM_MIN_PLAYERS)) {
                room.status = "waiting";
                room.locked = false;
                room.countdownStartedAt = null;
                room.roundId = null;
                room.phaseVersion = Number(room.phaseVersion || 0) + 1;
            }
            else if (room.status === "playing") {
                if (room?.coreHeistMode)
                    this.updateCoreHeistObjective(room, now);
                else
                    this.updateZonePvpWinCondition(room, now);
            }
            room.lastStaticStateAt = 0;
            this.broadcastZonePvpRoomState(room, now, true);
        }
        this.zonePvpSocketRoom.delete(socketId);
        this.zonePvpSocketResumeToken.delete(socketId);
    }
    cleanupZonePvpRoom(room, now) {
        for (const player of [...room.players.values()]) {
            if (player?.isBot)
                continue;
            const disconnectedAt = Number(player.disconnectedAt || 0);
            const disconnectedTooLong = disconnectedAt > 0 &&
                now - disconnectedAt >= ZONE_PVP_RECONNECT_GRACE_MS;
            if (disconnectedTooLong) {
                if (!this.zonePvpSocketRoom.has(player.id)) {
                    this.zonePvpSocketRoom.set(player.id, room.id);
                }
                this.removeZonePvpPlayer(player.id);
                if (!this.zonePvpRooms.has(room.id))
                    return;
            }
        }
        if (room.status === "finished") {
            if (!room.closingAt) {
                room.closingAt = now + ZONE_PVP_FINISH_DISPLAY_MS;
            }
            if (now >= room.closingAt) {
                this.closeZonePvpRoom(room, now, room.finishReason || "finished");
                return;
            }
        }
        if (this.shouldDeleteEmptyRoom(room, now)) {
            this.closeZonePvpRoom(room, now, "empty");
        }
    }
    getZonePvpZoneRadius(room) {
        if (room?.coreHeistMode)
            return Math.max(WORLD_WIDTH, WORLD_HEIGHT);
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
        const unitSpatialIndex = this.buildSpatialIndex(units);
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
            const nearbyUnits = this.querySpatialIndex(unitSpatialIndex, viewAnchor.x, viewAnchor.y, range).filter((other) => other.id !== viewer.id &&
                (viewer.alive !== false || other.alive !== false));
            const playerRows = this.filterNear(viewAnchor, nearbyUnits, range, ZONE_TRANSFORM_PLAYER_LIMIT).map((unit) => {
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
        const zoneCountdownDuration = room?.coreHeistMode
            ? CORE_HEIST_START_COUNTDOWN_MS
            : ZONE_PVP_START_COUNTDOWN_MS;
        const zonePvpCountdown = room.status === "countdown" && room.countdownStartedAt
            ? Math.max(1, Math.ceil((zoneCountdownDuration - (now - room.countdownStartedAt)) /
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
            const minimapOrbStride = room.coreHeistMode ? 1 : 3;
            const minimapOrbLimit = room.coreHeistMode ? 420 : 120;
            const minimapEnergyStride = room.coreHeistMode ? 1 : 2;
            const minimapEnergyLimit = room.coreHeistMode ? 240 : 60;
            minimapOrbs = [...room.orbs]
                .sort((a, b) => a.id.localeCompare(b.id))
                .filter((_, index) => index % minimapOrbStride === 0)
                .slice(0, minimapOrbLimit);
            minimapEnergyCells = [...room.energyCells]
                .sort((a, b) => a.id.localeCompare(b.id))
                .filter((_, index) => index % minimapEnergyStride === 0)
                .slice(0, minimapEnergyLimit);
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
            const includeViewportItems = Boolean(room?.coreHeistMode) ||
                !player.lastViewportItemStateAt ||
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
                countdownEndsAt: room.status === "countdown" && room.countdownStartedAt
                    ? Number(room.countdownStartedAt) + zoneCountdownDuration
                    : null,
                coreDropCountdown,
                winnerId: room.winnerId,
                winnerName: room.winnerName,
                playerCount: alivePlayers.length,
                realPlayerCount: this.getZoneHumanPlayerCount(room),
                matchmakingPlayerCount: room.status === "waiting" || room.status === "countdown"
                    ? this.getZoneConnectedHumanPlayerCount(room)
                    : this.getZoneHumanPlayerCount(room),
                botCount: this.getZoneBotCount(room),
                minPlayers: room?.coreHeistMode ? CORE_HEIST_ROOM_MIN_PLAYERS : ZONE_PVP_ROOM_MIN_PLAYERS,
                maxPlayers: room?.coreHeistMode ? CORE_HEIST_ROOM_MAX_PLAYERS : ZONE_PVP_ROOM_MAX_PLAYERS,
                mode: room?.coreHeistMode ? CORE_HEIST_MODE : "zone-pvp",
                heist: this.serializeCoreHeist(room, player, now),
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
                safeZoneRadius: zoneRadius,
                zoneShrinkDuration: room?.coreHeistMode ? 0 : ZONE_PVP_ZONE_SHRINK_DURATION,
                matchStartedAt: room.matchStartedAt,
                battlePrepareUntil: room.battlePrepareUntil || null,
                battlePrepareRemainingMs,
                heistRoleRevealUntil: room?.coreHeistMode ? (room.heistRoleRevealUntil || null) : null,
                heistRoleRevealRemainingMs: room?.coreHeistMode && room.heistRoleRevealUntil ? Math.max(0, room.heistRoleRevealUntil - now) : 0,
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
                const visibleOrbLimit = room.coreHeistMode ? 380 : 140;
                const visibleEnergyLimit = room.coreHeistMode ? 150 : 30;
                if (room.coreHeistMode) {
                    payload.orbs = this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE + 720, visibleOrbLimit);
                    payload.energyCells = this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE + 720, visibleEnergyLimit);
                    payload.cores = this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 8);
                }
                else {
                    payload.orbs = room.orbSpatialIndex
                        ? this.filterNearIndexed(viewAnchor, room.orbSpatialIndex, VIEW_DISTANCE, visibleOrbLimit)
                        : this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, visibleOrbLimit);
                    payload.energyCells = room.energySpatialIndex
                        ? this.filterNearIndexed(viewAnchor, room.energySpatialIndex, VIEW_DISTANCE, visibleEnergyLimit)
                        : this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, visibleEnergyLimit);
                    payload.cores = room.coreSpatialIndex
                        ? this.filterNearIndexed(viewAnchor, room.coreSpatialIndex, VIEW_DISTANCE + 600, 8)
                        : this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 8);
                }
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
        if (room?.coreHeistMode) {
            this.ensureCoreHeistResources(room, zoneRadius);
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
    (0, websockets_1.SubscribeMessage)("game-stats:get"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleGameStatsGet", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("game-stats:record-pve"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleGameStatsRecordPve", null);
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
    (0, websockets_1.SubscribeMessage)("normal-pvp:session-check"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleNormalPvpSessionCheck", null);
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
    (0, websockets_1.SubscribeMessage)("zone-pvp:session-check"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpSessionCheck", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:resync"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleZonePvpResync", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("zone-pvp:leave"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
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