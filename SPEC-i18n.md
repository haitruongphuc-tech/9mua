# Spec: Đa ngôn ngữ (i18n)

> Áp dụng cho mọi module. Quyết định gốc: `docs/v4-merge-plan.md` §7 mục 13 (CEO yêu cầu làm ngay, 27/10/2026).
> **Trạng thái: CEO duyệt 27/10/2026** (giữ nguyên địa chỉ trang, không làm `/en/…`).

## Objective

Người nước ngoài và Việt kiều dùng được 9mua.com bằng tiếng của họ. Giao diện có đủ 7 thứ tiếng như V4:
**Tiếng Việt** (mặc định), English, 中文, 日本語, 한국어, Français, Español.

### Tiêu chí chấp nhận

1. **Chọn ngôn ngữ:** nút ngôn ngữ trên header (hình quả địa cầu + mã `VI`, giống V4) mở danh sách 7 thứ tiếng.
   Chọn xong thì trang đổi ngôn ngữ ngay, không mất chỗ đang xem.
2. **Lần đầu vào web:** tự chọn theo ngôn ngữ của trình duyệt nếu nằm trong 7 thứ tiếng, nếu không thì tiếng Việt.
3. **Ghi nhớ:** lưu lựa chọn trong cookie `lang` (1 năm) trên `.9mua.com`, nên dùng chung cho mọi trang Kiot
   `<slug>.9mua.com`. Không thêm cột vào bảng tài khoản.
4. **Dịch những gì:** mọi chữ của giao diện (nút, menu, tiêu đề, thông báo lỗi, trang trống, slogan), email hệ thống,
   thông báo trong app, trang Giới thiệu và chính sách.
5. **Không dịch:** nội dung người dùng tự viết (tên Kiot, tên và mô tả sản phẩm, chú thích video, chat live). Nút
   "Dịch" bằng AI cho nội dung này để làm sau (hỏi trước).
6. **Giá luôn hiện VNĐ** ở mọi ngôn ngữ (quyết định §7 mục 4). Ngày giờ và cách viết số theo ngôn ngữ đang chọn.
7. **Thiếu bản dịch** thì hiện tiếng Việt, không bao giờ hiện mã khoá kiểu `cart.empty`.
8. **Đọc slogan** (giống nút "TTS Auto-Read" của V4): trong danh sách ngôn ngữ có nút đọc to slogan của trang bằng
   giọng của trình duyệt. Máy không hỗ trợ thì ẩn nút.
9. **Trang admin** chỉ cần tiếng Việt.

### Kỹ thuật

- Từ điển tự viết trong `src/i18n/<mã>.ts` (`vi`, `en`, `zh`, `ja`, `ko`, `fr`, `es`). Tiếng Việt là bản gốc; các bản
  khác phải có **đủ khoá như bản gốc**, TypeScript báo lỗi nếu thiếu.
- Hàm `t('khoá', { biến })` dùng được ở cả máy chủ và trình duyệt. **Không thêm thư viện npm.**
- Địa chỉ trang **không đổi** (không có `/en/…`). Thẻ `<html lang>` đổi theo ngôn ngữ đang chọn.
- Google vẫn chỉ đánh chỉ mục bản tiếng Việt. Muốn Google nước ngoài tìm thấy bản tiếng Anh thì phải làm địa chỉ riêng
  cho từng ngôn ngữ (việc lớn hơn, hỏi trước).
- Claude dịch. Tiếng Trung, Nhật, Hàn nên có người bản xứ đọc lại trước khi quảng cáo ra nước ngoài.

### Ghi chú khi làm (T66, 27/10/2026)

- Email do người dùng bấm gửi (quên mật khẩu) đi theo ngôn ngữ đang chọn. Email máy tự gửi về sau (đơn hàng, rút tiền,
  nhắc gia hạn, biên nhận) vẫn là **tiếng Việt**: theo mục 3, ngôn ngữ chỉ nằm trong cookie, không lưu vào tài khoản,
  nên lúc gửi máy không biết người nhận dùng tiếng gì. Muốn các email này đúng ngôn ngữ thì phải thêm cột ngôn ngữ vào
  bảng tài khoản (hỏi CEO trước).
- Lỗi kiểm tra dữ liệu của module (vd. "Tên Kiot cần ít nhất 2 ký tự") được dịch ở lớp giao diện
  (`src/i18n/module-messages.ts`), không đổi hợp đồng `index.ts`. Tên tỉnh/thành và tên ngân hàng giữ tiếng Việt.

## Testing Strategy

- **Unit:** 7 từ điển có đủ khoá như tiếng Việt; chọn ngôn ngữ từ trình duyệt (`ja-JP` → `ja`, `de-DE` → `vi`);
  thiếu khoá thì trả về tiếng Việt.
- **E2E:** đổi sang English → header, thanh dưới và trang Chợ ra tiếng Anh, giá vẫn VNĐ; sang trang Kiot trên tên miền
  con vẫn giữ tiếng Anh; tải lại trang vẫn nhớ.

## Boundaries

- **Luôn làm:** chữ mới trên giao diện phải đi qua `t()`, có đủ 7 thứ tiếng trước khi commit.
- **Hỏi trước:** làm địa chỉ riêng cho từng ngôn ngữ; dịch nội dung người dùng bằng AI; thêm ngôn ngữ thứ 8.
- **Không bao giờ:** đổi giá sang tiền nước ngoài; để mã khoá lộ ra giao diện.
