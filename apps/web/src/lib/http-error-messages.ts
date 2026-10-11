const SERVER_ERROR_MESSAGE = "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

const HTTP_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  400: "입력한 정보를 확인해 주세요.",
  401: "로그인이 필요합니다. 다시 로그인해 주세요.",
  403: "해당 기능에 접근할 권한이 없습니다.",
  404: "요청한 정보를 찾을 수 없습니다.",
  409: "이미 등록된 정보입니다. 다른 값을 입력해 주세요.",
  422: "입력한 정보가 올바르지 않습니다. 입력 내용을 확인해 주세요.",
  429: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  500: SERVER_ERROR_MESSAGE,
};

export function getHttpErrorMessage(status: number): string {
  return HTTP_ERROR_MESSAGES[status] ?? SERVER_ERROR_MESSAGE;
}
