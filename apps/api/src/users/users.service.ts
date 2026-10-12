import { HttpStatus, Injectable } from '@nestjs/common';
import { PasswordHasher } from '../auth/password-hasher';
import { outranks } from '../auth/role-rank';
import type { AuthenticatedUser } from '../auth/session.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignableStatus } from './dto/update-user-status.dto';

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
    const role = await this.findAssignableRole(actor, input.roleCode);

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

  async updateStatus(
    actor: AuthenticatedUser,
    targetId: string,
    status: AssignableStatus,
  ): Promise<UserSummary> {
    await this.assertManageable(actor, targetId);

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.adminUser.update({
        where: { id: targetId },
        data: { status },
        select: USER_SUMMARY_SELECT,
      });
      // 비활성화된 계정은 즉시 로그아웃시킨다.
      if (status === 'INACTIVE') {
        await tx.adminSession.deleteMany({ where: { userId: targetId } });
      }
      return updated;
    });
    return toSummary(user);
  }

  async updateRole(
    actor: AuthenticatedUser,
    targetId: string,
    roleCode: string,
  ): Promise<UserSummary> {
    const role = await this.findAssignableRole(actor, roleCode);
    await this.assertManageable(actor, targetId);

    const [, , user] = await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: targetId } }),
      this.prisma.userRole.create({
        data: { userId: targetId, roleId: role.id, assignedBy: actor.id },
      }),
      this.prisma.adminUser.findUniqueOrThrow({
        where: { id: targetId },
        select: USER_SUMMARY_SELECT,
      }),
    ]);
    return toSummary(user);
  }

  // 요청한 계정보다 하위 역할만 부여할 수 있다.
  private async findAssignableRole(
    actor: AuthenticatedUser,
    roleCode: string,
  ): Promise<{ id: string }> {
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
      select: { id: true, code: true },
    });
    if (!role) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST);
    }
    if (!outranks(actor.role?.code ?? null, role.code)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }
    return role;
  }

  // 자기 자신과 같거나 상위 역할의 계정은 변경할 수 없다.
  private async assertManageable(
    actor: AuthenticatedUser,
    targetId: string,
  ): Promise<void> {
    const target = await this.prisma.adminUser.findUnique({
      where: { id: targetId },
      select: USER_SUMMARY_SELECT,
    });
    if (!target) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }
    const targetRoleCode = toSummary(target).role?.code ?? null;
    if (
      target.id === actor.id ||
      !outranks(actor.role?.code ?? null, targetRoleCode)
    ) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
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
