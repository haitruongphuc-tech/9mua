import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { notBlockedWith } from '@/lib/blocks';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processCroppedImage } from '@/lib/media/process-image';
import { notifyEvent } from '@/lib/notify-events';
import { hydrateVideos, type FeedVideo, type Viewer } from './feed';
import { canViewVideo } from './visibility';

// Watch: phim ngắn nhiều tập (SPEC-creator.md V5.9, công tắc watch). Mỗi tập là một video thường gắn seriesId + episodeNo.
export const SERIES_GENRES = ['tinh-cam', 'hai', 'gia-dinh', 'hanh-dong', 'khac'] as const;
export type SeriesGenre = (typeof SERIES_GENRES)[number];
export const MAX_SERIES_TITLE = 80;
export const MAX_SERIES_DESCRIPTION = 500;
export const MAX_EPISODE = 200;
export const MAX_SERIES_PER_USER = 50;
export const WATCHED_RATIO = 0.9;

export type SeriesInput = {
  title: string;
  description: string;
  genre: string;
  status: string; // ongoing | complete
  coverPath?: string | null;
};

export type SeriesCard = {
  id: string;
  title: string;
  coverPath: string | null;
  genre: SeriesGenre;
  status: 'ongoing' | 'complete';
  episodeCount: number;
  ownerName: string;
};

export type Episode = {
  videoId: string;
  episodeNo: number;
  durationSec: number | null;
  posterUrl: string | null;
  caption: string;
  watched: boolean;
};

export type SeriesPage = {
  series: SeriesCard & { description: string; ownerId: string; updatedAt: Date };
  episodes: Episode[];
  videos: FeedVideo[]; // cùng thứ tự với episodes (chỉ các tập người xem được xem)
  following: boolean; // đã "Lưu phim"
  resume: { videoId: string; second: number } | null;
};

type Result<E extends string> = { ok: true } | { ok: false; error: E };

function clean(input: SeriesInput): Omit<SeriesInput, 'coverPath'> | null {
  const title = input.title.replace(/\s+/g, ' ').trim();
  const description = input.description.trim();
  if (!title || title.length > MAX_SERIES_TITLE || hasLink(title)) return null;
  if (description.length > MAX_SERIES_DESCRIPTION || hasLink(description)) return null;
  if (!SERIES_GENRES.includes(input.genre as SeriesGenre)) return null;
  if (input.status !== 'ongoing' && input.status !== 'complete') return null;
  return { title, description, genre: input.genre, status: input.status };
}

export async function createSeries(
  userId: string,
  input: SeriesInput,
): Promise<{ ok: true; seriesId: string } | { ok: false; error: 'INVALID' | 'LIMIT' }> {
  const data = clean(input);
  if (!data) return { ok: false, error: 'INVALID' };
  if ((await db.series.count({ where: { ownerId: userId } })) >= MAX_SERIES_PER_USER)
    return { ok: false, error: 'LIMIT' };
  const t = now();
  const s = await db.series.create({
    data: { ...data, ownerId: userId, coverPath: input.coverPath ?? null, createdAt: t, updatedAt: t },
  });
  return { ok: true, seriesId: s.id };
}

export async function updateSeries(
  userId: string,
  seriesId: string,
  input: SeriesInput,
): Promise<Result<'INVALID' | 'NOT_FOUND'>> {
  const data = clean(input);
  if (!data) return { ok: false, error: 'INVALID' };
  const r = await db.series.updateMany({
    where: { id: seriesId, ownerId: userId },
    data: {
      ...data,
      ...(input.coverPath !== undefined ? { coverPath: input.coverPath } : {}),
      updatedAt: now(),
    },
  });
  return r.count ? { ok: true } : { ok: false, error: 'NOT_FOUND' };
}

async function recount(seriesId: string) {
  const episodeCount = await db.video.count({
    where: { seriesId, status: { notIn: ['deleted', 'removed'] } },
  });
  await db.series.update({ where: { id: seriesId }, data: { episodeCount } });
}

