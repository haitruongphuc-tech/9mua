'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { addMutedKeyword, removeMutedKeyword, setMentionPolicy, setShowLikedVideos } from '@/modules/social';
import { NOTIFY_TYPES, setNotifyTypes } from '@/lib/notify-events';

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

// Bật / tắt từng loại thông báo (SPEC-social.md V5.5). Ô không tích = tắt.
export async function setNotifyTypesAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await setNotifyTypes(
    user.id,
    NOTIFY_TYPES.filter((t) => form.get(`n.${t}`) === 'on'),
  );
  redirect('/tai-khoan/cai-dat?da-luu=thong-bao#thong-bao');
}

// Tab "Đã thích" công khai (SPEC-social.md V5.2).
export async function setShowLikedAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await setShowLikedVideos(user.id, form.get('show') === 'on');
  redirect('/tai-khoan/cai-dat?da-luu=da-thich#da-thich');
}
