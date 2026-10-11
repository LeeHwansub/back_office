import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, PasswordResetService],
})
export class AuthModule {}
