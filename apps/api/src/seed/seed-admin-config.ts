import { isEmail } from 'class-validator';

export type SeedAdminConfig = {
  loginId: string;
  email: string;
  password: string;
  displayName: string;
};

const DEFAULT_DISPLAY_NAME = '관리자';
const REQUIRED_KEYS = [
  'SEED_ADMIN_LOGIN_ID',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
] as const;
const ALL_KEYS = [...REQUIRED_KEYS, 'SEED_ADMIN_DISPLAY_NAME'] as const;

export function readSeedAdminConfig(
  env: Record<string, string | undefined>,
): SeedAdminConfig | null {
  if (ALL_KEYS.every((key) => !env[key])) return null;

  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `시드 관리자 환경 변수가 일부만 설정되었습니다. 누락: ${missing.join(', ')}`,
    );
  }

  const config: SeedAdminConfig = {
    loginId: env.SEED_ADMIN_LOGIN_ID!,
    email: env.SEED_ADMIN_EMAIL!,
    password: env.SEED_ADMIN_PASSWORD!,
    displayName: env.SEED_ADMIN_DISPLAY_NAME || DEFAULT_DISPLAY_NAME,
  };

  if (config.loginId.length > 50) {
    throw new Error('SEED_ADMIN_LOGIN_ID는 50자 이하여야 합니다.');
  }
  if (!isEmail(config.email)) {
    throw new Error('SEED_ADMIN_EMAIL이 이메일 형식이 아닙니다.');
  }
  if (config.password.length < 8 || config.password.length > 200) {
    throw new Error('SEED_ADMIN_PASSWORD는 8자 이상 200자 이하여야 합니다.');
  }
  if (config.displayName.length > 100) {
    throw new Error('SEED_ADMIN_DISPLAY_NAME은 100자 이하여야 합니다.');
  }

  return config;
}
