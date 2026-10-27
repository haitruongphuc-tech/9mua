import { afterEach, describe, expect, it } from 'vitest';
import { advanceClock, resetClock, setClock } from '@/lib/clock';
import { setSetting } from '@/lib/settings';
import { db } from '@/lib/db';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import {
  addComment,
  checkVoucher,
  followingFeed,
  getVoucher,
  hashtagVideos,
  heartVideo,
  listComments,
  pinComment,
  reportComment,
  toggleFollow,
  toggleSave,
  trendingHashtags,
  consumeDailyAction,
} from './index';

afterEach(() => resetClock());

async function readyVideo(authorId: string, caption = 'Video thử #thanhlong') {
  return db.video.create({
    data: {
      authorId,
      caption,
      hashtags: ['thanhlong'],
      status: 'ready',
      fileUrl: '/x.mp4',
      readyAt: new Date(),
    },
  });
}

describe('giới hạn tài khoản Free (50 tim/follow mỗi ngày)', () => {
  it('lượt thứ 51 bị chặn, sang ngày mới dùng lại được; chủ Kiot không bị chặn', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    await setSetting('social_free_daily_limit', '3', null);
    const free = await createUser();
    for (let i = 0; i < 3; i++) expect(await consumeDailyAction(free.id)).toEqual({ ok: true });
    expect(await consumeDailyAction(free.id)).toEqual({ ok: false, error: 'FREE_LIMIT' });
    advanceClock({ hours: 18 }); // qua 0 giờ Việt Nam
    expect(await consumeDailyAction(free.id)).toEqual({ ok: true });

    const { user: owner } = await createSeller({ active: true });
    for (let i = 0; i < 5; i++) expect(await consumeDailyAction(owner.id)).toEqual({ ok: true });
  });

  it('hết lượt thì thích video báo FREE_LIMIT và số thích không đổi', async () => {
    await setSetting('social_free_daily_limit', '1', null);
    const author = await createUser();
    const fan = await createUser();
    const [a, b] = [await readyVideo(author.id), await readyVideo(author.id)];
    expect(await heartVideo(fan.id, a.id, 'like')).toMatchObject({ ok: true, liked: true, likes: 1 });
    expect(await heartVideo(fan.id, b.id, 'toggle')).toEqual({ ok: false, error: 'FREE_LIMIT' });
    expect((await db.video.findUniqueOrThrow({ where: { id: b.id } })).likes).toBe(0);
    // Chạm 2 lần lên video đã thích: không bỏ thích, không tốn lượt.
    expect(await heartVideo(fan.id, a.id, 'like')).toMatchObject({ ok: true, liked: true, likes: 1 });
    // Bỏ thích không tốn lượt.
    expect(await heartVideo(fan.id, a.id, 'toggle')).toMatchObject({ ok: true, liked: false, likes: 0 });
  });
});

describe('follow', () => {
  it('không follow chính mình; follow/bỏ follow; tab Đang Follow chỉ có video của người đã follow', async () => {
    const me = await createUser();
    const star = await createUser();
    const other = await createUser();
    expect(await toggleFollow(me.id, me.id)).toEqual({ ok: false, error: 'SELF' });
    expect(await toggleFollow(me.id, star.id)).toEqual({ ok: true, following: true, followers: 1 });
    const v = await readyVideo(star.id);
    await readyVideo(other.id);
    const feed = await followingFeed({ userId: me.id });
    expect(feed.items.map((x) => x.id)).toEqual([v.id]);
    expect(await toggleFollow(me.id, star.id)).toEqual({ ok: true, following: false, followers: 0 });
    expect((await followingFeed({ userId: me.id })).items).toEqual([]);
  });
});

