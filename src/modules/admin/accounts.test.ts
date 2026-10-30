import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { getIntSetting } from '@/lib/settings';
import { getBalance } from '@/modules/payouts';
import { createPaidOrder, createSeller, createUser, sampleImage } from '../../../tests/helpers/factories';
import { setProfileImage, updateProfile } from '@/modules/identity';
import {
  adjustKiotBalance,
  clearUserProfile,
  grantKiotYear,
  lockKiotAccount,
  lockUserAccount,
  unlockKiotAccount,
  updateSettings,
} from './accounts';
import { incomingCsv, outgoingCsv, toCsv } from './export';
import { searchKiots, searchOrders, searchUsers } from './search';

describe('cài đặt', () => {
  it('phí sàn ngoài 0–30% bị từ chối; đổi cài đặt ghi nhật ký trước/sau', async () => {
    const admin = await createUser();
    expect(await updateSettings(admin.id, { platform_fee_bp: '3100' })).toEqual({
      ok: false,
      error: 'Phí sàn phải từ 0 đến 3.000',
    });
    expect(await updateSettings(admin.id, { kiot_fee_vnd: '1000' })).toMatchObject({ ok: false });
    expect(await updateSettings(admin.id, { payout_auto_enabled: 'maybe' })).toMatchObject({ ok: false });
    expect(await db.adminAuditLog.count()).toBe(0);
    expect(
      await updateSettings(admin.id, {
        platform_fee_bp: '700',
        payout_auto_enabled: 'false',
        kiot_fee_vnd: '26000',
      }),
    ).toEqual({
      ok: true,
      message: 'Đã lưu 2 thay đổi.',
    });
    expect(await getIntSetting('platform_fee_bp')).toBe(700);
    expect(await db.adminAuditLog.findMany({ orderBy: { targetId: 'asc' } })).toMatchObject([
      {
        action: 'setting.update',
        targetId: 'payout_auto_enabled',
        before: { value: 'true' },
        after: { value: 'false' },
      },
      {
        action: 'setting.update',
        targetId: 'platform_fee_bp',
        before: { value: '500' },
        after: { value: '700' },
      },
    ]);
  });
});

