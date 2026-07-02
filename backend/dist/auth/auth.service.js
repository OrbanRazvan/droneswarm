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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt_1 = require("@nestjs/jwt");
const ALLOWED_DRONES = [
    'basic',
    'cyan',
    'red',
    'purple',
    'orange',
    'green',
    'pink',
    'ice-blue',
    'solar-gold',
    'shadow-black',
    'toxic-lime',
    'royal-violet',
    'crimson-white',
    'neon-teal',
    'ember-red',
    'arctic-silver',
    'void-purple',
    'plasma-pink',
    'jade-black',
    'azure-white',
    'inferno-orange',
    'midnight-blue',
    'acid-green',
    'ruby-black',
    'ghost-white',
    'cyber-yellow',
    'deep-ocean',
    'magenta-cyan',
    'bronze-steel',
    'electric-indigo',
    'dark-emerald',
];
const DEFAULT_CTF_PACK_ID = 'ctf-pack-starter-command';
const ALLOWED_CTF_PACK_IDS = [
    'ctf-pack-starter-command',
    'ctf-pack-galactic-command',
    'ctf-pack-medieval-forge',
    'ctf-pack-military-prototype',
    'ctf-pack-dark-galactic',
];
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    normalizeDrone(drone) {
        const clean = String(drone || 'basic')
            .trim()
            .toLowerCase()
            .replace(/_/g, '-')
            .replace(/\s+/g, '-');
        return clean || 'basic';
    }
    normalizeCtfPackId(ctfPackId) {
        const clean = String(ctfPackId || '')
            .trim()
            .toLowerCase()
            .replace(/_/g, '-')
            .replace(/\s+/g, '-');
        return clean || DEFAULT_CTF_PACK_ID;
    }
    safeUser(user) {
        const selectedDrone = user.selectedDrone || 'basic';
        const selectedCtfPackId = user.selectedCtfPackId || DEFAULT_CTF_PACK_ID;
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username || null,
            email: user.email,
            selectedDrone,
            selectedSkin: selectedDrone === 'basic' ? 'cyan' : selectedDrone,
            selectedCtfPackId,
            avatar: user.avatar || null,
        };
    }
    async sendActivationEmail(email, code) {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: email,
            subject: 'Drone Swarm - Cod activare cont',
            html: `
        <div style="font-family: Arial, sans-serif; background:#06101d; color:white; padding:24px;">
          <h2 style="color:#00eaff;">Drone Swarm</h2>
          <p>Codul tau de activare este:</p>
          <h1 style="letter-spacing:6px; color:#00eaff;">${code}</h1>
          <p>Introdu acest cod in joc pentru activarea contului.</p>
        </div>
      `,
        });
    }
    async register(data) {
        const firstName = data.firstName?.trim();
        const lastName = data.lastName?.trim();
        const email = data.email?.trim().toLowerCase();
        const password = data.password;
        if (!firstName || !lastName || !email || !password) {
            throw new common_1.BadRequestException('Completeaza toate campurile.');
        }
        if (password.length < 6) {
            throw new common_1.BadRequestException('Parola trebuie sa aiba minimum 6 caractere.');
        }
        const existing = await this.prisma.gameUser.findUnique({
            where: { email },
        });
        if (existing) {
            throw new common_1.BadRequestException('Email-ul exista deja.');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const code = this.generateCode();
        const user = await this.prisma.gameUser.create({
            data: {
                firstName,
                lastName,
                email,
                password: hashedPassword,
                activationCode: code,
                isVerified: false,
                selectedDrone: 'basic',
                selectedCtfPackId: DEFAULT_CTF_PACK_ID,
            },
        });
        let emailSent = true;
        try {
            await this.sendActivationEmail(email, code);
        }
        catch {
            emailSent = false;
        }
        return {
            message: emailSent
                ? 'Cont creat. Verifica email-ul pentru codul de activare.'
                : 'Cont creat. Emailul nu a putut fi trimis momentan. Foloseste codul de test.',
            userId: user.id,
            email: user.email,
            devActivationCode: emailSent ? undefined : code,
        };
    }
    async verify(data) {
        const email = data.email?.trim().toLowerCase();
        const code = data.code?.trim();
        if (!email || !code) {
            throw new common_1.BadRequestException('Email si cod obligatorii.');
        }
        const user = await this.prisma.gameUser.findUnique({
            where: { email },
        });
        if (!user) {
            throw new common_1.BadRequestException('Utilizator inexistent.');
        }
        if (user.isVerified) {
            return { message: 'Contul este deja activat.' };
        }
        if (user.activationCode !== code) {
            throw new common_1.BadRequestException('Cod invalid.');
        }
        await this.prisma.gameUser.update({
            where: { email },
            data: {
                isVerified: true,
                activationCode: null,
            },
        });
        return { message: 'Cont activat cu succes.' };
    }
    async login(data) {
        const email = data.email?.trim().toLowerCase();
        const password = data.password;
        if (!email || !password) {
            throw new common_1.UnauthorizedException('Email si parola obligatorii.');
        }
        const user = await this.prisma.gameUser.findUnique({
            where: { email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Email sau parola gresita.');
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new common_1.UnauthorizedException('Email sau parola gresita.');
        }
        if (!user.isVerified) {
            throw new common_1.UnauthorizedException('Contul nu este activat.');
        }
        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
        });
        return {
            token,
            user: this.safeUser(user),
        };
    }
    async googleLogin(profile) {
        if (!profile?.email) {
            throw new common_1.UnauthorizedException('Google login invalid.');
        }
        const email = profile.email.toLowerCase();
        let user = await this.prisma.gameUser.findUnique({
            where: { email },
        });
        if (!user) {
            user = await this.prisma.gameUser.create({
                data: {
                    firstName: profile.firstName || 'Player',
                    lastName: profile.lastName || '',
                    email,
                    password: '',
                    isVerified: true,
                    activationCode: null,
                    selectedDrone: 'basic',
                    selectedCtfPackId: DEFAULT_CTF_PACK_ID,
                    avatar: profile.avatar || null,
                    username: null,
                },
            });
        }
        else {
            user = await this.prisma.gameUser.update({
                where: { id: user.id },
                data: {
                    isVerified: true,
                    activationCode: null,
                    avatar: profile.avatar || user.avatar,
                },
            });
        }
        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
        });
        return {
            token,
            user: this.safeUser(user),
        };
    }
    async setUsername(userId, username) {
        const cleanUsername = username?.trim();
        if (!userId) {
            throw new common_1.BadRequestException('UserId lipseste.');
        }
        if (!cleanUsername) {
            throw new common_1.BadRequestException('Username lipseste.');
        }
        if (cleanUsername.length < 3) {
            throw new common_1.BadRequestException('Username-ul trebuie sa aiba minimum 3 caractere.');
        }
        if (cleanUsername.length > 16) {
            throw new common_1.BadRequestException('Username-ul trebuie sa aiba maximum 16 caractere.');
        }
        const valid = /^[a-zA-Z0-9_]+$/.test(cleanUsername);
        if (!valid) {
            throw new common_1.BadRequestException('Username-ul poate contine doar litere, cifre si underscore.');
        }
        const existing = await this.prisma.gameUser.findUnique({
            where: { username: cleanUsername },
        });
        if (existing && existing.id !== Number(userId)) {
            throw new common_1.BadRequestException('Username-ul este deja folosit.');
        }
        const user = await this.prisma.gameUser.update({
            where: { id: Number(userId) },
            data: {
                username: cleanUsername,
            },
        });
        return {
            user: this.safeUser(user),
        };
    }
    async selectCtfPack(userId, ctfPackId) {
        if (!userId) {
            throw new common_1.BadRequestException('UserId lipseste.');
        }
        const cleanPackId = this.normalizeCtfPackId(ctfPackId);
        if (!ALLOWED_CTF_PACK_IDS.includes(cleanPackId)) {
            throw new common_1.BadRequestException('Pachetul Capture The Flag este invalid.');
        }
        const user = await this.prisma.gameUser.update({
            where: { id: Number(userId) },
            data: {
                selectedCtfPackId: cleanPackId,
            },
        });
        return {
            selectedCtfPackId: user.selectedCtfPackId,
            user: this.safeUser(user),
        };
    }
    async selectDrone(userId, drone) {
        if (!userId) {
            throw new common_1.BadRequestException('UserId lipseste.');
        }
        const cleanDrone = this.normalizeDrone(drone);
        if (!cleanDrone) {
            throw new common_1.BadRequestException('Drona lipseste.');
        }
        if (!ALLOWED_DRONES.includes(cleanDrone)) {
            throw new common_1.BadRequestException('Drona invalida.');
        }
        const user = await this.prisma.gameUser.update({
            where: { id: Number(userId) },
            data: {
                selectedDrone: cleanDrone,
            },
        });
        return {
            selectedDrone: user.selectedDrone,
            selectedSkin: user.selectedDrone === 'basic' ? 'cyan' : user.selectedDrone,
            user: this.safeUser(user),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map