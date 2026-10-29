import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasLink } from '@/modules/social';
import { activeBan, isBlocked, isMember, otherOf } from './access';
import { MAX_TEXT, MIN_GAP_MS } from './rules';
import { productCards, toViews, type MessageView } from './view';

export type SendError =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'LINK'
  | 'TOO_FAST'
  | 'REQUEST_PENDING'
  | 'BLOCKED'
  | 'BANNED'
  | 'NOT_MEMBER'
  | 'IMAGE_INVALID';

// Gửi tin (SPEC-messages.md mục 3–5): chữ ≤ 1.000 ký tự, không link, 1 tin mỗi giây; người lạ chỉ gửi 1 tin tới khi
// được chấp nhận; người nhận trả lời thì coi như chấp nhận. Tin mới làm hiện lại cuộc trò chuyện đã xoá phía mình.
export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { text?: string | null; imageId?: string | null; productId?: string | null },
): Promise<{ ok: true; message: MessageView } | { ok: false; error: SendError }> {
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || !isMember(c, userId)) return { ok: false, error: 'NOT_MEMBER' };
  if (await activeBan(userId)) return { ok: false, error: 'BANNED' };
  if (await isBlocked(userId, otherOf(c, userId))) return { ok: false, error: 'BLOCKED' };

  const text = input.text?.trim() || null;
  if (text && text.length > MAX_TEXT) return { ok: false, error: 'TOO_LONG' };
  if (text && hasLink(text)) return { ok: false, error: 'LINK' };
  let imageId: string | null = null;
  if (input.imageId) {
    const image = await db.messageImage.findFirst({ where: { id: input.imageId, ownerId: userId } });
    const used = image ? await db.message.count({ where: { imageId: image.id } }) : 1;
    if (!image || used > 0) return { ok: false, error: 'IMAGE_INVALID' };
    imageId = image.id;
  }
  const productId =
    input.productId && (await productCards([input.productId])).has(input.productId) ? input.productId : null;
  if (!text && !imageId && !productId) return { ok: false, error: 'EMPTY' };

  const at = now();
  const last = await db.message.findFirst({
    where: { senderId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (last && at.getTime() - last.createdAt.getTime() < MIN_GAP_MS) return { ok: false, error: 'TOO_FAST' };

  let accept = false;
  if (c.status === 'request') {
    if (c.requestedById === userId) {
      const mine = await db.message.count({ where: { conversationId, senderId: userId } });
      if (mine >= 1) return { ok: false, error: 'REQUEST_PENDING' };
    } else accept = true;
  }

  const row = await db.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: { conversationId, senderId: userId, text, imageId, productId, createdAt: at },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: at, ...(accept ? { status: 'active', acceptedAt: at } : {}) },
    });
    await tx.conversationMember.updateMany({ where: { conversationId }, data: { hiddenAt: null } });
    // Người gửi đã "đọc" tới tin của chính mình.
    await tx.conversationMember.updateMany({ where: { conversationId, userId }, data: { lastReadAt: at } });
    return m;
  });
  const [message] = await toViews([row]);
  return { ok: true, message: message! };
}
