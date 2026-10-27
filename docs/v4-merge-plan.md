# Phân tích 9MUA V4 và kế hoạch đưa vào 9mua.com

Ngày: 27/10/2026. Người phân tích: Claude. Nguồn: thư mục `9mua v4/` (commit `7f3a04a`, 31 file mã), so với
9mua.com đang chạy (nhánh `main`).

## 1. Kết luận ngắn

**V4 là bản demo giao diện, không phải phần mềm chạy thật.** Mọi dữ liệu là mẫu cố định trong `lib/data.ts`,
mọi thao tác (đăng ký, mua Kiot, nạp/rút ví, đặt hàng, duyệt rút tiền) chỉ lưu trên trình duyệt của người
xem (`localStorage`). Không có máy chủ, không đăng nhập thật, không thu tiền thật, số liệu mạng xã hội và AI
là số giả sinh ra từ tên tài khoản.

Vì vậy **không gộp thẳng code V4 vào 9mua.com được**: làm vậy sẽ thay đăng nhập thật, thanh toán PayOS, sổ tiền
chỉ-thêm và kiểm duyệt bằng logic giả. Cách đúng: dùng V4 làm **bản mẫu giao diện + danh sách ý tưởng**, rồi làm
lại từng phần trên nền hiện tại, theo quy trình spec → kế hoạch → code có test → review.

Khoảng **một nửa ý tưởng của V4 làm được ngay và an toàn** (giao diện, thanh điều hướng dưới, trang Kiot kiểu
TikTok, thả tim 2 chạm, chia sẻ có QR, trang Tôi, trang Pháp lý). **Một phần cần thêm bảng dữ liệu mới**
(follow Kiot, bình luận video, lưu, ghim). **Một số điểm mâu thuẫn với quy tắc tiền/pháp lý/thương hiệu đã duyệt**,
cần CEO quyết trước (mục 3).

## 2. So sánh từng trang

Mức: **A** = làm ngay (chỉ giao diện) · **B** = cần bảng dữ liệu mới, không đụng tiền · **C** = công cụ CEO ·
**Sau** = để giai đoạn sau · **Không** = không nên làm.

