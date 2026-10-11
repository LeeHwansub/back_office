import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasher } from './password-hasher';
import { generateSessionToken, hashSessionToken } from './session-token';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REMEMBER_ME_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type LoginInput = {
  loginId: string;
  password: string;
  rememberMe: boolean;
};

export type LoginResult = {
  token: string;
  expiresAt: Date;
  rememberMe: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async login({
    loginId,
    password,
    rememberMe,
  }: LoginInput): Promise<LoginResult> {
    const user = await this.prisma.adminUser.findUnique({
      where: { loginId },
    });

    const passwordMatches = user
      ? await this.passwordHasher.verify(user.passwordHash, password)
      : await this.passwordHasher.verifyAgainstDummy(password);
    if (!user || !passwordMatches) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    if (user.status === 'LOCKED') {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_LOCKED);
    }
    if (user.status !== 'ACTIVE') {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_DISABLED);
    }

    const token = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        (rememberMe ? REMEMBER_ME_SESSION_TTL_MS : SESSION_TTL_MS),
    );

    await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: {
          tokenHash: hashSessionToken(token),
          userId: user.id,
          expiresAt,
        },
      }),
      this.prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
    ]);

    return { token, expiresAt, rememberMe };
  }
}
