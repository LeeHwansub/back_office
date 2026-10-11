import { ERROR_MESSAGES, ErrorCode } from "./error-messages";

const HTTP_ERROR_CODES: Readonly<Record<number, ErrorCode>> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  422: ErrorCode.UNPROCESSABLE,
  429: ErrorCode.TOO_MANY_REQUESTS,
  500: ErrorCode.SERVER_ERROR,
};

export function getHttpErrorMessage(status: number): string {
  return ERROR_MESSAGES[HTTP_ERROR_CODES[status] ?? ErrorCode.SERVER_ERROR];
}
