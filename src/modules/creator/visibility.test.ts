import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { addComment, hashtagVideos, toggleFollow, followingFeed } from '@/modules/social';
import { createUser } from '../../../tests/helpers/factories';
import { getFeed, getVideo } from './feed';
import { getCreatorProfile, getHotVideos } from './profile';
import { searchVideos } from './search';
import { canViewVideo, setVideoOptions } from './visibility';

async function video(authorId: string, caption: string, visibility = 'public') {
  return db.video.create({
    data: {
      authorId,
      caption,
      hashtags: ['rieng'],
      status: 'ready',
      fileUrl: '/uploads/v.mp4',
      readyAt: new Date(),
      visibility,
    },
  });
}

describe('quyền riêng tư từng video + canViewVideo (SPEC-creator.md V5.3)', () => {
  it('public: ai cũng xem; followers: chỉ người đang follow và chủ; private: chỉ chủ', async () => {
    const author = await createUser();
    const fan = await createUser();
    const stranger = await createUser();
    await toggleFollow(fan.id, author.id);
    const pub = await video(author.id, 'công khai');
    const fol = await video(author.id, 'người follow', 'followers');
    const pri = await video(author.id, 'chỉ mình tôi', 'private');

    for (const [v, viewer, expected] of [
      [pub, undefined, true],
      [pub, stranger.id, true],
      [fol, undefined, false],
      [fol, stranger.id, false],
      [fol, fan.id, true],
      [fol, author.id, true],
      [pri, fan.id, false],
      [pri, author.id, true],
    ] as const)
      expect(await canViewVideo(v.id, viewer), `${v.caption} / ${viewer ?? 'khách'}`).toBe(expected);

    // /v/<id>
    expect(await getVideo(fol.id, { userId: fan.id })).not.toBeNull();
    expect(await getVideo(fol.id, { userId: stranger.id })).toBeNull();
    expect(await getVideo(pri.id, { userId: author.id })).not.toBeNull();
  });

  it('video không public không vào feed Dành cho bạn, hashtag, tìm kiếm, video hot', async () => {
    const author = await createUser();
    const fan = await createUser();
    await toggleFollow(fan.id, author.id);
    await video(author.id, 'rieng tu cong khai');
    await video(author.id, 'rieng tu follow', 'followers');
    await video(author.id, 'rieng tu rieng', 'private');
    const captions = (items: { caption: string }[]) => items.map((v) => v.caption).sort();
    expect(captions((await getFeed({ userId: fan.id })).items)).toEqual(['rieng tu cong khai']);
    expect(captions(await hashtagVideos('rieng', {}))).toEqual(['rieng tu cong khai']);
    expect(captions(await searchVideos('rieng tu', 10))).toEqual(['rieng tu cong khai']);
    expect(captions(await getHotVideos(10))).toEqual(['rieng tu cong khai']);
    // Tab Đang Follow: người follow thấy cả video "người follow", không thấy "chỉ mình tôi".
    expect(captions((await followingFeed({ userId: fan.id })).items)).toEqual([
      'rieng tu cong khai',
      'rieng tu follow',
    ]);
  });

  it('trang cá nhân: người lạ chỉ thấy public; chủ thấy hết', async () => {
    const author = await createUser();
    const stranger = await createUser();
    await video(author.id, 'a');
    await video(author.id, 'b', 'followers');
    await video(author.id, 'c', 'private');
    expect((await getCreatorProfile(author.id, stranger.id))!.videos).toHaveLength(1);
    expect((await getCreatorProfile(author.id))!.videos).toHaveLength(1);
    expect((await getCreatorProfile(author.id, author.id))!.videos).toHaveLength(3);
  });

  it('tắt bình luận thì không bình luận được; chỉ chủ video đổi được tuỳ chọn', async () => {
    const author = await createUser();
    const other = await createUser();
    const v = await video(author.id, 'x');
    expect(await setVideoOptions(other.id, v.id, { allowComments: false })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await setVideoOptions(author.id, v.id, { allowComments: false })).toEqual({ ok: true });
    expect(await addComment(other.id, v.id, 'chào')).toEqual({ ok: false, error: 'COMMENTS_OFF' });
    expect(await setVideoOptions(author.id, v.id, { visibility: 'followers' })).toEqual({ ok: true });
    // Người không follow không thấy video "người follow" nên cũng không bình luận được.
    expect(await addComment(other.id, v.id, 'chào')).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await setVideoOptions(author.id, v.id, { visibility: 'ai-cung-duoc' as never })).toEqual({
      ok: false,
      error: 'INVALID',
    });
  });
});
