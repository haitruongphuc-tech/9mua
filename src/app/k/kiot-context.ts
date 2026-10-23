import { headers } from 'next/headers';
import { kiotOrigin } from '@/lib/urls';

// Đường dẫn gốc của trang Kiot: "" khi đang ở tenkiot.9mua.com, "/k/<slug>" khi ở 9mua.com/k/<slug>.
export async function kiotBasePath(slug: string): Promise<string> {
  return (await headers()).get('x-kiot-host') === '1' ? '' : `/k/${slug}`;
}

export function kiotCanonical(slug: string, path = ''): string {
  return `${kiotOrigin(slug)}${path}`;
}
