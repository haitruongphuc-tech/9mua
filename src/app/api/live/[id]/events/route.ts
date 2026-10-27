import { liveState, recentChat, type ChatLine } from '@/modules/live';

export const dynamic = 'force-dynamic';

// Server-Sent Events (SPEC-live.md "Kỹ thuật"): chat mới, số người xem, tim, sản phẩm ghim, trạng thái. App đọc DB mỗi
// 1,5 giây cho mỗi kết nối (gọn, chạy được với nhiều tiến trình). Kết nối tự đóng sau 5 phút, trình duyệt nối lại.
const TICK_MS = 1_500;
const MAX_MS = 5 * 60_000;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const liveId = (await params).id;
  const first = await liveState(liveId);
  if (!first) return new Response('Not found', { status: 404 });
  let lastChatId = new URL(request.url).searchParams.get('after');
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let lastState = '';
      const started = Date.now();
      let closed = false;
      request.signal.addEventListener('abort', () => {
        closed = true;
      });
      try {
        while (!closed && Date.now() - started < MAX_MS) {
          const [state, chat] = await Promise.all([liveState(liveId), recentChat(liveId, lastChatId, 50)]);
          if (!state) break;
          if (chat.length) {
            lastChatId = chat[chat.length - 1]!.id;
            send('chat', chat satisfies ChatLine[]);
          }
          const json = JSON.stringify(state);
          if (json !== lastState) {
            lastState = json;
            send('state', state);
          }
          if (state.status === 'ended' || state.status === 'stopped') break;
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch (e) {
        console.error('[live] SSE lỗi:', e instanceof Error ? e.message : e);
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
      'x-accel-buffering': 'no', // Nginx không gom dữ liệu SSE
    },
  });
}