describe('bình luận', () => {
  it('chặn link, chặn gửi dồn trong 10 giây; trả lời 1 cấp; chỉ người đăng video ghim được', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const author = await createUser();
    const fan = await createUser();
    const v = await readyVideo(author.id);
    expect(await addComment(fan.id, v.id, 'mua tại shopee.vn/abc')).toEqual({ ok: false, error: 'HAS_LINK' });
    const first = await addComment(fan.id, v.id, 'Đẹp quá shop ơi');
    expect(first.ok).toBe(true);
    expect(await addComment(fan.id, v.id, 'Còn hàng không?')).toEqual({ ok: false, error: 'RATE_LIMIT' });
    advanceClock({ seconds: 11 });
    const id = first.ok ? first.id : '';
    const reply = await addComment(author.id, v.id, 'Còn nhiều nha', id);
    expect(reply.ok).toBe(true);
    expect(await pinComment(id, fan.id)).toEqual({ ok: false });
    expect(await pinComment(id, author.id)).toEqual({ ok: true });
    const { items, total } = await listComments(v.id);
    expect(total).toBe(2);
    expect(items[0]).toMatchObject({ pinned: true, text: 'Đẹp quá shop ơi' });
    expect(items[0]!.replies[0]).toMatchObject({ text: 'Còn nhiều nha', byVideoAuthor: true });
    expect(await db.notification.count({ where: { userId: author.id, title: '@notify.newComment' } })).toBe(
      1,
    );
  });

  it('5 người khác nhau báo cáo thì bình luận tự ẩn', async () => {
    const author = await createUser();
    const v = await readyVideo(author.id);
    const c = await addComment(author.id, v.id, 'Bình luận bị báo cáo');
    const id = c.ok ? c.id : '';
    for (let i = 0; i < 5; i++) await reportComment((await createUser()).id, id, 'spam');
    expect((await listComments(v.id)).total).toBe(0);
  });
});

describe('lưu video', () => {
  it('bấm lần nữa để bỏ lưu', async () => {
    const u = await createUser();
    const v = await readyVideo((await createUser()).id);
    expect(await toggleSave(u.id, v.id)).toEqual({ ok: true, saved: true });
    expect(await toggleSave(u.id, v.id)).toEqual({ ok: true, saved: false });
  });
});

describe('hashtag', () => {
  it('trang hashtag chỉ có video sẵn sàng; hàng nổi bật đếm video 7 ngày qua, không tính Story', async () => {
    const author = await createUser();
    const mk = (hashtags: string[], extra: Record<string, unknown> = {}) =>
      db.video.create({
        data: {
          authorId: author.id,
          caption: 'x',
          hashtags,
          status: 'ready',
          fileUrl: '/x.mp4',
          readyAt: new Date(),
          ...extra,
        },
      });
    await mk(['caphe', 'daklak']);
    await mk(['caphe']);
    await mk(['caphe'], { kind: 'story' });
    await mk(['caphe'], { status: 'processing', readyAt: null });
    await mk(['cu'], { readyAt: new Date(Date.now() - 8 * 86_400_000) });
    expect(await trendingHashtags(10)).toEqual([
      { tag: 'caphe', videos: 2 },
      { tag: 'daklak', videos: 1 },
    ]);
    // Gõ có dấu, chữ hoa vẫn ra đúng hashtag đã chuẩn hoá.
    expect(await hashtagVideos('#CàPhê', {})).toHaveLength(2);
    expect(await hashtagVideos('cu', {})).toHaveLength(1);
  });
});

describe('voucher mở Kiot', () => {
  it('đủ mốc video đã thích thì tặng đúng 1 voucher; tài khoản mới dưới 3 ngày không nhận', async () => {
    await setSetting('social_voucher_threshold', '10', null);
    await setSetting('social_free_daily_limit', '100', null);
    const author = await createUser();
    const videos = await Promise.all(Array.from({ length: 11 }, () => readyVideo(author.id)));
    const fan = await createUser();
    const young = await createUser();
    await db.user.update({
      where: { id: fan.id },
      data: { createdAt: new Date(Date.now() - 4 * 86_400_000) },
    });
    for (const v of videos.slice(0, 9)) await heartVideo(fan.id, v.id, 'like');
    expect(await getVoucher(fan.id)).toBeNull();
    await heartVideo(fan.id, videos[9]!.id, 'like');
    expect(await getVoucher(fan.id)).toMatchObject({ usable: true });
    await heartVideo(fan.id, videos[10]!.id, 'like');
    expect(await db.kiotVoucher.count({ where: { userId: fan.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: fan.id, title: '@notify.voucherIssued' } })).toBe(
      1,
    );

    for (const v of videos.slice(0, 10)) await heartVideo(young.id, v.id, 'like');
    expect(await getVoucher(young.id)).toBeNull();

    await setSetting('social_voucher_enabled', 'false', null);
    const late = await createUser();
    await db.user.update({
      where: { id: late.id },
      data: { createdAt: new Date(Date.now() - 9 * 86_400_000) },
    });
    for (const v of videos.slice(0, 10)) await heartVideo(late.id, v.id, 'like');
    expect(await checkVoucher(late.id)).toBe(false);
  });
});
