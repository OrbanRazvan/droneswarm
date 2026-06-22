import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MatchResultService } from './match-result.service';

@Controller('matches')
export class MatchResultController {
  constructor(private matchResultService: MatchResultService) {}

  // POST /matches/battle-royale
  // Body: { userId, username, kills, totalCollected, placement, totalPlayers, durationSeconds, skin }
  @Post('battle-royale')
  saveBattleRoyaleResult(@Body() body: any) {
    return this.matchResultService.saveBattleRoyaleResult(body);
  }

  // GET /matches/battle-royale/history/:userId
  @Get('battle-royale/history/:userId')
  getHistory(@Param('userId') userId: string) {
    return this.matchResultService.getHistoryForUser(Number(userId));
  }
}