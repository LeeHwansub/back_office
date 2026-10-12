// 숫자가 작을수록 상위 역할이다. roles 테이블에는 순위 컬럼이 없어 코드로 관리한다.
const ROLE_RANK: Readonly<Record<string, number>> = {
  ROOT: 0,
  MANAGER: 1,
  ADMIN: 2,
};

const NO_ROLE_RANK = Number.POSITIVE_INFINITY;

function rankOf(roleCode: string | null): number | undefined {
  return roleCode === null ? NO_ROLE_RANK : ROLE_RANK[roleCode];
}

// 행위자가 대상 역할보다 엄격하게 상위일 때만 true다.
export function outranks(
  actorRoleCode: string | null,
  targetRoleCode: string | null,
): boolean {
  if (actorRoleCode === null) return false;
  const actorRank = rankOf(actorRoleCode);
  const targetRank = rankOf(targetRoleCode);
  if (actorRank === undefined || targetRank === undefined) return false;
  return actorRank < targetRank;
}
