# Spec: `live` + `xu` — Livestream bán hàng và thưởng xu theo KPI

> Module 10 và 11 trong `CAPABILITY-MAP.md`. `live` phụ thuộc `identity`, `kiot`, `billing`, `orders`, `creator`.
> `xu` phụ thuộc `identity`, `kiot`, `live`. Nền móng chung theo `SPEC-identity.md`.
> Quyết định gốc: `docs/v4-merge-plan.md` §7, mục 8 (tự xây trên VPS), 9 (xu theo KPI) và 12 (làm ngay).
> **Trạng thái: CEO duyệt toàn bộ ngày 27/10/2026**, gồm 7 mặc định ở cuối spec.

## Objective

Mọi tài khoản phát live ngay từ trình duyệt điện thoại, không cần cài app. Chủ Kiot live để bán hàng; người khác live
giới thiệu sản phẩm của các Kiot (giống video Creator). Người xem vuốt dọc qua các buổi live như TikTok LIVE, chat,
thả tim và mua sản phẩm đang được ghim. 9MUA thưởng **xu** cho người phát khi buổi live đạt đủ người xem thật.
Mục tiêu: kéo người dùng ở lại 9MUA và đưa người mua vào Kiot.

Toàn bộ chạy trên VPS của 9MUA bằng **MediaMTX**, không dùng dịch vụ live trả phí theo phút.

## Phần 1: `live`

### Tiêu chí chấp nhận

1. **Ai được phát live:** **mọi tài khoản** đã đăng nhập, không bị khoá, không bị CEO cấm live (CEO chốt 27/10/2026),
   và tài khoản được tạo ít nhất **3 ngày** (chống tài khoản tạo vội để phát nội dung xấu). Mỗi tài khoản chỉ có
   1 buổi live tại một thời điểm.
2. **Giới hạn** (CEO đổi được trong `/admin`):
   - Tối đa **2 buổi live cùng lúc** trên toàn hệ thống. Đã đủ thì báo "Đang đủ 2 buổi live, anh/chị thử lại sau".
   - Tối đa **50 người xem** mỗi buổi. Người thứ 51 thấy "Buổi live đã đủ người xem" và được gợi ý buổi khác.
   - Mỗi buổi dài tối đa **2 giờ**. Còn 5 phút thì báo cho người phát; hết giờ thì tự kết thúc.
   - Hình dọc tối đa **720×1280, 30 khung/giây, 1,5 Mbps**; tiếng Opus.
3. **Phát live `/live/phat`** (mọi tài khoản, trên điện thoại):
   - Xin quyền camera và micro, hiện hình xem trước. Nhập tiêu đề ≤ 100 ký tự. Có thể chọn sẵn sản phẩm để ghim.
   - Bấm "Bắt đầu live": máy chủ kiểm tra các luật ở mục 1–2, tạo buổi live và trả về **mã phát dùng một lần**
     (hết hạn sau 2 phút nếu chưa dùng). Trình duyệt gửi hình lên MediaMTX theo chuẩn WHIP.
   - Buổi live chỉ chuyển sang **"đang live"** khi MediaMTX báo đã nhận được hình, không tin trình duyệt tự báo.
   - Trong lúc live: giữ màn hình sáng; nút đổi camera trước/sau, tắt/bật micro, số người đang xem, khung chat,
     ghim/bỏ ghim sản phẩm, nút "Kết thúc".
   - Mất kết nối (chuyển app, mất sóng) thì tự nối lại; quá **60 giây** chưa có hình thì buổi live kết thúc.
   - Kết thúc xong hiện bảng tổng kết: thời lượng, số người xem cao nhất, số tim, số người xem hợp lệ, số xu được
     thưởng hoặc lý do không được thưởng.