| V4 | 9mua.com hiện có | Đề xuất | Mức |
|---|---|---|---|
| Thanh dưới 5 nút (Home, Explore, +Live, Value, Tôi) | Thanh trên: Chợ, Video, Bán hàng, Đăng nhập | Thêm thanh dưới trên điện thoại: **Trang chủ · Chợ · ＋ Đăng video · Video · Tôi**; máy tính giữ thanh trên | A |
| Header: logo tròn, slogan, ô tìm, ngôn ngữ, giỏ | Logo + chữ 9MUA, menu | Header gọn: logo, ô tìm kiếm (mở Chợ), giỏ hàng có số lượng | A |
| Logo trong vòng tròn trắng viền cam, phát sáng nhấp nháy, bỏ chữ 9MUA | `docs/BRAND.md` cấm hiệu ứng nhấp nháy, header có chữ 9MUA | Cần CEO quyết (mục 3.1) | A sau khi quyết |
| Nền đen toàn site `#0A0A0A`, cam `#FF6B00`, chữ trắng trên cam | Nền trắng, cam `#FC6F15`, chữ đen trên cam (đạt chuẩn dễ đọc) | Đề xuất: **nền đen cho Video/Live/feed**, nền trắng cho trang mua bán (sản phẩm, giỏ, thanh toán) để dễ đọc giá và mô tả | A |
| Trang 01 Home Feed: lướt dọc từng Kiot, 2 tab "Dành cho bạn / Đang follow", thả tim 2 chạm có túi cam bay, thanh tiến độ | `/video`: feed video dọc, thích, chia sẻ, mua từ video | Gộp vào feed video: **thả tim 2 chạm + hiệu ứng túi cam**, thanh tiến độ, tab "Đang follow" (cần B1) | A + B |
| Trang 02 Khám phá Kiot: lưới Kiot, lọc ngành/vị trí/#hashtag | `/cho` (lọc danh mục, tỉnh, giá, tìm không dấu) + `/cho/kiot` danh bạ Kiot | Thêm lọc theo tỉnh và ngành vào danh bạ Kiot; thẻ Kiot kiểu lưới ảnh dọc | A |
| Trang 03 Live & Story: live giả, chat tự chạy, ghim sản phẩm, Story 24h | Chưa có | **Live thật cần hạ tầng phát trực tiếp riêng** (Mux… tốn phí theo phút). Trước mắt: Kiot gắn link live TikTok/Facebook + lịch live. Story 24h = video ngắn tự ẩn sau 24h, dùng lại bộ xử lý video | Sau |
| Trang 04 Value Calculator "$951" | Chưa có | **Không làm** (mục 3.3) | Không |
| Trang 05 Giỏ hàng: gom nhiều Kiot, ship gộp 30k + 10k/Kiot, MoMo/VNPay/Stripe/MBBank | Giỏ nhiều Kiot, 1 lần trả qua PayOS, phí ship do từng Kiot đặt | Giữ cách hiện tại; chỉ học **bố cục nhóm theo Kiot** và nút +/− số lượng. Ship gộp là số tự đặt, người bán gửi riêng từng Kiot nên không đúng thực tế | A (giao diện) / Không (ship gộp) |
| Trang 06 Ví: nạp tiền, trả bằng ví, rút tự duyệt, "1 ví 6 nguồn" | Số dư người bán từ đơn hoàn tất, rút qua PayOS chi hộ theo 8 luật, CEO duyệt hàng chờ | **Không làm ví nạp tiền** (mục 3.2). Có thể đổi giao diện trang Số dư của người bán cho giống V4 | Không / A |
| Trang 07 Hồ sơ Kiot kiểu TikTok + Shopee: ảnh bìa, avatar, Followers, Tim, Sản phẩm, Đánh giá, nút Follow/Nhắn/Tim/Chia sẻ, tab Video/Sản phẩm/Live | Trang Kiot: ảnh bìa, logo, tên, tỉnh, nút Gọi/Zalo, lưới sản phẩm | Làm lại trang Kiot theo bố cục V4: **tab Sản phẩm / Video** (video có gắn sản phẩm của Kiot), số sản phẩm, số đã bán, nút Chia sẻ có **mã QR**. Followers + nút Follow cần B1. Không hiện "4.9★" khi chưa có đánh giá thật | A + B |
| Trang 08 Social Connect 6 mạng | Chưa có | Kết nối thật cần xin duyệt ứng dụng với từng mạng (TikTok, Facebook, YouTube…). Trước mắt: Kiot **dán link** trang TikTok/Facebook/Zalo/Shopee để hiện trên trang Kiot | Sau (OAuth) / A (dán link) |
| Trang 09 AI Studio: 4 ảnh + video + đọc 7 thứ tiếng | Chưa có | Bước nhỏ hữu ích nhất: nút **"AI viết mô tả sản phẩm"** khi đăng sản phẩm (cần khoá API, chi phí theo lượt). Tạo ảnh/video AI để sau | Sau |
| Trang 10 Pháp lý: giới thiệu công ty, 2 địa chỉ, STK, con dấu vẽ | Footer có tên công ty, MST, địa chỉ | Làm **trang Giới thiệu & Pháp lý** thật: thông tin công ty, showroom Hamubay + văn phòng 115 Nguyễn Hậu, bản đồ, liên hệ. **Không** hiện con dấu vẽ, **không** hiện STK cá nhân (mục 3.2). Kèm các trang chính sách bắt buộc của sàn TMĐT (mục 3.6) | A |
| Trang Tôi: hồ sơ, Free/Owner, lối tắt | `/tai-khoan` | Làm `/toi` thành trang trung tâm: đơn mua, giỏ, thông báo, Kiot của tôi, video của tôi, tài khoản | A |
| /admin: slogan 10 trang, địa chỉ pháp lý, ghim Kiot lên đầu, ban Kiot, duyệt Owner, bật/tắt AI | Trang CEO đầy đủ: 2 lớp, hàng chờ, khoá, tra cứu, xuất CSV, nhật ký | Thêm: **ghim Kiot/video lên đầu**, **sửa slogan từng trang**, **sửa thông tin pháp lý**, có ghi nhật ký. Khoá Kiot đã có | C |
| Bình luận có trả lời, chủ Kiot ghim | Chưa có | Bình luận video: trả lời 1 cấp, người đăng ghim 1 bình luận, báo cáo/ẩn, giới hạn số lần gửi chống spam | B |
| Follow Kiot, Lưu (bookmark) | Chưa có | Bảng Follow + Lưu, đếm Followers, tab "Đang follow" trong feed, thông báo khi Kiot đăng video mới | B |
| Điểm, voucher "100 tim tặng $1", giới hạn Free 50 tim/ngày | Chưa có | Để sau: thưởng theo số tim dễ bị tạo tài khoản ảo để cày | Sau |
| Đa ngôn ngữ 7 thứ tiếng, đọc slogan tự động | Tiếng Việt | Để sau (dịch toàn site là việc lớn) | Sau |
| Popup "Mở tài khoản miễn phí" tự bật sau 1,2 giây | Không có | Thay bằng **dải nhắc nhỏ không che trang**. Google hạ hạng trang có popup che nội dung trên điện thoại | A (dạng nhẹ) |
| 10 slogan, mỗi trang 1 câu | Chưa có | Hiện slogan ở đầu các trang chính; CEO sửa ở /admin (C) | A + C |

