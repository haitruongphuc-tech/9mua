import { env } from '@/lib/env';

// Next.js gọi register() một lần khi server khởi động: thiếu cấu hình thì dừng ngay với thông báo rõ ràng.
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') env();
}
