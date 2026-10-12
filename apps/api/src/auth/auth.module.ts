import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { PasswordResetService } from './password-reset.service';
import { PermissionGuard } from './permission.guard';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    PasswordResetService,
    SessionService,
    SessionGuard,
    PermissionGuard,
  ],
  exports: [PasswordHasher, SessionService, SessionGuard, PermissionGuard],
})
export class AuthModule {}
