# Spec: `creator` — Video dọc 9:16 có gắn sản phẩm

> Module 8 trong `CAPABILITY-MAP.md`. Phụ thuộc `identity`, `kiot`. Thêm vào giỏ qua `orders`.
> Nền móng chung theo `SPEC-identity.md`.

## Objective

Mọi tài khoản đã đăng ký đều đăng được video dọc ngắn, gắn sản phẩm của các Kiot vào video. Người xem cuộn
feed như TikTok, bấm sản phẩm trên video là mua được ngay. Mục tiêu là đưa người xem tới Kiot và ghi nhận
đơn đến từ video nào, làm nền cho hoa hồng creator ở giai đoạn sau.

### Tiêu chí chấp nhận

1. **Đăng video** `/video/dang`:
   - Chọn file từ điện thoại: MP4, MOV (iPhone) hoặc WebM, **≤ 60 giây, ≤ 100MB**. Có thanh tiến trình tải lên.
   - Chú thích ≤ 300 ký tự. Hashtag `#thanhlong` được tách tự động.
   - Gắn **tối đa 3 sản phẩm**: tìm theo tên trong mọi Kiot đang hoạt động, mặc định ưu tiên sản phẩm
     của Kiot mình.
   - Mỗi tài khoản đăng tối đa **10 video/ngày**.
2. **Xử lý video** (máy chủ, chạy nền):
   - Trạng thái: tải lên xong là `processing`, sau đó `ready` hoặc `failed` (kèm lý do).
   - Worker dùng **ffmpeg** chuyển mọi video về **MP4 H.264 + AAC, tối đa 720×1280**, bật faststart
     (phát được ngay khi đang tải). Lý do: video quay bằng iPhone (HEVC/MOV) **không phát được** trên
     nhiều điện thoại Android và Chrome. Chuyển mã cũng giảm dung lượng 3–5 lần, đỡ băng thông VPS.
   - Tạo ảnh bìa từ giây thứ 1. Đo thời lượng thật, quá 60 giây thì `failed`.
   - Xoá metadata gốc (vị trí GPS).
   - Hàng đợi dùng bảng `VideoJob` trong Postgres (`FOR UPDATE SKIP LOCKED`). Worker là một tiến trình
     riêng `worker` trong docker-compose, cùng image với app, chạy 1 video một lúc để không làm chậm web.
   - Xử lý xong thì báo cho người đăng (thông báo trong app). Video `ready` mới lên feed.
3. **Feed `/video`**:
   - Toàn màn hình, vuốt lên/xuống chuyển video, tự phát (tắt tiếng sẵn, chạm để bật tiếng).
   - Tải trước video kế tiếp.
   - Trên video có: tên creator, chú thích, nút Thích, Chia sẻ, và **thẻ sản phẩm** (ảnh nhỏ, tên, giá).
     Bấm thẻ thì mở trang sản phẩm. Nút "Thêm vào giỏ" gọi `orders.addToCart(..., sourceVideoId)`.
   - Sản phẩm được gắn mà hết hàng, ẩn, hoặc Kiot không hoạt động thì thẻ tự ẩn. Video vẫn hiện.
   - Thứ tự feed: điểm = (lượt thích × 3 + lượt xem đủ ≥ 50% thời lượng) giảm dần theo tuổi video
     (chia `(giờ tuổi + 2)^1.5`), trộn 30% video mới nhất để video mới có cơ hội.
   - Người dùng đã đăng nhập không thấy lại video vừa xem trong 24 giờ.
4. **Lượt xem**: tính khi phát **≥ 3 giây**. Mỗi người xem (tài khoản, hoặc cookie ẩn danh) chỉ tính 1 lần
   mỗi video mỗi 24 giờ. Ghi theo lô để không làm chậm DB.
5. **Thích**: phải đăng nhập, bấm lần nữa để bỏ thích. Số đếm cập nhật ngay trên màn hình.
6. **Chia sẻ**: link `9mua.com/v/<id>` có thẻ Open Graph (ảnh bìa, chú thích), mở ra đúng video trong feed.
7. **Trang creator `/creator/<userId>`**: tên, số video, tổng lượt thích, lưới video.
8. **Thống kê của tôi `/video/cua-toi`**: mỗi video có lượt xem, lượt thích, **số đơn hoàn tất có nguồn
   từ video** (đếm `OrderItem.sourceVideoId`). Người đăng xoá được video của mình.
9. **Kiểm duyệt**:
   - Nút "Báo cáo" (lý do: nội dung xấu, lừa đảo, bản quyền, khác).
   - **5 người khác nhau** báo cáo thì video tự ẩn, chờ CEO xem.
   - CEO gỡ video kèm lý do, người đăng nhận thông báo.
   - Tài khoản bị khoá thì mọi video của tài khoản đó ẩn khỏi feed.
10. **Trang chủ**: `getHotVideos(8)` cấp cho khối "Video hot" của `marketplace`.

### Lưu trữ & phát

- File gốc xoá sau khi chuyển mã xong. Chỉ giữ bản 720p và ảnh bìa trong `UPLOAD_DIR/videos/`.
- Nginx phục vụ trực tiếp, hỗ trợ tua (HTTP Range), cache 1 năm.
- Nginx cấu hình `client_max_body_size 110m` cho riêng route tải video.
- Ghi file qua interface `MediaStore`, để sau này chuyển sang Cloudflare R2 hoặc Bunny Stream mà không
  sửa module. Đây là việc **nên làm khi lượt xem tăng**, vì băng thông VPS có hạn.

