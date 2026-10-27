import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Space_Grotesk } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { MeProvider } from '@/components/MeProvider';
import { SignupPopup } from '@/components/SignupPopup';
import { SiteHeader } from '@/components/SiteHeader';
import { I18nProvider } from '@/i18n/client';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getLang, messagesFor } from '@/i18n/server';
import { env } from '@/lib/env';
import { getIntSetting } from '@/lib/settings';
import { googleMode, hasSessionCookie } from '@/modules/identity';
import './globals.css';

const siteUrl = process.env.APP_URL ?? 'http://localhost:3000';

// Font tiêu đề V4 (class font-display). next/font tải về lúc build và tự phục vụ, không gọi Google khi chạy.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
  // Chỉ dùng cho vài tiêu đề lớn: không tải trước để không tranh băng thông với nội dung chính trên 4G (LCP).
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: '9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất', template: '%s | 9MUA' },
  description: 'Thuê Kiot online 26.000đ/năm, bán hàng trên Chợ 9MUA và video Creator.',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: { type: 'website', locale: 'vi_VN', siteName: '9MUA', images: ['/og-default.png'] },
};

// Mọi trang render theo request để gắn được nonce CSP vào script (T36).
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { themeColor: '#0a0a0a', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const messages = await messagesFor(['common.']);
  // Popup mở tài khoản chỉ cho khách chưa có cookie phiên (không cần hỏi DB).
  const guest = !(await hasSessionCookie());
  const root = env().ROOT_DOMAIN;
  const [freeLimit, voucherThreshold] = guest
    ? await Promise.all([getIntSetting('social_free_daily_limit'), getIntSetting('social_voucher_threshold')])
    : [0, 0];
  return (
    // pb: chừa chỗ cho thanh dưới (64px + viền 1px), hiện trên mọi màn hình như V4.
    // <main> giữ nền trắng cho các trang chưa đổi sang giao diện V4; trang đã đổi (V4Page) làm <main> thành nền đen.
    <html lang={lang} className={spaceGrotesk.variable}>
      <body className="flex min-h-dvh flex-col bg-ink pb-[calc(4rem+1px+env(safe-area-inset-bottom))] text-white">
        <I18nProvider lang={lang} messages={messages}>
          <MeProvider hasSession={!guest}>
            <SiteHeader />
            <main className="flex-1 bg-surface text-brand-ink">{children}</main>
            <SiteFooter />
            {guest ? (
              <Suspense>
                <ClientMessages prefixes={['auth.']}>
                  <SignupPopup
                    cookieDomain={root === 'localhost' ? null : `.${root}`}
                    freeLimit={freeLimit}
                    voucherThreshold={voucherThreshold}
                    googleEnabled={googleMode() !== 'off'}
                  />
                </ClientMessages>
              </Suspense>
            ) : null}
          </MeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
