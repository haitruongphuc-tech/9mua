import type { KiotStatus } from '@/modules/kiot';

const LABELS: Record<KiotStatus, { text: string; className: string }> = {
  draft: { text: 'Nháp — chưa kích hoạt', className: 'bg-black/10 text-brand-ink' },
  active: { text: 'Đang hoạt động', className: 'bg-success/15 text-success' },
  expired: { text: 'Hết hạn — tạm ngưng', className: 'bg-danger/10 text-danger' },
  locked: { text: 'Bị khoá', className: 'bg-danger text-white' },
};

export function StatusBadge({ status }: { status: KiotStatus }) {
  const { text, className } = LABELS[status];
  return (
    <span data-testid="kiot-status" className={`rounded-full px-3 py-1 text-sm font-bold ${className}`}>
      {text}
    </span>
  );
}
