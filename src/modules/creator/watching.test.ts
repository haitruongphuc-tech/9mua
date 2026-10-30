import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { recordViews } from './engagement';
import { getFeed } from './feed';
import {
  clearViewHistory,
  markNotInterested,
  MAX_NOT_INTERESTED,
  removeFromHistory,
  setHistoryOff,
  viewHistory,
} from './watching';

async function video(authorId: string, caption: string, score: number) {
  return db.video.create({
    data: {
      authorId,
      caption,
      hashtags: [],
      status: 'ready',
      fileUrl: '/uploads/v.mp4',
      readyAt: new Date(),
      score,
    },
  });
}

describe('Không quan tâm + lịch sử đã xem (SPEC-creator.md V5.2)', () => {
  it('ẩn video đó; 30 ngày điểm các video cùng người đăng nhân 0,2 với người xem này', async () => {
    setClock(new Date('2026-11-01T03:00:00Z'));
    const viewer = await createUser();
    const a = await createUser();
    const b = await createUser();
    const a1 = await video(a.id, 'A1', 10);
    await video(a.id, 'A2', 9);
    await video(b.id, 'B1', 5);
    const order = async () => (await getFeed({ userId: viewer.id })).items.map((v) => v.caption);
    expect((await order()).slice(0, 3)).toEqual(['A1', 'A2', 'B1']);
    expect(await markNotInterested({ userId: viewer.id }, a1.id)).toEqual({ ok: true });
    // A1 biến mất; A2 (9 × 0,2 = 1,8) xuống dưới B1 (5).
    expect((await order()).filter((c) => c !== 'A2' || true)).not.toContain('A1');
    const now = await order();
    expect(now.indexOf('B1')).toBeLessThan(now.indexOf('A2'));
    // Người khác không bị ảnh hưởng.
    const other = await createUser();
    expect((await getFeed({ userId: other.id })).items.map((v) => v.caption).slice(0, 3)).toEqual([
      'A1',
      'A2',
      'B1',
    ]);
    // Sau 30 ngày thì hết hạ điểm (video đã bấm vẫn ẩn).
    advanceClock({ days: 31 });
    const later = (await getFeed({ userId: viewer.id })).items.map((v) => v.caption);
    expect(later).not.toContain('A1');
    expect(later.indexOf('A2')).toBeLessThan(later.indexOf('B1'));
  });

  it(`mỗi người giữ tối đa ${MAX_NOT_INTERESTED} dòng, dòng cũ nhất tự xoá`, async () => {
    const viewer = await createUser();
    const author = await createUser();
    await db.videoNotInterested.createMany({
      data: Array.from({ length: MAX_NOT_INTERESTED }, (_, i) => ({
        viewerKey: `u:${viewer.id}`,
        videoId: `cu-${i}`,
        authorId: author.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })),
    });
    const v = await video(author.id, 'mới', 1);
    await markNotInterested({ userId: viewer.id }, v.id);
    expect(await db.videoNotInterested.count({ where: { viewerKey: `u:${viewer.id}` } })).toBe(
      MAX_NOT_INTERESTED,
    );
    expect(
      await db.videoNotInterested.findUnique({
        where: { viewerKey_videoId: { viewerKey: `u:${viewer.id}`, videoId: 'cu-0' } },
      }),
    ).toBeNull();
  });

  it('lịch sử: ghi video xem ≥ 3 giây, mới nhất trước, 90 ngày; xoá không đổi lượt xem; tắt thì không ghi', async () => {
    setClock(new Date('2026-11-01T03:00:00Z'));
    const u = await createUser();
    const author = await createUser();
    const v1 = await video(author.id, 'một', 1);
    const v2 = await video(author.id, 'hai', 1);
    await recordViews({ userId: u.id }, [{ videoId: v1.id, watchedSeconds: 2 }]); // chưa đủ 3 giây
    expect((await viewHistory(u.id)).items).toEqual([]);
    await recordViews({ userId: u.id }, [{ videoId: v1.id, watchedSeconds: 5 }]);
    advanceClock({ minutes: 1 });
    await recordViews({ userId: u.id }, [{ videoId: v2.id, watchedSeconds: 5 }]);
    expect((await viewHistory(u.id)).items.map((v) => v.caption)).toEqual(['hai', 'một']);

    await removeFromHistory(u.id, v2.id);
    expect((await viewHistory(u.id)).items.map((v) => v.caption)).toEqual(['một']);
    expect((await db.video.findUniqueOrThrow({ where: { id: v2.id } })).views).toBe(1);

    advanceClock({ days: 91 });
    expect((await viewHistory(u.id)).items).toEqual([]);

    await clearViewHistory(u.id);
    await setHistoryOff(u.id, true);
    await recordViews({ userId: u.id }, [{ videoId: v1.id, watchedSeconds: 5 }]);
    expect(await db.viewHistory.count({ where: { userId: u.id } })).toBe(0);
  });
});
