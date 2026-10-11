import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResetPasswordPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

type SearchParams = { [key: string]: string | string[] | undefined };

async function renderPage(searchParams: SearchParams) {
  render(
    await ResetPasswordPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

describe("ResetPasswordPage", () => {
  it("비밀번호 재설정 제목과 안내 문구를 표시한다", async () => {
    await renderPage({ token: "reset-token" });

    expect(
      screen.getByRole("heading", { level: 1, name: "비밀번호 재설정" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("새로 사용할 비밀번호를 입력해 주세요."),
    ).toBeInTheDocument();
  });

  it("로고 자리를 표시한다", async () => {
    await renderPage({ token: "reset-token" });

    expect(screen.getByText("LOGO")).toBeInTheDocument();
  });

  it("토큰이 있으면 새 비밀번호 설정 폼을 표시한다", async () => {
    await renderPage({ token: "reset-token" });

    expect(screen.getByLabelText("새 비밀번호")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호 확인")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "비밀번호 변경" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["토큰 없음", {}],
    ["빈 토큰", { token: "" }],
    ["토큰이 여러 개", { token: ["a", "b"] }],
  ])(
    "링크가 올바르지 않으면(%s) 폼 대신 다시 요청하기 안내를 표시한다",
    async (_, params) => {
      await renderPage(params);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "올바르지 않은 재설정 링크입니다. 비밀번호 찾기를 다시 진행해 주세요.",
      );
      expect(
        screen.getByRole("link", { name: "재설정 링크 다시 요청하기" }),
      ).toHaveAttribute("href", "/forgot-password");
      expect(screen.queryByLabelText("새 비밀번호")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("브라우저 탭 제목을 비밀번호 재설정 | 통합 관리자 포털로 지정한다", () => {
    expect(metadata.title).toBe("비밀번호 재설정 | 통합 관리자 포털");
  });
});
