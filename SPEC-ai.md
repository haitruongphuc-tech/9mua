# Spec: `ai` — AI Studio cho chủ Kiot

> Module 13 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `kiot`, `creator`.
> **Trạng thái: CEO duyệt qua chat ngày 27/10/2026** (câu 8 "làm luôn"). V4 chỉ là bản mẫu giao diện (ảnh giả, video giả);
> đây là bản chạy thật.

## Objective

Chủ Kiot nhập tên và giá sản phẩm, chọn phong cách; AI viết mô tả, gợi ý hashtag, vẽ 4 ảnh, máy chủ ghép video 10 giây,
và đọc thử bằng 7 thứ tiếng. Bấm "Đăng bán" là có sản phẩm mới trong Kiot, kèm video lên feed (tuỳ chọn).

### Tiêu chí chấp nhận

1. **Ai dùng:** chủ Kiot đang hoạt động (như V4). Người chưa có Kiot thấy nút "Mở Kiot để dùng AI Studio".
2. **Đầu vào:** tên sản phẩm (≤ 120 ký tự), giá, danh mục, ghi chú ngắn (≤ 300 ký tự), **5 phong cách ảnh** như V4:
   Flat Vector, 3D Isometric, Photo Realistic, Hand Sketch, Neon Glow.
3. **AI viết chữ** (Claude, Anthropic): mô tả sản phẩm chia mục đúng định dạng trang sản phẩm hiện có, 5 hashtag, một câu
   giới thiệu ngắn và bản dịch câu đó sang 6 thứ tiếng còn lại. Không bịa thông tin kiểm chứng được (xuất xứ, chứng nhận,
   công dụng chữa bệnh): chỉ dùng những gì chủ Kiot nhập.
4. **AI vẽ 4 ảnh** (Google Gemini, model tạo ảnh) theo phong cách đã chọn, nền sạch, không chữ, không logo của hãng khác.
   Chủ Kiot chọn ảnh dùng làm ảnh chính. Ảnh lưu qua `MediaStore` như ảnh sản phẩm thường.
5. **Video 10 giây**: worker dùng ffmpeg ghép các ảnh đã chọn thành video dọc 720×1280 có chuyển cảnh nhẹ (zoom chậm),
   không tốn phí AI. Không dùng AI tạo video (vài trăm nghìn mỗi clip).
6. **Đọc thử 7 thứ tiếng**: dùng giọng có sẵn của trình duyệt đọc câu giới thiệu đã dịch (miễn phí, như V4).
7. **Đăng bán**: tạo sản phẩm trong Kiot qua `kiot.createProduct` (tên, giá, danh mục, mô tả, ảnh) và, nếu chọn, đăng
   video qua `creator` với sản phẩm được gắn sẵn. Chủ Kiot sửa được mọi thứ trước khi đăng.
8. **Chi phí và giới hạn** (CEO chỉnh trong `/admin`):
   - Công tắc bật/tắt AI Studio. Chưa có khoá API thì phần tương ứng báo "Chưa bật" và phần còn lại vẫn chạy.
   - Mỗi chủ Kiot tối đa **10 lần viết chữ** và **3 lần vẽ ảnh** mỗi ngày.
   - **Ngân sách tháng** (mặc định 500.000đ). Mỗi lần gọi AI ghi chi phí ước tính; chạm ngân sách thì tạm dừng tới đầu
     tháng sau và báo CEO.
   - Chi phí ước tính tham khảo: viết chữ dưới 100đ/lần, ảnh khoảng 1.000đ/ảnh. Giá thật theo bảng giá của Anthropic và
     Google lúc dùng.
9. **Riêng tư:** chỉ gửi cho AI những gì chủ Kiot nhập vào AI Studio; không gửi dữ liệu khách hàng, đơn hàng hay tiền.

### Kỹ thuật

- Gọi API bằng `fetch`, không thêm thư viện npm. Khoá `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` trong `.env`, không bao giờ ghi
  log khoá hay gửi xuống trình duyệt.
- Model viết chữ: Claude bản nhanh, rẻ (đặt bằng biến `AI_TEXT_MODEL`). Model vẽ ảnh: đặt bằng biến `AI_IMAGE_MODEL`.
- Gọi AI có thời hạn (30 giây chữ, 90 giây ảnh); lỗi thì báo "AI đang bận, thử lại sau" và không trừ lượt.
- Kết quả AI qua kiểm tra như dữ liệu người dùng nhập (độ dài, định dạng, lọc link).

### Hợp đồng (`src/modules/ai/index.ts`)

```ts
aiStatus(): Promise<{ text: boolean; image: boolean; enabled: boolean; budgetLeftVnd: number }>
writeProductCopy(userId, input): Promise<{ ok: true; copy: ProductCopy } | { ok: false; error: 'NOT_OWNER' | 'DISABLED' | 'DAILY_LIMIT' | 'BUDGET' | 'AI_ERROR' }>
drawProductImages(userId, input): Promise<{ ok: true; images: StoredImage[] } | { ok: false; error: ... }>
startSlideshow(userId, imageIds): Promise<{ ok: true; jobId } | { ok: false; error }>
publishFromStudio(userId, draft): Promise<{ ok: true; productId; videoId? } | { ok: false; error }>
monthlyUsage(): Promise<{ usedVnd: number; budgetVnd: number }>          // cho admin
```

### Dữ liệu

- `AiUsage`: id, userId, kind (`text | image`), model, inputTokens?, outputTokens?, images?, costVnd, ok, createdAt.
- `AiImage`: id, userId, fileUrl, style, createdAt (ảnh chưa đăng bán tự xoá sau 7 ngày).
- Cài đặt trong `Setting`: `ai.enabled`, `ai.monthlyBudgetVnd`, `ai.textPerDay`, `ai.imagePerDay`.

## Testing Strategy

- **Unit:** ráp prompt (không lọt dữ liệu ngoài đầu vào); đọc kết quả AI sai định dạng thì báo lỗi, không đăng.
- **Integration:** dùng driver AI giả (giống `PAYMENTS_DRIVER=fake`): đủ lượt trong ngày thì chặn; chạm ngân sách thì chặn và
  báo CEO; người không có Kiot bị chặn; đăng bán tạo đúng 1 sản phẩm có ảnh và mô tả.
- **E2E (driver giả):** chủ Kiot mở AI Studio → tạo → chọn ảnh → đăng bán → sản phẩm có trên trang Kiot.

## Boundaries

- **Luôn làm:** giới hạn lượt và ngân sách ở máy chủ; ghi chi phí mỗi lần gọi.
- **Hỏi trước:** AI tạo video; giọng đọc AI trả phí; AI trả lời khách tự động; đổi nhà cung cấp AI.
- **Không bao giờ:** gửi khoá API xuống trình duyệt; để AI tự đăng bán khi chủ Kiot chưa bấm.