### Hợp đồng (`src/modules/creator/index.ts`)

```ts
createVideoUpload(userId, file, meta: { caption; productIds: string[] }): Promise<{ ok: true; videoId } | { ok: false; error: 'TOO_LARGE' | 'DAILY_LIMIT' | 'BAD_FORMAT' | 'PRODUCT_INVALID' }>
getFeed(viewer: { userId?; anonId }, cursor?): Promise<Page<FeedVideo>>
recordView(videoId, viewer, watchedSeconds): Promise<void>
toggleLike(videoId, userId): Promise<{ liked: boolean; likes: number }>
getHotVideos(limit): Promise<FeedVideo[]>
getCreatorProfile(userId): Promise<CreatorProfile>
myVideoStats(userId): Promise<VideoStat[]>
deleteVideo(videoId, userId): Promise<Result>
reportVideo(userId, videoId, reason, message): Promise<Result>
removeVideo(videoId, adminId, reason): Promise<void>     // cho admin
```

### Dữ liệu

- `Video`: id, authorId, caption, hashtags[], status (`processing | ready | failed | hidden | removed | deleted`),
  failReason, durationSec, width, height, fileUrl, posterUrl, views, likes, qualifiedViews, score, createdAt.
- `VideoProduct`: videoId, productId, position. Tối đa 3 dòng mỗi video.
- `VideoLike`: (videoId, userId) là khoá chính.
- `VideoView`: videoId, viewerKey, day. Khoá duy nhất cả ba cột.
- `VideoJob`: videoId, status, attempts, lockedAt, error.
- `VideoReport`: videoId, userId, reason, message. Khoá duy nhất (videoId, userId).

## Phụ thuộc mới (cần duyệt)

- **ffmpeg** (gói hệ điều hành, cài trong Docker image, không phải thư viện npm). Dùng qua `child_process`
  với danh sách tham số cố định, **không bao giờ ghép chuỗi lệnh từ dữ liệu người dùng**.
- Thêm service `worker` vào `docker-compose.yml` (cùng image với app).

## Testing Strategy (riêng module)

- **Unit:**
  - Tách hashtag.
  - Công thức điểm feed: video mới chưa có tương tác vẫn có điểm > 0, video cũ nhiều like giảm dần theo thời gian.
  - Luật tính lượt xem: dưới 3 giây không tính, trong 24 giờ không tính lại.
- **Integration** (dùng 3 video mẫu nhỏ trong `tests/fixtures`: MOV HEVC từ iPhone, MP4 ngang, file 75 giây):
  - MOV HEVC → `ready`, ra MP4 H.264 ≤ 720×1280 có ảnh bìa, không còn GPS.
  - File 75 giây → `failed` "Video dài hơn 60 giây".
  - File đổi đuôi `.mp4` nhưng không phải video → bị từ chối.
  - Hai worker chạy song song không xử lý trùng một video.
  - Thích 2 lần thì về 0. Không đăng nhập thì không thích được.
  - 5 báo cáo khác người thì ẩn video.
  - Gắn sản phẩm của Kiot không hoạt động thì `PRODUCT_INVALID`. Kiot hết hạn sau khi đăng thì thẻ sản phẩm tự ẩn.
  - Mua từ video → đơn hoàn tất → thống kê video tăng 1 đơn.
- **E2E (Playwright, thiết bị giả lập iPhone):** đăng video → chờ `ready` → mở `/video` → vuốt → bấm
  thẻ sản phẩm → thêm vào giỏ → trong giỏ có `sourceVideoId`.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Kiểm tra định dạng file thật bằng `ffprobe`, không tin đuôi file.
  - Giới hạn thời gian chạy ffmpeg (tối đa 5 phút mỗi video).
- **Hỏi trước:**
  - Bình luận.
  - Quà tặng, tiền thưởng, hoa hồng creator.
  - Livestream.
  - Chuyển lưu trữ video sang dịch vụ ngoài.
- **Không bao giờ:**
  - Phát video gốc chưa qua xử lý.
  - Hiện số lượt xem hoặc thích giả.
  - Ghép tên file hay dữ liệu người dùng vào câu lệnh shell.

## Success Criteria

- [ ] Video quay bằng iPhone đăng lên xem được trên Android, iPhone và Chrome máy tính.
- [ ] Video 60 giây xử lý xong dưới 1 phút trên VPS 2 vCPU.
- [ ] Vuốt sang video kế tiếp phát gần như ngay (đã tải trước).
- [ ] Mua hàng từ video được ghi nhận đúng video nguồn, và creator thấy trong thống kê.
- [ ] Đang xử lý video thì trang web vẫn nhanh bình thường (worker tách riêng).

## Open Questions

1. Đồng ý dùng **ffmpeg chuyển mã video**? Spec cũ ghi "chưa nén/chuyển mã", nhưng nếu bỏ bước này thì
   video iPhone không xem được trên Android. Đề xuất **có**.
2. **Bình luận** dưới video: đề xuất **chưa làm** trong MVP vì cần kiểm duyệt. Chỉ có Thích và Chia sẻ.
3. Creator được gắn **sản phẩm của mọi Kiot** (không chỉ Kiot của mình): đề xuất **có**, làm nền cho
   hoa hồng sau này.
