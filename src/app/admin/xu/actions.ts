'use server';

import { requireAdminVerified } from '@/modules/admin';
import { revokeXu, setXuRules } from '@/modules/xu';
import { back } from '../flash';

const int = (v: FormDataEntryValue | null) => Number(String(v ?? '').replace(/[^\d]/g, '') || NaN);

// Luật thưởng xu (SPEC-live.md phần 2 mục 9): áp dụng cho buổi live bắt đầu sau khi lưu.
export async function saveXuRulesAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const tiers = [1, 2, 3]
    .map((i) => [int(form.get(`viewers${i}`)), int(form.get(`xu${i}`))])
    .filter(([v, x]) => Number.isFinite(v) && Number.isFinite(x) && v! > 0 && x! > 0);
  const r = await setXuRules(
    { tiers, monthlyBudget: int(form.get('monthlyBudget')), minMinutes: int(form.get('minMinutes')) },
    admin.id,
  );
  back(
    '/admin/xu',
    r.ok ? { ok: true, message: 'Đã lưu luật thưởng xu.' } : { ok: false, message: 'Luật không hợp lệ.' },
  );
}

// Thu hồi xu: 1 dòng trừ kèm lý do, có nhật ký admin.
export async function revokeXuAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await revokeXu(
    String(form.get('userId') ?? ''),
    int(form.get('amount')),
    admin.id,
    String(form.get('reason') ?? ''),
  );
  back(
    '/admin/xu',
    r.ok ? { ok: true, message: 'Đã thu hồi xu.' } : { ok: false, message: 'Cần số xu và lý do.' },
  );
}
