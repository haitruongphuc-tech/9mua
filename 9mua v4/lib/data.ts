// [DATA-V4] Dữ liệu mẫu theo tài liệu "9MUA-COM-V4-TAT-CA-TINH-NANG-DA-CHOT" - thay bằng Supabase khi có key

export type PageId = "home" | "explore" | "live" | "value" | "cart" | "wallet" | "profile" | "connect" | "ai" | "legal";

// [PAGE-01] -> [PAGE-10] 10 slogan, không trùng - CEO sửa tại /admin (tab Slogan)
export const DEFAULT_SLOGANS: Record<PageId, string> = {
  home: "Mở cổng thế giới - Một chạm là tới",
  explore: "Kiot nào cũng là showroom - 9MUA kết nối",
  live: "Nhìn thật - Mua thật - Người thật việc thật",
  value: "Tài khoản bạn đáng giá bao nhiêu? 9MUA tính ra tiền",
  cart: "Gom cả chợ vào một túi - Túi cam 9MUA",
  wallet: "Tiền về túi cam - An toàn như két",
  profile: "Mỗi Kiot là một thương hiệu - CEO đứng sau",
  connect: "6 mạng xã hội - 1 nơi quản",
  ai: "5 kỹ thuật - 9 AI - ArtCraft vẽ tương lai",
  legal: "99% AI vận hành - 1% CEO phê duyệt - Người thật",
};

export const PAGE_LABELS: Record<PageId, string> = {
  home: "Trang 01 - Home Feed", explore: "Trang 02 - Khám phá Kiot", live: "Trang 03 - Live & Story", value: "Trang 04 - Giá trị tài khoản",
  cart: "Trang 05 - Giỏ hàng & Deal", wallet: "Trang 06 - Ví & Thanh toán", profile: "Trang 07 - Hồ sơ Kiot", connect: "Trang 08 - Kết nối Social",
  ai: "Trang 09 - AI Studio", legal: "Trang 10 - Pháp lý",
};

export const BANK = { name: "MBBank", bin: "970422", account: "979393916", holder: "NGUYEN HAI", holderDisplay: "NGUYỄN HẢI", branch: "Chi nhánh Phú Thọ Hòa" };
export const USD_VND = 26000;
export const KIOT_PRICE_VND = USD_VND; // Kiot $1
export const CEO_APPROVAL_VND = 500 * USD_VND; // Rút > $500 cần CEO duyệt
export const FREE_DAILY_LIMIT = 50;

export const DEFAULT_LEGAL = {
  hq: "Lô 26, Đường ven biển Hamubay, Tiến Thành, Phan Thiết, Lâm Đồng (Bình Thuận cũ) - 100m2 - Trưng bày hàng thật",
  office: "115 Nguyễn Hậu, Phú Thọ Hòa, Tân Phú, HCM - Gần Nhà Thờ Tân Phú, Chợ Phú Thọ Hòa - Team dev ngồi đây",
};

export type Product = { id: string; kiotId: number; title: string; price: number; desc: string; ai?: boolean; technique?: string };
export type Kiot = {
  id: number; slug: string; name: string; owner: string; cat: string; location: string; color: string;
  views: string; likes: number; followers: number; hashtags: string[]; music: string; bio: string;
};

