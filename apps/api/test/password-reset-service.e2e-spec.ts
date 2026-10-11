import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PasswordHasher } from '../src/auth/password-hasher';
import { PasswordResetService } from '../src/auth/password-reset.service';
import { hashSessionToken } from '../src/auth/session-token';
import {
  PasswordResetMail,
  PasswordResetMailer,
} from '../src/mail/password-reset-mailer';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const MINUTE_MS = 60 * 1000;
const RESET_URL_PATTERN =
  /^http:\/\/localhost:3000\/reset-password\?token=([A-Za-z0-9_-]{43})$/;

function flushBackgroundTasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('PasswordResetService.request (e2e)', () => {
  const originalWebUrl = process.env.WEB_URL;
  let prisma: PrismaService;
  let service: PasswordResetService;
  const send = jest.fn<Promise<void>, [PasswordResetMail]>();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        PasswordResetService,
        PasswordHasher,
        { provide: PasswordResetMailer, useValue: { send } },
      ],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    service = moduleFixture.get(PasswordResetService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    send.mockReset().mockResolvedValue();
    delete process.env.WEB_URL;
  });

  afterAll(async () => {
    process.env.WEB_URL = originalWebUrl;
    await prisma.onModuleDestroy();
  });

  function createAdmin(status = 'ACTIVE') {
    return prisma.adminUser.create({
      data: {
        loginId: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hashed-password',
        displayName: '관리자',
        status,
      },
    });
  }

  function sentToken(callIndex = 0): string {
    const [mail] = send.mock.calls[callIndex];
    const token = RESET_URL_PATTERN.exec(mail.resetUrl)?.[1];
    if (!token) throw new Error(`unexpected reset url: ${mail.resetUrl}`);
    return token;
  }

  it('아이디와 이메일이 일치하면 30분짜리 토큰을 저장하고 재설정 링크를 메일로 보낸다', async () => {
    const admin = await createAdmin();
    const before = Date.now();

    await service.request({ loginId: 'admin', email: 'admin@example.com' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      to: 'admin@example.com',
      expiresInMinutes: 30,
    });
    const tokens = await prisma.passwordResetToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].userId).toBe(admin.id);
    expect(tokens[0].tokenHash).toBe(hashSessionToken(sentToken()));
    expect(tokens[0].usedAt).toBeNull();
    expect(tokens[0].expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 30 * MINUTE_MS,
    );
    expect(tokens[0].expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * MINUTE_MS,
    );
  });

  it('재설정 링크는 WEB_URL을 기준으로 만든다', async () => {
    await createAdmin();
    process.env.WEB_URL = 'https://admin.example.com';

    await service.request({ loginId: 'admin', email: 'admin@example.com' });

    expect(send.mock.calls[0][0].resetUrl).toMatch(
      /^https:\/\/admin\.example\.com\/reset-password\?token=[A-Za-z0-9_-]{43}$/,
    );
  });

  it('이메일은 대소문자를 구분하지 않고 비교하며 저장된 주소로 보낸다', async () => {
    await createAdmin();

    await service.request({ loginId: 'admin', email: 'Admin@Example.COM' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('admin@example.com');
  });

  it('잠금(LOCKED) 계정에도 재설정 메일을 보낸다', async () => {
    await createAdmin('LOCKED');

    await service.request({ loginId: 'admin', email: 'admin@example.com' });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['없는 아이디', { loginId: 'unknown', email: 'admin@example.com' }],
    ['일치하지 않는 이메일', { loginId: 'admin', email: 'other@example.com' }],
  ])('%s인 경우 토큰을 만들지 않고 메일도 보내지 않는다', async (_, input) => {
    await createAdmin();

    await expect(service.request(input)).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
  });

  it.each(['INACTIVE', 'UNKNOWN'])(
    '%s 상태 계정에는 토큰을 만들지 않고 메일도 보내지 않는다',
    async (status) => {
      await createAdmin(status);

      await service.request({ loginId: 'admin', email: 'admin@example.com' });

      expect(send).not.toHaveBeenCalled();
      await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
    },
  );

  it('다시 요청하면 사용하지 않은 이전 토큰은 삭제하고 최신 토큰만 남긴다', async () => {
    await createAdmin();
    const input = { loginId: 'admin', email: 'admin@example.com' };

    await service.request(input);
    await service.request(input);

    const tokens = await prisma.passwordResetToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBe(hashSessionToken(sentToken(1)));
    expect(sentToken(0)).not.toBe(sentToken(1));
  });

  it('다시 요청해도 이미 사용한 토큰 기록은 남긴다', async () => {
    const admin = await createAdmin();
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: 'c'.repeat(64),
        userId: admin.id,
        expiresAt: new Date(),
        usedAt: new Date(),
      },
    });

    await service.request({ loginId: 'admin', email: 'admin@example.com' });

    await expect(prisma.passwordResetToken.count()).resolves.toBe(2);
  });

  it('메일 발송이 실패해도 요청은 성공으로 끝나고, 토큰 없이 오류를 로그에 남긴다', async () => {
    await createAdmin();
    send.mockRejectedValue(new Error('Resend 메일 발송 실패: rate limited'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.request({ loginId: 'admin', email: 'admin@example.com' }),
    ).resolves.toBeUndefined();
    await flushBackgroundTasks();

    expect(error).toHaveBeenCalledTimes(1);
    const logged = error.mock.calls[0].map(String).join(' ');
    expect(logged).toContain('rate limited');
    expect(logged).not.toContain(sentToken());
    error.mockRestore();
  });
});
