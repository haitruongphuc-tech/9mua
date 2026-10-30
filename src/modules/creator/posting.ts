import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processCroppedImage, type ImageError } from '@/lib/media/process-image';
import { notifyKey } from '@/lib/notifications';
import { getProductForCheckout, PROVINCES, provinceName } from '@/modules/kiot';
import { extractHashtags } from './hashtags';
import { runVideoReadyHooks } from './hooks';
import { removeVideoFiles } from './moderation';
import { initialScore } from './score';
import { isVisibility, type VideoOptions } from './visibility';

// Tuỳ chọn khi đăng và sau khi đăng (SPEC-creator.md V5.3, công tắc post_options): nháp, hẹn giờ, địa điểm, ghim lên
// trang cá nhân, nhãn AI, sửa sau khi đăng.
export const MAX_DRAFTS = 20;
export const DRAFT_KEEP_DAYS = 90;
export const DRAFT_WARN_DAYS = 7;
export const MIN_SCHEDULE_MINUTES = 15;
export const MAX_SCHEDULE_DAYS = 30;
export const MAX_PLACE_NAME = 60;
export const MAX_PROFILE_PINS = 3;
const DAY = 86_400_000;

export type PostOptions = VideoOptions & {
  draft?: boolean;
  publishAt?: Date | null;
  province?: string | null;
  placeName?: string | null;
  aiGenerated?: boolean;
  autoCaptions?: boolean; // phụ đề tự động (SPEC-creator.md V5.4)
  look?: string | null; // bộ lọc màu (SPEC-creator.md V5.5)
  beauty?: number; // làm đẹp 0–3
  editSpec?: unknown; // chỉnh video (SPEC-creator.md V5.6 mục 1), kiểm bằng parseEditSpec
  sound?: { id: string; startSec: number; volume: number; originalVolume: number } | null; // nhạc nền (V5.6 mục 2)
  replyTo?: { commentId: string; x: number; y: number } | null; // trả lời bình luận bằng video (V5.8)
};

// Giờ hẹn hợp lệ: từ 15 phút tới 30 ngày sau.
export function scheduleOk(at: Date): boolean {
  const t = at.getTime();
  const n = now().getTime();
  return Number.isFinite(t) && t >= n + MIN_SCHEDULE_MINUTES * 60_000 && t <= n + MAX_SCHEDULE_DAYS * DAY;
}

// Địa điểm: slug một trong 34 tỉnh + tên tự gõ ≤ 60 ký tự, không link. Chuỗi rỗng là bỏ địa điểm.
export function normalizePlace(place: {
  province?: string | null;
  placeName?: string | null;
}): { province?: string | null; placeName?: string | null } | null {
  const out: { province?: string | null; placeName?: string | null } = {};
  if (place.province !== undefined) {
    const slug = place.province?.trim() || null;
    if (slug && !PROVINCES.some((p) => p.slug === slug)) return null;
    out.province = slug;
  }
  if (place.placeName !== undefined) {
    const name = place.placeName?.replace(/\s+/g, ' ').trim() || null;
    if (name && (name.length > MAX_PLACE_NAME || hasLink(name))) return null;
    out.placeName = name;
  }
  return out;
}

