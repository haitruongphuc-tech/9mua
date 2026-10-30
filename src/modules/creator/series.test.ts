import { describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { getFeed } from './feed';
import {
  createSeries,
  notifyNewEpisode,
  saveWatchProgress,
  seriesPage,
  setEpisode,
  toggleSeriesFollow,
  updateSeries,
  watchHome,
} from './series';

const input = (over: Record<string, string> = {}) => ({
  title: 'Mẹ chồng nàng dâu',
  description: 'Phim ngắn gia đình',
  genre: 'gia-dinh',
  status: 'ongoing',
  ...over,
});

const episode = (authorId: string, over: Record<string, unknown> = {}) =>
  db.video.create({
    data: {
      authorId,
      status: 'ready',
      caption: 'tập',
      fileUrl: '/uploads/x.mp4',
      durationSec: 60,
      readyAt: now(),
      views: 5,
      ...over,
    },
  });

describe('Watch: phim ngắn nhiều tập (SPEC-creator.md V5.9)', () => {
  it('tạo phim: tên ≤ 80, mô tả ≤ 500, đúng thể loại; gắn tập 1–200 không trùng; chỉ chủ phim sửa được', async () => {
    const owner = await createUser({ displayName: 'Đạo diễn' });
    const other = await createUser();
    expect(await createSeries(owner.id, input({ title: 'x'.repeat(81) }))).toEqual({
      ok: false,
      error: 'INVALID',
    });
    expect(await createSeries(owner.id, input({ genre: 'kinh-di' }))).toEqual({
      ok: false,
      error: 'INVALID',
    });
    expect(await createSeries(owner.id, input({ description: 'xem https://x.co' }))).toEqual({
      ok: false,
      error: 'INVALID',
    });
    const r = await createSeries(owner.id, input());
    if (!r.ok) throw new Error(r.error);
    expect(await updateSeries(other.id, r.seriesId, input({ status: 'complete' }))).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await updateSeries(owner.id, r.seriesId, input({ status: 'complete' }))).toEqual({ ok: true });

    const v1 = await episode(owner.id);
    const v2 = await episode(owner.id);
    const theirs = await episode(other.id);
    expect(await setEpisode(owner.id, v1.id, { seriesId: r.seriesId, episodeNo: 0 })).toEqual({
      ok: false,
      error: 'EPISODE_INVALID',
    });
    expect(await setEpisode(owner.id, v1.id, { seriesId: r.seriesId, episodeNo: 201 })).toEqual({
      ok: false,
      error: 'EPISODE_INVALID',
    });
    expect(await setEpisode(owner.id, v1.id, { seriesId: r.seriesId, episodeNo: 1 })).toEqual({ ok: true });
    expect(await setEpisode(owner.id, v2.id, { seriesId: r.seriesId, episodeNo: 1 })).toEqual({
      ok: false,
      error: 'EPISODE_TAKEN',
    });
    expect(await setEpisode(other.id, theirs.id, { seriesId: r.seriesId, episodeNo: 2 })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(
      await setEpisode(owner.id, v2.id, { seriesId: r.seriesId, episodeNo: 2, watchOnly: true }),
    ).toEqual({
      ok: true,
    });
    const s = await db.series.findUniqueOrThrow({ where: { id: r.seriesId } });
    expect(s).toMatchObject({ episodeCount: 2, status: 'complete' });

    // "Chỉ hiện trong Watch": tập 2 không lên feed, tập 1 vẫn lên.
    const feed = await getFeed({}, undefined, { limit: 50 });
    expect(feed.items.map((x) => x.id)).toContain(v1.id);
    expect(feed.items.map((x) => x.id)).not.toContain(v2.id);
    const page = await seriesPage(r.seriesId, {});
    expect(page?.episodes.map((e) => e.episodeNo)).toEqual([1, 2]);
    expect(page?.videos.map((v) => v.id)).toEqual([v1.id, v2.id]);
  });

  it('lưu phim, thông báo tập mới, nhớ chỗ đang xem, đánh dấu đã xem ở 90%; /watch có 3 hàng', async () => {
    const owner = await createUser();
    const fan = await createUser();
    const r = await createSeries(owner.id, input({ title: `Phim ${Date.now()}` }));
    if (!r.ok) throw new Error(r.error);
    const v1 = await episode(owner.id, { seriesId: r.seriesId, episodeNo: 1 });
    const v2 = await episode(owner.id, { seriesId: r.seriesId, episodeNo: 2 });
    const priv = await episode(owner.id, { seriesId: r.seriesId, episodeNo: 3, visibility: 'private' });

    expect(await toggleSeriesFollow(fan.id, r.seriesId)).toEqual({ ok: true, following: true });
    expect(await notifyNewEpisode(v2.id)).toBe(1);
    expect(await notifyNewEpisode(priv.id)).toBe(0); // tập riêng tư: không báo
    expect(await db.notification.count({ where: { userId: fan.id } })).toBeGreaterThanOrEqual(1);

    expect(await saveWatchProgress(fan.id, v1.id, 30)).toEqual({ ok: true, watched: false });
    expect(await saveWatchProgress(fan.id, v1.id, 55)).toEqual({ ok: true, watched: true });
    expect(await saveWatchProgress(fan.id, v2.id, 12.6)).toEqual({ ok: true, watched: false });
    const page = await seriesPage(r.seriesId, { userId: fan.id });
    expect(page?.following).toBe(true);
    expect(page?.resume).toEqual({ videoId: v2.id, second: 12 });
    expect(page?.episodes.map((e) => [e.episodeNo, e.watched])).toEqual([
      [1, true],
      [2, false],
    ]); // tập riêng tư không hiện với người khác

    const home = await watchHome({ userId: fan.id });
    expect(home.latest.map((s) => s.id)).toContain(r.seriesId);
    expect(home.popular.map((s) => s.id)).toContain(r.seriesId);
    expect(home.following.map((s) => s.id)).toEqual([r.seriesId]);
    expect(await toggleSeriesFollow(fan.id, r.seriesId)).toEqual({ ok: true, following: false });
  });
});
