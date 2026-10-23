import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from '@/lib/env';
import { kiotOrigin } from '@/lib/urls';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, kiotStatus } from '@/modules/kiot';
import { StatusBadge } from './StatusBadge';

export const metadata: Metadata = { title: 'Kiot của tôi', robots: { index: false } };

const dateVN = (d: Date) => d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ 'moi-tao'?: string }>;
}) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-12 text-center">
        <h1 className="text-2xl font-extrabold">Bạn chưa có Kiot</h1>
        <p className="max-w-sm text-black/70">
          Mở Kiot tại tenkiot.9mua.com, đăng sản phẩm và bán trên Chợ 9MUA.
        </p>
        <Link
          href="/kiot-cua-toi/tao"
          className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
        >
          Tạo Kiot ngay
        </Link>
      </section>
    );
  }

  const status = kiotStatus(kiot);
  const url = kiotOrigin(kiot.slug);
  const justCreated = Boolean((await searchParams)['moi-tao']);
  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      {justCreated ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã tạo Kiot! Hãy đăng sản phẩm rồi kích hoạt để Kiot hiện công khai.
        </p>
      ) : null}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">{kiot.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm text-black/70" data-testid="kiot-url">
            {kiot.slug}.{env().ROOT_DOMAIN}
          </span>
        </div>
        {kiot.activeUntil && status !== 'locked' ? (
          <p className="text-sm text-black/70">
            {status === 'active' ? 'Hoạt động đến' : 'Đã hết hạn ngày'} {dateVN(kiot.activeUntil)}
          </p>
        ) : null}
        {status === 'locked' ? (
          <p className="text-sm text-danger">
            Kiot bị khoá{kiot.lockReason ? `: ${kiot.lockReason}` : ''}. Liên hệ 9MUA.
          </p>
        ) : null}
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/kiot-cua-toi/san-pham"
          className="rounded-2xl border-2 border-black/10 p-4 font-bold hover:border-brand-ink"
        >
          Quản lý sản phẩm →
        </Link>
        <a href={url} className="rounded-2xl border-2 border-black/10 p-4 font-bold hover:border-brand-ink">
          Xem trang Kiot →
        </a>
      </div>
    </section>
  );
}
