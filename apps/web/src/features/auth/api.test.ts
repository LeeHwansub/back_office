import type { AxiosRequestConfig } from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { httpClient } from "@/lib/http-client";
import {
  confirmPasswordReset,
  login,
  LoginError,
  PasswordResetConfirmError,
  PasswordResetError,
  requestPasswordReset,
} from "./api";

const request = { loginId: "admin", password: "secret", rememberMe: false };

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(httpClient);
});

afterEach(() => {
  mock.restore();
});

function captureRequest(url: string, status = 204) {
  const requests: AxiosRequestConfig[] = [];
  mock.onPost(url).reply((config) => {
    requests.push(config);
    return [status];
  });
  return requests;
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected promise to reject");
}

describe("login", () => {
  const url = "/api/v1/auth/login";

  it("POST /api/v1/auth/login 으로 쿠키를 포함해 JSON 요청을 보낸다", async () => {
    const requests = captureRequest(url);

    await login(request);

    expect(requests).toHaveLength(1);
    expect(requests[0].withCredentials).toBe(true);
    expect(requests[0].headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(requests[0].data as string)).toEqual(request);
  });

  it("2xx 응답이면 오류 없이 완료한다", async () => {
    mock.onPost(url).reply(200, {});

    await expect(login(request)).resolves.toBeUndefined();
  });

  it.each([400, 401, 403, 422, 429, 500, 503])(
    "%i 응답이면 상태 코드와 로그인 문구를 담은 LoginError를 던진다",
    async (status) => {
      mock.onPost(url).reply(status);

      const error = await captureError(login(request));

      expect(error).toBeInstanceOf(LoginError);
      expect((error as LoginError).status).toBe(status);
    },
  );

  it("LoginError의 message는 로그인 화면용 문구다", async () => {
    mock.onPost(url).reply(401);

    const error = await captureError(login(request));

    expect((error as LoginError).message).toBe(
      "아이디 또는 비밀번호를 확인해 주세요.",
    );
  });

  it.each([
    ["네트워크 오류", () => mock.onPost(url).networkError()],
    ["시간 초과", () => mock.onPost(url).timeout()],
  ])("%s면 status가 null인 LoginError를 던진다", async (_, arrange) => {
    arrange();

    const error = await captureError(login(request));

    expect(error).toBeInstanceOf(LoginError);
    expect((error as LoginError).status).toBeNull();
    expect((error as LoginError).message).toBe(
      "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("오류 메시지에 입력한 비밀번호를 포함하지 않는다", async () => {
    mock.onPost(url).reply(500);

    const error = await captureError(login(request));

    expect((error as LoginError).message).not.toContain(request.password);
  });
});

describe("requestPasswordReset", () => {
  const url = "/api/v1/auth/password-reset";
  const resetRequest = { loginId: "admin", email: "admin@example.com" };

  it("POST /api/v1/auth/password-reset 으로 쿠키를 포함해 JSON 요청을 보낸다", async () => {
    const requests = captureRequest(url);

    await requestPasswordReset(resetRequest);

    expect(requests).toHaveLength(1);
    expect(requests[0].withCredentials).toBe(true);
    expect(requests[0].headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(requests[0].data as string)).toEqual(resetRequest);
  });

  it("2xx 응답이면 오류 없이 완료한다", async () => {
    mock.onPost(url).reply(200, {});

    await expect(requestPasswordReset(resetRequest)).resolves.toBeUndefined();
  });

  it.each([400, 404, 422, 429, 500])(
    "%i 응답이면 상태 코드를 담은 PasswordResetError를 던진다",
    async (status) => {
      mock.onPost(url).reply(status);

      const error = await captureError(requestPasswordReset(resetRequest));

      expect(error).toBeInstanceOf(PasswordResetError);
      expect((error as PasswordResetError).status).toBe(status);
    },
  );

  it("PasswordResetError의 message는 비밀번호 찾기 화면용 문구다", async () => {
    mock.onPost(url).reply(404);

    const error = await captureError(requestPasswordReset(resetRequest));

    expect((error as PasswordResetError).message).toBe(
      "비밀번호 재설정 요청을 처리할 수 없습니다. 입력 정보를 확인해 주세요.",
    );
  });

  it.each([
    ["네트워크 오류", () => mock.onPost(url).networkError()],
    ["시간 초과", () => mock.onPost(url).timeout()],
  ])("%s면 status가 null인 PasswordResetError를 던진다", async (_, arrange) => {
    arrange();

    const error = await captureError(requestPasswordReset(resetRequest));

    expect(error).toBeInstanceOf(PasswordResetError);
    expect((error as PasswordResetError).status).toBeNull();
    expect((error as PasswordResetError).message).toBe(
      "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});

describe("confirmPasswordReset", () => {
  const url = "/api/v1/auth/password-reset/confirm";
  const confirmRequest = { token: "reset-token", newPassword: "new-password1" };

  it("POST /api/v1/auth/password-reset/confirm 으로 쿠키를 포함해 JSON 요청을 보낸다", async () => {
    const requests = captureRequest(url);

    await confirmPasswordReset(confirmRequest);

    expect(requests).toHaveLength(1);
    expect(requests[0].withCredentials).toBe(true);
    expect(requests[0].headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(requests[0].data as string)).toEqual(confirmRequest);
  });

  it("2xx 응답이면 오류 없이 완료한다", async () => {
    mock.onPost(url).reply(204);

    await expect(confirmPasswordReset(confirmRequest)).resolves.toBeUndefined();
  });

  it("오류 응답 본문의 code를 담은 PasswordResetConfirmError를 던진다", async () => {
    mock.onPost(url).reply(400, { code: "INVALID_RESET_TOKEN" });

    const error = await captureError(confirmPasswordReset(confirmRequest));

    expect(error).toBeInstanceOf(PasswordResetConfirmError);
    expect((error as PasswordResetConfirmError).status).toBe(400);
    expect((error as PasswordResetConfirmError).code).toBe(
      "INVALID_RESET_TOKEN",
    );
    expect((error as PasswordResetConfirmError).message).toBe(
      "재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
    );
  });

  it.each([
    ["본문 없음", 500, undefined],
    ["JSON이 아닌 본문", 502, "<html>"],
    ["code가 문자열이 아닌 본문", 400, { code: 1 }],
  ])(
    "%s이면 code가 null인 PasswordResetConfirmError를 던진다",
    async (_, status, body) => {
      mock.onPost(url).reply(status, body);

      const error = await captureError(confirmPasswordReset(confirmRequest));

      expect(error).toBeInstanceOf(PasswordResetConfirmError);
      expect((error as PasswordResetConfirmError).status).toBe(status);
      expect((error as PasswordResetConfirmError).code).toBeNull();
    },
  );

  it.each([
    ["네트워크 오류", () => mock.onPost(url).networkError()],
    ["시간 초과", () => mock.onPost(url).timeout()],
  ])(
    "%s면 status와 code가 null인 PasswordResetConfirmError를 던진다",
    async (_, arrange) => {
      arrange();

      const error = await captureError(confirmPasswordReset(confirmRequest));

      expect(error).toBeInstanceOf(PasswordResetConfirmError);
      expect((error as PasswordResetConfirmError).status).toBeNull();
      expect((error as PasswordResetConfirmError).code).toBeNull();
      expect((error as PasswordResetConfirmError).message).toBe(
        "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      );
    },
  );

  it("오류 메시지에 새 비밀번호와 토큰을 포함하지 않는다", async () => {
    mock.onPost(url).reply(400, { code: "BAD_REQUEST" });

    const error = await captureError(confirmPasswordReset(confirmRequest));

    expect((error as PasswordResetConfirmError).message).not.toContain(
      confirmRequest.newPassword,
    );
    expect((error as PasswordResetConfirmError).message).not.toContain(
      confirmRequest.token,
    );
  });
});
