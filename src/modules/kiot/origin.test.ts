import { describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createSeller, createUser, sampleImage } from '../../../tests/helpers/factories';
import { kiotBadges, readOriginFile, remindOriginRenewal, reviewOrigin, submitOrigin } from './origin';

const DAY = 86_400_000;
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

describe('hồ sơ nguồn gốc + huy hiệu (SPEC-kiot.md V5.2)', () => {
  it('đủ giấy tờ mới nộp được; duyệt thì có huy hiệu 12 tháng; hết hạn thì mất; file chỉ đọc qua route admin', async () => {
    const s = await createSeller({ active: true });
    const admin = await createUser();
    const photos = [await sampleImage('#111'), await sampleImage('#222'), await sampleImage('#333')];
    const base = {
      documents: [{ kind: 'invoice' as const, data: pdf }],
      photos,
      commitOrigin: true,
      commitRefund: true,
    };
    expect(await submitOrigin(s.user.id, { ...base, documents: [] })).toEqual({
      ok: false,
      error: 'NEED_DOCUMENT',
    });
    expect(await submitOrigin(s.user.id, { ...base, photos: photos.slice(0, 2) })).toEqual({
      ok: false,
      error: 'NEED_PHOTOS',
    });
    expect(await submitOrigin(s.user.id, { ...base, commitRefund: false })).toEqual({
      ok: false,
      error: 'NEED_COMMIT',
    });
    expect(
      await submitOrigin(s.user.id, { ...base, documents: [{ kind: 'invoice', data: Buffer.from('rac') }] }),
    ).toEqual({
      ok: false,
      error: 'FILE_INVALID',
    });
    const r = await submitOrigin(s.user.id, base);
    if (!r.ok) throw new Error(r.error);
    expect(await submitOrigin(s.user.id, base)).toEqual({ ok: false, error: 'PENDING' });
    const files = await db.originFile.findMany({ where: { dossierId: r.dossierId } });
    expect(files.map((f) => f.kind).sort()).toEqual(['invoice', 'photo', 'photo', 'photo']);
    expect(files.every((f) => !f.path.startsWith('/'))).toBe(true);
    expect((await readOriginFile(files.find((f) => f.kind === 'invoice')!.id))?.pdf).toBe(true);

    expect(await kiotBadges(s.kiotId, false)).toMatchObject({ origin: false, level: 0 });
    expect(await reviewOrigin(admin.id, r.dossierId, 'reject')).toBe(false); // thiếu lý do
    expect(await reviewOrigin(admin.id, r.dossierId, 'approve')).toBe(true);
    expect(await kiotBadges(s.kiotId, true)).toEqual({ origin: true, bank: true, video: false, level: 2 });

    setClock(new Date(Date.now() + 340 * DAY));
    try {
      expect(await remindOriginRenewal()).toBeGreaterThanOrEqual(1);
      expect(await remindOriginRenewal()).toBe(0);
    } finally {
      resetClock();
    }
    setClock(new Date(Date.now() + 366 * DAY));
    try {
      expect((await kiotBadges(s.kiotId, false)).origin).toBe(false);
    } finally {
      resetClock();
    }

    expect(await reviewOrigin(admin.id, r.dossierId, 'revoke')).toBe(false); // thiếu lý do
    expect(await reviewOrigin(admin.id, r.dossierId, 'revoke', 'Hàng giả')).toBe(true);
    expect((await kiotBadges(s.kiotId, false)).origin).toBe(false);
  });
});
