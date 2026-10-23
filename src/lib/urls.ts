import { env } from './env';

// Gốc URL của một Kiot: https://<slug>.9mua.com (giữ giao thức và cổng của APP_URL khi chạy thử).
export function kiotOrigin(slug: string, appUrl: string = env().APP_URL): string {
  const url = new URL(appUrl);
  return `${url.protocol}//${slug}.${url.host}`;
}
