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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PlayersService = class PlayersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOrCreatePlayer(username) {
        const existing = await this.prisma.player.findUnique({
            where: { username },
        });
        if (existing)
            return existing;
        return this.prisma.player.create({
            data: {
                username,
                mass: 1250,
                drones: 19,
                skin: 'cyan',
                coins: 0,
            },
        });
    }
    async getLeaderboard() {
        return this.prisma.player.findMany({
            orderBy: { mass: 'desc' },
            take: 10,
        });
    }
    async updatePlayer(id, mass, drones) {
        return this.prisma.player.update({
            where: { id },
            data: { mass, drones },
        });
    }
};
exports.PlayersService = PlayersService;
exports.PlayersService = PlayersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlayersService);
//# sourceMappingURL=players.service.js.map