## 3. Điểm mâu thuẫn với quy tắc đã duyệt: CEO cần quyết trước

### 3.1 Thương hiệu (`docs/BRAND.md`, CEO duyệt 23/10)
- Màu cam V4 `#FF6B00` khác màu logo `#FC6F15`. Hai màu gần giống nhau; nên **giữ `#FC6F15`** cho đồng bộ với logo.
- V4 đặt **chữ trắng trên nền cam** ở hầu hết nút. Độ tương phản chỉ 2,8:1, khó đọc ngoài nắng; BRAND.md quy định
  chữ đen trên cam. Đề xuất giữ chữ đen.
- Logo V4: vòng tròn trắng viền cam, **phát sáng nhấp nháy liên tục**, **bỏ chữ 9MUA**. BRAND.md ghi "không thêm
  hiệu ứng nhấp nháy cho logo". Đề xuất: dùng vòng tròn trắng viền cam (đẹp, nổi trên nền đen) nhưng **không
  nhấp nháy**; giữ chữ 9MUA trên máy tính. Nếu CEO chọn theo V4 thì sửa BRAND.md trước.

### 3.2 Tiền (quy tắc: "Tiền là số nguyên VNĐ. Sổ tiền chỉ được thêm…", SPEC-payments, SPEC-payouts)
- **STK MBBank cá nhân `979393916 – NGUYỄN HẢI`** in trên trang, QR mua Kiot, QR đơn hàng. Tiền bán hàng và phí
  Kiot của **9MUA CO.,LTD** phải vào tài khoản công ty qua PayOS (đối soát tự động, đúng thuế). **Không đưa STK cá
  nhân lên web.**
- Nút **"Tôi đã chuyển khoản"** mở khoá Kiot ngay, không chờ tiền về. Hiện tại Kiot chỉ kích hoạt khi PayOS báo
  đã nhận tiền. Giữ cách hiện tại.
- **Ví 9MUA nạp tiền rồi trả bằng ví**: giữ tiền của khách dưới dạng ví điện tử cần **giấy phép trung gian thanh
  toán của Ngân hàng Nhà nước** (Nghị định 52/2024). 9MUA chưa có giấy phép này → **không làm ví nạp tiền**.
  Số dư người bán (từ đơn hoàn tất) và rút tiền đã có, đúng quy trình.
- **Rút tiền "AI tự duyệt 99%, trên $500 CEO duyệt"**: khác quy tắc chi hộ đã duyệt (8 luật tự động + hàng chờ CEO
  + công tắc khẩn cấp). Giữ quy tắc hiện tại; nếu CEO muốn thêm ngưỡng 13.000.000đ thì sửa SPEC-payouts trước.
- **Doanh thu mẫu từ TikTok/Facebook… cộng vào ví khi mua Kiot**: đây là tiền giả, tuyệt đối không đưa lên web thật.

