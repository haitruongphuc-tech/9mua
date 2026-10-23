import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { MAX_IMAGE_BYTES } from '@/lib/media/process-image';
import { getCurrentUser } from '@/modules/identity';
import { submitKyc } from '@/modules/payouts';

export const dynamic = 'force-dynamic';

const back = (q: string) => NextResponse.redirect(`${env().APP_URL}/kiot-cua-toi/xac-minh?${q}`, 303);

// Nộp CCCD (2 ảnh, mỗi ảnh ≤ 10MB). Nginx cho route này tối đa 25MB.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${env().APP_URL}/dang-nhap?next=/kiot-cua-toi/xac-minh`, 303);
  if (Number(request.headers.get('content-length') ?? 0) > 2 * MAX_IMAGE_BYTES + 256 * 1024)
    return back('loi=TOO_LARGE');

  const form = await request.formData();
  const front = form.get('front');
  const backImage = form.get('back');
  if (!(front instanceof File) || !(backImage instanceof File) || !front.size || !backImage.size)
    return back('loi=INVALID_IMAGE');
  const result = await submitKyc(user.id, {
    fullName: String(form.get('fullName') ?? ''),
    idNumber: String(form.get('idNumber') ?? ''),
    front: Buffer.from(await front.arrayBuffer()),
    back: Buffer.from(await backImage.arrayBuffer()),
  });
  if (!result.ok) return back(`loi=${result.error}`);
  return back('da-gui=1');
}
