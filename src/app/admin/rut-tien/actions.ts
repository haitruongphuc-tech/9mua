'use server';

import {
  approvePayout,
  markPayoutTransferred,
  rejectPayoutRequest,
  requireAdminVerified,
} from '@/modules/admin';
import { back } from '../flash';

const PATH = '/admin/rut-tien';
const ERR: Record<string, string> = {
  NOT_FOUND: 'Không tìm thấy yêu cầu.',
  NOT_PENDING: 'Yêu cầu không còn chờ duyệt (có thể đã được xử lý).',
  CHANNEL_UNAVAILABLE: 'Chưa kết nối kênh chi hộ PayOS — dùng "Đã chuyển tay".',
  KYC_REQUIRED: 'Người bán chưa được duyệt CCCD.',
  FUND_LOW: 'Quỹ chi PayOS không đủ, hãy nạp thêm hoặc chuyển tay.',
  REASON_REQUIRED: 'Hãy ghi lý do.',
  BANK_REF_REQUIRED: 'Hãy nhập mã giao dịch ngân hàng.',
};

export async function approvePayoutAction(payoutId: string): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await approvePayout(admin.id, payoutId);
  back(PATH, r.ok ? { ok: true, message: 'Đã gửi lệnh chi qua PayOS.' } : { ok: false, message: r.message });
}

export async function markPayoutPaidAction(payoutId: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await markPayoutTransferred(admin.id, payoutId, String(form.get('bankRef') ?? ''));
  back(
    PATH,
    r.ok ? { ok: true, message: 'Đã ghi nhận chuyển tay.' } : { ok: false, message: ERR[r.error] ?? r.error },
  );
}

export async function rejectPayoutAction(payoutId: string, form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await rejectPayoutRequest(admin.id, payoutId, String(form.get('reason') ?? ''));
  back(
    PATH,
    r.ok
      ? { ok: true, message: 'Đã từ chối, số dư đã hoàn cho người bán.' }
      : { ok: false, message: ERR[r.error] ?? r.error },
  );
}
