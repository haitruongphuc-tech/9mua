import { describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { followingFeed } from './follow';
import {
  reactionSummary,
  repostedContent,
  setPostReaction,
  setVideoReaction,
  toggleRepost,
} from './reactions';

const video = (authorId: string, visibility = 'public') =>
  db.video.create({
    data: { authorId, status: 'ready', visibility, fileUrl: '/uploads/x.mp4', readyAt: now() },
  });

describe('cảm xúc và đăng lại (SPEC-social.md V5.8–V5.9)', () => {
  it('video: mỗi người một cảm xúc, đổi được, bỏ được; tổng = số cảm xúc; xem từng loại', async () => {
    const author = await createUser();
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const v = await video(author.id);
    expect(await setVideoReaction(a.id, v.id, 'haha')).toMatchObject({
      ok: true,
      reaction: 'haha',
      total: 1,
    });
    expect(await setVideoReaction(b.id, v.id, 'love')).toMatchObject({ ok: true, total: 2 });
    expect(await setVideoReaction(a.id, v.id, 'wow')).toMatchObject({ ok: true, reaction: 'wow', total: 2 });
    expect(await reactionSummary({ videoId: v.id })).toMatchObject({ wow: 1, love: 1, haha: 0, like: 0 });
    expect(await setVideoReaction(a.id, v.id, null)).toMatchObject({ ok: true, reaction: null, total: 1 });
  });

  it('bài viết: cảm xúc lưu ở bảng Reaction', async () => {
    const author = await createUser();
    const fan = await createUser();
    const post = await db.post.create({ data: { authorId: author.id, text: 'Chào', status: 'ready' } });
    expect(await setPostReaction(fan.id, post.id, 'sad')).toMatchObject({
      ok: true,
      reaction: 'sad',
      total: 1,
    });
    expect(await setPostReaction(fan.id, post.id, 'angry')).toMatchObject({
      ok: true,
      reaction: 'angry',
      total: 1,
    });
    expect(await reactionSummary({ postId: post.id })).toMatchObject({ angry: 1 });
  });

  it('đăng lại: 1 lần, bỏ được; không đăng lại nội dung của mình hay không công khai; hiện ở tab Đang Follow', async () => {
    const author = await createUser();
    const reposter = await createUser({ displayName: 'Người đăng lại' });
    const follower = await createUser();
    await db.follow.create({ data: { followerId: follower.id, followeeId: reposter.id } });
    const v = await video(author.id);
    const priv = await video(author.id, 'private');
    expect(await toggleRepost(author.id, { videoId: v.id })).toEqual({ ok: false, error: 'OWN' });
    expect(await toggleRepost(reposter.id, { videoId: priv.id })).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await toggleRepost(reposter.id, { videoId: v.id })).toEqual({ ok: true, reposted: true });
    expect(await db.notification.count({ where: { userId: author.id, title: '@notify.reposted' } })).toBe(1);
    const feed = await followingFeed({ userId: follower.id });
    expect(feed.items.find((x) => x.id === v.id)?.repostedBy).toBe('Người đăng lại');
    expect((await repostedContent(reposter.id, follower.id)).videos.map((x) => x.id)).toEqual([v.id]);
    expect(await toggleRepost(reposter.id, { videoId: v.id })).toEqual({ ok: true, reposted: false });
    expect(await db.repost.count({ where: { userId: reposter.id } })).toBe(0);
  });
});
