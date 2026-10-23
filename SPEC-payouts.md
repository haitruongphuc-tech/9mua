# Spec: `payouts` — Số dư người bán, rút tiền, xác minh danh tính

> Module 6 trong `CAPABILITY-MAP.md`. Phụ thuộc `orders`, và dùng `kiot.getPayoutAccount`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Ghi sổ chính xác tiền 9mua đang giữ cho từng người bán. Người bán thấy số dư, yêu cầu rút. CEO chuyển
khoản tay rồi xác nhận. Mọi con số truy ngược được về từng đơn hàng, và không có cách nào rút quá số dư.

### Tiêu chí chấp nhận

1. **Cộng số dư khi đơn hoàn tất** (hook `orders.onOrderCompleted`, chạy trong transaction của `orders`):
   - `phí sàn = round(subtotal × platformFeeRate / 10000)`. Phí sàn tính trên **tiền hàng**, không tính
     trên phí ship. `platformFeeRate` lấy từ đơn, là tỉ lệ lúc đặt hàng.
   - `số tiền cộng = total − phí sàn`.
   - Ghi 1 dòng `BalanceEntry(type = 'order_credit', refId = orderId)`. Khoá duy nhất `(type, refId)`, nên
     hook chạy lại cũng không cộng 2 lần.
   - Ghi doanh thu sàn `PlatformRevenue(orderId, fee)`.
2. **Trang số dư** `/kiot-cua-toi/so-du`:
   - **Có thể rút** = tổng `BalanceEntry`.
   - **Đang chờ** = tổng tiền các đơn `paid` → `delivered` chưa hoàn tất (tính từ `orders`, chỉ để xem).
   - Lịch sử biến động: đơn nào, cộng bao nhiêu, phí sàn bao nhiêu, rút lúc nào.
3. **Xác minh danh tính (KYC), bắt buộc trước lần rút đầu tiên**:
   - Nhập họ tên theo CCCD và số CCCD, tải ảnh mặt trước và mặt sau.
   - Ảnh lưu ở **thư mục riêng tư** `PRIVATE_DIR` (Nginx không phục vụ). Chỉ admin xem được, qua route
     có kiểm quyền.
   - Trạng thái: `pending` → `approved` / `rejected` (kèm lý do, cho nộp lại).
   - CEO được cảnh báo khi **tên chủ tài khoản ngân hàng khác tên trên CCCD** (so sánh sau khi bỏ dấu,
     viết hoa).
4. **Yêu cầu rút tiền**:
   - Điều kiện: KYC `approved`, số tiền ≥ **50.000đ** và ≤ số dư có thể rút, không có yêu cầu nào khác
     đang chờ, đã khai báo tài khoản nhận tiền, và tài khoản đó **đổi cách đây hơn 24 giờ**.
   - Tạo yêu cầu thì ghi ngay `BalanceEntry(type = 'payout_reserve', amount = −số tiền)`, nên số dư giảm
     liền. Hai yêu cầu bấm cùng lúc không thể cùng qua: khoá theo Kiot bằng
     `pg_advisory_xact_lock(kiotId)`.
   - Yêu cầu **chụp lại** tài khoản nhận lúc tạo (ngân hàng, STK, tên). Đổi tài khoản sau đó không ảnh
     hưởng yêu cầu đang chờ.
   - Người bán huỷ được khi yêu cầu còn `pending`. Huỷ thì ghi
     `BalanceEntry(type = 'payout_reversal', +số tiền)`.
5. **CEO xử lý** (trang admin, module `admin` dựng giao diện, module này cung cấp hàm):
   - Danh sách yêu cầu `pending`, mỗi dòng có **QR VietQR của tài khoản người bán**, đã điền sẵn số tiền
     và nội dung `9MUA RUT <mã>`. CEO mở app MB quét là chuyển được, không phải gõ STK.
   - "Đã chuyển": nhập mã giao dịch ngân hàng, yêu cầu chuyển `paid`, gửi email cho người bán.
   - "Từ chối": nhập lý do, yêu cầu chuyển `rejected`, ghi `payout_reversal` trả lại số dư, gửi email.
6. **Điều chỉnh tay** (hiếm dùng): CEO cộng hoặc trừ số dư kèm lý do bắt buộc. Ghi
   `BalanceEntry(type = 'adjustment')` cùng người thực hiện.
7. **Báo cáo** cho admin:
   - Tổng tiền đang giữ hộ (tổng mọi số dư cộng đơn đang chờ).
   - Tổng phí sàn theo khoảng thời gian.
   - Tổng đã chi trả.
   - Mục đích: đối chiếu với số dư thật của TK MB 979393916.

### Hợp đồng (`src/modules/payouts/index.ts`)

