# Deploy 9mua.com lên VPS

Kiến trúc: **Nginx trên host** (cổng 80/443, SSL) → **app trong Docker** ở `127.0.0.1:3009`.
`db` (PostgreSQL 16) và `worker` (xử lý video) chạy cùng trong `docker-compose.yml`.
Không container nào mở cổng ra Internet.

```
Internet ──443──▶ Nginx (host) ──▶ 127.0.0.1:3009 app ──▶ db
                     │ /uploads/* đọc thẳng /srv/9mua/uploads        worker ──▶ db, /srv/9mua/uploads
                     │ /api/internal/* → 404 (chỉ cron trên VPS gọi thẳng 127.0.0.1:3009)
```

## 1. Chuẩn bị một lần

```bash
# Docker Engine + plugin compose (Ubuntu)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # đăng xuất/đăng nhập lại

# Thư mục dữ liệu (ảnh, video công khai / ảnh CCCD riêng tư). Container chạy bằng user node (uid 1000)
sudo mkdir -p /srv/9mua/uploads /srv/9mua/private /srv/9mua/backups
sudo chown -R 1000:1000 /srv/9mua/uploads /srv/9mua/private
sudo chmod 750 /srv/9mua/private

# Mã nguồn
sudo mkdir -p /opt/9mua && sudo chown $USER /opt/9mua
git clone https://github.com/haitruongphuc-tech/9mua.git /opt/9mua
cd /opt/9mua
cp .env.example .env && chmod 600 .env   # rồi điền giá trị thật
```

Không đặt `HOSTNAME` trong `.env`: image Docker dùng `HOSTNAME=0.0.0.0`. Đặt `127.0.0.1` sẽ làm mọi trang
Kiot trên tên miền phụ lỗi 500 khi chạy sau Nginx/HTTPS (xem ghi chú trong `src/middleware.ts`).

Tối thiểu cần điền trong `.env`:
- `POSTGRES_PASSWORD`: tạo bằng `openssl rand -hex 24`.
- `INTERNAL_CRON_TOKEN`: tạo bằng `openssl rand -hex 32`.
- `APP_ENCRYPTION_KEY`: tạo bằng `openssl rand -hex 32`. Mã hoá bí mật 2 lớp của CEO; **mất khoá này thì
  CEO phải cài lại 2 lớp**, nên chép một bản cất riêng (không để chung với bản sao lưu DB).
- `APP_URL=https://9mua.com`.
- `PAYOS_*` (kênh nhận tiền) và, khi PayOS đã mở kênh chi hộ cho 9MUA CO.,LTD, `PAYOS_PAYOUT_*`. Để trống
  `PAYOS_PAYOUT_*` thì mọi yêu cầu rút vào hàng chờ CEO duyệt tay (chuyển bằng QR VietQR).

Kênh chi hộ PayOS cần:
- Nạp trước tiền vào tài khoản chi. Hệ thống báo CEO khi quỹ thấp hơn tổng yêu cầu đang chờ + 10.000.000đ.
- Cho phép lệnh chi tạo qua API được duyệt tự động trên trang PayOS. Nếu PayOS bắt duyệt tay từng lệnh,
  lệnh sẽ nằm ở trạng thái "đang chuyển" và hệ thống báo CEO sau 2 giờ.
- Thêm IP của VPS vào danh sách IP được phép gọi API chi hộ (nếu PayOS yêu cầu).

## 2. Chạy ứng dụng

```bash
docker compose up -d --build db
docker compose run --rm migrate        # áp migration database
docker compose up -d --build           # app + worker
curl -s 127.0.0.1:3009/api/health      # → {"ok":true}

# Đăng ký webhook PayOS (cần PAYOS_* trong .env)
docker compose run --rm app node dist/scripts/payos-confirm-webhook.mjs https://9mua.com/api/payos/webhook

# Tạo tài khoản CEO (hỏi mật khẩu ẩn; tài khoản đã có thì chỉ nâng quyền).
# Ngay sau đó đăng nhập 9mua.com/admin để cài xác thực 2 lớp (trước khi ai khác kịp đăng nhập).
docker compose run --rm app node dist/scripts/create-admin.mjs --phone 0979393916 --name "Nguyễn Hải"
# Mất điện thoại 2 lớp và cả 10 mã dự phòng: thêm --reset-2fa rồi cài lại
# docker compose run --rm app node dist/scripts/create-admin.mjs --phone 0979393916 --reset-2fa
```

**Cập nhật phiên bản mới**:

```bash
git pull && docker compose run --rm --build migrate && docker compose up -d --build
```

## 3. Nginx + SSL wildcard `*.9mua.com`

Mỗi Kiot là một tên miền phụ, nên cần chứng chỉ **wildcard**. Let's Encrypt chỉ cấp wildcard qua **DNS-01**.

