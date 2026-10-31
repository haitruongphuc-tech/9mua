import type { getT } from '@/i18n/server';
import type { ImportNetwork, PageInfo } from '@/modules/social';
import { disconnectNetworkAction, importPagesAction } from './import-actions';

const formatCompact = (n: number, lang: string) =>
  new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Nhập Page (SPEC-kiot.md V5.4): chọn mạng, dán link hoặc @tên, tick Page muốn nhập ("Chọn tất cả"), bấm "Nhập".
export function ImportPages({
  networks,
  network,
  q,
  found,
  imported,
  error,
  t,
}: {
  networks: ImportNetwork[];
  network: ImportNetwork | null;
  q: string;
  found: PageInfo[];
  imported: { id: string; network: string; name: string; url: string; followers: number }[];
  error: string | null;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const field = 'h-11 rounded-[12px] border border-white/15 bg-white/5 px-3 text-[14px]';
  return (
    <section
      className="mt-6 flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
      data-testid="page-import"
    >
      <h2 className="text-[15px] font-black">{t('profile.import.title')}</h2>
      <p className="text-[12px] text-white/60">{t('profile.import.lead')}</p>
      <form action="/ket-noi" method="get" className="flex flex-wrap gap-2">
        <select
          name="nhap"
          defaultValue={network ?? networks[0]}
          className={field}
          aria-label={t('profile.import.network')}
        >
          {networks.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={q}
          required
          maxLength={200}
          placeholder={t('profile.import.hint')}
          className={`${field} min-w-0 flex-1`}
          data-testid="page-import-q"
        />
        <button
          type="submit"
          className="h-11 rounded-full bg-white/10 px-4 text-[13px] font-black"
          data-testid="page-import-find"
        >
          {t('profile.import.find')}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-[12px] font-bold text-red-300">
          {t(error === 'LIMIT' ? 'profile.import.limit' : 'profile.import.none')}
        </p>
      ) : null}
      {network && found.length ? (
        <form
          action={importPagesAction.bind(null, network, q)}
          className="flex flex-col gap-2"
          data-testid="page-import-results"
        >
          <label className="flex items-center gap-2 text-[12px] font-bold text-white/70">
            <input type="checkbox" name="all" className="h-4 w-4 accent-[#ff6b00]" />
            {t('profile.import.all')}
          </label>
          {found.map((p) => (
            <label
              key={p.externalId}
              className="flex items-center gap-2 rounded-[10px] bg-white/5 px-3 py-2 text-[13px]"
            >
              <input type="checkbox" name="id" value={p.externalId} className="h-4 w-4 accent-[#ff6b00]" />
              <span className="flex-1 font-bold">{p.name}</span>
              <span className="text-white/50">
                {t('profile.import.followers', { count: formatCompact(p.followers, t.lang) })}
              </span>
            </label>
          ))}
          <button
            type="submit"
            className="h-10 w-fit rounded-full bg-brand px-5 text-[13px] font-black"
            data-testid="page-import-submit"
          >
            {t('profile.import.import')}
          </button>
        </form>
      ) : network && q ? (
        <p className="text-[12px] text-white/60">{t('profile.import.none')}</p>
      ) : null}
      {imported.length ? (
        <ul className="flex flex-col gap-2" data-testid="page-import-list">
          {imported.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-[13px]">
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 font-bold hover:underline"
              >
                {p.network} · {p.name}
              </a>
              <span className="text-white/50">
                {t('profile.import.followers', { count: formatCompact(p.followers, t.lang) })}
              </span>
              <form action={disconnectNetworkAction.bind(null, p.network as ImportNetwork)}>
                <button
                  type="submit"
                  className="text-[12px] font-bold text-red-300"
                  data-testid="page-import-disconnect"
                >
                  {t('profile.import.disconnect')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
