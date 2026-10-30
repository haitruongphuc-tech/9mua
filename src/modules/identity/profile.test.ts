import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createUser, sampleImage } from '../../../tests/helpers/factories';
import { updateProfile } from './account';
import { clearProfile, publicProfiles, removeProfileImage, setProfileImage } from './profile';

const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

describe('hồ sơ công khai (SPEC-social.md bổ sung 30/10, A2)', () => {
  it('giới thiệu: tối đa 160 ký tự, 4 dòng, không link; để trống là xoá', async () => {
    const u = await createUser();
    expect(await updateProfile(u.id, { bio: '  Bán thanh long Bình Thuận 🍉  ' })).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).bio).toBe(
      'Bán thanh long Bình Thuận 🍉',
    );
    expect(await updateProfile(u.id, { bio: 'a'.repeat(161) })).toMatchObject({
      ok: false,
      error: 'BIO_TOO_LONG',
    });
    expect(await updateProfile(u.id, { bio: '1\n2\n3\n4\n5' })).toMatchObject({
      ok: false,
      error: 'BIO_TOO_LONG',
    });
    expect(await updateProfile(u.id, { bio: 'Mua tại shopee.vn/abc' })).toMatchObject({
      ok: false,
      error: 'HAS_LINK',
    });
    // Đổi tên không đụng tới giới thiệu.
    expect(await updateProfile(u.id, { displayName: 'Chị Hoa' })).toEqual({ ok: true });
    expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({
      displayName: 'Chị Hoa',
      bio: 'Bán thanh long Bình Thuận 🍉',
    });
    expect(await updateProfile(u.id, { bio: '   ' })).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).bio).toBeNull();
  });

  it('ảnh đại diện cắt vuông 400×400, ảnh bìa 1200×400; đổi ảnh thì xoá file cũ', async () => {
    const u = await createUser();
    const first = await setProfileImage(u.id, 'avatar', await sampleImage('#fc6f15', 900, 600));
    if (!first.ok) throw new Error(first.error);
    expect(await sharp(fileOf(first.url)).metadata()).toMatchObject({
      width: 400,
      height: 400,
      format: 'webp',
    });
    const second = await setProfileImage(u.id, 'avatar', await sampleImage('#1a1410', 500, 800));
    if (!second.ok) throw new Error(second.error);
    expect(existsSync(fileOf(first.url))).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).avatarUrl).toBe(second.url);

    const cover = await setProfileImage(u.id, 'cover', await sampleImage('#c2410c', 1600, 900));
    if (!cover.ok) throw new Error(cover.error);
    expect(await sharp(fileOf(cover.url)).metadata()).toMatchObject({ width: 1200, height: 400 });
    await removeProfileImage(u.id, 'cover');
    expect(existsSync(fileOf(cover.url))).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).coverUrl).toBeNull();
  });

  it('từ chối file không phải ảnh (đổi đuôi)', async () => {
    const u = await createUser();
    expect(await setProfileImage(u.id, 'avatar', Buffer.from('<?php echo 1; ?>'))).toEqual({
      ok: false,
      error: 'NOT_AN_IMAGE',
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).avatarUrl).toBeNull();
  });

  it('mỗi người đổi ảnh tối đa 20 lần mỗi ngày', async () => {
    const u = await createUser();
    const img = await sampleImage('#fc6f15', 40, 40);
    for (let i = 0; i < 20; i++) expect((await setProfileImage(u.id, 'avatar', img)).ok).toBe(true);
    expect(await setProfileImage(u.id, 'cover', img)).toEqual({ ok: false, error: 'DAILY_LIMIT' });
  });

  it('publicProfiles chỉ trả tên và ảnh đại diện (không email/SĐT)', async () => {
    const a = await createUser({ displayName: 'Anh A' });
    const b = await createUser({ displayName: 'Chị B' });
    const set = await setProfileImage(b.id, 'avatar', await sampleImage());
    if (!set.ok) throw new Error(set.error);
    const list = await publicProfiles([a.id, b.id, 'khong-co']);
    expect(list).toEqual(
      expect.arrayContaining([
        { id: a.id, displayName: 'Anh A', avatarUrl: null },
        { id: b.id, displayName: 'Chị B', avatarUrl: set.url },
      ]),
    );
    expect(list).toHaveLength(2);
    expect(await publicProfiles([])).toEqual([]);
  });

  it('clearProfile gỡ ảnh đại diện, ảnh bìa, giới thiệu và xoá file; trả lại bản trước để ghi nhật ký', async () => {
    const u = await createUser();
    await updateProfile(u.id, { bio: 'Giới thiệu vi phạm' });
    const av = await setProfileImage(u.id, 'avatar', await sampleImage());
    const cv = await setProfileImage(u.id, 'cover', await sampleImage());
    if (!av.ok || !cv.ok) throw new Error('setup');
    expect(await clearProfile(u.id)).toEqual({
      avatarUrl: av.url,
      coverUrl: cv.url,
      bio: 'Giới thiệu vi phạm',
    });
    expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({
      avatarUrl: null,
      coverUrl: null,
      bio: null,
    });
    expect(existsSync(fileOf(av.url))).toBe(false);
    expect(existsSync(fileOf(cv.url))).toBe(false);
    expect(await clearProfile('khong-co')).toBeNull();
  });
});
