import Link from 'next/link';

export function PreviewBanner() {
  return (
    <p
      role="status"
      data-testid="preview-banner"
      className="rounded-xl bg-brand/20 px-4 py-3 text-sm font-bold"
    >
      Bản xem trước — chỉ bạn thấy trang này. Kích hoạt Kiot để mọi người xem được.{' '}
      <Link href={`${process.env.APP_URL ?? ''}/kiot-cua-toi`} className="underline">
        Quản lý Kiot
      </Link>
    </p>
  );
}
