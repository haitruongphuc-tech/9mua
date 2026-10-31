import Image from 'next/image';
import Link from 'next/link';
import type { GroupCard } from '@/modules/social';

// Thẻ nhóm trong /nhom: ảnh, tên, công khai / riêng tư, số thành viên.
export function GroupCardView({
  group,
  labels,
}: {
  group: GroupCard;
  labels: { privacy: string; members: string };
}) {
  return (
    <Link
      href={`/nhom/${group.id}`}
      className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 p-3 hover:bg-white/10"
      data-testid="group-card"
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-white/10">
        {group.avatarPath ? (
          <Image src={group.avatarPath} alt="" fill sizes="48px" className="object-cover" unoptimized />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-bold">{group.name}</span>
        <span className="text-[11px] text-white/60">
          {labels.privacy} · {labels.members}
        </span>
      </span>
    </Link>
  );
}
