'use server';

import { markOrderRefunded, requireAdminVerified } from '@/modules/admin';
import { back } from '../flash';

export async function markRefundedAction(orderId: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await markOrderRefunded(admin.id, orderId, String(form.get('refundRef') ?? ''));
  back(
    '/admin/hoan-tien',
    r.ok
      ? { ok: true, message: 'Đã ghi nhận hoàn tiền, người mua được báo qua email.' }
      : {
          ok: false,
          message:
            r.error === 'INVALID_INPUT'
              ? 'Hãy nhập mã giao dịch ngân hàng.'
              : 'Đơn đã đổi trạng thái, hãy tải lại.',
        },
  );
}
