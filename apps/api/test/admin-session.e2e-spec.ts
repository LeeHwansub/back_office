import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_USER_ID = '00000000-0000-4000-8000-000000000000';
const TOKEN_HASH = 'a'.repeat(64);

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('AdminSession 모델 (e2e)', () => {
  let prisma: PrismaService;
  let userId: string;
  const expiresAt = new Date('2030-01-01T00:00:00.000Z');

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

  it('세션을 저장하면 id와 생성 시각 기본값을 채운다', async () => {
    const session = await prisma.adminSession.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    expect(session.id).toMatch(UUID_PATTERN);
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.expiresAt).toEqual(expiresAt);
  });

  it('tokenHash로 세션과 관리자를 함께 조회한다', async () => {
    await prisma.adminSession.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    const found = await prisma.adminSession.findUnique({
      where: { tokenHash: TOKEN_HASH },
      include: { user: true },
    });

    expect(found?.user.loginId).toBe('admin');
  });

  it('같은 tokenHash는 중복 저장할 수 없다', async () => {
    await prisma.adminSession.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    const error = await captureError(
      prisma.adminSession.create({
        data: { tokenHash: TOKEN_HASH, userId, expiresAt },
      }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('존재하지 않는 관리자로는 세션을 만들 수 없다', async () => {
    const error = await captureError(
      prisma.adminSession.create({
        data: { tokenHash: TOKEN_HASH, userId: MISSING_USER_ID, expiresAt },
      }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
  });

  it('관리자를 삭제하면 해당 관리자의 세션도 삭제된다', async () => {
    await prisma.adminSession.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    await prisma.adminUser.delete({ where: { id: userId } });

    await expect(prisma.adminSession.count()).resolves.toBe(0);
  });
});
