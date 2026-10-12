import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashSessionToken } from '../src/auth/session-token';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const MISSING_USER_ID = '00000000-0000-4000-8000-000000000000';

type UserSummary = {
  id: string;
  loginId: string;
  status: string;
  role: { code: string; name: string } | null;
};

describe('회원 상태·역할 변경 API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(
    loginId: string,
    roleCode?: string,
    status = 'ACTIVE',
  ) {
    const user = await prisma.adminUser.create({
      data: {
        loginId,
        email: `${loginId}@example.com`,
        passwordHash: 'hashed-password',
        displayName: loginId,
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

  function createSession(userId: string, token: string) {
    return prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  async function signIn(loginId: string, roleCode?: string) {
    const user = await createUser(loginId, roleCode);
    const token = `token-${loginId}`;
    await createSession(user.id, token);
    return { user, cookie: `sid=${token}` };
  }

  function patch(path: string, cookie: string | null, body: object) {
    const req = request(app.getHttpServer()).patch(`/api/v1/users/${path}`);
    return (cookie ? req.set('Cookie', cookie) : req).send(body);
  }

  async function roleCodeOf(userId: string): Promise<string[]> {
    const rows = await prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { code: true } } },
    });
    return rows.map(({ role }) => role.code);
  }

  describe('PATCH /users/:id/status', () => {
    function patchStatus(id: string, cookie: string | null, body: object) {
      return patch(`${id}/status`, cookie, body);
    }

    it('쿠키가 없으면 401을 반환한다', async () => {
      const target = await createUser('target', 'ADMIN');

      await patchStatus(target.id, null, { status: 'INACTIVE' }).expect(401);
    });

    it('USER_UPDATE 권한이 없으면 403을 반환한다', async () => {
      const { cookie } = await signIn('admin', 'ADMIN');
      const target = await createUser('target');

      const response = await patchStatus(target.id, cookie, {
        status: 'INACTIVE',
      }).expect(403);

      expect(response.body).toEqual({ code: 'FORBIDDEN' });
    });

    it('하위 역할 계정을 비활성으로 바꾸면 200과 바뀐 계정 정보를 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'MANAGER');

      const response = await patchStatus(target.id, cookie, {
        status: 'INACTIVE',
      }).expect(200);

      const body = response.body as UserSummary;
      expect(body).toMatchObject({
        id: target.id,
        loginId: 'target',
        status: 'INACTIVE',
        role: { code: 'MANAGER', name: '중간 관리자' },
      });
      await expect(
        prisma.adminUser.findUniqueOrThrow({ where: { id: target.id } }),
      ).resolves.toMatchObject({ status: 'INACTIVE' });
    });

    it('비활성으로 바꾸면 대상 계정의 세션만 모두 삭제한다', async () => {
      const { user: root, cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'ADMIN');
      await createSession(target.id, 'target-1');
      await createSession(target.id, 'target-2');

      await patchStatus(target.id, cookie, { status: 'INACTIVE' }).expect(200);

      await expect(
        prisma.adminSession.count({ where: { userId: target.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.adminSession.count({ where: { userId: root.id } }),
      ).resolves.toBe(1);
    });

    it.each(['INACTIVE', 'LOCKED'])(
      '%s 계정을 활성으로 바꾸면 ACTIVE가 된다',
      async (status) => {
        const { cookie } = await signIn('manager', 'MANAGER');
        const target = await createUser('target', 'ADMIN', status);

        const response = await patchStatus(target.id, cookie, {
          status: 'ACTIVE',
        }).expect(200);

        expect((response.body as UserSummary).status).toBe('ACTIVE');
      },
    );

    it.each([
      ['MANAGER', 'MANAGER'],
      ['MANAGER', 'ROOT'],
      ['ROOT', 'ROOT'],
    ])(
      '%s는 같거나 상위인 %s 계정의 상태를 바꿀 수 없다',
      async (actorRole, targetRole) => {
        const { cookie } = await signIn('actor', actorRole);
        const target = await createUser('target', targetRole);

        const response = await patchStatus(target.id, cookie, {
          status: 'INACTIVE',
        }).expect(403);

        expect(response.body).toEqual({ code: 'FORBIDDEN' });
        await expect(
          prisma.adminUser.findUniqueOrThrow({ where: { id: target.id } }),
        ).resolves.toMatchObject({ status: 'ACTIVE' });
      },
    );

    it('자기 자신의 상태는 바꿀 수 없다', async () => {
      const { user, cookie } = await signIn('root', 'ROOT');

      await patchStatus(user.id, cookie, { status: 'INACTIVE' }).expect(403);
    });

    it('없는 계정이면 404 NOT_FOUND를 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');

      const response = await patchStatus(MISSING_USER_ID, cookie, {
        status: 'INACTIVE',
      }).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND' });
    });

    it.each([
      ['상태 누락', {}],
      ['LOCKED로 변경', { status: 'LOCKED' }],
      ['알 수 없는 상태', { status: 'DELETED' }],
      ['정의되지 않은 필드', { status: 'INACTIVE', roleCode: 'ADMIN' }],
    ])('%s이면 400을 반환한다', async (_, body) => {
      const { cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'ADMIN');

      const response = await patchStatus(target.id, cookie, body).expect(400);

      expect(response.body).toEqual({ code: 'BAD_REQUEST' });
    });

    it('id가 UUID 형식이 아니면 400을 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');

      const response = await patchStatus('not-uuid', cookie, {
        status: 'INACTIVE',
      }).expect(400);

      expect(response.body).toEqual({ code: 'BAD_REQUEST' });
    });
  });

  describe('PATCH /users/:id/role', () => {
    function patchRole(id: string, cookie: string | null, body: object) {
      return patch(`${id}/role`, cookie, body);
    }

    it('쿠키가 없으면 401을 반환한다', async () => {
      const target = await createUser('target', 'ADMIN');

      await patchRole(target.id, null, { roleCode: 'MANAGER' }).expect(401);
    });

    it('USER_UPDATE 권한이 없으면 403을 반환한다', async () => {
      const { cookie } = await signIn('admin', 'ADMIN');
      const target = await createUser('target');

      await patchRole(target.id, cookie, { roleCode: 'ADMIN' }).expect(403);
    });

    it('ROOT가 ADMIN을 MANAGER로 바꾸면 200과 바뀐 역할을 반환하고 부여자를 기록한다', async () => {
      const { user: root, cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'ADMIN');

      const response = await patchRole(target.id, cookie, {
        roleCode: 'MANAGER',
      }).expect(200);

      expect((response.body as UserSummary).role).toEqual({
        code: 'MANAGER',
        name: '중간 관리자',
      });
      await expect(roleCodeOf(target.id)).resolves.toEqual(['MANAGER']);
      const userRole = await prisma.userRole.findFirstOrThrow({
        where: { userId: target.id },
      });
      expect(userRole.assignedBy).toBe(root.id);
    });

    it('ROOT가 MANAGER를 ADMIN으로 바꿀 수 있다', async () => {
      const { cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'MANAGER');

      await patchRole(target.id, cookie, { roleCode: 'ADMIN' }).expect(200);

      await expect(roleCodeOf(target.id)).resolves.toEqual(['ADMIN']);
    });

    it('역할이 없는 계정에 역할을 부여할 수 있다', async () => {
      const { cookie } = await signIn('manager', 'MANAGER');
      const target = await createUser('target');

      await patchRole(target.id, cookie, { roleCode: 'ADMIN' }).expect(200);

      await expect(roleCodeOf(target.id)).resolves.toEqual(['ADMIN']);
    });

    it('바뀐 역할의 권한이 다음 요청부터 바로 적용된다', async () => {
      const { cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'ADMIN');
      await createSession(target.id, 'target-token');

      await patchRole(target.id, cookie, { roleCode: 'MANAGER' }).expect(200);

      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', 'sid=target-token')
        .expect(200);
      expect((me.body as { permissions: string[] }).permissions).toContain(
        'USER_CREATE',
      );
    });

    it.each([
      ['MANAGER', 'ADMIN', 'MANAGER'],
      ['MANAGER', 'ADMIN', 'ROOT'],
      ['ROOT', 'ADMIN', 'ROOT'],
    ])(
      '%s는 %s 계정을 같거나 상위인 %s 역할로 바꿀 수 없다',
      async (actorRole, targetRole, roleCode) => {
        const { cookie } = await signIn('actor', actorRole);
        const target = await createUser('target', targetRole);

        const response = await patchRole(target.id, cookie, {
          roleCode,
        }).expect(403);

        expect(response.body).toEqual({ code: 'FORBIDDEN' });
        await expect(roleCodeOf(target.id)).resolves.toEqual([targetRole]);
      },
    );

    it.each([
      ['MANAGER', 'MANAGER'],
      ['MANAGER', 'ROOT'],
      ['ROOT', 'ROOT'],
    ])(
      '%s는 같거나 상위인 %s 계정의 역할을 바꿀 수 없다',
      async (actorRole, targetRole) => {
        const { cookie } = await signIn('actor', actorRole);
        const target = await createUser('target', targetRole);

        await patchRole(target.id, cookie, { roleCode: 'ADMIN' }).expect(403);

        await expect(roleCodeOf(target.id)).resolves.toEqual([targetRole]);
      },
    );

    it('자기 자신의 역할은 바꿀 수 없다', async () => {
      const { user, cookie } = await signIn('manager', 'MANAGER');

      await patchRole(user.id, cookie, { roleCode: 'ADMIN' }).expect(403);

      await expect(roleCodeOf(user.id)).resolves.toEqual(['MANAGER']);
    });

    it('없는 계정이면 404를 반환한다', async () => {
      const { cookie } = await signIn('root', 'ROOT');

      await patchRole(MISSING_USER_ID, cookie, { roleCode: 'ADMIN' }).expect(
        404,
      );
    });

    it.each([
      ['역할 누락', {}],
      ['빈 역할', { roleCode: '' }],
      ['없는 역할 코드', { roleCode: 'UNKNOWN' }],
      ['정의되지 않은 필드', { roleCode: 'ADMIN', status: 'INACTIVE' }],
    ])('%s이면 400을 반환한다', async (_, body) => {
      const { cookie } = await signIn('root', 'ROOT');
      const target = await createUser('target', 'MANAGER');

      const response = await patchRole(target.id, cookie, body).expect(400);

      expect(response.body).toEqual({ code: 'BAD_REQUEST' });
      await expect(roleCodeOf(target.id)).resolves.toEqual(['MANAGER']);
    });
  });
});
