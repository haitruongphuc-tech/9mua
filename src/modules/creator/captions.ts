import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { alertCeo } from '@/lib/alerts';
import { now, startOfVnMonth } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { formatVnd } from '@/lib/format';
import { runTool } from '@/lib/media/run-tool';
import { notifyKey } from '@/lib/notifications';
import { getIntSetting } from '@/lib/settings';
import { canViewVideo } from './visibility';

// Phụ đề tự động (SPEC-creator.md V5.4, công tắc auto_captions). Máy chủ tách tiếng ra file âm thanh nhỏ, gửi dịch vụ nghe
// giọng nói (đề xuất OpenAI Whisper), nhận WebVTT. Người đăng xem, sửa chữ rồi mới bật cho người xem.
export const MAX_CAPTION_SECONDS = 600; // chỉ video ≤ 10 phút
export const STT_USD_PER_MINUTE = 0.006; // giá Whisper tham khảo — CEO kiểm lại trên trang giá OpenAI khi mở tài khoản
export const FAKE_VTT = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nPhụ đề mẫu 9MUA\n';
const MAX_VTT_CHARS = 100_000;

export type SttDriver = { name: string; transcribe(audioPath: string): Promise<string> };

// Khoá chỉ dùng ở máy chủ; thông báo lỗi chỉ có mã HTTP, không bao giờ chứa khoá.
export function openAiStt(apiKey: string): SttDriver {
  return {
    name: 'openai',
    async transcribe(audioPath) {
      const form = new FormData();
      form.set('file', new Blob([await readFile(audioPath)], { type: 'audio/mp4' }), 'audio.m4a');
      form.set('model', 'whisper-1');
      form.set('response_format', 'vtt');
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(5 * 60_000),
      });
      if (!res.ok) throw new Error(`Whisper trả lỗi ${res.status}`);
      return res.text();
    },
  };
}

const fakeStt: SttDriver = { name: 'fake', transcribe: async () => FAKE_VTT };

export function sttDriver(): SttDriver | null {
  const e = env();
  if (e.STT_PROVIDER === 'fake' || (!e.STT_PROVIDER && e.TEST_MODE === 'e2e')) return fakeStt;
  return e.OPENAI_API_KEY ? openAiStt(e.OPENAI_API_KEY) : null;
}

const audioPath = (videoId: string) => path.join(env().PRIVATE_DIR, 'caption-audio', `${videoId}.m4a`);

// Gọi từ worker khi video xử lý xong (file gốc còn trên đĩa): tách tiếng mono 16 kHz, 32 kbps (10 phút ≈ 2,4MB).
export async function queueCaptions(
  video: { id: string; authorId: string; wantCaptions: boolean; kind: string },
  source: { path: string; hasAudio: boolean; durationSec: number },
): Promise<void> {
  if (!video.wantCaptions || video.kind !== 'video' || !(await isFeatureOn('auto_captions'))) return;
  const skip = async (reason: 'TOO_LONG' | 'NO_AUDIO') => {
    await db.videoCaption.create({ data: { videoId: video.id, status: 'skipped', reason } });
    await notifyKey(video.authorId, 'notify.captionsSkipped', {}, `/video/cua-toi/${video.id}/phu-de`);
  };
  if (source.durationSec > MAX_CAPTION_SECONDS + 0.5) return skip('TOO_LONG');
  if (!source.hasAudio) return skip('NO_AUDIO');
  const out = audioPath(video.id);
  await mkdir(path.dirname(out), { recursive: true });
  await runTool(
    'ffmpeg',
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      source.path,
      '-map',
      '0:a:0',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'aac',
      '-b:a',
      '32k',
      '-t',
      String(MAX_CAPTION_SECONDS + 1),
      '-map_metadata',
      '-1',
      '-f',
      'mp4',
      out,
    ],
    2 * 60_000,
  );
  await db.videoCaption.create({ data: { videoId: video.id, status: 'pending' } });
}

export async function sttUsedThisMonthVnd(): Promise<number> {
  const r = await db.sttUsage.aggregate({
    _sum: { costVnd: true },
    where: { createdAt: { gte: startOfVnMonth() } },
  });
  return r._sum.costVnd ?? 0;
}

const isVtt = (text: string) => /^WEBVTT[ \t\r\n]/.test(`${text.replace(/^﻿/, '').trimStart()}\n`);

