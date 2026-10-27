'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { localizeFields } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { createKiot, updateKiot } from '@/modules/kiot';
import { redeemVoucher } from '@/modules/social';

export type KiotFormValues = { name: string; slug: string; description: string; contactPhone: string };
export type KiotFormState = {
  values?: KiotFormValues;
  fields?: Partial<Record<keyof KiotFormValues, string>>;
  message?: string;
  ok?: string;
};

const KIOT_ERRORS = [
  'SLUG_INVALID',
  'SLUG_RESERVED',
  'SLUG_TAKEN',
  'SLUG_LOCKED',
  'ALREADY_HAS_KIOT',
  'NO_KIOT',
] as const;

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

async function toState(
  values: KiotFormValues,
  result: { ok: false; error: string; fields?: KiotFormState['fields'] },
): Promise<KiotFormState> {
  const t = await getT();
  if (result.error === 'INVALID_INPUT') return { values, fields: localizeFields(t, result.fields) };
  const code = KIOT_ERRORS.find((c) => c === result.error);
  const message = code ? t(`seller.err.${code}`) : t('seller.err.generic');
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
  return { values, ok: (await getT())('seller.form.saved') };
}

// "Dùng voucher – miễn phí 1 năm" (SPEC-billing.md bổ sung 27/10).
export async function redeemVoucherAction(): Promise<void> {
  const user = await requireUser();
  const r = await redeemVoucher(user.id);
  revalidatePath('/kiot-cua-toi');
  redirect(r.ok ? '/kiot-cua-toi?da-dung-voucher=1' : '/kiot-cua-toi?loi-voucher=1');
}
