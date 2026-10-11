export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SERVER_ERROR: "SERVER_ERROR",

  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  LOGIN_SERVER_ERROR: "LOGIN_SERVER_ERROR",

  REQUIRED_LOGIN_ID_AND_PASSWORD: "REQUIRED_LOGIN_ID_AND_PASSWORD",
  REQUIRED_LOGIN_ID: "REQUIRED_LOGIN_ID",
  REQUIRED_PASSWORD: "REQUIRED_PASSWORD",

  REQUIRED_LOGIN_ID_AND_EMAIL: "REQUIRED_LOGIN_ID_AND_EMAIL",
  REQUIRED_EMAIL: "REQUIRED_EMAIL",
  INVALID_EMAIL_FORMAT: "INVALID_EMAIL_FORMAT",
  PASSWORD_RESET_FAILED: "PASSWORD_RESET_FAILED",

  REQUIRED_NEW_PASSWORD_AND_CONFIRM: "REQUIRED_NEW_PASSWORD_AND_CONFIRM",
  REQUIRED_NEW_PASSWORD: "REQUIRED_NEW_PASSWORD",
  REQUIRED_PASSWORD_CONFIRM: "REQUIRED_PASSWORD_CONFIRM",
  INVALID_PASSWORD_POLICY: "INVALID_PASSWORD_POLICY",
  PASSWORD_CONFIRM_MISMATCH: "PASSWORD_CONFIRM_MISMATCH",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  BAD_REQUEST: "입력한 정보를 확인해 주세요.",
  UNAUTHORIZED: "로그인이 필요합니다. 다시 로그인해 주세요.",
  FORBIDDEN: "해당 기능에 접근할 권한이 없습니다.",
  NOT_FOUND: "요청한 정보를 찾을 수 없습니다.",
  CONFLICT: "이미 등록된 정보입니다. 다른 값을 입력해 주세요.",
  UNPROCESSABLE: "입력한 정보가 올바르지 않습니다. 입력 내용을 확인해 주세요.",
  TOO_MANY_REQUESTS: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  SERVER_ERROR: "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",

  INVALID_CREDENTIALS: "아이디 또는 비밀번호를 확인해 주세요.",
  ACCOUNT_DISABLED: "현재 사용할 수 없는 계정입니다. 관리자에게 문의해 주세요.",
  LOGIN_SERVER_ERROR: "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",

  REQUIRED_LOGIN_ID_AND_PASSWORD: "아이디와 비밀번호를 모두 입력해 주세요.",
  REQUIRED_LOGIN_ID: "아이디를 입력해 주세요.",
  REQUIRED_PASSWORD: "비밀번호를 입력해 주세요.",

  REQUIRED_LOGIN_ID_AND_EMAIL: "아이디와 이메일을 모두 입력해 주세요.",
  REQUIRED_EMAIL: "이메일을 입력해 주세요.",
  INVALID_EMAIL_FORMAT: "올바른 이메일 주소를 입력해 주세요.",
  PASSWORD_RESET_FAILED: "비밀번호 재설정 요청을 처리할 수 없습니다. 입력 정보를 확인해 주세요.",

  REQUIRED_NEW_PASSWORD_AND_CONFIRM: "새 비밀번호와 비밀번호 확인을 모두 입력해 주세요.",
  REQUIRED_NEW_PASSWORD: "새 비밀번호를 입력해 주세요.",
  REQUIRED_PASSWORD_CONFIRM: "비밀번호 확인을 입력해 주세요.",
  INVALID_PASSWORD_POLICY: "비밀번호는 영문과 숫자를 포함해 8~200자로 입력해 주세요.",
  PASSWORD_CONFIRM_MISMATCH: "비밀번호가 일치하지 않습니다.",
  INVALID_RESET_TOKEN:
    "재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
};
