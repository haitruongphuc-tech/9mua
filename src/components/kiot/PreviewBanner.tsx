import Link from 'next/link';
import { getT } from '@/i18n/server';

export async function PreviewBanner() {
  const t = await getT();
  return (
    <p
      role="status"
      data-testid="preview-banner"
      className="rounded-[14px] border border-brand/40 bg-brand/15 px-4 py-3 text-[13px] font-bold"
    >
      {t('market.preview.text')}{' '}
      <Link href={`${process.env.APP_URL ?? ''}/kiot-cua-toi`} className="text-brand underline">
        {t('market.preview.manage')}
      </Link>
    </p>
  );
}
