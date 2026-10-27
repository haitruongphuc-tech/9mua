import { describe, expect, it } from 'vitest';
import { advanceClock, now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setSetting } from '@/lib/settings';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import { sendChat, sendHearts, banFromChat, hideChat, pinProduct, hasLink } from './chat';
import { fakeMedia } from './media';
import { banUserFromLive, reportLive, stopLive } from './moderation';
import { endLive, startLive } from './session';
import { getLiveForViewer, listLiveNow } from './view';
import { authorizeMedia, heartbeat, syncWithMediaServer } from './viewers';
import { verifyViewToken } from './tokens';

async function oldUser() {
  const u = await createUser();
  await db.user.update({
    where: { id: u.id },
    data: { createdAt: new Date(now().getTime() - 10 * 86_400_000) },
  });
  return u;
}

async function goLive(userId: string, title = 'Bán mực một nắng') {
  const r = await startLive(userId, { title });
  if (!r.ok) throw new Error(r.error);
  const live = await db.liveSession.findUniqueOrThrow({ where: { id: r.liveId } });
  expect(await authorizeMedia({ action: 'publish', path: live.mediaPath, token: r.publishToken })).toBe(true);
  fakeMedia.setReady(live.mediaPath, true);
  await syncWithMediaServer();
  return { ...r, mediaPath: live.mediaPath };
}

describe('bắt đầu live (SPEC-live.md mục 1–3)', () => {
  it('tài khoản dưới 3 ngày, đủ 2 buổi, đang live, bị cấm đều bị chặn', async () => {
    const young = await createUser();
    expect(await startLive(young.id, { title: 'x' })).toEqual({ ok: false, error: 'ACCOUNT_TOO_NEW' });
    const [a, b, c] = [await oldUser(), await oldUser(), await oldUser()];
    expect((await startLive(a.id, { title: 'A' })).ok).toBe(true);
    expect(await startLive(a.id, { title: 'A2' })).toEqual({ ok: false, error: 'ALREADY_LIVE' });
    expect((await startLive(b.id, { title: 'B' })).ok).toBe(true);
    expect(await startLive(c.id, { title: 'C' })).toEqual({ ok: false, error: 'LIVE_FULL' });
    const banned = await oldUser();
    await banUserFromLive(banned.id, c.id, 7, 'Nội dung xấu');
    expect(await startLive(banned.id, { title: 'x' })).toEqual({ ok: false, error: 'LIVE_BANNED' });
    expect(await startLive(c.id, { title: '' })).toEqual({ ok: false, error: 'INVALID_INPUT' });
  });

  it('người không có Kiot vẫn phát và ghim sản phẩm Kiot khác; sản phẩm Kiot hết hạn thì không ghim được', async () => {
    const host = await oldUser();
    const shop = await createSeller({ active: true });
    const p = await createProduct(shop.kiotId, { name: 'Mực' });
    const r = await startLive(host.id, { title: 'Review mực', pinProductId: p.id });
    expect(r.ok).toBe(true);
    const expired = await createSeller();
    const q = await createProduct(expired.kiotId);
    if (!r.ok) return;
    expect(await pinProduct(r.liveId, host.id, q.id)).toEqual({ ok: false });
    expect(await pinProduct(r.liveId, host.id, null)).toEqual({ ok: true });
    expect(await startLive((await oldUser()).id, { title: 'x', pinProductId: q.id })).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
    });
  });
});

describe('quyền phát / xem với MediaMTX', () => {
  it('mã phát đúng buổi, dùng 1 lần, hết hạn 2 phút; sai mã hay sai buổi bị chặn', async () => {
    const host = await oldUser();
    const r = await startLive(host.id, { title: 'Live' });
    if (!r.ok) throw new Error();
    const live = await db.liveSession.findUniqueOrThrow({ where: { id: r.liveId } });
    expect(await authorizeMedia({ action: 'publish', path: live.mediaPath, token: 'sai' })).toBe(false);
    expect(await authorizeMedia({ action: 'publish', path: 'lkhac', token: r.publishToken })).toBe(false);
    expect(await authorizeMedia({ action: 'publish', path: live.mediaPath, token: r.publishToken })).toBe(
      true,
    );
    // Đã dùng mà buổi chưa có hình: không cho dùng lại.
    expect(await authorizeMedia({ action: 'publish', path: live.mediaPath, token: r.publishToken })).toBe(
      false,
    );

    const late = await oldUser();
    const r2 = await startLive(late.id, { title: 'Muộn' });
    if (!r2.ok) throw new Error();
    advanceClock({ minutes: 3 });
    const l2 = await db.liveSession.findUniqueOrThrow({ where: { id: r2.liveId } });
    expect(await authorizeMedia({ action: 'publish', path: l2.mediaPath, token: r2.publishToken })).toBe(
      false,
    );
  });

  it('mã xem hết hạn sau 5 phút; người thứ 51 bị chặn', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const live = await goLive(host.id);
    const v = await getLiveForViewer(live.liveId, { anonId: 'khach-0001' });
    if (v?.kind !== 'live' || !v.viewToken) throw new Error();
    expect(await authorizeMedia({ action: 'read', path: live.mediaPath, token: v.viewToken })).toBe(true);
    expect(verifyViewToken(v.viewToken, now().getTime())?.viewerKey).toBe('a:khach-0001');
    advanceClock({ minutes: 6 });
    expect(await authorizeMedia({ action: 'read', path: live.mediaPath, token: v.viewToken })).toBe(false);

    await setSetting('live_max_viewers', '3', null);
    for (const i of [1, 2, 3]) await heartbeat(live.liveId, { anonId: `khach-000${i}x` }, `10.0.0.${i}`);
    expect(await getLiveForViewer(live.liveId, { anonId: 'khach-moi-0004' })).toEqual({
      kind: 'full',
      id: live.liveId,
    });
    const again = await getLiveForViewer(live.liveId, { anonId: 'khach-0001x' });
    expect(again?.kind).toBe('live');
  });
});

