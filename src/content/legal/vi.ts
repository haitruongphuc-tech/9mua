import type { PolicySet } from './types';

// Bản gốc tiếng Việt — BẢN NHÁP chờ CEO duyệt (27/10/2026).
export const vi: PolicySet = {
  'quy-che': {
    title: 'Quy chế hoạt động sàn 9MUA',
    summary: 'Quy định chung cho người mua, người bán và 9MUA trên sàn 9mua.com.',
    sections: [
      {
        heading: 'Về sàn 9MUA',
        paragraphs: [
          '9mua.com là sàn giao dịch thương mại điện tử do {company} (mã số thuế {taxId}, địa chỉ {office}) vận hành.',
          'Mỗi người bán mở một gian hàng gọi là Kiot, có địa chỉ riêng dạng tenkiot.9mua.com. Sản phẩm của các Kiot đang hoạt động hiện chung trên Chợ 9MUA.',
          '9MUA không trực tiếp bán hàng. Người bán chịu trách nhiệm về sản phẩm, giá, mô tả và việc giao hàng. 9MUA giữ hộ tiền người mua trả và chỉ trả cho người bán khi giao dịch hoàn tất.',
        ],
      },
      {
        heading: 'Tài khoản',
        paragraphs: [
          'Bạn đăng ký bằng số điện thoại, email hoặc tài khoản Google, và tự giữ bí mật mật khẩu. Thông tin đăng ký phải đúng sự thật.',
          'Mỗi người chỉ dùng tài khoản của chính mình. 9MUA được khoá tài khoản vi phạm quy chế này.',
        ],
      },
      {
        heading: 'Mở Kiot',
        paragraphs: [
          'Phí thuê Kiot là {kiotFee}/năm (tương đương 1 USD, quy đổi theo tỷ giá bán USD của Vietcombank), trả bằng mã QR. Kiot hoạt động 1 năm kể từ ngày trả; gia hạn sớm thì thời hạn được cộng dồn.',
          'Hết hạn mà chưa gia hạn thì Kiot tạm ngưng hiển thị; sản phẩm và dữ liệu vẫn được giữ để mở lại.',
          'Người bán khai số điện thoại liên hệ và tài khoản ngân hàng nhận tiền đúng tên chủ tài khoản. Khi cần, 9MUA đề nghị xác minh căn cước công dân trước khi chuyển tiền.',
        ],
      },
      {
        heading: 'Hàng hoá được bán',
        paragraphs: [
          'Chỉ bán hàng hoá hợp pháp, có nguồn gốc rõ ràng và đúng như mô tả.',
          'Cấm bán: hàng giả, hàng nhái, hàng cấm kinh doanh theo pháp luật Việt Nam, thuốc kê đơn, vũ khí, chất cấm, động vật hoang dã, nội dung đồi truỵ và các mặt hàng pháp luật cấm khác.',
          'Không quảng cáo sai sự thật, không ghi công dụng chữa bệnh cho thực phẩm hay mỹ phẩm.',
        ],
      },
      {
        heading: 'Phí',
        paragraphs: [
          'Người mua không trả phí cho 9MUA.',
          'Người bán trả phí thuê Kiot và phí sàn {platformFee} trên tiền hàng của mỗi đơn hoàn tất. Rút tiền tối thiểu {payoutMin} mỗi lần, phí rút {payoutFee}.',
        ],
      },
      {
        heading: 'Kiểm duyệt nội dung',
        paragraphs: [
          'Sản phẩm, video hoặc bình luận bị 5 người khác nhau báo cáo vi phạm sẽ tự ẩn và chờ 9MUA xem xét.',
          '9MUA được gỡ nội dung, khoá Kiot hoặc khoá tài khoản vi phạm và báo lý do cho người liên quan.',
        ],
      },
      {
        heading: 'Liên hệ',
        paragraphs: ['Hotline {hotline} · Email {email} · Văn phòng {office}.'],
      },
    ],
  },
  'dieu-khoan': {
    title: 'Điều khoản sử dụng',
    summary: 'Khi dùng 9mua.com, bạn đồng ý với các điều khoản dưới đây.',
    sections: [
      {
        heading: 'Đồng ý điều khoản',
        paragraphs: [
          'Khi tạo tài khoản hoặc dùng 9mua.com, bạn đồng ý với điều khoản này, Quy chế hoạt động và các chính sách của sàn.',
        ],
      },
      {
        heading: 'Nội dung bạn đăng',
        paragraphs: [
          'Bạn giữ quyền đối với ảnh, video và mô tả mình đăng, và cho phép 9MUA hiển thị chúng trên sàn và trong các đường link chia sẻ.',
          'Bạn chỉ đăng nội dung mình có quyền sử dụng, không vi phạm bản quyền, không xúc phạm người khác và không trái pháp luật.',
        ],
      },
      {
        heading: 'AI Studio',
        paragraphs: [
          'Mô tả, ảnh và video do AI tạo chỉ là gợi ý. Chủ Kiot đọc, sửa và chịu trách nhiệm về nội dung trước khi bấm đăng bán. AI không tự đăng bán thay bạn.',
        ],
      },
      {
        heading: 'Hành vi bị cấm',
        paragraphs: [
          'Tạo tài khoản ảo để nhận voucher hoặc tăng lượt tim, lượt xem; spam; gian lận thanh toán; mạo danh người khác; tấn công hoặc làm gián đoạn hệ thống.',
        ],
      },
      {
        heading: 'Trách nhiệm',
        paragraphs: [
          '9MUA là bên trung gian giữ hộ tiền và hỗ trợ giải quyết khiếu nại. Người bán chịu trách nhiệm về chất lượng hàng hoá và nghĩa vụ với người mua.',
          '9MUA cố gắng giữ dịch vụ chạy liên tục nhưng có thể tạm dừng để bảo trì hoặc khi có sự cố ngoài ý muốn.',
        ],
      },
      {
        heading: 'Thay đổi điều khoản',
        paragraphs: [
          'Khi sửa điều khoản, 9MUA cập nhật trên trang này kèm ngày cập nhật. Tiếp tục dùng sàn sau ngày đó nghĩa là bạn đồng ý bản mới.',
          'Điều khoản này áp dụng theo pháp luật Việt Nam.',
        ],
      },
    ],
  },
  'bao-mat': {
    title: 'Chính sách bảo mật thông tin',
    summary: '9MUA thu thập những thông tin gì, dùng để làm gì và bảo vệ ra sao.',
    sections: [
      {
        heading: 'Thông tin 9MUA thu thập',
        paragraphs: [
          'Số điện thoại hoặc email, tên hiển thị, mật khẩu (lưu dạng mã hoá một chiều, không ai đọc được), địa chỉ nhận hàng, thông tin đơn hàng.',
          'Với người bán: số điện thoại liên hệ, địa chỉ lấy hàng, tài khoản ngân hàng nhận tiền, và ảnh căn cước khi xác minh (lưu riêng, chỉ CEO xem được).',
          'Lượt xem, lượt thích, theo dõi và bình luận trên video để gợi ý nội dung.',
        ],
      },
      {
        heading: 'Dùng để làm gì',
        paragraphs: [
          'Xử lý đơn hàng, thanh toán, giao hàng, hoàn tiền, chống gian lận và gửi email hệ thống (biên nhận, nhắc gia hạn, đặt lại mật khẩu).',
          'Người bán chỉ thấy tên, số điện thoại và địa chỉ nhận hàng của người mua trong đơn hàng của chính Kiot mình.',
        ],
      },
      {
        heading: 'Chia sẻ với ai',
        paragraphs: [
          'Cổng thanh toán PayOS (xử lý chuyển khoản), dịch vụ gửi email, và người bán (thông tin giao hàng của đơn).',
          'AI Studio chỉ gửi tên, danh mục và ghi chú sản phẩm do chủ Kiot nhập cho nhà cung cấp AI (Anthropic, Google). Không gửi dữ liệu khách hàng, đơn hàng hay tiền.',
          '9MUA không bán dữ liệu cá nhân của bạn.',
        ],
      },
      {
        heading: 'Cookie',
        paragraphs: [
          '9MUA dùng cookie để giữ đăng nhập, nhớ ngôn ngữ bạn chọn và giỏ hàng. Không dùng cookie quảng cáo của bên thứ ba.',
        ],
      },
      {
        heading: 'Bảo vệ thông tin',
        paragraphs: [
          'Kết nối HTTPS, mật khẩu mã hoá, khoá tạm khi đăng nhập sai nhiều lần, trang quản trị bắt buộc xác thực 2 lớp, sao lưu dữ liệu hằng ngày.',
        ],
      },
      {
        heading: 'Quyền của bạn',
        paragraphs: [
          'Xem và sửa thông tin trong trang Tài khoản. Muốn xoá tài khoản, gửi yêu cầu tới {email}; dữ liệu giao dịch được giữ theo thời hạn pháp luật về kế toán, thuế yêu cầu.',
        ],
      },
    ],
  },
  'doi-tra': {
    title: 'Chính sách đổi trả và hoàn tiền',
    summary: 'Tiền của người mua được 9MUA giữ hộ cho tới khi đơn hoàn tất.',
    sections: [
      {
        heading: 'Tiền được giữ hộ',
        paragraphs: [
          'Tiền người mua trả nằm ở 9MUA. 9MUA chỉ trả cho người bán khi người mua đã nhận hàng và hết 7 ngày khiếu nại.',
        ],
      },
      {
        heading: 'Hoàn tiền tự động',
        paragraphs: [
          'Người bán không xác nhận đơn trong 48 giờ sau khi bạn trả tiền; người bán huỷ đơn; hoặc bạn trả tiền muộn khi hàng đã hết: đơn chuyển sang chờ hoàn tiền.',
        ],
      },
      {
        heading: 'Hàng lỗi, sai, thiếu hoặc không nhận được',
        paragraphs: [
          'Trong 7 ngày kể từ khi đơn ở trạng thái "Đã giao", vào Đơn mua và bấm "Báo vấn đề", mô tả vấn đề và gửi tối đa 3 ảnh.',
          '9MUA xem xét, liên hệ hai bên và quyết định hoàn tiền cho bạn hoặc trả tiền cho người bán.',
        ],
      },
      {
        heading: 'Đổi hàng',
        paragraphs: [
          'Đổi size, đổi mẫu… do bạn thoả thuận với người bán. Nếu hai bên không thống nhất, bạn gửi khiếu nại để 9MUA hỗ trợ.',
        ],
      },
      {
        heading: 'Nhận tiền hoàn',
        paragraphs: [
          'Bạn nhập tài khoản ngân hàng nhận tiền ngay trong trang đơn hàng. 9MUA chuyển khoản đủ số tiền đã trả và báo trong đơn khi xong.',
          'Sau 7 ngày không khiếu nại, đơn hoàn tất và tiền đã trả cho người bán; khi đó bạn liên hệ trực tiếp người bán.',
        ],
      },
    ],
  },
  'khieu-nai': {
    title: 'Chính sách giải quyết khiếu nại',
    summary: 'Cách gửi khiếu nại và cách 9MUA xử lý.',
    sections: [
      {
        heading: 'Gửi khiếu nại ở đâu',
        paragraphs: [
          'Về đơn hàng: nút "Báo vấn đề" trong Đơn mua, trong 7 ngày sau khi đơn ở trạng thái "Đã giao".',
          'Về sản phẩm, video, bình luận vi phạm: nút "Báo cáo" ngay trên nội dung đó.',
          'Việc khác: hotline {hotline} hoặc email {email}.',
        ],
      },
      {
        heading: '9MUA xử lý thế nào',
        paragraphs: [
          'Khi có khiếu nại về đơn, tiền của đơn được giữ nguyên, chưa trả cho ai.',
          '9MUA xem mô tả, ảnh của người mua và thông tin giao hàng (mã vận đơn) của người bán, liên hệ hai bên khi cần, rồi quyết định hoàn tiền cho người mua hoặc trả tiền cho người bán. Kết quả được báo trong app và trong đơn hàng.',
        ],
      },
      {
        heading: 'Khi không đồng ý với kết quả',
        paragraphs: [
          'Các bên có thể tiếp tục thương lượng, hoà giải, hoặc đề nghị cơ quan nhà nước có thẩm quyền giải quyết theo pháp luật Việt Nam.',
        ],
      },
    ],
  },
  'van-chuyen': {
    title: 'Chính sách vận chuyển',
    summary: 'Người bán tự giao hàng; 9MUA theo dõi các mốc thời gian của đơn.',
    sections: [
      {
        heading: 'Ai giao hàng',
        paragraphs: [
          'Mỗi Kiot tự giao hàng hoặc tự chọn đơn vị vận chuyển. Phí giao hàng do từng Kiot đặt, có thể miễn phí từ một mức giá trị đơn, và hiện rõ trước khi bạn đặt hàng.',
        ],
      },
      {
        heading: 'Các mốc thời gian',
        paragraphs: [
          'Người bán xác nhận đơn trong 48 giờ sau khi bạn trả tiền, sau đó giao hàng và nhập mã vận đơn (nếu có).',
          'Nhận hàng xong, bạn bấm "Đã nhận hàng". Nếu không bấm, đơn tự chuyển "Đã giao" sau 10 ngày kể từ khi người bán giao.',
        ],
      },
      {
        heading: 'Địa chỉ và hư hỏng',
        paragraphs: [
          'Bạn ghi địa chỉ và số điện thoại nhận hàng chính xác. Hàng hư hỏng, thất lạc khi vận chuyển được xử lý theo Chính sách đổi trả và hoàn tiền.',
        ],
      },
    ],
  },
  'thanh-toan': {
    title: 'Chính sách thanh toán',
    summary: 'Người mua trả cho 9MUA qua mã QR; 9MUA trả cho người bán khi đơn hoàn tất.',
    sections: [
      {
        heading: 'Người mua trả tiền',
        paragraphs: [
          'Bạn trả cho 9MUA bằng mã QR chuyển khoản (cổng PayOS), dùng được với mọi ứng dụng ngân hàng. Mã có hiệu lực 15 phút; quá hạn thì đơn tự huỷ và hàng được trả lại Kiot.',
          'Giá trên 9MUA luôn ghi bằng VNĐ.',
          'Không chuyển tiền trực tiếp cho người bán ngoài sàn: 9MUA không bảo vệ được giao dịch ngoài sàn.',
        ],
      },
      {
        heading: 'Người bán nhận tiền',
        paragraphs: [
          'Khi đơn hoàn tất (đã giao và hết 7 ngày khiếu nại), tiền hàng trừ phí sàn {platformFee} được cộng vào số dư của Kiot.',
          'Người bán rút tiền về tài khoản ngân hàng đúng tên, tối thiểu {payoutMin} mỗi lần, phí rút {payoutFee}.',
        ],
      },
      {
        heading: 'Phí thuê Kiot',
        paragraphs: [
          '{kiotFee}/năm, trả bằng mã QR và có email biên nhận. Giá quy đổi từ 1 USD theo tỷ giá Vietcombank; mã QR đã tạo giữ nguyên giá lúc tạo.',
        ],
      },
      {
        heading: 'Chuyển sai số tiền',
        paragraphs: [
          'Nếu bạn chuyển thiếu hoặc thừa so với mã QR, hệ thống báo 9MUA và 9MUA liên hệ bạn để xử lý.',
        ],
      },
    ],
  },
};
