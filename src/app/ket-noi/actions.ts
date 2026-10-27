'use server';

import { revalidatePath } from 'next/cache';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { PLATFORM_LIST, setSocialLinks } from '@/modules/social';

export type ConnectState = { ok?: boolean; message?: string; invalid?: string[] };

// Lưu link mạng xã hội (SPEC-kiot.md bổ sung 27/10). Ô để trống là gỡ link của mạng đó.
export async function saveSocialLinksAction(_prev: ConnectState, form: FormData): Promise<ConnectState> {
  const user = await requireUser();
  const t = await getT();
  const input = Object.fromEntries(PLATFORM_LIST.map((p) => [p, String(form.get(p) ?? '').slice(0, 400)]));
  const result = await setSocialLinks(user.id, input);
  if (!result.ok) return { message: t('profile.connect.invalid'), invalid: result.invalid };
  revalidatePath('/ket-noi');
  return { ok: true, message: t('profile.connect.saved') };
}
