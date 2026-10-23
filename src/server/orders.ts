// Lớp ghép ở tầng ứng dụng: đăng ký hook "đơn hoàn tất" (payouts cộng số dư, marketplace thống kê đã bán).
// Mọi luồng có thể làm đơn hoàn tất (tick định kỳ, admin xử khiếu nại) PHẢI import từ đây.
import { onOrderCompleted } from '@/modules/orders';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  // payouts nối vào ở T22, marketplace ở T26.
  void onOrderCompleted;
}

registerAll();

export { runOrderTick, transition } from '@/modules/orders';
