import { PlayersService } from './players.service';
export declare class PlayersController {
    private readonly playersService;
    constructor(playersService: PlayersService);
    login(body: {
        username: string;
    }): Promise<{
        id: number;
        username: string;
        mass: number;
        drones: number;
        skin: string;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    leaderboard(): Promise<{
        id: number;
        username: string;
        mass: number;
        drones: number;
        skin: string;
        coins: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
