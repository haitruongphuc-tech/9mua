# Spec: `messages` — Hộp thư, nhắn tin giữa người dùng

Trạng thái: **CEO duyệt qua chat 29/10/2026** (câu 4 trong bảng đề xuất: "Đồng ý hết đề xuất", "tiến hành làm").
Phụ thuộc: `identity`, `kiot`, `social`. Không đụng tiền.

## Objective

Người dùng nhắn tin với nhau ngay trong 9MUA: người mua hỏi Kiot về sản phẩm, creator trò chuyện với người follow.
Mục "Hộp thư" nằm ở thanh dưới (`/hop-thu`). Ưu tiên chống spam và lừa đảo, vì tin nhắn riêng là nơi dễ bị lợi dụng nhất.

### Tiêu chí chấp nhận

1. **Hộp thư `/hop-thu`** (phải đăng nhập): danh sách cuộc trò chuyện mới nhất trước (ảnh đại diện, tên, tin cuối, giờ,
   chấm chưa đọc). Tab **"Tin nhắn chờ"** chứa tin của người lạ. Số tin chưa đọc hiện trên nút Hộp thư ở thanh dưới.
2. **Bắt đầu trò chuyện:**
   - Nút "Nhắn tin" ở trang Kiot (nhắn cho chủ Kiot), trang creator, và "Hỏi Kiot" ở trang sản phẩm (gửi kèm **thẻ sản phẩm**).
   - Chỉ trò chuyện 1-1. Chưa có nhóm.
   - Không tự nhắn cho chính mình.
3. **Ai nhắn được cho ai:**
   - Nhắn cho **chủ Kiot đang hoạt động**: vào thẳng hộp thư chính của chủ Kiot.
   - Hai người có quan hệ follow (một trong hai follow người kia): vào thẳng hộp thư chính.
   - Còn lại (người lạ): tin vào **"Tin nhắn chờ"** của người nhận. Người gửi chỉ gửi được **1 tin** cho tới khi người nhận
     bấm **Chấp nhận**. Người nhận có thể Chấp nhận, Xoá, hoặc Chặn. Người nhận trả lời thì coi như chấp nhận.
4. **Nội dung:**
   - Chữ tối đa 1.000 ký tự. **Không cho gửi link** ra ngoài (cùng luật với chat live: `http`, `www.`, `abc.com`,
     `zalo.me/...`), báo "Không gửi link trong tin nhắn."
   - Ảnh: 1 ảnh mỗi tin, JPG/PNG/WebP ≤ 5 MB, máy chủ chuyển về WebP và bỏ thông tin vị trí. Ảnh **không công khai**: chỉ
     2 người trong cuộc trò chuyện (và CEO khi xem báo cáo) mở được.
   - Thẻ sản phẩm (ảnh, tên, giá, link về trang sản phẩm 9MUA) khi bấm "Hỏi Kiot".
   - Chưa có: gọi điện, ghi âm, video, thu hồi tin.
5. **Giới hạn chống spam** (máy chủ kiểm):
   - Mỗi người tối đa **1 tin mỗi giây**.
   - Tài khoản **Free** (không có Kiot đang hoạt động) mở tối đa **20 cuộc trò chuyện mới mỗi ngày** (giờ Việt Nam).
     Chủ Kiot đang hoạt động và admin không bị giới hạn này. Hết lượt thì báo "Tài khoản Free mở tối đa 20 cuộc trò chuyện
     mới mỗi ngày. Mở Kiot để không giới hạn."
   - Tài khoản tạo dưới 1 ngày chỉ nhắn được cho chủ Kiot.
6. **Thời gian thực:** tin mới hiện ngay qua Server-Sent Events (`/api/hop-thu/events`); không có SSE thì hỏi lại mỗi 5 giây.
   Đã xem: hiện "Đã xem" dưới tin cuối khi người kia đã mở cuộc trò chuyện.
7. **Chặn và báo cáo:**
   - Chặn: người bị chặn không gửi được tin cho mình nữa (báo "Không gửi được tin nhắn cho người này"), cuộc trò chuyện ẩn
     khỏi hộp thư của người chặn. Bỏ chặn trong Cài đặt.
   - Báo cáo cuộc trò chuyện (lý do: lừa đảo, quấy rối, spam, khác). CEO thấy ở `/admin/tin-nhan` **chỉ các cuộc trò
     chuyện bị báo cáo**, xem 50 tin gần nhất lúc báo cáo. CEO không có chỗ đọc tin nhắn không bị báo cáo.
   - CEO: ẩn tin vi phạm, **cấm nhắn tin** 1 / 7 / 30 ngày / vĩnh viễn, hoặc khoá tài khoản như hiện có. Mọi thao tác ghi
     audit log.
   - 3 người khác nhau báo cáo cùng một người trong 7 ngày thì người đó tự bị cấm nhắn tin 1 ngày và CEO nhận thông báo.
