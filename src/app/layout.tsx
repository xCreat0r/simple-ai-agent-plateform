import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Platform",
  description: "AI Agent Platform MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-white text-gray-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
