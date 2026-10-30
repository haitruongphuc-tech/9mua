import { db } from './db';

// Công tắc chức năng của đợt nâng cấp (docs/nang-cap-mot-dot.md mục 3, SPEC-admin.md V5.0). Lưu ở bảng Setting với khoá
// "feature.<tên>" = "on" | "off". Tắt thì nút, trang và API của nhóm đó ẩn hẳn (API trả 404); dữ liệu đã có giữ nguyên.
//
// needs: biến môi trường bắt buộc (dịch vụ ngoài). Mỗi phần tử là một khoá, hoặc mảng nghĩa là "chỉ cần một trong số này".
// Thiếu khoá thì không bật được và luôn coi là tắt.
type Feature = {
  label: string;
  codes: string;
  defaultOn: boolean;
  money?: boolean; // bật phải nhập mã xác thực 2 lớp
  reason?: string; // lý do tắt sẵn
  needs?: (string | string[])[];
};

const DEFS = {
  feed_tools: {
    label: 'Công cụ xem video (tua, tốc độ, xoay ngang, tự cuộn, lịch sử)',
    codes: 'C57–C61, C63',
    defaultOn: true,
  },
  share_more: {
    label: 'Tải về, nhúng, chia sẻ TikTok/Instagram, gửi qua Hộp thư',
    codes: 'C03–C05, C65',
    defaultOn: true,
  },
  post_options: {
    label: 'Nháp, hẹn giờ, quyền riêng tư, địa điểm, ghim, nhãn AI, sửa sau khi đăng',
    codes: 'C48–C50, C52–C56',
    defaultOn: true,
  },
  camera: {
    label: 'Quay trong app, hiệu ứng, Stitch, chỉnh video, âm thanh',
    codes: 'C08, C09, C89, C90',
    defaultOn: true,
  },
  long_video: {
    label: 'Video dài tới 60 phút, nhiều mức chất lượng',
    codes: 'C06, C07',
    defaultOn: false,
    reason: 'Cần kho video ngoài và đo thời gian xử lý trên VPS',
  },
  external_storage: {
    label: 'Kho video ngoài (R2 / S3)',
    codes: 'C06',
    defaultOn: false,
    reason: 'Chờ khoá',
    needs: [
      'STORAGE_S3_ENDPOINT',
      'STORAGE_S3_BUCKET',
      'STORAGE_S3_KEY',
      'STORAGE_S3_SECRET',
      'STORAGE_PUBLIC_URL',
    ],
  },
  auto_captions: {
    label: 'Phụ đề tự động',
    codes: 'C51',
    defaultOn: false,
    reason: 'Chờ khoá dịch vụ nghe giọng nói',
    needs: ['OPENAI_API_KEY'],
  },
  watch: { label: 'Watch — phim ngắn nhiều tập', codes: 'C02', defaultOn: true },
  posts: { label: 'Bài đăng ảnh + chữ, cảm xúc, đăng lại', codes: 'C86, C87, C88', defaultOn: true },
  groups: { label: 'Nhóm cộng đồng', codes: 'C91', defaultOn: true },
  points: { label: 'Điểm thưởng (cộng điểm, hiển thị)', codes: 'C01', defaultOn: true },
  points_exchange: {
    label: 'Đổi điểm ra xu',
    codes: 'C01',
    defaultOn: false,
    money: true,
    reason: 'Xu dùng thay tiền trong 9MUA',
  },
  xu_spend: {
    label: 'Dùng xu: gia hạn Kiot, đẩy video/live',
    codes: 'C94',
    defaultOn: false,
    money: true,
    reason: 'Xu thay tiền phí Kiot, giảm doanh thu tiền mặt',
  },
  social_more: {
    label: 'Bạn chung, gợi ý follow, tim bình luận, chặn, từ cấm, thông báo mới',
    codes: 'C23–C25, C62, C64, C66–C68',
    defaultOn: true,
  },
  events: { label: 'Sự kiện, Kỷ niệm', codes: 'C26', defaultOn: true },
  commitment: { label: 'Cam kết nội dung', codes: 'C10, C11', defaultOn: true },
  search_more: {
    label: 'Tìm Kiot, Gần tôi, gợi ý từ khoá, micro',
    codes: 'C12, C13, C38, C74',
    defaultOn: true,
  },
  map: {
    label: 'Bản đồ nhiệt',
    codes: 'C14',
    defaultOn: false,
    reason: 'Chờ khoá bản đồ',
    needs: ['MAP_TILE_URL'],
  },
  reviews: { label: 'Đánh giá sản phẩm, sao Kiot', codes: 'C15, C82', defaultOn: true },
  origin: { label: 'Hồ sơ nguồn gốc, huy hiệu', codes: 'C16, C17, C42', defaultOn: true },
  fake_report: { label: 'Tố cáo hàng giả (báo cáo, xử lý)', codes: 'C18', defaultOn: true },
  fake_report_refund: {
    label: 'Tố cáo hàng giả: hoàn tiền',
    codes: 'C18',
    defaultOn: false,
    money: true,
    reason: 'Đụng tiền',
  },
  ai_moderation: {
    label: 'AI kiểm duyệt',
    codes: 'C19',
    defaultOn: false,
    reason: 'Chờ khoá',
    needs: ['ANTHROPIC_API_KEY'],
  },
  strikes: { label: 'Lý do báo cáo mới, xử lý 3 lần, trang Kiểm duyệt', codes: 'C20–C22', defaultOn: true },
  kiot_builder: { label: 'Giao diện Kiot kéo thả, bảo hành', codes: 'C27, C29', defaultOn: true },
  page_import: {
    label: 'Nhập Page từ mạng xã hội',
    codes: 'C28',
    defaultOn: false,
    reason: 'Chờ khoá từng mạng',
    needs: [
      [
        'PAGEIMPORT_FACEBOOK_TOKEN',
        'PAGEIMPORT_YOUTUBE_KEY',
        'PAGEIMPORT_TIKTOK_KEY',
        'PAGEIMPORT_ZALO_TOKEN',
        'PAGEIMPORT_INSTAGRAM_TOKEN',
        'PAGEIMPORT_SHOPEE_KEY',
      ],
    ],
  },
  variants: {
    label: 'Biến thể sản phẩm (màu, cỡ)',
    codes: 'C83',
    defaultOn: false,
    money: true,
    reason: 'Đổi tồn kho, giỏ hàng, đơn hàng',
  },
  coupons: {
    label: 'Mã giảm giá, giảm giá theo giờ',
    codes: 'C84',
    defaultOn: false,
    money: true,
    reason: 'Đổi số tiền đơn',
  },
  carriers: {
    label: 'Giao hàng GHN/GHTK',
    codes: 'C31',
    defaultOn: false,
    money: true,
    reason: 'Đụng phí ship, chờ khoá',
    needs: [['GHN_TOKEN', 'GHTK_TOKEN']],
  },
  cod: {
    label: 'Thanh toán khi nhận hàng',
    codes: 'C85',
    defaultOn: false,
    money: true,
    reason: 'Đụng tiền',
  },
  play: { label: 'Vui chơi có thưởng', codes: 'C30', defaultOn: false, money: true, reason: 'Đụng tiền' },
  commission: {
    label: 'Hoa hồng creator',
    codes: 'C92',
    defaultOn: false,
    money: true,
    reason: 'Đụng tiền',
  },
  live_more: { label: 'Hẹn lịch live, người quản lý chat', codes: 'C77, C79', defaultOn: true },
  live_recording: { label: 'Xem lại buổi live', codes: 'C76', defaultOn: false, reason: 'Tốn ổ đĩa' },
  live_guest: { label: 'Mời khách cùng live', codes: 'C78', defaultOn: false, reason: 'Gấp đôi băng thông' },
  messages_more: { label: 'Nhắn nhóm, tin thoại, tin video, thu hồi', codes: 'C80, C81', defaultOn: true },
  account_more: {
    label: '@tên, tài khoản riêng tư, tự xoá, nhiều tài khoản',
    codes: 'C69–C71, C73',
    defaultOn: true,
  },
  apple_login: {
    label: 'Đăng nhập bằng Apple',
    codes: 'C72',
    defaultOn: false,
    reason: 'Chờ khoá',
    needs: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
  },
  site_more: {
    label: 'Nhãn cổng thế giới, Hướng dẫn, slogan trang mới, Pháp lý thêm',
    codes: 'C37, C39–C41',
    defaultOn: true,
  },
  ceo_finance: {
    label: 'Kanban, chi phí, Tài chính (chỉ CEO thấy)',
    codes: 'C43, C44, C47',
    defaultOn: true,
  },
  expense_autopay: {
    label: 'Trả chi phí tự động qua PayOS chi hộ',
    codes: 'C45',
    defaultOn: false,
    money: true,
    reason: 'Chuyển tiền công ty',
  },
  bank_feed: {
    label: 'Số dư, biến động tài khoản qua Casso',
    codes: 'C46',
    defaultOn: false,
    reason: 'Chờ khoá CAS',
    needs: ['CASSO_API_KEY', 'CASSO_WEBHOOK_SECRET'],
  },
} as const satisfies Record<string, Feature>;

