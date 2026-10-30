import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { getAllSettings, listTrustedDevices, requireAdminVerified } from '@/modules/admin';
import { recentFeeRates } from '@/modules/billing';
import { formatVnd } from '@/lib/format';
import type { FlashParams } from '../flash';
import { forgetDevicesAction, saveSettingsAction, toggleAutoPayoutAction, updateRateAction } from './actions';

export const dynamic = 'force-dynamic';

const field = 'h-11 rounded-[14px] border border-white/15 bg-white/10 text-white px-3 text-base';

export default async function SettingsPage({ searchParams }: { searchParams: FlashParams }) {
  const admin = await requireAdminVerified();
  const [s, params, devices, rates] = await Promise.all([
    getAllSettings(),
    searchParams,
    listTrustedDevices(admin.id),
    recentFeeRates(5),
  ]);
  const autoOn = s.payout_auto_enabled === 'true';
  const num = (label: string, name: string, value: string, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm font-bold">
      {label}
      <input
        name={name}
        inputMode="numeric"
        defaultValue={Number(value).toLocaleString('vi-VN')}
        className={field}
      />
      {hint ? <span className="text-xs font-normal text-white/60">{hint}</span> : null}
    </label>
  );
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Cài đặt</h1>
      <Flash ok={params.xong} error={params.loi} />
      <div
        className={`flex flex-col gap-3 rounded-2xl border-4 p-4 ${autoOn ? 'border-success' : 'border-danger bg-danger/5'}`}
        data-testid="auto-switch"
      >
        <p className="text-lg font-extrabold">
          Chi tự động:{' '}
          <span className={autoOn ? 'text-green-400' : 'text-red-400'}>
            {autoOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}
          </span>
        </p>
        <p className="text-sm text-white/70">
          Tắt khi có sự cố: mọi yêu cầu rút mới sẽ vào hàng chờ duyệt tay.
        </p>
        <form action={toggleAutoPayoutAction.bind(null, !autoOn)}>
          <ConfirmSubmit
            confirm={autoOn ? 'TẮT chi tự động ngay?' : 'BẬT lại chi tự động?'}
            tone={autoOn ? 'danger' : 'brand'}
            testId="toggle-auto"
          >
            {autoOn ? 'TẮT chi tự động' : 'BẬT chi tự động'}
          </ConfirmSubmit>
        </form>
      </div>
      <form
        action={saveSettingsAction}
        className="flex flex-col gap-4 rounded-[18px] border border-white/10 bg-white/5 p-4"
      >
        <label className="flex flex-col gap-1 text-sm font-bold">
          Giá thuê Kiot (USD/năm)
          <input
            name="kiot_fee_usd"
            inputMode="decimal"
            defaultValue={(Number(s.kiot_fee_usd_cents) / 100).toFixed(2).replace('.', ',')}
            className={field}
            data-testid="kiot-fee-usd"
          />
          <span className="text-xs font-normal text-white/60">
            Đang thu {formatVnd(Number(s.kiot_fee_vnd))}/năm (tỷ giá {formatVnd(Number(s.usd_vnd_rate))}/USD).
            Web chỉ hiện VNĐ; mỗi sáng 7:00 tự cập nhật theo tỷ giá bán của Vietcombank.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Phí sàn (% trên tiền hàng)
          <input
            name="platform_fee_percent"
            inputMode="decimal"
            defaultValue={String(Number(s.platform_fee_bp) / 100).replace('.', ',')}
            className={field}
            data-testid="platform-fee"
          />
          <span className="text-xs font-normal text-white/60">
            Từ 0% đến 30%. Đơn đã đặt giữ tỉ lệ lúc đặt.
          </span>
        </label>
        {num('Phí chi hộ PayOS (đ/lần, người bán chịu)', 'payout_fee_vnd', s.payout_fee_vnd)}
        {num('Rút tối thiểu (đ)', 'payout_min_vnd', s.payout_min_vnd)}
        {num('Hạn mức chi tự động mỗi lần (đ)', 'payout_auto_max_per_request', s.payout_auto_max_per_request)}
        {num('Hạn mức mỗi Kiot mỗi ngày (đ)', 'payout_auto_max_per_kiot_day', s.payout_auto_max_per_kiot_day)}
        {num('Hạn mức toàn sàn mỗi ngày (đ)', 'payout_auto_daily_cap', s.payout_auto_daily_cap)}
        <h2 className="mt-2 text-lg font-extrabold">Tài khoản Free và voucher mở Kiot</h2>
        {num(
          'Tim + follow tối đa mỗi ngày (tài khoản Free)',
          'social_free_daily_limit',
          s.social_free_daily_limit,
          'Tài khoản chưa có Kiot đang hoạt động. Mặc định 50.',
        )}
        {num(
          'Số video đã thả tim để nhận voucher',
          'social_voucher_threshold',
          s.social_voucher_threshold,
          'Voucher = 1 năm phí Kiot, mỗi tài khoản 1 lần. Mặc định 100.',
        )}
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            name="social_voucher_enabled"
            defaultChecked={s.social_voucher_enabled === 'true'}
            className="h-5 w-5 accent-brand"
          />
          Đang tặng voucher mở Kiot
        </label>
        <h2 className="mt-2 text-lg font-extrabold">Video dài (khi bật công tắc long_video)</h2>
        {num(
          'Video dài tối đa (giây)',
          'video_long_max_seconds',
          s.video_long_max_seconds,
          'Mặc định 3.600 giây (60 phút). Công tắc tắt thì video tối đa 60 giây.',
        )}
        {num('Dung lượng video tối đa (MB)', 'video_max_mb', s.video_max_mb, 'Mặc định 2.048MB (2GB).')}
        {num(
          'Tổng phút video dài mỗi người mỗi ngày',
          'video_long_daily_minutes',
          s.video_long_daily_minutes,
          'Chỉ tính video dài hơn 60 giây. Mặc định 120 phút.',
        )}
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            name="video_enable_1080"
            defaultChecked={s.video_enable_1080 === 'true'}
            className="h-5 w-5 accent-brand"
          />
          Thêm mức 1080p cho video dài (tốn thêm dung lượng và thời gian xử lý)
        </label>
        <ConfirmSubmit confirm="Lưu các thay đổi cài đặt?">Lưu cài đặt</ConfirmSubmit>
      </form>
      <section
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="fee-rates"
      >
        <h2 className="text-lg font-extrabold">Tỷ giá và giá Kiot gần đây</h2>
        {rates.length === 0 ? (
          <p className="text-sm text-white/60">Chưa lấy tỷ giá lần nào.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {rates.map((r) => (
              <li key={r.id} className="rounded-xl bg-white/5 px-3 py-2">
                <p className="font-bold">
                  {formatDateTimeVN(r.createdAt)} · {r.source === 'admin' ? 'CEO đổi giá' : 'Vietcombank'} ·{' '}
                  {formatVnd(r.rate)}/USD
                </p>
                <p className={r.applied ? 'text-white/70' : 'text-red-400'}>
                  {formatVnd(r.oldFeeVnd)} → {formatVnd(r.newFeeVnd)}{' '}
                  {r.applied ? '(đã áp dụng)' : '(chưa áp dụng)'}
                  {r.note ? ` — ${r.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form action={updateRateAction}>
          <ConfirmSubmit confirm="Lấy tỷ giá Vietcombank ngay bây giờ?" tone="plain" testId="update-rate">
            Cập nhật tỷ giá ngay
          </ConfirmSubmit>
        </form>
      </section>
      <section
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="trusted-devices"
      >
        <h2 className="text-lg font-extrabold">Thiết bị đã nhớ (không phải nhập mã 2 lớp trong 30 ngày)</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-white/60">Chưa nhớ thiết bị nào.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {devices.map((d) => (
              <li key={d.id} className="rounded-xl bg-white/5 px-3 py-2">
                <p className="font-bold">{d.userAgent || 'Trình duyệt không rõ'}</p>
                <p className="text-white/60">
                  Nhớ lúc {formatDateTimeVN(d.createdAt)} · dùng lần cuối{' '}
                  {d.lastUsedAt ? formatDateTimeVN(d.lastUsedAt) : '—'} · hết hạn{' '}
                  {formatDateTimeVN(d.expiresAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form action={forgetDevicesAction}>
          <ConfirmSubmit confirm="Quên mọi thiết bị? Lần sau mọi máy phải nhập mã 2 lớp." tone="danger">
            Quên mọi thiết bị đã nhớ
          </ConfirmSubmit>
        </form>
      </section>
    </section>
  );
}
