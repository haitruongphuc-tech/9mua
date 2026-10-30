import { createReadStream } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { toggleFollow } from '@/modules/social';
import { publishScheduledVideos } from '@/server/creator';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import { getFeed, getVideo } from './feed';
import { processNextJob } from './jobs';
import {
  changePostTiming,
  editVideo,
  expireDrafts,
  MAX_DRAFTS,
  MAX_PROFILE_PINS,
  pinToProfile,
} from './posting';
import { getCreatorProfile } from './profile';
import { createVideoUpload, saveUpload } from './upload';

const FIX = 'tests/fixtures/videos';

async function uploadFile(userId: string) {
  const saved = await saveUpload(userId, createReadStream(path.join(FIX, 'landscape.mp4')));
  if (!saved.ok) throw new Error(saved.error);
  return saved.uploadId;
}

async function row(authorId: string, data: Record<string, unknown> = {}) {
  return db.video.create({
    data: {
      authorId,
      caption: 'v',
      hashtags: [],
      status: 'ready',
      fileUrl: '/uploads/v.mp4',
      readyAt: new Date(),
      ...data,
    },
  });
}

const followNotices = (userId: string) =>
  db.notification.count({ where: { userId, title: '@notify.followNewVideo' } });

describe('nháp, hẹn giờ, địa điểm, ghim, nhãn AI, sửa sau khi đăng (SPEC-creator.md V5.3)', () => {
  it(
    'lưu nháp: xử lý xong thành nháp, không lên feed, không báo người follow; bấm đăng thì lên feed và báo',
    { timeout: 60_000 },
    async () => {
      const author = await createUser();
      const fan = await createUser();
      await toggleFollow(fan.id, author.id);
      const r = await createVideoUpload(author.id, await uploadFile(author.id), {
        caption: 'nháp #thu',
        productIds: [],
        options: { draft: true },
      });
      if (!r.ok) throw new Error(r.error);
      expect(await processNextJob()).toBe(true);
      expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
        status: 'draft',
        draft: true,
        readyAt: null,
      });
      expect(await getVideo(r.videoId, { userId: fan.id })).toBeNull();
      expect(await followNotices(fan.id)).toBe(0);

      expect(await changePostTiming(fan.id, r.videoId, { mode: 'now' })).toEqual({
        ok: false,
        error: 'NOT_FOUND',
      });
      expect(await changePostTiming(author.id, r.videoId, { mode: 'now' })).toEqual({ ok: true });
      expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
        status: 'ready',
        draft: false,
      });
      expect(await getVideo(r.videoId, { userId: fan.id })).not.toBeNull();
      expect(await followNotices(fan.id)).toBe(1);
    },
  );

  it('hẹn giờ 15 phút – 30 ngày; tới giờ mới lên feed và mới báo; đổi giờ, huỷ hẹn thì không đăng', async () => {
    setClock(new Date('2026-11-01T03:00:00Z'));
    const author = await createUser();
    const fan = await createUser();
    await toggleFollow(fan.id, author.id);

    const upload = await uploadFile(author.id);
    for (const at of [new Date('2026-11-01T03:10:00Z'), new Date('2026-12-02T03:00:00Z')])
      expect(
        await createVideoUpload(author.id, upload, {
          caption: '',
          productIds: [],
          options: { publishAt: at },
        }),
      ).toEqual({ ok: false, error: 'SCHEDULE_INVALID' });

    const a = await row(author.id, {
      caption: 'hẹn A',
      status: 'scheduled',
      readyAt: null,
      publishAt: new Date('2026-11-01T05:00:00Z'),
    });
    const b = await row(author.id, {
      caption: 'hẹn B',
      status: 'scheduled',
      readyAt: null,
      publishAt: new Date('2026-11-01T05:00:00Z'),
    });
    expect(await publishScheduledVideos()).toBe(0);
    expect((await getFeed({ userId: fan.id })).items).toHaveLength(0);

    // Đổi giờ B sang muộn hơn, huỷ hẹn A (thành nháp).
    expect(
      await changePostTiming(author.id, b.id, { mode: 'schedule', at: new Date('2026-11-01T03:05:00Z') }),
    ).toEqual({ ok: false, error: 'SCHEDULE_INVALID' });
    expect(
      await changePostTiming(author.id, b.id, { mode: 'schedule', at: new Date('2026-11-02T05:00:00Z') }),
    ).toEqual({ ok: true });
    expect(await changePostTiming(author.id, a.id, { mode: 'draft' })).toEqual({ ok: true });
    expect(await db.video.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      status: 'draft',
      publishAt: null,
    });

    advanceClock({ hours: 3 });
    expect(await publishScheduledVideos()).toBe(0);
    advanceClock({ days: 1 });
    expect(await publishScheduledVideos()).toBe(1);
    expect(await publishScheduledVideos()).toBe(0); // không đăng hai lần
    expect(await db.video.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
      status: 'ready',
      readyAt: new Date('2026-11-02T05:00:00Z'),
    });
    expect((await getFeed({ userId: fan.id })).items.map((v) => v.caption)).toEqual(['hẹn B']);
    expect(await followNotices(fan.id)).toBe(1);
  });

  it(`tối đa ${MAX_DRAFTS} nháp; nháp quá 90 ngày tự xoá, báo trước 7 ngày`, async () => {
    setClock(new Date('2026-11-01T03:00:00Z'));
    const u = await createUser();
    await db.video.createMany({
      data: Array.from({ length: MAX_DRAFTS }, (_, i) => ({
        authorId: u.id,
        caption: `nháp ${i}`,
        hashtags: [],
        status: 'draft',
        draft: true,
        createdAt: new Date('2026-10-31T03:00:00Z'), // hôm qua: không tính vào 10 video mỗi ngày
      })),
    });
    expect(
      await createVideoUpload(u.id, await uploadFile(u.id), {
        caption: '',
        productIds: [],
        options: { draft: true },
      }),
    ).toEqual({ ok: false, error: 'DRAFT_LIMIT' });

    advanceClock({ days: 81 }); // nháp 82 ngày tuổi
    expect(await expireDrafts()).toEqual({ warned: 0, deleted: 0 });
    advanceClock({ days: 2 });
    expect(await expireDrafts()).toEqual({ warned: MAX_DRAFTS, deleted: 0 });
    expect(await expireDrafts()).toEqual({ warned: 0, deleted: 0 }); // chỉ báo một lần
    expect(await db.notification.count({ where: { userId: u.id, title: '@notify.draftExpiring' } })).toBe(
      MAX_DRAFTS,
    );
    advanceClock({ days: 7 });
    expect(await expireDrafts()).toEqual({ warned: 0, deleted: MAX_DRAFTS });
    expect(await db.video.count({ where: { authorId: u.id, status: 'deleted' } })).toBe(MAX_DRAFTS);
  });

  it(`ghim tối đa ${MAX_PROFILE_PINS} video lên trang cá nhân, video ghim đứng đầu lưới`, async () => {
    const u = await createUser();
    const other = await createUser();
    const vs = [];
    for (let i = 0; i < 5; i++)
      vs.push(await row(u.id, { caption: `v${i}`, readyAt: new Date(Date.UTC(2026, 9, 1 + i)) }));
    expect(await pinToProfile(other.id, vs[0]!.id, true)).toEqual({ ok: false, error: 'NOT_FOUND' });
    for (const v of vs.slice(0, 3)) expect(await pinToProfile(u.id, v.id, true)).toEqual({ ok: true });
    expect(await pinToProfile(u.id, vs[3]!.id, true)).toEqual({ ok: false, error: 'PIN_LIMIT' });
    expect(await pinToProfile(u.id, vs[1]!.id, false)).toEqual({ ok: true });
    expect(await pinToProfile(u.id, vs[3]!.id, true)).toEqual({ ok: true });
    const grid = (await getCreatorProfile(u.id, other.id))!.videos;
    expect(grid.map((v) => [v.caption, v.pinned])).toEqual([
      ['v3', true],
      ['v2', true],
      ['v0', true],
      ['v4', false],
      ['v1', false],
    ]);
  });

  it('sửa sau khi đăng: chú thích, hashtag tính lại, sản phẩm, địa điểm, nhãn AI; hiện "Đã chỉnh sửa"', async () => {
    const seller = await createSeller({ active: true });
    const p1 = await createProduct(seller.kiotId, { name: 'Xoài' });
    const p2 = await createProduct(seller.kiotId, { name: 'Bưởi' });
    const u = seller.user;
    const r = await createVideoUpload(u.id, await uploadFile(u.id), {
      caption: 'ban dau #cu',
      productIds: [p1.id],
      options: { province: 'da-nang', placeName: 'Chợ Hàn' },
    });
    if (!r.ok) throw new Error(r.error);
    await db.video.update({
      where: { id: r.videoId },
      data: { status: 'ready', fileUrl: '/uploads/v.mp4', readyAt: new Date() },
    });
    expect(await db.video.findUniqueOrThrow({ where: { id: r.videoId } })).toMatchObject({
      province: 'da-nang',
      placeName: 'Chợ Hàn',
      aiGenerated: false,
      editedAt: null,
    });

    expect(await editVideo(u.id, r.videoId, { province: 'khong-co' })).toEqual({
      ok: false,
      error: 'PLACE_INVALID',
    });
    expect(await editVideo(u.id, r.videoId, { placeName: 'x'.repeat(61) })).toEqual({
      ok: false,
      error: 'PLACE_INVALID',
    });
    expect(
      await editVideo(u.id, r.videoId, {
        caption: 'da sua #moi #xoai',
        productIds: [p2.id],
        aiGenerated: true,
        visibility: 'followers',
      }),
    ).toEqual({ ok: true });
    const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId }, include: { products: true } });
    expect(v).toMatchObject({ hashtags: ['moi', 'xoai'], aiGenerated: true, visibility: 'followers' });
    expect(v.products.map((p) => p.productId)).toEqual([p2.id]);
    expect(v.editedAt).not.toBeNull();
    const feedItem = (await getVideo(r.videoId, { userId: u.id }))!;
    expect(feedItem).toMatchObject({ edited: true, aiGenerated: true, place: 'Đà Nẵng · Chợ Hàn' });

    // Video làm từ AI Studio: nhãn AI không gỡ được.
    const studio = await row(u.id, { aiGenerated: true, aiStudio: true });
    expect(await editVideo(u.id, studio.id, { aiGenerated: false })).toEqual({
      ok: false,
      error: 'AI_LOCKED',
    });
    expect(await editVideo(u.id, r.videoId, { aiGenerated: false })).toEqual({ ok: true });
    // Người khác không sửa được.
    const other = await createUser();
    expect(await editVideo(other.id, r.videoId, { caption: 'hack' })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });
});
