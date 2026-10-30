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

## Quyết định đã chốt

1. Bắt buộc xác thực 2 lớp (TOTP) cho admin. Dùng thư viện `otplib`.
2. MVP chỉ có một cấp admin toàn quyền.

## Bổ sung 27/10/2026 — Nhớ thiết bị, công cụ CEO (CEO duyệt qua chat, câu 2 "làm luôn", câu 6 "a")

### Nhớ thiết bị 30 ngày cho xác thực 2 lớp
- Nhập mã 2 lớp đúng thì có ô "Nhớ thiết bị này 30 ngày" (đánh dấu sẵn). Thiết bị đã nhớ không phải nhập mã lại trong
  30 ngày; vẫn phải đăng nhập mật khẩu khi phiên admin hết hạn.
- Cookie riêng `nm_admin_device` (httpOnly, Secure, SameSite=Strict, chỉ tên miền chính), DB chỉ lưu mã băm.
- Đổi mật khẩu, "Đăng xuất khỏi mọi thiết bị" hoặc nút "Quên mọi thiết bị đã nhớ" trong `/admin` thì mọi thiết bị
  phải nhập mã lại. Danh sách thiết bị đã nhớ (trình duyệt, ngày nhớ, lần dùng cuối) xem được trong `/admin`.
- Đây không phải tắt xác thực 2 lớp: thiết bị chỉ được nhớ sau khi đã nhập đúng mã.
- Dữ liệu: bảng mới `AdminTrustedDevice`: id, userId, tokenHash, userAgent, createdAt, expiresAt, lastUsedAt, revokedAt.

### Công cụ CEO (giai đoạn C)
- **Ghim**: ghim tối đa 5 video lên đầu tab "Dành cho bạn" và tối đa 5 Kiot lên đầu danh bạ Kiot / "Kiot nổi bật",
  có ngày hết ghim (tuỳ chọn). Video/Kiot ghim có nhãn "📌 GHIM".
- **Slogan**: sửa 6 câu slogan theo từng thứ tiếng (để trống thì dùng câu mặc định của từ điển).
- **Thông tin pháp lý**: tên công ty, MST, địa chỉ showroom, văn phòng, hotline, email. Hiện ở chân trang và trang
  Giới thiệu & Pháp lý.
- **Luật Free và voucher** (`SPEC-social.md`): giới hạn tim/follow mỗi ngày, mốc tim tặng voucher, công tắc voucher,
  thu hồi voucher chưa dùng.
- **AI Studio** (`SPEC-ai.md`): công tắc bật/tắt, ngân sách tháng, số lần mỗi người mỗi ngày.
- **Live và xu** (`SPEC-live.md`): buổi đang live, dừng live, cấm live, luật thưởng xu, thu hồi xu.
- Mọi thay đổi ghi audit log có trước/sau.

## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: CEO duyệt qua chat 30/10/2026 ("duyệt làm đi").** Quyết định, công tắc, dịch vụ ngoài, dữ liệu: `docs/nang-cap-mot-dot.md`. Hình: M12, M14.
> Mọi thao tác mới của CEO ghi đúng 1 dòng nhật ký CEO có trước/sau, như hiện nay.

### V5.0 Trang công tắc `/admin/cong-tac`

- Liệt kê mọi công tắc ở `docs/nang-cap-mot-dot.md` mục 3: tên dễ hiểu, mã C.., đang bật hay tắt, lý do tắt sẵn.
- Công tắc cần khoá dịch vụ mà chưa có khoá thì không bật được, ghi "Chưa có khoá: <tên biến>".
- Bật công tắc đụng tiền phải nhập mã xác thực 2 lớp (TOTP đang có).

### V5.1 AI kiểm duyệt (C19, M12) — công tắc `feature.ai_moderation`, **viết sẵn, tắt**

1. Dùng lại driver Claude của AI Studio (cùng `ANTHROPIC_API_KEY`), ngân sách riêng `moderation.monthly_budget_vnd`.
   Driver `fake` cho dev/test.
2. Khi bật, quét **trước khi hiện công khai**:
   - Video: chú thích, chữ trên video, và ảnh cắt từ video (1 ảnh mỗi 5 giây, tối đa 24 ảnh).
   - Ảnh: ảnh sản phẩm, ảnh đại diện, ảnh bìa, ảnh bài viết, ảnh đánh giá.
   - Chữ: tên và mô tả sản phẩm, giới thiệu, chữ bài viết, tên nhóm, tên sự kiện.
   - **Không** gửi bình luận và tin nhắn cho AI (tốn phí); hai loại này dùng từ cấm và báo cáo như hiện nay.
3. Kết quả:
   - `ok`: hiện công khai.
   - `flag` (kèm loại vi phạm và độ chắc): giữ ở trạng thái chờ, vào hàng "AI gắn cờ" cho CEO bấm "Cho đăng" hoặc "Gỡ + ghi lý do".
   - AI **không tự gỡ** nội dung nào.
   - Lỗi, quá thời gian, hoặc hết ngân sách: vẫn hiện công khai, ghi "chưa quét" để CEO lọc xem sau. Không chặn người dùng vì AI lỗi.