4. **Xem live `/live`** (nút giữa của thanh dưới):
   - Vuốt dọc giữa các buổi đang live. Mỗi màn hình có: video toàn màn hình, ảnh và tên người phát (người phát có Kiot thì bấm vào Kiot),
     tiêu đề, **số người đang xem thật**, chat chạy ở góc dưới bên trái, ô nhập chat, nút tim, chia sẻ, báo cáo,
     và thẻ sản phẩm đang ghim.
   - Tự phát với tiếng tắt sẵn, chạm để bật tiếng (giống feed video). Độ trễ mục tiêu **dưới 2 giây** (WebRTC, chuẩn WHEP).
   - **Ai cũng xem được, không cần đăng nhập.** Chat, thả tim và báo cáo thì phải đăng nhập; chưa đăng nhập thì
     hiện khung đăng nhập nhanh, không rời buổi live.
   - Chưa có buổi nào thì hiện "Chưa có ai đang live", kèm nút "Phát live".
   - Link chia sẻ `9mua.com/live/<id>`: còn live thì mở thẳng buổi đó; đã kết thúc thì báo "Buổi live đã kết thúc"
     kèm link vào trang người phát (hoặc Kiot của họ).
   - Thanh dưới: ô Live có chấm đỏ khi có ít nhất 1 buổi đang live.
   - Trang Kiot: avatar viền đỏ và nhãn "LIVE" khi chủ Kiot đang live, bấm vào là xem. Trang creator cũng vậy.
5. **Chat:**
   - Tối đa 150 ký tự, mỗi người 1 tin mỗi 3 giây. **Không cho gửi link** (chống lừa đảo).
   - Người xem thấy 50 tin gần nhất. Tin của người phát có nhãn "Người phát".
   - Người phát ẩn được tin nhắn và cấm một người chat trong buổi đó.
   - Tin chat tự xoá sau 30 ngày (chat không phải sổ tiền).
6. **Thả tim:** bấm liên tục được, tim bay lên màn hình. Máy chủ đếm tổng tim của buổi, mỗi người tối đa 10 tim/giây.
7. **Ghim sản phẩm:** người phát ghim **1 sản phẩm của bất kỳ Kiot đang hoạt động nào** (giống gắn sản phẩm vào video;
   mặc định ưu tiên sản phẩm Kiot của mình), đang bán và còn hàng. Người xem thấy thẻ sản phẩm
   (ảnh, tên, giá): bấm thẻ mở trang sản phẩm, nút "Thêm vào giỏ" gọi `orders.addToCart` kèm nguồn là buổi live.
   Sản phẩm hết hàng hoặc bị ẩn thì thẻ tự ẩn.
8. **Báo cáo và xử lý vi phạm:**
   - Lý do: nội dung xấu, lừa đảo, bản quyền, khác. Mỗi người báo cáo 1 lần mỗi buổi.
   - **5 người khác nhau** báo cáo thì buổi live bị ẩn khỏi danh sách Live (người đang xem vẫn xem được) và CEO
     nhận thông báo ngay.
   - CEO trong `/admin/live`: xem các buổi đang live, **dừng ngay** kèm lý do, cấm tài khoản phát live 1 ngày / 7 ngày /
     30 ngày / vĩnh viễn. Mọi thao tác ghi audit log.
9. **Không ghi hình** buổi live trong đợt này. Kết thúc là hết.

### Kỹ thuật

- **MediaMTX** chạy thành service `mediamtx` trong `docker-compose.yml`, dùng image ghim đúng phiên bản. File cấu hình
  `deploy/mediamtx/mediamtx.yml`:
  - Chỉ bật WebRTC. Tắt RTSP, RTMP, HLS, SRT.
  - API của MediaMTX chỉ mở trong mạng nội bộ Docker, không ra Internet.
  - `authMethod: http`: mỗi lần có người phát hoặc xem, MediaMTX hỏi app qua `/api/live/media-auth`. App chỉ cho
    phát khi đúng mã phát của đúng buổi, và chỉ cho xem khi có **mã xem** hợp lệ (ký HMAC, hết hạn sau 5 phút)
    và buổi chưa đủ 50 người.
  - `maxReaders: 50`, `webrtcAdditionalHosts` là IP công khai của VPS.
- **Nginx:** `https://9mua.com/live-media/` chuyển vào MediaMTX (cổng 8889, dùng cho WHIP/WHEP). Hình và tiếng đi
  thẳng qua **cổng 8189 UDP**; mở thêm **8189 TCP** dự phòng cho mạng chặn UDP. CEO mở 2 cổng này trên VPS.
- **Không cần TURN** lúc đầu, vì VPS có IP công khai. App ghi lại tỉ lệ kết nối thất bại; nếu vượt 5% thì đề xuất
  thêm TURN (hỏi trước).
