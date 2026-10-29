import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { getKiotFee } from '@/modules/billing';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { ClientMessages } from '@/i18n/ClientMessages';
import { hasContact, requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { createKiotAction } from '../actions';
import { KiotForm } from '../KiotForm';

export const metadata: Metadata = { title: 'Tạo Kiot', robots: { index: false } };

export default async function CreateKiotPage() {
  const user = await requireUser();
  if (await getKiotByOwner(user.id)) redirect('/kiot-cua-toi');
  const [t, fee] = await Promise.all([getT(), getKiotFee()]);
  // Tài khoản Zalo/Facebook chưa có email hay SĐT: thêm email (xác nhận bằng mã) trước (SPEC-identity.md bổ sung 29/10).
  if (!hasContact(user))
    return (
      <section className="mx-auto w-full max-w-md px-4 py-8" data-testid="add-email-gate">
        <h1 className="mb-1 font-display text-[22px] font-black">{t('auth.addEmail.title')}</h1>
        <p className="mb-6 text-white/70">{t('auth.addEmail.lead')}</p>
        <ClientMessages prefixes={['auth.']}>
          <EmailOtpForm mode="add-email" />
        </ClientMessages>
      </section>
    );
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
