import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { featureStates, requireAdminVerified } from '@/modules/admin';
import type { FlashParams } from '../flash';
import { setFeatureAction } from './actions';

export const dynamic = 'force-dynamic';

// Công tắc chức năng của đợt nâng cấp (SPEC-admin.md V5.0, docs/nang-cap-mot-dot.md mục 3). Tắt thì nút, trang, API của
// nhóm đó ẩn hẳn; dữ liệu đã có giữ nguyên.
export default async function FeatureSwitchesPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [states, params] = await Promise.all([featureStates(), searchParams]);
  const field = 'h-10 w-28 rounded-[12px] border border-white/15 bg-white/10 px-3 text-base text-white';
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Công tắc chức năng</h1>
      <p className="text-sm text-white/70">
        Tắt một nhóm thì nút, trang và API của nhóm đó ẩn hẳn, dữ liệu đã có giữ nguyên. Công tắc có nhãn 💰
        đụng tiền: bật phải nhập mã xác thực 2 lớp.
      </p>
      <Flash ok={params.xong} error={params.loi} />
      <ul className="flex flex-col gap-2">
        {states.map((s) => (
          <li
            key={s.name}
            className={`flex flex-col gap-2 rounded-2xl border p-4 ${s.on ? 'border-success/50 bg-success/5' : 'border-white/10 bg-white/5'}`}
            data-testid={`feature-${s.name}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-extrabold">
                {s.money ? '💰 ' : ''}
                {s.label} <span className="text-xs font-normal text-white/50">· {s.codes}</span>
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${s.on ? 'bg-success text-ink' : 'bg-white/15'}`}
                data-testid="feature-state"
              >
                {s.on ? 'Đang bật' : 'Đang tắt'}
              </span>
            </div>
            {s.reason && !s.on ? <p className="text-xs text-white/60">Tắt sẵn vì: {s.reason}</p> : null}
            {s.missing.length ? (
              <p className="text-xs font-bold text-yellow-300" data-testid="feature-missing">
                Chưa có khoá: {s.missing.join(', ')}
              </p>
            ) : (
              <form
                action={setFeatureAction.bind(null, s.name, !s.on)}
                className="flex flex-wrap items-center gap-2"
              >
                {s.money && !s.on ? (
                  <input name="totp" inputMode="numeric" placeholder="Mã 2 lớp" className={field} required />
                ) : null}
                <ConfirmSubmit
                  confirm={`${s.on ? 'Tắt' : 'Bật'} "${s.label}"?`}
                  tone={s.on ? 'danger' : 'plain'}
                >
                  {s.on ? 'Tắt' : 'Bật'}
                </ConfirmSubmit>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
