# Spec: `admin` — Trang CEO

> Module 9 (cuối) trong `CAPABILITY-MAP.md`. Phụ thuộc mọi module trước.
> Nền móng chung theo `SPEC-identity.md`.
> Module này **chỉ có giao diện và điều phối**: mọi thao tác gọi hàm trong `index.ts` của module sở hữu dữ
> liệu đó. `admin` không ghi thẳng vào bảng của module khác.

## Objective

Một trang duy nhất `9mua.com/admin` để CEO thấy ngay việc gì cần xử lý và xử lý bằng 1–2 chạm trên điện
thoại. Phần còn lại hệ thống tự chạy: đây là "1% CEO" của mô hình 9mua.

### Tiêu chí chấp nhận

1. **Bảo vệ**:
   - Mọi route `/admin/**` gọi `requireAdmin()`. Tài khoản không phải admin nhận **404**, để không lộ
     là có trang admin.
   - **Bắt buộc xác thực 2 lớp (TOTP)** cho tài khoản admin, dùng Google Authenticator hoặc Authy.
     - Lần đầu vào admin thì quét QR để cài.
     - Mỗi phiên admin phải nhập mã 6 số. Phiên admin hết hạn sau 12 giờ.
     - Có 10 mã dự phòng dùng 1 lần, phòng khi mất điện thoại.
   - Mọi thao tác thay đổi dữ liệu đều ghi `AdminAuditLog`: ai, lúc nào, làm gì, đối tượng nào, lý do,
     dữ liệu trước và sau.
2. **Tổng quan `/admin`**:
   - **Hộp "Cần xử lý"** đứng đầu, mỗi dòng có số lượng và link tới đúng hàng chờ:
     - Yêu cầu rút tiền chờ duyệt tay.
     - KYC chờ duyệt.
     - Đơn chờ hoàn tiền.
     - Khiếu nại.
     - Thanh toán lệch tiền (`mismatch`).
     - Báo cáo sản phẩm/video.
     - Lệnh chi PayOS lỗi hoặc treo.
     - Quỹ chi PayOS sắp hết.
     - Video xử lý lỗi nhiều lần.
   - **Số liệu** (chọn Hôm nay / 7 ngày / 30 ngày):
     - Người dùng mới, Kiot mới, Kiot đang hoạt động.
     - Doanh số đơn đã trả (GMV), phí sàn thu được, phí thuê Kiot thu được.
     - Tiền đã chi cho người bán, **tiền đang giữ hộ**.
     - Video mới, lượt xem.
   - Biểu đồ đường doanh thu theo ngày (phí sàn + phí thuê).
3. **Hàng chờ** (mỗi hàng chờ một trang, có lọc, mở chi tiết, nút thao tác ngay trên dòng):

   | Hàng chờ | Thao tác | Gọi module |
   |---|---|---|
   | Rút tiền | Chi qua PayOS · Đã chuyển tay (có QR VietQR) · Từ chối | `payouts` |
   | KYC | Xem ảnh CCCD, so tên với tài khoản ngân hàng · Duyệt · Từ chối | `payouts` |
   | Hoàn tiền | Xem tài khoản người mua · QR VietQR · Đã hoàn (nhập mã GD) | `orders` |
   | Khiếu nại | Xem đơn, lịch sử, ảnh · Hoàn cho người mua · Trả cho người bán | `orders` |
   | Lệch tiền | Xem giao dịch PayOS · Ghi chú cách xử lý · Đánh dấu đã xử lý | `payments` |
   | Báo cáo | Xem nội dung · Gỡ · Bỏ qua (hiện lại) | `marketplace`, `creator` |

4. **Tra cứu**:
   - **Người dùng**: tìm theo SĐT/email/tên. Xem Kiot, đơn, video. Khoá/mở khoá. Gửi link đặt lại mật
     khẩu, hoặc cấp mật khẩu tạm.
   - **Kiot**: tìm theo tên/slug. Xem hạn, lịch sử phí, số dư, sản phẩm. Khoá/mở khoá kèm lý do.
     Tặng 1 năm. Điều chỉnh số dư (bắt buộc ghi lý do).
   - **Đơn hàng**: tìm theo mã `DH…`, SĐT người mua, Kiot. Xem đầy đủ lịch sử `OrderEvent`.
   - **Giao dịch**: sổ `PaymentEvent` (tiền vào) và `PayoutRequest` (tiền ra). Lọc theo ngày, xuất **CSV**
     để làm kế toán.
5. **Cài đặt** (`Setting`, đổi gì cũng ghi audit log):
   - Phí thuê Kiot (mặc định 26.000đ).
   - Phí sàn (mặc định 5%).
   - Phí chi hộ.
   - Rút tối thiểu.
   - **Chi tự động**: công tắc bật/tắt (to, đỏ, ở đầu trang), hạn mức mỗi lần / mỗi Kiot mỗi ngày /
     toàn sàn mỗi ngày.
   - Giá trị mới được kiểm tra hợp lệ trước khi lưu. Ví dụ phí sàn chỉ từ 0% đến 30%.