### 3.3 Value Calculator "$951" và "1 ví 6 nguồn"
Trang hứa "tài khoản bạn đáng giá bao nhiêu – 9MUA tính ra tiền", "biến $… thành tiền thật", với con số tự sinh
từ tên tài khoản. Trên web thật, đây là **quảng cáo gây hiểu nhầm về thu nhập** (Luật Bảo vệ quyền lợi người tiêu
dùng 2023, Luật Quảng cáo). Lấy số liệu thật thì phải xin quyền API từng mạng. **Đề xuất không làm.** Nếu muốn
giữ ý tưởng: "Hồ sơ mạng xã hội" chỉ hiển thị link và số người theo dõi thật, không quy ra tiền.

### 3.4 Giá Kiot "$1"
Hiện tại: **26.000đ/năm** (SPEC-billing). V4: "Kiot $1" (= 26.000đ) nhưng không nói theo năm hay mua đứt.
Giá trên web phải ghi bằng VNĐ. Đề xuất hiển thị: **"Kiot 26.000đ/năm (~1 USD)"**, giữ thu theo năm. CEO xác nhận.

### 3.5 Tài khoản Free và Kiot Owner
V4 khoá một số chức năng với tài khoản chưa mua Kiot (giới hạn 50 tim/follow mỗi ngày, không rút tiền, không đăng
live). Hiện tại: ai cũng đăng ký miễn phí, mua hàng, đăng video; chỉ bán hàng mới cần Kiot. Đề xuất giữ như hiện
tại; chỉ thêm giới hạn chống spam (số bình luận/tim mỗi phút) cho mọi người.

### 3.6 Pháp lý sàn TMĐT
- Trang Pháp lý V4 vẽ **con dấu tròn bằng CSS** và ghi "Mã số thuế: đang cập nhật". Không nên vẽ con dấu trên
  web; MST thật đã có ở footer (3401295437).
- Việc quan trọng hơn mà V4 chưa có: 9mua.com là **sàn giao dịch TMĐT** (nhiều người bán) nên phải **đăng ký với
  Bộ Công Thương** (online.gov.vn) và đăng **Quy chế hoạt động sàn**, chính sách bảo mật, đổi trả, giải quyết
  khiếu nại (Nghị định 52/2013, 85/2021). Đề xuất làm các trang này cùng trang Pháp lý.

### 3.7 Triển khai
- `9mua v4/vercel.json` khai báo tên miền **9mua.com, www.9mua.com**. Nếu ai đó chạy `vercel --prod` với cấu hình
  này và trỏ DNS theo hướng dẫn của Vercel, **bản demo sẽ thay web thật**: khách thấy QR chuyển tiền vào STK cá nhân,
  mua Kiot không cần trả tiền. **Không deploy V4 lên 9mua.com.** Muốn xem demo thì chạy trên máy (`npm run dev`)
  hoặc link preview của Vercel.
- `supabase/schema.sql` (10 bảng Supabase): không dùng. 9mua.com đã có database PostgreSQL riêng trên VPS với đăng
  nhập, thanh toán, sổ tiền thật; thêm Supabase là 2 nơi lưu dữ liệu, 2 hệ đăng nhập.

## 4. Kế hoạch đề xuất

Mỗi giai đoạn: cập nhật spec → CEO duyệt → code có test (cả điện thoại và máy tính) → review → deploy bằng
`scripts/deploy.sh`.

### Giai đoạn A: Giao diện (không đụng tiền, không đổi database), khoảng 2–3 ngày
1. Thanh điều hướng dưới 5 nút trên điện thoại + header mới (logo, tìm kiếm, giỏ).
2. Logo tròn viền cam (theo quyết định mục 3.1), cập nhật BRAND.md.
3. Nền đen cho Video/feed; giữ nền trắng cho trang mua bán (hoặc toàn site đen nếu CEO chọn).
4. Feed video: thả tim 2 chạm có hiệu ứng túi cam, thanh tiến độ, bảng chia sẻ có QR + Zalo/Facebook + copy link.
5. Trang Kiot kiểu TikTok: tab Sản phẩm / Video, số sản phẩm, số đã bán, chia sẻ có QR, link mạng xã hội của Kiot.
6. Trang Tôi làm trung tâm tài khoản.
7. Trang Giới thiệu & Pháp lý + các trang chính sách sàn TMĐT.
8. Slogan cố định ở đầu các trang chính.
9. Dải nhắc "Mở tài khoản miễn phí" không che trang.
- Đụng tới: `src/components/*`, `src/app/(trang)`, `docs/BRAND.md`, `SPEC-kiot.md` (bố cục trang Kiot),
  `SPEC-creator.md` (feed). Không đổi `index.ts` của module, không đổi schema.

