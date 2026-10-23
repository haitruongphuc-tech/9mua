# Spec: `kiot` — Kiot, sản phẩm, trang Kiot công khai

> Module 2 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`.
> Tech stack, lệnh, cấu trúc, code style, test và ranh giới chung theo `SPEC-identity.md`.
> Spec này chỉ ghi phần riêng của module.

## Objective

Cho một tài khoản tạo Kiot của mình: đặt tên, chọn địa chỉ `tenkiot.9mua.com`, đăng sản phẩm có ảnh,
giá, tồn kho, và khai báo tài khoản ngân hàng để 9mua trả tiền bán hàng. Khi Kiot đã đóng phí và còn
hạn (module `billing` quyết định), trang Kiot hiện công khai cho người mua.

### Trạng thái Kiot

| Trạng thái | Nghĩa | Công khai? | Chủ Kiot sửa được? |
|---|---|---|---|
| `draft` | Mới tạo, chưa đóng phí | Không (chủ xem trước được) | Có |
| `active` | Đã đóng phí, `activeUntil` > hiện tại | Có | Có |
| `expired` | Quá `activeUntil` | Không, hiện "Kiot tạm ngưng" | Có, nhưng phải gia hạn mới mở lại |
| `locked` | CEO khoá | Không, hiện "Kiot tạm ngưng" | Không |

`active` / `expired` được **tính từ `activeUntil`** chứ không lưu cứng, nên không cần tác vụ định kỳ để
chuyển trạng thái. `locked` là cờ `lockedAt` riêng.

### User stories & tiêu chí chấp nhận

1. **Tạo Kiot** tại `/kiot-cua-toi/tao`. Mỗi tài khoản có tối đa 1 Kiot trong MVP.
   - Nhập: tên Kiot (2–60 ký tự), slug, mô tả ngắn (≤ 500 ký tự), SĐT/Zalo liên hệ.
   - Slug gợi ý tự động từ tên, bỏ dấu tiếng Việt (`Thanh Long Bình Thuận` → `thanh-long-binh-thuan`).
   - Slug dài 3–30 ký tự, chỉ gồm `a-z 0-9 -`, không bắt đầu hay kết thúc bằng `-`, không trùng Kiot khác.
   - Slug không được nằm trong danh sách cấm: `www api admin ceo cho app mail static cdn uploads
     9mua help hotro dang-nhap dang-ky tai-khoan kiot ...` (đầy đủ trong `reserved-slugs.ts`).
   - Trang tạo kiểm tra slug còn trống ngay khi gõ.
   - Slug **chỉ đổi được khi còn `draft`**. Sau khi kích hoạt thì cố định để link và QR đã in không bị hỏng.
2. **Thông tin Kiot**: logo và ảnh bìa (tuỳ chọn), địa chỉ lấy hàng (tỉnh/thành, quận/huyện, địa chỉ
   chi tiết), mô tả.
3. **Tài khoản nhận tiền**: chọn ngân hàng (danh sách ngân hàng VietQR), số tài khoản, tên chủ tài khoản
   (viết hoa, không dấu).
   - Đổi tài khoản nhận tiền phải **nhập lại mật khẩu**.
   - Đổi xong hệ thống gửi email báo cho chủ Kiot, để phát hiện kẻ gian đổi tài khoản.
   - Mỗi lần đổi được lưu lịch sử. `payouts` dùng lịch sử này để tạm giữ tiền 24 giờ sau khi đổi.
4. **Sản phẩm** (CRUD) tại `/kiot-cua-toi/san-pham`:
   - Trường: tên (2–120), mô tả (≤ 5.000), giá bán (số nguyên VNĐ, 1.000–100.000.000), giá gốc gạch
     ngang (tuỳ chọn, phải lớn hơn giá bán), tồn kho (số nguyên ≥ 0), danh mục, 1–6 ảnh,
     trạng thái `visible` / `hidden`.
   - Ảnh: JPG/PNG/WebP/HEIC ≤ 10MB. Server chuyển sang WebP, cạnh dài tối đa 1200px, tạo thêm bản
     thu nhỏ 400px, xoá metadata EXIF (có thể chứa vị trí GPS). Tên file ngẫu nhiên. Chủ Kiot kéo thả
     để đổi thứ tự ảnh.
   - Tối đa 500 sản phẩm mỗi Kiot.
   - Xoá sản phẩm là **xoá mềm** (`deletedAt`), vì đơn hàng cũ vẫn tham chiếu tới sản phẩm đó.
   - MVP chưa có biến thể (size/màu). Mỗi biến thể là một sản phẩm riêng.
5. **Danh mục**: danh sách cố định do 9mua quy định, khoảng 12 mục (Thực phẩm & Đặc sản, Thời trang,
   Mỹ phẩm, Đồ gia dụng, Điện tử, Mẹ & Bé, Sức khoẻ, Thủ công mỹ nghệ, Nông sản, Sách & VPP,
   Thú cưng, Khác). CEO đổi được ở giai đoạn sau.
6. **Trang Kiot công khai** `https://<slug>.9mua.com` (đồng thời có ở `https://9mua.com/k/<slug>`):
   - Header có logo, tên, mô tả, nút gọi / Zalo. Bên dưới là lưới sản phẩm `visible` còn hàng, hết
     hàng thì hiện mờ.
   - Trang chi tiết sản phẩm `<slug>.9mua.com/p/<productId>-<ten-khong-dau>` có ảnh, giá, mô tả và nút
     "Thêm vào giỏ" (nút này do module `orders` gắn vào).
   - Có thẻ meta và Open Graph để chia sẻ Facebook/Zalo hiện đúng ảnh và giá.
   - Kiot không `active` thì trả trang "Kiot tạm ngưng" với mã HTTP 404 (để bỏ khỏi chỉ mục tìm kiếm).
   - Có nút tạo **QR dẫn tới trang Kiot** (QR của đường link, không phải QR chuyển khoản) để in dán
     tại quầy.
