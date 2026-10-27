import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { advanceClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { cleanupAiFiles } from './cleanup';
import { publishFromStudio } from './publish';
import { processNextSlideshow, slideshowStatus, startSlideshow } from './slideshow';
import { drawProductImages } from './studio';
import { runTool } from '@/lib/media/run-tool';

async function ownerWithImages() {
  const seller = await createSeller({ active: true });
  const r = await drawProductImages(seller.user.id, {
    name: 'Mực một nắng',
    category: 'thuc-pham-dac-san',
    style: 'photo',
  });
  if (!r.ok) throw new Error('vẽ ảnh giả thất bại');
  return { ...seller, images: r.images };
}

const draft = (imageIds: string[]) => ({
  name: 'Mực một nắng Hamubay',
  price: 350_000,
  stock: 20,
  category: 'thuc-pham-dac-san',
  description: 'Mực dai ngọt.\n\nĐIỂM NỔI BẬT\n• Phơi đúng một nắng.',
  caption: 'Mực dai ngọt #mucmotnang',
  imageIds,
});

describe('video 10 giây từ ảnh AI (SPEC-ai.md mục 5)', () => {
  it('worker ghép ảnh đã chọn thành video dọc 720×1280 dài 10 giây', async () => {
    const { user, images } = await ownerWithImages();
    const r = await startSlideshow(
      user.id,
      images.map((i) => i.id),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await slideshowStatus(user.id, r.jobId)).toMatchObject({ status: 'queued' });
    expect(await processNextSlideshow()).toBe(true);
    expect(await processNextSlideshow()).toBe(false);
    const done = await slideshowStatus(user.id, r.jobId);
    expect(done?.status).toBe('done');
    const file = imageStore().localPath(done!.url!)!;
    const { stdout } = await runTool(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file],
      30_000,
    );
    const info = JSON.parse(stdout) as {
      streams: { width: number; height: number }[];
      format: { duration: string };
    };
    expect(info.streams[0]).toMatchObject({ width: 720, height: 1280 });
    expect(Number(info.format.duration)).toBeCloseTo(10, 0);
  }, 60_000);

  it('1 ảnh cũng ghép được (không có chuyển cảnh)', async () => {
    const { user, images } = await ownerWithImages();
    const r = await startSlideshow(user.id, [images[0]!.id]);
    if (!r.ok) throw new Error('không tạo được video');
    await processNextSlideshow();
    expect(await slideshowStatus(user.id, r.jobId)).toMatchObject({ status: 'done' });
  }, 60_000);

  it('chỉ dùng ảnh của chính mình, 1–4 ảnh; người khác không xem được trạng thái', async () => {
    const { user, images } = await ownerWithImages();
    const other = await ownerWithImages();
    expect(await startSlideshow(user.id, [other.images[0]!.id])).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
    });
    expect(await startSlideshow(user.id, [])).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(
      await startSlideshow(
        user.id,
        [...images, images[0]!].map((i) => i.id),
      ),
    ).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
    });
    const buyer = await createUser();
    expect(await startSlideshow(buyer.id, [images[0]!.id])).toEqual({ ok: false, error: 'NOT_OWNER' });
    const r = await startSlideshow(user.id, [images[1]!.id]);
    expect(r.ok && (await slideshowStatus(other.user.id, r.jobId))).toBeNull();
  });
});

describe('đăng bán từ AI Studio (SPEC-ai.md mục 7)', () => {
  it('tạo đúng 1 sản phẩm có ảnh (chép sang ảnh sản phẩm) và mô tả; ảnh đầu là ảnh chính', async () => {
    const { user, kiotId, images } = await ownerWithImages();
    const chosen = [images[2]!.id, images[0]!.id];
    const r = await publishFromStudio(user.id, draft(chosen));
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.videoId).toBeUndefined();
    const products = await db.product.findMany({
      where: { kiotId },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: 'Mực một nắng Hamubay',
      price: 350_000,
      stock: 20,
      visible: true,
    });
    expect(products[0]!.description).toContain('ĐIỂM NỔI BẬT');
    expect(products[0]!.images).toHaveLength(2);
    // Ảnh sản phẩm là bản chép riêng: ảnh AI bị dọn sau 7 ngày không làm mất ảnh sản phẩm.
    expect(products[0]!.images.map((i) => i.url)).not.toContain(images[2]!.url);
    expect(products[0]!.images[0]!.url).toMatch(/^\/uploads\/products\//);
  });

  it('kèm video: lên hàng đợi video với sản phẩm vừa tạo được gắn sẵn', async () => {
    const { user, images } = await ownerWithImages();
    const s = await startSlideshow(
      user.id,
      images.map((i) => i.id),
    );
    if (!s.ok) throw new Error('không tạo được video');
    await processNextSlideshow();
    const r = await publishFromStudio(user.id, { ...draft([images[0]!.id]), slideshowId: s.jobId });
    expect(r.ok && r.videoId).toBeTruthy();
    if (!r.ok || !r.videoId) return;
    const video = await db.video.findUniqueOrThrow({ where: { id: r.videoId }, include: { products: true } });
    expect(video).toMatchObject({
      authorId: user.id,
      status: 'processing',
      caption: 'Mực dai ngọt #mucmotnang',
    });
    expect(video.products.map((p) => p.productId)).toEqual([r.productId]);
    expect(await db.videoJob.count({ where: { videoId: video.id, status: 'queued' } })).toBe(1);
  }, 60_000);

  it('video chưa ghép xong thì vẫn đăng sản phẩm, báo video chưa sẵn sàng', async () => {
    const { user, images } = await ownerWithImages();
    const s = await startSlideshow(user.id, [images[0]!.id]);
    if (!s.ok) throw new Error('không tạo được video');
    const r = await publishFromStudio(user.id, { ...draft([images[0]!.id]), slideshowId: s.jobId });
    expect(r).toMatchObject({ ok: true, videoError: 'NOT_READY' });
    expect(await db.product.count()).toBe(1);
    expect(await db.video.count()).toBe(0);
  });

  it('chặn người không có Kiot, ảnh của người khác, dữ liệu sai (không tạo sản phẩm)', async () => {
    const { user, images } = await ownerWithImages();
    const other = await ownerWithImages();
    const buyer = await createUser();
    expect(await publishFromStudio(buyer.id, draft([images[0]!.id]))).toEqual({
      ok: false,
      error: 'NOT_OWNER',
    });
    expect(await publishFromStudio(user.id, draft([other.images[0]!.id]))).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { images: expect.any(String) },
    });
    expect(await publishFromStudio(user.id, { ...draft([images[0]!.id]), price: 500 })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { price: expect.any(String) },
    });
    expect(await db.product.count()).toBe(0);
  });
});

describe('dọn ảnh AI chưa đăng bán (SPEC-ai.md "Dữ liệu")', () => {
  it('ảnh và video AI quá 7 ngày bị xoá cả file; ảnh mới giữ lại', async () => {
    const { user, images } = await ownerWithImages();
    const file = imageStore().localPath(images[0]!.url)!;
    expect(existsSync(file)).toBe(true);
    advanceClock({ days: 8 });
    const fresh = await drawProductImages(user.id, { name: 'Tiêu', category: 'nong-san', style: 'flat' });
    expect(fresh.ok).toBe(true);
    expect(await cleanupAiFiles()).toBe(4);
    expect(existsSync(file)).toBe(false);
    expect(await db.aiImage.count()).toBe(4);
  });
});
