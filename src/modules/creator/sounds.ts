import { randomBytes } from 'node:crypto';
import { privateUserIds } from '@/lib/private-accounts';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';
import { notBlockedWith } from '@/lib/blocks';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { runTool } from '@/lib/media/run-tool';
import { hydrateVideos, type FeedVideo, type Viewer } from './feed';
import { probe } from './transcode';

// Âm thanh (SPEC-creator.md V5.6 mục 2): âm thanh gốc tự tách từ video công khai cho phép dùng lại (như TikTok), và nhạc
// CEO tải lên ở /admin/am-thanh. Video mới dùng âm thanh thì máy chủ trộn tiếng khi xử lý — file đã trộn không phụ thuộc
// âm thanh nữa, nên gỡ âm thanh không làm hỏng video đã đăng.
export const MAX_SOUND_SEC = 300;
export const MAX_LIBRARY_BYTES = 10 * 1024 * 1024;
export const MAX_SOUND_TITLE = 60;
export const TRENDING_SOUNDS = 50;
const TRENDING_DAYS = 7;
const STEP_TIMEOUT_MS = 3 * 60_000;

export type SoundView = {
  id: string;
  kind: 'library' | 'original';
  title: string | null; // null: âm thanh gốc chưa đặt tên → "Âm thanh gốc – @tên"
  artist: string | null;
  authorName: string | null; // người đăng video gốc
  url: string;
  durationSec: number;
  uses: number; // số video dùng trong 7 ngày (thịnh hành) hoặc tất cả (trang âm thanh)
};

export type SoundPage = {
  sound: SoundView & {
    status: 'active' | 'removed';
    selectable: boolean;
    ownerId: string | null;
    sourceVideoId: string | null;
  };
  total: number;
  videos: FeedVideo[];
};

type SoundRow = {
  id: string;
  kind: string;
  title: string | null;
  artist: string | null;
  authorName: string | null;
  fileUrl: string;
  durationSec: number;
  uses: number;
};

const FROM = Prisma.sql`"Sound" s LEFT JOIN "Video" v ON v.id = s."sourceVideoId" LEFT JOIN "User" u ON u.id = v."authorId"`;
// Chọn mới được: đang hoạt động; âm thanh gốc thì video gốc còn công khai, cho phép dùng lại, tài khoản không bị khoá.
const SELECTABLE = Prisma.sql`s.status = 'active' AND (s.kind = 'library' OR (v.status = 'ready' AND v.visibility = 'public'
  AND v."allowRemix" = true AND u."lockedAt" IS NULL AND NOT u."isPrivate"))`;

const view = (r: SoundRow): SoundView => ({
  id: r.id,
  kind: r.kind === 'library' ? 'library' : 'original',
  title: r.title,
  artist: r.artist,
  authorName: r.authorName,
  url: r.fileUrl,
  durationSec: r.durationSec,
  uses: r.uses,
});

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// Thịnh hành: 50 âm thanh được dùng nhiều nhất 7 ngày; có từ khoá thì tìm theo tên âm thanh, nghệ sĩ, tên người đăng.
export async function listSounds(q?: string): Promise<SoundView[]> {
  const since = new Date(now().getTime() - TRENDING_DAYS * 86_400_000);
  const query = (q ?? '').trim().slice(0, 60);
  const search = query
    ? Prisma.sql`AND (s.title ILIKE ${likePattern(query)} OR s.artist ILIKE ${likePattern(query)}
        OR u."displayName" ILIKE ${likePattern(query)} OR u.handle ILIKE ${likePattern(query)})`
    : Prisma.empty;
  const rows = await db.$queryRaw<SoundRow[]>`
    WITH used AS (
      SELECT "soundId" AS id, count(*)::int AS uses FROM "Video"
      WHERE "soundId" IS NOT NULL AND status = 'ready' AND "readyAt" >= ${since} GROUP BY "soundId"
    )
    SELECT s.id, s.kind, s.title, s.artist, u."displayName" AS "authorName", s.path AS "fileUrl", s."durationSec",
      COALESCE(used.uses, 0) AS uses
    FROM ${FROM} LEFT JOIN used ON used.id = s.id
    WHERE ${SELECTABLE} ${search}
    ORDER BY uses DESC, (s.kind = 'library') DESC, s."createdAt" DESC
    LIMIT ${TRENDING_SOUNDS}`;
  return rows.map(view);
}

