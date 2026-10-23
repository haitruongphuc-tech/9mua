'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/modules/identity';
import { setPayoutAccount } from '@/modules/kiot';

export type PayoutFormState = {
  ok?: string;
  error?: string;
  fields?: Partial<Record<'bankBin' | 'accountNumber' | 'accountName', string>>;
  values?: { bankBin: string; accountNumber: string; accountName: string };
};

export async function setPayoutAccountAction(_p: PayoutFormState, form: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  const values = {
    bankBin: String(form.get('bankBin') ?? ''),
    accountNumber: String(form.get('accountNumber') ?? ''),
    accountName: String(form.get('accountName') ?? ''),
  };
  const result = await setPayoutAccount(user.id, { ...values, password: String(form.get('password') ?? '') });
  if (!result.ok) {
    if (result.error === 'INVALID_INPUT') return { values, fields: result.fields };
    return {
      values,
      error: result.error === 'WRONG_PASSWORD' ? 'Mật khẩu không đúng.' : 'Bạn chưa có Kiot.',
    };
  }
  revalidatePath('/kiot-cua-toi/cai-dat');
  return { ok: 'Đã lưu tài khoản nhận tiền. Rút tiền sẽ tạm giữ 24 giờ sau mỗi lần đổi.' };
}
