# Implementation Plan: 9mua.com MVP

## Overview

Xây 9 module trong `CAPABILITY-MAP.md` thành một ứng dụng Next.js chạy bằng Docker trên VPS, sau Nginx.
Kết quả: người bán trả 26.000đ qua PayOS để mở Kiot `tenkiot.9mua.com`. Người mua đặt hàng và trả cho 9mua.
9mua giữ tiền tới khi đơn hoàn tất rồi tự chi cho người bán. Có Chợ chung, video Creator và trang CEO.

Mỗi task là **một lát cắt dọc** (DB + logic + giao diện + test), xong task nào là chạy được task đó.
Danh sách chi tiết ở `tasks/todo.md`.

## Architecture Decisions

| Quyết định | Lý do | Nguồn |
|---|---|---|
| Một app Next.js 15 (App Router), mỗi module là thư mục `src/modules/<id>/` với `index.ts` làm hợp đồng | Một codebase, ranh giới module rõ, dễ tách sau | `SPEC-identity.md` |
| PostgreSQL 16 + Prisma. Tiền là số nguyên VNĐ. Sổ tiền **chỉ thêm** (`PaymentEvent`, `BalanceEntry`, `OrderEvent`, `AdminAuditLog`) | Mọi con số truy ngược được, không mất tiền vì ghi đè | `payments`, `payouts`, `orders` |
| Module phụ thuộc ngược bằng **đăng ký handler** (`registerPaymentHandler`, `onOrderCompleted`) | Giữ chiều phụ thuộc một chiều như capability map, không vòng | `payments`, `orders` |
| Mọi tích hợp ngoài (PayOS thu, PayOS chi, SMTP, lưu file) đều có **driver giả** cho dev/test, bị chặn ở production | Viết và test hết luồng tiền mà không cần tiền thật hay key thật | `payments`, `payouts`, `identity` |
| Việc định kỳ chạy qua route `/api/internal/*` (chỉ localhost), gọi bằng cron của host. Hàng đợi video dùng bảng Postgres | Không thêm Redis hay hệ thống hàng đợi riêng | `orders`, `billing`, `payouts`, `creator` |
| Docker Compose gồm `app` (127.0.0.1:3009), `worker` (ffmpeg), `db`. Nginx trên host làm reverse proxy + SSL wildcard | Theo yêu cầu: giữ Nginx, cổng riêng | `SPEC-identity.md` |
| Kiểm thử: Vitest với Postgres thật cho logic tiền và đồng thời, Playwright cho luồng người dùng. Viết test trước | Lỗi tiền và lỗi đồng thời chỉ bắt được trên DB thật | Mọi spec |

## Phases (chi tiết trong `tasks/todo.md`)

| Phase | Task | Kết quả nhìn thấy được | Checkpoint |
|---|---|---|---|
| 0. Nền móng | T1–T3 | Trang trắng có logo chạy trong Docker, `/api/health` xanh, có mẫu cấu hình Nginx | A |
| 1. Tài khoản | T4–T7 | Đăng ký, đăng nhập, quên mật khẩu qua email, tạo CEO | B |
| 2. Kiot | T8–T12 | Tạo Kiot, đăng sản phẩm có ảnh, trang `slug.9mua.com` | C |
| 3. Thu tiền + phí thuê | T13–T17 | Trả 26.000đ (giả lập rồi thật) → Kiot tự mở | D |
| 4. Đơn hàng | T18–T21 | Mua từ nhiều Kiot bằng 1 QR, đơn đi đủ vòng đời | E |
| 5. Số dư + chi trả | T22–T25 | Đơn hoàn tất → số dư → rút → chi tự động qua PayOS | F |
| 6. Chợ | T26–T27 | Trang chủ, Chợ, tìm kiếm không dấu | G |
| 7. Creator | T28–T30 | Đăng video, feed 9:16, mua từ video | G |
| 8. Trang CEO | T31–T35 | Admin có 2 lớp, hàng chờ, cài đặt, email cảnh báo | H |
| 9. Ra mắt | T36–T37 | Kiểm thử toàn bộ, review bảo mật, deploy VPS, thử tiền thật | I |

Thứ tự đi theo capability map. Phase 6 và 7 độc lập với nhau, làm song song được sau Checkpoint E.

**Ưu tiên rủi ro cao làm sớm:**
- Docker + Nginx + subdomain làm ở T3 và T11.
- Webhook PayOS và chống trùng làm ở T14.
- Tồn kho đồng thời làm ở T12.
- Chi tiền trùng làm ở T25.

