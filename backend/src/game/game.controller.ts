import { Controller, Get } from '@nestjs/common';
@Controller('game')
export class GameController {
  @Get('state')
  state() {
    return {
      server: 'EU #3',
      playing: 52,
      player: { username: 'You', mass: 1250, drones: 19, skin: 'cyan' },
      abilities: ['speed', 'split', 'shield', 'magnet']
    };
  }
}
