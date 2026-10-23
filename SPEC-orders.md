# Spec: `orders` — Giỏ hàng, đặt hàng, 9mua thu hộ

> Module 5 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `kiot`, `payments`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Người mua thêm sản phẩm từ một hoặc nhiều Kiot vào giỏ, rồi trả **một lần** qua QR PayOS vào tài khoản
9mua. Mỗi Kiot nhận một đơn riêng để xác nhận và giao hàng. Tiền nằm ở 9mua cho tới khi đơn hoàn tất,
tức đã giao và hết **7 ngày khiếu nại**. Lúc đó module `payouts` cộng tiền vào số dư người bán (trừ phí sàn).

### Vòng đời đơn

```
pending_payment ──trả đủ──▶ paid ──người bán xác nhận──▶ confirmed ──giao cho shipper──▶ shipping
      │                     │                              │                               │
      │ hết 15' / huỷ       │ người bán từ chối / quá 48h   │ người bán huỷ                 │ người mua bấm "Đã nhận"
      ▼                     ▼ không xác nhận               ▼                               ▼ hoặc tự động sau 10 ngày
  cancelled            refund_pending ◀────────────────────┘                          delivered
                            │ CEO chuyển trả tiền tay                                       │ 7 ngày không khiếu nại
                            ▼                                                               ▼
                         refunded            disputed ◀──người mua "Báo vấn đề" (≤7 ngày)── completed ──▶ payouts cộng số dư
                                               │ CEO phân xử: hoàn tiền → refund_pending / cho người bán → completed
```

### Tiêu chí chấp nhận

1. **Giỏ hàng** `/gio-hang`:
   - Phải **đăng nhập** mới thêm vào giỏ. Bấm "Thêm vào giỏ" khi chưa đăng nhập thì chuyển sang đăng
     nhập rồi quay lại và tự thêm.
   - Giỏ lưu trong DB, xem được trên mọi thiết bị. Hiển thị **nhóm theo Kiot**.
   - Sửa số lượng (không vượt tồn kho), xoá món.
   - Món hết hàng, bị ẩn, hoặc Kiot không còn `active` thì hiện cảnh báo và không cho thanh toán món đó.
   - Mỗi giỏ tối đa 50 dòng.
2. **Phí ship** (người bán cài trong `/kiot-cua-toi/cai-dat`):
   - Phí ship cố định cho mỗi đơn (0–200.000đ), và ngưỡng miễn phí ship (tuỳ chọn).
   - Người bán tự giao hàng, MVP chưa tích hợp hãng vận chuyển.
3. **Đặt hàng** `/dat-hang`:
   - Nhập địa chỉ nhận: họ tên, SĐT, tỉnh/thành, quận/huyện, phường/xã, địa chỉ chi tiết. Có thể lưu làm
     mặc định. Ghi chú cho từng Kiot (tuỳ chọn).
   - Bấm "Đặt hàng" thì **một transaction** làm các việc sau:
     - Đọc lại giá và tồn kho từ DB (không tin giá trình duyệt gửi lên).
     - `kiot.decrementStock` giữ hàng.
     - Tạo 1 `Checkout` và N `Order` (mỗi Kiot 1 đơn).
     - Chụp lại tên, giá, ảnh của từng món vào `OrderItem`.
     - Lưu **tỉ lệ phí sàn tại thời điểm đặt** (mặc định 5%) vào đơn.

     Sau đó gọi `payments.createPayment({ purpose: 'order', refId: checkoutId, amount: tổng tất cả đơn })`.
   - Có món hết hàng thì không tạo gì và báo rõ món nào.
   - Trang thanh toán giống `billing`: QR, đếm ngược 15 phút, tự kiểm tra mỗi 3 giây.
4. **Khi tiền vào** (handler `onPaid` đăng ký với `payments`): mọi đơn của checkout chuyển sang `paid`,
   ghi `paidAt`, gửi email cho người mua và cho từng người bán ("Bạn có đơn mới").
   - **Trả muộn sau khi đã huỷ vì hết 15 phút:** thử giữ hàng lại. Còn hàng thì chuyển `paid` bình thường.
     Hết hàng thì chuyển `refund_pending`, báo CEO và báo người mua.
5. **Huỷ trước khi trả**: người mua bấm huỷ, hoặc quá 15 phút. Đơn thành `cancelled`, `kiot.restoreStock`,
   và `payments.cancelPayment`.
