import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { resolveUploadPath } from '@/lib/media/image-store';
import { getProductForCheckout } from '@/modules/kiot';
import { extractHashtags } from './hashtags';
import { isVisibility } from './visibility';
import { hasCurrentCommitment } from '@/modules/identity';
import { MAX_DRAFTS, normalizePlace, scheduleOk, type PostOptions } from './posting';
import { checkLongVideo, SHORT_MAX_SEC, videoLimits } from './limits';
import { probe } from './transcode';
import { isLook, MAX_BEAUTY } from './look';
import { isEmptyEdit, parseEditSpec } from './edit-spec';
import { selectableSound } from './sounds';

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEOS_PER_DAY = 10;
export const MAX_PRODUCTS_PER_VIDEO = 3;
export const MAX_CAPTION = 300;

const UPLOAD_ID = /^[a-f0-9]{32}$/;

// File gốc nằm trong PRIVATE_DIR (Nginx không phục vụ): không bao giờ phát video gốc chưa qua xử lý.
function uploadPath(userId: string, uploadId: string): string | null {
  if (!UPLOAD_ID.test(uploadId) || !/^[\w-]+$/.test(userId)) return null;
  return resolveUploadPath(env().PRIVATE_DIR, ['video-uploads', userId, `${uploadId}.bin`]);
}

export async function videosToday(userId: string, kind: 'video' | 'story' = 'video'): Promise<number> {
  return db.video.count({ where: { authorId: userId, kind, createdAt: { gte: startOfVnDay() } } });
}

export class UploadTooLarge extends Error {}

// Chỗ ghi file tải lên mới (dùng chung cho tải một lần và ghép từ nhiều phần).
export async function newUploadTarget(userId: string): Promise<{ uploadId: string; target: string }> {
  const uploadId = randomBytes(16).toString('hex');
  const target = uploadPath(userId, uploadId)!;
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  return { uploadId, target };
}

// Ghi luồng tải lên xuống đĩa, cắt ngay khi vượt 100MB (không giữ cả file trong RAM).
export async function saveUpload(
  userId: string,
  body: Readable,
): Promise<{ ok: true; uploadId: string; size: number } | { ok: false; error: 'TOO_LARGE' | 'DAILY_LIMIT' }> {
  // Bước tải lên chưa biết là video hay Story: chỉ chặn khi cả hai loại đều đã đủ 10 trong ngày.
  const [videos, stories] = await Promise.all([videosToday(userId), videosToday(userId, 'story')]);
  if (videos >= MAX_VIDEOS_PER_DAY && stories >= MAX_VIDEOS_PER_DAY)
    return { ok: false, error: 'DAILY_LIMIT' };
  const { uploadId, target } = await newUploadTarget(userId);
  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      if (size > MAX_VIDEO_BYTES) return done(new UploadTooLarge());
      done(null, chunk);
    },
  });
  try {
    await pipeline(body, limiter, createWriteStream(target, { flags: 'wx', mode: 0o640 }));
  } catch (e) {
    await unlink(target).catch(() => {});
    if (e instanceof UploadTooLarge) return { ok: false, error: 'TOO_LARGE' };
    throw e;
  }
  return { ok: true, uploadId, size };
}

// Nhận dạng nhanh bằng chữ ký đầu file (MP4/MOV có "ftyp", WebM/MKV có EBML, AVI có "RIFF…AVI " khi bật video dài).
// ffprobe kiểm kỹ ở worker.
export async function looksLikeVideo(file: string, avi = false): Promise<boolean> {
  const fh = await open(file, 'r');
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await fh.read(head, 0, 12, 0);
    if (bytesRead < 12) return false;
    const box = head.subarray(4, 8).toString('latin1');
    if (
      avi &&
      head.subarray(0, 4).toString('latin1') === 'RIFF' &&
      head.subarray(8, 12).toString('latin1') === 'AVI '
    )
      return true;
    return ['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(box) || head.readUInt32BE(0) === 0x1a45dfa3;
  } finally {
    await fh.close();
  }
}

export type CreateVideoResult =
  | { ok: true; videoId: string }
  | {
      ok: false;
      error:
        | 'NOT_FOUND'
        | 'TOO_LARGE'
        | 'DAILY_LIMIT'
        | 'BAD_FORMAT'
        | 'PRODUCT_INVALID'
        | 'CAPTION_TOO_LONG'
        | 'DUET_INVALID'
        | 'COMMITMENT_REQUIRED'
        | 'SCHEDULE_INVALID'
        | 'PLACE_INVALID'
        | 'DRAFT_LIMIT'
        | 'TOO_LONG'
        | 'ACCOUNT_TOO_NEW'
        | 'LONG_DAILY_LIMIT'
        | 'STITCH_INVALID'
        | 'EDIT_INVALID'
        | 'SOUND_INVALID';
    };

