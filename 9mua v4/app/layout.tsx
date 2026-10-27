// [LAYOUT-ROOT] Store + Shell (Logo, slogan, search, bottom nav 5 nút) dùng chung 10 trang
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "9MUA.COM - Mở cổng thế giới",
  description: "99% AI + 1 CEO - Kiot $1 mở cổng thế giới",
  icons: { icon: "/logo.jpg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-[#0A0A0A] text-white antialiased">
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
