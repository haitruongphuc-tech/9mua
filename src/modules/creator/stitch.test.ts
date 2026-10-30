import { createReadStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { runTool } from '@/lib/media/run-tool';
import { createUser } from '../../../tests/helpers/factories';
import { getVideo } from './feed';
import { processNextJob } from './jobs';
import { setVideoOptions } from './visibility';
import { probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const TMP = path.join(os.tmpdir(), 'ninemua-stitch');
const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

async function clip(name: string, seconds: number): Promise<string> {
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
      `testsrc=size=640x360:rate=15:duration=${seconds}`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=330:duration=${seconds}`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      out,
    ],
    60_000,
  );
  return out;
}

async function post(userId: string, file: string, meta: Parameters<typeof createVideoUpload>[2]) {
  const saved = await saveUpload(userId, createReadStream(file));
  if (!saved.ok) throw new Error(saved.error);
  return createVideoUpload(userId, saved.uploadId, meta);
}

describe('Stitch (SPEC-creator.md V5.5 mục 4)', () => {
  it(
    'ghép 1–5 giây của video gốc + video mới thành 720×1280, có nhãn "Stitch với @tên"',
    { timeout: 120_000 },
    async () => {
      const owner = await createUser({ displayName: 'Chủ gốc' });
      const me = await createUser();
      const original = await post(owner.id, await clip('goc.mp4', 10), { caption: 'gốc', productIds: [] });
      if (!original.ok) throw new Error(original.error);
      expect(await processNextJob()).toBe(true);

      // Đoạn phải dài 1–5 giây và nằm trong video gốc.
      for (const stitch of [
        { ofId: original.videoId, fromSec: 2, toSec: 2.5 },
        { ofId: original.videoId, fromSec: 2, toSec: 8 },
        { ofId: original.videoId, fromSec: 8, toSec: 12 },
        { ofId: 'khong-co', fromSec: 0, toSec: 3 },
      ])
        expect(
          await post(me.id, await clip('moi.mp4', 3), { caption: 'x', productIds: [], stitch }),
          JSON.stringify(stitch),
        ).toEqual({ ok: false, error: 'STITCH_INVALID' });

      const r = await post(me.id, await clip('moi.mp4', 3), {
        caption: 'stitch',
        productIds: [],
        stitch: { ofId: original.videoId, fromSec: 2, toSec: 5 },
      });
      if (!r.ok) throw new Error(r.error);
      expect(await processNextJob()).toBe(true);
      const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
      expect(v).toMatchObject({
        status: 'ready',
        stitchOfId: original.videoId,
        stitchFromSec: 2,
        stitchToSec: 5,
      });
      const out = await probe(fileOf(v.fileUrl!));
      expect(out.video).toMatchObject({ width: 720, height: 1280 });
      expect(out.hasAudio).toBe(true);
      expect(out.durationSec).toBeGreaterThan(5.6); // 3 giây gốc + 3 giây mới
      expect(out.durationSec).toBeLessThan(6.6);
      expect((await getVideo(v.id, {}))!.stitchOf).toEqual({ id: original.videoId, authorName: 'Chủ gốc' });

      // Chủ video gốc tắt Duet/Stitch: không Stitch thêm được, video đã Stitch vẫn giữ.
      await setVideoOptions(owner.id, original.videoId, { allowRemix: false });
      expect(
        await post(me.id, await clip('moi.mp4', 3), {
          caption: 'x',
          productIds: [],
          stitch: { ofId: original.videoId, fromSec: 0, toSec: 2 },
        }),
      ).toEqual({ ok: false, error: 'STITCH_INVALID' });
      expect((await getVideo(v.id, {}))!.stitchOf).toEqual({ id: original.videoId, authorName: 'Chủ gốc' });
    },
  );
});
