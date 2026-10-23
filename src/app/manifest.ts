import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất',
    short_name: '9MUA',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#fc6f15',
    lang: 'vi',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
