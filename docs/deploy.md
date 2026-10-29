# Deploy 9mua.com lên VPS

Kiến trúc: **Nginx trên host** (cổng 80/443, SSL) → **app trong Docker** ở `127.0.0.1:3009`.
`db` (PostgreSQL 16) và `worker` (xử lý video) chạy cùng trong `docker-compose.yml`.
Không container nào mở cổng ra Internet.

```
Internet ──443──▶ Nginx (host) ──▶ 127.0.0.1:3009 app ──▶ db
                     │ /uploads/* đọc thẳng /srv/9mua/uploads        worker ──▶ db, /srv/9mua/uploads
                     │ /api/internal/* → 404 (chỉ cron trên VPS gọi thẳng 127.0.0.1:3009)
```

## Thứ tự làm lần đầu

1. Chuyển DNS về Cloudflare (mục 1). Làm trước vì phải chờ, có khi tới 24 giờ.
2. Chuẩn bị VPS (mục 2) và lấy mã nguồn bằng khoá chỉ đọc (mục 3).
3. Điền `.env` (mục 4), chạy ứng dụng (mục 5).
4. Lấy chứng chỉ HTTPS và bật Nginx (mục 6). Cần DNS ở bước 1 đã chạy.
5. Tạo tài khoản CEO và cài 2 lớp ngay, đăng ký webhook PayOS (mục 7), bật cron (mục 8).
6. Kiểm tra theo mục 12. Các lần sau chỉ cần cập nhật bằng 1 lệnh (mục 9).

## 1. DNS trên Cloudflare (làm trên trình duyệt)

Mỗi Kiot là một tên miền phụ `tenkiot.9mua.com`, nên cần chứng chỉ HTTPS **wildcard** `*.9mua.com`. Let's Encrypt chỉ
cấp loại này khi chứng minh được quyền sở hữu bằng bản ghi DNS, và chứng chỉ phải gia hạn khoảng 60 ngày một lần.
Cloudflare (miễn phí) có API để certbot tự làm việc đó, nên không phải thêm bản ghi bằng tay.

1. Ở trang quản lý tên miền hiện tại (nơi mua 9mua.com), **chụp lại toàn bộ bản ghi DNS**, nhất là `MX` và `TXT`
   (email `@9mua.com` nếu có). Đang bật **DNSSEC** thì tắt trước, nếu không tên miền sẽ ngừng chạy khi đổi nameserver.
2. Đăng ký https://dash.cloudflare.com → **Add a domain** → nhập `9mua.com` → để Cloudflare tự quét bản ghi →
   chọn gói **Free**.
3. So danh sách Cloudflare quét được với ảnh chụp ở bước 1, thiếu thì thêm. Rồi đặt:

   | Type | Name | Content (IPv4) | Proxy status |
   |---|---|---|---|
   | A | `@` | IP của VPS | **DNS only** (đám mây xám) |
   | A | `*` | IP của VPS | **DNS only** (đám mây xám) |

   - Xoá các bản ghi `A`/`CNAME` cũ trỏ về hosting hay trang đỗ tên miền (ví dụ `www`): bản ghi cụ thể được ưu tiên
     hơn `*`. Giữ nguyên `MX`/`TXT` của email.
   - Chỉ thêm `AAAA` (IPv6) khi VPS có IPv6 và chắc chắn địa chỉ đúng.
   - **Vì sao để xám, không bật đám mây cam (proxy):** gói Free chặn file tải lên lớn hơn 100MB, trong khi video
     được phép tới 100MB. Ngoài ra Nginx sẽ thấy IP của Cloudflare thay vì IP khách, nên giới hạn đăng nhập theo IP
     chặn nhầm mọi người cùng lúc và nhật ký CEO ghi sai IP. Muốn bật cam sau này thì phải sửa cấu hình Nginx trước.
