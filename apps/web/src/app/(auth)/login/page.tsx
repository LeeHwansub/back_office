import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = {
  title: "로그인 | 통합 관리자 포털",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex w-[120px] justify-center rounded bg-[#e0e0e0] py-2.5 text-[13px] font-bold text-[#737373]">
        LOGO
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold text-[#262626]">관리자 로그인</h1>
        <p className="text-sm text-[#808080]">통합 관리자 포털</p>
      </div>
      <LoginForm />
    </div>
  );
}
