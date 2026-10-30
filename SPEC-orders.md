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

## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: chờ CEO duyệt.** Quyết định, công tắc, dịch vụ ngoài, dữ liệu: `docs/nang-cap-mot-dot.md`. Hình: M7.
> Phần đụng tiền (V5.2 hoàn tiền, V5.3, V5.4, V5.5) **tắt sẵn** khi đưa lên web. Mọi chuyển trạng thái mới vẫn đi qua
> `transition()`, ghi `OrderEvent`, chỉ **thêm** cặp chuyển mới vào bảng, không sửa cặp cũ.

### V5.1 Đánh giá sản phẩm, sao Kiot (C15, C82) — công tắc `feature.reviews`

1. Ai được đánh giá: người mua có `OrderItem` thuộc đơn `delivered` hoặc `completed`, trong **30 ngày** từ `deliveredAt`.
   Mỗi `OrderItem` một đánh giá. Đơn đã hoàn tiền thì không đánh giá được; đánh giá có trước khi hoàn tiền vẫn giữ.
2. Nội dung: **1–5 sao** (bắt buộc), chữ ≤ 1.000 ký tự (không cho link), tối đa 5 ảnh, tối đa 1 video ≤ 30 giây.
   Sửa được 1 lần trong 7 ngày.
3. Nhắc đánh giá: thông báo 3 ngày sau `delivered`.
4. Chủ Kiot trả lời mỗi đánh giá 1 lần (≤ 500 ký tự). Chủ Kiot **không** xoá hay ẩn được đánh giá.
5. Báo cáo đánh giá (lý do như báo cáo khác, `SPEC-admin.md` V5.2): 5 người khác nhau báo cáo thì tự ẩn chờ CEO; CEO ẩn kèm lý do.
6. Hiện trên trang sản phẩm: trung bình, tổng số, phân bố 5→1 sao, lọc "Có ảnh/video" và theo số sao; mỗi đánh giá ghi
   "Đã mua · <biến thể>".
7. **Sao Kiot** = trung bình mọi đánh giá đang hiện của sản phẩm Kiot đó. Chỉ hiện khi có **từ 3 đánh giá** (giữ quy tắc cũ
   "không hiện điểm khi chưa có đánh giá thật").
8. Cột `Product.ratingAvg`, `Product.ratingCount` cập nhật trong cùng transaction với đánh giá. Bảng `ProductReview`
   (orderItemId duy nhất, productId, kiotId, buyerId, stars, text, editedAt, reply, repliedAt, hiddenAt, hiddenBy),
   `ReviewMedia`, `ReviewReport`.

### V5.2 Tố cáo hàng giả, xử lý 24 giờ (C18) — công tắc `feature.fake_report`, hoàn tiền `feature.fake_report_refund`

1. Nút "Tố cáo hàng giả" trên trang sản phẩm, tách khỏi nút "Báo cáo" chung. Phải đăng nhập.
2. Form: lý do (Hàng giả/nhái, Sai nguồn gốc), mô tả 20–2.000 ký tự, tối đa 5 ảnh, chọn đơn đã mua sản phẩm này (nếu có).
3. Bảng `FakeReport`: status `open` → `investigating` → `confirmed` | `rejected`; `deadlineAt = createdAt + 24 giờ`.
   Người tố cáo thấy "9MUA xử lý trước HH:mm ngày dd/mm".
