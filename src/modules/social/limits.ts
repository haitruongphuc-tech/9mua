import { db } from '@/lib/db';
import { getIntSetting } from '@/lib/settings';
import { getKiotByOwner, isKiotActive } from '@/modules/kiot';
import { vnDay } from './day';

// Tài khoản Free = chưa có Kiot đang hoạt động và không phải admin (SPEC-social.md mục 7).
export async function isFreeAccount(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role === 'admin') return false;
  const kiot = await getKiotByOwner(userId);
  return !(kiot && isKiotActive(kiot));
}

// Dùng 1 lượt tim/follow mới. Cộng nguyên tử: chỉ tăng khi còn dưới giới hạn, hai request cùng lúc không vượt.
export async function consumeDailyAction(userId: string): Promise<{ ok: true } | { ok: false; error: 'FREE_LIMIT' }> {
  if (!(await isFreeAccount(userId))) return { ok: true };
  const limit = await getIntSetting('social_free_daily_limit');
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "DailyAction" ("userId", day, count) VALUES (${userId}, ${vnDay()}, 1)
    ON CONFLICT ("userId", day) DO UPDATE SET count = "DailyAction".count + 1
    WHERE "DailyAction".count < ${limit}
    RETURNING count`;
  return rows.length ? { ok: true } : { ok: false, error: 'FREE_LIMIT' };
}

export async function freeStatus(userId: string): Promise<{ isFree: boolean; used: number; limit: number }> {
  const [isFree, limit, row] = await Promise.all([
    isFreeAccount(userId),
    getIntSetting('social_free_daily_limit'),
    db.dailyAction.findUnique({ where: { userId_day: { userId, day: vnDay() } } }),
  ]);
  return { isFree, used: row?.count ?? 0, limit };
}
