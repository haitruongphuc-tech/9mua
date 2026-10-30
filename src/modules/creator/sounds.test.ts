import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createUser } from '../../../tests/helpers/factories';
import { getVideo } from './feed';
import { processNextJob } from './jobs';
import {
  addLibrarySound,
  listSounds,
  MAX_LIBRARY_BYTES,
  renameSound,
  selectableSound,
  setSoundStatus,
  soundPage,
} from './sounds';
import { probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));
let tmp = '';
const ff = (...args: string[]) =>
  execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args]);

beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'sounds-'));
  // Video 2 giây không có tiếng, nhạc MP3 4 giây, nhạc dài 5 phút 2 giây.
  ff(
    '-f',
    'lavfi',
    '-t',
    '2',
    '-i',
    'testsrc2=size=320x568:rate=30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    path.join(tmp, 'silent.mp4'),
  );
  ff(
    '-f',
    'lavfi',
    '-t',
    '4',
    '-i',
    'sine=frequency=660:sample_rate=44100',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '96k',
    path.join(tmp, 'nhac.mp3'),
  );
  ff(
    '-f',
    'lavfi',
    '-t',
    '302',
    '-i',
    'anullsrc=r=8000:cl=mono',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '8k',
    path.join(tmp, 'dai.mp3'),
  );
});

async function post(
  userId: string,
  file: string,
  options: Parameters<typeof createVideoUpload>[2]['options'] = {},
): Promise<string> {
  const saved = await saveUpload(userId, createReadStream(file));
  if (!saved.ok) throw new Error(saved.error);
  const r = await createVideoUpload(userId, saved.uploadId, { caption: 'âm thanh', productIds: [], options });
  if (!r.ok) throw new Error(r.error);
  expect(await processNextJob()).toBe(true);
  return r.videoId;
}

async function library(title = 'Nhạc Tết', artist = 'Ban nhạc 9MUA'): Promise<string> {
  const admin = await createUser();
  const file = path.join(tmp, 'nhac.mp3');
  const r = await addLibrarySound(admin.id, { title, artist, path: file, bytes: (await stat(file)).size });
  if (!r.ok) throw new Error(r.error);
  return r.soundId;
}

