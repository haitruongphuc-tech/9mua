'use server';

import { requireAdminVerified } from '@/modules/admin';
import { confirmFakeReport, rejectFakeReport } from '@/server/fake-reports';
import { back } from '../flash';

export async function confirmFakeAction(reportId: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await confirmFakeReport(admin.id, reportId, String(form.get('reason') ?? ''));
  back(
    '/admin/hang-gia',
    r.ok
      ? {
          ok: true,
          message: r.refunded
            ? 'Đã xác nhận hàng giả và chuyển đơn sang hoàn tiền.'
            : 'Đã xác nhận hàng giả.',
        }
      : { ok: false, message: r.error === 'REASON_REQUIRED' ? 'Cần ghi kết luận.' : 'Tố cáo đã được xử lý.' },
  );
}

export async function rejectFakeAction(reportId: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const ok = await rejectFakeReport(admin.id, reportId, String(form.get('reason') ?? ''));
  back(
    '/admin/hang-gia',
    ok
      ? { ok: true, message: 'Đã bác tố cáo.' }
      : { ok: false, message: 'Cần lý do, hoặc tố cáo đã được xử lý.' },
  );
}
