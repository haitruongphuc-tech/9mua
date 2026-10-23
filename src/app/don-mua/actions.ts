'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/modules/identity';
import { setRefundAccount, submitDispute, transition } from '@/modules/orders';
import '@/server/orders';

export type BuyerActionState = { error?: string; ok?: string };

export async function receiveAction(orderId: string): Promise<void> {
  const user = await requireUser();
  await transition(orderId, 'receive', { userId: user.id, role: 'buyer' });
  revalidatePath(`/don-mua/${orderId}`);
}

const DISPUTE_ERRORS = {
  NOT_FOUND: 'Không tìm thấy đơn.',
  MESSAGE_REQUIRED: 'Hãy mô tả vấn đề (10–2.000 ký tự).',
  INVALID_IMAGES: 'Ảnh không hợp lệ (tối đa 3 ảnh).',
  DISPUTE_WINDOW_CLOSED: 'Đã quá 7 ngày kể từ khi nhận hàng.',
  INVALID_TRANSITION: 'Đơn không còn ở trạng thái có thể khiếu nại.',
} as const;

export async function disputeAction(
  orderId: string,
  _p: BuyerActionState,
  form: FormData,
): Promise<BuyerActionState> {
  const user = await requireUser();
  const result = await submitDispute(user.id, orderId, {
    message: String(form.get('message') ?? ''),
    images: form.getAll('imageIds').map(String),
  });
  if (!result.ok) return { error: DISPUTE_ERRORS[result.error] };
  revalidatePath(`/don-mua/${orderId}`);
  return { ok: 'Đã gửi khiếu nại. 9MUA sẽ xem xét và phản hồi.' };
}

export async function refundAccountAction(
  orderId: string,
  _p: BuyerActionState,
  form: FormData,
): Promise<BuyerActionState> {
  const user = await requireUser();
  const result = await setRefundAccount(user.id, orderId, {
    bankBin: String(form.get('bankBin') ?? ''),
    accountNumber: String(form.get('accountNumber') ?? ''),
    accountName: String(form.get('accountName') ?? ''),
  });
  if (!result.ok)
    return { error: result.error === 'INVALID_INPUT' ? result.message : 'Đơn không ở trạng thái hoàn tiền.' };
  revalidatePath(`/don-mua/${orderId}`);
  return { ok: 'Đã lưu tài khoản nhận hoàn tiền.' };
}
