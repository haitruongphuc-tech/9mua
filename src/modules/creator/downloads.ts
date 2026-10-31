import { randomBytes } from 'node:crypto';
import { privateUserIds } from '@/lib/private-accounts';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { VideoDownload } from '@prisma/client';
import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { externalStore, imageStore } from '@/lib/media/image-store';
import { runTool } from '@/lib/media/run-tool';
import { FONT_FILE } from './edit-spec';

// Tải về (SPEC-creator.md V5.7 mục 1): video công khai cho phép tải, dài ≤ 10 phút. Lần tải đầu tạo bản MP4 720p có logo
// 9MUA và @tên ở góc dưới (việc nền), giữ 7 ngày. Mỗi người tối đa 20 lượt tải mỗi ngày.
export const MAX_DOWNLOAD_SEC = 600;
export const DOWNLOADS_PER_DAY = 20;
export const DOWNLOAD_KEEP_DAYS = 7;
const MAX_ATTEMPTS = 3;
const STEP_TIMEOUT_MS = 20 * 60_000;
const STALE_MS = 30 * 60_000;
const LOGO_FILE = path.resolve(process.cwd(), 'public/brand/9mua-logo.png');

export type DownloadResult =
  | { ok: true; url: string }
  | { ok: true; pending: true }
  | { ok: false; error: 'NOT_FOUND' | 'DAILY_LIMIT' | 'FAILED' };

async function downloadable(videoId: string) {
  const v = await db.video.findFirst({
    where: {
      id: videoId,
      status: 'ready',
      kind: 'video',
      visibility: 'public',
      authorId: { notIn: await privateUserIds() },
      allowDownload: true,
      fileUrl: { not: null },
      durationSec: { lte: MAX_DOWNLOAD_SEC + 0.5 },
    },
    select: { id: true, authorId: true, fileUrl: true },
  });
  if (!v) return null;
  const author = await db.user.findUnique({
    where: { id: v.authorId },
    select: { lockedAt: true, handle: true, displayName: true },
  });
  return author && !author.lockedAt ? { ...v, author } : null;
}

export async function requestDownload(userId: string, videoId: string): Promise<DownloadResult> {
  const video = await downloadable(videoId);
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  const t = now();
  const existing = await db.videoDownload.findUnique({ where: { videoId } });
  if (existing?.status === 'ready' && existing.path && existing.expiresAt && existing.expiresAt > t) {
    // Giới hạn 20 lượt mỗi ngày tính lúc nhận được file (lúc chờ tạo bản tải thì không tính).
    const used = await db.videoDownloadLog.count({ where: { userId, createdAt: { gte: startOfVnDay() } } });
    if (used >= DOWNLOADS_PER_DAY) return { ok: false, error: 'DAILY_LIMIT' };
    await db.videoDownloadLog.create({ data: { userId, videoId, createdAt: t } });
    return { ok: true, url: existing.path };
  }
  if (existing && ['queued', 'processing'].includes(existing.status)) return { ok: true, pending: true };
  if (existing?.status === 'failed' && existing.attempts >= MAX_ATTEMPTS)
    return { ok: false, error: 'FAILED' };
  await db.videoDownload.upsert({
    where: { videoId },
    create: { videoId, status: 'queued', createdAt: t },
    update: {
      status: 'queued',
      path: null,
      attempts: 0,
      error: null,
      readyAt: null,
      expiresAt: null,
      createdAt: t,
    },
  });
  return { ok: true, pending: true };
}

