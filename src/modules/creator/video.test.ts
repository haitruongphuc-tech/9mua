import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import { processNextJob } from './jobs';
import { probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const FIX = 'tests/fixtures/videos';
const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

async function upload(
  userId: string,
  fixture: string,
  meta: { caption?: string; productIds?: string[] } = {},
) {
  const saved = await saveUpload(userId, createReadStream(path.join(FIX, fixture)));
  if (!saved.ok) throw new Error(saved.error);
  return createVideoUpload(userId, saved.uploadId, {
    caption: meta.caption ?? '',
    productIds: meta.productIds ?? [],
  });
}

describe('đăng video và chuyển mã', () => {
  it(
    'MOV HEVC của iPhone → MP4 H.264 ≤ 720×1280, đúng chiều dọc, có ảnh bìa, không còn GPS; xoá file gốc',
    { timeout: 60_000 },
    async () => {
      const u = await createUser();
      const r = await upload(u.id, 'iphone-hevc.mov', { caption: 'Thanh long ngon #thanhlong' });
      if (!r.ok) throw new Error(r.error);
      const job = await db.videoJob.findUniqueOrThrow({ where: { videoId: r.videoId } });
      expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
        status: 'processing',
        hashtags: ['thanhlong'],
      });

      expect(await processNextJob()).toBe(true);
      const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
      expect(v).toMatchObject({ status: 'ready', width: 360, height: 640 });
      expect(v.durationSec).toBeCloseTo(2, 0);
      const out = await probe(fileOf(v.fileUrl!));
      expect(out.video?.codec).toBe('h264');
      expect(out.formatName).toContain('mp4');
      expect(out.tags.location).toBeUndefined();
      expect(JSON.stringify(out.tags)).not.toMatch(/iPhone|Apple|106\.7/);
      expect(existsSync(fileOf(v.posterUrl!))).toBe(true);
      expect(existsSync(job.sourcePath)).toBe(false);
      expect(await db.notification.findFirst({ where: { userId: u.id } })).toMatchObject({
        title: 'Video đã đăng xong',
      });
      expect(await processNextJob()).toBe(false);
    },
  );

  it('MP4 ngang 1280×720 thu về khoảng 720×405 (giữ tỉ lệ)', { timeout: 60_000 }, async () => {
    const u = await createUser();
    const r = await upload(u.id, 'landscape.mp4');
    if (!r.ok) throw new Error(r.error);
    await processNextJob();
    const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
    expect(v).toMatchObject({ status: 'ready', width: 720 });
    expect(Math.abs(v.height! - 405)).toBeLessThanOrEqual(1); // làm tròn về số chẵn cho H.264
  });

  it('file 75 giây → failed "Video dài hơn 60 giây" và báo người đăng', async () => {
    const u = await createUser();
    const r = await upload(u.id, 'long-75s.mp4');
    if (!r.ok) throw new Error(r.error);
    await processNextJob();
    expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
      status: 'failed',
      failReason: 'Video dài hơn 60 giây',
      fileUrl: null,
    });
    expect(await db.notification.findFirst({ where: { userId: u.id } })).toMatchObject({
      title: 'Video không đăng được',
    });
  });

  it('file đổi đuôi .mp4 nhưng không phải video → bị từ chối ngay', async () => {
    const u = await createUser();
    expect(await upload(u.id, 'fake.mp4')).toEqual({ ok: false, error: 'BAD_FORMAT' });
    expect(await db.video.count()).toBe(0);
  });

  it('hai worker chạy song song không xử lý trùng một video', { timeout: 60_000 }, async () => {
    const u = await createUser();
    const a = await upload(u.id, 'landscape.mp4');
    const b = await upload(u.id, 'landscape.mp4');
    if (!a.ok || !b.ok) throw new Error();
    const results = await Promise.all([processNextJob(), processNextJob(), processNextJob()]);
    expect(results.filter(Boolean)).toHaveLength(2);
    const jobs = await db.videoJob.findMany();
    expect(jobs.map((j) => [j.status, j.attempts])).toEqual([
      ['done', 1],
      ['done', 1],
    ]);
  });
});

describe('điều kiện đăng', () => {
  it('tối đa 10 video và 10 Story mỗi ngày (giới hạn riêng, SPEC-creator.md bổ sung 27/10)', async () => {
    const u = await createUser();
    for (let i = 0; i < 10; i++) expect(await upload(u.id, 'long-75s.mp4')).toMatchObject({ ok: true });
    // Hết lượt video nhưng vẫn tải lên được để đăng Story.
    const saved = await saveUpload(u.id, createReadStream(path.join(FIX, 'long-75s.mp4')));
    if (!saved.ok) throw new Error(saved.error);
    expect(await createVideoUpload(u.id, saved.uploadId, { caption: '', productIds: [] })).toEqual({
      ok: false,
      error: 'DAILY_LIMIT',
    });
    for (let i = 0; i < 10; i++) {
      const s = await saveUpload(u.id, createReadStream(path.join(FIX, 'long-75s.mp4')));
      if (!s.ok) throw new Error(s.error);
      expect(
        await createVideoUpload(u.id, s.uploadId, { caption: '', productIds: [], kind: 'story' }),
      ).toMatchObject({
        ok: true,
      });
    }
    expect(await saveUpload(u.id, createReadStream(path.join(FIX, 'long-75s.mp4')))).toEqual({
      ok: false,
      error: 'DAILY_LIMIT',
    });
  });

  it('gắn tối đa 3 sản phẩm đang bán (Kiot bất kỳ); Kiot không hoạt động → PRODUCT_INVALID', async () => {
    const u = await createUser();
    const live = await createSeller({ active: true });
    const ps = await Promise.all([1, 2, 3, 4].map((i) => createProduct(live.kiotId, { name: `SP ${i}` })));
    const draft = await createSeller();
    const dead = await createProduct(draft.kiotId);
    expect(await upload(u.id, 'long-75s.mp4', { productIds: ps.slice(0, 3).map((p) => p.id) })).toMatchObject(
      { ok: true },
    );
    expect(await upload(u.id, 'long-75s.mp4', { productIds: ps.map((p) => p.id) })).toEqual({
      ok: false,
      error: 'PRODUCT_INVALID',
    });
    expect(await upload(u.id, 'long-75s.mp4', { productIds: [dead.id] })).toEqual({
      ok: false,
      error: 'PRODUCT_INVALID',
    });
    expect(await upload(u.id, 'long-75s.mp4', { caption: 'x'.repeat(301) })).toEqual({
      ok: false,
      error: 'CAPTION_TOO_LONG',
    });
  });

  it('file vượt 100MB bị cắt khi đang tải lên', async () => {
    const u = await createUser();
    const { Readable } = await import('node:stream');
    const chunk = Buffer.alloc(1024 * 1024);
    const big = Readable.from(
      (function* () {
        for (let i = 0; i < 101; i++) yield chunk;
      })(),
    );
    expect(await saveUpload(u.id, big)).toEqual({ ok: false, error: 'TOO_LARGE' });
  });

  it('không dùng được mã tải lên của người khác', async () => {
    const a = await createUser();
    const b = await createUser();
    const saved = await saveUpload(a.id, createReadStream(path.join(FIX, 'landscape.mp4')));
    if (!saved.ok) throw new Error();
    expect(await createVideoUpload(b.id, saved.uploadId, { caption: '', productIds: [] })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await createVideoUpload(a.id, '../../etc/passwd', { caption: '', productIds: [] })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });
});
