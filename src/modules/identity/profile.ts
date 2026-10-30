import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { processCroppedImage, type ImageError } from '@/lib/media/process-image';

// Hồ sơ công khai (SPEC-social.md bổ sung 30/10, A2): ảnh đại diện, ảnh bìa, giới thiệu.
export type ProfileImageKind = 'avatar' | 'cover';
export type PublicProfile = { id: string; displayName: string; avatarUrl: string | null };

export const MAX_BIO = 160;
export const MAX_BIO_LINES = 4;
const MAX_IMAGE_CHANGES_PER_DAY = 20;

const SIZE: Record<ProfileImageKind, { width: number; height: number }> = {
  avatar: { width: 400, height: 400 },
  cover: { width: 1200, height: 400 },
};
const column = { avatar: 'avatarUrl', cover: 'coverUrl' } as const;

// Đếm số lần đổi ảnh trong ngày (giờ Việt Nam) ngay trong tiến trình: web chạy 1 tiến trình Node, khởi động lại thì
// đếm lại từ 0 — chấp nhận được vì đây chỉ là chặn spam, không phải giới hạn tiền.
const changes = new Map<string, number>();
const vnDayKey = () => new Date(now().getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

function takeImageChange(userId: string): boolean {
  const key = `${userId}:${vnDayKey()}`;
  const used = changes.get(key) ?? 0;
  if (used >= MAX_IMAGE_CHANGES_PER_DAY) return false;
  if (changes.size > 10_000) for (const k of changes.keys()) if (!k.endsWith(vnDayKey())) changes.delete(k);
  changes.set(key, used + 1);
  return true;
}

// Ảnh mới lưu xong mới cập nhật hồ sơ, rồi mới xoá file ảnh cũ.
export async function setProfileImage(
  userId: string,
  kind: ProfileImageKind,
  data: Buffer,
): Promise<{ ok: true; url: string } | { ok: false; error: ImageError | 'NOT_FOUND' | 'DAILY_LIMIT' }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true, coverUrl: true },
  });
  if (!user) return { ok: false, error: 'NOT_FOUND' };
  const processed = await processCroppedImage(data, SIZE[kind]);
  if (!processed.ok) return processed;
  if (!takeImageChange(userId)) return { ok: false, error: 'DAILY_LIMIT' };
  const key = `users/${userId}/${kind}-${now().getTime()}-${randomBytes(6).toString('base64url')}.webp`;
  const store = imageStore();
  const url = await store.save(key, processed.data);
  await db.user.update({ where: { id: userId }, data: { [column[kind]]: url } });
  const old = user[column[kind]];
  if (old) await store.remove(old);
  return { ok: true, url };
}

export async function removeProfileImage(userId: string, kind: ProfileImageKind): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true, coverUrl: true },
  });
  if (!user) return;
  await db.user.update({ where: { id: userId }, data: { [column[kind]]: null } });
  const old = user[column[kind]];
  if (old) await imageStore().remove(old);
}

// Tên + ảnh đại diện để module khác hiện người dùng (video, bình luận, Hộp thư, Live). Không bao giờ trả email/SĐT.
export async function publicProfiles(ids: string[]): Promise<PublicProfile[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  return db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
}

// CEO gỡ hồ sơ vi phạm (module admin ghi nhật ký và báo người dùng). Trả bản trước khi gỡ; null nếu không có người dùng.
export async function clearProfile(
  userId: string,
): Promise<{ avatarUrl: string | null; coverUrl: string | null; bio: string | null } | null> {
  const before = await db.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true, coverUrl: true, bio: true },
  });
  if (!before) return null;
  await db.user.update({ where: { id: userId }, data: { avatarUrl: null, coverUrl: null, bio: null } });
  const store = imageStore();
  for (const url of [before.avatarUrl, before.coverUrl]) if (url) await store.remove(url);
  return before;
}

export type FullPublicProfile = PublicProfile & { coverUrl: string | null; bio: string | null };

// Hồ sơ đầy đủ cho trang cá nhân / trang Sửa hồ sơ; null nếu không có hoặc tài khoản bị khoá.
export async function getPublicProfile(userId: string): Promise<FullPublicProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, avatarUrl: true, coverUrl: true, bio: true, lockedAt: true },
  });
  if (!user || user.lockedAt) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
  };
}
