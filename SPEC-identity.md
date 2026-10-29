# Spec: `identity` — Tài khoản, đăng nhập, phân quyền

> Module đầu tiên trong `CAPABILITY-MAP.md`. Spec này cũng chốt **nền móng kỹ thuật dùng chung** cho
> mọi module sau (tech stack, lệnh, cấu trúc, code style, test, ranh giới).
> Các module sau chỉ ghi phần khác biệt so với spec này.

## Objective

Cho phép mọi người tạo tài khoản 9mua bằng số điện thoại hoặc email cộng mật khẩu, đăng nhập một lần
và dùng được trên cả `9mua.com` lẫn mọi `tenkiot.9mua.com`. Module cũng gán vai trò để các module sau
biết ai được làm gì.

Người dùng:
- **Người mua / creator:** đăng ký để đặt hàng và đăng video.
- **Người bán:** cũng là tài khoản thường. Họ trở thành `seller` khi tạo Kiot (module `kiot`).
- **CEO (`admin`):** được tạo bằng lệnh CLI trên VPS, không đăng ký qua web.

### User stories & tiêu chí chấp nhận

1. **Đăng ký**: nhập định danh (SĐT Việt Nam `0xxxxxxxxx` hoặc email), tên hiển thị, mật khẩu ≥ 8 ký tự.
   - Định danh được chuẩn hoá: SĐT về dạng `+84…`, email về chữ thường. Định danh trùng thì báo
     "Tài khoản đã tồn tại".
   - Mật khẩu chỉ lưu dạng băm argon2id, không bao giờ lưu, log hay trả về dạng gốc.
   - Đăng ký thành công thì đăng nhập luôn và chuyển về trang trước đó (mặc định `/`).
2. **Đăng nhập**: định danh + mật khẩu.
   - Sai thông tin chỉ báo chung "Sai tài khoản hoặc mật khẩu", không tiết lộ tài khoản có tồn tại hay không.
   - Sai 5 lần trong 15 phút (tính theo định danh) thì khoá đăng nhập định danh đó 15 phút.
3. **Phiên đăng nhập**: cookie `httpOnly`, `Secure`, `SameSite=Lax`, domain `.9mua.com`, hạn 30 ngày,
   tự gia hạn khi dùng.
   - Chỉ lưu **mã băm** của token trong DB, nên lộ DB cũng không chiếm được phiên.
   - Đăng xuất xoá phiên trên server. Có nút "Đăng xuất khỏi mọi thiết bị".
4. **Đổi mật khẩu** khi đã đăng nhập (nhập mật khẩu cũ). Đổi xong thì huỷ mọi phiên khác.
5. **Quên mật khẩu qua email** tại `/quen-mat-khau`:
   - Người dùng nhập email. Hệ thống **luôn** trả lời "Nếu email tồn tại, chúng tôi đã gửi link đặt
     lại mật khẩu", để không lộ email nào đã đăng ký.
   - Link `/dat-lai-mat-khau?token=…` có token ngẫu nhiên 32 byte. DB chỉ lưu mã băm của token.
     Link hết hạn sau 30 phút và chỉ dùng được 1 lần.
   - Đặt mật khẩu mới thành công thì huỷ mọi phiên và mọi token đặt lại khác của tài khoản đó.
   - Mỗi email được yêu cầu tối đa 3 lần/giờ.
   - Tài khoản chỉ có SĐT có thể thêm email trong `/tai-khoan` để dùng tính năng này. Nếu không có
     email thì liên hệ CEO: `resetPassword(userId)` trong trang admin tạo mật khẩu tạm và buộc đổi
     ở lần đăng nhập sau.
   - Gửi mail qua SMTP (nodemailer), cấu hình bằng biến môi trường `SMTP_*`. Đổi nhà cung cấp
     (Resend, Brevo, Gmail…) không cần sửa code.
   - Môi trường dev và test không gửi mail thật mà ghi ra console hoặc hộp thư giả.
6. **Vai trò**: `user` (mặc định, mua và đăng video được), `admin`. Vai trò `seller` **không lưu** ở đây
   mà suy ra từ việc tài khoản có Kiot.