**Cách A: tự động** (nhà cung cấp DNS có plugin certbot, ví dụ Cloudflare):

```bash
sudo apt install certbot python3-certbot-dns-cloudflare
# /root/.secrets/cloudflare.ini chứa: dns_cloudflare_api_token = <token chỉ có quyền Zone:DNS:Edit>
sudo chmod 600 /root/.secrets/cloudflare.ini
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d 9mua.com -d '*.9mua.com'
```

**Cách B: thủ công** (DNS ở P.A / Mắt Bão không có plugin). Certbot yêu cầu thêm 1 bản ghi TXT
`_acme-challenge.9mua.com`. Phải lặp lại mỗi 90 ngày, nên **khuyến nghị chuyển DNS sang Cloudflare
(miễn phí)** để dùng cách A.

```bash
sudo certbot certonly --manual --preferred-challenges dns -d 9mua.com -d '*.9mua.com'
```

Bật site:

```bash
sudo cp deploy/nginx/ninemua-proxy.conf /etc/nginx/snippets/ninemua-proxy.conf
sudo cp deploy/nginx/9mua.conf /etc/nginx/sites-available/9mua.conf
sudo ln -sf /etc/nginx/sites-available/9mua.conf /etc/nginx/sites-enabled/9mua.conf
sudo nginx -t && sudo systemctl reload nginx
```

DNS cần có: `A 9mua.com → IP VPS` và `A *.9mua.com → IP VPS` (hoặc `CNAME * → 9mua.com`).

## 3b. Google Search Console

Xác minh `9mua.com` dạng **Domain property** (bản ghi DNS TXT) để Google nhận cả các link
`tenkiot.9mua.com` trong `https://9mua.com/sitemap.xml`, rồi gửi sitemap đó.

## 4. Cron

File mẫu: `deploy/cron/9mua.cron`. Các route được bổ sung dần theo task T15, T17, T21, T25, T35.

```bash
sudo cp deploy/cron/9mua.cron /etc/cron.d/9mua && sudo chmod 644 /etc/cron.d/9mua
```

Cron gọi thẳng `127.0.0.1:3009` kèm header `X-Internal-Token: $INTERNAL_CRON_TOKEN`. Route
`/api/internal/*` bị Nginx chặn từ bên ngoài, và app kiểm token (vì trong Docker, app không phân biệt
được request đi từ Nginx hay từ cron).

## 5. Sao lưu database

`scripts/backup-db.sh` chạy lúc 2:00 (dòng cuối `deploy/cron/9mua.cron`): dump DB nén vào
`/srv/9mua/backups/db-<ngày-giờ>.sql.gz` (kiểm đọc lại được mới giữ, giữ 14 ngày) và đồng bộ `uploads/`,
`private/` (ảnh CCCD) sang `/srv/9mua/backups/files/`. Thư mục sao lưu chỉ root đọc được.
**Nên chép thêm ra ngoài VPS** (Google Drive, ổ khác) — mất VPS là mất cả bản sao lưu.

Đã thử khôi phục trọn bộ (T36): số dòng mọi bảng khớp, đủ trigger chỉ-thêm, tìm kiếm chạy.

Khôi phục **thử** vào một database phụ (không đụng dữ liệu đang chạy):

```bash
docker compose exec -T db createdb -U ninemua ninemua_restore
gunzip -c /srv/9mua/backups/db-<ngày-giờ>.sql.gz | docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U ninemua -d ninemua_restore
docker compose exec -T db psql -U ninemua -d ninemua_restore -c 'select count(*) from "Order"'
docker compose exec -T db dropdb -U ninemua ninemua_restore
```

Khôi phục **thật** (sự cố): dừng `app` và `worker`, tạo lại database `ninemua` rỗng, nạp bản sao lưu như trên
vào `ninemua`, chép lại `files/uploads` và `files/private` về `/srv/9mua/`, rồi `docker compose up -d`.

## 6. Kiểm tra sau deploy

- [ ] `https://9mua.com` và `https://abc.9mua.com` có ổ khoá HTTPS hợp lệ.
- [ ] `https://9mua.com/api/internal/x` trả 404.
- [ ] `docker compose ps`: `app` healthy, `db` healthy, `worker` running.
- [ ] `docker compose port db 5432` không trả gì (database không mở ra ngoài).
- [ ] `docker compose run --rm worker ffmpeg -version` chạy được (worker có ffmpeg).
- [ ] Gửi liên tục 7 lần form đăng nhập sai: lần thứ 7 trở đi nhận lỗi 429 (giới hạn theo IP).
- [ ] `sh scripts/backup-db.sh` chạy tay 1 lần thành công, rồi khôi phục thử như mục 5.
