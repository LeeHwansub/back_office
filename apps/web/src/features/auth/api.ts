import { getLoginErrorMessage } from "./login-error-messages";
import { getPasswordResetErrorMessage } from "./password-reset-error-messages";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

export async function login(request: LoginRequest): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new LoginError(null);
  }

  if (!response.ok) {
    throw new LoginError(response.status);
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

export async function requestPasswordReset(request: PasswordResetRequest): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new PasswordResetError(null);
  }

  if (!response.ok) {
    throw new PasswordResetError(response.status);
  }
}
