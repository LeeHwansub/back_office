import { PasswordHasher } from '../auth/password-hasher';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SeedAdminConfig } from './seed-admin-config';

export type SeedAdminResult = 'created' | 'root-assigned' | 'skipped';

const ROOT_ROLE_CODE = 'ROOT';

export async function seedAdmin(
  prisma: PrismaService,
  passwordHasher: PasswordHasher,
  { loginId, email, password, displayName }: SeedAdminConfig,
): Promise<SeedAdminResult> {
  const existing = await prisma.adminUser.findFirst({
    where: { OR: [{ loginId }, { email }] },
    select: { id: true, loginId: true },
  });
  if (existing) {
    if (existing.loginId !== loginId) return 'skipped';
    return (await assignRootIfVacant(prisma, existing.id))
      ? 'root-assigned'
      : 'skipped';
  }

  const rootRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROOT_ROLE_CODE },
    select: { id: true },
  });
  try {
    await prisma.adminUser.create({
      data: {
        loginId,
        email,
        displayName,
        passwordHash: await passwordHasher.hash(password),
        userRoles: { create: { roleId: rootRole.id } },
      },
    });
  } catch (error) {
    // 동시에 실행된 다른 시드가 먼저 만든 경우
    if (isUniqueViolation(error)) return 'skipped';
    throw error;
  }
  return 'created';
}

// ROOT는 한 계정만 가진다. 이미 누군가 ROOT이면 부여하지 않는다.
async function assignRootIfVacant(
  prisma: PrismaService,
  userId: string,
): Promise<boolean> {
  const rootHolder = await prisma.userRole.findFirst({
    where: { role: { code: ROOT_ROLE_CODE } },
    select: { userId: true },
  });
  if (rootHolder) return false;

  const rootRole = await prisma.role.findUniqueOrThrow({
    where: { code: ROOT_ROLE_CODE },
    select: { id: true },
  });
  try {
    await prisma.userRole.create({ data: { userId, roleId: rootRole.id } });
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
  return true;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
