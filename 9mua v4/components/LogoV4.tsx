// [COMP-LOGO] Logo V4: white circle 48x48 + viền cam 2px + shadow 4px + neon glow - chỉ 1 logo góc trái
export default function LogoV4({ size = 48 }: { size?: number }) {
  const inner = Math.round(size * 0.75);
  return (
    <div
      className="rounded-full bg-white flex items-center justify-center shrink-0 select-none"
      style={{
        width: size, height: size, border: "2px solid #FF6B00",
        boxShadow: "0 0 0 4px rgba(255,107,0,0.15), 0 0 12px #FF6B00, 0 0 28px rgba(255,107,0,0.55)",
      }}
    >
      <img src="/logo.jpg" alt="9MUA" width={inner} height={inner} className="object-contain rounded-full" style={{ width: inner, height: inner, transform: "translateX(-0.5px)", filter: "contrast(1.15) saturate(1.1)" }} draggable={false} />
    </div>
  );
}
