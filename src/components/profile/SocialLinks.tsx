// Nút tròn tới trang mạng xã hội của người dùng (Social Connect, SPEC-kiot.md bổ sung 27/10). Chỉ có link,
// không có số follower của các mạng đó.
export const SOCIAL_ORDER = ['tiktok', 'facebook', 'instagram', 'youtube', 'shopee', 'zalo'] as const;
type Network = (typeof SOCIAL_ORDER)[number];
const LOOK: Record<Network, { name: string; cls: string; mark: string }> = {
  tiktok: { name: 'TikTok', cls: 'bg-black border border-white/20', mark: '♪' },
  facebook: { name: 'Facebook', cls: 'bg-[#1877F2]', mark: 'f' },
  instagram: { name: 'Instagram', cls: 'bg-gradient-to-br from-fuchsia-500 to-orange-400', mark: 'IG' },
  youtube: { name: 'YouTube', cls: 'bg-[#FF0000]', mark: '▶' },
  shopee: { name: 'Shopee', cls: 'bg-[#EE4D2D]', mark: 'S' },
  zalo: { name: 'Zalo', cls: 'bg-[#0068FF]', mark: 'Z' },
};
export const socialLook = (platform: Network) => LOOK[platform];

export function SocialLinks({ links }: { links: Partial<Record<string, string>> }) {
  const items = SOCIAL_ORDER.filter((p) => links[p]);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" data-testid="social-links">
      {items.map((p) => (
        <li key={p}>
          <a
            href={links[p]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={LOOK[p].name}
            title={LOOK[p].name}
            className={`grid h-9 w-9 place-items-center rounded-full text-[12px] font-black text-white ${LOOK[p].cls}`}
          >
            {LOOK[p].mark}
          </a>
        </li>
      ))}
    </ul>
  );
}
