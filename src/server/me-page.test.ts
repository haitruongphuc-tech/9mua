import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { setSetting } from '@/lib/settings';
import { consumeDailyAction, setSocialLinks, toggleFollow, toggleSave } from '@/modules/social';
import { createProduct, createSeller, createUser } from '../../tests/helpers/factories';
import { loadMePage } from './me-page';

async function readyVideo(authorId: string) {
  return db.video.create({
    data: { authorId, caption: 'x', status: 'ready', fileUrl: '/x.mp4', readyAt: new Date() },
  });
}

describe('trang Tôi V4 (SPEC-social.md mục 4, 7, 8)', () => {
  it('tài khoản Free: n/50 tim/follow hôm nay, tiến độ voucher, Bộ sưu tập, số follow, link mạng xã hội', async () => {
    await setSetting('social_voucher_threshold', '100', null);
    const me = await createUser();
    const star = await createUser();
    const [a, b] = [await readyVideo(star.id), await readyVideo(star.id)];
    const mine = await readyVideo(me.id);
    await db.videoLike.createMany({
      data: [a, b, mine].map((v) => ({ userId: me.id, videoId: v.id })),
    });
    await toggleFollow(me.id, star.id);
    await consumeDailyAction(me.id);
    await toggleSave(me.id, a.id);
    await setSocialLinks(me.id, { youtube: 'youtube.com/@toi' });

    const page = await loadMePage({ id: me.id, role: 'user' });
    expect(page.role).toBe('free');
    // toggleFollow cũng tốn 1 lượt của tài khoản Free.
    expect(page.free).toEqual({ used: 2, limit: 50 });
    expect(page.follow).toEqual({ followers: 0, following: 1 });
    // Không tính video của chính mình.
    expect(page.voucher).toEqual({ enabled: true, liked: 2, threshold: 100, status: 'none' });
    expect(page.saved.map((v) => v.id)).toEqual([a.id]);
    expect(page.socialCount).toBe(1);
    expect(page.kiot).toBeNull();
  });

  it('chủ Kiot đang hoạt động: không giới hạn, có ô Kiot của bạn; voucher đã tặng thì hiện còn dùng được', async () => {
    const { user, kiotId, slug } = await createSeller({ active: true });
    await createProduct(kiotId);
    await db.kiotVoucher.create({ data: { userId: user.id, issuedAt: new Date() } });
    const page = await loadMePage({ id: user.id, role: 'user' });
    expect(page.role).toBe('owner');
    expect(page.free).toBeNull();
    expect(page.kiot).toMatchObject({ slug, status: 'active', products: 1 });
    expect(page.voucher.status).toBe('usable');
  });

  it('admin là CEO, không bị giới hạn', async () => {
    const admin = await createUser();
    await db.user.update({ where: { id: admin.id }, data: { role: 'admin' } });
    const page = await loadMePage({ id: admin.id, role: 'admin' });
    expect(page.role).toBe('admin');
    expect(page.free).toBeNull();
  });
});
