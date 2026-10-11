import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPasswordReset, PasswordResetConfirmError } from "./api";
import { ResetPasswordForm } from "./ResetPasswordForm";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, confirmPasswordReset: vi.fn() };
});

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const confirmPasswordResetMock = vi.mocked(confirmPasswordReset);

const TOKEN = "reset-token-value";
const VALID_PASSWORD = "newPassw0rd";

beforeEach(() => {
  confirmPasswordResetMock.mockReset();
  replaceMock.mockReset();
});

function submitButton() {
  return screen.getByRole("button", { name: "비밀번호 변경" });
}

function newPasswordInput() {
  return screen.getByLabelText("새 비밀번호");
}

function passwordConfirmInput() {
  return screen.getByLabelText("비밀번호 확인");
}

async function fillPasswords(
  user: ReturnType<typeof userEvent.setup>,
  newPassword: string,
  passwordConfirm: string,
) {
  if (newPassword) await user.type(newPasswordInput(), newPassword);
  if (passwordConfirm) await user.type(passwordConfirmInput(), passwordConfirm);
}

describe("ResetPasswordForm 렌더링", () => {
  it("새 비밀번호 입력란을 비밀번호 형식으로 표시한다", () => {
    render(<ResetPasswordForm token={TOKEN} />);

    expect(newPasswordInput()).toHaveAttribute("type", "password");
    expect(newPasswordInput()).toHaveAttribute("autocomplete", "new-password");
    expect(newPasswordInput()).toHaveAttribute(
      "placeholder",
      "새 비밀번호를 입력하세요",
    );
  });

  it("비밀번호 확인 입력란을 비밀번호 형식으로 표시한다", () => {
    render(<ResetPasswordForm token={TOKEN} />);

    expect(passwordConfirmInput()).toHaveAttribute("type", "password");
    expect(passwordConfirmInput()).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(passwordConfirmInput()).toHaveAttribute(
      "placeholder",
      "새 비밀번호를 다시 입력하세요",
    );
  });

  it("활성화된 비밀번호 변경 버튼을 표시한다", () => {
    render(<ResetPasswordForm token={TOKEN} />);

    expect(submitButton()).toBeEnabled();
    expect(submitButton()).toHaveAttribute("type", "submit");
  });

  it("로그인으로 돌아가기 링크는 /login으로 이동한다", () => {
    render(<ResetPasswordForm token={TOKEN} />);

    expect(
      screen.getByRole("link", { name: "로그인으로 돌아가기" }),
    ).toHaveAttribute("href", "/login");
  });
});

describe("ResetPasswordForm 입력 검증", () => {
  it("처음에는 검증 안내와 오류 표시가 없다", () => {
    render(<ResetPasswordForm token={TOKEN} />);

    expect(screen.queryByText(/입력해 주세요/)).not.toBeInTheDocument();
    expect(newPasswordInput()).not.toHaveAttribute("aria-invalid");
    expect(passwordConfirmInput()).not.toHaveAttribute("aria-invalid");
  });

  it("두 입력란이 모두 비어 있으면 공통 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await user.click(submitButton());

    expect(
      screen.getByText("새 비밀번호와 비밀번호 확인을 모두 입력해 주세요."),
    ).toBeInTheDocument();
    expect(newPasswordInput()).toHaveAttribute("aria-invalid", "true");
    expect(passwordConfirmInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("새 비밀번호만 비어 있으면 새 비밀번호 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, "", VALID_PASSWORD);
    await user.click(submitButton());

    expect(newPasswordInput()).toHaveAccessibleDescription(
      "새 비밀번호를 입력해 주세요.",
    );
    expect(newPasswordInput()).toHaveAttribute("aria-invalid", "true");
    expect(passwordConfirmInput()).not.toHaveAttribute("aria-invalid");
  });

  it("비밀번호 확인만 비어 있으면 비밀번호 확인 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, "");
    await user.click(submitButton());

    expect(passwordConfirmInput()).toHaveAccessibleDescription(
      "비밀번호 확인을 입력해 주세요.",
    );
    expect(passwordConfirmInput()).toHaveAttribute("aria-invalid", "true");
    expect(newPasswordInput()).not.toHaveAttribute("aria-invalid");
  });

  it.each([
    ["7자", "abcd123"],
    ["영문 없음", "12345678"],
    ["숫자 없음", "abcdefgh"],
    ["200자 초과", `a1${"b".repeat(199)}`],
  ])(
    "새 비밀번호가 규칙에 맞지 않으면(%s) 규칙 안내를 표시한다",
    async (_, password) => {
      const user = userEvent.setup();
      render(<ResetPasswordForm token={TOKEN} />);

      await user.click(newPasswordInput());
      await user.paste(password);
      await user.click(passwordConfirmInput());
      await user.paste(password);
      await user.click(submitButton());

      expect(newPasswordInput()).toHaveAccessibleDescription(
        "비밀번호는 영문과 숫자를 포함해 8~200자로 입력해 주세요.",
      );
      expect(newPasswordInput()).toHaveAttribute("aria-invalid", "true");
      expect(passwordConfirmInput()).not.toHaveAttribute("aria-invalid");
    },
  );

  it("두 비밀번호가 다르면 불일치 안내를 비밀번호 확인 입력란에 표시한다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, "otherPassw0rd");
    await user.click(submitButton());

    expect(passwordConfirmInput()).toHaveAccessibleDescription(
      "비밀번호가 일치하지 않습니다.",
    );
    expect(passwordConfirmInput()).toHaveAttribute("aria-invalid", "true");
    expect(newPasswordInput()).not.toHaveAttribute("aria-invalid");
  });

  it("안내가 표시된 입력란을 다시 입력하면 해당 안내가 사라진다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, "different1");
    await user.click(submitButton());
    await user.type(passwordConfirmInput(), "x");

    expect(
      screen.queryByText("비밀번호가 일치하지 않습니다."),
    ).not.toBeInTheDocument();
    expect(passwordConfirmInput()).not.toHaveAttribute("aria-invalid");
  });

  it("안내는 비밀번호 확인 입력란과 비밀번호 변경 버튼 사이에 표시한다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await user.click(submitButton());

    const message = screen.getByText(
      "새 비밀번호와 비밀번호 확인을 모두 입력해 주세요.",
    );
    expect(
      passwordConfirmInput().compareDocumentPosition(message) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      message.compareDocumentPosition(submitButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("검증에 실패하면 변경 요청을 보내지 않는다", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, "otherPassw0rd");
    await user.click(submitButton());

    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });
});

