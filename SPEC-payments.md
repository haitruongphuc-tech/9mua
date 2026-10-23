# Spec: `payments` — Lớp tích hợp PayOS dùng chung

> Module 3 trong `CAPABILITY-MAP.md`. Không phụ thuộc module nghiệp vụ nào.
> Nền móng chung theo `SPEC-identity.md`.
> Nguồn đối chiếu: SDK chính thức `@payos/node` 2.0.5 (payOSHQ/payos-lib-node, phát hành 2026-03-05)
> và API reference https://payos.vn/docs/api.

## Objective

Chỉ một chỗ trong hệ thống nói chuyện với PayOS. Module này tạo mã QR/link thanh toán, nhận webhook báo
tiền vào, kiểm tra chữ ký và ghi sổ, rồi báo cho module nghiệp vụ (`billing`, `orders`) đúng **một lần**
cho mỗi khoản đã trả đủ. Các module đó không cần biết PayOS hoạt động ra sao.

Tiền vào TK MB 979393916 của 9MUA CO.,LTD, là tài khoản đã liên kết với PayOS.

### Luồng

```
billing/orders ──createPayment()──▶ payments ──paymentRequests.create──▶ PayOS
                                        │  lưu PaymentIntent(pending, orderCode, checkoutUrl, qrCode)
người mua quét QR / mở checkoutUrl ─────────────────────────────────────▶ PayOS ──tiền──▶ MB 979393916
PayOS ──POST /api/payos/webhook──▶ payments: verify chữ ký → khớp orderCode + số tiền
                                        │  1 transaction DB: intent=paid + ghi PaymentEvent + gọi handler(purpose)
                                        ▼
                         billing.onPaid(tx, intent) / orders.onPaid(tx, intent)
```

### Tiêu chí chấp nhận

1. **Tạo thanh toán**: `createPayment({ purpose, refId, amount, description, returnPath, ttlMinutes })`.
   - `orderCode` là số nguyên dương duy nhất, lấy từ sequence PostgreSQL (không dùng `Date.now()`, dễ trùng).
   - `amount` là số nguyên VNĐ, từ 2.000 trở lên.
   - `description` chỉ chữ in hoa không dấu và số, **tối đa 9 ký tự**, ví dụ `KIOT1234` hoặc `DH58213`
     (giới hạn của tài khoản ngân hàng liên kết. Cần kiểm lại với tài khoản PayOS thật).
   - `expiredAt` mặc định 15 phút.
   - Trả về `{ intentId, orderCode, checkoutUrl, qrCode, expiresAt }`. Trang của 9mua tự vẽ QR từ chuỗi
     `qrCode`, người dùng không phải rời khỏi site.
   - Nếu đã có intent `pending` còn hạn cho cùng `purpose + refId + amount` thì trả lại intent đó,
     không tạo link mới. Người dùng bấm "Thanh toán" hai lần cũng không sinh hai QR.
2. **Webhook** `POST /api/payos/webhook`:
   - Kiểm chữ ký bằng `payos.webhooks.verify()` với `PAYOS_CHECKSUM_KEY`. Sai chữ ký thì trả 400, ghi log
     cảnh báo và **không thay đổi gì**.
   - Ghi mọi webhook hợp lệ vào `PaymentEvent`, khoá duy nhất là `(orderCode, reference)`.
     **Nhận trùng thì trả 200 và không làm gì thêm**, vì PayOS có thể gửi lại.
   - Số tiền nhận được **bằng** `amount`: chuyển intent sang `paid` và gọi handler của `purpose` trong
     **cùng một transaction**. Handler lỗi thì rollback toàn bộ và trả 500 để PayOS gửi lại.
   - Tiền **thiếu hoặc thừa**: chuyển intent sang `mismatch` và không gọi handler. Hiện cảnh báo trong
     trang admin để CEO xử lý tay (hoàn tiền hoặc ghi nhận).
   - Webhook cho `orderCode` không có trong hệ thống: trả 200 và ghi `PaymentEvent` mồ côi để đối soát.
   - Thời gian phản hồi nhỏ hơn 2 giây.
3. **Đối soát** (phòng webhook bị mất):
   - Khi người dùng quay về `returnUrl`, gọi `payos.paymentRequests.get(orderCode)` để kiểm trạng thái.
   - `GET /api/internal/payments/reconcile` (chỉ gọi được từ localhost, cron trên host gọi mỗi 5 phút)
     kiểm mọi intent `pending` dưới 24 giờ.
   - Trạng thái PayOS `PAID` đi qua **đúng hàm xử lý của webhook**, cùng tính idempotent.
   - `EXPIRED` / `CANCELLED` thì đánh dấu tương ứng.
4. **Huỷ**: `cancelPayment(intentId, reason)` gọi `paymentRequests.cancel(orderCode)`. Dùng khi người dùng huỷ
   đơn trước khi trả.
5. **Đăng ký webhook**: lệnh `npm run payos:confirm-webhook -- https://9mua.com/api/payos/webhook`
   (gọi `payos.webhooks.confirm`). Chạy một lần khi deploy.
