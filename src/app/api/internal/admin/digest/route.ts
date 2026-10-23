import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { remindRefundAccounts, sendDailyDigest } from '@/modules/admin';

export const dynamic = 'force-dynamic';

// Cron 8:00 mỗi sáng: bản tin cho CEO + nhắc người mua nhập tài khoản nhận hoàn tiền.
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  const [digest, reminders] = await Promise.all([sendDailyDigest(), remindRefundAccounts()]);
  return Response.json({ ...digest, ...reminders });
}
