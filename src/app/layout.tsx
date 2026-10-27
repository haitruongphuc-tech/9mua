import type { Metadata, Viewport } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const siteUrl = process.env.APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: '9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất', template: '%s | 9MUA' },
  description: 'Thuê Kiot online 26.000đ/năm, bán hàng trên Chợ 9MUA và video Creator.',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: { type: 'website', locale: 'vi_VN', siteName: '9MUA', images: ['/og-default.png'] },
};

// Mọi trang render theo request để gắn được nonce CSP vào script (T36).
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { themeColor: '#fc6f15', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // pb: chừa chỗ cho thanh điều hướng dưới trên điện thoại (BottomNav).
    <html lang="vi">
      <body className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