6. **Người bán xử lý** `/kiot-cua-toi/don-hang`, lọc theo trạng thái:
   - `paid` → "Xác nhận" (`confirmed`) hoặc "Từ chối" kèm lý do (`refund_pending`, hoàn tồn kho).
   - Quá **48 giờ** sau `paid` mà người bán không xác nhận thì tự động `refund_pending`.
   - `confirmed` → "Đã giao cho shipper" (`shipping`), nhập mã vận đơn và tên hãng (tuỳ chọn).
     Người bán cũng có thể huỷ ở bước này (`refund_pending`).
   - Người bán thấy **địa chỉ và SĐT người mua chỉ khi đơn đã `paid`**.
7. **Người mua** `/don-mua`:
   - Xem trạng thái từng đơn.
   - Ở `shipping`, bấm "Đã nhận hàng" (`delivered`). Không bấm thì tự động `delivered` sau **10 ngày**
     kể từ `shipping`.
   - Trong **7 ngày** sau `delivered`, bấm "Báo vấn đề" kèm mô tả và tối đa 3 ảnh. Đơn chuyển `disputed`
     và CEO nhận thông báo.
8. **Hoàn tất**: `delivered` đủ 7 ngày và không có khiếu nại thì chuyển `completed`. Gọi các hook
   `onOrderCompleted(tx, order)` đã đăng ký (`payouts` đăng ký để cộng số dư) **trong cùng transaction**.
9. **Hoàn tiền (MVP làm tay)**: đơn `refund_pending` hiện trong admin kèm số tiền.
   - Người mua nhập tài khoản ngân hàng nhận hoàn tiền trong `/don-mua/<id>`. Hệ thống gửi email nhắc nếu chưa nhập.
   - CEO chuyển khoản, rồi bấm "Đã hoàn" và nhập mã giao dịch. Đơn chuyển `refunded`.
   - Hoàn tiền là **trả lại toàn bộ đơn**, bao gồm phí ship. MVP chưa có hoàn một phần.
10. **Khiếu nại**: CEO xem hai bên rồi chọn "Hoàn tiền cho người mua" (`refund_pending`) hoặc
    "Trả cho người bán" (`completed`, cộng số dư ngay).
11. **Tác vụ định kỳ** `GET /api/internal/orders/tick` (chỉ localhost, cron chạy mỗi 5 phút):
    - Huỷ đơn chưa trả quá 15 phút.
    - Tự `refund_pending` đơn không xác nhận quá 48 giờ.
    - Tự `delivered` sau 10 ngày `shipping`.
    - Tự `completed` sau 7 ngày `delivered`.

    Mỗi bước idempotent, chạy lại không sinh lỗi.
12. **Kiot hết hạn hoặc bị khoá khi còn đơn**: đơn đang chạy vẫn đi tiếp bình thường, chỉ không nhận đơn mới.
13. **Mọi chuyển trạng thái** đều ghi vào `OrderEvent`: ai, lúc nào, từ trạng thái gì sang gì, lý do.
    Chỉ cho phép các chuyển trạng thái có trong sơ đồ trên. Chuyển sai thì từ chối ở server.
14. **Nguồn đơn**: `OrderItem.sourceVideoId` (tuỳ chọn) ghi lại món được mua từ video Creator nào,
    để `creator` thống kê. Chưa dùng để trả hoa hồng.

### Hợp đồng (`src/modules/orders/index.ts`)

```ts
addToCart(userId, productId, qty, sourceVideoId?): Promise<Result>
placeOrder(userId, input: { address; notes: Record<kiotId, string> }): Promise<{ ok: true; intentId } | { ok: false; error: 'OUT_OF_STOCK'; productIds: string[] } | ...>
transition(orderId: string, action: OrderAction, actor: Actor, payload?): Promise<Result>   // mọi thay đổi trạng thái đi qua đây
onOrderCompleted(handler: (tx: Tx, order: CompletedOrder) => Promise<void>): void
listOrdersForKiot(kiotId, filter), listOrdersForBuyer(userId), getOrder(orderId, viewer)
listRefundsPending(), listDisputes()          // cho admin
```

`CompletedOrder` gồm `{ id, kiotId, total, shippingFee, platformFeeRate, completedAt }`. `payouts` chỉ cần chừng này.