6. **Chế độ giả lập** (`PAYMENTS_DRIVER=fake`, chỉ dev/test, **bị chặn khi `NODE_ENV=production`**):
   - Không gọi PayOS. Trang `/dev/payos/<orderCode>` có nút "Giả lập đã trả" và "Giả lập trả thiếu".
   - Nút sinh webhook có chữ ký hợp lệ, đi qua đúng đường xử lý thật.
   - Cách này test được toàn bộ luồng mà không cần tiền thật hay URL công khai.

### Hợp đồng (`src/modules/payments/index.ts`)

```ts
type Purpose = 'kiot_fee' | 'order';
createPayment(input: { purpose: Purpose; refId: string; amount: number; description: string; returnPath: string; ttlMinutes?: number }): Promise<PaymentIntentView>
getPayment(intentId: string): Promise<PaymentIntentView | null>      // tự đối soát nếu còn pending
cancelPayment(intentId: string, reason: string): Promise<void>
registerPaymentHandler(purpose: Purpose, onPaid: (tx: Tx, intent: PaidIntent) => Promise<void>): void
listMismatches(): Promise<PaymentIntentView[]>                         // cho admin
```

`registerPaymentHandler` giúp `payments` không phải import `billing` hay `orders`. Hai module đó tự đăng ký
lúc khởi động, nên chiều phụ thuộc đúng như capability map.

### Dữ liệu

- `PaymentIntent`: id, orderCode (bigint, unique), purpose, refId, amount, description,
  status (`pending | paid | expired | cancelled | mismatch`), paymentLinkId, checkoutUrl, qrCode,
  expiresAt, paidAt, amountPaid, createdAt.
- `PaymentEvent`: id, orderCode, reference, amount, transactionDateTime, counterAccount* (tên/STK người
  chuyển, phục vụ đối soát), payload JSON, createdAt. Khoá duy nhất `(orderCode, reference)`.
- Không bao giờ xoá hai bảng này: đây là **sổ cái tiền vào**.

### Biến môi trường

`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYMENTS_DRIVER=payos|fake`, `APP_URL=https://9mua.com`.
Các giá trị này lấy từ trang quản lý PayOS và chỉ đặt trong `.env` trên VPS.

## Phụ thuộc mới (cần duyệt)

- `@payos/node` (SDK chính thức, cần Node ≥ 20, có sẵn trong image Node 22).

## Testing Strategy (riêng module)

- **Unit:**
  - Chuẩn hoá `description` (bỏ dấu, viết hoa, cắt 9 ký tự).
  - Kiểm `amount`.
  - Bảng chuyển trạng thái intent: `paid` không quay lại `pending`, `expired` vẫn nhận được webhook trả
    muộn và chuyển sang `paid`.
- **Integration (driver giả + chữ ký HMAC thật bằng checksum key test):**
  - Webhook hợp lệ: intent thành `paid` và handler được gọi đúng 1 lần.
  - **Gửi cùng webhook 5 lần song song thì handler vẫn chạy đúng 1 lần.**
  - Sai chữ ký: 400, DB không đổi.
  - Trả thiếu hoặc thừa: `mismatch`, handler không chạy.
  - Handler throw: rollback, intent vẫn `pending`, trả 500. Gửi lại sau đó thì thành công.
  - Đối soát thấy `PAID` mà chưa có webhook: kết quả giống hệt nhánh webhook.
  - `createPayment` gọi 2 lần liên tiếp trả cùng một intent.
  - Driver `fake` bị từ chối khi `NODE_ENV=production`.
- Một test **contract** với SDK thật: `webhooks.verify` của SDK chấp nhận payload do bộ giả lập ký,
  đảm bảo bộ giả lập ký đúng chuẩn PayOS.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Kiểm chữ ký trước khi đọc bất kỳ trường nào của webhook.
  - So khớp số tiền.
  - Mọi thay đổi trạng thái tiền nằm trong transaction.
- **Hỏi trước:**
  - Thêm cổng thanh toán thứ hai (VNPay, MoMo).
  - Đổi tài khoản nhận tiền trên PayOS.
- **Không bao giờ:**
  - Tin `returnUrl?status=PAID` từ trình duyệt mà không hỏi lại PayOS.
  - Log hoặc commit `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY`.
  - Sửa hoặc xoá dòng `PaymentEvent`.
  - Bật driver `fake` ở production.

## Success Criteria

- [ ] Trên môi trường thật, trả 2.000đ thử bằng app ngân hàng: trong vòng 10 giây intent thành `paid`
      và handler chạy.
- [ ] Tắt webhook rồi trả tiền: trong vòng 5 phút, đối soát vẫn ghi nhận `paid`.
- [ ] Gửi lại cùng webhook nhiều lần không bao giờ kích hoạt 2 lần.
- [ ] Webhook giả mạo (sai chữ ký) không làm thay đổi dữ liệu.
- [ ] Toàn bộ luồng chạy được ở dev bằng driver `fake`, không cần tài khoản PayOS.

## Open Questions

1. Cần **tài khoản PayOS** liên kết MB 979393916 (lấy Client ID, API Key, Checksum Key) trước khi test
   tiền thật. Code và test viết trước bằng driver giả, không bị chặn.

## Ghi chú cho module sau

SDK PayOS có sẵn **API chi hộ (`payos.payouts`)**: chuyển tiền tự động tới số tài khoản người bán.
MVP vẫn để CEO chuyển tay như đã chốt. Giai đoạn sau `payouts` có thể dùng API này để tự động hoá.
