# Danh sách kiểm trước khi mở cửa 9mua.com (T36)

Ngày kiểm: 23/10/2026. Người kiểm: Claude (theo quy trình agent-skills `/ship`). Kết luận ở cuối trang.

## 1. Chất lượng mã

| Hạng mục | Kết quả |
|---|---|
| Unit + integration (Vitest, Postgres thật) | ✅ 437 test đạt |
| E2E (Playwright, bản build production standalone) | ✅ 37 kịch bản đạt; 2 test chập chờn khi chạy cả bộ (`cart.spec` 1 lần, `kiot-profile.spec` 1 lần — đã sửa nguyên nhân bộ chọn trùng) |
| Lint + TypeScript strict | ✅ 0 lỗi, 0 cảnh báo |
| Build | ✅ `next build` + đóng gói CLI/worker |
| TODO / `console.log` gỡ lỗi trong mã chạy thật | ✅ không có |
| Đo tìm kiếm 100.000 sản phẩm (`PERF=1 npx vitest run tests/perf`) | ✅ p50 54ms, p95 183ms (mục tiêu < 300ms) |

## 2. Bảo mật

| Hạng mục | Kết quả |
|---|---|
| Bí mật trong mã / git | ✅ không có; `.env` bị bỏ qua; khoá PayOS, SMTP, mã hoá chỉ đọc từ môi trường |
| `npm audit` | ✅ đã vá `deepmerge-ts` (High, qua Prisma CLI) bằng override 8.0.2. ⚠ Còn 2 cảnh báo ở `vitest` (công cụ test, không có trong image chạy thật) — nâng `vitest` 4.1.12 khi bản này đủ 2 tuần |
| Phân quyền | ✅ test quét mọi trang/action/API admin; kiểm chủ sở hữu ở server cho Kiot, sản phẩm, đơn, rút tiền, video |
| Đăng nhập | ✅ argon2id, khoá 5 lần sai/15 phút, phiên băm SHA-256, cookie httpOnly + SameSite=Lax + Secure |
| Admin | ✅ bắt buộc TOTP (bí mật mã hoá AES-256-GCM), mã dự phòng, phiên 12 giờ, nhật ký chỉ-thêm; khôi phục 2 lớp chỉ bằng CLI trên VPS |
| Header bảo mật | ✅ CSP theo nonce (`strict-dynamic`, không script inline, cấm nhúng khung), HSTS (Nginx), nosniff, Referrer-Policy, Permissions-Policy, COOP; E2E xác nhận HTML chèn lậu không chạy được |
| Giới hạn tần suất | ✅ Nginx: gửi form đăng nhập/đăng ký/quên mật khẩu 10 lần/phút/IP (thử thật: lần 7 nhận 429), tải ảnh/video 30 lần/phút |
| Route nội bộ cron | ✅ Nginx trả 404 + app kiểm token so sánh thời gian hằng |
| Chế độ test | ✅ driver giả (PayOS, mail) và `TEST_MODE` bị chặn trên địa chỉ HTTPS thật; route chỉ cho E2E trả 404 ở production (đã thử trong container) |
| Tiêm SQL / lệnh | ✅ Prisma có tham số; ffmpeg chạy bằng mảng tham số cố định, có giới hạn thời gian |
| Dữ liệu riêng tư | ✅ ảnh CCCD ngoài thư mục công khai; địa chỉ chi tiết Kiot và SĐT người mua (trước khi trả tiền) không lộ; mật khẩu tạm không đưa lên URL |
| CORS | ✅ không mở CORS cho API nào |

Còn theo dõi sau mở cửa (không chặn ra mắt):
- Đổi email chưa có bước xác minh quyền sở hữu email mới (đã báo CEO).
- Ảnh khiếu nại nằm trong `/uploads/disputes/` với tên ngẫu nhiên khó đoán (ai có link mới xem được).
- Từ lúc chạy CLI nâng quyền tới lúc CEO cài 2 lớp, người có mật khẩu CEO có thể cài trước → cài 2 lớp ngay sau khi tạo.

## 3. Hiệu năng (4G chậm giả lập: RTT 150ms, 1,6 Mbps, CPU chậm 4 lần — `e2e/perf.spec.ts`)

| Trang | LCP | CLS |
|---|---|---|
| Trang chủ | 0,53 s | 0,001 |
| Chợ `/cho` | 1,72 s | 0,001 |
| Danh mục `/cho/nong-san` | 1,69 s | 0,001 |
| Trang Kiot `tenkiot.9mua.com` | 1,55 s | 0,001 |
| Feed video | 0,55 s | 0,001 |

