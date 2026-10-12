import { PrismaService } from '../src/prisma/prisma.service';

// 마이그레이션이 넣는 기준 데이터라 비우면 다시 채울 방법이 없다.
const REFERENCE_TABLES = ['roles', 'permissions', 'role_permissions'];

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const targets = tables.filter(
    ({ tablename }) => !REFERENCE_TABLES.includes(tablename),
  );
  if (targets.length === 0) return;

  const tableList = targets
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
}
