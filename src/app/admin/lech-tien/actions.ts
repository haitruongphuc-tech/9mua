'use server';

import { requireAdminVerified, resolveIssue } from '@/modules/admin';
import { back } from '../flash';

export async function resolveIssueAction(issueKey: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await resolveIssue(admin.id, issueKey, String(form.get('note') ?? ''));
  back(
    '/admin/lech-tien',
    r.ok
      ? { ok: true, message: 'Đã đánh dấu xử lý.' }
      : {
          ok: false,
          message:
            r.error === 'NOTE_REQUIRED'
              ? 'Hãy ghi cách đã xử lý (ít nhất 5 ký tự).'
              : 'Không tìm thấy giao dịch.',
        },
  );
}
