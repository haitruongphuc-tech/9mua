// Định dạng tiền và ngày theo kiểu Việt Nam.
export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

export function formatDateVN(date: Date): string {
  return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatDateTimeVN(date: Date): string {
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

// Ngày giờ theo ngôn ngữ đang chọn (SPEC-i18n.md mục 6), luôn theo giờ Việt Nam. Tiếng Việt giữ đúng kiểu cũ.
export function formatDateTime(date: Date, lang: string): string {
  return date.toLocaleString(lang === 'vi' ? 'vi-VN' : lang, { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

// "45.000" / "45,000đ" → 45000; chuỗi rỗng → null.
export function parseVndInput(value: FormDataEntryValue | null): number | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}
