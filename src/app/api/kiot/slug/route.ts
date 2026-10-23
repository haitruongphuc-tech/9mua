import { isSlugAvailable } from '@/modules/kiot';
import { KIOT_ERROR_MESSAGES } from '@/modules/kiot/messages';

export const dynamic = 'force-dynamic';

// Kiểm tra địa chỉ Kiot còn trống khi người dùng đang gõ.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('value') ?? '';
  const result = await isSlugAvailable(slug.slice(0, 64));
  return Response.json(result.ok ? { ok: true } : { ok: false, message: KIOT_ERROR_MESSAGES[result.error] });
}
