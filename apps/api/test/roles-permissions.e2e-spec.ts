import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('역할·권한 모델 (e2e)', () => {
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    await prisma.onModuleInit();
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

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  async function findRoleId(code: string): Promise<string> {
    const role = await prisma.role.findUniqueOrThrow({ where: { code } });
    return role.id;
  }

  async function permissionCodesOf(roleCode: string): Promise<string[]> {
    const rows = await prisma.rolePermission.findMany({
      where: { role: { code: roleCode } },
      select: { permission: { select: { code: true } } },
    });
    return rows.map(({ permission }) => permission.code).sort();
  }

  it('DB를 초기화해도 기본 역할 ROOT·MANAGER·ADMIN이 남아 있다', async () => {
    const roles = await prisma.role.findMany({ select: { code: true } });

    expect(roles.map(({ code }) => code).sort()).toEqual([
      'ADMIN',
      'MANAGER',
      'ROOT',
    ]);
  });

  it('DB를 초기화해도 기본 권한 4개가 남아 있다', async () => {
    const permissions = await prisma.permission.findMany({
      select: { code: true },
    });

    expect(permissions.map(({ code }) => code).sort()).toEqual([
      'ROLE_PERMISSION_UPDATE',
      'USER_CREATE',
      'USER_READ',
      'USER_UPDATE',
    ]);
  });

  it('ROOT·MANAGER는 모든 권한을, ADMIN은 회원 목록 조회 권한만 가진다', async () => {
    const all = [
      'ROLE_PERMISSION_UPDATE',
      'USER_CREATE',
      'USER_READ',
      'USER_UPDATE',
    ];

    await expect(permissionCodesOf('ROOT')).resolves.toEqual(all);
    await expect(permissionCodesOf('MANAGER')).resolves.toEqual(all);
    await expect(permissionCodesOf('ADMIN')).resolves.toEqual(['USER_READ']);
  });

  it('관리자에게 역할을 부여하면 부여 일시를 채우고 부여자는 비워 둘 수 있다', async () => {
    const userRole = await prisma.userRole.create({
      data: { userId, roleId: await findRoleId('ADMIN') },
    });

    expect(userRole.assignedAt).toBeInstanceOf(Date);
    expect(userRole.assignedBy).toBeNull();
  });

  it('같은 관리자에게 같은 역할을 중복 부여할 수 없다', async () => {
    const roleId = await findRoleId('ADMIN');
    await prisma.userRole.create({ data: { userId, roleId } });

    const error = await captureError(
      prisma.userRole.create({ data: { userId, roleId } }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('관리자를 삭제하면 해당 관리자의 역할 부여도 삭제된다', async () => {
    await prisma.userRole.create({
      data: { userId, roleId: await findRoleId('ADMIN') },
    });

    await prisma.adminUser.delete({ where: { id: userId } });

    await expect(prisma.userRole.count()).resolves.toBe(0);
  });

  it('관리자에게 부여된 역할은 삭제할 수 없다', async () => {
    const roleId = await findRoleId('ADMIN');
    await prisma.userRole.create({ data: { userId, roleId } });

    const error = await captureError(
      prisma.role.delete({ where: { id: roleId } }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(prisma.role.count({ where: { id: roleId } })).resolves.toBe(1);
  });

  it('같은 역할 코드는 중복 저장할 수 없다', async () => {
    const error = await captureError(
      prisma.role.create({ data: { code: 'ADMIN', name: '중복' } }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });
});
