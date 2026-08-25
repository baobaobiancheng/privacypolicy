import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "百鉴 · 隐私政策",
  description: "结构化收集产品事实，智能补充遗漏信息，生成可预览和下载的隐私政策。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