7. **Khoá tài khoản**: cờ `lockedAt`. Tài khoản bị khoá thì không đăng nhập được và mọi phiên bị huỷ
   (CEO thao tác từ `admin`).
8. **Tạo CEO**: `npm run user:create-admin -- --phone 0979393916`. Lệnh hỏi mật khẩu ở terminal,
   không nhận mật khẩu qua tham số dòng lệnh.

### Giao diện cung cấp cho module khác (hợp đồng)

```ts
// src/modules/identity/index.ts — chỉ export những hàm này
getCurrentUser(): Promise<SessionUser | null>         // đọc cookie, dùng trong Server Component / Route Handler
requireUser(): Promise<SessionUser>                    // chưa đăng nhập → redirect /dang-nhap?next=...
requireAdmin(): Promise<SessionUser>                   // không phải admin → 404
lockUser(userId: string): Promise<void>
resetPassword(userId: string): Promise<{ tempPassword: string }>

type SessionUser = { id: string; displayName: string; role: 'user' | 'admin'; phone: string | null; email: string | null }
```

### Trang

`/dang-ky`, `/dang-nhap`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/tai-khoan` (thông tin, thêm/sửa email, đổi mật khẩu, đăng xuất mọi thiết bị).

## Tech Stack (chung cho toàn dự án)

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Runtime | Node.js 22 LTS **trong Docker image** | Không phụ thuộc phiên bản Node trên VPS |
| Framework | Next.js 15 (App Router) + TypeScript `strict` | Một codebase cho web + API, SSR tốt cho SEO trang Kiot |
| DB | PostgreSQL 16 | Giao dịch tiền cần ACID |
| ORM | Prisma 6 | Migration rõ ràng, type-safe |
| Validation | Zod | Kiểm tra mọi input ở biên |
| Mật khẩu | `@node-rs/argon2` (argon2id) | Chuẩn hiện hành, không cần build native |
| UI | Tailwind CSS 4, mobile-first, màu và logo theo `docs/BRAND.md` | Logo chính thức CEO duyệt 23/10/2026 |
| Đóng gói | Dockerfile multi-stage (Next `output: 'standalone'`) + `docker-compose.yml` gồm `app` và `db` (Postgres 16, volume riêng) | Một lệnh để deploy, chạy giống nhau ở mọi máy |
| Cổng | `app` chỉ mở `127.0.0.1:3009`. `db` không mở cổng ra ngoài | Không đụng tới các site khác đang chạy trên VPS |
| Reverse proxy + HTTPS | **Nginx sẵn có trên VPS** proxy `9mua.com` và `*.9mua.com` → `127.0.0.1:3009`, giữ nguyên header `Host`. Chứng chỉ wildcard `*.9mua.com` cấp bằng certbot DNS-01. Mẫu cấu hình nằm ở `deploy/nginx/9mua.conf` | Giữ Nginx làm máy chủ chính như anh yêu cầu |
| Email | nodemailer qua SMTP **Brevo** (`smtp-relay.brevo.com:587`), cấu hình bằng `SMTP_*` | Đổi nhà cung cấp không cần sửa code |
| Test | Vitest (unit + integration với Postgres thật), Playwright (e2e) | |

Không dùng Auth.js: chỉ cần đăng nhập bằng mật khẩu, nên tự viết ~200 dòng sẽ dễ kiểm soát cookie
dùng chung cho mọi `*.9mua.com` hơn.

## Commands

```bash
npm install
npm run dev                       # http://localhost:3000
npm run build && npm start        # production
npm run lint                      # eslint + tsc --noEmit
npm test                          # vitest run (cần DATABASE_URL_TEST)
npm run test:e2e                  # playwright
npx prisma migrate dev --name <ten>    # tạo migration (local)
npx prisma migrate deploy              # áp migration trên VPS
npm run user:create-admin -- --phone 0979393916

# Docker (local giống production)
docker compose up -d --build          # app (127.0.0.1:3009) + db
docker compose exec app npx prisma migrate deploy
docker compose exec app node scripts/create-admin.js --phone 0979393916

