# Nhận diện thương hiệu 9MUA

Logo chính thức: túi mua sắm cam hình số 9, có chip mạch điện, kèm chữ **9MUA** (CEO duyệt ngày 23/10/2026).

## File logo

| File | Dùng ở đâu |
|---|---|
| `public/brand/9mua-logo-full.png` | Bản gốc CEO gửi (1920×1280, nền trong suốt). Không sửa |
| `public/brand/9mua-logo.png` | Logo đầy đủ đã cắt sát: trang đăng nhập, email, footer |
| `public/brand/9mua-icon.png` | Chỉ phần túi số 9, nền trong suốt: header, avatar mặc định, watermark video |
| `public/favicon.ico` | Biểu tượng tab trình duyệt (16–64px) |
| `public/apple-touch-icon.png` | Biểu tượng khi "Thêm vào màn hình chính" trên iPhone (180px) |
| `public/icon-192.png`, `public/icon-512.png` | Biểu tượng PWA |
| `public/icon-maskable-512.png` | Biểu tượng PWA Android, có lề an toàn |
| `public/og-default.png` | Ảnh mặc định khi chia sẻ link lên Facebook/Zalo (1200×630) |

Header web: `9mua-icon.png` 26px đặt trong **vòng tròn trắng 40px, viền cam `brand` 2px**, quầng cam nhạt đứng yên
(CEO chọn 27/10/2026, theo V4 — `docs/v4-merge-plan.md`). Máy tính có chữ "9MUA" bên phải logo; điện thoại chỉ
logo. Không kéo méo, không đổi màu, không thêm hiệu ứng nhấp nháy cho logo.

Điện thoại có thanh điều hướng 5 nút ở cuối màn hình (Trang chủ · Chợ · ＋ Đăng video · Video · Tôi), icon
`lucide-react`; nút giữa nền `brand` viền `brand-ink`, nút đang mở tô `brand-deep`.

## Màu

Lấy mẫu trực tiếp từ logo. Độ tương phản đo theo WCAG 2.1.

| Token | Mã | Dùng cho |
|---|---|---|
| `brand` | `#FC6F15` | Màu cam của logo: nền nút chính, điểm nhấn, biểu tượng |
| `brand-ink` | `#1A1410` | Màu đen viền logo: chữ trên nền cam (tương phản 6,45:1, đạt AA), chữ tiêu đề |
| `brand-deep` | `#C2410C` | Chữ cam / link trên nền trắng (5,18:1, đạt AA) và nền nút có chữ trắng |
| `surface` | `#FFFFFF` / `#F5F5F7` | Nền trang / nền khối |
| `success` | `#15803D` | Đã trả, hoàn tất |
| `danger` | `#DC2626` | Lỗi, khiếu nại, công tắc tắt chi tự động |

**Quy tắc:** không đặt chữ trắng trên `#FC6F15` vì chỉ đạt 2,83:1, khó đọc ngoài nắng. Nút chính dùng
nền `brand` + chữ `brand-ink`, giống phong cách viền đen của logo.

## Chữ và hình khối

- Font: **Be Vietnam Pro** (Google Fonts, hỗ trợ đầy đủ tiếng Việt), đậm 700–800 cho tiêu đề, gần với chữ
  tròn đậm "9MUA" trong logo.
- Bo góc 16px cho thẻ, 999px cho nút. Viền đen 2px cho nút và thẻ nổi bật, theo đường viền của logo.