4. Chủ Kiot nhận thông báo và gửi giải trình kèm giấy tờ trong 12 giờ.
5. Hàng chờ CEO `/admin/hang-gia` xếp theo hạn; quá hạn thì báo CEO (như cảnh báo đang có).
6. CEO **xác nhận là hàng giả** thì làm trong một transaction, mỗi việc ghi nhật ký CEO:
   - gỡ sản phẩm; thu hồi huy hiệu nguồn gốc (`SPEC-kiot.md` V5.2); ghi 1 vi phạm (`SPEC-admin.md` V5.3);
   - nếu công tắc hoàn tiền bật và tố cáo gắn với đơn của người tố cáo:
     - đơn chưa `completed` (`delivered` hoặc `disputed`): chuyển `refund_pending` qua luồng hoàn tiền đang có;
     - đơn đã `completed` (người bán đã được cộng số dư): thêm cặp chuyển mới `completed → refund_pending`
       (hành động `fake_refund`, chỉ admin), và ghi dòng `BalanceEntry(type = 'adjustment', amount = −số đã cộng cho người bán,
       refId = fakeReportId)`. Số dư có thể âm; Kiot số dư âm không rút được và CEO thấy cảnh báo.
   - Tiền hoàn cho người mua đi đúng đường hoàn tiền hiện nay (người mua nhập tài khoản, CEO chuyển, bấm "Đã hoàn").
     Hoàn tối đa bằng tổng đơn.
7. CEO **bác** thì báo người tố cáo kèm lý do; tố cáo sai nhiều lần (3 lần bị bác trong 90 ngày) thì 30 ngày không tố cáo được.

### V5.3 Mã giảm giá, giảm giá theo giờ (C84) — công tắc `feature.coupons`

1. **Mã giảm giá của Kiot** (`/kiot-cua-toi/khuyen-mai`):
   - Mã 4–16 ký tự (chữ in hoa, số) hoặc "tự áp" (không cần nhập).
   - Giảm số tiền (≥ 1.000đ) hoặc giảm % (1–50%, có mức giảm tối đa).
   - Đơn tối thiểu, thời gian bắt đầu/kết thúc, tổng lượt dùng, mỗi người dùng 1 lần, áp cho cả Kiot hoặc danh sách sản phẩm.
   - **Kiot chịu toàn bộ tiền giảm**; 9MUA không bù.
2. **Khi đặt hàng:** mỗi đơn (mỗi Kiot) dùng tối đa 1 mã. Máy chủ kiểm tra lại mã trong transaction đặt hàng.
   - `Order.discountVnd`, `Order.couponId`. `total = subtotal − discountVnd + shippingFee`.
   - **Phí sàn tính trên tiền hàng sau giảm:** `round((subtotal − discountVnd) × platformFeeRate / 10000)`.
3. **Giảm giá theo giờ:** Kiot đặt giá giảm cho sản phẩm (hoặc biến thể) trong một khung ≤ 24 giờ, giới hạn số suất.
   - Trang sản phẩm hiện đồng hồ đếm ngược và "còn N suất". Giá tính lại lúc đặt hàng; hết suất hoặc hết giờ thì về giá thường.
   - Dùng chung được với mã giảm giá, trừ khi Kiot tick "Không dùng chung".
4. Chợ có nhãn "Giảm giá" và bộ lọc "Đang giảm giá".
5. Sổ chỉ thêm `CouponRedemption` (couponId, orderId, buyerId, amount, kind `use | release`). Đơn huỷ trước khi trả tiền thì
   ghi dòng `release` để trả lượt.
6. Bảng `Coupon`, `FlashSale` (productId, variantId, salePrice, startAt, endAt, quota, sold).

### V5.4 Giao hàng qua GHN/GHTK (C31) — công tắc `feature.carriers`

1. Dùng **tài khoản doanh nghiệp của 9MUA** với từng hãng (khoá ở `.env`). Kiot tự chọn "Giao qua hãng" và hãng mặc định trong
   cài đặt; sản phẩm có khối lượng và kích thước (cột mới `Product.weightGram`, `lengthCm`, `widthCm`, `heightCm`).
2. **Phí ship:** đơn của Kiot giao qua hãng dùng phí hãng báo theo địa chỉ người mua và khối lượng, thay cho phí cố định.
   Người mua thấy trước khi trả. `Order.shippingPaidBy = 'platform'`.
3. Người bán xác nhận đơn rồi bấm "Tạo đơn giao hàng": gọi API hãng, nhận mã vận đơn và nhãn in.
4. Webhook của hãng (kiểm chữ ký) đổi trạng thái: lấy hàng → `shipping`; giao xong → `delivered`; hoàn hàng → `disputed`
   để CEO xử lý (đơn trả trước) hoặc theo V5.5 (đơn COD). Người mua thấy hành trình đơn.
