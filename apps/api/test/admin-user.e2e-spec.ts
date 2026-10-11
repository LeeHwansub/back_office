import { Test } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDatabase } from './reset-database';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type ColumnInfo = {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: 'YES' | 'NO';
};

function adminUserData(overrides: Partial<Prisma.AdminUserCreateInput> = {}) {
  return {
    loginId: 'admin',
    email: 'admin@example.com',
    passwordHash: 'hashed-password',
    displayName: '관리자',
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

describe('AdminUser 모델 (e2e)', () => {
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

  it('admin_users 테이블 컬럼이 ERD 정의(타입·길이·NULL 허용)와 일치한다', async () => {
    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
      ORDER BY column_name`;

    expect(columns).toEqual([
      {
        column_name: 'created_at',
        data_type: 'timestamp without time zone',
        character_maximum_length: null,
        is_nullable: 'NO',
      },
      {
        column_name: 'display_name',
        data_type: 'character varying',
        character_maximum_length: 100,
        is_nullable: 'NO',
      },
      {
        column_name: 'email',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'NO',
      },
      {
        column_name: 'id',
        data_type: 'uuid',
        character_maximum_length: null,
        is_nullable: 'NO',
      },
      {
        column_name: 'last_login_at',
        data_type: 'timestamp without time zone',
        character_maximum_length: null,
        is_nullable: 'YES',
      },
      {
        column_name: 'password_hash',
        data_type: 'character varying',
        character_maximum_length: 255,
        is_nullable: 'NO',
      },
      {
        column_name: 'status',
        data_type: 'character varying',
        character_maximum_length: 20,
        is_nullable: 'NO',
      },
      {
        column_name: 'updated_at',
        data_type: 'timestamp without time zone',
        character_maximum_length: null,
        is_nullable: 'NO',
      },
      {
        column_name: 'username',
        data_type: 'character varying',
        character_maximum_length: 100,
        is_nullable: 'NO',
      },
    ]);
  });

  it('SQL로 직접 저장해도 상태·생성/수정 시각 기본값을 채운다', async () => {
    await prisma.$executeRaw`
      INSERT INTO admin_users (id, username, password_hash, display_name, email)
      VALUES (gen_random_uuid(), 'admin', 'hashed-password', '관리자', 'admin@example.com')`;

    const found = await prisma.adminUser.findUniqueOrThrow({
      where: { loginId: 'admin' },
    });

    expect(found.status).toBe('ACTIVE');
    expect(found.createdAt).toBeInstanceOf(Date);
    expect(found.updatedAt).toBeInstanceOf(Date);
  });

  it('관리자를 저장하면 id·상태 기본값을 채우고 최근 로그인 일시는 비워 둔다', async () => {
    const user = await prisma.adminUser.create({ data: adminUserData() });

    expect(user.id).toMatch(UUID_PATTERN);
    expect(user.status).toBe('ACTIVE');
    expect(user.lastLoginAt).toBeNull();
  });

  it('loginId(username 컬럼)로 관리자를 조회한다', async () => {
    await prisma.adminUser.create({ data: adminUserData() });

    const found = await prisma.adminUser.findUnique({
      where: { loginId: 'admin' },
    });

    expect(found).toMatchObject({
      loginId: 'admin',
      email: 'admin@example.com',
      passwordHash: 'hashed-password',
      displayName: '관리자',
    });
  });

  it.each(['INACTIVE', 'LOCKED'])(
    '%s 상태로 저장할 수 있다',
    async (status) => {
      const user = await prisma.adminUser.create({
        data: adminUserData({ status }),
      });

      expect(user.status).toBe(status);
    },
  );

  it('같은 loginId는 중복 저장할 수 없다', async () => {
    await prisma.adminUser.create({ data: adminUserData() });

    const error = await captureError(
      prisma.adminUser.create({
        data: adminUserData({ email: 'other@example.com' }),
      }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('같은 email은 중복 저장할 수 없다', async () => {
    await prisma.adminUser.create({ data: adminUserData() });

    const error = await captureError(
      prisma.adminUser.create({ data: adminUserData({ loginId: 'other' }) }),
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });
});
