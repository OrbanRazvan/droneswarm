import { Body, Controller, Get, Post } from '@nestjs/common';
import { PlayersService } from './players.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post('login')
  login(@Body() body: { username: string }) {
    return this.playersService.getOrCreatePlayer(body.username);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.playersService.getLeaderboard();
  }
}