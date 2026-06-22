import { MatchResultService } from './match-result.service';
export declare class MatchResultController {
    private matchResultService;
    constructor(matchResultService: MatchResultService);
    saveBattleRoyaleResult(body: any): Promise<{
        id: number;
        saved: boolean;
    }>;
    getHistory(userId: string): Promise<{
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
