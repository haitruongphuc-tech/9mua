// Chỉ cho phép quay về đường dẫn nội bộ sau đăng nhập/đăng ký (chống open redirect).
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}
