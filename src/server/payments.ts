// Lớp ghép ở tầng ứng dụng: đăng ký handler của billing/orders vào payments rồi mới cho dùng.
// Mọi route/trang có thể làm tiền vào (webhook, đối soát, trang QR) PHẢI import từ đây, không import
// thẳng '@/modules/payments', để handler luôn có mặt trong đúng bundle đang chạy.
import { onKiotFeePaid } from '@/modules/billing';
import { registerPaymentHandler } from '@/modules/payments';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  registerPaymentHandler('kiot_fee', onKiotFeePaid);
  // orders nối vào ở T19.
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
