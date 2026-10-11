import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthLayout from "./layout";

describe("AuthLayout", () => {
  it("페이지 내용을 표시한다", () => {
    render(
      <AuthLayout>
        <p>페이지 내용</p>
      </AuthLayout>,
    );

    expect(screen.getByText("페이지 내용")).toBeInTheDocument();
  });

  it("바닥글에 저작권 문구를 표시한다", () => {
    render(
      <AuthLayout>
        <p>페이지 내용</p>
      </AuthLayout>,
    );

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "© (주)OO. 사내 운영 인력 전용 시스템",
    );
  });
});
