import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createUser, sampleImage } from '../../../tests/helpers/factories';
import {
  addPostComment,
  canViewPost,
  createPost,
  deletePost,
  hashtagPosts,
  listPostComments,
  postFeed,
  postsByAuthor,
  savePostImage,
  togglePostLike,
  updatePost,
} from './posts';

async function upload(userId: string, color = '#fc6f15') {
  const r = await savePostImage(userId, await sampleImage(color));
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

describe('bài đăng ảnh + chữ (SPEC-creator.md V5.10)', () => {
  it('kiểm nội dung: phải có chữ hoặc ảnh, ≤ 2.000 ký tự, không link, ≤ 10 ảnh, nền màu chỉ cho bài chữ ≤ 300', async () => {
    const u = await createUser();
    expect(await createPost(u.id, { text: '  ', imageIds: [] })).toEqual({ ok: false, error: 'EMPTY' });
    expect(await createPost(u.id, { text: 'x'.repeat(2001), imageIds: [] })).toEqual({
      ok: false,
      error: 'TOO_LONG',
    });
    expect(await createPost(u.id, { text: 'mua ở shop.vn nhé', imageIds: [] })).toEqual({
      ok: false,
      error: 'HAS_LINK',
    });
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) ids.push(await upload(u.id));
    expect(await createPost(u.id, { text: '', imageIds: ids })).toEqual({
      ok: false,
      error: 'TOO_MANY_IMAGES',
    });
    const other = await createUser();
    expect(await createPost(other.id, { text: '', imageIds: [ids[0]!] })).toEqual({
      ok: false,
      error: 'IMAGE_INVALID',
    });
    expect(await createPost(u.id, { text: 'x'.repeat(301), imageIds: [], bgColor: '#ff6b00' })).toEqual({
      ok: false,
      error: 'BG_INVALID',
    });
    expect(await createPost(u.id, { text: 'Có ảnh', imageIds: [ids[0]!], bgColor: '#ff6b00' })).toEqual({
      ok: false,
      error: 'BG_INVALID',
    });

    const long = await createPost(u.id, {
      text: `Dòng 1\nDòng 2 #mucmotnang\n${'a'.repeat(1950)}`,
      imageIds: [],
    });
    expect(long.ok).toBe(true);
    const bg = await createPost(u.id, { text: 'Chào cả nhà!', imageIds: [], bgColor: '#7c3aed' });
    const photos = await createPost(u.id, { text: 'Ảnh mới', imageIds: ids.slice(0, 3) });
    if (!long.ok || !bg.ok || !photos.ok) throw new Error('đăng lỗi');
    const p = await db.post.findUniqueOrThrow({ where: { id: long.postId } });
    expect(p.text.startsWith('Dòng 1\nDòng 2')).toBe(true);
    expect(p.hashtags).toEqual(['mucmotnang']);
    expect(await db.postImage.count({ where: { postId: photos.postId } })).toBe(3);
    expect(await db.postUpload.count({ where: { id: { in: ids.slice(0, 3) } } })).toBe(0); // ảnh đã gắn vào bài

    // Sửa: bỏ ảnh 2, thêm 1 ảnh mới, sửa chữ.
    const added = await upload(u.id, '#123456');
    const imgs = await db.postImage.findMany({
      where: { postId: photos.postId },
      orderBy: { position: 'asc' },
    });
    expect(
      await updatePost(u.id, photos.postId, {
        text: 'Ảnh mới (sửa)',
        keepImageUrls: [imgs[2]!.url, imgs[0]!.url],
        imageIds: [added],
        productIds: [],
      }),
    ).toEqual({ ok: true });
    const after = await db.post.findUniqueOrThrow({
      where: { id: photos.postId },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    expect(after.text).toBe('Ảnh mới (sửa)');
    expect(after.editedAt).not.toBeNull();
    expect(after.images.map((i) => i.url).slice(0, 2)).toEqual([imgs[2]!.url, imgs[0]!.url]);
    expect(after.images).toHaveLength(3);
  });

  it('quyền xem, feed, trang cá nhân, hashtag, thích, bình luận; xoá thì không xem được', async () => {
    const author = await createUser({ displayName: 'Người viết' });
    const fan = await createUser();
    const tag = `bai${Date.now()}`;
    const pub = await createPost(author.id, { text: `Bài công khai #${tag}`, imageIds: [] });
    const priv = await createPost(author.id, { text: 'Bài riêng tư', imageIds: [], visibility: 'private' });
    const draft = await createPost(author.id, { text: 'Bài nháp', imageIds: [], draft: true });
    if (!pub.ok || !priv.ok || !draft.ok) throw new Error('đăng lỗi');
    expect(await canViewPost(pub.postId, null)).toBe(true);
    expect(await canViewPost(priv.postId, fan.id)).toBe(false);
    expect(await canViewPost(priv.postId, author.id)).toBe(true);
    expect(await canViewPost(draft.postId, fan.id)).toBe(false);

    expect((await postFeed({ userId: fan.id }, null, 50)).items.map((p) => p.id)).toContain(pub.postId);
    expect((await postFeed({ userId: fan.id }, null, 50)).items.map((p) => p.id)).not.toContain(priv.postId);
    expect((await postsByAuthor(author.id, { userId: fan.id })).map((p) => p.id)).toEqual([pub.postId]);
    expect((await postsByAuthor(author.id, { userId: author.id })).map((p) => p.id)).toHaveLength(3);
    expect((await hashtagPosts(tag, {})).map((p) => p.id)).toEqual([pub.postId]);

    expect(await togglePostLike(fan.id, pub.postId)).toEqual({ ok: true, liked: true, likes: 1 });
    expect(await togglePostLike(fan.id, priv.postId)).toMatchObject({ ok: false });
    expect(await addPostComment(fan.id, pub.postId, 'xem ở abc.com')).toEqual({
      ok: false,
      error: 'HAS_LINK',
    });
    expect((await addPostComment(fan.id, pub.postId, 'Hay quá')).ok).toBe(true);
    expect((await listPostComments(pub.postId, fan.id)).map((c) => c.text)).toEqual(['Hay quá']);

    expect(await deletePost(fan.id, pub.postId)).toBe(false);
    expect(await deletePost(author.id, pub.postId)).toBe(true);
    expect(await canViewPost(pub.postId, author.id)).toBe(false);
  });

  it('tối đa 20 bài mỗi ngày', async () => {
    const u = await createUser();
    for (let i = 0; i < 20; i++)
      expect((await createPost(u.id, { text: `Bài ${i}`, imageIds: [] })).ok).toBe(true);
    expect(await createPost(u.id, { text: 'Bài 21', imageIds: [] })).toEqual({
      ok: false,
      error: 'DAILY_LIMIT',
    });
  });
});
