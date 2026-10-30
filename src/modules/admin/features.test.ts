import { generate } from 'otplib';
import { describe, expect, it } from 'vitest';
import { advanceClock, now, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';
import { createUser } from '../../../tests/helpers/factories';
import { setFeatureSwitch } from './features';
import { beginTotpSetup, confirmTotpSetup } from './totp';

const code = (secret: string) => generate({ secret, epoch: Math.floor(now().getTime() / 1000) });

async function adminWithTotp() {
  setClock(new Date('2026-10-30T03:00:00Z'));
  const u = await createUser();
  const setup = await beginTotpSetup(u.id, '0979393916');
  if (!setup) throw new Error();
  if (!(await confirmTotpSetup(u.id, await code(setup.secret))).ok) throw new Error('totp');
  advanceClock({ seconds: 31 });
  return { id: u.id, secret: setup.secret };
}

describe('trang công tắc /admin/cong-tac (SPEC-admin.md V5.0)', () => {
  it('bật/tắt công tắc thường: ghi nhật ký trước/sau', async () => {
    const admin = await adminWithTotp();
    expect(await setFeatureSwitch(admin.id, 'posts', false, '')).toMatchObject({ ok: true });
    expect(await isFeatureOn('posts')).toBe(false);
    expect(await db.adminAuditLog.findFirst({ where: { action: 'feature.set' } })).toMatchObject({
      adminId: admin.id,
      targetType: 'feature',
      targetId: 'posts',
      before: { on: true },
      after: { on: false },
    });
  });

  it('công tắc đụng tiền: bật phải đúng mã 2 lớp; tắt thì không cần', async () => {
    const admin = await adminWithTotp();
    expect(await setFeatureSwitch(admin.id, 'cod', true, '')).toEqual({
      ok: false,
      error: 'Công tắc này đụng tiền: nhập mã xác thực 2 lớp để bật.',
    });
    expect(await setFeatureSwitch(admin.id, 'cod', true, '000000')).toEqual({
      ok: false,
      error: 'Mã xác thực không đúng.',
    });
    expect(await isFeatureOn('cod')).toBe(false);
    expect(await setFeatureSwitch(admin.id, 'cod', true, await code(admin.secret))).toMatchObject({
      ok: true,
    });
    expect(await isFeatureOn('cod')).toBe(true);
    expect(await setFeatureSwitch(admin.id, 'cod', false, '')).toMatchObject({ ok: true });
    expect(await isFeatureOn('cod')).toBe(false);
  });

  it('thiếu khoá dịch vụ thì báo rõ tên biến, không bật; tên lạ bị từ chối', async () => {
    const admin = await adminWithTotp();
    expect(await setFeatureSwitch(admin.id, 'bank_feed', true, '')).toEqual({
      ok: false,
      error: 'Chưa có khoá: CASSO_API_KEY, CASSO_WEBHOOK_SECRET',
    });
    expect(await setFeatureSwitch(admin.id, 'khong_co', true, '')).toEqual({
      ok: false,
      error: 'Không có công tắc này.',
    });
    expect(await db.adminAuditLog.count()).toBe(0);
  });
});
