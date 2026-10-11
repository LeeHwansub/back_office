import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForgotPasswordPage, { metadata } from "./page";

describe("ForgotPasswordPage", () => {
  it("비밀번호 찾기 제목과 안내 문구를 표시한다", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole("heading", { level: 1, name: "비밀번호 찾기" })).toBeInTheDocument();
    expect(
      screen.getByText("계정 정보를 입력하시면 비밀번호 재설정 링크를 이메일로 보내드립니다."),
    ).toBeInTheDocument();
  });

  it("로고 자리를 표시한다", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText("LOGO")).toBeInTheDocument();
  });

  it("비밀번호 찾기 폼을 표시한다", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText("아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "재설정 링크 받기" })).toBeInTheDocument();
  });

  it("브라우저 탭 제목을 비밀번호 찾기 | 통합 관리자 포털로 지정한다", () => {
    expect(metadata.title).toBe("비밀번호 찾기 | 통합 관리자 포털");
  });
});
