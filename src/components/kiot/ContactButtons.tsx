// Nút gọi và Zalo cho người mua liên hệ chủ Kiot (SĐT lưu dạng +84…).
export function ContactButtons({ phone }: { phone: string }) {
  const local = '0' + phone.replace(/^\+84/, '');
  return (
    <div className="flex gap-2">
      <a
        href={`tel:${phone}`}
        className="rounded-full border-2 border-brand-ink px-4 py-2 text-sm font-extrabold"
      >
        📞 Gọi
      </a>
      <a
        href={`https://zalo.me/${local}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border-2 border-brand-ink px-4 py-2 text-sm font-extrabold"
      >
        💬 Zalo
      </a>
    </div>
  );
}
