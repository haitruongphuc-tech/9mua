import type { Metadata } from 'next';
import { formatDateTimeVN } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKycStatus } from '@/modules/payouts';

export const metadata: Metadata = { title: 'Xác minh danh tính', robots: { index: false } };

const ERRORS: Record<string, string> = {
  INVALID_INPUT: 'Kiểm tra lại họ tên và số CCCD (12 chữ số).',
  INVALID_IMAGE: 'Ảnh không hợp lệ. Chọn ảnh JPG/PNG/WebP rõ nét của 2 mặt CCCD.',
  TOO_LARGE: 'Ảnh quá lớn (mỗi ảnh tối đa 10MB).',
  ALREADY_PENDING: 'Bạn đã nộp, đang chờ 9MUA duyệt.',
  ALREADY_APPROVED: 'Bạn đã được xác minh.',
};

const field =
  'h-12 rounded-xl border-2 border-black/15 bg-white px-4 text-base outline-none focus:border-brand-ink';

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-gui'?: string }>;
}) {
  const user = await requireUser();
  const status = await getKycStatus(user.id);
  const params = await searchParams;
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Xác minh danh tính (CCCD)</h1>
      <p className="text-sm text-black/70">
        Bắt buộc trước lần rút tiền đầu tiên. Ảnh CCCD được lưu riêng tư, chỉ bộ phận duyệt của 9MUA xem được
        và không bao giờ hiện công khai.
      </p>
      {params.loi ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {ERRORS[params.loi] ?? 'Có lỗi, thử lại.'}
        </p>
      ) : null}
      {params['da-gui'] ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã gửi. 9MUA sẽ duyệt sớm.
        </p>
      ) : null}
      {status ? (
        <p className="rounded-xl border-2 border-black/10 p-4 text-sm" data-testid="kyc-status">
          {status.status === 'approved'
            ? `✅ Đã xác minh: ${status.fullName}`
            : status.status === 'pending'
              ? `⏳ Đang chờ duyệt (gửi lúc ${formatDateTimeVN(status.createdAt)})`
              : `❌ Bị từ chối: ${status.reason ?? ''}. Hãy nộp lại.`}
        </p>
      ) : null}
      {!status || status.status === 'rejected' ? (
        <form
          method="post"
          action="/api/kyc/submit"
          encType="multipart/form-data"
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Họ tên đúng như trên CCCD
            <input name="fullName" id="kyc-name" required className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Số CCCD (12 số)
            <input name="idNumber" id="kyc-number" required inputMode="numeric" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Ảnh mặt trước
            <input
              name="front"
              id="kyc-front"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Ảnh mặt sau
            <input name="back" id="kyc-back" type="file" required accept="image/jpeg,image/png,image/webp" />
          </label>
          <button className="h-12 rounded-full border-2 border-brand-ink bg-brand font-extrabold text-brand-ink">
            Gửi xác minh
          </button>
        </form>
      ) : null}
    </section>
  );
}
