// Nội dung dữ liệu mẫu (src/server/demo-data.ts): 6 Kiot, 40 sản phẩm. Tên, giá, mô tả viết giống Kiot thật để
// CEO thử web; mọi Kiot ghi "(Mẫu)" và mọi mô tả ghi rõ không bán thật.
// query: từ khoá tiếng Anh để tìm ảnh thật trên Pixabay/Pexels (kho ảnh tiếng Anh cho kết quả đúng hơn).
export type DemoProduct = {
  name: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  category: string;
  query: string;
  intro: string; // 1–2 câu mở đầu
  highlights: string[]; // điểm nổi bật
  spec: string[]; // quy cách, xuất xứ, kích thước…
  care?: string[]; // hướng dẫn riêng, thay cho hướng dẫn chung của danh mục
};

export type DemoKiot = {
  slug: string;
  name: string;
  owner: string;
  description: string;
  province: string;
  district: string;
  color: [string, string];
  caption: string;
  promises: string[]; // cam kết riêng của shop, in trong mọi mô tả sản phẩm của Kiot
  queries: { logo: string; cover: string; video: string };
  products: DemoProduct[];
};

// Hướng dẫn dùng/bảo quản theo danh mục: phần chung của mô tả.
const CARE: Record<string, string[]> = {
  'nong-san': [
    'Bảo quản ngăn mát tủ lạnh 5–10°C, ngon nhất trong 3–5 ngày.',
    'Rửa sạch, để ráo trước khi dùng. Trái chưa chín tới thì để nhiệt độ phòng 1–2 ngày.',
  ],
  'thuc-pham-dac-san': [
    'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp.',
    'Sau khi mở túi: buộc kín, để ngăn mát và dùng trong 7–10 ngày.',
  ],
  'thoi-trang': [
    'Giặt tay hoặc giặt máy chế độ nhẹ ở 30°C, lộn trái khi giặt.',
    'Không dùng thuốc tẩy; phơi nơi thoáng mát, tránh nắng gắt để giữ màu.',
    'Bảng size: S (45–52kg), M (52–60kg), L (60–68kg), XL (68–76kg). Phân vân giữa 2 size thì chọn size lớn hơn.',
  ],
  'my-pham': [
    'Thử trên vùng da nhỏ (cổ tay, sau tai) trước khi dùng lần đầu.',
    'Tránh tiếp xúc với mắt; nếu dính vào mắt, rửa ngay bằng nước sạch.',
    'Bảo quản dưới 30°C, đậy nắp kín. Hạn dùng 24 tháng từ ngày sản xuất, 12 tháng sau khi mở.',
  ],
  'do-gia-dung': [
    'Đọc kỹ hướng dẫn sử dụng kèm theo trước khi dùng.',
    'Vệ sinh sau mỗi lần dùng bằng khăn mềm, không dùng miếng chà kim loại.',
    'Bảo hành 12 tháng lỗi do nhà sản xuất.',
  ],
  'dien-tu': [
    'Sạc bằng củ sạc chuẩn 5V–2A trở lên; không để máy nơi ẩm ướt hoặc nhiệt độ cao.',
    'Bảo hành 12 tháng, 1 đổi 1 trong 7 ngày đầu nếu lỗi nhà sản xuất.',
  ],
  'me-va-be': [
    'Giặt hoặc tiệt trùng trước khi dùng lần đầu cho bé.',
    'Dùng nước giặt riêng cho trẻ em, không dùng nước xả có hương liệu mạnh.',
    'Luôn có người lớn trông chừng khi bé sử dụng.',
  ],
  'thu-cung': [
    'Chuyển đổi thức ăn từ từ trong 5–7 ngày để bé quen vị.',
    'Luôn để sẵn nước sạch. Đóng kín miệng túi sau khi dùng, bảo quản nơi khô mát.',
  ],
  'sach-van-phong-pham': ['Phù hợp bé từ 3 tuổi. Dùng bút màu sáp hoặc bút chì màu cho kết quả đẹp nhất.'],
  'thu-cong-my-nghe': [
    'Để nơi khô ráo; lau bụi bằng khăn khô hoặc chổi lông mềm.',
    'Hàng thủ công nên mỗi sản phẩm có thể khác nhau đôi chút về màu và đường đan.',
  ],
};

const SHIPPING = [
  'Đóng gói cẩn thận, giao toàn quốc 2–4 ngày (nội thành 1–2 ngày).',
  'Được kiểm tra hàng trước khi thanh toán cho người giao.',
  'Đổi trả miễn phí trong 7 ngày nếu hàng lỗi hoặc không đúng mô tả.',
];

// Mô tả đầy đủ như người bán thật viết: giới thiệu, điểm nổi bật, quy cách, hướng dẫn, giao hàng.
export function describeProduct(p: DemoProduct, k: Pick<DemoKiot, 'promises'>): string {
  const list = (items: string[]) => items.map((i) => `• ${i}`).join('\n');
  return [
    p.intro,
    `ĐIỂM NỔI BẬT\n${list(p.highlights)}`,
    `THÔNG TIN SẢN PHẨM\n${list(p.spec)}`,
    `HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN\n${list(p.care ?? CARE[p.category] ?? CARE['do-gia-dung']!)}`,
    `CAM KẾT CỦA SHOP\n${list(k.promises)}`,
    `GIAO HÀNG & ĐỔI TRẢ\n${list(SHIPPING)}`,
    '(Đây là sản phẩm mẫu để thử web 9MUA, không bán thật.)',
  ].join('\n\n');
}