- **Trạng thái buổi live:** worker hỏi API MediaMTX mỗi 5 giây. Có hình thì chuyển `live`; mất hình quá 60 giây thì
  `ended`. Nút "Kết thúc" và lệnh dừng của CEO kết thúc ngay và ngắt kết nối phía MediaMTX.
- **Chat, tim, số người xem** đẩy tới người xem bằng Server-Sent Events từ app. Không có SSE thì trình duyệt tự hỏi
  lại mỗi 3 giây.
- **Đếm người xem:** khi video đang phát và tab đang mở, trình duyệt gửi tín hiệu mỗi 20 giây. "Đang xem" là người
  có tín hiệu trong 45 giây gần nhất. Không bao giờ hiện số giả.
- Phần gửi và nhận hình (WHIP/WHEP) tự viết bằng `fetch` và `RTCPeerConnection` có sẵn trong trình duyệt,
  **không thêm thư viện npm**.

### Băng thông (CEO cần hỏi nhà cung cấp VPS)

Lúc cao điểm 2 buổi × 50 người × 1,5 Mbps ≈ **150 Mbps** tải ra. Một giờ live đủ 50 người tốn khoảng **34 GB**
dữ liệu. Cần biết tốc độ cổng mạng và giới hạn dung lượng tháng của VPS trước khi mở live cho mọi người. Nếu cổng
chỉ 100 Mbps thì hạ giới hạn xuống 2 buổi × 30 người.

### Hợp đồng (`src/modules/live/index.ts`)

```ts
startLive(userId, { title; pinProductId? }): Promise<{ ok: true; liveId; whipUrl; publishToken } | { ok: false; error: 'ACCOUNT_TOO_NEW' | 'LIVE_FULL' | 'ALREADY_LIVE' | 'LIVE_BANNED' }>
endLive(liveId, userId): Promise<Result>
listLiveNow(): Promise<LiveCard[]>
getLiveForViewer(liveId, viewer: { userId?; anonId }): Promise<LiveView | { full: true } | { ended: true } | null>
authorizeMedia(req: { action: 'publish' | 'read'; path; token; ip }): Promise<boolean>   // cho /api/live/media-auth
heartbeat(liveId, viewer, ip): Promise<{ viewers: number }>
sendChat(liveId, userId, text): Promise<Result>
hideChat(messageId, ownerId): Promise<Result>
banFromChat(liveId, ownerId, userId): Promise<Result>
pinProduct(liveId, ownerId, productId | null): Promise<Result>
sendHearts(liveId, userId, count): Promise<{ hearts: number }>
reportLive(userId, liveId, reason, message?): Promise<Result>
stopLive(liveId, adminId, reason): Promise<void>                        // cho admin
banUserFromLive(userId, adminId, days: 1 | 7 | 30 | null, reason): Promise<void>
syncWithMediaServer(): Promise<void>                                     // worker gọi mỗi 5 giây
```

### Dữ liệu (bảng mới)

- `LiveSession`: id, hostUserId, kiotId? (Kiot của người phát nếu có), title, status (`created | live | ended | stopped`), mediaPath (ngẫu nhiên),
  publishTokenHash, startedAt, endedAt, endReason, peakViewers, hearts, hiddenAt, createdAt.
- `LiveViewer`: liveId, viewerKey, userId?, networkHash (mã băm IP, không lưu IP gốc), firstSeenAt, lastSeenAt,
  longestStreakSec. Khoá duy nhất (liveId, viewerKey).
- `LiveChatMessage`: id, liveId, userId, text, hiddenAt, hiddenBy, createdAt.
- `LiveChatBan`: (liveId, userId).
- `LiveReport`: liveId, userId, reason, message. Khoá duy nhất (liveId, userId).
- `LiveBan`: userId, until (trống = vĩnh viễn), reason, adminId, createdAt.

### Thay đổi ở module khác (cần CEO duyệt)

- **`orders`:** thêm cột `sourceLiveId` (cho phép trống) vào giỏ hàng và món trong đơn, giống `sourceVideoId` đang
  có. Chỉ thêm cột, không sửa dữ liệu cũ. Hợp đồng `addToCart` nhận thêm nguồn là buổi live.
- **`kiot`, `creator`:** trang Kiot và trang creator có nhãn LIVE và tab Live (chỉ giao diện).
- **`admin`:** thêm trang `/admin/live` và `/admin/xu`.

## Phần 2: `xu` — Thưởng xu theo KPI người xem

