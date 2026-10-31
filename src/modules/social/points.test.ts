import { describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { saveFeature } from '@/lib/features';
import { createUser } from '../../../tests/helpers/factories';
import { toggleFollow } from './follow';
import { heartVideo } from './hearts';
import { exchangePoints, pointBalance, revokeLockedPoints } from './points';

const DAY = 86_400_000;
const aged = async (days = 10, name?: string) => {
  const u = await createUser({ displayName: name });
  return db.user.update({ where: { id: u.id }, data: { createdAt: new Date(now().getTime() - days * DAY) } });
};
const video = (authorId: string) =>
  db.video.create({ data: { authorId, status: 'ready', fileUrl: '/uploads/x.mp4', readyAt: now() } });

describe('điểm thưởng (SPEC-social.md V5.6)', () => {
  it('tim +5 lần đầu; bỏ tim rồi tim lại không cộng; tài khoản dưới 3 ngày không có điểm; tim video của mình không có', async () => {
    setClock(new Date('2026-10-31T03:00:00Z'));
    try {
      const author = await aged();
      const fan = await aged();
      const young = await aged(1);
      const v = await video(author.id);
      expect((await heartVideo(fan.id, v.id, 'toggle')) as { points?: unknown }).toMatchObject({
        points: { points: 5 },
      });
      await heartVideo(fan.id, v.id, 'toggle'); // bỏ tim
      await heartVideo(fan.id, v.id, 'toggle'); // tim lại
      expect(await pointBalance(fan.id)).toBe(5);
      await heartVideo(young.id, v.id, 'toggle');
      expect(await pointBalance(young.id)).toBe(0);
      const own = await video(fan.id);
      await heartVideo(fan.id, own.id, 'toggle');
      expect(await pointBalance(fan.id)).toBe(5);
    } finally {
      resetClock();
    }
  });

  it('chuỗi: tim 2 ngày liền thì ngày thứ 3 điểm tim ×2; trần 200 điểm mỗi ngày', async () => {
    setClock(new Date('2026-10-20T03:00:00Z'));
    try {
      const author = await aged(30);
      const fan = await aged(30);
      for (let d = 0; d < 3; d++) {
        await heartVideo(fan.id, (await video(author.id)).id, 'toggle');
        advanceClock({ days: 1 });
      }
      advanceClock({ days: -1 });
      const rows = await db.pointEntry.findMany({ where: { userId: fan.id }, orderBy: { createdAt: 'asc' } });
      expect(rows.map((r) => r.points)).toEqual([5, 5, 10]);
      advanceClock({ days: 1 });
      for (let i = 0; i < 25; i++) await heartVideo(fan.id, (await video(author.id)).id, 'toggle');
      const today = await db.pointEntry.aggregate({
        where: { userId: fan.id, createdAt: { gte: new Date(now().getTime() - 3_600_000) } },
        _sum: { points: true },
      });
      expect(today._sum.points).toBe(200);
    } finally {
      resetClock();
    }
  });

  it('follow +10; follow nhau lần đầu +20 cho cả hai; khoá tài khoản thì thu hồi bằng dòng trừ', async () => {
    resetClock();
    const a = await aged();
    const b = await aged();
    await toggleFollow(a.id, b.id);
    expect(await pointBalance(a.id)).toBe(10);
    await toggleFollow(b.id, a.id);
    expect(await pointBalance(b.id)).toBe(30);
    expect(await pointBalance(a.id)).toBe(30);
    await db.user.update({ where: { id: a.id }, data: { lockedAt: now() } });
    expect(await revokeLockedPoints()).toBeGreaterThanOrEqual(1);
    expect(await pointBalance(a.id)).toBe(0);
    expect(await revokeLockedPoints()).toBe(0); // không thu hồi 2 lần
  });

  it('đổi điểm ra xu (tắt sẵn): 1.000 điểm = 1 xu, 1 lần mỗi ngày, có dòng xu cùng mã tham chiếu', async () => {
    resetClock();
    const u = await aged(30);
    expect(await exchangePoints(u.id)).toEqual({ ok: false, error: 'OFF' });
    await saveFeature('points_exchange', true, null);
    try {
      expect(await exchangePoints(u.id)).toEqual({ ok: false, error: 'TOO_FEW' });
      await db.pointEntry.create({
        data: {
          userId: u.id,
          kind: 'like',
          points: 2500,
          refType: 'test',
          refId: 'seed',
          vnDay: '2026-10-01',
          createdAt: now(),
        },
      });
      expect(await exchangePoints(u.id)).toEqual({ ok: true, xu: 2, points: 2000 });
      expect(await exchangePoints(u.id)).toEqual({ ok: false, error: 'ONCE_A_DAY' });
      expect(await pointBalance(u.id)).toBe(500);
      const xu = await db.xuEntry.findFirstOrThrow({ where: { userId: u.id, kind: 'points_exchange' } });
      expect(xu.amount).toBe(2);
      // Sổ điểm chỉ thêm: không sửa, không xoá được.
      await expect(db.pointEntry.deleteMany({ where: { userId: u.id } })).rejects.toThrow();
    } finally {
      await saveFeature('points_exchange', false, null);
    }
  });
});
