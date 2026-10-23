'use server';

import { requireAdminVerified, resolveProductReport, resolveVideoReport } from '@/modules/admin';
import { back } from '../flash';

export async function resolveProductAction(
  productId: string,
  decision: 'remove' | 'dismiss',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await resolveProductReport(admin.id, productId, decision, String(form.get('reason') ?? ''));
  back(
    '/admin/bao-cao',
    r.ok
      ? { ok: true, message: decision === 'remove' ? 'Đã gỡ sản phẩm.' : 'Đã bỏ qua báo cáo.' }
      : {
          ok: false,
          message: r.error === 'REASON_REQUIRED' ? 'Hãy ghi lý do gỡ.' : 'Báo cáo đã được xử lý.',
        },
  );
}

export async function resolveVideoAction(
  videoId: string,
  decision: 'remove' | 'restore',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await resolveVideoReport(admin.id, videoId, decision, String(form.get('reason') ?? ''));
  back(
    '/admin/bao-cao',
    r.ok
      ? {
          ok: true,
          message: decision === 'remove' ? 'Đã gỡ video, người đăng được thông báo.' : 'Đã hiện lại video.',
        }
      : {
          ok: false,
          message: r.error === 'REASON_REQUIRED' ? 'Hãy ghi lý do gỡ.' : 'Video không còn ở trạng thái này.',
        },
  );
}
