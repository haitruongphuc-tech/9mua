import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { addToCart } from '@/modules/orders';

export const dynamic = 'force-dynamic';

// Tiếp tục "Thêm vào giỏ" sau khi đăng nhập. Chỉ thêm vào giỏ của chính người đang đăng nhập,
// số lượng bị chặn theo tồn kho thật nên link lạ không gây hại ngoài việc thêm món vào giỏ.
export default async function ContinueAddToCart({
  searchParams,
}: {
  searchParams: Promise<{ sp?: string; sl?: string; v?: string }>;
}) {
  const user = await requireUser();
  const { sp, sl, v } = await searchParams;
  if (sp) {
    const result = await addToCart(user.id, sp, Math.max(1, Math.min(1000, Number(sl) || 1)), v);
    if (!result.ok) redirect(`/gio-hang?loi=${result.error}`);
  }
  redirect('/gio-hang?da-them=1');
}
