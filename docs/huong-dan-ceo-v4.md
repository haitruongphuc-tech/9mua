# Việc CEO cần làm cho bản V4 (27/10/2026)

Bản V4 đã gộp vào nhánh `main`. Các bước dưới đây làm theo thứ tự. Chi tiết lệnh nằm trong `docs/deploy.md`.

**Không bao giờ dán khoá, mật khẩu, token vào chat, email hay Zalo.** Chỉ điền trong file `.env` trên VPS.

## Bản này có gì

- Giao diện V4 nền tối; thanh dưới **Video · Chợ · Live · Kiot · Tôi**; 7 thứ tiếng, link giữ nguyên.
- Đăng nhập bằng Google; popup mời mở tài khoản; admin nhớ thiết bị 30 ngày; CEO ghim nội dung, đổi slogan,
  sửa thông tin pháp lý.
- Mạng xã hội: follow, bình luận, lưu, hashtag, Story 24 giờ, Duet.
- AI Studio cho chủ Kiot: Claude viết mô tả, Gemini vẽ ảnh, máy tự ghép video 10 giây. AI không tự đăng bán;
  chủ Kiot phải bấm.
- Giá mở Kiot 1 USD/năm, quy ra VNĐ theo tỷ giá Vietcombank mỗi sáng; voucher mở Kiot.
- Trang Giới thiệu & Pháp lý và 7 trang chính sách (**bản nháp, chờ CEO duyệt**).
- Livestream bán hàng và xu thưởng theo số người xem thật. Xu không đổi ra tiền.

## Bước 1. Chuẩn bị trên VPS (làm 1 lần, trước khi cập nhật)

1. Mở `.env` (`cd /opt/9mua && nano .env`) và điền các biến mới. Cách lấy từng khoá ở `docs/deploy.md` mục 4.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: đăng nhập Google. Để trống thì nút Google tự ẩn.
   - `ANTHROPIC_API_KEY`: AI viết mô tả, khoảng 20đ mỗi lần.
   - `GEMINI_API_KEY`: AI vẽ ảnh, khoảng 1.000đ mỗi ảnh.
   - `LIVE_PUBLIC_IP`: IP công khai của VPS (`curl -4 ifconfig.me`).
   - `AI_TEXT_MODEL`, `AI_IMAGE_MODEL`: để trống để dùng mặc định.
2. Mở cổng cho Live:
   ```bash
   sudo ufw allow 8189/udp && sudo ufw allow 8189/tcp
   ```
   Nếu trang quản lý của nhà cung cấp VPS có tường lửa riêng, mở thêm **8189 UDP và TCP** ở đó.
3. Hỏi nhà cung cấp VPS **tốc độ cổng mạng** và **giới hạn dung lượng tháng**. Lúc đông nhất (2 buổi live × 50 người)
   cần khoảng 150 Mbps. Một giờ live đủ 50 người tốn khoảng 34 GB. Nếu cổng chỉ 100 Mbps, sau khi cập nhật hạ
   "Người xem tối đa mỗi buổi" xuống 30 ở `/admin/cai-dat`.

## Bước 2. Cập nhật

```bash
cd /opt/9mua && sh scripts/deploy.sh
```

- Script tự sao lưu database trước, rồi nâng cấp database 7 lần. Các lần nâng cấp **chỉ thêm bảng mới và thêm cột
  trống**, không sửa hay xoá dữ liệu cũ, nên quay về bản cũ vẫn được (`sh scripts/deploy.sh --rollback`).
- Script tự bật máy chủ hình `mediamtx` cho Live. Nếu nó báo `[CHÚ Ý] MediaMTX (Live) chưa chạy`, web vẫn chạy
  bình thường. Xem lỗi bằng lệnh dưới (lệnh tự che khoá nội bộ); gửi Claude kết quả, nhớ che IP:
  ```bash
  docker compose logs --tail 50 mediamtx | sed 's/key=[^" ]*/key=***/g'
  ```
