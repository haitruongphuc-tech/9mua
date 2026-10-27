import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { changePassword, register } from '@/modules/identity';
import { forgetTrustedDevices, isTrustedDevice, listTrustedDevices, trustDevice } from './devices';

async function admin() {
  const phone = `09${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 10)}`;
  const r = await register({ identifier: phone, displayName: 'CEO Thử', password: 'mat-khau-ceo-1' });
  if (!r.ok) throw new Error(r.error);
  return db.user.update({ where: { id: r.userId }, data: { role: 'admin' } });
}

describe('nhớ thiết bị admin 30 ngày', () => {
  it('thiết bị đã nhớ được nhận ra; cookie lạ hoặc của người khác thì không', async () => {
    const a = await admin();
    const b = await admin();
    const { token, expiresAt } = await trustDevice(a.id, 'Chrome iPhone');
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect(await isTrustedDevice(a.id, token)).toBe(true);
    expect(await isTrustedDevice(b.id, token)).toBe(false);
    expect(await isTrustedDevice(a.id, 'khong-co')).toBe(false);
    expect(await isTrustedDevice(a.id, undefined)).toBe(false);
    expect(await listTrustedDevices(a.id)).toHaveLength(1);
  });

  it('đổi mật khẩu thì thiết bị cũ hết hiệu lực', async () => {
    const a = await admin();
    const { token } = await trustDevice(a.id, 'Safari');
    const r = await changePassword(a.id, 'khong-co-phien', {
      oldPassword: 'mat-khau-ceo-1',
      newPassword: 'mat-khau-ceo-2',
    });
    expect(r.ok).toBe(true);
    expect(await isTrustedDevice(a.id, token)).toBe(false);
  });

  it('"Quên mọi thiết bị" thu hồi tất cả; hết hạn cũng không còn', async () => {
    const a = await admin();
    const one = await trustDevice(a.id, 'A');
    await trustDevice(a.id, 'B');
    expect(await forgetTrustedDevices(a.id)).toBe(2);
    expect(await isTrustedDevice(a.id, one.token)).toBe(false);
    const old = await trustDevice(a.id, 'C');
    await db.adminTrustedDevice.updateMany({
      where: { userId: a.id, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await isTrustedDevice(a.id, old.token)).toBe(false);
    expect(await listTrustedDevices(a.id)).toHaveLength(0);
  });
});