4. Chỉ gửi nội dung cần quét; không gửi email, SĐT, địa chỉ.
5. Bảng `ModerationCheck` (targetType, targetId, status `ok | flag | skipped`, categories, confidence, model, costVnd,
   decidedBy, decidedAt).

### V5.2 Lý do báo cáo mới (C20)

- Thêm 4 lý do cho **mọi** nút Báo cáo (video, bài viết, bình luận, live, sản phẩm, đánh giá, tin nhắn, nhóm, sự kiện):
  Vi phạm pháp luật; Đạo đức, nhục mạ, xâm phạm hình ảnh cá nhân; Chống phá Nhà nước; Giả mạo, lừa dối.
- Lý do cũ giữ nguyên. Đủ 7 thứ tiếng.

### V5.3 Xử lý vi phạm 3 lần (C21, M12) — công tắc `feature.strikes`

1. **Giữ luật "5 người báo cáo thì tự ẩn".** Vi phạm do **CEO bấm ghi**, hệ thống không tự ghi.
2. Sổ chỉ thêm `Strike` (userId, kiotId, reason, sourceType, sourceId, level, createdBy, createdAt, kind `strike | revoke`).
   Đếm vi phạm còn hiệu lực trong 365 ngày.
3. Mức:
   - **Lần 1:** cảnh báo (thông báo và email kèm lý do).
   - **Lần 2:** khoá Kiot vĩnh viễn (dùng trạng thái khoá đang có): sản phẩm ẩn; đơn đang chạy vẫn đi tiếp; số dư vẫn rút được
     sau khi đơn xong. Không xoá dữ liệu vì sổ tiền chỉ thêm.
   - **Lần 3:** khoá tài khoản vĩnh viễn, kèm ô "Đã báo cơ quan chức năng" (CEO tự làm ngoài hệ thống, ghi ngày và ghi chú).
4. Màn ghi vi phạm gợi ý mức tiếp theo. CEO huỷ vi phạm ghi nhầm bằng dòng `revoke` kèm lý do.
5. Người dùng xem vi phạm của mình ở Cài đặt → "Vi phạm".

### V5.4 Nội dung trang (C22, C37, C39, C40, C41) — công tắc `feature.site_more`

CEO sửa trong `/admin/noi-dung` (trang "Slogan & pháp lý" đang có). Chữ tiếng Việt là bản chính; 6 thứ tiếng còn lại dịch sẵn
lúc làm và CEO sửa được.

- **Trang Kiểm duyệt `/kiem-duyet` (C22):** giải thích cách 9MUA duyệt: AI quét (khi bật), 5 báo cáo thì ẩn, xử lý 3 lần,
  cách khiếu nại khi bị gỡ nhầm.
- **Nhãn "CỔNG THẾ GIỚI ĐÃ MỞ" (C37):** cạnh logo trên header máy tính; nhấp nháy cùng nhịp logo (2,8 giây); tắt hiệu ứng khi
  người dùng bật "giảm chuyển động". Điện thoại không hiện (header không đủ chỗ). CEO sửa chữ hoặc tắt.
- **Trang Hướng dẫn `/huong-dan` (C39):** 8 bước, mỗi bước 1 câu và nút tới đúng trang: mở tài khoản, xem video, thả tim và
  follow, bình luận và chia sẻ, đăng video, mở Kiot, phát live, tìm kiếm.
- **Slogan trang mới (C40):** thêm khoá slogan cho Watch, Tìm kiếm, Cam kết, Nguồn gốc, Kiểm duyệt, Hướng dẫn, Vui chơi,
  Sự kiện, Nhóm, Đăng video.
- **Pháp lý (C41):** thêm dòng tài khoản nhận tiền "MBBank 979393916 – 9MUA CO.,LTD" và ảnh con dấu do CEO tải lên (ảnh scan
  thật; không vẽ con dấu bằng code).

### V5.5 Kanban (C43) — công tắc `feature.ceo_finance`

- `/admin/kanban`: 3 cột Cần làm, Đang làm, Xong. Thẻ: tiêu đề, ghi chú, hạn, người phụ trách (tài khoản admin), nhãn màu.
- Kéo thả giữa các cột và trong cột. Chỉ admin. Bảng `KanbanCard` (column, position, title, note, dueAt, assigneeId, color).

### V5.6 Chi phí và trả tự động (C44, C45, M14)

