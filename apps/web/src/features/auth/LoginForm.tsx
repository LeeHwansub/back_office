"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { login, LoginError } from "./api";
import { getLoginErrorMessage } from "./login-error-messages";

const inputClassName =
  "h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 aria-[invalid=true]:border-red-600";

const REQUIRED_BOTH_MESSAGE = "아이디와 비밀번호를 모두 입력해 주세요.";
const REQUIRED_LOGIN_ID_MESSAGE = "아이디를 입력해 주세요.";
const REQUIRED_PASSWORD_MESSAGE = "비밀번호를 입력해 주세요.";

type InvalidFields = { loginId: boolean; password: boolean };

const NO_INVALID_FIELDS: InvalidFields = { loginId: false, password: false };

export function LoginForm() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [invalid, setInvalid] = useState<InvalidFields>(NO_INVALID_FIELDS);
  const [showRequiredBoth, setShowRequiredBoth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const trimmedLoginId = loginId.trim();
    const nextInvalid = { loginId: trimmedLoginId === "", password: password === "" };
    setInvalid(nextInvalid);
    setShowRequiredBoth(nextInvalid.loginId && nextInvalid.password);
    if (nextInvalid.loginId || nextInvalid.password) return;

    setIsSubmitting(true);
    try {
      await login({ loginId: trimmedLoginId, password, rememberMe });
    } catch (error) {
      setSubmitError(error instanceof LoginError ? error.message : getLoginErrorMessage(null));
      setPassword("");
      setIsSubmitting(false);
    }
  }

  function handleLoginIdChange(value: string) {
    setLoginId(value);
    setInvalid((prev) => ({ ...prev, loginId: false }));
    setShowRequiredBoth(false);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setInvalid((prev) => ({ ...prev, password: false }));
    setShowRequiredBoth(false);
  }

  const showLoginIdMessage = invalid.loginId && !showRequiredBoth;
  const showPasswordMessage = invalid.password && !showRequiredBoth;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {submitError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </p>
      )}

      {showRequiredBoth && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {REQUIRED_BOTH_MESSAGE}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="loginId" className="text-sm font-medium text-gray-700">
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          autoComplete="username"
          value={loginId}
          onChange={(event) => handleLoginIdChange(event.target.value)}
          aria-invalid={invalid.loginId || undefined}
          aria-describedby={showLoginIdMessage ? "loginId-error" : undefined}
          className={inputClassName}
        />
        {showLoginIdMessage && (
          <p id="loginId-error" className="text-sm text-red-600">
            {REQUIRED_LOGIN_ID_MESSAGE}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => handlePasswordChange(event.target.value)}
          aria-invalid={invalid.password || undefined}
          aria-describedby={showPasswordMessage ? "password-error" : undefined}
          className={inputClassName}
        />
        {showPasswordMessage && (
          <p id="password-error" className="text-sm text-red-600">
            {REQUIRED_PASSWORD_MESSAGE}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            name="rememberMe"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          로그인 상태 유지
        </label>
        <Link href="/forgot-password" className="text-blue-700 hover:underline">
          비밀번호 찾기
        </Link>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-md bg-blue-700 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        {isSubmitting ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