export const KIOTS: Kiot[] = [
  { id: 1, slug: "gom-bat-trang", name: "Kiot Gốm Bát Tràng", owner: "Cô Lan Bát Tràng", cat: "Thủ Công", location: "Hà Nội", color: "from-orange-400 to-red-500", views: "12.4K", likes: 2100, followers: 8400, hashtags: ["Kiot", "GomViet", "9MUA"], music: "Trống Cơm (Remix) - Trending", bio: "Gốm men lam thủ công 3 đời" },
  { id: 2, slug: "lua-hoi-an", name: "Kiot Vải Lụa Hội An", owner: "Anh Tú Hội An", cat: "Thời Trang", location: "Quảng Nam", color: "from-pink-400 to-rose-500", views: "8.7K", likes: 1500, followers: 5200, hashtags: ["Kiot", "LuaHoiAn", "9MUA"], music: "Hội An Phố - Lofi", bio: "Lụa tơ tằm may đo trong 24h" },
  { id: 3, slug: "ca-phe-dak-lak", name: "Kiot Cà Phê Đắk Lắk", owner: "Chị Mai Đắk Lắk", cat: "Nông Sản", location: "Đắk Lắk", color: "from-amber-600 to-orange-600", views: "15.2K", likes: 3800, followers: 12100, hashtags: ["Kiot", "CaPhe", "9MUA"], music: "Cà Phê Sáng - Acoustic", bio: "Robusta rang mộc, hái chín 100%" },
  { id: 4, slug: "hai-san-hamubay", name: "Kiot Hải Sản Hamubay", owner: "Chú Ba Hamubay", cat: "Hải Sản", location: "Hamubay", color: "from-cyan-500 to-blue-600", views: "22K", likes: 5200, followers: 18300, hashtags: ["Kiot", "Hamubay", "9MUA"], music: "Biển Hát - Chill", bio: "Showroom Lô 26 Hamubay - Hàng thật, live thật" },
  { id: 5, slug: "may-tre-hue", name: "Kiot Mây Tre Đan", owner: "Bà Sáu Huế", cat: "Thủ Công", location: "Huế", color: "from-lime-500 to-emerald-600", views: "6.3K", likes: 900, followers: 3100, hashtags: ["Kiot", "MayTre", "9MUA"], music: "Nam Ai - Ca Huế", bio: "Giỏ mây, đèn tre xuất khẩu" },
  { id: 6, slug: "xuong-go", name: "Kiot Xưởng Gỗ", owner: "Factory Link", cat: "Xưởng", location: "Bình Dương", color: "from-zinc-600 to-zinc-800", views: "18.5K", likes: 4100, followers: 9900, hashtags: ["Kiot", "XuongGo", "9MUA"], music: "Factory Beat", bio: "Nội thất gỗ giá xưởng" },
  { id: 7, slug: "trai-cay-mien-tay", name: "Kiot Trái Cây Miền Tây", owner: "Vườn Chín Miền Tây", cat: "Nông Sản", location: "Cần Thơ", color: "from-yellow-400 to-orange-500", views: "9.9K", likes: 2300, followers: 6700, hashtags: ["Kiot", "TraiCay", "9MUA"], music: "Miền Tây Quê Tôi", bio: "Trái cây chín cây, giao trong ngày" },
  { id: 8, slug: "viet-kieu-cali", name: "Kiot Việt Kiều Cali", owner: "Anh Việt Cali", cat: "Việt Kiều", location: "California", color: "from-blue-500 to-indigo-600", views: "31K", likes: 8900, followers: 31000, hashtags: ["Kiot", "VietKieu", "9MUA"], music: "Sài Gòn Đẹp Lắm", bio: "Hàng Mỹ xách tay chính hãng" },
];

const P = (kiotId: number, n: number, title: string, price: number, desc: string): Product => ({ id: `p${kiotId}-${n}`, kiotId, title, price, desc });
export const PRODUCTS: Product[] = [
  P(1, 1, "Bình gốm men lam", 350000, "Bình gốm Bát Tràng men lam vẽ tay, cao 30cm"),
  P(1, 2, "Bộ ấm chén hoa sen", 520000, "Bộ ấm 6 chén men rạn, hoa sen nổi"),
  P(2, 1, "Khăn lụa tơ tằm", 280000, "Khăn lụa Hội An 100% tơ tằm, 90x90cm"),
  P(2, 2, "Áo dài lụa may đo", 1450000, "Áo dài lụa tơ tằm, may đo trong 24h"),
  P(3, 1, "Robusta rang mộc 500g", 145000, "Cà phê Đắk Lắk rang mộc, hái chín"),
  P(3, 2, "Phin nhôm + cà phê 250g", 99000, "Combo phin nhôm và cà phê pha phin"),
  P(4, 1, "Mực một nắng 500g", 320000, "Mực một nắng Hamubay, giao lạnh"),
  P(4, 2, "Cá thu cắt khúc 1kg", 280000, "Cá thu tươi cắt khúc, hút chân không"),
  P(5, 1, "Giỏ mây đan tay", 180000, "Giỏ mây đan tay đựng đồ, size M"),
  P(6, 1, "Kệ gỗ thông 3 tầng", 650000, "Kệ gỗ thông lắp ráp, giá xưởng"),
  P(7, 1, "Xoài cát Hòa Lộc 2kg", 160000, "Xoài cát chín cây, giao trong ngày"),
  P(8, 1, "Vitamin tổng hợp Mỹ", 590000, "Hàng Mỹ xách tay, có bill"),
];

