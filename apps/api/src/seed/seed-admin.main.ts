import { Logger } from '@nestjs/common';
import { PasswordHasher } from '../auth/password-hasher';
import { PrismaService } from '../prisma/prisma.service';
import { seedAdmin, SeedAdminResult } from './seed-admin';
import { readSeedAdminConfig } from './seed-admin-config';

const logger = new Logger('SeedAdmin');

const RESULT_MESSAGES: Record<SeedAdminResult, (loginId: string) => string> = {
  created: (loginId) => `시드 관리자 계정을 생성했습니다: ${loginId}`,
  'root-assigned': (loginId) =>
    `기존 시드 관리자 계정에 ROOT 역할을 부여했습니다: ${loginId}`,
  skipped: (loginId) =>
    `같은 아이디 또는 이메일의 계정이 있어 건너뜁니다: ${loginId}`,
};

async function main(): Promise<void> {
  const config = readSeedAdminConfig(process.env);
  if (!config) {
    logger.log('시드 관리자 환경 변수가 없어 건너뜁니다.');
    return;
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  try {
    const result = await seedAdmin(prisma, new PasswordHasher(), config);
    logger.log(RESULT_MESSAGES[result](config.loginId));
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : '알 수 없는 오류');
  process.exitCode = 1;
});
