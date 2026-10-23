import type { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { now } from './clock';
import { db, type Tx } from './db';

export type AuditEntry = {
  adminId: string;
  action: string; // vd. 'kiot.lock', 'payout.reject', 'setting.update'
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
};

// IP người thao tác: Nginx đặt X-Real-IP. Ngoài request (test, CLI) thì bỏ trống.
async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

const json = (v: unknown) =>
  v === undefined ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

// Nhật ký thao tác admin (SPEC-admin.md mục 1). Bảng có trigger chỉ-thêm: không sửa, không xoá được.
export async function audit(entry: AuditEntry, tx: Tx | typeof db = db): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason ?? null,
      before: json(entry.before),
      after: json(entry.after),
      ip: await requestIp(),
      createdAt: now(),
    },
  });
}
