'use server';

import { getT } from '@/i18n/server';
import { getCurrentUser, requireUser } from '@/modules/identity';
import {
  banFromChat,
  getLive,
  hideChat,
  liveSummary,
  pinProduct,
  startLive,
  type StartError,
} from '@/modules/live';
import { addToCart } from '@/modules/orders';
import { endLive } from '@/server/live';

const START_ERRORS: StartError[] = [
  'ACCOUNT_TOO_NEW',
  'LIVE_FULL',
  'ALREADY_LIVE',
  'LIVE_BANNED',
  'INVALID_INPUT',
];

export async function startLiveAction(input: {
  title: string;
  pinProductId: string | null;
}): Promise<
  { ok: true; liveId: string; whipUrl: string; publishToken: string } | { ok: false; error: string }
> {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const r = await startLive(user.id, {
    title: String(input.title ?? ''),
    pinProductId: input.pinProductId || null,
  });
  if (r.ok) return r;
  const code = START_ERRORS.find((e) => e === r.error) ?? 'INVALID_INPUT';
  return { ok: false, error: t(`live.publish.err.${code}`) };
}

// Kết thúc qua src/server/live để hook xét thưởng xu được đăng ký.
export async function endLiveAction(liveId: string) {
  const user = await requireUser();
  await endLive(liveId, user.id);
  return liveSummary(liveId, user.id);
}

export async function summaryAction(liveId: string) {
  const user = await requireUser();
  return liveSummary(liveId, user.id);
}

export async function pinAction(liveId: string, productId: string | null) {
  const user = await requireUser();
  return pinProduct(liveId, user.id, productId);
}

export async function hideChatAction(messageId: string) {
  const user = await requireUser();
  return hideChat(messageId, user.id);
}

export async function banChatAction(liveId: string, userId: string) {
  const user = await requireUser();
  return banFromChat(liveId, user.id, userId);
}

// "+ Giỏ" trên thẻ sản phẩm đang ghim: chỉ ghi nguồn buổi live khi sản phẩm đúng là đang ghim (SPEC-live.md mục 7).
export async function addLiveToCartAction(
  liveId: string,
  productId: string,
): Promise<{ ok: true; message: string } | { ok: false; login?: true; message: string }> {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  if (!user) return { ok: false, login: true, message: t('live.chat.login') };
  const live = await getLive(liveId);
  const source = live?.pinnedProductId === productId ? { liveId } : undefined;
  const r = await addToCart(user.id, productId, 1, source);
  if (r.ok) return { ok: true, message: t('live.added') };
  return {
    ok: false,
    message:
      r.error === 'EXCEEDS_STOCK'
        ? t('shop.cart.err.onlyLeft', { stock: r.stock })
        : t(`shop.cart.err.${r.error}`),
  };
}
