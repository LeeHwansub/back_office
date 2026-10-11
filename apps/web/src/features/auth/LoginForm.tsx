"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login, LoginError } from "./api";
import { getLoginErrorMessage } from "./login-error-messages";

const inputClassName =
  "h-[43px] rounded border border-[#b3b3b3] px-3 text-sm text-gray-900 outline-none placeholder:text-[#999] focus:border-[#404040] focus:ring-2 focus:ring-[#404040]/20 aria-[invalid=true]:border-red-600";

const labelClassName = "text-[13px] font-medium text-[#404040]";

const REQUIRED_BOTH_MESSAGE = "아이디와 비밀번호를 모두 입력해 주세요.";
const REQUIRED_LOGIN_ID_MESSAGE = "아이디를 입력해 주세요.";
const REQUIRED_PASSWORD_MESSAGE = "비밀번호를 입력해 주세요.";
const ERROR_MESSAGE_ID = "login-error";

type InvalidFields = { loginId: boolean; password: boolean };

const NO_INVALID_FIELDS: InvalidFields = { loginId: false, password: false };

export function LoginForm() {
  const router = useRouter();
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
      return;
    }

    router.replace("/dashboard");
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

  const validationMessage = showRequiredBoth
    ? REQUIRED_BOTH_MESSAGE
    : invalid.loginId
      ? REQUIRED_LOGIN_ID_MESSAGE
      : invalid.password
        ? REQUIRED_PASSWORD_MESSAGE
        : null;
  const errorMessage = submitError ?? validationMessage;
  const errorDescribedBy = errorMessage ? ERROR_MESSAGE_ID : undefined;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="loginId" className={labelClassName}>
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          autoComplete="username"
          placeholder="아이디를 입력하세요"
          value={loginId}
          onChange={(event) => handleLoginIdChange(event.target.value)}
          aria-invalid={invalid.loginId || undefined}
          aria-describedby={invalid.loginId ? errorDescribedBy : undefined}
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClassName}>
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(event) => handlePasswordChange(event.target.value)}
          aria-invalid={invalid.password || undefined}
          aria-describedby={invalid.password ? errorDescribedBy : undefined}
          className={inputClassName}
        />
      </div>

      {errorMessage && (
        <p
          id={ERROR_MESSAGE_ID}
          role={submitError ? "alert" : undefined}
          className="rounded border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700"
        >
          {errorMessage}
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-[#4d4d4d]">
        <input
          type="checkbox"
          name="rememberMe"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 accent-[#404040]"
        />
        로그인 상태 유지
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-[46px] rounded bg-[#404040] text-[15px] font-bold text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#8c8c8c]"
      >
        {isSubmitting ? "로그인 중..." : "로그인"}
      </button>

      <Link href="/forgot-password" className="self-start text-[13px] text-[#666] underline">
        비밀번호 찾기
      </Link>
    </form>
  );
}
