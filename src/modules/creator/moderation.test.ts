import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getOutbox } from '@/lib/mail';
import { runOrderTick } from '@/server/orders';
import { addToCart } from '@/modules/orders';
import { placeOrder } from '@/modules/orders/place-order';
import { getPayment } from '@/server/payments';
import { createProduct, createSeller, createUser, sampleAddress } from '../../../tests/helpers/factories';
import { simulatePaid } from '../../../tests/helpers/payments';
import { getFeed } from './feed';
import { myVideoStats } from './mine';
import { deleteVideo, removeVideo, reportVideo, restoreVideo } from './moderation';
import { getCreatorProfile, getHotVideos } from './profile';
import { initialScore } from './score';

let n = 0;
async function readyVideo(authorId: string, score = initialScore()) {
  n += 1;
  return db.video.create({
    data: {
      authorId,
      caption: `Clip ${n}`,
      status: 'ready',
      fileUrl: `/uploads/videos/m${n}.mp4`,
      posterUrl: `/uploads/videos/m${n}.jpg`,
      score,
      readyAt: new Date(),
      durationSec: 10,
    },
  });
}

describe('kiểm duyệt video', () => {
  it('5 người khác nhau báo cáo thì tự ẩn và báo CEO; 1 người báo nhiều lần không tính', async () => {
    const admin = await createUser();
    await db.user.update({ where: { id: admin.id }, data: { role: 'admin', email: 'ceo@9mua.test' } });
    const author = await createUser();
    const v = await readyVideo(author.id);
    const spam = await createUser();
    for (let i = 0; i < 5; i++) await reportVideo(spam.id, v.id, 'noi_dung_xau', '');
    for (let i = 0; i < 3; i++) await reportVideo((await createUser()).id, v.id, 'lua_dao', '');
    expect((await db.video.findUniqueOrThrow({ where: { id: v.id } })).status).toBe('ready');
    expect(await reportVideo((await createUser()).id, v.id, 'ban_quyen', 'nhạc có bản quyền')).toEqual({
      ok: true,
      autoHidden: true,
    });
    expect((await db.video.findUniqueOrThrow({ where: { id: v.id } })).status).toBe('hidden');
    expect((await getFeed({})).items).toHaveLength(0);
    expect(getOutbox().some((m) => m.subject === '[9MUA] Video bị tự ẩn do nhiều báo cáo')).toBe(true);

    expect(await restoreVideo(v.id)).toEqual({ ok: true });
    expect((await getFeed({})).items).toHaveLength(1);
  });

  it('không tự báo cáo video của mình; lý do phải hợp lệ', async () => {
    const author = await createUser();
    const v = await readyVideo(author.id);
    expect(await reportVideo(author.id, v.id, 'khac', '')).toEqual({ ok: false, error: 'OWN_VIDEO' });
    expect(await reportVideo((await createUser()).id, v.id, 'ghet', '')).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
    });
  });

  it('CEO gỡ video kèm lý do, người đăng nhận thông báo', async () => {
    const author = await createUser();
    const v = await readyVideo(author.id);
    expect(await removeVideo(v.id, 'admin', '')).toEqual({ ok: false, error: 'REASON_REQUIRED' });
    expect(await removeVideo(v.id, 'admin', 'Quảng cáo sai sự thật')).toEqual({ ok: true });
    expect(await db.video.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({
      status: 'removed',
      moderationNote: '9MUA gỡ: Quảng cáo sai sự thật',
    });
    expect(await db.notification.findFirstOrThrow({ where: { userId: author.id } })).toMatchObject({
      title: 'Video của bạn bị gỡ',
    });
  });

  it('tài khoản bị khoá thì video biến khỏi feed, Video hot và trang creator', async () => {
    const author = await createUser();
    await readyVideo(author.id);
    expect(await getHotVideos(8)).toHaveLength(1);
    await db.user.update({ where: { id: author.id }, data: { lockedAt: new Date() } });
    expect((await getFeed({})).items).toHaveLength(0);
    expect(await getHotVideos(8)).toHaveLength(0);
    expect(await getCreatorProfile(author.id)).toBeNull();
  });
});

describe('người đăng', () => {
  it('xoá video của mình: xoá file, không xoá được video người khác', async () => {
    const author = await createUser();
    const v = await readyVideo(author.id);
    const file = path.join(env().UPLOAD_DIR, v.fileUrl!.slice('/uploads/'.length));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'x');
    expect(await deleteVideo(v.id, (await createUser()).id)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await deleteVideo(v.id, author.id)).toEqual({ ok: true });
    expect(existsSync(file)).toBe(false);
    expect(await myVideoStats(author.id)).toEqual([]);
  });

  it('trang creator: số video, tổng lượt thích; Video hot theo điểm', async () => {
    const author = await createUser({ displayName: 'Chị Hoa bán mật ong' });
    const a = await readyVideo(author.id, 5);
    await readyVideo(author.id, 1);
    await db.video.update({ where: { id: a.id }, data: { likes: 7 } });
    expect(await getCreatorProfile(author.id)).toMatchObject({
      displayName: 'Chị Hoa bán mật ong',
      videoCount: 2,
      totalLikes: 7,
    });
    expect((await getHotVideos(1)).map((v) => v.id)).toEqual([a.id]);
  });

  it('đơn hoàn tất có món mua từ video thì thống kê tăng đúng 1 đơn', async () => {
    const author = await createUser();
    const v = await readyVideo(author.id);
    const seller = await createSeller({ active: true });
    const product = await createProduct(seller.kiotId);
    await db.videoProduct.create({ data: { videoId: v.id, productId: product.id, position: 0 } });
    const buyer = await createUser();
    await addToCart(buyer.id, product.id, 2, v.id);
    const placed = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!placed.ok) throw new Error(JSON.stringify(placed));
    await simulatePaid((await getPayment(placed.intentId))!.orderCode);
    const order = await db.order.findFirstOrThrow({ where: { checkoutId: placed.checkoutId } });
    expect((await myVideoStats(author.id))[0]!.orders).toBe(0);
    await db.order.update({
      where: { id: order.id },
      data: { status: 'delivered', deliveredAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await runOrderTick();
    expect((await myVideoStats(author.id))[0]!.orders).toBe(1);
  });
});