### Giai đoạn B: Mạng xã hội (thêm bảng mới, không đụng tiền), khoảng 3–4 ngày
1. Follow Kiot (bảng mới) + số Followers + tab "Đang follow" trong feed + thông báo khi Kiot đăng video.
2. Bình luận video: trả lời 1 cấp, người đăng ghim, báo cáo/ẩn, CEO gỡ, chống spam.
3. Lưu video/sản phẩm (bookmark) + "Bộ sưu tập" ở trang Tôi.
4. Trang hashtag (`/video?tag=…`).
5. Feed ưu tiên Kiot đang follow và ngành hàng đã thích.
- Đụng tới: module `creator` và `kiot` (thêm hàm vào `index.ts`, cần CEO đồng ý), migration **chỉ thêm bảng mới**,
  không sửa bảng đang có dữ liệu.

### Giai đoạn C: Công cụ CEO, khoảng 1–2 ngày
1. Ghim Kiot/video lên đầu trang chủ, Chợ, feed (có hạn ngày).
2. Sửa slogan từng trang, sửa thông tin pháp lý/địa chỉ.
- Mọi thao tác ghi nhật ký CEO như hiện tại.

### Để sau / không làm
| Hạng mục | Lý do |
|---|---|
| Live bán hàng thật | Cần hạ tầng phát trực tiếp riêng và chi phí theo phút; làm sau khi có người bán thật hỏi |
| Story 24h | Làm sau giai đoạn B, dùng lại bộ xử lý video |
| AI Studio, "9 AI $745/tháng" | Chi phí cố định lớn khi chưa có doanh thu; bước đầu chỉ nên làm "AI viết mô tả" trả theo lượt |
| Kết nối thật 6 mạng xã hội | Phải xin duyệt ứng dụng từng mạng; trước mắt cho dán link |
| Đa ngôn ngữ, đọc tự động | Việc lớn, làm khi có khách nước ngoài |
| Điểm, voucher theo số tim, giới hạn Free | Dễ bị cày bằng tài khoản ảo; cần chống gian lận trước |
| Ví nạp tiền, trả bằng ví | Cần giấy phép NHNN |
| Value $951, thu nhập mẫu | Gây hiểu nhầm về thu nhập |
| STK cá nhân, "Tôi đã chuyển khoản" | Sai quy trình thu tiền của công ty |
| Ship gộp tự tính | Không khớp phí ship thật của từng Kiot |
| Supabase, deploy Vercel | Trùng hạ tầng, nguy cơ thay web thật |

## 5. Ghi chú kỹ thuật
- V4 dùng Next 14 / React 18 / Tailwind 3; 9mua.com dùng Next 15 / React 19 / Tailwind 4, trang render ở máy chủ,
  module chỉ gọi nhau qua `index.ts`. Giao diện sẽ được **viết lại** theo cấu trúc này, không chép `lib/store.tsx`
  (trạng thái giả trên trình duyệt).
- Thư viện mới cần CEO đồng ý: `lucide-react` (bộ icon V4 dùng; cài 1 gói, chỉ tải icon nào dùng). Nếu không
  muốn thêm thư viện thì vẽ icon bằng SVG. Không cần `framer-motion` (V4 khai báo nhưng không dùng), không cần
  `@supabase/supabase-js`. `qrcode` đã có sẵn trong dự án. VietQR đã có ở `src/modules/payouts/vietqr.ts`.
