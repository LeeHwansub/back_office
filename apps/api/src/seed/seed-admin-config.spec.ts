import { readSeedAdminConfig } from './seed-admin-config';

const VALID_ENV = {
  SEED_ADMIN_LOGIN_ID: 'admin',
  SEED_ADMIN_EMAIL: 'admin@example.com',
  SEED_ADMIN_PASSWORD: 'password1234',
};

describe('readSeedAdminConfig', () => {
  it('시드 환경 변수가 하나도 없으면 null을 반환한다', () => {
    expect(readSeedAdminConfig({})).toBeNull();
  });

  it('빈 문자열만 있으면 설정하지 않은 것으로 보고 null을 반환한다', () => {
    expect(
      readSeedAdminConfig({
        SEED_ADMIN_LOGIN_ID: '',
        SEED_ADMIN_EMAIL: '',
        SEED_ADMIN_PASSWORD: '',
        SEED_ADMIN_DISPLAY_NAME: '',
      }),
    ).toBeNull();
  });

  it('필수 값이 모두 있으면 설정을 반환하고 표시 이름 기본값은 "관리자"다', () => {
    expect(readSeedAdminConfig(VALID_ENV)).toEqual({
      loginId: 'admin',
      email: 'admin@example.com',
      password: 'password1234',
      displayName: '관리자',
    });
  });

  it('SEED_ADMIN_DISPLAY_NAME이 있으면 표시 이름으로 사용한다', () => {
    expect(
      readSeedAdminConfig({ ...VALID_ENV, SEED_ADMIN_DISPLAY_NAME: '운영팀' }),
    ).toMatchObject({ displayName: '운영팀' });
  });

  it.each([
    'SEED_ADMIN_LOGIN_ID',
    'SEED_ADMIN_EMAIL',
    'SEED_ADMIN_PASSWORD',
  ] as const)('일부만 설정되어 %s가 없으면 오류를 낸다', (key) => {
    const env: Record<string, string> = { ...VALID_ENV };
    delete env[key];

    expect(() => readSeedAdminConfig(env)).toThrow(key);
  });

  it('표시 이름만 설정되어도 필수 값 누락으로 오류를 낸다', () => {
    expect(() =>
      readSeedAdminConfig({ SEED_ADMIN_DISPLAY_NAME: '운영팀' }),
    ).toThrow('SEED_ADMIN_LOGIN_ID');
  });

  it.each([
    [
      '아이디 51자',
      { SEED_ADMIN_LOGIN_ID: 'a'.repeat(51) },
      'SEED_ADMIN_LOGIN_ID',
    ],
    [
      '이메일 형식 오류',
      { SEED_ADMIN_EMAIL: 'not-an-email' },
      'SEED_ADMIN_EMAIL',
    ],
    [
      '비밀번호 7자',
      { SEED_ADMIN_PASSWORD: 'a'.repeat(7) },
      'SEED_ADMIN_PASSWORD',
    ],
    [
      '비밀번호 201자',
      { SEED_ADMIN_PASSWORD: 'a'.repeat(201) },
      'SEED_ADMIN_PASSWORD',
    ],
    [
      '표시 이름 101자',
      { SEED_ADMIN_DISPLAY_NAME: 'a'.repeat(101) },
      'SEED_ADMIN_DISPLAY_NAME',
    ],
  ])('값이 규칙에 맞지 않으면(%s) 오류를 낸다', (_, override, key) => {
    expect(() => readSeedAdminConfig({ ...VALID_ENV, ...override })).toThrow(
      key,
    );
  });

  it('경계값(아이디 50자·비밀번호 8자와 200자·표시 이름 100자)은 통과한다', () => {
    expect(
      readSeedAdminConfig({
        ...VALID_ENV,
        SEED_ADMIN_LOGIN_ID: 'a'.repeat(50),
        SEED_ADMIN_PASSWORD: 'a'.repeat(8),
        SEED_ADMIN_DISPLAY_NAME: 'a'.repeat(100),
      }),
    ).not.toBeNull();
    expect(
      readSeedAdminConfig({
        ...VALID_ENV,
        SEED_ADMIN_PASSWORD: 'a'.repeat(200),
      }),
    ).not.toBeNull();
  });

  it('오류 메시지에 비밀번호 값을 포함하지 않는다', () => {
    const password = 'short';
    let message = '';
    try {
      readSeedAdminConfig({ ...VALID_ENV, SEED_ADMIN_PASSWORD: password });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('SEED_ADMIN_PASSWORD');
    expect(message).not.toContain(password);
  });
});
