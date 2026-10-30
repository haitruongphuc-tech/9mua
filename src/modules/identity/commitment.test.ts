import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { saveFeature } from '@/lib/features';
import { createVideoUpload } from '@/modules/creator';
import { createKiot, createProduct } from '@/modules/kiot';
import { startLive } from '@/modules/live';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { register } from './register';
import {
  acceptCommitment,
  commitmentRecords,
  currentCommitment,
  hasCurrentCommitment,
  publishCommitment,
} from './commitment';

describe('cam kết nội dung (SPEC-identity.md V5.6)', () => {
  it('chưa đồng ý thì chưa có; đồng ý bản mới nhất thì có; CEO đổi chữ thì phải đồng ý lại', async () => {
    const r = await register({ identifier: '0912000222', displayName: 'Mới', password: 'matkhau-9mua' });
    if (!r.ok) throw new Error('setup');
    const u = { id: r.userId };
    expect(await currentCommitment()).toEqual({ version: 1, lines: null });
    expect(await hasCurrentCommitment(u.id)).toBe(false);
    expect(await acceptCommitment(u.id, 1, '1.2.3.4', 'Safari')).toEqual({ ok: true });
    expect(await acceptCommitment(u.id, 1, '1.2.3.4', 'Safari')).toEqual({ ok: true }); // bấm 2 lần không lỗi
    expect(await hasCurrentCommitment(u.id)).toBe(true);
    const v2 = await publishCommitment(null, ['Dòng 1', 'Dòng 2', 'Dòng 3', 'Dòng 4']);
    expect(v2).toEqual({ ok: true, version: 2 });
    expect(await currentCommitment()).toEqual({
      version: 2,
      lines: ['Dòng 1', 'Dòng 2', 'Dòng 3', 'Dòng 4'],
    });
    expect(await hasCurrentCommitment(u.id)).toBe(false);
    expect(await acceptCommitment(u.id, 1, null, null)).toEqual({ ok: false, error: 'OUTDATED' });
    expect(await publishCommitment(null, ['thiếu dòng'])).toEqual({ ok: false, error: 'INVALID' });
    expect((await commitmentRecords(u.id)).map((r) => [r.version, r.ip])).toEqual([[1, '1.2.3.4']]);
  });

  it('sổ cam kết chỉ thêm: không sửa, không xoá được', async () => {
    const u = await createUser();
    await acceptCommitment(u.id, 1, null, null);
    await expect(db.commitment.updateMany({ where: { userId: u.id }, data: { ip: 'x' } })).rejects.toThrow();
    await expect(db.commitment.deleteMany({ where: { userId: u.id } })).rejects.toThrow();
  });

  it('máy chủ chặn tạo Kiot, đăng sản phẩm, phát live, đăng video khi chưa đồng ý; tắt công tắc thì không hỏi', async () => {
    const r = await register({
      identifier: '0912000111',
      displayName: 'Chưa cam kết',
      password: 'matkhau-9mua',
    });
    if (!r.ok) throw new Error('setup');
    const id = r.userId;
    expect(
      await createKiot(id, {
        name: 'Kiot Cam Kết',
        slug: 'kiot-cam-ket',
        contactPhone: '0979393916',
        description: '',
      }),
    ).toEqual({ ok: false, error: 'COMMITMENT_REQUIRED' });
    expect(await startLive(id, { title: 'Live' })).toEqual({ ok: false, error: 'COMMITMENT_REQUIRED' });
    expect(await createVideoUpload(id, 'khong-co', { caption: '', productIds: [] })).toEqual({
      ok: false,
      error: 'COMMITMENT_REQUIRED',
    });
    // Chủ Kiot đã đồng ý bản cũ: CEO ra bản mới thì phải đồng ý lại mới đăng sản phẩm được.
    const seller = await createSeller({ active: true });
    await publishCommitment(null, ['1', '2', '3', '4']);
    expect(
      await createProduct(seller.user.id, {
        name: 'Mật ong',
        price: 100_000,
        stock: 5,
        category: 'thuc-pham-dac-san',
        imageIds: [],
      }),
    ).toEqual({ ok: false, error: 'COMMITMENT_REQUIRED' });

    await saveFeature('commitment', false, null);
    expect(await hasCurrentCommitment(id)).toBe(true);
  });
});