6. **Báo CEO qua email** (Brevo):
   - **Ngay lập tức**: thanh toán lệch tiền, lệnh chi PayOS lỗi, quỹ chi sắp hết, khiếu nại mới.
   - **Bản tin 8:00 mỗi sáng**: số liệu hôm qua kèm danh sách việc cần xử lý.
   - Chống spam: mỗi loại cảnh báo tối đa 1 email mỗi 15 phút, gộp nhiều sự việc vào một email.
7. **Tạo thêm admin**: chỉ bằng lệnh CLI trên VPS (đã có ở `identity`), không có nút trên web.
8. **Giao diện**: dùng tốt trên điện thoại (CEO duyệt khi đang ngoài đường). Bảng tự chuyển sang dạng thẻ ở màn hình nhỏ.

### Hợp đồng

`admin` không cung cấp hàm cho module khác. Module này dùng các hàm admin đã khai báo trong `index.ts` của
`identity`, `kiot`, `billing`, `payments`, `orders`, `payouts`, `marketplace`, `creator`. Mỗi hàm admin
trong các module đó nhận `adminId` và tự ghi `AdminAuditLog` qua `src/lib/audit.ts`.

### Dữ liệu

- `AdminAuditLog`: id, adminId, action, targetType, targetId, reason, before (JSON), after (JSON), ip,
  createdAt. **Chỉ thêm, không sửa, không xoá.**
- `AdminTotp`: userId, secret (mã hoá bằng `APP_ENCRYPTION_KEY`), backupCodes (băm), enabledAt.
- `AlertThrottle`: kind, lastSentAt.

## Phụ thuộc mới (cần duyệt)

- `otplib`: tạo và kiểm mã TOTP cho xác thực 2 lớp.
- Biểu đồ: tự vẽ SVG đơn giản, **không** thêm thư viện biểu đồ.

## Testing Strategy (riêng module)

- **Integration:**
  - Tài khoản thường vào mọi route `/admin/**` (cả trang lẫn API) đều nhận 404. Test tự quét **tất cả**
    route admin, nên thêm route mới mà quên chặn quyền là test đỏ.
  - Admin chưa nhập mã TOTP thì không thao tác được. Mã sai 5 lần thì khoá 15 phút. Mã dự phòng dùng 1
    lần là hết hiệu lực.
  - Mỗi thao tác (khoá Kiot, duyệt KYC, đổi phí…) sinh đúng 1 dòng audit log có before/after.
  - Số liệu tổng quan khớp với dữ liệu mẫu đã biết trước kết quả.
  - Xuất CSV giao dịch đúng cột, đúng định dạng tiếng Việt (UTF-8 có BOM để Excel mở không lỗi font).
  - Cảnh báo email: 10 sự việc cùng loại trong 15 phút gộp vào 1 email.
- **E2E:** đăng nhập admin + TOTP → hộp "Cần xử lý" có 1 yêu cầu rút → "Chi qua PayOS" (driver giả) →
  hàng chờ trống → audit log có dòng tương ứng.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Hỏi xác nhận trước thao tác tiền hoặc khoá.
  - Bắt nhập lý do cho khoá, gỡ, từ chối và điều chỉnh số dư.
- **Hỏi trước:**
  - Phân quyền nhiều cấp (kế toán chỉ xem, vận hành chỉ xử lý báo cáo…).
  - Báo qua Zalo hoặc Telegram.
- **Không bao giờ:**
  - Tắt xác thực 2 lớp cho admin.
  - Cho admin sửa trực tiếp số dư hoặc trạng thái tiền mà không đi qua hàm của module sở hữu.
  - Xoá audit log.

## Success Criteria

- [ ] Mở `/admin` trên điện thoại thấy ngay việc cần làm. Mỗi việc xử lý xong trong ≤ 2 chạm sau khi mở.
- [ ] Không ai ngoài admin, kể cả khi đã đăng nhập, biết được trang admin tồn tại.
- [ ] Lộ mật khẩu admin vẫn không vào được nếu không có điện thoại chứa mã 2 lớp.
- [ ] Mọi thao tác admin truy ngược được ai làm, lúc nào, vì sao.
- [ ] Xuất CSV giao dịch tháng mở được bằng Excel, dùng được cho kế toán.
- [ ] CEO nhận email ngay khi có sự cố tiền, và bản tin mỗi sáng.

## Open Questions

1. **Xác thực 2 lớp bắt buộc** cho admin (cần cài Google Authenticator trên điện thoại): đề xuất **có**,
   vì trang này điều khiển tiền.
2. MVP chỉ có **một cấp admin** (toàn quyền). Phân quyền kế toán hoặc vận hành để sau.
