// Next.js gọi register() một lần khi server khởi động: thiếu cấu hình thì dừng ngay với thông báo rõ ràng.
// Nạp động chỉ trong runtime Node (env.ts dùng node:path, không chạy được ở edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/lib/env');
    env();
  }
}
