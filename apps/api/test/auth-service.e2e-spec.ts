import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { PasswordHasher } from '../src/auth/password-hasher';
import { hashSessionToken } from '../src/auth/session-token';
import { AppException } from '../src/common/errors/app.exception';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const PASSWORD = 'correct-password';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('AuthService.login (e2e)', () => {
  let prisma: PrismaService;
  let authService: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [AuthService, PasswordHasher],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    authService = moduleFixture.get(AuthService);
    await prisma.onModuleInit();
    passwordHash = await moduleFixture.get(PasswordHasher).hash(PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  function createAdmin(status = 'ACTIVE') {
    return prisma.adminUser.create({
      data: {
        loginId: 'admin',
        email: 'admin@example.com',
        passwordHash,
        displayName: '관리자',
        status,
      },
    });
  }

  async function expectLoginError(
    input: { loginId: string; password: string },
    status: HttpStatus,
    code: string,
  ) {
    const error = await captureError(
      authService.login({ ...input, rememberMe: false }),
    );

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(status);
    expect((error as AppException).code).toBe(code);
    await expect(prisma.adminSession.count()).resolves.toBe(0);
  }

  it('로그인에 성공하면 원본 토큰을 반환하고 DB에는 해시만 저장한다', async () => {
    const admin = await createAdmin();

    const result = await authService.login({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    });

    const sessions = await prisma.adminSession.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].userId).toBe(admin.id);
    expect(sessions[0].tokenHash).toBe(hashSessionToken(result.token));
    expect(sessions[0].tokenHash).not.toBe(result.token);
    expect(sessions[0].expiresAt).toEqual(result.expiresAt);
  });

  it('로그인 유지를 선택하지 않으면 세션은 8시간 뒤 만료된다', async () => {
    await createAdmin();
    const before = Date.now();

    const result = await authService.login({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    });

    const after = Date.now();
    expect(result.rememberMe).toBe(false);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 8 * HOUR_MS,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 8 * HOUR_MS);
  });

  it('로그인 유지를 선택하면 세션은 7일 뒤 만료된다', async () => {
    await createAdmin();
    const before = Date.now();

    const result = await authService.login({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: true,
    });

    const after = Date.now();
    expect(result.rememberMe).toBe(true);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 7 * DAY_MS,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 7 * DAY_MS);
  });

  it('로그인에 성공하면 최근 로그인 일시를 기록한다', async () => {
    const admin = await createAdmin();
    const before = Date.now();

    await authService.login({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    });

    const updated = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
    });
    expect(updated.lastLoginAt?.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('로그인할 때마다 다른 토큰으로 새 세션을 만든다', async () => {
    await createAdmin();
    const input = { loginId: 'admin', password: PASSWORD, rememberMe: false };

    const first = await authService.login(input);
    const second = await authService.login(input);

    expect(first.token).not.toBe(second.token);
    await expect(prisma.adminSession.count()).resolves.toBe(2);
  });

  it('없는 아이디면 401 INVALID_CREDENTIALS', async () => {
    await expectLoginError(
      { loginId: 'unknown', password: PASSWORD },
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
    );
  });

  it('비밀번호가 틀리면 401 INVALID_CREDENTIALS', async () => {
    await createAdmin();

    await expectLoginError(
      { loginId: 'admin', password: 'wrong-password' },
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
    );
  });

  it('비활성(INACTIVE) 계정은 비밀번호가 맞으면 403 ACCOUNT_DISABLED', async () => {
    await createAdmin('INACTIVE');

    await expectLoginError(
      { loginId: 'admin', password: PASSWORD },
      HttpStatus.FORBIDDEN,
      'ACCOUNT_DISABLED',
    );
  });

  it('잠금(LOCKED) 계정은 비밀번호가 맞으면 403 ACCOUNT_LOCKED', async () => {
    await createAdmin('LOCKED');

    await expectLoginError(
      { loginId: 'admin', password: PASSWORD },
      HttpStatus.FORBIDDEN,
      'ACCOUNT_LOCKED',
    );
  });

  it('알 수 없는 상태값의 계정은 403 ACCOUNT_DISABLED', async () => {
    await createAdmin('UNKNOWN');

    await expectLoginError(
      { loginId: 'admin', password: PASSWORD },
      HttpStatus.FORBIDDEN,
      'ACCOUNT_DISABLED',
    );
  });

  it('비활성·잠금 계정도 비밀번호가 틀리면 상태를 드러내지 않고 401', async () => {
    await createAdmin('LOCKED');

    await expectLoginError(
      { loginId: 'admin', password: 'wrong-password' },
      HttpStatus.UNAUTHORIZED,
      'INVALID_CREDENTIALS',
    );
  });

  it('로그인에 실패하면 최근 로그인 일시를 바꾸지 않는다', async () => {
    const admin = await createAdmin('INACTIVE');

    await captureError(
      authService.login({
        loginId: 'admin',
        password: PASSWORD,
        rememberMe: false,
      }),
    );

    const unchanged = await prisma.adminUser.findUniqueOrThrow({
      where: { id: admin.id },
    });
    expect(unchanged.lastLoginAt).toBeNull();
  });
});
