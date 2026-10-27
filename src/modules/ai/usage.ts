import { alertCeo } from '@/lib/alerts';
import { now, startOfVnDay, startOfVnMonth } from '@/lib/clock';
import { db } from '@/lib/db';
import { formatVnd } from '@/lib/format';
import { getIntSetting } from '@/lib/settings';

// Sổ chi phí AI (bảng AiUsage, chỉ thêm). Lượt trong ngày chỉ đếm lần thành công (lỗi không trừ lượt);
// ngân sách tháng cộng MỌI lần gọi vì lần lỗi cũng có thể đã tốn tiền.
export type AiKind = 'text' | 'image';

export function usedToday(userId: string, kind: AiKind): Promise<number> {
  return db.aiUsage.count({ where: { userId, kind, ok: true, createdAt: { gte: startOfVnDay() } } });
}

export async function usedThisMonthVnd(): Promise<number> {
  const r = await db.aiUsage.aggregate({
    _sum: { costVnd: true },
    where: { createdAt: { gte: startOfVnMonth() } },
  });
  return r._sum.costVnd ?? 0;
}

export async function monthlyUsage(): Promise<{ usedVnd: number; budgetVnd: number }> {
  const [usedVnd, budgetVnd] = await Promise.all([
    usedThisMonthVnd(),
    getIntSetting('ai_monthly_budget_vnd'),
  ]);
  return { usedVnd, budgetVnd };
}

export async function recordUsage(row: {
  userId: string;
  kind: AiKind;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  costVnd: number;
  ok: boolean;
}): Promise<void> {
  const before = await monthlyUsage();
  await db.aiUsage.create({ data: { ...row, createdAt: now() } });
  // Báo CEO đúng lần vượt ngân sách (SPEC-ai.md mục 8); các lần sau bị chặn trước khi gọi AI.
  const after = before.usedVnd + row.costVnd;
  if (before.usedVnd < before.budgetVnd && after >= before.budgetVnd) {
    await alertCeo(
      'ai_budget',
      `AI Studio đã dùng ${formatVnd(after)} / ngân sách ${formatVnd(before.budgetVnd)} tháng này. ` +
        'AI tạm dừng tới đầu tháng sau; muốn mở lại thì tăng ngân sách ở /admin/ai.',
    );
  }
}

export type RecentUsage = Awaited<ReturnType<typeof recentUsage>>[number];

// Cho trang /admin/ai: 50 lần gọi gần nhất.
export function recentUsage(take = 50) {
  return db.aiUsage.findMany({ orderBy: { createdAt: 'desc' }, take });
}
