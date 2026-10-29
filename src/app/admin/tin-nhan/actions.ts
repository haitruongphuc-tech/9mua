'use server';

import { requireAdminVerified } from '@/modules/admin';
import { banFromMessages, hideMessage, markReportsHandled } from '@/modules/messages';
import { back } from '../flash';

const page = (form: FormData) => `/admin/tin-nhan/${String(form.get('conversationId') ?? '')}`;

// Ẩn một tin vi phạm, bắt buộc ghi lý do (SPEC-messages.md mục 7). Có nhật ký admin.
export async function hideMessageAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  if (reason.length < 3) back(page(form), { ok: false, message: 'Cần ghi lý do ẩn.' });
  const r = await hideMessage(admin.id, String(form.get('messageId') ?? ''), reason);
  back(
    page(form),
    r.ok ? { ok: true, message: 'Đã ẩn tin nhắn.' } : { ok: false, message: 'Tin đã ẩn rồi.' },
  );
}

// Cấm nhắn tin 1 / 7 / 30 ngày hoặc vĩnh viễn.
export async function banMessagesAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  const raw = String(form.get('days') ?? '');
  const days =
    raw === '1' ? 1 : raw === '7' ? 7 : raw === '30' ? 30 : raw === 'forever' ? 'forever' : undefined;
  if (reason.length < 3 || days === undefined)
    back(page(form), { ok: false, message: 'Chọn thời hạn và ghi lý do.' });
  await banFromMessages(admin.id, String(form.get('userId') ?? ''), days!, reason);
  back(page(form), {
    ok: true,
    message: days === 'forever' ? 'Đã cấm nhắn tin vĩnh viễn.' : `Đã cấm nhắn tin ${days} ngày.`,
  });
}

export async function markHandledAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  await markReportsHandled(admin.id, String(form.get('conversationId') ?? ''));
  back('/admin/tin-nhan', { ok: true, message: 'Đã đánh dấu xử lý xong.' });
}
