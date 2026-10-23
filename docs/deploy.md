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

Tối thiểu cần điền trong `.env`:
- `POSTGRES_PASSWORD`: tạo bằng `openssl rand -hex 24`.
- `INTERNAL_CRON_TOKEN`: tạo bằng `openssl rand -hex 32`.
- `APP_URL=https://9mua.com`.

## 2. Chạy ứng dụng

```bash
docker compose up -d --build db
docker compose run --rm migrate        # áp migration database
docker compose up -d --build           # app + worker
curl -s 127.0.0.1:3009/api/health      # → {"ok":true}
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

## 4. Cron

File mẫu: `deploy/cron/9mua.cron`. Các route được bổ sung dần theo task T15, T17, T21, T25, T35.

```bash
sudo cp deploy/cron/9mua.cron /etc/cron.d/9mua && sudo chmod 644 /etc/cron.d/9mua
```

Cron gọi thẳng `127.0.0.1:3009` kèm header `X-Internal-Token: $INTERNAL_CRON_TOKEN`. Route
`/api/internal/*` bị Nginx chặn từ bên ngoài, và app kiểm token (vì trong Docker, app không phân biệt
được request đi từ Nginx hay từ cron).

## 5. Sao lưu database

`scripts/backup-db.sh` (task T37) dump hằng ngày lúc 2:00 vào `/srv/9mua/backups`, giữ 14 bản.
**Nên chép thêm ra ngoài VPS** (Google Drive, S3…).

Khôi phục thử:

```bash
gunzip -c /srv/9mua/backups/<file>.sql.gz | docker compose exec -T db psql -U ninemua -d ninemua
```

## 6. Kiểm tra sau deploy

- [ ] `https://9mua.com` và `https://abc.9mua.com` có ổ khoá HTTPS hợp lệ.
- [ ] `https://9mua.com/api/internal/x` trả 404.
- [ ] `docker compose ps`: `app` healthy, `db` healthy, `worker` running.
- [ ] `docker compose port db 5432` không trả gì (database không mở ra ngoài).
