import { createHash } from 'node:crypto';
import { generateSessionToken, hashSessionToken } from './session-token';

describe('세션 토큰', () => {
  it('32바이트 난수를 base64url 문자열(43자)로 만든다', () => {
    expect(generateSessionToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('매번 다른 토큰을 만든다', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it('토큰을 SHA-256 16진수 해시(64자)로 바꾼다', () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
