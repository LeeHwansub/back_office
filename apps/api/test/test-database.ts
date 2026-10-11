export function resolveTestDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  const testDatabaseUrl = env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('e2e 테스트에는 TEST_DATABASE_URL이 필요합니다.');
  }
  if (testDatabaseUrl === env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL이 DATABASE_URL과 같습니다. 개발 DB를 보호하기 위해 e2e 테스트를 중단합니다.',
    );
  }
  return testDatabaseUrl;
}
