import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const WORLD_WIDTH = 11000;
const WORLD_HEIGHT = 11000;
const ROOM_MAX_PLAYERS = 50;
const ROOM_MIN_PLAYERS = 2;

const NORMAL_ROOM_MAX_PLAYERS = 50;
const NORMAL_ROOM_MIN_PLAYERS = 1;
const NORMAL_ROOM_ZONE_RADIUS = 100000;
const NORMAL_VISIBLE_PLAYERS_LIMIT = 50;

const BR_ONLINE_ROOM_MAX_PLAYERS = 50;
const BR_ONLINE_ROOM_MIN_PLAYERS = 2;
const BR_ONLINE_START_COUNTDOWN_MS = 5000;
const BR_ONLINE_ZONE_SHRINK_DURATION = 600000;
const BR_ONLINE_ZONE_DAMAGE = 10;
const BR_ONLINE_ZONE_DAMAGE_INTERVAL = 1000;
const BR_ONLINE_VISIBLE_PLAYERS_LIMIT = 50;

// ---------------------------------------------------------------------------
// ZONE PVP - mod nou, clona exacta a Normal PvP (normal-pvp:*) la care se
// adauga DOAR o zona verde care se strange timp de 10 minute, 10 HP/secunda
// in afara ei, si o conditie de victorie (ultimul jucator viu castiga).
// Refolosim aceeasi harta (WORLD_WIDTH/HEIGHT) si aceeasi raza de start/final
// ca BR Online (ZONE_START_RADIUS/ZONE_END_RADIUS definite mai jos), pentru
// ca zona sa acopere intreaga harta de 10000x10000 la fel ca celelalte moduri
// care au deja zona.
// ---------------------------------------------------------------------------
const ZONE_PVP_REAL_PLAYER_MAX = 2;
const ZONE_PVP_ROOM_MAX_PLAYERS = 50;
const ZONE_PVP_ROOM_MIN_PLAYERS = 2;
const ZONE_PVP_BOT_COUNT = 48;
const ZONE_PVP_START_COUNTDOWN_MS = 5000;
const ZONE_PVP_ZONE_SHRINK_DURATION = 600000;
const ZONE_PVP_ZONE_DAMAGE = 10;
const ZONE_PVP_ZONE_DAMAGE_INTERVAL = 1000;
const ZONE_PVP_VISIBLE_PLAYERS_LIMIT = 60;

// ---------------------------------------------------------------------------
// ZONE PVP BOTS - AI inspirat din BattleRoyaleMode:
// spawn random cu distanta intre participanti, farm inteligent, atac agresiv,
// evitare margine zona, cautare energy/core/orbs si strafing in lupta.
// ---------------------------------------------------------------------------
const ZONE_PVP_BOT_VIEW_RANGE = 1900;
const ZONE_PVP_BOT_ATTACK_RANGE = 900;
const ZONE_PVP_BOT_FARM_UNTIL_DRONES = 2;
const ZONE_PVP_BOT_LOW_HP = 35;
const ZONE_PVP_BOT_SAFE_DISTANCE = 620;
const ZONE_PVP_BOT_ZONE_EDGE_BUFFER = 560;
const ZONE_PVP_BOT_MIN_SPAWN_DISTANCE = 1250;
const ZONE_PVP_REAL_PLAYER_BOT_SPAWN_DISTANCE = 1450;
const ZONE_PVP_SPAWN_SAFE_ZONE_MARGIN = 1250;
const ZONE_PVP_BOT_AVOID_RADIUS = 340;
const ZONE_PVP_BOT_DECISION_INTERVAL_MIN = 120;
const ZONE_PVP_BOT_DECISION_INTERVAL_MAX = 260;

const COLLISION_GRID_CELL_SIZE = 600;

