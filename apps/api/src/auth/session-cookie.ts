import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'sid';

// 발급과 만료에 같은 속성을 써야 브라우저가 같은 쿠키로 인식한다.
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function readSessionToken(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;

    const raw = pair.slice(separator + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
