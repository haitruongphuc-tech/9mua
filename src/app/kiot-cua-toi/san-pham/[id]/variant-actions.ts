'use server';

import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { upsertVariants, type VariantInput } from '@/modules/kiot';

// Lưu biến thể (SPEC-kiot.md V5.6). Tắt công tắc thì không tạo / sửa biến thể được; biến thể đã có vẫn bán.
export async function saveVariantsAction(productId: string, form: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await isFeatureOn('variants'))) redirect(`/kiot-cua-toi/san-pham/${productId}`);
  let input: { optionNames: string[]; variants: VariantInput[] } = { optionNames: [], variants: [] };
  try {
    input = JSON.parse(String(form.get('payload') ?? '{}'));
  } catch {}
  const r = await upsertVariants(user.id, productId, {
    optionNames: Array.isArray(input.optionNames) ? input.optionNames.map(String) : [],
    variants: Array.isArray(input.variants) ? input.variants : [],
  });
  redirect(
    `/kiot-cua-toi/san-pham/${productId}?${r.ok ? 'da-luu=bien-the' : `loi-bien-the=${r.error}`}#bien-the`,
  );
}
