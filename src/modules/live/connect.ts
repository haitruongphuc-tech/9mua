import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getLive } from './session';
import { viewerKey, type Viewer } from './viewers';

// Tỉ lệ người xem không kết nối được hình (SPEC-live.md "Không cần TURN lúc đầu"): mỗi người xem 1 dòng mỗi buổi.
// Người từng kết nối được thì tính là được, dù có lần lỗi trước hoặc sau đó.
export async function reportConnect(liveId: string, viewer: Viewer, ok: boolean): Promise<boolean> {
  const key = viewerKey(viewer);
  const live = await getLive(liveId);
  if (!key || !live || live.status !== 'live') return false;
  await db.liveConnect.upsert({
    where: { liveId_viewerKey: { liveId, viewerKey: key } },
    create: { liveId, viewerKey: key, ok, createdAt: now() },
    update: ok ? { ok: true } : {},
  });
  return true;
}

export type ConnectStats = { total: number; failed: number };

export async function connectStats(days = 7): Promise<ConnectStats> {
  const since = new Date(now().getTime() - days * 86_400_000);
  const [total, failed] = await Promise.all([
    db.liveConnect.count({ where: { createdAt: { gte: since } } }),
    db.liveConnect.count({ where: { createdAt: { gte: since }, ok: false } }),
  ]);
  return { total, failed };
}

// Cần ít nhất 20 lượt để kết luận; vượt 5% thì CEO thấy đề xuất thêm máy chủ TURN.
export const TURN_MIN_SAMPLES = 20;
export function suggestTurn(s: ConnectStats): boolean {
  return s.total >= TURN_MIN_SAMPLES && s.failed / s.total > 0.05;
}
