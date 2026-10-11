import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

export const DEFAULT_MAIL_FROM = 'onboarding@resend.dev';
const SUBJECT = '[통합 관리자 포털] 비밀번호 재설정 안내';

export type PasswordResetMail = {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export abstract class PasswordResetMailer {
  abstract send(mail: PasswordResetMail): Promise<void>;
}

export type ResendEmailClient = { emails: Pick<Resend['emails'], 'send'> };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ResendPasswordResetMailer extends PasswordResetMailer {
  constructor(
    private readonly client: ResendEmailClient,
    readonly from: string,
  ) {
    super();
  }

  async send({ to, resetUrl, expiresInMinutes }: PasswordResetMail) {
    const notice = `링크는 ${expiresInMinutes}분 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`;
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: SUBJECT,
      text: `아래 링크에서 새 비밀번호를 설정해 주세요.\n${resetUrl}\n\n${notice}`,
      html:
        `<p>아래 링크에서 새 비밀번호를 설정해 주세요.</p>` +
        `<p><a href="${escapeHtml(resetUrl)}">비밀번호 재설정하기</a></p>` +
        `<p>${notice}</p>`,
    });
    if (error) {
      throw new Error(`Resend 메일 발송 실패: ${error.message}`);
    }
  }
}

export class LogPasswordResetMailer extends PasswordResetMailer {
  private readonly logger = new Logger(LogPasswordResetMailer.name);

  send({ resetUrl }: PasswordResetMail): Promise<void> {
    this.logger.log(`비밀번호 재설정 링크(메일 미발송): ${resetUrl}`);
    return Promise.resolve();
  }
}

export function createPasswordResetMailer(
  env: Record<string, string | undefined>,
): PasswordResetMailer {
  if (!env.RESEND_API_KEY) {
    new Logger(PasswordResetMailer.name).warn(
      'RESEND_API_KEY가 없어 메일을 보내지 않고 재설정 링크가 서버 로그에 기록됩니다.',
    );
    return new LogPasswordResetMailer();
  }
  return new ResendPasswordResetMailer(
    new Resend(env.RESEND_API_KEY),
    env.MAIL_FROM || DEFAULT_MAIL_FROM,
  );
}
