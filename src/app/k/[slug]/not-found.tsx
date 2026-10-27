import Link from 'next/link';
import { getT } from '@/i18n/server';

export default async function KiotNotFound() {
  const t = await getT();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-[22px] font-black">{t('market.nf.title')}</h1>
      <p className="text-white/70">{t('market.nf.text')}</p>
      <Link
        href={`${process.env.APP_URL ?? ''}/cho`}
        className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[14px] font-black"
      >
        {t('market.nf.go')}
      </Link>
    </section>
  );
}
