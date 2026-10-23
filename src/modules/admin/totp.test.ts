import { generate } from 'otplib';
import { describe, expect, it } from 'vitest';
import { advanceClock, now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { isSessionVerified, markSessionVerified } from './guard';
import { beginTotpSetup, confirmTotpSetup, getTotpStatus, resetAdminTotp, verifyTotp } from './totp';

const code = (secret: string) => generate({ secret, epoch: Math.floor(now().getTime() / 1000) });

async function enabledAdmin() {
  setClock(new Date('2026-10-23T03:00:00Z'));
  const u = await createUser();
  const setup = await beginTotpSetup(u.id, '0979393916');
  if (!setup) throw new Error();
  const confirmed = await confirmTotpSetup(u.id, await code(setup.secret));
  if (!confirmed.ok) throw new Error(JSON.stringify(confirmed));
  advanceClock({ seconds: 31 });
  return { user: u, secret: setup.secret, backupCodes: confirmed.backupCodes! };
}

describe('cài 2 lớp', () => {
  it('quét QR, nhập mã đúng thì bật và nhận 10 mã dự phòng; bí mật lưu dạng mã hoá', async () => {
    const u = await createUser();
    expect(await getTotpStatus(u.id)).toBe('none');
    const setup = await beginTotpSetup(u.id, 'ceo@9mua.com');
    expect(setup!.qrSvg).toContain('<svg');
    // Tải lại trang cài trong 10 phút: vẫn bí mật cũ (QR đã quét không bị vô hiệu).
    expect((await beginTotpSetup(u.id, 'ceo@9mua.com'))!.secret).toBe(setup!.secret);
    expect(await getTotpStatus(u.id)).toBe('pending');
    const row = await db.adminTotp.findUniqueOrThrow({ where: { userId: u.id } });
    expect(row.secretEnc).not.toContain(setup!.secret);
    expect(await confirmTotpSetup(u.id, '000000')).toEqual({ ok: false, error: 'INVALID' });
    const ok = await confirmTotpSetup(u.id, await code(setup!.secret));
    expect(ok).toMatchObject({ ok: true });
    if (!ok.ok) throw new Error();
    expect(ok.backupCodes).toHaveLength(10);
    expect(await getTotpStatus(u.id)).toBe('enabled');
    // Đã bật thì không tạo lại bí mật mới được (kẻ có phiên đăng nhập không thay được thiết bị).
    expect(await beginTotpSetup(u.id, 'x')).toBeNull();
  });
});

describe('nhập mã mỗi phiên', () => {
  it('mã đúng qua; dùng lại đúng mã vừa dùng thì bị từ chối', async () => {
    const { user, secret } = await enabledAdmin();
    const c = await code(secret);
    expect(await verifyTotp(user.id, c)).toEqual({ ok: true });
    expect(await verifyTotp(user.id, c)).toEqual({ ok: false, error: 'INVALID' });
    advanceClock({ seconds: 30 });
    expect(await verifyTotp(user.id, await code(secret))).toEqual({ ok: true });
  });

  it('sai 5 lần thì khoá 15 phút, kể cả mã đúng; hết 15 phút thì nhập lại được', async () => {
    const { user, secret } = await enabledAdmin();
    for (let i = 0; i < 5; i++)
      expect(await verifyTotp(user.id, '123456')).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await verifyTotp(user.id, await code(secret))).toMatchObject({ ok: false, error: 'LOCKED' });
    advanceClock({ minutes: 15, seconds: 1 });
    expect(await verifyTotp(user.id, await code(secret))).toEqual({ ok: true });
  });

  it('mã dự phòng dùng 1 lần là hết hiệu lực', async () => {
    const { user, backupCodes } = await enabledAdmin();
    expect(await verifyTotp(user.id, backupCodes[0]!.toLowerCase())).toEqual({ ok: true, usedBackup: true });
    expect(await verifyTotp(user.id, backupCodes[0]!)).toEqual({ ok: false, error: 'INVALID' });
    expect((await db.adminTotp.findUniqueOrThrow({ where: { userId: user.id } })).backupHashes).toHaveLength(
      9,
    );
  });

  it('phiên admin hết hạn sau 12 giờ; phiên của người khác không dùng được', async () => {
    const { user } = await enabledAdmin();
    await markSessionVerified('sess-1', user.id);
    expect(await isSessionVerified('sess-1', user.id)).toBe(true);
    expect(await isSessionVerified('sess-1', 'nguoi-khac')).toBe(false);
    advanceClock({ hours: 12, seconds: 1 });
    expect(await isSessionVerified('sess-1', user.id)).toBe(false);
  });
});

describe('khôi phục 2 lớp từ máy chủ', () => {
  it('xoá cài đặt và phiên đã xác thực, có ghi nhật ký', async () => {
    const { user } = await enabledAdmin();
    await markSessionVerified('sess-x', user.id);
    await resetAdminTotp(user.id);
    expect(await getTotpStatus(user.id)).toBe('none');
    expect(await isSessionVerified('sess-x', user.id)).toBe(false);
    expect(await db.adminAuditLog.findFirstOrThrow()).toMatchObject({
      action: 'admin.reset_2fa',
      targetId: user.id,
    });
  });
});
