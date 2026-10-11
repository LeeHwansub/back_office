import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset } from "./api";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, requestPasswordReset: vi.fn() };
});

const requestPasswordResetMock = vi.mocked(requestPasswordReset);

beforeEach(() => {
  requestPasswordResetMock.mockReset();
});

function submitButton() {
  return screen.getByRole("button", { name: "재설정 링크 받기" });
}

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

describe("ForgotPasswordForm 입력 검증", () => {
  it("처음에는 검증 안내와 오류 표시가 없다", () => {
    render(<ForgotPasswordForm />);

    expect(screen.queryByText(/입력해 주세요/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("이메일")).not.toHaveAttribute("aria-invalid");
  });

  it("아이디와 이메일이 모두 비어 있으면 공통 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(submitButton());

    expect(screen.getByText("아이디와 이메일을 모두 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("이메일")).toHaveAttribute("aria-invalid", "true");
  });

  it("아이디만 비어 있으면 아이디 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("이메일"), "admin@example.com");
    await user.click(submitButton());

    expect(screen.getByLabelText("아이디")).toHaveAccessibleDescription("아이디를 입력해 주세요.");
    expect(screen.getByLabelText("아이디")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("이메일")).not.toHaveAttribute("aria-invalid");
  });

  it("이메일만 비어 있으면 이메일 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.click(submitButton());

    expect(screen.getByLabelText("이메일")).toHaveAccessibleDescription("이메일을 입력해 주세요.");
    expect(screen.getByLabelText("이메일")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("아이디")).not.toHaveAttribute("aria-invalid");
  });

  it("공백만 입력한 아이디는 입력하지 않은 것으로 처리한다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("아이디"), "   ");
    await user.type(screen.getByLabelText("이메일"), "admin@example.com");
    await user.click(submitButton());

    expect(screen.getByLabelText("아이디")).toHaveAccessibleDescription("아이디를 입력해 주세요.");
  });

  it.each(["admin", "admin@", "admin@example", "ad min@example.com"])(
    "이메일 형식이 올바르지 않으면(%s) 형식 안내를 표시한다",
    async (email) => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      await user.type(screen.getByLabelText("아이디"), "admin");
      await user.type(screen.getByLabelText("이메일"), email);
      await user.click(submitButton());

      expect(screen.getByLabelText("이메일")).toHaveAccessibleDescription(
        "올바른 이메일 주소를 입력해 주세요.",
      );
      expect(screen.getByLabelText("이메일")).toHaveAttribute("aria-invalid", "true");
    },
  );

  it("안내가 표시된 입력란을 다시 입력하면 해당 안내가 사라진다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.type(screen.getByLabelText("이메일"), "wrong");
    await user.click(submitButton());
    await user.type(screen.getByLabelText("이메일"), "@example.com");

    expect(screen.queryByText("올바른 이메일 주소를 입력해 주세요.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).not.toHaveAttribute("aria-invalid");
  });

  it("안내는 이메일 입력란과 재설정 링크 받기 버튼 사이에 표시한다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(submitButton());

    const message = screen.getByText("아이디와 이메일을 모두 입력해 주세요.");
    const email = screen.getByLabelText("이메일");
    expect(email.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      message.compareDocumentPosition(submitButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("검증에 실패하면 재설정 요청을 보내지 않는다", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(submitButton());

    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });
});
