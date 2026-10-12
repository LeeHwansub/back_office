import { describe, expect, it, vi } from "vitest";
import Home from "./page";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("Home", () => {
  it("첫 화면에 접속하면 로그인 화면(/login)으로 이동한다", () => {
    Home();

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
