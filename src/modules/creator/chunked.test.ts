import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { advanceClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { saveFeature } from '@/lib/features';
import { createUser } from '../../../tests/helpers/factories';
import {
  cleanupUploadSessions,
  completeUploadSession,
  MAX_OPEN_SESSIONS,
  openUploadSession,
  PART_SIZE,
  putUploadPart,
  uploadSessionStatus,
} from './chunked';
import { claimJob, processNextJob } from './jobs';
import { createVideoUpload, saveUpload } from './upload';

const FIX = 'tests/fixtures/videos';
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function oldUser() {
  const u = await createUser();
  await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - 5 * 86_400_000) } });
  return u;
}

describe('tải lên từng phần + video dài (SPEC-creator.md V5.1)', () => {
  it('mất phần giữa chừng rồi gửi tiếp vẫn ra file đúng; gửi trùng phần không hỏng file', async () => {
    await saveFeature('long_video', true, null);
    const u = await oldUser();
    const file = randomBytes(2 * PART_SIZE + 123);
    const opened = await openUploadSession(u.id, { name: 'dai.mp4', size: file.length, durationSec: 30 });
    if (!opened.ok) throw new Error(opened.error);
    expect(opened).toMatchObject({ partSize: PART_SIZE, parts: 3 });
    const part = (n: number) => Readable.from(file.subarray(n * PART_SIZE, (n + 1) * PART_SIZE));

    expect(await putUploadPart(u.id, opened.sessionId, 0, part(0))).toEqual({ ok: true, duplicate: false });
    expect(await putUploadPart(u.id, opened.sessionId, 2, part(2))).toEqual({ ok: true, duplicate: false });
    // Rớt mạng ở phần 1: trình duyệt hỏi lại danh sách đã nhận.
    expect(await uploadSessionStatus(u.id, opened.sessionId)).toMatchObject({ ok: true, received: [0, 2] });
    expect(await completeUploadSession(u.id, opened.sessionId)).toEqual({ ok: false, error: 'INCOMPLETE' });
    // Phần thiếu byte bị từ chối, không ghi.
    expect(
      await putUploadPart(u.id, opened.sessionId, 1, Readable.from(file.subarray(PART_SIZE, PART_SIZE + 10))),
    ).toEqual({
      ok: false,
      error: 'BAD_PART',
    });
    expect(await putUploadPart(u.id, opened.sessionId, 1, part(1))).toEqual({ ok: true, duplicate: false });
    expect(await putUploadPart(u.id, opened.sessionId, 1, part(1))).toEqual({ ok: true, duplicate: true });
    expect(await putUploadPart(u.id, opened.sessionId, 3, part(1))).toEqual({ ok: false, error: 'BAD_PART' });
    // Người khác không gửi được vào phiên của mình.
    const other = await oldUser();
    expect(await putUploadPart(other.id, opened.sessionId, 0, part(0))).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });

    const done = await completeUploadSession(u.id, opened.sessionId);
    if (!done.ok) throw new Error(done.error);
    const target = path.join(env().PRIVATE_DIR, 'video-uploads', u.id, `${done.uploadId}.bin`);
    expect(sha(await readFile(target))).toBe(sha(file));
    expect(existsSync(path.join(env().PRIVATE_DIR, 'video-chunks', opened.sessionId))).toBe(false);
    expect(await uploadSessionStatus(u.id, opened.sessionId)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it(`tối đa ${MAX_OPEN_SESSIONS} phiên đang mở; phiên quá 24 giờ bị xoá cùng file tạm`, async () => {
    await saveFeature('long_video', true, null);
    const u = await oldUser();
    const ids: string[] = [];
    for (let i = 0; i < MAX_OPEN_SESSIONS; i++) {
      const r = await openUploadSession(u.id, { name: `v${i}.mp4`, size: 1000, durationSec: 20 });
      if (!r.ok) throw new Error(r.error);
      ids.push(r.sessionId);
      await putUploadPart(u.id, r.sessionId, 0, Readable.from(randomBytes(1000)));
    }
    expect(await openUploadSession(u.id, { name: 'x.mp4', size: 1000, durationSec: 20 })).toEqual({
      ok: false,
      error: 'TOO_MANY_SESSIONS',
    });
    advanceClock({ hours: 25 });
    expect(await cleanupUploadSessions()).toBe(MAX_OPEN_SESSIONS);
    for (const id of ids) expect(existsSync(path.join(env().PRIVATE_DIR, 'video-chunks', id))).toBe(false);
    expect(await uploadSessionStatus(u.id, ids[0]!)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect((await openUploadSession(u.id, { name: 'moi.mp4', size: 1000, durationSec: 20 })).ok).toBe(true);
  });

  it('công tắc tắt thì không mở phiên; tài khoản dưới 3 ngày, quá dung lượng, quá thời lượng, ổ đầy bị từ chối', async () => {
    const u = await oldUser();
    expect(await openUploadSession(u.id, { name: 'a.mp4', size: 1000, durationSec: 75 })).toEqual({
      ok: false,
      error: 'DISABLED',
    });
    await saveFeature('long_video', true, null);
    const fresh = await createUser();
    expect(await openUploadSession(fresh.id, { name: 'a.mp4', size: 1000, durationSec: 75 })).toEqual({
      ok: false,
      error: 'ACCOUNT_TOO_NEW',
    });
    expect((await openUploadSession(fresh.id, { name: 'a.mp4', size: 1000, durationSec: 30 })).ok).toBe(true);
    expect(
      await openUploadSession(u.id, { name: 'a.mp4', size: 2048 * 1024 * 1024 + 1, durationSec: 30 }),
    ).toEqual({
      ok: false,
      error: 'TOO_LARGE',
    });
    expect(await openUploadSession(u.id, { name: 'a.mp4', size: 1000, durationSec: 3601 })).toEqual({
      ok: false,
      error: 'TOO_LONG',
    });
    expect(
      await openUploadSession(
        u.id,
        { name: 'a.mp4', size: 1000, durationSec: 75 },
        { freeRatio: async () => 0.1 },
      ),
    ).toEqual({ ok: false, error: 'STORAGE_FULL' });
    expect(await db.alertEvent.count({ where: { kind: 'storage_full' } })).toBe(1);
    // Đã đăng 119 phút video dài hôm nay: thêm 75 giây là vượt 120 phút.
    await db.video.create({
      data: { authorId: u.id, caption: 'dai', hashtags: [], status: 'ready', sourceSec: 119 * 60 },
    });
    expect(await openUploadSession(u.id, { name: 'a.mp4', size: 1000, durationSec: 75 })).toEqual({
      ok: false,
      error: 'LONG_DAILY_LIMIT',
    });
  });

  it(
    'video 75 giây: tài khoản mới bị từ chối; tài khoản ≥ 3 ngày vào hàng long, worker xử lý ra đủ 75 giây',
    { timeout: 90_000 },
    async () => {
      await saveFeature('long_video', true, null);
      const upload = async (userId: string) => {
        const saved = await saveUpload(userId, createReadStream(path.join(FIX, 'long-75s.mp4')));
        if (!saved.ok) throw new Error(saved.error);
        return createVideoUpload(userId, saved.uploadId, { caption: 'dài', productIds: [] });
      };
      const fresh = await createUser();
      expect(await upload(fresh.id)).toEqual({ ok: false, error: 'ACCOUNT_TOO_NEW' });
      const u = await oldUser();
      const r = await upload(u.id);
      if (!r.ok) throw new Error(r.error);
      expect(await db.videoJob.findUniqueOrThrow({ where: { videoId: r.videoId } })).toMatchObject({
        lane: 'long',
      });
      expect((await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).sourceSec).toBeCloseTo(75, 0);
      expect(await processNextJob()).toBe(true);
      const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
      expect(v.status).toBe('ready');
      expect(v.durationSec).toBeGreaterThan(74);
    },
  );

  it('hàng chờ: có việc short thì việc long không được lấy trước; mỗi lúc chỉ 1 việc long', async () => {
    const u = await createUser();
    const job = async (lane: string, minute: number) => {
      const v = await db.video.create({ data: { authorId: u.id, caption: lane, hashtags: [] } });
      return db.videoJob.create({
        data: {
          videoId: v.id,
          sourcePath: `/x/${v.id}`,
          lane,
          createdAt: new Date(Date.UTC(2026, 9, 1, 0, minute)),
        },
      });
    };
    const long1 = await job('long', 0);
    const long2 = await job('long', 1);
    const short1 = await job('short', 5);
    expect((await claimJob())?.id).toBe(short1.id);
    expect((await claimJob())?.id).toBe(long1.id);
    // long1 đang chạy: long2 phải chờ.
    expect(await claimJob()).toBeNull();
    const short2 = await job('short', 9);
    expect((await claimJob())?.id).toBe(short2.id);
    await db.videoJob.update({ where: { id: long1.id }, data: { status: 'done' } });
    expect((await claimJob())?.id).toBe(long2.id);
  });
});
