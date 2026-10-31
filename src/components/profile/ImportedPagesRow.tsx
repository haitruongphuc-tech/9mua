// Page đã nhập (SPEC-kiot.md V5.4 mục 4): hiện cạnh link mạng xã hội trên trang Kiot và trang cá nhân.
export function ImportedPagesRow({
  pages,
  lang,
}: {
  pages: { id: string; network: string; name: string; url: string; followers: number }[];
  lang: string;
}) {
  if (!pages.length) return null;
  const fmt = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <ul className="flex flex-wrap gap-2" data-testid="imported-pages">
      {pages.map((p) => (
        <li key={p.id}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-bold text-white/80"
          >
            {p.network} · {p.name} · {fmt.format(p.followers)}
          </a>
        </li>
      ))}
    </ul>
  );
}
