import type { MessageKey } from './messages/vi';
import type { Vars } from './translate';

// Các module (kiot, orders, payouts…) trả lỗi kiểm tra dữ liệu bằng câu tiếng Việt (giữ nguyên hợp đồng index.ts).
// Lớp giao diện đổi câu đó sang khoá dịch ở đây; câu lạ thì giữ nguyên tiếng Việt (SPEC-i18n.md mục 7).
const MAP: Record<string, MessageKey> = {
  'Tên Kiot cần ít nhất 2 ký tự': 'seller.v.kiotNameMin',
  'Tên Kiot tối đa 60 ký tự': 'seller.v.kiotNameMax',
  'Mô tả tối đa 500 ký tự': 'seller.v.desc500',
  'Mô tả tối đa 5.000 ký tự': 'seller.v.desc5000',
  'Số điện thoại liên hệ không hợp lệ': 'seller.v.contactPhone',
  'Phí ship là số nguyên': 'seller.v.shipInt',
  'Phí ship không âm': 'seller.v.shipMin',
  'Phí ship tối đa 200.000đ': 'seller.v.shipMax',
  'Ngưỡng miễn phí phải lớn hơn 0': 'seller.v.freeMin',
  'Tên sản phẩm cần ít nhất 2 ký tự': 'seller.v.productNameMin',
  'Tên tối đa 120 ký tự': 'seller.v.name120',
  'Nhập giá bán': 'seller.v.priceRequired',
  'Giá phải là số nguyên': 'seller.v.priceInt',
  'Giá bán tối thiểu 1.000đ': 'seller.v.priceMin',
  'Giá bán tối đa 100.000.000đ': 'seller.v.priceMax',
  'Nhập tồn kho': 'seller.v.stockRequired',
  'Tồn kho là số nguyên': 'seller.v.stockInt',
  'Tồn kho không âm': 'seller.v.stockMin',
  'Chọn danh mục': 'seller.v.category',
  'Cần ít nhất 1 ảnh': 'seller.v.imageMin',
  'Ảnh bị trùng': 'seller.v.imageDup',
  'Giá gốc phải lớn hơn giá bán': 'seller.v.compare',
  'Ảnh không hợp lệ, hãy tải lại ảnh': 'seller.v.imageInvalid',
  'Chọn tỉnh/thành': 'seller.v.province',
  'Quận/huyện tối đa 60 ký tự': 'seller.v.district',
  'Địa chỉ tối đa 200 ký tự': 'seller.v.addressLine',
  'Chọn ngân hàng': 'seller.v.bank',
  'Số tài khoản gồm 6–19 chữ số': 'seller.v.accountNumber',
  'Nhập tên chủ tài khoản đúng như trên ngân hàng': 'seller.v.accountName',
};

type Translate = (key: MessageKey, vars?: Vars) => string;

export function localizeModuleMessage(t: Translate, message: string): string {
  const key = MAP[message];
  if (key) return t(key);
  const max = /^Tối đa (\d+) ảnh$/.exec(message);
  return max ? t('seller.v.imageMax', { max: max[1]! }) : message;
}

const IMAGE_ERRORS = ['TOO_LARGE', 'NOT_AN_IMAGE', 'HEIC_UNSUPPORTED', 'TOO_MANY_PIXELS'] as const;
const KIOT_ERRORS = [
  'SLUG_INVALID',
  'SLUG_RESERVED',
  'SLUG_TAKEN',
  'SLUG_LOCKED',
  'ALREADY_HAS_KIOT',
  'NO_KIOT',
  'PRODUCT_LIMIT',
  'TOO_MANY_PENDING',
  'NOT_FOUND',
] as const;

// Mã lỗi của module kiot và của bước xử lý ảnh → câu theo ngôn ngữ đang chọn.
export function kiotErrorText(t: Translate, code: string): string {
  const image = IMAGE_ERRORS.find((c) => c === code);
  if (image) return t(`seller.img.${image}`);
  const kiot = KIOT_ERRORS.find((c) => c === code);
  return kiot ? t(`seller.err.${kiot}`) : t('seller.err.generic');
}

// Dịch cả bộ lỗi từng ô của form (fields: { name: 'Tên Kiot cần ít nhất 2 ký tự', … }).
export function localizeFields<K extends string>(
  t: Translate,
  fields: Partial<Record<K, string>> | undefined,
): Partial<Record<K, string>> | undefined {
  if (!fields) return fields;
  const out: Partial<Record<K, string>> = {};
  for (const [k, v] of Object.entries(fields) as [K, string | undefined][])
    if (v) out[k] = localizeModuleMessage(t, v);
  return out;
}
