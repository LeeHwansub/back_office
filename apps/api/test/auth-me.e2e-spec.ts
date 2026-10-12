import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordHasher } from '../src/auth/password-hasher';
import { hashSessionToken } from '../src/auth/session-token';
import type { AuthenticatedUser } from '../src/auth/session.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const ME_PATH = '/api/v1/auth/me';
const PASSWORD = 'correct-password';
const TOKEN = 'session-token';

describe('GET /api/v1/auth/me (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordHash: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await app.get(PasswordHasher).hash(PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createAdmin({
    status = 'ACTIVE',
    roleCode,
  }: { status?: string; roleCode?: string } = {}) {
    const user = await prisma.adminUser.create({
      data: {
        loginId: 'admin',
        email: 'admin@example.com',
        passwordHash,
        displayName: '관리자',
        status,
      },
    });
    if (roleCode) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: roleCode },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
    }
    return user;
  }

  function createSession(
    userId: string,
    expiresAt = new Date(Date.now() + 60 * 60 * 1000),
  ) {
    return prisma.adminSession.create({
      data: { tokenHash: hashSessionToken(TOKEN), userId, expiresAt },
    });
  }

  function bodyOf(response: request.Response): AuthenticatedUser {
    return response.body as AuthenticatedUser;
  }

  function getMe(cookie?: string) {
    const req = request(app.getHttpServer()).get(ME_PATH);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  it('세션이 유효하면 200과 계정·역할·권한 정보를 반환한다', async () => {
    const user = await createAdmin({ roleCode: 'ADMIN' });
    await createSession(user.id);

    const response = await getMe(`sid=${TOKEN}`).expect(200);

    expect(response.body).toEqual({
      id: user.id,
      loginId: 'admin',
      displayName: '관리자',
      email: 'admin@example.com',
      role: { code: 'ADMIN', name: '일반 관리자' },
      permissions: ['USER_READ'],
    });
  });

  it('ROOT 계정은 모든 권한을 정렬해 반환한다', async () => {
    const user = await createAdmin({ roleCode: 'ROOT' });
    await createSession(user.id);

    const response = await getMe(`sid=${TOKEN}`).expect(200);

    expect(bodyOf(response).role).toEqual({
      code: 'ROOT',
      name: '최고 관리자',
    });
    expect(bodyOf(response).permissions).toEqual([
      'ROLE_PERMISSION_UPDATE',
      'USER_CREATE',
      'USER_READ',
      'USER_UPDATE',
    ]);
  });

  it('역할이 없는 계정은 role null, 빈 권한 목록을 반환한다', async () => {
    const user = await createAdmin();
    await createSession(user.id);

    const response = await getMe(`sid=${TOKEN}`).expect(200);

    expect(bodyOf(response).role).toBeNull();
    expect(bodyOf(response).permissions).toEqual([]);
  });

  it('응답에 비밀번호 해시를 포함하지 않는다', async () => {
    const user = await createAdmin();
    await createSession(user.id);

    const response = await getMe(`sid=${TOKEN}`).expect(200);

    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain(passwordHash);
  });

  it('로그인으로 받은 쿠키로 조회할 수 있다', async () => {
    await createAdmin();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ loginId: 'admin', password: PASSWORD, rememberMe: false })
      .expect(204);
    const cookies = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    const sid = cookies.find((cookie) => cookie.startsWith('sid='));

    const response = await getMe(sid?.split(';')[0]).expect(200);

    expect(bodyOf(response).loginId).toBe('admin');
  });

  it('쿠키가 없으면 401 UNAUTHORIZED를 반환한다', async () => {
    const response = await getMe().expect(401);

    expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
  });

  it('저장되지 않은 토큰이면 401을 반환한다', async () => {
    const user = await createAdmin();
    await createSession(user.id);

    const response = await getMe('sid=unknown-token').expect(401);

    expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
  });

  it('만료된 세션이면 401을 반환하고 세션을 삭제한다', async () => {
    const user = await createAdmin();
    await createSession(user.id, new Date(Date.now() - 1000));

    const response = await getMe(`sid=${TOKEN}`).expect(401);

    expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
    await expect(prisma.adminSession.count()).resolves.toBe(0);
  });

  it.each(['INACTIVE', 'LOCKED'])(
    '%s 계정의 세션이면 401을 반환한다',
    async (status) => {
      const user = await createAdmin({ status });
      await createSession(user.id);

      const response = await getMe(`sid=${TOKEN}`).expect(401);

      expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
    },
  );
});
