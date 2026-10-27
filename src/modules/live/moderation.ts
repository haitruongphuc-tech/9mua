import { alertCeo } from '@/lib/alerts';
import { audit } from '@/lib/audit';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { finishLive, getLive, OPEN } from './session';

// Báo cáo và xử lý vi phạm (SPEC-live.md mục 8).
export const LIVE_REPORT_REASONS = ['bad_content', 'scam', 'copyright', 'other'] as const;
export type LiveReportReason = (typeof LIVE_REPORT_REASONS)[number];
export const LIVE_AUTO_HIDE_REPORTERS = 5;

export async function reportLive(
  userId: string,
  liveId: string,
  reason: string,
  message?: string,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'INVALID' | 'ALREADY' }> {
  const r = LIVE_REPORT_REASONS.find((x) => x === reason);
  if (!r) return { ok: false, error: 'INVALID' };
  const live = await getLive(liveId);
  if (!live || live.hostUserId === userId) return { ok: false, error: 'NOT_FOUND' };
  try {
    await db.liveReport.create({
      data: { liveId, userId, reason: r, message: message?.slice(0, 500) || null, createdAt: now() },
    });
  } catch {
    return { ok: false, error: 'ALREADY' }; // mỗi người báo 1 lần mỗi buổi
  }
  const reporters = await db.liveReport.count({ where: { liveId } });
  if (reporters >= LIVE_AUTO_HIDE_REPORTERS && !live.hiddenAt) {
    const { count } = await db.liveSession.updateMany({
      where: { id: liveId, hiddenAt: null },
      data: { hiddenAt: now() },
    });
    if (count)
      await alertCeo(
        'live_reported',
        `Buổi live "${live.title}" bị ${reporters} người báo cáo, đã ẩn khỏi danh sách Live. Xem ở /admin/live.`,
      );
  }
  return { ok: true };
}

export async function stopLive(liveId: string, adminId: string, reason: string): Promise<{ ok: boolean }> {
  if (!reason.trim()) return { ok: false };
  const stopped = await finishLive(liveId, 'stopped', reason.trim());
  if (stopped)
    await audit({
      adminId,
      action: 'live.stop',
      targetType: 'live',
      targetId: liveId,
      reason: reason.trim(),
    });
  return { ok: stopped };
}

// Cấm phát live 1 / 7 / 30 ngày hoặc vĩnh viễn (null). Đang live thì dừng luôn.
export async function banUserFromLive(
  userId: string,
  adminId: string,
  days: 1 | 7 | 30 | null,
  reason: string,
): Promise<void> {
  const until = days ? new Date(now().getTime() + days * 86_400_000) : null;
  await db.liveBan.create({
    data: { userId, until, reason: reason.trim().slice(0, 300), adminId, createdAt: now() },
  });
  await audit({
    adminId,
    action: 'live.ban',
    targetType: 'user',
    targetId: userId,
    reason: reason.trim(),
    after: { days },
  });
  const open = await db.liveSession.findFirst({ where: { hostUserId: userId, status: { in: OPEN } } });
  if (open) await finishLive(open.id, 'stopped', `Bị cấm live: ${reason.trim()}`);
}

// Cho /admin/live: buổi đang mở + 30 buổi gần nhất, kèm số báo cáo.
export async function listLivesForAdmin() {
  const lives = await db.liveSession.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const [reports, hosts] = await Promise.all([
    db.liveReport.groupBy({
      by: ['liveId'],
      where: { liveId: { in: lives.map((l) => l.id) } },
      _count: true,
    }),
    db.user.findMany({
      where: { id: { in: lives.map((l) => l.hostUserId) } },
      select: { id: true, displayName: true, phone: true },
    }),
  ]);
  return lives.map((l) => ({
    ...l,
    reports: reports.find((r) => r.liveId === l.id)?._count ?? 0,
    host: hosts.find((h) => h.id === l.hostUserId) ?? null,
  }));
}
