import Link from 'next/link';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { listReportedConversations } from '@/modules/messages';
import type { FlashParams } from '../flash';

export const dynamic = 'force-dynamic';

const REASON: Record<string, string> = {
  lua_dao: 'Lừa đảo',
  quay_roi: 'Quấy rối',
  spam: 'Spam',
  khac: 'Khác',
};

// Trang CEO cho Hộp thư (SPEC-messages.md mục 7): CHỈ các cuộc trò chuyện bị báo cáo, chưa xử lý lên đầu.
// Không có chỗ đọc tin nhắn không bị báo cáo.
export default async function AdminMessagesPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [list, params] = await Promise.all([listReportedConversations(), searchParams]);
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Tin nhắn bị báo cáo</h1>
      <Flash ok={params.xong} error={params.loi} />
      <p className="text-sm text-white/70">
        Chỉ hiện cuộc trò chuyện có người báo cáo. 3 người khác nhau báo cáo cùng một tài khoản trong 7 ngày
        thì tài khoản đó tự bị cấm nhắn tin 1 ngày và có email báo.
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-white/60">Chưa có báo cáo nào.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => (
            <li key={r.conversationId}>
              <Link
                href={`/admin/tin-nhan/${r.conversationId}`}
                className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm hover:bg-white/10"
                data-testid="reported-conversation"
              >
                <span className="font-bold">
                  Bị báo cáo: {r.reportedUser.displayName || r.reportedUser.id}
                  {r.handled ? (
                    <span className="text-white/50"> · đã xử lý</span>
                  ) : (
                    <span className="text-red-400"> · chưa xử lý</span>
                  )}
                </span>
                <span className="text-white/70">
                  {r.reports} báo cáo · {r.reasons.map((x) => REASON[x] ?? x).join(', ')} · lần cuối{' '}
                  {formatDateTimeVN(new Date(r.lastReportAt))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
