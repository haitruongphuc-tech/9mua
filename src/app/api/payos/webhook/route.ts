import { handleWebhook } from '@/server/payments';

export const dynamic = 'force-dynamic';

// PayOS gọi khi có tiền vào. Chữ ký được kiểm trước khi đọc dữ liệu (SPEC-payments.md mục 2).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const result = await handleWebhook(body);
  return Response.json(result.body, { status: result.status });
}
