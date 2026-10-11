"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ERROR_MESSAGES, ErrorCode } from "@/lib/error-messages";
import { confirmPasswordReset, PasswordResetConfirmError } from "./api";

const inputClassName =
  "h-[43px] rounded border border-[#b3b3b3] px-3 text-sm text-gray-900 outline-none placeholder:text-[#999] focus:border-[#404040] focus:ring-2 focus:ring-[#404040]/20 aria-[invalid=true]:border-red-600";

const labelClassName = "text-[13px] font-medium text-[#404040]";

const ERROR_MESSAGE_ID = "reset-password-error";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 200;

type FieldErrors = {
  newPassword: ErrorCode | null;
  passwordConfirm: ErrorCode | null;
};

const NO_FIELD_ERRORS: FieldErrors = {
  newPassword: null,
  passwordConfirm: null,
};

type SubmitError = { message: string; canRequestAgain: boolean };

function satisfiesPolicy(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function validate(newPassword: string, passwordConfirm: string): FieldErrors {
  const newPasswordError =
    newPassword === ""
      ? ErrorCode.REQUIRED_NEW_PASSWORD
      : satisfiesPolicy(newPassword)
        ? null
        : ErrorCode.INVALID_PASSWORD_POLICY;
  const passwordConfirmError =
    passwordConfirm === ""
      ? ErrorCode.REQUIRED_PASSWORD_CONFIRM
      : newPasswordError === null && passwordConfirm !== newPassword
        ? ErrorCode.PASSWORD_CONFIRM_MISMATCH
        : null;
  return {
    newPassword: newPasswordError,
    passwordConfirm: passwordConfirmError,
  };
}

function toSubmitError(error: unknown): SubmitError {
  if (error instanceof PasswordResetConfirmError) {
    return {
      message: error.message,
      canRequestAgain: error.code === ErrorCode.INVALID_RESET_TOKEN,
    };
  }
  return {
    message: ERROR_MESSAGES[ErrorCode.SERVER_ERROR],
    canRequestAgain: false,
  };
}

type ResetPasswordFormProps = { token: string };

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const [showRequiredBoth, setShowRequiredBoth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const nextErrors = validate(newPassword, passwordConfirm);
    setFieldErrors(nextErrors);
    setShowRequiredBoth(
      nextErrors.newPassword === ErrorCode.REQUIRED_NEW_PASSWORD &&
        nextErrors.passwordConfirm === ErrorCode.REQUIRED_PASSWORD_CONFIRM,
    );
    if (nextErrors.newPassword || nextErrors.passwordConfirm) return;

    setIsSubmitting(true);
    try {
      await confirmPasswordReset({ token, newPassword });
    } catch (error) {
      setSubmitError(toSubmitError(error));
      setIsSubmitting(false);
      return;
    }

    router.replace("/login");
  }

  function handleNewPasswordChange(value: string) {
    setNewPassword(value);
    setFieldErrors((prev) => ({ ...prev, newPassword: null }));
    setShowRequiredBoth(false);
  }

  function handlePasswordConfirmChange(value: string) {
    setPasswordConfirm(value);
    setFieldErrors((prev) => ({ ...prev, passwordConfirm: null }));
    setShowRequiredBoth(false);
  }

  const errorCode = showRequiredBoth
    ? ErrorCode.REQUIRED_NEW_PASSWORD_AND_CONFIRM
    : (fieldErrors.newPassword ?? fieldErrors.passwordConfirm);
  const validationMessage = errorCode ? ERROR_MESSAGES[errorCode] : null;
  const errorMessage = submitError?.message ?? validationMessage;
  const errorDescribedBy = validationMessage ? ERROR_MESSAGE_ID : undefined;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className={labelClassName}>
          새 비밀번호
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호를 입력하세요"
          value={newPassword}
          onChange={(event) => handleNewPasswordChange(event.target.value)}
          aria-invalid={fieldErrors.newPassword ? true : undefined}
          aria-describedby={
            fieldErrors.newPassword ? errorDescribedBy : undefined
          }
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="passwordConfirm" className={labelClassName}>
          비밀번호 확인
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호를 다시 입력하세요"
          value={passwordConfirm}
          onChange={(event) => handlePasswordConfirmChange(event.target.value)}
          aria-invalid={fieldErrors.passwordConfirm ? true : undefined}
          aria-describedby={
            fieldErrors.passwordConfirm ? errorDescribedBy : undefined
          }
          className={inputClassName}
        />
      </div>

      {errorMessage && (
        <div
          id={ERROR_MESSAGE_ID}
          role={submitError ? "alert" : undefined}
          className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700"
        >
          <p>{errorMessage}</p>
          {submitError?.canRequestAgain && (
            <Link href="/forgot-password" className="self-start underline">
              재설정 링크 다시 요청하기
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-[46px] rounded bg-[#404040] text-[15px] font-bold text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#8c8c8c]"
      >
        {isSubmitting ? "변경 중..." : "비밀번호 변경"}
      </button>

      <Link
        href="/login"
        className="self-start text-[13px] text-[#666] underline"
      >
        <span aria-hidden="true">← </span>로그인으로 돌아가기
      </Link>
    </form>
  );
}
