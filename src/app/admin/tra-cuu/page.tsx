import Link from 'next/link';
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { STATUS_LABELS } from '@/components/orders/status';
import { formatDateTimeVN, formatDateVN, formatVnd } from '@/lib/format';
import { kiotOrigin } from '@/lib/urls';
import { requireAdminVerified, searchKiots, searchOrders, searchUsers } from '@/modules/admin';
import type { FlashParams } from '../flash';
import * as act from './actions';
import { TempPassword } from './TempPassword';

export const dynamic = 'force-dynamic';
const input = 'h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 text-white px-3';
const TYPES = [
  ['nguoi-dung', 'Người dùng'],
  ['kiot', 'Kiot'],
  ['don', 'Đơn hàng'],
] as const;

export default async function LookupPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const params = await searchParams;
  const type = TYPES.some(([t]) => t === params.loai) ? params.loai! : 'nguoi-dung';
  const q = params.q?.trim() ?? '';
  const qs = new URLSearchParams({ loai: type, ...(q ? { q } : {}) }).toString();
  const [users, kiots, orders] = await Promise.all([
    type === 'nguoi-dung' ? searchUsers(q) : [],
    type === 'kiot' ? searchKiots(q) : [],
    type === 'don' ? searchOrders(q) : [],
  ]);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Tra cứu</h1>
      <Flash ok={params.xong} error={params.loi} />
      <form action="/admin/tra-cuu" method="get" className="flex flex-wrap gap-2">
        <select
          name="loai"
          defaultValue={type}
          className="h-11 rounded-[14px] border border-white/15 bg-white/10 text-white px-3"
          aria-label="Loại"
        >
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          placeholder="SĐT, email, tên, slug, mã DH…"
          className={input}
          data-testid="lookup-q"
        />
        <button type="submit" className="h-11 rounded-full bg-brand px-5 font-black text-white">
          Tìm
        </button>
      </form>

      {users.map((u) => (
        <article
          key={u.id}
          className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
          data-testid="user-row"
        >
          <p className="font-extrabold">
            {u.displayName} {u.role === 'admin' ? '· CEO' : ''}{' '}
            {u.lockedAt ? <span className="text-red-400">· đang khoá</span> : null}
          </p>
          <p className="text-sm text-white/70">
            {u.phone ? '0' + u.phone.slice(3) : '—'} · {u.email ?? 'không có email'} · tạo{' '}
            {formatDateVN(u.createdAt)}
          </p>
          <p className="text-sm">
            {u.kiot ? (
              <Link href={`/admin/tra-cuu?loai=kiot&q=${u.kiot.slug}`} className="underline">
                Kiot {u.kiot.name}
              </Link>
            ) : (
              'Chưa có Kiot'
            )}{' '}
            · {u.orders} đơn mua · {u.videos} video ·{' '}
            <Link href={`/creator/${u.id}`} className="underline">
              trang cá nhân
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            {u.lockedAt ? (
              <form action={act.unlockUserAction.bind(null, u.id, qs)}>
                <ConfirmSubmit confirm="Mở khoá tài khoản này?" tone="plain">
                  Mở khoá
                </ConfirmSubmit>
              </form>
            ) : (
              <form action={act.lockUserAction.bind(null, u.id, qs)} className="flex min-w-0 flex-1 gap-2">
                <input name="reason" required placeholder="Lý do khoá" className={input} />
                <ConfirmSubmit confirm="Khoá tài khoản và đăng xuất mọi thiết bị?" tone="danger">
                  Khoá
                </ConfirmSubmit>
              </form>
            )}
            <form action={act.sendResetLinkAction.bind(null, u.id, qs)}>
              <ConfirmSubmit confirm="Gửi link đặt lại mật khẩu qua email?" tone="plain">
                Gửi link đặt lại
              </ConfirmSubmit>
            </form>
            <TempPassword userId={u.id} />
          </div>
          <form action={act.clearProfileAction.bind(null, u.id, qs)} className="flex min-w-0 gap-2">
            <input name="reason" required placeholder="Lý do gỡ ảnh / giới thiệu" className={input} />
            <ConfirmSubmit confirm="Gỡ ảnh đại diện, ảnh bìa và giới thiệu của tài khoản này?" tone="danger">
              Gỡ hồ sơ
            </ConfirmSubmit>
          </form>
        </article>
      ))}

      {kiots.map((k) => (
        <article
          key={k.id}
          className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
          data-testid="kiot-row"
        >
          <p className="font-extrabold">
            <a href={kiotOrigin(k.slug)} className="underline">
              {k.name}
            </a>{' '}
            · {k.slug} {k.lockedAt ? <span className="text-red-400">· khoá: {k.lockReason}</span> : null}
          </p>
          <p className="text-sm text-white/70">
            Chủ: {k.owner.displayName} ({k.owner.phone ? '0' + k.owner.phone.slice(3) : '—'}) ·{' '}
            {k._count.products} sản phẩm ·{' '}
            {k.activeUntil ? `hạn ${formatDateVN(k.activeUntil)}` : 'chưa kích hoạt'}
          </p>
          <p className="text-sm">
            Số dư có thể rút <b>{formatVnd(k.balance.available)}</b> · đang chờ {formatVnd(k.balance.pending)}
          </p>
          {k.subscriptions.length ? (
            <p className="text-xs text-white/60">
              Phí thuê:{' '}
              {k.subscriptions
                .map(
                  (s) =>
                    `${formatDateVN(s.createdAt)} ${s.source === 'payos' ? formatVnd(s.amount) : 'tặng'}`,
                )
                .join(' · ')}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            {k.lockedAt ? (
              <form action={act.unlockKiotAction.bind(null, k.id, qs)}>
                <ConfirmSubmit confirm="Mở khoá Kiot?" tone="plain">
                  Mở khoá Kiot
                </ConfirmSubmit>
              </form>
            ) : (
              <form action={act.lockKiotAction.bind(null, k.id, qs)} className="flex gap-2">
                <input name="reason" required placeholder="Lý do khoá Kiot" className={input} />
                <ConfirmSubmit confirm="Khoá Kiot (ẩn khỏi Chợ)?" tone="danger">
                  Khoá
                </ConfirmSubmit>
              </form>
            )}
            <form action={act.grantYearAction.bind(null, k.id, qs)} className="flex gap-2">
              <input name="reason" required placeholder="Lý do tặng 1 năm" className={input} />
              <ConfirmSubmit confirm="Tặng Kiot 1 năm sử dụng?" tone="plain">
                Tặng 1 năm
              </ConfirmSubmit>
            </form>
            <form action={act.adjustBalanceAction.bind(null, k.id, qs)} className="flex flex-wrap gap-2">
              <select
                name="sign"
                className="h-11 rounded-[14px] border border-white/15 bg-white/10 text-white px-2"
                aria-label="Cộng hay trừ"
              >
                <option value="+">Cộng</option>
                <option value="-">Trừ</option>
              </select>
              <input
                name="amount"
                inputMode="numeric"
                required
                placeholder="Số tiền"
                className="h-11 w-28 rounded-[14px] border border-white/15 bg-white/10 text-white px-3"
              />
              <input name="reason" required placeholder="Lý do điều chỉnh" className={input} />
              <ConfirmSubmit confirm="Điều chỉnh số dư Kiot?" tone="danger">
                Điều chỉnh
              </ConfirmSubmit>
            </form>
          </div>
        </article>
      ))}

      {orders.map((o) => (
        <article
          key={o.id}
          className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-white/5 p-4"
          data-testid="order-row"
        >
          <p className="font-extrabold">
            {o.code} · {STATUS_LABELS[o.status] ?? o.status} · {formatVnd(o.total)}
          </p>
          <p className="text-sm text-white/70">
            {o.kiot.name} · {formatDateTimeVN(o.createdAt)} ·{' '}
            {o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
          </p>
          <ol className="mt-1 text-xs text-white/70">
            {o.events.map((e) => (
              <li key={e.id}>
                {formatDateTimeVN(e.createdAt)} — {e.action} ({e.actorRole}){e.reason ? `: ${e.reason}` : ''}
              </li>
            ))}
          </ol>
        </article>
      ))}
      {q && users.length + kiots.length + orders.length === 0 ? (
        <p className="text-center text-white/60">Không tìm thấy.</p>
      ) : null}
    </section>
  );
}
