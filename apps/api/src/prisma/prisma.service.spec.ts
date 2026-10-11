import { PrismaService } from './prisma.service';

const DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/back_office_unit';

describe('PrismaService', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    jest.restoreAllMocks();
  });

  it('DATABASE_URL이 없으면 생성 시 오류를 던진다', () => {
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService()).toThrow('DATABASE_URL');
  });

  it('DATABASE_URL 오류 메시지에 접속 정보를 포함하지 않는다', () => {
    process.env.DATABASE_URL = '';

    expect(() => new PrismaService()).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('postgres') as unknown,
      }) as Error,
    );
  });

  it('모듈 초기화 시 DB에 연결한다', async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    const service = new PrismaService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('모듈 종료 시 DB 연결을 끊는다', async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    const service = new PrismaService();
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