// Gắn / gỡ một video của mình vào phim (seriesId null là gỡ). Số tập 1–200, không trùng trong phim.
export async function setEpisode(
  userId: string,
  videoId: string,
  target: { seriesId: string; episodeNo: number; watchOnly?: boolean } | null,
): Promise<Result<'NOT_FOUND' | 'EPISODE_INVALID' | 'EPISODE_TAKEN'>> {
  const video = await db.video.findFirst({
    where: { id: videoId, authorId: userId, kind: 'video', status: { notIn: ['deleted', 'removed'] } },
    select: { id: true, seriesId: true },
  });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  if (!target) {
    await db.video.update({
      where: { id: videoId },
      data: { seriesId: null, episodeNo: null, watchOnly: false },
    });
    if (video.seriesId) await recount(video.seriesId);
    return { ok: true };
  }
  const n = target.episodeNo;
  if (!Number.isInteger(n) || n < 1 || n > MAX_EPISODE) return { ok: false, error: 'EPISODE_INVALID' };
  const series = await db.series.findFirst({ where: { id: target.seriesId, ownerId: userId } });
  if (!series) return { ok: false, error: 'NOT_FOUND' };
  const taken = await db.video.findFirst({
    where: {
      seriesId: series.id,
      episodeNo: n,
      id: { not: videoId },
      status: { notIn: ['deleted', 'removed'] },
    },
    select: { id: true },
  });
  if (taken) return { ok: false, error: 'EPISODE_TAKEN' };
  await db.video.update({
    where: { id: videoId },
    data: { seriesId: series.id, episodeNo: n, watchOnly: target.watchOnly === true },
  });
  await recount(series.id);
  if (video.seriesId && video.seriesId !== series.id) await recount(video.seriesId);
  await db.series.update({ where: { id: series.id }, data: { updatedAt: now() } });
  return { ok: true };
}

const GENRE = (g: string): SeriesGenre =>
  SERIES_GENRES.includes(g as SeriesGenre) ? (g as SeriesGenre) : 'khac';

type CardRow = {
  id: string;
  title: string;
  coverPath: string | null;
  genre: string;
  status: string;
  episodeCount: number;
  ownerName: string;
};
const card = (r: CardRow): SeriesCard => ({
  id: r.id,
  title: r.title,
  coverPath: r.coverPath,
  genre: GENRE(r.genre),
  status: r.status === 'complete' ? 'complete' : 'ongoing',
  episodeCount: r.episodeCount,
  ownerName: r.ownerName,
});

// Phim hiện ở /watch: có ít nhất 1 tập công khai đã lên, người đăng không bị khoá, không chặn nhau với người xem.
const LISTED = (viewerId: string | undefined) => Prisma.sql`u."lockedAt" IS NULL AND NOT u."isPrivate"
  AND ${notBlockedWith(viewerId, Prisma.sql`s."ownerId"`)}
  AND EXISTS (SELECT 1 FROM "Video" v WHERE v."seriesId" = s.id AND v.status = 'ready' AND v.visibility = 'public')`;

// Trang /watch: Mới cập nhật, Xem nhiều 7 ngày (theo lượt xem các tập lên trong 7 ngày), Phim đang theo dõi.
export async function watchHome(viewer: Viewer): Promise<{
  latest: SeriesCard[];
  popular: SeriesCard[];
  following: SeriesCard[];
}> {
  const since = new Date(now().getTime() - 7 * 86_400_000);
  const base = Prisma.sql`SELECT s.id, s.title, s."coverPath", s.genre, s.status, s."episodeCount",
      u."displayName" AS "ownerName" FROM "Series" s JOIN "User" u ON u.id = s."ownerId"`;
  const [latest, popular, following] = await Promise.all([
    db.$queryRaw<CardRow[]>`${base} WHERE ${LISTED(viewer.userId)} ORDER BY s."updatedAt" DESC LIMIT 20`,
    db.$queryRaw<CardRow[]>`${base}
      LEFT JOIN (SELECT "seriesId", sum(views)::int AS views FROM "Video"
        WHERE "seriesId" IS NOT NULL AND status = 'ready' AND visibility = 'public' AND "readyAt" >= ${since}
        GROUP BY "seriesId") w ON w."seriesId" = s.id
      WHERE ${LISTED(viewer.userId)} AND COALESCE(w.views, 0) > 0
      ORDER BY w.views DESC, s."updatedAt" DESC LIMIT 20`,
    viewer.userId
      ? db.$queryRaw<
          CardRow[]
        >`${base} JOIN "SeriesFollow" f ON f."seriesId" = s.id AND f."userId" = ${viewer.userId}
          WHERE ${LISTED(viewer.userId)} ORDER BY s."updatedAt" DESC LIMIT 20`
      : Promise.resolve([]),
  ]);
  return { latest: latest.map(card), popular: popular.map(card), following: following.map(card) };
}

