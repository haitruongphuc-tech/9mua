'use server';

import { requireAdminVerified, setFeatureSwitch } from '@/modules/admin';
import { back } from '../flash';

// Bật/tắt một công tắc chức năng; công tắc đụng tiền cần mã 2 lớp ở ô "totp" khi bật.
export async function setFeatureAction(name: string, on: boolean, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await setFeatureSwitch(admin.id, name, on, String(form.get('totp') ?? ''));
  back(
    '/admin/cong-tac',
    r.ok ? { ok: true, message: r.message ?? 'Đã lưu.' } : { ok: false, message: r.error },
  );
}