# Deploy lên VPS (chi tiết trong docs/deploy.md)
git pull && docker compose up -d --build && docker compose exec app npx prisma migrate deploy
```

## Project Structure

```
prisma/schema.prisma          → Schema DB (mọi module)
prisma/migrations/            → Migration, commit vào git
src/app/                      → Route Next.js (chỉ mỏng: gọi module, render UI)
src/app/(auth)/dang-nhap/     → Trang đăng nhập …
src/modules/<module-id>/      → Logic nghiệp vụ mỗi module (đúng id trong CAPABILITY-MAP)
  index.ts                    → Hợp đồng public. Module khác CHỈ import từ đây
  *.ts                        → Nội bộ module
  *.test.ts                   → Test cạnh code
src/lib/                      → Tiện ích dùng chung (db client, env, rate-limit)
src/components/               → UI dùng chung
scripts/                      → CLI (create-admin…)
e2e/                          → Playwright
Dockerfile, docker-compose.yml → Đóng gói và chạy
deploy/nginx/9mua.conf        → Mẫu server block Nginx trên host
.env.example                  → Danh sách biến môi trường (không chứa giá trị thật)
docs/deploy.md                → Hướng dẫn deploy lên VPS bằng Docker
```

## Code Style

```ts
// src/modules/identity/register.ts
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from './password';
import { normalizeIdentifier } from './identifier';

export const registerInput = z.object({
  identifier: z.string().trim().min(1),
  displayName: z.string().trim().min(2).max(50),
  password: z.string().min(8).max(128),
});

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: 'IDENTIFIER_INVALID' | 'IDENTIFIER_TAKEN' };

export async function register(raw: unknown): Promise<RegisterResult> {
  const input = registerInput.parse(raw);
  const id = normalizeIdentifier(input.identifier);
  if (!id) return { ok: false, error: 'IDENTIFIER_INVALID' };

  const exists = await db.user.findUnique({ where: id.where });
  if (exists) return { ok: false, error: 'IDENTIFIER_TAKEN' };

  const user = await db.user.create({
    data: { ...id.data, displayName: input.displayName, passwordHash: await hashPassword(input.password) },
  });
  return { ok: true, userId: user.id };
}
```

- Tên code bằng **tiếng Anh**, URL và chữ hiển thị bằng **tiếng Việt** (`/dang-nhap`).
- Lỗi nghiệp vụ dự đoán được thì trả về kiểu kết quả (`ok: false`), không `throw`. Chỉ `throw` khi lỗi bất ngờ.
- Tiền luôn là số nguyên **VNĐ** (`Int`), không dùng số thực.
- ID dùng `cuid2`. Thời gian lưu UTC, hiển thị giờ `Asia/Ho_Chi_Minh`.
- File ≤ 300 dòng, hàm làm một việc. Prettier mặc định, dấu nháy đơn.

## Testing Strategy

- **Unit (Vitest):** chuẩn hoá SĐT/email, băm/kiểm mật khẩu, logic khoá sau 5 lần sai.
- **Integration (Vitest + Postgres test thật, reset mỗi file):** register → login → getCurrentUser →
  logout; đổi mật khẩu huỷ phiên khác; tài khoản bị khoá không đăng nhập được; token trong DB là mã băm;
  quên mật khẩu → token hết hạn hoặc đã dùng thì bị từ chối → đặt lại xong thì huỷ phiên cũ.
- **Docker smoke test:** `docker compose up` trên máy sạch, sau đó `/api/health` trả 200.
- **E2E (Playwright):** đăng ký → thấy tên trên header → đăng xuất → đăng nhập lại.
- Mục tiêu: mọi tiêu chí chấp nhận ở trên đều có ít nhất 1 test. Coverage `src/modules/identity` ≥ 90%.
- Viết test trước (TDD). Sửa lỗi nào cũng thêm test tái hiện lỗi đó trước.

## Boundaries

- **Luôn làm:**
  - Kiểm tra input bằng Zod.
  - Chạy `npm run lint && npm test` trước khi commit.
  - Mỗi thay đổi schema đi kèm migration.
  - Module khác chỉ import từ `index.ts`.
  - Commit nhỏ, mỗi commit một việc.
- **Hỏi trước:**
  - Thêm dependency mới.
  - Đổi schema của bảng đã có dữ liệu thật.
  - Đổi hợp đồng `index.ts`.
  - Thao tác trực tiếp trên VPS hoặc DB production.
- **Không bao giờ:**
  - Commit `.env` hay bí mật (PayOS key, mật khẩu DB).
  - Log mật khẩu, token hoặc cookie.
  - Lưu mật khẩu hay token ở dạng gốc.
  - Xoá hoặc skip test đang fail để cho qua.
  - Mở đăng ký vai trò `admin` qua web.

## Success Criteria

- [ ] Đăng ký bằng SĐT và bằng email đều được. Định danh trùng bị từ chối dù khác cách viết
      (`0979…` = `+84979…`, `A@x.com` = `a@x.com`).
- [ ] Đăng nhập ở `9mua.com` thì vào `abc.9mua.com` vẫn đang đăng nhập.
- [ ] Sai mật khẩu lần thứ 6 trong 15 phút bị chặn, kể cả khi lần đó nhập đúng mật khẩu.
- [ ] Bảng `Session` không chứa token gốc. Bảng `User` không chứa mật khẩu gốc.
- [ ] `requireAdmin()` trả 404 cho tài khoản thường.
- [ ] Quên mật khẩu: nhận được mail, link dùng được đúng 1 lần, hết hạn sau 30 phút, đặt lại xong thì mọi thiết
      bị khác bị đăng xuất. Nhập email chưa đăng ký vẫn thấy cùng một thông báo.
- [ ] Trên VPS: `docker compose up -d --build` + bật `deploy/nginx/9mua.conf` xong thì `https://9mua.com` và `https://abc.9mua.com` đều chạy qua Nginx. Các site khác trên VPS không bị ảnh hưởng.
- [ ] `npm run lint`, `npm test`, `npm run test:e2e` đều xanh.

