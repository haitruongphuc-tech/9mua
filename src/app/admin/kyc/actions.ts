'use server';

import { requireAdminVerified, reviewKycSubmission } from '@/modules/admin';
import { back } from '../flash';

const ERR: Record<string, string> = {
  NOT_FOUND: 'Không tìm thấy hồ sơ.',
  REASON_REQUIRED: 'Hãy ghi lý do từ chối.',
  ALREADY_REVIEWED: 'Hồ sơ đã được duyệt trước đó.',
};

export async function reviewKycAction(
  kycId: string,
  decision: 'approve' | 'reject',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await reviewKycSubmission(admin.id, kycId, decision, String(form.get('reason') ?? ''));
  back(
    '/admin/kyc',
    r.ok
      ? { ok: true, message: decision === 'approve' ? 'Đã duyệt CCCD.' : 'Đã từ chối hồ sơ.' }
      : { ok: false, message: ERR[r.error] ?? r.error },
  );
}
