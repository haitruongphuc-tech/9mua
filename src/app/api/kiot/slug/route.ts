import { kiotErrorText } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { isSlugAvailable } from '@/modules/kiot';

export const dynamic = 'force-dynamic';

// Kiểm tra địa chỉ Kiot còn trống khi người dùng đang gõ.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('value') ?? '';
  const result = await isSlugAvailable(slug.slice(0, 64));
  if (result.ok) return Response.json({ ok: true });
  return Response.json({ ok: false, message: kiotErrorText(await getT(), result.error) });
}
