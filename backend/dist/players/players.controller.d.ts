import { PlayersService } from './players.service';
export declare class PlayersController {
    private readonly playersService;
    constructor(playersService: PlayersService);
    login(body: {
        username: string;
    }): Promise<{
        skin: string;
        id: number;
        username: string;
        mass: number;
        drones: number;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    leaderboard(): Promise<{
        skin: string;
        id: number;
        username: string;
        mass: number;
        drones: number;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
