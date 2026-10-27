import type { Metadata } from 'next';
import Link from 'next/link';
import { StoriesRow } from '@/components/live/StoriesRow';
import { V4Page } from '@/components/V4Page';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { listStories } from '@/modules/creator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Live', robots: { index: false } };

// Trang Live (V4): hàng Story 24 giờ ở đầu; danh sách buổi live làm ở T49–T57 (SPEC-live.md).
export default async function LivePage() {
  const [t, stories] = await Promise.all([getT(), listStories()]);
  return (
    <V4Page className="flex flex-col">
      <ClientMessages prefixes={['live.']}>
        <StoriesRow groups={stories} />
      </ClientMessages>
      <div className="flex flex-col items-center px-6 py-20 text-center">
        <h1 className="font-display text-[22px] font-bold">{t('live.empty.title')}</h1>
        <p className="mt-2 text-[13px] text-white/60">{t('live.empty.body')}</p>
        <Link
          href="/"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-brand px-6 text-[13px] font-black"
        >
          {t('live.empty.cta')}
        </Link>
      </div>
    </V4Page>
  );
}