async function claim(): Promise<VideoDownload | null> {
  const stale = new Date(now().getTime() - STALE_MS);
  const rows = await db.$queryRaw<VideoDownload[]>`
    UPDATE "VideoDownload" SET status = 'processing', attempts = attempts + 1, "lockedAt" = ${now()}
    WHERE id = (
      SELECT id FROM "VideoDownload"
      WHERE status = 'queued' OR (status = 'processing' AND "lockedAt" < ${stale})
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

// Nguồn để vẽ logo: file trên VPS, hoặc link công khai ở kho ngoài (ffmpeg đọc thẳng qua HTTPS).
function inputOf(fileUrl: string): string | null {
  const local = imageStore().localPath(fileUrl);
  if (local) return local;
  return externalStore()?.owns(fileUrl) ? fileUrl : null;
}

// Worker: tạo 1 bản tải về đang chờ. Trả về false khi không có việc.
export async function processNextDownload(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;
  const video = await downloadable(job.videoId);
  const input = video?.fileUrl ? inputOf(video.fileUrl) : null;
  if (!video || !input) {
    await db.videoDownload.update({
      where: { id: job.id },
      data: { status: 'failed', attempts: MAX_ATTEMPTS },
    });
    return true;
  }
  const work = path.join(env().PRIVATE_DIR, 'download-work', job.id);
  await mkdir(work, { recursive: true });
  try {
    const out = path.join(work, 'download.mp4');
    const name = path.join(work, 'name.txt');
    await writeFile(name, `@${video.author.handle ?? video.author.displayName}`, 'utf8');
    // Tối đa 720p (không phóng to bản nhỏ hơn), giữ tỉ lệ; logo rộng 1/5 khung ở góc dưới trái, @tên ngay dưới logo. Chữ đọc từ file (expansion=none).
    const filter = [
      `[0:v]scale=w='trunc(min(iw,if(gt(iw,ih),1280,720))/2)*2':h=-2,setsar=1[base]`,
      `[1:v][base]scale2ref=w='trunc(main_w/10)*2':h='trunc(ow/mdar/2)*2'[logo][bg]`,
      `[bg][logo]overlay=x='main_w*0.04':y='main_h-overlay_h-main_h*0.08'[marked]`,
      `[marked]drawtext=fontfile=${FONT_FILE}:textfile=${name}:expansion=none:fontsize=h/40:fontcolor=white:borderw=2:bordercolor=black@0.6:x=w*0.04:y=h-h*0.07,format=yuv420p[v]`,
    ].join(';');
    await runTool(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        // Video dài (HLS fMP4) trên VPS: cho ffmpeg đọc đoạn .m4s cạnh playlist.
        ...(input.endsWith('.m3u8') && !input.startsWith('http') ? ['-allowed_extensions', 'ALL'] : []),
        '-i',
        input,
        '-i',
        LOGO_FILE,
        '-filter_complex',
        filter,
        '-map',
        '[v]',
        '-map',
        '0:a?',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-t',
        String(MAX_DOWNLOAD_SEC + 1),
        out,
      ],
      STEP_TIMEOUT_MS,
    );
    const t = now();
    const url = await imageStore().saveFile(
      `downloads/${video.id}-${randomBytes(6).toString('hex')}.mp4`,
      out,
    );
    await db.videoDownload.update({
      where: { id: job.id },
      data: {
        status: 'ready',
        path: url,
        readyAt: t,
        expiresAt: new Date(t.getTime() + DOWNLOAD_KEEP_DAYS * 86_400_000),
        error: null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[worker] bản tải về video ${job.videoId} lỗi (lần ${job.attempts}):`, message);
    await db.videoDownload.update({
      where: { id: job.id },
      data: { status: job.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', error: message.slice(0, 1000) },
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return true;
}

// Việc hằng ngày: bản tải về quá 7 ngày thì xoá file (lần tải sau tạo lại).
export async function expireDownloads(): Promise<number> {
  const due = await db.videoDownload.findMany({
    where: { status: 'ready', expiresAt: { lt: now() } },
    select: { id: true, path: true },
    take: 500,
  });
  for (const d of due) {
    if (d.path)
      await imageStore()
        .remove(d.path)
        .catch(() => {});
    await db.videoDownload.update({ where: { id: d.id }, data: { status: 'expired', path: null } });
  }
  return due.length;
}