export const DEMO_KIOTS: DemoKiot[] = [
  {
    slug: 'mau-traicay',
    name: 'Trái cây Miền Tây (Mẫu)',
    owner: 'Chị Ngọc (Mẫu)',
    description:
      'Nhà vườn 3 đời ở Phong Điền, Cần Thơ. Trái cây hái theo đơn mỗi sáng, không dùng thuốc giữ tươi, giao trong ngày ở Cần Thơ và 2–3 ngày đi các tỉnh. Đây là Kiot mẫu để thử web.',
    province: 'can-tho',
    district: 'Ninh Kiều',
    color: ['#f59e0b', '#16a34a'],
    caption: 'Xoài cát chín cây, ngọt lịm #traicay #mientay #mau',
    promises: [
      'Trái cây nhà vườn trồng, không qua thương lái, không thuốc giữ tươi.',
      'Trái dập, hư khi nhận: chụp ảnh gửi shop, shop gửi bù trong lần giao sau hoặc hoàn tiền.',
      'Shop báo trước nếu hết mùa hoặc trái chưa đạt, không giao hàng kém chất lượng.',
    ],
    queries: { logo: 'tropical fruit', cover: 'fruit market stall', video: 'tropical fruit' },
    products: [
      {
        name: 'Xoài cát Hòa Lộc loại 1 (1kg)',
        price: 65_000,
        compareAtPrice: 80_000,
        stock: 120,
        category: 'nong-san',
        query: 'mango fruit',
        intro:
          'Xoài cát Hòa Lộc chính gốc Tiền Giang, chín cây tự nhiên, thịt vàng óng, ngọt thanh và thơm đặc trưng. Loại 1: trái đều, 2–3 trái mỗi kg, vỏ mỏng, hạt lép.',
        highlights: [
          'Chín cây, không ủ hoá chất, để 1–2 ngày là ăn được',
          'Thịt dày, mịn, ít xơ, độ ngọt cao',
          'Hái theo đơn mỗi sáng, giao trong ngày ở Cần Thơ',
          'Mỗi trái bọc lưới xốp, đóng thùng carton chống dập',
        ],
        spec: [
          'Khối lượng: 1kg (2–3 trái)',
          'Xuất xứ: Cái Bè, Tiền Giang',
          'Mùa vụ: quanh năm, ngon nhất tháng 4–6',
          'Độ ngọt: 18–22 độ Brix',
          'Đóng gói: thùng carton có lưới xốp',
          'Chứng nhận: VietGAP',
        ],
      },
      {
        name: 'Sầu riêng Ri6 nguyên trái (2–3kg)',
        price: 145_000,
        compareAtPrice: null,
        stock: 40,
        category: 'nong-san',
        query: 'durian fruit',
        intro:
          'Sầu riêng Ri6 cơm vàng, hạt lép, béo ngọt vừa phải. Nhà vườn chọn trái già, cắt cuống chuẩn, chín tự nhiên 1–2 ngày sau khi nhận. Mỗi trái được gõ thử và soi cuống trước khi giao, nhà vườn quay video cân trái gửi khách trước khi đóng thùng.',
        highlights: [
          'Cơm vàng đậm, ráo, không sượng',
          'Bao ăn: trái sượng hoặc hư được đổi trái mới',
          'Giá đã tính theo kg thực tế khi cân',
          'Có video cân trái trước khi giao',
        ],
        spec: [
          'Khối lượng: 2–3kg mỗi trái',
          'Giá: 145.000đ/trái 2kg, phụ thu theo cân nặng',
          'Xuất xứ: Cai Lậy, Tiền Giang',
          'Độ chín: già 100–110 ngày, chín sau 1–2 ngày',
          'Đóng gói: thùng carton đục lỗ, bọc lưới',
          'Chứng nhận: VietGAP',
        ],
      },
      {
        name: 'Bưởi da xanh Bến Tre (1 trái)',
        price: 55_000,
        compareAtPrice: 70_000,
        stock: 80,
        category: 'nong-san',
        query: 'pomelo',
        intro:
          'Bưởi da xanh Bến Tre ruột hồng, tép mọng nước, vị ngọt thanh không đắng. Trái được tuyển tay, vỏ mỏng, mỗi trái 1,3–1,6kg.',
        highlights: [
          'Ruột hồng, ráo nước, dễ tách múi',
          'Để được 2–3 tuần ở nhiệt độ phòng',
          'Hợp làm quà biếu, cúng rằm',
          'Vỏ có tinh dầu thơm, dùng nấu nước gội đầu được',
        ],
        spec: [
          'Khối lượng: 1,3–1,6kg/trái',
          'Xuất xứ: Chợ Lách, Bến Tre',
          'Độ ngọt: 10–12 độ Brix',
          'Mùa ngon: tháng 8 đến Tết Âm lịch',
          'Bảo quản: nhiệt độ phòng 2–3 tuần',
          'Chứng nhận: VietGAP',
        ],
      },
      {
        name: 'Chôm chôm nhãn (1kg)',
        price: 45_000,
        compareAtPrice: null,
        stock: 60,
        category: 'nong-san',
        query: 'rambutan',
        intro:
          'Chôm chôm nhãn trái nhỏ, cùi dày, giòn, tróc hạt, ngọt đậm như nhãn. Hái buổi sáng, đóng thùng có lỗ thông khí để giữ tươi. Đây là giống chôm chôm đặc sản của Phong Điền, mỗi năm chỉ có khoảng 3 tháng.',
        highlights: [
          'Cùi giòn, tróc hạt',
          'Ngọt đậm, không chua',
          'Đóng thùng thông khí, giữ tươi 3–4 ngày',
          'Trái chọn đều, không trái nứt hay sâu',
        ],
        spec: [
          'Khối lượng: 1kg (khoảng 35–40 trái)',
          'Xuất xứ: Phong Điền, Cần Thơ',
          'Mùa vụ: tháng 5–8',
          'Đóng gói: thùng carton có lỗ thông khí',
          'Bảo quản: ngăn mát 3–4 ngày',
        ],
      },
      {
        name: 'Thanh long ruột đỏ (1kg)',
        price: 35_000,
        compareAtPrice: 42_000,
        stock: 150,
        category: 'nong-san',
        query: 'dragon fruit',
        intro:
          'Thanh long ruột đỏ Long An, trái to, vỏ đỏ tươi, ruột đỏ tím ngọt mát. Giàu chất xơ và vitamin C, hợp ăn sáng, làm sinh tố.',
        highlights: [
          'Ruột đỏ đậm, ngọt hơn thanh long trắng',
          'Trái 400–500g, đều trái',
          'Hái chín tới, không chín ép',
          'Vỏ mỏng, tai xanh tươi chứng tỏ trái mới hái',
        ],
        spec: [
          'Khối lượng: 1kg (2–3 trái)',
          'Xuất xứ: Châu Thành, Long An',
          'Trọng lượng trái: 400–500g',
          'Độ ngọt: 14–16 độ Brix',
          'Bảo quản: ngăn mát 7–10 ngày',
          'Chứng nhận: VietGAP',
        ],
      },
      {
        name: 'Mít Thái sấy giòn (500g)',
        price: 89_000,
        compareAtPrice: null,
        stock: 200,
        category: 'thuc-pham-dac-san',
        query: 'dried fruit snack',
        intro:
          'Mít Thái sấy giòn bằng công nghệ sấy chân không, giữ nguyên vị ngọt tự nhiên, không thêm đường, không chất bảo quản. Miếng to, vàng đều, giòn rụm.',
        highlights: [
          'Sấy chân không, ít dầu',
          'Không đường, không phẩm màu',
          'Túi zip tiện mang theo',
          'Ăn vặt lành mạnh cho cả trẻ em và người ăn kiêng',
        ],
        spec: [
          'Khối lượng: 500g',
          'Hạn dùng: 6 tháng từ ngày sản xuất',
          'Nơi sản xuất: Cần Thơ, có giấy ATTP',
          'Thành phần: 100% mít Thái chín',
          'Đóng gói: túi zip có lớp nhôm chống ẩm',
          'Năng lượng: khoảng 380 kcal/100g',
        ],
      },
      {
        name: 'Combo trái cây biếu Tết',
        price: 450_000,
        compareAtPrice: 520_000,
        stock: 15,
        category: 'thuc-pham-dac-san',
        query: 'fruit gift basket',
        intro:
          'Giỏ trái cây biếu Tết gồm 5 loại theo mùa, xếp trong giỏ mây, bọc giấy kiếng và nơ đỏ. Có thiệp ghi lời chúc theo yêu cầu. Nhà vườn chọn trái đẹp nhất trong vườn, giao tận tay trong ngày ở Cần Thơ.',
        highlights: [
          '5 loại trái cây chọn lọc theo mùa',
          'Giỏ mây đan tay dùng lại được',
          'Miễn phí thiệp và lời chúc',
          'Giao đúng giờ hẹn, có ảnh giỏ trước khi giao',
        ],
        spec: [
          'Tổng khối lượng: 5–6kg',
          'Kích thước giỏ: 40 × 30cm',
          'Đặt trước 1 ngày để nhà vườn chuẩn bị',
          'Gồm: bưởi, xoài cát, thanh long, quýt hồng, nho (đổi theo mùa)',
          'Giao hàng: trong ngày ở Cần Thơ, các tỉnh 1–2 ngày',
        ],
      },
    ],
  },
  {
    slug: 'mau-thoitrang',
    name: 'Thời trang Phố Cổ (Mẫu)',
    owner: 'Anh Tuấn (Mẫu)',
    description:
      'Xưởng may nhỏ ở Hà Nội, tự thiết kế và may sẵn quần áo basic, chất liệu cotton và linen thoáng mát. Nhận đổi size trong 7 ngày. Đây là Kiot mẫu để thử web.',
    province: 'ha-noi',
    district: 'Hoàn Kiếm',
    color: ['#6366f1', '#ec4899'],
    caption: 'Áo thun mới về, đủ size #thoitrang #aothun #mau',
    promises: [
      'Ảnh sản phẩm do xưởng tự chụp, màu thật có thể đậm nhạt hơn một chút do màn hình.',
      'Đổi size miễn phí trong 7 ngày, sản phẩm còn tem mác và chưa giặt.',
      'Nhắn shop chiều cao, cân nặng để được tư vấn size trước khi đặt.',
    ],
    queries: { logo: 'clothing store', cover: 'clothing rack boutique', video: 'fashion clothes' },
    products: [
      {
        name: 'Áo thun cotton trơn unisex',
        price: 129_000,
        compareAtPrice: 159_000,
        stock: 300,
        category: 'thoi-trang',
        query: 'white t-shirt',
        intro:
          'Áo thun trơn form rộng vừa, cotton 100% định lượng 230gsm dày dặn, không xù lông, không bai cổ sau nhiều lần giặt. Mặc đi học, đi làm hay đi chơi đều hợp.',
        highlights: [
          'Cotton 100% 230gsm, thấm hút tốt',
          'Cổ bo dệt kim chắc chắn, không bai',
          '6 màu: trắng, đen, be, xám, xanh rêu, nâu',
          'Đường may 2 kim chắc chắn ở vai và gấu áo',
        ],
        spec: [
          'Chất liệu: cotton 100%',
          'Size: S, M, L, XL',
          'Sản xuất tại Việt Nam',
          'Định lượng: 230gsm',
          'Form: rộng vừa (relaxed fit)',
          'Màu: trắng, đen, be, xám, xanh rêu, nâu',
        ],
      },
      {
        name: 'Áo sơ mi linen tay ngắn',
        price: 249_000,
        compareAtPrice: null,
        stock: 80,
        category: 'thoi-trang',
        query: 'linen shirt',
        intro:
          'Sơ mi linen tay ngắn cổ bẻ, vải đũi pha linen mát, nhẹ, hợp thời tiết nóng. Form suông thoải mái, có thể sơ vin hoặc mặc ngoài. Đường may tỉ mỉ, đã giặt xử lý trước nên không co rút sau khi giặt.',
        highlights: [
          'Vải linen pha, mát và nhẹ',
          'Nút gỗ tự nhiên',
          'Ít nhăn hơn linen thường',
          'Đã giặt xử lý trước, không co rút',
          'Có túi ngực tiện dụng',
        ],
        spec: [
          'Chất liệu: 55% linen, 45% cotton',
          'Size: M, L, XL',
          'Màu: trắng ngà, xanh nhạt, be',
          'Form: suông',
          'Dài áo size L: 72cm',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Quần jean ống suông nữ',
        price: 299_000,
        compareAtPrice: 359_000,
        stock: 60,
        category: 'thoi-trang',
        query: 'women jeans',
        intro:
          'Quần jean ống suông lưng cao, tôn dáng và che khuyết điểm. Vải denim co giãn nhẹ, mặc cả ngày không bí. Đường chỉ chắc chắn, khoá kéo YKK, đi làm hay đi chơi đều dễ phối với áo thun, sơ mi.',
        highlights: [
          'Lưng cao, ống suông dài chấm gót',
          'Denim co giãn 2 chiều',
          'Wash màu xanh nhạt không phai',
          'Khoá kéo YKK bền, êm',
          'Có 5 túi tiện dụng',
        ],
        spec: [
          'Chất liệu: 98% cotton, 2% spandex',
          'Size: 26–32',
          'Dài quần: 100cm',
          'Màu: xanh nhạt, xanh đậm',
          'Form: lưng cao, ống suông',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Váy hoa nhí dáng dài',
        price: 319_000,
        compareAtPrice: null,
        stock: 45,
        category: 'thoi-trang',
        query: 'floral dress',
        intro:
          'Váy hoa nhí dáng dài cổ vuông, tay phồng nhẹ, chân váy xoè bay bổng. Vải voan lụa có lót, không lộ. Thiết kế nữ tính, dễ phối với sandal hay giày thể thao, hợp mặc cả mùa hè.',
        highlights: [
          'Có lớp lót trong',
          'Chun lưng sau co giãn, dễ mặc',
          'Hợp đi biển, dạo phố, chụp ảnh',
          'Tay phồng nhẹ che bắp tay',
        ],
        spec: [
          'Chất liệu: voan lụa, lót cotton',
          'Size: S, M, L',
          'Dài váy: 115cm',
          'Màu: hoa nhí nền trắng, nền xanh',
          'Form: chân váy xoè',
          'Có khoá kéo ẩn sau lưng',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Áo khoác gió 2 lớp',
        price: 389_000,
        compareAtPrice: 450_000,
        stock: 70,
        category: 'thoi-trang',
        query: 'windbreaker jacket',
        intro:
          'Áo khoác gió 2 lớp chống nước nhẹ, cản gió tốt, lớp lót lưới thoáng khí. Có mũ tháo rời và túi khoá kéo an toàn. Hợp đi xe máy, đi phượt hay mặc khi trời chuyển mưa.',
        highlights: [
          'Chống nước nhẹ, cản gió',
          'Mũ tháo rời được',
          '2 túi khoá kéo và 1 túi trong',
          'Gấp gọn vào túi trong, dễ mang theo khi đi xa',
        ],
        spec: [
          'Chất liệu: vải dù polyester, lót lưới',
          'Size: M, L, XL, XXL',
          'Màu: đen, xanh navy, xám',
          'Chống nước: mưa nhỏ, mưa phùn',
          'Khối lượng: khoảng 380g',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Túi tote vải canvas',
        price: 99_000,
        compareAtPrice: null,
        stock: 120,
        category: 'thoi-trang',
        query: 'canvas tote bag',
        intro:
          'Túi tote canvas dày, đựng vừa laptop 14 inch, sách vở và đồ cá nhân. Có túi nhỏ bên trong và khoá kéo miệng túi. Đường may viền chắc chắn, quai được may gia cố ở 2 điểm chịu lực nên xách nặng không bung.',
        highlights: [
          'Canvas 12oz dày, đứng form',
          'Khoá kéo miệng túi',
          'Quai dài đeo vai thoải mái',
          'Có túi nhỏ bên trong đựng điện thoại, chìa khoá',
        ],
        spec: [
          'Kích thước: 38 × 42 × 10cm',
          'Chất liệu: canvas cotton',
          'Tải trọng: đến 8kg',
          'Dài quai: 60cm',
          'Màu: kem, đen, xanh rêu',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Mũ bucket thêu chữ',
        price: 79_000,
        compareAtPrice: 99_000,
        stock: 90,
        category: 'thoi-trang',
        query: 'bucket hat',
        intro:
          'Mũ bucket vành vừa, thêu chữ nổi phía trước, che nắng tốt, gấp gọn bỏ túi được. Đường may viền vành chắc, giặt nhiều lần vẫn giữ form, hợp đi chơi, đi biển, đi phượt.',
        highlights: [
          'Vải kaki cotton thoáng',
          'Thêu nổi sắc nét',
          'Gấp gọn không nhăn',
          'Vành 6cm che nắng mặt và gáy',
        ],
        spec: [
          'Vòng đầu: 56–58cm',
          'Màu: đen, be, xanh lá',
          'Chất liệu: kaki cotton',
          'Độ rộng vành: 6cm',
          'Size: free size',
          'Sản xuất tại Việt Nam',
        ],
      },
    ],
  },
  {
    slug: 'mau-mypham',
    name: 'Mỹ phẩm Thiên Nhiên (Mẫu)',
    owner: 'Chị Hoa (Mẫu)',
    description:
      'Mỹ phẩm handmade từ nguyên liệu thiên nhiên Việt Nam: nghệ, bồ kết, sáp ong, hoa hồng. Sản xuất tại xưởng ở TP.HCM, có phiếu công bố mỹ phẩm. Đây là Kiot mẫu để thử web.',
    province: 'tp-ho-chi-minh',
    district: 'Quận 3',
    color: ['#f472b6', '#a855f7'],
    caption: 'Son dưỡng môi từ sáp ong #mypham #sonduong #mau',
    promises: [
      'Sản xuất tại xưởng có phiếu công bố mỹ phẩm, ghi rõ ngày sản xuất trên bao bì.',
      'Không dùng chì, paraben, cồn khô hay hương liệu tổng hợp.',
      'Da kích ứng trong 7 ngày đầu: shop hoàn tiền, không cần gửi lại sản phẩm.',
    ],
    queries: { logo: 'cosmetics', cover: 'skincare products', video: 'skincare' },
    products: [
      {
        name: 'Son dưỡng môi sáp ong',
        price: 85_000,
        compareAtPrice: 110_000,
        stock: 200,
        category: 'my-pham',
        query: 'lip balm',
        intro:
          'Son dưỡng từ sáp ong nguyên chất, dầu dừa và vitamin E, giúp môi mềm, giảm nứt nẻ trong thời tiết hanh khô. Không màu, dùng được cả ngày và trước khi ngủ.',
        highlights: [
          'Sáp ong và dầu dừa nguyên chất',
          'Không chì, không hương liệu tổng hợp',
          'Dùng được cho cả nam và nữ',
          'Thỏi nhỏ gọn bỏ túi tiện mang theo',
        ],
        spec: [
          'Dung tích: 5g',
          'Thành phần: sáp ong, dầu dừa, bơ hạt mỡ, vitamin E',
          'Dạng: thỏi vặn',
          'Hạn dùng: 24 tháng từ ngày sản xuất',
          'Xuất xứ: TP.HCM',
          'Có phiếu công bố mỹ phẩm',
        ],
      },
      {
        name: 'Sữa rửa mặt nghệ tươi (150ml)',
        price: 125_000,
        compareAtPrice: null,
        stock: 150,
        category: 'my-pham',
        query: 'facial cleanser',
        intro:
          'Sữa rửa mặt chiết xuất nghệ tươi, tạo bọt mịn, làm sạch dầu thừa mà không gây khô căng. Hợp da dầu và da hỗn hợp. Chỉ cần một lượng nhỏ bằng hạt đậu là đủ cho cả mặt, mỗi chai dùng được khoảng 2 tháng.',
        highlights: [
          'pH 5,5 dịu nhẹ',
          'Chiết xuất nghệ giúp da sáng đều màu',
          'Không chứa xà phòng (SLS)',
          'Dùng được khoảng 2 tháng',
        ],
        spec: [
          'Dung tích: 150ml',
          'Dùng 2 lần mỗi ngày, sáng và tối',
          'Loại da: da dầu, da hỗn hợp',
          'Thành phần chính: chiết xuất nghệ, glycerin, lô hội',
          'Xuất xứ: TP.HCM',
          'Có phiếu công bố mỹ phẩm',
        ],
      },
      {
        name: 'Nước hoa hồng không cồn (200ml)',
        price: 159_000,
        compareAtPrice: 189_000,
        stock: 90,
        category: 'my-pham',
        query: 'toner bottle skincare',
        intro:
          'Toner chưng cất từ cánh hoa hồng Đà Lạt, không cồn, cân bằng độ ẩm và làm dịu da sau khi rửa mặt. Dùng sau bước rửa mặt để giúp da hấp thụ serum và kem dưỡng tốt hơn.',
        highlights: [
          'Không cồn, không gây khô da',
          'Hương hoa hồng tự nhiên',
          'Dùng được cho da nhạy cảm',
          'Giúp các bước dưỡng sau thấm tốt hơn',
        ],
        spec: [
          'Dung tích: 200ml',
          'Thoa bằng bông tẩy trang hoặc vỗ nhẹ bằng tay',
          'Loại da: mọi loại da, kể cả da nhạy cảm',
          'Thành phần chính: nước cất hoa hồng, lô hội, glycerin',
          'Xuất xứ: TP.HCM',
          'Có phiếu công bố mỹ phẩm',
        ],
      },
      {
        name: 'Kem chống nắng SPF50 (50ml)',
        price: 219_000,
        compareAtPrice: null,
        stock: 75,
        category: 'my-pham',
        query: 'sunscreen',
        intro:
          'Kem chống nắng phổ rộng SPF50 PA++++, kết cấu mỏng nhẹ, thấm nhanh, không để lại vệt trắng. Nâng tông nhẹ, thay được kem lót.',
        highlights: [
          'SPF50 PA++++ chống tia UVA/UVB',
          'Không gây bết dính',
          'Bôi lại sau mỗi 2–3 giờ khi ra nắng',
          'Không gây cay mắt khi ra mồ hôi',
        ],
        spec: [
          'Dung tích: 50ml',
          'Dùng bước cuối của chu trình dưỡng da buổi sáng',
          'Chỉ số: SPF50 PA++++',
          'Loại da: mọi loại da',
          'Xuất xứ: TP.HCM',
          'Có phiếu công bố mỹ phẩm',
        ],
      },
      {
        name: 'Dầu gội bồ kết (300ml)',
        price: 99_000,
        compareAtPrice: 120_000,
        stock: 130,
        category: 'my-pham',
        query: 'shampoo bottle',
        intro:
          'Dầu gội bồ kết, vỏ bưởi và hương nhu theo công thức truyền thống, giúp sạch gàu, giảm gãy rụng, tóc mềm mượt tự nhiên. Dầu gội ít bọt hơn dầu gội thông thường vì không dùng chất tạo bọt mạnh, nhưng vẫn sạch tóc và da đầu.',
        highlights: [
          'Bồ kết, vỏ bưởi, hương nhu',
          'Không silicon, không paraben',
          'Hương thảo mộc dễ chịu',
          'Phù hợp cả tóc nhuộm, tóc yếu',
        ],
        spec: [
          'Dung tích: 300ml',
          'Gội 3–4 lần mỗi tuần để có kết quả tốt nhất',
          'Thành phần chính: bồ kết, vỏ bưởi, hương nhu, sả',
          'Loại tóc: mọi loại tóc',
          'Xuất xứ: TP.HCM',
        ],
      },
      {
        name: 'Mặt nạ đất sét (100g)',
        price: 139_000,
        compareAtPrice: null,
        stock: 60,
        category: 'my-pham',
        query: 'clay face mask',
        intro:
          'Mặt nạ đất sét kaolin kết hợp than tre, hút dầu và làm sạch sâu lỗ chân lông. Dùng 1–2 lần mỗi tuần. Kết cấu sệt mịn, dễ tán đều, khô vừa phải sau 10 phút mà không làm căng rát da.',
        highlights: [
          'Đất sét kaolin và than tre',
          'Giúp lỗ chân lông thông thoáng',
          'Rửa sạch dễ dàng, không khô căng',
          'Hũ 100g dùng được khoảng 20 lần',
        ],
        spec: [
          'Khối lượng: 100g',
          'Đắp 10–15 phút rồi rửa bằng nước ấm',
          'Loại da: da dầu, da hỗn hợp, da mụn',
          'Thành phần chính: đất sét kaolin, than tre, lô hội',
          'Xuất xứ: TP.HCM',
        ],
      },
    ],
  },
  {
    slug: 'mau-giadung',
    name: 'Gia dụng Tiện Ích (Mẫu)',
    owner: 'Anh Minh (Mẫu)',
    description:
      'Đồ gia dụng và phụ kiện điện thoại chính hãng, giá tốt cho gia đình. Bảo hành tại cửa hàng ở Đà Nẵng, hỗ trợ đổi mới trong 7 ngày. Đây là Kiot mẫu để thử web.',
    province: 'da-nang',
    district: 'Hải Châu',
    color: ['#0ea5e9', '#14b8a6'],
    caption: 'Nồi chiên không dầu cho gia đình #giadung #bep #mau',
    promises: [
      'Hàng chính hãng, có hoá đơn và phiếu bảo hành.',
      'Lỗi nhà sản xuất trong 7 ngày đầu: đổi sản phẩm mới, shop chịu phí gửi.',
      'Bảo hành trực tiếp tại cửa hàng ở Hải Châu, Đà Nẵng hoặc gửi qua bưu điện.',
    ],
    queries: { logo: 'kitchen utensils', cover: 'modern kitchen', video: 'kitchen cooking' },
    products: [
      {
        name: 'Nồi chiên không dầu 5 lít',
        price: 1_290_000,
        compareAtPrice: 1_590_000,
        stock: 25,
        category: 'do-gia-dung',
        query: 'air fryer',
        intro:
          'Nồi chiên không dầu dung tích 5 lít, đủ cho gia đình 4–5 người. Màn hình cảm ứng 8 chế độ nấu sẵn, giảm đến 80% dầu mỡ so với chiên truyền thống.',
        highlights: [
          'Dung tích 5 lít, nướng được gà nguyên con 1,2kg',
          '8 chế độ nấu cài sẵn, hẹn giờ 60 phút',
          'Lòng nồi chống dính, tháo rời rửa dễ',
          'Tự ngắt khi rút khay, an toàn cho gia đình',
        ],
        spec: [
          'Công suất: 1.500W',
          'Nhiệt độ: 80–200°C',
          'Bảo hành: 12 tháng',
          'Điện áp: 220V–50Hz',
          'Kích thước: 30 × 34 × 32cm',
          'Khối lượng: 4,8kg',
        ],
      },
      {
        name: 'Bình giữ nhiệt inox 500ml',
        price: 189_000,
        compareAtPrice: null,
        stock: 140,
        category: 'do-gia-dung',
        query: 'thermos bottle',
        intro:
          'Bình giữ nhiệt inox 304 hai lớp chân không, giữ nóng 12 giờ, giữ lạnh 24 giờ. Nắp vặn kín, không rò rỉ khi bỏ balo. Thân bình nhỏ gọn vừa hộc xe máy và túi bên hông balo.',
        highlights: [
          'Inox 304 an toàn thực phẩm',
          'Giữ nóng 12h, lạnh 24h',
          'Sơn tĩnh điện chống trầy',
          'Nắp có quai xách tiện mang theo',
        ],
        spec: [
          'Dung tích: 500ml',
          'Chiều cao: 24cm',
          'Màu: đen, trắng, xanh',
          'Chất liệu: inox 304, nắp nhựa PP không BPA',
          'Khối lượng: 300g',
          'Bảo hành: 12 tháng',
        ],
      },
      {
        name: 'Bộ hộp đựng thực phẩm 5 món',
        price: 159_000,
        compareAtPrice: 199_000,
        stock: 85,
        category: 'do-gia-dung',
        query: 'food storage containers',
        intro:
          'Bộ 5 hộp thuỷ tinh chịu nhiệt nắp gài 4 cạnh, dùng được trong lò vi sóng, tủ lạnh và tủ đông. Tiện chia phần ăn, mang cơm đi làm.',
        highlights: [
          'Thuỷ tinh chịu nhiệt -20°C đến 400°C',
          'Nắp gài kín có gioăng silicon',
          'Xếp chồng gọn trong tủ',
          'Không ám mùi, không bám màu thức ăn',
        ],
        spec: [
          'Dung tích: 2 hộp 370ml, 2 hộp 640ml, 1 hộp 1.040ml',
          'Nắp không dùng trong lò vi sóng',
          'Chất liệu: thuỷ tinh borosilicate, nắp nhựa PP không BPA',
          'Dùng được: lò vi sóng, lò nướng, tủ đông, máy rửa bát',
          'Bảo hành: 12 tháng',
        ],
      },
      {
        name: 'Tai nghe bluetooth chống ồn',
        price: 459_000,
        compareAtPrice: 590_000,
        stock: 50,
        category: 'dien-tu',
        query: 'wireless headphones',
        intro:
          'Tai nghe không dây chống ồn chủ động (ANC), pin 30 giờ, đàm thoại rõ với 4 micro. Kết nối bluetooth 5.3 ổn định, độ trễ thấp khi xem phim.',
        highlights: [
          'Chống ồn chủ động giảm đến 35dB',
          'Pin 30 giờ kèm hộp sạc',
          'Sạc nhanh 10 phút nghe 2 giờ',
          'Có chế độ xuyên âm để nghe tiếng xung quanh',
        ],
        spec: [
          'Bluetooth: 5.3',
          'Cổng sạc: Type-C',
          'Chống nước: IPX4',
          'Thời lượng pin: 8 giờ, kèm hộp sạc 30 giờ',
          'Khối lượng: 5g mỗi bên tai',
          'Bảo hành: 12 tháng',
        ],
      },
      {
        name: 'Sạc dự phòng 10.000mAh',
        price: 299_000,
        compareAtPrice: null,
        stock: 100,
        category: 'dien-tu',
        query: 'power bank',
        intro:
          'Sạc dự phòng 10.000mAh nhỏ gọn bằng thẻ ATM, sạc nhanh 20W cho iPhone và Android, sạc cùng lúc 2 thiết bị. Vỏ nhôm chắc chắn, mạch bảo vệ nhiều lớp, mang lên máy bay được.',
        highlights: [
          'Sạc nhanh PD 20W',
          'Màn hình hiển thị % pin',
          'Mạch bảo vệ quá nhiệt, quá dòng',
          'Mang lên máy bay được',
        ],
        spec: [
          'Dung lượng: 10.000mAh',
          'Cổng: 1 Type-C, 1 USB-A',
          'Khối lượng: 190g',
          'Công suất: 20W',
          'Kích thước: 9,5 × 6,3 × 2,3cm',
          'Bảo hành: 12 tháng',
        ],
      },
      {
        name: 'Cáp sạc nhanh Type-C 1m',
        price: 59_000,
        compareAtPrice: 79_000,
        stock: 400,
        category: 'dien-tu',
        query: 'usb cable',
        intro:
          'Cáp sạc Type-C bọc dù chống đứt, hỗ trợ sạc nhanh 60W và truyền dữ liệu tốc độ cao. Dùng được cho điện thoại Android, iPhone 15 trở lên, máy tính bảng và laptop có cổng Type-C.',
        highlights: [
          'Bọc dù, chịu được 10.000 lần gập',
          'Sạc nhanh đến 60W',
          'Đầu nhôm chắc chắn',
          'Tương thích iPhone 15 trở lên và Android',
        ],
        spec: [
          'Chiều dài: 1m',
          'Chuẩn: USB-C to USB-C',
          'Công suất: tối đa 60W',
          'Tốc độ truyền dữ liệu: 480Mbps',
          'Màu: đen, trắng',
          'Bảo hành: 12 tháng',
        ],
      },
      {
        name: 'Đèn ngủ cảm ứng để bàn',
        price: 149_000,
        compareAtPrice: null,
        stock: 65,
        category: 'do-gia-dung',
        query: 'bedside lamp',
        intro:
          'Đèn ngủ cảm ứng chạm, 3 mức sáng ánh vàng dịu mắt, pin sạc dùng 8–10 giờ. Hợp đặt đầu giường, phòng em bé. Thân đèn bằng nhựa ABS phủ sơn mờ, chân đế chống trượt, đặt cạnh giường hay bàn làm việc đều đẹp.',
        highlights: [
          'Chạm để bật/tắt, đổi độ sáng',
          'Ánh sáng vàng 3000K không chói',
          'Pin sạc Type-C',
          'Có chế độ hẹn giờ tắt 30 phút',
        ],
        spec: [
          'Kích thước: 12 × 12 × 18cm',
          'Pin: 1.800mAh',
          'Thời gian sạc: 2–3 giờ',
          'Nhiệt độ màu: 3000K',
          'Chất liệu: nhựa ABS',
          'Bảo hành: 12 tháng',
        ],
      },
    ],
  },
  {
    slug: 'mau-dacsan',
    name: 'Đặc sản Tây Bắc (Mẫu)',
    owner: 'Chú Sùng (Mẫu)',
    description:
      'Đặc sản vùng cao do bà con người Thái, người Mông ở Điện Biên làm thủ công: thịt trâu gác bếp, mật ong rừng, chè Shan tuyết, gạo nếp nương. Đây là Kiot mẫu để thử web.',
    province: 'dien-bien',
    district: 'Mường Thanh',
    color: ['#b45309', '#7c2d12'],
    caption: 'Thịt trâu gác bếp chuẩn vị Tây Bắc #dacsan #taybac #mau',
    promises: [
      'Sản phẩm do bà con trong bản làm thủ công, shop thu mua tận nơi.',
      'Không phẩm màu, không hàn the, không chất bảo quản.',
      'Không đúng mô tả: shop hoàn tiền 100%, không cần gửi lại hàng.',
    ],
    queries: { logo: 'mountain village', cover: 'rice terraces', video: 'honey' },
    products: [
      {
        name: 'Thịt trâu gác bếp (500g)',
        price: 450_000,
        compareAtPrice: 520_000,
        stock: 40,
        category: 'thuc-pham-dac-san',
        query: 'smoked meat',
        intro:
          'Thịt trâu bắp tươi tẩm mắc khén, hạt dổi, ớt rừng rồi hun khói trên gác bếp củi 7 ngày theo cách của người Thái. Thớ thịt dai, thơm mùi khói, càng nhai càng ngọt.',
        highlights: [
          '100% thịt trâu bắp, không pha thịt bò',
          'Hun khói củi tự nhiên 7 ngày',
          'Kèm 1 gói chẩm chéo chấm',
          'Có giấy chứng nhận an toàn thực phẩm',
        ],
        spec: [
          'Khối lượng: 500g (hút chân không)',
          'Hạn dùng: 6 tháng để ngăn đá, 1 tháng ngăn mát',
          'Nơi sản xuất: Điện Biên',
          'Thành phần: thịt trâu, mắc khén, hạt dổi, ớt, gừng, sả',
          'Cách dùng: nướng hoặc hấp 10 phút, xé sợi',
        ],
      },
      {
        name: 'Mật ong rừng nguyên chất (1 lít)',
        price: 380_000,
        compareAtPrice: null,
        stock: 30,
        category: 'thuc-pham-dac-san',
        query: 'honey jar',
        intro:
          'Mật ong rừng khai thác tự nhiên từ tổ ong khoái trên núi cao, màu nâu sẫm, vị ngọt đậm hơi đắng nhẹ ở hậu. Không pha đường, không nấu cô.',
        highlights: [
          'Khai thác tự nhiên, không nuôi',
          'Cam kết hoàn tiền nếu phát hiện pha trộn',
          'Đựng chai thuỷ tinh',
          'Có thể gửi kiểm nghiệm theo yêu cầu',
        ],
        spec: [
          'Dung tích: 1 lít (khoảng 1,4kg)',
          'Có thể kết tinh khi lạnh, đây là hiện tượng tự nhiên',
          'Màu: nâu sẫm',
          'Xuất xứ: rừng Mường Nhé, Điện Biên',
          'Hạn dùng: 24 tháng',
        ],
      },
      {
        name: 'Chè Shan tuyết cổ thụ (200g)',
        price: 260_000,
        compareAtPrice: 300_000,
        stock: 50,
        category: 'thuc-pham-dac-san',
        query: 'green tea leaves',
        intro:
          'Chè Shan tuyết hái từ những cây chè cổ thụ trăm năm tuổi trên độ cao 1.500m. Búp chè phủ lông tơ trắng, nước xanh vàng, vị chát dịu và hậu ngọt sâu.',
        highlights: [
          'Cây chè cổ thụ trên 100 năm tuổi',
          'Sao tay thủ công',
          'Pha được 5–6 nước',
          'Đóng túi hút chân không giữ hương',
        ],
        spec: [
          'Khối lượng: 200g',
          'Pha: 5g chè với 150ml nước 90°C, hãm 1–2 phút',
          'Độ cao vùng chè: 1.500m',
          'Xuất xứ: Tủa Chùa, Điện Biên',
          'Hạn dùng: 18 tháng',
        ],
      },
      {
        name: 'Lạp xưởng hun khói (500g)',
        price: 220_000,
        compareAtPrice: null,
        stock: 45,
        category: 'thuc-pham-dac-san',
        query: 'chinese sausage',
        intro:
          'Lạp xưởng làm từ thịt lợn bản thả đồi, tẩm rượu ngô và mắc khén, hun khói bếp củi. Vị đậm đà, thơm, không ngọt gắt như lạp xưởng miền xuôi.',
        highlights: [
          'Thịt lợn bản thả đồi',
          'Hun khói bếp củi',
          'Không phẩm màu, không hàn the',
          'Đóng túi hút chân không',
        ],
        spec: [
          'Khối lượng: 500g (khoảng 10 cây)',
          'Chiên, nướng hoặc hấp đều ngon',
          'Thành phần: thịt lợn bản, rượu ngô, mắc khén, muối, đường',
          'Xuất xứ: Điện Biên',
          'Hạn dùng: 3 tháng ngăn mát, 6 tháng ngăn đá',
        ],
      },
      {
        name: 'Gạo nếp nương (2kg)',
        price: 120_000,
        compareAtPrice: 140_000,
        stock: 70,
        category: 'nong-san',
        query: 'sticky rice',
        intro:
          'Gạo nếp nương trồng trên ruộng bậc thang, hạt tròn mẩy, đồ xôi dẻo thơm, để nguội vẫn mềm. Hợp nấu xôi, làm bánh chưng, ủ rượu.',
        highlights: [
          'Vụ mới, xay xát tại bản',
          'Dẻo thơm, không cần ngâm lâu',
          'Đóng túi hút chân không',
          'Không chất bảo quản, không tẩy trắng',
        ],
        spec: [
          'Khối lượng: 2kg',
          'Ngâm 4–6 giờ trước khi đồ xôi',
          'Giống: nếp nương bản địa',
          'Xuất xứ: Mường Ảng, Điện Biên',
          'Hạn dùng: 6 tháng từ ngày xay',
        ],
        care: [
          'Bảo quản nơi khô ráo, thoáng mát; sau khi mở túi buộc kín.',
          'Ngon nhất trong 6 tháng kể từ ngày xay.',
        ],
      },
      {
        name: 'Giỏ mây đan tay',
        price: 180_000,
        compareAtPrice: null,
        stock: 20,
        category: 'thu-cong-my-nghe',
        query: 'rattan basket',
        intro:
          'Giỏ mây đan tay bởi các nghệ nhân người Thái, dáng tròn có nắp, dùng đựng đồ, trang trí hoặc làm giỏ quà. Mây được luộc, phơi kỹ nên bền và chống mốc.',
        highlights: [
          'Đan tay 100%, mỗi giỏ mất 2 ngày',
          'Mây tự nhiên đã xử lý chống mốc',
          'Có nắp đậy và quai xách',
          'Mỗi giỏ là một sản phẩm độc bản',
        ],
        spec: [
          'Kích thước: đường kính 30cm, cao 25cm',
          'Màu: mây tự nhiên',
          'Chất liệu: mây rừng tự nhiên',
          'Khối lượng: khoảng 600g',
          'Xuất xứ: Điện Biên',
        ],
      },
    ],
  },
  {
    slug: 'mau-mevabe',
    name: 'Mẹ và Bé Xinh (Mẫu)',
    owner: 'Chị Mai (Mẫu)',
    description:
      'Cửa hàng đồ dùng cho mẹ và bé ở Hải Phòng: quần áo sơ sinh, bình sữa, đồ chơi gỗ an toàn, và đồ cho thú cưng trong nhà. Hàng có nguồn gốc rõ ràng. Đây là Kiot mẫu để thử web.',
    province: 'hai-phong',
    district: 'Lê Chân',
    color: ['#22c55e', '#facc15'],
    caption: 'Bộ đồ sơ sinh cotton mềm mịn #mevabe #sosinh #mau',
    promises: [
      'Hàng có nguồn gốc rõ ràng, có tem nhãn tiếng Việt.',
      'Kiểm tra từng sản phẩm trước khi gói, gói kín trong túi zip sạch.',
      'Mẹ cần tư vấn chọn size hay độ tuổi, nhắn shop trả lời trong giờ hành chính.',
    ],
    queries: { logo: 'baby', cover: 'nursery room', video: 'baby toys' },
    products: [
      {
        name: 'Bộ đồ sơ sinh cotton (3 bộ)',
        price: 189_000,
        compareAtPrice: 229_000,
        stock: 100,
        category: 'me-va-be',
        query: 'baby clothes',
        intro:
          'Set 3 bộ quần áo sơ sinh cotton organic, cài nút vai tiện thay đồ, đường may êm không cấn da bé. Hoạ tiết nhẹ nhàng, màu nhuộm an toàn.',
        highlights: [
          'Cotton organic mềm, thấm hút',
          'Cài nút vai, dễ mặc cho bé sơ sinh',
          'Không huỳnh quang, không formaldehyde',
          'Đóng túi zip riêng từng bộ, tiện làm quà',
        ],
        spec: [
          'Size: 0–3 tháng, 3–6 tháng, 6–12 tháng',
          'Gồm 3 áo và 3 quần',
          'Chất liệu: 100% cotton organic',
          'Màu: trắng kem, xanh nhạt, vàng nhạt',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Khăn sữa sợi tre (10 cái)',
        price: 99_000,
        compareAtPrice: null,
        stock: 160,
        category: 'me-va-be',
        query: 'muslin cloth baby',
        intro:
          'Khăn sữa sợi tre 4 lớp mềm mịn, thấm hút gấp 3 lần khăn cotton, kháng khuẩn tự nhiên, nhanh khô. Mềm và dịu nhẹ cho làn da mỏng của trẻ sơ sinh, giặt máy được.',
        highlights: [
          'Sợi tre kháng khuẩn tự nhiên',
          'Mềm hơn sau mỗi lần giặt',
          'Đa năng: lau miệng, lau người, quàng cổ',
          'Giặt máy được, nhanh khô',
        ],
        spec: [
          'Kích thước: 30 × 30cm',
          'Gói 10 cái nhiều màu',
          'Chất liệu: 70% sợi tre, 30% cotton',
          'Số lớp: 4 lớp',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Bình sữa thuỷ tinh 240ml',
        price: 249_000,
        compareAtPrice: 289_000,
        stock: 55,
        category: 'me-va-be',
        query: 'baby bottle',
        intro:
          'Bình sữa thuỷ tinh borosilicate cổ rộng, núm ti silicon mềm mô phỏng ti mẹ, van chống đầy hơi giúp bé bú êm. Thuỷ tinh không giữ mùi sữa, dùng lâu vẫn trong như mới.',
        highlights: [
          'Thuỷ tinh chịu nhiệt, không BPA',
          'Van chống sặc và đầy hơi',
          'Cổ rộng dễ pha sữa, dễ vệ sinh',
          'Tiệt trùng được bằng nước sôi và máy tiệt trùng',
        ],
        spec: [
          'Dung tích: 240ml',
          'Kèm núm ti size M (3–6 tháng)',
          'Chất liệu: thuỷ tinh borosilicate, núm ti silicon',
          'Chịu nhiệt: -20°C đến 120°C',
          'Xuất xứ: Hàn Quốc',
        ],
      },
      {
        name: 'Đồ chơi gỗ xếp hình',
        price: 159_000,
        compareAtPrice: null,
        stock: 70,
        category: 'me-va-be',
        query: 'wooden toys',
        intro:
          'Bộ đồ chơi gỗ xếp hình 30 chi tiết nhiều màu, giúp bé phát triển tư duy hình khối và khéo léo đôi tay. Gỗ tự nhiên, sơn gốc nước an toàn.',
        highlights: [
          'Gỗ thông tự nhiên, bo tròn cạnh',
          'Sơn gốc nước an toàn cho bé',
          'Kèm hộp gỗ đựng gọn gàng',
          'Đạt tiêu chuẩn an toàn đồ chơi trẻ em',
        ],
        spec: [
          'Số chi tiết: 30',
          'Độ tuổi: từ 18 tháng',
          'Chất liệu: gỗ thông, sơn gốc nước',
          'Kích thước hộp: 25 × 25 × 8cm',
          'Sản xuất tại Việt Nam',
        ],
      },
      {
        name: 'Thức ăn hạt cho mèo (1,5kg)',
        price: 179_000,
        compareAtPrice: 199_000,
        stock: 90,
        category: 'thu-cung',
        query: 'cat food',
        intro:
          'Hạt cho mèo mọi lứa tuổi vị cá hồi, bổ sung taurine tốt cho mắt và tim, omega 3–6 giúp lông mượt. Hạt nhỏ dễ ăn, giảm mùi phân.',
        highlights: [
          'Vị cá hồi mèo thích',
          'Bổ sung taurine, omega 3–6',
          'Giảm búi lông và mùi phân',
          'Túi zip kín giữ hạt luôn giòn',
        ],
        spec: [
          'Khối lượng: 1,5kg',
          'Khẩu phần: 40–60g mỗi ngày cho mèo 3–5kg',
          'Thành phần chính: cá hồi, gạo, ngô, dầu cá',
          'Độ đạm: 32%',
          'Hạn dùng: 18 tháng',
        ],
      },
      {
        name: 'Sách tô màu cho bé',
        price: 45_000,
        compareAtPrice: null,
        stock: 200,
        category: 'sach-van-phong-pham',
        query: 'coloring book',
        intro:
          'Sách tô màu 48 trang chủ đề con vật, trái cây và phương tiện giao thông, nét vẽ to rõ, giấy dày không thấm màu sang trang sau. Mỗi trang có tên con vật bằng tiếng Việt và tiếng Anh, giúp bé vừa tô vừa học từ mới.',
        highlights: [
          '48 trang, 4 chủ đề',
          'Giấy dày 120gsm',
          'Có hình mẫu tô màu ở mỗi trang',
          'Song ngữ Việt – Anh',
        ],
        spec: [
          'Khổ: A4',
          'Độ tuổi: 3–6 tuổi',
          'Số trang: 48',
          'Giấy: 120gsm',
          'Nhà xuất bản: NXB Mỹ thuật (mẫu)',
        ],
      },
      {
        name: 'Sữa tắm thảo dược cho bé',
        price: 135_000,
        compareAtPrice: 160_000,
        stock: 80,
        category: 'me-va-be',
        query: 'baby bath',
        intro:
          'Sữa tắm gội 2 trong 1 chiết xuất lá chè xanh, kim ngân và mướp đắng, giúp làm dịu rôm sảy, mẩn ngứa. Không cay mắt, an toàn cho bé từ sơ sinh.',
        highlights: [
          'Thảo dược thiên nhiên lành tính',
          'Không cay mắt, không xà phòng',
          'Dùng được cho bé sơ sinh',
          'Hương thơm nhẹ tự nhiên từ thảo mộc',
        ],
        spec: [
          'Dung tích: 250ml',
          'Pha 1 nắp với 5 lít nước ấm hoặc dùng trực tiếp',
          'Thành phần chính: lá chè xanh, kim ngân, mướp đắng',
          'Độ tuổi: từ sơ sinh',
          'Hạn dùng: 24 tháng',
        ],
      },
    ],
  },
];
