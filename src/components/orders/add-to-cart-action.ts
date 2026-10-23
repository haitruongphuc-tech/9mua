'use server';

import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { isProductTagged } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';
import { addToCart } from '@/modules/orders';
import { CART_ERROR_MESSAGES } from '@/modules/orders/messages';

export type AddToCartState = { ok?: boolean; message?: string };

export async function addToCartAction(
  productId: string,
  sourceVideoId: string | null,
  _p: AddToCartState,
  form: FormData,
): Promise<AddToCartState> {
  const qty = Math.max(1, Math.min(1000, Number(form.get('qty') ?? 1) || 1));
  const user = await getCurrentUser();
  if (!user) {
    // Đăng nhập xong quay lại /gio-hang/them để tự thêm món (SPEC-orders.md mục 1).
    const next = `/gio-hang/them?sp=${encodeURIComponent(productId)}&sl=${qty}${sourceVideoId ? `&v=${encodeURIComponent(sourceVideoId)}` : ''}`;
    redirect(`${env().APP_URL}/dang-nhap?next=${encodeURIComponent(next)}`);
  }
  // Chỉ ghi nguồn video khi video đó thật sự gắn sản phẩm này (thống kê creator không bị ghi giả).
  const source =
    sourceVideoId && (await isProductTagged(sourceVideoId, productId)) ? sourceVideoId : undefined;
  const result = await addToCart(user.id, productId, qty, source);
  if (!result.ok) {
    return {
      message:
        result.error === 'EXCEEDS_STOCK'
          ? `Chỉ còn ${result.stock} sản phẩm.`
          : CART_ERROR_MESSAGES[result.error],
    };
  }
  return { ok: true, message: 'Đã thêm vào giỏ hàng.' };
}
