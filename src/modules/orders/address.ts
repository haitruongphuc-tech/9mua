import { z } from 'zod';
import { normalizeIdentifier } from '@/modules/identity';

const text = (label: string, max = 120) =>
  z.string().trim().min(1, `Nhập ${label}`).max(max, `${label} quá dài`);

const addressSchema = z.object({
  name: z.string().trim().min(2, 'Nhập họ tên người nhận').max(60),
  phone: z.string(),
  province: text('tỉnh/thành'),
  district: text('quận/huyện'),
  ward: text('phường/xã'),
  line: text('địa chỉ chi tiết', 200),
});

export type Address = z.infer<typeof addressSchema>;
export type AddressField = keyof Address;

export function parseAddress(
  raw: Record<string, string>,
): { ok: true; address: Address } | { ok: false; fields: Partial<Record<AddressField, string>> } {
  const parsed = addressSchema.safeParse(raw);
  const fields: Partial<Record<AddressField, string>> = {};
  if (!parsed.success) for (const i of parsed.error.issues) fields[i.path[0] as AddressField] ??= i.message;
  const phone = normalizeIdentifier(raw.phone ?? '');
  if (phone?.kind !== 'phone') fields.phone ??= 'Số điện thoại người nhận không hợp lệ';
  if (!parsed.success || phone?.kind !== 'phone') return { ok: false, fields };
  return { ok: true, address: { ...parsed.data, phone: phone.value } };
}
