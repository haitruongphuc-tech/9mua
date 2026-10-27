# 9MUA.COM V4 - App demo

Bản demo giao diện theo tài liệu "9MUA-COM-V4-TAT-CA-TINH-NANG-DA-CHOT". Bấm đâu chạy đó, dữ liệu mẫu,
lưu trên trình duyệt. Không đăng nhập thật, không trừ tiền thật, không gọi AI thật.

Thư mục này là dự án Next.js 14 riêng, tách khỏi dự án 9mua.com ở thư mục gốc (đã loại trừ khỏi
`tsconfig.json`, `eslint.config.mjs`, `.dockerignore` ở gốc).

## Chạy local

```bash
cd "9mua v4"
npm install
npm run dev
```

Mở http://localhost:3000

## 10 trang

| Trang | URL |
|---|---|
| Home Feed | `/` |
| Khám phá Kiot | `/explore` |
| Live & Story | `/live` |
| Value Calculator $951 | `/value` |
| Giỏ hàng | `/cart` |
| Ví | `/wallet` |
| Hồ sơ Kiot | `/<slug>` (vd. `/gom-bat-trang`) |
| Social Connect | `/connect` |
| AI Studio | `/ai` |
| Pháp lý | `/legal` |

Thêm: `/me` (Tôi), `/admin` (CEO: users, kiots, value, ai-cost, slogan, legal).

## Cấu trúc

- `lib/data.ts` - dữ liệu mẫu, 10 slogan, công thức Value $951
- `lib/store.tsx` - trạng thái demo (localStorage)
- `lib/vietqr.ts` - tạo mã QR chuyển khoản VietQR
- `components/Shell.tsx` - header, bottom nav 5 nút, popup dùng chung
- `supabase/schema.sql` - 10 bảng theo tài liệu V4 (chưa nối vào app)
