import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "통합 관리자 포털",
  description: "사내 통합 관리자 포털",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
