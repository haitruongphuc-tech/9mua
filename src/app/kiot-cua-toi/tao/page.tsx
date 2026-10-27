import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { getKiotFee } from '@/modules/billing';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { createKiotAction } from '../actions';
import { KiotForm } from '../KiotForm';

export const metadata: Metadata = { title: 'Tạo Kiot', robots: { index: false } };

export default async function CreateKiotPage() {
  const user = await requireUser();
  if (await getKiotByOwner(user.id)) redirect('/kiot-cua-toi');
  const [t, fee] = await Promise.all([getT(), getKiotFee()]);
  return (
    <section className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="mb-1 font-display text-[22px] font-black">{t('seller.create.title')}</h1>
      <p className="mb-6 text-white/70">{t('seller.create.text', { fee: formatVnd(fee) })}</p>
      <KiotForm
        action={createKiotAction}
        rootDomain={env().ROOT_DOMAIN}
        submitLabel={t('seller.create.submit')}
      />
    </section>
  );
}
