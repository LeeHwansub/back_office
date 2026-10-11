import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./LoginForm";

describe("LoginForm 렌더링", () => {
  it("아이디와 비밀번호 입력란을 표시한다", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("아이디")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("비밀번호 입력값을 마스킹한다", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password");
  });

  it("로그인 상태 유지 체크박스는 기본값이 미선택이다", () => {
    render(<LoginForm />);

    expect(screen.getByRole("checkbox", { name: "로그인 상태 유지" })).not.toBeChecked();
  });

  it("활성화된 로그인 버튼을 표시한다", () => {
    render(<LoginForm />);

    const button = screen.getByRole("button", { name: "로그인" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("비밀번호 찾기 링크는 /forgot-password로 이동한다", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "비밀번호 찾기" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});
