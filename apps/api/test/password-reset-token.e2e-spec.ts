import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_USER_ID = '00000000-0000-4000-8000-000000000000';
const TOKEN_HASH = 'b'.repeat(64);

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('PasswordResetToken 모델 (e2e)', () => {
  let prisma: PrismaService;
  let userId: string;
  const expiresAt = new Date('2030-01-01T00:30:00.000Z');

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

  it('토큰을 저장하면 id·생성 시각을 채우고 사용 일시는 비워 둔다', async () => {
    const token = await prisma.passwordResetToken.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    expect(token.id).toMatch(UUID_PATTERN);
    expect(token.createdAt).toBeInstanceOf(Date);
    expect(token.expiresAt).toEqual(expiresAt);
    expect(token.usedAt).toBeNull();
  });

  it('tokenHash로 토큰과 관리자를 함께 조회한다', async () => {
    await prisma.passwordResetToken.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    const found = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: TOKEN_HASH },
      include: { user: true },
    });

    expect(found?.user.loginId).toBe('admin');
  });

  it('같은 tokenHash는 중복 저장할 수 없다', async () => {
    await prisma.passwordResetToken.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    const error = await captureError(
      prisma.passwordResetToken.create({
        data: { tokenHash: TOKEN_HASH, userId, expiresAt },
      }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('존재하지 않는 관리자로는 토큰을 만들 수 없다', async () => {
    const error = await captureError(
      prisma.passwordResetToken.create({
        data: { tokenHash: TOKEN_HASH, userId: MISSING_USER_ID, expiresAt },
      }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2003');
  });

  it('관리자를 삭제하면 해당 관리자의 토큰도 삭제된다', async () => {
    await prisma.passwordResetToken.create({
      data: { tokenHash: TOKEN_HASH, userId, expiresAt },
    });

    await prisma.adminUser.delete({ where: { id: userId } });

    await expect(prisma.passwordResetToken.count()).resolves.toBe(0);
  });
});