describe("ResetPasswordForm 제출", () => {
  it("토큰과 새 비밀번호를 그대로 담아 변경 요청을 보낸다", async () => {
    confirmPasswordResetMock.mockResolvedValue();
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, " newPassw0rd ", " newPassw0rd ");
    await user.click(submitButton());

    expect(confirmPasswordResetMock).toHaveBeenCalledTimes(1);
    expect(confirmPasswordResetMock).toHaveBeenCalledWith({
      token: TOKEN,
      newPassword: " newPassw0rd ",
    });
  });

  it("요청 중에는 버튼에 변경 중...을 표시하고 비활성화한다", async () => {
    confirmPasswordResetMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, VALID_PASSWORD);
    await user.click(submitButton());

    expect(screen.getByRole("button", { name: "변경 중..." })).toBeDisabled();
  });

  it("요청 중에는 다시 제출해도 변경 요청을 한 번만 보낸다", async () => {
    confirmPasswordResetMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, VALID_PASSWORD);
    await user.click(submitButton());
    await user.click(screen.getByRole("button", { name: "변경 중..." }));
    await user.type(passwordConfirmInput(), "{Enter}");

    expect(confirmPasswordResetMock).toHaveBeenCalledTimes(1);
  });
});

describe("ResetPasswordForm 요청 실패", () => {
  async function submitValidForm(user: ReturnType<typeof userEvent.setup>) {
    await fillPasswords(user, VALID_PASSWORD, VALID_PASSWORD);
    await user.click(submitButton());
  }

  it("재설정 링크가 무효하면 안내와 함께 다시 요청하기 링크를 표시한다", async () => {
    confirmPasswordResetMock.mockRejectedValue(
      new PasswordResetConfirmError(400, "INVALID_RESET_TOKEN"),
    );
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
    );
    expect(
      screen.getByRole("link", { name: "재설정 링크 다시 요청하기" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("그 밖의 실패는 다시 요청하기 링크 없이 안내만 표시한다", async () => {
    confirmPasswordResetMock.mockRejectedValue(
      new PasswordResetConfirmError(400, "BAD_REQUEST"),
    );
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "입력한 정보를 확인해 주세요.",
    );
    expect(
      screen.queryByRole("link", { name: "재설정 링크 다시 요청하기" }),
    ).not.toBeInTheDocument();
  });

  it("실패 안내는 비밀번호 확인 입력란과 비밀번호 변경 버튼 사이에 표시한다", async () => {
    confirmPasswordResetMock.mockRejectedValue(
      new PasswordResetConfirmError(500, null),
    );
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await submitValidForm(user);

    const alert = await screen.findByRole("alert");
    expect(
      passwordConfirmInput().compareDocumentPosition(alert) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      alert.compareDocumentPosition(submitButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("알 수 없는 오류는 내부 내용 대신 서버 오류 안내를 표시한다", async () => {
    confirmPasswordResetMock.mockRejectedValue(new Error("internal detail"));
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await submitValidForm(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(alert).not.toHaveTextContent("internal detail");
  });

  it("실패하면 비밀번호 변경 버튼을 다시 활성화하고 이동하지 않는다", async () => {
    confirmPasswordResetMock.mockRejectedValue(
      new PasswordResetConfirmError(500, null),
    );
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await submitValidForm(user);
    await screen.findByRole("alert");

    expect(submitButton()).toBeEnabled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("다시 제출하면 이전 실패 안내를 지운다", async () => {
    confirmPasswordResetMock
      .mockRejectedValueOnce(
        new PasswordResetConfirmError(400, "INVALID_RESET_TOKEN"),
      )
      .mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await submitValidForm(user);
    await screen.findByRole("alert");
    await user.click(submitButton());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "재설정 링크 다시 요청하기" }),
    ).not.toBeInTheDocument();
  });
});

describe("ResetPasswordForm 요청 성공", () => {
  it("성공하면 로그인 화면으로 이동한다", async () => {
    confirmPasswordResetMock.mockResolvedValue();
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, VALID_PASSWORD);
    await user.click(submitButton());

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("이동하는 동안 비밀번호 변경 버튼을 비활성화된 상태로 유지한다", async () => {
    confirmPasswordResetMock.mockResolvedValue();
    const user = userEvent.setup();
    render(<ResetPasswordForm token={TOKEN} />);

    await fillPasswords(user, VALID_PASSWORD, VALID_PASSWORD);
    await user.click(submitButton());

    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "변경 중..." })).toBeDisabled();
  });
});
