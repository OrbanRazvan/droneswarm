import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchResultService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Salveaza rezultatul unui meci de Battle Royale (single-player + boti AI).
  // userId e optional: daca lipseste sau e invalid, salvam totusi meciul
  // (cu userId: null) ca sa nu pierdem rezultatul - mai bine un rand orfan
  // decat sa blocam jucatorul la finalul unui meci.
  // ---------------------------------------------------------------------
  async saveBattleRoyaleResult(data: {
    userId?: number | null;
    username: string;
    kills?: number;
    totalCollected?: number;
    placement: number;
    totalPlayers?: number;
    durationSeconds?: number;
    skin?: string;
  }) {
    const username = String(data?.username || 'Player').trim().slice(0, 32) || 'Player';
    const placement = Number(data?.placement);

    if (!Number.isFinite(placement) || placement < 1) {
      throw new BadRequestException('Placement invalid.');
    }

    const userId =
      data?.userId !== undefined && data?.userId !== null && Number.isFinite(Number(data.userId))
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

  // Istoric simplu pentru un user (ultimele 20 meciuri), folosit optional
  // intr-un ecran de statistici/profil.
  async getHistoryForUser(userId: number) {
    if (!userId) return [];

    return this.prisma.matchResult.findMany({
      where: { userId: Number(userId), gameMode: 'battle-royale' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}