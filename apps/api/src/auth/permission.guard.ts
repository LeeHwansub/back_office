import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { AuthenticatedUser } from './session.service';

const REQUIRED_PERMISSION_KEY = 'requiredPermission';

export const RequirePermission = (permissionCode: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permissionCode);

// SessionGuard 다음에 실행해야 한다.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const { currentUser } = context
      .switchToHttp()
      .getRequest<{ currentUser?: AuthenticatedUser }>();
    if (!currentUser?.permissions.includes(required)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN);
    }
    return true;
  }
}
