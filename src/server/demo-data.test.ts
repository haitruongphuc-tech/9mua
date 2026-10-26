import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { searchProducts } from '@/modules/marketplace';
import { login } from '@/modules/identity';
import { addToCart } from '@/modules/orders';
import { placeOrder } from '@/modules/orders/place-order';
import { createProduct, createSeller, createUser, sampleAddress } from '../../tests/helpers/factories';
import { DEMO_EMAIL_DOMAIN, removeDemoData, seedDemoData } from './demo-data';

const fixture = readFileSync(path.join(__dirname, '../../tests/fixtures/videos/landscape.mp4'));
const makeVideo = async () => fixture;
const uploadFile = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

describe('dữ liệu mẫu', () => {
  it('tạo Kiot đang hoạt động, sản phẩm có ảnh, video chờ xử lý và 1 tài khoản đăng nhập được', async () => {
    const result = await seedDemoData({ makeVideo });
    if (!result.ok) throw new Error(result.error);
    expect(result).toMatchObject({ kiots: 6, videos: 6 });
    expect(result.products).toBeGreaterThanOrEqual(36);

    const kiots = await db.kiot.findMany({ include: { owner: true } });
    expect(kiots).toHaveLength(6);
    for (const k of kiots) {
      expect(k.name).toContain('(Mẫu)');
      expect(k.owner.email).toMatch(new RegExp(`@${DEMO_EMAIL_DOMAIN.replace('.', '\\.')}$`));
      expect(k.activeUntil!.getTime()).toBeGreaterThan(Date.now() + 300 * 86_400_000);
      expect(k.logoUrl && existsSync(uploadFile(k.logoUrl))).toBe(true);
    }
    const images = await db.productImage.findMany();
    expect(images.length).toBe(result.products);
    expect(images.every((i) => i.productId && existsSync(uploadFile(i.thumbUrl)))).toBe(true);

    // Hiện trên Chợ, tìm được không dấu.
    expect((await searchProducts({ q: 'xoai cat', sort: 'phu-hop' })).items.length).toBeGreaterThan(0);
    expect(await db.videoJob.count({ where: { status: 'queued' } })).toBe(6);
    expect(await db.videoProduct.count()).toBeGreaterThanOrEqual(6);

    expect(await login({ identifier: result.login.email, password: result.login.password })).toMatchObject({
      ok: true,
    });
    // Không đụng sổ tiền.
    expect(await db.order.count()).toBe(0);
    expect(await db.paymentIntent.count()).toBe(0);
    expect(await db.kiotSubscription.count()).toBe(0);
  });

  it('dùng ảnh và video thật theo từ khoá; ảnh hỏng thì tự thay bằng ảnh vẽ sẵn', async () => {
    const red = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 220, g: 20, b: 20 } },
    })
      .jpeg()
      .toBuffer();
    const queries: string[] = [];
    const videoQueries: string[] = [];
    const result = await seedDemoData({
      photo: async (q) => {
        queries.push(q);
        return q === 'durian fruit' ? Buffer.from('khong phai anh') : red;
      },
      makeVideo: async (_i, q) => {
        videoQueries.push(q);
        return fixture;
      },
    });
    if (!result.ok) throw new Error(result.error);
    // 40 ảnh sản phẩm + 6 logo + 6 ảnh bìa, trừ 1 ảnh hỏng.
    expect(result.realPhotos).toBe(result.products + 12 - 1);
    expect(queries).toContain('mango fruit');
    expect(videoQueries).toHaveLength(6);

    const mango = await db.product.findFirstOrThrow({
      where: { name: { startsWith: 'Xoài cát' } },
      include: { images: true },
    });
    const stats = await sharp(uploadFile(mango.images[0]!.url)).stats();
    expect(stats.channels[0]!.mean).toBeGreaterThan(180); // ảnh đỏ từ Pexels
    const durian = await db.product.findFirstOrThrow({
      where: { name: { startsWith: 'Sầu riêng' } },
      include: { images: true },
    });
    expect(existsSync(uploadFile(durian.images[0]!.url))).toBe(true); // vẫn có ảnh (vẽ sẵn)
  });

  it('chạy lại khi đã có dữ liệu mẫu thì từ chối', async () => {
    expect((await seedDemoData({ makeVideo: async () => null })).ok).toBe(true);
    expect(await seedDemoData({ makeVideo: async () => null })).toEqual({
      ok: false,
      error: 'ALREADY_SEEDED',
    });
  });

  it('xoá sạch dữ liệu mẫu và file, giữ nguyên dữ liệu thật', async () => {
    const realSeller = await createSeller({ active: true });
    const realProduct = await createProduct(realSeller.kiotId);
    const result = await seedDemoData({ makeVideo });
    if (!result.ok) throw new Error(result.error);

    // Người dùng thật đã tương tác với dữ liệu mẫu: giỏ hàng, thích video, báo cáo sản phẩm.
    const buyer = await createUser();
    const demoProduct = await db.product.findFirstOrThrow({ where: { kiotId: { not: realSeller.kiotId } } });
    await addToCart(buyer.id, demoProduct.id, 1);
    const video = await db.video.findFirstOrThrow();
    await db.videoLike.create({ data: { videoId: video.id, userId: buyer.id } });
    await db.productReport.create({
      data: { productId: demoProduct.id, reporterId: buyer.id, reason: 'khac' },
    });
    const files = (await db.productImage.findMany({ where: { productId: demoProduct.id } })).map((i) =>
      uploadFile(i.url),
    );

    expect(await removeDemoData()).toMatchObject({ mode: 'deleted', users: 6, kiots: 6, videos: 6 });
    expect(await db.user.count({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } })).toBe(0);
    expect(await db.kiot.findMany({ select: { id: true } })).toEqual([{ id: realSeller.kiotId }]);
    expect((await db.product.findMany()).map((p) => p.id)).toEqual([realProduct.id]);
    expect(await db.video.count()).toBe(0);
    expect(await db.cartItem.count()).toBe(0);
    expect(await db.productReport.count()).toBe(0);
    expect(files.every((f) => !existsSync(f))).toBe(true);
    expect(await db.user.findUnique({ where: { id: buyer.id } })).not.toBeNull();

    expect(await removeDemoData()).toMatchObject({ mode: 'deleted', users: 0 });
  });

  it('Kiot mẫu đã có đơn hàng thì chỉ khoá và ẩn (đơn và sổ tiền chỉ được thêm, không xoá)', async () => {
    const result = await seedDemoData({ makeVideo: async () => null });
    if (!result.ok) throw new Error(result.error);
    const buyer = await createUser();
    const product = await db.product.findFirstOrThrow();
    await addToCart(buyer.id, product.id, 1);
    const placed = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    expect(placed.ok).toBe(true);

    expect(await removeDemoData()).toMatchObject({ mode: 'hidden', users: 6, kiots: 6 });
    expect(await db.order.count()).toBe(1);
    expect(await db.kiot.count({ where: { lockedAt: null } })).toBe(0);
    expect(await db.product.count({ where: { deletedAt: null } })).toBe(0);
    expect(
      await db.user.count({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` }, lockedAt: null } }),
    ).toBe(0);
    expect((await searchProducts({ q: 'xoai', sort: 'phu-hop' })).items).toHaveLength(0);
  });
});
