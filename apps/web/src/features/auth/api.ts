import { HttpError, httpClient } from "@/lib/http-client";
import { getLoginErrorMessage } from "./login-error-messages";
import { getPasswordResetConfirmErrorMessage } from "./password-reset-confirm-error-messages";
import { getPasswordResetErrorMessage } from "./password-reset-error-messages";

export type LoginRequest = {
  loginId: string;
  password: string;
  rememberMe: boolean;
};

export class LoginError extends Error {
  constructor(readonly status: number | null) {
    super(getLoginErrorMessage(status));
    this.name = "LoginError";
  }
}

function toHttpError(error: unknown): HttpError {
  return error instanceof HttpError ? error : new HttpError(null, null);
}

export async function login(request: LoginRequest): Promise<void> {
  try {
    await httpClient.post("/api/v1/auth/login", request);
  } catch (error) {
    throw new LoginError(toHttpError(error).status);
  }
}

export type PasswordResetRequest = {
  loginId: string;
  email: string;
};

export class PasswordResetError extends Error {
  constructor(readonly status: number | null) {
    super(getPasswordResetErrorMessage(status));
    this.name = "PasswordResetError";
  }
}

export async function requestPasswordReset(
  request: PasswordResetRequest,
): Promise<void> {
  try {
    await httpClient.post("/api/v1/auth/password-reset", request);
  } catch (error) {
    throw new PasswordResetError(toHttpError(error).status);
  }
}

export type PasswordResetConfirmRequest = {
  token: string;
  newPassword: string;
};

export class PasswordResetConfirmError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(getPasswordResetConfirmErrorMessage(status, code));
    this.name = "PasswordResetConfirmError";
  }
}

export async function confirmPasswordReset(
  request: PasswordResetConfirmRequest,
): Promise<void> {
  try {
    await httpClient.post("/api/v1/auth/password-reset/confirm", request);
  } catch (error) {
    const { status, code } = toHttpError(error);
    throw new PasswordResetConfirmError(status, code);
  }
}
