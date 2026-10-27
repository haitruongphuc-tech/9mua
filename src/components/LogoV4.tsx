import Image from 'next/image';

// Logo V4: vòng tròn trắng, viền cam 2px, quầng cam; ảnh logo của V4 (có lề trắng) cỡ 75% ở giữa (docs/BRAND.md).
export function LogoV4({ size = 48 }: { size?: number }) {
  const inner = Math.round(size * 0.75);
  return (
    <span
      className="grid shrink-0 select-none place-items-center rounded-full border-2 border-brand bg-white"
      style={{
        width: size,
        height: size,
        boxShadow: '0 0 0 4px rgb(255 107 0 / 0.15), 0 0 12px #ff6b00, 0 0 28px rgb(255 107 0 / 0.55)',
      }}
    >
      <Image
        src="/brand/9mua-logo-v4.jpg"
        alt=""
        width={inner}
        height={inner}
        priority
        className="rounded-full object-contain"
        style={{ width: inner, height: inner, filter: 'contrast(1.15) saturate(1.1)' }}
      />
    </span>
  );
}