- Cuối script sẽ nhắc 2 file cấu hình đã đổi. Chép lại như sau:
  ```bash
  sudo cp deploy/nginx/9mua.conf /etc/nginx/sites-available/9mua.conf
  [ -f /proc/net/if_inet6 ] || sudo sed -i '/listen \[::\]/d' /etc/nginx/sites-available/9mua.conf
  sudo nginx -t && sudo systemctl reload nginx
  sudo cp deploy/cron/9mua.cron /etc/cron.d/9mua && sudo chmod 644 /etc/cron.d/9mua
  ```
  File Nginx mới thêm đường cho Live. File cron mới thêm việc cập nhật tỷ giá lúc 7:00 sáng.

## Bước 3. Kiểm tra sau khi cập nhật

1. `/admin/ai`: bấm **Thử kết nối** cho phần viết và phần vẽ. Cả 2 phải báo được. Ngân sách AI mặc định
   500.000đ/tháng; chạm ngân sách thì AI tạm dừng và CEO nhận email.
2. `/admin/cai-dat`: bấm **Cập nhật tỷ giá ngay**. Giá Kiot phải hiện số VNĐ mới, làm tròn tới 1.000đ. Nếu tỷ giá
   lệch quá 10% so với lần trước, hệ thống giữ giá cũ và gửi email cho CEO.
3. Đăng xuất, rồi bấm **Tiếp tục với Google** để thử đăng nhập Google.
4. Live, dùng 2 điện thoại khác mạng (1 máy dùng 4G):
   - Máy A vào `/live/phat` và bấm phát. Tài khoản phải tạo từ 3 ngày trước.
   - Máy B vào `/live`. Phải thấy hình sau vài giây, chat qua lại được.
   - Không thấy hình thì kiểm lại `LIVE_PUBLIC_IP` và cổng 8189 (Bước 1).
5. `/admin/xu`: xem bậc thưởng xu và ngân sách xu tháng; chỉnh nếu muốn.
6. Sau vài ngày có live, mở `/admin/live` xem dòng "lượt xem không kết nối được hình". Nếu tỉ lệ vượt 5%, trang sẽ
   đề xuất thêm máy chủ TURN; khi đó nhắn Claude.

## Bước 4. Nội dung chờ CEO

1. **Đọc duyệt 7 trang chính sách** ở `https://9mua.com/chinh-sach`. Đây là bản nháp Claude viết.
   - Tên công ty, MST, địa chỉ, hotline, email trên các trang lấy từ `/admin/noi-dung`, nên điền đúng ở đó trước.
   - Chỗ nào cần sửa thì ghi lại gửi Claude.
2. Sau khi duyệt bản tiếng Việt, Claude dịch sang tiếng Trung, Nhật, Hàn, Pháp, Tây Ban Nha. Hiện các thứ tiếng này
   tạm hiện bản tiếng Việt, có dòng báo "chưa có bản dịch". Tiếng Anh đã có bản dịch nháp.
3. Xoá dữ liệu mẫu trước khi mở cửa, nếu đã nạp (`docs/deploy.md` mục 13).

## Phần Claude chưa thử được trên máy test

- **Máy chủ hình MediaMTX thật.** Máy test không tải được MediaMTX, nên E2E dùng máy chủ hình giả. CEO thử bằng
  2 điện thoại ở Bước 3.
- **Gọi thật Claude, Gemini, Google và tỷ giá Vietcombank.** Máy test không có khoá. Phần gọi đi đã có test với dữ
  liệu mẫu. CEO kiểm bằng các nút ở Bước 3.

## Hợp đồng giữa các module: chỉ thêm, không đổi cái cũ

Các phần dưới đây là chỗ các module gọi nhau. Bản này chỉ thêm hàm mới, mọi hàm cũ vẫn dùng như trước:

- `kiot`: `countPublicProducts`, `kiotOwnerId`, `kiotBasics`.
- `marketplace`: `kiotSoldTotal`.
- `identity`: `ResetEmailCopy`.
- `billing`: `grantVoucherYear`, `updateKiotFeeFromRate`, `setKiotFeeUsd`, `recentFeeRates`, `parseVcbUsdSell`.
- `social`: `redeemVoucher`. `listVouchers` trả thêm thông tin người dùng.
- `orders`: `addToCart` nhận thêm nguồn là buổi live (`{ videoId?, liveId? }`). Kiểu cũ là một chuỗi mã video, vẫn
  dùng được.
- Module mới: `ai` (AI Studio), `live` (livestream), `xu` (xu thưởng).
