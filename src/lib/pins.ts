import type { PinKind } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { audit } from './audit';
import { now } from './clock';
import { db } from './db';

// Ghim của CEO (SPEC-admin.md bổ sung 27/10): tối đa 5 video và 5 Kiot, có thể đặt ngày hết ghim.
export const MAX_PINS = 5;

const active = () => ({ OR: [{ until: null }, { until: { gt: now() } }] });

export async function activePinIds(kind: PinKind): Promise<string[]> {
  const rows = await db.pin.findMany({ where: { kind, ...active() }, orderBy: { position: 'asc' } });
  return rows.map((r) => r.targetId);
}

// Điều kiện SQL "đang được ghim" cho câu truy vấn thô (vd. sắp Kiot ghim lên đầu).
export const activePinSql = (kind: PinKind, alias: string) =>
  Prisma.sql`(SELECT pin.position FROM "Pin" pin WHERE pin.kind = ${kind}::"PinKind" AND pin."targetId" = ${Prisma.raw(
    `${alias}.id`,
  )} AND (pin.until IS NULL OR pin.until > ${now()}))`;

export async function listPins(kind: PinKind) {
  return db.pin.findMany({ where: { kind, ...active() }, orderBy: { position: 'asc' } });
}

export async function addPin(
  kind: PinKind,
  targetId: string,
  adminId: string,
  until: Date | null,
): Promise<{ ok: true } | { ok: false; error: 'FULL' | 'EXISTS' }> {
  await db.pin.deleteMany({ where: { kind, until: { lte: now() } } }); // dọn ghim đã hết hạn
  const current = await listPins(kind);
  if (current.some((p) => p.targetId === targetId)) return { ok: false, error: 'EXISTS' };
  if (current.length >= MAX_PINS) return { ok: false, error: 'FULL' };
  const position = (current.at(-1)?.position ?? 0) + 1;
  await db.pin.create({ data: { kind, targetId, position, until, createdById: adminId } });
  await audit({ adminId, action: `pin.${kind}.add`, targetType: kind, targetId, after: { position, until } });
  return { ok: true };
}

export async function removePin(kind: PinKind, targetId: string, adminId: string): Promise<void> {
  const { count } = await db.pin.deleteMany({ where: { kind, targetId } });
  if (count) await audit({ adminId, action: `pin.${kind}.remove`, targetType: kind, targetId });
}