5. Bảng `Shipment` (orderId, carrier, code, fee, status, labelUrl) và sổ chỉ thêm `ShipmentEvent`.
6. Tiền ship hãng thu được trả từ tài khoản 9MUA; phần này **không** cộng cho người bán (`SPEC-payouts.md` V5.1).

### V5.5 Thanh toán khi nhận hàng (COD) (C85) — công tắc `feature.cod`

1. Chỉ có khi: công tắc bật, Kiot bật COD, Kiot giao qua hãng (V5.4). Người mua chọn "Trả khi nhận hàng" cho từng đơn.
2. Giới hạn (CEO chỉnh): tổng đơn COD ≤ 5.000.000đ; tài khoản người mua tạo từ 3 ngày; tối đa 3 đơn COD đang chạy;
   từ chối nhận 2 đơn COD trong 90 ngày thì người đó không dùng COD nữa.
3. **Trạng thái mới** `cod_pending` (chờ người bán xác nhận). Thêm cặp chuyển: `cod_pending → confirmed` (người bán),
   `cod_pending → cancelled` (người mua huỷ, người bán từ chối, hoặc quá 48 giờ). Sau đó `confirmed → shipping → delivered`
   như đơn thường; `delivered` của đơn COD do webhook hãng báo "đã thu tiền".
4. Giỏ nhiều Kiot: đơn COD không vào QR; QR chỉ gồm các đơn trả trước.
5. **Tiền:** hãng thu tiền người mua rồi chuyển về tài khoản 9MUA theo đợt đối soát. Đơn COD chỉ được `completed` khi đã có dòng
   đối soát khớp (`SPEC-payouts.md` V5.1) **và** đủ 7 ngày sau `delivered`.
6. **Người mua từ chối nhận:** hãng báo hoàn → đơn `cancelled`, hoàn tồn kho; phí ship đi và về trừ vào số dư người bán bằng dòng
   `adjustment` (CEO đổi được người chịu phí trong cài đặt).

### Hợp đồng mới của `orders` (chỉ thêm)

```ts
createReview / editReview / replyReview / reportReview / productRatings(productId, filter) / kiotRating(kiotIds)
fileFakeReport / explainFakeReport / decideFakeReport(adminId, id, 'confirmed' | 'rejected', options)
upsertCoupon / validateCoupon(buyerId, kiotId, code, lines) / upsertFlashSale
quoteShipping(kiotId, address, lines) / createShipment(orderId, sellerId) / handleCarrierWebhook(carrier, payload, signature)
placeOrder(userId, input: { ...cũ; coupons?: Record<kiotId, string>; paymentMethod?: Record<kiotId, 'prepaid' | 'cod'> })
```

`CompletedOrder` thêm `discountVnd`, `shippingPaidBy`, `paymentMethod`, `codFeeVnd` để `payouts` tính đúng.

### Kiểm thử V5 (riêng `orders`)

- Đánh giá: không mua thì không đánh giá được; quá 30 ngày bị từ chối; sao Kiot ẩn khi dưới 3 đánh giá; chủ Kiot không xoá được.
- Tố cáo: xác nhận hàng giả với đơn đã `completed` tạo đúng 1 dòng `adjustment` âm bằng số đã cộng; bấm 2 lần không tạo 2 dòng;
  công tắc hoàn tiền tắt thì không chuyển trạng thái tiền.
- Mã giảm giá: 2 người dùng lượt cuối cùng lúc, 1 người được; đơn huỷ trả lượt; phí sàn tính trên tiền sau giảm.
- Giảm giá theo giờ: hết suất giữa lúc thanh toán thì đơn dùng giá thường và báo người mua trước khi trả.
- Giao hàng: webhook sai chữ ký bị từ chối; webhook gửi trùng không đổi trạng thái 2 lần.
- COD: giỏ có cả đơn COD và đơn trả trước thì QR chỉ gồm đơn trả trước; đơn COD không `completed` khi chưa đối soát; từ chối nhận
  thì hoàn tồn kho và trừ phí đúng.
