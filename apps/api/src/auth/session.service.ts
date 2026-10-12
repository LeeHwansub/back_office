import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PrismaService } from '../prisma/prisma.service';
import { hashSessionToken } from './session-token';

export type AuthenticatedUser = {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  role: { code: string; name: string } | null;
  permissions: string[];
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(token: string | null): Promise<AuthenticatedUser> {
    if (!token) throw unauthorized();

    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            loginId: true,
            displayName: true,
            email: true,
            status: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    code: true,
                    name: true,
                    rolePermissions: {
                      select: { permission: { select: { code: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!session) throw unauthorized();

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.adminSession.deleteMany({ where: { id: session.id } });
      throw unauthorized();
    }

    const { user } = session;
    if (user.status !== 'ACTIVE') throw unauthorized();

    // 계정당 역할은 하나만 부여한다.
    const role = user.userRoles[0]?.role ?? null;
    return {
      id: user.id,
      loginId: user.loginId,
      displayName: user.displayName,
      email: user.email,
      role: role && { code: role.code, name: role.name },
      permissions: (role?.rolePermissions ?? [])
        .map(({ permission }) => permission.code)
        .sort(),
    };
  }
}

function unauthorized(): AppException {
  return new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
}
