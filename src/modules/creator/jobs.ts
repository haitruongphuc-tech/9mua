import { randomBytes } from 'node:crypto';
import { mkdir, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { VideoJob } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { imageStore } from '@/lib/media/image-store';
import { notifyKey } from '@/lib/notifications';
import { runVideoReadyHooks } from './hooks';
import { initialScore } from './score';
import { composeDuet, MAX_DURATION_SEC, MAX_STORY_SEC, probe, rejectReason, transcode } from './transcode';

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
  if (video) await notifyKey(video.authorId, 'notify.videoFailed', { detail: reason }, '/video/cua-toi');
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
    const story = video.kind === 'story';
    let reason = source
      ? rejectReason(source, story ? MAX_STORY_SEC : MAX_DURATION_SEC)
      : 'File không phải video MP4, MOV hoặc WebM';
    // Duet: cần file video gốc còn trên feed (SPEC-creator.md bổ sung 27/10).
    const original = video.duetOfId
      ? await db.video.findFirst({ where: { id: video.duetOfId, status: 'ready', kind: 'video' } })
      : null;
    const originalPath = original?.fileUrl ? imageStore().localPath(original.fileUrl) : null;
    if (!reason && video.duetOfId && !originalPath) reason = 'Video gốc để Duet không còn trên 9MUA';
    if (reason) {
      await fail(job, reason);
      return true;
    }
    await mkdir(work, { recursive: true });
    const outMp4 = path.join(work, 'video.mp4');
    const outPoster = path.join(work, 'poster.jpg');
    if (originalPath) {
      const orig = await probe(originalPath);
      await composeDuet(job.sourcePath, originalPath, outMp4, outPoster, {
        durationSec: source!.durationSec,
        newAudio: source!.hasAudio,
        origAudio: orig.hasAudio,
      });
    } else await transcode(job.sourcePath, outMp4, outPoster, source!.durationSec);
    const result = await probe(outMp4);

    const t = now();
    // Nháp / hẹn giờ (SPEC-creator.md V5.3): xử lý xong vẫn chưa lên feed. Hẹn giờ đã qua lúc xử lý xong thì đăng luôn.
    // Đọc lại vì người đăng có thể đổi nháp / giờ hẹn trong lúc chờ xử lý.
    const timing = await db.video.findUniqueOrThrow({
      where: { id: video.id },
      select: { draft: true, publishAt: true },
    });
    Object.assign(video, timing);
    const scheduled = !video.draft && video.publishAt && video.publishAt > t;
    const finalStatus = video.draft ? 'draft' : scheduled ? 'scheduled' : 'ready';
    const key = `videos/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${video.id}-${randomBytes(6).toString('hex')}`;
    const store = imageStore();
    const fileUrl = await store.saveFile(`${key}.mp4`, outMp4);
    const posterUrl = await store.saveFile(`${key}.jpg`, outPoster);
    await db.$transaction([
      db.video.update({
        where: { id: video.id },
        data: {
          status: finalStatus,
          fileUrl,
          posterUrl,
          durationSec: result.durationSec,
          width: result.video?.width,
          height: result.video?.height,
          readyAt: finalStatus === 'ready' ? t : null,
          score: initialScore(),
          // Story tự ẩn sau 24 giờ kể từ lúc lên.
          expiresAt: story ? new Date(t.getTime() + 24 * 3_600_000) : null,
        },
      }),
      db.videoJob.update({ where: { id: job.id }, data: { status: 'done', error: null } }),
    ]);
    await unlink(job.sourcePath).catch(() => {});
    if (finalStatus !== 'ready') {
      await notifyKey(
        video.authorId,
        video.draft ? 'notify.videoDraftReady' : 'notify.videoScheduled',
        { detail: video.caption.slice(0, 80) },
        video.draft ? '/video/cua-toi?tab=nhap' : '/video/cua-toi',
      );
      return true;
    }
    await notifyKey(
      video.authorId,
      'notify.videoReady',
      { detail: video.caption.slice(0, 80) },
      `/video?v=${video.id}`,
    );
    await runVideoReadyHooks({
      id: video.id,
      authorId: video.authorId,
      caption: video.caption,
      kind: video.kind,
    });
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