## Risks and Mitigations

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Thu hộ có thể cần giấy phép trung gian thanh toán (NĐ 52/2024) | Cao | CEO hỏi luật sư/kế toán trước khi mở cho khách thật. Code gói gọn trong `orders`/`payouts`, đổi mô hình chỉ sửa 2 module |
| Chưa có tài khoản PayOS thu / kênh chi hộ | Cao | Toàn bộ code chạy bằng driver giả. Chi hộ tự động tắt thì hệ thống tự chuyển sang duyệt tay |
| Giới hạn mô tả chuyển khoản PayOS (9 ký tự) chưa kiểm với tài khoản thật | Trung bình | Hàm chuẩn hoá mô tả tập trung một chỗ. Thử 2.000đ thật ở Checkpoint D |
| SSL wildcard `*.9mua.com` cần DNS-01 | Trung bình | `docs/deploy.md` có cả 2 cách: certbot plugin DNS, hoặc thêm bản ghi TXT thủ công |
| Băng thông và CPU VPS khi video tăng | Trung bình | Chuyển mã 720p (nhẹ 3–5 lần), worker riêng xử lý 1 video một lúc, `MediaStore` sẵn sàng chuyển sang R2/Bunny |
| Email vào spam | Trung bình | Xác thực tên miền Brevo (SPF, DKIM, DMARC) trong `docs/deploy.md` |
| Phạm vi lớn (37 task), mất ngữ cảnh giữa các phiên | Trung bình | Spec và todo là nguồn sự thật. Checkpoint sau mỗi phase. Commit + push sau mỗi task |
| Code chỉ nằm trong container, GitHub chưa kết nối | **Cao** | CEO liên kết GitHub sớm. Mỗi checkpoint phải push được lên `haitruongphuc-tech/9mua` |

## Open Questions

1. **Cấu hình VPS** (CPU, RAM, ổ đĩa, phiên bản Ubuntu)? Cần ≥ 2 vCPU / 4GB RAM / 40GB SSD cho Postgres + ffmpeg.
2. **Liên kết GitHub** (claude.ai/connect-github + cài Claude GitHub App cho repo `9mua`), để lưu code an toàn.
3. **Truy cập VPS để deploy** ở Phase 9: anh tự chạy theo `docs/deploy.md`, hay cấp SSH cho tôi? Có thể quyết lúc tới Phase 9.

## Live + xu (T49–T57) — chia nhỏ ngày 27/10/2026 (`SPEC-live.md`)

| Task | Việc | Kiểm tra |
|---|---|---|
| T49 | Dữ liệu: `LiveSession`, `LiveViewer`, `LiveChatMessage`, `LiveChatBan`, `LiveReport`, `LiveBan`, `XuEntry` (trigger chỉ thêm), cột `sourceLiveId` ở `CartItem`/`OrderItem`; cài đặt `live_*`, `xu_rules_json` | migrate, test chốt chặn DB |
| T50 | `startLive`/`endLive`, mã phát dùng 1 lần (lưu băm), mã xem HMAC 5 phút, `authorizeMedia` + `/api/live/media-auth`; giới hạn 2 buổi, 50 người, 2 giờ, tài khoản ≥ 3 ngày, cấm live | integration |
| T51 | MediaMTX: `deploy/mediamtx/mediamtx.yml`, service trong docker-compose, Nginx `/live-media/`, cổng 8189; `syncWithMediaServer` (API MediaMTX) trong worker mỗi 5 giây | unit với API giả |
| T52 | `/live/phat`: camera/micro, WHIP bằng `fetch` + `RTCPeerConnection`, đổi camera, tắt micro, giữ màn hình sáng, tự nối lại, bảng tổng kết | E2E |
| T53 | `/live` + `/live/<id>`: WHEP, vuốt dọc, tín hiệu 20 giây, số người xem thật; chấm đỏ thanh dưới; nhãn LIVE ở trang Kiot/creator | E2E |
| T54 | Chat + tim qua SSE (không có SSE thì hỏi lại 3 giây); lọc link, 1 tin/3 giây, 10 tim/giây; ẩn tin, cấm chat | unit + integration |
| T55 | Ghim sản phẩm (mọi Kiot đang hoạt động) + "Thêm vào giỏ" ghi `sourceLiveId` | integration + E2E |
| T56 | Báo cáo (5 người thì ẩn + báo CEO), `/admin/live`: dừng ngay, cấm 1/7/30 ngày/vĩnh viễn, audit | integration |
| T57 | Xu: sổ chỉ thêm, `rewardLive` khi kết thúc (người xem hợp lệ, mức thưởng, 1 buổi/ngày, ngân sách tháng), `/admin/xu`, ô xu ở trang Tôi | unit + integration |

Ghi chú: máy làm việc của Claude không chạy được MediaMTX thật (bị chặn tải và build phần mềm ngoài), nên E2E dùng
"máy chủ hình giả" khi `TEST_MODE=e2e` (giả lập MediaMTX báo có hình); phát/xem hình thật kiểm tra trên VPS.

