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
