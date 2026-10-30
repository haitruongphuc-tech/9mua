import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { saveFeature } from '@/lib/features';
import { runTool } from '@/lib/media/run-tool';
import { createUser, sampleImage } from '../../../tests/helpers/factories';
import { processNextJob } from './jobs';
import { deleteVideo } from './moderation';
import { setVideoCover } from './posting';
import { hlsLevels } from './renditions';
import { createVideoUpload, saveUpload } from './upload';

const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));
const TMP = path.join(os.tmpdir(), 'ninemua-renditions');

// Video 3 màu nối nhau (đỏ → xanh lá → xanh dương), mỗi màu 1/3 thời lượng: ảnh bìa ở 10%, 50%, 90% phải đúng 3 màu.
// Thêm nhiễu đổi theo thời gian để các khung hình khác nhau (khung giống hệt nhau thì WebP động gộp thành 1 khung).
async function bands(name: string, size: string, totalSec: number): Promise<string> {
  const out = path.join(TMP, name);
  if (existsSync(out)) return out;
  await mkdir(TMP, { recursive: true });
  const d = totalSec / 3;
  await runTool(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...['red', 'lime', 'blue'].flatMap((c) => ['-f', 'lavfi', '-i', `color=c=${c}:s=${size}:r=2:d=${d}`]),
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${totalSec}`,
      '-filter_complex',
      '[0:v][1:v][2:v]concat=n=3:v=1:a=0,noise=alls=12:allf=t[v]',
      '-map',
      '[v]',
      '-map',
      '3:a',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '32k',
      out,
    ],
    120_000,
  );
  return out;
}

async function dominant(url: string): Promise<'red' | 'green' | 'blue'> {
  const { channels } = await sharp(await readFile(fileOf(url))).stats();
  const [r, g, b] = channels.map((c) => c.mean);
  return r! > g! && r! > b! ? 'red' : g! > b! ? 'green' : 'blue';
}

async function oldUser() {
  const u = await createUser();
  await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - 5 * 86_400_000) } });
  return u;
}

async function post(userId: string, file: string) {
  const saved = await saveUpload(userId, createReadStream(file));
  if (!saved.ok) throw new Error(saved.error);
  const r = await createVideoUpload(userId, saved.uploadId, { caption: 'mức', productIds: [] });
  if (!r.ok) throw new Error(r.error);
  expect(await processNextJob()).toBe(true);
  return db.video.findUniqueOrThrow({ where: { id: r.videoId }, include: { renditions: true } });
}

describe('nhiều mức chất lượng, 3 ảnh bìa, ảnh xem trước động (SPEC-creator.md V5.1)', () => {
  beforeAll(async () => {
    await bands('short.mp4', '1280x720', 9);
    await bands('long.mp4', '854x480', 66);
  }, 120_000);

  it('các mức HLS theo độ phân giải gốc, không phóng to; 1080p chỉ khi gốc ≥ 1080p và CEO bật', () => {
    expect(hlsLevels({ width: 640, height: 360 }, true)).toEqual([360]);
    expect(hlsLevels({ width: 854, height: 480 }, true)).toEqual([360, 480]);
    expect(hlsLevels({ width: 1280, height: 720 }, true)).toEqual([360, 480, 720]);
    expect(hlsLevels({ width: 1920, height: 1080 }, false)).toEqual([360, 480, 720]);
    expect(hlsLevels({ width: 1080, height: 1920 }, true)).toEqual([360, 480, 720, 1080]);
    expect(hlsLevels({ width: 64, height: 64 }, true)).toEqual([360]);
  });

  it('công tắc tắt: như cũ, chỉ MP4 720p, không có bản khác', { timeout: 60_000 }, async () => {
    const v = await post((await createUser()).id, await bands('short.mp4', '1280x720', 9));
    expect(v).toMatchObject({ status: 'ready', posterChoices: [], previewUrl: null });
    expect(v.renditions).toEqual([]);
  });

  it(
    'video ≤ 60 giây: MP4 720p và 480p, 3 ảnh bìa ở 10%, 50%, 90%, ảnh xem trước WebP động',
    { timeout: 60_000 },
    async () => {
      await saveFeature('long_video', true, null);
      const v = await post((await createUser()).id, await bands('short.mp4', '1280x720', 9));
      expect(v.status).toBe('ready');
      expect(v.fileUrl).toMatch(/\.mp4$/);
      expect(v.renditions.map((r) => [r.kind, r.height]).sort()).toEqual([
        ['mp4', 480],
        ['mp4', 720],
      ]);
      const sd = v.renditions.find((r) => r.height === 480)!;
      expect(existsSync(fileOf(sd.path))).toBe(true);
      expect(sd.bytes).toBeGreaterThan(0);
      expect(v.posterChoices).toHaveLength(3);
      expect(await Promise.all(v.posterChoices.map(dominant))).toEqual(['red', 'green', 'blue']);
      const preview = await sharp(await readFile(fileOf(v.previewUrl!)), { animated: true }).metadata();
      expect(preview).toMatchObject({ format: 'webp', width: 240 });
      expect(preview.pages).toBeGreaterThan(1);
    },
  );

  it(
    'video > 60 giây: HLS đoạn 6 giây đủ các mức theo gốc; xoá video thì xoá hết các bản',
    { timeout: 120_000 },
    async () => {
      await saveFeature('long_video', true, null);
      const v = await post((await oldUser()).id, await bands('long.mp4', '854x480', 66));
      expect(v.status).toBe('ready');
      expect(v.fileUrl).toMatch(/\/master\.m3u8$/);
      const master = await readFile(fileOf(v.fileUrl!), 'utf8');
      expect(master).toContain('360p/index.m3u8');
      expect(master).toContain('480p/index.m3u8');
      expect(master).not.toContain('720p');
      expect(v.renditions.map((r) => [r.kind, r.height]).sort()).toEqual([
        ['hls', 360],
        ['hls', 480],
      ]);
      const level = await readFile(fileOf(v.renditions.find((r) => r.height === 480)!.path), 'utf8');
      expect(level).toContain('#EXT-X-TARGETDURATION:6');
      expect(level.match(/seg\d+\.m4s/g)).toHaveLength(11); // 66 giây / 6 giây
      expect(level).toMatch(/#EXT-X-MAP:URI="init_\d\.mp4"/);
      expect(await Promise.all(v.posterChoices.map(dominant))).toEqual(['red', 'green', 'blue']);
      expect(v.previewUrl).toMatch(/\.webp$/);

      expect(await deleteVideo(v.id, v.authorId)).toEqual({ ok: true });
      expect(existsSync(path.dirname(fileOf(v.fileUrl!)))).toBe(false);
      for (const url of [...v.posterChoices, v.previewUrl!]) expect(existsSync(fileOf(url))).toBe(false);
    },
  );

  it(
    'đổi ảnh bìa: chọn 1 trong 3 ảnh gợi ý, hoặc tải ảnh riêng cắt 9:16; người khác không đổi được',
    { timeout: 60_000 },
    async () => {
      await saveFeature('long_video', true, null);
      const u = await createUser();
      const v = await post(u.id, await bands('short.mp4', '1280x720', 9));
      const original = v.posterUrl!;
      const other = await createUser();
      expect(await setVideoCover(other.id, v.id, { choice: v.posterChoices[1]! })).toEqual({
        ok: false,
        error: 'NOT_FOUND',
      });
      expect(await setVideoCover(u.id, v.id, { choice: '/uploads/khac.jpg' })).toEqual({
        ok: false,
        error: 'BAD_CHOICE',
      });
      expect(await setVideoCover(u.id, v.id, { choice: v.posterChoices[1]! })).toEqual({
        ok: true,
        posterUrl: v.posterChoices[1],
      });
      expect(existsSync(fileOf(original))).toBe(false); // ảnh bìa cũ không phải ảnh gợi ý thì xoá
      const custom = await setVideoCover(u.id, v.id, { image: await sampleImage('#123456', 1000, 1000) });
      if (!custom.ok) throw new Error(custom.error);
      expect(await sharp(await readFile(fileOf(custom.posterUrl))).metadata()).toMatchObject({
        format: 'webp',
        width: 720,
        height: 1280,
      });
      expect(existsSync(fileOf(v.posterChoices[1]!))).toBe(true); // ảnh gợi ý vẫn giữ để chọn lại
      expect(await setVideoCover(u.id, v.id, { image: Buffer.from('khong phai anh') })).toEqual({
        ok: false,
        error: 'NOT_AN_IMAGE',
      });
    },
  );
});
