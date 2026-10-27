import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AiSlideshow } from '@prisma/client';
import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { imageStore } from '@/lib/media/image-store';
import { runTool } from '@/lib/media/run-tool';
import { isStudioOwner } from './studio';

// Video 10 giây từ ảnh AI (SPEC-ai.md mục 5): worker ghép bằng ffmpeg (ảnh zoom chậm trên nền mờ, chuyển cảnh mờ
// dần), không tốn phí AI. Web không có ffmpeg nên chỉ xếp hàng; worker (hoặc route E2E) xử lý.
export const MAX_SLIDES = 4;
export const MAX_SLIDESHOWS_PER_DAY = 10;
export const SLIDESHOW_SEC = 10;
const MAX_ATTEMPTS = 2;
const STALE_LOCK_MS = 10 * 60_000;
const FFMPEG_TIMEOUT_MS = 3 * 60_000;

export async function startSlideshow(
  userId: string,
  imageIds: string[],
): Promise<
  { ok: true; jobId: string } | { ok: false; error: 'NOT_OWNER' | 'INVALID_INPUT' | 'DAILY_LIMIT' }
> {
  if (!(await isStudioOwner(userId))) return { ok: false, error: 'NOT_OWNER' };
  const ids = [...new Set(imageIds)];
  if (ids.length === 0 || ids.length !== imageIds.length || ids.length > MAX_SLIDES)
    return { ok: false, error: 'INVALID_INPUT' };
  if ((await db.aiImage.count({ where: { id: { in: ids }, userId } })) !== ids.length)
    return { ok: false, error: 'INVALID_INPUT' };
  const today = await db.aiSlideshow.count({ where: { userId, createdAt: { gte: startOfVnDay() } } });
  if (today >= MAX_SLIDESHOWS_PER_DAY) return { ok: false, error: 'DAILY_LIMIT' };
  const job = await db.aiSlideshow.create({ data: { userId, imageIds: ids, createdAt: now() } });
  return { ok: true, jobId: job.id };
}

export type SlideshowStatus = { status: 'queued' | 'running' | 'done' | 'failed'; url: string | null };

export async function slideshowStatus(userId: string, jobId: string): Promise<SlideshowStatus | null> {
  const job = await db.aiSlideshow.findFirst({ where: { id: jobId, userId } });
  if (!job) return null;
  return { status: job.status as SlideshowStatus['status'], url: job.url };
}

// Lấy 1 việc bằng FOR UPDATE SKIP LOCKED (như hàng đợi video): nhiều worker không lấy trùng.
async function claim(): Promise<AiSlideshow | null> {
  const staleBefore = new Date(now().getTime() - STALE_LOCK_MS);
  const rows = await db.$queryRaw<AiSlideshow[]>`
    UPDATE "AiSlideshow" SET status = 'running', "lockedAt" = ${now()}, attempts = attempts + 1, "updatedAt" = ${now()}
    WHERE id = (
      SELECT id FROM "AiSlideshow"
      WHERE status = 'queued' OR (status = 'running' AND "lockedAt" < ${staleBefore})
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  return rows[0] ?? null;
}

// Xử lý 1 video trong hàng đợi. Trả về false nếu không còn việc.
export async function processNextSlideshow(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;
  const work = path.join(env().PRIVATE_DIR, 'ai-work', job.id);
  try {
    const images = await db.aiImage.findMany({ where: { id: { in: job.imageIds }, userId: job.userId } });
    const store = imageStore();
    const files = job.imageIds
      .map((id) => images.find((i) => i.id === id))
      .map((i) => (i ? store.localPath(i.url) : null));
    if (files.length === 0 || files.some((f) => !f)) throw new Error('Ảnh không còn trên máy chủ');
    await mkdir(work, { recursive: true });
    const out = path.join(work, 'out.mp4');
    await runTool('ffmpeg', slideshowArgs(files as string[], out), FFMPEG_TIMEOUT_MS);
    const t = now();
    const key = `ai/slides/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(12).toString('base64url')}.mp4`;
    const url = await store.saveFile(key, out);
    await db.aiSlideshow.update({ where: { id: job.id }, data: { status: 'done', url, error: null } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[ai] ghép video ${job.id} lỗi: ${message.slice(0, 300)}`);
    await db.aiSlideshow.update({
      where: { id: job.id },
      data: { status: job.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', error: message.slice(0, 500) },
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return true;
}

// Mỗi ảnh: nền là chính ảnh đó phóng to, làm mờ và tối đi; ảnh vuông 720×720 ở giữa, zoom chậm 8%. Các cảnh nối bằng
// hiệu ứng mờ dần 0,5 giây; tổng đúng 10 giây, 30 khung/giây, không có tiếng.
export function slideshowArgs(files: string[], out: string): string[] {
  const n = files.length;
  const fade = n > 1 ? 0.5 : 0;
  const each = (SLIDESHOW_SEC + (n - 1) * fade) / n;
  const frames = Math.round(each * 30);
  const inputs = files.flatMap((f) => ['-loop', '1', '-framerate', '30', '-t', each.toFixed(3), '-i', f]);
  const scenes = files.map(
    (_, i) =>
      `[${i}:v]split[a${i}][b${i}];` +
      `[a${i}]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,gblur=sigma=40,eq=brightness=-0.15[bg${i}];` +
      `[b${i}]scale=1440:1440,zoompan=z='1+0.08*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x720:fps=30[fg${i}];` +
      `[bg${i}][fg${i}]overlay=0:280:shortest=1,setsar=1,format=yuv420p[v${i}]`,
  );
  const joins: string[] = [];
  let last = 'v0';
  for (let i = 1; i < n; i += 1) {
    const label = i === n - 1 ? 'v' : `x${i}`;
    joins.push(
      `[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${(i * (each - fade)).toFixed(3)}[${label}]`,
    );
    last = label;
  }
  const graph = [...scenes, ...joins].join(';') + (n === 1 ? ';[v0]null[v]' : '');
  return [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    graph,
    '-map',
    '[v]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-t',
    String(SLIDESHOW_SEC),
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    out,
  ];
}
