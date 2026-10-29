import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { reportedConversationDetail } from '@/modules/messages';
import type { FlashParams } from '../../flash';
import { banMessagesAction, hideMessageAction, markHandledAction } from '../actions';

export const dynamic = 'force-dynamic';

const input = 'h-10 min-w-0 flex-1 rounded-[12px] border border-white/15 bg-white/10 px-3 text-white';

// 50 tin gần nhất tính tới lúc bị báo cáo (kể cả tin đã ẩn). Ẩn tin, cấm nhắn tin, đánh dấu đã xử lý; có nhật ký.
export default async function ReportedConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: FlashParams;
}) {
  await requireAdminVerified();
  const [{ id }, flash] = await Promise.all([params, searchParams]);
  const detail = await reportedConversationDetail(id);
  if (!detail) notFound();
  const name = new Map(detail.users.map((u) => [u.id, u.displayName || u.id]));
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <Link href="/admin/tin-nhan" className="text-sm text-brand">
        ← Tin nhắn bị báo cáo
      </Link>
      <h1 className="text-xl font-extrabold">{detail.users.map((u) => u.displayName).join(' ↔ ')}</h1>
      <Flash ok={flash.xong} error={flash.loi} />
      <ul className="flex flex-col gap-2 text-sm" data-testid="reported-messages">
        {detail.messages.map((m) => (
          <li key={m.id} className="rounded-[14px] border border-white/10 bg-white/5 p-3">
            <p className="text-white/60">
              {name.get(m.senderId)} · {formatDateTimeVN(new Date(m.createdAt))}
              {m.hidden ? <span className="text-red-400"> · đã ẩn</span> : null}
            </p>
            {m.text ? <p className="mt-1 whitespace-pre-wrap">{m.text}</p> : null}
            {m.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư qua route có kiểm quyền
              <img src={m.imageUrl} alt="" className="mt-1 max-h-48 rounded-[10px]" />
            ) : null}
            {m.product ? (
              <p className="mt-1 text-white/70">
                Sản phẩm: {m.product.name} · {formatVnd(m.product.price)}
              </p>
            ) : null}
            {m.hidden ? null : (
              <form action={hideMessageAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="conversationId" value={detail.conversationId} />
                <input type="hidden" name="messageId" value={m.id} />
                <input name="reason" required minLength={3} placeholder="Lý do ẩn" className={input} />
                <ConfirmSubmit confirm="Ẩn tin nhắn này?" tone="danger">
                  Ẩn tin
                </ConfirmSubmit>
              </form>
            )}
          </li>
        ))}
      </ul>
      {detail.users.map((u) => (
        <form key={u.id} action={banMessagesAction} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="conversationId" value={detail.conversationId} />
          <input type="hidden" name="userId" value={u.id} />
          <span className="font-bold">{u.displayName}</span>
          <select name="days" defaultValue="7" className={`${input} max-w-[150px] flex-none`}>
            <option value="1">Cấm 1 ngày</option>
            <option value="7">Cấm 7 ngày</option>
            <option value="30">Cấm 30 ngày</option>
            <option value="forever">Cấm vĩnh viễn</option>
          </select>
          <input name="reason" required minLength={3} placeholder="Lý do cấm" className={input} />
          <ConfirmSubmit confirm="Cấm tài khoản này nhắn tin?" tone="danger">
            Cấm nhắn tin
          </ConfirmSubmit>
        </form>
      ))}
      <form action={markHandledAction}>
        <input type="hidden" name="conversationId" value={detail.conversationId} />
        <button type="submit" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
          Đánh dấu đã xử lý
        </button>
      </form>
    </section>
  );
}
