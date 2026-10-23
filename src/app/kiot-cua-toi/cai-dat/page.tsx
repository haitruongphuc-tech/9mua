import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { requireUser } from '@/modules/identity';
import { BANKS, getKiotByOwner, getPayoutAccount } from '@/modules/kiot';
import { updateKiotAction } from '../actions';
import { KiotForm } from '../KiotForm';
import { PayoutAccountForm } from './PayoutAccountForm';

export const metadata: Metadata = { title: 'Cài đặt Kiot', robots: { index: false } };

export default async function KiotSettingsPage() {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const payout = await getPayoutAccount(kiot.id);
  return (
    <section className="flex flex-col gap-6 px-4 py-6">
      <div className="rounded-2xl border-2 border-black/10 p-5">
        <h1 className="mb-4 text-lg font-extrabold">Thông tin Kiot</h1>
        <KiotForm
          action={updateKiotAction}
          rootDomain={env().ROOT_DOMAIN}
          slugLocked={kiot.activeUntil !== null}
          submitLabel="Lưu thông tin"
          initial={{
            name: kiot.name,
            slug: kiot.slug,
            description: kiot.description,
            contactPhone: '0' + kiot.contactPhone.slice(3),
          }}
        />
      </div>
      <div className="rounded-2xl border-2 border-black/10 p-5">
        <h2 className="mb-4 text-lg font-extrabold">Tài khoản nhận tiền</h2>
        <PayoutAccountForm banks={BANKS} current={payout} />
      </div>
    </section>
  );
}
