import { execSync } from 'node:child_process';
import { resolveTestDatabaseUrl } from './test-database';

export default function globalSetup(): void {
  const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
