import { createReadStream } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { advanceClock, resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createUser } from '../../../tests/helpers/factories';
import { getFeed } from './feed';
import { processNextJob } from './jobs';
import { expireStories, listStories } from './stories';
import { duetArgs, probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const FIX = 'tests/fixtures/videos';
const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));

async function upload(
  userId: string,
  fixture: string,
  meta: { kind?: 'video' | 'story'; duetOfId?: string; caption?: string } = {},
) {
  const saved = await saveUpload(userId, createReadStream(path.join(FIX, fixture)));
  if (!saved.ok) throw new Error(saved.error);
  return createVideoUpload(userId, saved.uploadId, { caption: meta.caption ?? '', productIds: [], ...meta });
}

describe('Story 24 giờ', () => {
  it('lên Story có hạn 24 giờ, không vào feed chính; hết hạn thì biến mất', { timeout: 60_000 }, async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const u = await createUser();
    const r = await upload(u.id, 'iphone-hevc.mov', { kind: 'story', caption: 'Story thử' });
    if (!r.ok) throw new Error(r.error);
    await processNextJob();
    const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
    expect(v).toMatchObject({ status: 'ready', kind: 'story' });
    expect(v.expiresAt!.getTime() - v.readyAt!.getTime()).toBe(24 * 3_600_000);
    expect((await listStories()).map((g) => g.items.map((i) => i.id))).toEqual([[r.videoId]]);
    expect((await getFeed({})).items.map((x) => x.id)).not.toContain(r.videoId);

    advanceClock({ hours: 25 });
    expect(await listStories()).toEqual([]);
    expect(await expireStories()).toBe(1);
    expect((await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).status).toBe('expired');
    resetClock();
  });

  it('Story dài hơn 30 giây bị từ chối', { timeout: 60_000 }, async () => {
    const u = await createUser();
    const r = await upload(u.id, 'long-75s.mp4', { kind: 'story' });
    if (!r.ok) throw new Error(r.error);
    await processNextJob();
    expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
      status: 'failed',
      failReason: 'Video dài hơn 30 giây',
    });
  });
});

describe('Duet', () => {
  it(
    'ghép 2 video cạnh nhau thành 720×1280, có tiếng, dài bằng video mới',
    { timeout: 120_000 },
    async () => {
      const author = await createUser();
      const orig = await upload(author.id, 'landscape.mp4');
      if (!orig.ok) throw new Error(orig.error);
      await processNextJob();

      const u = await createUser();
      const duet = await upload(u.id, 'iphone-hevc.mov', { duetOfId: orig.videoId });
      if (!duet.ok) throw new Error(duet.error);
      await processNextJob();
      const v = await db.video.findUniqueOrThrow({ where: { id: duet.videoId } });
      expect(v).toMatchObject({ status: 'ready', duetOfId: orig.videoId, width: 720, height: 1280 });
      expect(v.durationSec).toBeCloseTo(2, 0);
      const out = await probe(fileOf(v.fileUrl!));
      expect(out.video?.codec).toBe('h264');
    },
  );

  it('không Duet được video không còn trên feed hoặc Story', async () => {
    const u = await createUser();
    expect(await upload(u.id, 'iphone-hevc.mov', { duetOfId: 'khong-co' })).toEqual({
      ok: false,
      error: 'DUET_INVALID',
    });
  });

  it('tham số ffmpeg cố định, không có tiếng thì không map tiếng', () => {
    const args = duetArgs('/a/new.mp4', '/a/orig.mp4', '/a/out.mp4', {
      durationSec: 12,
      newAudio: false,
      origAudio: false,
    });
    expect(args.join(' ')).toContain('hstack=inputs=2');
    expect(args.join(' ')).not.toContain('[a]');
    expect(args.slice(-1)[0]).toBe('/a/out.mp4');
    expect(args).toContain('12');
  });
});
