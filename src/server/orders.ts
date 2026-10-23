// Lớp ghép ở tầng ứng dụng: đăng ký hook "đơn hoàn tất" (payouts cộng số dư, marketplace thống kê đã bán).
// Mọi luồng có thể làm đơn hoàn tất (tick định kỳ, admin xử khiếu nại) PHẢI import từ đây.
import { onOrderCompleted } from '@/modules/orders';
import { recordSale } from '@/modules/marketplace';
import { creditCompletedOrder } from '@/modules/payouts';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  onOrderCompleted(creditCompletedOrder);
  onOrderCompleted(recordSale);
}

registerAll();

export { runOrderTick, transition } from '@/modules/orders';
