import { MessageCircle } from 'lucide-react';
import { openConversationAction } from '@/app/hop-thu/actions';
import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/modules/identity';

// Nút "Nhắn tin" (trang Kiot, creator) và "Hỏi Kiot" (trang sản phẩm, gửi kèm thẻ sản phẩm) — SPEC-messages.md mục 2.
// Chưa đăng nhập thì dẫn tới trang đăng nhập. Không hiện cho chính chủ.
export async function MessageButton({
  toUserId,
  productId,
  loginHref,
  kind = 'message',
}: {
  toUserId: string;
  productId?: string;
  loginHref: string;
  kind?: 'message' | 'ask';
}) {
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  if (user?.id === toUserId) return null;
  const label = t(kind === 'ask' ? 'inbox.askShop' : 'inbox.message');
  const className =
    'flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 text-[12px] font-black hover:bg-white/20';
  if (!user)
    return (
      <a href={loginHref} className={className} data-testid="message-button">
        <MessageCircle className="h-4 w-4" aria-hidden /> {label}
      </a>
    );
  return (
    <form action={openConversationAction.bind(null, toUserId, productId ?? null)}>
      <button type="submit" className={className} data-testid="message-button">
        <MessageCircle className="h-4 w-4" aria-hidden /> {label}
      </button>
    </form>
  );
}
