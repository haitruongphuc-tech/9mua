'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { createKiot, updateKiot } from '@/modules/kiot';
import { KIOT_ERROR_MESSAGES } from '@/modules/kiot/messages';

export type KiotFormValues = { name: string; slug: string; description: string; contactPhone: string };
export type KiotFormState = {
  values?: KiotFormValues;
  fields?: Partial<Record<keyof KiotFormValues, string>>;
  message?: string;
  ok?: string;
};

function readForm(form: FormData): KiotFormValues {
  return {
    name: String(form.get('name') ?? ''),
    slug: String(form.get('slug') ?? '')
      .trim()
      .toLowerCase(),
    description: String(form.get('description') ?? ''),
    contactPhone: String(form.get('contactPhone') ?? ''),
  };
}

function toState(
  values: KiotFormValues,
  result: { ok: false; error: string; fields?: KiotFormState['fields'] },
) {
  if (result.error === 'INVALID_INPUT') return { values, fields: result.fields };
  const message = KIOT_ERROR_MESSAGES[result.error as keyof typeof KIOT_ERROR_MESSAGES];
  return result.error.startsWith('SLUG_') ? { values, fields: { slug: message } } : { values, message };
}

export async function createKiotAction(_p: KiotFormState, form: FormData): Promise<KiotFormState> {
  const user = await requireUser();
  const values = readForm(form);
  const result = await createKiot(user.id, values);
  if (!result.ok) return toState(values, result);
  redirect('/kiot-cua-toi?moi-tao=1');
}

export async function updateKiotAction(_p: KiotFormState, form: FormData): Promise<KiotFormState> {
  const user = await requireUser();
  const values = readForm(form);
  const result = await updateKiot(user.id, values);
  if (!result.ok) return toState(values, result);
  revalidatePath('/kiot-cua-toi', 'layout');
  return { values, ok: 'Đã lưu thông tin Kiot.' };
}
