import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

export const metadata: Metadata = {
  title: "My Orbit | 나만의 이야기를 연결하다",
  description: "AI와 함께 나를 발견하고, 디지털 프로필과 NFC 오브제로 기회를 연결하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col"><SessionProvider><ToastProvider>{children}</ToastProvider></SessionProvider></body>
    </html>
  );
}