export const CATEGORIES = ["Tất cả", "Thủ Công", "Thời Trang", "Nông Sản", "Hải Sản", "Xưởng", "Việt Kiều"];
export const LOCATIONS = ["Mọi nơi", "Hamubay", "Hà Nội", "Đắk Lắk", "Huế", "Cần Thơ", "Quảng Nam", "Bình Dương", "California"];

export type Platform = "tiktok" | "facebook" | "instagram" | "youtube" | "shopee" | "zalo";
export const PLATFORMS: { id: Platform; name: string; color: string; max: number; api: string; fields: [string, string][] }[] = [
  { id: "tiktok", name: "TikTok", color: "bg-black", max: 300, api: "TikTok API", fields: [["followers", "Followers"], ["views", "Lượt xem"]] },
  { id: "facebook", name: "Facebook", color: "bg-[#1877F2]", max: 200, api: "Graph API", fields: [["followers", "Bạn bè + Followers"], ["engagement", "Tương tác TB/bài"]] },
  { id: "instagram", name: "Instagram", color: "bg-gradient-to-br from-fuchsia-500 to-orange-400", max: 250, api: "IG Basic Display", fields: [["followers", "Followers"]] },
  { id: "youtube", name: "YouTube", color: "bg-[#FF0000]", max: 150, api: "YouTube Data API", fields: [["followers", "Subscribers"], ["watch", "Giờ xem"]] },
  { id: "shopee", name: "Shopee", color: "bg-[#EE4D2D]", max: 30, api: "Shopee Open API", fields: [["reviews", "Đánh giá"], ["orders", "Đơn đã bán"]] },
  { id: "zalo", name: "Zalo", color: "bg-[#0068FF]", max: 21, api: "Zalo API (manual)", fields: [["followers", "Bạn bè"], ["engagement", "Tương tác"]] },
];

// [COMP-VALUE] Công thức $951 - mỗi nền tảng có mức trần
export function platformValue(id: Platform, v: Record<string, number>): number {
  const n = (k: string) => Math.max(0, Number(v[k]) || 0);
  const raw: Record<Platform, number> = {
    tiktok: n("followers") * 0.02 + n("views") * 0.001,
    facebook: n("followers") * 0.01 + n("engagement") * 5,
    instagram: n("followers") * 0.03,
    youtube: n("followers") * 0.05 + n("watch") * 0.1,
    shopee: n("reviews") * 2 + n("orders") * 0.5,
    zalo: n("followers") * 0.01 + n("engagement") * 0.05,
  };
  const max = PLATFORMS.find((p) => p.id === id)!.max;
  return Math.min(max, Math.round(raw[id] * 100) / 100);
}

// Số liệu mẫu suy ra từ handle (khi chưa có API thật)
export function mockStats(id: Platform, handle: string): Record<string, number> {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (min: number, max: number, salt: number) => min + ((h >> salt) % (max - min));
  const base: Record<Platform, Record<string, number>> = {
    tiktok: { followers: r(800, 15000, 1), views: r(20000, 300000, 3) },
    facebook: { followers: r(500, 5000, 2), engagement: r(5, 40, 4) },
    instagram: { followers: r(400, 9000, 5) },
    youtube: { followers: r(100, 3000, 6), watch: r(50, 1500, 7) },
    shopee: { reviews: r(2, 15, 8), orders: r(5, 60, 9) },
    zalo: { followers: r(200, 2000, 10), engagement: r(10, 400, 11) },
  };
  return base[id];
}

