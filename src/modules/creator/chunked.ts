import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, stat, statfs, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Transform, Writable, type Readable } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { checkLongVideo, SHORT_MAX_SEC, videoLimits, type LongVideoError } from './limits';
import { MAX_VIDEOS_PER_DAY, newUploadTarget, videosToday } from './upload';

// Tải video lên từng phần 8MB (SPEC-creator.md V5.1 mục 3, tự viết, không thêm thư viện). Rớt mạng thì trình duyệt hỏi
// danh sách phần đã nhận rồi gửi tiếp. Đủ phần thì ghép thành file như đường tải một lần, trả uploadId cho createVideoUpload.
export const PART_SIZE = 8 * 1024 * 1024;
export const MAX_OPEN_SESSIONS = 3;
export const SESSION_TTL_MS = 24 * 3_600_000;
export const MIN_FREE_RATIO = 0.15; // ổ VPS còn dưới 15% và chưa bật kho ngoài: không nhận video dài

const SESSION_ID = /^[a-f0-9]{32}$/;
const chunkDir = (sessionId: string) => path.join(env().PRIVATE_DIR, 'video-chunks', sessionId);
const partFile = (sessionId: string, n: number) => path.join(chunkDir(sessionId), `${n}.part`);

export async function diskFreeRatio(dir = env().PRIVATE_DIR): Promise<number> {
  await mkdir(dir, { recursive: true });
  const s = await statfs(dir);
  return s.blocks > 0 ? s.bavail / s.blocks : 1;
}

export type OpenSessionResult =
  | { ok: true; sessionId: string; partSize: number; parts: number }
  | {
      ok: false;
      error: 'DISABLED' | 'TOO_LARGE' | 'DAILY_LIMIT' | 'TOO_MANY_SESSIONS' | 'STORAGE_FULL' | LongVideoError;
    };

export async function openUploadSession(
  userId: string,
  input: { name: string; size: number; durationSec?: number | null },
  deps: { freeRatio?: () => Promise<number> } = {},
): Promise<OpenSessionResult> {
  const limits = await videoLimits();
  if (!limits.long) return { ok: false, error: 'DISABLED' };
  const size = Math.floor(Number(input.size));
  if (!Number.isFinite(size) || size <= 0 || size > limits.maxBytes) return { ok: false, error: 'TOO_LARGE' };
  const durationSec = Number(input.durationSec);
  const long = Number.isFinite(durationSec) && durationSec > SHORT_MAX_SEC + 0.5;
  if (long) {
    const error = await checkLongVideo(userId, durationSec, limits);
    if (error) return { ok: false, error };
  }
  if ((await videosToday(userId)) >= MAX_VIDEOS_PER_DAY) return { ok: false, error: 'DAILY_LIMIT' };
  const open = await db.videoUploadSession.count({
    where: { userId, status: 'open', expiresAt: { gt: now() } },
  });
  if (open >= MAX_OPEN_SESSIONS) return { ok: false, error: 'TOO_MANY_SESSIONS' };
  if (long && !(await isFeatureOn('external_storage'))) {
    const free = await (deps.freeRatio ?? diskFreeRatio)();
    if (free < MIN_FREE_RATIO) {
      await alertCeo(
        'storage_full',
        `Ổ đĩa VPS chỉ còn ${Math.round(free * 100)}% trống nên đang từ chối video dài. Bật kho video ngoài hoặc dọn ổ.`,
      );
      return { ok: false, error: 'STORAGE_FULL' };
    }
  }
  const session = await db.videoUploadSession.create({
    data: {
      id: randomBytes(16).toString('hex'),
      userId,
      fileName: String(input.name ?? '').slice(0, 200),
      size: BigInt(size),
      durationSec: Number.isFinite(durationSec) ? durationSec : null,
      partSize: PART_SIZE,
      parts: Math.ceil(size / PART_SIZE),
      createdAt: now(),
      expiresAt: new Date(now().getTime() + SESSION_TTL_MS),
    },
  });
  await mkdir(chunkDir(session.id), { recursive: true, mode: 0o750 });
  return { ok: true, sessionId: session.id, partSize: session.partSize, parts: session.parts };
}

async function openSession(userId: string, sessionId: string) {
  if (!SESSION_ID.test(sessionId)) return null;
  const s = await db.videoUploadSession.findFirst({ where: { id: sessionId, userId } });
  return s && s.status === 'open' && s.expiresAt > now() ? s : null;
}

const expectedBytes = (s: { size: bigint; partSize: number; parts: number }, n: number) =>
  n < s.parts - 1 ? s.partSize : Number(s.size) - s.partSize * (s.parts - 1);

