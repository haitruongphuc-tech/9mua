import { requireAdminVerified } from '@/modules/admin';
import { storageStats } from '@/modules/creator';

export const dynamic = 'force-dynamic';

const gb = (bytes: number) =>
  `${(bytes / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`;

// Trang CEO "Dung lượng" (SPEC-creator.md V5.1 mục 10): GB video theo nơi lưu, ổ VPS còn trống, số video dài, ước tính
// GB tháng tới theo tốc độ 30 ngày qua.
export default async function StoragePage() {
  await requireAdminVerified();
  const s = await storageStats();
  const freePct = s.disk.totalBytes ? Math.round((s.disk.freeBytes / s.disk.totalBytes) * 100) : 0;
  const tiles = [
    {
      id: 'local',
      label: 'Video trên VPS',
      value: gb(s.local.bytes),
      hint: `${s.local.files.toLocaleString('vi-VN')} file`,
    },
    {
      id: 'external',
      label: 'Video trên kho ngoài',
      value: s.external ? gb(s.external.bytes) : 'Chưa có khoá',
      hint: s.external
        ? `${s.external.files.toLocaleString('vi-VN')} file · công tắc ${s.external.on ? 'đang bật' : 'đang tắt'}`
        : 'Điền khoá STORAGE_* trong .env rồi bật công tắc "Kho video ngoài"',
    },
    {
      id: 'disk',
      label: 'Ổ đĩa VPS còn trống',
      value: `${gb(s.disk.freeBytes)} (${freePct}%)`,
      hint:
        freePct < 15
          ? 'Dưới 15%: đang từ chối video dài nếu chưa bật kho ngoài'
          : `Tổng ${gb(s.disk.totalBytes)}`,
    },
    {
      id: 'long',
      label: 'Video dài hơn 60 giây',
      value: s.longVideos.toLocaleString('vi-VN'),
      hint: 'Đang có trên web',
    },
    {
      id: 'next30',
      label: 'Ước tính 30 ngày tới',
      value: gb(s.next30Bytes),
      hint: 'Theo dung lượng video mới trong 30 ngày qua',
    },
  ];
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Dung lượng</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-4"
            data-testid={`storage-${t.id}`}
          >
            <span className="text-sm text-white/60">{t.label}</span>
            <span className="text-2xl font-extrabold">{t.value}</span>
            <span className="text-xs text-white/50">{t.hint}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-white/70">
        Chuyển video cũ từ VPS lên kho ngoài: chạy{' '}
        <code className="rounded bg-white/10 px-1">npm run media:migrate</code> trên VPS (xem docs/deploy.md).
        Lệnh chạy lại được; chỉ xoá bản trên VPS khi bản trên kho ngoài đọc lại khớp dung lượng.
      </p>
    </section>
  );
}
