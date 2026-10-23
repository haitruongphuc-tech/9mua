import Link from 'next/link';

export default function KiotNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">Kiot tạm ngưng</h1>
      <p className="text-black/70">Kiot này đang tạm ngưng hoặc không tồn tại.</p>
      <Link
        href={`${process.env.APP_URL ?? ''}/cho`}
        className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
      >
        Vào Chợ 9MUA
      </Link>
    </section>
  );
}
