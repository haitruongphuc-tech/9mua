import { createReadStream } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createUser } from '../../../tests/helpers/factories';
import { DOWNLOADS_PER_DAY, expireDownloads, processNextDownload, requestDownload } from './downloads';
import { embedVideo } from './embed';
import { processNextJob } from './jobs';
import { probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

async function post(userId: string, options: Parameters<typeof createVideoUpload>[2]['options'] = {}) {
  const saved = await saveUpload(userId, createReadStream('tests/fixtures/videos/landscape.mp4'));
  if (!saved.ok) throw new Error(saved.error);
  const r = await createVideoUpload(userId, saved.uploadId, { caption: 'tải về', productIds: [], options });
  if (!r.ok) throw new Error(r.error);
  expect(await processNextJob()).toBe(true);
  return r.videoId;
}

describe('tải về có logo, nhúng (SPEC-creator.md V5.7)', () => {
  it(
    'lần đầu tạo bản 720p có logo (việc nền), lần sau trả link; 20 lượt mỗi ngày; giữ 7 ngày',
    { timeout: 90_000 },
    async () => {
      const owner = await createUser({ displayName: 'Chủ video' });
      const fan = await createUser();
      const id = await post(owner.id);
      // Video không cho tải, riêng tư: không tải được.
      const noDl = await post(owner.id, { allowDownload: false });
      const priv = await post(owner.id, { visibility: 'private' });
      expect(await requestDownload(fan.id, noDl)).toEqual({ ok: false, error: 'NOT_FOUND' });
      expect(await requestDownload(fan.id, priv)).toEqual({ ok: false, error: 'NOT_FOUND' });

      expect(await requestDownload(fan.id, id)).toEqual({ ok: true, pending: true });
      expect(await requestDownload(fan.id, id)).toEqual({ ok: true, pending: true }); // không tạo trùng
      expect(await processNextDownload()).toBe(true);
      expect(await processNextDownload()).toBe(false);
      const r = await requestDownload(fan.id, id);
      if (!r.ok || !('url' in r)) throw new Error('chưa có link');
      expect(r.url).toMatch(/^\/uploads\/downloads\/.+\.mp4$/);
      const out = await probe(fileOf(r.url));
      const src = await db.video.findUniqueOrThrow({ where: { id } });
      expect(out.video?.width).toBe(src.width); // giữ đúng cỡ bản đã xử lý (≤ 720p), không phóng to
      expect(out.hasAudio).toBe(true);
      expect(await db.videoDownloadLog.count({ where: { userId: fan.id } })).toBe(1);

      for (let i = 1; i < DOWNLOADS_PER_DAY; i++) expect((await requestDownload(fan.id, id)).ok).toBe(true);
      expect(await requestDownload(fan.id, id)).toEqual({ ok: false, error: 'DAILY_LIMIT' });

      // Quá 7 ngày: xoá file, lần tải sau tạo lại.
      setClock(new Date(Date.now() + 8 * 86_400_000));
      try {
        expect(await expireDownloads()).toBeGreaterThanOrEqual(1);
        expect((await db.videoDownload.findUniqueOrThrow({ where: { videoId: id } })).status).toBe('expired');
        expect(await requestDownload(owner.id, id)).toEqual({ ok: true, pending: true });
      } finally {
        resetClock();
      }
    },
  );

  it('nhúng: chỉ video công khai', { timeout: 60_000 }, async () => {
    const owner = await createUser({ displayName: 'Người nhúng' });
    const pub = await post(owner.id);
    const followers = await post(owner.id, { visibility: 'followers' });
    expect(await embedVideo(pub)).toMatchObject({ id: pub, authorName: expect.any(String) });
    expect(await embedVideo(followers)).toBeNull();
  });
});
