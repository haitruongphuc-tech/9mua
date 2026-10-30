import Image from 'next/image';

// Ảnh đại diện tròn (SPEC-social.md bổ sung 30/10, A2): có ảnh thì hiện ảnh, chưa có thì chữ cái đầu của tên trên nền cam.
// Kích thước, viền do nơi dùng truyền qua className (vd. "h-12 w-12 text-[18px]"). Chỉ để trang trí: tên người luôn có
// ở chữ hoặc aria-label bên cạnh.
export function Avatar({
  name,
  url,
  className = 'h-10 w-10 text-[15px]',
}: {
  name: string;
  url: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand to-red-500 font-black text-white ${className}`}
    >
      {url ? (
        // Máy chủ đã cắt sẵn ảnh 400×400 WebP nên không cần tối ưu lại.
        <Image src={url} alt="" fill sizes="96px" className="object-cover" unoptimized />
      ) : (
        name.trim().charAt(0).toUpperCase() || '9'
      )}
    </span>
  );
}
