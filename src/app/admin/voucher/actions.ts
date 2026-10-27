'use server';

import { requireAdminVerified } from '@/modules/admin';
import { revokeVoucher } from '@/modules/social';
import { back } from '../flash';

// Thu hồi voucher CHƯA dùng, bắt buộc ghi lý do (SPEC-social.md mục 8). Có ghi nhật ký admin.
export async function revokeVoucherAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  if (reason.length < 3) back('/admin/voucher', { ok: false, message: 'Cần ghi lý do thu hồi.' });
  const r = await revokeVoucher(String(form.get('voucherId') ?? ''), admin.id, reason);
  back(
    '/admin/voucher',
    r.ok
      ? { ok: true, message: 'Đã thu hồi voucher.' }
      : { ok: false, message: 'Voucher đã dùng hoặc đã bị thu hồi.' },
  );
}
