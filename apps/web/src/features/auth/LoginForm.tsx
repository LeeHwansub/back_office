import Link from "next/link";

const inputClassName =
  "h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20";

export function LoginForm() {
  return (
    <form noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="loginId" className="text-sm font-medium text-gray-700">
          아이디
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          autoComplete="username"
          className={inputClassName}
        />
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
          className={inputClassName}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-gray-700">
          <input type="checkbox" name="rememberMe" className="h-4 w-4 rounded border-gray-300" />
          로그인 상태 유지
        </label>
        <Link href="/forgot-password" className="text-blue-700 hover:underline">
          비밀번호 찾기
        </Link>
      </div>

      <button
        type="submit"
        className="h-11 rounded-md bg-blue-700 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        로그인
      </button>
    </form>
  );
}
