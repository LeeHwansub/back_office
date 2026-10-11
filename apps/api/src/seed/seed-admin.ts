import { PasswordHasher } from '../auth/password-hasher';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SeedAdminConfig } from './seed-admin-config';

export type SeedAdminResult = 'created' | 'skipped';

export async function seedAdmin(
  prisma: PrismaService,
  passwordHasher: PasswordHasher,
  { loginId, email, password, displayName }: SeedAdminConfig,
): Promise<SeedAdminResult> {
  const existing = await prisma.adminUser.findFirst({
    where: { OR: [{ loginId }, { email }] },
    select: { id: true },
  });
  if (existing) return 'skipped';

  try {
    await prisma.adminUser.create({
      data: {
        loginId,
        email,
        displayName,
        passwordHash: await passwordHasher.hash(password),
      },
    });
  } catch (error) {
    // 동시에 실행된 다른 시드가 먼저 만든 경우
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return 'skipped';
    }
    throw error;
  }
  return 'created';
}
