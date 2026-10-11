import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES, ErrorCode } from "./error-messages";

describe("ErrorCode", () => {
  it("코드 값은 키 이름과 같은 문자열이다", () => {
    for (const [key, value] of Object.entries(ErrorCode)) {
      expect(value).toBe(key);
    }
  });
});

describe("ERROR_MESSAGES", () => {
  it("모든 오류 코드에 비어 있지 않은 문구가 있다", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ERROR_MESSAGES[code].trim()).not.toBe("");
    }
  });

  it("오류 코드에 없는 문구는 두지 않는다", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(Object.values(ErrorCode).sort());
  });

  it("필수 입력 안내 문구를 제공한다", () => {
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_LOGIN_ID_AND_PASSWORD]).toBe(
      "아이디와 비밀번호를 모두 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_LOGIN_ID]).toBe("아이디를 입력해 주세요.");
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_PASSWORD]).toBe("비밀번호를 입력해 주세요.");
  });

  it("로그인 전용 문구를 제공한다", () => {
    expect(ERROR_MESSAGES[ErrorCode.INVALID_CREDENTIALS]).toBe(
      "아이디 또는 비밀번호를 확인해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.ACCOUNT_DISABLED]).toBe(
      "현재 사용할 수 없는 계정입니다. 관리자에게 문의해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.LOGIN_SERVER_ERROR]).toBe(
      "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("비밀번호 찾기 문구를 제공한다", () => {
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_LOGIN_ID_AND_EMAIL]).toBe(
      "아이디와 이메일을 모두 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_EMAIL]).toBe("이메일을 입력해 주세요.");
    expect(ERROR_MESSAGES[ErrorCode.INVALID_EMAIL_FORMAT]).toBe(
      "올바른 이메일 주소를 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.PASSWORD_RESET_FAILED]).toBe(
      "비밀번호 재설정 요청을 처리할 수 없습니다. 입력 정보를 확인해 주세요.",
    );
  });

  it("새 비밀번호 설정 문구를 제공한다", () => {
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_NEW_PASSWORD_AND_CONFIRM]).toBe(
      "새 비밀번호와 비밀번호 확인을 모두 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_NEW_PASSWORD]).toBe("새 비밀번호를 입력해 주세요.");
    expect(ERROR_MESSAGES[ErrorCode.REQUIRED_PASSWORD_CONFIRM]).toBe(
      "비밀번호 확인을 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.INVALID_PASSWORD_POLICY]).toBe(
      "비밀번호는 영문과 숫자를 포함해 8~200자로 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.PASSWORD_CONFIRM_MISMATCH]).toBe(
      "비밀번호가 일치하지 않습니다.",
    );
    expect(ERROR_MESSAGES[ErrorCode.INVALID_RESET_TOKEN]).toBe(
      "재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
    );
  });

  it("공통 HTTP 오류 문구를 제공한다", () => {
    expect(ERROR_MESSAGES[ErrorCode.BAD_REQUEST]).toBe("입력한 정보를 확인해 주세요.");
    expect(ERROR_MESSAGES[ErrorCode.UNAUTHORIZED]).toBe(
      "로그인이 필요합니다. 다시 로그인해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.FORBIDDEN]).toBe("해당 기능에 접근할 권한이 없습니다.");
    expect(ERROR_MESSAGES[ErrorCode.NOT_FOUND]).toBe("요청한 정보를 찾을 수 없습니다.");
    expect(ERROR_MESSAGES[ErrorCode.CONFLICT]).toBe(
      "이미 등록된 정보입니다. 다른 값을 입력해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.UNPROCESSABLE]).toBe(
      "입력한 정보가 올바르지 않습니다. 입력 내용을 확인해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.TOO_MANY_REQUESTS]).toBe(
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(ERROR_MESSAGES[ErrorCode.SERVER_ERROR]).toBe(
      "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});
