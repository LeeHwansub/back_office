import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  PasswordResetMail,
  PasswordResetMailer,
} from '../src/mail/password-reset-mailer';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const RESET_PATH = '/api/v1/auth/password-reset';

describe('POST /api/v1/auth/password-reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const send = jest.fn<Promise<void>, [PasswordResetMail]>();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PasswordResetMailer)
      .useValue({ send })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    send.mockReset().mockResolvedValue();
    await prisma.adminUser.create({
      data: {
        loginId: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hashed-password',
        displayName: '관리자',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function postReset(body: object) {
    return request(app.getHttpServer()).post(RESET_PATH).send(body);
  }

  it('아이디와 이메일이 일치하면 204로 응답하고 재설정 메일을 보낸다', async () => {
    const response = await postReset({
      loginId: 'admin',
      email: 'admin@example.com',
    }).expect(204);

    expect(response.text).toBe('');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('admin@example.com');
    await expect(prisma.passwordResetToken.count()).resolves.toBe(1);
  });

  it.each([
    ['없는 아이디', { loginId: 'unknown', email: 'admin@example.com' }],
    ['일치하지 않는 이메일', { loginId: 'admin', email: 'other@example.com' }],
  ])('%s도 같은 204로 응답하고 메일은 보내지 않는다', async (_, body) => {
    const response = await postReset(body).expect(204);

    expect(response.text).toBe('');
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['loginId 누락', { email: 'admin@example.com' }],
    ['email 누락', { loginId: 'admin' }],
    ['빈 loginId', { loginId: '', email: 'admin@example.com' }],
    ['51자 loginId', { loginId: 'a'.repeat(51), email: 'admin@example.com' }],
    ['이메일 형식 오류', { loginId: 'admin', email: 'not-an-email' }],
    [
      '255자 초과 이메일',
      {
        loginId: 'admin',
        email: `${'a'.repeat(64)}@${Array(4).fill('b'.repeat(46)).join('.')}.com`,
      },
    ],
    ['문자열이 아닌 email', { loginId: 'admin', email: 123 }],
    [
      '정의되지 않은 필드',
      { loginId: 'admin', email: 'admin@example.com', extra: true },
    ],
  ])('입력값이 잘못되면(%s) 400 BAD_REQUEST', async (_, body) => {
    const response = await postReset(body).expect(400);

    expect(response.body).toEqual({ code: 'BAD_REQUEST' });
    expect(send).not.toHaveBeenCalled();
  });
});
