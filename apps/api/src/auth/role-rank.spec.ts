import { compareRoleRank, outranks } from './role-rank';

describe('compareRoleRank', () => {
  it('상위 역할부터 정렬하고 알 수 없는 역할은 맨 뒤에 둔다', () => {
    expect(
      ['ADMIN', 'UNKNOWN', 'ROOT', 'MANAGER'].sort(compareRoleRank),
    ).toEqual(['ROOT', 'MANAGER', 'ADMIN', 'UNKNOWN']);
  });
});

describe('outranks', () => {
  it.each([
    ['ROOT', 'MANAGER'],
    ['ROOT', 'ADMIN'],
    ['MANAGER', 'ADMIN'],
  ])('%s는 %s보다 상위다', (actor, target) => {
    expect(outranks(actor, target)).toBe(true);
  });

  it.each([
    ['ROOT', 'ROOT'],
    ['MANAGER', 'MANAGER'],
    ['MANAGER', 'ROOT'],
    ['ADMIN', 'ADMIN'],
    ['ADMIN', 'MANAGER'],
    ['ADMIN', 'ROOT'],
  ])('%s는 %s보다 상위가 아니다', (actor, target) => {
    expect(outranks(actor, target)).toBe(false);
  });

  it('역할이 없는 대상은 역할이 있는 계정보다 하위다', () => {
    expect(outranks('ADMIN', null)).toBe(true);
  });

  it('역할이 없거나 알 수 없는 역할의 계정은 누구보다도 상위가 아니다', () => {
    expect(outranks(null, null)).toBe(false);
    expect(outranks(null, 'ADMIN')).toBe(false);
    expect(outranks('UNKNOWN', 'ADMIN')).toBe(false);
  });

  it('알 수 없는 역할의 대상은 어떤 계정도 다룰 수 없다', () => {
    expect(outranks('ROOT', 'UNKNOWN')).toBe(false);
  });
});
