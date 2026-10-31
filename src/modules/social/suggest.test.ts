import { describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { invalidateCached } from '@/lib/ttl-cache';
import { createUser } from '../../../tests/helpers/factories';
import {
  dismissSuggestion,
  followSuggestions,
  likedVideoIds,
  mutualFollowers,
  setShowLikedVideos,
} from './suggest';

const follow = (followerId: string, followeeId: string) =>
  db.follow.create({ data: { followerId, followeeId } });

describe('bạn chung, gợi ý follow, tab Đã thích (SPEC-social.md V5.1–V5.2)', () => {
  it('bạn chung: người mình follow cũng follow trang này; bỏ tài khoản bị khoá', async () => {
    const me = await createUser();
    const page = await createUser();
    const [a, b, c] = await Promise.all([
      createUser({ displayName: 'An' }),
      createUser({ displayName: 'Bình' }),
      createUser(),
    ]);
    for (const x of [a, b, c]) {
      await follow(me.id, x.id);
      await follow(x.id, page.id);
    }
    await db.user.update({ where: { id: c.id }, data: { lockedAt: now() } });
    const m = await mutualFollowers(me.id, page.id);
    expect(m.total).toBe(2);
    expect(m.people.map((p) => p.displayName)).toEqual(['An', 'Bình']);
  });

  it('gợi ý: theo số bạn chung; không gợi ý người đã follow, chính mình, đã ẩn; ít follow thì lấy creator nổi bật', async () => {
    const me = await createUser();
    const friends = await Promise.all([1, 2, 3].map(() => createUser()));
    const popular = await createUser();
    const lessPopular = await createUser();
    const followed = await createUser();
    for (const f of friends) {
      await follow(me.id, f.id);
      await follow(f.id, popular.id);
      await follow(f.id, me.id);
    }
    await follow(friends[0]!.id, lessPopular.id);
    await follow(me.id, followed.id);
    await follow(friends[0]!.id, followed.id);
    invalidateCached(`suggest:${me.id}`);
    const s = await followSuggestions(me.id);
    expect(s.map((p) => p.id).slice(0, 2)).toEqual([popular.id, lessPopular.id]);
    expect(s[0]!.mutual).toBe(3);
    expect(s.map((p) => p.id)).not.toContain(me.id);
    expect(s.map((p) => p.id)).not.toContain(followed.id);
    await dismissSuggestion(me.id, popular.id);
    expect((await followSuggestions(me.id)).map((p) => p.id)).not.toContain(popular.id);

    const newbie = await createUser();
    const star = await createUser();
    await db.video.create({
      data: { authorId: star.id, status: 'ready', fileUrl: '/x.mp4', readyAt: now(), likes: 999 },
    });
    expect((await followSuggestions(newbie.id)).map((p) => p.id)).toContain(star.id);
  });

  it('tab Đã thích: chủ trang thấy; người khác chỉ khi bật công khai', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const v = await db.video.create({
      data: { authorId: viewer.id, status: 'ready', fileUrl: '/x.mp4', readyAt: now() },
    });
    await db.videoLike.create({ data: { videoId: v.id, userId: owner.id, createdAt: now() } });
    expect(await likedVideoIds(owner.id, owner.id)).toEqual([v.id]);
    expect(await likedVideoIds(owner.id, viewer.id)).toBeNull();
    await setShowLikedVideos(owner.id, true);
    expect(await likedVideoIds(owner.id, viewer.id)).toEqual([v.id]);
  });
});
