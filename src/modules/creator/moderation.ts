import { z } from 'zod';
import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { notifyKey } from '@/lib/notifications';

export const VIDEO_REPORT_REASONS = [
  { value: 'noi_dung_xau', label: 'Nội dung xấu, phản cảm' },
  { value: 'lua_dao', label: 'Lừa đảo' },
  { value: 'ban_quyen', label: 'Vi phạm bản quyền' },
  { value: 'khac', label: 'Khác' },
] as const;
export const VIDEO_AUTO_HIDE_REPORTERS = 5;

const reportInput = z.object({
  reason: z.enum(VIDEO_REPORT_REASONS.map((r) => r.value) as [string, ...string[]], 'Chọn lý do báo cáo'),
  message: z.string().trim().max(1000, 'Mô tả tối đa 1.000 ký tự'),
});

export type VideoActionResult =
  | { ok: true; autoHidden?: boolean }
  | { ok: false; error: 'NOT_FOUND' | 'OWN_VIDEO' | 'REASON_REQUIRED' }
  | { ok: false; error: 'INVALID_INPUT'; message: string };

// Báo cáo video (SPEC-creator.md mục 9): mỗi người 1 lần; 5 người khác nhau thì tự ẩn, chờ CEO xem.
export async function reportVideo(
  userId: string,
  videoId: string,
  reason: string,
  message: string,
): Promise<VideoActionResult> {
  const parsed = reportInput.safeParse({ reason, message });
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
  const video = await db.video.findFirst({ where: { id: videoId, status: 'ready' } });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  if (video.authorId === userId) return { ok: false, error: 'OWN_VIDEO' };
  await db.videoReport.createMany({
    data: [{ videoId, userId, ...parsed.data, createdAt: now() }],
    skipDuplicates: true,
  });
  const reporters = await db.videoReport.count({ where: { videoId, status: 'open' } });
  if (reporters < VIDEO_AUTO_HIDE_REPORTERS) return { ok: true, autoHidden: false };
  const hidden = await db.video.updateMany({
    where: { id: videoId, status: 'ready' },
    data: { status: 'hidden', moderationNote: `Tạm ẩn: ${reporters} người báo cáo, chờ 9MUA xem xét` },
  });
  if (hidden.count)
    await alertCeo(
      'video_auto_hidden',
      `Video "${video.caption.slice(0, 60)}" bị ${reporters} người báo cáo nên đã tự ẩn.`,
    );
  return { ok: true, autoHidden: true };
}

async function removeFiles(v: { fileUrl: string | null; posterUrl: string | null }) {
  const store = imageStore();
  await Promise.all([v.fileUrl && store.remove(v.fileUrl), v.posterUrl && store.remove(v.posterUrl)]);
}

// Người đăng xoá video của mình: gỡ khỏi feed và xoá file. Đơn cũ vẫn giữ mã video nguồn để thống kê.
export async function deleteVideo(videoId: string, userId: string): Promise<VideoActionResult> {
  const video = await db.video.findFirst({
    where: { id: videoId, authorId: userId, status: { not: 'deleted' } },
  });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  await db.video.update({
    where: { id: videoId },
    data: { status: 'deleted', fileUrl: null, posterUrl: null },
  });
  await removeFiles(video);
  return { ok: true };
}

// CEO gỡ video kèm lý do; người đăng nhận thông báo (SPEC-creator.md mục 9).
export async function removeVideo(
  videoId: string,
  adminId: string,
  reason: string,
): Promise<VideoActionResult> {
  const note = reason.trim();
  if (!note) return { ok: false, error: 'REASON_REQUIRED' };
  const video = await db.video.findFirst({ where: { id: videoId, status: { in: ['ready', 'hidden'] } } });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  await db.$transaction([
    db.video.update({
      where: { id: videoId },
      data: { status: 'removed', moderationNote: `9MUA gỡ: ${note.slice(0, 300)}` },
    }),
    db.videoReport.updateMany({ where: { videoId, status: 'open' }, data: { status: 'actioned' } }),
  ]);
  await notifyKey(video.authorId, 'notify.videoRemoved', { detail: note }, '/video/cua-toi');
  return { ok: true };
}

// CEO xem xong báo cáo và thấy video không vi phạm: hiện lại.
export async function restoreVideo(videoId: string): Promise<VideoActionResult> {
  const updated = await db.video.updateMany({
    where: { id: videoId, status: 'hidden' },
    data: { status: 'ready', moderationNote: null },
  });
  if (!updated.count) return { ok: false, error: 'NOT_FOUND' };
  await db.videoReport.updateMany({ where: { videoId, status: 'open' }, data: { status: 'dismissed' } });
  return { ok: true };
}

export async function listVideoReports() {
  const reports = await db.videoReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const ids = [...new Set(reports.map((r) => r.videoId))];
  const videos = await db.video.findMany({ where: { id: { in: ids } } });
  const byId = new Map(videos.map((v) => [v.id, v]));
  return ids
    .map((id) => {
      const rs = reports.filter((r) => r.videoId === id);
      const v = byId.get(id);
      return {
        videoId: id,
        caption: v?.caption ?? '',
        status: v?.status ?? 'deleted',
        posterUrl: v?.posterUrl ?? null,
        reporters: rs.length,
        reasons: rs.reduce<Record<string, number>>(
          (acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }),
          {},
        ),
        messages: rs
          .map((r) => r.message)
          .filter(Boolean)
          .slice(0, 10),
        lastAt: rs[0]!.createdAt,
      };
    })
    .sort((a, b) => b.reporters - a.reporters);
}

// Video xử lý lỗi nhiều lần (lỗi hệ thống, không phải video quá dài) để CEO kiểm tra worker.
export async function listFailedVideoJobs(days = 7) {
  const since = new Date(now().getTime() - days * 86_400_000);
  const jobs = await db.videoJob.findMany({
    where: { status: 'failed', attempts: { gte: 3 }, updatedAt: { gte: since } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return jobs.map((j) => ({ videoId: j.videoId, attempts: j.attempts, error: j.error, at: j.updatedAt }));
}
