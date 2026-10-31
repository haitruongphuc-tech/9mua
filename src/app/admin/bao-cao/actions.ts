'use server';

import { requireAdminVerified, resolveProductReport, resolveVideoReport } from '@/modules/admin';
import { audit } from '@/lib/audit';
import { resolvePostReports } from '@/modules/creator';
import { resolveEventReports, resolveGroupReports } from '@/modules/social';

// Nhóm bị báo cáo (SPEC-social.md V5.10 mục 5): CEO khoá nhóm kèm lý do hoặc bỏ qua.
export async function resolveGroupAction(
  groupId: string,
  decision: 'lock' | 'dismiss',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const reason = String(form.get('reason') ?? '').trim();
  const ok = await resolveGroupReports(groupId, decision, reason);
  if (ok)
    await audit({
      adminId: admin.id,
      action: `group.${decision}`,
      targetType: 'group',
      targetId: groupId,
      reason: reason || null,
    });
  back(
    '/admin/bao-cao',
    ok
      ? { ok: true, message: decision === 'lock' ? 'Đã khoá nhóm.' : 'Đã bỏ qua báo cáo.' }
      : { ok: false, message: 'Nhóm không còn.' },
  );
}

// Sự kiện bị báo cáo (SPEC-social.md V5.7): gỡ hoặc bỏ qua (sự kiện tự ẩn thì hiện lại).
export async function resolveEventAction(eventId: string, decision: 'remove' | 'dismiss'): Promise<void> {
  const admin = await requireAdminVerified();
  const ok = await resolveEventReports(eventId, decision);
  if (ok)
    await audit({ adminId: admin.id, action: `event.${decision}`, targetType: 'event', targetId: eventId });
  back(
    '/admin/bao-cao',
    ok
      ? { ok: true, message: decision === 'remove' ? 'Đã gỡ sự kiện.' : 'Đã bỏ qua báo cáo.' }
      : { ok: false, message: 'Sự kiện không còn.' },
  );
}
import { back } from '../flash';

// Bài viết bị báo cáo (SPEC-creator.md V5.10 mục 3): gỡ bài hoặc bỏ qua (bài tự ẩn thì hiện lại).
export async function resolvePostAction(
  postId: string,
  decision: 'remove' | 'dismiss',
  form: FormData,
): Promise<void> {
  const admin = await requireAdminVerified();
  const reason =
    String(form.get('reason') ?? '')
      .trim()
      .slice(0, 300) || null;
  if (decision === 'remove' && !reason) back('/admin/bao-cao', { ok: false, message: 'Hãy ghi lý do gỡ.' });
  const ok = await resolvePostReports(postId, decision, reason);
  if (ok)
    await audit({
      adminId: admin.id,
      action: `post.${decision}`,
      targetType: 'post',
      targetId: postId,
      reason,
    });
  back(
    '/admin/bao-cao',
    ok
      ? { ok: true, message: decision === 'remove' ? 'Đã gỡ bài viết.' : 'Đã bỏ qua báo cáo.' }
      : { ok: false, message: 'Bài viết không còn.' },
  );
}

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
