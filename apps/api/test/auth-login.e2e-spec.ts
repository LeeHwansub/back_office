import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordHasher } from '../src/auth/password-hasher';
import { hashSessionToken } from '../src/auth/session-token';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const LOGIN_PATH = '/api/v1/auth/login';
const PASSWORD = 'correct-password';

function sidCookie(response: request.Response): string {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const sid = cookies.find((cookie) => cookie.startsWith('sid='));
  if (!sid) throw new Error('sid cookie not set');
  return sid;
}

function cookieValue(cookie: string): string {
  return decodeURIComponent(cookie.split(';')[0].slice('sid='.length));
}

describe('POST /api/v1/auth/login (e2e)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
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

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(async () => {
    await app.close();
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

  function postLogin(body: object) {
    return request(app.getHttpServer()).post(LOGIN_PATH).send(body);
  }

  it('로그인에 성공하면 204와 HttpOnly·SameSite=Lax sid 쿠키를 발급한다', async () => {
    await createAdmin();

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    }).expect(204);

    const cookie = sidCookie(response);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).not.toMatch(/; Secure/);
    expect(response.text).toBe('');
  });

  it('발급한 쿠키 값의 해시로 세션이 저장된다', async () => {
    await createAdmin();

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    }).expect(204);

    const tokenHash = hashSessionToken(cookieValue(sidCookie(response)));
    await expect(
      prisma.adminSession.count({ where: { tokenHash } }),
    ).resolves.toBe(1);
  });

  it('로그인 유지를 선택하지 않으면 브라우저 세션 쿠키(만료 지정 없음)로 발급한다', async () => {
    await createAdmin();

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    }).expect(204);

    const cookie = sidCookie(response);
    expect(cookie).not.toMatch(/Max-Age=/);
    expect(cookie).not.toMatch(/Expires=/);
  });

  it('로그인 유지를 선택하면 세션 만료 시각(7일 뒤)에 만료되는 쿠키로 발급한다', async () => {
    await createAdmin();
    const before = Date.now();

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: true,
    }).expect(204);

    const session = await prisma.adminSession.findFirstOrThrow();
    const expires = /; Expires=([^;]+)/.exec(sidCookie(response))?.[1];
    expect(expires).toBe(session.expiresAt.toUTCString());
    expect(session.expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it('rememberMe를 보내지 않으면 유지하지 않는 것으로 처리한다', async () => {
    await createAdmin();

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
    }).expect(204);

    expect(sidCookie(response)).not.toMatch(/Max-Age=/);
  });

  it('운영 환경에서는 Secure 쿠키로 발급한다', async () => {
    await createAdmin();
    process.env.NODE_ENV = 'production';

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    }).expect(204);

    expect(sidCookie(response)).toMatch(/; Secure/);
  });

  it('비밀번호가 틀리면 401 INVALID_CREDENTIALS이고 쿠키를 발급하지 않는다', async () => {
    await createAdmin();

    const response = await postLogin({
      loginId: 'admin',
      password: 'wrong-password',
      rememberMe: false,
    }).expect(401);

    expect(response.body).toEqual({ code: 'INVALID_CREDENTIALS' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('비활성 계정은 403 ACCOUNT_DISABLED', async () => {
    await createAdmin('INACTIVE');

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    }).expect(403);

    expect(response.body).toEqual({ code: 'ACCOUNT_DISABLED' });
  });

  it('잠금 계정은 403 ACCOUNT_LOCKED', async () => {
    await createAdmin('LOCKED');

    const response = await postLogin({
      loginId: 'admin',
      password: PASSWORD,
      rememberMe: false,
    }).expect(403);

    expect(response.body).toEqual({ code: 'ACCOUNT_LOCKED' });
  });

  it.each([
    ['loginId 누락', { password: PASSWORD }],
    ['password 누락', { loginId: 'admin' }],
    ['빈 loginId', { loginId: '', password: PASSWORD }],
    ['빈 password', { loginId: 'admin', password: '' }],
    ['51자 loginId', { loginId: 'a'.repeat(51), password: PASSWORD }],
    ['201자 password', { loginId: 'admin', password: 'a'.repeat(201) }],
    ['문자열이 아닌 loginId', { loginId: 123, password: PASSWORD }],
    [
      '불리언이 아닌 rememberMe',
      { loginId: 'admin', password: PASSWORD, rememberMe: 'yes' },
    ],
    [
      '정의되지 않은 필드',
      { loginId: 'admin', password: PASSWORD, extra: true },
    ],
  ])('입력값이 잘못되면(%s) 400 BAD_REQUEST', async (_, body) => {
    await createAdmin();

    const response = await postLogin(body).expect(400);

    expect(response.body).toEqual({ code: 'BAD_REQUEST' });
    await expect(prisma.adminSession.count()).resolves.toBe(0);
  });

  it('최대 길이(아이디 50자·비밀번호 200자)까지는 검증을 통과한다', async () => {
    const response = await postLogin({
      loginId: 'a'.repeat(50),
      password: 'a'.repeat(200),
    }).expect(401);

    expect(response.body).toEqual({ code: 'INVALID_CREDENTIALS' });
  });
});
