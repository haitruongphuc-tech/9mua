import { describe, expect, it } from 'vitest';
import { advanceClock, now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { toggleFollow } from '@/modules/social';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import {
  acceptRequest,
  banFromMessages,
  blockUser,
  deleteConversation,
  getMessages,
  hideMessage,
  listConversations,
  listReportedConversations,
  markRead,
  openConversation,
  reportConversation,
  reportedConversationDetail,
  sendMessage,
  unblockUser,
  unreadCount,
} from './index';

async function oldUser() {
  const u = await createUser();
  await db.user.update({
    where: { id: u.id },
    data: { createdAt: new Date(now().getTime() - 10 * 86_400_000) },
  });
  return u;
}

async function open(a: string, b: string) {
  const r = await openConversation(a, b);
  if (!r.ok) throw new Error(r.error);
  return r.conversationId;
}

describe('hộp thư (SPEC-messages.md)', () => {
  it('nhắn chủ Kiot đang hoạt động: vào thẳng hộp thư chính, có thẻ sản phẩm; chủ Kiot trả lời, đọc thì hết chưa đọc', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const shop = await createSeller({ active: true });
    const p = await createProduct(shop.kiotId, { name: 'Mực một nắng' });
    const buyer = await oldUser();
    const r = await openConversation(buyer.id, shop.user.id);
    if (!r.ok) throw new Error(r.error);
    const sent = await sendMessage(buyer.id, r.conversationId, {
      text: 'Còn hàng không shop?',
      productId: p.id,
    });
    expect(sent).toMatchObject({
      ok: true,
      message: { text: 'Còn hàng không shop?', product: { name: 'Mực một nắng' } },
    });
    expect((await listConversations(shop.user.id, 'inbox')).map((c) => c.id)).toEqual([r.conversationId]);
    expect(await listConversations(shop.user.id, 'requests')).toEqual([]);
    expect(await unreadCount(shop.user.id)).toBe(1);
    advanceClock({ seconds: 2 });
    expect((await sendMessage(shop.user.id, r.conversationId, { text: 'Còn ạ' })).ok).toBe(true);
    await markRead(shop.user.id, r.conversationId);
    expect(await unreadCount(shop.user.id)).toBe(0);
    expect(await unreadCount(buyer.id)).toBe(1);
    const msgs = await getMessages(buyer.id, r.conversationId);
    expect(msgs?.map((m) => m.text)).toEqual(['Còn hàng không shop?', 'Còn ạ']);
    // Không phải thành viên thì không đọc, không gửi được.
    const stranger = await oldUser();
    expect(await getMessages(stranger.id, r.conversationId)).toBeNull();
    expect(await sendMessage(stranger.id, r.conversationId, { text: 'xin chào' })).toEqual({
      ok: false,
      error: 'NOT_MEMBER',
    });
  });

  it('người lạ: vào Tin nhắn chờ, chỉ gửi được 1 tin tới khi được chấp nhận; trả lời = chấp nhận', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const a = await oldUser();
    const b = await oldUser();
    const id = await open(a.id, b.id);
    expect((await sendMessage(a.id, id, { text: 'Chào bạn' })).ok).toBe(true);
    advanceClock({ seconds: 2 });
    expect(await sendMessage(a.id, id, { text: 'Bạn ơi' })).toEqual({ ok: false, error: 'REQUEST_PENDING' });
    expect((await listConversations(b.id, 'requests')).map((c) => c.id)).toEqual([id]);
    expect(await listConversations(b.id, 'inbox')).toEqual([]);
    expect((await listConversations(a.id, 'inbox')).map((c) => c.id)).toEqual([id]);
    expect((await sendMessage(b.id, id, { text: 'Chào' })).ok).toBe(true);
    expect((await listConversations(b.id, 'inbox')).map((c) => c.id)).toEqual([id]);
    advanceClock({ seconds: 2 });
    expect((await sendMessage(a.id, id, { text: 'Bạn ơi' })).ok).toBe(true);

    // Chấp nhận bằng nút cũng được; có quan hệ follow thì vào thẳng hộp thư chính.
    const c = await oldUser();
    const d = await oldUser();
    const id2 = await open(c.id, d.id);
    await sendMessage(c.id, id2, { text: 'hi' });
    expect(await acceptRequest(c.id, id2)).toEqual({ ok: false });
    expect(await acceptRequest(d.id, id2)).toEqual({ ok: true });
    const e = await oldUser();
    await toggleFollow(e.id, a.id);
    const id3 = await open(a.id, e.id);
    advanceClock({ seconds: 2 });
    expect((await sendMessage(a.id, id3, { text: 'hi' })).ok).toBe(true);
    expect((await listConversations(e.id, 'inbox')).map((x) => x.id)).toEqual([id3]);
  });

  it('chặn link, quá 1.000 ký tự, tin trống, 2 tin trong 1 giây; không tự nhắn cho mình', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const shop = await createSeller({ active: true });
    const a = await oldUser();
    expect(await openConversation(a.id, a.id)).toEqual({ ok: false, error: 'SELF' });
    const id = await open(a.id, shop.user.id);
    expect(await sendMessage(a.id, id, { text: 'mua rẻ hơn ở shopee.vn/abc' })).toEqual({
      ok: false,
      error: 'LINK',
    });
    expect(await sendMessage(a.id, id, { text: 'x'.repeat(1001) })).toEqual({ ok: false, error: 'TOO_LONG' });
    expect(await sendMessage(a.id, id, { text: '   ' })).toEqual({ ok: false, error: 'EMPTY' });
    expect((await sendMessage(a.id, id, { text: 'một' })).ok).toBe(true);
    expect(await sendMessage(a.id, id, { text: 'hai' })).toEqual({ ok: false, error: 'TOO_FAST' });
    advanceClock({ seconds: 1 });
    expect((await sendMessage(a.id, id, { text: 'hai' })).ok).toBe(true);
  });

  it('tài khoản Free mở tối đa 20 cuộc trò chuyện mới mỗi ngày; chủ Kiot không giới hạn; tài khoản mới chỉ nhắn Kiot', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const free = await oldUser();
    const others = await Promise.all(Array.from({ length: 21 }, () => oldUser()));
    for (let i = 0; i < 20; i++) await open(free.id, others[i]!.id);
    expect(await openConversation(free.id, others[20]!.id)).toEqual({ ok: false, error: 'FREE_LIMIT' });
    // Mở lại cuộc trò chuyện cũ không tính lượt mới.
    expect((await openConversation(free.id, others[0]!.id)).ok).toBe(true);
    advanceClock({ hours: 24 });
    expect((await openConversation(free.id, others[20]!.id)).ok).toBe(true);

    const owner = await createSeller({ active: true });
    await db.user.update({
      where: { id: owner.user.id },
      data: { createdAt: new Date(now().getTime() - 5 * 86_400_000) },
    });
    for (const o of others) expect((await openConversation(owner.user.id, o.id)).ok).toBe(true);

    const fresh = await createUser();
    expect(await openConversation(fresh.id, others[0]!.id)).toEqual({ ok: false, error: 'NEW_ACCOUNT' });
    expect((await openConversation(fresh.id, owner.user.id)).ok).toBe(true);
  });

  it('chặn: người bị chặn không gửi được, cuộc trò chuyện ẩn khỏi người chặn; bỏ chặn thì gửi lại được', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const shop = await createSeller({ active: true });
    const a = await oldUser();
    const id = await open(a.id, shop.user.id);
    await sendMessage(a.id, id, { text: 'hỏi giá' });
    await blockUser(shop.user.id, a.id);
    advanceClock({ seconds: 2 });
    expect(await sendMessage(a.id, id, { text: 'alo' })).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await openConversation(a.id, shop.user.id)).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await listConversations(shop.user.id, 'inbox')).toEqual([]);
    await unblockUser(shop.user.id, a.id);
    expect((await sendMessage(a.id, id, { text: 'alo' })).ok).toBe(true);
  });

  it('xoá phía mình: người kia vẫn thấy; tin mới đến thì hiện lại', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const shop = await createSeller({ active: true });
    const a = await oldUser();
    const id = await open(a.id, shop.user.id);
    await sendMessage(a.id, id, { text: 'hỏi giá' });
    await deleteConversation(a.id, id);
    expect(await listConversations(a.id, 'inbox')).toEqual([]);
    expect((await listConversations(shop.user.id, 'inbox')).map((c) => c.id)).toEqual([id]);
    await sendMessage(shop.user.id, id, { text: '50k ạ' });
    expect((await listConversations(a.id, 'inbox')).map((c) => c.id)).toEqual([id]);
  });

  it('báo cáo: CEO thấy cuộc trò chuyện bị báo cáo; 3 người báo cáo trong 7 ngày thì tự cấm 1 ngày; CEO ẩn tin, cấm nhắn', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const spammer = await oldUser();
    const victims = [await oldUser(), await oldUser(), await oldUser()];
    const ids: string[] = [];
    for (const v of victims) {
      const id = await open(spammer.id, v.id);
      ids.push(id);
      await sendMessage(spammer.id, id, { text: 'Nhận quà miễn phí, chuyển khoản trước' });
      advanceClock({ seconds: 2 });
    }
    expect(await reportConversation(victims[0]!.id, ids[0]!, 'lua_dao')).toEqual({ ok: true });
    expect(await reportConversation(victims[0]!.id, ids[0]!, 'lua_dao')).toEqual({ ok: false });
    expect(await reportConversation(victims[1]!.id, ids[1]!, 'spam')).toEqual({ ok: true });
    const other = await oldUser();
    const free = await open(spammer.id, other.id);
    expect((await sendMessage(spammer.id, free, { text: 'hi' })).ok).toBe(true);
    await reportConversation(victims[2]!.id, ids[2]!, 'quay_roi');
    advanceClock({ seconds: 2 });
    const other2 = await oldUser();
    expect(await openConversation(spammer.id, other2.id)).toEqual({ ok: false, error: 'BANNED' });
    advanceClock({ hours: 25 });
    expect((await openConversation(spammer.id, other2.id)).ok).toBe(true);
    const alert = await db.alertEvent.findFirst({ where: { kind: 'messages_reported' } });
    expect(alert).not.toBeNull();

    const reported = await listReportedConversations();
    expect(reported.map((r) => r.conversationId)).toEqual(expect.arrayContaining(ids));
    const detail = await reportedConversationDetail(ids[0]!);
    expect(detail?.messages.map((m) => m.text)).toEqual(['Nhận quà miễn phí, chuyển khoản trước']);

    const ceo = await oldUser();
    await db.user.update({ where: { id: ceo.id }, data: { role: 'admin' } });
    const msg = detail!.messages[0]!;
    await hideMessage(ceo.id, msg.id, 'Lừa đảo');
    const seen = await getMessages(victims[0]!.id, ids[0]!);
    expect(seen?.[0]).toMatchObject({ hidden: true, text: null });
    await banFromMessages(ceo.id, spammer.id, 'forever', 'Lừa đảo nhiều lần');
    advanceClock({ days: 30 });
    expect(await sendMessage(spammer.id, free, { text: 'hi' })).toEqual({ ok: false, error: 'BANNED' });
    expect(
      await db.adminAuditLog.count({ where: { adminId: ceo.id, action: { startsWith: 'messages.' } } }),
    ).toBe(2);
  });
});
