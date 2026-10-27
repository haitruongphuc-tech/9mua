import type { Metadata } from 'next';
import Link from 'next/link';
import { V4Page } from '@/components/V4Page';
import { getT } from '@/i18n/server';

export const metadata: Metadata = { title: 'Live', robots: { index: false } };

// Tạm thời cho tới khi làm xong livestream (SPEC-live.md, T49–T57).
export default async function LivePage() {
  const t = await getT();
  return (
    <V4Page className="flex flex-col items-center px-6 py-24 text-center">
      <h1 className="font-display text-[22px] font-bold">{t('live.empty.title')}</h1>
      <p className="mt-2 text-[13px] text-white/60">{t('live.empty.body')}</p>
      <Link
        href="/"
        className="mt-5 inline-flex h-11 items-center rounded-full bg-brand px-6 text-[13px] font-black"
      >
        {t('live.empty.cta')}
      </Link>
    </V4Page>
  );
}
