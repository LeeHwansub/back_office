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

const USERS_PATH = '/api/v1/users';
const NEW_PASSWORD = 'newpass1234';

type UserSummary = {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  status: string;
  role: { code: string; name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
};

describe('회원 API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let hasher: PasswordHasher;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    hasher = app.get(PasswordHasher);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(loginId: string, roleCode?: string) {
    const user = await prisma.adminUser.create({
      data: {
        loginId,
        email: `${loginId}@example.com`,
        passwordHash: 'hashed-password',
        displayName: loginId,
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

  // 로그인한 계정을 만들고 그 계정의 Cookie 헤더 값을 돌려준다.
  async function signIn(loginId: string, roleCode?: string) {
    const user = await createUser(loginId, roleCode);
    const token = `token-${loginId}`;
    await prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { user, cookie: `sid=${token}` };
  }

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      loginId: 'new-user',
      password: NEW_PASSWORD,
      displayName: '새 관리자',
      email: 'new-user@example.com',
      roleCode: 'ADMIN',
      ...overrides,
    };
  }

  describe('GET /users', () => {
    it('쿠키가 없으면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get(USERS_PATH)
        .expect(401);

      expect(response.body).toEqual({ code: 'UNAUTHORIZED' });
    });

    it('USER_READ 권한이 없으면 403 FORBIDDEN을 반환한다', async () => {
      const { cookie } = await signIn('no-role');

      const response = await request(app.getHttpServer())
        .get(USERS_PATH)
        .set('Cookie', cookie)
        .expect(403);

      expect(response.body).toEqual({ code: 'FORBIDDEN' });
    });

    it('USER_READ 권한이 있으면 생성 순서대로 회원 목록을 반환한다', async () => {
      const root = await createUser('root', 'ROOT');
      const { user: admin, cookie } = await signIn('admin', 'ADMIN');

      const response = await request(app.getHttpServer())
        .get(USERS_PATH)
        .set('Cookie', cookie)
        .expect(200);

      const body = response.body as UserSummary[];
      expect(body.map(({ loginId }) => loginId)).toEqual(['root', 'admin']);
      expect(body[0]).toEqual({
        id: root.id,
        loginId: 'root',
        displayName: 'root',
        email: 'root@example.com',
        status: 'ACTIVE',
        role: { code: 'ROOT', name: '최고 관리자' },
        lastLoginAt: null,
        createdAt: root.createdAt.toISOString(),
      });
      expect(body[1].id).toBe(admin.id);
      expect(JSON.stringify(body)).not.toContain('password');
    });
  });

  describe('POST /users', () => {
    function postUser(cookie: string | null, body: object) {
      const req = request(app.getHttpServer()).post(USERS_PATH);
      return (cookie ? req.set('Cookie', cookie) : req).send(body);
    }

    it('쿠키가 없으면 401을 반환한다', async () => {
      await postUser(null, validBody()).expect(401);
      await expect(prisma.adminUser.count()).resolves.toBe(0);
    });

    it('USER_CREATE 권한이 없으면 403을 반환하고 계정을 만들지 않는다', async () => {
      const { cookie } = await signIn('admin', 'ADMIN');

      const response = await postUser(cookie, validBody()).expect(403);

      expect(response.body).toEqual({ code: 'FORBIDDEN' });
      await expect(prisma.adminUser.count()).resolves.toBe(1);
    });

    it('ROOT가 MANAGER 계정을 발급하면 201과 계정 정보를 반환한다', async () => {
      const { user: root, cookie } = await signIn('root', 'ROOT');

      const response = await postUser(
        cookie,
        validBody({ roleCode: 'MANAGER' }),
      ).expect(201);

      const body = response.body as UserSummary;
      expect(body).toMatchObject({
        loginId: 'new-user',
        displayName: '새 관리자',
        email: 'new-user@example.com',
        status: 'ACTIVE',
        role: { code: 'MANAGER', name: '중간 관리자' },
        lastLoginAt: null,
      });
      expect(JSON.stringify(body)).not.toContain('password');

      const userRole = await prisma.userRole.findFirstOrThrow({
        where: { userId: body.id },
      });
      expect(userRole.assignedBy).toBe(root.id);
    });

    it('비밀번호는 해시로 저장하고 발급한 계정으로 로그인할 수 있다', async () => {
      const { cookie } = await signIn('root', 'ROOT');
      await postUser(cookie, validBody()).expect(201);

      const created = await prisma.adminUser.findUniqueOrThrow({
        where: { loginId: 'new-user' },
      });
      expect(created.passwordHash).not.toContain(NEW_PASSWORD);
      await expect(
        hasher.verify(created.passwordHash, NEW_PASSWORD),
      ).resolves.toBe(true);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ loginId: 'new-user', password: NEW_PASSWORD })
        .expect(204);
    });

    it('MANAGER는 ADMIN 계정을 발급할 수 있다', async () => {
      const { cookie } = await signIn('manager', 'MANAGER');

      await postUser(cookie, validBody({ roleCode: 'ADMIN' })).expect(201);
    });

    it.each([
      ['MANAGER', 'MANAGER'],
      ['MANAGER', 'ROOT'],
      ['ROOT', 'ROOT'],
    ])(
      '%s는 같거나 상위인 %s 역할로 발급할 수 없다',
      async (actorRole, roleCode) => {
        const { cookie } = await signIn('actor', actorRole);

        const response = await postUser(cookie, validBody({ roleCode })).expect(
          403,
        );

        expect(response.body).toEqual({ code: 'FORBIDDEN' });
        await expect(prisma.adminUser.count()).resolves.toBe(1);
      },
    );

    it('없는 역할 코드면 400을 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');

      const response = await postUser(
        cookie,
        validBody({ roleCode: 'UNKNOWN' }),
      ).expect(400);

      expect(response.body).toEqual({ code: 'BAD_REQUEST' });
    });

    it('이미 있는 아이디면 409 DUPLICATE_LOGIN_ID를 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');
      await createUser('new-user');

      const response = await postUser(
        cookie,
        validBody({ email: 'other@example.com' }),
      ).expect(409);

      expect(response.body).toEqual({ code: 'DUPLICATE_LOGIN_ID' });
    });

    it('이미 있는 이메일이면 409 DUPLICATE_EMAIL을 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');
      await createUser('someone');

      const response = await postUser(
        cookie,
        validBody({ email: 'someone@example.com' }),
      ).expect(409);

      expect(response.body).toEqual({ code: 'DUPLICATE_EMAIL' });
    });

    it.each([
      ['아이디 누락', { loginId: undefined }],
      ['빈 아이디', { loginId: '' }],
      ['51자 아이디', { loginId: 'a'.repeat(51) }],
      ['비밀번호 누락', { password: undefined }],
      ['7자 비밀번호', { password: 'abc1234' }],
      ['숫자 없는 비밀번호', { password: 'abcdefgh' }],
      ['영문 없는 비밀번호', { password: '12345678' }],
      ['201자 비밀번호', { password: `a1${'b'.repeat(199)}` }],
      ['이름 누락', { displayName: undefined }],
      ['빈 이름', { displayName: '' }],
      ['101자 이름', { displayName: 'a'.repeat(101) }],
      ['이메일 형식 아님', { email: 'not-email' }],
      ['역할 누락', { roleCode: undefined }],
      ['정의되지 않은 필드', { status: 'INACTIVE' }],
    ])('%s이면 400을 반환한다', async (_, overrides) => {
      const { cookie } = await signIn('root', 'ROOT');

      const response = await postUser(cookie, validBody(overrides)).expect(400);

      expect(response.body).toEqual({ code: 'BAD_REQUEST' });
      await expect(prisma.adminUser.count()).resolves.toBe(1);
    });
  });
});
