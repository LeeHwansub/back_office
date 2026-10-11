"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ERROR_MESSAGES, ErrorCode } from "@/lib/error-messages";
import { PasswordResetError, requestPasswordReset } from "./api";

const inputClassName =
  "h-[43px] rounded border border-[#b3b3b3] px-3 text-sm text-gray-900 outline-none placeholder:text-[#999] focus:border-[#404040] focus:ring-2 focus:ring-[#404040]/20 aria-[invalid=true]:border-red-600";

const labelClassName = "text-[13px] font-medium text-[#404040]";

const ERROR_MESSAGE_ID = "forgot-password-error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { loginId: ErrorCode | null; email: ErrorCode | null };

const NO_FIELD_ERRORS: FieldErrors = { loginId: null, email: null };

function validate(loginId: string, email: string): FieldErrors {
  return {
    loginId: loginId === "" ? ErrorCode.REQUIRED_LOGIN_ID : null,
    email:
      email === ""
        ? ErrorCode.REQUIRED_EMAIL
        : EMAIL_PATTERN.test(email)
          ? null
          : ErrorCode.INVALID_EMAIL_FORMAT,
  };
}

export function ForgotPasswordForm() {
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const [showRequiredBoth, setShowRequiredBoth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const trimmedLoginId = loginId.trim();
    const trimmedEmail = email.trim();
    const nextErrors = validate(trimmedLoginId, trimmedEmail);
    setFieldErrors(nextErrors);
    setShowRequiredBoth(
      nextErrors.loginId === ErrorCode.REQUIRED_LOGIN_ID &&
        nextErrors.email === ErrorCode.REQUIRED_EMAIL,
    );
    if (nextErrors.loginId || nextErrors.email) return;

    setIsSubmitting(true);
    try {
      await requestPasswordReset({ loginId: trimmedLoginId, email: trimmedEmail });
    } catch (error) {
      setSubmitError(
        error instanceof PasswordResetError ? error.message : ERROR_MESSAGES[ErrorCode.SERVER_ERROR],
      );
      setIsSubmitting(false);
    }
  }

  function handleLoginIdChange(value: string) {
    setLoginId(value);
    setFieldErrors((prev) => ({ ...prev, loginId: null }));
    setShowRequiredBoth(false);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setFieldErrors((prev) => ({ ...prev, email: null }));
    setShowRequiredBoth(false);
  }

  const errorCode = showRequiredBoth
    ? ErrorCode.REQUIRED_LOGIN_ID_AND_EMAIL
    : (fieldErrors.loginId ?? fieldErrors.email);
  const validationMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;
  const errorMessage = submitError ?? validationMessage;
  const errorDescribedBy = validationMessage ? ERROR_MESSAGE_ID : undefined;

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
          aria-invalid={fieldErrors.loginId ? true : undefined}
          aria-describedby={fieldErrors.loginId ? errorDescribedBy : undefined}
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClassName}>
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="사내 이메일 주소를 입력하세요"
          value={email}
          onChange={(event) => handleEmailChange(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? errorDescribedBy : undefined}
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-[46px] rounded bg-[#404040] text-[15px] font-bold text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#8c8c8c]"
      >
        {isSubmitting ? "요청 중..." : "재설정 링크 받기"}
      </button>

      <Link href="/login" className="self-start text-[13px] text-[#666] underline">
        <span aria-hidden="true">← </span>로그인으로 돌아가기
      </Link>
    </form>
  );
}
