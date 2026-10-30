import { readdir, stat, statfs } from 'node:fs/promises';
import path from 'node:path';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { externalStore, localStore } from '@/lib/media/image-store';
import { SHORT_MAX_SEC } from './limits';
import { listFiles } from './renditions';

const DAY = 86_400_000;
const LOCAL_PREFIX = '/uploads/videos/';
const HLS_MASTER = '/master.m3u8';

export type MigrateResult =
  { ok: true; moved: number; skipped: number; remaining: number } | { ok: false; error: 'NO_STORAGE' };

// Mọi file trên VPS của một video: bản chính (MP4, hoặc cả thư mục HLS), ảnh bìa, 3 ảnh gợi ý, ảnh xem trước, MP4 480p.
async function localFilesOf(v: {
  fileUrl: string | null;
  posterUrl: string | null;
  posterChoices: string[];
  previewUrl: string | null;
  renditions: { path: string }[];
}): Promise<{ urls: string[]; hlsDir: string | null } | null> {
  const urls = new Set<string>();
  let hlsDir: string | null = null;
  if (v.fileUrl?.endsWith(HLS_MASTER)) {
    hlsDir = v.fileUrl.slice(0, -HLS_MASTER.length);
    const dir = localStore().localPath(hlsDir);
    if (!dir) return null;
    for (const f of await listFiles(dir).catch(() => [])) urls.add(`${hlsDir}/${f.rel}`);
    if (!urls.has(v.fileUrl)) return null;
  } else if (v.fileUrl) urls.add(v.fileUrl);
  for (const u of [v.posterUrl, v.previewUrl, ...v.posterChoices, ...v.renditions.map((r) => r.path)])
    if (u?.startsWith(LOCAL_PREFIX)) urls.add(u);
  return { urls: [...urls], hlsDir };
}

// Lệnh `npm run media:migrate` (SPEC-creator.md V5.1 mục 9): chuyển dần video cũ trên VPS lên kho ngoài. Chạy lại được.
// Chỉ đổi link và xoá bản trên VPS khi MỌI file của video đã lên kho và đọc lại khớp dung lượng.
export async function migrateVideosToExternal(
  opts: { limit?: number; log?: (line: string) => void } = {},
): Promise<MigrateResult> {
  const ext = externalStore();
  if (!ext) return { ok: false, error: 'NO_STORAGE' };
  const local = localStore();
  const log = opts.log ?? (() => {});
  const where = { fileUrl: { startsWith: LOCAL_PREFIX }, status: { not: 'deleted' } };
  const videos = await db.video.findMany({
    where,
    include: { renditions: true },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 50,
  });
  let moved = 0;
  let skipped = 0;
  for (const v of videos) {
    const files = await localFilesOf(v);
    const map = new Map<string, string>();
    let ok = files !== null;
    for (const url of files?.urls ?? []) {
      const file = local.localPath(url);
      const size = file ? (await stat(file).catch(() => null))?.size : undefined;
      if (!file || size === undefined) {
        ok = false;
        break;
      }
      const extUrl = await ext.upload(url.slice('/uploads/'.length), file);
      if ((await ext.sizeOf(extUrl)) !== size) {
        ok = false;
        break;
      }
      map.set(url, extUrl);
    }
    if (!ok || !files) {
      skipped += 1;
      log(`Bỏ qua video ${v.id}: thiếu file trên VPS hoặc kho ngoài đọc lại không khớp dung lượng`);
      continue;
    }
    const swap = (u: string | null) => (u ? (map.get(u) ?? u) : u);
    await db.$transaction([
      db.video.update({
        where: { id: v.id },
        data: {
          fileUrl: swap(v.fileUrl),
          posterUrl: swap(v.posterUrl),
          posterChoices: v.posterChoices.map((u) => swap(u)!),
          previewUrl: swap(v.previewUrl),
        },
      }),
      ...v.renditions.map((r) =>
        db.videoRendition.update({ where: { id: r.id }, data: { path: swap(r.path)! } }),
      ),
    ]);
    // Link đã đổi sang kho ngoài: giờ mới xoá bản trên VPS.
    if (files.hlsDir) await local.removeDir(files.hlsDir);
    for (const url of files.urls)
      if (!files.hlsDir || !url.startsWith(`${files.hlsDir}/`)) await local.remove(url);
    moved += 1;
    log(`Đã chuyển video ${v.id} (${files.urls.length} file)`);
  }
  const remaining = await db.video.count({ where });
  return { ok: true, moved, skipped, remaining };
}

async function walk(
  dir: string,
  since: number,
): Promise<{ bytes: number; files: number; recentBytes: number }> {
  const out = { bytes: 0, files: 0, recentBytes: 0 };
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(full, since);
      out.bytes += sub.bytes;
      out.files += sub.files;
      out.recentBytes += sub.recentBytes;
    } else {
      const s = await stat(full).catch(() => null);
      if (!s) continue;
      out.bytes += s.size;
      out.files += 1;
      if (s.mtimeMs >= since) out.recentBytes += s.size;
    }
  }
  return out;
}

export type StorageStats = {
  disk: { totalBytes: number; freeBytes: number };
  local: { bytes: number; files: number; last30Bytes: number };
  external: { on: boolean; bytes: number; files: number; last30Bytes: number } | null; // null: chưa có khoá
  longVideos: number;
  next30Bytes: number; // ước tính GB tháng tới theo tốc độ 30 ngày qua
};

// Trang CEO "Dung lượng" (SPEC-creator.md V5.1 mục 10).
export async function storageStats(): Promise<StorageStats> {
  const since = now().getTime() - 30 * DAY;
  const root = env().UPLOAD_DIR;
  const fs = await statfs(root).catch(() => null);
  const localUse = await walk(path.join(root, 'videos'), since);
  const ext = externalStore();
  let external: StorageStats['external'] = null;
  if (ext) {
    const objects = (await ext.listObjects('videos/').catch(() => [])).flat();
    external = {
      on: await isFeatureOn('external_storage'),
      bytes: objects.reduce((sum, o) => sum + o.size, 0),
      files: objects.length,
      last30Bytes: objects
        .filter((o) => (o.lastModified?.getTime() ?? 0) >= since)
        .reduce((sum, o) => sum + o.size, 0),
    };
  }
  const longVideos = await db.video.count({
    where: { sourceSec: { gt: SHORT_MAX_SEC + 0.5 }, status: { notIn: ['deleted', 'failed'] } },
  });
  return {
    disk: { totalBytes: fs ? fs.blocks * fs.bsize : 0, freeBytes: fs ? fs.bavail * fs.bsize : 0 },
    local: { bytes: localUse.bytes, files: localUse.files, last30Bytes: localUse.recentBytes },
    external,
    longVideos,
    next30Bytes: localUse.recentBytes + (external?.last30Bytes ?? 0),
  };
}
