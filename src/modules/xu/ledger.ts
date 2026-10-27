import { audit } from '@/lib/audit';
import { now, startOfVnMonth } from '@/lib/clock';
import { db } from '@/lib/db';
import { getXuRules } from './rules';

// Sổ xu chỉ thêm (trigger trong DB chặn sửa/xoá). Xu là điểm thưởng nội bộ, không phải tiền (SPEC-live.md phần 2).
export async function getXuBalance(userId: string): Promise<number> {
  const r = await db.xuEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

export type XuEntryView = {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  liveId: string | null;
  createdAt: Date;
};

export async function getXuHistory(
  userId: string,
  cursor?: string | null,
  take = 30,
): Promise<{ items: XuEntryView[]; nextCursor: string | null }> {
  const rows = await db.xuEntry.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, amount: true, kind: true, note: true, liveId: true, createdAt: true },
  });
  return { items: rows.slice(0, take), nextCursor: rows.length > take ? rows[take - 1]!.id : null };
}

// CEO thu hồi: 1 dòng âm kèm lý do + nhật ký admin. Số dư có thể âm (khi âm thì không dùng được xu).
export async function revokeXu(
  userId: string,
  amount: number,
  adminId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000 || reason.trim().length < 3)
    return { ok: false };
  const entry = await db.xuEntry.create({
    data: {
      userId,
      amount: -amount,
      kind: 'admin_revoke',
      note: reason.trim().slice(0, 300),
      createdById: adminId,
      createdAt: now(),
    },
  });
  await audit({
    adminId,
    action: 'xu.revoke',
    targetType: 'user',
    targetId: userId,
    reason: reason.trim(),
    after: { amount: -amount, entryId: entry.id },
  });
  return { ok: true };
}

// Xu đã thưởng trong tháng (giờ VN) so với ngân sách.
export async function monthlyXuUsage(at: Date = now()): Promise<{ used: number; budget: number }> {
  const [r, rules] = await Promise.all([
    db.xuEntry.aggregate({
      where: { kind: 'live_reward', createdAt: { gte: startOfVnMonth(at) } },
      _sum: { amount: true },
    }),
    getXuRules(),
  ]);
  return { used: r._sum.amount ?? 0, budget: rules.monthlyBudget };
}

// Cho /admin/xu: các dòng gần nhất kèm tên người nhận.
export async function recentXuEntries(take = 100) {
  const rows = await db.xuEntry.findMany({ orderBy: { createdAt: 'desc' }, take });
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, displayName: true, phone: true },
  });
  return rows.map((r) => ({ ...r, user: users.find((u) => u.id === r.userId) ?? null }));
}
