'use server';

import { redirect } from 'next/navigation';
import { startKiotPayment } from '@/modules/billing';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import '@/server/payments';

export async function startKiotPaymentAction(): Promise<void> {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const result = await startKiotPayment(kiot.id, user.id);
  if (!result.ok) redirect('/kiot-cua-toi?loi-thanh-toan=1');
  redirect(`/kiot-cua-toi/thanh-toan/${result.intentId}`);
}
