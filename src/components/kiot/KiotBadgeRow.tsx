import type { KiotBadges } from '@/modules/kiot';
import type { BadgeStyle } from '@/server/kiot-badges';

// Hàng huy hiệu Kiot (SPEC-kiot.md V5.2 mục 4): màu theo số huy hiệu 1 Xanh · 2 Vàng · 3 Tím.
export function KiotBadgeRow({ badges, style }: { badges: KiotBadges; style: BadgeStyle }) {
  if (!badges.level) return null;
  const color = style.colors[badges.level - 1];
  const items = [
    badges.origin ? style.names.origin : null,
    badges.bank ? style.names.bank : null,
    badges.video ? style.names.video : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" data-testid="kiot-badges" data-level={badges.level}>
      {items.map((name) => (
        <li
          key={name}
          className="rounded-full px-2.5 py-1 text-[11px] font-black text-white"
          style={{ backgroundColor: color }}
        >
          ✓ {name}
        </li>
      ))}
    </ul>
  );
}
