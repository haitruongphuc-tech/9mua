'use server';

import { requireAdminVerified, resolveDispute } from '@/modules/admin';
import { back } from '../flash';

export async function resolveDisputeAction(
  orderId: string,
  decision: 'refund' | 'release',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await resolveDispute(admin.id, orderId, decision, String(form.get('reason') ?? ''));
  back(
    '/admin/khieu-nai',
    r.ok
      ? {
          ok: true,
          message:
            decision === 'refund'
              ? 'Đã chuyển đơn sang chờ hoàn tiền.'
              : 'Đã trả tiền cho người bán (đơn hoàn tất).',
        }
      : {
          ok: false,
          message:
            r.error === 'REASON_REQUIRED'
              ? 'Hãy ghi lý do (ít nhất 5 ký tự).'
              : 'Đơn đã đổi trạng thái, hãy tải lại.',
        },
  );
}
