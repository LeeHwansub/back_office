import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordHasher } from '../src/auth/password-hasher';
import { hashSessionToken } from '../src/auth/session-token';
import { PasswordResetMailer } from '../src/mail/password-reset-mailer';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const CONFIRM_PATH = '/api/v1/auth/password-reset/confirm';
const LOGIN_PATH = '/api/v1/auth/login';
const OLD_PASSWORD = 'old-password1';
const NEW_PASSWORD = 'new-password2';
const TOKEN = 'reset-token';

describe('POST /api/v1/auth/password-reset/confirm (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let oldPasswordHash: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PasswordResetMailer)
      .useValue({ send: jest.fn() })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    oldPasswordHash = await app.get(PasswordHasher).hash(OLD_PASSWORD);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const admin = await prisma.adminUser.create({
      data: {
        loginId: 'admin',
        email: 'admin@example.com',
        passwordHash: oldPasswordHash,
        displayName: '관리자',
      },
    });
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashSessionToken(TOKEN),
        userId: admin.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function postConfirm(body: object) {
    return request(app.getHttpServer()).post(CONFIRM_PATH).send(body);
  }

  function postLogin(password: string) {
    return request(app.getHttpServer())
      .post(LOGIN_PATH)
      .send({ loginId: 'admin', password });
  }

  it('유효한 토큰이면 204로 응답하고 새 비밀번호로만 로그인할 수 있다', async () => {
    const response = await postConfirm({
      token: TOKEN,
      newPassword: NEW_PASSWORD,
    }).expect(204);

    expect(response.text).toBe('');
    await postLogin(NEW_PASSWORD).expect(204);
    await postLogin(OLD_PASSWORD).expect(401);
  });

  it('같은 토큰을 다시 쓰면 400 INVALID_RESET_TOKEN', async () => {
    await postConfirm({ token: TOKEN, newPassword: NEW_PASSWORD }).expect(204);

    const response = await postConfirm({
      token: TOKEN,
      newPassword: 'third-password3',
    }).expect(400);

    expect(response.body).toEqual({ code: 'INVALID_RESET_TOKEN' });
  });

  it('없는 토큰이면 400 INVALID_RESET_TOKEN', async () => {
    const response = await postConfirm({
      token: 'unknown-token',
      newPassword: NEW_PASSWORD,
    }).expect(400);

    expect(response.body).toEqual({ code: 'INVALID_RESET_TOKEN' });
  });

  it.each([
    ['token 누락', { newPassword: NEW_PASSWORD }],
    ['빈 token', { token: '', newPassword: NEW_PASSWORD }],
    ['101자 token', { token: 'a'.repeat(101), newPassword: NEW_PASSWORD }],
    ['newPassword 누락', { token: TOKEN }],
    ['7자 비밀번호', { token: TOKEN, newPassword: 'abcdef1' }],
    ['201자 비밀번호', { token: TOKEN, newPassword: `${'a'.repeat(200)}1` }],
    ['숫자 없는 비밀번호', { token: TOKEN, newPassword: 'abcdefgh' }],
    ['영문 없는 비밀번호', { token: TOKEN, newPassword: '12345678' }],
    ['문자열이 아닌 비밀번호', { token: TOKEN, newPassword: 12345678 }],
    [
      '정의되지 않은 필드',
      { token: TOKEN, newPassword: NEW_PASSWORD, extra: true },
    ],
  ])('입력값이 잘못되면(%s) 400 BAD_REQUEST', async (_, body) => {
    const response = await postConfirm(body).expect(400);

    expect(response.body).toEqual({ code: 'BAD_REQUEST' });
    await postLogin(OLD_PASSWORD).expect(204);
  });

  it.each([
    ['8자', 'abcdefg1'],
    ['200자', `${'a'.repeat(199)}1`],
    ['특수문자·한글 포함', '새비밀번호!pw1'],
  ])('비밀번호 규칙 경계값(%s)은 통과한다', async (_, newPassword) => {
    await postConfirm({ token: TOKEN, newPassword }).expect(204);
  });
});
