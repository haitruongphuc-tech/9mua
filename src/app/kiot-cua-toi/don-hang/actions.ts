'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/modules/identity';
import { transition, type OrderAction } from '@/modules/orders';

export type SellerActionState = { error?: string };

const ERRORS = {
  NOT_FOUND: 'Không tìm thấy đơn.',
  INVALID_TRANSITION: 'Đơn đã đổi trạng thái, hãy tải lại trang.',
  REASON_REQUIRED: 'Hãy ghi lý do (ít nhất 5 ký tự).',
  INVALID_INPUT: 'Thông tin không hợp lệ.',
} as const;

const SELLER_ACTIONS = new Set<OrderAction>(['confirm', 'reject', 'ship', 'seller_cancel']);

export async function sellerOrderAction(
  orderId: string,
  _p: SellerActionState,
  form: FormData,
): Promise<SellerActionState> {
  const user = await requireUser();
  const action = String(form.get('action')) as OrderAction;
  if (!SELLER_ACTIONS.has(action)) return { error: ERRORS.INVALID_TRANSITION };
  const result = await transition(
    orderId,
    action,
    { userId: user.id, role: 'seller' },
    {
      reason: String(form.get('reason') ?? ''),
      trackingCode: String(form.get('trackingCode') ?? ''),
      carrier: String(form.get('carrier') ?? ''),
    },
  );
  if (!result.ok) return { error: ERRORS[result.error] };
  revalidatePath('/kiot-cua-toi/don-hang', 'layout');
  return {};
}
