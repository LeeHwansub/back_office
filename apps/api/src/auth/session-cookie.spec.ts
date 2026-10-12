import { readSessionToken } from './session-cookie';

describe('readSessionToken', () => {
  it('Cookie 헤더에서 sid 값을 읽는다', () => {
    expect(readSessionToken('sid=abc123')).toBe('abc123');
  });

  it('다른 쿠키와 섞여 있어도 sid 값만 읽는다', () => {
    expect(readSessionToken('theme=dark; sid=abc123; lang=ko')).toBe('abc123');
  });

  it('URL 인코딩된 값을 디코딩한다', () => {
    expect(readSessionToken('sid=a%2Bb')).toBe('a+b');
  });

  it('이름이 sid로 시작하는 다른 쿠키는 무시한다', () => {
    expect(readSessionToken('sid_old=zzz')).toBeNull();
  });

  it.each([
    ['헤더 없음', undefined],
    ['빈 헤더', ''],
    ['sid 없음', 'theme=dark'],
    ['빈 sid', 'sid='],
    ['디코딩할 수 없는 값', 'sid=%E0%A4%A'],
  ])('%s이면 null을 반환한다', (_, header) => {
    expect(readSessionToken(header)).toBeNull();
  });
});