## Nâng cấp một đợt (T79–T136) — CEO duyệt 30/10/2026 ("duyệt làm đi")

Nguồn: `docs/nang-cap-mot-dot.md` (quyết định, công tắc, dịch vụ ngoài, thư viện, dữ liệu) và mục "Bổ sung 30/10/2026 — Nâng cấp
một đợt (V5)" trong từng `SPEC-<module>.md`, cùng `SPEC-play.md`. Làm trên nhánh `nang-cap-mot-dot`. Trừ App (C32–C36).

**Luật cho mọi task:**
- Test trước → code → `sh scripts/check.sh` (prettier, lint, typecheck, vitest) → **một commit** → push ngay.
- Migration **chỉ thêm** bảng/cột (cột mới cho phép trống hoặc có mặc định). Sổ chỉ thêm có trigger chặn sửa/xoá như các sổ cũ.
- Mỗi chức năng kiểm công tắc `isFeatureOn('<tên>')` (T79) ở trang, API và việc nền. Mặc định bật/tắt đúng bảng ở
  `docs/nang-cap-mot-dot.md` mục 3. Phần đụng tiền và phần chờ khoá **tắt sẵn**.
- Dịch vụ ngoài luôn có driver `fake`; thiếu khoá thì công tắc không bật được.
- Chỉ thêm 3 thư viện đã duyệt: `leaflet`, `hls.js`, `@aws-sdk/client-s3`. Cần thư viện khác thì hỏi CEO.
- Hợp đồng `index.ts` chỉ thêm hàm, không đổi hàm cũ. Chữ giao diện mới đủ 7 thứ tiếng.

