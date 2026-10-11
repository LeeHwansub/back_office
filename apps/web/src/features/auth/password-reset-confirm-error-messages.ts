import { ERROR_MESSAGES, ErrorCode } from "@/lib/error-messages";
import { getHttpErrorMessage } from "@/lib/http-error-messages";

/** status가 null이면 응답을 받지 못한 네트워크 오류로 본다. */
export function getPasswordResetConfirmErrorMessage(
  status: number | null,
  code: string | null,
): string {
  if (code === ErrorCode.INVALID_RESET_TOKEN) return ERROR_MESSAGES[ErrorCode.INVALID_RESET_TOKEN];
  if (status === null || status >= 500) return ERROR_MESSAGES[ErrorCode.SERVER_ERROR];
  return getHttpErrorMessage(status);
}
