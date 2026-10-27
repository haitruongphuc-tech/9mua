'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { formatVnd, parseVndInput } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { cancelPayout, payoutQuote, requestPayout } from '@/modules/payouts';

export type PayoutRequestState = { error?: string; amount?: string };

export async function requestPayoutAction(
  _p: PayoutRequestState,
  form: FormData,
): Promise<PayoutRequestState> {
  const user = await requireUser();
  const t = await getT();
  const kiot = await getKiotByOwner(user.id);
  const raw = String(form.get('amount') ?? '');
  if (!kiot) return { error: t('seller.wd.err.NOT_FOUND'), amount: raw };
  const amount = parseVndInput(raw) ?? 0;
  const result = await requestPayout(kiot.id, user.id, amount);
  if (!result.ok) {
    const error =
      result.error === 'BELOW_MIN'
        ? t('seller.wd.err.min', { min: formatVnd((await payoutQuote(amount)).min) })
        : t(`seller.wd.err.${result.error}`);
    return { error, amount: raw };
  }
  revalidatePath('/kiot-cua-toi/so-du');
  redirect(`/kiot-cua-toi/so-du?da-gui=${result.code}${result.mode === 'auto' ? '&tu-dong=1' : ''}`);
}

export async function cancelPayoutAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await cancelPayout(String(form.get('payoutId') ?? ''), user.id);
  revalidatePath('/kiot-cua-toi/so-du');
  redirect('/kiot-cua-toi/so-du');
}