describe('trạng thái buổi live theo máy chủ hình', () => {
  it('có hình thì live; mất hình quá 60 giây thì kết thúc; người xem thấy "đã kết thúc"', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const live = await goLive(host.id);
    expect((await listLiveNow()).map((l) => l.id)).toEqual([live.liveId]);
    fakeMedia.setReady(live.mediaPath, false);
    advanceClock({ seconds: 30 });
    await syncWithMediaServer();
    expect((await db.liveSession.findUniqueOrThrow({ where: { id: live.liveId } })).status).toBe('live');
    advanceClock({ seconds: 40 });
    await syncWithMediaServer();
    expect(await db.liveSession.findUniqueOrThrow({ where: { id: live.liveId } })).toMatchObject({
      status: 'ended',
      endReason: 'no_media',
    });
    expect((await getLiveForViewer(live.liveId, {}))?.kind).toBe('ended');
  });

  it('quá 2 giờ thì tự kết thúc; mã phát không dùng thì buổi tự huỷ', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const live = await goLive(host.id);
    advanceClock({ minutes: 121 });
    await syncWithMediaServer();
    expect(await db.liveSession.findUniqueOrThrow({ where: { id: live.liveId } })).toMatchObject({
      status: 'ended',
      endReason: 'time_limit',
    });
    const idle = await oldUser();
    const r = await startLive(idle.id, { title: 'Bỏ dở' });
    advanceClock({ minutes: 4 });
    await syncWithMediaServer();
    expect(r.ok && (await db.liveSession.findUniqueOrThrow({ where: { id: r.liveId } })).endReason).toBe(
      'never_started',
    );
  });

  it('người phát bấm kết thúc; người khác không kết thúc được', async () => {
    const host = await oldUser();
    const other = await oldUser();
    const live = await goLive(host.id);
    expect(await endLive(live.liveId, other.id)).toEqual({ ok: false });
    expect(await endLive(live.liveId, host.id)).toEqual({ ok: true });
    expect((await db.liveSession.findUniqueOrThrow({ where: { id: live.liveId } })).status).toBe('ended');
    expect(await authorizeMedia({ action: 'publish', path: live.mediaPath, token: live.publishToken })).toBe(
      false,
    );
  });
});

