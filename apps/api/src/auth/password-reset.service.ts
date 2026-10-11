import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_WEB_URL } from '../app.setup';
import { PasswordResetMailer } from '../mail/password-reset-mailer';
import { PrismaService } from '../prisma/prisma.service';
import { generateSessionToken, hashSessionToken } from './session-token';

const RESET_TOKEN_TTL_MINUTES = 30;
const RESETTABLE_STATUSES = ['ACTIVE', 'LOCKED'];

export type PasswordResetRequestInput = {
  loginId: string;
  email: string;
};

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: PasswordResetMailer,
  ) {}

  async request({ loginId, email }: PasswordResetRequestInput): Promise<void> {
    const user = await this.prisma.adminUser.findUnique({
      where: { loginId },
    });
    if (
      !user ||
      user.email.toLowerCase() !== email.toLowerCase() ||
      !RESETTABLE_STATUSES.includes(user.status)
    ) {
      return;
    }

    const token = generateSessionToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          tokenHash: hashSessionToken(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
        },
      }),
    ]);

    const webUrl = process.env.WEB_URL || DEFAULT_WEB_URL;
    // 발송을 기다리면 계정이 있을 때만 응답이 느려져 계정 존재 여부가 드러난다.
    this.mailer
      .send({
        to: user.email,
        resetUrl: `${webUrl}/reset-password?token=${token}`,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `비밀번호 재설정 메일 발송 실패(loginId: ${loginId}): ${
            error instanceof Error ? error.message : '알 수 없는 오류'
          }`,
        );
      });
  }
}
