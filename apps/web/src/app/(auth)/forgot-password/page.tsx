import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 찾기 | 통합 관리자 포털",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex w-[120px] justify-center rounded bg-[#e0e0e0] py-2.5 text-[13px] font-bold text-[#737373]">
        LOGO
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[#262626]">비밀번호 찾기</h1>
        <p className="text-sm text-[#808080]">
          계정 정보를 입력하시면 비밀번호 재설정 링크를 이메일로 보내드립니다.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
