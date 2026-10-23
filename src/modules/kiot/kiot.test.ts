import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { createKiot, getKiotByOwner, isSlugAvailable, kiotStatus, updateKiot } from './kiot';

const input = {
  name: 'Thanh Long Bình Thuận',
  slug: 'thanh-long-binh-thuan',
  contactPhone: '0979 393 916',
  description: 'Thanh long ruột đỏ',
};

describe('tạo Kiot', () => {
  it('tạo Kiot nháp, chuẩn hoá SĐT liên hệ', async () => {
    const user = await createUser();
    const result = await createKiot(user.id, input);
    expect(result.ok).toBe(true);
    const kiot = await getKiotByOwner(user.id);
    expect(kiot).toMatchObject({
      slug: 'thanh-long-binh-thuan',
      contactPhone: '+84979393916',
      activeUntil: null,
    });
    expect(kiotStatus(kiot!)).toBe('draft');
  });

  it('mỗi tài khoản chỉ 1 Kiot', async () => {
    const user = await createUser();
    await createKiot(user.id, input);
    expect(await createKiot(user.id, { ...input, slug: 'kiot-thu-hai' })).toEqual({
      ok: false,
      error: 'ALREADY_HAS_KIOT',
    });
  });

  it('slug trùng, cấm, sai định dạng bị từ chối', async () => {
    const a = await createUser();
    const b = await createUser();
    await createKiot(a.id, input);
    expect(await createKiot(b.id, input)).toEqual({ ok: false, error: 'SLUG_TAKEN' });
    expect(await createKiot(b.id, { ...input, slug: 'admin' })).toEqual({
      ok: false,
      error: 'SLUG_RESERVED',
    });
    expect(await createKiot(b.id, { ...input, slug: 'Thanh Long' })).toEqual({
      ok: false,
      error: 'SLUG_INVALID',
    });
  });

  it('hai người cùng lấy một slug cùng lúc: chỉ một người được', async () => {
    const [a, b] = [await createUser(), await createUser()];
    const results = await Promise.all([createKiot(a.id, input), createKiot(b.id, input)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: 'SLUG_TAKEN' });
  });

  it('dữ liệu không hợp lệ báo theo trường', async () => {
    const user = await createUser();
    const result = await createKiot(user.id, {
      name: 'A',
      slug: 'abc-xyz',
      contactPhone: '123',
      description: 'x'.repeat(501),
    });
    expect(result).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { name: expect.any(String), contactPhone: expect.any(String), description: expect.any(String) },
    });
  });

  it('isSlugAvailable cho ô kiểm tra khi gõ', async () => {
    const user = await createUser();
    await createKiot(user.id, input);
    expect(await isSlugAvailable('thanh-long-binh-thuan')).toEqual({ ok: false, error: 'SLUG_TAKEN' });
    expect(await isSlugAvailable('www')).toEqual({ ok: false, error: 'SLUG_RESERVED' });
    expect(await isSlugAvailable('slug-moi')).toEqual({ ok: true });
  });
});

describe('sửa Kiot', () => {
  it('đổi slug được khi còn nháp', async () => {
    const user = await createUser();
    await createKiot(user.id, input);
    expect(await updateKiot(user.id, { ...input, slug: 'thanh-long-ruot-do' })).toEqual({ ok: true });
    expect((await getKiotByOwner(user.id))?.slug).toBe('thanh-long-ruot-do');
  });

  it('không đổi slug được sau khi đã kích hoạt, nhưng sửa thông tin khác được', async () => {
    const user = await createUser();
    await createKiot(user.id, input);
    await db.kiot.update({
      where: { ownerId: user.id },
      data: { activeUntil: new Date(Date.now() + 86_400_000) },
    });
    expect(await updateKiot(user.id, { ...input, slug: 'slug-khac' })).toEqual({
      ok: false,
      error: 'SLUG_LOCKED',
    });
    expect(await updateKiot(user.id, { ...input, name: 'Thanh Long Ruột Đỏ' })).toEqual({ ok: true });
    expect((await getKiotByOwner(user.id))?.name).toBe('Thanh Long Ruột Đỏ');
  });

  it('người chưa có Kiot không sửa được', async () => {
    const user = await createUser();
    expect(await updateKiot(user.id, input)).toEqual({ ok: false, error: 'NO_KIOT' });
  });
});

describe('trạng thái Kiot', () => {
  it('nháp → hoạt động → hết hạn; khoá luôn thắng', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const base = { activeUntil: null as Date | null, lockedAt: null as Date | null };
    expect(kiotStatus(base)).toBe('draft');
    const active = { ...base, activeUntil: new Date('2027-10-23T00:00:00Z') };
    expect(kiotStatus(active)).toBe('active');
    advanceClock({ days: 366 });
    expect(kiotStatus(active)).toBe('expired');
    expect(kiotStatus({ ...active, lockedAt: new Date() })).toBe('locked');
  });
});
