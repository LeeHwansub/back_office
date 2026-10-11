import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('비밀번호를 원문이 아닌 argon2id 해시로 만든다', async () => {
    const hash = await hasher.hash('correct-password');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct-password');
  });

  it('같은 비밀번호도 매번 다른 해시를 만든다', async () => {
    const first = await hasher.hash('correct-password');
    const second = await hasher.hash('correct-password');

    expect(first).not.toBe(second);
  });

  it('올바른 비밀번호면 true를 반환한다', async () => {
    const hash = await hasher.hash('correct-password');

    await expect(hasher.verify(hash, 'correct-password')).resolves.toBe(true);
  });

  it('틀린 비밀번호면 false를 반환한다', async () => {
    const hash = await hasher.hash('correct-password');

    await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('해시 형식이 잘못되면 오류 없이 false를 반환한다', async () => {
    await expect(hasher.verify('not-a-hash', 'any-password')).resolves.toBe(
      false,
    );
  });

  it('계정이 없을 때 쓰는 가짜 검증은 항상 false를 반환한다', async () => {
    await expect(hasher.verifyAgainstDummy('any-password')).resolves.toBe(
      false,
    );
  });
});
