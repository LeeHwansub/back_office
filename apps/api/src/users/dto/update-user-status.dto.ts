import { IsIn } from 'class-validator';

// 잠금(LOCKED)은 시스템이 거는 상태라 관리자가 직접 지정하지 않는다.
export const ASSIGNABLE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type AssignableStatus = (typeof ASSIGNABLE_STATUSES)[number];

export class UpdateUserStatusDto {
  @IsIn(ASSIGNABLE_STATUSES)
  status!: AssignableStatus;
}