7. **Bảng điều khiển** `/kiot-cua-toi`: trạng thái Kiot, ngày hết hạn, nút "Kích hoạt / Gia hạn"
   (gọi `billing`), số sản phẩm, link xem trang Kiot. Các tab Đơn hàng và Số dư do `orders` và
   `payouts` gắn vào.

### Định tuyến tên miền phụ

`middleware.ts` đọc header `Host`:
- `<slug>.9mua.com` được rewrite nội bộ sang `/k/<slug>/...`.
- `9mua.com` và `www.9mua.com` đi theo route bình thường.

Cookie phiên đăng nhập có domain `.9mua.com`, nên người dùng vẫn đăng nhập khi sang trang Kiot.
Ở dev dùng `<slug>.localhost:3000`.

### Hợp đồng cho module khác (`src/modules/kiot/index.ts`)

```ts
getKiotBySlug(slug: string): Promise<KiotPublic | null>
getKiotByOwner(userId: string): Promise<Kiot | null>
isKiotActive(kiot: Pick<Kiot, 'activeUntil' | 'lockedAt'>, now?: Date): boolean
extendActiveUntil(kiotId: string, until: Date): Promise<void>        // chỉ billing gọi
lockKiot(kiotId: string, reason: string): Promise<void>              // chỉ admin gọi
unlockKiot(kiotId: string): Promise<void>
listPublicProducts(filter: { kiotId?: string; category?: string; q?: string; cursor?: string; limit: number }): Promise<Page<ProductCard>>
getProductForCheckout(productId: string): Promise<{ id; kiotId; name; price; stock; active: boolean } | null>
decrementStock(tx: Tx, items: { productId: string; qty: number }[]): Promise<{ ok: true } | { ok: false; productId: string }>
restoreStock(tx: Tx, items: { productId: string; qty: number }[]): Promise<void>
getPayoutAccount(kiotId: string): Promise<{ bankBin; accountNumber; accountName; changedAt: Date } | null>
hideProduct(productId: string, reason: string): Promise<void>       // admin gỡ vi phạm
```

`decrementStock` chạy **trong transaction của `orders`**, dùng `UPDATE … SET stock = stock - qty WHERE stock >= qty`.
Hai người mua cùng lúc món cuối cùng thì chỉ một người thành công, tồn kho không bao giờ âm.

### Lưu trữ ảnh