- Thư mục `9mua v4/` đã được loại khỏi kiểm tra kiểu, lint và image Docker, nên không ảnh hưởng web đang chạy.
  Giữ làm tài liệu tham khảo tới khi xong giai đoạn A–C, sau đó xoá khỏi `main` (lịch sử git vẫn giữ).
- Nhánh `claude/project-thread-dnygzz` (phiên làm việc khác): chia mô tả sản phẩm thành từng mục và mô tả mẫu dài
  hơn. Gộp vào `main` không xung đột. Nên review và gộp **trước** giai đoạn A vì cùng sửa trang sản phẩm.

## 6. CEO cần trả lời
1. Thương hiệu: giữ cam `#FC6F15` + chữ đen trên nút, logo tròn **không nhấp nháy**? Hay theo đúng V4?
2. Nền: đen cho Video/feed + trắng cho mua bán (đề xuất), hay đen toàn site?
3. Trang chủ: giữ trang chủ hiện tại (Chợ, Video hot, Kiot) + thanh dưới, hay trang chủ là feed video như TikTok?
4. Giá Kiot hiển thị "26.000đ/năm (~1 USD)", thu theo năm như hiện tại?
5. Đồng ý **không làm**: STK cá nhân, ví nạp tiền, Value $951, thu nhập mẫu?
6. Đồng ý thêm thư viện `lucide-react`?
7. Duyệt bắt đầu giai đoạn A?

## 7. Quyết định của CEO (27/10/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Thương hiệu | Logo trong vòng tròn trắng viền cam, **không nhấp nháy**; giữ cam `#FC6F15` và chữ đen trên nút; máy tính có chữ "9MUA" cạnh logo, điện thoại chỉ logo |
| 2 | Nền | Đen chỉ cho Video/feed; trang mua bán nền trắng |
| 3 | Trang chủ | **Trang chủ là feed video** (giữ chữ giới thiệu + link Chợ trong trang cho Google; chỉ tải trước video đầu; chưa có video thì hiện nội dung Chợ). Nội dung trang chủ cũ chuyển vào đầu `/cho` |
| 4 | Giá Kiot | **1 USD/năm**, máy chủ lấy tỷ giá bán USD Vietcombank mỗi sáng, làm tròn tới 1.000đ; lỗi thì giữ giá gần nhất; lệch > 10% so với lần trước thì không áp dụng và báo CEO; QR đã tạo giữ giá cũ; web chỉ hiện VNĐ. Sửa `SPEC-billing.md` trước khi code |
| 5 | Không làm | STK cá nhân, ví nạp tiền, Value $951, doanh thu mẫu |
| 6 | Thư viện | Thêm `lucide-react` |
| 7 | Giai đoạn A | Duyệt toàn bộ |
| 8 | Livestream | **Tự xây trên VPS** (MediaMTX, phát từ trình duyệt điện thoại), làm sau giai đoạn A; ban đầu tối đa 2 buổi cùng lúc × 50 người xem |
| 9 | Quà livestream | **9MUA thưởng xu nội bộ theo KPI số người xem**, tự động (bộ quy tắc dưới đây); khách không tặng nhau |
| – | Pháp lý | CEO yêu cầu không phân tích pháp lý trong các đề xuất tiếp theo |

**Xu 9MUA (mặc định, CEO sửa sau):**
- 1 xu dùng thay 1.000đ trong 9MUA: gia hạn Kiot, đẩy video/live lên đầu feed. Không đổi ra tiền mặt, không
  chuyển cho người khác. Sổ xu riêng, chỉ thêm.
- Người xem hợp lệ: đã đăng nhập, tài khoản tạo trước buổi live ≥ 3 ngày, xem liên tục ≥ 1 phút, mỗi tài khoản 1 lần
  mỗi buổi, không tính chủ Kiot, tối đa 3 tài khoản cùng mạng mỗi buổi.
- Buổi live ≥ 15 phút. Thưởng: 10 người xem → 10 xu; 25 → 30 xu; 50 → 80 xu. Mỗi Kiot tối đa 1 buổi được thưởng/ngày.
  Ngân sách 20.000 xu/tháng, hết thì dừng và báo CEO. Tự cộng khi buổi live kết thúc; CEO thu hồi bằng dòng trừ.
