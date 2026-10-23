import { describe, expect, it } from 'vitest';
import { advanceClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { addToCart } from '@/modules/orders';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import { recordViews, toggleLike } from './engagement';
import { getFeed, getVideo, isProductTagged, recomputeScores } from './feed';
import { initialScore } from './score';

let n = 0;
async function readyVideo(
  authorId: string,
  data: { score?: number; readyAt?: Date; productIds?: string[]; durationSec?: number } = {},
) {
  n += 1;
  return db.video.create({
    data: {
      authorId,
      caption: `Video ${n}`,
      status: 'ready',
      fileUrl: `/uploads/videos/v${n}.mp4`,
      posterUrl: `/uploads/videos/v${n}.jpg`,
      durationSec: data.durationSec ?? 10,
      score: data.score ?? initialScore(),
      readyAt: data.readyAt ?? new Date(),
      products: { create: (data.productIds ?? []).map((productId, position) => ({ productId, position })) },
    },
  });
}

describe('feed', () => {
  it('video mới chưa có tương tác vẫn lên feed; chỉ video ready của tài khoản không bị khoá', async () => {
    const a = await createUser();
    const fresh = await readyVideo(a.id);
    await db.video.create({ data: { authorId: a.id, status: 'processing' } });
    const locked = await createUser();
    await readyVideo(locked.id);
    await db.user.update({ where: { id: locked.id }, data: { lockedAt: new Date() } });
    const feed = await getFeed({ anonId: 'anon-aaaaaaaaaaaaaaaa' });
    expect(feed.items.map((v) => v.id)).toEqual([fresh.id]);
  });

  it('không lặp video giữa các trang; trộn video mới vào giữa video điểm cao', async () => {
    const a = await createUser();
    const old: string[] = [];
    for (let i = 0; i < 12; i++)
      old.push(
        (await readyVideo(a.id, { score: 100 - i, readyAt: new Date(Date.now() - (30 - i) * 86_400_000) }))
          .id,
      );
    const newest = await readyVideo(a.id, { score: 0.01, readyAt: new Date() });

    const p1 = await getFeed({}, undefined, { limit: 6 });
    expect(p1.items.map((v) => v.id)).toContain(newest.id);
    const p2 = await getFeed({}, p1.nextCursor!, { limit: 6 });
    const p3 = await getFeed({}, p2.nextCursor!, { limit: 6 });
    const all = [...p1.items, ...p2.items, ...p3.items].map((v) => v.id);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set([...old, newest.id]));
  });

  it('người đã đăng nhập không thấy lại video vừa xem trong 24 giờ', async () => {
    const a = await createUser();
    const viewer = await createUser();
    const v1 = await readyVideo(a.id);
    const v2 = await readyVideo(a.id);
    await recordViews({ userId: viewer.id }, [{ videoId: v1.id, watchedSeconds: 5 }]);
    expect((await getFeed({ userId: viewer.id })).items.map((v) => v.id)).toEqual([v2.id]);
    advanceClock({ hours: 25 });
    expect((await getFeed({ userId: viewer.id })).items.map((v) => v.id).sort()).toEqual(
      [v1.id, v2.id].sort(),
    );
  });

  it('mở link chia sẻ thì video đó đứng đầu', async () => {
    const a = await createUser();
    await readyVideo(a.id, { score: 50 });
    const shared = await readyVideo(a.id, { score: 0.1 });
    const feed = await getFeed({}, undefined, { first: shared.id });
    expect(feed.items[0]!.id).toBe(shared.id);
    expect(feed.items.filter((v) => v.id === shared.id)).toHaveLength(1);
  });

  it('thẻ sản phẩm tự ẩn khi Kiot hết hạn hoặc hết hàng; video vẫn hiện', async () => {
    const a = await createUser();
    const s = await createSeller({ active: true });
    const p1 = await createProduct(s.kiotId, { name: 'Cà phê' });
    const p2 = await createProduct(s.kiotId, { name: 'Hết hàng', stock: 0 });
    const v = await readyVideo(a.id, { productIds: [p1.id, p2.id] });
    expect((await getVideo(v.id, {}))!.products.map((p) => p.name)).toEqual(['Cà phê']);
    expect((await getVideo(v.id, {}))!.products[0]!.url).toMatch(new RegExp(`//${s.slug}\\..+/p/`));
    await db.kiot.update({ where: { id: s.kiotId }, data: { activeUntil: new Date(Date.now() - 1000) } });
    const after = await getVideo(v.id, {});
    expect(after).not.toBeNull();
    expect(after!.products).toEqual([]);
  });

  it('điểm được tính lại theo thích và tuổi video', async () => {
    const a = await createUser();
    const popular = await readyVideo(a.id, { readyAt: new Date(Date.now() - 3_600_000) });
    const quiet = await readyVideo(a.id, { readyAt: new Date(Date.now() - 3_600_000) });
    await db.video.update({ where: { id: popular.id }, data: { likes: 20 } });
    await recomputeScores();
    const [p, q] = await Promise.all([
      db.video.findUniqueOrThrow({ where: { id: popular.id } }),
      db.video.findUniqueOrThrow({ where: { id: quiet.id } }),
    ]);
    expect(p.score).toBeGreaterThan(q.score);
    expect(q.score).toBeGreaterThan(0);
  });
});

