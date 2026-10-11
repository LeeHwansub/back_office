import type { AxiosRequestConfig } from "axios";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, httpClient, REQUEST_TIMEOUT_MS } from "./http-client";

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(httpClient);
});

afterEach(() => {
  mock.restore();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("요청이 실패하지 않았습니다.");
}

describe("httpClient 공통 설정", () => {
  it("모든 요청에 쿠키를 포함하고 JSON으로 보낸다", async () => {
    let config: AxiosRequestConfig | undefined;
    mock.onPost("/api/v1/sample").reply((requestConfig) => {
      config = requestConfig;
      return [204];
    });

    await httpClient.post("/api/v1/sample", { name: "value" });

    expect(config?.withCredentials).toBe(true);
    expect(config?.headers?.["Content-Type"]).toBe("application/json");
    expect(config?.data).toBe(JSON.stringify({ name: "value" }));
  });

  it("요청 시간 제한은 10초다", async () => {
    let config: AxiosRequestConfig | undefined;
    mock.onGet("/api/v1/sample").reply((requestConfig) => {
      config = requestConfig;
      return [200, {}];
    });

    await httpClient.get("/api/v1/sample");

    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(config?.timeout).toBe(REQUEST_TIMEOUT_MS);
  });

  it("기본 주소는 NEXT_PUBLIC_API_URL을 사용한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.example.com");
    vi.resetModules();

    const { httpClient: client } = await import("./http-client");

    expect(client.defaults.baseURL).toBe("http://api.example.com");
  });

  it("NEXT_PUBLIC_API_URL이 없으면 같은 출처로 요청한다", () => {
    expect(httpClient.defaults.baseURL).toBe("");
  });

  it("성공 응답은 그대로 돌려준다", async () => {
    mock.onGet("/api/v1/sample").reply(200, { id: 1 });

    const response = await httpClient.get("/api/v1/sample");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ id: 1 });
  });
});

describe("httpClient 오류 변환", () => {
  it("오류 응답은 상태 코드와 응답 본문의 code를 담은 HttpError로 바꾼다", async () => {
    mock
      .onPost("/api/v1/sample")
      .reply(400, { code: "INVALID_RESET_TOKEN", message: "x" });

    const error = await captureError(httpClient.post("/api/v1/sample", {}));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 400, code: "INVALID_RESET_TOKEN" });
  });

  it.each([
    ["본문 없음", undefined],
    ["JSON이 아닌 본문", "<html>Bad Gateway</html>"],
    ["code가 문자열이 아님", { code: 123 }],
    ["code 없음", { message: "x" }],
    ["null 본문", null],
  ])(
    "응답 본문에서 code를 읽을 수 없으면(%s) code는 null이다",
    async (_, body) => {
      mock.onPost("/api/v1/sample").reply(502, body);

      const error = await captureError(httpClient.post("/api/v1/sample", {}));

      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 502, code: null });
    },
  );

  it("네트워크 오류는 상태 코드와 code가 없는 HttpError로 바꾼다", async () => {
    mock.onPost("/api/v1/sample").networkError();

    const error = await captureError(httpClient.post("/api/v1/sample", {}));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: null, code: null });
  });

  it("시간 제한을 넘기면 상태 코드와 code가 없는 HttpError로 바꾼다", async () => {
    mock.onPost("/api/v1/sample").timeout();

    const error = await captureError(httpClient.post("/api/v1/sample", {}));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: null, code: null });
  });

  it("오류 메시지에 요청 본문을 담지 않는다", async () => {
    mock.onPost("/api/v1/sample").reply(500);

    const error = await captureError(
      httpClient.post("/api/v1/sample", {
        password: "secretPassw0rd",
        token: "secret-token",
      }),
    );

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).message).not.toContain("secretPassw0rd");
    expect((error as HttpError).message).not.toContain("secret-token");
  });
});