describe('người xem, chat, tim (SPEC-live.md mục 4–6)', () => {
  it('đếm người xem thật trong 45 giây; chuỗi xem liên tục tính lại khi ngắt quãng quá 45 giây', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const fan = await oldUser();
    const live = await goLive(host.id);
    expect(await heartbeat(live.liveId, { userId: fan.id }, '1.1.1.1')).toEqual({ viewers: 1 });
    advanceClock({ seconds: 20 });
    await heartbeat(live.liveId, { userId: fan.id }, '1.1.1.1');
    advanceClock({ seconds: 20 });
    await heartbeat(live.liveId, { userId: fan.id }, '1.1.1.1');
    let row = await db.liveViewer.findFirstOrThrow({ where: { liveId: live.liveId } });
    expect(row.longestStreakSec).toBe(40);
    expect(row.networkHash).not.toContain('1.1.1.1');
    advanceClock({ seconds: 50 });
    await heartbeat(live.liveId, { userId: fan.id }, '1.1.1.1');
    advanceClock({ seconds: 20 });
    await heartbeat(live.liveId, { userId: fan.id }, '1.1.1.1');
    row = await db.liveViewer.findFirstOrThrow({ where: { liveId: live.liveId } });
    expect(row.longestStreakSec).toBe(40); // chuỗi mới mới được 20 giây
    advanceClock({ seconds: 50 });
    expect(await getLiveForViewer(live.liveId, {})).toMatchObject({ kind: 'live', viewers: 0 });
    expect((await db.liveSession.findUniqueOrThrow({ where: { id: live.liveId } })).peakViewers).toBe(1);
  });

  it('chat: không link, tối đa 150 ký tự, 1 tin mỗi 3 giây; người phát ẩn tin và cấm chat', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const fan = await oldUser();
    const live = await goLive(host.id);
    expect(hasLink('vào shopee.vn/abc mua rẻ')).toBe(true);
    expect(hasLink('Giá bao nhiêu vậy shop?')).toBe(false);
    expect(await sendChat(live.liveId, fan.id, 'xem tại https://lua.dao')).toEqual({
      ok: false,
      error: 'LINK',
    });
    expect(await sendChat(live.liveId, fan.id, 'x'.repeat(151))).toEqual({ ok: false, error: 'TOO_LONG' });
    const first = await sendChat(live.liveId, fan.id, 'Giá bao nhiêu vậy shop?');
    expect(first.ok).toBe(true);
    expect(await sendChat(live.liveId, fan.id, 'Còn hàng không?')).toEqual({ ok: false, error: 'TOO_FAST' });
    advanceClock({ seconds: 4 });
    expect((await sendChat(live.liveId, fan.id, 'Còn hàng không?')).ok).toBe(true);
    if (!first.ok) return;
    expect(await hideChat(first.id, fan.id)).toEqual({ ok: false });
    expect(await hideChat(first.id, host.id)).toEqual({ ok: true });
    expect(await banFromChat(live.liveId, host.id, fan.id)).toEqual({ ok: true });
    advanceClock({ seconds: 4 });
    expect(await sendChat(live.liveId, fan.id, 'alo')).toEqual({ ok: false, error: 'BANNED' });
    const view = await getLiveForViewer(live.liveId, {});
    expect(view?.kind === 'live' && view.chat).toEqual([]);
  });

  it('tim: mỗi người tối đa 10 tim mỗi giây, máy chủ đếm tổng', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const host = await oldUser();
    const fan = await oldUser();
    const live = await goLive(host.id);
    expect(await sendHearts(live.liveId, fan.id, 7)).toEqual({ hearts: 7 });
    expect(await sendHearts(live.liveId, fan.id, 7)).toEqual({ hearts: 10 });
    advanceClock({ seconds: 1 });
    expect(await sendHearts(live.liveId, fan.id, 50)).toEqual({ hearts: 20 });
  });
});

describe('báo cáo và CEO xử lý (SPEC-live.md mục 8)', () => {
  it('5 người khác nhau báo cáo thì ẩn khỏi danh sách và báo CEO; 1 người báo 2 lần không tính', async () => {
    const host = await oldUser();
    const live = await goLive(host.id);
    const first = await oldUser();
    expect(await reportLive(first.id, live.liveId, 'scam')).toEqual({ ok: true });
    expect(await reportLive(first.id, live.liveId, 'scam')).toEqual({ ok: false, error: 'ALREADY' });
    for (let i = 0; i < 4; i += 1) await reportLive((await oldUser()).id, live.liveId, 'bad_content');
    expect(await listLiveNow()).toEqual([]);
    expect((await getLiveForViewer(live.liveId, {}))?.kind).toBe('live'); // người đang xem vẫn xem được
    expect(await db.alertEvent.count({ where: { kind: 'live_reported' } })).toBe(1);
  });

  it('CEO dừng ngay kèm lý do (ghi nhật ký); cấm live thì buổi đang phát dừng luôn', async () => {
    const admin = await createUser();
    const host = await oldUser();
    const live = await goLive(host.id);
    expect(await stopLive(live.liveId, admin.id, '')).toEqual({ ok: false });
    expect(await stopLive(live.liveId, admin.id, 'Bán hàng cấm')).toEqual({ ok: true });
    expect(await db.liveSession.findUniqueOrThrow({ where: { id: live.liveId } })).toMatchObject({
      status: 'stopped',
      endReason: 'Bán hàng cấm',
    });
    expect(await db.adminAuditLog.count({ where: { action: 'live.stop', targetId: live.liveId } })).toBe(1);
    const other = await oldUser();
    const l2 = await goLive(other.id);
    await banUserFromLive(other.id, admin.id, null, 'Lừa đảo');
    expect((await db.liveSession.findUniqueOrThrow({ where: { id: l2.liveId } })).status).toBe('stopped');
    expect(await startLive(other.id, { title: 'x' })).toEqual({ ok: false, error: 'LIVE_BANNED' });
  });
});