// Trang phim /watch/<id>: tập theo số, tập đã xem (≥ 90%), chỗ đang xem dở, đã lưu phim chưa.
export async function seriesPage(seriesId: string, viewer: Viewer): Promise<SeriesPage | null> {
  const rows = await db.$queryRaw<(CardRow & { description: string; ownerId: string; updatedAt: Date })[]>`
    SELECT s.id, s.title, s."coverPath", s.genre, s.status, s."episodeCount", s.description, s."ownerId",
      s."updatedAt", u."displayName" AS "ownerName"
    FROM "Series" s JOIN "User" u ON u.id = s."ownerId"
    WHERE s.id = ${seriesId} AND u."lockedAt" IS NULL AND ${notBlockedWith(viewer.userId, Prisma.sql`s."ownerId"`)}`;
  const s = rows[0];
  if (!s) return null;
  const candidates = await db.video.findMany({
    where: { seriesId, status: 'ready', episodeNo: { not: null } },
    orderBy: { episodeNo: 'asc' },
    select: { id: true },
  });
  // hydrateVideos không kiểm quyền: lọc theo quyền xem như /v/<id>.
  const allowed: string[] = [];
  for (const c of candidates) if (await canViewVideo(c.id, viewer.userId)) allowed.push(c.id);
  const videos = await hydrateVideos(allowed, viewer);
  const meta = await db.video.findMany({
    where: { id: { in: allowed } },
    select: { id: true, episodeNo: true, durationSec: true, posterUrl: true, caption: true },
  });
  const [watched, follow, progress] = viewer.userId
    ? await Promise.all([
        db.episodeWatched.findMany({
          where: { userId: viewer.userId, videoId: { in: allowed } },
          select: { videoId: true },
        }),
        db.seriesFollow.findUnique({ where: { userId_seriesId: { userId: viewer.userId, seriesId } } }),
        db.seriesProgress.findUnique({ where: { userId_seriesId: { userId: viewer.userId, seriesId } } }),
      ])
    : [[], null, null];
  const seen = new Set(watched.map((w) => w.videoId));
  const episodes = allowed.map((id) => {
    const m = meta.find((x) => x.id === id)!;
    return {
      videoId: id,
      episodeNo: m.episodeNo!,
      durationSec: m.durationSec,
      posterUrl: m.posterUrl,
      caption: m.caption,
      watched: seen.has(id),
    };
  });
  return {
    series: { ...card(s), description: s.description, ownerId: s.ownerId, updatedAt: s.updatedAt },
    episodes,
    videos: allowed.map((id) => videos.find((v) => v.id === id)).filter((v): v is FeedVideo => Boolean(v)),
    following: Boolean(follow),
    resume:
      progress && allowed.includes(progress.videoId)
        ? { videoId: progress.videoId, second: progress.second }
        : null,
  };
}