// Âm thanh chọn được khi đăng (kiểm lại ở máy chủ).
export async function selectableSound(soundId: string): Promise<SoundView | null> {
  const rows = await db.$queryRaw<SoundRow[]>`
    SELECT s.id, s.kind, s.title, s.artist, u."displayName" AS "authorName", s.path AS "fileUrl", s."durationSec", 0 AS uses
    FROM ${FROM} WHERE s.id = ${soundId} AND ${SELECTABLE}`;
  return rows[0] ? view(rows[0]) : null;
}

// Trang /am-thanh/<id>: tên, số video dùng, lưới video (video gốc đứng đầu).
export async function soundPage(soundId: string, viewer: Viewer): Promise<SoundPage | null> {
  const sound = await db.sound.findUnique({ where: { id: soundId } });
  if (!sound) return null;
  const source = sound.sourceVideoId
    ? await db.video.findUnique({ where: { id: sound.sourceVideoId }, select: { authorId: true } })
    : null;
  const author = source
    ? await db.user.findUnique({ where: { id: source.authorId }, select: { displayName: true } })
    : null;
  const src = sound.sourceVideoId ?? '';
  const [rows, total, selectable] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
      WHERE v.status = 'ready' AND v.kind = 'video' AND v.visibility = 'public' AND u."lockedAt" IS NULL
        AND NOT u."isPrivate" AND (v."soundId" = ${soundId} OR v.id = ${src})
        AND ${notBlockedWith(viewer.userId, Prisma.sql`v."authorId"`)}
      ORDER BY (v.id = ${src}) DESC, v.score DESC, v."readyAt" DESC
      LIMIT 60`,
    db.video.count({
      where: { soundId, status: 'ready', visibility: 'public', authorId: { notIn: await privateUserIds() } },
    }),
    selectableSound(soundId),
  ]);
  return {
    sound: {
      ...view({
        id: sound.id,
        kind: sound.kind,
        title: sound.title,
        artist: sound.artist,
        authorName: author?.displayName ?? null,
        fileUrl: sound.path,
        durationSec: sound.durationSec,
        uses: total,
      }),
      status: sound.status === 'removed' ? 'removed' : 'active',
      selectable: Boolean(selectable),
      ownerId: source?.authorId ?? null,
      sourceVideoId: sound.sourceVideoId,
    },
    total,
    videos: await hydrateVideos(
      rows.map((r) => r.id),
      viewer,
    ),
  };
}

const soundKey = (id: string) => {
  const t = now();
  return `sounds/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${id}-${randomBytes(6).toString('hex')}.m4a`;
};

// Đổi sang AAC trong .m4a (tối đa 5 phút): cùng định dạng cho mọi âm thanh, trình duyệt nào cũng phát được.
async function toM4a(input: string, out: string, startSec = 0, maxSec = MAX_SOUND_SEC) {
  await runTool(
    'ffmpeg',
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...(startSec > 0 ? ['-ss', startSec.toFixed(3)] : []),
      '-i',
      input,
      '-t',
      String(maxSec),
      '-vn',
      '-map',
      '0:a:0',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-ar',
      '44100',
      '-movflags',
      '+faststart',
      out,
    ],
    STEP_TIMEOUT_MS,
  );
}

// Worker gọi sau khi xử lý xong video: tách "Âm thanh gốc – @tên". Chỉ video thường, công khai, cho phép dùng lại, có
// tiếng và không dùng âm thanh của người khác. Lỗi ở đây không làm hỏng video.
export async function createOriginalSound(
  video: {
    id: string;
    kind: string;
    visibility: string;
    allowRemix: boolean;
    soundId: string | null;
    duetOfId: string | null;
    stitchOfId: string | null;
  },
  input: { path: string; hasAudio: boolean; startSec?: number; maxSec?: number },
): Promise<string | null> {
  if (video.kind !== 'video' || video.visibility !== 'public' || !video.allowRemix || !input.hasAudio)
    return null;
  if (video.soundId || video.duetOfId || video.stitchOfId) return null;
  if (await db.sound.findUnique({ where: { sourceVideoId: video.id }, select: { id: true } })) return null;
  const work = path.join(env().PRIVATE_DIR, 'sound-work', randomBytes(8).toString('hex'));
  await mkdir(work, { recursive: true });
  try {
    const out = path.join(work, 'sound.m4a');
    await toM4a(input.path, out, input.startSec ?? 0, Math.min(MAX_SOUND_SEC, input.maxSec ?? MAX_SOUND_SEC));
    const p = await probe(out);
    if (!p.hasAudio || p.durationSec < 1) return null;
    const fileUrl = await imageStore().saveFile(soundKey(video.id), out);
    const sound = await db.sound.create({
      data: {
        kind: 'original',
        sourceVideoId: video.id,
        path: fileUrl,
        durationSec: p.durationSec,
        createdAt: now(),
      },
    });
    return sound.id;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export type LibraryResult =
  { ok: true; soundId: string } | { ok: false; error: 'INVALID' | 'TOO_LARGE' | 'TOO_LONG' | 'BAD_FORMAT' };

// CEO tải nhạc lên thư viện (MP3/M4A ≤ 10MB, ≤ 5 phút). File gốc ở thư mục tạm, gọi xong bên gọi tự xoá.
export async function addLibrarySound(
  adminId: string,
  input: { title: string; artist: string; path: string; bytes: number },
): Promise<LibraryResult> {
  const title = input.title.replace(/\s+/g, ' ').trim();
  const artist = input.artist.replace(/\s+/g, ' ').trim();
  if (!title || title.length > MAX_SOUND_TITLE || artist.length > MAX_SOUND_TITLE)
    return { ok: false, error: 'INVALID' };
  if (input.bytes > MAX_LIBRARY_BYTES) return { ok: false, error: 'TOO_LARGE' };
  const p = await probe(input.path).catch(() => null);
  if (!p?.hasAudio || p.video) return { ok: false, error: 'BAD_FORMAT' };
  if (p.durationSec > MAX_SOUND_SEC + 0.5) return { ok: false, error: 'TOO_LONG' };
  const work = path.join(env().PRIVATE_DIR, 'sound-work', randomBytes(8).toString('hex'));
  await mkdir(work, { recursive: true });
  try {
    const out = path.join(work, 'sound.m4a');
    await toM4a(input.path, out);
    const converted = await probe(out);
    const id = randomBytes(8).toString('hex');
    const fileUrl = await imageStore().saveFile(soundKey(id), out);
    const sound = await db.sound.create({
      data: {
        kind: 'library',
        title,
        artist: artist || null,
        path: fileUrl,
        durationSec: converted.durationSec,
        createdById: adminId,
        createdAt: now(),
      },
    });
    await audit({
      adminId,
      action: 'sound.add',
      targetType: 'sound',
      targetId: sound.id,
      after: { title, artist },
    });
    return { ok: true, soundId: sound.id };
  } catch {
    return { ok: false, error: 'BAD_FORMAT' };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// CEO gỡ / mở lại một âm thanh. Gỡ: không chọn mới được; video đã dùng vẫn phát (tiếng đã trộn vào file).
export async function setSoundStatus(
  adminId: string,
  soundId: string,
  status: 'active' | 'removed',
  reason: string | null,
): Promise<boolean> {
  const sound = await db.sound.findUnique({ where: { id: soundId } });
  if (!sound || sound.status === status) return false;
  await db.$transaction(async (tx) => {
    await tx.sound.update({ where: { id: soundId }, data: { status } });
    await audit(
      {
        adminId,
        action: status === 'removed' ? 'sound.remove' : 'sound.restore',
        targetType: 'sound',
        targetId: soundId,
        reason,
        before: { status: sound.status },
        after: { status },
      },
      tx,
    );
  });
  return true;
}

// Người đăng video gốc đặt lại tên âm thanh gốc (≤ 60 ký tự, không link). Để trống: quay về "Âm thanh gốc – @tên".
export async function renameSound(
  userId: string,
  soundId: string,
  title: string,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'INVALID' }> {
  const sound = await db.sound.findUnique({ where: { id: soundId } });
  const source = sound?.sourceVideoId
    ? await db.video.findUnique({ where: { id: sound.sourceVideoId }, select: { authorId: true } })
    : null;
  if (!sound || sound.kind !== 'original' || source?.authorId !== userId)
    return { ok: false, error: 'NOT_FOUND' };
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length > MAX_SOUND_TITLE || hasLink(clean)) return { ok: false, error: 'INVALID' };
  await db.sound.update({ where: { id: soundId }, data: { title: clean || null } });
  return { ok: true };
}

// Danh sách cho /admin/am-thanh: mới nhất trước, cả âm thanh đã gỡ.
export async function adminSounds(take = 100): Promise<(SoundView & { status: string; createdAt: Date })[]> {
  const rows = await db.$queryRaw<(SoundRow & { status: string; createdAt: Date })[]>`
    SELECT s.id, s.kind, s.title, s.artist, u."displayName" AS "authorName", s.path AS "fileUrl", s."durationSec",
      s.status, s."createdAt",
      (SELECT count(*)::int FROM "Video" x WHERE x."soundId" = s.id AND x.status = 'ready') AS uses
    FROM ${FROM}
    ORDER BY (s.kind = 'library') DESC, s."createdAt" DESC
    LIMIT ${take}`;
  return rows.map((r) => ({ ...view(r), status: r.status, createdAt: r.createdAt }));
}

// Trộn nhạc vào video khi xử lý. Giây âm thanh tính từ đầu video SAU khi cắt (người đăng nghe thử theo video đã cắt):
// trước khi cắt, nhạc phải lùi trimStart giây. Ra file cùng hình (chép nguyên), tiếng mới; worker chuyển mã tiếp như cũ.
export async function mixSound(
  input: string,
  soundPath: string,
  out: string,
  o: {
    hasAudio: boolean;
    durationSec: number;
    soundStartSec: number;
    trimStartSec: number;
    soundVolume: number; // 0–100
    originalVolume: number; // 0–100
  },
): Promise<void> {
  const seek = o.soundStartSec - o.trimStartSec;
  const delayMs = seek < 0 ? Math.round(-seek * 1000) : 0;
  const music = `[1:a]volume=${(o.soundVolume / 100).toFixed(2)}${delayMs ? `,adelay=${delayMs}|${delayMs}` : ''},aresample=44100,apad[m]`;
  const mix = o.hasAudio
    ? `[0:a:0]volume=${(o.originalVolume / 100).toFixed(2)},aresample=44100[o];[o][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`
    : `[m]anull[a]`;
  await runTool(
    'ffmpeg',
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      ...(seek > 0 ? ['-ss', seek.toFixed(3)] : []),
      '-i',
      soundPath,
      '-filter_complex',
      `${music};${mix}`,
      '-map',
      '0:v:0',
      '-map',
      '[a]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-t',
      o.durationSec.toFixed(3),
      out,
    ],
    STEP_TIMEOUT_MS,
  );
}
