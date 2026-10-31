import { describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { DELETED_NAME, login } from '@/modules/identity';
import { createPaidOrder, createUser } from '../../tests/helpers/factories';
import { deletionBlockers, finalizeAccountDeletions, requestAccountDeletion } from './account-delete';

const DAY = 86_400_000;

describe('tự xoá tài khoản (SPEC-identity.md V5.3)', () => {
  it('sai mật khẩu thì không xoá; xác nhận đúng: khoá + đăng xuất; đăng nhập lại trong 30 ngày là huỷ xoá', async () => {
    const u = await createUser();
    await db.session.create({
      data: { userId: u.id, tokenHash: `tk-${u.id}`, expiresAt: new Date(Date.now() + DAY) },
    });
    expect(await requestAccountDeletion(u.id, { password: 'sai' })).toEqual({
      ok: false,
      error: 'BAD_PASSWORD',
    });
    expect(await requestAccountDeletion(u.id, { password: u.password })).toEqual({ ok: true });
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.lockedAt).not.toBeNull();
    expect(after.deleteRequestedAt?.getTime()).toBe(after.lockedAt?.getTime());
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);

    setClock(new Date(Date.now() + 10 * DAY));
    try {
      expect(await login({ identifier: u.phone, password: u.password })).toMatchObject({ ok: true });
      const back = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(back.lockedAt).toBeNull();
      expect(back.deleteRequestedAt).toBeNull();
    } finally {
      resetClock();
    }
  });

  it('hết 30 ngày: ẩn danh hoá, gỡ video; quá hạn thì không đăng nhập lại được; CEO khoá thì không mở', async () => {
    const u = await createUser({ displayName: 'Sẽ xoá' });
    const v = await db.video.create({
      data: { authorId: u.id, status: 'ready', caption: 'xoá tôi', readyAt: new Date() },
    });
    expect(await requestAccountDeletion(u.id, { password: u.password })).toEqual({ ok: true });
    setClock(new Date(Date.now() + 31 * DAY));
    try {
      expect(await login({ identifier: u.phone, password: u.password })).toEqual({
        ok: false,
        error: 'ACCOUNT_LOCKED',
      });
      expect(await finalizeAccountDeletions()).toBeGreaterThanOrEqual(1);
      const gone = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(gone).toMatchObject({ displayName: DELETED_NAME, phone: null, email: null, handle: null });
      expect(gone.deletedAt).not.toBeNull();
      expect((await db.video.findUniqueOrThrow({ where: { id: v.id } })).status).toBe('deleted');
      expect(await finalizeAccountDeletions()).toBe(0);
    } finally {
      resetClock();
    }

    // CEO khoá tài khoản (lockedAt khác deleteRequestedAt): đăng nhập không mở khoá.
    const w = await createUser();
    await requestAccountDeletion(w.id, { password: w.password });
    await db.user.update({ where: { id: w.id }, data: { lockedAt: new Date(Date.now() + 1000) } });
    expect(await login({ identifier: w.phone, password: w.password })).toEqual({
      ok: false,
      error: 'ACCOUNT_LOCKED',
    });
  });

  it('còn đơn chưa xong hoặc là admin thì không xoá được', async () => {
    const { buyer, seller } = await createPaidOrder();
    expect(await deletionBlockers(buyer.id)).toContain('OPEN_ORDERS');
    expect(await requestAccountDeletion(buyer.id, { password: buyer.password })).toMatchObject({
      ok: false,
      error: 'BLOCKED',
    });
    expect(await deletionBlockers(seller.user.id)).toEqual(
      expect.arrayContaining(['OPEN_ORDERS', 'KIOT_BALANCE']),
    );
    const admin = await createUser();
    await db.user.update({ where: { id: admin.id }, data: { role: 'admin' } });
    expect(await requestAccountDeletion(admin.id, { password: admin.password })).toEqual({
      ok: false,
      error: 'ADMIN',
    });
  });
});
