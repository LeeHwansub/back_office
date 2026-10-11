import { Module } from '@nestjs/common';
import {
  createPasswordResetMailer,
  PasswordResetMailer,
} from './password-reset-mailer';

@Module({
  providers: [
    {
      provide: PasswordResetMailer,
      useFactory: () => createPasswordResetMailer(process.env),
    },
  ],
  exports: [PasswordResetMailer],
})
export class MailModule {}
