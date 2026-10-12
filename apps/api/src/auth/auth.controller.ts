import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetService } from './password-reset.service';
import {
  readSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from './session-cookie';
import { CurrentUser, SessionGuard } from './session.guard';
import { type AuthenticatedUser, SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly sessionService: SessionService,
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
      ...sessionCookieOptions(),
      // 로그인 유지를 선택하지 않으면 브라우저를 닫을 때 사라지는 쿠키로 둔다.
      ...(rememberMe && { expires: expiresAt }),
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionService.revoke(readSessionToken(request.headers.cookie));
    response.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
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

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(
    @Body() body: PasswordResetConfirmDto,
  ): Promise<void> {
    await this.passwordResetService.confirm({
      token: body.token,
      newPassword: body.newPassword,
    });
  }
}
