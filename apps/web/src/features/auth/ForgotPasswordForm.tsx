import Link from "next/link";

const inputClassName =
  "h-[43px] rounded border border-[#b3b3b3] px-3 text-sm text-gray-900 outline-none placeholder:text-[#999] focus:border-[#404040] focus:ring-2 focus:ring-[#404040]/20 aria-[invalid=true]:border-red-600";

const labelClassName = "text-[13px] font-medium text-[#404040]";

export function ForgotPasswordForm() {
  return (
    <form noValidate className="flex flex-col gap-5">
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
          className={inputClassName}
        />
      </div>

      <button
        type="submit"
        className="h-[46px] rounded bg-[#404040] text-[15px] font-bold text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#8c8c8c]"
      >
        재설정 링크 받기
      </button>

      <Link href="/login" className="self-start text-[13px] text-[#666] underline">
        <span aria-hidden="true">← </span>로그인으로 돌아가기
      </Link>
    </form>
  );
}