export const TECHNIQUES = [
  { id: "flat", name: "Flat Vector", cls: "from-orange-300 to-amber-200" },
  { id: "3d", name: "3D Isometric", cls: "from-indigo-500 to-cyan-400" },
  { id: "photo", name: "Photo Realistic", cls: "from-stone-600 to-stone-300" },
  { id: "sketch", name: "Hand Sketch", cls: "from-zinc-200 to-zinc-50" },
  { id: "neon", name: "Neon Glow", cls: "from-fuchsia-600 to-[#FF6B00]" },
];
export const AIS = ["ChatGPT-4o", "Claude 3.5 Sonnet", "Midjourney v6", "DALL-E 3", "Runway Gen-3", "ElevenLabs", "HeyGen", "Stable Diffusion XL", "Google Imagen"];

// [PAGE-ADMIN-AI] Mua AI từng tính năng $745/mo
export const AI_FEATURES = [
  { id: "chat", name: "AI Chat tư vấn Kiot", cost: 120, provider: "ChatGPT-4o + Claude 3.5", desc: "Trả lời khách tự động" },
  { id: "image", name: "AI Tạo ảnh sản phẩm", cost: 150, provider: "Midjourney + DALL-E 3", desc: "5 techniques ArtCraft" },
  { id: "video", name: "AI Video + Voice", cost: 180, provider: "Runway + ElevenLabs + HeyGen", desc: "Video bán hàng + giọng đọc 7 ngôn ngữ" },
  { id: "tts", name: "AI Dịch + TTS/STT Auto-Read", cost: 95, provider: "Google Cloud Translation + TTS", desc: "7 ngôn ngữ tự động" },
  { id: "feed", name: "AI Thuật toán Feed", cost: 100, provider: "Custom + Supabase Vector", desc: "Gợi ý như TikTok" },
  { id: "fraud", name: "AI Chống gian lận", cost: 100, provider: "Custom model", desc: "Phát hiện tim ảo, follow ảo" },
];

export const LANGS = [
  { id: "VI", label: "Tiếng Việt", tts: "vi-VN" },
  { id: "EN", label: "English", tts: "en-US" },
  { id: "ZH", label: "中文", tts: "zh-CN" },
  { id: "JA", label: "日本語", tts: "ja-JP" },
  { id: "KO", label: "한국어", tts: "ko-KR" },
  { id: "FR", label: "Français", tts: "fr-FR" },
  { id: "ES", label: "Español", tts: "es-ES" },
];

// Bản dịch sẵn cho 10 slogan mặc định (khi chưa bật AI Dịch)
export const SLOGAN_I18N: Record<string, Partial<Record<PageId, string>>> = {
  EN: { home: "Open the world gate - One tap away", explore: "Every Kiot is a showroom - 9MUA connects", live: "See real - Buy real - Real people", value: "What is your account worth? 9MUA turns it into money", cart: "The whole market in one bag - The 9MUA orange bag", wallet: "Money into the orange bag - Safe as a vault", profile: "Every Kiot is a brand - A CEO behind it", connect: "6 social networks - 1 place to manage", ai: "5 techniques - 9 AIs - ArtCraft draws the future", legal: "99% AI operated - 1% CEO approved - Real people" },
  ZH: { home: "打开世界之门 - 一触即达" },
  JA: { home: "世界への扉を開く - ワンタップで" },
  KO: { home: "세상의 문을 열다 - 한 번의 터치로" },
  FR: { home: "Ouvrez la porte du monde - À portée de doigt" },
  ES: { home: "Abre la puerta al mundo - A un toque" },
};

export const fmtVND = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
export const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);
export const kiotById = (id: number) => KIOTS.find((k) => k.id === id);
export const kiotBySlug = (slug: string) => KIOTS.find((k) => k.slug === slug);
export const productsOf = (kiotId: number, extra: Product[] = []) => [...PRODUCTS, ...extra].filter((p) => p.kiotId === kiotId);
