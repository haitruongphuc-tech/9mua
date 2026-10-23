# 9mua.com — Hướng dẫn cho Claude

## Quy tắc làm việc với CEO (bắt buộc)

CEO Nguyễn Hải đặt ra ngày 23/10/2026:

1. **Phản biện trước khi làm.** Mỗi khi CEO yêu cầu một chức năng hoặc chỉnh sửa, phải phân tích và nói rõ
   ảnh hưởng tới hệ thống đang chạy trước khi bắt tay vào làm: module nào bị đụng, dữ liệu và tiền có bị
   ảnh hưởng không, bảo mật, tương thích ngược. Nếu yêu cầu có rủi ro thì nói thẳng và đề xuất cách an toàn hơn.
2. **Hiểu đúng ý trước khi làm.** Khi có yêu cầu mới, nhắc lại yêu cầu theo cách mình hiểu. Chỗ nào mơ hồ
   thì hỏi lại, không tự đoán rồi làm.
3. **Trình bày rõ và đề xuất cách làm hợp lý.** Luôn giải thích bằng tiếng Việt dễ hiểu, không thuật ngữ
   thừa. Hướng dẫn và đề xuất cách thêm chức năng sao cho khớp với kiến trúc hiện có: module nào,
   có cần sửa spec không, tác động tới các phần khác.

## Quy trình

- Theo quy trình agent-skills (addyosmani/agent-skills): spec → plan → build (TDD) → review → ship.
- Nguồn sự thật:
  - `CAPABILITY-MAP.md`: 9 module và thứ tự phụ thuộc.
  - `SPEC-<module>.md`: yêu cầu đã được CEO duyệt.
  - `tasks/plan.md`, `tasks/todo.md`: kế hoạch và tiến độ.
  - `docs/BRAND.md`: logo và màu.
  - `docs/deploy.md`: VPS, Docker, Nginx.
- Yêu cầu mới làm thay đổi phạm vi thì **cập nhật spec trước** và được CEO duyệt, rồi mới code.
- Mỗi task: viết test trước → code → `npm run lint && npm test` → một commit riêng.

## Ranh giới kỹ thuật (tóm tắt từ SPEC-identity.md)

- Module khác chỉ import qua `src/modules/<id>/index.ts`.
- Tiền là số nguyên VNĐ. Sổ tiền (`PaymentEvent`, `BalanceEntry`, `OrderEvent`, audit log) chỉ được thêm,
  không bao giờ sửa hay xoá.
- Không commit `.env` hay bí mật. Không log mật khẩu, token, cookie.
- Phải hỏi CEO trước khi:
  - thêm dependency mới;
  - đổi schema của bảng đã có dữ liệu thật;
  - đổi hợp đồng `index.ts`;
  - thao tác trên VPS hay DB production.
