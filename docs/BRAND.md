# Nhận diện thương hiệu 9MUA

Logo chính thức: túi mua sắm cam hình số 9, có chip mạch điện, kèm chữ **9MUA** (CEO duyệt ngày 23/10/2026).

## File logo

| File | Dùng ở đâu |
|---|---|
| `public/brand/9mua-logo-full.png` | Bản gốc CEO gửi (1920×1280, nền trong suốt). Không sửa |
| `public/brand/9mua-logo.png` | Logo đầy đủ đã cắt sát: trang đăng nhập, email, footer |
| `public/brand/9mua-icon.png` | Chỉ phần túi số 9, nền trong suốt: avatar mặc định, watermark video |
| `public/brand/9mua-logo-v4.jpg` | Logo đầy đủ nền trắng có lề (lấy từ V4): logo tròn trên header và popup |
| `public/favicon.ico` | Biểu tượng tab trình duyệt (16–64px) |
| `public/apple-touch-icon.png` | Biểu tượng khi "Thêm vào màn hình chính" trên iPhone (180px) |
| `public/icon-192.png`, `public/icon-512.png` | Biểu tượng PWA |
| `public/icon-maskable-512.png` | Biểu tượng PWA Android, có lề an toàn |
| `public/og-default.png` | Ảnh mặc định khi chia sẻ link lên Facebook/Zalo (1200×630) |

## Giao diện chuẩn V4 (CEO chốt 27/10/2026)

CEO quyết định lấy bản **9MUA V4** làm chuẩn giao diện cho toàn site, đúng từng màu, độ dày viền, bo góc, cỡ chữ
(`docs/v4-merge-plan.md` §7 mục 10–11). Bảng dưới thay cho quy tắc cũ "nền trắng, chữ đen trên nút cam".

**Header** (cao 64px, nền `#0A0A0A` mờ 90% + làm mờ phía sau, viền dưới 1px trắng 10%):
- Logo: vòng tròn trắng **48px**, viền cam **2px**, bóng `0 0 0 4px` cam 15% + quầng cam 12px và 28px, ảnh `9mua-logo-v4.jpg`
  (túi số 9 + chữ 9MUA, nền trắng có lề) cỡ 36px ở giữa. **Phát sáng nhấp nháy** chu kỳ 2,8 giây (`glowPulse`). Bấm logo về trang chủ.
- Slogan của trang: chữ nghiêng 12px màu `#94A3B8`, cắt bằng "…" khi dài.
- Máy tính: ô tìm kiếm rộng 300px, cao 40px, bo tròn, nền trắng 10%, viền 1px trắng 10%. Điện thoại: nút kính lúp tròn 40px.
- Nút ngôn ngữ (quả địa cầu + mã `VI`), nút giỏ hàng tròn 40px nền trắng 10%, số món trên chấm cam.

**Thanh dưới** (hiện trên **mọi màn hình**, cao 64px, nền `#0A0A0A` mờ 95%, viền trên 1px trắng 10%, rộng tối đa 560px ở giữa):
Video · Chợ · **Live** · Kiot · Tôi. Icon 24px, chữ 10px đậm; nút đang mở màu cam `#FF6B00`, nút khác trắng 60%.
Nút giữa 56×36px bo 12px: viền 2px chuyển màu xanh ngọc → trắng → cam, lõi cam, dấu ＋ trắng; đang mở thì cam đặc có quầng.

## Màu

| Token | Mã | Dùng cho |
|---|---|---|
| `ink` (nền) | `#0A0A0A` | Nền toàn site, header, thanh dưới |
| `brand` | `#FF6B00` | Cam V4: nền nút chính (chữ **trắng**, rất đậm), chữ/icon nhấn trên nền đen (6,9:1) |
| trắng 5% / 10% / 15% | `rgba(255,255,255,…)` | Nền khung / nền nút phụ, viền 1px / viền nút phụ |
| trắng 50–60% | | Chữ phụ |
| `#94A3B8` | | Slogan |
| `#FFF7ED` | | Nền ô đang chọn trong khung trắng (bảng thanh toán, popup) |
| `success` | `#15803D` | Đã trả, hoàn tất |
| `danger` | `#DC2626` | Lỗi, khiếu nại, live |

Popup trượt từ dưới lên nền **trắng**, chữ đen, bo trên 24px. Thẻ sản phẩm trong Kiot nền trắng, chữ đen.

**Lưu ý đã báo CEO:** chữ trắng trên cam chỉ đạt 2,8:1 (chuẩn khuyên 4,5:1), V4 bù bằng chữ rất đậm (900). CEO chấp nhận.

## Chữ và hình khối

- Font chữ thường: **Be Vietnam Pro** 400–900. Font tiêu đề lớn (class `display`): **Space Grotesk** 500/700.
- Bo góc: khung 14–18px, nút tròn hẳn hoặc 12px (nút vuông của trang Kiot), popup 24px.
- Viền 1px trắng 10% cho khung trên nền đen; nút phụ viền 1px trắng 15–20%.
