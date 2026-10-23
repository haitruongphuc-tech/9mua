import { describe, expect, it } from 'vitest';
import { audit } from './audit';
import { db } from './db';

describe('nhật ký thao tác admin', () => {
  it('ghi đủ ai, làm gì, đối tượng, lý do, trước/sau; không sửa, không xoá được', async () => {
    await audit({
      adminId: 'admin-1',
      action: 'kiot.lock',
      targetType: 'kiot',
      targetId: 'k1',
      reason: 'Lừa đảo',
      before: { lockedAt: null },
      after: { lockedAt: '2026-10-23' },
    });
    const row = await db.adminAuditLog.findFirstOrThrow();
    expect(row).toMatchObject({
      adminId: 'admin-1',
      action: 'kiot.lock',
      targetId: 'k1',
      reason: 'Lừa đảo',
      before: { lockedAt: null },
    });
    await expect(
      db.adminAuditLog.update({ where: { id: row.id }, data: { reason: 'sửa' } }),
    ).rejects.toThrow();
    await expect(db.adminAuditLog.delete({ where: { id: row.id } })).rejects.toThrow();
  });
});
