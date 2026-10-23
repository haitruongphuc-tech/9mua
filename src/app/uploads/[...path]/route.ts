import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { resolveUploadPath } from '@/lib/media/image-store';

// Production: Nginx phục vụ /uploads trực tiếp nên route này không bao giờ được gọi.
// Dùng cho máy dev và E2E (không có Nginx).
const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const target = resolveUploadPath(env().UPLOAD_DIR, (await params).path);
  const type = target ? TYPES[path.extname(target)] : undefined;
  if (!target || !type) return new Response('Not found', { status: 404 });
  try {
    const data = await readFile(target);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
