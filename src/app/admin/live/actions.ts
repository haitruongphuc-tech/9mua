'use server';

import { requireAdminVerified } from '@/modules/admin';
import { banUserFromLive, stopLive } from '@/server/live';
import { back } from '../flash';

// Dừng ngay buổi live vi phạm, bắt buộc ghi lý do (SPEC-live.md mục 8). Có nhật ký admin; không thưởng xu.
export async function stopLiveAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  if (reason.length < 3) back('/admin/live', { ok: false, message: 'Cần ghi lý do dừng.' });
  const r = await stopLive(String(form.get('liveId') ?? ''), admin.id, reason);
  back(
    '/admin/live',
    r.ok ? { ok: true, message: 'Đã dừng buổi live.' } : { ok: false, message: 'Buổi live đã kết thúc.' },
  );
}

// Cấm tài khoản phát live 1 / 7 / 30 ngày hoặc vĩnh viễn; đang live thì dừng luôn.
export async function banLiveAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  const raw = String(form.get('days') ?? '');
  const days = raw === '1' ? 1 : raw === '7' ? 7 : raw === '30' ? 30 : raw === 'forever' ? null : undefined;
  if (reason.length < 3 || days === undefined)
    back('/admin/live', { ok: false, message: 'Chọn thời hạn và ghi lý do.' });
  await banUserFromLive(String(form.get('userId') ?? ''), admin.id, days!, reason);
  back('/admin/live', {
    ok: true,
    message: days ? `Đã cấm phát live ${days} ngày.` : 'Đã cấm phát live vĩnh viễn.',
  });
}
