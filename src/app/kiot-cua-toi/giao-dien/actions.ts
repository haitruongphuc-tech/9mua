'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { setKiotLayout } from '@/modules/kiot';

// Lưu giao diện Kiot (SPEC-kiot.md V5.3 mục 4): máy chủ kiểm cấu trúc trước khi lưu.
export async function saveLayoutAction(form: FormData): Promise<void> {
  const user = await requireUser();
  let raw: unknown = null;
  try {
    raw = JSON.parse(String(form.get('layout') ?? ''));
  } catch {}
  const r = await setKiotLayout(user.id, raw);
  redirect(r.ok ? '/kiot-cua-toi/giao-dien?da-luu=1' : '/kiot-cua-toi/giao-dien?loi=1');
}