4. Cloudflare đưa 2 nameserver dạng `xxx.ns.cloudflare.com`. Vào trang quản lý tên miền ở nhà cung cấp →
   mục **Nameserver / Máy chủ tên miền** → thay toàn bộ nameserver cũ bằng 2 cái đó → lưu.
5. Quay lại Cloudflare bấm **Check nameservers**. Thường xong trong 1 giờ, lâu nhất 24–48 giờ; Cloudflare gửi email
   khi tên miền chuyển sang **Active**.
6. Kiểm tra trên máy tính bất kỳ: `nslookup 9mua.com` và `nslookup thu.9mua.com` đều ra IP của VPS.

**API token cho certbot** (để chứng chỉ tự gia hạn): Cloudflare → biểu tượng tài khoản góc phải → **My Profile** →
**API Tokens** → **Create Token** → mẫu **Edit zone DNS** → **Use template** → *Zone Resources*: `Include` ·
`Specific zone` · `9mua.com` → **Continue to summary** → **Create Token**. Token chỉ hiện 1 lần: dán thẳng vào VPS
ở mục 6, **không gửi qua chat hay email**. Token chỉ sửa được DNS của 9mua.com; lỡ lộ thì xoá ở cùng trang rồi tạo lại.

**Email Brevo** (để thư không vào spam): Brevo → *Senders, Domains & Dedicated IPs* → **Domains** → thêm `9mua.com`
→ thêm đúng các bản ghi Brevo hiển thị (mã xác minh, DKIM, DMARC) vào Cloudflare, để **DNS only** → bấm xác minh.

## 2. Chuẩn bị VPS một lần

Ubuntu 22.04 hoặc 24.04. Chạy bằng user có quyền `sudo` (hoặc `root`).

```bash
sudo timedatectl set-timezone Asia/Ho_Chi_Minh     # cron chạy theo giờ Việt Nam
sudo apt update && sudo apt install -y git curl rsync nginx certbot python3-certbot-dns-cloudflare
sudo rm -f /etc/nginx/sites-enabled/default

# Tường lửa: chỉ mở SSH, 80, 443 (và 8189 cho Live). SSH KHÔNG ở cổng 22 thì thay "OpenSSH" bằng "<cổng>/tcp",
# nếu không sẽ tự khoá mình ở ngoài.
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
# Live: hình và tiếng đi qua cổng 8189 (UDP, TCP dự phòng). Xem thêm mục 4 "Live".
sudo ufw allow 8189/udp && sudo ufw allow 8189/tcp

# Docker Engine + plugin compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # rồi đăng xuất, đăng nhập lại

# Thư mục dữ liệu (ảnh, video công khai / ảnh CCCD riêng tư). Container chạy bằng user node (uid 1000)
sudo mkdir -p /srv/9mua/uploads /srv/9mua/private /srv/9mua/backups
sudo chown -R 1000:1000 /srv/9mua/uploads /srv/9mua/private
sudo chmod 750 /srv/9mua/private
```

## 3. Lấy mã nguồn từ GitHub (VPS tự kéo code)

VPS dùng một **deploy key chỉ đọc** của riêng repo 9mua. GitHub không giữ khoá nào để vào VPS. Nếu khoá trên VPS bị lộ,
người khác chỉ đọc được code, không sửa được.

1. Chuyển repo sang **Private**: GitHub → repo `9mua` → **Settings** → **General** → cuối trang (*Danger Zone*) →
   **Change visibility** → **Make private**.
