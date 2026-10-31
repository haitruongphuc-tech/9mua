import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';
import { getIntSetting } from '@/lib/settings';
import { vnDay } from './day';

// Điểm thưởng (SPEC-social.md V5.6, công tắc points; đổi xu: points_exchange, tắt sẵn). Sổ PointEntry chỉ thêm, khoá
// duy nhất (userId, kind, refId): bỏ tim / bỏ follow rồi làm lại không có điểm lần nữa; bấm 2 lần không cộng 2 lần.
const DAY = 86_400_000;

export type PointAward = { points: number; streak: boolean } | null;

async function canEarn(userId: string): Promise<boolean> {
  if (!(await isFeatureOn('points'))) return false;
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true, lockedAt: true } });
  const minDays = await getIntSetting('points_min_account_days');
  return Boolean(u && !u.lockedAt && u.createdAt.getTime() <= now().getTime() - minDays * DAY);
}

async function earnedToday(tx: Tx, userId: string): Promise<number> {
  const r = await tx.pointEntry.aggregate({
    where: { userId, vnDay: vnDay(now()), points: { gt: 0 }, kind: { in: ['like', 'follow', 'mutual'] } },
    _sum: { points: true },
  });
  return r._sum.points ?? 0;
}

// Ghi 1 dòng cộng điểm (cắt theo trần 200 điểm mỗi ngày). Đã có (userId, kind, refId) thì không ghi.
async function award(
  userId: string,
  kind: 'like' | 'follow' | 'mutual',
  refType: string,
  refId: string,
  points: number,
): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`points:${userId}`}))`;
    const cap = await getIntSetting('points_daily_cap', tx);
    const room = Math.max(0, cap - (await earnedToday(tx, userId)));
    const give = Math.min(points, room);
    if (give <= 0) return 0;
    const inserted = await tx.$executeRaw`
      INSERT INTO "PointEntry" (id, "userId", kind, points, "refType", "refId", "vnDay", "createdAt")
      VALUES (${`pe_${crypto.randomUUID()}`}, ${userId}, ${kind}, ${give}, ${refType}, ${refId}, ${vnDay(now())}, ${now()})
      ON CONFLICT ("userId", kind, "refId") DO NOTHING`;
    return inserted ? give : 0;
  });
}

// +5 khi thả tim một video lần đầu (không tính video của mình). Thả tim liên tục từ ngày thứ 3 thì điểm tim ×2.
export async function awardLikePoints(
  userId: string,
  videoId: string,
  authorId: string,
): Promise<PointAward> {
  if (userId === authorId || !(await canEarn(userId))) return null;
  const base = await getIntSetting('points_like');
  const prev = [1, 2].map((d) => vnDay(new Date(now().getTime() - d * DAY)));
  const streakDays = await db.pointEntry.findMany({
    where: { userId, kind: 'like', vnDay: { in: prev } },
    distinct: ['vnDay'],
    select: { vnDay: true },
  });
  const streak = streakDays.length === 2;
  const got = await award(userId, 'like', 'video', videoId, streak ? base * 2 : base);
  return got ? { points: got, streak } : null;
}

// +10 khi follow một người lần đầu; +20 cho cả hai khi hai người follow nhau lần đầu.
export async function awardFollowPoints(followerId: string, followeeId: string): Promise<PointAward> {
  if (!(await canEarn(followerId))) return null;
  let got = await award(followerId, 'follow', 'user', followeeId, await getIntSetting('points_follow'));
  const mutual = await db.follow.findFirst({ where: { followerId: followeeId, followeeId: followerId } });
  if (mutual) {
    const bonus = await getIntSetting('points_mutual');
    got += await award(followerId, 'mutual', 'user', followeeId, bonus);
    if (await canEarn(followeeId)) await award(followeeId, 'mutual', 'user', followerId, bonus);
  }
  return got ? { points: got, streak: false } : null;
}

export async function pointBalance(userId: string): Promise<number> {
  const r = await db.pointEntry.aggregate({ where: { userId }, _sum: { points: true } });
  return r._sum.points ?? 0;
}

// Thu hồi điểm của tài khoản bị khoá bằng dòng trừ (việc hằng ngày). Một lần khoá chỉ thu hồi một lần.
export async function revokeLockedPoints(): Promise<number> {
  // Tài khoản đang chờ tự xoá (SPEC-identity.md V5.3) không tính: đăng nhập lại là huỷ xoá.
  const locked = await db.user.findMany({
    where: { lockedAt: { not: null }, deleteRequestedAt: null },
    select: { id: true, lockedAt: true },
  });
  let n = 0;
  for (const u of locked) {
    const balance = await pointBalance(u.id);
    if (balance <= 0) continue;
    await db.pointEntry
      .create({
        data: {
          userId: u.id,
          kind: 'revoke',
          points: -balance,
          refType: 'lock',
          refId: u.lockedAt!.toISOString(),
          vnDay: vnDay(now()),
          createdAt: now(),
        },
      })
      .then(() => (n += 1))
      .catch(() => {});
  }
  return n;
}

export type ExchangeError = 'OFF' | 'TOO_FEW' | 'ONCE_A_DAY' | 'MONTH_CAP' | 'BUDGET' | 'NOT_ALLOWED';

// Đổi điểm ra xu (tắt sẵn): 1.000 điểm = 1 xu; tối thiểu 1.000 điểm; 1 lần mỗi ngày; ≤ 30 xu mỗi tháng mỗi người;
// ngân sách 10.000 xu mỗi tháng cho toàn hệ thống. Dòng trừ điểm và dòng cộng xu cùng mã tham chiếu trong một
// transaction: bấm 2 lần không đổi 2 lần.
export async function exchangePoints(
  userId: string,
): Promise<{ ok: true; xu: number; points: number } | { ok: false; error: ExchangeError }> {
  if (!(await isFeatureOn('points_exchange'))) return { ok: false, error: 'OFF' };
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true, lockedAt: true } });
  if (!u || u.lockedAt || u.createdAt.getTime() > now().getTime() - 7 * DAY)
    return { ok: false, error: 'NOT_ALLOWED' };
  const rate = await getIntSetting('points_per_xu');
  const monthCap = await getIntSetting('points_xu_month_cap');
  const budget = await getIntSetting('points_xu_month_budget');
  const today = vnDay(now());
  const refId = `px:${userId}:${today}`;
  const since = new Date(`${today.slice(0, 7)}-01T00:00:00+07:00`);
  return db.$transaction(async (tx) => {
    // Khoá chung: ngân sách tháng là của cả hệ thống.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('points-exchange'))`;
    if (await tx.pointEntry.findFirst({ where: { userId, kind: 'exchange', vnDay: today } }))
      return { ok: false as const, error: 'ONCE_A_DAY' as const };
    const balance =
      (await tx.pointEntry.aggregate({ where: { userId }, _sum: { points: true } }))._sum.points ?? 0;
    if (balance < rate) return { ok: false as const, error: 'TOO_FEW' as const };
    const mine =
      (
        await tx.xuEntry.aggregate({
          where: { userId, kind: 'points_exchange', createdAt: { gte: since } },
          _sum: { amount: true },
        })
      )._sum.amount ?? 0;
    const all =
      (
        await tx.xuEntry.aggregate({
          where: { kind: 'points_exchange', createdAt: { gte: since } },
          _sum: { amount: true },
        })
      )._sum.amount ?? 0;
    if (mine >= monthCap) return { ok: false as const, error: 'MONTH_CAP' as const };
    if (all >= budget) return { ok: false as const, error: 'BUDGET' as const };
    const xu = Math.min(Math.floor(balance / rate), monthCap - mine, budget - all);
    const t = now();
    await tx.pointEntry.create({
      data: {
        userId,
        kind: 'exchange',
        points: -xu * rate,
        refType: 'xu',
        refId,
        vnDay: today,
        createdAt: t,
      },
    });
    await tx.xuEntry.create({ data: { userId, amount: xu, kind: 'points_exchange', refId, createdAt: t } });
    return { ok: true as const, xu, points: xu * rate };
  });
}
