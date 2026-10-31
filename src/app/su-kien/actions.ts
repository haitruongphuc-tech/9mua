'use server';

import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { cancelEvent, createEvent } from '@/modules/social';

// Tạo / huỷ sự kiện (SPEC-social.md V5.7 mục 1). Giờ nhập theo giờ Việt Nam.
const vnTime = (v: FormDataEntryValue | null) => new Date(`${String(v ?? '')}:00+07:00`);

export async function createEventAction(form: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await isFeatureOn('events'))) redirect('/');
  const r = await createEvent(user.id, {
    title: String(form.get('title') ?? ''),
    startsAt: vnTime(form.get('startsAt')),
    endsAt: vnTime(form.get('endsAt')),
    mode: String(form.get('mode') ?? ''),
    province: String(form.get('province') ?? ''),
    address: String(form.get('address') ?? ''),
    description: String(form.get('description') ?? ''),
  });
  redirect(r.ok ? `/su-kien/${r.eventId}` : `/su-kien/tao?loi=${r.error}`);
}

export async function cancelEventAction(eventId: string): Promise<void> {
  const user = await requireUser();
  await cancelEvent(user.id, eventId);
  redirect(`/su-kien/${eventId}`);
}