2. Trên VPS, tạo khoá và in khoá công khai ra:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "9mua-vps-deploy" -f ~/.ssh/9mua_deploy
   cat >> ~/.ssh/config <<'EOF'
   Host github-9mua
     HostName github.com
     User git
     IdentityFile ~/.ssh/9mua_deploy
     IdentitiesOnly yes
   EOF
   chmod 600 ~/.ssh/config
   cat ~/.ssh/9mua_deploy.pub   # khoá CÔNG KHAI (dòng bắt đầu bằng ssh-ed25519), chép đi đâu cũng an toàn
   ```

3. GitHub → repo → **Settings** → **Deploy keys** → **Add deploy key** → *Title* `VPS 9mua`, dán dòng vừa chép,
   **không** tick *Allow write access* → **Add key**.
4. Thử kết nối rồi lấy code:

   ```bash
   ssh -T git@github-9mua
   # Lần đầu máy hỏi "Are you sure you want to continue connecting?": vân tay ED25519 phải đúng là
   # SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU (đối chiếu ở docs.github.com, trang
   # "GitHub's SSH key fingerprints") thì mới gõ yes. Thành công: "Hi haitruongphuc-tech/9mua! You've successfully authenticated"
   sudo mkdir -p /opt/9mua && sudo chown $USER /opt/9mua
   git clone git@github-9mua:haitruongphuc-tech/9mua.git /opt/9mua
   ```

Khoá riêng `~/.ssh/9mua_deploy` (không có `.pub`) không bao giờ rời VPS.

## 4. File `.env`

```bash
cd /opt/9mua
cp .env.example .env && chmod 600 .env
nano .env   # điền giá trị thật, Ctrl+O Enter để lưu, Ctrl+X để thoát
```

Không đặt `HOSTNAME` trong `.env`: image Docker dùng `HOSTNAME=0.0.0.0`. Đặt `127.0.0.1` sẽ làm mọi trang
Kiot trên tên miền phụ lỗi 500 khi chạy sau Nginx/HTTPS (xem ghi chú trong `src/middleware.ts`).

Tối thiểu cần điền trong `.env`:
- `POSTGRES_PASSWORD`: tạo bằng `openssl rand -hex 24`.
- `INTERNAL_CRON_TOKEN`: tạo bằng `openssl rand -hex 32`.
- `APP_ENCRYPTION_KEY`: tạo bằng `openssl rand -hex 32`. Mã hoá bí mật 2 lớp của CEO; **mất khoá này thì
  CEO phải cài lại 2 lớp**, nên chép một bản cất riêng (không để chung với bản sao lưu DB).
- `APP_URL=https://9mua.com`.
- `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`: lấy ở Brevo → *SMTP & API*.
- `PAYOS_*` (kênh nhận tiền) và, khi PayOS đã mở kênh chi hộ cho 9MUA CO.,LTD, `PAYOS_PAYOUT_*`. Để trống
  `PAYOS_PAYOUT_*` thì mọi yêu cầu rút vào hàng chờ CEO duyệt tay (chuyển bằng QR VietQR).

Kênh chi hộ PayOS cần:
- Nạp trước tiền vào tài khoản chi. Hệ thống báo CEO khi quỹ thấp hơn tổng yêu cầu đang chờ + 10.000.000đ.
- Cho phép lệnh chi tạo qua API được duyệt tự động trên trang PayOS. Nếu PayOS bắt duyệt tay từng lệnh,
  lệnh sẽ nằm ở trạng thái "đang chuyển" và hệ thống báo CEO sau 2 giờ.
- Thêm IP của VPS vào danh sách IP được phép gọi API chi hộ (nếu PayOS yêu cầu).

Đăng nhập Google (không bắt buộc; để trống thì ẩn nút "Tiếp tục với Google"):
1. Vào console.cloud.google.com → tạo dự án (vd. `9mua`).
2. *APIs & Services* → *OAuth consent screen*: chọn **External**, điền tên `9MUA`, email hỗ trợ, logo; mục
   *Authorized domains* thêm `9mua.com`; link chính sách `https://9mua.com/chinh-sach/bao-mat`. Phạm vi chỉ cần
   `openid`, `email`, `profile`. Bấm **Publish app** (không thì chỉ tài khoản thử đăng nhập được).
3. *Credentials* → *Create credentials* → *OAuth client ID* → **Web application**.
   *Authorized redirect URIs* điền đúng: `https://9mua.com/api/auth/google/callback`.