// Tạo video từ file đã tải lên (SPEC-creator.md mục 1). Video ở trạng thái processing cho tới khi worker xong.
export async function createVideoUpload(
  userId: string,
  uploadId: string,
  meta: {
    caption: string;
    productIds: string[];
    kind?: 'video' | 'story';
    duetOfId?: string | null;
    stitch?: { ofId: string; fromSec: number; toSec: number } | null; // Stitch (SPEC-creator.md V5.5 mục 4)
    // Quyền riêng tư, cho bình luận/Duet/tải về, nháp, hẹn giờ, địa điểm, nhãn AI (SPEC-creator.md V5.3).
    options?: PostOptions;
    aiStudio?: boolean; // video làm từ AI Studio: luôn có nhãn AI, không gỡ được
  },
): Promise<CreateVideoResult> {
  // Phải đồng ý cam kết nội dung bản mới nhất (SPEC-identity.md V5.6).
  if (!(await hasCurrentCommitment(userId))) return { ok: false, error: 'COMMITMENT_REQUIRED' };
  const kind = meta.kind === 'story' ? 'story' : 'video';
  // Duet chỉ với video thường đang trên feed (không Duet Story, không Duet chính Story).
  const duetOfId = kind === 'video' && meta.duetOfId ? meta.duetOfId : null;
  const stitch = kind === 'video' && !duetOfId && meta.stitch ? meta.stitch : null;
  const file = uploadPath(userId, uploadId);
  const info = file ? await stat(file).catch(() => null) : null;
  if (!file || !info) return { ok: false, error: 'NOT_FOUND' };
  const discard = async <T>(result: T) => {
    await unlink(file).catch(() => {});
    return result;
  };
  // Giới hạn theo công tắc long_video (SPEC-creator.md V5.1): tắt thì như cũ 100MB, 60 giây.
  const limits = await videoLimits();
  if (info.size > limits.maxBytes) return discard({ ok: false as const, error: 'TOO_LARGE' as const });
  if (!(await looksLikeVideo(file, limits.long)))
    return discard({ ok: false as const, error: 'BAD_FORMAT' as const });
  // Video dài: đo thời lượng thật bằng ffprobe (không tin số trình duyệt gửi), xếp vào hàng long.
  let sourceSec: number | null = null;
  if (limits.long && kind === 'video' && !duetOfId && !stitch) {
    sourceSec = (await probe(file).catch(() => null))?.durationSec ?? null;
    const longError = sourceSec !== null ? await checkLongVideo(userId, sourceSec, limits) : null;
    if (longError) return discard({ ok: false as const, error: longError });
  }
  const lane = sourceSec !== null && sourceSec > SHORT_MAX_SEC + 0.5 ? 'long' : 'short';
  const caption = meta.caption.trim();
  if (caption.length > MAX_CAPTION) return { ok: false, error: 'CAPTION_TOO_LONG' };
  // Nháp và hẹn giờ chỉ cho video thường (Story tự hết hạn sau 24 giờ).
  const draft = kind === 'video' && meta.options?.draft === true;
  const publishAt = kind === 'video' && !draft && meta.options?.publishAt ? meta.options.publishAt : null;
  if (publishAt && !scheduleOk(publishAt)) return { ok: false, error: 'SCHEDULE_INVALID' };
  const place = normalizePlace({ province: meta.options?.province, placeName: meta.options?.placeName });
  if (!place) return { ok: false, error: 'PLACE_INVALID' };
  // Chỉnh video: chỉ video thường; giá trị lạ thì từ chối cả lần đăng (không âm thầm bỏ qua).
  const editSpec = kind === 'video' ? parseEditSpec(meta.options?.editSpec) : parseEditSpec(undefined);
  if (!editSpec) return { ok: false, error: 'EDIT_INVALID' };
  // Nhạc nền: âm thanh còn chọn được, giây bắt đầu nằm trong âm thanh, âm lượng 0–100. Không áp cho Story, Duet, Stitch.
  const soundIn = kind === 'video' && !duetOfId && !stitch ? meta.options?.sound : null;
  let sound: { id: string; startSec: number; volume: number; originalVolume: number } | null = null;
  if (soundIn) {
    const found = await selectableSound(String(soundIn.id));
    const startSec = Number(soundIn.startSec);
    const level = (x: unknown) =>
      Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 100 ? Number(x) : null;
    const volume = level(soundIn.volume);
    const originalVolume = level(soundIn.originalVolume);
    if (
      !found ||
      !(startSec >= 0) ||
      startSec > Math.max(0, found.durationSec - 1) ||
      volume === null ||
      originalVolume === null
    )
      return { ok: false, error: 'SOUND_INVALID' };
    sound = { id: found.id, startSec, volume, originalVolume };
  }

  // Duet chỉ với video công khai còn cho phép Duet/Stitch (SPEC-creator.md V5.3).
  if (
    duetOfId &&
    !(await db.video.count({
      // Video dài (HLS) không Duet được: Duet ghép trên file MP4 ≤ 60 giây.
      where: {
        id: duetOfId,
        status: 'ready',
        kind: 'video',
        visibility: 'public',
        allowRemix: true,
        fileUrl: { endsWith: '.mp4' },
      },
    }))
  )
    return { ok: false, error: 'DUET_INVALID' };

  // Stitch: video gốc công khai, còn cho Duet/Stitch, là MP4; đoạn lấy dài 1–5 giây và nằm trong video gốc.
  if (stitch) {
    const from = Number(stitch.fromSec);
    const to = Number(stitch.toSec);
    const orig = await db.video.findFirst({
      where: {
        id: String(stitch.ofId),
        status: 'ready',
        kind: 'video',
        visibility: 'public',
        allowRemix: true,
        fileUrl: { endsWith: '.mp4' },
      },
      select: { durationSec: true },
    });
    const length = to - from;
    if (!orig || !(from >= 0) || !(length >= 0.999) || length > 5.001 || to > (orig.durationSec ?? 0) + 0.05)
      return { ok: false, error: 'STITCH_INVALID' };
  }

  const productIds = [...new Set(meta.productIds.filter(Boolean))];
  if (productIds.length > MAX_PRODUCTS_PER_VIDEO) return { ok: false, error: 'PRODUCT_INVALID' };
  for (const id of productIds) {
    const p = await getProductForCheckout(id);
    if (!p?.available) return { ok: false, error: 'PRODUCT_INVALID' };
  }

  return db.$transaction(async (tx): Promise<CreateVideoResult> => {
    // Khoá theo người đăng để 2 lần đăng cùng lúc không vượt 10 video/ngày.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`video:${userId}`}))`;
    // Video và Story có giới hạn riêng, mỗi loại 10 mỗi ngày.
    const today = await tx.video.count({
      where: { authorId: userId, kind, createdAt: { gte: startOfVnDay() } },
    });
    if (today >= MAX_VIDEOS_PER_DAY) return discard({ ok: false as const, error: 'DAILY_LIMIT' as const });
    if (
      draft &&
      (await tx.video.count({
        where: { authorId: userId, draft: true, status: { in: ['processing', 'draft'] } },
      })) >= MAX_DRAFTS
    )
      return { ok: false as const, error: 'DRAFT_LIMIT' as const };
    const video = await tx.video.create({
      data: {
        authorId: userId,
        caption,
        hashtags: extractHashtags(caption),
        kind,
        duetOfId,
        stitchOfId: stitch ? String(stitch.ofId) : null,
        stitchFromSec: stitch ? Number(stitch.fromSec) : null,
        stitchToSec: stitch ? Number(stitch.toSec) : null,
        visibility: isVisibility(meta.options?.visibility) ? meta.options.visibility : 'public',
        allowComments: meta.options?.allowComments ?? true,
        allowRemix: meta.options?.allowRemix ?? true,
        allowDownload: meta.options?.allowDownload ?? true,
        draft,
        publishAt,
        province: place.province ?? null,
        placeName: place.placeName ?? null,
        aiGenerated: meta.aiStudio === true || meta.options?.aiGenerated === true,
        aiStudio: meta.aiStudio === true,
        sourceSec,
        wantCaptions: kind === 'video' && meta.options?.autoCaptions === true,
        editSpec: isEmptyEdit(editSpec) ? undefined : editSpec,
        soundId: sound?.id ?? null,
        soundStartSec: sound?.startSec ?? null,
        soundVolume: sound?.volume ?? null,
        originalVolume: sound?.originalVolume ?? null,
        look: isLook(meta.options?.look) && meta.options.look !== 'goc' ? meta.options.look : null,
        beauty:
          Number.isInteger(meta.options?.beauty) &&
          meta.options!.beauty! > 0 &&
          meta.options!.beauty! <= MAX_BEAUTY
            ? meta.options!.beauty!
            : 0,
        createdAt: now(),
        products: { create: productIds.map((productId, position) => ({ productId, position })) },
      },
    });
    await tx.videoJob.create({ data: { videoId: video.id, sourcePath: file, lane, createdAt: now() } });
    return { ok: true, videoId: video.id };
  });
}

// Dọn file tải lên bị bỏ dở (không thành video) sau 24 giờ.
export async function cleanupStaleUploads(maxAgeMs = 24 * 3_600_000): Promise<number> {
  const root = path.join(env().PRIVATE_DIR, 'video-uploads');
  const users = await readdir(root).catch(() => [] as string[]);
  const pending = new Set(
    (
      await db.videoJob.findMany({
        where: { status: { in: ['queued', 'running'] } },
        select: { sourcePath: true },
      })
    ).map((j) => j.sourcePath),
  );
  let removed = 0;
  for (const u of users) {
    for (const f of await readdir(path.join(root, u)).catch(() => [] as string[])) {
      const full = path.join(root, u, f);
      const s = await stat(full).catch(() => null);
      if (s && !pending.has(full) && Date.now() - s.mtimeMs > maxAgeMs) {
        await unlink(full).catch(() => {});
        removed += 1;
      }
    }
  }
  return removed;
}
