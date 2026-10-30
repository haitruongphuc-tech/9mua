import { randomBytes } from 'node:crypto';
import { mkdir, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { VideoJob } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { externalStore, imageStore, videoStore } from '@/lib/media/image-store';
import { getSetting } from '@/lib/settings';
import { notifyKey } from '@/lib/notifications';
import { queueCaptions } from './captions';
import { lookFilter } from './look';
import { overlayFilter, parseEditSpec } from './edit-spec';
import { runVideoReadyHooks } from './hooks';
import { initialScore } from './score';
import { createOriginalSound, mixSound } from './sounds';
import { videoLimits } from './limits';
import {
  hlsInitFile,
  hlsLevels,
  listFiles,
  makeCovers,
  makeHls,
  makeMp4Sd,
  makePreview,
  SD_BOX,
} from './renditions';
import {
  composeDuet,
  composeStitch,
  LONG_TRANSCODE_TIMEOUT_MS,
  makePoster,
  MAX_DURATION_SEC,
  MAX_STORY_SEC,
  probe,
  rejectReason,
  ToolError,
  transcode,
} from './transcode';

export const MAX_ATTEMPTS = 3;
// Việc "running" mà không xong sau 15 phút (worker chết giữa chừng) được lấy lại; việc video dài sau 3 giờ 15 phút.
const STALE_LOCK_MS = 15 * 60_000;
const STALE_LONG_LOCK_MS = LONG_TRANSCODE_TIMEOUT_MS + 15 * 60_000;

// Lấy 1 việc bằng FOR UPDATE SKIP LOCKED: nhiều worker chạy song song không bao giờ lấy trùng một video.
// Hàng chờ (SPEC-creator.md V5.1): luôn lấy việc short trước; việc long chỉ khi không còn việc short, mỗi lúc 1 việc.
export async function claimJob(): Promise<VideoJob | null> {
  const staleShort = new Date(now().getTime() - STALE_LOCK_MS);
  const staleLong = new Date(now().getTime() - STALE_LONG_LOCK_MS);
  const rows = await db.$queryRaw<VideoJob[]>`
    UPDATE "VideoJob" SET status = 'running', "lockedAt" = ${now()}, attempts = attempts + 1, "updatedAt" = ${now()}
    WHERE id = (
      SELECT j.id FROM "VideoJob" j
      WHERE (j.status = 'queued'
          OR (j.status = 'running' AND j."lockedAt" < CASE WHEN j.lane = 'long' THEN ${staleLong} ELSE ${staleShort} END))
        AND (j.lane = 'short' OR NOT EXISTS (
          SELECT 1 FROM "VideoJob" r
          WHERE r.lane = 'long' AND r.status = 'running' AND r."lockedAt" >= ${staleLong} AND r.id <> j.id))
      ORDER BY (j.lane = 'long'), j."createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
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
  const long = job.lane === 'long';
  try {
    const source = await probe(job.sourcePath).catch(() => null);
    const story = video.kind === 'story';
    // Video dài (hàng long) theo giới hạn CEO đặt; hàng short giữ ≤ 60 giây, Story ≤ 30 giây.
    const limits = await videoLimits();
    const maxSec = story ? MAX_STORY_SEC : long && limits.long ? limits.maxSec : MAX_DURATION_SEC;
    let reason = source
      ? rejectReason(source, maxSec, limits.long)
      : 'File không phải video MP4, MOV hoặc WebM';
    // Duet / Stitch: cần file video gốc còn trên feed (SPEC-creator.md bổ sung 27/10, V5.5 mục 4).
    const remixOfId = video.duetOfId ?? video.stitchOfId;
    const original = remixOfId
      ? await db.video.findFirst({
          where: { id: remixOfId, status: 'ready', kind: 'video', fileUrl: { endsWith: '.mp4' } },
        })
      : null;
    let originalPath = original?.fileUrl ? imageStore().localPath(original.fileUrl) : null;
    // Video gốc nằm ở kho ngoài (SPEC-creator.md V5.1 mục 9): tải về thư mục làm việc để ghép.
    const ext = externalStore();
    if (!originalPath && original?.fileUrl && ext?.owns(original.fileUrl)) {
      await mkdir(work, { recursive: true });
      const dest = path.join(work, 'original.mp4');
      if (await ext.download(original.fileUrl, dest).catch(() => false)) originalPath = dest;
    }
    if (!reason && video.duetOfId && !originalPath) reason = 'Video gốc để Duet không còn trên 9MUA';
    if (!reason && video.stitchOfId && !originalPath) reason = 'Video gốc để Stitch không còn trên 9MUA';
    if (reason) {
      await fail(job, reason);
      return true;
    }
    await mkdir(work, { recursive: true });
    const outMp4 = path.join(work, 'video.mp4');
    const outPoster = path.join(work, 'poster.jpg');
    // Nhiều mức chất lượng (SPEC-creator.md V5.1, khi bật long_video): video thường, không Story, không Duet.
    // Video dài ra HLS đoạn 6 giây; video ≤ 60 giây ra MP4 720p + 480p. Cả hai có 3 ảnh bìa và ảnh xem trước động.
    const extras = limits.long && !story && !originalPath;
    const hls = extras && long;
    const hlsDir = path.join(work, 'hls');
    // Bộ lọc màu, làm đẹp (SPEC-creator.md V5.5), chữ và nhãn dán, cắt đầu/cuối (V5.6) — không áp cho Duet/Stitch.
    const edit = originalPath ? null : parseEditSpec(video.editSpec ?? undefined);
    const overlay = edit ? await overlayFilter(edit, work) : null;
    const look =
      [originalPath ? null : lookFilter(video.look as never, video.beauty), overlay]
        .filter(Boolean)
        .join(',') || null;
    const trim =
      edit && (edit.trimStart > 0 || edit.trimEnd !== null)
        ? { start: edit.trimStart, len: edit.trimEnd !== null ? edit.trimEnd - edit.trimStart : null }
        : null;
    const levels = hls ? hlsLevels(source!.video!, (await getSetting('video_enable_1080')) === 'true') : [];
    // Nhạc nền (V5.6 mục 2): trộn vào file gốc trước khi chuyển mã, hình chép nguyên (giữ chiều xoay của MOV/MP4).
    let src = job.sourcePath;
    let srcAudio = source!.hasAudio;
    const sound =
      video.soundId && !originalPath ? await db.sound.findUnique({ where: { id: video.soundId } }) : null;
    const soundPath = sound ? imageStore().localPath(sound.path) : null;
    if (soundPath) {
      src = path.join(work, /mov|mp4/.test(source!.formatName) ? 'mixed.mov' : 'mixed.mkv');
      await mixSound(job.sourcePath, soundPath, src, {
        hasAudio: source!.hasAudio,
        durationSec: source!.durationSec,
        soundStartSec: video.soundStartSec ?? 0,
        trimStartSec: trim?.start ?? 0,
        soundVolume: video.soundVolume ?? 100,
        originalVolume: video.originalVolume ?? 100,
      });
      srcAudio = true;
    }
    if (originalPath && video.stitchOfId) {
      const orig = await probe(originalPath);
      await composeStitch(originalPath, job.sourcePath, outMp4, outPoster, {
        fromSec: video.stitchFromSec ?? 0,
        toSec: video.stitchToSec ?? 1,
        newSec: source!.durationSec,
        origAudio: orig.hasAudio,
        newAudio: source!.hasAudio,
        maxSec,
      });
    } else if (originalPath) {
      const orig = await probe(originalPath);
      await composeDuet(job.sourcePath, originalPath, outMp4, outPoster, {
        durationSec: source!.durationSec,
        newAudio: source!.hasAudio,
        origAudio: orig.hasAudio,
      });
    } else if (hls) {
      await makeHls(src, hlsDir, levels, srcAudio, maxSec, LONG_TRANSCODE_TIMEOUT_MS, look, trim);
      await makePoster(src, outPoster, source!.durationSec);
    } else
      await transcode(src, outMp4, outPoster, source!.durationSec, {
        maxSec,
        timeoutMs: long ? LONG_TRANSCODE_TIMEOUT_MS : undefined,
        look,
        trim,
      });
    // HLS: kích thước đo ở file init của mức cao nhất (đã xoay đúng chiều); thời lượng theo file gốc.
    const result = await probe(hls ? await hlsInitFile(path.join(hlsDir, `${levels.at(-1)}p`)) : outMp4);
    const durationSec = hls
      ? Math.min(trim ? (trim.len ?? source!.durationSec - trim.start) : source!.durationSec, maxSec)
      : result.durationSec;
    const playable = hls ? src : outMp4;
    const sdPath = path.join(work, 'video-sd.mp4');
    const sd =
      extras &&
      !hls &&
      !!result.video &&
      (result.video.width > SD_BOX.width || result.video.height > SD_BOX.height);
    if (sd) await makeMp4Sd(outMp4, sdPath);
    const coverFiles = extras ? await makeCovers(playable, work, durationSec) : [];
    const previewPath = path.join(work, 'preview.webp');
    if (extras) await makePreview(playable, previewPath, durationSec);

    const t = now();
    // Nháp / hẹn giờ (SPEC-creator.md V5.3): xử lý xong vẫn chưa lên feed. Hẹn giờ đã qua lúc xử lý xong thì đăng luôn.
    // Đọc lại vì người đăng có thể đổi nháp / giờ hẹn trong lúc chờ xử lý.
    const timing = await db.video.findUniqueOrThrow({
      where: { id: video.id },
      select: { draft: true, publishAt: true, visibility: true, allowRemix: true },
    });
    Object.assign(video, timing);
    // Âm thanh gốc (V5.6 mục 2): tách từ bản đã xử lý (đã cắt); video dài lấy từ file gốc theo đoạn cắt. Lỗi thì bỏ qua.
    await createOriginalSound(
      video,
      hls
        ? {
            path: job.sourcePath,
            hasAudio: source!.hasAudio,
            startSec: trim?.start,
            maxSec: trim?.len ?? undefined,
          }
        : { path: outMp4, hasAudio: result.hasAudio },
    ).catch((e) =>
      console.error(`[worker] âm thanh gốc video ${video.id} lỗi:`, e instanceof Error ? e.message : e),
    );
    const scheduled = !video.draft && video.publishAt && video.publishAt > t;
    const finalStatus = video.draft ? 'draft' : scheduled ? 'scheduled' : 'ready';
    const key = `videos/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${video.id}-${randomBytes(6).toString('hex')}`;
    // Mọi file của video này ghi cùng một nơi (kho ngoài khi bật external_storage, còn lại trên VPS).
    const store = await videoStore();
    const renditions: { kind: 'mp4' | 'hls'; height: number; path: string; bytes: bigint }[] = [];
    let fileUrl: string;
    if (hls) {
      const files = await listFiles(hlsDir);
      const urls = new Map<string, string>();
      for (const f of files)
        urls.set(f.rel, await store.saveFile(`${key}-hls/${f.rel}`, path.join(hlsDir, f.rel)));
      fileUrl = urls.get('master.m3u8')!;
      for (const h of levels)
        renditions.push({
          kind: 'hls',
          height: h,
          path: urls.get(`${h}p/index.m3u8`)!,
          bytes: BigInt(files.filter((f) => f.rel.startsWith(`${h}p/`)).reduce((sum, f) => sum + f.bytes, 0)),
        });
    } else {
      const bytes = BigInt((await stat(outMp4)).size);
      fileUrl = await store.saveFile(`${key}.mp4`, outMp4);
      if (extras) renditions.push({ kind: 'mp4', height: 720, path: fileUrl, bytes });
      if (sd) {
        const sdBytes = BigInt((await stat(sdPath)).size);
        renditions.push({
          kind: 'mp4',
          height: 480,
          path: await store.saveFile(`${key}-480.mp4`, sdPath),
          bytes: sdBytes,
        });
      }
    }
    const posterUrl = await store.saveFile(`${key}.jpg`, outPoster);
    const posterChoices: string[] = [];
    for (const [i, file] of coverFiles.entries())
      posterChoices.push(await store.saveFile(`${key}-c${i + 1}.jpg`, file));
    const previewUrl = extras ? await store.saveFile(`${key}-p.webp`, previewPath) : null;
    await db.$transaction([
      db.video.update({
        where: { id: video.id },
        data: {
          status: finalStatus,
          fileUrl,
          posterUrl,
          posterChoices,
          previewUrl,
          durationSec,
          width: result.video?.width,
          height: result.video?.height,
          readyAt: finalStatus === 'ready' ? t : null,
          score: initialScore(),
          // Story tự ẩn sau 24 giờ kể từ lúc lên.
          expiresAt: story ? new Date(t.getTime() + 24 * 3_600_000) : null,
        },
      }),
      db.videoRendition.createMany({ data: renditions.map((r) => ({ videoId: video.id, ...r })) }),
      db.videoJob.update({ where: { id: job.id }, data: { status: 'done', error: null } }),
    ]);
    // Phụ đề tự động (SPEC-creator.md V5.4): tách tiếng từ file gốc trước khi xoá; lỗi ở đây không làm hỏng video.
    await queueCaptions(video, {
      path: job.sourcePath,
      hasAudio: source!.hasAudio,
      durationSec,
    }).catch((e) =>
      console.error(`[worker] phụ đề video ${video.id} lỗi:`, e instanceof Error ? e.message : e),
    );
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
    if (long && e instanceof ToolError && message.includes('chạy quá'))
      await fail(job, 'Video dài xử lý quá 3 giờ, hãy cắt ngắn rồi đăng lại');
    else if (job.attempts >= MAX_ATTEMPTS)
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
