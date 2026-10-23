// Lớp ghép ở tầng ứng dụng: đăng ký handler của billing/orders vào payments rồi mới cho dùng.
// Mọi route/trang có thể làm tiền vào (webhook, đối soát, trang QR) PHẢI import từ đây, không import
// thẳng '@/modules/payments', để handler luôn có mặt trong đúng bundle đang chạy.
import { registerPaymentHandler } from '@/modules/payments';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  // Các module nghiệp vụ được nối vào ở T16 (billing) và T19 (orders).
  void registerPaymentHandler;
}

registerAll();

export {
  createPayment,
  getPayment,
  cancelPayment,
  handleWebhook,
  reconcilePending,
  listMismatches,
} from '@/modules/payments';
export type { PaymentIntentView } from '@/modules/payments';