export type FeatureName = keyof typeof DEFS;
export const FEATURES: Record<FeatureName, Feature> = DEFS;
export const FEATURE_NAMES = Object.keys(FEATURES) as FeatureName[];

const feature = (name: FeatureName): Feature => FEATURES[name];
const settingKey = (name: FeatureName) => `feature.${name}`;
export const isFeatureName = (v: string): v is FeatureName => v in FEATURES;

// Biến môi trường còn thiếu. Chế độ thử (TEST_MODE=e2e) dùng driver giả nên coi như đủ khoá.
export function missingKeys(name: FeatureName): string[] {
  if (process.env.TEST_MODE === 'e2e') return [];
  const has = (k: string) => Boolean(process.env[k]?.trim());
  return (feature(name).needs ?? []).flatMap((n) =>
    Array.isArray(n) ? (n.some(has) ? [] : [n.join(' | ')]) : has(n) ? [] : [n],
  );
}

function stateOf(name: FeatureName, stored: string | undefined): boolean {
  if (missingKeys(name).length) return false;
  return stored === undefined ? feature(name).defaultOn : stored === 'on';
}

export async function isFeatureOn(name: FeatureName): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: settingKey(name) } });
  return stateOf(name, row?.value);
}

export type FeatureState = {
  name: FeatureName;
  label: string;
  codes: string;
  on: boolean;
  defaultOn: boolean;
  money: boolean;
  reason: string | null;
  missing: string[];
};

