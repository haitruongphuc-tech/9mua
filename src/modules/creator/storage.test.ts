import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { env, resetEnvCache } from '@/lib/env';
import { saveFeature } from '@/lib/features';
import { fakeS3, resetMediaStores } from '@/lib/media/image-store';
import { createUser } from '../../../tests/helpers/factories';
import { processNextJob } from './jobs';
import { deleteVideo } from './moderation';
import { migrateVideosToExternal, storageStats } from './storage';
import { createVideoUpload, saveUpload } from './upload';

const BASE = 'https://media.9mua.test';
const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

async function post(userId: string) {
  const saved = await saveUpload(userId, createReadStream('tests/fixtures/videos/landscape.mp4'));
  if (!saved.ok) throw new Error(saved.error);
  const r = await createVideoUpload(userId, saved.uploadId, { caption: 'kho', productIds: [] });
  if (!r.ok) throw new Error(r.error);
  expect(await processNextJob()).toBe(true);
  return db.video.findUniqueOrThrow({ where: { id: r.videoId }, include: { renditions: true } });
}

describe('kho video ngoài + lệnh chuyển file cũ + trang Dung lượng (SPEC-creator.md V5.1 mục 9–10)', () => {
  beforeEach(() => {
    vi.stubEnv('STORAGE_DRIVER', 'fake');
    vi.stubEnv('STORAGE_PUBLIC_URL', BASE);
    // Công tắc chỉ bật được khi có đủ khoá (driver fake vẫn đọc như thật).
    for (const k of ['STORAGE_S3_ENDPOINT', 'STORAGE_S3_BUCKET', 'STORAGE_S3_KEY', 'STORAGE_S3_SECRET'])
      vi.stubEnv(k, k === 'STORAGE_S3_ENDPOINT' ? 'https://r2.test' : 'x');
    resetEnvCache();
    resetMediaStores();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
    resetMediaStores();
  });

  it(
    'tắt: video lưu trên VPS như cũ; bật: video MỚI lên kho ngoài, phát từ STORAGE_PUBLIC_URL; xoá thì xoá trên kho',
    { timeout: 60_000 },
    async () => {
      const u = await createUser();
      const before = await post(u.id);
      expect(before.fileUrl).toMatch(/^\/uploads\/videos\//);

      await saveFeature('external_storage', true, null);
      const v = await post(u.id);
      expect(v.fileUrl).toMatch(new RegExp(`^${BASE}/videos/.+\\.mp4$`));
      expect(v.posterUrl).toMatch(new RegExp(`^${BASE}/videos/`));
      const key = v.fileUrl!.slice(BASE.length + 1);
      expect(fakeS3()!.objects.get(key)?.contentType).toBe('video/mp4');
      expect(existsSync(path.join(env().UPLOAD_DIR, key))).toBe(false);
      // Video cũ vẫn ở VPS.
      expect(existsSync(fileOf(before.fileUrl!))).toBe(true);

      await deleteVideo(v.id, u.id);
      expect(fakeS3()!.objects.has(key)).toBe(false);
    },
  );

  it(
    'chuyển file cũ: đọc lại khớp dung lượng mới xoá bản trên VPS; chạy lại được; lệch dung lượng thì giữ nguyên',
    { timeout: 90_000 },
    async () => {
      await saveFeature('long_video', true, null); // có thêm bản 480p, 3 ảnh bìa, ảnh xem trước
      const u = await createUser();
      const v = await post(u.id);
      const localFiles = [
        v.fileUrl!,
        v.posterUrl!,
        ...v.posterChoices,
        v.previewUrl!,
        ...v.renditions.map((r) => r.path),
      ];
      for (const f of localFiles) expect(existsSync(fileOf(f)), f).toBe(true);

      const first = await migrateVideosToExternal();
      expect(first).toMatchObject({ ok: true, moved: 1, skipped: 0 });
      const moved = await db.video.findUniqueOrThrow({ where: { id: v.id }, include: { renditions: true } });
      for (const url of [
        moved.fileUrl!,
        moved.posterUrl!,
        ...moved.posterChoices,
        moved.previewUrl!,
        ...moved.renditions.map((r) => r.path),
      ])
        expect(url.startsWith(`${BASE}/videos/`), url).toBe(true);
      for (const f of localFiles) expect(existsSync(fileOf(f)), f).toBe(false);
      expect(await migrateVideosToExternal()).toMatchObject({ ok: true, moved: 0, skipped: 0 });

      // Kho ngoài trả dung lượng lệch: không đổi link, không xoá bản trên VPS.
      await saveFeature('long_video', false, null);
      const w = await post(u.id);
      fakeS3()!.wrongSize = true;
      expect(await migrateVideosToExternal()).toMatchObject({ ok: true, moved: 0, skipped: 1 });
      expect((await db.video.findUniqueOrThrow({ where: { id: w.id } })).fileUrl).toBe(w.fileUrl);
      expect(existsSync(fileOf(w.fileUrl!))).toBe(true);
    },
  );

  it(
    'trang Dung lượng: GB theo nơi lưu, ổ VPS còn trống, số video dài, ước tính tháng tới',
    { timeout: 60_000 },
    async () => {
      const u = await createUser();
      await post(u.id);
      await saveFeature('external_storage', true, null);
      await post(u.id);
      await db.video.create({
        data: { authorId: u.id, caption: 'dài', hashtags: [], status: 'ready', sourceSec: 600 },
      });
      const s = await storageStats();
      expect(s.local.bytes).toBeGreaterThan(0);
      expect(s.external).toMatchObject({ on: true });
      expect(s.external!.bytes).toBeGreaterThan(0);
      expect(s.disk.totalBytes).toBeGreaterThan(s.disk.freeBytes);
      expect(s.longVideos).toBe(1);
      expect(s.next30Bytes).toBe(s.local.last30Bytes + s.external!.last30Bytes);
    },
  );
});