async function receivedParts(sessionId: string): Promise<number[]> {
  const files = await readdir(chunkDir(sessionId)).catch(() => [] as string[]);
  return files
    .map((f) => /^(\d+)\.part$/.exec(f)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

export async function uploadSessionStatus(
  userId: string,
  sessionId: string,
): Promise<
  { ok: true; parts: number; partSize: number; received: number[] } | { ok: false; error: 'NOT_FOUND' }
> {
  const s = await openSession(userId, sessionId);
  if (!s) return { ok: false, error: 'NOT_FOUND' };
  return { ok: true, parts: s.parts, partSize: s.partSize, received: await receivedParts(s.id) };
}

class PartTooLarge extends Error {}

// Nhận một phần. Phần đã có đủ byte thì bỏ qua (gửi trùng không hỏng file). Ghi ra file tạm rồi đổi tên.
export async function putUploadPart(
  userId: string,
  sessionId: string,
  n: number,
  body: Readable,
): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: 'NOT_FOUND' | 'BAD_PART' }> {
  const s = await openSession(userId, sessionId);
  const drain = async () => {
    await pipeline(body, new Writable({ write: (_c, _e, done) => done() })).catch(() => {});
  };
  if (!s) {
    await drain();
    return { ok: false, error: 'NOT_FOUND' };
  }
  if (!Number.isInteger(n) || n < 0 || n >= s.parts) {
    await drain();
    return { ok: false, error: 'BAD_PART' };
  }
  const expected = expectedBytes(s, n);
  const target = partFile(s.id, n);
  if ((await stat(target).catch(() => null))?.size === expected) {
    await drain();
    return { ok: true, duplicate: true };
  }
  const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`;
  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      if (size > expected) return done(new PartTooLarge());
      done(null, chunk);
    },
  });
  try {
    await mkdir(chunkDir(s.id), { recursive: true, mode: 0o750 });
    await pipeline(body, limiter, createWriteStream(tmp, { flags: 'wx', mode: 0o640 }));
  } catch (e) {
    await unlink(tmp).catch(() => {});
    if (e instanceof PartTooLarge) return { ok: false, error: 'BAD_PART' };
    throw e;
  }
  if (size !== expected) {
    await unlink(tmp).catch(() => {});
    return { ok: false, error: 'BAD_PART' };
  }
  await rename(tmp, target);
  return { ok: true, duplicate: false };
}

// Đủ phần: ghép theo thứ tự vào file tải lên (như đường tải một lần), xoá phần, đóng phiên.
export async function completeUploadSession(
  userId: string,
  sessionId: string,
): Promise<{ ok: true; uploadId: string } | { ok: false; error: 'NOT_FOUND' | 'INCOMPLETE' }> {
  const s = await openSession(userId, sessionId);
  if (!s) return { ok: false, error: 'NOT_FOUND' };
  const received = new Set(await receivedParts(s.id));
  for (let n = 0; n < s.parts; n++) {
    if (!received.has(n) || (await stat(partFile(s.id, n))).size !== expectedBytes(s, n))
      return { ok: false, error: 'INCOMPLETE' };
  }
  // Đánh dấu trước để hai lần bấm cùng lúc không ghép hai lần.
  const { count } = await db.videoUploadSession.updateMany({
    where: { id: s.id, status: 'open' },
    data: { status: 'assembling' },
  });
  if (count !== 1) return { ok: false, error: 'NOT_FOUND' };
  const { uploadId, target } = await newUploadTarget(userId);
  const out = createWriteStream(target, { flags: 'wx', mode: 0o640 });
  try {
    for (let n = 0; n < s.parts; n++)
      for await (const chunk of createReadStream(partFile(s.id, n)))
        if (!out.write(chunk)) await once(out, 'drain');
    out.end();
    await finished(out);
  } catch (e) {
    out.destroy();
    await unlink(target).catch(() => {});
    await db.videoUploadSession.update({ where: { id: s.id }, data: { status: 'open' } });
    throw e;
  }
  if (BigInt((await stat(target)).size) !== s.size) {
    await unlink(target).catch(() => {});
    await db.videoUploadSession.update({ where: { id: s.id }, data: { status: 'open' } });
    return { ok: false, error: 'INCOMPLETE' };
  }
  await rm(chunkDir(s.id), { recursive: true, force: true });
  await db.videoUploadSession.update({ where: { id: s.id }, data: { status: 'done', uploadId } });
  return { ok: true, uploadId };
}

// Phiên quá 24 giờ: xoá file tạm (chạy mỗi 5 phút).
export async function cleanupUploadSessions(): Promise<number> {
  const stale = await db.videoUploadSession.findMany({
    where: { status: { in: ['open', 'assembling'] }, expiresAt: { lte: now() } },
    select: { id: true },
    take: 500,
  });
  for (const s of stale) {
    await rm(chunkDir(s.id), { recursive: true, force: true });
    await db.videoUploadSession.update({ where: { id: s.id }, data: { status: 'expired' } });
  }
  return stale.length;
}