describe('lượt xem', () => {
  it('dưới 3 giây không tính; trong ngày không tính lại; xem đủ 50% tính riêng và nâng hạng 1 lần', async () => {
    const a = await createUser();
    const v = await readyVideo(a.id, { durationSec: 20 });
    const viewer = { anonId: 'anon-bbbbbbbbbbbbbbbb' };
    expect(await recordViews(viewer, [{ videoId: v.id, watchedSeconds: 2.9 }])).toBe(0);
    expect(await recordViews(viewer, [{ videoId: v.id, watchedSeconds: 4 }])).toBe(1);
    expect(await recordViews(viewer, [{ videoId: v.id, watchedSeconds: 6 }])).toBe(0);
    expect(await db.video.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({
      views: 1,
      qualifiedViews: 0,
    });
    await recordViews(viewer, [{ videoId: v.id, watchedSeconds: 12 }]);
    await recordViews(viewer, [{ videoId: v.id, watchedSeconds: 15 }]);
    expect(await db.video.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({
      views: 1,
      qualifiedViews: 1,
    });
    advanceClock({ days: 1 });
    expect(await recordViews(viewer, [{ videoId: v.id, watchedSeconds: 4 }])).toBe(1);
  });

  it('ghi theo lô nhiều video một lần; mã ẩn danh lạ bị bỏ qua', async () => {
    const a = await createUser();
    const vs = await Promise.all([1, 2, 3].map(() => readyVideo(a.id)));
    expect(
      await recordViews(
        { anonId: 'anon-cccccccccccccccc' },
        vs.map((v) => ({ videoId: v.id, watchedSeconds: 5 })),
      ),
    ).toBe(3);
    expect(await recordViews({ anonId: 'x' }, [{ videoId: vs[0]!.id, watchedSeconds: 5 }])).toBe(0);
  });
});

describe('thích', () => {
  it('bấm 2 lần thì về 0; bấm song song vẫn đúng số', async () => {
    const a = await createUser();
    const u = await createUser();
    const v = await readyVideo(a.id);
    expect(await toggleLike(v.id, u.id)).toEqual({ ok: true, liked: true, likes: 1 });
    expect((await getVideo(v.id, { userId: u.id }))!.liked).toBe(true);
    expect(await toggleLike(v.id, u.id)).toEqual({ ok: true, liked: false, likes: 0 });
    const others = await Promise.all([1, 2, 3, 4, 5].map(() => createUser()));
    await Promise.all(others.map((o) => toggleLike(v.id, o.id)));
    expect((await db.video.findUniqueOrThrow({ where: { id: v.id } })).likes).toBe(5);
    expect(await toggleLike('khong-co', u.id)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('mua từ video', () => {
  it('món thêm từ video có sourceVideoId trong giỏ; chỉ nhận nguồn khi video gắn đúng sản phẩm', async () => {
    const a = await createUser();
    const s = await createSeller({ active: true });
    const p = await createProduct(s.kiotId);
    const other = await createProduct(s.kiotId, { name: 'Không gắn' });
    const v = await readyVideo(a.id, { productIds: [p.id] });
    expect(await isProductTagged(v.id, p.id)).toBe(true);
    expect(await isProductTagged(v.id, other.id)).toBe(false);
    const buyer = await createUser();
    await addToCart(buyer.id, p.id, 1, v.id);
    expect(await db.cartItem.findFirstOrThrow({ where: { userId: buyer.id } })).toMatchObject({
      sourceVideoId: v.id,
    });
  });
});
