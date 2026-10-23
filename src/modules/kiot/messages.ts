// Thông báo tiếng Việt cho các mã lỗi của module kiot (dùng chung cho form tạo và sửa).
export const KIOT_ERROR_MESSAGES = {
  SLUG_INVALID: 'Địa chỉ chỉ gồm chữ thường không dấu, số và dấu gạch ngang, dài 3–30 ký tự.',
  SLUG_RESERVED: 'Địa chỉ này được 9MUA giữ lại, hãy chọn tên khác.',
  SLUG_TAKEN: 'Địa chỉ này đã có Kiot khác dùng.',
  SLUG_LOCKED: 'Kiot đã kích hoạt nên không đổi được địa chỉ (để link và QR đã in không bị hỏng).',
  ALREADY_HAS_KIOT: 'Tài khoản của bạn đã có Kiot.',
  NO_KIOT: 'Bạn chưa có Kiot.',
} as const;
