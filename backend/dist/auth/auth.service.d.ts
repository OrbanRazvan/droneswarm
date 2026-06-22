import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    private generateCode;
    private normalizeDrone;
    private safeUser;
    private sendActivationEmail;
    register(data: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
    }): Promise<{
        message: string;
        userId: number;
        email: string;
        devActivationCode: string;
    }>;
    verify(data: {
        email: string;
        code: string;
    }): Promise<{
        message: string;
    }>;
    login(data: {
        email: string;
        password: string;
    }): Promise<{
        token: string;
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            avatar: any;
        };
    }>;
    googleLogin(profile: {
        googleId: string;
        email: string;
        firstName: string;
        lastName: string;
        avatar?: string | null;
    }): Promise<{
        token: string;
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            avatar: any;
        };
    }>;
    setUsername(userId: number, username: string): Promise<{
        user: {
            id: any;
            firstName: any;
            lastName: any;
            username: any;
            email: any;
            selectedDrone: any;
            selectedSkin: any;
            avatar: any;
        };
    }>;
    selectDrone(userId: number, drone: string): Promise<{
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
            avatar: any;
        };
    }>;
}
