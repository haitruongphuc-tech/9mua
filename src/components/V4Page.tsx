// Khung trang giao diện V4: đánh dấu data-v4 để <main> chuyển nền đen chữ trắng (globals.css). Khi mọi trang đã
// đổi xong thì <main> chuyển hẳn sang nền đen và bỏ khung này.
export function V4Page({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-v4 className={className}>
      {children}
    </div>
  );
}
