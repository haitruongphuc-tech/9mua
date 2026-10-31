import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { checkLongVideo } from '@/modules/creator';
import { createGroup } from '@/modules/social';
import { createUser } from '../../tests/helpers/factories';
import { accountTooNew, setSetting } from './settings';

const setLimits = (on: boolean) => setSetting('new_account_limits', on ? 'true' : 'false', null);

// Công tắc "Giới hạn tài khoản mới" (CEO chốt 31/10): tắt thì tài khoản mới phát live, đăng video dài, tạo nhóm ngay.
describe('giới hạn tài khoản mới', () => {
  afterEach(() => setLimits(true));

  it('bật (mặc định): tài khoản vừa tạo bị chặn; tắt: không chặn', async () => {
    const fresh = new Date();
    expect(await accountTooNew(fresh, 3)).toBe(true);
    expect(await accountTooNew(new Date(Date.now() - 4 * 86_400_000), 3)).toBe(false);
    await setLimits(false);
    expect(await accountTooNew(fresh, 3)).toBe(false);
  });

  it('tắt công tắc: tài khoản mới tạo nhóm và đăng video dài được ngay', async () => {
    const u = await createUser();
    expect(await createGroup(u.id, { name: 'Nhóm mới', privacy: 'public' })).toEqual({
      ok: false,
      error: 'TOO_NEW',
    });
    const limits = { long: true, maxBytes: 2048 * 1024 * 1024, maxSec: 3600, longDailySec: 7200 };
    expect(await checkLongVideo(u.id, 600, limits)).toBe('ACCOUNT_TOO_NEW');
    await setLimits(false);
    expect((await createGroup(u.id, { name: 'Nhóm mới', privacy: 'public' })).ok).toBe(true);
    expect(await checkLongVideo(u.id, 600, limits)).toBeNull();
    expect(await db.communityGroup.count({ where: { ownerId: u.id } })).toBe(1);
  });
});
