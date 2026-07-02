import { Response } from 'express';
import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(body: any): Promise<{
        message: string;
        userId: number;
        email: string;
        devActivationCode: string;
    }>;
    verify(body: any): Promise<{
        message: string;
    }>;
    login(body: any): Promise<{
        token: string;
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            selectedCtfPackId: any;
            avatar: any;
        };
    }>;
    selectDrone(body: {
        userId: number;
        drone: string;
    }): Promise<{
        selectedDrone: string;
        selectedSkin: string;
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            selectedCtfPackId: any;
            avatar: any;
        };
    }>;
    selectCtfPack(body: {
        userId: number;
        ctfPackId: string;
    }): Promise<{
        selectedCtfPackId: string;
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            selectedCtfPackId: any;
            avatar: any;
        };
    }>;
    setUsername(body: {
        userId: number;
        username: string;
    }): Promise<{
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            selectedCtfPackId: any;
            avatar: any;
        };
    }>;
    googleAuth(): void;
    googleCallback(req: any, res: Response): Promise<void>;
}
