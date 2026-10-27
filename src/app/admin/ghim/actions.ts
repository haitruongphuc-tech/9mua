'use server';

import { requireAdminVerified, unpin } from '@/modules/admin';
import { pinVideo } from '@/modules/creator';
import { pinKiot } from '@/modules/marketplace';
import { back } from '../flash';

const ERRORS = {
  NOT_FOUND: 'Không tìm thấy (video phải đang hiện trên feed, Kiot phải đang hoạt động).',
  FULL: 'Đã đủ 5 ghim. Bỏ bớt một ghim trước.',
  EXISTS: 'Đã ghim rồi.',
} as const;

const untilOf = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  return s ? new Date(`${s}T23:59:59+07:00`) : null;
};

// Nhận mã video hoặc link 9mua.com/v/<mã>.
const videoIdOf = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .trim()
    .split('/v/')
    .pop()!
    .split(/[?#/]/)[0]!;
// Nhận slug hoặc link <slug>.9mua.com.
const slugOf = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .split('.')[0]!
    .toLowerCase();

export async function pinVideoAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await pinVideo(videoIdOf(form.get('video')), admin.id, untilOf(form.get('until')));
  back(
    '/admin/ghim',
    r.ok ? { ok: true, message: 'Đã ghim video.' } : { ok: false, message: ERRORS[r.error] },
  );
}

export async function pinKiotAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await pinKiot(slugOf(form.get('kiot')), admin.id, untilOf(form.get('until')));
  back(
    '/admin/ghim',
    r.ok ? { ok: true, message: 'Đã ghim Kiot.' } : { ok: false, message: ERRORS[r.error] },
  );
}

export async function unpinAction(kind: 'video' | 'kiot', targetId: string): Promise<void> {
  const admin = await requireAdminVerified();
  await unpin(kind, targetId, admin.id);
  back('/admin/ghim', { ok: true, message: 'Đã bỏ ghim.' });
}
