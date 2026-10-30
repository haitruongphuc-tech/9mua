'use server';

import { requireAdminVerified } from '@/modules/admin';
import { setSoundStatus } from '@/modules/creator';
import { back } from '../flash';

// Gỡ / mở lại một âm thanh (SPEC-creator.md V5.6 mục 2). Video đã dùng vẫn phát.
export async function setSoundStatusAction(soundId: string, status: 'active' | 'removed', form: FormData) {
  const admin = await requireAdminVerified();
  const reason =
    String(form.get('reason') ?? '')
      .trim()
      .slice(0, 200) || null;
  const ok = await setSoundStatus(admin.id, soundId, status, reason);
  back(
    '/admin/am-thanh',
    ok
      ? { ok: true, message: status === 'removed' ? 'Đã gỡ âm thanh.' : 'Đã mở lại âm thanh.' }
      : { ok: false, message: 'Không đổi được (âm thanh không còn hoặc đã ở trạng thái đó).' },
  );
}
