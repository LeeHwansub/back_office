import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

describe("ForgotPasswordForm 렌더링", () => {
  it("아이디 입력란을 안내 문구와 함께 표시한다", () => {
    render(<ForgotPasswordForm />);

    const loginId = screen.getByLabelText("아이디");
    expect(loginId).toHaveAttribute("type", "text");
    expect(loginId).toHaveAttribute("placeholder", "아이디를 입력하세요");
  });

  it("이메일 입력란을 안내 문구와 함께 표시한다", () => {
    render(<ForgotPasswordForm />);

    const email = screen.getByLabelText("이메일");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("placeholder", "사내 이메일 주소를 입력하세요");
  });

  it("활성화된 재설정 링크 받기 버튼을 표시한다", () => {
    render(<ForgotPasswordForm />);

    const button = screen.getByRole("button", { name: "재설정 링크 받기" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("로그인으로 돌아가기 링크는 /login으로 이동한다", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByRole("link", { name: "로그인으로 돌아가기" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
