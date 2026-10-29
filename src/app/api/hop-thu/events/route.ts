import { getCurrentUser } from '@/modules/identity';
import { getConversation, getMessages, unreadCount } from '@/modules/messages';

export const dynamic = 'force-dynamic';

// Tin nhắn thời gian thực (SPEC-messages.md mục 6): Server-Sent Events, app đọc DB mỗi 1,5 giây cho mỗi kết nối.
// ?c=<cuộc trò chuyện>&after=<tin cuối đã có>: gửi tin mới và lúc người kia đọc ("Đã xem"). Luôn gửi số chưa đọc.
// ?poll=1: trình duyệt/mạng không giữ được SSE thì hỏi lại mỗi 5 giây, nhận 1 gói JSON.
const TICK_MS = 1_500;
const MAX_MS = 5 * 60_000;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const search = new URL(request.url).searchParams;
  const conversationId = search.get('c');
  let after = search.get('after');
  if (conversationId && !(await getConversation(user.id, conversationId)))
    return new Response('Not found', { status: 404 });

  const snapshot = async () => {
    const [messages, conv, unread] = await Promise.all([
      conversationId ? getMessages(user.id, conversationId, { after }) : Promise.resolve([]),
      conversationId ? getConversation(user.id, conversationId) : Promise.resolve(null),
      unreadCount(user.id),
    ]);
    return { messages: messages ?? [], otherReadAt: conv?.otherReadAt ?? null, unread };
  };

  if (search.get('poll') === '1')
    return Response.json(await snapshot(), { headers: { 'cache-control': 'no-store' } });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const started = Date.now();
      let closed = false;
      let lastRead: string | null = null;
      let lastUnread = -1;
      request.signal.addEventListener('abort', () => {
        closed = true;
      });
      try {
        while (!closed && Date.now() - started < MAX_MS) {
          const s = await snapshot();
          if (s.messages.length) {
            after = s.messages[s.messages.length - 1]!.id;
            send('messages', s.messages);
          }
          if (s.otherReadAt !== lastRead) {
            lastRead = s.otherReadAt;
            send('read', { at: s.otherReadAt });
          }
          if (s.unread !== lastUnread) {
            lastUnread = s.unread;
            send('unread', { count: s.unread });
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch (e) {
        console.error('[hop-thu] SSE lỗi:', e instanceof Error ? e.message : e);
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
