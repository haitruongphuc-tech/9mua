'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { setKiotLocation } from '@/modules/kiot';

// Lưu vị trí cửa hàng (SPEC-kiot.md V5.1).
export async function setLocationAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const lat = Number(form.get('lat'));
  const lng = Number(form.get('lng'));
  const clear = form.get('clear') === '1';
  const hasPin = !clear && form.get('lat') !== null && form.get('lng') !== null;
  const r = await setKiotLocation(user.id, {
    pin: hasPin ? { lat, lng } : clear ? null : undefined,
    showExact: form.get('showExact') === 'on',
  });
  redirect(`/kiot-cua-toi/cai-dat?${r.ok ? 'da-luu=vi-tri' : 'loi-vi-tri=1'}#vi-tri`);
}
