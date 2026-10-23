import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { setPayoutAccount } from '@/modules/kiot';
import { createSeller, createUser, sampleImage } from '../../../tests/helpers/factories';
import { getKycStatus, listKycForReview, readKycImage, reviewKyc, submitKyc } from './kyc';

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), '9mua-public-'));
  process.env.PRIVATE_DIR = await mkdtemp(path.join(tmpdir(), '9mua-private-'));
});

const input = async () => ({
  fullName: 'Nguyễn Hải',
  idNumber: '079 123 456 789',
  front: await sampleImage('#123456'),
  back: await sampleImage('#654321'),
});

describe('KYC', () => {
  it('nộp: chuẩn hoá tên/số CCCD; ảnh nằm trong thư mục riêng tư, không nằm trong uploads công khai', async () => {
    const user = await createUser();
    expect(await submitKyc(user.id, await input())).toEqual({ ok: true });
    const status = await getKycStatus(user.id);
    expect(status).toMatchObject({ status: 'pending', fullName: 'NGUYEN HAI', idNumber: '079123456789' });
    const sub = (await listKycForReview())[0]!;
    expect(existsSync(path.join(process.env.PRIVATE_DIR!, sub.frontImage))).toBe(true);
    expect(sub.frontImage).not.toContain('uploads');
    expect(existsSync(path.join(process.env.UPLOAD_DIR!, sub.frontImage))).toBe(false);
    expect((await readKycImage(sub.id, 'front'))?.length).toBeGreaterThan(100);
  });

  it('số CCCD phải đủ 12 số; ảnh phải là ảnh thật', async () => {
    const user = await createUser();
    expect(await submitKyc(user.id, { ...(await input()), idNumber: '12345' })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
    });
    expect(
      await submitKyc(user.id, { ...(await input()), back: Buffer.from('khong phai anh') }),
    ).toMatchObject({ ok: false, error: 'INVALID_IMAGE' });
  });

  it('đang chờ duyệt thì không nộp lại; bị từ chối thì nộp lại được; đã duyệt thì thôi', async () => {
    const user = await createUser();
    const admin = await createUser();
    await submitKyc(user.id, await input());
    expect(await submitKyc(user.id, await input())).toEqual({ ok: false, error: 'ALREADY_PENDING' });
    const sub = (await listKycForReview())[0]!;
    expect(await reviewKyc(sub.id, admin.id, 'reject', '')).toEqual({ ok: false, error: 'REASON_REQUIRED' });
    expect(await reviewKyc(sub.id, admin.id, 'reject', 'Ảnh mờ, chụp lại')).toEqual({ ok: true });
    expect(await getKycStatus(user.id)).toMatchObject({ status: 'rejected', reason: 'Ảnh mờ, chụp lại' });
    expect(await submitKyc(user.id, await input())).toEqual({ ok: true });
    const again = (await listKycForReview())[0]!;
    expect(await reviewKyc(again.id, admin.id, 'approve')).toEqual({ ok: true });
    expect(await submitKyc(user.id, await input())).toEqual({ ok: false, error: 'ALREADY_APPROVED' });
  });

  it('cảnh báo CEO khi tên tài khoản ngân hàng khác tên CCCD', async () => {
    const { user } = await createSeller();
    await setPayoutAccount(user.id, {
      bankBin: '970422',
      accountNumber: '0979393916',
      accountName: 'NGUYEN VAN KHAC',
      password: user.password,
    });
    await submitKyc(user.id, await input());
    expect((await listKycForReview())[0]).toMatchObject({
      nameMatchesBank: false,
      bankAccountName: 'NGUYEN VAN KHAC',
    });
  });
});
