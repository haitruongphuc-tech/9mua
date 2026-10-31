'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { setProductWarranty, setWarrantyDefault } from '@/modules/kiot';

// Bảo hành (SPEC-kiot.md V5.5): mặc định của Kiot cho sản phẩm mới, và của từng sản phẩm.
export async function setWarrantyDefaultAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await setWarrantyDefault(user.id, String(form.get('warranty') ?? ''));
  redirect('/kiot-cua-toi/cai-dat?da-luu=bao-hanh#bao-hanh');
}

export async function setProductWarrantyAction(productId: string, form: FormData): Promise<void> {
  const user = await requireUser();
  await setProductWarranty(user.id, productId, String(form.get('warranty') ?? ''));
  redirect(`/kiot-cua-toi/san-pham/${productId}?da-luu=bao-hanh`);
}