// Worker: lấy 1 phụ đề đang chờ (SKIP LOCKED: nhiều worker không lấy trùng). Trả false khi không còn việc.
export async function processNextCaption(): Promise<boolean> {
  const rows = await db.$queryRaw<{ videoId: string }[]>`
    UPDATE "VideoCaption" SET status = 'running', "updatedAt" = ${now()}
    WHERE "videoId" = (
      SELECT "videoId" FROM "VideoCaption" WHERE status = 'pending'
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING "videoId"`;
  const videoId = rows[0]?.videoId;
  if (!videoId) return false;
  const audio = audioPath(videoId);
  const done = async (data: { status: string; reason?: string; vtt?: string }) => {
    await db.videoCaption.update({ where: { videoId }, data });
    await unlink(audio).catch(() => {});
  };
  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video || video.status === 'deleted') {
    await done({ status: 'failed', reason: 'DELETED' });
    return true;
  }
  const link = `/video/cua-toi/${videoId}/phu-de`;
  const seconds = video.durationSec ?? 0;
  if (seconds > MAX_CAPTION_SECONDS + 0.5) {
    await done({ status: 'skipped', reason: 'TOO_LONG' });
    await notifyKey(video.authorId, 'notify.captionsSkipped', {}, link);
    return true;
  }
  const driver = sttDriver();
  if (!driver) {
    await done({ status: 'failed', reason: 'NO_KEY' });
    return true;
  }
  const [rate, budget, used] = await Promise.all([
    getIntSetting('usd_vnd_rate'),
    getIntSetting('stt_monthly_budget_vnd'),
    sttUsedThisMonthVnd(),
  ]);
  const costVnd = Math.ceil((Math.max(seconds, 1) / 60) * STT_USD_PER_MINUTE * rate);
  if (used + costVnd > budget) {
    await done({ status: 'skipped', reason: 'BUDGET' });
    await notifyKey(video.authorId, 'notify.captionsSkipped', {}, link);
    await alertCeo(
      'stt_budget',
      `Phụ đề tự động đã dùng ${formatVnd(used)} / ngân sách ${formatVnd(budget)} tháng này nên video mới không được ` +
        'tạo phụ đề. Muốn tiếp tục thì tăng ngân sách ở /admin/cai-dat.',
    );
    return true;
  }
  const usage = { videoId, userId: video.authorId, provider: driver.name, seconds, costVnd };
  try {
    const vtt = await driver.transcribe(audio);
    if (!isVtt(vtt) || vtt.length > MAX_VTT_CHARS)
      throw new Error('Dịch vụ trả phụ đề không đúng dạng WebVTT');
    await db.sttUsage.create({ data: { ...usage, ok: true, createdAt: now() } });
    await done({ status: 'ready', vtt });
    await notifyKey(video.authorId, 'notify.captionsReady', { detail: video.caption.slice(0, 80) }, link);
  } catch (e) {
    // Lần lỗi cũng có thể đã tốn tiền nên vẫn ghi sổ.
    await db.sttUsage.create({ data: { ...usage, ok: false, createdAt: now() } });
    await done({ status: 'failed', reason: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
  }
  return true;
}

export type CaptionsForEdit = {
  videoId: string;
  caption: string;
  status: string;
  reason: string | null;
  vtt: string | null;
  published: boolean;
};

export async function captionsForEdit(userId: string, videoId: string): Promise<CaptionsForEdit | null> {
  const v = await db.video.findFirst({
    where: { id: videoId, authorId: userId, status: { not: 'deleted' } },
    include: { captions: true },
  });
  if (!v?.captions) return null;
  const { status, reason, vtt, published } = v.captions;
  return { videoId: v.id, caption: v.caption, status, reason, vtt, published };
}

// Người đăng sửa chữ phụ đề và bật / tắt cho người xem.
export async function saveCaptions(
  userId: string,
  videoId: string,
  input: { vtt: string; published: boolean },
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'INVALID' }> {
  const v = await db.video.findFirst({
    where: { id: videoId, authorId: userId, status: { not: 'deleted' } },
    include: { captions: true },
  });
  if (!v?.captions || v.captions.status !== 'ready') return { ok: false, error: 'NOT_FOUND' };
  const vtt = input.vtt.replace(/\r\n/g, '\n').trim();
  if (!isVtt(vtt) || vtt.length > MAX_VTT_CHARS) return { ok: false, error: 'INVALID' };
  await db.videoCaption.update({ where: { videoId }, data: { vtt: `${vtt}\n`, published: input.published } });
  return { ok: true };
}

// Route /api/video/<id>/phu-de: chỉ khi người xem được xem video và phụ đề đã bật.
export async function captionsForViewer(videoId: string, viewerId?: string | null): Promise<string | null> {
  const row = await db.videoCaption.findUnique({ where: { videoId } });
  if (!row || row.status !== 'ready' || !row.published || !row.vtt) return null;
  return (await canViewVideo(videoId, viewerId)) ? row.vtt : null;
}
