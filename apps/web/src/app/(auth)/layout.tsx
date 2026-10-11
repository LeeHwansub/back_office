export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f2f2f2] px-4 py-12">
      <main className="w-full max-w-[440px] rounded-lg border border-[#d9d9d9] bg-white px-10 py-12">
        {children}
      </main>
      <footer className="text-xs text-[#8c8c8c]">© (주)OO. 사내 운영 인력 전용 시스템</footer>
    </div>
  );
}
