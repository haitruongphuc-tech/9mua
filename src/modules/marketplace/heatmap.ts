import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { cached } from '@/lib/ttl-cache';
import { kiotLatSql, kiotLngSql, provinceCentersSql } from '@/modules/kiot';
import { visibleOnMarket } from './search';

// Bản đồ nhiệt Kiot (SPEC-marketplace.md V5.3, công tắc map): đếm Kiot đang hoạt động (có sản phẩm đang hiện) theo ô lưới
// 0,01 độ (~1,1 km) trong khung đang xem. Kiot chưa đặt ghim tính theo tâm tỉnh. Chỉ trả tâm ô, không trả toạ độ từng
// Kiot (SPEC-kiot.md V5.1 mục 4). Lưu đệm 5 phút.
export const CELL_DEG = 0.01;
const MAX_CELLS = 2000;

export type Bounds = { south: number; west: number; north: number; east: number };
export type HeatCell = { lat: number; lng: number; count: number };

const r2 = (v: number) => Math.round(v * 100) / 100;

export function validBounds(b: Partial<Record<keyof Bounds, unknown>>): Bounds | null {
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v));
  const out = { south: n(b.south), west: n(b.west), north: n(b.north), east: n(b.east) };
  if (!Object.values(out).every(Number.isFinite)) return null;
  if (out.south >= out.north || out.west >= out.east) return null;
  return {
    south: Math.max(-90, out.south),
    north: Math.min(90, out.north),
    west: Math.max(-180, out.west),
    east: Math.min(180, out.east),
  };
}

export function kiotHeatmap(b: Bounds): Promise<{ cells: HeatCell[] }> {
  const key = `heatmap:${r2(b.south)}:${r2(b.west)}:${r2(b.north)}:${r2(b.east)}`;
  return cached(key, 300, async () => {
    const at = now();
    const rows = await db.$queryRaw<{ gy: number; gx: number; count: number }[]>`
      WITH k AS (
        SELECT ${kiotLatSql} AS lat, ${kiotLngSql} AS lng
        FROM "Kiot" k LEFT JOIN ${provinceCentersSql} ON pc.slug = k.province
        WHERE k."activeUntil" > ${at} AND k."lockedAt" IS NULL
          AND EXISTS (SELECT 1 FROM "Product" p WHERE p."kiotId" = k.id AND ${visibleOnMarket(at)})
      )
      SELECT floor(lat / ${CELL_DEG})::int AS gy, floor(lng / ${CELL_DEG})::int AS gx, count(*)::int AS count
      FROM k WHERE lat BETWEEN ${b.south} AND ${b.north} AND lng BETWEEN ${b.west} AND ${b.east}
      GROUP BY 1, 2 ORDER BY count DESC LIMIT ${MAX_CELLS}`;
    return {
      cells: rows.map((r) => ({
        lat: Math.round((r.gy + 0.5) * CELL_DEG * 10_000) / 10_000,
        lng: Math.round((r.gx + 0.5) * CELL_DEG * 10_000) / 10_000,
        count: r.count,
      })),
    };
  });
}
