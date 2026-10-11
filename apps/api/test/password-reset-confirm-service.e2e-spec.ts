import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PasswordHasher } from '../src/auth/password-hasher';
import { PasswordResetService } from '../src/auth/password-reset.service';
import { hashSessionToken } from '../src/auth/session-token';
import { AppException } from '../src/common/errors/app.exception';
import { PasswordResetMailer } from '../src/mail/password-reset-mailer';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const OLD_PASSWORD = 'old-password1';
const NEW_PASSWORD = 'new-password2';
const TOKEN = 'reset-token';
const MINUTE_MS = 60 * 1000;

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('PasswordResetService.confirm (e2e)', () => {
  let prisma: PrismaService;
  let service: PasswordResetService;
  let hasher: PasswordHasher;
  let oldPasswordHash: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        PasswordResetService,
        PasswordHasher,
        { provide: PasswordResetMailer, useValue: { send: jest.fn() } },
      ],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    service = moduleFixture.get(PasswordResetService);
    hasher = moduleFixture.get(PasswordHasher);
    await prisma.onModuleInit();
    oldPasswordHash = await hasher.hash(OLD_PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  function createAdmin(status = 'ACTIVE', loginId = 'admin') {
    return prisma.adminUser.create({
      data: {
        loginId,
        email: `${loginId}@example.com`,
        passwordHash: oldPasswordHash,
        displayName: '관리자',
        status,
      },
    });
  }

  function createToken(
    userId: string,
    {
      token = TOKEN,
      expiresAt = new Date(Date.now() + 30 * MINUTE_MS),
      usedAt = null as Date | null,
    } = {},
  ) {
    return prisma.passwordResetToken.create({
      data: { tokenHash: hashSessionToken(token), userId, expiresAt, usedAt },
    });
  }

  async function passwordOf(userId: string) {
    const user = await prisma.adminUser.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      isNew: await hasher.verify(user.passwordHash, NEW_PASSWORD),
      isOld: await hasher.verify(user.passwordHash, OLD_PASSWORD),
      status: user.status,
    };
  }

  async function expectInvalidToken(promise: Promise<unknown>) {
    const error = await captureError(promise);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect((error as AppException).code).toBe('INVALID_RESET_TOKEN');
  }

  it('유효한 토큰이면 새 비밀번호로 바꾸고 토큰을 사용 처리한다', async () => {
    const admin = await createAdmin();
    const token = await createToken(admin.id);

    await service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD });

    await expect(passwordOf(admin.id)).resolves.toEqual({
      isNew: true,
      isOld: false,
      status: 'ACTIVE',
    });
    const used = await prisma.passwordResetToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    expect(used.usedAt).toBeInstanceOf(Date);
  });

  it('잠금(LOCKED) 계정은 비밀번호를 바꾸면 ACTIVE로 풀린다', async () => {
    const admin = await createAdmin('LOCKED');
    await createToken(admin.id);

    await service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD });

    await expect(passwordOf(admin.id)).resolves.toMatchObject({
      isNew: true,
      status: 'ACTIVE',
    });
  });

  it('비밀번호를 바꾸면 해당 관리자의 로그인 세션을 모두 삭제한다', async () => {
    const admin = await createAdmin();
    const other = await createAdmin('ACTIVE', 'other');
    const expiresAt = new Date(Date.now() + 60 * MINUTE_MS);
    await prisma.adminSession.createMany({
      data: [
        { tokenHash: 'a'.repeat(64), userId: admin.id, expiresAt },
        { tokenHash: 'b'.repeat(64), userId: admin.id, expiresAt },
        { tokenHash: 'c'.repeat(64), userId: other.id, expiresAt },
      ],
    });
    await createToken(admin.id);

    await service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD });

    await expect(
      prisma.adminSession.count({ where: { userId: admin.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.adminSession.count({ where: { userId: other.id } }),
    ).resolves.toBe(1);
  });

  it('같은 관리자의 다른 미사용 토큰은 삭제한다', async () => {
    const admin = await createAdmin();
    await createToken(admin.id);
    await createToken(admin.id, { token: 'another-token' });

    await service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD });

    const tokens = await prisma.passwordResetToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBe(hashSessionToken(TOKEN));
  });

  it('없는 토큰이면 400 INVALID_RESET_TOKEN', async () => {
    await createAdmin();

    await expectInvalidToken(
      service.confirm({ token: 'unknown', newPassword: NEW_PASSWORD }),
    );
  });

  it('만료된 토큰이면 400 INVALID_RESET_TOKEN이고 비밀번호를 바꾸지 않는다', async () => {
    const admin = await createAdmin();
    await createToken(admin.id, { expiresAt: new Date(Date.now() - 1000) });

    await expectInvalidToken(
      service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD }),
    );
    await expect(passwordOf(admin.id)).resolves.toMatchObject({ isOld: true });
  });

  it('이미 사용한 토큰이면 400 INVALID_RESET_TOKEN', async () => {
    const admin = await createAdmin();
    await createToken(admin.id, { usedAt: new Date() });

    await expectInvalidToken(
      service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD }),
    );
    await expect(passwordOf(admin.id)).resolves.toMatchObject({ isOld: true });
  });

  it.each(['INACTIVE', 'UNKNOWN'])(
    '%s 상태 계정의 토큰이면 400 INVALID_RESET_TOKEN',
    async (status) => {
      const admin = await createAdmin(status);
      await createToken(admin.id);

      await expectInvalidToken(
        service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD }),
      );
      await expect(passwordOf(admin.id)).resolves.toMatchObject({
        isOld: true,
      });
    },
  );

  it('같은 토큰으로 두 번 확정하면 두 번째는 실패한다', async () => {
    const admin = await createAdmin();
    await createToken(admin.id);

    await service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD });

    await expectInvalidToken(
      service.confirm({ token: TOKEN, newPassword: 'third-password3' }),
    );
    await expect(passwordOf(admin.id)).resolves.toMatchObject({ isNew: true });
  });

  it('같은 토큰으로 동시에 확정해도 한 번만 성공한다', async () => {
    const admin = await createAdmin();
    await createToken(admin.id);

    const results = await Promise.allSettled([
      service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD }),
      service.confirm({ token: TOKEN, newPassword: NEW_PASSWORD }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(AppException);
    expect((rejected?.reason as AppException).code).toBe('INVALID_RESET_TOKEN');
  });
});
