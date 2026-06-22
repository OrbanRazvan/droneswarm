export declare class GameController {
    state(): {
        server: string;
        playing: number;
        player: {
            username: string;
            mass: number;
            drones: number;
            skin: string;
        };
        abilities: string[];
    };
}
