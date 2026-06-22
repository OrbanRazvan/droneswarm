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
exports.MatchResultService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MatchResultService = class MatchResultService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async saveBattleRoyaleResult(data) {
        const username = String(data?.username || 'Player').trim().slice(0, 32) || 'Player';
        const placement = Number(data?.placement);
        if (!Number.isFinite(placement) || placement < 1) {
            throw new common_1.BadRequestException('Placement invalid.');
        }
        const userId = data?.userId !== undefined && data?.userId !== null && Number.isFinite(Number(data.userId))
            ? Number(data.userId)
            : null;
        const result = await this.prisma.matchResult.create({
            data: {
                userId,
                username,
                gameMode: 'battle-royale',
                kills: Math.max(0, Number(data?.kills) || 0),
                totalCollected: Math.max(0, Number(data?.totalCollected) || 0),
                placement: Math.floor(placement),
                totalPlayers: Math.max(1, Number(data?.totalPlayers) || 60),
                durationSeconds: Math.max(0, Number(data?.durationSeconds) || 0),
                skin: String(data?.skin || 'cyan').trim().slice(0, 32) || 'cyan',
            },
        });
        return { id: result.id, saved: true };
    }
    async getHistoryForUser(userId) {
        if (!userId)
            return [];
        return this.prisma.matchResult.findMany({
            where: { userId: Number(userId), gameMode: 'battle-royale' },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }
};
exports.MatchResultService = MatchResultService;
exports.MatchResultService = MatchResultService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MatchResultService);
//# sourceMappingURL=match-result.service.js.map