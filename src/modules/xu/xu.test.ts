import { describe, expect, it } from 'vitest';
import '@/server/live';
import { advanceClock, now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setSetting } from '@/lib/settings';
import {
  authorizeMedia,
  endLive,
  fakeMedia,
  heartbeat,
  startLive,
  stopLive,
  syncWithMediaServer,
} from '@/modules/live';
import { createUser } from '../../../tests/helpers/factories';
import {
  getXuBalance,
  getXuHistory,
  monthlyXuUsage,
  qualifiedViewers,
  revokeXu,
  rewardLive,
  xuForViewers,
} from './index';

async function oldUser(days = 10) {
  const u = await createUser();
  await db.user.update({
    where: { id: u.id },
    data: { createdAt: new Date(now().getTime() - days * 86_400_000) },
  });
  return u;
}

async function goLive(userId: string) {
  const r = await startLive(userId, { title: 'Live bán hàng' });
  if (!r.ok) throw new Error(r.error);
  const live = await db.liveSession.findUniqueOrThrow({ where: { id: r.liveId } });
  await authorizeMedia({ action: 'publish', path: live.mediaPath, token: r.publishToken });
  fakeMedia.setReady(live.mediaPath, true);
  await syncWithMediaServer();
  return r.liveId;
}

// n người xem, mỗi người xem liên tục `sec` giây, mạng khác nhau (trừ khi truyền ip).
async function watch(liveId: string, users: { id: string }[], sec: number, ip?: string) {
  for (const [i, u] of users.entries()) await heartbeat(liveId, { userId: u.id }, ip ?? `10.0.${i}.1`);
  for (let t = 20; t <= sec; t += 20) {
    advanceClock({ seconds: 20 });
    for (const [i, u] of users.entries()) await heartbeat(liveId, { userId: u.id }, ip ?? `10.0.${i}.1`);
  }
}

async function viewers(n: number) {
  return Promise.all(Array.from({ length: n }, () => oldUser()));
}

describe('mức thưởng', () => {
  it('9 → 0, 10 → 10, 24 → 10, 25 → 30, 50 → 80', () => {
    const tiers: [number, number][] = [
      [10, 10],
      [25, 30],
      [50, 80],
    ];
    expect([9, 10, 24, 25, 50, 80].map((n) => xuForViewers(n, tiers))).toEqual([0, 10, 10, 30, 80, 80]);
  });
});

describe('người xem hợp lệ', () => {
  it('tài khoản 2 ngày tuổi, xem dưới 60 giây, người phát, tài khoản thứ 4 cùng mạng: không tính', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const liveId = await goLive(host.id);
    const ok = await viewers(2);
    const young = await oldUser(2);
    await watch(liveId, [...ok, young], 60);
    const sameNet = await viewers(4);
    await watch(liveId, sameNet, 60, '203.0.113.9');
    const short = await oldUser();
    await heartbeat(liveId, { userId: short.id }, '10.9.9.9');
    advanceClock({ seconds: 40 });
    await heartbeat(liveId, { userId: short.id }, '10.9.9.9');
    await heartbeat(liveId, { userId: host.id }, '10.8.8.8');
    // 2 người đủ điều kiện + 3 trong 4 tài khoản cùng mạng.
    expect(await qualifiedViewers(liveId)).toBe(5);
  });
});

describe('thưởng xu khi buổi live kết thúc (SPEC-live.md phần 2)', () => {
  it('đủ 15 phút và 10 người xem hợp lệ: cộng 10 xu, báo người phát; buổi thứ 2 trong ngày không được thưởng', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const liveId = await goLive(host.id);
    await watch(liveId, await viewers(10), 60);
    advanceClock({ minutes: 15 });
    await endLive(liveId, host.id); // hook ở src/server/live.ts xét thưởng
    expect(await getXuBalance(host.id)).toBe(10);
    expect(await db.notification.count({ where: { userId: host.id, title: '@notify.xuReward' } })).toBe(1);
    expect((await getXuHistory(host.id)).items[0]).toMatchObject({ amount: 10, kind: 'live_reward', liveId });

    const second = await goLive(host.id);
    await watch(second, await viewers(10), 60);
    advanceClock({ minutes: 15 });
    await endLive(second, host.id);
    expect(await getXuBalance(host.id)).toBe(10);
    expect(
      await db.notification.count({ where: { userId: host.id, title: '@notify.xuSkipped.DAILY_LIMIT' } }),
    ).toBe(1);
  });

  it('buổi 14 phút không thưởng; CEO dừng vì vi phạm không thưởng', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const liveId = await goLive(host.id);
    await watch(liveId, await viewers(10), 60);
    advanceClock({ minutes: 13 });
    await endLive(liveId, host.id);
    expect(await rewardLive(liveId)).toEqual({ skipped: 'TOO_SHORT' });
    const other = await oldUser();
    const l2 = await goLive(other.id);
    await watch(l2, await viewers(10), 60);
    advanceClock({ minutes: 20 });
    await stopLive(l2, host.id, 'Vi phạm');
    expect(await getXuBalance(other.id)).toBe(0);
  });

  it('gần hết ngân sách tháng thì không cộng, báo CEO', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    await setSetting(
      'xu_rules_json',
      JSON.stringify({ tiers: [[10, 10]], monthlyBudget: 5, minMinutes: 15 }),
      null,
    );
    const host = await oldUser();
    const liveId = await goLive(host.id);
    await watch(liveId, await viewers(10), 60);
    advanceClock({ minutes: 16 });
    await endLive(liveId, host.id);
    expect(await getXuBalance(host.id)).toBe(0);
    expect(await db.alertEvent.count({ where: { kind: 'xu_budget' } })).toBe(1);
    expect(await monthlyXuUsage()).toEqual({ used: 0, budget: 5 });
  });

  it('hai worker cùng xét thưởng một buổi: chỉ 1 dòng thưởng', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const liveId = await goLive(host.id);
    await watch(liveId, await viewers(10), 60);
    advanceClock({ minutes: 16 });
    await db.liveSession.update({ where: { id: liveId }, data: { status: 'ended', endedAt: now() } });
    const results = await Promise.all([rewardLive(liveId), rewardLive(liveId)]);
    expect(results.filter((r) => 'credited' in r)).toHaveLength(1);
    expect(await db.xuEntry.count({ where: { liveId } })).toBe(1);
  });

  it('sổ xu chỉ thêm; CEO thu hồi tạo dòng âm, số dư có thể âm', async () => {
    const user = await oldUser();
    const admin = await createUser();
    await db.xuEntry.create({
      data: { userId: user.id, amount: 30, kind: 'live_reward', rewardDay: '2026-10-27' },
    });
    const row = await db.xuEntry.findFirstOrThrow();
    await expect(db.xuEntry.update({ where: { id: row.id }, data: { amount: 999 } })).rejects.toThrow();
    await expect(db.xuEntry.delete({ where: { id: row.id } })).rejects.toThrow();
    expect(await revokeXu(user.id, 50, admin.id, 'Cày người xem ảo')).toEqual({ ok: true });
    expect(await revokeXu(user.id, 5, admin.id, '')).toEqual({ ok: false });
    expect(await getXuBalance(user.id)).toBe(-20);
    expect(await db.adminAuditLog.count({ where: { action: 'xu.revoke' } })).toBe(1);
  });
});
