import { describe, expect, it } from "vitest";
import { getPasswordResetErrorMessage } from "./password-reset-error-messages";

const RESET_FAILED = "비밀번호 재설정 요청을 처리할 수 없습니다. 입력 정보를 확인해 주세요.";
const SERVER_ERROR = "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

describe("getPasswordResetErrorMessage", () => {
  it.each([400, 404, 422])("%i이면 재설정 요청 실패 문구를 돌려준다", (status) => {
    expect(getPasswordResetErrorMessage(status)).toBe(RESET_FAILED);
  });

  it.each([500, 502, 503])("%i이면 서버 오류 문구를 돌려준다", (status) => {
    expect(getPasswordResetErrorMessage(status)).toBe(SERVER_ERROR);
  });

  it("응답을 받지 못한 네트워크 오류(null)면 서버 오류 문구를 돌려준다", () => {
    expect(getPasswordResetErrorMessage(null)).toBe(SERVER_ERROR);
  });

  it("그 밖의 상태는 공통 HTTP 문구를 돌려준다", () => {
    expect(getPasswordResetErrorMessage(429)).toBe(
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