Mục tiêu LCP < 2,5 s, CLS < 0,1: ✅. Ảnh dùng bản WebP 400px trên lưới; ảnh/video do Nginx phục vụ, cache 1 năm.
Trang chủ và danh mục cache dữ liệu 60 giây. Truy vấn nóng đều có chỉ mục (tìm kiếm GIN trigram, đơn, video).

## 4. Khả năng truy cập

- ✅ Ô nhập có nhãn; lỗi form hiện bằng `role="alert"`; nút có tên đọc được (thích, chia sẻ, báo cáo…).
- ✅ Tương phản: chữ xám nâng lên mức đạt WCAG AA (≥ 4,5:1); nút cam chữ đen ≈ 7:1.
- ⚠ Chưa chạy công cụ axe tự động (cần thêm thư viện → hỏi CEO nếu muốn).

## 5. Hạ tầng (làm ở T37 trên VPS)

- [ ] `.env` thật: `APP_URL`, `POSTGRES_PASSWORD`, `INTERNAL_CRON_TOKEN`, `APP_ENCRYPTION_KEY` (cất bản sao riêng), SMTP Brevo, PayOS (nhận tiền), PayOS chi hộ (khi có kênh).
- [ ] DNS + SSL wildcard `*.9mua.com` (certbot DNS-01), Nginx (`deploy/nginx`), `nginx -t`.
- [ ] `docker compose run --rm migrate` rồi `up -d`; health `/api/health` 200.
- [ ] Cron (`deploy/cron/9mua.cron`): đối soát 5', vòng đời đơn 5', chi hộ 2', cảnh báo 5', nhắc gia hạn 8:00, bản tin 8:05, thống kê Chợ 3:10, sao lưu 2:00.
- [ ] Webhook PayOS, xác thực tên miền Brevo, tạo tài khoản CEO + cài 2 lớp ngay.
- [ ] Thử tiền thật: trả 2.000đ kích hoạt Kiot thử; chi hộ 2.000đ tới tài khoản thử.
- [ ] Sao lưu chạy tay 1 lần + khôi phục thử (đã thử trên máy dev: số dòng khớp, trigger đủ, tìm kiếm chạy).

Đã kiểm trong sandbox: image Docker build được, container web chạy ở chế độ production (CSP, route test tắt,
tên miền phụ sau HTTPS), container `worker` khởi động/dừng đúng, 2 lệnh CLI chạy. Chưa kiểm được ffmpeg
trong image `worker` vì sandbox chặn `apt` → kiểm trên VPS.

## 6. Giám sát

- `/api/health` cho Docker healthcheck và dịch vụ theo dõi ngoài (gợi ý: UptimeRobot miễn phí, 5 phút).
- Email báo CEO ngay: tiền vào lệch, lệnh chi lỗi/treo, quỹ chi thấp, khiếu nại mới, sản phẩm/video bị tự ẩn
  (gộp, tối đa 1 email/loại/15 phút) + bản tin 8:05 mỗi sáng.
- Nhật ký: `docker compose logs -f app worker`. Chưa có dịch vụ thu lỗi (Sentry…) — thêm sau nếu CEO duyệt.

## 7. Kế hoạch quay lui

- **Tắt chi tự động** khi nghi có sự cố tiền: `/admin/cai-dat` → nút đỏ (1 chạm). Mọi yêu cầu rút vào hàng chờ.
- **Quay về bản trước**: mỗi lần deploy gắn tag image theo commit (`docker tag ninemua-app:latest ninemua-app:<commit>`),
  lỗi thì `docker compose up -d` với tag cũ (< 5 phút).
- **Database**: migration chỉ đi tiến (thêm cột/bảng, không xoá) nên bản app cũ vẫn chạy được trên DB mới.
  Luôn chạy `scripts/backup-db.sh` trước `migrate`. Sổ tiền chỉ-thêm: không bao giờ "sửa tay" số dư — dùng
  "Điều chỉnh số dư" có lý do trong trang CEO.
- **Kênh thanh toán**: PayOS lỗi thì đơn chờ thanh toán tự hết hạn sau 15 phút, không trừ kho vĩnh viễn; cron
  đối soát ghi nhận lại tiền vào khi PayOS hoạt động lại.

## Kết luận

**GO có điều kiện** — mã nguồn sẵn sàng ra mắt: không còn lỗi Critical/High trong ứng dụng, mọi luồng tiền có
test đồng thời + chống trùng, hiệu năng đạt mục tiêu. Điều kiện trước khi mở cho người dùng thật: hoàn thành mục
5 (T37 trên VPS), đặc biệt **thử tiền thật 2.000đ** cả chiều vào lẫn chiều chi, và **khôi phục thử bản sao lưu**.
