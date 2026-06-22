import { PrismaService } from '../prisma/prisma.service';
export declare class PlayersService {
    private prisma;
    constructor(prisma: PrismaService);
    getOrCreatePlayer(username: string): Promise<{
        skin: string;
        id: number;
        username: string;
        mass: number;
        drones: number;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getLeaderboard(): Promise<{
        skin: string;
        id: number;
        username: string;
        mass: number;
        drones: number;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    updatePlayer(id: number, mass: number, drones: number): Promise<{
        skin: string;
        id: number;
        username: string;
        mass: number;
        drones: number;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