4. Chép *Client ID* vào `GOOGLE_CLIENT_ID`, *Client secret* vào `GOOGLE_CLIENT_SECRET`.

Đăng nhập Zalo (không bắt buộc; để trống thì ẩn nút "Tiếp tục với Zalo"):
1. Vào developers.zalo.me, đăng nhập bằng Zalo của công ty → **Tạo ứng dụng** (tên `9MUA`, danh mục Thương mại điện tử).
2. Trong ứng dụng → **Sản phẩm** → **Đăng nhập** (Social API). Mục *Callback URL* (đường dẫn quay về) điền đúng:
   `https://9mua.com/api/auth/zalo/callback`. Nếu Zalo bắt xác thực tên miền `9mua.com`, gửi Claude nội dung Zalo yêu cầu
   (file hoặc thẻ meta) để thêm vào web; không gửi khoá.
3. Bật (kích hoạt) ứng dụng. Ở *Cài đặt* → *Thông tin ứng dụng*: chép **ID ứng dụng** vào `ZALO_APP_ID`, **Khoá bí mật
   của ứng dụng** vào `ZALO_APP_SECRET`.
4. Zalo không cho biết email/SĐT: người đăng ký bằng Zalo sẽ được hỏi thêm email khi mở Kiot.

Đăng nhập Facebook (không bắt buộc; để trống thì ẩn nút "Tiếp tục với Facebook"):
1. Vào developers.facebook.com → *My Apps* → **Create App** → chọn trường hợp dùng *Xác thực người dùng bằng Facebook Login*.
2. *Facebook Login* → *Settings* → *Valid OAuth Redirect URIs*: `https://9mua.com/api/auth/facebook/callback`.
3. *App settings* → *Basic*: *App Domains* `9mua.com`; *Privacy Policy URL* `https://9mua.com/chinh-sach/bao-mat`;
   *Terms of Service URL* `https://9mua.com/chinh-sach/dieu-khoan`; *User data deletion* → *Data deletion instructions URL*
   `https://9mua.com/chinh-sach/bao-mat` (trang có mục xoá tài khoản); biểu tượng ứng dụng là logo 9MUA.
4. Quyền cần: `public_profile`, `email`. Để người ngoài (không phải tài khoản thử của app) đăng nhập được, Facebook bắt
   **xác minh doanh nghiệp** (Business Verification) và chuyển app sang **Live**; có thể phải gửi duyệt quyền `email`.
   Việc này mất vài ngày đến vài tuần; trong lúc chờ, nút Facebook chỉ dùng được với tài khoản thử của app.
5. Chép *App ID* vào `FACEBOOK_APP_ID`, *App Secret* vào `FACEBOOK_APP_SECRET`.

Mã đăng nhập qua email (luôn bật): gửi bằng SMTP Brevo đang dùng. Gói miễn phí của Brevo gửi được 300 email/ngày; đông
người đăng ký hơn thì nâng gói ở Brevo.

AI Studio (không bắt buộc, `SPEC-ai.md`):
- `ANTHROPIC_API_KEY`: tạo ở console.anthropic.com → *API Keys* (nạp trước ít tiền, vd. 5 USD). Dùng để AI viết
  mô tả; mỗi lần khoảng 20đ.
- `GEMINI_API_KEY`: tạo ở aistudio.google.com → *Get API key* (bật thanh toán cho dự án Google Cloud đi kèm).
  Dùng để AI vẽ ảnh; mỗi ảnh khoảng 1.000đ.
- Thiếu khoá nào thì phần đó hiện "Chưa bật", phần còn lại vẫn chạy. Video 10 giây do worker ghép bằng ffmpeg,
  không tốn phí AI.
- Sau khi điền khoá: vào `/admin/ai` bấm **Thử kết nối** từng phần để chắc khoá đúng. Ngân sách tháng (mặc định
  500.000đ), lượt mỗi ngày và công tắc bật/tắt chỉnh ở trang đó. Chạm ngân sách thì AI tạm dừng tới đầu tháng
  sau và CEO nhận email.