// "Đà Nẵng · Chợ Hàn" hiện dưới chú thích.
export function placeLabel(v: { province: string | null; placeName: string | null }): string | null {
  const parts = [v.province ? provinceName(v.province) : null, v.placeName].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export async function countDrafts(userId: string): Promise<number> {
  return db.video.count({
    where: { authorId: userId, draft: true, status: { in: ['processing', 'draft'] } },
  });
}

// Đưa một video nháp / hẹn giờ lên feed ngay (điều kiện status để không đăng hai lần khi việc định kỳ chạy cùng lúc).
async function goLive(
  video: { id: string; authorId: string; caption: string; kind: string },
  from: 'draft' | 'scheduled',
  readyAt: Date,
): Promise<boolean> {
  const { count } = await db.video.updateMany({
    where: { id: video.id, status: from },
    data: { status: 'ready', draft: false, readyAt, score: initialScore() },
  });
  if (count !== 1) return false;
  await runVideoReadyHooks(video);
  return true;
}

export type TimingResult = { ok: true } | { ok: false; error: 'NOT_FOUND' | 'SCHEDULE_INVALID' };

// Nháp và video hẹn giờ (chưa lên feed): đăng ngay, hẹn giờ / đổi giờ, hoặc huỷ hẹn (về Nháp).
export async function changePostTiming(
  userId: string,
  videoId: string,
  timing: { mode: 'now' } | { mode: 'schedule'; at: Date } | { mode: 'draft' },
): Promise<TimingResult> {
  const video = await db.video.findFirst({
    where: {
      id: videoId,
      authorId: userId,
      kind: 'video',
      OR: [
        { status: { in: ['draft', 'scheduled'] } },
        { status: 'processing', OR: [{ draft: true }, { publishAt: { not: null } }] },
      ],
    },
  });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  const status = video.status as 'draft' | 'scheduled' | 'processing';
  if (timing.mode === 'now') {
    if (status === 'processing') {
      await db.video.updateMany({
        where: { id: video.id, status: 'processing' },
        data: { draft: false, publishAt: null },
      });
      return { ok: true };
    }
    await db.video.updateMany({ where: { id: video.id, status }, data: { publishAt: null } });
    await goLive(video, status, now());
    return { ok: true };
  }
  if (timing.mode === 'schedule') {
    if (!scheduleOk(timing.at)) return { ok: false, error: 'SCHEDULE_INVALID' };
    await db.video.updateMany({
      where: { id: video.id, status },
      data: {
        draft: false,
        publishAt: timing.at,
        status: status === 'processing' ? 'processing' : 'scheduled',
      },
    });
    return { ok: true };
  }
  await db.video.updateMany({
    where: { id: video.id, status },
    data: { draft: true, publishAt: null, status: status === 'processing' ? 'processing' : 'draft' },
  });
  return { ok: true };
}

// Việc chạy mỗi phút (worker) và mỗi 5 phút (cron, dự phòng): video hẹn giờ tới giờ thì lên feed, báo người follow.
// Chạy cả khi công tắc post_options tắt: video đã hẹn vẫn lên đúng giờ, chỉ là không hẹn thêm được.
export async function publishScheduledVideos(limit = 200): Promise<number> {
  const due = await db.video.findMany({
    where: { status: 'scheduled', publishAt: { lte: now() } },
    orderBy: { publishAt: 'asc' },
    take: limit,
  });
  let published = 0;
  for (const v of due) {
    if (!(await goLive(v, 'scheduled', v.publishAt ?? now()))) continue;
    published += 1;
    await notifyKey(v.authorId, 'notify.videoPublished', { detail: v.caption.slice(0, 80) }, `/v/${v.id}`);
  }
  return published;
}

// Việc hằng ngày: nháp quá 83 ngày được báo một lần, quá 90 ngày thì xoá (như người đăng tự xoá).
export async function expireDrafts(): Promise<{ warned: number; deleted: number }> {
  const t = now().getTime();
  const old = await db.video.findMany({
    where: { status: 'draft', createdAt: { lte: new Date(t - DRAFT_KEEP_DAYS * DAY) } },
    take: 500,
  });
  for (const v of old) {
    const { count } = await db.video.updateMany({
      where: { id: v.id, status: 'draft' },
      data: { status: 'deleted', fileUrl: null, posterUrl: null },
    });
    if (count) await removeVideoFiles(v);
  }
  const warn = await db.video.findMany({
    where: {
      status: 'draft',
      draftWarnedAt: null,
      createdAt: { lte: new Date(t - (DRAFT_KEEP_DAYS - DRAFT_WARN_DAYS) * DAY) },
    },
    select: { id: true, authorId: true, caption: true },
    take: 500,
  });
  for (const v of warn) {
    await db.video.update({ where: { id: v.id }, data: { draftWarnedAt: now() } });
    await notifyKey(
      v.authorId,
      'notify.draftExpiring',
      { detail: v.caption.slice(0, 80), days: DRAFT_WARN_DAYS },
      '/video/cua-toi?tab=nhap',
    );
  }
  return { warned: warn.length, deleted: old.length };
}

// Ghim video của mình lên đầu trang cá nhân (tối đa 3).
export async function pinToProfile(
  userId: string,
  videoId: string,
  on: boolean,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'PIN_LIMIT' }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`profile-pin:${userId}`}))`;
    const video = await tx.video.findFirst({
      where: { id: videoId, authorId: userId, kind: 'video', status: 'ready' },
    });
    if (!video) return { ok: false as const, error: 'NOT_FOUND' as const };
    if (on && !video.profilePinnedAt) {
      const pinned = await tx.video.count({
        where: { authorId: userId, profilePinnedAt: { not: null }, status: { not: 'deleted' } },
      });
      if (pinned >= MAX_PROFILE_PINS) return { ok: false as const, error: 'PIN_LIMIT' as const };
    }
    await tx.video.update({
      where: { id: videoId },
      data: { profilePinnedAt: on ? (video.profilePinnedAt ?? now()) : null },
    });
    return { ok: true as const };
  });
}

export type EditVideoPatch = VideoOptions & {
  caption?: string;
  productIds?: string[];
  province?: string | null;
  placeName?: string | null;
  aiGenerated?: boolean;
};

export type EditVideoResult =
  | { ok: true }
  | {
      ok: false;
      error: 'NOT_FOUND' | 'CAPTION_TOO_LONG' | 'PRODUCT_INVALID' | 'PLACE_INVALID' | 'INVALID' | 'AI_LOCKED';
    };

// Sửa sau khi đăng (C56): chú thích (hashtag tính lại), sản phẩm gắn, quyền riêng tư, địa điểm, nhãn AI, bình luận /
// Duet / tải về. Không sửa file video. Sửa chữ, sản phẩm hoặc địa điểm của video đã lên feed thì hiện "Đã chỉnh sửa".
export async function editVideo(
  userId: string,
  videoId: string,
  patch: EditVideoPatch,
  limits: { maxCaption: number; maxProducts: number } = { maxCaption: 300, maxProducts: 3 },
): Promise<EditVideoResult> {
  const video = await db.video.findFirst({
    where: {
      id: videoId,
      authorId: userId,
      kind: 'video',
      status: { in: ['processing', 'draft', 'scheduled', 'ready', 'hidden'] },
    },
    include: { products: { orderBy: { position: 'asc' } } },
  });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  if (patch.visibility !== undefined && !isVisibility(patch.visibility))
    return { ok: false, error: 'INVALID' };
  if (patch.aiGenerated === false && video.aiStudio) return { ok: false, error: 'AI_LOCKED' };
  const place = normalizePlace(patch);
  if (!place) return { ok: false, error: 'PLACE_INVALID' };

  let caption: string | undefined;
  if (patch.caption !== undefined) {
    caption = patch.caption.trim();
    if (caption.length > limits.maxCaption) return { ok: false, error: 'CAPTION_TOO_LONG' };
  }
  let productIds: string[] | undefined;
  if (patch.productIds !== undefined) {
    productIds = [...new Set(patch.productIds.filter(Boolean))];
    if (productIds.length > limits.maxProducts) return { ok: false, error: 'PRODUCT_INVALID' };
    const current = new Set(video.products.map((p) => p.productId));
    for (const id of productIds) {
      // Sản phẩm đã gắn từ trước được giữ dù hết hàng; sản phẩm mới phải đang bán.
      if (current.has(id)) continue;
      const p = await getProductForCheckout(id);
      if (!p?.available) return { ok: false, error: 'PRODUCT_INVALID' };
    }
  }

  const contentChanged =
    (caption !== undefined && caption !== video.caption) ||
    (productIds !== undefined && productIds.join() !== video.products.map((p) => p.productId).join()) ||
    (place.province !== undefined && place.province !== video.province) ||
    (place.placeName !== undefined && place.placeName !== video.placeName);
  const published = video.status === 'ready' || video.status === 'hidden';

  await db.$transaction(async (tx) => {
    await tx.video.update({
      where: { id: video.id },
      data: {
        caption,
        hashtags: caption !== undefined ? extractHashtags(caption) : undefined,
        visibility: patch.visibility,
        allowComments: patch.allowComments,
        allowRemix: patch.allowRemix,
        allowDownload: patch.allowDownload,
        province: place.province,
        placeName: place.placeName,
        aiGenerated: patch.aiGenerated,
        editedAt: contentChanged && published ? now() : undefined,
      },
    });
    if (productIds !== undefined) {
      await tx.videoProduct.deleteMany({ where: { videoId: video.id } });
      if (productIds.length)
        await tx.videoProduct.createMany({
          data: productIds.map((productId, position) => ({ videoId: video.id, productId, position })),
        });
    }
  });
  return { ok: true };
}

export type VideoForEdit = {
  id: string;
  status: string;
  caption: string;
  posterUrl: string | null;
  visibility: string;
  allowComments: boolean;
  allowRemix: boolean;
  allowDownload: boolean;
  province: string | null;
  placeName: string | null;
  aiGenerated: boolean;
  aiStudio: boolean;
  posterChoices: string[];
  products: { id: string; name: string; price: number; thumbUrl: string | null }[];
};

// Dữ liệu cho trang "Sửa video" — chỉ chủ video.
export async function videoForEdit(userId: string, videoId: string): Promise<VideoForEdit | null> {
  const v = await db.video.findFirst({
    where: {
      id: videoId,
      authorId: userId,
      kind: 'video',
      status: { in: ['processing', 'draft', 'scheduled', 'ready', 'hidden'] },
    },
    include: { products: { orderBy: { position: 'asc' } } },
  });
  if (!v) return null;
  const products = await Promise.all(v.products.map((p) => getProductForCheckout(p.productId)));
  return {
    id: v.id,
    status: v.status,
    caption: v.caption,
    posterUrl: v.posterUrl,
    visibility: v.visibility,
    allowComments: v.allowComments,
    allowRemix: v.allowRemix,
    allowDownload: v.allowDownload,
    province: v.province,
    placeName: v.placeName,
    aiGenerated: v.aiGenerated,
    aiStudio: v.aiStudio,
    posterChoices: v.posterChoices,
    products: products
      .filter((p) => p !== null)
      .map((p) => ({ id: p.id, name: p.name, price: p.price, thumbUrl: p.imageUrl })),
  };
}

// Đổi ảnh bìa (SPEC-creator.md V5.1 mục 6, V5.3 mục 7): chọn 1 trong 3 ảnh gợi ý, hoặc tải ảnh riêng (JPG, PNG, WebP
// ≤ 10MB, cắt 9:16, bỏ thông tin ẩn như ảnh sản phẩm). Ảnh bìa cũ không phải ảnh gợi ý thì xoá.
export async function setVideoCover(
  userId: string,
  videoId: string,
  input: { choice: string } | { image: Buffer },
): Promise<{ ok: true; posterUrl: string } | { ok: false; error: 'NOT_FOUND' | 'BAD_CHOICE' | ImageError }> {
  const v = await db.video.findFirst({
    where: {
      id: videoId,
      authorId: userId,
      kind: 'video',
      status: { in: ['draft', 'scheduled', 'ready', 'hidden'] },
    },
  });
  if (!v) return { ok: false, error: 'NOT_FOUND' };
  let posterUrl: string;
  if ('choice' in input) {
    if (!v.posterChoices.includes(input.choice)) return { ok: false, error: 'BAD_CHOICE' };
    posterUrl = input.choice;
  } else {
    const processed = await processCroppedImage(input.image, { width: 720, height: 1280 });
    if (!processed.ok) return processed;
    posterUrl = await imageStore().save(
      `videos/covers/${v.id}-${randomBytes(6).toString('hex')}.webp`,
      processed.data,
    );
  }
  await db.video.update({ where: { id: v.id }, data: { posterUrl } });
  if (v.posterUrl && v.posterUrl !== posterUrl && !v.posterChoices.includes(v.posterUrl))
    await imageStore().remove(v.posterUrl);
  return { ok: true, posterUrl };
}