const ROOM_START_COUNTDOWN_MS = 5000;
const MAP_MIN_SIZE = Math.min(WORLD_WIDTH, WORLD_HEIGHT);
const ZONE_START_RADIUS = MAP_MIN_SIZE * 0.47;
const ZONE_END_RADIUS = MAP_MIN_SIZE * 0.07;
const ZONE_SHRINK_DURATION = 300000;
const PLAYER_SPEED = 2.15;
const PLAYER_RADIUS = 80;
const VIEW_DISTANCE = 2400;
const MAX_ORBS = 500;
const MIN_ORBS = 80;
const VISIBLE_ORB_LIMIT = 260;
const ORB_COLLECT_DISTANCE = 180;
const COLORS = ['cyan', 'green', 'orange', 'purple', 'red', 'pink'];
const START_HP = 100;
const MAX_HP = 150;
const START_ENERGY = 50;
const ENERGY_DRAIN_INTERVAL = 1000;
const ENERGY_DRAIN_AMOUNT = 1;
const ZONE_DAMAGE = 10;
const ZONE_DAMAGE_INTERVAL = 1000;
const MAX_ENERGY_CELLS = 50;
const MIN_ENERGY_CELLS = 18;
const VISIBLE_ENERGY_LIMIT = 45;
const ENERGY_CELL_COLLECT_DISTANCE = 160;
const DRONE_REQUIREMENTS = [5, 15, 25, 35];
const MAX_DRONES = 4;
const FIRE_COOLDOWN = 3000;
const PROJECTILE_SPEED = 3.55;
const PROJECTILE_MAX_DISTANCE = 4200;
const PROJECTILE_MAX_LIFETIME = 10000;
const PROJECTILE_DAMAGE = 50;
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
const BODY_COLLISION_COOLDOWN = 450;
const BODY_COLLISION_BOTH_HAVE_DRONES_DAMAGE = 10;
const BODY_COLLISION_BOTH_NO_DRONES_DAMAGE = 35;
const BODY_COLLISION_WITH_DRONES_DAMAGE = 5;
const BODY_COLLISION_WITHOUT_DRONES_DAMAGE = 45;
const BODY_COLLISION_LIGHT_PUSH = 1.4;
const BODY_COLLISION_MEDIUM_PUSH = 2.2;
const BODY_COLLISION_STRONG_PUSH = 3.0;
const BODY_COLLISION_PUSH_DECAY = 0.62;
const BODY_COLLISION_PUSH_MIN = 0.02;
const CORE_TYPES = [
    'nano',
    'rotor',
    'piercing',
    'overclock',
    'berserk',
    'shield-breaker',
    'swarm',
    'vampire',
    'emp',
];
function normalizeSkin(skin) {
    const clean = String(skin || 'cyan')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-');
    if (!clean || clean === 'basic' || clean === 'basic-drone')
        return 'cyan';
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
    @SubscribeMessage('pvp:join')
    handlePvpJoin(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
        this.removePlayer(client.id);
        const room = this.findOrCreateRoom();
        const zoneRadius = this.getSafeZoneRadius(room);
        const spawn = this.getSafeSpawn(room, zoneRadius);
        const player = {
            id: client.id,
            userId: data?.userId,
            username: String(data?.username || 'Player').slice(0, 18),
            skin: normalizeSkin(data?.skin),
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
        if (room.players.size >= ROOM_MIN_PLAYERS && room.status === 'waiting') {
            room.status = 'countdown';
            room.countdownStartedAt = Date.now();
        }
        client.emit('pvp:joined', {
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
    @SubscribeMessage('pvp:leave')
    handlePvpLeave(@ConnectedSocket() client: Socket) {
        this.removePlayer(client.id);
    }
    @SubscribeMessage('pvp:input')
    handlePvpInput(@ConnectedSocket() client: Socket, @MessageBody() input: any) {
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
    @SubscribeMessage('normal-pvp:join')
    handleNormalPvpJoin(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
        this.removePlayer(client.id);
        this.removeNormalPlayer(client.id);

        const room = this.findOrCreateNormalRoom();
        const spawn = this.getNormalSpawn(room);

        const player = {
            id: client.id,
            userId: data?.userId,
            username: String(data?.username || 'Player').slice(0, 18),
            skin: normalizeSkin(data?.skin),
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
        };

        room.players.set(client.id, player);
        this.normalSocketRoom.set(client.id, room.id);
        client.join(room.id);

        client.emit('normal-pvp:joined', {
            status: 'playing',
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

    @SubscribeMessage('normal-pvp:leave')
    handleNormalPvpLeave(@ConnectedSocket() client: Socket) {
        this.removeNormalPlayer(client.id);
    }

    @SubscribeMessage('normal-pvp:input')
    handleNormalPvpInput(@ConnectedSocket() client: Socket, @MessageBody() input: any) {
        const room = this.getNormalRoomBySocket(client.id);
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

    @SubscribeMessage('battle-royale-online:join')
    handleBattleRoyaleOnlineJoin(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
        this.removePlayer(client.id);
        this.removeNormalPlayer(client.id);
        this.removeBattleRoyaleOnlinePlayer(client.id);

        const room = this.findOrCreateBattleRoyaleOnlineRoom();
        const zoneRadius = this.getBattleRoyaleOnlineZoneRadius(room);
        const spawn = this.getSafeSpawn(room, zoneRadius);

        const player = {
            id: client.id,
            userId: data?.userId,
            username: String(data?.username || 'Player').slice(0, 18),
            skin: normalizeSkin(data?.skin),
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
        };

        room.players.set(client.id, player);
        this.battleRoyaleOnlineSocketRoom.set(client.id, room.id);
        client.join(room.id);

        if (room.players.size >= BR_ONLINE_ROOM_MIN_PLAYERS && room.status === 'waiting') {
            room.status = 'countdown';
            room.countdownStartedAt = Date.now();
        }

        client.emit('battle-royale-online:joined', {
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

    @SubscribeMessage('battle-royale-online:leave')
    handleBattleRoyaleOnlineLeave(@ConnectedSocket() client: Socket) {
        this.removeBattleRoyaleOnlinePlayer(client.id);
    }

    @SubscribeMessage('battle-royale-online:input')
    handleBattleRoyaleOnlineInput(@ConnectedSocket() client: Socket, @MessageBody() input: any) {
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

    @SubscribeMessage('zone-pvp:join')
    handleZonePvpJoin(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
        this.removePlayer(client.id);
        this.removeNormalPlayer(client.id);
        this.removeBattleRoyaleOnlinePlayer(client.id);
        this.removeZonePvpPlayer(client.id);

        const room = this.findOrCreateZonePvpRoom();
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const spawn = this.getSafeSpawn(room, zoneRadius);

        const player = {
            id: client.id,
            userId: data?.userId,
            username: String(data?.username || 'Player').slice(0, 18),
            skin: normalizeSkin(data?.skin),
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
        };

        room.players.set(client.id, player);
        this.zonePvpSocketRoom.set(client.id, room.id);
        client.join(room.id);

        if (room.players.size >= ZONE_PVP_ROOM_MIN_PLAYERS && room.status === 'waiting') {
            room.status = 'countdown';
            room.countdownStartedAt = Date.now();
            room.locked = true;
        }

        const zonePvpCountdown = room.status === 'countdown' && room.countdownStartedAt
            ? Math.max(1, Math.ceil((ZONE_PVP_START_COUNTDOWN_MS - (Date.now() - room.countdownStartedAt)) / 1000))
            : null;

        client.emit('zone-pvp:joined', {
            status: room.status,
            countdown: zonePvpCountdown,
            playerId: client.id,
            worldWidth: WORLD_WIDTH,
            worldHeight: WORLD_HEIGHT,
            safeZoneRadius: zoneRadius,
            zoneShrinkDuration: ZONE_PVP_ZONE_SHRINK_DURATION,
            matchStartedAt: room.matchStartedAt,
            playerCount: this.getZonePvpRealPlayerCount(room),
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

    @SubscribeMessage('zone-pvp:leave')
    handleZonePvpLeave(@ConnectedSocket() client: Socket) {
        this.removeZonePvpPlayer(client.id);
    }

    @SubscribeMessage('zone-pvp:input')
    handleZonePvpInput(@ConnectedSocket() client: Socket, @MessageBody() input: any) {
        const room = this.getZonePvpRoomBySocket(client.id);
        const player = room?.players.get(client.id);
        if (!room || room.status !== 'playing' || !player || !player.alive) return;

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

    startLoop() {
        if (this.loop)
            return;
        this.loop = setInterval(() => {
            const now = Date.now();
            const deltaFrames = Math.min(2, Math.max(0.35, (now - this.lastLoopAt) / (1000 / 60)));
            this.lastLoopAt = now;

            for (const room of this.rooms.values()) {
                this.updateRoomStatus(room, now);
                if (room.status === 'playing') {
                    const zoneRadius = this.getSafeZoneRadius(room);
                    this.updatePlayers(room, now, zoneRadius, deltaFrames);
                    this.applyZoneDamage(room, now, zoneRadius);
                    this.handleBodyCollisions(room, now, zoneRadius);
                    this.collectOrbs(room, zoneRadius);
                    this.collectEnergy(room, zoneRadius);
                    this.collectCores(room, zoneRadius);
                    this.updateProjectiles(room, deltaFrames);
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
                this.updateProjectiles(room, deltaFrames);
                this.maintainWorldItems(room, zoneRadius, now);

                const broadcastInterval = room.players.size > 40 ? 33 : 25;

                if (!room.lastBroadcastAt || now - room.lastBroadcastAt >= broadcastInterval) {
                    room.lastBroadcastAt = now;
                    this.broadcastNormalRoomState(room, now);
                }

                this.cleanupNormalRoom(room, now);
            }

            for (const room of this.battleRoyaleOnlineRooms.values()) {
                this.updateBattleRoyaleOnlineRoomStatus(room, now);

                if (room.status === 'playing') {
                    const zoneRadius = this.getBattleRoyaleOnlineZoneRadius(room);
                    this.updatePlayers(room, now, zoneRadius, deltaFrames);
                    this.applyBattleRoyaleOnlineZoneDamage(room, now, zoneRadius);
                    this.handleBodyCollisions(room, now, zoneRadius);
                    this.collectOrbs(room, zoneRadius);
                    this.collectEnergy(room, zoneRadius);
                    this.collectCores(room, zoneRadius);
                    this.updateProjectiles(room, deltaFrames);
                    this.maintainWorldItems(room, zoneRadius, now);
                    this.updateBattleRoyaleOnlineWinCondition(room, now);
                }

                const broadcastInterval = room.players.size > 30 ? 33 : 25;

                if (!room.lastBroadcastAt || now - room.lastBroadcastAt >= broadcastInterval) {
                    room.lastBroadcastAt = now;
                    this.broadcastBattleRoyaleOnlineRoomState(room, now);
                }

                this.cleanupBattleRoyaleOnlineRoom(room, now);
            }

            for (const room of this.zonePvpRooms.values()) {
                this.updateZonePvpRoomStatus(room, now);

                if (room.status === 'playing') {
                    const zoneRadius = this.getZonePvpZoneRadius(room);
                    this.updateZonePvpBots(room, now, zoneRadius);
                    this.updatePlayers(room, now, zoneRadius, deltaFrames);
                    this.applyZonePvpZoneDamage(room, now, zoneRadius);
                    this.handleBodyCollisions(room, now, zoneRadius);
                    this.collectOrbs(room, zoneRadius);
                    this.collectEnergy(room, zoneRadius);
                    this.collectCores(room, zoneRadius);
                    this.updateProjectiles(room, deltaFrames);
                    this.maintainWorldItems(room, zoneRadius, now);
                    this.updateZonePvpWinCondition(room, now);
                }

                const broadcastInterval = room.players.size > 30 ? 33 : 25;

                if (!room.lastBroadcastAt || now - room.lastBroadcastAt >= broadcastInterval) {
                    room.lastBroadcastAt = now;
                    this.broadcastZonePvpRoomState(room, now);
                }

                this.cleanupZonePvpRoom(room, now);
            }
        }, 1000 / 60);
    }
    updateRoomStatus(room, now) {
        if (room.status === 'countdown' && room.countdownStartedAt) {
            if (room.players.size < ROOM_MIN_PLAYERS) {
                room.status = 'waiting';
                room.countdownStartedAt = null;
                return;
            }
            if (now - room.countdownStartedAt >= ROOM_START_COUNTDOWN_MS) {
                room.status = 'playing';
                room.countdownStartedAt = null;
                room.matchStartedAt = now;
                room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + 5000;
            }
        }
    }

    updateBattleRoyaleOnlineRoomStatus(room, now) {
        if (room.status === 'countdown' && room.countdownStartedAt) {
            if (room.players.size < BR_ONLINE_ROOM_MIN_PLAYERS) {
                room.status = 'waiting';
                room.countdownStartedAt = null;
                return;
            }
            if (now - room.countdownStartedAt >= BR_ONLINE_START_COUNTDOWN_MS) {
                room.status = 'playing';
                room.countdownStartedAt = null;
                room.matchStartedAt = now;
                room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + 5000;
            }
        }
    }
    updateZonePvpRoomStatus(room, now) {
        if (room.status !== 'countdown') return;

        if (this.getZonePvpRealPlayerCount(room) < ZONE_PVP_ROOM_MIN_PLAYERS) {
            room.status = 'waiting';
            room.locked = false;
            room.countdownStartedAt = null;
            return;
        }

        if (now - room.countdownStartedAt >= ZONE_PVP_START_COUNTDOWN_MS) {
            room.status = 'playing';
            room.locked = true;
            room.countdownStartedAt = null;
            room.matchStartedAt = now;
            room.matchHadMultiplePlayers = true;
            this.ensureZonePvpBots(room, now);
            room.lastCoreWaveAt = now - CORE_RESPAWN_DELAY + CORE_WARNING_DELAY;
        }
    }

    updatePlayers(room, now, zoneRadius, deltaFrames = 1) {
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            let dx = 0;
            let dy = 0;
            const input = player.input || {};
            if (input.w)
                dy -= 1;
            if (input.s)
                dy += 1;
            if (input.a)
                dx -= 1;
            if (input.d)
                dx += 1;
            const isMovingInput = dx !== 0 || dy !== 0;
            if (isMovingInput && now - player.lastEnergyDrainAt >= ENERGY_DRAIN_INTERVAL) {
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
            if (player.input.shield &&
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
            const speed = PLAYER_SPEED;
            const rawX = player.x + (dx / length) * speed * deltaFrames;
            const rawY = player.y + (dy / length) * speed * deltaFrames;
            const safe = this.keepInsideSafeZone(rawX, rawY, zoneRadius, PLAYER_RADIUS + 18, Boolean(room.zonePvpMode));
            player.x = this.clamp(safe.x, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
            player.y = this.clamp(safe.y, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
            this.applyKnockbackStep(player, zoneRadius, room);
            if (dx || dy) {
                player.moveX = dx / length;
                player.moveY = dy / length;
                player.moveAngle = Math.atan2(dy, dx);
                player.isMoving = true;
            }
            else {
                player.moveX = 0;
                player.moveY = 0;
                player.isMoving = false;
            }
            if (input.attacking) {
                this.tryFireProjectile(room, player, now);
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
    applyKillReward(killer) {
        killer.kills = (killer.kills || 0) + 1;
        killer.killStreak = (killer.killStreak || 0) + 1;
        killer.drones = Math.min(MAX_DRONES, (killer.drones || 0) + 1);
        killer.progress = 0;
        killer.nextDroneAt = this.getNextDroneAt(killer.drones || 0);

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
        const safe = this.keepInsideSafeZone(player.x + kx, player.y + ky, zoneRadius, PLAYER_RADIUS + 18, Boolean(room?.zonePvpMode));
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
                this.resolvePlayerPairCollision(alive[i], alive[j], room, now, zoneRadius);
            }
        }
    }

    resolvePlayerPairCollision(a, b, room, now, zoneRadius) {
        const key = this.getCollisionKey(a.id, b.id);
        const lastAt = room.collisionCooldowns.get(key) || 0;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > BODY_COLLISION_DISTANCE)
            return;
        const dirX = dx / dist;
        const dirY = dy / dist;
        const overlap = BODY_COLLISION_DISTANCE - dist;
        const separation = Math.min(7, Math.max(BODY_COLLISION_LIGHT_PUSH, overlap * 0.08));
        this.addSmoothKnockback(a, -dirX, -dirY, separation);
        this.addSmoothKnockback(b, dirX, dirY, separation);
        this.applyKnockbackStep(a, zoneRadius, room);
        this.applyKnockbackStep(b, zoneRadius, room);
        if (now - lastAt < BODY_COLLISION_COOLDOWN)
            return;
        room.collisionCooldowns.set(key, now);
        const outcome = this.getBodyCollisionOutcome(a, b);
        const aWasAlive = a.alive;
        const bWasAlive = b.alive;
        this.applyBodyCollisionDamage(a, outcome.aHpDamage, outcome.aDroneLoss);
        this.applyBodyCollisionDamage(b, outcome.bHpDamage, outcome.bDroneLoss);
        this.addSmoothKnockback(a, -dirX, -dirY, outcome.push);
        this.addSmoothKnockback(b, dirX, dirY, outcome.push);
        if (aWasAlive && !a.alive && b.alive)
            this.applyKillReward(b);
        if (bWasAlive && !b.alive && a.alive)
            this.applyKillReward(a);
    }

    tryFireProjectile(room, player, now) {
        if ((player.drones || 0) <= 0)
            return;
        const cooldown = this.getFireCooldown(player, now);
        if (now - player.lastFireAt < cooldown)
            return;
        const targetX = player.input.mouseX || player.x + 1;
        const targetY = player.input.mouseY || player.y;
        const angle = Math.atan2(targetY - player.y, targetX - player.x);
        const rapidBonus = player.rapidFireUntil && player.rapidFireUntil > now ? 0.75 : 0;
        const overclockBonus = player.overclockUntil && player.overclockUntil > now ? 1.25 : 0;
        const speed = PROJECTILE_SPEED +
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
        return Math.max(420, Math.floor(cooldown));
    }
    updateProjectiles(room, deltaFrames = 1) {
        const nextProjectiles = [];
        for (const projectile of room.projectiles) {
            projectile.x += projectile.vx * deltaFrames;
            projectile.y += projectile.vy * deltaFrames;
            const traveled = Math.hypot(projectile.x - projectile.startX, projectile.y - projectile.startY);
            const age = Date.now() - (projectile.createdAt || Date.now());
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
                const damageBlocked = target.shieldActive && !projectile.shieldBreaker;
                if (!damageBlocked) {
                    target.hp = Math.max(0, target.hp - projectile.damage);
                    if (owner && owner.vampireUntil && owner.vampireUntil > Date.now()) {
                        owner.hp = Math.min(owner.maxHp, owner.hp + Math.floor(projectile.damage * VAMPIRE_HEAL_RATIO));
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
                        target.spectatorTargetId = owner?.alive !== false ? owner?.id || null : null;
                        if (owner) {
                            this.applyKillReward(owner);
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

    collectOrbs(room, zoneRadius) {
        const collectedIndexes = new Set();
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            let collected = 0;
            for (let i = 0; i < room.orbs.length; i += 1) {
                if (collectedIndexes.has(i))
                    continue;
                const orb = room.orbs[i];
                const endDx = orb.x - player.x;
                const endDy = orb.y - player.y;
                const pathDistance = this.distancePointToSegment(
                    orb.x,
                    orb.y,
                    player.prevX ?? player.x,
                    player.prevY ?? player.y,
                    player.x,
                    player.y
                );
                if (endDx * endDx + endDy * endDy > ORB_COLLECT_DISTANCE * ORB_COLLECT_DISTANCE &&
                    pathDistance > ORB_COLLECT_DISTANCE) {
                    continue;
                }
                collectedIndexes.add(i);
                collected += 1;
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
            }
        }
        if (collectedIndexes.size > 0) {
            room.orbs = room.orbs.filter((_, index) => !collectedIndexes.has(index));
        }
    }
    collectEnergy(room, zoneRadius) {
        const collectedIndexes = new Set();
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            for (let i = 0; i < room.energyCells.length; i += 1) {
                if (collectedIndexes.has(i))
                    continue;
                const cell = room.energyCells[i];
                const endDx = cell.x - player.x;
                const endDy = cell.y - player.y;
                const pathDistance = this.distancePointToSegment(
                    cell.x,
                    cell.y,
                    player.prevX ?? player.x,
                    player.prevY ?? player.y,
                    player.x,
                    player.y
                );
                if (endDx * endDx + endDy * endDy >
                    ENERGY_CELL_COLLECT_DISTANCE * ENERGY_CELL_COLLECT_DISTANCE &&
                    pathDistance > ENERGY_CELL_COLLECT_DISTANCE) {
                    continue;
                }
                collectedIndexes.add(i);
                player.energy = Math.min(100, player.energy + 25);
            }
        }
        if (collectedIndexes.size > 0) {
            room.energyCells = room.energyCells.filter((_, index) => !collectedIndexes.has(index));
        }
    }
    collectCores(room, zoneRadius) {
        const collectedIndexes = new Set();
        for (const player of room.players.values()) {
            if (!player.alive)
                continue;
            for (let i = 0; i < room.cores.length; i += 1) {
                if (collectedIndexes.has(i))
                    continue;
                const core = room.cores[i];
                const endDx = core.x - player.x;
                const endDy = core.y - player.y;
                const pathDistance = this.distancePointToSegment(
                    core.x,
                    core.y,
                    player.prevX ?? player.x,
                    player.prevY ?? player.y,
                    player.x,
                    player.y
                );
                if (endDx * endDx + endDy * endDy > CORE_COLLECT_DISTANCE * CORE_COLLECT_DISTANCE &&
                    pathDistance > CORE_COLLECT_DISTANCE) {
                    continue;
                }
                if (!this.canUseCore(player, core))
                    continue;
                this.applyCore(player, core);
                collectedIndexes.add(i);
            }
        }
        if (collectedIndexes.size > 0) {
            room.cores = room.cores.filter((_, index) => !collectedIndexes.has(index));
        }
    }
    canUseCore(player, core) {
        if (this.getActiveCoreCount(player) >= MAX_ACTIVE_CORES &&
            !this.hasCoreAlready(player, core.type)) {
            return false;
        }
        if (core.type === 'nano') {
            return (!player.nanoCoreActive &&
                (player.maxHp < MAX_HP || player.hp < player.maxHp));
        }
        if (core.type === 'rotor') {
            return (!player.rotorCoreActive &&
                (player.attackSpeedLevel || 1) < ROTOR_MAX_LEVEL);
        }
        if (core.type === 'piercing')
            return (player.piercingShots || 0) <= 0;
        if (core.type === 'shield-breaker') {
            return (player.shieldBreakerShots || 0) <= 0;
        }
        if (core.type === 'swarm') {
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
        if (type === 'nano')
            return Boolean(player.nanoCoreActive);
        if (type === 'rotor')
            return Boolean(player.rotorCoreActive);
        if (type === 'swarm')
            return Boolean(player.swarmCoreActive);
        if (type === 'piercing')
            return (player.piercingShots || 0) > 0;
        if (type === 'shield-breaker')
            return (player.shieldBreakerShots || 0) > 0;
        if (type === 'overclock')
            return (player.overclockUntil || 0) > now;
        if (type === 'berserk')
            return (player.berserkUntil || 0) > now;
        if (type === 'vampire')
            return (player.vampireUntil || 0) > now;
        if (type === 'emp')
            return (player.empPulseUntil || 0) > now;
        return false;
    }
    applyCore(player, core) {
        const now = Date.now();
        if (core.type === 'nano') {
            player.maxHp = Math.min(MAX_HP, player.maxHp + 10);
            player.hp = Math.min(player.maxHp, player.hp + 10);
            player.nanoCoreActive = true;
        }
        if (core.type === 'rotor') {
            player.attackSpeedLevel = ROTOR_MAX_LEVEL;
            player.projectileSpeedBonus = Math.max(player.projectileSpeedBonus || 0, 0.9);
            player.rotorCoreActive = true;
        }
        if (core.type === 'piercing')
            player.piercingShots = 3;
        if (core.type === 'overclock') {
            player.overclockUntil = now + OVERCLOCK_DURATION;
        }
        if (core.type === 'berserk') {
            player.berserkUntil = now + BERSERK_DURATION;
        }
        if (core.type === 'shield-breaker') {
            player.shieldBreakerShots = SHIELD_BREAKER_SHOTS;
        }
        if (core.type === 'swarm') {
            player.drones = Math.min(MAX_DRONES, player.drones + SWARM_CORE_DRONES);
            player.progress = 0;
            player.nextDroneAt = this.getNextDroneAt(player.drones);
            player.swarmCoreActive = true;
        }
        if (core.type === 'vampire') {
            player.vampireUntil = now + VAMPIRE_DURATION;
        }
        if (core.type === 'emp') {
            player.empPulseUntil = now + 900;
            const playerRoom =
                this.getRoomBySocket(player.id) ||
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
        room.orbs = room.orbs.filter((orb) => this.isInsideSafeZone(orb.x, orb.y, zoneRadius, 120));
        room.energyCells = room.energyCells.filter((cell) => this.isInsideSafeZone(cell.x, cell.y, zoneRadius, 120));
        room.cores = room.cores.filter((core) => this.isInsideSafeZone(core.x, core.y, zoneRadius, 420));

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
                    room.cores = Array.from({ length: CORE_WAVE_SIZE }, () => this.createCore(zoneRadius));
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
    }
    updateWinCondition(room, now) {
        if (room.status !== 'playing')
            return;
        const alive = this.getAlivePlayers(room);
        if (room.players.size >= ROOM_MIN_PLAYERS && alive.length <= 1) {
            const winner = alive[0] || null;
            room.status = 'finished';
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
        if (room.status !== 'playing')
            return;
        const alive = this.getAlivePlayers(room);
        if (room.players.size >= BR_ONLINE_ROOM_MIN_PLAYERS && alive.length <= 1) {
            const winner = alive[0] || null;
            room.status = 'finished';
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
        if (room.status !== 'playing') return;

        const alive = this.getAlivePlayers(room);

        // Camera declara castigator doar dupa ce meciul a pornit valid cu minim 2 jucatori.
        // Daca unul moare, devine spectator sau se deconecteaza, ultimul ramas viu castiga.
        if (room.matchHadMultiplePlayers && alive.length <= 1) {
            const winner = alive[0] || null;
            room.status = 'finished';
            room.locked = true;
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
    broadcastRoomState(room, now) {
        const players = [...room.players.values()];
        const alivePlayers = players.filter((p) => p.alive);
        const zoneRadius = this.getSafeZoneRadius(room);
        const leaderboard = [...players]
            .sort((a, b) => b.kills - a.kills || b.totalCollected - a.totalCollected)
            .slice(0, 10)
            .map((player) => ({
            id: player.id,
            username: player.username,
            totalCollected: player.totalCollected,
            kills: player.kills,
            drones: player.drones,
            skin: player.skin,
        }));
        const countdown = room.status === 'countdown' && room.countdownStartedAt
            ? Math.max(1, Math.ceil((ROOM_START_COUNTDOWN_MS -
                (now - room.countdownStartedAt)) /
                1000))
            : null;
        const secondsUntilCoreDrop = Math.ceil(Math.max(0, CORE_RESPAWN_DELAY - (now - room.lastCoreWaveAt)) / 1000);
        const coreDropCountdown = room.status === 'playing' && secondsUntilCoreDrop > 0 && secondsUntilCoreDrop <= 5
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
            const visibleOrbs = this.filterNear(player, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT);
            const visibleEnergyCells = this.filterNear(player, room.energyCells, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT);
            const visibleCores = this.filterNear(player, room.cores, VIEW_DISTANCE + 600, 18);
            const visibleProjectiles = this.filterNear(player, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT);
            socket.volatile.emit('pvp:state', {
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
            isBot: Boolean(player.isBot),
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
        };
    }
    findOrCreateNormalRoom() {
        for (const room of this.normalRooms.values()) {
            if (room.status !== 'playing') {
                continue;
            }

            if (room.players.size < NORMAL_ROOM_MAX_PLAYERS) {
                return room;
            }
        }

        const room = {
            id: `normal-${crypto.randomUUID()}`,
            status: 'playing',
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(NORMAL_ROOM_ZONE_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(NORMAL_ROOM_ZONE_RADIUS)),
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

        if (this.getZonePvpRealPlayerCount(room) === 0 && now - room.createdAt > 15000) {
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
                WORLD_WIDTH - PLAYER_RADIUS
            ),
            y: this.clamp(
                WORLD_HEIGHT / 2 + (Math.random() - 0.5) * spawnAreaRadius,
                PLAYER_RADIUS,
                WORLD_HEIGHT - PLAYER_RADIUS
            ),
        };
    }

    broadcastNormalRoomState(room, now) {
        const players = [...room.players.values()];
        const alivePlayers = players.filter((player) => player.alive);

        const leaderboard = players
            .slice()
            .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.totalCollected || 0) - (a.totalCollected || 0))
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
                isBot: Boolean(player.isBot),
            }));

        const secondsUntilCoreDrop = room.cores.length === 0 && room.nextCoreWaveAt
            ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
            : null;

        const coreDropCountdown =
            secondsUntilCoreDrop && secondsUntilCoreDrop > 0 && secondsUntilCoreDrop <= Math.ceil(CORE_WARNING_DELAY / 1000)
                ? secondsUntilCoreDrop
                : null;

        const minimapOrbs = [...room.orbs]
            .sort((a, b) => a.id.localeCompare(b.id))
            .filter((_, index) => index % 3 === 0)
            .slice(0, 120);

        const minimapEnergyCells = [];

        const minimapCores = [...room.cores]
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, 12);

        for (const player of players) {
            const socket = this.server.sockets.sockets.get(player.id);
            if (!socket) continue;

            const aliveOthers = players.filter((other) => other.id !== player.id && other.alive !== false);

            let spectatorTarget = null;
            if (player.alive === false) {
                spectatorTarget = player.killedById
                    ? aliveOthers.find((other) => other.id === player.killedById) || null
                    : null;

                if (!spectatorTarget && player.spectatorTargetId) {
                    spectatorTarget = aliveOthers.find((other) => other.id === player.spectatorTargetId) || null;
                }

                if (!spectatorTarget && aliveOthers.length > 0) {
                    spectatorTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                }

                player.spectatorTargetId = spectatorTarget?.id || null;
            } else {
                player.spectatorTargetId = null;
                player.killedById = null;
            }

            const viewAnchor = spectatorTarget || player;

            const visiblePlayers = player.alive === false
                ? this.filterNear(viewAnchor, aliveOthers, VIEW_DISTANCE + 1200, NORMAL_VISIBLE_PLAYERS_LIMIT)
                    .map((other) => this.serializePlayer(other))
                : this.filterNear(
                    player,
                    players.filter((other) => other.id !== player.id),
                    VIEW_DISTANCE,
                    NORMAL_VISIBLE_PLAYERS_LIMIT
                ).map((other) => this.serializePlayer(other));

            socket.volatile.emit('normal-pvp:state', {
                status: 'playing',
                countdown: null,
                coreDropCountdown,
                winnerId: null,
                winnerName: null,
                playerCount: alivePlayers.length,
                minPlayers: NORMAL_ROOM_MIN_PLAYERS,
                maxPlayers: NORMAL_ROOM_MAX_PLAYERS,
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
                safeZoneRadius: NORMAL_ROOM_ZONE_RADIUS,
                you: this.serializePlayer(player),
                players: visiblePlayers,
                spectatorTargetId: spectatorTarget?.id || null,
                spectatingPlayer: spectatorTarget ? this.serializePlayer(spectatorTarget) : null,

                orbs: this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT),
                energyCells: this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT),
                cores: this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 18),
                projectiles: this.filterNear(viewAnchor, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT),

                minimapOrbs,
                minimapEnergyCells,
                minimapCores,

                leaderboard,
            });
        }
    }

    findOrCreateBattleRoyaleOnlineRoom() {
        for (const room of this.battleRoyaleOnlineRooms.values()) {
            if (room.status === 'waiting' && room.players.size < BR_ONLINE_ROOM_MAX_PLAYERS) {
                return room;
            }
        }

        const room = {
            id: `br-online-${crypto.randomUUID()}`,
            status: 'waiting',
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(ZONE_START_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(ZONE_START_RADIUS)),
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

            if (room.players.size < BR_ONLINE_ROOM_MIN_PLAYERS && room.status === 'countdown') {
                room.status = 'waiting';
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

        if (this.getZonePvpRealPlayerCount(room) === 0 && now - room.createdAt > 15000) {
            this.battleRoyaleOnlineRooms.delete(room.id);
            return;
        }

        if (room.status === 'finished' && room.finishedAt && now - room.finishedAt > 90000) {
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
            .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.totalCollected || 0) - (a.totalCollected || 0))
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
            room.status === 'countdown' && room.countdownStartedAt
                ? Math.max(1, Math.ceil((BR_ONLINE_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) / 1000))
                : null;

        const secondsUntilCoreDrop = room.cores.length === 0 && room.nextCoreWaveAt
            ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
            : null;

        const coreDropCountdown =
            secondsUntilCoreDrop && secondsUntilCoreDrop > 0 && secondsUntilCoreDrop <= Math.ceil(CORE_WARNING_DELAY / 1000)
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

            const aliveOthers = players.filter((other) => other.id !== player.id && other.alive !== false);

            let spectatorTarget = null;
            if (player.alive === false) {
                spectatorTarget = player.killedById
                    ? aliveOthers.find((other) => other.id === player.killedById) || null
                    : null;

                if (!spectatorTarget && player.spectatorTargetId) {
                    spectatorTarget = aliveOthers.find((other) => other.id === player.spectatorTargetId) || null;
                }

                if (!spectatorTarget && aliveOthers.length > 0) {
                    spectatorTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                }

                player.spectatorTargetId = spectatorTarget?.id || null;
            } else {
                player.spectatorTargetId = null;
                player.killedById = null;
            }

            const viewAnchor = spectatorTarget || player;

            const visiblePlayers = player.alive === false
                ? this.filterNear(viewAnchor, aliveOthers, VIEW_DISTANCE + 1200, BR_ONLINE_VISIBLE_PLAYERS_LIMIT)
                    .map((other) => this.serializePlayer(other))
                : this.filterNear(
                    player,
                    players.filter((other) => other.id !== player.id),
                    VIEW_DISTANCE,
                    BR_ONLINE_VISIBLE_PLAYERS_LIMIT
                ).map((other) => this.serializePlayer(other));

            socket.volatile.emit('battle-royale-online:state', {
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
                you: this.serializePlayer(player),
                players: visiblePlayers,
                spectatorTargetId: spectatorTarget?.id || null,
                spectatingPlayer: spectatorTarget ? this.serializePlayer(spectatorTarget) : null,

                orbs: this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT),
                energyCells: this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT),
                cores: this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 18),
                projectiles: this.filterNear(viewAnchor, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT),

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
                room.status === 'waiting' &&
                !room.locked &&
                this.getZonePvpRealPlayerCount(room) < ZONE_PVP_REAL_PLAYER_MAX
            ) {
                return room;
            }
        }

        const room = {
            id: `zone-pvp-${crypto.randomUUID()}`,
            status: 'waiting',
            locked: false,
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(ZONE_START_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(ZONE_START_RADIUS)),
            cores: [],
            pendingCores: [],
            projectiles: [],
            countdownStartedAt: null,
            createdAt: Date.now(),
            matchStartedAt: null,
            matchHadMultiplePlayers: false,
            lastCoreWaveAt: 0,
            nextCoreWaveAt: null,
            lastLocalItemAt: 0,
            lastBroadcastAt: 0,
            winnerId: null,
            winnerName: null,
            finishedAt: null,
            collisionCooldowns: new Map(),
            botsInjected: false,
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
            if (player.isBot) continue;
            if (!socketOnline || now - player.lastSeenAt > 30000) {
                this.removeZonePvpPlayer(player.id);
            }
        }

        if (this.getZonePvpRealPlayerCount(room) === 0 && now - room.createdAt > 15000) {
            this.zonePvpRooms.delete(room.id);
            return;
        }

        if (room.status === 'finished' && room.finishedAt && now - room.finishedAt > 90000) {
            this.zonePvpRooms.delete(room.id);
        }
    }

    getZonePvpZoneRadius(room) {
        if (!room.matchStartedAt) return ZONE_START_RADIUS;
        const elapsed = Math.max(0, Date.now() - room.matchStartedAt);
        const progress = Math.min(1, elapsed / ZONE_PVP_ZONE_SHRINK_DURATION);
        return ZONE_START_RADIUS + (ZONE_END_RADIUS - ZONE_START_RADIUS) * progress;
    }

    getZonePvpRealPlayerCount(room) {
        return [...room.players.values()].filter((player) => !player.isBot).length;
    }

    getZonePvpRandomSpawnPoint(room, usedSpawns = [], minDistance = ZONE_PVP_BOT_MIN_SPAWN_DISTANCE) {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;
        const safeSpawnRadius = Math.max(800, ZONE_START_RADIUS - ZONE_PVP_SPAWN_SAFE_ZONE_MARGIN);
        const existingPoints = [
            ...[...room.players.values()].map((player) => ({ x: player.x, y: player.y })),
            ...usedSpawns,
        ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

        for (let attempt = 0; attempt < 2500; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * safeSpawnRadius;
            const x = this.clamp(centerX + Math.cos(angle) * distance, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
            const y = this.clamp(centerY + Math.sin(angle) * distance, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);

            const isFarEnough = existingPoints.every((other) => {
                return Math.hypot(x - other.x, y - other.y) >= minDistance;
            });

            if (isFarEnough && this.isInsideSafeZone(x, y, ZONE_START_RADIUS, 700)) {
                return { x, y };
            }
        }

        // Relaxare controlata pentru cazul in care 50 de unitati nu incap la distanta mare.
        for (let attempt = 0; attempt < 1400; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.sqrt(Math.random()) * safeSpawnRadius;
            const x = this.clamp(centerX + Math.cos(angle) * distance, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
            const y = this.clamp(centerY + Math.sin(angle) * distance, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);

            const isFarEnough = existingPoints.every((other) => {
                return Math.hypot(x - other.x, y - other.y) >= minDistance * 0.62;
            });

            if (isFarEnough && this.isInsideSafeZone(x, y, ZONE_START_RADIUS, 500)) {
                return { x, y };
            }
        }

        return {
            x: centerX + (Math.random() - 0.5) * safeSpawnRadius * 0.55,
            y: centerY + (Math.random() - 0.5) * safeSpawnRadius * 0.55,
        };
    }

    createZonePvpBot(index, room, now, spawnPoint = null) {
        const spawn = spawnPoint || this.getZonePvpRandomSpawnPoint(room, [], ZONE_PVP_BOT_MIN_SPAWN_DISTANCE);
        const skins = [
            'cyan', 'red', 'purple', 'orange', 'green', 'pink',
            'ice-blue', 'solar-gold', 'shadow-black', 'toxic-lime',
            'royal-violet', 'crimson-white', 'neon-teal', 'ember-red',
            'arctic-silver', 'void-purple', 'plasma-pink', 'jade-black',
            'azure-white', 'inferno-orange', 'midnight-blue', 'acid-green',
            'ruby-black', 'ghost-white', 'cyber-yellow', 'deep-ocean',
            'magenta-cyan', 'bronze-steel', 'electric-indigo', 'dark-emerald'
        ];
        const names = ['DarkNova', 'SkyHunter', 'CyberCore', 'NanoByte', 'RedPulse', 'VoidRaptor', 'OrbHunter', 'ZoneGhost'];

        return {
            id: `zone-bot-${crypto.randomUUID()}`,
            isBot: true,
            userId: null,
            username: `${names[index % names.length]}-${index + 1}`,
            skin: skins[index % skins.length],
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
            lastSeenAt: now,
            lastEnergyDrainAt: now,
            lastZoneDamageAt: now,
            lastFireAt: 0,
            lastShieldAt: 0,
            shieldActive: false,
            shieldUntil: 0,
            knockbackX: 0,
            knockbackY: 0,
            gridKey: null,
            prevX: spawn.x,
            prevY: spawn.y,

            // AI BattleRoyale-like.
            aiPlanUntil: 0,
            aiTargetId: null,
            aiState: 'farm',
            aiStrafeDir: Math.random() < 0.5 ? -1 : 1,
            aiAggression: 0.92 + Math.random() * 0.5,
            aiCourage: 1.05 + Math.random() * 0.45,
            aiSkill: 0.92 + Math.random() * 0.35,
            preferredRange: 520 + Math.random() * 170,
            desiredDroneStock: 3 + Math.floor(Math.random() * 2),
            wanderAngle: Math.random() * Math.PI * 2,
            vx: 0,
            vy: 0,
            dangerMemory: [],
        };
    }

    ensureZonePvpBots(room, now) {
        if (room.botsInjected) return;

        const existingBots = [...room.players.values()].filter((player) => player.isBot).length;
        const botsToAdd = Math.max(0, ZONE_PVP_BOT_COUNT - existingBots);
        const usedSpawns = [];

        for (let i = 0; i < botsToAdd; i += 1) {
            const spawnPoint = this.getZonePvpRandomSpawnPoint(room, usedSpawns, ZONE_PVP_BOT_MIN_SPAWN_DISTANCE);
            usedSpawns.push(spawnPoint);
            const bot = this.createZonePvpBot(i, room, now, spawnPoint);
            room.players.set(bot.id, bot);
        }

        room.botsInjected = true;
    }

    getZonePvpBotPower(unit) {
        return (
            (unit.hp || 0) +
            (unit.drones || 0) * 38 +
            (unit.totalCollected || 0) * 2 +
            (unit.kills || 0) * 22
        );
    }

    getZonePvpZoneInfo(x, y, radius) {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;
        const dx = centerX - x;
        const dy = centerY - y;
        const distanceFromCenter = Math.hypot(dx, dy) || 1;

        return {
            distanceFromCenter,
            dangerDistance: radius - distanceFromCenter,
            isInDanger: distanceFromCenter > radius - ZONE_PVP_BOT_ZONE_EDGE_BUFFER,
            moveToCenterX: dx / distanceFromCenter,
            moveToCenterY: dy / distanceFromCenter,
        };
    }

    getZonePvpBotAvoidance(bot, room, avoidRadius = ZONE_PVP_BOT_AVOID_RADIUS) {
        let avoidX = 0;
        let avoidY = 0;

        for (const other of room.players.values()) {
            if (!other.alive || other.id === bot.id) continue;
            const dx = bot.x - other.x;
            const dy = bot.y - other.y;
            const distance = Math.hypot(dx, dy) || 1;

            if (distance < avoidRadius) {
                const force = (avoidRadius - distance) / avoidRadius;
                avoidX += (dx / distance) * force;
                avoidY += (dy / distance) * force;
            }
        }

        return { avoidX, avoidY };
    }

    isZonePvpPointSafeForBot(x, y, zoneRadius, margin = ZONE_PVP_BOT_ZONE_EDGE_BUFFER) {
        return this.isInsideSafeZone(x, y, zoneRadius, margin);
    }

    findClosestZonePvpItem(bot, items, zoneRadius, maxDistance, validator = null) {
        let best = null;
        let bestScore = Infinity;

        for (const item of items || []) {
            if (!item) continue;
            if (validator && !validator(item)) continue;
            if (!this.isZonePvpPointSafeForBot(item.x, item.y, zoneRadius, 120)) continue;

            const dx = (item.x || 0) - bot.x;
            const dy = (item.y || 0) - bot.y;
            if (Math.abs(dx) > maxDistance || Math.abs(dy) > maxDistance) continue;

            const distance = Math.hypot(dx, dy);
            let score = distance;

            if ((bot.hp || 0) <= ZONE_PVP_BOT_LOW_HP && item.type === 'nano') score -= 520;
            if ((bot.drones || 0) < 2 && item.type === 'swarm') score -= 420;
            if ((bot.drones || 0) >= 1 && (item.type === 'overclock' || item.type === 'berserk')) score -= 320;
            if ((bot.energy || 0) < 40 && !item.type) score -= 260;

            if (score < bestScore) {
                bestScore = score;
                best = item;
            }
        }

        return best;
    }

    findBestZonePvpCoreForBot(bot, room, zoneRadius) {
        return this.findClosestZonePvpItem(
            bot,
            room.cores,
            zoneRadius,
            ZONE_PVP_BOT_VIEW_RANGE,
            (core) => this.canUseCore(bot, core)
        );
    }

    shouldZonePvpBotFarm(bot) {
        return (bot.drones || 0) < ZONE_PVP_BOT_FARM_UNTIL_DRONES && (bot.hp || 0) > ZONE_PVP_BOT_LOW_HP;
    }

    findZonePvpBotEnemy(bot, room) {
        let bestEnemy = null;
        let bestScore = Infinity;
        const botPower = this.getZonePvpBotPower(bot) * (bot.aiCourage || 1);

        for (const enemy of room.players.values()) {
            if (!enemy || !enemy.alive || enemy.id === bot.id) continue;

            const dx = enemy.x - bot.x;
            const dy = enemy.y - bot.y;
            if (Math.abs(dx) > ZONE_PVP_BOT_VIEW_RANGE || Math.abs(dy) > ZONE_PVP_BOT_VIEW_RANGE) continue;

            const distance = Math.hypot(dx, dy);
            if (distance > ZONE_PVP_BOT_VIEW_RANGE) continue;

            const enemyPower = this.getZonePvpBotPower(enemy);
            const enemyWeak = enemy.hp <= 55 || (enemy.drones || 0) <= 1;
            const hasDroneAdvantage = (bot.drones || 0) >= (enemy.drones || 0) + 1;
            const hasEnoughAmmo = (bot.drones || 0) >= 1;
            const canWin = hasEnoughAmmo && (hasDroneAdvantage || enemyWeak || botPower >= enemyPower * 0.95);

            if (!hasEnoughAmmo) continue;
            if ((bot.drones || 0) < ZONE_PVP_BOT_FARM_UNTIL_DRONES && !enemyWeak && !hasDroneAdvantage && distance > 420) {
                continue;
            }

            let score = distance;
            if (!enemy.isBot) score -= 130;
            if (enemyWeak) score -= 300;
            if (hasDroneAdvantage) score -= 360;
            if (canWin) score -= 220;
            if (enemy.hp < bot.hp) score -= 100;
            if (!canWin) score += 320;
            if ((bot.hp || 0) <= ZONE_PVP_BOT_LOW_HP && enemyPower > botPower * 1.15) score += 560;
            if (distance < 260 && enemyPower > botPower * 1.15) score += 300;

            if (score < bestScore) {
                bestScore = score;
                bestEnemy = {
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    hp: enemy.hp,
                    maxHp: enemy.maxHp,
                    drones: enemy.drones,
                    totalCollected: enemy.totalCollected || 0,
                    kills: enemy.kills || 0,
                    isBot: enemy.isBot,
                    distance,
                    enemyWeak,
                    hasDroneAdvantage,
                    canWin,
                    enemyPower,
                    botPower,
                };
            }
        }

        return bestEnemy;
    }

    setZonePvpBotInput(bot, targetX, targetY, options = {}) {
        const dx = targetX - bot.x;
        const dy = targetY - bot.y;
        const distance = Math.hypot(dx, dy) || 1;

        bot.input = {
            w: dy < -22,
            s: dy > 22,
            a: dx < -22,
            d: dx > 22,
            attacking: Boolean(options.attacking),
            shield: Boolean(options.shield),
            mouseX: options.mouseX ?? targetX,
            mouseY: options.mouseY ?? targetY,
        };

        bot.moveX = dx / distance;
        bot.moveY = dy / distance;
        bot.moveAngle = Math.atan2(dy, dx);
        bot.isMoving = Math.abs(dx) > 22 || Math.abs(dy) > 22;
    }

    updateZonePvpBots(room, now, zoneRadius) {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;

        for (const bot of room.players.values()) {
            if (!bot.isBot || !bot.alive) continue;

            bot.lastSeenAt = now;

            // Nu recalculam decizia in fiecare frame pentru toti botii; miscarea continua
            // prin input-ul ramas setat. Asta pastreaza comportamentul fluid si scade CPU.
            if (bot.aiPlanUntil && now < bot.aiPlanUntil) {
                continue;
            }

            bot.aiPlanUntil = now + ZONE_PVP_BOT_DECISION_INTERVAL_MIN + Math.random() * (ZONE_PVP_BOT_DECISION_INTERVAL_MAX - ZONE_PVP_BOT_DECISION_INTERVAL_MIN);

            const zoneInfo = this.getZonePvpZoneInfo(bot.x, bot.y, zoneRadius);
            const avoidance = this.getZonePvpBotAvoidance(bot, room, ZONE_PVP_BOT_AVOID_RADIUS);

            let targetX = bot.x;
            let targetY = bot.y;
            let aimX = targetX;
            let aimY = targetY;
            let attacking = false;
            let shield = false;
            let speedPressureX = 0;
            let speedPressureY = 0;

            // 1) Zona are prioritate maxima: botii fug spre centru inainte sa ia damage.
            if (zoneInfo.dangerDistance < ZONE_PVP_BOT_ZONE_EDGE_BUFFER) {
                bot.aiState = 'escape-zone';
                speedPressureX += zoneInfo.moveToCenterX * 1200;
                speedPressureY += zoneInfo.moveToCenterY * 1200;
                targetX = bot.x + speedPressureX;
                targetY = bot.y + speedPressureY;
                aimX = targetX;
                aimY = targetY;
            }
            else {
                const enemy = this.findZonePvpBotEnemy(bot, room);
                const shouldFarm = this.shouldZonePvpBotFarm(bot);

                // 2) Fight agresiv ca in BattleRoyaleMode: ataca daca are drone sau daca inamicul e aproape/slab.
                if (enemy && (!shouldFarm || enemy.distance < 520 || enemy.enemyWeak || enemy.hasDroneAdvantage)) {
                    const dx = enemy.x - bot.x;
                    const dy = enemy.y - bot.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    const desiredRange = bot.preferredRange || ZONE_PVP_BOT_SAFE_DISTANCE;
                    const strafe = bot.aiStrafeDir || 1;

                    bot.aiState = 'fight';
                    aimX = enemy.x + (enemy.moveX || 0) * 120 * (bot.aiSkill || 1);
                    aimY = enemy.y + (enemy.moveY || 0) * 120 * (bot.aiSkill || 1);
                    attacking = dist <= ZONE_PVP_BOT_ATTACK_RANGE && (bot.drones || 0) > 0;

                    if (dist > desiredRange) {
                        targetX = enemy.x;
                        targetY = enemy.y;
                    }
                    else if (dist < desiredRange * 0.65 || ((bot.hp || 0) <= ZONE_PVP_BOT_LOW_HP && enemy.enemyPower > enemy.botPower)) {
                        targetX = bot.x - (dx / dist) * 680;
                        targetY = bot.y - (dy / dist) * 680;
                    }
                    else {
                        targetX = bot.x + (-dy / dist) * 560 * strafe;
                        targetY = bot.y + (dx / dist) * 560 * strafe;
                    }

                    if (Math.random() < 0.035) {
                        bot.aiStrafeDir *= -1;
                    }

                    shield = Boolean((bot.hp || 0) <= 45 && (bot.energy || 0) >= 20 && enemy.distance < 650 && Math.random() < 0.35);
                }
                else {
                    // 3) Farm inteligent: energy daca e low, apoi core util, apoi orb.
                    const needsEnergy = (bot.energy || 0) <= 48;
                    const energyTarget = needsEnergy
                        ? this.findClosestZonePvpItem(bot, room.energyCells, zoneRadius, ZONE_PVP_BOT_VIEW_RANGE)
                        : null;
                    const coreTarget = this.findBestZonePvpCoreForBot(bot, room, zoneRadius);
                    const orbTarget = this.findClosestZonePvpItem(bot, room.orbs, zoneRadius, ZONE_PVP_BOT_VIEW_RANGE);
                    const target = energyTarget || coreTarget || orbTarget;

                    if (target) {
                        bot.aiState = target.type ? 'core' : needsEnergy && energyTarget ? 'energy' : 'farm';
                        bot.aiTargetId = target.id;
                        targetX = target.x;
                        targetY = target.y;
                        aimX = target.x;
                        aimY = target.y;
                    }
                    else {
                        bot.aiState = 'wander';
                        bot.wanderAngle = (bot.wanderAngle || 0) + (Math.random() - 0.5) * 0.9;
                        const wanderRadius = Math.max(520, Math.min(zoneRadius * 0.52, 2100));
                        targetX = centerX + Math.cos(bot.wanderAngle) * wanderRadius;
                        targetY = centerY + Math.sin(bot.wanderAngle) * wanderRadius;
                        aimX = targetX;
                        aimY = targetY;
                    }
                }
            }

            // 4) Evitare aglomeratie: distanta intre toti, sa nu se lipeasca botii intre ei/playeri.
            targetX += avoidance.avoidX * 620;
            targetY += avoidance.avoidY * 620;

            // 5) Pastreaza tinta in harta si preferabil in zona safe.
            targetX = this.clamp(targetX, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
            targetY = this.clamp(targetY, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);
            if (!this.isInsideSafeZone(targetX, targetY, zoneRadius, 160)) {
                const dx = targetX - centerX;
                const dy = targetY - centerY;
                const dist = Math.hypot(dx, dy) || 1;
                const safeRadius = Math.max(160, zoneRadius - 180);
                targetX = centerX + (dx / dist) * safeRadius;
                targetY = centerY + (dy / dist) * safeRadius;
            }

            this.setZonePvpBotInput(bot, targetX, targetY, {
                attacking,
                shield,
                mouseX: aimX,
                mouseY: aimY,
            });
        }
    }

    broadcastZonePvpRoomState(room, now) {
        const players = [...room.players.values()];
        const alivePlayers = players.filter((player) => player.alive);
        const zoneRadius = this.getZonePvpZoneRadius(room);
        const zonePvpCountdown = room.status === 'countdown' && room.countdownStartedAt
            ? Math.max(1, Math.ceil((ZONE_PVP_START_COUNTDOWN_MS - (now - room.countdownStartedAt)) / 1000))
            : null;

        const leaderboard = players
            .slice()
            .sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.totalCollected || 0) - (a.totalCollected || 0))
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

        const secondsUntilCoreDrop = room.cores.length === 0 && room.nextCoreWaveAt
            ? Math.ceil(Math.max(0, room.nextCoreWaveAt - now) / 1000)
            : null;

        const coreDropCountdown =
            secondsUntilCoreDrop && secondsUntilCoreDrop > 0 && secondsUntilCoreDrop <= Math.ceil(CORE_WARNING_DELAY / 1000)
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

            const aliveOthers = players.filter((other) => other.id !== player.id && other.alive !== false);

            let spectatorTarget = null;
            if (player.alive === false) {
                spectatorTarget = player.killedById
                    ? aliveOthers.find((other) => other.id === player.killedById) || null
                    : null;

                if (!spectatorTarget && player.spectatorTargetId) {
                    spectatorTarget = aliveOthers.find((other) => other.id === player.spectatorTargetId) || null;
                }

                if (!spectatorTarget && aliveOthers.length > 0) {
                    spectatorTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                }

                player.spectatorTargetId = spectatorTarget?.id || null;
            } else {
                player.spectatorTargetId = null;
                player.killedById = null;
            }

            const viewAnchor = spectatorTarget || player;

            const visiblePlayers = player.alive === false
                ? this.filterNear(viewAnchor, aliveOthers, VIEW_DISTANCE + 1200, ZONE_PVP_VISIBLE_PLAYERS_LIMIT)
                    .map((other) => this.serializePlayer(other))
                : this.filterNear(
                    player,
                    players.filter((other) => other.id !== player.id),
                    VIEW_DISTANCE,
                    ZONE_PVP_VISIBLE_PLAYERS_LIMIT
                ).map((other) => this.serializePlayer(other));

            socket.volatile.emit('zone-pvp:state', {
                status: room.status,
                countdown: zonePvpCountdown,
                coreDropCountdown,
                winnerId: room.winnerId,
                winnerName: room.winnerName,
                playerCount: room.status === 'waiting' || room.status === 'countdown'
                    ? this.getZonePvpRealPlayerCount(room)
                    : alivePlayers.length,
                minPlayers: ZONE_PVP_ROOM_MIN_PLAYERS,
                maxPlayers: ZONE_PVP_ROOM_MAX_PLAYERS,
                worldWidth: WORLD_WIDTH,
                worldHeight: WORLD_HEIGHT,
                safeZoneRadius: zoneRadius,
                zoneShrinkDuration: ZONE_PVP_ZONE_SHRINK_DURATION,
                matchStartedAt: room.matchStartedAt,
                you: this.serializePlayer(player),
                players: visiblePlayers,
                spectatorTargetId: spectatorTarget?.id || null,
                spectatingPlayer: spectatorTarget ? this.serializePlayer(spectatorTarget) : null,

                orbs: this.filterNear(viewAnchor, room.orbs, VIEW_DISTANCE, VISIBLE_ORB_LIMIT),
                energyCells: this.filterNear(viewAnchor, room.energyCells, VIEW_DISTANCE, VISIBLE_ENERGY_LIMIT),
                cores: this.filterNear(viewAnchor, room.cores, VIEW_DISTANCE + 600, 18),
                projectiles: this.filterNear(viewAnchor, room.projectiles, VIEW_DISTANCE + 400, VISIBLE_PROJECTILE_LIMIT),

                minimapOrbs,
                minimapEnergyCells,
                minimapCores,

                leaderboard,
            });
        }
    }

    findOrCreateRoom() {
        for (const room of this.rooms.values()) {
            if (room.status !== 'playing' && room.status !== 'finished' && room.players.size < ROOM_MAX_PLAYERS) {
                return room;
            }
        }
        const room = {
            id: crypto.randomUUID(),
            status: 'waiting',
            players: new Map(),
            orbs: Array.from({ length: MAX_ORBS }, () => this.createOrb(ZONE_START_RADIUS)),
            energyCells: Array.from({ length: MAX_ENERGY_CELLS }, () => this.createEnergyCell(ZONE_START_RADIUS)),
            cores: Array.from({ length: CORE_WAVE_SIZE }, () => this.createCore(ZONE_START_RADIUS)),
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
            if (room.players.size < ROOM_MIN_PLAYERS && room.status === 'countdown') {
                room.status = 'waiting';
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
        if (this.getZonePvpRealPlayerCount(room) === 0 && now - room.createdAt > 15000) {
            this.rooms.delete(room.id);
            return;
        }
        if (room.status === 'finished' && room.finishedAt && now - room.finishedAt > 90000) {
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
    createOrb(zoneRadius: number, nearX?: number, nearY?: number) {
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
    createEnergyCell(zoneRadius: number, nearX?: number, nearY?: number) {
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
        for (const player of alive) {
            const nearbyOrbs = room.orbs.filter((orb) => this.isNear(player, orb, 1800)).length;
            const nearbyEnergy = room.energyCells.filter((cell) => this.isNear(player, cell, 1800)).length;
            if (nearbyOrbs < 90 && room.orbs.length < MAX_ORBS + alive.length * 90) {
                const toAdd = Math.min(90 - nearbyOrbs, 45);
                for (let i = 0; i < toAdd; i += 1) {
                    room.orbs.push(this.createOrb(zoneRadius, player.x, player.y));
                }
            }
            if (nearbyEnergy < 4 && room.energyCells.length < MAX_ENERGY_CELLS + alive.length * 6) {
                const toAdd = Math.min(4 - nearbyEnergy, 3);
                for (let i = 0; i < toAdd; i += 1) {
                    room.energyCells.push(this.createEnergyCell(zoneRadius, player.x, player.y));
                }
            }
        }
        if (room.orbs.length > MAX_ORBS + alive.length * 90) {
            room.orbs = room.orbs.slice(-(MAX_ORBS + alive.length * 90));
        }
        if (room.energyCells.length > MAX_ENERGY_CELLS + alive.length * 6) {
            room.energyCells = room.energyCells.slice(-(MAX_ENERGY_CELLS + alive.length * 6));
        }
    }
    randomSafePointNear(nearX, nearY, zoneRadius, margin = 120, minDistance = 300, maxDistance = 1400) {
        for (let attempt = 0; attempt < 90; attempt += 1) {
            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * Math.max(1, maxDistance - minDistance);
            const x = nearX + Math.cos(angle) * distance;
            const y = nearY + Math.sin(angle) * distance;

            const insideWorld =
                x >= PLAYER_RADIUS &&
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
    filterNear(player, items, distance, limit) {
        const distanceSq = distance * distance;
        const nearby = [];
        for (const item of items) {
            const dx = (item.x || 0) - (player.x || 0);
            const dy = (item.y || 0) - (player.y || 0);
            const distSq = dx * dx + dy * dy;
            if (distSq <= distanceSq) {
                nearby.push({ item, distSq });
            }
        }
        nearby.sort((a, b) => a.distSq - b.distSq);
        return nearby.slice(0, limit).map((entry) => entry.item);
    }
    getAlivePlayers(room) {
        return [...room.players.values()].filter((player) => player.alive);
    }
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

}
