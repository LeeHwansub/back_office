import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 재설정 | 통합 관리자 포털",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const validToken = typeof token === "string" && token !== "" ? token : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex w-[120px] justify-center rounded bg-[#e0e0e0] py-2.5 text-[13px] font-bold text-[#737373]">
        LOGO
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[#262626]">비밀번호 재설정</h1>
        <p className="text-sm text-[#808080]">
          새로 사용할 비밀번호를 입력해 주세요.
        </p>
      </div>
      {validToken ? (
        <ResetPasswordForm token={validToken} />
      ) : (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700"
        >
          <p>
            올바르지 않은 재설정 링크입니다. 비밀번호 찾기를 다시 진행해 주세요.
          </p>
          <Link href="/forgot-password" className="self-start underline">
            재설정 링크 다시 요청하기
          </Link>
        </div>
      )}
    </div>
  );
}
