import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Dùng chung cho 9mua.com và mọi tenkiot.9mua.com (middleware cho /robots.txt đi thẳng).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/kiot-cua-toi',
        '/tai-khoan',
        '/gio-hang',
        '/dat-hang',
        '/don-mua',
        '/dev/',
      ],
    },
    sitemap: `${env().APP_URL}/sitemap.xml`,
  };
}
