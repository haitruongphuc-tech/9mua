'use server';

import { getCurrentUser } from '@/modules/identity';
import { reportProduct } from '@/modules/marketplace';

export type ReportState = { ok?: string; error?: string };

export async function reportProductAction(
  productId: string,
  _p: ReportState,
  form: FormData,
): Promise<ReportState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Bạn cần đăng nhập để báo cáo.' };
  const result = await reportProduct(
    user.id,
    productId,
    String(form.get('reason') ?? ''),
    String(form.get('message') ?? ''),
  );
  if (result.ok) return { ok: 'Cảm ơn bạn. 9MUA sẽ xem xét báo cáo này.' };
  if (result.error === 'INVALID_INPUT') return { error: result.message };
  if (result.error === 'OWN_PRODUCT') return { error: 'Bạn không thể báo cáo sản phẩm của chính mình.' };
  return { error: 'Sản phẩm không còn được bán.' };
}