- Không bao giờ dán khoá vào chat hay gửi cho ai; chỉ điền trong `.env` trên VPS.

Live (`SPEC-live.md`):
- `LIVE_PUBLIC_IP`: IP công khai của VPS (xem bằng `curl -4 ifconfig.me`). Trình duyệt gửi/nhận hình thẳng tới IP
  này qua cổng **8189 UDP** (TCP dự phòng). Để trống thì người xem ngoài mạng VPS không thấy hình.
- Nếu nhà cung cấp VPS có tường lửa riêng trên trang quản lý (Security Group, Firewall…), mở thêm **8189 UDP và
  8189 TCP** ở đó, ngoài `ufw` ở mục 2.
- **Băng thông:** lúc cao điểm 2 buổi × 50 người × 1,5 Mbps ≈ 150 Mbps tải ra; 1 giờ live đủ 50 người tốn khoảng
  34 GB. Hỏi nhà cung cấp VPS tốc độ cổng mạng và giới hạn dung lượng tháng trước khi mở Live cho mọi người. Cổng
  chỉ 100 Mbps thì vào `/admin/cai-dat` hạ "Người xem tối đa mỗi buổi" xuống 30.
- MediaMTX (máy chủ hình) chạy thành service `mediamtx` trong `docker-compose.yml`, tự lên cùng app. Nó hỏi app
  trước mỗi lần phát/xem bằng `INTERNAL_CRON_TOKEN`; cổng quản trị 9997 không mở ra ngoài.

Sửa `.env` sau này: `docker compose up -d` để app nhận giá trị mới (không cần build lại).

## 5. Chạy ứng dụng lần đầu

```bash
cd /opt/9mua
docker compose up -d --build db
docker compose run --rm --build migrate   # áp migration database
docker compose up -d --build              # app + worker + mediamtx (build lần đầu mất 5–10 phút)
curl -s 127.0.0.1:3009/api/health         # → {"ok":true}
```

## 6. HTTPS (chứng chỉ wildcard) + Nginx

Cần DNS ở mục 1 đã **Active** và có API token Cloudflare.

```bash
sudo install -d -m 700 /root/.secrets
sudo nano /root/.secrets/cloudflare.ini
#   dán đúng 1 dòng:  dns_cloudflare_api_token = <token Cloudflare>
sudo chmod 600 /root/.secrets/cloudflare.ini

sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 -d 9mua.com -d '*.9mua.com' \
  --deploy-hook 'systemctl reload nginx'
sudo certbot renew --dry-run   # thử gia hạn: phải báo "all simulated renewals succeeded"
```

Certbot tự gia hạn trước khi hết hạn và tự nạp lại Nginx (`--deploy-hook`), không phải làm gì thêm.

Bật site:

```bash
sudo cp deploy/nginx/ninemua-proxy.conf /etc/nginx/snippets/ninemua-proxy.conf
sudo cp deploy/nginx/9mua.conf /etc/nginx/sites-available/9mua.conf
# VPS không có IPv6 thì bỏ các dòng "listen [::]" (nếu không Nginx báo "Address family not supported")
[ -f /proc/net/if_inet6 ] || sudo sed -i '/listen \[::\]/d' /etc/nginx/sites-available/9mua.conf
sudo ln -sf /etc/nginx/sites-available/9mua.conf /etc/nginx/sites-enabled/9mua.conf
sudo nginx -t && sudo systemctl reload nginx
```

Nginx của Ubuntu 24.04 là bản 1.24: `deploy/nginx/9mua.conf` dùng cú pháp `listen 443 ssl http2` cho bản này
(bản 1.25 trở lên chỉ cảnh báo "deprecated", vẫn chạy). Nếu VPS đã có site cũ cho `9mua.com` trong
`/etc/nginx/sites-enabled/`, sao lưu rồi gỡ link của site cũ trước khi `nginx -t`, tránh trùng tên miền.

