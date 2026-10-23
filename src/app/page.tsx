import Image from 'next/image';
import Link from 'next/link';

// Trang chủ tạm thời — trang thật được làm ở task T27 (SPEC-marketplace.md).
export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 text-center">
      <Image src="/brand/9mua-logo.png" alt="Logo 9MUA" width={214} height={236} priority />
      <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
        Kiếm tiền trên 9mua.com dễ và nhanh nhất
      </h1>
      <p className="max-w-md text-black/70">
        Mở Kiot online của riêng bạn tại <strong>tenkiot.9mua.com</strong> chỉ 26.000đ/năm.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/kiot-cua-toi/tao"
          className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
        >
          Tạo Kiot – 26.000đ/năm
        </Link>
        <Link href="/cho" className="rounded-full border-2 border-brand-ink px-6 py-3 font-extrabold">
          Vào Chợ
        </Link>
      </div>
    </section>
  );
}
