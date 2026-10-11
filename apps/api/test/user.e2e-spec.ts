import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function userData(overrides: Partial<Prisma.UserCreateInput> = {}) {
  return {
    loginId: 'admin',
    email: 'admin@example.com',
    passwordHash: 'hashed-password',
    ...overrides,
  };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('User 모델 (e2e)', () => {
  let prisma: PrismaService;

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

  it('사용자를 저장하면 id·상태·생성/수정 시각 기본값을 채운다', async () => {
    const user = await prisma.user.create({ data: userData() });

    expect(user.id).toMatch(UUID_PATTERN);
    expect(user.status).toBe('ACTIVE');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('loginId로 사용자를 조회한다', async () => {
    await prisma.user.create({ data: userData() });

    const found = await prisma.user.findUnique({
      where: { loginId: 'admin' },
    });

    expect(found).toMatchObject({
      loginId: 'admin',
      email: 'admin@example.com',
      passwordHash: 'hashed-password',
    });
  });

  it('비활성 상태(DISABLED)로 저장할 수 있다', async () => {
    const user = await prisma.user.create({
      data: userData({ status: 'DISABLED' }),
    });

    expect(user.status).toBe('DISABLED');
  });

  it('같은 loginId는 중복 저장할 수 없다', async () => {
    await prisma.user.create({ data: userData() });

    const error = await captureError(
      prisma.user.create({
        data: userData({ email: 'other@example.com' }),
      }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('같은 email은 중복 저장할 수 없다', async () => {
    await prisma.user.create({ data: userData() });

    const error = await captureError(
      prisma.user.create({ data: userData({ loginId: 'other' }) }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });
});
