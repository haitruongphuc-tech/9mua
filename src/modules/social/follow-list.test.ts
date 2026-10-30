import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { followList } from './follow';

describe('danh sách người theo dõi / đang theo dõi (SPEC-social.md bổ sung 30/10, A2)', () => {
  it('mới theo dõi hiện trước, 30 người mỗi trang, không hiện tài khoản bị khoá', async () => {
    const star = await createUser({ displayName: 'Ngôi sao' });
    const fans = [];
    for (let i = 0; i < 32; i++) fans.push(await createUser({ displayName: `Fan ${i}` }));
    const base = Date.UTC(2026, 9, 1);
    await db.follow.createMany({
      data: fans.map((f, i) => ({
        followerId: f.id,
        followeeId: star.id,
        createdAt: new Date(base + i * 60_000),
      })),
    });
    await db.user.update({ where: { id: fans[31]!.id }, data: { lockedAt: new Date() } });

    const first = await followList(star.id, 'followers');
    expect(first.items).toHaveLength(30);
    expect(first.items[0]).toEqual({ id: fans[30]!.id, displayName: 'Fan 30', avatarUrl: null });
    expect(first.hasMore).toBe(true);
    const second = await followList(star.id, 'followers', 2);
    expect(second.items.map((u) => u.displayName)).toEqual(['Fan 0']);
    expect(second.hasMore).toBe(false);

    const following = await followList(fans[0]!.id, 'following');
    expect(following).toEqual({
      items: [{ id: star.id, displayName: 'Ngôi sao', avatarUrl: null }],
      hasMore: false,
    });
    expect(await followList(star.id, 'following')).toEqual({ items: [], hasMore: false });
  });
});