## Open Questions

1. Chứng chỉ wildcard `*.9mua.com` cần một API key DNS (hoặc thêm thủ công 1 bản ghi TXT mỗi 90 ngày).
   Xử lý lúc deploy, không chặn việc viết code.

## Bổ sung 27/10/2026 — Đăng nhập Google, popup mở tài khoản (CEO duyệt qua chat, câu 3 "popup", câu 4 "Google")

### Đăng nhập bằng Google
- Nút "Tiếp tục với Google" trên trang đăng nhập, đăng ký và popup. Chỉ hiện khi đã cấu hình `GOOGLE_CLIENT_ID` và
  `GOOGLE_CLIENT_SECRET` (CEO tạo trong Google Cloud theo `docs/deploy.md`).
- Chuẩn OAuth 2.0 / OpenID Connect, luồng authorization code có **PKCE**, `state` và `nonce` chống giả mạo. Địa chỉ quay về
  luôn là tên miền chính `https://9mua.com/api/auth/google/callback`.
- Máy chủ đổi mã lấy `id_token`, **tự kiểm chữ ký** bằng khoá công khai của Google (JWKS) và kiểm `iss`, `aud`, `exp`,
  `nonce`. Chỉ nhận email đã được Google xác minh (`email_verified`). Không thêm thư viện npm.
- Tài khoản đã liên kết Google (cột `googleSub`) thì đăng nhập luôn.
- Email Google **trùng tài khoản có sẵn** thì **không tự liên kết**: hiện "Email này đã có tài khoản 9MUA. Đăng nhập bằng
  mật khẩu một lần để liên kết Google." Đăng nhập mật khẩu đúng trong 10 phút thì liên kết. Chống kẻ xấu tạo trước tài
  khoản bằng email người khác.
- Email chưa có tài khoản thì tạo tài khoản mới (tên lấy từ Google, mật khẩu ngẫu nhiên không ai biết; muốn đăng nhập bằng
  mật khẩu thì dùng "Quên mật khẩu").
- Tài khoản admin **không** đăng nhập bằng Google.
- Dữ liệu: thêm cột `googleSub` (trống, duy nhất) vào bảng `User`. Chỉ thêm cột, dữ liệu cũ không đổi.

