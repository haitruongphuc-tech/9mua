import Link from 'next/link';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';

const TABS = [
  { href: '/kiot-cua-toi', key: 'seller.nav.overview' },
  { href: '/kiot-cua-toi/san-pham', key: 'seller.nav.products' },
  { href: '/kiot-cua-toi/don-hang', key: 'seller.nav.orders' },
  { href: '/kiot-cua-toi/so-du', key: 'seller.nav.balance' },
  { href: '/kiot-cua-toi/thanh-toan', key: 'seller.nav.billing' },
  { href: '/kiot-cua-toi/cai-dat', key: 'seller.nav.settings' },
] as const;

// Khu "Kiot của tôi" (V4): thanh tab trên nền đen; các form bên trong dùng chữ nhóm "seller." đã dịch.
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [kiot, t] = await Promise.all([getKiotByOwner(user.id), getT()]);
  return (
    <div className="mx-auto w-full max-w-3xl">
      {kiot ? (
        <nav
          aria-label={t('seller.nav.aria')}
          className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10 px-4 pt-3"
        >
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="shrink-0 rounded-t-[12px] px-4 py-2 text-[13px] font-bold text-white/70 hover:bg-white/5 hover:text-white"
            >
              {t(tab.key)}
            </Link>
          ))}
        </nav>
      ) : null}
      <ClientMessages prefixes={['seller.', 'market.cat.']}>{children}</ClientMessages>
    </div>
  );
}
