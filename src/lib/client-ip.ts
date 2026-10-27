// IP người gọi: Nginx đặt X-Real-IP. Không có (chạy thử, E2E) thì dùng địa chỉ giả cố định.
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}
