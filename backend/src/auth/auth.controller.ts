import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('verify')
  verify(@Body() body: any) {
    return this.authService.verify(body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('select-drone')
  selectDrone(@Body() body: { userId: number; drone: string }) {
    return this.authService.selectDrone(body.userId, body.drone);
  }

  @Post('select-ctf-pack')
  selectCtfPack(@Body() body: { userId: number; ctfPackId: string }) {
    return this.authService.selectCtfPack(body.userId, body.ctfPackId);
  }

  @Post('set-username')
  setUsername(@Body() body: { userId: number; username: string }) {
    return this.authService.setUsername(body.userId, body.username);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.googleLogin(req.user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const redirectUrl =
      `${frontendUrl}/?token=${encodeURIComponent(result.token)}` +
      `&user=${encodeURIComponent(JSON.stringify(result.user))}`;

    return res.redirect(redirectUrl);
  }
}