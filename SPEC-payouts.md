# Spec: `payouts` — Số dư người bán, rút tiền, xác minh danh tính

> Module 6 trong `CAPABILITY-MAP.md`. Phụ thuộc `orders`, và dùng `kiot.getPayoutAccount`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Ghi sổ chính xác tiền 9mua đang giữ cho từng người bán. Người bán thấy số dư, yêu cầu rút. Yêu cầu
đủ điều kiện an toàn được **chi tự động qua API chi hộ của PayOS**, phần còn lại vào hàng chờ CEO duyệt. Mọi con số truy ngược được về từng đơn hàng, và không có cách nào rút quá số dư.

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
5. **Chi tự động qua PayOS** (`payos.payouts`, SDK `@payos/node` 2.0.5):
   - Khi tạo yêu cầu, hệ thống kiểm **luật duyệt tự động**. Đạt **tất cả** điều kiện thì chi ngay, không cần CEO:
     - Công tắc `payout_auto_enabled` đang bật. CEO tắt được bằng 1 chạm khi có sự cố.
     - KYC `approved` **và** tên chủ tài khoản ngân hàng khớp tên CCCD (bỏ dấu, viết hoa).
     - Tài khoản nhận **không đổi trong 72 giờ**.
     - Kiot đã có **ít nhất 1 lần rút được CEO duyệt tay thành công** trước đó. Lần rút đầu luôn duyệt tay,
       để kiểm tra tài khoản thật.
     - Số tiền ≤ `payout_auto_max_per_request` (mặc định 5.000.000đ).
     - Tổng chi tự động trong ngày của Kiot ≤ `payout_auto_max_per_kiot_day` (mặc định 10.000.000đ).
     - Tổng chi tự động toàn sàn trong ngày ≤ `payout_auto_daily_cap` (mặc định 50.000.000đ).
     - Kiot không bị khoá và không có đơn nào đang `disputed`.
     - Số dư tài khoản chi PayOS (`payoutsAccount.balance()`) đủ cho lệnh này.

     CEO chỉnh mọi mức trên trong trang admin (bảng `Setting`).
   - **Đạt luật**: yêu cầu chuyển `processing`, gọi `payos.payouts.create({ referenceId: code, amount,
     description: '9MUA RUT ' + code, toBin, toAccountNumber }, idempotencyKey = payoutId)`.
     - Gọi lỗi mạng hoặc hết thời gian chờ thì **thử lại với cùng `idempotencyKey`**, nên PayOS không chi
       2 lần.
     - Lưu `payosPayoutId`.
   - **Không đạt luật**: yêu cầu ở `pending` trong hàng chờ CEO, kèm **lý do cụ thể** (ví dụ "Lần rút
     đầu", "Vượt 5.000.000đ", "Tài khoản đổi 30 giờ trước").
   - **Đồng bộ trạng thái**: `GET /api/internal/payouts/sync` (chỉ localhost, cron mỗi 2 phút) gọi
     `payos.payouts.get` cho mọi yêu cầu `processing`.
     - `SUCCEEDED` → `paid`: lưu mã giao dịch ngân hàng và tên người nhận PayOS trả về, rồi gửi email
       cho người bán.
     - `FAILED` / `CANCELLED` / `REVERSED` → `failed`: ghi `payout_reversal` trả lại số dư, gửi email
       cho người bán, báo CEO.
     - `ON_HOLD` hoặc `processing` quá 2 giờ → báo CEO.
   - **Cảnh báo quỹ chi**: khi số dư tài khoản chi PayOS thấp hơn tổng yêu cầu đang chờ cộng 10.000.000đ,
     gửi email cho CEO để nạp thêm.
6. **CEO duyệt tay** (hàng chờ trong trang admin; module `admin` dựng giao diện, module này cung cấp hàm):
   - **"Chi qua PayOS"**: 1 chạm, đi qua đúng luồng tự động ở trên (bỏ qua luật, giữ mọi kiểm tra số dư).
   - **"Đã chuyển tay"**: dự phòng khi PayOS lỗi. Hệ thống hiện QR VietQR của tài khoản người bán, đã
     điền số tiền và nội dung `9MUA RUT <mã>`. CEO quét bằng app MB, chuyển, rồi nhập mã giao dịch.
   - **"Từ chối"**: nhập lý do, yêu cầu chuyển `rejected`, ghi `payout_reversal` trả lại số dư, gửi email.
7. **Điều chỉnh tay** (hiếm dùng): CEO cộng hoặc trừ số dư kèm lý do bắt buộc. Ghi
   `BalanceEntry(type = 'adjustment')` cùng người thực hiện.
8. **Báo cáo** cho admin:
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
requestPayout(kiotId, userId, amount): Promise<{ ok: true; payoutId; mode: 'auto' | 'manual'; reasons: string[] } | { ok: false; error: 'KYC_REQUIRED' | 'BELOW_MIN' | 'INSUFFICIENT' | 'HAS_PENDING' | 'NO_ACCOUNT' | 'ACCOUNT_RECENTLY_CHANGED' }>
cancelPayout(payoutId, userId): Promise<Result>
approvePayoutViaPayos(payoutId, adminId): Promise<Result>   // "Chi qua PayOS"
markPayoutPaid(payoutId, adminId, bankRef): Promise<Result>  // chuyển tay dự phòng
syncProcessingPayouts(): Promise<void>                        // cron
evaluateAutoRules(payoutId): Promise<{ eligible: boolean; reasons: string[] }>
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
  (`pending | processing | paid | failed | rejected | cancelled`), mode (`auto | manual`),
  autoRuleReasons, payosPayoutId, payosState, bankRef, receiverNameFromBank, rejectReason, các mốc thời
  gian, xử lý bởi.

## Phụ thuộc mới

Không có thư viện mới: dùng lại `@payos/node` (đã duyệt ở `payments`) và `qrcode` (đã duyệt ở `kiot`).
`payments` mở thêm một client chi hộ nội bộ (`payments/payout-client.ts`) có driver `fake` cho dev/test.
Đây vẫn là chỗ duy nhất nói chuyện với PayOS.

**Điều kiện ngoài code:** đăng ký **kênh chi hộ (Payout) với PayOS** cho 9MUA CO.,LTD. Kênh này có bộ
Client ID / API Key / Checksum Key riêng (`PAYOS_PAYOUT_*`) và một tài khoản chi phải nạp tiền trước.
Chưa có kênh chi thì hệ thống tự chạy chế độ duyệt tay.

## Testing Strategy (riêng module)

- **Unit:**
  - Tính phí sàn: 5% của 99.999đ được làm tròn đúng; phí ship không bị tính phí; tỉ lệ 0%.
  - Tạo chuỗi VietQR, rồi đọc lại bằng bộ giải để kiểm đúng STK và số tiền.
  - So khớp tên CCCD với tên tài khoản ngân hàng.
- **Integration:**
  - Đơn hoàn tất → số dư = total − phí. Hook chạy 2 lần vẫn chỉ cộng 1 lần.
  - **Luật tự động:** mỗi điều kiện có test riêng, sai đúng 1 điều kiện thì vào hàng chờ với lý do đúng.
    Đủ điều kiện thì `processing` → (PayOS giả trả `SUCCEEDED`) → `paid`.
  - PayOS giả trả `FAILED` thì số dư được hoàn đủ, CEO nhận cảnh báo.
  - PayOS giả hết thời gian chờ ở lần gọi đầu thì gọi lại cùng `idempotencyKey` và chỉ có 1 lệnh chi.
  - Tắt công tắc `payout_auto_enabled` thì mọi yêu cầu mới vào hàng chờ.
  - Vượt hạn mức ngày toàn sàn thì các yêu cầu sau vào hàng chờ.
  - **10 yêu cầu rút song song**, mỗi cái bằng toàn bộ số dư: đúng 1 cái thành công.
  - Chưa KYC thì `KYC_REQUIRED`. Vừa đổi tài khoản thì `ACCOUNT_RECENTLY_CHANGED`.
  - Từ chối hoặc huỷ yêu cầu thì số dư quay về đúng như trước.
  - Đổi tài khoản sau khi đã tạo yêu cầu: yêu cầu vẫn giữ tài khoản cũ.
  - Người bán A không xem được số dư hay ảnh KYC của B. Ảnh KYC không truy cập được qua `/uploads`.
  - `custodyReport` khớp tổng tiền vào trừ hoàn tiền trừ đã chi, trên dữ liệu mẫu nhiều đơn.
- **E2E:** đơn hoàn tất → người bán nộp KYC → CEO duyệt → rút lần 1 vào hàng chờ, CEO bấm "Chi qua
  PayOS" → `paid` → (đồng hồ giả +72h) rút lần 2 được **chi tự động** → `paid` mà CEO không cần làm gì.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Mọi thay đổi số dư qua `BalanceEntry` trong transaction, có khoá theo Kiot.
  - Kiểm quyền admin cho mọi thao tác với ảnh KYC.
- **Hỏi trước:**
  - Nới luật duyệt tự động (bỏ điều kiện "lần đầu duyệt tay", tăng hạn mức mặc định).
  - Thu phí rút tiền.
  - Đổi mức rút tối thiểu.
- **Không bao giờ:**
  - Sửa hoặc xoá `BalanceEntry`.
  - Phục vụ ảnh CCCD qua đường dẫn công khai.
  - Chi tiền khi KYC chưa duyệt.
  - Gọi `payouts.create` mà không có `idempotencyKey` cố định theo yêu cầu.
  - Đánh dấu `paid` trước khi PayOS trả `SUCCEEDED`.

## Success Criteria

- [ ] Số dư mọi Kiot luôn khớp: tổng đơn hoàn tất (trừ phí) + điều chỉnh − đã rút.
- [ ] Không có cách nào rút vượt số dư, kể cả bấm liên tục hay mở nhiều tab.
- [ ] Yêu cầu đủ điều kiện được chi tự động, tiền tới tài khoản người bán trong vòng 5 phút, CEO không phải làm gì.
- [ ] Yêu cầu không đủ điều kiện: CEO xử lý bằng 1 chạm "Chi qua PayOS", kèm lý do vì sao không được tự động.
- [ ] Không bao giờ chi 2 lần cho cùng một yêu cầu, kể cả khi mạng lỗi hoặc cron chạy chồng.
- [ ] Báo cáo tiền giữ hộ đối chiếu được với số dư TK MB 979393916.

## Open Questions

1. Rút tối thiểu **50.000đ**, **không thu phí rút**: có ổn không?
2. Mức tự động mặc định: **5 triệu/lần, 10 triệu/Kiot/ngày, 50 triệu/toàn sàn/ngày**, **lần rút đầu duyệt tay**.
   Có cần đổi không? (CEO chỉnh được sau trong admin.)
3. Cần đăng ký **kênh chi hộ PayOS** và nạp tiền vào tài khoản chi. Phí chi hộ của PayOS 9mua chịu hay
   trừ vào người bán? Đề xuất **9mua chịu** trong giai đoạn đầu.