8. **Xoá phía mình:** "Xoá cuộc trò chuyện" chỉ ẩn ở phía người bấm; người kia vẫn thấy. Tin mới đến thì hiện lại.
9. **Thông báo:** không gửi email cho từng tin nhắn (tránh spam hộp thư). Chỉ có số chưa đọc trong app.
10. **7 thứ tiếng:** giao diện Hộp thư dịch như các trang khác; nội dung tin nhắn giữ nguyên.

### Hợp đồng (`src/modules/messages/index.ts`)

```ts
openConversation(userId, otherUserId): Promise<{ ok: true; conversationId: string } | { ok: false; error: 'SELF' | 'NOT_FOUND' | 'BLOCKED' | 'BANNED' | 'FREE_LIMIT' | 'NEW_ACCOUNT' }>
sendMessage(userId, conversationId, input: { text?; imageId?; productId? }): Promise<{ ok: true; message: MessageView } | { ok: false; error: 'EMPTY' | 'TOO_LONG' | 'LINK' | 'TOO_FAST' | 'REQUEST_PENDING' | 'BLOCKED' | 'BANNED' | 'NOT_MEMBER' | 'IMAGE_INVALID' }>
listConversations(userId, folder: 'inbox' | 'requests'): Promise<ConversationView[]>
getConversation(userId, conversationId): Promise<ConversationDetail | null>
getMessages(userId, conversationId, opts?: { after?: string }): Promise<MessageView[] | null>
markRead(userId, conversationId) / acceptRequest(userId, conversationId) / deleteConversation(userId, conversationId)
blockUser(userId, otherUserId) / unblockUser(userId, otherUserId) / listBlocked(userId)
reportConversation(userId, conversationId, reason): Promise<{ ok: boolean }>
unreadCount(userId): Promise<number>
saveMessageImage(userId, data: Buffer) / readMessageImage(userId, imageId, opts?: { admin?: boolean }): Promise<Buffer | null>
productCardOf(productId): Promise<ProductCard | null>
// admin
listReportedConversations(), reportedConversationDetail(id), hideMessage(adminId, messageId, reason),
banFromMessages(adminId, userId, days | 'forever', reason), markReportsHandled(adminId, conversationId), hasActiveMessageBan(userId)
```

Cần thêm ở `social` (chỉ thêm): `followRelation(a, b): Promise<boolean>` (một trong hai follow người kia).
Ở `kiot` dùng hàm có sẵn để biết người nhận có Kiot đang hoạt động.

### Dữ liệu (bảng mới, chỉ thêm)

- `Conversation`: id, `userAId` < `userBId` (duy nhất theo cặp), `status` (`request` | `active`), `requestedById`,
  `acceptedAt`, `lastMessageAt`, `createdAt`.
- `ConversationMember`: (conversationId, userId) khoá chính, `lastReadAt`, `hiddenAt` (xoá phía mình).
- `Message`: id, conversationId, senderId, `text`, `imageId`, `productId`, `createdAt`, `hiddenAt`, `hiddenReason` (CEO ẩn).
- `MessageImage`: id, ownerId, đường dẫn file trong thư mục riêng tư (không qua Nginx), kích thước, createdAt.
- `MessageBlock`: (blockerId, blockedId) khoá chính, createdAt.
- `MessageReport`: id, conversationId, reporterId, reportedUserId, reason, createdAt, `handledAt`. Mỗi người báo 1 lần mỗi
  cuộc trò chuyện.
- `MessageBan`: id, userId, `until` (trống = vĩnh viễn), reason, byAdminId, createdAt.
- `NewConversationDaily`: (userId, day) khoá chính, count — đếm cuộc trò chuyện mới của tài khoản Free.

## Testing Strategy

- **Unit:** phát hiện link (dùng chung luật chat live); ngày theo giờ Việt Nam.
- **Integration (DB thật):**
  - Nhắn cho chủ Kiot → vào hộp thư chính; người lạ → Tin nhắn chờ, tin thứ 2 bị chặn tới khi chấp nhận; trả lời = chấp nhận.
  - Link bị chặn; quá 1.000 ký tự bị chặn; 2 tin trong 1 giây bị chặn.
  - Tài khoản Free: cuộc trò chuyện mới thứ 21 trong ngày bị chặn; chủ Kiot không bị chặn; tài khoản mới chỉ nhắn được Kiot.
  - Chặn: người bị chặn gửi không được; bỏ chặn thì gửi được.
  - Xoá phía mình: người kia vẫn thấy; tin mới làm hiện lại.
  - Đọc tin: chỉ thành viên đọc được; ảnh chỉ thành viên (và admin khi có báo cáo) mở được.
  - Báo cáo: CEO thấy cuộc trò chuyện bị báo cáo; 3 người báo cáo trong 7 ngày → tự cấm 1 ngày + báo CEO; cấm nhắn tin
    thì gửi không được; ghi audit log.
  - Số chưa đọc đúng sau khi đọc.
