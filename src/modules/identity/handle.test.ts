import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import {
  assignMissingHandles,
  ensureHandle,
  handleFromName,
  RESERVED_HANDLES,
  resolveHandle,
  setHandle,
  validateHandle,
} from './handle';

describe('@tên người dùng (SPEC-identity.md V5.1)', () => {
  it('luật hợp lệ: 3–24 ký tự a-z 0-9 . _, không chấm ở đầu/cuối, không 2 chấm liền, không từ dành riêng', () => {
    for (const ok of ['hai', 'nguyen.hai', 'hai_9mua', 'a1b', 'x'.repeat(24)])
      expect(validateHandle(ok), ok).toBe(null);
    for (const bad of ['ab', 'x'.repeat(25), 'Hai', 'hải', 'hai-9', '.hai', 'hai.', 'ha..i', 'hai 9'])
      expect(validateHandle(bad), bad).toBe('INVALID');
    for (const r of ['admin', '9mua', 'ceo', 'live', 'video', 'cho', 'kiot', 'api', 'watch', 'nhom'])
      expect(validateHandle(r), r).toBe('RESERVED');
    expect(RESERVED_HANDLES.length).toBeGreaterThan(20);
  });

  it('tên tự đặt từ tên hiển thị: bỏ dấu, viết liền; ngắn quá thì thêm chữ', () => {
    expect(handleFromName('Nguyễn Hải')).toBe('nguyenhai');
    expect(handleFromName('Đỗ Thị Mai Anh 9MUA!')).toBe('dothimaianh9mua');
    expect(handleFromName('A')).toBe('auser');
    expect(handleFromName('Một cái tên rất rất dài quá mức cho phép')).toHaveLength(20);
  });

  it('tự đặt cho tài khoản chưa có: trùng thì thêm 4 số; không đụng cột khác', async () => {
    const a = await createUser({ displayName: 'Nguyễn Hải' });
    const b = await createUser({ displayName: 'Nguyen Hai' });
    const admin = await createUser({ displayName: 'Admin' });
    expect(await assignMissingHandles(100)).toBe(3);
    const [ha, hb, hadmin] = await Promise.all(
      [a, b, admin].map(async (u) => (await db.user.findUniqueOrThrow({ where: { id: u.id } })).handle),
    );
    expect(ha).toBe('nguyenhai');
    expect(hb).toMatch(/^nguyenhai\d{4}$/);
    expect(hadmin).toMatch(/^admin\d{4}$/); // "admin" là từ dành riêng
    expect(await assignMissingHandles(100)).toBe(0);
    expect(await ensureHandle(a.id)).toBe('nguyenhai');
  });

  it('đổi @tên 30 ngày một lần; @tên cũ giữ 30 ngày và chuyển hướng, người khác không lấy được', async () => {
    setClock(new Date('2026-11-01T03:00:00Z'));
    const u = await createUser({ displayName: 'Chị Hoa' });
    const other = await createUser({ displayName: 'Người khác' });
    await ensureHandle(u.id);
    await ensureHandle(other.id);
    expect(await setHandle(u.id, 'Hoa.Vuon')).toEqual({ ok: false, error: 'INVALID' });
    expect(await setHandle(u.id, 'admin')).toEqual({ ok: false, error: 'RESERVED' });
    expect(await setHandle(u.id, (await ensureHandle(other.id))!)).toEqual({ ok: false, error: 'TAKEN' });
    // Lần đầu đổi (tên tự đặt) được ngay.
    expect(await setHandle(u.id, 'hoa.vuon')).toEqual({ ok: true });
    expect(await resolveHandle('hoa.vuon')).toEqual({ userId: u.id });
    expect(await resolveHandle('chihoa')).toEqual({ redirectTo: 'hoa.vuon' });
    expect(await setHandle(other.id, 'chihoa')).toEqual({ ok: false, error: 'TAKEN' });
    advanceClock({ days: 29 });
    expect(await setHandle(u.id, 'hoa.vuon2')).toEqual({ ok: false, error: 'TOO_SOON' });
    advanceClock({ days: 2 });
    expect(await resolveHandle('chihoa')).toBeNull();
    expect(await setHandle(other.id, 'chihoa')).toEqual({ ok: true });
    expect(await setHandle(u.id, 'hoa.vuon2')).toEqual({ ok: true });
    expect(await resolveHandle('@HOA.VUON2')).toEqual({ userId: u.id });
    expect(await resolveHandle('khong.co.ai')).toBeNull();
  });

  it('tài khoản bị khoá hoặc đã xoá không có trang @tên', async () => {
    const u = await createUser({ displayName: 'Bị Khoá' });
    const h = await ensureHandle(u.id);
    await db.user.update({ where: { id: u.id }, data: { lockedAt: new Date() } });
    expect(await resolveHandle(h!)).toBeNull();
  });
});
