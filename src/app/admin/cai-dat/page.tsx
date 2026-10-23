import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { getAllSettings, requireAdminVerified } from '@/modules/admin';
import type { FlashParams } from '../flash';
import { saveSettingsAction, toggleAutoPayoutAction } from './actions';

export const dynamic = 'force-dynamic';

const field = 'h-11 rounded-xl border-2 border-black/15 px-3 text-base';

export default async function SettingsPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [s, params] = await Promise.all([getAllSettings(), searchParams]);
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
      {hint ? <span className="text-xs font-normal text-black/60">{hint}</span> : null}
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
          <span className={autoOn ? 'text-success' : 'text-danger'}>{autoOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
        </p>
        <p className="text-sm text-black/70">
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
        className="flex flex-col gap-4 rounded-2xl border-2 border-black/10 p-4"
      >
        {num('Phí thuê Kiot (đ/năm)', 'kiot_fee_vnd', s.kiot_fee_vnd, 'Từ 2.000đ.')}
        <label className="flex flex-col gap-1 text-sm font-bold">
          Phí sàn (% trên tiền hàng)
          <input
            name="platform_fee_percent"
            inputMode="decimal"
            defaultValue={String(Number(s.platform_fee_bp) / 100).replace('.', ',')}
            className={field}
            data-testid="platform-fee"
          />
          <span className="text-xs font-normal text-black/60">
            Từ 0% đến 30%. Đơn đã đặt giữ tỉ lệ lúc đặt.
          </span>
        </label>
        {num('Phí chi hộ PayOS (đ/lần, người bán chịu)', 'payout_fee_vnd', s.payout_fee_vnd)}
        {num('Rút tối thiểu (đ)', 'payout_min_vnd', s.payout_min_vnd)}
        {num('Hạn mức chi tự động mỗi lần (đ)', 'payout_auto_max_per_request', s.payout_auto_max_per_request)}
        {num('Hạn mức mỗi Kiot mỗi ngày (đ)', 'payout_auto_max_per_kiot_day', s.payout_auto_max_per_kiot_day)}
        {num('Hạn mức toàn sàn mỗi ngày (đ)', 'payout_auto_daily_cap', s.payout_auto_daily_cap)}
        <ConfirmSubmit confirm="Lưu các thay đổi cài đặt?">Lưu cài đặt</ConfirmSubmit>
      </form>
    </section>
  );
}
