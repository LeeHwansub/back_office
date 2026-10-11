import { describe, expect, it } from "vitest";
import { getPasswordResetConfirmErrorMessage } from "./password-reset-confirm-error-messages";

const INVALID_TOKEN =
  "재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.";
const SERVER_ERROR = "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

describe("getPasswordResetConfirmErrorMessage", () => {
  it("INVALID_RESET_TOKEN 코드면 링크 만료 문구를 돌려준다", () => {
    expect(getPasswordResetConfirmErrorMessage(400, "INVALID_RESET_TOKEN")).toBe(INVALID_TOKEN);
  });

  it("코드가 없는 400이면 입력 확인 문구를 돌려준다", () => {
    expect(getPasswordResetConfirmErrorMessage(400, null)).toBe("입력한 정보를 확인해 주세요.");
  });

  it("BAD_REQUEST 코드면 입력 확인 문구를 돌려준다", () => {
    expect(getPasswordResetConfirmErrorMessage(400, "BAD_REQUEST")).toBe(
      "입력한 정보를 확인해 주세요.",
    );
  });

  it.each([500, 503])("%i이면 서버 오류 문구를 돌려준다", (status) => {
    expect(getPasswordResetConfirmErrorMessage(status, "SERVER_ERROR")).toBe(SERVER_ERROR);
  });

  it("응답을 받지 못한 네트워크 오류(null)면 서버 오류 문구를 돌려준다", () => {
    expect(getPasswordResetConfirmErrorMessage(null, null)).toBe(SERVER_ERROR);
  });

  it("그 밖의 상태는 공통 HTTP 문구를 돌려준다", () => {
    expect(getPasswordResetConfirmErrorMessage(429, null)).toBe(
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
