import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { searchVideos } from '@/modules/creator';
import { searchPublicUsers } from '@/modules/identity';
import { searchHashtags } from '@/modules/social';
import { createUser } from '../../../tests/helpers/factories';

async function video(
  authorId: string,
  caption: string,
  data: Partial<{ status: string; kind: string; score: number; hashtags: string[] }> = {},
) {
  return db.video.create({
    data: {
      authorId,
      caption,
      hashtags: data.hashtags ?? [],
      status: data.status ?? 'ready',
      kind: data.kind ?? 'video',
      score: data.score ?? 0,
      fileUrl: '/uploads/v.mp4',
      posterUrl: '/uploads/v.jpg',
      readyAt: new Date(),
    },
  });
}

describe('tìm kiếm (SPEC-social.md bổ sung 30/10, A3)', () => {
  it('tài khoản: không dấu, tên bắt đầu bằng từ khoá lên trước, rồi nhiều người theo dõi; bỏ tài khoản khoá và admin', async () => {
    const a = await createUser({ displayName: 'Vườn Thanh Long Bình Thuận' });
    const b = await createUser({ displayName: 'Chị Thanh Long' });
    const c = await createUser({ displayName: 'Anh Thanh Long Ruột Đỏ' });
    const locked = await createUser({ displayName: 'Thanh Long Bị Khoá' });
    const admin = await createUser({ displayName: 'Thanh Long CEO' });
    await db.user.update({ where: { id: locked.id }, data: { lockedAt: new Date() } });
    await db.user.update({ where: { id: admin.id }, data: { role: 'admin' } });
    const fan = await createUser();
    await db.follow.create({ data: { followerId: fan.id, followeeId: c.id } });

    const found = await searchPublicUsers('thanh long', 10);
    expect(found.map((u) => u.id)).toEqual([c.id, b.id, a.id]);
    expect(found[0]).toEqual({
      id: c.id,
      displayName: 'Anh Thanh Long Ruột Đỏ',
      avatarUrl: null,
      followers: 1,
    });
    const prefix = await createUser({ displayName: 'Thanh Long Xanh' });
    expect((await searchPublicUsers('THANH LONG', 10))[0]!.id).toBe(prefix.id);
    expect((await searchPublicUsers('binh thuan vuon', 10)).map((u) => u.id)).toEqual([a.id]);
    expect(await searchPublicUsers('%', 10)).toEqual([]);
    expect(await searchPublicUsers('   ', 10)).toEqual([]);
  });

  it('video: theo chú thích và hashtag, chỉ video đang lên feed, xếp theo điểm', async () => {
    const u = await createUser();
    const low = await video(u.id, 'Thanh long ruột đỏ', { score: 1 });
    const high = await video(u.id, 'Trái cây miền Tây', { score: 5, hashtags: ['thanhlong'] });
    await video(u.id, 'Thanh long đang xử lý', { status: 'processing' });
    await video(u.id, 'Story thanh long', { kind: 'story' });
    const lockedUser = await createUser();
    await db.user.update({ where: { id: lockedUser.id }, data: { lockedAt: new Date() } });
    await video(lockedUser.id, 'Thanh long của tài khoản khoá');

    // "thanh long" ra cả video có #thanhlong; điểm cao lên trước.
    expect((await searchVideos('thanh long', 10)).map((v) => v.id)).toEqual([high.id, low.id]);
    // Đủ các từ, không cần đúng thứ tự hay đứng liền nhau.
    expect((await searchVideos('ruot do thanh', 10)).map((v) => v.id)).toEqual([low.id]);
    expect((await searchVideos('thanhlong', 10)).map((v) => v.id)).toEqual([high.id]);
    expect((await searchVideos('#ThanhLong', 10)).map((v) => v.id)).toEqual([high.id]);
    expect(await searchVideos('', 10)).toEqual([]);
  });

  it('hashtag: theo tên, kèm số video, nhiều video lên trước', async () => {
    const u = await createUser();
    await video(u.id, 'a', { hashtags: ['thanhlong', 'traicay'] });
    await video(u.id, 'b', { hashtags: ['thanhlong'] });
    await video(u.id, 'c', { hashtags: ['thanhlongdo'] });
    await video(u.id, 'd', { hashtags: ['thanhlong'], status: 'processing' });
    expect(await searchHashtags('Thanh Long', 10)).toEqual([
      { tag: 'thanhlong', videos: 2 },
      { tag: 'thanhlongdo', videos: 1 },
    ]);
    expect(await searchHashtags('#trai', 10)).toEqual([{ tag: 'traicay', videos: 1 }]);
  });
});
