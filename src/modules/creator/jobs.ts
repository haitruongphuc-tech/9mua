import { randomBytes } from 'node:crypto';
import { mkdir, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { VideoJob } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { imageStore } from '@/lib/media/image-store';
import { notify } from '@/lib/notifications';
import { initialScore } from './score';
import { probe, rejectReason, transcode } from './transcode';

export const MAX_ATTEMPTS = 3;
// Việc "running" mà không xong sau 15 phút (worker chết giữa chừng) được lấy lại.
const STALE_LOCK_MS = 15 * 60_000;

// Lấy 1 việc bằng FOR UPDATE SKIP LOCKED: nhiều worker chạy song song không bao giờ lấy trùng một video.
export async function claimJob(): Promise<VideoJob | null> {
  const staleBefore = new Date(now().getTime() - STALE_LOCK_MS);
  const rows = await db.$queryRaw<VideoJob[]>`
    UPDATE "VideoJob" SET status = 'running', "lockedAt" = ${now()}, attempts = attempts + 1, "updatedAt" = ${now()}
    WHERE id = (
      SELECT id FROM "VideoJob"
      WHERE status = 'queued' OR (status = 'running' AND "lockedAt" < ${staleBefore})
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

async function fail(job: VideoJob, reason: string) {
  await db.$transaction([
    db.videoJob.update({ where: { id: job.id }, data: { status: 'failed', error: reason } }),
    db.video.updateMany({
      where: { id: job.videoId, status: 'processing' },
      data: { status: 'failed', failReason: reason },
    }),
  ]);
  await unlink(job.sourcePath).catch(() => {});
  const video = await db.video.findUnique({ where: { id: job.videoId } });
  if (video) await notify(video.authorId, 'Video không đăng được', reason, '/video/cua-toi');
}

// Xử lý 1 việc trong hàng đợi. Trả về false nếu không còn việc.
export async function processNextJob(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;
  const video = await db.video.findUnique({ where: { id: job.videoId } });
  if (!video || video.status !== 'processing') {
    // Người đăng đã xoá video trong lúc chờ.
    await db.videoJob.update({ where: { id: job.id }, data: { status: 'done' } });
    await unlink(job.sourcePath).catch(() => {});
    return true;
  }

  const work = path.join(env().PRIVATE_DIR, 'video-work', job.id);
  try {
    const source = await probe(job.sourcePath).catch(() => null);
    const reason = source ? rejectReason(source) : 'File không phải video MP4, MOV hoặc WebM';
    if (reason) {
      await fail(job, reason);
      return true;
    }
    await mkdir(work, { recursive: true });
    const outMp4 = path.join(work, 'video.mp4');
    const outPoster = path.join(work, 'poster.jpg');
    await transcode(job.sourcePath, outMp4, outPoster, source!.durationSec);
    const result = await probe(outMp4);

    const t = now();
    const key = `videos/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${video.id}-${randomBytes(6).toString('hex')}`;
    const store = imageStore();
    const fileUrl = await store.saveFile(`${key}.mp4`, outMp4);
    const posterUrl = await store.saveFile(`${key}.jpg`, outPoster);
    await db.$transaction([
      db.video.update({
        where: { id: video.id },
        data: {
          status: 'ready',
          fileUrl,
          posterUrl,
          durationSec: result.durationSec,
          width: result.video?.width,
          height: result.video?.height,
          readyAt: t,
          score: initialScore(),
        },
      }),
      db.videoJob.update({ where: { id: job.id }, data: { status: 'done', error: null } }),
    ]);
    await unlink(job.sourcePath).catch(() => {});
    await notify(
      video.authorId,
      'Video đã đăng xong',
      video.caption.slice(0, 80) || 'Video của bạn đã lên feed.',
      `/video?v=${video.id}`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[worker] video ${video.id} lỗi (lần ${job.attempts}):`, message);
    if (job.attempts >= MAX_ATTEMPTS)
      await fail(job, 'Không xử lý được video, hãy thử quay lại hoặc chọn file khác');
    else
      await db.videoJob.update({
        where: { id: job.id },
        data: { status: 'queued', error: message.slice(0, 1000) },
      });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return true;
}
