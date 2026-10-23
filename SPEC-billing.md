# Spec: `billing` — Phí thuê Kiot 25.000đ/năm

> Module 4 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `kiot`, `payments`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Chủ Kiot trả phí thuê Kiot qua QR PayOS, mặc định 25.000đ cho 1 năm. Trả xong thì Kiot tự mở công khai
ngay, không cần CEO duyệt. Gia hạn lúc nào cũng được, thời gian được cộng dồn. Hệ thống nhắc trước khi
hết hạn để không mất khách.

### Tiêu chí chấp nhận

1. **Kích hoạt / Gia hạn**: ở `/kiot-cua-toi` có nút "Kích hoạt Kiot – 25.000đ/năm" (Kiot `draft`) hoặc
   "Gia hạn thêm 1 năm" (Kiot `active` / `expired`).
   - Bấm nút thì gọi `payments.createPayment({ purpose: 'kiot_fee', refId: kiotId, amount: phí hiện hành,
     description: 'KIOT' + mã ngắn })` và chuyển sang trang `/kiot-cua-toi/thanh-toan/<intentId>`.
   - Trang thanh toán hiện QR to, số tiền, nội dung chuyển khoản, đồng hồ đếm ngược 15 phút và nút
     "Mở app ngân hàng" (`checkoutUrl`). Trang **tự kiểm tra mỗi 3 giây**, khi đã trả thì hiện "Kiot đã
     hoạt động đến dd/mm/yyyy" kèm nút xem Kiot.
   - Kiot bị `locked` thì không có nút thanh toán, và server cũng từ chối tạo thanh toán.
2. **Khi tiền vào**: handler `onPaid(tx, intent)` đăng ký với `payments` chạy trong cùng transaction:
   - Tính `periodStart = max(now, activeUntil hiện tại)`, `periodEnd = periodStart + 1 năm`.
     Gia hạn sớm vẫn giữ đủ ngày còn lại.
   - Ghi một dòng `KiotSubscription`, rồi gọi `kiot.extendActiveUntil(kiotId, periodEnd)`.
   - Sau khi transaction commit, gửi email biên nhận: số tiền, kỳ hạn, mã giao dịch.
3. **Giá phí**: lưu trong bảng `Setting` (`kiot_fee_vnd`, mặc định `25000`). CEO đổi trong trang admin.
   Giá mới chỉ áp dụng cho thanh toán **tạo sau khi đổi**. QR đang chờ vẫn giữ giá cũ và vẫn được ghi
   nhận đúng.
4. **Tặng năm miễn phí**: `grantYear(kiotId, adminId, reason)` để CEO tặng hoặc khuyến mãi. Ghi
   `KiotSubscription` với `source = 'admin_grant'`, lưu người cấp và lý do.
5. **Nhắc hết hạn**: `GET /api/internal/billing/reminders` (chỉ gọi được từ localhost, cron trên host chạy
   lúc 8:00 mỗi ngày) gửi email cho Kiot sắp hết hạn trong **14 ngày**, **3 ngày**, và **đúng ngày hết
   hạn**.
   - Mỗi mốc chỉ gửi 1 lần, có ghi lại để chạy lại cron cũng không gửi trùng.
   - Chủ Kiot không có email thì bỏ qua email, nhưng `/kiot-cua-toi` vẫn hiện banner nhắc.
6. **Lịch sử**: `/kiot-cua-toi/thanh-toan` liệt kê các lần trả: ngày, số tiền, kỳ hạn, nguồn
   (PayOS / tặng).
7. **Hết hạn**: không cần làm gì thêm. `kiot.isKiotActive` tự tính từ `activeUntil`, nên trang Kiot tự
   chuyển sang "Kiot tạm ngưng". Dữ liệu và sản phẩm **giữ nguyên**, gia hạn là mở lại ngay.
   (Đơn hàng đang xử lý khi Kiot hết hạn sẽ được quy định trong `SPEC-orders.md`.)

