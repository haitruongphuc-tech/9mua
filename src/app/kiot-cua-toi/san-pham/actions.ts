'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { kiotErrorText, localizeFields } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { parseVndInput } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { createProduct, deleteProduct, updateProduct, type ProductInput } from '@/modules/kiot';

export type ProductFormEcho = {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  category: string;
  visible: boolean;
};
export type ProductFormState = {
  fields?: Partial<Record<string, string>>;
  message?: string;
  values?: ProductFormEcho;
};

// Trả lại đúng những gì người dùng đã gõ để form không bị xoá trắng khi báo lỗi.
function echo(form: FormData): ProductFormEcho {
  const s = (k: string) => String(form.get(k) ?? '');
  return {
    name: s('name'),
    description: s('description'),
    price: s('price'),
    compareAtPrice: s('compareAtPrice'),
    stock: s('stock'),
    category: s('category'),
    visible: form.get('visible') === 'on',
  };
}

function readForm(form: FormData): ProductInput {
  return {
    name: String(form.get('name') ?? ''),
    description: String(form.get('description') ?? ''),
    price: parseVndInput(form.get('price')) ?? Number.NaN,
    compareAtPrice: parseVndInput(form.get('compareAtPrice')),
    stock: Number(String(form.get('stock') ?? '').replace(/\D/g, '') || Number.NaN),
    category: String(form.get('category') ?? ''),
    visible: form.get('visible') === 'on',
    imageIds: form.getAll('imageIds').map(String),
  };
}

async function toState(
  form: FormData,
  result: { ok: false; error: string; fields?: ProductFormState['fields'] },
): Promise<ProductFormState> {
  const t = await getT();
  const values = echo(form);
  if (result.error === 'INVALID_INPUT') return { fields: localizeFields(t, result.fields), values };
  return { values, message: kiotErrorText(t, result.error) };
}

export async function createProductAction(_p: ProductFormState, form: FormData): Promise<ProductFormState> {
  const user = await requireUser();
  const result = await createProduct(user.id, readForm(form));
  if (!result.ok) return toState(form, result);
  revalidatePath('/kiot-cua-toi/san-pham');
  redirect('/kiot-cua-toi/san-pham?da-luu=1');
}

export async function updateProductAction(
  productId: string,
  _p: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const user = await requireUser();
  const result = await updateProduct(user.id, productId, readForm(form));
  if (!result.ok) return toState(form, result);
  revalidatePath('/kiot-cua-toi/san-pham');
  redirect('/kiot-cua-toi/san-pham?da-luu=1');
}

export async function deleteProductAction(productId: string): Promise<void> {
  const user = await requireUser();
  await deleteProduct(user.id, productId);
  revalidatePath('/kiot-cua-toi/san-pham');
  redirect('/kiot-cua-toi/san-pham?da-xoa=1');
}
