'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatVnd, parseVndInput } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { cancelPayout, payoutQuote, requestPayout, type RequestPayoutError } from '@/modules/payouts';

export type PayoutRequestState = { error?: string; amount?: string };

const ERRORS: Record<RequestPayoutError, string> = {
  NOT_FOUND: 'Bạn chưa có Kiot.',
  KYC_REQUIRED: 'Bạn cần xác minh danh tính (CCCD) trước lần rút đầu tiên.',
  BELOW_MIN: 'Số tiền rút thấp hơn mức tối thiểu.',
  INSUFFICIENT: 'Số tiền rút lớn hơn số dư có thể rút.',
  HAS_PENDING: 'Bạn đang có một yêu cầu rút chờ xử lý.',
  NO_ACCOUNT: 'Bạn chưa khai báo tài khoản nhận tiền.',
  ACCOUNT_RECENTLY_CHANGED: 'Tài khoản nhận tiền vừa đổi, cần chờ đủ 24 giờ mới rút được.',
};

export async function requestPayoutAction(
  _p: PayoutRequestState,
  form: FormData,
): Promise<PayoutRequestState> {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  const raw = String(form.get('amount') ?? '');
  if (!kiot) return { error: ERRORS.NOT_FOUND, amount: raw };
  const amount = parseVndInput(raw) ?? 0;
  const result = await requestPayout(kiot.id, user.id, amount);
  if (!result.ok) {
    const error =
      result.error === 'BELOW_MIN'
        ? `Số tiền rút tối thiểu ${formatVnd((await payoutQuote(amount)).min)} và phải lớn hơn phí chi hộ.`
        : ERRORS[result.error];
    return { error, amount: raw };
  }
  revalidatePath('/kiot-cua-toi/so-du');
  redirect(`/kiot-cua-toi/so-du?da-gui=${result.code}`);
}

export async function cancelPayoutAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await cancelPayout(String(form.get('payoutId') ?? ''), user.id);
  revalidatePath('/kiot-cua-toi/so-du');
  redirect('/kiot-cua-toi/so-du');
}
