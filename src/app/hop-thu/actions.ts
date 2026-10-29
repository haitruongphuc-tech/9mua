'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { getCurrentUser, requireUser } from '@/modules/identity';
import {
  acceptRequest,
  blockUser,
  deleteConversation,
  markRead,
  openConversation,
  reportConversation,
  sendMessage,
  unblockUser,
  type MessageView,
} from '@/modules/messages';

// Hộp thư (SPEC-messages.md). Nút "Nhắn tin" / "Hỏi Kiot" có thể nằm ở tên miền phụ của Kiot: luôn chuyển về
// tên miền chính.
export async function openConversationAction(otherUserId: string, productId: string | null): Promise<void> {
  const app = env().APP_URL;
  const user = await getCurrentUser();
  if (!user) redirect(`${app}/dang-nhap?next=${encodeURIComponent('/hop-thu')}`);
  const r = await openConversation(user.id, otherUserId);
  if (!r.ok) redirect(`${app}/hop-thu?loi=${r.error}`);
  redirect(`${app}/hop-thu/${r.conversationId}${productId ? `?sp=${encodeURIComponent(productId)}` : ''}`);
}

export async function sendMessageAction(
  conversationId: string,
  input: { text?: string; imageId?: string | null; productId?: string | null },
): Promise<{ ok: true; message: MessageView } | { ok: false; message: string }> {
  const user = await requireUser();
  const r = await sendMessage(user.id, conversationId, input);
  if (r.ok) return r;
  return { ok: false, message: (await getT())(`inbox.err.${r.error}`) };
}

export async function markReadAction(conversationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (user) await markRead(user.id, conversationId);
}

export async function acceptAction(conversationId: string): Promise<void> {
  const user = await requireUser();
  await acceptRequest(user.id, conversationId);
  revalidatePath(`/hop-thu/${conversationId}`);
}

export async function deleteConversationAction(conversationId: string): Promise<void> {
  const user = await requireUser();
  await deleteConversation(user.id, conversationId);
  redirect('/hop-thu');
}

export async function blockAction(otherUserId: string): Promise<void> {
  const user = await requireUser();
  await blockUser(user.id, otherUserId);
  redirect('/hop-thu');
}

export async function unblockAction(otherUserId: string): Promise<void> {
  const user = await requireUser();
  await unblockUser(user.id, otherUserId);
  revalidatePath('/hop-thu');
}

export async function reportAction(
  conversationId: string,
  reason: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const r = await reportConversation(user.id, conversationId, reason);
  const t = await getT();
  return { ok: r.ok, message: t(r.ok ? 'inbox.report.sent' : 'inbox.report.failed') };
}
