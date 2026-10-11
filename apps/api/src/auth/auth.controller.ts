import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetService } from './password-reset.service';

export const SESSION_COOKIE_NAME = 'sid';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { token, expiresAt, rememberMe } = await this.authService.login({
      loginId: body.loginId,
      password: body.password,
      rememberMe: body.rememberMe ?? false,
    });

    response.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // 로그인 유지를 선택하지 않으면 브라우저를 닫을 때 사라지는 쿠키로 둔다.
      ...(rememberMe && { expires: expiresAt }),
    });
  }

  @Post('password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestPasswordReset(
    @Body() body: PasswordResetRequestDto,
  ): Promise<void> {
    await this.passwordResetService.request({
      loginId: body.loginId,
      email: body.email,
    });
  }
}
