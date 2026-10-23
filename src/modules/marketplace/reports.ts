import { z } from 'zod';
import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getProductForCheckout, hideProduct } from '@/modules/kiot';

export const REPORT_REASONS = [
  { value: 'hang_gia', label: 'Hàng giả, hàng nhái' },
  { value: 'cam_ban', label: 'Hàng cấm bán' },
  { value: 'lua_dao', label: 'Lừa đảo' },
  { value: 'khac', label: 'Khác' },
] as const;
export const AUTO_HIDE_REPORTERS = 5;
export const AUTO_HIDE_REASON = `Tự ẩn: ${AUTO_HIDE_REPORTERS} người báo cáo vi phạm, chờ CEO xem`;

const input = z.object({
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]], 'Chọn lý do báo cáo'),
  message: z.string().trim().max(1000, 'Mô tả tối đa 1.000 ký tự'),
});

export type ReportResult =
  | { ok: true; autoHidden: boolean }
  | { ok: false; error: 'NOT_FOUND' | 'OWN_PRODUCT' }
  | { ok: false; error: 'INVALID_INPUT'; message: string };

// Báo cáo vi phạm (SPEC-marketplace.md mục 6). Báo lại lần 2 không tính thêm; đủ 5 người khác nhau thì tự ẩn.
export async function reportProduct(
  userId: string,
  productId: string,
  reason: string,
  message: string,
): Promise<ReportResult> {
  const parsed = input.safeParse({ reason, message });
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
  const product = await getProductForCheckout(productId);
  if (!product || !product.available) return { ok: false, error: 'NOT_FOUND' };
  const kiot = await db.kiot.findUnique({
    where: { id: product.kiotId },
    select: { ownerId: true, name: true },
  });
  if (kiot?.ownerId === userId) return { ok: false, error: 'OWN_PRODUCT' };

  await db.productReport.createMany({
    data: [{ productId, reporterId: userId, ...parsed.data, createdAt: now() }],
    skipDuplicates: true,
  });
  const reporters = await db.productReport.count({ where: { productId, status: 'open' } });
  if (reporters < AUTO_HIDE_REPORTERS) return { ok: true, autoHidden: false };
  await hideProduct(productId, AUTO_HIDE_REASON);
  await alertCeo(
    'product_auto_hidden',
    `Sản phẩm "${product.name}" của Kiot ${kiot?.name ?? ''} bị ${reporters} người báo cáo nên đã tự ẩn. Vào trang quản trị để xem.`,
  );
  return { ok: true, autoHidden: true };
}

export type ReportView = {
  productId: string;
  productName: string;
  kiotName: string;
  reporters: number;
  reasons: Record<string, number>;
  messages: string[];
  hidden: boolean;
  lastAt: Date;
};

// Hàng chờ của CEO: gom theo sản phẩm, nhiều người báo nhất lên đầu.
export async function listReports(
  filter: { status?: 'open' | 'dismissed' | 'actioned' } = {},
): Promise<ReportView[]> {
  const reports = await db.productReport.findMany({
    where: { status: filter.status ?? 'open' },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const ids = [...new Set(reports.map((r) => r.productId))];
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, hiddenByAdminAt: true, kiot: { select: { name: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const views = ids.map((id): ReportView => {
    const rs = reports.filter((r) => r.productId === id);
    const p = byId.get(id);
    return {
      productId: id,
      productName: p?.name ?? '(đã xoá)',
      kiotName: p?.kiot.name ?? '',
      reporters: rs.length,
      reasons: rs.reduce<Record<string, number>>(
        (acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }),
        {},
      ),
      messages: rs
        .map((r) => r.message)
        .filter(Boolean)
        .slice(0, 10),
      hidden: Boolean(p?.hiddenByAdminAt),
      lastAt: rs[0]!.createdAt,
    };
  });
  return views.sort((a, b) => b.reporters - a.reporters || b.lastAt.getTime() - a.lastAt.getTime());
}
