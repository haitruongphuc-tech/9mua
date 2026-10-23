// Ngân hàng hỗ trợ chuyển khoản VietQR (BIN theo chuẩn NAPAS). Nguồn: gói npm vietnam-qr-pay@1.5.1
// (MIT, danh sách VietQR), đã đối chiếu 23 ngân hàng phổ biến với nguồn độc lập. Kiểm lại với
// https://api.vietqr.io/v2/banks khi deploy (T37). Sai BIN = chuyển nhầm tiền, không sửa tay tuỳ tiện.
export type Bank = { bin: string; shortName: string; name: string };

export const BANKS: readonly Bank[] = [
  { bin: '970425', shortName: 'AB Bank', name: 'Ngân hàng TMCP An Bình' },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { bin: '970405', shortName: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam' },
  { bin: '970409', shortName: 'BacA Bank', name: 'Ngân hàng TMCP Bắc Á' },
  { bin: '970438', shortName: 'BaoViet Bank', name: 'Ngân hàng TMCP Bảo Việt' },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { bin: '970454', shortName: 'BVBank', name: 'Ngân hàng TMCP Bản Việt' },
  {
    bin: '546034',
    shortName: 'CAKE by VPBank',
    name: 'Ngân hàng số CAKE by VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng',
  },
  { bin: '970446', shortName: 'Co-op Bank', name: 'Ngân hàng Hợp tác xã Việt Nam' },
  { bin: '970431', shortName: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' },
  { bin: '970437', shortName: 'HDBank', name: 'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh' },
  {
    bin: '668888',
    shortName: 'Kasikornbank',
    name: 'Ngân hàng Đại chúng TNHH KASIKORNBANK - CN TP. Hồ Chí Minh',
  },
  { bin: '970452', shortName: 'KienlongBank', name: 'Ngân hàng TMCP Kiên Long' },
  { bin: '970449', shortName: 'LienVietPostBank', name: 'Ngân hàng TMCP Bưu Điện Liên Việt' },
  { bin: '963369', shortName: 'Liobank', name: 'Ngân hàng số Liobank - Ngân hàng TMCP Phương Đông' },
  { bin: '970449', shortName: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
  { bin: '970422', shortName: 'MB Bank', name: 'Ngân hàng TMCP Quân đội' },
  { bin: '970414', shortName: 'MBV', name: 'Ngân hàng TNHH MTV Việt Nam Hiện Đại' },
  { bin: '971025', shortName: 'MoMo', name: 'CTCP Dịch Vụ Di Động Trực Tuyến' },
  { bin: '970426', shortName: 'MSB', name: 'Ngân hàng TMCP Hàng Hải' },
  { bin: '970428', shortName: 'Nam A Bank', name: 'Ngân hàng TMCP Nam Á' },
  { bin: '970419', shortName: 'NCB Bank', name: 'Ngân hàng TMCP Quốc Dân' },
  { bin: '970448', shortName: 'OCB Bank', name: 'Ngân hàng TMCP Phương Đông' },
  { bin: '970414', shortName: 'Ocean Bank', name: 'Ngân hàng Thương mại TNHH MTV Đại Dương' },
  { bin: '970430', shortName: 'PG Bank', name: 'Ngân hàng TMCP Xăng dầu Petrolimex' },
  { bin: '970412', shortName: 'PVcomBank', name: 'Ngân hàng TMCP Đại Chúng Việt Nam' },
  { bin: '970403', shortName: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { bin: '970400', shortName: 'SaigonBank', name: 'Ngân hàng TMCP Sài Gòn Công Thương' },
  { bin: '970429', shortName: 'SCB', name: 'Ngân hàng TMCP Sài Gòn' },
  { bin: '970440', shortName: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á' },
  { bin: '970443', shortName: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
  { bin: '970424', shortName: 'Shinhan Bank', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '963388', shortName: 'Timo', name: 'Ngân hàng số Timo by Bản Việt Bank' },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
  {
    bin: '546035',
    shortName: 'Ubank by VPBank',
    name: 'Ngân hàng số Ubank by VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng',
  },
  { bin: '970441', shortName: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
  { bin: '970427', shortName: 'VietABank', name: 'Ngân hàng TMCP Việt Á' },
  { bin: '970433', shortName: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970406', shortName: 'Vikki Bank', name: 'Ngân hàng TNHH MTV Số Vikki' },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
];

export function findBank(bin: string): Bank | undefined {
  return BANKS.find((b) => b.bin === bin);
}
