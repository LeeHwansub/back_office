import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('PrismaService (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AppModule에서 PrismaService를 주입받아 테스트 DB에 쿼리한다', async () => {
    const prisma = app.get(PrismaService);

    const rows = await prisma.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;

    expect(rows).toEqual([{ database: 'back_office_test' }]);
  });
});
