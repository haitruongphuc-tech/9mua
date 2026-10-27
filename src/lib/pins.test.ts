import { describe, expect, it } from 'vitest';
import { db } from './db';
import { activePinIds, addPin, MAX_PINS, removePin } from './pins';

describe('ghim của CEO', () => {
  it('tối đa 5, không trùng, theo thứ tự ghim; hết hạn thì tự bỏ; bỏ ghim có nhật ký', async () => {
    await db.pin.deleteMany({ where: { kind: 'kiot' } });
    const admin = 'admin-pin-test';
    const ids = Array.from({ length: MAX_PINS }, (_, i) => `kiot-${i}-${Date.now()}`);
    for (const id of ids) expect(await addPin('kiot', id, admin, null)).toEqual({ ok: true });
    expect(await addPin('kiot', ids[0]!, admin, null)).toEqual({ ok: false, error: 'EXISTS' });
    expect(await addPin('kiot', 'thu-6', admin, null)).toEqual({ ok: false, error: 'FULL' });
    expect(await activePinIds('kiot')).toEqual(ids);

    await db.pin.updateMany({ where: { targetId: ids[1] }, data: { until: new Date(Date.now() - 1000) } });
    expect(await activePinIds('kiot')).toEqual(ids.filter((_, i) => i !== 1));
    expect(await addPin('kiot', 'thu-6', admin, null)).toEqual({ ok: true });

    await removePin('kiot', ids[0]!, admin);
    expect(await activePinIds('kiot')).not.toContain(ids[0]);
    const log = await db.adminAuditLog.findFirst({ where: { action: 'pin.kiot.remove', targetId: ids[0] } });
    expect(log).not.toBeNull();
    await db.pin.deleteMany({ where: { kind: 'kiot' } });
  });
});
