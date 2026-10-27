import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { LANGS } from '@/i18n/config';
import { DICTS } from '@/i18n/messages';
import { LEGAL_DEFAULTS, LEGAL_FIELDS, parseLegal } from '@/lib/legal';
import { getAllSettings, requireAdminVerified } from '@/modules/admin';
import type { FlashParams } from '../flash';
import { saveContentAction } from './actions';
import { SLOGAN_KEYS, SLOGAN_PAGES } from './keys';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Slogan & pháp lý' };

const field = 'h-11 w-full rounded-xl border-2 border-black/15 px-3 text-base';
const LEGAL_LABELS = {
  company: 'Tên công ty',
  taxId: 'Mã số thuế',
  office: 'Địa chỉ văn phòng',
  showroom: 'Địa chỉ showroom',
  hotline: 'Hotline',
  email: 'Email liên hệ',
} as const;

export default async function ContentPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [s, params] = await Promise.all([getAllSettings(), searchParams]);
  let slogans: Record<string, Record<string, string>> = {};
  try {
    slogans = JSON.parse(s.slogans_json) as typeof slogans;
  } catch {
    /* trống */
  }
  const legal = parseLegal(s.legal_info_json);
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Slogan & thông tin pháp lý</h1>
      <Flash ok={params.xong} error={params.loi} />
      <form action={saveContentAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-black/10 p-4">
          <h2 className="text-lg font-extrabold">Slogan (để trống thì dùng câu mặc định đang hiện mờ)</h2>
          {SLOGAN_KEYS.map((key) => (
            <details key={key} className="rounded-xl bg-surface-muted p-3" open={key === 'home'}>
              <summary className="cursor-pointer font-bold">{SLOGAN_PAGES[key]}</summary>
              <div className="mt-3 grid gap-2">
                {LANGS.map((l) => (
                  <label
                    key={l.code}
                    className="grid grid-cols-[48px_1fr] items-center gap-2 text-sm font-bold"
                  >
                    {l.short}
                    <input
                      name={`slogan.${key}.${l.code}`}
                      defaultValue={slogans[key]?.[l.code] ?? ''}
                      placeholder={DICTS[l.code][`common.slogan.${key}`]}
                      maxLength={120}
                      className={field}
                    />
                  </label>
                ))}
              </div>
            </details>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-black/10 p-4">
          <h2 className="text-lg font-extrabold">Thông tin pháp lý (chân trang, trang Giới thiệu)</h2>
          {LEGAL_FIELDS.map((f) => (
            <label key={f} className="flex flex-col gap-1 text-sm font-bold">
              {LEGAL_LABELS[f]}
              <input
                name={`legal.${f}`}
                defaultValue={legal[f] === LEGAL_DEFAULTS[f] ? '' : legal[f]}
                placeholder={LEGAL_DEFAULTS[f]}
                maxLength={200}
                className={field}
              />
            </label>
          ))}
        </div>
        <ConfirmSubmit confirm="Lưu slogan và thông tin pháp lý?">Lưu</ConfirmSubmit>
      </form>
    </section>
  );
}
