import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isBlockedEither } from '@/lib/blocks';
import { getFeed } from '@/modules/creator';
import { getLiveForViewer, sendChat } from '@/modules/live';
import { blockUser as blockInInbox, openConversation, sendMessage } from '@/modules/messages';
import { createUser } from '../../../tests/helpers/factories';
import { blockUser, listBlockedUsers, MAX_BLOCKS, unblockUser } from './blocks';
import { addComment, listComments } from './comments';
import { followStats, toggleFollow } from './follow';

async function readyVideo(authorId: string, caption = 'v') {
  return db.video.create({
    data: {
      authorId,
      caption,
      hashtags: [],
      status: 'ready',
      fileUrl: '/uploads/v.mp4',
      readyAt: new Date(),
    },
  });
}

describe('chặn trên toàn web (SPEC-social.md V5.3)', () => {
  it('chặn một chiều là đủ để cả hai chiều bị chặn; gỡ follow cũ hai chiều, không follow lại được', async () => {
    const a = await createUser();
    const b = await createUser();
    await toggleFollow(a.id, b.id);
    await toggleFollow(b.id, a.id);
    expect(await blockUser(a.id, b.id)).toEqual({ ok: true });
    expect(await isBlockedEither(a.id, b.id)).toBe(true);
    expect(await isBlockedEither(b.id, a.id)).toBe(true);
    expect((await followStats(a.id)).followers).toBe(0);
    expect((await followStats(b.id)).followers).toBe(0);
    expect(await toggleFollow(a.id, b.id)).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await toggleFollow(b.id, a.id)).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await blockUser(a.id, a.id)).toEqual({ ok: false, error: 'SELF' });
  });

  it('không thấy video và bình luận của nhau, không bình luận vào video của nhau', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const va = await readyVideo(a.id, 'video của A');
    const vb = await readyVideo(b.id, 'video của B');
    await readyVideo(c.id, 'video của C');
    const cm = await addComment(b.id, va.id, 'B bình luận trước khi bị chặn');
    expect(cm.ok).toBe(true);
    await blockUser(a.id, b.id);

    const feedOfB = (await getFeed({ userId: b.id })).items.map((v) => v.caption);
    expect(feedOfB).toContain('video của C');
    expect(feedOfB).not.toContain('video của A');
    expect((await getFeed({ userId: a.id })).items.map((v) => v.caption)).not.toContain('video của B');

    expect((await listComments(va.id, a.id)).items).toHaveLength(0);
    expect((await listComments(va.id, c.id)).items).toHaveLength(1); // người khác vẫn thấy
    expect(await addComment(b.id, va.id, 'xin chào')).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await addComment(a.id, vb.id, 'xin chào')).toEqual({ ok: false, error: 'BLOCKED' });
  });

  it('Hộp thư: chặn toàn web thì không nhắn được; chặn ở Hộp thư cũng là chặn toàn web', async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    await db.user.updateMany({ data: { createdAt: new Date(Date.now() - 3 * 86_400_000) } });
    const opened = await openConversation(a.id, b.id);
    if (!opened.ok) throw new Error(opened.error);
    await blockUser(b.id, a.id);
    expect(await sendMessage(a.id, opened.conversationId, { text: 'chào' })).toMatchObject({
      ok: false,
      error: 'BLOCKED',
    });
    expect(await openConversation(b.id, a.id)).toMatchObject({ ok: false, error: 'BLOCKED' });

    await blockInInbox(a.id, c.id);
    expect(await isBlockedEither(a.id, c.id)).toBe(true);
    expect((await listBlockedUsers(a.id)).map((u) => u.id)).toEqual([c.id]);
    // Bỏ chặn ở Cài đặt gỡ cả chặn của Hộp thư.
    expect(await unblockUser(a.id, c.id)).toEqual({ ok: true });
    expect(await isBlockedEither(a.id, c.id)).toBe(false);
    expect(await db.messageBlock.count({ where: { blockerId: a.id } })).toBe(0);
  });

  it('live: người bị chặn không vào xem và không chat được ở buổi live của người chặn', async () => {
    const host = await createUser();
    const viewer = await createUser();
    const live = await db.liveSession.create({
      data: {
        hostUserId: host.id,
        title: 'Live thử',
        status: 'live',
        mediaPath: 'p1',
        publishTokenHash: 'h',
        publishExpiresAt: new Date(Date.now() + 120_000),
        startedAt: new Date(),
      },
    });
    expect(await getLiveForViewer(live.id, { userId: viewer.id })).toMatchObject({ kind: 'live' });
    await blockUser(host.id, viewer.id);
    expect(await getLiveForViewer(live.id, { userId: viewer.id })).toBeNull();
    expect(await sendChat(live.id, viewer.id, 'chào')).toEqual({ ok: false, error: 'BANNED' });
  });

  it(`tối đa ${MAX_BLOCKS} người; chặn lại người đã chặn không tính thêm`, async () => {
    const a = await createUser();
    await db.userBlock.createMany({
      data: Array.from({ length: MAX_BLOCKS }, (_, i) => ({ blockerId: a.id, blockedId: `x${i}` })),
    });
    const b = await createUser();
    expect(await blockUser(a.id, b.id)).toEqual({ ok: false, error: 'LIMIT' });
    expect(await blockUser(a.id, 'x1')).toEqual({ ok: true });
  });
});