- **E2E:** khách hỏi Kiot từ trang sản phẩm → chủ Kiot thấy tin (có thẻ sản phẩm) và trả lời → khách thấy ngay;
  người lạ nhắn → vào Tin nhắn chờ; chặn; CEO xem cuộc trò chuyện bị báo cáo.

## Boundaries

- **Luôn làm:** kiểm quyền thành viên ở máy chủ cho mọi lần đọc/gửi/xem ảnh; giới hạn tốc độ ở máy chủ; ghi audit log
  thao tác của CEO.
- **Hỏi trước:** nhắn nhóm; gửi email/thông báo đẩy cho từng tin; cho CEO đọc tin nhắn không bị báo cáo; mã hoá đầu-cuối.
- **Không bao giờ:** cho gửi link ra ngoài; để ảnh tin nhắn công khai; ghi nội dung tin nhắn vào log; hiện số chưa đọc giả.

## Ghi chú khi làm (T72)

- Giới hạn "20 cuộc trò chuyện mới mỗi ngày" và "tài khoản dưới 1 ngày chỉ nhắn Kiot" kiểm lúc **mở** cuộc trò chuyện mới
  (mở lại cuộc cũ không tính lượt). Cuộc trò chuyện chưa có tin nào không hiện trong hộp thư của ai.
- Nhắn cho chính chủ Kiot hiện ở trang Kiot ("Nhắn tin"), trang creator ("Nhắn tin") và trang sản phẩm ("Hỏi Kiot", gắn
  sẵn thẻ sản phẩm vào ô nhắn). Nút nằm ở tên miền phụ của Kiot vẫn đưa về `9mua.com/hop-thu`.
- SSE `/api/hop-thu/events` đọc DB mỗi 1,5 giây (giống chat live), tự đóng sau 5 phút; Nginx tắt gom dữ liệu cho đường này.
- Ảnh tin nhắn lưu trong thư mục riêng tư (như ảnh CCCD), xem qua `/api/hop-thu/anh/<id>` có kiểm quyền.

## Bổ sung 30/10/2026 — Nâng cấp một đợt (V5)

> **Trạng thái: CEO duyệt qua chat 30/10/2026 ("duyệt làm đi").** Quyết định, công tắc, dữ liệu: `docs/nang-cap-mot-dot.md`.

### V5.1 Gửi video qua Hộp thư (C65, M2) — công tắc `feature.share_more`

- Bảng chia sẻ có hàng 8 cuộc trò chuyện gần nhất và nút tìm. Chạm một người là gửi tin dạng thẻ video (ảnh bìa, chú thích,
  @tên). Gửi tin nhắn đi kèm (tuỳ chọn).
- Chỉ gửi video người gửi được xem. Người nhận không được xem thì thẻ ghi "Video không còn xem được".
- Tính vào giới hạn gửi tin như tin thường; không gửi cho người đã chặn nhau.

### V5.2 Nhắn nhóm (C80) — công tắc `feature.messages_more`

- `Conversation` thêm cột `kind` (`direct` mặc định, `group`), `title`, `avatarPath`.
- Nhóm 3–100 người. Người tạo là quản trị: thêm, mời ra, đổi tên, đổi ảnh. Thành viên tự rời nhóm được.
- Chỉ thêm được người follow lẫn nhau với mình, hoặc người đã nhắn 1-1 với mình. Tài khoản tạo dưới 1 ngày không tạo nhóm.
- Luật tin nhắn như 1-1 (không link, chống gửi nhanh). Báo cáo nhóm; CEO xem cuộc trò chuyện nhóm bị báo cáo như 1-1.

### V5.3 Tin nhắn thoại, video, thu hồi (C81) — công tắc `feature.messages_more`

- **Tin thoại** ≤ 60 giây, ghi bằng trình duyệt; máy chủ chuyển sang AAC để iPhone phát được.
- **Tin video** ≤ 60 giây, đi qua bộ xử lý video (hàng chờ `short`), không bao giờ hiện công khai.
- **Thu hồi** trong 10 phút: mọi người thấy "Tin nhắn đã thu hồi"; nội dung bị xoá. Tin đã bị báo cáo trước khi thu hồi thì CEO
  vẫn xem bản đã chụp lúc báo cáo.
- Bảng `MessageMedia` (messageId, kind `voice | video`, path, durationSec).

### Kiểm thử V5 (riêng `messages`)

- Thẻ video riêng tư không lộ nội dung cho người không đủ quyền.
- Không thêm được người lạ vào nhóm; người bị mời ra không đọc được tin mới.
- Thu hồi sau 10 phút bị từ chối; tin bị báo cáo rồi thu hồi vẫn có bản chụp cho CEO.
