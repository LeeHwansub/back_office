import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confirmPasswordReset,
  login,
  LoginError,
  PasswordResetConfirmError,
  PasswordResetError,
  requestPasswordReset,
} from "./api";

const request = { loginId: "admin", password: "secret", rememberMe: false };

function mockFetch(implementation: () => Promise<Response>) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST /api/v1/auth/login 으로 쿠키를 포함해 JSON 요청을 보낸다", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));

    await login(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/login$/);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("2xx 응답이면 오류 없이 완료한다", async () => {
    mockFetch(async () => new Response(JSON.stringify({}), { status: 200 }));

    await expect(login(request)).resolves.toBeUndefined();
  });

  it.each([400, 401, 403, 422, 429, 500, 503])(
    "%i 응답이면 상태 코드와 로그인 문구를 담은 LoginError를 던진다",
    async (status) => {
      mockFetch(async () => new Response(null, { status }));

      const error = await captureError(login(request));

      expect(error).toBeInstanceOf(LoginError);
      expect((error as LoginError).status).toBe(status);
    },
  );

  it("LoginError의 message는 로그인 화면용 문구다", async () => {
    mockFetch(async () => new Response(null, { status: 401 }));

    const error = await captureError(login(request));

    expect((error as LoginError).message).toBe("아이디 또는 비밀번호를 확인해 주세요.");
  });

  it("네트워크 오류면 status가 null인 LoginError를 던진다", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await captureError(login(request));

    expect(error).toBeInstanceOf(LoginError);
    expect((error as LoginError).status).toBeNull();
    expect((error as LoginError).message).toBe(
      "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("오류 메시지에 입력한 비밀번호를 포함하지 않는다", async () => {
    mockFetch(async () => new Response(null, { status: 500 }));

    const error = await captureError(login(request));

    expect((error as LoginError).message).not.toContain(request.password);
  });
});

describe("requestPasswordReset", () => {
  const resetRequest = { loginId: "admin", email: "admin@example.com" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST /api/v1/auth/password-reset 으로 JSON 요청을 보낸다", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));

    await requestPasswordReset(resetRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/password-reset$/);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body as string)).toEqual(resetRequest);
  });

  it("2xx 응답이면 오류 없이 완료한다", async () => {
    mockFetch(async () => new Response(JSON.stringify({}), { status: 200 }));

    await expect(requestPasswordReset(resetRequest)).resolves.toBeUndefined();
  });

  it.each([400, 404, 422, 429, 500])(
    "%i 응답이면 상태 코드를 담은 PasswordResetError를 던진다",
    async (status) => {
      mockFetch(async () => new Response(null, { status }));

      const error = await captureError(requestPasswordReset(resetRequest));

      expect(error).toBeInstanceOf(PasswordResetError);
      expect((error as PasswordResetError).status).toBe(status);
    },
  );

  it("PasswordResetError의 message는 비밀번호 찾기 화면용 문구다", async () => {
    mockFetch(async () => new Response(null, { status: 404 }));

    const error = await captureError(requestPasswordReset(resetRequest));

    expect((error as PasswordResetError).message).toBe(
      "비밀번호 재설정 요청을 처리할 수 없습니다. 입력 정보를 확인해 주세요.",
    );
  });

  it("네트워크 오류면 status가 null인 PasswordResetError를 던진다", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await captureError(requestPasswordReset(resetRequest));

    expect(error).toBeInstanceOf(PasswordResetError);
    expect((error as PasswordResetError).status).toBeNull();
    expect((error as PasswordResetError).message).toBe(
      "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});

describe("confirmPasswordReset", () => {
  const confirmRequest = { token: "reset-token", newPassword: "new-password1" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("POST /api/v1/auth/password-reset/confirm 으로 JSON 요청을 보낸다", async () => {
    const fetchMock = mockFetch(async () => new Response(null, { status: 204 }));

    await confirmPasswordReset(confirmRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/password-reset\/confirm$/);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body as string)).toEqual(confirmRequest);
  });

  it("2xx 응답이면 오류 없이 완료한다", async () => {
    mockFetch(async () => new Response(null, { status: 204 }));

    await expect(confirmPasswordReset(confirmRequest)).resolves.toBeUndefined();
  });

  it("오류 응답 본문의 code를 담은 PasswordResetConfirmError를 던진다", async () => {
    mockFetch(async () => jsonResponse(400, { code: "INVALID_RESET_TOKEN" }));

    const error = await captureError(confirmPasswordReset(confirmRequest));

    expect(error).toBeInstanceOf(PasswordResetConfirmError);
    expect((error as PasswordResetConfirmError).status).toBe(400);
    expect((error as PasswordResetConfirmError).code).toBe("INVALID_RESET_TOKEN");
    expect((error as PasswordResetConfirmError).message).toBe(
      "재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
    );
  });

  it.each([
    ["본문 없음", () => new Response(null, { status: 500 })],
    ["JSON이 아닌 본문", () => new Response("<html>", { status: 502 })],
    ["code가 문자열이 아닌 본문", () => jsonResponse(400, { code: 1 })],
  ])("%s이면 code가 null인 PasswordResetConfirmError를 던진다", async (_, response) => {
    mockFetch(async () => response());

    const error = await captureError(confirmPasswordReset(confirmRequest));

    expect(error).toBeInstanceOf(PasswordResetConfirmError);
    expect((error as PasswordResetConfirmError).code).toBeNull();
  });

  it("네트워크 오류면 status와 code가 null인 PasswordResetConfirmError를 던진다", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await captureError(confirmPasswordReset(confirmRequest));

    expect(error).toBeInstanceOf(PasswordResetConfirmError);
    expect((error as PasswordResetConfirmError).status).toBeNull();
    expect((error as PasswordResetConfirmError).code).toBeNull();
    expect((error as PasswordResetConfirmError).message).toBe(
      "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("오류 메시지에 새 비밀번호와 토큰을 포함하지 않는다", async () => {
    mockFetch(async () => jsonResponse(400, { code: "BAD_REQUEST" }));

    const error = await captureError(confirmPasswordReset(confirmRequest));

    expect((error as PasswordResetConfirmError).message).not.toContain(confirmRequest.newPassword);
    expect((error as PasswordResetConfirmError).message).not.toContain(confirmRequest.token);
  });
});