Mở `https://9mua.com` và `https://thu.9mua.com`: phải có ổ khoá hợp lệ.

`deploy/nginx/9mua.conf` đã có 2 chỗ cho Live: `/live-media/` chuyển vào MediaMTX (`127.0.0.1:8889`) để gửi/nhận
hình, và đường `/api/live/<id>/events` tắt gom dữ liệu để chat, tim hiện ngay. Bản cũ chưa có thì chép lại file
như trên.

## 7. Tài khoản CEO + webhook PayOS

```bash
cd /opt/9mua
# Tạo tài khoản CEO (hỏi mật khẩu ẩn; tài khoản đã có thì chỉ nâng quyền).
docker compose run --rm app node dist/scripts/create-admin.mjs --phone 0979393916 --name "Nguyễn Hải"
```

**Ngay sau đó** đăng nhập tại `https://9mua.com/dang-nhap?next=/admin` để cài xác thực 2 lớp (`/admin` trả 404 cho
mọi người chưa đăng nhập bằng tài khoản CEO, để không lộ trang quản trị), trước khi ai khác kịp đăng nhập. Cất 10 mã
dự phòng ở nơi an toàn. Mất điện thoại 2 lớp và cả 10 mã dự phòng thì cài lại bằng lệnh:
`docker compose run --rm app node dist/scripts/create-admin.mjs --phone 0979393916 --reset-2fa`

```bash
# Đăng ký webhook PayOS (cần PAYOS_* trong .env và HTTPS ở mục 6 đã chạy)
docker compose run --rm app node dist/scripts/payos-confirm-webhook.mjs https://9mua.com/api/payos/webhook
```

## 8. Cron

File mẫu: `deploy/cron/9mua.cron`. Các route được bổ sung dần theo task T15, T17, T21, T25, T35.

```bash
sudo cp deploy/cron/9mua.cron /etc/cron.d/9mua && sudo chmod 644 /etc/cron.d/9mua
```

Cron gọi thẳng `127.0.0.1:3009` kèm header `X-Internal-Token: $INTERNAL_CRON_TOKEN`. Route
`/api/internal/*` bị Nginx chặn từ bên ngoài, và app kiểm token (vì trong Docker, app không phân biệt
được request đi từ Nginx hay từ cron).

## 9. Cập nhật phiên bản mới

Mỗi khi có bản mới trên GitHub, chạy trên VPS:

```bash
cd /opt/9mua && sh scripts/deploy.sh
```

Script `scripts/deploy.sh` làm lần lượt:
1. Kéo code mới từ GitHub và in danh sách thay đổi. Không có gì mới thì dừng.
2. Build bản mới trong khi web cũ vẫn chạy (vài phút).
3. Sao lưu database vào `/srv/9mua/backups/`.
4. Nâng cấp database (migration).
5. Chuyển sang bản mới (web gián đoạn vài giây), rồi kiểm tra web và worker chạy được trong 90 giây.
6. Bật (hoặc tạo lại khi cấu hình đổi) máy chủ hình `mediamtx` cho Live. Lỗi ở bước này chỉ báo, không quay về.

Lỗi ở bất kỳ bước nào thì script **tự quay về code và bản cũ**, in lý do và đường dẫn bản sao lưu. Script cũng nhắc
khi bản mới đổi file cấu hình cron/Nginx (chép lại theo mục 6 và 8) hoặc thêm biến mới vào `.env.example`.

Sau khi cập nhật mới phát hiện lỗi (web vẫn chạy nhưng có tính năng sai), quay về bản trước bằng:

```bash
cd /opt/9mua && sh scripts/deploy.sh --rollback
```

Database giữ nguyên vì migration chỉ thêm, bản cũ vẫn chạy được. Lần chạy `deploy.sh` tiếp theo sẽ lấy lại bản mới
nhất trên GitHub, nên chỉ chạy khi đã có bản sửa lỗi.