describe('khoá, tặng năm, điều chỉnh số dư', () => {
  it('mỗi thao tác cần lý do và ghi đúng 1 dòng nhật ký', async () => {
    const admin = await createUser();
    const s = await createSeller({ active: true });
    expect(await lockKiotAccount(admin.id, s.kiotId, '')).toEqual({ ok: false, error: 'Hãy ghi lý do.' });
    expect(await lockKiotAccount(admin.id, s.kiotId, 'Bán hàng giả')).toMatchObject({ ok: true });
    expect((await db.kiot.findUniqueOrThrow({ where: { id: s.kiotId } })).lockReason).toBe('Bán hàng giả');
    expect(await unlockKiotAccount(admin.id, s.kiotId)).toMatchObject({ ok: true });
    const before = (await db.kiot.findUniqueOrThrow({ where: { id: s.kiotId } })).activeUntil!;
    expect(await grantKiotYear(admin.id, s.kiotId, 'Tri ân người bán đầu tiên')).toMatchObject({ ok: true });
    expect(
      (await db.kiot.findUniqueOrThrow({ where: { id: s.kiotId } })).activeUntil!.getTime(),
    ).toBeGreaterThan(before.getTime());
    expect(await adjustKiotBalance(admin.id, s.kiotId, -1, 'Thu hồi')).toEqual({
      ok: false,
      error: 'Không trừ quá số dư hiện có.',
    });
    expect(await adjustKiotBalance(admin.id, s.kiotId, 15_000, 'Bù phí ship đơn lỗi')).toMatchObject({
      ok: true,
    });
    expect((await getBalance(s.kiotId)).available).toBe(15_000);
    expect((await db.adminAuditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((l) => l.action)).toEqual(
      ['kiot.lock', 'kiot.unlock', 'kiot.grant_year', 'kiot.adjust_balance'],
    );
  });

  it('khoá người dùng: đăng xuất mọi thiết bị; không tự khoá chính mình', async () => {
    const admin = await createUser();
    const u = await createUser();
    await db.session.create({
      data: { userId: u.id, tokenHash: 'x'.repeat(64), expiresAt: new Date(Date.now() + 86_400_000) },
    });
    expect(await lockUserAccount(admin.id, admin.id, 'thử')).toMatchObject({ ok: false });
    expect(await lockUserAccount(admin.id, u.id, 'Lừa đảo người mua')).toMatchObject({ ok: true });
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
  });
});

describe('tra cứu', () => {
  it('tìm người dùng theo SĐT/tên, Kiot theo tên/slug, đơn theo mã', async () => {
    const o = await createPaidOrder();
    const buyer = await db.user.findUniqueOrThrow({ where: { id: o.buyer.id } });
    expect((await searchUsers('0' + buyer.phone!.slice(3))).map((u) => u.id)).toEqual([buyer.id]);
    expect((await searchUsers(buyer.displayName.toUpperCase())).map((u) => u.id)).toContain(buyer.id);
    expect((await searchKiots(o.seller.slug)).map((k) => k.id)).toEqual([o.seller.kiotId]);
    expect((await searchOrders(o.order.code.toLowerCase())).map((x) => x.id)).toEqual([o.order.id]);
    expect((await searchOrders('0' + buyer.phone!.slice(3))).map((x) => x.id)).toEqual([o.order.id]);
  });
});

describe('xuất CSV', () => {
  it('UTF-8 có BOM, CRLF, thoát dấu phẩy/ngoặc kép, chặn chèn công thức Excel', () => {
    const csv = toCsv(
      ['Tên', 'Số tiền'],
      [
        ['Nguyễn, "Hải"', 26_000],
        ['=HYPERLINK("x")', -5],
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿Tên,Số tiền\r\n"Nguyễn, ""Hải""",26000\r\n"\'=HYPERLINK(""x"")",-5\r\n');
  });

  it('tiền vào và tiền ra đúng cột', async () => {
    const o = await createPaidOrder({ price: 120_000 });
    const from = new Date(Date.now() - 86_400_000);
    const to = new Date(Date.now() + 86_400_000);
    const inc = (await incomingCsv(from, to)).split('\r\n');
    expect(inc[0]).toBe(
      '﻿Thời gian,Mã thanh toán,Loại,Nội dung,Số tiền,Kết quả,Mã giao dịch,Người chuyển,STK chuyển,Ngân hàng chuyển',
    );
    expect(inc[1]).toContain(',Tiền đơn hàng,');
    expect(inc[1]).toContain(`,${o.order.total},Đã ghi nhận,`);
    await db.order.update({
      where: { id: o.order.id },
      data: { status: 'refunded', refundedAt: new Date(), refundRef: 'FT1' },
    });
    const out = (await outgoingCsv(from, to)).split('\r\n');
    expect(out[0]).toContain('Thời gian,Loại,Mã,Kiot,Số tiền,Phí chi hộ,Số tiền chuyển');
    expect(out[1]).toContain(`Hoàn người mua,${o.order.code}`);
  });
});

describe('gỡ hồ sơ vi phạm (SPEC-social.md bổ sung 30/10, A2)', () => {
  it('phải có lý do; gỡ ảnh + giới thiệu, ghi nhật ký trước/sau, báo người dùng kèm lý do', async () => {
    const admin = await createUser();
    const u = await createUser();
    await updateProfile(u.id, { bio: 'Giới thiệu xấu' });
    const av = await setProfileImage(u.id, 'avatar', await sampleImage());
    if (!av.ok) throw new Error(av.error);
    expect(await clearUserProfile(admin.id, u.id, ' ')).toEqual({ ok: false, error: 'Hãy ghi lý do.' });
    expect(await clearUserProfile(admin.id, 'khong-co', 'Ảnh phản cảm')).toEqual({
      ok: false,
      error: 'Không tìm thấy người dùng.',
    });
    expect(await clearUserProfile(admin.id, u.id, 'Ảnh phản cảm')).toMatchObject({ ok: true });
    expect(await db.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ avatarUrl: null, bio: null });
    expect(await db.adminAuditLog.findFirst({ where: { action: 'user.clear_profile' } })).toMatchObject({
      adminId: admin.id,
      targetId: u.id,
      reason: 'Ảnh phản cảm',
      before: { avatarUrl: av.url, coverUrl: null, bio: 'Giới thiệu xấu' },
      after: { avatarUrl: null, coverUrl: null, bio: null },
    });
    expect(await db.notification.findFirst({ where: { userId: u.id } })).toMatchObject({
      title: '@notify.profileCleared',
      body: JSON.stringify({ detail: 'Ảnh phản cảm' }),
    });
  });
});
