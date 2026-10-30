import { createReadStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { runTool } from '@/lib/media/run-tool';
import { createUser } from '../../../tests/helpers/factories';
import { processNextJob } from './jobs';
import { CSS_LOOKS, LOOKS, lookFilter } from './look';
import { assembleRecording, MAX_SEGMENTS } from './recording';
import { probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const TMP = path.join(os.tmpdir(), 'ninemua-recording');
const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

// Đoạn quay giả như MediaRecorder của trình duyệt (WebM VP8 + Opus, có thể không có tiếng).
async function segment(name: string, seconds: number, audio: boolean, live = false): Promise<string> {
  await mkdir(TMP, { recursive: true });
  const out = path.join(TMP, name);
  await runTool(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=640x480:rate=15:duration=${seconds}`,
      ...(audio ? ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`] : []),
      '-c:v',
      'libvpx',
      '-b:v',
      '300k',
      ...(audio ? ['-c:a', 'libopus'] : []),
      // live: WebM không ghi thời lượng ở đầu file, giống file MediaRecorder của trình duyệt.
      ...(live ? ['-f', 'webm', '-live', '1'] : []),
      out,
    ],
    60_000,
  );
  return out;
}

describe('quay trong app, bộ lọc màu, làm đẹp (SPEC-creator.md V5.5)', () => {
  it('8 bộ lọc: mỗi bộ có bản xem trước trên trình duyệt và bộ lọc ffmpeg; làm đẹp 0–3', () => {
    expect(LOOKS).toEqual(['goc', 'sang', 'am', 'lanh', 'co-dien', 'den-trang', 'ruc', 'mem']);
    for (const look of LOOKS) expect(CSS_LOOKS[look]).toBeDefined();
    expect(lookFilter('goc', 0)).toBeNull();
    expect(lookFilter('den-trang', 0)).toContain('hue=s=0');
    expect(lookFilter('goc', 3)).toMatch(/hqdn3d=.*eq=brightness/);
    expect(lookFilter('khong-co' as never, 9)).toBeNull();
    // Không nhận diện hay chỉnh khuôn mặt: chỉ lọc toàn khung.
    expect(lookFilter('mem', 3)).not.toMatch(/face|landmark/i);
  });

  it(
    'ghép các đoạn quay: đổi tốc độ từng đoạn (tiếng đổi theo), đoạn không có tiếng thì thêm im lặng, ra 720×1280',
    { timeout: 120_000 },
    async () => {
      const u = await createUser();
      const a = await segment('a.webm', 2, true, true);
      const b = await segment('b.webm', 2, false);
      const r = await assembleRecording(u.id, [
        { path: a, speed: 1 },
        { path: b, speed: 2 },
      ]);
      if (!r.ok) throw new Error(r.error);
      const out = await probe(path.join(env().PRIVATE_DIR, 'video-uploads', u.id, `${r.uploadId}.bin`));
      expect(out.video).toMatchObject({ width: 720, height: 1280 });
      expect(out.hasAudio).toBe(true);
      expect(out.durationSec).toBeGreaterThan(2.7);
      expect(out.durationSec).toBeLessThan(3.4); // 2 giây + 2 giây ở 2x = 3 giây

      expect(await assembleRecording(u.id, [{ path: a, speed: 4 }])).toEqual({ ok: false, error: 'INVALID' });
      expect(await assembleRecording(u.id, [])).toEqual({ ok: false, error: 'INVALID' });
      expect(
        await assembleRecording(
          u.id,
          Array.from({ length: MAX_SEGMENTS + 1 }, () => ({ path: a, speed: 1 })),
        ),
      ).toEqual({ ok: false, error: 'INVALID' });
      // Đoạn quay dài quá giới hạn (60 giây khi tắt video dài).
      const long = await segment('long.webm', 62, true);
      expect(await assembleRecording(u.id, [{ path: long, speed: 1 }])).toEqual({
        ok: false,
        error: 'TOO_LONG',
      });
      // Chậm 0,5x làm video dài gấp đôi: 40 giây thành 80 giây, quá 60 giây.
      const mid = await segment('mid.webm', 40, true);
      expect(await assembleRecording(u.id, [{ path: mid, speed: 0.5 }])).toEqual({
        ok: false,
        error: 'TOO_LONG',
      });
    },
  );

  it('bộ lọc Đen trắng và làm đẹp được áp khi xử lý video', { timeout: 60_000 }, async () => {
    const u = await createUser();
    const saved = await saveUpload(u.id, createReadStream('tests/fixtures/videos/landscape.mp4'));
    if (!saved.ok) throw new Error(saved.error);
    const r = await createVideoUpload(u.id, saved.uploadId, {
      caption: 'đen trắng',
      productIds: [],
      options: { look: 'den-trang', beauty: 2 },
    });
    if (!r.ok) throw new Error(r.error);
    expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
      look: 'den-trang',
      beauty: 2,
    });
    expect(await processNextJob()).toBe(true);
    const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
    const { channels } = await sharp(await readFile(fileOf(v.posterUrl!))).stats();
    const [red, green, blue] = channels.map((c) => c.mean);
    expect(Math.abs(red! - green!)).toBeLessThan(3);
    expect(Math.abs(green! - blue!)).toBeLessThan(3);
  });
});
