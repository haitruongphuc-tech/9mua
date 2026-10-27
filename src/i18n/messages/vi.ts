// Từ điển gốc tiếng Việt (SPEC-i18n.md). Khoá phẳng "nhom.ten"; các thứ tiếng khác phải có đủ khoá như bản này.
// Tiền tố "common." được gửi xuống trình duyệt ở mọi trang; nhóm khác chỉ gửi khi trang cần.
export const vi = {
  'common.home': '9MUA - Trang chủ',
  'common.slogan.home': 'Mở cổng thế giới - Một chạm là tới',
  'common.slogan.explore': 'Kiot nào cũng là showroom - 9MUA kết nối',
  'common.slogan.live': 'Nhìn thật - Mua thật - Người thật việc thật',
  'common.slogan.cart': 'Gom cả chợ vào một túi - Túi cam 9MUA',
  'common.slogan.profile': 'Mỗi Kiot là một thương hiệu - CEO đứng sau',
  'common.slogan.legal': '99% AI vận hành - 1% CEO phê duyệt - Người thật',
  'common.search.placeholder': 'Tìm sản phẩm trên Chợ',
  'common.search.label': 'Tìm trên Chợ 9MUA',
  'common.search.button': 'Tìm kiếm',
  'common.cart.label': 'Giỏ hàng ({count} món)',
  'common.nav.label': 'Điều hướng chính',
  'common.nav.video': 'Video',
  'common.nav.market': 'Chợ',
  'common.nav.live': 'Live',
  'common.nav.kiot': 'Kiot',
  'common.nav.me': 'Tôi',
  'common.nav.meUser': 'Tôi ({name})',
  'common.nav.meLogin': 'Tôi (đăng nhập)',
  'common.lang.label': 'Ngôn ngữ',
  'common.lang.read': 'Đọc slogan',
  'common.lang.stop': 'Dừng đọc',
  'common.footer.taxId': 'MST',
  'live.empty.title': 'Chưa có ai đang live',
  'live.empty.body': 'Tính năng Live đang được hoàn thiện. Trong lúc chờ, xem video nhé.',
  'live.empty.cta': 'Xem video',
} as const;

export type MessageKey = keyof typeof vi;
export type Messages = Record<MessageKey, string>;
