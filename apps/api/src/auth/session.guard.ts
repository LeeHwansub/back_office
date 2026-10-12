import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { readSessionToken } from './session-cookie';
import { AuthenticatedUser, SessionService } from './session.service';

type AuthenticatedRequest = Request & { currentUser?: AuthenticatedUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.currentUser = await this.sessionService.authenticate(
      readSessionToken(request.headers.cookie),
    );
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.currentUser) {
      throw new Error('CurrentUser는 SessionGuard와 함께 사용해야 합니다.');
    }
    return request.currentUser;
  },
);
