import type { Metadata } from 'next';
import Link from 'next/link';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import {
  availableNetworks,
  getSocialLinks,
  importedPages,
  lookupPages,
  PLATFORM_LIST,
} from '@/modules/social';
import { isFeatureOn } from '@/lib/features';
import { ImportPages } from './ImportPages';
import { kiotCanonical } from '../k/kiot-context';
import { ConnectForm } from './ConnectForm';

export const metadata: Metadata = { title: 'Kết nối mạng xã hội', robots: { index: false } };

// Social Connect bản thật (SPEC-kiot.md bổ sung 27/10): chỉ gắn link, không lấy số follower của mạng khác.
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ nhap?: string; q?: string; 'loi-nhap'?: string }>;
}) {
  const user = await requireUser();
  // Nhập Page (SPEC-kiot.md V5.4), công tắc page_import (tắt sẵn, mạng nào có khoá mới hiện).
  const query = await searchParams;
  const importOn = await isFeatureOn('page_import');
  const networks = importOn ? availableNetworks() : [];
  const network = networks.find((n) => n === query.nhap) ?? null;
  const q = (query.q ?? '').trim().slice(0, 200);
  const [found, imported] = importOn
    ? await Promise.all([network && q ? lookupPages(network, q) : [], importedPages(user.id)])
    : [[], []];
  const [links, kiot, t] = await Promise.all([getSocialLinks(user.id), getKiotByOwner(user.id), getT()]);
  const count = PLATFORM_LIST.filter((p) => links[p]).length;
  return (
    <ClientMessages prefixes={['profile.connect.']}>
      <div>
        <div className="mx-auto max-w-[760px] px-4 py-5">
          <h1 className="font-display text-[22px] font-black md:text-[28px]">{t('profile.connect.title')}</h1>
          <p className="mt-1 text-[13px] text-white/60">{t('profile.connect.intro')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/50">{t('profile.connect.linked')}</p>
              <p className="text-[20px] font-black" data-testid="connect-count">
                {count}/{PLATFORM_LIST.length}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-1 rounded-[14px] bg-brand p-3 text-[12px] font-bold">
              <Link href={`/creator/${user.id}`} className="underline-offset-2 hover:underline">
                {t('profile.connect.viewCreator')} →
              </Link>
              {kiot ? (
                <a href={kiotCanonical(kiot.slug)} className="underline-offset-2 hover:underline">
                  {t('profile.connect.viewKiot')} →
                </a>
              ) : null}
            </div>
          </div>
          <ConnectForm links={links} />
          {importOn && networks.length ? (
            <div id="nhap-page">
              <ImportPages
                networks={networks}
                network={network}
                q={q}
                found={found}
                imported={imported}
                error={query['loi-nhap'] ?? null}
                t={t}
              />
            </div>
          ) : null}
          <p className="mt-4 text-[11px] text-white/40">{t('profile.connect.note')}</p>
        </div>
      </div>
    </ClientMessages>
  );
}
