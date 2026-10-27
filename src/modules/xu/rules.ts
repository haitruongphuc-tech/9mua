import { audit } from '@/lib/audit';
import { getSetting, setSetting } from '@/lib/settings';

// Luật thưởng xu (SPEC-live.md phần 2 mục 3, 5, 9): các mức người xem hợp lệ → xu (lấy mức cao nhất, không cộng
// dồn), ngân sách tháng, số phút có hình tối thiểu. CEO chỉnh ở /admin/xu; áp dụng cho buổi bắt đầu sau khi lưu.
export type XuRules = { tiers: [number, number][]; monthlyBudget: number; minMinutes: number };

export const DEFAULT_XU_RULES: XuRules = {
  tiers: [
    [10, 10],
    [25, 30],
    [50, 80],
  ],
  monthlyBudget: 20_000,
  minMinutes: 15,
};

const int = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

export function validateXuRules(raw: unknown): XuRules | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<XuRules>;
  if (!Array.isArray(r.tiers) || r.tiers.length === 0 || r.tiers.length > 10) return null;
  const tiers = r.tiers.map((t) => (Array.isArray(t) ? [t[0], t[1]] : [NaN, NaN]));
  if (!tiers.every(([v, x]) => int(v, 1, 1000) && int(x, 1, 10_000))) return null;
  if (!int(r.monthlyBudget, 0, 10_000_000) || !int(r.minMinutes, 1, 480)) return null;
  const sorted = [...(tiers as [number, number][])].sort((a, b) => a[0] - b[0]);
  return { tiers: sorted, monthlyBudget: r.monthlyBudget!, minMinutes: r.minMinutes! };
}

export async function getXuRules(): Promise<XuRules> {
  try {
    return validateXuRules(JSON.parse(await getSetting('xu_rules_json'))) ?? DEFAULT_XU_RULES;
  } catch {
    return DEFAULT_XU_RULES;
  }
}

export async function setXuRules(raw: unknown, adminId: string): Promise<{ ok: boolean }> {
  const rules = validateXuRules(raw);
  if (!rules) return { ok: false };
  const before = await getXuRules();
  await setSetting('xu_rules_json', JSON.stringify(rules), adminId);
  await audit({
    adminId,
    action: 'xu.rules',
    targetType: 'setting',
    targetId: 'xu_rules_json',
    before,
    after: rules,
  });
  return { ok: true };
}

// Số xu theo số người xem hợp lệ: mức cao nhất đạt được, 0 nếu chưa đạt mức nào.
export function xuForViewers(viewers: number, tiers: [number, number][]): number {
  let xu = 0;
  for (const [min, amount] of tiers) if (viewers >= min) xu = Math.max(xu, amount);
  return xu;
}