Xu là **điểm thưởng nội bộ, không phải tiền**: 1 xu dùng thay 1.000đ khi trả phí trong 9MUA. Không đổi ra tiền mặt,
không chuyển cho người khác, không mua được bằng tiền. Khách không tặng quà cho nhau; chỉ 9MUA thưởng.

### Tiêu chí chấp nhận

1. **Người xem hợp lệ** của một buổi live, phải đủ cả 5 điều kiện:
   - Đã đăng nhập, và tài khoản được tạo **ít nhất 3 ngày** trước lúc buổi live bắt đầu.
   - Xem **liên tục ít nhất 60 giây** (các tín hiệu cách nhau không quá 45 giây).
   - Chỉ tính 1 lần mỗi tài khoản mỗi buổi.
   - Không phải người đang phát.
   - Tối đa **3 tài khoản cùng một mạng** (cùng IP công khai) mỗi buổi; từ tài khoản thứ 4 cùng mạng thì không tính.
2. **Điều kiện buổi live:** có hình ít nhất **15 phút**, không bị CEO dừng vì vi phạm.
3. **Mức thưởng** (lấy mức cao nhất đạt được, không cộng dồn):

   | Người xem hợp lệ | Xu |
   |---|---|
   | ≥ 10 | 10 |
   | ≥ 25 | 30 |
   | ≥ 50 | 80 |

4. Mỗi tài khoản được thưởng **tối đa 1 buổi mỗi ngày** (giờ Việt Nam), tính buổi đủ điều kiện đầu tiên.
5. **Ngân sách 20.000 xu mỗi tháng** cho toàn hệ thống. Nếu lần thưởng làm vượt ngân sách thì không cộng, báo CEO
   và báo người phát "Đã hết ngân sách thưởng tháng này".
6. **Tự cộng** khi buổi live kết thúc (worker tính). Người phát nhận thông báo trong app: được bao nhiêu xu, hoặc lý do
   không được.
7. **CEO thu hồi** xu bằng một dòng trừ kèm lý do, ghi audit log. Số dư có thể âm; khi âm thì không dùng xu được.
8. **Xem xu:** trang Tôi hiện số dư, lịch sử từng dòng và luật thưởng.
9. **CEO chỉnh luật** trong `/admin/xu`: các mức thưởng, ngân sách tháng, số phút tối thiểu. Luật mới áp dụng cho buổi
   live bắt đầu sau khi lưu. Trang này cũng hiện ngân sách đã dùng trong tháng.
10. **Dùng xu** (gia hạn Kiot, đẩy video/live lên đầu) **chưa làm trong đợt này**. Sẽ viết vào `SPEC-billing.md` sau.

### Hợp đồng (`src/modules/xu/index.ts`)

```ts
getXuBalance(userId): Promise<number>
getXuHistory(userId, cursor?): Promise<Page<XuEntryView>>
rewardLive(liveId): Promise<{ credited: number } | { skipped: 'TOO_SHORT' | 'NOT_ENOUGH_VIEWERS' | 'DAILY_LIMIT' | 'BUDGET' | 'STOPPED' }>
revokeXu(userId, amount, adminId, reason): Promise<void>
getXuRules(): Promise<XuRules>
setXuRules(rules, adminId): Promise<void>
monthlyXuUsage(month): Promise<{ used: number; budget: number }>
```

### Dữ liệu

- `XuEntry` (**sổ chỉ thêm**, như sổ tiền: trigger trong DB chặn UPDATE và DELETE): id, userId, amount
  (số nguyên, dương là cộng, âm là trừ), kind (`live_reward | admin_revoke`), liveId?, rewardDay?, note,
  createdById?, createdAt. Khoá duy nhất (userId, rewardDay) cho dòng thưởng, để không thưởng 2 lần một ngày kể cả khi
  hai worker chạy cùng lúc.
- Luật thưởng lưu trong bảng `Setting` đang có (khoá `xu.rules`).

## Phụ thuộc mới (cần duyệt)

- **MediaMTX** (image Docker, phần mềm mã nguồn mở MIT), thêm thành service thứ 4 trong `docker-compose.yml`.
  Đây là lựa chọn CEO đã chốt ở quyết định 8.
- Không thêm thư viện npm.

## Testing Strategy

