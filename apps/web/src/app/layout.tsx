import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise OpenClaw",
  description: "Enterprise OpenClaw Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
