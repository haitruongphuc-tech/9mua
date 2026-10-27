import type { Metadata } from 'next';
import Link from 'next/link';
import { V4Page } from '@/components/V4Page';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { getSocialLinks, PLATFORM_LIST } from '@/modules/social';
import { kiotCanonical } from '../k/kiot-context';
import { ConnectForm } from './ConnectForm';

export const metadata: Metadata = { title: 'Kết nối mạng xã hội', robots: { index: false } };

// Social Connect bản thật (SPEC-kiot.md bổ sung 27/10): chỉ gắn link, không lấy số follower của mạng khác.
export default async function ConnectPage() {
  const user = await requireUser();
  const [links, kiot, t] = await Promise.all([getSocialLinks(user.id), getKiotByOwner(user.id), getT()]);
  const count = PLATFORM_LIST.filter((p) => links[p]).length;
  return (
    <ClientMessages prefixes={['profile.connect.']}>
      <V4Page>
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
          <p className="mt-4 text-[11px] text-white/40">{t('profile.connect.note')}</p>
        </div>
      </V4Page>
    </ClientMessages>
  );
}
