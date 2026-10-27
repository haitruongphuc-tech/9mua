// Nhóm "legal." — trang Giới thiệu & Pháp lý, tên các trang chính sách (SPEC-marketplace.md bổ sung 27/10).
export const legal = {
  'legal.title': 'Giới thiệu & Pháp lý',
  'legal.about.p1':
    '9MUA là sàn thương mại điện tử nơi mỗi người bán có một Kiot riêng — một showroom online với địa chỉ tenkiot.9mua.com — và mọi sản phẩm cùng hiện trên Chợ 9MUA.',
  'legal.about.p2':
    'Người mua trả tiền cho 9MUA qua mã QR. 9MUA giữ hộ tiền và chỉ trả cho người bán khi người mua đã nhận hàng và hết 7 ngày khiếu nại.',
  'legal.about.p3':
    'Phần lớn việc vận hành do máy tự làm: kiểm tra thanh toán, nhắc gia hạn, ẩn nội dung bị báo cáo, AI viết mô tả và vẽ ảnh. CEO duyệt những việc quan trọng: tiền, khiếu nại, khoá tài khoản.',
  'legal.company': 'Công ty',
  'legal.taxId': 'Mã số thuế',
  'legal.office': 'Văn phòng',
  'legal.showroom': 'Showroom',
  'legal.hotline': 'Hotline',
  'legal.email': 'Email',
  'legal.map': 'Xem bản đồ',
  'legal.policies': 'Chính sách của sàn',
  'legal.updated': 'Cập nhật ngày {date}',
  'legal.fallback': 'Trang này chưa có bản dịch, dưới đây là bản tiếng Việt.',
  'legal.official': 'Bản tiếng Việt là bản chính thức.',
  'legal.policy.quy-che': 'Quy chế hoạt động',
  'legal.policy.dieu-khoan': 'Điều khoản sử dụng',
  'legal.policy.bao-mat': 'Bảo mật thông tin',
  'legal.policy.doi-tra': 'Đổi trả & hoàn tiền',
  'legal.policy.khieu-nai': 'Giải quyết khiếu nại',
  'legal.policy.van-chuyen': 'Vận chuyển',
  'legal.policy.thanh-toan': 'Thanh toán',
} as const;

export type LegalMessages = Record<keyof typeof legal, string>;
