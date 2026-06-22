import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PlayersModule } from './players/players.module';
import { GameModule } from './game/game.module';
import { AuthModule } from './auth/auth.module';
import { MatchResultModule } from './match-result/match-result.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayersModule,
    GameModule,
    MatchResultModule,
  ],
})
export class AppModule {}