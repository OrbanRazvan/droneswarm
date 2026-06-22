import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayersService {
  constructor(private prisma: PrismaService) {}

  async getOrCreatePlayer(username: string) {
    const existing = await this.prisma.player.findUnique({
      where: { username },
    });

    if (existing) return existing;

    return this.prisma.player.create({
      data: {
        username,
        mass: 1250,
        drones: 19,
        skin: 'cyan',
        coins: 0,
      },
    });
  }

  async getLeaderboard() {
    return this.prisma.player.findMany({
      orderBy: { mass: 'desc' },
      take: 10,
    });
  }

  async updatePlayer(id: number, mass: number, drones: number) {
    return this.prisma.player.update({
      where: { id },
      data: { mass, drones },
    });
  }
}