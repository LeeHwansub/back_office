import { resolveTestDatabaseUrl } from './test-database';

const DEV_URL = 'postgresql://postgres:postgres@postgres:5432/back_office';
const TEST_URL =
  'postgresql://postgres:postgres@postgres:5432/back_office_test';

describe('resolveTestDatabaseUrl', () => {
  it('TEST_DATABASE_URL을 반환한다', () => {
    expect(
      resolveTestDatabaseUrl({
        DATABASE_URL: DEV_URL,
        TEST_DATABASE_URL: TEST_URL,
      }),
    ).toBe(TEST_URL);
  });

  it('TEST_DATABASE_URL이 없으면 오류를 던진다', () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: DEV_URL })).toThrow(
      'TEST_DATABASE_URL',
    );
  });

  it('TEST_DATABASE_URL이 빈 문자열이면 오류를 던진다', () => {
    expect(() =>
      resolveTestDatabaseUrl({ DATABASE_URL: DEV_URL, TEST_DATABASE_URL: '' }),
    ).toThrow('TEST_DATABASE_URL');
  });

  it('TEST_DATABASE_URL이 DATABASE_URL과 같으면 개발 DB 보호를 위해 오류를 던진다', () => {
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL: DEV_URL,
        TEST_DATABASE_URL: DEV_URL,
      }),
    ).toThrow('DATABASE_URL');
  });

  it('오류 메시지에 DB 접속 정보를 포함하지 않는다', () => {
    let message = '';
    try {
      resolveTestDatabaseUrl({
        DATABASE_URL: DEV_URL,
        TEST_DATABASE_URL: DEV_URL,
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain('postgres:postgres');
  });
});