### Dữ liệu

- `CartItem`: userId, productId, qty, sourceVideoId. Khoá duy nhất (userId, productId).
- `Checkout`: id, buyerId, total, intentId.
- `Order`: id, code (`DH` + 6 số, dễ đọc qua điện thoại), checkoutId, kiotId, buyerId, status,
  subtotal, shippingFee, total, platformFeeRate (basis point, 500 = 5%), shipTo (JSON), note,
  trackingCode, carrier, các mốc thời gian (`paidAt`, `confirmedAt`, `shippedAt`, `deliveredAt`,
  `completedAt`, `cancelledAt`), refundAccount (JSON), refundRef.
- `OrderItem`: orderId, productId, name, price, qty, imageUrl, sourceVideoId.
- `OrderEvent`: orderId, from, to, actorId, actorRole (`buyer | seller | admin | system`), reason, createdAt.
- `Dispute`: orderId, message, images, resolution, resolvedBy, resolvedAt.

## Testing Strategy (riêng module)

- **Unit:**
  - Bảng chuyển trạng thái: mọi cặp (trạng thái, hành động, vai trò) hợp lệ thì qua, còn lại bị từ chối.
  - Tính tổng tiền, phí ship, ngưỡng miễn phí ship.
  - Sinh mã đơn.
- **Integration** (driver `fake`):
  - Giỏ 2 Kiot → đặt hàng → 1 QR → trả → 2 đơn `paid`, tồn kho giảm đúng, mỗi người bán nhận 1 email.
  - Sửa giá sản phẩm sau khi vào giỏ: đơn dùng giá mới trong DB, và `OrderItem` giữ giá lúc đặt.
  - 2 người cùng đặt món cuối cùng: 1 người thành công, 1 người nhận `OUT_OF_STOCK`.
  - Hết 15 phút: huỷ và hoàn tồn kho. Trả muộn khi còn hàng thì `paid`, hết hàng thì `refund_pending`.
  - 48 giờ không xác nhận thì `refund_pending`. 10 ngày `shipping` thì `delivered`. 7 ngày sau thì
    `completed` và hook `onOrderCompleted` chạy đúng 1 lần, kể cả khi tick chạy 2 lần song song.
  - Người bán A không xem hay sửa được đơn của Kiot B. Người mua không thấy đơn người khác.
  - Người bán không thấy SĐT người mua khi đơn còn `pending_payment`.
- **E2E:** mua hàng từ trang Kiot → trả (giả lập) → người bán xác nhận và giao → người mua "Đã nhận"
  → chạy tick với đồng hồ giả +7 ngày → đơn `completed`.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Tính lại giá từ DB.
  - Mọi thay đổi trạng thái qua `transition()` trong transaction.
  - Ghi `OrderEvent`.
- **Hỏi trước:**
  - Hoàn một phần.
  - Tích hợp GHN/GHTK.
  - Mua không cần đăng nhập.
  - COD (trả tiền khi nhận hàng).
- **Không bao giờ:**
  - Sửa `OrderItem` sau khi tạo.
  - Cho người bán tự đánh dấu `delivered` / `completed`.
  - Lộ thông tin người mua trước khi đơn được trả tiền.

## Success Criteria

- [ ] Mua từ 2 Kiot chỉ quét **1 QR**, mỗi Kiot nhận đúng đơn của mình.
- [ ] Không bao giờ bán quá tồn kho, kể cả khi nhiều người mua cùng lúc.
- [ ] Đơn đi đủ vòng `paid → confirmed → shipping → delivered → completed` và chỉ khi `completed` mới
      báo `payouts`.
- [ ] Mọi đơn bị kẹt đều được tự xử lý theo đúng mốc thời gian: chưa trả, không xác nhận, không bấm đã nhận.
- [ ] Mỗi đơn có lịch sử đầy đủ ai làm gì lúc nào.

## Quyết định đã chốt

1. Bắt buộc đăng nhập mới thêm vào giỏ.
2. Phí ship: người bán đặt một mức cố định cho mỗi đơn, kèm ngưỡng miễn phí ship.
3. Các mốc: 48 giờ xác nhận, 10 ngày tự động "đã nhận", 7 ngày khiếu nại.
4. Không có COD trong MVP. Hoàn tiền do CEO chuyển tay.