1. **Chi phí** (`/admin/chi-phi`, công tắc `feature.ceo_finance`):
   - Khoản chi: tên, nhà cung cấp, số tiền (VNĐ, hoặc USD quy đổi theo tỷ giá Vietcombank đang lưu cho phí Kiot), chu kỳ
     (tháng / năm / một lần), ngày đến hạn, cách trả (thẻ tự trừ / chuyển khoản / trả tay), người nhận (khi chuyển khoản).
   - Trạng thái kỳ hiện tại: **Đã trả** (xanh), **Sắp hạn** trong 7 ngày (vàng), **Quá hạn** (đỏ).
   - Dự toán tháng này, năm nay; dự toán dung lượng = GB đang dùng (`/admin/dung-luong`) × đơn giá GB CEO nhập.
   - Biểu đồ 12 tháng doanh thu và chi phí (dùng `LineChart` đang có).
   - Cảnh báo khi số dư (từ V5.7, hoặc số CEO nhập tay) thấp hơn tổng chi 30 ngày tới.
   - Sổ chỉ thêm `ExpensePayment` (expenseId, period, amount, method, ref, status, createdAt).
2. **Trả tự động** (công tắc `feature.expense_autopay`, **tắt sẵn**):
   - Chỉ cho khoản chi "chuyển khoản" tới **người nhận đã duyệt** (`ExpensePayee`: tên, ngân hàng, STK, tên chủ tài khoản).
     Thêm người nhận phải nhập mã 2 lớp và chỉ dùng được sau **24 giờ**.
   - 08:00 (giờ Việt Nam) ngày đến hạn: nếu khoản ≤ `autopay.max_per_payment` (mặc định 5.000.000đ), tổng tháng ≤
     `autopay.monthly_cap` (mặc định 20.000.000đ) và quỹ chi hộ đủ tiền, thì tạo lệnh chi qua **PayOS chi hộ** (qua `payments`,
     nơi duy nhất nói chuyện với PayOS).
   - Ghi `ExpensePayment` trạng thái `processing` → `paid` / `failed`. Mỗi lần trả và mỗi lần lỗi đều báo CEO. Lỗi thì chuyển về
     trả tay.
   - Khoản trả bằng thẻ: không chuyển tiền; tới hạn thì hiện "Thẻ tự trừ — chờ xác nhận", CEO bấm "Đã trừ".
   - Nút "Tạo QR trả" (VietQR tới người nhận, CEO tự trả) và "QR nạp quỹ chi hộ" (VietQR tới tài khoản quỹ chi hộ PayOS).

### V5.7 Số dư và biến động tài khoản qua Casso (C46) — công tắc `feature.bank_feed`, chờ khoá

- "CAS" trong bản V4.7 là dịch vụ đọc biến động tài khoản ngân hàng; Claude đề xuất **Casso**, cùng công ty làm PayOS mà 9MUA
  đang dùng. Driver `bankfeed` (driver `casso` và `fake`). Nhận biến động qua webhook `/api/bankfeed/webhook` (kiểm khoá bí mật
  `CASSO_WEBHOOK_SECRET`) và kéo lại mỗi 15 phút để không sót (tài khoản MBBank doanh nghiệp đồng bộ tối đa 1 lần mỗi 15 phút;
  webhook lỗi nhiều lần có thể bị Casso tắt).
- Sổ chỉ thêm `BankTransaction` (providerTxnId duy nhất, amount, direction, balanceAfter, description, occurredAt).
- Hiện số dư mới nhất, 20 biến động gần nhất, trạng thái kết nối (xanh/đỏ).
- **Chỉ để xem.** Không dùng biến động ngân hàng để đánh dấu đơn đã trả (việc đó vẫn do PayOS).

### V5.8 Tài chính (C47, M14) — công tắc `feature.ceo_finance`

- `/admin/tai-chinh`, theo tháng:
  - Doanh thu 9MUA = phí sàn + phí thuê Kiot (đang có trong Tổng quan).
  - Chi phí = khoản chi đã trả + chi phí AI (AI Studio, kiểm duyệt, phụ đề) + phí ship hãng 9MUA trả + tiền thưởng đã trả.
  - Lợi nhuận = doanh thu − chi phí. Dự báo tháng tới = trung bình 3 tháng gần nhất, ghi rõ "ước tính".
  - Tiền đang giữ hộ (trang đang có).
- Nút "Xuất số liệu cho MISA": file Excel/CSV chứng từ thu, chi theo tháng. Cột chốt với kế toán trước khi làm; chưa chốt thì
  dùng mẫu: ngày, số chứng từ, diễn giải, số tiền, loại (thu/chi), đối tượng. Không kết nối thẳng MISA.

### Kiểm thử V5 (riêng `admin`)

- AI kiểm duyệt: `flag` giữ nội dung chờ; lỗi hoặc hết ngân sách thì vẫn đăng và ghi `skipped`; AI không tự gỡ.
- Vi phạm: lần 2 khoá Kiot mà đơn đang chạy vẫn đi tiếp; `revoke` làm giảm đếm; ngoài 365 ngày không tính.
- Trả tự động: người nhận mới chưa đủ 24 giờ thì không trả; vượt mức trần hoặc ngân sách tháng thì không trả; chạy việc 2 lần
  không trả 2 lần; quỹ không đủ thì không trả và báo CEO.
- `BankTransaction` trùng mã không ghi 2 lần; webhook sai khoá bị từ chối.
- Mọi thao tác mới ghi đúng 1 dòng nhật ký CEO.
