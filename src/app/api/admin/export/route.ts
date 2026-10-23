import { audit } from '@/lib/audit';
import { getVerifiedAdmin, incomingCsv, outgoingCsv } from '@/modules/admin';

export const dynamic = 'force-dynamic';

const day = (s: string | null, fallback: Date) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  return new Date(`${s}T00:00:00+07:00`);
};

// Xuất sổ giao dịch CSV cho kế toán. ?loai=vao|ra&tu=YYYY-MM-DD&den=YYYY-MM-DD (ngày giờ VN, gồm cả ngày "đến").
export async function GET(request: Request) {
  const admin = await getVerifiedAdmin();
  if (!admin) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  const type = url.searchParams.get('loai') === 'ra' ? 'ra' : 'vao';
  const from = day(url.searchParams.get('tu'), new Date(Date.now() - 30 * 86_400_000));
  const to = new Date(day(url.searchParams.get('den'), new Date()).getTime() + 86_400_000);
  const csv = type === 'vao' ? await incomingCsv(from, to) : await outgoingCsv(from, to);
  await audit({
    adminId: admin.id,
    action: `export.${type}`,
    targetType: 'ledger',
    targetId: `${from.toISOString()}..${to.toISOString()}`,
  });
  const name = `9mua-tien-${type}-${url.searchParams.get('tu') ?? 'tu'}-${url.searchParams.get('den') ?? 'den'}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
