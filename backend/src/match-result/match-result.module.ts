import { Module } from '@nestjs/common';
import { MatchResultService } from './match-result.service';
import { MatchResultController } from './match-result.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MatchResultController],
  providers: [MatchResultService],
})
export class MatchResultModule {}