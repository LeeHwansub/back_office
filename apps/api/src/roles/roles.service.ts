import { HttpStatus, Injectable } from '@nestjs/common';
import { compareRoleRank, outranks } from '../auth/role-rank';
import type { AuthenticatedUser } from '../auth/session.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RoleView = {
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
};

export type PermissionView = {
  code: string;
  name: string;
  description: string | null;
};

const ROLE_VIEW_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  rolePermissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof ROLE_VIEW_SELECT }>;

function toView({ code, name, description, rolePermissions }: RoleRow) {
  return {
    code,
    name,
    description,
    permissions: rolePermissions
      .map(({ permission }) => permission.code)
      .sort(),
  } satisfies RoleView;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles(): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({ select: ROLE_VIEW_SELECT });
    return roles.sort((a, b) => compareRoleRank(a.code, b.code)).map(toView);
  }

  listPermissions(): Promise<PermissionView[]> {
    return this.prisma.permission.findMany({
      select: { code: true, name: true, description: true },
      orderBy: { code: 'asc' },
    });
  }

  async updatePermissions(
    actor: AuthenticatedUser,
    roleCode: string,
    permissionCodes: string[],
  ): Promise<RoleView> {
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
      select: ROLE_VIEW_SELECT,
    });
    if (!role) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND);
    }
    if (!outranks(actor.role?.code ?? null, role.code)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });
    if (permissions.length !== permissionCodes.length) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST);
    }

    // 자기에게 없는 권한은 하위 역할에 새로 줄 수 없다. 이미 있는 권한은 유지·삭제할 수 있다.
    const current = new Set(toView(role).permissions);
    const granting = permissionCodes.filter((code) => !current.has(code));
    if (granting.some((code) => !actor.permissions.includes(code))) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }

    const [, , updated] = await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map(({ id }) => ({
          roleId: role.id,
          permissionId: id,
        })),
      }),
      this.prisma.role.findUniqueOrThrow({
        where: { id: role.id },
        select: ROLE_VIEW_SELECT,
      }),
    ]);
    return toView(updated);
  }
}
