import axios, { isAxiosError } from "axios";

export const REQUEST_TIMEOUT_MS = 10_000;

/** status가 null이면 응답을 받지 못한 경우(네트워크 오류·시간 초과)다. */
export class HttpError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(
      status === null
        ? "HTTP request failed without response"
        : `HTTP ${status}`,
    );
    this.name = "HttpError";
  }
}

function readErrorCode(data: unknown): string | null {
  if (typeof data === "object" && data !== null && "code" in data) {
    return typeof data.code === "string" ? data.code : null;
  }
  return null;
}

function toHttpError(error: unknown): HttpError {
  if (isAxiosError(error) && error.response) {
    return new HttpError(
      error.response.status,
      readErrorCode(error.response.data),
    );
  }
  return new HttpError(null, null);
}

export const httpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
});

httpClient.interceptors.response.use(undefined, (error: unknown) =>
  Promise.reject(toHttpError(error)),
);