### Hợp đồng (`src/modules/billing/index.ts`)

```ts
startKiotPayment(kiotId: string, userId: string): Promise<{ ok: true; intentId: string } | { ok: false; error: 'NOT_OWNER' | 'KIOT_LOCKED' }>
getKiotBilling(kiotId: string): Promise<{ activeUntil: Date | null; history: KiotSubscriptionView[] }>
grantYear(kiotId: string, adminId: string, reason: string): Promise<void>
getKiotFee(): Promise<number>
setKiotFee(amount: number, adminId: string): Promise<void>         // ≥ 2.000, ghi log người đổi
listExpiringKiots(withinDays: number): Promise<KiotExpiringView[]>  // cho admin
revenueSummary(range: { from: Date; to: Date }): Promise<{ count: number; total: number }>  // cho admin
```

### Dữ liệu

- `KiotSubscription`: id, kiotId, source (`payos | admin_grant`), intentId (nullable, unique),
  amount, periodStart, periodEnd, grantedBy (nullable), note, createdAt.
- `Setting`: key, value, updatedBy, updatedAt (bảng dùng chung, các module khác như phí sàn 5% cũng dùng).
- `BillingReminder`: kiotId, milestone (`d14 | d3 | d0`), periodEnd. Khoá duy nhất cả ba cột.

## Testing Strategy (riêng module)

- **Unit:** tính `periodStart/periodEnd`:
  - Kiot mới.
  - Gia hạn khi còn 100 ngày (phải cộng dồn).
  - Gia hạn khi đã hết hạn 30 ngày (tính từ hôm nay).
  - Năm nhuận (29/02 + 1 năm = 28/02).
- **Integration** (driver `fake` của `payments`):
  - Tạo Kiot → thanh toán → webhook giả lập: Kiot `active` đúng 1 năm, có 1 `KiotSubscription`, có gửi email.
  - Webhook gửi trùng không cộng thêm năm.
  - Đổi giá khi đang có QR chờ: QR cũ vẫn kích hoạt được, QR mới dùng giá mới.
  - Kiot `locked` bị từ chối tạo thanh toán. Người không phải chủ Kiot cũng bị từ chối.
  - Cron nhắc chạy 2 lần trong ngày chỉ gửi 1 email mỗi mốc.
- **E2E:** tạo Kiot → bấm Kích hoạt → trang QR → (giả lập đã trả) → trang tự chuyển "Kiot đã hoạt động"
  → mở `slug.localhost:3000` thấy sản phẩm.

## Boundaries (bổ sung)

- **Luôn làm:** tính hạn theo giờ server (UTC), hiển thị ngày theo `Asia/Ho_Chi_Minh`.
- **Hỏi trước:**
  - Gói nhiều năm hoặc giảm giá.
  - Dùng thử miễn phí cho mọi Kiot mới.
  - Hoàn tiền phí thuê.
- **Không bao giờ:**
  - Kích hoạt Kiot dựa trên thông tin trình duyệt gửi lên. Chỉ kích hoạt qua handler của `payments`
    hoặc `grantYear` của admin.
  - Xoá `KiotSubscription`.

## Success Criteria

- [ ] Từ lúc quét QR trả 25.000đ đến khi trang Kiot hiện công khai không quá 15 giây, không cần ai duyệt.
- [ ] Gia hạn khi còn 100 ngày thì hạn mới = hạn cũ + 1 năm.
- [ ] Đổi giá phí trong admin có hiệu lực với QR tạo sau đó, không ảnh hưởng QR đang chờ.
- [ ] Chủ Kiot nhận email nhắc ở mốc 14 ngày, 3 ngày và ngày hết hạn, mỗi mốc đúng 1 lần.
- [ ] Doanh thu phí thuê trong admin khớp tổng `PaymentEvent` của `purpose = kiot_fee`.

## Open Questions

Không có. Mọi quyết định đều theo những gì đã chốt. Các mục "Hỏi trước" ở trên đều nằm ngoài MVP.