- Ảnh lưu ở thư mục `UPLOAD_DIR` (trong container là `/data/uploads`), gắn ra host `/srv/9mua/uploads`.
- Nginx trên host phục vụ trực tiếp `https://9mua.com/uploads/...`, cache 1 năm (tên file không bao giờ trùng).
- Code ghi ảnh qua interface `ImageStore`, để sau này chuyển sang Cloudflare R2 mà không phải sửa module.

## Phụ thuộc mới (cần duyệt)

- `sharp`: xử lý ảnh (đổi định dạng, thu nhỏ, xoá EXIF).
- `qrcode`: tạo QR link Kiot.
- `slugify` **không dùng**: tự viết hàm bỏ dấu tiếng Việt khoảng 15 dòng.

## Testing Strategy (riêng module)

- **Unit:**
  - Tạo slug từ tên tiếng Việt (có `đ`, dấu, ký tự đặc biệt).
  - Kiểm tra slug (độ dài, ký tự, danh sách cấm).
  - `isKiotActive` ở các mốc thời gian.
  - Kiểm tra giá và giá gốc.
- **Integration:**
  - Tạo Kiot: trùng slug thì bị từ chối, tài khoản đã có Kiot không tạo thêm được.
  - Đổi slug: được khi `draft`, không được khi đã kích hoạt.
  - Đổi tài khoản nhận tiền: sai mật khẩu thì bị từ chối, đổi xong có lịch sử và có gửi mail.
  - **Tồn kho:** 20 lệnh `decrementStock` đồng thời trên sản phẩm có tồn kho 5 thì đúng 5 lệnh thành
    công, tồn kho cuối bằng 0.
  - Người khác không sửa hay xoá được sản phẩm của Kiot không thuộc mình.
  - Ảnh tải lên không còn EXIF, và file không phải ảnh (đổi đuôi `.jpg`) bị từ chối.
- **E2E:** tạo Kiot → thêm sản phẩm có ảnh → (giả lập `extendActiveUntil`) → mở `slug.localhost:3000`
  thấy sản phẩm → khoá Kiot → thấy trang "Kiot tạm ngưng".

## Boundaries (bổ sung)

- **Luôn làm:**
  - Kiểm tra quyền sở hữu Kiot ở **server** cho mọi thao tác sửa.
  - Kiểm tra nội dung ảnh thật (magic bytes), không tin đuôi file.
- **Hỏi trước:**
  - Cho phép nhiều Kiot trên một tài khoản.
  - Thêm biến thể sản phẩm.
  - Đổi danh sách danh mục.
- **Không bao giờ:**
  - Cho đổi slug sau khi Kiot đã kích hoạt.
  - Xoá cứng sản phẩm đã có đơn hàng.
  - Hiển thị số tài khoản ngân hàng của người bán ra trang công khai.

## Success Criteria

- [ ] Tạo Kiot "Thanh Long Bình Thuận" thì gợi ý slug `thanh-long-binh-thuan`. Slug `admin`, `www` hay
      slug đã có người dùng đều bị từ chối.
- [ ] Kiot `draft`: chủ Kiot xem trước được, người khác vào `slug.9mua.com` thấy 404.
- [ ] Sau `extendActiveUntil`, trang `slug.9mua.com` hiện sản phẩm. Quá hạn hoặc bị khoá thì hiện "Kiot tạm ngưng".
- [ ] Ảnh điện thoại 8MB tải lên thành WebP ≤ 300KB và không còn GPS.
- [ ] Tồn kho không bao giờ âm khi nhiều người mua cùng lúc (theo test đồng thời ở trên).
- [ ] Chia sẻ link sản phẩm lên Zalo/Facebook hiện đúng ảnh, tên, giá.
- [ ] Trang Kiot trên điện thoại 4G tải xong nội dung chính dưới 2,5 giây (LCP).

## Open Questions

1. Mỗi tài khoản **1 Kiot** trong MVP: có ổn không?
2. Danh sách 12 danh mục ở trên có cần thêm hoặc bớt mục nào không?
3. Thông tin Kiot có cần giấy tờ hay CCCD (KYC) không? Tài liệu cũ nhắc "KYC + cọc 199k" chống Kiot ảo.
   Đề xuất MVP chưa làm KYC, chỉ yêu cầu khi người bán **rút tiền lần đầu** (module `payouts`).
