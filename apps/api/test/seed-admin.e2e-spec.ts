import { Test } from '@nestjs/testing';
import { PasswordHasher } from '../src/auth/password-hasher';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedAdmin } from '../src/seed/seed-admin';
import { SeedAdminConfig } from '../src/seed/seed-admin-config';
import { resetDatabase } from './reset-database';

const CONFIG: SeedAdminConfig = {
  loginId: 'admin',
  email: 'admin@example.com',
  password: 'password1234',
  displayName: '관리자',
};

describe('seedAdmin (e2e)', () => {
  let prisma: PrismaService;
  const hasher = new PasswordHasher();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    prisma = moduleFixture.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('계정이 없으면 ACTIVE 관리자를 만들고 created를 반환한다', async () => {
    await expect(seedAdmin(prisma, hasher, CONFIG)).resolves.toBe('created');

    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: { loginId: 'admin' },
    });
    expect(admin).toMatchObject({
      email: 'admin@example.com',
      displayName: '관리자',
      status: 'ACTIVE',
    });
  });

  it('비밀번호는 원문이 아닌 검증 가능한 해시로 저장한다', async () => {
    await seedAdmin(prisma, hasher, CONFIG);

    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: { loginId: 'admin' },
    });
    expect(admin.passwordHash).not.toContain(CONFIG.password);
    await expect(
      hasher.verify(admin.passwordHash, CONFIG.password),
    ).resolves.toBe(true);
  });

  it('같은 아이디가 이미 있으면 바꾸지 않고 skipped를 반환한다', async () => {
    await seedAdmin(prisma, hasher, CONFIG);
    const before = await prisma.adminUser.findUniqueOrThrow({
      where: { loginId: 'admin' },
    });

    await expect(
      seedAdmin(prisma, hasher, {
        ...CONFIG,
        email: 'other@example.com',
        password: 'other-password',
      }),
    ).resolves.toBe('skipped');

    await expect(prisma.adminUser.findMany()).resolves.toEqual([before]);
  });

  it('같은 이메일이 이미 있으면 skipped를 반환한다', async () => {
    await seedAdmin(prisma, hasher, CONFIG);

    await expect(
      seedAdmin(prisma, hasher, { ...CONFIG, loginId: 'other' }),
    ).resolves.toBe('skipped');
    await expect(prisma.adminUser.count()).resolves.toBe(1);
  });
});
