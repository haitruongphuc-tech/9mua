import { getT } from '@/i18n/server';
import { sendChat } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

const ERRORS = ['NOT_LIVE', 'EMPTY', 'TOO_LONG', 'LINK', 'TOO_FAST', 'BANNED'] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  if (!user) return Response.json({ error: 'LOGIN' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const r = await sendChat((await params).id, user.id, String(body.text ?? ''));
  if (r.ok) return Response.json({ ok: true, id: r.id });
  const code = ERRORS.find((e) => e === r.error) ?? 'NOT_LIVE';
  return Response.json({ ok: false, error: t(`live.chat.err.${code}`) }, { status: 400 });
}
