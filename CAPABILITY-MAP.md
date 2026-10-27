# Capability Map: 9mua.com MVP — Kiot + Chợ + Thu hộ + Creator video

Mục tiêu MVP: người bán trả 26.000đ qua PayOS để kích hoạt Kiot 1 năm và có trang `tenkiot.9mua.com`.
Người mua đặt hàng và **trả tiền cho 9mua qua PayOS**, sau đó 9mua trả lại cho người bán. Sản phẩm hiện
trên Chợ chung. Creator đăng video dọc 9:16 có gắn sản phẩm. CEO quản trị tất cả.

| Module id | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `identity` | Đăng ký / đăng nhập (SĐT hoặc email + mật khẩu), phiên đăng nhập, vai trò `buyer` / `seller` / `creator` / `admin` | — |
| `kiot` | Tạo Kiot (tên, slug `tenkiot`), thông tin liên hệ, TK ngân hàng nhận tiền của người bán; CRUD sản phẩm + ảnh + tồn kho; trang Kiot công khai `tenkiot.9mua.com` | `identity` |
| `payments` | Lớp tích hợp PayOS dùng chung: tạo link/QR thanh toán, xác thực chữ ký webhook, ghi sổ giao dịch (idempotent) | — |
| `billing` | Phí thuê Kiot 26.000đ/năm: thanh toán qua `payments`, kích hoạt / gia hạn / hết hạn Kiot | `identity`, `kiot`, `payments` |
| `orders` | Giỏ hàng (mỗi đơn thuộc một Kiot), thanh toán qua `payments`, trạng thái đơn (chờ trả → đã trả → đang giao → hoàn tất / huỷ / hoàn tiền), người bán xác nhận và giao hàng | `identity`, `kiot`, `payments` |
| `payouts` | Sổ số dư người bán: cộng khi đơn hoàn tất, trừ phí sàn; người bán yêu cầu rút; CEO duyệt và đánh dấu đã chuyển khoản | `orders` |
| `marketplace` | Chợ chung tại `9mua.com/cho`: liệt kê sản phẩm của Kiot đang hoạt động, tìm kiếm, lọc danh mục, thêm vào giỏ | `kiot`, `billing` |
| `creator` | Creator đăng video dọc ≤60s, feed 9:16 cuộn dọc, thích / lượt xem, gắn sản phẩm Kiot vào video → bấm mua | `identity`, `kiot` |
| `admin` | Trang CEO: người dùng, Kiot, đơn hàng, giao dịch, duyệt rút tiền, doanh thu, khoá Kiot, gỡ sản phẩm/video vi phạm | tất cả ở trên |
| `live` | Mọi tài khoản phát live từ trình duyệt điện thoại (MediaMTX trên VPS), người xem vuốt dọc, chat, thả tim, mua sản phẩm đang ghim (`SPEC-live.md`) | `identity`, `kiot`, `billing`, `orders` |
| `xu` | Sổ xu thưởng chỉ thêm: 9MUA tự thưởng người phát theo số người xem live hợp lệ; CEO chỉnh luật và thu hồi (`SPEC-live.md`) | `identity`, `kiot`, `live` |
| `social` | Follow, bình luận, lưu, hashtag, tab Đang Follow, tim Kiot, giới hạn tài khoản Free, voucher mở Kiot (`SPEC-social.md`) | `identity`, `kiot`, `billing`, `creator` |
| `ai` | AI Studio cho chủ Kiot: viết mô tả, vẽ ảnh, ghép video, đăng bán (`SPEC-ai.md`) | `identity`, `kiot`, `creator` |

Thứ tự xây:
`identity` → `kiot` → `payments` → `billing` → `orders` → `payouts` → `marketplace`, `creator` (song song) → `admin`

(`payments` không phụ thuộc gì nên có thể làm song song với `identity` / `kiot`.)

## Giả định (sửa ngay nếu sai)

1. **9mua thu hộ:** tiền đơn hàng vào TK MB 979393916 của 9MUA CO.,LTD qua PayOS. Khi đơn hoàn tất,
   tiền được cộng vào số dư của người bán, sau đó 9mua chuyển khoản trả người bán theo yêu cầu rút
   tiền. **MVP: CEO chuyển khoản tay rồi bấm "đã trả"**, chưa chi tự động.
2. Kiot chỉ hiện công khai và nhận đơn khi đã đóng phí 26k và còn hạn.
3. Giao hàng: người bán tự giao và tự cập nhật trạng thái. Chưa tích hợp GHN/GHTK.
4. VPS Ubuntu có sẵn Nginx + Node.js. Sẽ cài thêm **PostgreSQL**. Ảnh và video lưu trên ổ đĩa VPS,
   do Nginx phục vụ. Cần **chứng chỉ wildcard `*.9mua.com`** (Let's Encrypt, DNS challenge).
5. Video MVP: tải lên ≤60 giây, ≤100MB, chuyển mã về MP4 H.264 720p bằng ffmpeg (xem `SPEC-creator.md`). Livestream xem `SPEC-live.md` (CEO yêu cầu làm ngay, 27/10/2026).
6. Giao diện tiếng Việt, ưu tiên điện thoại, màu và logo theo `docs/BRAND.md`.
7. **Ngoài phạm vi MVP:** quà tặng / tiền thưởng creator, affiliate, đấu trường, AI mua/bán, tự đăng
   12 nền tảng, Quỹ AI, Visa ảo, blockchain, MISA, chi trả tự động. (Đa ngôn ngữ: CEO yêu cầu làm ngay, 27/10/2026, xem `docs/v4-merge-plan.md` §7.)
8. **Phí sàn mặc định 5% mỗi đơn**, CEO chỉnh được trong trang admin (áp dụng cho đơn mới).
9. **Tiền đơn được cộng vào số dư khả dụng sau 7 ngày** kể từ lúc đơn hoàn tất, nếu không có khiếu nại
   hay hoàn tiền. Sau đó người bán mới được rút.
10. **Mọi tài khoản đã đăng ký đều đăng được video Creator.** CEO gỡ được video vi phạm.
11. GitHub làm sau. Đến lúc đó code chỉ nằm trong container, nên cần đẩy lên repo trước khi container bị thu hồi.
