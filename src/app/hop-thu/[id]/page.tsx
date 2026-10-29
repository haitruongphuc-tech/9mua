import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ChatRoom } from '@/components/inbox/ChatRoom';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getCurrentUser } from '@/modules/identity';
import { getConversation, getMessages, markRead, productCardOf } from '@/modules/messages';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Hộp thư', robots: { index: false } };

// Một cuộc trò chuyện (SPEC-messages.md). ?sp=<sản phẩm>: từ nút "Hỏi Kiot", gắn sẵn thẻ sản phẩm vào ô nhắn.
export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sp?: string }>;
}) {
  const [{ id }, { sp }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/dang-nhap?next=${encodeURIComponent(`/hop-thu/${id}`)}`);
  const conversation = await getConversation(user.id, id);
  if (!conversation) notFound();
  const [messages, product] = await Promise.all([getMessages(user.id, id), sp ? productCardOf(sp) : null]);
  await markRead(user.id, id);
  return (
    <ClientMessages prefixes={['inbox.']}>
      <ChatRoom meId={user.id} conversation={conversation} initial={messages ?? []} attach={product} />
    </ClientMessages>
  );
}