### Popup mở tài khoản (V4)
- Khách chưa đăng nhập vào web lần đầu: sau **1,2 giây** hiện bảng trượt từ dưới lên (V4): logo, "Mở tài khoản miễn phí -
  Dùng như TikTok - Không cần mua Kiot", nút Google, ô tên + SĐT/email + mật khẩu, nút "MỞ TÀI KHOẢN MIỄN PHÍ", và
  "Để sau, xem trước đã".
- Bấm "Để sau" hoặc ✕ thì **30 ngày** không hiện lại. Không hiện trên trang đăng nhập/đăng ký, admin, thanh toán.
- Đăng ký trong popup dùng đúng luồng đăng ký hiện có (cùng kiểm tra, cùng giới hạn).
- Rủi ro đã báo CEO: Google có thể hạ hạng trang có popup che nội dung trên điện thoại. Popup chỉ hiện 1 lần và đóng được ngay.

## Bổ sung 29/10/2026 — Đăng ký bằng Zalo, Google, Facebook, Email mã OTP (CEO duyệt qua chat)

### Màn đăng ký, đăng nhập, popup
- **Đăng ký** (trang `/dang-ky` và popup) chỉ còn 4 nút: **Zalo**, **Google**, **Facebook**, **Email** (nhận mã). Bỏ form
  đăng ký SĐT + mật khẩu khỏi giao diện. Nút nào chưa cấu hình khoá thì ẩn (Email luôn có).
- **Đăng nhập** (`/dang-nhap`): 4 nút trên, và form SĐT/email + mật khẩu cho tài khoản cũ và admin.
- **Nhớ đăng nhập 30 ngày**: giữ như hiện có (phiên 30 ngày, tự gia hạn khi còn dùng), áp dụng cho mọi cách đăng nhập.
- Tài khoản **admin** chỉ đăng nhập bằng mật khẩu + xác thực 2 lớp; Zalo, Google, Facebook, mã email đều bị từ chối.
- Tài khoản bị khoá: mọi cách đăng nhập đều báo "Tài khoản đã bị khoá".

### Email mã OTP
- Nhập email → 9MUA gửi **mã 6 số** (email tiếng Việt, gửi qua SMTP đang dùng). Nhập đúng mã thì vào luôn, không cần mật
  khẩu. Email chưa có tài khoản thì tạo tài khoản mới, mật khẩu ngẫu nhiên.
- **Đăng ký chỉ cần email, không hỏi tên** (CEO chốt 29/10). Tên tạm "Thành viên 1234" (4 số ngẫu nhiên), **không** lấy
  phần trước `@` vì tên hiện công khai sẽ làm lộ email. Trang Tôi nhắc "Đặt tên hiển thị"; đặt trong Cài đặt tài khoản.
- Mã **hết hạn sau 10 phút**, dùng 1 lần, **sai 5 lần** thì mã hỏng phải xin mã mới.
- Chống lạm dụng: gửi lại sau **60 giây**; mỗi email tối đa **5 mã/giờ**; mỗi IP tối đa **20 mã/giờ**. Màn hình luôn báo
  "Đã gửi mã nếu email hợp lệ" để không lộ email nào đã có tài khoản.
- Mã lưu dạng băm HMAC (khoá `APP_ENCRYPTION_KEY`), không bao giờ ghi log mã.
- Mã email còn dùng để: (a) **liên kết Google/Facebook** khi email trùng tài khoản có sẵn (thay cho đăng nhập mật khẩu,
  vì tài khoản tạo bằng mã không có mật khẩu); (b) **thêm email** vào tài khoản chưa có email.

### Zalo
- Zalo Social API OAuth v4 có **PKCE**: chuyển sang `https://oauth.zaloapp.com/v4/permission` (app_id, redirect_uri,
  state, code_challenge S256); quay về `https://9mua.com/api/auth/zalo/callback`; máy chủ đổi mã ở
  `https://oauth.zaloapp.com/v4/access_token` (khoá bí mật gửi trong header `secret_key`, kèm `code_verifier`), rồi lấy
  `id`, `name` ở `https://graph.zalo.me/v2.0/me`. Không thêm thư viện npm. Token Zalo không lưu, không ghi log.
