import { PrismaService } from '../prisma/prisma.service';
export declare class MatchResultService {
    private prisma;
    constructor(prisma: PrismaService);
    saveBattleRoyaleResult(data: {
        userId?: number | null;
        username: string;
        kills?: number;
        totalCollected?: number;
        placement: number;
        totalPlayers?: number;
        durationSeconds?: number;
        skin?: string;
    }): Promise<{
        id: number;
        saved: boolean;
    }>;
    getHistoryForUser(userId: number): Promise<{
        skin: string;
        id: number;
        username: string;
        createdAt: Date;
        totalCollected: number;
        kills: number;
        userId: number | null;
        gameMode: string;
        placement: number;
        totalPlayers: number;
        durationSeconds: number;
    }[]>;
}