- **Unit:**
  - Luật người xem hợp lệ: tài khoản 2 ngày tuổi không tính; xem 59 giây không tính; ngắt quãng 50 giây thì tính lại
    từ đầu; người phát không tính; tài khoản thứ 4 cùng mạng không tính.
  - Bảng mức thưởng: 9 → 0, 10 → 10, 24 → 10, 25 → 30, 50 → 80.
  - Lọc link trong chat; giới hạn 1 tin mỗi 3 giây.
- **Integration (DB thật):**
  - `startLive`: tài khoản 2 ngày tuổi → `ACCOUNT_TOO_NEW`; đủ 2 buổi → `LIVE_FULL`; đang có buổi live → `ALREADY_LIVE`; bị cấm → `LIVE_BANNED`.
  - Tài khoản không có Kiot vẫn phát được và ghim được sản phẩm của Kiot khác; ghim sản phẩm của Kiot hết hạn → bị từ chối.
  - `authorizeMedia`: đúng mã phát → cho; mã sai, hết hạn hoặc sai buổi → chặn; mã xem hết hạn → chặn; người thứ 51 → chặn.
  - Buổi 14 phút → không thưởng; 2 buổi đủ điều kiện trong một ngày → chỉ buổi đầu được thưởng; gần hết ngân sách → không cộng và có thông báo cho CEO.
  - Hai worker cùng gọi `rewardLive` → chỉ 1 dòng thưởng.
  - `UPDATE`/`DELETE` vào `XuEntry` bị DB từ chối; thu hồi tạo dòng âm.
  - CEO dừng live → không thưởng, có audit log.
  - Thêm vào giỏ từ live → món trong đơn có `sourceLiveId`.
- **E2E (Playwright):** Chromium với camera giả: người phát bắt đầu live → người xem (điện thoại giả lập) thấy video chạy,
  thấy số người xem tăng, gửi chat và người phát nhận được → ghim sản phẩm → người xem thêm vào giỏ → người phát kết thúc
  → người xem thấy "Buổi live đã kết thúc". Chạy với một MediaMTX thật trên máy test.

## Boundaries (bổ sung)

- **Luôn làm:**
  - Kiểm tra quyền phát và quyền xem ở máy chủ cho mỗi kết nối.
  - Chỉ lưu mã băm của mã phát và IP.
  - Giới hạn số buổi, số người xem và thời lượng.
- **Hỏi trước:**
  - Ghi hình buổi live, hoặc phát lại.
  - Thêm TURN, hoặc chuyển phần phát hình sang dịch vụ ngoài.
  - Tăng giới hạn người xem hay số buổi vượt khả năng băng thông.
  - Cho khách tặng quà bằng tiền.
  - Dùng xu để trả phí.
- **Không bao giờ:**
  - Hiện số người xem, tim hay chat giả.
  - Đổi xu ra tiền mặt.
  - Sửa hay xoá dòng trong sổ xu.
  - Mở API quản trị của MediaMTX ra Internet.

## Success Criteria

- [ ] iPhone (Safari) và Android (Chrome) phát live được từ trình duyệt, người xem thấy hình trong vòng 5 giây.
- [ ] Độ trễ từ người phát tới người xem dưới 2 giây.
- [ ] 2 buổi × 50 người xem cùng lúc mà CPU VPS dưới 50% và web vẫn nhanh.
- [ ] Xu được cộng đúng luật, không bao giờ cộng 2 lần, và CEO thu hồi được.
- [ ] Người phát ghim sản phẩm, người xem mua được, và đơn ghi đúng buổi live nguồn.

## Mặc định (CEO đã duyệt 27/10/2026)

1. ~~Chỉ chủ Kiot được phát live~~ → **Mọi tài khoản được phát live** (CEO chốt 27/10). Kèm theo: tài khoản phải tạo
   ít nhất 3 ngày mới được phát, và ghim được sản phẩm của mọi Kiot đang hoạt động.
2. Ai cũng xem được; muốn chat, thả tim hay báo cáo thì phải đăng nhập.
3. Mỗi buổi tối đa 2 giờ.
4. Chat không cho gửi link.
5. 5 báo cáo thì ẩn khỏi danh sách và báo CEO, chứ không tự tắt live.
6. Thêm cột `sourceLiveId` vào giỏ và đơn hàng.
7. Chưa ghi hình, chưa dùng xu để trả phí.
