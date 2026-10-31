'use server';

import { audit } from '@/lib/audit';
import { requireAdminVerified } from '@/modules/admin';
import { reviewOrigin } from '@/modules/kiot';
import { back } from '../flash';

export async function reviewOriginAction(
  dossierId: string,
  decision: 'approve' | 'reject' | 'revoke',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  const ok = await reviewOrigin(admin.id, dossierId, decision, reason);
  if (ok)
    await audit({
      adminId: admin.id,
      action: `origin.${decision}`,
      targetType: 'origin',
      targetId: dossierId,
      reason: reason || null,
    });
  back(
    '/admin/nguon-goc',
    ok
      ? {
          ok: true,
          message:
            decision === 'approve'
              ? 'Đã duyệt hồ sơ.'
              : decision === 'reject'
                ? 'Đã từ chối hồ sơ.'
                : 'Đã thu hồi.',
        }
      : { ok: false, message: 'Hồ sơ đã được xử lý hoặc thiếu lý do.' },
  );
}
