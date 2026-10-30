# Spec: `play` — Vui chơi có thưởng

> Module mới trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `social`, `payouts` (ví thu nhập).
> Nền móng chung theo `SPEC-identity.md`. Giao diện chuẩn V4 (`docs/BRAND.md`), đủ 7 thứ tiếng (`SPEC-i18n.md`).
> **Trạng thái: CEO duyệt qua chat 30/10/2026 ("duyệt làm đi").** CEO chốt 30/10/2026 "làm luôn", **tắt sẵn** (`feature.play`). Mã C30.
> Quyết định chung: `docs/nang-cap-mot-dot.md`.

## Objective

Trang `/vui-choi` có 2 trò miễn phí: **Quay số** và **Bắn tim**, cùng **bảng xếp hạng tuần**. Giải thưởng lấy từ ngân sách 9MUA
do CEO đặt. Người chơi **không nạp tiền** để chơi. Tiền thưởng vào ví thu nhập (`SPEC-payouts.md` V5.2) và rút về ngân hàng
sau khi CEO duyệt.

### Tiêu chí chấp nhận

1. **Ai được chơi có thưởng tiền:** tài khoản tạo từ **7 ngày**, đã cam kết nội dung (`SPEC-identity.md` V5.6), không có vi phạm
   còn hiệu lực (`SPEC-admin.md` V5.3), không bị khoá. Người khác vẫn chơi được nhưng không nhận giải tiền.
2. **Quay số:**
   - Mỗi ngày (giờ Việt Nam) 1 lượt miễn phí. Thêm lượt: video đăng trong ngày đạt 100 lượt xem (+1), buổi live được thưởng xu (+1),
     có đơn mua hoàn tất trong ngày (+1). Tối đa 3 lượt mỗi ngày.
   - Bảng giải do CEO đặt: tiền (1.000đ–1.000.000đ), xu, voucher mở Kiot, "Chúc may mắn"; mỗi giải một xác suất, tổng 100%.
   - **Máy chủ chọn kết quả** (số ngẫu nhiên an toàn) và ghi lại trước khi trình duyệt chạy hoạt cảnh vòng quay.
3. **Bắn tim:**
   - Mỗi lượt 30 giây, chạm vào trái tim bay để ghi điểm; tối đa 10 lượt mỗi ngày.
   - Máy chủ phát "hạt giống" cho mỗi lượt để quyết định tim bay ở đâu, lúc nào. Trình duyệt gửi danh sách lần chạm kèm thời điểm;
     máy chủ chấm lại. Điểm vượt mức có thể đạt hoặc chạm quá nhanh thì loại lượt đó.
   - Lượt chưa gửi kết quả trong 2 phút thì hết hạn.
4. **Bảng xếp hạng tuần** (Thứ Hai 00:00 → Chủ Nhật 23:59 giờ Việt Nam): điểm Bắn tim cao nhất mỗi người. Hiện tuần này và tuần trước.
   - Chốt tuần lúc 00:05 Thứ Hai: top 10 nhận giải theo bảng CEO đặt. Chốt chạy lại không trả 2 lần.
   - Chống tài khoản ảo: mỗi IP công khai tối đa 3 tài khoản được xếp hạng mỗi tuần (giống cách tính người xem live hợp lệ).
5. **Ngân sách:** `play.monthly_budget_vnd` (mặc định **0**). Trả tiền thưởng chỉ khi còn ngân sách:
   - Hết ngân sách thì giải tiền bị bỏ khỏi vòng quay, phần xác suất đó dồn vào "Chúc may mắn".
   - Giải xếp hạng tuần chỉ trả phần còn ngân sách, theo thứ hạng từ trên xuống; người không được trả nhận thông báo.
6. **Trả thưởng:** giải tiền ghi `EarningEntry(type = 'prize', refId = lượt hoặc tuần)` vào ví thu nhập. Xu ghi `XuEntry`
   (xu không đổi ra tiền, như hiện nay). Voucher dùng luật voucher đang có.
7. **Trang CEO `/admin/vui-choi`:** bật/tắt từng trò, bảng giải và xác suất (phải đủ 100%), ngân sách tháng, đã trả trong tháng,
   top tuần, khoá người gian lận. Khoá thì thu hồi tiền thưởng chưa rút bằng dòng bù. Mọi thao tác ghi nhật ký CEO.

### Hợp đồng (`src/modules/play/index.ts`)

```ts
turnsLeft(userId, game): Promise<number>
spin(userId): Promise<{ ok: true; prize: PrizeView; turnId } | { ok: false; error: 'NO_TURNS' | 'NOT_ELIGIBLE' | 'OFF' }>
startHeartRun(userId): Promise<{ runId; seed; endsAt }>
submitHeartRun(userId, runId, taps: { at: number; x: number; y: number }[]): Promise<{ ok: true; score } | { ok: false; error: 'EXPIRED' | 'INVALID' }>
leaderboard(week): Promise<LeaderRow[]>
settleWeek(week): Promise<void>        // idempotent
```

### Dữ liệu

- `PlayGame`: code (`spin | hearts`), active, rules (JSON: bảng giải, xác suất, giải xếp hạng).
- `PlayTurn`: id, userId, game, vnDay, seed, result (JSON), score, prizeVnd, status (`open | done | expired | rejected`), createdAt.
- `LeaderboardWeek`: week, userId, score, rank, prizeVnd, paidAt. Khoá duy nhất (week, userId).
- Tiền thưởng dùng `EarningEntry` của `payouts`; không có sổ tiền riêng trong `play`.

## Testing Strategy

- **Unit:** chọn giải theo xác suất với hạt giống cố định khớp phân bố; bảng giải không đủ 100% bị từ chối; chấm lại điểm Bắn tim
  từ danh sách chạm; điểm không thể đạt bị loại.
- **Integration:** hết lượt thì từ chối; tài khoản 6 ngày tuổi không nhận giải tiền; hết ngân sách thì không có giải tiền; chốt tuần
  chạy 2 lần song song chỉ trả 1 lần; 4 tài khoản cùng IP thì chỉ 3 được xếp hạng.
- **E2E (điện thoại + máy tính):** quay số nhận giải; chơi Bắn tim, thấy tên trên bảng xếp hạng.

## Boundaries

- **Luôn làm:** máy chủ quyết định kết quả; ghi mọi lượt; kiểm tra ngân sách trong transaction trả thưởng.
- **Hỏi trước:** thêm trò mới; giải hiện vật; tăng tối đa lượt mỗi ngày.
- **Không bao giờ:** cho nạp tiền hay trả phí để chơi; đổi xu ra tiền; trả thưởng vượt ngân sách; để trình duyệt tự báo điểm mà
  không chấm lại.
