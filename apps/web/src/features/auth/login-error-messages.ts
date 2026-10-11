import { getHttpErrorMessage } from "@/lib/http-error-messages";

const LOGIN_SERVER_ERROR_MESSAGE = "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

const LOGIN_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  401: "아이디 또는 비밀번호를 확인해 주세요.",
  403: "현재 사용할 수 없는 계정입니다. 관리자에게 문의해 주세요.",
};

/** status가 null이면 응답을 받지 못한 네트워크 오류로 본다. */
export function getLoginErrorMessage(status: number | null): string {
  if (status === null || status >= 500) return LOGIN_SERVER_ERROR_MESSAGE;
  return LOGIN_ERROR_MESSAGES[status] ?? getHttpErrorMessage(status);
}
