import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { LANGS } from '@/i18n/config';
import { DICTS } from '@/i18n/messages';
import { LEGAL_DEFAULTS, LEGAL_FIELDS, parseLegal } from '@/lib/legal';
import { getAllSettings, requireAdminVerified } from '@/modules/admin';
import type { FlashParams } from '../flash';
import { currentCommitment } from '@/modules/identity';
import {
  publishCommitmentAction,
  saveBadgesAction,
  saveContentAction,
  saveHiddenKeywordsAction,
} from './actions';
import { badgeStyle } from '@/server/kiot-badges';
import { SLOGAN_KEYS, SLOGAN_PAGES } from './keys';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Slogan & pháp lý' };

const field = 'h-11 w-full rounded-[14px] border border-white/15 bg-white/10 text-white px-3 text-base';
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
  const [s, params, commitment] = await Promise.all([getAllSettings(), searchParams, currentCommitment()]);
  const commitDefaults = DICTS.vi;
  let slogans: Record<string, Record<string, string>> = {};
  try {
    slogans = JSON.parse(s.slogans_json) as typeof slogans;
  } catch {
    /* trống */
  }
  const legal = parseLegal(s.legal_info_json);
  const badges = await badgeStyle();
  const hiddenWords = (() => {
    try {
      const v = JSON.parse(s.search_hidden_json) as { words?: unknown };
      return Array.isArray(v.words) ? v.words.filter((w): w is string => typeof w === 'string') : [];
    } catch {
      return [];
    }
  })();
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Slogan & thông tin pháp lý</h1>
      <Flash ok={params.xong} error={params.loi} />
      <form action={saveContentAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-[18px] border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-extrabold">Slogan (để trống thì dùng câu mặc định đang hiện mờ)</h2>
          {SLOGAN_KEYS.map((key) => (
            <details key={key} className="rounded-xl bg-white/5 p-3" open={key === 'home'}>
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
        <div className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
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

      {/* Tên và màu huy hiệu Kiot (SPEC-kiot.md V5.2 mục 4): 1 huy hiệu, 2 huy hiệu, 3 huy hiệu. */}
      <form
        action={saveBadgesAction}
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="admin-badges"
      >
        <h2 className="text-lg font-extrabold">Huy hiệu Kiot</h2>
        {(['origin', 'bank', 'video'] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-sm font-bold">
            {k === 'origin' ? 'Nguồn gốc' : k === 'bank' ? 'Ngân hàng' : 'Video'}
            <input name={`name.${k}`} defaultValue={badges.names[k]} maxLength={40} className={field} />
          </label>
        ))}
        <div className="flex gap-3">
          {[1, 2, 3].map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm font-bold">
              {n} huy hiệu
              <input type="color" name={`color.${n}`} defaultValue={badges.colors[n - 1]} />
            </label>
          ))}
        </div>
        <ConfirmSubmit confirm="Lưu tên và màu huy hiệu?">Lưu huy hiệu</ConfirmSubmit>
      </form>

      {/* Từ khoá ẩn khỏi "Từ khoá đang hot" (SPEC-marketplace.md V5.4 mục 3). */}
      <form
        action={saveHiddenKeywordsAction}
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="admin-hidden-keywords"
      >
        <h2 className="text-lg font-extrabold">Từ khoá không cho hiện ở &quot;đang hot&quot;</h2>
        <p className="text-sm text-white/60">
          Mỗi dòng một từ. Từ khoá hot nào chứa từ này (không dấu) sẽ bị ẩn.
        </p>
        <textarea
          name="words"
          rows={4}
          defaultValue={hiddenWords.join('\n')}
          className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-base text-white"
        />
        <ConfirmSubmit confirm="Lưu danh sách từ khoá ẩn?">Lưu từ khoá ẩn</ConfirmSubmit>
      </form>

      {/* Cam kết nội dung (SPEC-identity.md V5.6): đăng bản mới thì mọi người được hỏi lại. */}
      <form
        action={publishCommitmentAction}
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="admin-commitment"
      >
        <h2 className="text-lg font-extrabold">Cam kết nội dung · bản {commitment.version}</h2>
        <p className="text-sm text-white/60">
          Đăng bản mới thì mọi người phải đọc và đồng ý lại trước khi đăng video, sản phẩm, live hay tạo Kiot.
        </p>
        {[1, 2, 3, 4].map((i) => (
          <label key={i} className="flex flex-col gap-1 text-sm font-bold">
            Dòng {i}
            <textarea
              name={`commit.${i}`}
              required
              maxLength={200}
              rows={2}
              defaultValue={
                commitment.lines?.[i - 1] ??
                commitDefaults[`common.commit.line${i}` as keyof typeof commitDefaults]
              }
              className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-base font-normal text-white"
            />
          </label>
        ))}
        <ConfirmSubmit confirm="Đăng bản cam kết mới? Mọi người sẽ phải đồng ý lại.">
          Đăng bản mới
        </ConfirmSubmit>
      </form>
    </section>
  );
}
