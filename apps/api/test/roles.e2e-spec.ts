import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashSessionToken } from '../src/auth/session-token';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

type RoleView = {
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
};

type PermissionView = {
  code: string;
  name: string;
  description: string | null;
};

const ALL_PERMISSIONS = [
  'ROLE_PERMISSION_UPDATE',
  'USER_CREATE',
  'USER_READ',
  'USER_UPDATE',
];

describe('역할·권한 API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let defaultRolePermissions: { roleId: string; permissionId: string }[];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    defaultRolePermissions = await prisma.rolePermission.findMany();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  // 역할별 권한은 테스트 DB 초기화로 비우지 않는 기준 데이터라 직접 되돌린다.
  afterEach(async () => {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany(),
      prisma.rolePermission.createMany({ data: defaultRolePermissions }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function signIn(loginId: string, roleCode?: string) {
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
    const token = `token-${loginId}`;
    await prisma.adminSession.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return `sid=${token}`;
  }

  async function permissionsOf(roleCode: string): Promise<string[]> {
    const rows = await prisma.rolePermission.findMany({
      where: { role: { code: roleCode } },
      select: { permission: { select: { code: true } } },
    });
    return rows.map(({ permission }) => permission.code).sort();
  }

  async function setPermissions(roleCode: string, codes: string[]) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: roleCode },
    });
    const permissions = await prisma.permission.findMany({
      where: { code: { in: codes } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map(({ id }) => ({
        roleId: role.id,
        permissionId: id,
      })),
    });
  }

  describe('GET /roles', () => {
    it('쿠키가 없으면 401을 반환한다', async () => {
      await request(app.getHttpServer()).get('/api/v1/roles').expect(401);
    });

    it('로그인한 계정은 역할을 순위 순서대로 권한과 함께 조회한다', async () => {
      const cookie = await signIn('admin', 'ADMIN');

      const response = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('Cookie', cookie)
        .expect(200);

      const body = response.body as RoleView[];
      expect(body.map(({ code }) => code)).toEqual([
        'ROOT',
        'MANAGER',
        'ADMIN',
      ]);
      expect(body[0]).toMatchObject({
        code: 'ROOT',
        name: '최고 관리자',
        permissions: ALL_PERMISSIONS,
      });
      expect(body[0].description).toEqual(expect.any(String));
      expect(body[2].permissions).toEqual(['USER_READ']);
    });
  });

  describe('GET /permissions', () => {
    it('쿠키가 없으면 401을 반환한다', async () => {
      await request(app.getHttpServer()).get('/api/v1/permissions').expect(401);
    });

    it('로그인한 계정은 전체 권한을 코드 순으로 조회한다', async () => {
      const cookie = await signIn('admin', 'ADMIN');

      const response = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Cookie', cookie)
        .expect(200);

      const body = response.body as PermissionView[];
      expect(body.map(({ code }) => code)).toEqual(ALL_PERMISSIONS);
      expect(body.find(({ code }) => code === 'USER_READ')).toMatchObject({
        name: '회원 목록 조회',
      });
    });
  });

  describe('PUT /roles/:code/permissions', () => {
    function putPermissions(
      roleCode: string,
      cookie: string | null,
      body: object,
    ) {
      const req = request(app.getHttpServer()).put(
        `/api/v1/roles/${roleCode}/permissions`,
      );
      return (cookie ? req.set('Cookie', cookie) : req).send(body);
    }

    it('쿠키가 없으면 401을 반환한다', async () => {
      await putPermissions('ADMIN', null, { permissionCodes: [] }).expect(401);
    });

    it('ROLE_PERMISSION_UPDATE 권한이 없으면 403을 반환한다', async () => {
      const cookie = await signIn('admin', 'ADMIN');

      const response = await putPermissions('ADMIN', cookie, {
        permissionCodes: [],
      }).expect(403);

      expect(response.body).toEqual({ code: 'FORBIDDEN' });
    });

    it('ROOT가 MANAGER 권한을 바꾸면 200과 바뀐 역할을 반환한다', async () => {
      const cookie = await signIn('root', 'ROOT');

      const response = await putPermissions('MANAGER', cookie, {
        permissionCodes: ['USER_READ', 'USER_CREATE'],
      }).expect(200);

      expect(response.body).toMatchObject({
        code: 'MANAGER',
        permissions: ['USER_CREATE', 'USER_READ'],
      });
      await expect(permissionsOf('MANAGER')).resolves.toEqual([
        'USER_CREATE',
        'USER_READ',
      ]);
    });

    it('MANAGER는 ADMIN 권한을 편집할 수 있다', async () => {
      const cookie = await signIn('manager', 'MANAGER');

      await putPermissions('ADMIN', cookie, {
        permissionCodes: ['USER_READ', 'USER_CREATE'],
      }).expect(200);

      await expect(permissionsOf('ADMIN')).resolves.toEqual([
        'USER_CREATE',
        'USER_READ',
      ]);
    });

    it('빈 목록을 보내면 역할의 권한을 모두 뺀다', async () => {
      const cookie = await signIn('root', 'ROOT');

      await putPermissions('ADMIN', cookie, { permissionCodes: [] }).expect(
        200,
      );

      await expect(permissionsOf('ADMIN')).resolves.toEqual([]);
    });

    it('바뀐 권한이 그 역할 계정의 다음 요청부터 적용된다', async () => {
      const rootCookie = await signIn('root', 'ROOT');
      const adminCookie = await signIn('admin', 'ADMIN');

      await putPermissions('ADMIN', rootCookie, {
        permissionCodes: [],
      }).expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Cookie', adminCookie)
        .expect(403);
    });

    it.each([
      ['MANAGER', 'MANAGER'],
      ['MANAGER', 'ROOT'],
      ['ROOT', 'ROOT'],
    ])(
      '%s는 같거나 상위인 %s 역할의 권한을 바꿀 수 없다',
      async (actorRole, targetRole) => {
        const cookie = await signIn('actor', actorRole);
        const before = await permissionsOf(targetRole);

        const response = await putPermissions(targetRole, cookie, {
          permissionCodes: ['USER_READ'],
        }).expect(403);

        expect(response.body).toEqual({ code: 'FORBIDDEN' });
        await expect(permissionsOf(targetRole)).resolves.toEqual(before);
      },
    );

    it('자기에게 없는 권한은 하위 역할에 새로 줄 수 없다', async () => {
      await setPermissions('MANAGER', ['USER_READ', 'ROLE_PERMISSION_UPDATE']);
      const cookie = await signIn('manager', 'MANAGER');

      const response = await putPermissions('ADMIN', cookie, {
        permissionCodes: ['USER_READ', 'USER_CREATE'],
      }).expect(403);

      expect(response.body).toEqual({ code: 'FORBIDDEN' });
      await expect(permissionsOf('ADMIN')).resolves.toEqual(['USER_READ']);
    });

    it('자기에게 없는 권한이라도 이미 있는 권한은 유지하거나 뺄 수 있다', async () => {
      await setPermissions('ADMIN', ['USER_READ', 'USER_CREATE']);
      await setPermissions('MANAGER', ['USER_READ', 'ROLE_PERMISSION_UPDATE']);
      const cookie = await signIn('manager', 'MANAGER');

      await putPermissions('ADMIN', cookie, {
        permissionCodes: ['USER_CREATE'],
      }).expect(200);
      await putPermissions('ADMIN', cookie, { permissionCodes: [] }).expect(
        200,
      );

      await expect(permissionsOf('ADMIN')).resolves.toEqual([]);
    });

    it('없는 역할이면 404를 반환한다', async () => {
      const cookie = await signIn('root', 'ROOT');

      const response = await putPermissions('UNKNOWN', cookie, {
        permissionCodes: [],
      }).expect(404);

      expect(response.body).toEqual({ code: 'NOT_FOUND' });
    });

    it.each([
      ['목록 누락', {}],
      ['배열이 아님', { permissionCodes: 'USER_READ' }],
      ['문자열이 아닌 항목', { permissionCodes: [1] }],
      ['중복 코드', { permissionCodes: ['USER_READ', 'USER_READ'] }],
      ['없는 권한 코드', { permissionCodes: ['UNKNOWN'] }],
      ['정의되지 않은 필드', { permissionCodes: [], extra: true }],
    ])('%s이면 400을 반환하고 권한을 바꾸지 않는다', async (_, body) => {
      const cookie = await signIn('root', 'ROOT');

      const response = await putPermissions('ADMIN', cookie, body).expect(400);

      expect(response.body).toEqual({ code: 'BAD_REQUEST' });
      await expect(permissionsOf('ADMIN')).resolves.toEqual(['USER_READ']);
    });
  });
});
