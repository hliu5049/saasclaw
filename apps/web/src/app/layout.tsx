import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}