describe('âm thanh (SPEC-creator.md V5.6 mục 2)', () => {
  it(
    'video công khai cho dùng lại, có tiếng → tự có "âm thanh gốc"; riêng tư, tắt dùng lại, không tiếng thì không',
    { timeout: 90_000 },
    async () => {
      const u = await createUser({ displayName: 'Chủ tiếng' });
      const pub = await post(u.id, 'tests/fixtures/videos/landscape.mp4');
      const sound = await db.sound.findUniqueOrThrow({ where: { sourceVideoId: pub } });
      expect(sound).toMatchObject({ kind: 'original', title: null, status: 'active' });
      expect(sound.durationSec).toBeGreaterThan(1.5);
      expect((await probe(fileOf(sound.path))).hasAudio).toBe(true);
      expect((await selectableSound(sound.id))?.authorName).toBe('Chủ tiếng');

      const priv = await post(u.id, 'tests/fixtures/videos/landscape.mp4', { visibility: 'private' });
      const noRemix = await post(u.id, 'tests/fixtures/videos/landscape.mp4', { allowRemix: false });
      const silent = await post(u.id, path.join(tmp, 'silent.mp4'));
      expect(await db.sound.count({ where: { sourceVideoId: { in: [priv, noRemix, silent] } } })).toBe(0);

      // Người đăng tắt dùng lại sau khi đăng: không chọn mới được nữa.
      await db.video.update({ where: { id: pub }, data: { allowRemix: false } });
      expect(await selectableSound(sound.id)).toBeNull();
    },
  );

  it(
    'CEO tải nhạc: MP3/M4A ≤ 10MB, ≤ 5 phút, đổi sang M4A; gỡ thì không chọn mới được',
    { timeout: 60_000 },
    async () => {
      const admin = await createUser();
      const mp3 = path.join(tmp, 'nhac.mp3');
      expect(await addLibrarySound(admin.id, { title: '', artist: '', path: mp3, bytes: 100 })).toEqual({
        ok: false,
        error: 'INVALID',
      });
      expect(
        await addLibrarySound(admin.id, { title: 'To', artist: '', path: mp3, bytes: MAX_LIBRARY_BYTES + 1 }),
      ).toEqual({ ok: false, error: 'TOO_LARGE' });
      expect(
        await addLibrarySound(admin.id, {
          title: 'Dài',
          artist: '',
          path: path.join(tmp, 'dai.mp3'),
          bytes: 300_000,
        }),
      ).toEqual({ ok: false, error: 'TOO_LONG' });
      expect(
        await addLibrarySound(admin.id, {
          title: 'Hình',
          artist: '',
          path: 'tests/fixtures/videos/landscape.mp4',
          bytes: 100_000,
        }),
      ).toEqual({ ok: false, error: 'BAD_FORMAT' });
      const id = await library('Nhạc gỡ');
      const s = await db.sound.findUniqueOrThrow({ where: { id } });
      expect(s).toMatchObject({
        kind: 'library',
        title: 'Nhạc gỡ',
        artist: 'Ban nhạc 9MUA',
        status: 'active',
      });
      expect(s.path).toMatch(/^\/uploads\/sounds\/.+\.m4a$/);
      expect(s.durationSec).toBeGreaterThan(3.5);
      expect(await setSoundStatus(admin.id, id, 'removed', 'bản quyền')).toBe(true);
      expect(await selectableSound(id)).toBeNull();
      expect(
        await db.adminAuditLog.count({
          where: { targetId: id, action: { in: ['sound.add', 'sound.remove'] } },
        }),
      ).toBe(2); // thêm + gỡ
    },
  );

  it(
    'đăng video dùng âm thanh: máy chủ trộn tiếng (video không tiếng cũng có nhạc), âm thanh bị gỡ thì từ chối',
    { timeout: 90_000 },
    async () => {
      const u = await createUser();
      const soundId = await library();
      const silent = await post(u.id, path.join(tmp, 'silent.mp4'), {
        sound: { id: soundId, startSec: 1, volume: 80, originalVolume: 100 },
      });
      const v = await db.video.findUniqueOrThrow({ where: { id: silent } });
      expect(v).toMatchObject({
        status: 'ready',
        soundId,
        soundStartSec: 1,
        soundVolume: 80,
        originalVolume: 100,
      });
      const out = await probe(fileOf(v.fileUrl!));
      expect(out.hasAudio).toBe(true);
      expect(out.durationSec).toBeGreaterThan(1.8);
      expect(out.durationSec).toBeLessThan(2.3);
      // Video dùng âm thanh của người khác thì không tạo âm thanh gốc mới.
      expect(await db.sound.count({ where: { sourceVideoId: silent } })).toBe(0);

      const withVoice = await post(u.id, 'tests/fixtures/videos/landscape.mp4', {
        sound: { id: soundId, startSec: 0, volume: 50, originalVolume: 30 },
        editSpec: { trimStart: 0.5 },
      });
      const w = await db.video.findUniqueOrThrow({ where: { id: withVoice } });
      expect(w.status).toBe('ready');
      expect((await probe(fileOf(w.fileUrl!))).hasAudio).toBe(true);

      const saved = await saveUpload(u.id, createReadStream('tests/fixtures/videos/landscape.mp4'));
      if (!saved.ok) throw new Error(saved.error);
      const meta = (sound: unknown) => ({ caption: 'x', productIds: [], options: { sound } as never });
      expect(
        await createVideoUpload(
          u.id,
          saved.uploadId,
          meta({ id: soundId, startSec: 99, volume: 50, originalVolume: 50 }),
        ),
      ).toEqual({ ok: false, error: 'SOUND_INVALID' });
      expect(
        await createVideoUpload(
          u.id,
          saved.uploadId,
          meta({ id: soundId, startSec: 0, volume: 101, originalVolume: 50 }),
        ),
      ).toEqual({ ok: false, error: 'SOUND_INVALID' });
      expect(
        await createVideoUpload(
          u.id,
          saved.uploadId,
          meta({ id: 'khong-co', startSec: 0, volume: 50, originalVolume: 50 }),
        ),
      ).toEqual({ ok: false, error: 'SOUND_INVALID' });
      const admin = await createUser();
      await setSoundStatus(admin.id, soundId, 'removed', null);
      expect(
        await createVideoUpload(
          u.id,
          saved.uploadId,
          meta({ id: soundId, startSec: 0, volume: 50, originalVolume: 50 }),
        ),
      ).toEqual({ ok: false, error: 'SOUND_INVALID' });
      // Video đã đăng vẫn phát.
      expect((await db.video.findUniqueOrThrow({ where: { id: silent } })).status).toBe('ready');
      await stat(fileOf(v.fileUrl!));
    },
  );

  it(
    'thịnh hành: xếp theo số video dùng 7 ngày; tìm theo tên; trang âm thanh đếm video, người đăng đổi tên',
    { timeout: 60_000 },
    async () => {
      const owner = await createUser({ displayName: 'Người hát rong' });
      const other = await createUser();
      const tag = `t${Date.now()}`;
      const a = await library(`Nhạc A ${tag}`);
      const b = await library(`Nhạc B ${tag}`);
      const t = now();
      const old = new Date(t.getTime() - 8 * 86_400_000);
      const use = (soundId: string, readyAt: Date) =>
        db.video.create({
          data: {
            authorId: other.id,
            status: 'ready',
            soundId,
            readyAt,
            fileUrl: '/uploads/x.mp4',
            createdAt: readyAt,
          },
        });
      await use(a, t);
      await use(b, t);
      await use(b, t);
      for (let i = 0; i < 3; i++) await use(a, old); // dùng nhiều nhưng đã quá 7 ngày
      const found = await listSounds(tag);
      expect(found.map((s) => s.id)).toEqual([b, a]);
      expect(found[0]!.uses).toBe(2);
      expect((await listSounds()).map((s) => s.id)).toEqual(expect.arrayContaining([a, b]));

      const src = await db.video.create({
        data: { authorId: owner.id, status: 'ready', readyAt: t, fileUrl: '/uploads/y.mp4', createdAt: t },
      });
      const orig = await db.sound.create({
        data: {
          kind: 'original',
          sourceVideoId: src.id,
          path: '/uploads/sounds/y.m4a',
          durationSec: 5,
          createdAt: t,
        },
      });
      expect((await listSounds('hát rong')).map((s) => s.id)).toEqual([orig.id]);
      await use(orig.id, t);
      const page = await soundPage(orig.id, {});
      expect(page?.sound).toMatchObject({
        kind: 'original',
        authorName: 'Người hát rong',
        selectable: true,
        ownerId: owner.id,
      });
      expect(page?.total).toBe(1);
      expect(page?.videos[0]?.id).toBe(src.id); // video gốc đứng đầu

      expect(await renameSound(other.id, orig.id, 'Tên lạ')).toEqual({ ok: false, error: 'NOT_FOUND' });
      expect(await renameSound(owner.id, orig.id, 'xem https://x.co')).toEqual({
        ok: false,
        error: 'INVALID',
      });
      expect(await renameSound(owner.id, orig.id, '  Bài ca  bán hàng ')).toEqual({ ok: true });
      expect((await db.sound.findUniqueOrThrow({ where: { id: orig.id } })).title).toBe('Bài ca bán hàng');
      // Feed hiện tên âm thanh của video gốc.
      expect((await getVideo(src.id, {}))?.sound).toMatchObject({ id: orig.id, title: 'Bài ca bán hàng' });
    },
  );
});