// Lưu chỗ đang xem (người đã đăng nhập; khách lưu trong trình duyệt). Xem ≥ 90% thì đánh dấu tập đã xem.
export async function saveWatchProgress(
  userId: string,
  videoId: string,
  second: number,
): Promise<{ ok: boolean; watched: boolean }> {
  const v = await db.video.findFirst({
    where: { id: videoId, status: 'ready', seriesId: { not: null } },
    select: { seriesId: true, durationSec: true },
  });
  if (!v?.seriesId || !Number.isFinite(second) || second < 0) return { ok: false, watched: false };
  const at = Math.min(Math.floor(second), Math.ceil(v.durationSec ?? second));
  const t = now();
  await db.seriesProgress.upsert({
    where: { userId_seriesId: { userId, seriesId: v.seriesId } },
    create: { userId, seriesId: v.seriesId, videoId, second: at, updatedAt: t },
    update: { videoId, second: at, updatedAt: t },
  });
  const watched = Boolean(v.durationSec && second >= v.durationSec * WATCHED_RATIO);
  if (watched)
    await db.episodeWatched.upsert({
      where: { userId_videoId: { userId, videoId } },
      create: { userId, videoId, createdAt: t },
      update: {},
    });
  return { ok: true, watched };
}

// "Lưu phim": có tập mới thì nhận thông báo.
export async function toggleSeriesFollow(
  userId: string,
  seriesId: string,
): Promise<{ ok: boolean; following: boolean }> {
  const s = await db.series.findUnique({ where: { id: seriesId }, select: { ownerId: true } });
  if (!s) return { ok: false, following: false };
  const key = { userId_seriesId: { userId, seriesId } };
  if (await db.seriesFollow.findUnique({ where: key })) {
    await db.seriesFollow.delete({ where: key });
    return { ok: true, following: false };
  }
  await db.seriesFollow.create({ data: { userId, seriesId, createdAt: now() } });
  return { ok: true, following: true };
}

// Gọi khi một tập lên (công khai): báo người đã lưu phim.
export async function notifyNewEpisode(videoId: string): Promise<number> {
  const v = await db.video.findUnique({
    where: { id: videoId },
    select: { seriesId: true, episodeNo: true, visibility: true, status: true },
  });
  if (!v?.seriesId || v.status !== 'ready' || v.visibility !== 'public') return 0;
  const s = await db.series.findUnique({ where: { id: v.seriesId }, select: { title: true } });
  const followers = await db.seriesFollow.findMany({
    where: { seriesId: v.seriesId },
    select: { userId: true },
  });
  for (const f of followers)
    await notifyEvent({
      userId: f.userId,
      type: 'episode',
      key: 'notify.newEpisode',
      vars: { detail: `${s?.title ?? ''} · ${v.episodeNo ?? ''}` },
      url: `/watch/${v.seriesId}?tap=${videoId}`,
    });
  return followers.length;
}

// Phim của tôi (/video/cua-toi/phim).
export async function mySeries(userId: string) {
  return db.series.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: 'desc' } });
}

// Ảnh bìa phim 2:3 (600×900 WebP, bỏ metadata). Ảnh cũ xoá sau khi lưu ảnh mới.
export async function setSeriesCover(
  userId: string,
  seriesId: string,
  image: Buffer,
): Promise<{ ok: true; coverPath: string } | { ok: false; error: string }> {
  const s = await db.series.findFirst({ where: { id: seriesId, ownerId: userId } });
  if (!s) return { ok: false, error: 'NOT_FOUND' };
  const processed = await processCroppedImage(image, { width: 600, height: 900 });
  if (!processed.ok) return processed;
  const coverPath = await imageStore().save(
    `series/${s.id}-${randomBytes(6).toString('hex')}.webp`,
    processed.data,
  );
  await db.series.update({ where: { id: s.id }, data: { coverPath, updatedAt: now() } });
  if (s.coverPath)
    await imageStore()
      .remove(s.coverPath)
      .catch(() => {});
  return { ok: true, coverPath };
}

// Trang sửa phim: video của mình chưa thuộc phim nào hoặc đã thuộc phim này (mới nhất trước).
export async function episodeCandidates(userId: string, seriesId: string) {
  return db.video.findMany({
    where: {
      authorId: userId,
      kind: 'video',
      status: { notIn: ['deleted', 'removed', 'failed'] },
      OR: [{ seriesId: null }, { seriesId }],
    },
    orderBy: [{ episodeNo: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      caption: true,
      posterUrl: true,
      status: true,
      seriesId: true,
      episodeNo: true,
      watchOnly: true,
    },
  });
}
