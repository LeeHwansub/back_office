import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashSessionToken } from '../src/auth/session-token';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const LOGOUT_PATH = '/api/v1/auth/logout';
const TOKEN = 'session-token';
const OTHER_TOKEN = 'other-session-token';

function sidCookie(response: request.Response): string {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const sid = cookies.find((cookie) => cookie.startsWith('sid='));
  if (!sid) throw new Error('sid cookie not set');
  return sid;
}

describe('POST /api/v1/auth/logout (e2e)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.adminUser.create({
      data: {
        loginId: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hashed-password',
        displayName: '관리자',
      },
    });
    userId = user.id;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(async () => {
    await app.close();
  });

  function createSession(token: string) {
    return prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  function postLogout(cookie?: string) {
    const req = request(app.getHttpServer()).post(LOGOUT_PATH);
    return cookie ? req.set('Cookie', cookie) : req;
  }

  it('로그아웃하면 204를 반환하고 해당 세션을 삭제한다', async () => {
    await createSession(TOKEN);

    const response = await postLogout(`sid=${TOKEN}`).expect(204);

    expect(response.text).toBe('');
    await expect(
      prisma.adminSession.count({
        where: { tokenHash: hashSessionToken(TOKEN) },
      }),
    ).resolves.toBe(0);
  });

  it('같은 계정의 다른 세션은 삭제하지 않는다', async () => {
    await createSession(TOKEN);
    await createSession(OTHER_TOKEN);

    await postLogout(`sid=${TOKEN}`).expect(204);

    await expect(
      prisma.adminSession.findMany({ select: { tokenHash: true } }),
    ).resolves.toEqual([{ tokenHash: hashSessionToken(OTHER_TOKEN) }]);
  });

  it('브라우저의 sid 쿠키를 같은 속성으로 만료시킨다', async () => {
    await createSession(TOKEN);

    const response = await postLogout(`sid=${TOKEN}`).expect(204);

    const cookie = sidCookie(response);
    expect(cookie).toMatch(/^sid=;/);
    expect(cookie).toMatch(/; Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).not.toMatch(/; Secure/);
  });

  it('운영 환경에서는 Secure 속성으로 쿠키를 만료시킨다', async () => {
    process.env.NODE_ENV = 'production';

    const response = await postLogout(`sid=${TOKEN}`).expect(204);

    expect(sidCookie(response)).toMatch(/; Secure/);
  });

  it('쿠키가 없어도 204를 반환하고 쿠키를 만료시킨다', async () => {
    const response = await postLogout().expect(204);

    expect(sidCookie(response)).toMatch(/^sid=;/);
  });

  it('저장되지 않은 토큰이어도 204를 반환하고 다른 세션은 그대로 둔다', async () => {
    await createSession(OTHER_TOKEN);

    await postLogout('sid=unknown-token').expect(204);

    await expect(prisma.adminSession.count()).resolves.toBe(1);
  });

  it('로그아웃한 쿠키로는 현재 계정을 조회할 수 없다', async () => {
    await createSession(TOKEN);
    await postLogout(`sid=${TOKEN}`).expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `sid=${TOKEN}`)
      .expect(401);
  });
});
