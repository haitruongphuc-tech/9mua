import Link from 'next/link';
import { LogoV4 } from '@/components/LogoV4';
import { getT } from '@/i18n/server';

// Trang 404 chung kiểu V4, theo ngôn ngữ đang chọn.
export default async function NotFound() {
  const t = await getT();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <LogoV4 size={72} />
      <h1 className="font-display text-[22px] font-black">{t('common.nf.title')}</h1>
      <p className="text-white/60">{t('common.nf.text')}</p>
      <Link
        href="/"
        className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[14px] font-black"
      >
        {t('common.nf.home')}
      </Link>
    </section>
  );
}