| Task | Việc (mã) | Kiểm tra |
|---|---|---|
| T79 | Công tắc chức năng: khoá `feature.*` trong `Setting`, `isFeatureOn`, `/admin/cong-tac`, mã 2 lớp khi bật công tắc tiền, báo "Chưa có khoá" | unit + integration + admin route test |
| T80 | @tên người dùng (C69): cột `handle`, tự đặt cho tài khoản cũ, `/@<tên>`, `/creator/<id>` chuyển 301, đổi 30 ngày, giữ tên cũ 30 ngày | unit luật tên + integration |
| T81 | Chặn toàn web (C68): `UserBlock`, chép `MessageBlock`, `isBlockedEither` ở feed, bình luận, follow, live, Hộp thư | integration hai chiều |
| T82 | Quyền riêng tư video + `canViewVideo` dùng mọi nơi (C50) | integration từng nơi hiện video |
| T83 | Cam kết nội dung (C10, C11): `CommitmentVersion`, `Commitment`, chặn 7 thao tác ở máy chủ, bảng M5, `/cam-ket` | integration + E2E |
| T84 | Công cụ xem: thanh tua, tốc độ, xoay ngang, tự cuộn (C57–C59, C63) | E2E điện thoại + máy tính |
| T85 | Không quan tâm + lịch sử đã xem (C60, C61) | unit điểm feed + integration |
| T86 | Nháp, hẹn giờ, địa điểm, ghim lên trang cá nhân, nhãn AI, sửa sau khi đăng (C48, C49, C53–C56) | integration (đồng hồ giả) |
| T87 | Tải lên từng phần, giới hạn video dài, tài khoản ≥ 3 ngày, hàng chờ `short`/`long`, chặn khi ổ đầy (C06) | integration mất phần, gửi trùng |
| T88 | Nhiều mức chất lượng: MP4 480p, HLS 360–1080p, 3 ảnh bìa, ảnh xem trước động, `hls.js` (C07) | worker test với video mẫu |
| T89 | Kho video ngoài: driver `s3`, `/admin/dung-luong`, `npm run media:migrate` | unit với S3 giả |
| T90 | Phụ đề tự động (C51): driver OpenAI Whisper + `fake`, sửa phụ đề, nút CC, ngân sách | unit + integration |
| T91 | Quay trong app, 8 bộ lọc màu, làm đẹp (C08, C09) | E2E (camera giả của Playwright) + worker test |
| T92 | Stitch (C09) | worker test 720×1280 |
| T93 | Chỉnh video: cắt, ghép, chữ, nhãn dán, `editSpec` (C89) | worker test + E2E |
| T94 | Âm thanh: tự tạo âm thanh gốc, "dùng âm thanh này", thịnh hành, thư viện CEO, `/am-thanh/<id>` (C90) | integration |
| T95 | Chia sẻ thêm: tải về có logo, `/nhung/<id>`, TikTok/Instagram, gửi qua Hộp thư (C03–C05, C65) | integration + E2E |
| T96 | Watch: phim nhiều tập, tab Watch, tự phát tập tiếp, lưu phim, bình luận theo phút (C02) | integration + E2E |
| T97 | Bài đăng ảnh + chữ trong feed, trang cá nhân, hashtag (C86) | integration + E2E |
| T98 | Tim bình luận, @nhắc tên, từ cấm (C25, C52, C67) | unit khớp không dấu + integration |
| T99 | Trả lời bình luận bằng video (C64) | integration |
| T100 | Thông báo mới (gộp theo giờ) + cài đặt thông báo (C66) | integration |
| T101 | Bạn chung, gợi ý follow, tab Đã thích (C23, C24, C62) | integration |
| T102 | Cảm xúc 6 loại + đăng lại (C87, C88) | integration |
| T103 | Điểm thưởng + đổi điểm ra xu (C01) | unit chống cày + integration ngân sách |
| T104 | Sự kiện + Kỷ niệm "ngày này năm trước" (C26) | integration |
| T105 | Nhóm công khai/riêng tư, quản trị, duyệt bài (C91) | integration |
| T106 | Tài khoản riêng tư + yêu cầu follow (C70) | integration |
| T107 | Tự xoá tài khoản: điều kiện, 30 ngày chờ, ẩn danh hoá, giữ sổ tiền (C71) | integration (đồng hồ giả) |
| T108 | Đăng nhập Apple (C72) | integration với driver giả |
| T109 | Nhiều tài khoản trên một máy (C73) | integration + E2E |
| T110 | Vị trí Kiot, tìm Kiot theo tên, Gần tôi, khoảng giá, lọc sao (C12, C13) | unit khoảng cách + integration |
| T111 | Bản đồ nhiệt `leaflet` (C14) | integration đếm ô + E2E |
| T112 | Gợi ý từ khoá, lịch sử tìm, từ khoá hot, micro (C38, C74) | integration |
| T113 | Đánh giá sản phẩm + sao Kiot (C15, C82) | integration |
| T114 | Hồ sơ nguồn gốc riêng tư, huy hiệu 3 mức, CEO duyệt (C16, C17, C42) | integration + route quyền |
| T115 | Tố cáo hàng giả 24 giờ; hoàn tiền tắt sẵn, dòng `adjustment` (C18) | integration tiền |
| T116 | Giao diện Kiot kéo thả 50 mẫu + bảo hành (C27, C29) | unit cấu trúc layout + E2E |
| T117 | Nhập Page 6 mạng, driver giả (C28) | integration |
| T118 | Biến thể sản phẩm, giỏ, đơn, tồn kho theo biến thể (C83) | integration tranh mua |
| T119 | Mã giảm giá, giảm giá theo giờ, công thức cộng số dư mới (C84, payouts V5.1) | integration + so công thức cũ |
| T120 | GHN/GHTK: tính phí, tạo đơn giao, webhook (C31) | integration webhook trùng, sai chữ ký |
| T121 | COD: trạng thái `cod_pending`, đối soát, hoàn hàng (C85) | integration tiền |
| T122 | Ví thu nhập + hoa hồng creator + rút tiền CEO duyệt (C92) | integration tiền |
| T123 | Dùng xu: gia hạn Kiot, đẩy video/live (C94) | integration |
| T124 | Vui chơi: quay số, bắn tim, xếp hạng tuần (C30, `SPEC-play.md`) | unit xác suất + integration ngân sách |
| T125 | AI kiểm duyệt bằng Claude, viết sẵn, tắt (C19) | integration với driver giả |
| T126 | Lý do báo cáo mới, xử lý 3 lần, trang `/kiem-duyet` (C20–C22) | integration |
| T127 | Nhãn "Cổng thế giới đã mở", `/huong-dan`, slogan trang mới, Pháp lý thêm STK + con dấu (C37, C39–C41) | E2E |
| T128 | Kanban CEO (C43) | integration |
| T129 | Chi phí + trả tự động qua PayOS chi hộ (C44, C45) | integration mức trần, chạy 2 lần |
| T130 | Casso + Tài chính + xuất file cho MISA (C46, C47) | integration webhook |
| T131 | Live: giới hạn chỉnh được, hẹn lịch, người quản lý chat (C75, C77, C79) | integration |
| T132 | Xem lại buổi live (C76) | worker test |
| T133 | Mời khách cùng live (C78) | integration + E2E máy chủ hình giả |
| T134 | Nhắn nhóm (C80) | integration |
| T135 | Tin thoại, tin video, thu hồi (C81) | integration |
| T136 | Kiểm tra toàn bộ: E2E điện thoại + máy tính, dịch 7 thứ tiếng, `docs/deploy.md` (biến môi trường, Nginx), hướng dẫn CEO bật công tắc | toàn bộ test + E2E |
