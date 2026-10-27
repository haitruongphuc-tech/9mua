import { LogoV4 } from '@/components/LogoV4';

// Khung chung của các trang đăng nhập/đăng ký theo V4: nền đen, logo tròn, cột giữa rộng 420px.
export function AuthShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-10">
      <div className="flex justify-center">
        <LogoV4 size={72} />
      </div>
      <h1 className="mt-5 text-center font-display text-[22px] font-bold">{title}</h1>
      <p className="mb-6 mt-1 text-center text-[13px] text-white/60">{lead}</p>
      {children}
    </div>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] text-white/40">
      <span className="h-px flex-1 bg-white/15" />
      {label}
      <span className="h-px flex-1 bg-white/15" />
    </div>
  );
}
