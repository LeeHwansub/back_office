import { HttpStatus, Injectable } from '@nestjs/common';
import { PasswordHasher } from '../auth/password-hasher';
import { outranks } from '../auth/role-rank';
import type { AuthenticatedUser } from '../auth/session.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type UserSummary = {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  status: string;
  role: { code: string; name: string } | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type CreateUserInput = {
  loginId: string;
  password: string;
  displayName: string;
  email: string;
  roleCode: string;
};

const USER_SUMMARY_SELECT = {
  id: true,
  loginId: true,
  displayName: true,
  email: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { select: { role: { select: { code: true, name: true } } } },
} satisfies Prisma.AdminUserSelect;

type UserSummaryRow = Prisma.AdminUserGetPayload<{
  select: typeof USER_SUMMARY_SELECT;
}>;

function toSummary({ userRoles, ...user }: UserSummaryRow): UserSummary {
  // 계정당 역할은 하나만 부여한다.
  return { ...user, role: userRoles[0]?.role ?? null };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async list(): Promise<UserSummary[]> {
    const users = await this.prisma.adminUser.findMany({
      select: USER_SUMMARY_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return users.map(toSummary);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateUserInput,
  ): Promise<UserSummary> {
    const role = await this.prisma.role.findUnique({
      where: { code: input.roleCode },
      select: { id: true, code: true },
    });
    if (!role) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST);
    }
    if (!outranks(actor.role?.code ?? null, role.code)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }

    await this.assertNotDuplicated(input.loginId, input.email);

    try {
      const user = await this.prisma.adminUser.create({
        data: {
          loginId: input.loginId,
          email: input.email,
          displayName: input.displayName,
          passwordHash: await this.passwordHasher.hash(input.password),
          userRoles: { create: { roleId: role.id, assignedBy: actor.id } },
        },
        select: USER_SUMMARY_SELECT,
      });
      return toSummary(user);
    } catch (error) {
      // 확인 직후 다른 요청이 같은 아이디·이메일로 먼저 저장한 경우
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.assertNotDuplicated(input.loginId, input.email);
      }
      throw error;
    }
  }

  private async assertNotDuplicated(
    loginId: string,
    email: string,
  ): Promise<void> {
    const existing = await this.prisma.adminUser.findFirst({
      where: { OR: [{ loginId }, { email }] },
      select: { loginId: true },
    });
    if (!existing) return;
    throw new AppException(
      HttpStatus.CONFLICT,
      existing.loginId === loginId
        ? ErrorCode.DUPLICATE_LOGIN_ID
        : ErrorCode.DUPLICATE_EMAIL,
    );
  }
}