- Zalo **không cho biết email/SĐT**: tài khoản tạo mới chỉ có tên. Đã liên kết thì đăng nhập luôn.

### Facebook
- Facebook Login (Graph API **v25.0**): hộp thoại `https://www.facebook.com/v25.0/dialog/oauth` (scope `public_profile,email`,
  `state`), quay về `https://9mua.com/api/auth/facebook/callback`, máy chủ đổi mã ở `graph.facebook.com/v25.0/oauth/access_token`
  rồi gọi `/me?fields=id,name,email` kèm `appsecret_proof`. Token không lưu, không ghi log.
- Email Facebook **trùng tài khoản có sẵn** thì không tự liên kết: phải đăng nhập mật khẩu **hoặc** nhập mã gửi về email đó
  (trong 10 phút) rồi mới liên kết. Facebook không cho email thì tạo tài khoản chỉ có tên.

### Google (sửa bổ sung 27/10)
- Email Google trùng tài khoản có sẵn: liên kết sau khi đăng nhập mật khẩu **hoặc** nhập mã gửi về email đó.

### Mở Kiot cần email hoặc SĐT
- Tài khoản không có email và SĐT (thường là tài khoản Zalo/Facebook) phải **thêm email** (xác nhận bằng mã) trước khi mở
  Kiot, để nhận thông báo đơn hàng, hoá đơn và khôi phục tài khoản.

### Đặt mật khẩu trong trang cá nhân (CEO chốt 29/10)
- Tài khoản tạo bằng Zalo/Google/Facebook/mã email có mật khẩu ngẫu nhiên, nên không tự làm được các việc cần mật khẩu
  (đổi tài khoản nhận tiền, đổi email, đổi mật khẩu). Cài đặt tài khoản có mục **"Đặt mật khẩu mới"**: không cần mật khẩu
  cũ, xác nhận bằng **mã gửi về email của chính tài khoản** (không cho nhập email khác), đặt xong thì đăng xuất các thiết
  bị khác như khi đổi mật khẩu. Admin vẫn đổi mật khẩu bằng mật khẩu cũ.
- Ô mật khẩu ở tài khoản nhận tiền, đổi email, đổi mật khẩu có dòng gợi ý dẫn tới mục này.
- Tài khoản chưa có email: Cài đặt tài khoản cho **thêm email bằng mã** (thay vì bằng mật khẩu).

### Dữ liệu, cấu hình, hợp đồng
- Bảng mới (không đổi bảng cũ): `EmailOtp` (email, mục đích, mã băm, số lần sai, hết hạn, đã dùng, IP băm),
  `AuthIdentity` (nhà cung cấp `zalo` | `facebook`, mã tài khoản bên đó, userId; mỗi tài khoản 9MUA tối đa 1 Zalo, 1 Facebook).
  Google vẫn dùng cột `googleSub` có sẵn.
- `.env`: `ZALO_APP_ID`, `ZALO_APP_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. Thiếu thì ẩn nút. E2E dùng màn hình giả
  như Google (chỉ khi `TEST_MODE`).
- `index.ts` thêm (không đổi hàm cũ): `requestEmailOtp`, `loginWithEmailOtp`, `addEmailWithOtp`, `setPasswordWithOtp`, `linkWithOtp`,
  `linkTicketEmail`, `hasContact`, `isTemporaryName`; luồng Zalo/Facebook `OAUTH_PROVIDERS`, `oauthMode`, `isOauthProvider`, `startOauthFlow`,
  `openOauthFlow`, `profileFromCode`, `completeOauthLogin`, `sealFakeOauthCode`; vé liên kết dùng chung `linkWithTicket`,
  `openLinkTicket` (`linkGoogleWithTicket` giữ tên cũ, giờ dùng chung).
- Giới hạn mã theo IP chỉ tính IP do Nginx gửi (`X-Real-IP`); không có IP thật thì chỉ áp giới hạn theo email.
- Chính sách bảo mật: thêm dữ liệu nhận từ Zalo/Facebook (mã tài khoản, tên, email nếu có).
