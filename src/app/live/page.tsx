import type { Metadata } from 'next';
import Link from 'next/link';
import { V4Page } from '@/components/V4Page';

export const metadata: Metadata = { title: 'Live', robots: { index: false } };

// Tạm thời cho tới khi làm xong livestream (SPEC-live.md, T49–T57).
export default function LivePage() {
  return (
    <V4Page className="flex flex-col items-center px-6 py-24 text-center">
      <p className="font-display text-[22px] font-bold">Chưa có ai đang live</p>
      <p className="mt-2 text-[13px] text-white/60">
        Tính năng Live đang được hoàn thiện. Trong lúc chờ, xem video nhé.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-11 items-center rounded-full bg-brand px-6 text-[13px] font-black"
      >
        Xem video
      </Link>
    </V4Page>
  );
}
