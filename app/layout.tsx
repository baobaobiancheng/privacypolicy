import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知证 · 隐私政策协作生成器",
  description: "先确认产品事实，再生成可追溯、可复核的隐私政策工作草稿。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
