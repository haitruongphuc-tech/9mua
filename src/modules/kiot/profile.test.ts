import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createSeller, createUser, sampleImage } from '../../../tests/helpers/factories';
import { removeKiotImage, setKiotImage, updateKiotAddress } from './profile';
import { getPublicKiot } from './public';
import { provinceName, PROVINCES } from './provinces';

const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

describe('địa chỉ lấy hàng', () => {
  it('lưu tỉnh theo danh sách 34 tỉnh/thành; quận và địa chỉ tuỳ chọn', async () => {
    expect(PROVINCES).toHaveLength(34);
    const s = await createSeller({ active: true });
    expect(
      await updateKiotAddress(s.user.id, { province: 'lam-dong', district: ' Đà Lạt ', addressLine: '' }),
    ).toEqual({ ok: true });
    expect(await db.kiot.findUniqueOrThrow({ where: { id: s.kiotId } })).toMatchObject({
      province: 'lam-dong',
      district: 'Đà Lạt',
      addressLine: null,
    });
    expect(provinceName('lam-dong')).toBe('Lâm Đồng');
  });

  it('từ chối tỉnh lạ; người chưa có Kiot', async () => {
    const s = await createSeller();
    expect(
      await updateKiotAddress(s.user.id, { province: 'sai-gon', district: '', addressLine: '' }),
    ).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { province: 'Chọn tỉnh/thành' },
    });
    const u = await createUser();
    expect(await updateKiotAddress(u.id, { province: 'ha-noi', district: '', addressLine: '' })).toEqual({
      ok: false,
      error: 'NO_KIOT',
    });
  });

  it('địa chỉ chi tiết không lộ ra trang công khai', async () => {
    const s = await createSeller({ active: true });
    await updateKiotAddress(s.user.id, {
      province: 'ha-noi',
      district: 'Cầu Giấy',
      addressLine: 'Số 1 ngõ 2',
    });
    const pub = await getPublicKiot(s.slug, null);
    expect(pub?.kiot).toMatchObject({ province: 'ha-noi', district: 'Cầu Giấy' });
    expect(JSON.stringify(pub)).not.toContain('Số 1 ngõ 2');
  });
});

describe('logo và ảnh bìa', () => {
  it('đổi logo thì xoá file logo cũ; gỡ ảnh bìa thì xoá file', async () => {
    const s = await createSeller();
    const first = await setKiotImage(s.user.id, 'logo', await sampleImage('#fc6f15', 600, 600));
    if (!first.ok) throw new Error(first.error);
    const second = await setKiotImage(s.user.id, 'logo', await sampleImage('#1a1410', 600, 600));
    if (!second.ok) throw new Error(second.error);
    expect(existsSync(fileOf(first.url))).toBe(false);
    expect(existsSync(fileOf(second.url))).toBe(true);
    expect((await db.kiot.findUniqueOrThrow({ where: { id: s.kiotId } })).logoUrl).toBe(second.url);

    const cover = await setKiotImage(s.user.id, 'cover', await sampleImage('#c2410c', 1600, 600));
    if (!cover.ok) throw new Error(cover.error);
    await removeKiotImage(s.user.id, 'cover');
    expect(existsSync(fileOf(cover.url))).toBe(false);
    expect((await db.kiot.findUniqueOrThrow({ where: { id: s.kiotId } })).coverUrl).toBeNull();
  });

  it('từ chối file không phải ảnh', async () => {
    const s = await createSeller();
    expect(await setKiotImage(s.user.id, 'cover', Buffer.from('not an image'))).toEqual({
      ok: false,
      error: 'NOT_AN_IMAGE',
    });
  });
});