export async function featureStates(): Promise<FeatureState[]> {
  const rows = await db.setting.findMany({ where: { key: { startsWith: 'feature.' } } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return FEATURE_NAMES.map((name) => {
    const f = feature(name);
    return {
      name,
      label: f.label,
      codes: f.codes,
      on: stateOf(name, stored.get(settingKey(name))),
      defaultOn: f.defaultOn,
      money: Boolean(f.money),
      reason: f.reason ?? null,
      missing: missingKeys(name),
    };
  });
}

// Ghi công tắc. Kiểm tra quyền, mã 2 lớp và nhật ký nằm ở module admin (setFeatureSwitch).
export async function saveFeature(name: FeatureName, on: boolean, actorId: string | null): Promise<void> {
  if (on && missingKeys(name).length) throw new Error('MISSING_KEYS');
  const key = settingKey(name);
  const value = on ? 'on' : 'off';
  await db.setting.upsert({
    where: { key },
    create: { key, value, updatedById: actorId },
    update: { value, updatedById: actorId },
  });
}

// Dùng ở route API: công tắc tắt thì trả 404 như route không tồn tại.
export async function featureGuard(name: FeatureName): Promise<Response | null> {
  return (await isFeatureOn(name)) ? null : new Response('Not Found', { status: 404 });
}
