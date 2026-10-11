import { ERROR_MESSAGES, ErrorCode } from "@/lib/error-messages";
import { getHttpErrorMessage } from "@/lib/http-error-messages";

const LOGIN_ERROR_CODES: Readonly<Record<number, ErrorCode>> = {
  401: ErrorCode.INVALID_CREDENTIALS,
  403: ErrorCode.ACCOUNT_DISABLED,
};

/** status가 null이면 응답을 받지 못한 네트워크 오류로 본다. */
export function getLoginErrorMessage(status: number | null): string {
  if (status === null || status >= 500) return ERROR_MESSAGES[ErrorCode.LOGIN_SERVER_ERROR];
  const code = LOGIN_ERROR_CODES[status];
  return code ? ERROR_MESSAGES[code] : getHttpErrorMessage(status);
}