**Không bật tự cập nhật theo lịch.** Hệ thống đang giữ tiền, nên mỗi lần cập nhật phải có người chọn giờ vắng khách
và theo dõi tới khi xong.

## 10. Google Search Console

Xác minh `9mua.com` dạng **Domain property**: Search Console đưa một bản ghi `TXT`, thêm vào Cloudflare (mục 1).
Cách này giúp Google nhận cả các link `tenkiot.9mua.com` trong `https://9mua.com/sitemap.xml`. Sau đó gửi sitemap đó.

## 11. Sao lưu database

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

## 12. Kiểm tra sau deploy

- [ ] `https://9mua.com` và `https://abc.9mua.com` có ổ khoá HTTPS hợp lệ; `sudo certbot renew --dry-run` thành công.
- [ ] `https://9mua.com/api/internal/x` trả 404.
- [ ] `docker compose ps`: `app` healthy, `db` healthy, `worker` running.
- [ ] `docker compose port db 5432` không trả gì (database không mở ra ngoài).
- [ ] `docker compose run --rm worker ffmpeg -version` chạy được (worker có ffmpeg).
- [ ] Gửi liên tục 7 lần form đăng nhập sai: lần thứ 7 trở đi nhận lỗi 429 (giới hạn theo IP).
- [ ] `sh scripts/backup-db.sh` chạy tay 1 lần thành công, rồi khôi phục thử như mục 11.
- [ ] Live: `docker compose logs --tail 50 mediamtx | sed 's/key=[^" ]*/key=***/g'` (lệnh tự che khoá nội bộ) không có dòng `ERR`; `curl 127.0.0.1:9997` báo "Connection refused"
  (cổng quản trị không mở ra host). Dùng 2 điện thoại khác mạng (1 máy 4G): máy A vào `/live/phat` bấm phát, máy B
  vào `/live` thấy hình trong vài giây, chat qua lại được. Không thấy hình thì kiểm lại `LIVE_PUBLIC_IP` và cổng
  8189 (mục 2, mục 4).
- [ ] Sau vài ngày có live: `/admin/live` xem dòng "lượt xem không kết nối được hình". Vượt 5% thì cần thêm máy chủ
  TURN (nhắn Claude làm).

## 13. Dữ liệu mẫu để thử (xoá trước khi mở cửa)

Tạo 6 Kiot "(Mẫu)", 40 sản phẩm có ảnh, 6 video và 1 tài khoản người bán mẫu (email + mật khẩu in ra màn hình).
Không tạo đơn hàng hay thanh toán: sổ tiền chỉ thêm, không xoá được. Chạy trong container `worker` vì cần ffmpeg:

```bash
cd /opt/9mua && docker compose run --rm worker node dist/scripts/seed-demo.mjs
# đã có dữ liệu mẫu cũ thì: ... seed-demo.mjs --lam-lai   (xoá rồi tạo lại)
```

**Ảnh và video thật:** thêm dòng `PIXABAY_API_KEY=<khoá>` vào `.env` (khoá miễn phí: đăng nhập pixabay.com rồi mở
pixabay.com/api/docs; giấy phép Pixabay cho dùng thương mại, không bắt ghi nguồn). Pexels tạm ngừng cấp khoá mới;
ai đã có khoá thì dùng `PEXELS_API_KEY`. Không có khoá, hoặc kho ảnh lỗi, thì script dùng ảnh vẽ sẵn.

**Trước khi mở cửa** xoá sạch (tài khoản, Kiot, sản phẩm, video, file ảnh/video):

```bash
cd /opt/9mua && docker compose run --rm worker node dist/scripts/seed-demo.mjs --xoa
```

Nếu đã lỡ đặt đơn trên Kiot mẫu thì lệnh xoá chỉ khoá và ẩn (đơn và sổ tiền không xoá được).
