import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { setSocialLinks, toggleFollow, toggleKiotHeart } from '@/modules/social';
import { createProduct, createSeller, createUser } from '../../tests/helpers/factories';
import { followKiotOwner, heartKiot, loadKiotPage } from './kiot-page';

describe('trang Kiot V4 (SPEC-kiot.md bổ sung 27/10)', () => {
  it('số liệu thật: Followers, Tim (tim Kiot + thích video của chủ), Sản phẩm đang hiện, Đã bán', async () => {
    const { user: owner, kiotId, slug } = await createSeller({ active: true });
    const fan = await createUser();
    const a = await createProduct(kiotId, { name: 'Cà phê' });
    const b = await createProduct(kiotId, { name: 'Tiêu' });
    await createProduct(kiotId, { name: 'Đã ẩn' }).then((p) =>
      db.product.update({ where: { id: p.id }, data: { visible: false } }),
    );
    await db.productSale.createMany({
      data: [
        { orderId: 'o1', productId: a.id, kiotId, qty: 7, completedAt: new Date() },
        { orderId: 'o2', productId: b.id, kiotId, qty: 3, completedAt: new Date() },
      ],
    });
    await db.video.create({
      data: {
        authorId: owner.id,
        caption: 'x',
        status: 'ready',
        fileUrl: '/x.mp4',
        readyAt: new Date(),
        likes: 4,
      },
    });
    await toggleFollow(fan.id, owner.id);
    await toggleKiotHeart(fan.id, kiotId);
    await setSocialLinks(owner.id, { tiktok: 'tiktok.com/@kiotthu' });

    const page = await loadKiotPage(slug, fan.id);
    expect(page?.stats).toEqual({ followers: 1, hearts: 5, products: 2, sold: 10 });
    expect(page?.viewer).toEqual({ following: true, hearted: true, isOwner: false });
    expect(page?.owner.displayName).toBeTruthy();
    expect(page?.socialLinks).toEqual({ tiktok: 'https://tiktok.com/@kiotthu' });
    expect(page?.videos).toHaveLength(1);

    // Khách chưa đăng nhập vẫn thấy số liệu, không có trạng thái của riêng mình.
    expect((await loadKiotPage(slug, null))?.viewer).toEqual({
      following: false,
      hearted: false,
      isOwner: false,
    });
  });

  it('Follow trên trang Kiot là follow chủ Kiot; chủ Kiot không tự follow mình', async () => {
    const { user: owner, kiotId } = await createSeller({ active: true });
    const fan = await createUser();
    expect(await followKiotOwner(fan.id, kiotId)).toMatchObject({ ok: true, following: true, followers: 1 });
    expect(await db.follow.count({ where: { followerId: fan.id, followeeId: owner.id } })).toBe(1);
    expect(await followKiotOwner(owner.id, kiotId)).toEqual({ ok: false, error: 'SELF' });
    expect(await followKiotOwner(fan.id, 'khong-co')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('Tim Kiot trả về số Tim hiển thị (tim Kiot + thích video của chủ); Kiot không có thì báo NOT_FOUND', async () => {
    const { user: owner, kiotId } = await createSeller({ active: true });
    const fan = await createUser();
    await db.video.create({
      data: {
        authorId: owner.id,
        caption: 'x',
        status: 'ready',
        fileUrl: '/x.mp4',
        readyAt: new Date(),
        likes: 2,
      },
    });
    expect(await heartKiot(fan.id, kiotId)).toEqual({ ok: true, hearted: true, hearts: 3 });
    expect(await heartKiot(fan.id, kiotId)).toEqual({ ok: true, hearted: false, hearts: 2 });
    expect(await heartKiot(fan.id, 'khong-co')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
