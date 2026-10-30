import { describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { addComment, listComments, toggleCommentLike, unhideMutedComment } from './comments';
import { mentionSuggestions, parseMentions, setMentionPolicy } from './mentions';
import { addMutedKeyword, containsMuted, foldText } from './muted';

const video = (authorId: string) =>
  db.video.create({ data: { authorId, status: 'ready', fileUrl: '/uploads/x.mp4', readyAt: now() } });
const withHandle = async (handle: string, displayName?: string) => {
  const u = await createUser({ displayName });
  return db.user.update({ where: { id: u.id }, data: { handle } });
};

describe('bình luận: tim, nhắc tên, từ cấm (SPEC-social.md V5.4)', () => {
  it('khớp từ cấm không dấu, không phân biệt hoa thường, nguyên từ', () => {
    expect(foldText('Lừa Đảo!!')).toBe('lua dao');
    expect(containsMuted('Shop này LỪA ĐẢO quá', ['lua dao'])).toBe(true);
    expect(containsMuted('Hàng xịn, lừa đảo là sai', ['lua dao'])).toBe(true);
    expect(containsMuted('cái luadao', ['lua dao'])).toBe(false);
    expect(containsMuted('ngon', ['ngo'])).toBe(false); // không khớp một phần của từ
    expect(parseMentions('Chào @nhu.huynh và @abc, cả @Nhu.Huynh.')).toEqual(['nhu.huynh', 'abc']);
  });

  it('tim bình luận, sắp xếp: ghim → từ 3 tim → mới nhất; tối đa 60 lần mỗi phút', async () => {
    setClock(new Date('2026-10-30T05:00:00Z'));
    try {
      const owner = await createUser();
      const v = await video(owner.id);
      const users = await Promise.all([1, 2, 3, 4].map(() => createUser()));
      const ids: string[] = [];
      for (const [i, u] of users.entries()) {
        const r = await addComment(u.id, v.id, `Bình luận ${i}`);
        if (!r.ok) throw new Error(r.error);
        ids.push(r.id);
        advanceClock({ seconds: 11 });
      }
      for (const u of users.slice(0, 3))
        expect(await toggleCommentLike(u.id, ids[0]!)).toMatchObject({ ok: true, liked: true });
      expect(await toggleCommentLike(users[0]!.id, ids[1]!)).toMatchObject({ ok: true, likeCount: 1 });
      const list = await listComments(v.id, users[0]!.id);
      // Bình luận 0 có 3 tim lên đầu; bình luận 1 chỉ 1 tim nên theo thời gian (mới nhất trước).
      expect(list.items.map((c) => c.text)).toEqual([
        'Bình luận 0',
        'Bình luận 3',
        'Bình luận 2',
        'Bình luận 1',
      ]);
      expect(list.items[0]).toMatchObject({ likeCount: 3, liked: true });
      expect(await toggleCommentLike(users[0]!.id, ids[0]!)).toMatchObject({
        ok: true,
        liked: false,
        likeCount: 2,
      });
      const spammer = await createUser();
      for (let i = 0; i < 60; i++) await toggleCommentLike(spammer.id, ids[2]!);
      expect(await toggleCommentLike(spammer.id, ids[2]!)).toEqual({ ok: false, error: 'RATE_LIMIT' });
    } finally {
      resetClock();
    }
  });

  it('nhắc tên: báo người được nhắc theo cài đặt; không báo người chặn nhau; gợi ý người follow trước', async () => {
    resetClock();
    const author = await createUser({ displayName: 'Người viết' });
    const a = await withHandle(`an${Date.now() % 100000}`, 'An Nguyễn');
    const b = await withHandle(`binh${Date.now() % 100000}`);
    const c = await withHandle(`chi${Date.now() % 100000}`);
    await setMentionPolicy(b.id, 'nobody');
    await db.follow.create({ data: { followerId: author.id, followeeId: c.id } });
    const v = await video(author.id);
    const r = await addComment(author.id, v.id, `Chào @${a.handle} @${b.handle} @${c.handle}`);
    expect(r.ok).toBe(true);
    const got = await db.mention.findMany({ where: { sourceType: 'comment' }, select: { userId: true } });
    expect(got.map((m) => m.userId).sort()).toEqual([a.id, c.id].sort());
    expect(await db.notification.count({ where: { userId: b.id } })).toBe(0);
    const sug = await mentionSuggestions(author.id, '');
    expect(sug[0]?.id).toBe(c.id); // người mình follow đứng đầu
    expect((await mentionSuggestions(author.id, 'An Ng')).map((s) => s.id)).toContain(a.id);
  });

  it('từ cấm: bình luận tự ẩn, người viết vẫn thấy, chủ video thấy mục "Đã ẩn" và hiện lại được', async () => {
    resetClock();
    const owner = await createUser();
    const writer = await createUser();
    const other = await createUser();
    expect(await addMutedKeyword(owner.id, 'lừa đảo')).toEqual({ ok: true });
    expect(await addMutedKeyword(owner.id, 'Lua Dao')).toEqual({ ok: false, error: 'DUPLICATE' });
    expect(await addMutedKeyword(owner.id, 'x'.repeat(31))).toEqual({ ok: false, error: 'INVALID' });
    const v = await video(owner.id);
    const r = await addComment(writer.id, v.id, 'Shop LỪA ĐẢO');
    if (!r.ok) throw new Error(r.error);
    expect((await db.comment.findUniqueOrThrow({ where: { id: r.id } })).hiddenReason).toBe('keyword');
    expect((await listComments(v.id, other.id)).items).toHaveLength(0);
    expect((await listComments(v.id, writer.id)).items.map((c) => c.id)).toEqual([r.id]);
    const ownerView = await listComments(v.id, owner.id);
    expect(ownerView.items).toHaveLength(0);
    expect(ownerView.mutedHidden.map((c) => c.id)).toEqual([r.id]);
    expect(await unhideMutedComment(r.id, other.id)).toEqual({ ok: false });
    expect(await unhideMutedComment(r.id, owner.id)).toEqual({ ok: true });
    expect((await listComments(v.id, other.id)).items.map((c) => c.id)).toEqual([r.id]);
  });
});
