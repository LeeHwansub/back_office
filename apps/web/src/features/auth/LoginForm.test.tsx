import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, LoginError } from "./api";
import { LoginForm } from "./LoginForm";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, login: vi.fn() };
});

const loginMock = vi.mocked(login);

beforeEach(() => {
  loginMock.mockReset();
});

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

describe("LoginForm 필수 입력 검증", () => {
  it("처음에는 검증 안내와 오류 표시가 없다", () => {
    render(<LoginForm />);

    expect(screen.queryByText(/입력해 주세요/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("비밀번호")).not.toHaveAttribute("aria-invalid");
  });

  it("아이디와 비밀번호가 모두 비어 있으면 공통 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByText("아이디와 비밀번호를 모두 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("aria-invalid", "true");
  });

  it("아이디만 비어 있으면 아이디 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByLabelText("아이디")).toHaveAccessibleDescription("아이디를 입력해 주세요.");
    expect(screen.getByLabelText("아이디")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("비밀번호")).not.toHaveAttribute("aria-invalid");
  });

  it("비밀번호만 비어 있으면 비밀번호 안내를 표시한다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByLabelText("비밀번호")).toHaveAccessibleDescription(
      "비밀번호를 입력해 주세요.",
    );
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("아이디")).not.toHaveAttribute("aria-invalid");
  });

  it("공백만 입력한 아이디는 입력하지 않은 것으로 처리한다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("아이디"), "   ");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByLabelText("아이디")).toHaveAccessibleDescription("아이디를 입력해 주세요.");
  });

  it("안내가 표시된 입력란을 다시 입력하면 해당 안내가 사라진다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));
    await user.type(screen.getByLabelText("아이디"), "a");

    expect(screen.queryByText("아이디를 입력해 주세요.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).not.toHaveAttribute("aria-invalid");
  });

  it("공통 안내는 어느 입력란이든 다시 입력하면 사라진다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "로그인" }));
    await user.type(screen.getByLabelText("아이디"), "a");

    expect(
      screen.queryByText("아이디와 비밀번호를 모두 입력해 주세요."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("비밀번호")).toHaveAttribute("aria-invalid", "true");
  });

  it("검증에 실패하면 로그인 요청을 보내지 않는다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(loginMock).not.toHaveBeenCalled();
  });
});

describe("LoginForm 제출", () => {
  it("아이디는 앞뒤 공백을 제거하고 비밀번호는 그대로 로그인 요청에 담는다", async () => {
    loginMock.mockResolvedValue();
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("아이디"), "  admin  ");
    await user.type(screen.getByLabelText("비밀번호"), " secret ");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(loginMock).toHaveBeenCalledWith({
      loginId: "admin",
      password: " secret ",
      rememberMe: false,
    });
  });

  it("로그인 상태 유지를 선택하면 rememberMe를 true로 보낸다", async () => {
    loginMock.mockResolvedValue();
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("checkbox", { name: "로그인 상태 유지" }));
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(loginMock).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: true }));
  });

  it("요청 중에는 버튼에 로그인 중...을 표시하고 비활성화한다", async () => {
    loginMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.getByRole("button", { name: "로그인 중..." })).toBeDisabled();
  });

  it("요청 중에는 다시 제출해도 로그인 요청을 한 번만 보낸다", async () => {
    loginMock.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));
    await user.click(screen.getByRole("button", { name: "로그인 중..." }));
    await user.type(screen.getByLabelText("비밀번호"), "{Enter}");

    expect(loginMock).toHaveBeenCalledTimes(1);
  });
});

describe("LoginForm 로그인 실패", () => {
  async function submitValidForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("아이디"), "admin");
    await user.type(screen.getByLabelText("비밀번호"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "로그인" }));
  }

  it("LoginError의 안내 문구를 alert로 표시한다", async () => {
    loginMock.mockRejectedValue(new LoginError(401));
    const user = userEvent.setup();
    render(<LoginForm />);

    await submitValidForm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "아이디 또는 비밀번호를 확인해 주세요.",
    );
  });

  it("알 수 없는 오류는 내부 내용 대신 로그인 서버 오류 안내를 표시한다", async () => {
    loginMock.mockRejectedValue(new Error("internal detail"));
    const user = userEvent.setup();
    render(<LoginForm />);

    await submitValidForm(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(alert).not.toHaveTextContent("internal detail");
  });

  it("실패하면 비밀번호는 비우고 아이디는 유지한다", async () => {
    loginMock.mockRejectedValue(new LoginError(401));
    const user = userEvent.setup();
    render(<LoginForm />);

    await submitValidForm(user);
    await screen.findByRole("alert");

    expect(screen.getByLabelText("아이디")).toHaveValue("admin");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });

  it("실패하면 로그인 버튼을 다시 활성화한다", async () => {
    loginMock.mockRejectedValue(new LoginError(401));
    const user = userEvent.setup();
    render(<LoginForm />);

    await submitValidForm(user);
    await screen.findByRole("alert");

    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });

  it("다시 제출하면 이전 실패 안내를 지운다", async () => {
    loginMock.mockRejectedValueOnce(new LoginError(401)).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginForm />);

    await submitValidForm(user);
    await screen.findByRole("alert");
    await user.type(screen.getByLabelText("비밀번호"), "secret");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
