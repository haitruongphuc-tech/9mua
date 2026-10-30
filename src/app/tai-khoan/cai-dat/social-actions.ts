'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { addMutedKeyword, removeMutedKeyword, setMentionPolicy } from '@/modules/social';

// Cài đặt bình luận (SPEC-social.md V5.4): "Ai được nhắc tên tôi" và từ cấm.
export async function setMentionPolicyAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await setMentionPolicy(user.id, String(form.get('policy') ?? ''));
  redirect('/tai-khoan/cai-dat?da-luu=nhac-ten#nhac-ten');
}

export async function addMutedKeywordAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const r = await addMutedKeyword(user.id, String(form.get('word') ?? ''));
  redirect(`/tai-khoan/cai-dat?${r.ok ? 'da-luu=tu-cam' : `loi-tu-cam=${r.error}`}#tu-cam`);
}

export async function removeMutedKeywordAction(id: string): Promise<void> {
  const user = await requireUser();
  await removeMutedKeyword(user.id, id);
  redirect('/tai-khoan/cai-dat#tu-cam');
}
