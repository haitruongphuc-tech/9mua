import { createReadStream, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { resetEnvCache } from '@/lib/env';
import { saveFeature } from '@/lib/features';
import { setSetting } from '@/lib/settings';
import { createUser } from '../../../tests/helpers/factories';
import {
  captionsForViewer,
  FAKE_VTT,
  MAX_CAPTION_SECONDS,
  openAiStt,
  processNextCaption,
  saveCaptions,
} from './captions';
import { getVideo } from './feed';
import { processNextJob } from './jobs';
import { createVideoUpload, saveUpload } from './upload';

async function post(userId: string, autoCaptions = true) {
  const saved = await saveUpload(userId, createReadStream('tests/fixtures/videos/landscape.mp4'));
  if (!saved.ok) throw new Error(saved.error);
  const r = await createVideoUpload(userId, saved.uploadId, {
    caption: 'phụ đề',
    productIds: [],
    options: { autoCaptions },
  });
  if (!r.ok) throw new Error(r.error);
  expect(await processNextJob()).toBe(true);
  return r.videoId;
}

describe('phụ đề tự động (SPEC-creator.md V5.4)', () => {
  beforeEach(async () => {
    vi.stubEnv('STT_PROVIDER', 'fake');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test'); // công tắc chỉ bật được khi có khoá
    resetEnvCache();
    await saveFeature('auto_captions', true, null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetEnvCache();
  });

  it(
    'bật khi đăng: xử lý xong thì tạo phụ đề, ghi sổ chi phí; chưa bật cho người xem thì chưa hiện',
    { timeout: 60_000 },
    async () => {
      const u = await createUser();
      const videoId = await post(u.id);
      expect(await db.videoCaption.findUniqueOrThrow({ where: { videoId } })).toMatchObject({
        status: 'pending',
      });
      expect(await processNextCaption()).toBe(true);
      expect(await db.videoCaption.findUniqueOrThrow({ where: { videoId } })).toMatchObject({
        status: 'ready',
        vtt: FAKE_VTT,
        published: false,
      });
      const usage = await db.sttUsage.findFirstOrThrow({ where: { videoId } });
      expect(usage).toMatchObject({ userId: u.id, provider: 'fake', ok: true });
      expect(usage.costVnd).toBeGreaterThan(0);
      expect(await db.notification.count({ where: { userId: u.id, title: '@notify.captionsReady' } })).toBe(
        1,
      );
      expect(await processNextCaption()).toBe(false);

      const viewer = await createUser();
      expect((await getVideo(videoId, { userId: viewer.id }))!.captionsUrl).toBeNull();
      expect(await captionsForViewer(videoId, viewer.id)).toBeNull();

      // Người đăng sửa chữ rồi bật cho người xem.
      const edited = FAKE_VTT.replace('Phụ đề mẫu', 'Chào cả nhà');
      expect(await saveCaptions(viewer.id, videoId, { vtt: edited, published: true })).toEqual({
        ok: false,
        error: 'NOT_FOUND',
      });
      expect(await saveCaptions(u.id, videoId, { vtt: 'không phải phụ đề', published: true })).toEqual({
        ok: false,
        error: 'INVALID',
      });
      expect(await saveCaptions(u.id, videoId, { vtt: edited, published: true })).toEqual({ ok: true });
      expect((await getVideo(videoId, { userId: viewer.id }))!.captionsUrl).toBe(
        `/api/video/${videoId}/phu-de`,
      );
      expect(await captionsForViewer(videoId, viewer.id)).toContain('Chào cả nhà');
    },
  );

  it('không bật khi đăng, hoặc công tắc tắt: không tạo phụ đề', { timeout: 60_000 }, async () => {
    const u = await createUser();
    const a = await post(u.id, false);
    await saveFeature('auto_captions', false, null);
    const b = await post(u.id, true);
    expect(await db.videoCaption.count({ where: { videoId: { in: [a, b] } } })).toBe(0);
  });

  it(
    `video dài hơn ${MAX_CAPTION_SECONDS / 60} phút thì bỏ qua; hết ngân sách tháng thì bỏ qua, báo người đăng và CEO`,
    { timeout: 60_000 },
    async () => {
      const u = await createUser();
      const videoId = await post(u.id);
      await db.video.update({ where: { id: videoId }, data: { durationSec: MAX_CAPTION_SECONDS + 1 } });
      expect(await processNextCaption()).toBe(true);
      expect(await db.videoCaption.findUniqueOrThrow({ where: { videoId } })).toMatchObject({
        status: 'skipped',
        reason: 'TOO_LONG',
      });

      await setSetting('stt_monthly_budget_vnd', '0', null);
      const second = await post(u.id);
      expect(await processNextCaption()).toBe(true);
      expect(await db.videoCaption.findUniqueOrThrow({ where: { videoId: second } })).toMatchObject({
        status: 'skipped',
        reason: 'BUDGET',
      });
      expect(await db.sttUsage.count({ where: { videoId: second } })).toBe(0);
      expect(await db.notification.count({ where: { userId: u.id, title: '@notify.captionsSkipped' } })).toBe(
        2,
      );
      expect(await db.alertEvent.count({ where: { kind: 'stt_budget' } })).toBe(1);
    },
  );

  it('driver OpenAI: gửi file âm thanh tới Whisper, nhận WebVTT; lỗi thì báo lỗi, không lộ khoá', async () => {
    const dir = path.join(os.tmpdir(), 'ninemua-stt');
    await mkdir(dir, { recursive: true });
    const audio = path.join(dir, 'a.m4a');
    await writeFile(audio, Buffer.from('am thanh'));
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(FAKE_VTT, { status: 200, headers: { 'content-type': 'text/vtt' } });
      }),
    );
    expect(await openAiStt('sk-bi-mat').transcribe(audio)).toBe(FAKE_VTT);
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-bi-mat');
    const body = calls[0]!.init.body as FormData;
    expect(body.get('model')).toBe('whisper-1');
    expect(body.get('response_format')).toBe('vtt');
    expect(body.get('file')).toBeInstanceOf(Blob);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"quota"}', { status: 429 })),
    );
    const err = await openAiStt('sk-bi-mat')
      .transcribe(audio)
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).toContain('429');
    expect(String((err as Error).message)).not.toContain('sk-bi-mat');
    expect(existsSync(audio)).toBe(true);
  });
});
