import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "./login-error-messages";

describe("getLoginErrorMessage", () => {
  it("401은 아이디·비밀번호 확인 문구를 반환한다", () => {
    expect(getLoginErrorMessage(401)).toBe("아이디 또는 비밀번호를 확인해 주세요.");
  });

  it("403은 계정 비활성화 문구를 반환한다", () => {
    expect(getLoginErrorMessage(403)).toBe(
      "현재 사용할 수 없는 계정입니다. 관리자에게 문의해 주세요.",
    );
  });

  it.each([500, 502, 503])("서버 오류(%i)는 로그인 서버 오류 문구를 반환한다", (status) => {
    expect(getLoginErrorMessage(status)).toBe(
      "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("네트워크 오류(status 없음)는 로그인 서버 오류 문구를 반환한다", () => {
    expect(getLoginErrorMessage(null)).toBe(
      "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it.each([
    [400, "입력한 정보를 확인해 주세요."],
    [422, "입력한 정보가 올바르지 않습니다. 입력 내용을 확인해 주세요."],
    [429, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."],
  ])("그 외 %i 응답은 공통 HTTP 문구를 반환한다", (status, message) => {
    expect(getLoginErrorMessage(status)).toBe(message);
  });
});
