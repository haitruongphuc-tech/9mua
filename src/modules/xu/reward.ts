import { Prisma } from '@prisma/client';
import { alertCeo } from '@/lib/alerts';
import { now, startOfVnMonth } from '@/lib/clock';
import { db } from '@/lib/db';
import { notifyKey } from '@/lib/notifications';
import { getLive } from '@/modules/live';
import { xuForViewers, getXuRules } from './rules';

// Thưởng xu khi buổi live kết thúc (SPEC-live.md phần 2 mục 1–6).
export const MIN_WATCH_SEC = 60;
export const MIN_ACCOUNT_AGE_MS = 3 * 86_400_000;
export const MAX_ACCOUNTS_PER_NETWORK = 3;

export type RewardResult =
  | { credited: number }
  | { skipped: 'TOO_SHORT' | 'NOT_ENOUGH_VIEWERS' | 'DAILY_LIMIT' | 'BUDGET' | 'STOPPED' | 'NOT_ENDED' };

const vnDay = (at: Date) => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

// Người xem hợp lệ: đã đăng nhập, tài khoản ≥ 3 ngày trước lúc buổi bắt đầu, xem liên tục ≥ 60 giây, không phải
// người phát, 1 lần mỗi tài khoản, tối đa 3 tài khoản cùng một mạng (tài khoản thứ 4 trở đi không tính).
export async function qualifiedViewers(liveId: string): Promise<number> {
  const live = await getLive(liveId);
  if (!live?.startedAt) return 0;
  const rows = await db.liveViewer.findMany({
    where: { liveId, userId: { not: null }, longestStreakSec: { gte: MIN_WATCH_SEC } },
    orderBy: { firstSeenAt: 'asc' },
  });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId!) } },
    select: { id: true, createdAt: true },
  });
  const oldEnough = new Set(
    users
      .filter((u) => live.startedAt!.getTime() - u.createdAt.getTime() >= MIN_ACCOUNT_AGE_MS)
      .map((u) => u.id),
  );
  const perNetwork = new Map<string, number>();
  let count = 0;
  for (const r of rows) {
    if (r.userId === live.hostUserId || !oldEnough.has(r.userId!)) continue;
    const n = perNetwork.get(r.networkHash) ?? 0;
    perNetwork.set(r.networkHash, n + 1);
    if (n < MAX_ACCOUNTS_PER_NETWORK) count += 1;
  }
  return count;
}

const notifySkip = (userId: string, reason: string, viewers: number) =>
  notifyKey(userId, `notify.xuSkipped.${reason}`, { viewers }, '/tai-khoan/xu');

export async function rewardLive(liveId: string): Promise<RewardResult> {
  const live = await getLive(liveId);
  if (!live || (live.status !== 'ended' && live.status !== 'stopped')) return { skipped: 'NOT_ENDED' };
  // Đã xét buổi này rồi (2 worker cùng chạy): không làm lại.
  if (await db.xuEntry.count({ where: { liveId } })) return { skipped: 'DAILY_LIMIT' };
  const rules = await getXuRules();
  const viewers = await qualifiedViewers(liveId);
  const skip = async (reason: Exclude<RewardResult, { credited: number }>['skipped']) => {
    await notifySkip(live.hostUserId, reason, viewers);
    return { skipped: reason };
  };
  if (live.status === 'stopped') return skip('STOPPED');
  const seconds =
    live.startedAt && live.endedAt ? (live.endedAt.getTime() - live.startedAt.getTime()) / 1000 : 0;
  if (seconds < rules.minMinutes * 60) return skip('TOO_SHORT');
  const amount = xuForViewers(viewers, rules.tiers);
  if (amount === 0) return skip('NOT_ENOUGH_VIEWERS');

  const rewardDay = vnDay(live.startedAt!);
  let result: RewardResult;
  try {
    result = await db.$transaction(async (tx) => {
      // Khoá ngân sách: hai lần thưởng cùng lúc không cùng vượt ngân sách tháng.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('xu:budget'))`;
      const used =
        (
          await tx.xuEntry.aggregate({
            where: { kind: 'live_reward', createdAt: { gte: startOfVnMonth() } },
            _sum: { amount: true },
          })
        )._sum.amount ?? 0;
      if (used + amount > rules.monthlyBudget) return { skipped: 'BUDGET' as const };
      await tx.xuEntry.create({
        data: {
          userId: live.hostUserId,
          amount,
          kind: 'live_reward',
          liveId,
          rewardDay,
          note: `${viewers} người xem hợp lệ`,
          createdAt: now(),
        },
      });
      return { credited: amount };
    });
  } catch (e) {
    // Đã được thưởng 1 buổi trong ngày này (khoá duy nhất userId + rewardDay).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return skip('DAILY_LIMIT');
    throw e;
  }
  if ('skipped' in result) {
    await alertCeo(
      'xu_budget',
      `Hết ngân sách thưởng xu tháng này (${rules.monthlyBudget} xu). Buổi live ${liveId} không được cộng ${amount} xu.`,
    );
    return skip(result.skipped);
  }
  await notifyKey(live.hostUserId, 'notify.xuReward', { xu: amount, viewers }, '/tai-khoan/xu');
  return result;
}