```ts
getBalance(kiotId): Promise<{ available: number; pending: number }>
listBalanceEntries(kiotId, cursor?): Promise<Page<BalanceEntryView>>
submitKyc(userId, input): Promise<Result>
reviewKyc(kycId, adminId, decision: 'approve' | 'reject', reason?): Promise<Result>
requestPayout(kiotId, userId, amount): Promise<{ ok: true; payoutId } | { ok: false; error: 'KYC_REQUIRED' | 'BELOW_MIN' | 'INSUFFICIENT' | 'HAS_PENDING' | 'NO_ACCOUNT' | 'ACCOUNT_RECENTLY_CHANGED' }>
cancelPayout(payoutId, userId): Promise<Result>
markPayoutPaid(payoutId, adminId, bankRef): Promise<Result>
rejectPayout(payoutId, adminId, reason): Promise<Result>
adjustBalance(kiotId, adminId, amount, reason): Promise<void>
custodyReport(range): Promise<{ held: number; pending: number; platformFees: number; paidOut: number }>
```

### Dữ liệu

- `BalanceEntry`: id, kiotId, type (`order_credit | payout_reserve | payout_reversal | adjustment`),
  amount (số nguyên có dấu), refId, note, actorId, createdAt. Khoá duy nhất `(type, refId)`.
  **Chỉ thêm, không bao giờ sửa hay xoá.** Số dư luôn bằng `SUM(amount)`, không lưu cứng ở chỗ khác.
- `PlatformRevenue`: orderId (unique), fee, createdAt.
- `KycSubmission`: id, userId, fullName, idNumber, frontImage, backImage, status, reason, reviewedBy,
  reviewedAt.
- `PayoutRequest`: id, code (`RT` + 6 số), kiotId, amount, bankBin, accountNumber, accountName, status
  (`pending | paid | rejected | cancelled`), bankRef, rejectReason, các mốc thời gian, xử lý bởi.

## Phụ thuộc mới

Không. QR VietQR được dựng theo chuẩn EMVCo bằng thư viện `qrcode` đã duyệt ở `kiot`, không gọi dịch vụ ngoài.

## Testing Strategy (riêng module)

- **Unit:**
  - Tính phí sàn: 5% của 99.999đ được làm tròn đúng; phí ship không bị tính phí; tỉ lệ 0%.
  - Tạo chuỗi VietQR, rồi đọc lại bằng bộ giải để kiểm đúng STK và số tiền.
  - So khớp tên CCCD với tên tài khoản ngân hàng.
- **Integration:**
  - Đơn hoàn tất → số dư = total − phí. Hook chạy 2 lần vẫn chỉ cộng 1 lần.
  - **10 yêu cầu rút song song**, mỗi cái bằng toàn bộ số dư: đúng 1 cái thành công.
  - Chưa KYC thì `KYC_REQUIRED`. Vừa đổi tài khoản thì `ACCOUNT_RECENTLY_CHANGED`.
  - Từ chối hoặc huỷ yêu cầu thì số dư quay về đúng như trước.
  - Đổi tài khoản sau khi đã tạo yêu cầu: yêu cầu vẫn giữ tài khoản cũ.
  - Người bán A không xem được số dư hay ảnh KYC của B. Ảnh KYC không truy cập được qua `/uploads`.
  - `custodyReport` khớp tổng tiền vào trừ hoàn tiền trừ đã chi, trên dữ liệu mẫu nhiều đơn.
- **E2E:** đơn hoàn tất → người bán nộp KYC → CEO duyệt → người bán rút 50.000đ → CEO thấy QR, bấm
  "Đã chuyển" → người bán thấy `paid` và số dư giảm.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Mọi thay đổi số dư qua `BalanceEntry` trong transaction, có khoá theo Kiot.
  - Kiểm quyền admin cho mọi thao tác với ảnh KYC.
- **Hỏi trước:**
  - Chi hộ tự động qua API PayOS.
  - Thu phí rút tiền.
  - Đổi mức rút tối thiểu.
- **Không bao giờ:**
  - Sửa hoặc xoá `BalanceEntry`.
  - Phục vụ ảnh CCCD qua đường dẫn công khai.
  - Chi tiền khi KYC chưa duyệt.

## Success Criteria

- [ ] Số dư mọi Kiot luôn khớp: tổng đơn hoàn tất (trừ phí) + điều chỉnh − đã rút.
- [ ] Không có cách nào rút vượt số dư, kể cả bấm liên tục hay mở nhiều tab.
- [ ] CEO xử lý một yêu cầu rút trong dưới 1 phút: quét QR bằng app MB, chuyển, bấm "Đã chuyển".
- [ ] Báo cáo tiền giữ hộ đối chiếu được với số dư TK MB 979393916.

## Open Questions

1. Mức rút tối thiểu **50.000đ**, **không thu phí rút**: có ổn không?
2. Cam kết thời gian xử lý rút tiền hiển thị cho người bán: đề xuất "trong 2 ngày làm việc".
