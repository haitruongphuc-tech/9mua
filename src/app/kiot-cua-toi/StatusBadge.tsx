import { getT } from '@/i18n/server';
import type { KiotStatus } from '@/modules/kiot';

const TONE: Record<KiotStatus, string> = {
  draft: 'bg-white/10 text-white',
  active: 'bg-success/20 text-green-300',
  expired: 'bg-danger/20 text-red-300',
  locked: 'bg-danger text-white',
};

export async function StatusBadge({ status }: { status: KiotStatus }) {
  const t = await getT();
  return (
    <span
      data-testid="kiot-status"
      className={`rounded-full px-3 py-1 text-[13px] font-bold ${TONE[status]}`}
    >
      {t(`seller.status.${status}`)}
    </span>
  );
}
