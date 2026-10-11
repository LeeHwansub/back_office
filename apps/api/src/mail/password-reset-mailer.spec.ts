import { Logger } from '@nestjs/common';
import {
  createPasswordResetMailer,
  DEFAULT_MAIL_FROM,
  LogPasswordResetMailer,
  PasswordResetMail,
  ResendEmailClient,
  ResendPasswordResetMailer,
} from './password-reset-mailer';

const MAIL: PasswordResetMail = {
  to: 'admin@example.com',
  resetUrl: 'http://localhost:3000/reset-password?token=abc_DEF-123',
  expiresInMinutes: 30,
};

function fakeClient(
  result: Awaited<ReturnType<ResendEmailClient['emails']['send']>>,
) {
  const send = jest.fn().mockResolvedValue(result);
  return { client: { emails: { send } } as unknown as ResendEmailClient, send };
}

const SUCCESS = { data: { id: 'email-id' }, error: null, headers: null };

describe('ResendPasswordResetMailer', () => {
  it('보내는 주소·받는 주소·제목과 재설정 링크가 담긴 본문으로 발송한다', async () => {
    const { client, send } = fakeClient(SUCCESS);
    const mailer = new ResendPasswordResetMailer(
      client,
      'no-reply@example.com',
    );

    await mailer.send(MAIL);

    expect(send).toHaveBeenCalledTimes(1);
    const [payload] = send.mock.calls[0] as [
      { from: string; to: string; subject: string; text: string; html: string },
    ];
    expect(payload.from).toBe('no-reply@example.com');
    expect(payload.to).toBe('admin@example.com');
    expect(payload.subject).toBe('[통합 관리자 포털] 비밀번호 재설정 안내');
    expect(payload.text).toContain(MAIL.resetUrl);
    expect(payload.text).toContain('30분');
    expect(payload.html).toContain(`href="${MAIL.resetUrl}"`);
  });

  it('HTML 본문의 링크는 특수문자를 이스케이프한다', async () => {
    const { client, send } = fakeClient(SUCCESS);
    const mailer = new ResendPasswordResetMailer(client, DEFAULT_MAIL_FROM);

    await mailer.send({ ...MAIL, resetUrl: 'http://x/?a=1&b="<x>"' });

    const [payload] = send.mock.calls[0] as [{ html: string }];
    expect(payload.html).toContain('http://x/?a=1&amp;b=&quot;&lt;x&gt;&quot;');
    expect(payload.html).not.toContain('"<x>"');
  });

  it('Resend가 오류를 반환하면 예외를 던진다', async () => {
    const { client } = fakeClient({
      data: null,
      error: {
        message: 'API key is invalid',
        statusCode: 403,
        name: 'validation_error',
      },
      headers: null,
    });
    const mailer = new ResendPasswordResetMailer(client, DEFAULT_MAIL_FROM);

    await expect(mailer.send(MAIL)).rejects.toThrow(
      'Resend 메일 발송 실패: API key is invalid',
    );
  });
});

describe('LogPasswordResetMailer', () => {
  it('메일 대신 재설정 링크를 로그에 남긴다', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await new LogPasswordResetMailer().send(MAIL);

    expect(log).toHaveBeenCalledWith(expect.stringContaining(MAIL.resetUrl));
    log.mockRestore();
  });
});

describe('createPasswordResetMailer', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('RESEND_API_KEY가 없으면 로그 발송기를 쓰고 경고를 남긴다', () => {
    const mailer = createPasswordResetMailer({});

    expect(mailer).toBeInstanceOf(LogPasswordResetMailer);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('재설정 링크가 서버 로그에 기록됩니다'),
    );
  });

  it('RESEND_API_KEY가 있으면 Resend 발송기를 쓴다', () => {
    const mailer = createPasswordResetMailer({ RESEND_API_KEY: 're_test' });

    expect(mailer).toBeInstanceOf(ResendPasswordResetMailer);
    expect(warn).not.toHaveBeenCalled();
  });

  it('MAIL_FROM이 없으면 Resend 테스트 주소를 보내는 주소로 쓴다', () => {
    const mailer = createPasswordResetMailer({ RESEND_API_KEY: 're_test' });

    expect((mailer as ResendPasswordResetMailer).from).toBe(
      'onboarding@resend.dev',
    );
  });

  it('MAIL_FROM이 있으면 보내는 주소로 쓴다', () => {
    const mailer = createPasswordResetMailer({
      RESEND_API_KEY: 're_test',
      MAIL_FROM: 'no-reply@example.com',
    });

    expect((mailer as ResendPasswordResetMailer).from).toBe(
      'no-reply@example.com',
    );
  });
});
