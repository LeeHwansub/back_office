import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("LoginPage", () => {
  it("관리자 로그인 제목과 포털 이름을 표시한다", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1, name: "관리자 로그인" })).toBeInTheDocument();
    expect(screen.getByText("통합 관리자 포털")).toBeInTheDocument();
  });

  it("로고 자리를 표시한다", () => {
    render(<LoginPage />);

    expect(screen.getByText("LOGO")).toBeInTheDocument();
  });

  it("로그인 폼을 표시한다", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("브라우저 탭 제목을 로그인 | 통합 관리자 포털로 지정한다", () => {
    expect(metadata.title).toBe("로그인 | 통합 관리자 포털");
  });
});
