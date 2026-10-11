import { ERROR_MESSAGES, ErrorCode } from "@/lib/error-messages";
import { getHttpErrorMessage } from "@/lib/http-error-messages";

const PASSWORD_RESET_ERROR_CODES: Readonly<Record<number, ErrorCode>> = {
  400: ErrorCode.PASSWORD_RESET_FAILED,
  404: ErrorCode.PASSWORD_RESET_FAILED,
  422: ErrorCode.PASSWORD_RESET_FAILED,
};

/** status가 null이면 응답을 받지 못한 네트워크 오류로 본다. */
export function getPasswordResetErrorMessage(status: number | null): string {
  if (status === null || status >= 500) return ERROR_MESSAGES[ErrorCode.SERVER_ERROR];
  const code = PASSWORD_RESET_ERROR_CODES[status];
  return code ? ERROR_MESSAGES[code] : getHttpErrorMessage(status);
}
